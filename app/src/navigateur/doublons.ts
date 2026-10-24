// Étape « Doublons » pour tout le projet : rafales (local) puis, sur demande,
// analyse IA de chaque lot (script 06). Un lot est un dossier, ou une journée
// tant que le dossier à trier est en vrac (D54). Les propositions et les
// scènes sont enregistrées dans `.album/doublons.json` au fil de l'eau (règle
// d'or 7) ; les décisions de l'utilisateur, elles, sont dans le plan.

import { analyserDossier, cleVue, consigneSysteme, estimationDoublons, etageRafales, SCHEMA_VERIF, SCHEMA_VUE, type OutilsIA, type PhotoDoublon, type ResultatDossier } from '../lib/doublons';
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
  /**
   * Résultat de chaque lot analysé, par identifiant de lot (dossier, ou
   * « jour:AAAA-MM-JJ ») ; `modele` : le lot a été vu par l'IA (absent : rafales seules) ;
   * `signature` : ses photos à ce moment-là (un lot qui change est cherché de nouveau).
   */
  dossiers: Record<string, ResultatDossier & { photos: number; modele?: string; signature?: string }>;
}

/** Un lot de photos comparées entre elles : un dossier, ou une journée (dossier en vrac). */
export interface LotDoublons {
  id: string;
  nom: string;
}

const PREFIXE_JOUR = 'jour:';

function comparable(plan: Plan, f: FichierPlan): boolean {
  // Une photo écartée par cette étape reste dans son lot : une nouvelle recherche retrouve les mêmes
  // groupes, avec les décisions prises (D71). « Ne pas toucher » : ses photos ne sont pas comparées (D61).
  const enJeu = f.statut === 'archive' || (f.raison === 'doublons' && !!f.doublon);
  return enJeu && f.categorie === 'photo' && !f.capture && !nePasToucher(plan, f.dossier);
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

/** Empreinte courte des photos d'un lot (FNV-1a) : elle change si une photo entre ou sort du lot. */
export function signatureLot(photos: { id: string }[]): string {
  let h = 0x811c9dc5;
  for (const c of photos.map((p) => p.id).sort().join('\n')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${photos.length}:${h.toString(16)}`;
}

/**
 * Lots où chercher les rafales : jamais cherchés, ou dont les photos ont
 * changé (photos arrivées par une mise à jour de l'inventaire, D63 ; choix
 * changé à l'étape « Dossiers » ; photos floues écartées). Les autres gardent
 * leurs propositions, celles de l'IA comprises ; les décisions sont dans le plan.
 */
export function lotsAChercher(plan: Plan, etat: EtatDoublons | undefined, lots: string[], analyses: Analyses): string[] {
  return lots.filter((id) => {
    const avant = etat?.dossiers[id];
    if (!avant) return true;
    const photos = photosLot(plan, id, analyses);
    return avant.signature ? avant.signature !== signatureLot(photos) : avant.photos !== photos.length;
  });
}

/** Lots enregistrés qui n'existent plus (un dossier passé à « Ne pas toucher »…) : leurs groupes ne s'affichent plus. */
export function lotsDisparus(etat: EtatDoublons | undefined, lots: string[]): string[] {
  const actuels = new Set(lots);
  return Object.keys(etat?.dossiers ?? {}).filter((id) => !actuels.has(id));
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
    return { id: f.id, date: f.date, phash: a?.phash, nettete: a?.nettete };
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
  /** Tous les lots actuels : ceux qui n'y sont plus sont retirés. */
  actuels?: string[];
  strict: boolean;
  ia: { service: ServiceIA; modele: string } | null;
  miniature: (f: FichierPlan) => Promise<Blob>;
  original: (f: FichierPlan) => Promise<Blob>;
  progres: (faits: number, total: number, texte: string) => void;
  arreter: () => boolean;
}

/** Hauteur des miniatures du cache : au-delà, la planche part des originaux. */
const COTE_MINIATURE = 256;

/**
 * Analyse des lots demandés. `faits` : lots traités ; `arrete` : l'utilisateur
 * a arrêté avant la fin (les lots déjà traités sont gardés).
 */
export async function analyserDoublons(
  o: OptionsDoublons,
  precedent?: EtatDoublons,
): Promise<{ etat: EtatDoublons; budgetAtteint: boolean; erreurs: string[]; faits: number; arrete: boolean }> {
  const resultat: EtatDoublons = {
    version: 1,
    strict: o.ia ? o.strict : (precedent?.strict ?? o.strict),
    // Dernier modèle IA utilisé : une recherche de rafales seules ne l'efface pas.
    modele: o.ia?.modele ?? precedent?.modele ?? null,
    quand: new Date().toISOString(),
    // Les dossiers non relancés gardent leurs propositions ; ceux qui n'existent plus sont retirés.
    dossiers: Object.fromEntries(Object.entries(precedent?.dossiers ?? {}).filter(([id]) => !o.actuels || o.actuels.includes(id))),
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
      // Rafales seules sur un lot déjà vu par l'IA (des photos y sont arrivées) : ses scènes sont gardées, sans nouveau coût.
      const avant = precedent?.dossiers[d];
      const scenesIA = !o.ia && avant?.modele ? avant.propositions.filter((p) => p.source === 'ia') : [];
      const modele = o.ia?.modele ?? (scenesIA.length ? avant?.modele : undefined);
      resultat.dossiers[d] = { ...r, propositions: [...r.propositions, ...scenesIA], photos: photos.length, signature: signatureLot(photos), ...(modele && { modele }) };
    } catch (err) {
      if (err instanceof BudgetAtteint) budgetAtteint = true;
      else erreurs.push(t`${nom} : ${err instanceof Error ? err.message : String(err)}`);
    }
    faits++;
    o.progres(faits, o.dossiers.length, nom);
    ecriture = ecriture.then(() => o.etat.ecrire(FICHIER, resultat)).catch(() => undefined);
    await ecriture;
  });
  // Rien à chercher, mais des lots retirés : l'état allégé est enregistré quand même.
  if (!o.dossiers.length) await o.etat.ecrire(FICHIER, resultat).catch(() => undefined);
  return { etat: resultat, budgetAtteint, erreurs, faits, arrete: faits < o.dossiers.length && o.arreter() };
}
