// Aides IA de la sélection (IA8 à IA11) et de l'album (
// IA12 à IA15), SPEC § 6.9 et § 6.10. Elles notent, décrivent, remarquent et
// proposent ; elles ne cochent jamais rien (principe P5).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { demandesEtiquettes, demandesAppreciation, LIBELLES_DEFAUTS, LIBELLES_PERSONNES, LIBELLES_TYPES, demandeControleSelection, demandeMeilleure, estimerDemandes, lireAppreciation, lireControleSelection, lireEtiquettes, lireMeilleure, lotsPile, texteEtiquettes, type Appreciation, type DemandeIA, type Etiquettes, type PhotoIA, type Remarque } from '../../lib/aidesSelection';
import { demandeCouverture, demandeCouvertureTri, demandesControleAlbum, demandeTextes, lireControleAlbum, lireCouverture, lireCouvertureTri, lireTextes, LIBELLES_TONS, type RemarqueAlbum, type Ton } from '../../lib/aidesAlbum';
import { ordreAlbum, paginer, photosAlbum, sections, type Section } from '../../lib/album';
import { blocCalendrier, evenementsAutour } from '../../lib/ics';
import { cheminDossier, RACINE, type FichierPlan } from '../../lib/plan';
import { modele as infoModele } from '../../lib/tarifs';
import { titreDossier } from '../../navigateur/album';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerDemande } from '../../navigateur/executeur';
import { enParallele } from '../../navigateur/workers';
import { contexteExecution, evenements, session, versionIA, type Session } from '../etat';
import { pluriel } from '../format';
import { selection, vue } from '../organiser';
import { derniereMeilleure, montrerPhotos, photosVue } from '../selection';
import { Miniature } from '../composants/GrillePhotos';
import { ETAPE } from '../../navigateur/projet';
import { aTraduire, t } from '../../lib/langue';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs, type Usage } from './AidesIA';

// ---------------------------------------------------------------------------
// Outils communs
// ---------------------------------------------------------------------------

const NIVEAU: Record<DemandeIA['niveau'], Usage> = { rapide: 'rapide', standard: 'standard', avance: 'avance' };

function photoIA(_s: Session, f: FichierPlan): PhotoIA {
  return { id: f.id, identite: cleAnalyse(f), date: f.date, album: f.album };
}

/** Coût des demandes qui ne sont pas encore en cache. */
function estimer(s: Session, demandes: DemandeIA[]) {
  const aFaire = demandes.filter((d) => !s.ia.enCache(`${d.fonction}|${modeleDe(NIVEAU[d.niveau])}|${d.cle}`));
  if (!demandes.length) return null;
  const m = infoModele(modeleDe(NIVEAU[demandes[0].niveau]));
  const e = m ? estimerDemandes(aFaire, m) : { usd: 0, appels: 0 };
  return { usd: e.usd, appels: e.appels };
}

/**
 * Exécute des demandes (3 à la fois) et rend chaque réponse lue ; `garder`
 * reçoit chaque résultat aussitôt (pour l'enregistrer même si la suite
 * s'arrête). Un échec isolé est compté dans `bilan` et n'arrête pas les autres.
 */
async function executer<T>(
  s: Session,
  demandes: DemandeIA[],
  lire: (r: unknown, d: DemandeIA) => T,
  l: { progres: (f: number, t: number) => void; arreter: () => boolean },
  bilan: BilanEchecs,
  garder?: (x: { d: DemandeIA; r: T }) => void,
): Promise<{ d: DemandeIA; r: T }[]> {
  const ctx = contexteExecution(s);
  const resultats: { d: DemandeIA; r: T }[] = [];
  let faits = 0;
  await enParallele(demandes, 3, async (d) => {
    if (l.arreter()) return;
    const v = await essai(() => executerDemande(ctx, d, modeleDe(NIVEAU[d.niveau])), bilan);
    if (v !== undefined) {
      const x = { d, r: lire(v, d) };
      resultats.push(x);
      garder?.(x);
    }
    l.progres(++faits, demandes.length);
  });
  return resultats;
}

/** Photos visées par les aides de l'étape « Sélection » : celles de la vue (sortie choisie, ou tout le projet). */
function photosDeLaVue(s: Session): FichierPlan[] {
  return photosVue(s.plan, vue.value);
}

function nomVue(s: Session): string {
  return vue.value === RACINE ? t`tout le projet` : t`« ${cheminDossier(s.plan, vue.value)} »`;
}

// ---------------------------------------------------------------------------
// IA8 à IA11 — sélection
// ---------------------------------------------------------------------------

enregistrerAide({
  id: 'IA8',
  nom: aTraduire('Étiqueter les photos avec l’IA'),
  etape: ETAPE.selection,
  description: aTraduire('Pour chaque photo : personnes, type, défauts éventuels et courte description. Tout sert de filtre et à la recherche en langage naturel.'),
  envoi: aTraduire('chaque photo réduite à 768 px, 10 par appel'),
  web: false,
  usage: 'rapide',
  estimer: (s) => {
    const deja = s.aides.get<Record<string, Etiquettes>>('IA8') ?? {};
    const photos = photosDeLaVue(s).filter((f) => !deja[f.id]);
    if (!photos.length) return null;
    const e = estimer(s, demandesEtiquettes(photos.map((f) => photoIA(s, f)), { contexte: s.projet.contexte }));
    return e && { ...e, detail: t`${pluriel(photos.length, 'photo')} de ${nomVue(s)}` };
  },
  lancer: async (s, l) => {
    const deja = s.aides.get<Record<string, Etiquettes>>('IA8') ?? {};
    const photos = photosDeLaVue(s).filter((f) => !deja[f.id]);
    const ajouts: Record<string, Etiquettes> = {};
    const bilan: BilanEchecs = { echecs: 0 };
    try {
      await executer(s, demandesEtiquettes(photos.map((f) => photoIA(s, f)), { contexte: s.projet.contexte }), (r, d) => lireEtiquettes(r, d.ids), l, bilan, ({ r }) => {
        for (const [id, e] of r) ajouts[id] = e;
      });
    } finally {
      await s.aides.fusionner('IA8', ajouts);
    }
    return t`${pluriel(Object.keys(ajouts).length, 'photo étiquetée', 'photos étiquetées')} : filtres et recherche disponibles.${texteEchecs(bilan)}`;
  },
});

enregistrerAide({
  id: 'IA9',
  nom: aTraduire('Apprécier les photos avec l’IA'),
  etape: ETAPE.selection,
  description: aTraduire('Note indicative de qualité (composition, expressions, lumière), avec une phrase. Sert à trier, jamais à cocher.'),
  envoi: aTraduire('les photos en 1024 px, 6 par appel'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const deja = s.aides.get<Record<string, Appreciation>>('IA9') ?? {};
    const photos = photosDeLaVue(s).filter((f) => !deja[f.id]);
    if (!photos.length) return null;
    const e = estimer(s, demandesAppreciation(photos.map((f) => photoIA(s, f)), { contexte: s.projet.contexte }));
    return e && { ...e, detail: t`${pluriel(photos.length, 'photo')} de ${nomVue(s)}` };
  },
  lancer: async (s, l) => {
    const deja = s.aides.get<Record<string, Appreciation>>('IA9') ?? {};
    const photos = photosDeLaVue(s).filter((f) => !deja[f.id]);
    const ajouts: Record<string, Appreciation> = {};
    const bilan: BilanEchecs = { echecs: 0 };
    try {
      await executer(s, demandesAppreciation(photos.map((f) => photoIA(s, f)), { contexte: s.projet.contexte }), (r, d) => lireAppreciation(r, d.ids), l, bilan, ({ r }) => {
        for (const [id, a] of r) ajouts[id] = a;
      });
    } finally {
      await s.aides.fusionner('IA9', ajouts);
    }
    return t`${pluriel(Object.keys(ajouts).length, 'photo appréciée', 'photos appréciées')} : triez « par appréciation ».${texteEchecs(bilan)}`;
  },
});

/** Photos choisies pour la meilleure de la pile : 2 à 6 photos sélectionnées. */
function pileChoisie(s: Session): FichierPlan[] {
  const ids = [...selection.value];
  return ids.length >= 2 && ids.length <= 12 ? ids.map((id) => s.plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f) : [];
}

enregistrerAide({
  id: 'IA10',
  nom: aTraduire('Meilleure de la sélection (IA)'),
  etape: ETAPE.selection,
  description: aTraduire('Parmi 2 à 12 photos semblables sélectionnées (une pile), l’IA indique celle qu’elle préférerait et pourquoi ; vous gardez la main.'),
  siRien: aTraduire('sélectionnez 2 à 12 photos semblables'),
  selectionDependante: true,
  envoi: aTraduire('les photos de la pile en 1024 px'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const pile = pileChoisie(s);
    if (!pile.length) return null;
    const lotsP = lotsPile(pile.map((f) => photoIA(s, f)));
    const e = estimer(s, lotsP.map((lot) => demandeMeilleure(lot, { contexte: s.projet.contexte })));
    return e && { ...e, appels: e.appels + (lotsP.length > 1 ? 1 : 0), detail: pluriel(pile.length, 'photo') };
  },
  lancer: async (s, l) => {
    const pile = pileChoisie(s).map((f) => photoIA(s, f));
    // Au-delà de 6 photos : la meilleure de chaque lot, puis un second tour entre les gagnantes.
    let candidates = pile;
    let finale = null as ReturnType<typeof lireMeilleure>;
    const bilan: BilanEchecs = { echecs: 0 };
    while (candidates.length) {
      const res = await executer(s, lotsPile(candidates).map((lot) => demandeMeilleure(lot, { contexte: s.projet.contexte })), (r, d) => lireMeilleure(r, d.ids), l, bilan);
      const gagnantes = res.map((x) => x.r).filter((x): x is NonNullable<typeof x> => !!x);
      if (gagnantes.length <= 1) {
        finale = gagnantes[0] ?? null;
        break;
      }
      candidates = pile.filter((p) => gagnantes.some((g) => g.id === p.id));
    }
    if (!finale) return t`Réponse inexploitable : rien à proposer.${texteEchecs(bilan)}`;
    await s.aides.fusionner('IA10', { [finale.id]: { justification: finale.justification, pile: pile.map((p) => p.id) } });
    // La photo elle-même, pas son nom de fichier : sélectionnée, amenée à l'écran et montrée dans le panneau.
    derniereMeilleure.value = finale.id;
    resultatArrive.value = 'IA10';
    montrerPhotos([finale.id]);
    return t`L’IA préfère la photo maintenant sélectionnée : ${finale.justification}`;
  },
});

enregistrerAide({
  id: 'IA11',
  nom: aTraduire('Contrôler la sélection de cette sortie (IA)'),
  etape: ETAPE.selection,
  description: aTraduire('Relecture des photos retenues d’une sortie : redondances, moments manquants, photos faibles. Uniquement des remarques.'),
  siRien: aTraduire('choisissez une sortie avec des photos retenues'),
  envoi: aTraduire('planches des photos retenues et des autres photos de la sortie'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    if (vue.value === RACINE) return null;
    const d = demandeControle(s);
    return d ? estimer(s, [d]) : null;
  },
  lancer: async (s, l) => {
    // Sortie et demande notées avant l'appel : l'utilisateur peut changer de sortie pendant qu'il dure.
    const sortie = vue.value;
    const nom = nomVue(s);
    const d = demandeControle(s, sortie);
    if (!d) return t`Aucune photo retenue dans cette sortie.`;
    // Nombre de photos retenues réellement envoyées (48 au plus) : les numéros suivants sont des « autres ».
    const k = d.ids.filter((id) => (s.plan.fichiers.get(id)?.album ?? 0) > 0).length;
    const bilan: BilanEchecs = { echecs: 0 };
    const [res] = await executer(s, [d], (r) => lireControleSelection(r, d.ids, k), l, bilan);
    if (res) {
      await s.aides.fusionner('IA11', { [sortie]: res.r });
      resultatArrive.value = 'IA11';
    }
    return t`${pluriel(res?.r.length ?? 0, 'remarque')} sur la sélection de ${nom}.${texteEchecs(bilan)}`;
  },
});

function demandeControle(s: Session, sortie = vue.value) {
  const photos = photosVue(s.plan, sortie);
  const retenues = photos.filter((f) => (f.album ?? 0) > 0).map((f) => photoIA(s, f));
  const autres = photos.filter((f) => !f.album).map((f) => photoIA(s, f));
  return demandeControleSelection(retenues, autres, { sortie: cheminDossier(s.plan, sortie), contexte: s.projet.contexte });
}

/** Résultats IA de la sélection, pour les badges, filtres et tris de l'étape « Sélection ». */
export function resultatsSelection(s: Session) {
  return {
    etiquettes: s.aides.get<Record<string, Etiquettes>>('IA8') ?? {},
    appreciations: s.aides.get<Record<string, Appreciation>>('IA9') ?? {},
    meilleures: s.aides.get<Record<string, { justification: string }>>('IA10') ?? {},
    controles: s.aides.get<Record<string, Remarque[]>>('IA11') ?? {},
  };
}

export { texteEtiquettes };

/** Ce que l'IA dit d'une photo (étiquettes, description, appréciation, conseil), en lignes lisibles. */
export function lignesIA(s: Session, id: string): string[] {
  const r = resultatsSelection(s);
  const lignes: string[] = [];
  const e = r.etiquettes[id];
  if (e) {
    if (e.description) lignes.push(t`« ${e.description} »`);
    const details = [e.personnes ? t(LIBELLES_PERSONNES[e.personnes]) : '', e.type ? t(LIBELLES_TYPES[e.type]) : '', ...e.defauts.map((d) => t(LIBELLES_DEFAUTS[d]))].filter(Boolean);
    if (details.length) lignes.push(details.join(' · '));
  }
  const a = r.appreciations[id];
  if (a) lignes.push(t`Appréciation IA : ${a.note}/10${a.pleinePage ? t` (grande photo)` : ''} — ${a.justification}`);
  const m = r.meilleures[id];
  if (m) lignes.push(t`Meilleure de sa pile selon l’IA : ${m.justification}`);
  return lignes;
}

/** Aide de la sélection dont le résultat vient d'arriver : son bloc dans le panneau défile jusqu'à l'écran. */
const resultatArrive = signal<'IA10' | 'IA11' | null>(null);

/**
 * Résultat d'une aide IA dans le panneau : à son arrivée, le panneau défile
 * pour le montrer au-dessus des messages (en bas à droite), qui le cacheraient.
 */
function ResultatIA({ fonction, children }: { fonction: 'IA10' | 'IA11'; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  const arrive = resultatArrive.value === fonction;
  useEffect(() => {
    if (!arrive) return;
    resultatArrive.value = null;
    // Un instant plus tard : la barre de progression de l'aide a disparu, la mise en page est faite.
    setTimeout(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 100);
  }, [arrive]);
  return (
    <div ref={ref} class="resultat-ia">
      {children}
    </div>
  );
}

/** Vignette cliquable d'une photo citée par l'IA : elle la sélectionne et l'amène à l'écran dans la grille. */
function VignetteIA({ f, taille }: { f: FichierPlan; taille: number }) {
  return (
    <button type="button" class="vignette-ia" onClick={() => montrerPhotos([f.id])} title={t`Montrer cette photo dans la grille`}>
      <Miniature f={f} taille={taille} rotation={f.rotation} />
    </button>
  );
}

/** Bloc « Aides IA » du panneau de droite de l'étape « Sélection ». */
export function AidesSelection() {
  const s = session.value!;
  versionIA.value;
  const resultats = resultatsSelection(s);
  const remarques = resultats.controles[vue.value] ?? [];
  const meilleure = derniereMeilleure.value ? s.plan.fichiers.get(derniereMeilleure.value) : undefined;
  const raison = meilleure ? resultats.meilleures[meilleure.id]?.justification : undefined;
  return (
    <section class="outil">
      <h3>{t`Aides IA`}</h3>
      <AideIA fonction="IA8" />
      <AideIA fonction="IA9" />
      <AideIA fonction="IA10" />
      {meilleure && raison && (
        <ResultatIA fonction="IA10">
          <div class="meilleure-ia">
            <VignetteIA f={meilleure} taille={64} />
            <p>
              <strong>{t`L’IA préfère cette photo :`}</strong> {raison}
            </p>
          </div>
        </ResultatIA>
      )}
      <AideIA fonction="IA11" />
      {vue.value === RACINE && <p class="discret">{t`Choisissez une sortie dans le panneau pour la faire contrôler.`}</p>}
      {remarques.length > 0 && (
        <ResultatIA fonction="IA11">
          <ul class="remarques">
            {remarques.map((r, i) => (
              <li key={i}>
                <strong>{r.type === 'redondance' ? t`Redondance :` : r.type === 'manque' ? t`Manque :` : r.type === 'faible' ? t`Photo faible :` : t`Remarque :`}</strong> {r.texte}
                {r.photos.length > 0 && (
                  <span class="vignettes-remarque">
                    {r.photos
                      .slice(0, 4)
                      .map((id) => s.plan.fichiers.get(id))
                      .filter((f): f is FichierPlan => !!f)
                      .map((f) => (
                        <VignetteIA key={f.id} f={f} taille={44} />
                      ))}
                    <button type="button" class="lien" onClick={() => montrerPhotos(r.photos)}>
                      {t`voir (${r.photos.length})`}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </ResultatIA>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// IA12 à IA15 — album
// ---------------------------------------------------------------------------

/** Réglages des textes, partagés entre la page et le catalogue. */
export const reglagesTextes = { ton: 'chaleureux' as Ton, part: 0.15, rechercheWeb: false };

/** Sections de l'album avec leurs photos (dans l'ordre), et une clé stable par section. */
function sectionsAlbum(s: Session) {
  const ordre = ordreAlbum(photosAlbum(s.plan), s.album.ordre);
  const secs = sections(ordre, (d) => titreDossier(s.plan, d), s.album);
  return { ordre, secs, liste: secs.map((sec) => ({ sec, cle: `${sec.dossier}#${ordre[sec.debut].id}`, photos: ordre.slice(sec.debut, sec.fin + 1) })) };
}

function demandesTextes(s: Session, legendes: boolean) {
  const notes = new Map(Object.entries(s.aides.get<Record<string, Appreciation>>('IA9') ?? {}).map(([id, a]) => [id, a.note]));
  return sectionsAlbum(s).liste.flatMap(({ sec, cle, photos }) => {
    const dates = photos.map((f) => f.date).filter((d): d is string => !!d).sort();
    const calendrier = dates.length ? blocCalendrier(evenementsAutour(evenements.value, dates[0].slice(0, 10), dates.at(-1)!.slice(0, 10))) : '';
    const d = demandeTextes(
      { nom: sec.titre, photos: photos.map((f) => photoIA(s, f)) },
      { legendes, part: reglagesTextes.part, ton: reglagesTextes.ton, rechercheWeb: reglagesTextes.rechercheWeb, contexte: s.projet.contexte, calendrier, notes },
    );
    return d ? [{ d, cle }] : [];
  });
}

export interface TextesProposes {
  titre: string;
  introduction: string;
  legendes: Record<string, string>;
  references: { texte: string; source: string }[];
}

function aideTextes(id: 'IA12' | 'IA13', legendes: boolean) {
  enregistrerAide({
    id,
    nom: legendes ? aTraduire('Proposer des légendes (IA)') : aTraduire('Proposer titres et introductions (IA)'),
    etape: ETAPE.album,
    description: legendes
      ? aTraduire('Légendes pour une part des photos de chaque section (15 % par défaut), dans le ton choisi.')
      : aTraduire('Titre et texte d’introduction de chaque section, d’après les photos, le nom de la sortie, le calendrier et le contexte ; recherche web en option.'),
    envoi: aTraduire('jusqu’à 12 photos par section (1024 px), le nom de la section, le calendrier et le contexte'),
    web: !legendes,
    usage: 'avance',
    estimer: (s) => {
      const liste = demandesTextes(s, legendes);
      if (!liste.length) return null;
      const e = estimer(s, liste.map((x) => x.d));
      return e && { ...e, detail: pluriel(liste.length, 'section') };
    },
    lancer: async (s, l) => {
      const liste = demandesTextes(s, legendes);
      const parDemande = new Map(liste.map((x) => [x.d, x.cle]));
      const ajouts: Record<string, TextesProposes> = {};
      const bilan: BilanEchecs = { echecs: 0 };
      try {
        await executer(s, liste.map((x) => x.d), (r, d) => lireTextes(r, d.ids), l, bilan, ({ d, r }) => {
          if (r) ajouts[parDemande.get(d)!] = { titre: r.titre, introduction: r.introduction, legendes: Object.fromEntries(r.legendes), references: r.references };
        });
      } finally {
        await s.aides.fusionner(id, ajouts);
      }
      return t`${pluriel(Object.keys(ajouts).length, 'section')} : propositions à relire dans l’aperçu et dans « Tous les textes ».${texteEchecs(bilan)}`;
    },
  });
}
aideTextes('IA12', false);
aideTextes('IA13', true);

function grandesPhotos(s: Session) {
  return photosAlbum(s.plan).filter((f) => f.album === 2).map((f) => photoIA(s, f));
}

/** Couvertures proposées (IA14), avec les grandes photos d'alors : tant qu'elles n'ont pas changé, c'est « déjà fait ». */
interface CouverturesIA14 {
  grandes: string;
  propositions: { id: string; raison: string }[];
}

const signatureGrandes = (s: Session) => grandesPhotos(s).map((p) => p.identite).join('|');

export function couverturesProposees(s: Session): { id: string; raison: string }[] {
  const c = s.aides.get<CouverturesIA14 | { id: string; raison: string }[]>('IA14');
  return Array.isArray(c) ? c : (c?.propositions ?? []);
}

enregistrerAide({
  id: 'IA14',
  nom: aTraduire('Suggérer une couverture (IA)'),
  etape: ETAPE.album,
  description: aTraduire('5 candidates parmi les grandes photos ★★, avec la raison.'),
  siRien: aTraduire('il faut au moins 2 grandes photos ★★'),
  envoi: aTraduire('les grandes photos ★★ (planches puis 1024 px)'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const grandes = grandesPhotos(s);
    if (grandes.length < 2) return null;
    const deja = s.aides.get<CouverturesIA14>('IA14');
    if (deja && !Array.isArray(deja) && deja.grandes === signatureGrandes(s)) return { usd: 0, appels: 0 };
    const tri = demandeCouvertureTri(grandes, { album: s.projet.nom, contexte: s.projet.contexte });
    const finale = demandeCouverture(grandes.slice(0, 6), { album: s.projet.nom, contexte: s.projet.contexte });
    return estimer(s, [tri, finale].filter((d): d is DemandeIA => !!d));
  },
  lancer: async (s, l) => {
    const grandes = grandesPhotos(s);
    const signature = signatureGrandes(s);
    const bilan: BilanEchecs = { echecs: 0 };
    let finalistes = grandes;
    const tri = demandeCouvertureTri(grandes, { album: s.projet.nom, contexte: s.projet.contexte });
    if (tri) {
      const [r] = await executer(s, [tri], (x, d) => lireCouvertureTri(x, d.ids), l, bilan);
      const ids = r?.r ?? [];
      finalistes = grandes.filter((g) => ids.includes(g.id));
      if (!finalistes.length) finalistes = grandes.slice(0, 6);
    }
    const d = demandeCouverture(finalistes, { album: s.projet.nom, contexte: s.projet.contexte });
    if (!d) return t`Pas assez de grandes photos ★★.`;
    const [r] = await executer(s, [d], (x, dd) => lireCouverture(x, dd.ids), l, bilan);
    if (r) await s.aides.set('IA14', { grandes: signature, propositions: r.r } satisfies CouverturesIA14);
    return `${pluriel(r?.r.length ?? 0, 'couverture proposée', 'couvertures proposées')}.${texteEchecs(bilan)}`;
  },
});

function demandesControle(s: Session) {
  const { ordre, secs } = sectionsAlbum(s);
  const pages = paginer(ordre, secs, s.album);
  return demandesControleAlbum(ordre.map((f) => photoIA(s, f)), pages, secs, { album: s.projet.nom, contexte: s.projet.contexte });
}

enregistrerAide({
  id: 'IA15',
  nom: aTraduire('Relire l’album (IA)'),
  etape: ETAPE.album,
  description: aTraduire('Relecture des pages simulées : redondances entre pages voisines, rythme, sections déséquilibrées. Uniquement des remarques.'),
  envoi: aTraduire('planches de l’album dans l’ordre, avec le numéro de page'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const d = demandesControle(s);
    return d.length ? estimer(s, d) : null;
  },
  lancer: async (s, l) => {
    const bilan: BilanEchecs = { echecs: 0 };
    const res = await executer(s, demandesControle(s), (r, d) => lireControleAlbum(r, d), l, bilan);
    const remarques = res.flatMap((x) => x.r);
    if (res.length) await s.aides.set('IA15', remarques);
    return t`${pluriel(remarques.length, 'remarque')} sur l’album.${texteEchecs(bilan)}`;
  },
});

/** Réglages des textes et boutons des aides de l'étape « Album ». */
export function AidesAlbum() {
  const s = session.value!;
  versionIA.value;
  const [ton, setTon] = useState(reglagesTextes.ton);
  const [part, setPart] = useState(reglagesTextes.part);
  const [web, setWeb] = useState(reglagesTextes.rechercheWeb);
  reglagesTextes.ton = ton;
  reglagesTextes.part = part;
  reglagesTextes.rechercheWeb = web;
  const couvertures = couverturesProposees(s);
  const remarques = s.aides.get<RemarqueAlbum[]>('IA15') ?? [];
  return (
    <details class="aides-album">
      <summary>
        <strong>{t`Aides IA`}</strong>
        {t` : titres, légendes, couverture, relecture`}
      </summary>
      <div class="reglages-etape ligne">
        <label>
          {t`Ton`}{' '}
          <select value={ton} onChange={(e) => setTon(e.currentTarget.value as Ton)}>
            {(Object.keys(LIBELLES_TONS) as Ton[]).map((x) => (
              <option key={x} value={x}>
                {t(LIBELLES_TONS[x])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t`Part des photos légendées`}{' '}
          <input type="number" class="tres-court" min="0" max="100" step="5" value={Math.round(part * 100)} onChange={(e) => setPart(Math.max(0, Math.min(100, Number(e.currentTarget.value) || 0)) / 100)} /> %
        </label>
        <label class="case" title={t`Monument, histoire d’un lieu, fait marquant d’une course… (plus cher)`}>
          <input type="checkbox" checked={web} onChange={(e) => setWeb(e.currentTarget.checked)} /> {t`Informations trouvées sur internet`}
        </label>
      </div>
      <AideIA fonction="IA12" />
      <AideIA fonction="IA13" />
      <AideIA fonction="IA14" />
      {/* Les couvertures proposées sont montrées en miniatures avec la couverture, en tête de l'aperçu des pages (Album.tsx). */}
      {couvertures.length > 0 && <p class="discret">{t`Couvertures proposées : voyez-les sous « Couverture », en tête de l’aperçu des pages.`}</p>}
      <AideIA fonction="IA15" />
      {remarques.length > 0 && (
        <ul class="liste-courte remarques">
          {remarques.map((r, i) => (
            <li key={i}>
              {r.pages.length > 0 && <strong>{t`p. ${r.pages.join(', ')} : `}</strong>}
              {r.texte}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** Propositions de textes d'une section (IA12, IA13). */
export function textesProposes(s: Session, sec: Section, premiere: string): { titres?: TextesProposes; legendes?: TextesProposes } {
  const cle = `${sec.dossier}#${premiere}`;
  return { titres: s.aides.get<Record<string, TextesProposes>>('IA12')?.[cle], legendes: s.aides.get<Record<string, TextesProposes>>('IA13')?.[cle] };
}
