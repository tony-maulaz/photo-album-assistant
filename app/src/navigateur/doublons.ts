// Étape « Doublons » pour tout le projet : rafales (local) puis, sur demande,
// analyse IA de chaque lot (script 06). Un lot est un dossier, ou une journée
// tant que le dossier à trier est en vrac (D54). Les propositions et les
// scènes sont enregistrées dans `.album/doublons.json` au fil de l'eau (règle
// d'or 7) ; les décisions de l'utilisateur, elles, sont dans le plan.

import { analyserDossier, cleVue, etatDoublon, consigneSysteme, estimationDoublons, etageRafales, SCHEMA_VERIF, SCHEMA_VUE, type OutilsIA, type PhotoDoublon, type ResultatDossier } from '../lib/doublons';
import { t } from '../lib/langue';
import { cheminDossier, contenu, gardeSaPlace, nePasToucher, type FichierPlan, type Plan } from '../lib/plan';
import { coutUSD, modele as infoModele } from '../lib/tarifs';
import { cleAnalyse, type Analyses } from './analyses';
import { BudgetAtteint, type ServiceIA } from './ia';
import { enBase64, fabriquerPlanche } from './planches';
import type { EtatProjet } from './projet';
import { enParallele } from './workers';

const FICHIER = 'doublons.json';

export interface EtatDoublons {
  version: 1;
  strict: boolean;
  /** Modèle utilisé, ou `null` pour les rafales seules. */
  modele: string | null;
  quand: string;
  /** Résultat de chaque lot analysé, par identifiant de lot (dossier, ou « jour:AAAA-MM-JJ »). */
  dossiers: Record<string, ResultatDossier & { photos: number }>;
}

/** Un lot de photos comparées entre elles : un dossier, ou une journée (dossier en vrac). */
export interface LotDoublons {
  id: string;
  nom: string;
}

const PREFIXE_JOUR = 'jour:';

function comparable(plan: Plan, f: FichierPlan): boolean {
  // « Ne pas toucher » : ses photos ne sont pas comparées (D61).
  return f.statut === 'archive' && f.categorie === 'photo' && !f.capture && !nePasToucher(plan, f.dossier);
}

/** Journée d'une photo ; « sans » si elle n'a pas de vraie date (date du fichier seulement). */
function jourDe(f: FichierPlan): string {
  return f.origineDate === 'fichier' ? 'sans' : (f.date?.slice(0, 10) ?? 'sans');
}

/** « 18.07.26 », ou « Sans date ». */
function nomJour(jour: string): string {
  return jour === 'sans' ? t`Sans date` : `${jour.slice(8, 10)}.${jour.slice(5, 7)}.${jour.slice(2, 4)}`;
}

export function nomLot(plan: Plan, lot: string): string {
  return lot.startsWith(PREFIXE_JOUR) ? nomJour(lot.slice(PREFIXE_JOUR.length)) : cheminDossier(plan, lot) || t`Photos (racine)`;
}

/**
 * Lots à analyser : les dossiers d'au moins deux photos ; `parJour`, pour un
 * dossier en vrac (une seule grande pile avant le tri), les photos à trier
 * regroupées par journée ; un dossier qui garde sa place forme son propre lot,
 * un dossier « Ne pas toucher » n'est pas comparé.
 */
export function lotsDoublons(plan: Plan, parJour: boolean): LotDoublons[] {
  const comptes = new Map<string, number>();
  for (const f of plan.fichiers.values()) {
    if (!comparable(plan, f)) continue;
    const lot = parJour && !gardeSaPlace(plan, f.dossier) ? `${PREFIXE_JOUR}${jourDe(f)}` : f.dossier;
    comptes.set(lot, (comptes.get(lot) ?? 0) + 1);
  }
  return [...comptes]
    .filter(([, n]) => n >= 2)
    .map(([id]) => ({ id, nom: nomLot(plan, id) }))
    .sort((a, b) => Number(b.id.startsWith(PREFIXE_JOUR)) - Number(a.id.startsWith(PREFIXE_JOUR)) || a.id.localeCompare(b.id));
}

/**
 * Lots à rechercher de nouveau après une mise à jour de l'inventaire (D63) :
 * ceux qui ont reçu des photos ajoutées depuis la dernière recherche. Les
 * autres gardent leurs propositions (celles de l'IA comprises).
 */
export function lotsANouveau(plan: Plan, etat: EtatDoublons, lots: string[], analyses: Analyses): string[] {
  return lots.filter((id) => photosLot(plan, id, analyses).some((p) => (plan.fichiers.get(p.id)?.ajout ?? '') > etat.quand));
}

export async function lireDoublons(etat: EtatProjet): Promise<EtatDoublons | undefined> {
  const lu = await etat.lire<EtatDoublons>(FICHIER).catch(() => undefined);
  return lu && lu.version === 1 && typeof lu.dossiers === 'object' ? lu : undefined;
}

/** Photos d'un lot (dossier ou journée), prêtes pour l'analyse des doublons. */
export function photosLot(plan: Plan, lot: string, analyses: Analyses): PhotoDoublon[] {
  const fichiers = lot.startsWith(PREFIXE_JOUR)
    ? [...plan.fichiers.values()]
        .filter((f) => comparable(plan, f) && !gardeSaPlace(plan, f.dossier) && jourDe(f) === lot.slice(PREFIXE_JOUR.length))
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id))
    : contenu(plan, lot).filter((f) => comparable(plan, f));
  return fichiers.map((f) => {
    const a = analyses.get(f);
    return { id: f.id, date: f.date, phash: a?.phash, nettete: a?.nettete, protegee: f.protegee };
  });
}

/** Clé de cache d'un appel IA7 (le modèle en fait partie : un autre modèle répond autrement). */
function cleIA(modele: string, cle: string): string {
  return `IA7|${modele}|${cle}`;
}

/**
 * Coût estimé de l'analyse IA des lots : les rafales sont retirées
 * d'abord (gratuit) ; un lot dont la vue d'ensemble est en cache ne coûte rien.
 */
export function estimerDoublons(plan: Plan, analyses: Analyses, dossiers: string[], modele: string, ia: ServiceIA): { usd: number; appels: number; dossiers: number; enCache: number } {
  const m = infoModele(modele);
  if (!m) return { usd: 0, appels: 0, dossiers: 0, enCache: 0 };
  const tailles: number[] = [];
  let enCache = 0;
  for (const d of dossiers) {
    const { restants } = etageRafales(photosLot(plan, d, analyses));
    if (restants.length < 2) continue;
    if (ia.enCache(cleIA(modele, cleVue(restants, (id) => cleAnalyse(plan.fichiers.get(id)!))))) enCache++;
    else tailles.push(restants.length);
  }
  const e = estimationDoublons(tailles, m);
  return { usd: e.usd, appels: e.appels, dossiers: tailles.length, enCache };
}

export interface OptionsDoublons {
  plan: Plan;
  etat: EtatProjet;
  analyses: Analyses;
  dossiers: string[];
  strict: boolean;
  ia: { service: ServiceIA; modele: string } | null;
  miniature: (f: FichierPlan) => Promise<Blob>;
  original: (f: FichierPlan) => Promise<Blob>;
  progres: (faits: number, total: number, texte: string) => void;
  arreter: () => boolean;
}

/** Hauteur des miniatures du cache : au-delà, la planche part des originaux. */
const COTE_MINIATURE = 256;

export async function analyserDoublons(o: OptionsDoublons, precedent?: EtatDoublons): Promise<{ etat: EtatDoublons; budgetAtteint: boolean; erreurs: string[] }> {
  const resultat: EtatDoublons = {
    version: 1,
    strict: o.strict,
    modele: o.ia?.modele ?? null,
    quand: new Date().toISOString(),
    // Les dossiers non relancés gardent leurs propositions.
    dossiers: { ...(precedent?.dossiers ?? {}) },
  };
  const erreurs: string[] = [];
  let budgetAtteint = false;
  let faits = 0;
  let ecriture: Promise<void> = Promise.resolve();
  o.progres(0, o.dossiers.length, '');
  // Trois dossiers à la fois : 2 à 4 appels simultanés (§ 7.2).
  await enParallele(o.dossiers, o.ia ? 3 : 1, async (d) => {
    if (o.arreter() || budgetAtteint) return;
    const nom = nomLot(o.plan, d);
    o.progres(faits, o.dossiers.length, nom);
    const photos = photosLot(o.plan, d, o.analyses);
    const fichier = (id: string) => o.plan.fichiers.get(id)!;
    const outils: OutilsIA | null = o.ia && {
      identite: (id) => cleAnalyse(fichier(id)),
      planche: async (ids, numeros, flous, opt) => {
        const source = opt.cellule <= COTE_MINIATURE ? o.miniature : o.original;
        const etiquettes = opt.etiquettes && new Map([...opt.etiquettes].map(([k, v]) => [String(k), v]));
        return enBase64(await fabriquerPlanche(ids.map((id) => () => source(fichier(id))), numeros, new Set([...flous].map(String)), { cellule: opt.cellule, colonnes: opt.colonnes, etiquettes }));
      },
      appeler: (type, planches, consigne, cle) =>
        o.ia!.service.appeler({
          fonction: 'IA7',
          modele: o.ia!.modele,
          systeme: consigneSysteme,
          planches,
          consigne,
          cle: cleIA(o.ia!.modele, cle),
          // Majorant pour la pause avant dépassement : 2200 jetons par planche, 1500 en sortie.
          estimationUSD: coutUSD(o.ia!.modele, { input_tokens: 1200 + 2200 * planches.length, output_tokens: 1500 }) ?? 0,
          schema: type === 'vue' ? SCHEMA_VUE : SCHEMA_VERIF,
          effort: 'medium',
        }),
    };
    try {
      const r = await analyserDossier(photos, outils, o.strict);
      // Les groupes déjà acceptés restent visibles (leurs doublons ne sont plus dans le dossier).
      const acceptes = (precedent?.dossiers[d]?.propositions ?? []).filter((p) => p.doublons.some((x) => etatDoublon(o.plan.fichiers.get(x.id)) === 'accepte'));
      resultat.dossiers[d] = { ...r, propositions: [...acceptes, ...r.propositions], photos: photos.length };
    } catch (err) {
      if (err instanceof BudgetAtteint) budgetAtteint = true;
      else erreurs.push(t`${nom} : ${err instanceof Error ? err.message : String(err)}`);
    }
    faits++;
    o.progres(faits, o.dossiers.length, nom);
    ecriture = ecriture.then(() => o.etat.ecrire(FICHIER, resultat)).catch(() => undefined);
    await ecriture;
  });
  return { etat: resultat, budgetAtteint, erreurs };
}
