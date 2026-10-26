// Étape « Doublons » (SPEC § 6.8, D71) : un onglet par sorte de doublons —
// copies exactes (avec les photos présentes dans plusieurs dossiers gardés,
// D86), rafales (repérées sur l'ordinateur, gratuit), même scène (IA, à la
// demande) — et un onglet des photos mises de côté. Les groupes se relisent journée par journée (ou
// dossier par dossier) ; un clic sur une photo la garde ou l'écarte, rien ne
// disparaît de l'écran et tout s'annule (Ctrl+Z). Rien n'est écarté sans
// action de l'utilisateur (règle d'or 3).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  acceptablesSansVider,
  accepter,
  aEcarter,
  aRelire,
  avancementGroupes,
  aGarder,
  choisir as choisirPhoto,
  choixEnAttente,
  ecarterTout,
  garderTout,
  groupesCopies,
  groupesScenes,
  groupeVisible,
  photosDuGroupe,
  raisonDe,
  sectionJour,
  type GroupeDoublons,
  type EtatPhoto,
  type PhotoDuGroupe,
  type Sorte,
} from '../../lib/groupesDoublons';
import { aTraduire, t } from '../../lib/langue';
import { comparerPhotos, LIBELLES_REMARQUES, type Comparaison, type Remarque } from '../../lib/comparerPhotos';
import { cheminDossier, comparerNoms, dossierSource, ecarterDoublons, garderAussi, RACINE, traitementDe, type FichierPlan, type InfoDoublon, type Modification, type Plan } from '../../lib/plan';
import { dossierMisDeCote, nomsSortie } from '../../lib/sortie';
import { MODELES } from '../../lib/tarifs';
import { cleApi } from '../../navigateur/cle';
import { analyserDoublons, estimerDoublons, lotsDoublons, type EtatDoublons } from '../../navigateur/doublons';
import { BudgetAtteint } from '../../navigateur/ia';
import { cleMiniature } from '../../navigateur/miniatures';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { analyseEnCours, lancerAnalyseDossier, rafalesAChercher } from '../analyseDossier';
import { EncartAnalyse } from '../composants/Analyse';
import { BarreProgression, BarreValidation, TeteEtape } from '../composants/Cadre';
import { Comparateur } from '../composants/Comparateur';
import { confirmer } from '../composants/Dialogues';
import { CurseurTaille, Miniature } from '../composants/GrillePhotos';
import { redimensionner, styleLargeurPanneau } from '../composants/PanneauDossiers';
import { REGLAGES_DEFAUT } from '../../navigateur/reglages';
import { useCopiesExactes } from '../copiesExactes';
import { allerEtape, annuler, appliquer, changerEtape, changerReglages, journal, notifier, page, reglages, revenirDe, serviceMiniatures, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { nombre, nomJour, nomMois, pluriel, taille as texteTaille } from '../format';
import { simplifier } from '../organiser';
import { enregistrerAide } from './AidesIA';
import { avisDe, BoutonIARafales, ciblesIA, estimationIA } from '../iaRafales';
import type { AvisRafale } from '../../lib/iaRafales';

/** Les photos dans plusieurs dossiers gardés (`dossiers`) se relisent avec les copies exactes (D86). */
type Onglet = Exclude<Sorte, 'dossiers'> | 'mis_de_cote';
type Filtre = 'a_relire' | 'relus' | 'tous';
type Ordre = 'heure' | 'taille';
type Groupement = 'jour' | 'mois' | 'dossier';

/** Onglet (par projet) et section affichés : gardés le temps de la session, d'une visite de l'étape à l'autre. */
const ongletsChoisis = signal<Record<string, Onglet>>({});
const sectionsChoisies = signal<Partial<Record<Onglet, string>>>({});
const groupementsChoisis = signal<Partial<Record<Onglet, Groupement>>>({});
const choisirOnglet = (projet: string, o: Onglet) => (ongletsChoisis.value = { ...ongletsChoisis.value, [projet]: o });

/** Lots comparés : les dossiers, ou les journées tant que le dossier à trier est en vrac (D54). */
function lots(s: Session) {
  return lotsDoublons(s.plan, s.projet.mode === 'vrac');
}

/** « dossier » ou « journée », selon les lots. */
function unite(s: Session): [string, string] {
  return s.projet.mode === 'vrac' ? [aTraduire('journée'), aTraduire('journées')] : [aTraduire('dossier'), aTraduire('dossiers')];
}

// IA7 au catalogue : l'estimation pour le projet ; le lancement se fait depuis l'étape « Doublons » (réglages Prudent / Strict).
enregistrerAide({
  id: 'IA7',
  nom: aTraduire('Doublons (IA)'),
  etape: ETAPE.doublons,
  description: aTraduire('Vue d’ensemble de chaque dossier (ou de chaque journée pour un dossier en vrac), puis vérification en grand des scènes répétées, avec garde-fous (script 06).'),
  envoi: aTraduire('planches de miniatures de chaque dossier ou journée, puis 6 photos au plus en grand par vérification'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const ids = lots(s).map((l) => l.id);
    if (!ids.length) return null;
    const e = estimerDoublons(s.plan, s.analyses, ids, reglages.value.modeles.standard, s.ia);
    return { usd: e.usd, appels: e.appels, detail: t`${pluriel(e.dossiers, ...unite(s))} (analyse locale des photos nécessaire)` };
  },
  lancer: async () => {
    const s = session.value;
    if (s) choisirOnglet(s.projet.nom, 'ia');
    allerEtape('doublons');
    return t`Lancez l’analyse depuis l’étape ${ETAPE.doublons}.`;
  },
});

// IA16 au catalogue : l'estimation pour tout le projet ; le lancement se fait depuis l'onglet « Rafales » (D102).
enregistrerAide({
  id: 'IA16',
  nom: aTraduire('Choisir dans les rafales (IA)'),
  etape: ETAPE.doublons,
  description: aTraduire('Dans chaque rafale pas encore validée, l’IA choisit la meilleure photo (yeux fermés, regards, flou, personne qui manque) et dit pourquoi ; vous validez.'),
  envoi: aTraduire('les photos de chaque rafale en 1568 px, 6 au plus'),
  web: false,
  usage: 'rapide',
  estimer: (s) => {
    if (!s.doublons) return null;
    const cibles = ciblesIA(s, groupesScenes(s.doublons.dossiers, (id) => s.plan.fichiers.get(id)));
    if (!cibles.length) return null;
    return { ...estimationIA(s, cibles), detail: pluriel(cibles.length, 'rafale') };
  },
  lancer: async () => {
    const s = session.value;
    if (s) choisirOnglet(s.projet.nom, 'rafales');
    allerEtape('doublons');
    return t`Lancez l’aide depuis l’onglet « Rafales » de l’étape ${ETAPE.doublons}.`;
  },
});

/** « Analyse arrêtée : 3 journées sur 7 analysées. » */
function texteArret(journees: boolean, faits: number, total: number): string {
  if (journees) return faits <= 1 ? t`Analyse arrêtée : ${nombre(faits)} journée sur ${nombre(total)} analysée.` : t`Analyse arrêtée : ${nombre(faits)} journées sur ${nombre(total)} analysées.`;
  return faits <= 1 ? t`Analyse arrêtée : ${nombre(faits)} dossier sur ${nombre(total)} analysé.` : t`Analyse arrêtée : ${nombre(faits)} dossiers sur ${nombre(total)} analysés.`;
}

/** Groupes de rafales et de scènes encore à relire, après une recherche. */
function groupesARelire(etat: EtatDoublons, plan: Plan): number {
  const fichier = (id: string) => plan.fichiers.get(id);
  return groupesScenes(etat.dossiers, fichier).filter((g) => groupeVisible(g, fichier) && aRelire(g, fichier)).length;
}

function estChampDeSaisie(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

/** Les photos de la racine : celles à trier, tant que le dossier est en vrac. */
function nomRacine(vrac: boolean): string {
  return vrac ? t`Photos à trier` : t`Photos (racine)`;
}

/** « 2 photos écartées → « _mis_de_cote/doublons » ». */
function texteEcartees(n: number, raison: 'doublons' | 'doublons_exacts'): string {
  return t`${pluriel(n, 'photo écartée', 'photos écartées')} → « ${dossierMisDeCote(raison)} »`;
}

// ---------------------------------------------------------------------------
// Sections de la liste de gauche : par journée, par mois ou par dossier (au choix)
// ---------------------------------------------------------------------------

/** Au-delà de 20 journées (une année), on groupe par mois par défaut : une journée n'a souvent qu'un groupe. */
const JOURNEES_MAX = 20;

/** Section d'une photo selon le regroupement : sa journée, son mois, ou son dossier ; « sans » sans date sûre. */
function sectionSelon(groupement: Groupement, f: FichierPlan | undefined): string {
  if (groupement === 'dossier') return f ? `dossier:${f.dossier}` : 'sans';
  const jour = sectionJour(f);
  return groupement === 'mois' && jour !== 'sans' ? `mois:${jour.slice(5, 12)}` : jour;
}

/** Regroupement choisi pour l'onglet, sinon par journée (par mois au-delà de 20 journées). */
function useGroupement(onglet: Onglet, fichiers: (FichierPlan | undefined)[]): [Groupement, (g: Groupement) => void] {
  const choisi = groupementsChoisis.value[onglet];
  const parDefaut = choisi ?? (new Set(fichiers.map(sectionJour).filter((x) => x !== 'sans')).size > JOURNEES_MAX ? 'mois' : 'jour');
  return [parDefaut, (g) => (groupementsChoisis.value = { ...groupementsChoisis.value, [onglet]: g })];
}

/** Menu « Grouper : par journée, par mois, par dossier ». */
function ChoixGroupement({ valeur, choisir }: { valeur: Groupement; choisir: (g: Groupement) => void }) {
  return (
    <label class="discret">
      {t`Grouper`}{' '}
      <select value={valeur} onChange={(e) => choisir(e.currentTarget.value as Groupement)}>
        <option value="jour">{t`par journée`}</option>
        <option value="mois">{t`par mois`}</option>
        <option value="dossier">{t`par dossier`}</option>
      </select>
    </label>
  );
}

interface Section {
  cle: string;
  /** Nom court (liste de gauche), et titre complet (en tête de la section). */
  nom: string;
  titre: string;
  total: number;
  aRelire: number;
}

/** Section d'un dossier : du plan (« dossier:<id> »), ou de la source pour les copies (« source:<chemin> »). */
function estDossier(x: Section): boolean {
  return x.cle.startsWith('dossier:') || x.cle.startsWith('source:');
}

function sections(elements: { section: string; aRelire: boolean }[], plan: Plan, vrac: boolean): Section[] {
  const parCle = new Map<string, Section>();
  for (const e of elements) {
    const x = parCle.get(e.section) ?? { cle: e.section, nom: '', titre: '', total: 0, aRelire: 0 };
    x.total++;
    if (e.aRelire) x.aRelire++;
    parCle.set(e.section, x);
  }
  const liste = [...parCle.values()];
  const annees = new Set(liste.filter((x) => x.cle.startsWith('jour:')).map((x) => x.cle.slice(5, 9)));
  for (const x of liste) {
    if (x.cle.startsWith('jour:')) {
      x.nom = nomJour(x.cle.slice(5), false, annees.size > 1);
      x.titre = nomJour(x.cle.slice(5), true);
    } else if (x.cle.startsWith('mois:')) x.nom = x.titre = nomMois(x.cle.slice(5));
    else if (x.cle.startsWith('dossier:'))
      // Avant le tri, les photos en vrac à la racine n'ont pas encore de dossier.
      x.nom = x.titre = x.cle.slice(8) === RACINE ? nomRacine(vrac) : cheminDossier(plan, x.cle.slice(8));
    else if (x.cle.startsWith('source:')) x.nom = x.titre = x.cle.slice(7) || nomRacine(vrac);
    else x.nom = x.titre = t`Photos sans date`;
  }
  // Journées et mois dans l'ordre du temps ; dossiers par nom, comme dans l'explorateur, la racine en tête.
  const racine = (x: Section) => x.cle === `dossier:${RACINE}` || x.cle === 'source:';
  const rang = (x: Section) => (x.cle.startsWith('jour:') || x.cle.startsWith('mois:') ? 0 : racine(x) ? 1 : estDossier(x) ? 2 : 3);
  return liste.sort((a, b) => rang(a) - rang(b) || (rang(a) === 0 ? a.cle.localeCompare(b.cle) : comparerNoms(a.nom, b.nom)));
}

/** Liste de gauche : chaque journée (ou dossier), ce qui reste à relire, ✓ quand c'est fait ; les dossiers se cherchent par leur nom. */
function ListeSections({ liste, choisie, choisir, avancement = true }: { liste: Section[]; choisie?: string; choisir: (cle: string) => void; avancement?: boolean }) {
  const [cherche, setCherche] = useState('');
  const q = simplifier(cherche.trim());
  const trouves = liste.filter((x) => estDossier(x) && simplifier(x.nom).includes(q));
  const blocs: [string, Section[]][] = [
    [t`Journées`, liste.filter((x) => x.cle.startsWith('jour:'))],
    [t`Mois`, liste.filter((x) => x.cle.startsWith('mois:'))],
    [t`Dossiers`, trouves],
    [t`Sans date`, liste.filter((x) => x.cle === 'sans')],
  ];
  const dejaVus = new Set<string>();
  return (
    <nav class="sections-doublons" aria-label={t`Journées et dossiers`} style={styleLargeurPanneau()}>
      <div
        class="poignee-panneau"
        role="separator"
        aria-orientation="vertical"
        title={t`Tirer pour élargir le panneau (double-clic : largeur d’origine)`}
        onPointerDown={redimensionner}
        onDblClick={() => changerReglages({ ...reglages.value, largeurPanneau: REGLAGES_DEFAUT.largeurPanneau })}
      />
      {liste.some(estDossier) && (
        <input
          type="search"
          class="recherche-sections"
          placeholder={t`Chercher…`}
          aria-label={t`Chercher un dossier`}
          value={cherche}
          onInput={(e) => setCherche(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && trouves[0] && choisir(trouves[0].cle)}
        />
      )}
      {q && !trouves.length && <p class="discret">{t`Aucun dossier ne correspond.`}</p>}
      {blocs
        .filter(([, l]) => l.length)
        .map(([titre, l]) => (
          <div key={titre}>
            <h2>{titre}</h2>
            {l.flatMap((x) => {
              // Dossiers imbriqués (D97) : chaque dossier parent une fois, ses sous-dossiers en retrait, sous leur seul nom.
              const parties = estDossier(x) ? x.nom.split('/') : [x.nom];
              const parents = parties.slice(0, -1).flatMap((nom, i) => {
                const chemin = parties.slice(0, i + 1).join('/');
                if (titre !== t`Dossiers` || dejaVus.has(chemin) || liste.some((y) => estDossier(y) && y.nom === chemin)) return [];
                dejaVus.add(chemin);
                return [
                  <div key={`p:${chemin}`} class="parent-section" style={{ paddingLeft: `${10 + i * 14}px` }}>
                    {nom}
                  </div>,
                ];
              });
              if (estDossier(x)) dejaVus.add(x.nom);
              return [
                ...parents,
                <button
                  key={x.cle}
                  type="button"
                  class={`section-doublons${x.cle === choisie ? ' choisie' : ''}`}
                  style={parties.length > 1 ? { paddingLeft: `${10 + (parties.length - 1) * 14}px` } : undefined}
                  title={x.nom}
                  aria-current={x.cle === choisie ? 'true' : undefined}
                  onClick={() => choisir(x.cle)}
                >
                  <span>{parties.at(-1)}</span>
                  {!avancement ? (
                    <span class="compte">{nombre(x.total)}</span>
                  ) : x.aRelire ? (
                    <span class="reste" title={t`groupes à valider`}>
                      {nombre(x.aRelire)}
                    </span>
                  ) : (
                    <span class="fait" title={t`tout est validé`}>
                      ✓
                    </span>
                  )}
                </button>,
              ];
            })}
          </div>
        ))}
    </nav>
  );
}

/** Ce que désigne une section, pour dire la portée de ses boutons : « Ce mois », « Cette journée »… */
function porteeSection(x: Section): string {
  if (x.cle.startsWith('jour:')) return t`Cette journée`;
  if (x.cle.startsWith('mois:')) return t`Ce mois`;
  if (estDossier(x)) return t`Ce dossier`;
  return t`Sans date`;
}

/**
 * En tête de la section : sa portée, son titre, ses actions (juste au-dessus des groupes qu'elles
 * touchent, D98). Au-dessus de la colonne des groupes, pour que la liste de gauche et la première carte
 * commencent à la même hauteur ; pas de boutons vers les sections voisines (N et P au clavier) (D100).
 */
function TeteSection({ section, detail, actions }: { section: Section; detail: string; actions?: ComponentChildren }) {
  return (
    <div class="tete-section-doublons" style={styleLargeurPanneau()}>
      {actions && <span class="etiquette-portee section">{porteeSection(section)}</span>}
      <h2>{section.titre}</h2>
      <span class="discret">{detail}</span>
      {actions}
    </div>
  );
}

/** Section affichée : celle choisie, sinon la première qui reste à relire (retenue, pour ne pas sauter ailleurs). */
function useSection(onglet: Onglet, liste: Section[]): [Section | undefined, (cle: string) => void] {
  const choisie = sectionsChoisies.value[onglet];
  const section = liste.find((x) => x.cle === choisie) ?? liste.find((x) => x.aRelire > 0) ?? liste[0];
  const choisir = (cle: string) => (sectionsChoisies.value = { ...sectionsChoisies.value, [onglet]: cle });
  useEffect(() => {
    if (section && section.cle !== choisie) choisir(section.cle);
  }, [section?.cle, choisie]);
  return [section, choisir];
}

// ---------------------------------------------------------------------------
// Un groupe
// ---------------------------------------------------------------------------

/** Où est la photo ★ d'une rafale : son dossier, ou les photos à trier. */
function lieuDe(s: Session, f: FichierPlan | undefined): string {
  if (!f) return '';
  if (f.dossier === RACINE) return nomRacine(s.projet.mode === 'vrac');
  return cheminDossier(s.plan, f.dossier);
}

/** Temps écoulé entre la première et la dernière photo d'une rafale : « en 12 s », « en 3 min ». */
function dureeRafale(photos: PhotoDuGroupe[]): string {
  const temps = photos.map((x) => (x.f.date && x.f.date.length > 10 ? Date.parse(x.f.date) : NaN)).filter((x) => !Number.isNaN(x));
  if (temps.length < 2) return '';
  const secondes = Math.round((Math.max(...temps) - Math.min(...temps)) / 1000);
  if (secondes < 1) return t`en moins d’une seconde`;
  return secondes < 60 ? t`en ${nombre(secondes)} s` : t`en ${nombre(Math.round(secondes / 60))} min`;
}

function titreGroupe(g: GroupeDoublons, photos: PhotoDuGroupe[], etoile: FichierPlan | undefined): string {
  const n = photos.length;
  if (g.sorte === 'copies' || g.sorte === 'dossiers') return `${etoile?.nom ?? ''} · ${pluriel(n, 'exemplaire')}`;
  if (g.sorte === 'rafales') {
    const duree = dureeRafale(photos);
    return duree ? t`Rafale de ${nombre(n)} photos ${duree}` : t`Rafale de ${nombre(n)} photos`;
  }
  return t`Même scène · ${nombre(n)} photos`;
}

/**
 * Netteté et exposition des photos du groupe, comparées entre elles (D99),
 * écartées comprises : les remarques ne changent pas au clic.
 */
function comparaisonDe(s: Session, g: GroupeDoublons, photos: PhotoDuGroupe[]): Comparaison {
  if (g.sorte !== 'rafales' && g.sorte !== 'ia') return { remarques: new Map() };
  return comparerPhotos(
    photos.map((x) => ({ id: x.m.id, indicateurs: s.analyses.get(x.f) })),
    g.sorte,
  );
}

function texteProposition(g: GroupeDoublons, n: number, c: Comparaison, avis?: AvisRafale): string {
  // Sans choix posé, c'est g.etoile qui est gardée : si l'IA en préfère une autre (son choix annulé), on le dit.
  if (avis) return !avis.meilleure ? t`L’IA ne départage pas (trop de monde) : à vous de choisir` : avis.meilleure === g.etoile ? t`Proposition de l’IA : garder la photo ★` : t`L’IA préfère la photo ★ : cliquez-la pour la choisir`;
  if (g.sorte === 'rafales') {
    if (c.plusNette === g.etoile) return t`Proposition : garder la plus nette ★`;
    if (c.plusNette) return t`Une photo est choisie ; une autre paraît plus nette`;
    return t`Elles se valent : une photo est choisie, cliquez celle que vous préférez`;
  }
  if (g.sorte === 'ia') return t`Proposition de l’IA : garder la photo ★`;
  return t`Proposition : écarter ${pluriel(n, 'exemplaire')}`;
}

/** Ce qu'on sait d'une photo pour choisir : l'heure, l'emplacement d'une copie, la description de l'IA. */
/**
 * Où est la photo : son dossier dans la source (chemin), et celui où le plan
 * la range s'il est autre (après le tri, un déplacement) ; pour choisir quoi
 * garder, sur tous les onglets (D96).
 */
function Emplacement({ f }: { f: FichierPlan }) {
  const s = session.value!;
  const source = dossierSource(f);
  const rangee = cheminDossier(s.plan, f.dossier);
  return (
    <>
      <strong class="chemin-doublon">{source || nomRacine(s.projet.mode === 'vrac')}</strong>
      {f.statut === 'archive' && rangee !== source && <span class="chemin-doublon">{t`rangée dans « ${rangee || t`Photos (racine)`} »`}</span>}
    </>
  );
}

/** Ce qui distingue la photo des autres du groupe : une remarque au plus, en mots comparatifs (D99). */
function RemarquePhoto({ remarque }: { remarque: Remarque | undefined }) {
  if (!remarque) return null;
  return <span class={`remarque-doublon ${remarque === 'plus_nette' ? 'qualite' : 'defaut'}`}>{t(LIBELLES_REMARQUES[remarque])}</span>;
}

/** Ce que l'IA dit de la photo (D102), distinct des mesures de l'application. */
function RaisonIA({ avis, id }: { avis?: AvisRafale; id: string }) {
  const raison = avis?.photos[id]?.raison;
  return raison ? <span class="raison-ia">{t`IA : ${raison}`}</span> : null;
}

function Legende({ g, x, c, avis }: { g: GroupeDoublons; x: PhotoDuGroupe; c: Comparaison; avis?: AvisRafale }) {
  const s = session.value!;
  const { m, f } = x;
  const heure = f.date && f.date.length > 10 ? f.date.slice(11, 19) : '';
  if (g.sorte === 'rafales')
    return (
      <span class="legende-doublon">
        <span>{heure}</span>
        <RemarquePhoto remarque={c.remarques.get(m.id)} />
        <RaisonIA avis={avis} id={m.id} />
        <Emplacement f={f} />
      </span>
    );
  if (g.sorte === 'ia')
    return (
      <span class="legende-doublon">
        <span>
          {heure.slice(0, 5)}
          {m.description && ` · ${m.description}`}
        </span>
        <RemarquePhoto remarque={c.remarques.get(m.id)} />
        <Emplacement f={f} />
        {m.refus && <em class="refus">{t`Gardée par le garde-fou : l’IA la décrit autrement.`}</em>}
      </span>
    );
  const r = g.remplacement;
  const nomDossier = (id: string) => cheminDossier(s.plan, id) || t`Photos (racine)`;
  const tr = traitementDe(s.plan, f.dossier);
  // Une copie se désigne par son dossier dans la source ; le tri (ou un déplacement) a pu la ranger ailleurs.
  return (
    <span class="legende-doublon">
      <Emplacement f={f} />
      {s.projet.mode === 'vrac' && tr === 'nettoyer' && <span>{t`dossier gardé, nettoyé`}</span>}
      <span>
        {f.dims ? `${nombre(f.dims.l)} × ${nombre(f.dims.h)} · ` : ''}
        {texteTaille(f.taille)}
      </span>
      {m.reduite && <span class="alerte-legende">{t`copie réduite`}</span>}
      {r && m.id === r.original && <span>{f.dossier === r.dossier ? t`placée dans « ${nomDossier(r.dossier)} », à la place de la copie réduite` : t`ira dans « ${nomDossier(r.dossier)} », à la place de la copie réduite`}</span>}
      {f.nom !== s.plan.fichiers.get(g.etoile)?.nom && <span class="discret">{f.nom}</span>}
    </span>
  );
}

/** Libellé de l'état d'une photo ; dans un groupe pas encore validé, une photo gardée est « à garder » (D101). */
function libelleEtat(etat: EtatPhoto, valide: boolean): [classe: EtatPhoto, libelle: string] {
  if (etat === 'gardee' && !valide) return ['choisie', t`à garder`];
  return [etat, etat === 'gardee' ? t`Gardée` : etat === 'ecartee' ? t`Écartée` : etat === 'choisie' ? t`à garder` : t`à écarter`];
}

/**
 * Une photo : un clic la choisit (D101). Dans une rafale ou une même scène, sans « Garder plusieurs
 * photos », elle est choisie seule ; Ctrl+clic l'ajoute ou la retire sans toucher aux autres.
 */
function TuileDoublon({
  g,
  x,
  c,
  avis,
  cote,
  agir,
  valide,
  seule,
  etoile,
}: {
  g: GroupeDoublons;
  x: PhotoDuGroupe;
  c: Comparaison;
  avis?: AvisRafale;
  cote: number;
  agir: (m: Modification | null) => void;
  valide: boolean;
  seule: boolean;
  /** La photo marquée ★ (proposée parce que vraiment meilleure), s'il y en a une. */
  etoile: string | undefined;
}) {
  const { m, f, etat } = x;
  const [classe, libelle] = libelleEtat(etat, valide);
  const garde = aGarder(etat);
  return (
    <div class="photo-doublon" style={{ width: `${cote}px` }}>
      <button
        type="button"
        class={`tuile-doublon ${classe}`}
        aria-pressed={garde}
        aria-label={`${f.nom} : ${libelle}`}
        title={garde ? t`Cliquer pour l’écarter` : seule ? t`Cliquer pour garder celle-ci seule (Ctrl+clic : en plus)` : t`Cliquer pour la garder`}
        onClick={(e) => agir(choisirPhoto(session.value!.plan, g, m.id, seule && !(e.ctrlKey || e.metaKey)))}
      >
        <span class="cadre-tuile" style={{ width: `${cote}px`, height: `${cote}px` }}>
          <Miniature f={f} taille={cote} rotation={f.rotation} />
        </span>
        <span class={`etat-photo ${classe}`}>{libelle}</span>
        {m.id === etoile && (
          <span class="etoile-doublon" title={avis ? t`Choisie par l’IA` : g.sorte === 'rafales' ? t`La plus nette : proposée` : t`La photo proposée`}>
            ★
          </span>
        )}
      </button>
      <Legende g={g} x={x} c={c} avis={avis} />
    </div>
  );
}

function CarteGroupe({
  g,
  ouverte,
  avecJour,
  agir,
  agirGroupe,
  rouvrir,
  replier,
  comparer,
  ordonner = (p) => p,
  plusieurs,
  changerPlusieurs,
}: {
  g: GroupeDoublons;
  ouverte: boolean;
  /** « Garder plusieurs photos » cochée à la main pour ce groupe (le temps de la page). */
  plusieurs: boolean;
  changerPlusieurs: (oui: boolean) => void;
  /** Ordre des photos : groupé par dossier, celle du dossier choisi d'abord. */
  ordonner?: (photos: PhotoDuGroupe[]) => PhotoDuGroupe[];
  replier: () => void;
  /** La section est un mois : la journée est dite devant l'heure. */
  avecJour: boolean;
  agir: (m: Modification | null) => void;
  agirGroupe: (m: Modification | null, message: string) => void;
  rouvrir: () => void;
  comparer: () => void;
}) {
  const s = session.value!;
  const plan = s.plan;
  const fichier = (id: string) => plan.fichiers.get(id);
  const photos = ordonner(photosDuGroupe(g, fichier));
  const etoile = fichier(g.etoile);
  const enAttente = photos.filter((x) => x.etat === 'a_ecarter').length;
  const gardees = photos.filter((x) => x.etat === 'gardee').length;
  const ecartees = photos.filter((x) => x.etat === 'ecartee').length;
  // Un clic choisit, « Accepter » valide (D101).
  const valide = !aRelire(g, fichier);
  const touche = choixEnAttente(g, fichier);
  const nGarder = photos.filter((x) => aGarder(x.etat)).length;
  const nEcarter = photos.length - nGarder - ecartees;
  // Rafale, même scène : un clic choisit une seule photo, sauf « Garder plusieurs photos » (cochée d'office dès deux).
  const unePhoto = g.sorte === 'rafales' || g.sorte === 'ia';
  const multiple = plusieurs || nGarder >= 2;
  const seule = unePhoto && !multiple;
  // ★ seulement quand une photo est vraiment meilleure : la plus nette d'une rafale, le choix de l'IA, l'original d'une copie réduite.
  const etoileVisible = g.sorte === 'rafales' ? comparaisonDe(s, g, photos).plusNette === g.etoile : g.sorte === 'ia' || g.membres.some((m) => m.reduite);
  // Avis de l'IA sur une rafale (D102) : sa photo porte la ★, avec sa raison ; g.etoile (la clé du groupe) ne change pas.
  const avis = avisDe(s, g);
  const etoileId = avis ? avis.meilleure : etoileVisible ? g.etoile : undefined;
  const choixIA = !!avis?.meilleure && photos.every((x) => aGarder(x.etat) === (x.m.id === avis.meilleure));
  const copie = g.sorte === 'copies' || g.sorte === 'dossiers';
  const heureSeule = etoile?.date && etoile.date.length > 10 ? etoile.date.slice(11, 16) : '';
  const heure = avecJour && etoile?.date ? [nomJour(etoile.date.slice(0, 10)), heureSeule].filter(Boolean).join(' · ') : heureSeule;
  const titre = titreGroupe(g, photos, etoile);
  const comparaison = comparaisonDe(s, g, photos);
  const resume = `${pluriel(gardees, 'gardée', 'gardées')}, ${pluriel(ecartees, 'écartée', 'écartées')}`;

  if (!ouverte)
    return (
      <div class="carte-doublons repliee" data-cle={g.cle}>
        <span class="vu" aria-hidden="true">
          ✓
        </span>
        <span class="heure">{heure}</span>
        <span class="resume">
          {titre} · {resume}
        </span>
        <button type="button" class="lien" onClick={rouvrir}>
          {t`Revoir`}
        </button>
      </div>
    );

  return (
    <article class={`carte-doublons${enAttente ? ' en-attente' : ' relue'}`} data-cle={g.cle} aria-label={heure ? `${heure} · ${titre}` : titre}>
      <header>
        {heure && <span class="heure">{heure}</span>}
        <span class="titre">{titre}</span>
        {!copie && <span class="discret">{lieuDe(s, etoile)}</span>}
        <span class="espace" />
        {touche ? (
          <span class="pastille-attente">{choixIA ? t`Choix de l’IA · pas encore validé` : t`Votre choix · pas encore validé`}</span>
        ) : !valide ? (
          <span class="pastille-proposition">{texteProposition(g, enAttente, comparaison, avis)}</span>
        ) : g.sorte === 'dossiers' && !ecartees ? (
          <span class="pastille-relue">{t`Gardée dans chaque dossier`}</span>
        ) : (
          <span class="pastille-relue">{t`✓ Validé`}</span>
        )}
      </header>
      {g.sorte === 'ia' && g.scene && <p class="scene-doublons">{g.scene}</p>}
      {avis?.justification && (
        <p class="scene-doublons avis-ia">
          {t`IA : ${avis.justification}`}
          {avis.equivalentes && <span class="discret">{t` (photos presque équivalentes)`}</span>}
        </p>
      )}
      <div class="photos-doublons">
        {photos.map((x) => (
          <TuileDoublon key={x.m.id} g={g} x={x} c={comparaison} avis={avis} cote={reglages.value.tailleMiniatures} agir={agir} valide={valide} seule={seule} etoile={etoileId} />
        ))}
      </div>
      {nGarder === 0 && <p class="alerte-doublons">{t`Aucune photo choisie : tout le groupe ira dans « ${dossierMisDeCote(raisonDe(g))} ».`}</p>}
      <footer>
        {!valide && (
          <button type="button" class="principal" data-action="accepter" onClick={() => agirGroupe(accepter(plan, [g]), texteEcartees(nEcarter, raisonDe(g)))} title={t`Touche A`}>
            {nEcarter ? t`Accepter : garder ${nombre(nGarder)}, écarter ${nombre(nEcarter)}` : t`Accepter : garder ${nombre(nGarder)}`}
          </button>
        )}
        <button type="button" disabled={gardees === photos.length} onClick={() => agirGroupe(garderTout(plan, [g]), t`Toutes les photos du groupe sont gardées.`)}>
          {t`Tout garder`}
        </button>
        <button type="button" disabled={ecartees === photos.length} onClick={() => agirGroupe(ecarterTout(plan, [g]), texteEcartees(photos.length - ecartees, raisonDe(g)))}>
          {t`Tout écarter`}
        </button>
        <button type="button" data-action="comparer" onClick={comparer} title={t`Touche C`}>
          {t`Comparer en grand`}
        </button>
        {valide && (
          <button type="button" class="lien" onClick={replier}>
            {t`Replier`}
          </button>
        )}
        {unePhoto && photos.length > 1 && (
          <label class="plusieurs-photos">
            <input
              type="checkbox"
              checked={multiple}
              onChange={(e) => {
                const oui = e.currentTarget.checked;
                changerPlusieurs(oui);
                // Décocher : seule la première photo choisie reste à garder (la ★ si elle l'est).
                const premiere = photos.find((x) => x.m.id === g.etoile && aGarder(x.etat)) ?? photos.find((x) => aGarder(x.etat));
                if (!oui && nGarder >= 2 && premiere) agir(choisirPhoto(plan, g, premiere.m.id, true));
              }}
            />{' '}
            {t`Garder plusieurs photos`}
          </label>
        )}
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Les groupes d'un onglet
// ---------------------------------------------------------------------------

function ListeGroupes({ onglet, groupes, titre }: { onglet: Exclude<Onglet, 'mis_de_cote'>; groupes: GroupeDoublons[]; titre: string }) {
  const s = session.value!;
  versionPlan.value;
  const plan = s.plan;
  const fichier = (id: string) => plan.fichiers.get(id);
  const [filtre, setFiltre] = useState<Filtre>('a_relire');
  const [ordre, setOrdre] = useState<Ordre>('heure');
  // Cartes repliées après « Accepter », « Tout garder »… ; et cartes déjà relues rouvertes (« Revoir »).
  const [fermees, setFermees] = useState<ReadonlySet<string>>(new Set());
  const [rouvertes, setRouvertes] = useState<ReadonlySet<string>>(new Set());
  const [comparee, setComparee] = useState<string | null>(null);
  // Groupes où « Garder plusieurs photos » a été cochée à la main (D101).
  const [plusieurs, setPlusieurs] = useState<ReadonlySet<string>>(new Set());
  /** Rafale, même scène : un clic (ou une touche) choisit une seule photo, sauf « Garder plusieurs photos ». */
  const uneSeule = (g: GroupeDoublons) => (g.sorte === 'rafales' || g.sorte === 'ia') && !plusieurs.has(g.cle) && photosDuGroupe(g, fichier).filter((x) => aGarder(x.etat)).length < 2;
  const zone = useRef<HTMLDivElement>(null);

  const [groupement, choisirGroupement] = useGroupement(
    onglet,
    groupes.map((g) => fichier(g.etoile)),
  );
  const copies = onglet === 'copies';
  // Une photo dans plusieurs dossiers gardés : rien à relire, tout est gardé ; elle se montre sous les groupes
  // à relire de la section, quel que soit le filtre, pour qu'on puisse en écarter un exemplaire (D86).
  const partout = (g: GroupeDoublons) => g.sorte === 'dossiers';
  // Par dossier, une copie se range sous chacun des dossiers de la source où elle a un exemplaire : ceux
  // que l'utilisateur connaît, même après le tri, qui range les photos à trier dans de nouveaux dossiers.
  const elements = groupes.flatMap((g) => {
    const etoile = fichier(g.etoile);
    const base = { g, relire: aRelire(g, fichier), date: etoile?.date };
    if (groupement === 'dossier' && copies) return [...new Set(photosDuGroupe(g, fichier).map((x) => `source:${dossierSource(x.f)}`))].map((section) => ({ ...base, section }));
    return [{ ...base, section: sectionSelon(groupement, etoile) }];
  });
  const liste = sections(
    elements.map((e) => ({ section: e.section, aRelire: e.relire })),
    plan,
    s.projet.mode === 'vrac',
  );
  const [section, choisir] = useSection(onglet, liste);
  const signature = groupes.map((g) => g.cle).join('|');
  // Instantané des groupes montrés, figé tant qu'on reste sur cette section et ce filtre : un clic sur une photo
  // ne fait rien disparaître (D71). Les groupes déjà relus à l'arrivée sont repliés ; « À relire » : un groupe
  // validé (Accepter, Tout garder, Tout écarter, Replier) s'en va, « Annuler » le fait revenir (D100).
  const montres = useMemo(
    () => new Set(elements.filter((e) => e.section === section?.cle && (filtre === 'tous' || partout(e.g) || (filtre === 'a_relire') === e.relire)).map((e) => e.g.cle)),
    [section?.cle, filtre, signature],
  );
  const relusAuDepart = useMemo(() => new Set(elements.filter((e) => e.section === section?.cle && !e.relire && !partout(e.g)).map((e) => e.g.cle)), [section?.cle, signature]);
  const parDate = (a: (typeof elements)[number], b: (typeof elements)[number]) => (a.date ?? '').localeCompare(b.date ?? '') || a.g.cle.localeCompare(b.g.cle);
  const visibles = elements
    .filter((e) => e.section === section?.cle && montres.has(e.g.cle) && !(filtre === 'a_relire' && fermees.has(e.g.cle) && !aRelire(e.g, fichier)))
    .sort((a, b) => Number(partout(a.g)) - Number(partout(b.g)) || (ordre === 'taille' ? b.g.membres.length - a.g.membres.length || parDate(a, b) : parDate(a, b)));
  const iPartout = visibles.findIndex((e) => partout(e.g));
  const enAttente = visibles.filter((e) => aRelire(e.g, fichier)).map((e) => e.g);
  // Copies : tout l'onglet a ses boutons (rangée de l'onglet) ; à relire dans l'onglet entier, hors photos dans plusieurs dossiers.
  const enAttenteOnglet = copies ? groupes.filter((g) => !partout(g) && aRelire(g, fichier)) : [];
  // Bouton de la section : pas pour un seul groupe (son « Accepter » suffit), ni quand la section est tout l'onglet
  // des copies (D98) ; groupé par dossier aussi : on parcourt le dossier, puis on le valide d'un coup (D100).
  const boutonSection = enAttente.length >= 2 && !(copies && enAttente.length === enAttenteOnglet.length);
  const { relus, total } = avancementGroupes(
    groupes.filter((g) => !partout(g)),
    fichier,
  );
  // Groupé par dossier : dans chaque groupe, la photo de ce dossier d'abord, à gauche (D100).
  const cleDossier = section && estDossier(section) ? section.cle : null;
  const duDossier = (f: FichierPlan) => cleDossier !== null && (cleDossier.startsWith('source:') ? dossierSource(f) === cleDossier.slice(7) : f.dossier === cleDossier.slice(8));
  const ordonner = (photos: PhotoDuGroupe[]) => (cleDossier === null ? photos : [...photos].sort((a, b) => Number(duDossier(b.f)) - Number(duDossier(a.f))));
  // Un groupe redevenu à relire (« Annuler ») se rouvre.
  const ouverte = (g: GroupeDoublons) => rouvertes.has(g.cle) || aRelire(g, fichier) || !(fermees.has(g.cle) || relusAuDepart.has(g.cle));
  // En-tête de section, compté comme la jauge : les photos dans plusieurs dossiers gardés à part (rien à relire).
  const dansSection = elements.filter((e) => e.section === section?.cle);
  const nPartout = dansSection.filter((e) => partout(e.g)).length;
  const nGroupes = dansSection.length - nPartout;
  const nRelus = dansSection.filter((e) => !partout(e.g) && !e.relire).length;
  const detail = [nGroupes > 0 && `${pluriel(nGroupes, 'groupe')} · ${pluriel(nRelus, 'validé', 'validés')}`, nPartout > 0 && pluriel(nPartout, 'photo dans plusieurs dossiers', 'photos dans plusieurs dossiers')]
    .filter(Boolean)
    .join(' · ');

  /** Après une action sur tout un groupe : la carte se replie à sa place, le clavier passe à la suivante. */
  const agirGroupe = (cles: string[], m: Modification | null, message: string) => {
    if (!m) return;
    appliquer(m);
    setFermees(new Set([...fermees, ...cles]));
    setRouvertes(new Set([...rouvertes].filter((c) => !cles.includes(c))));
    notifier('ok', message, { libelle: t`Annuler`, faire: annuler });
    const cartes = [...(zone.current?.querySelectorAll<HTMLElement>('.carte-doublons') ?? [])];
    const i = cartes.findIndex((c) => c.dataset.cle === cles.at(-1));
    setTimeout(() => cartes[i + 1]?.querySelector<HTMLElement>('.tuile-doublon, button')?.focus(), 0);
  };
  /** « Replier » une carte rouverte ou déjà relue. */
  const replier = (cle: string) => {
    setFermees(new Set([...fermees, cle]));
    setRouvertes(new Set([...rouvertes].filter((c) => c !== cle)));
  };
  // Valider la section : les groupes où au moins une photo est choisie ; on dit combien n'ont pas été touchés (D101).
  const validables = acceptablesSansVider(enAttente, fichier);
  const sansChoix = validables.filter((g) => !choixEnAttente(g, fichier)).length;
  const accepterSection = () => {
    const acceptes = validables;
    const n = acceptes.reduce((a, g) => a + aEcarter(g, fichier).length, 0);
    const raison = onglet === 'copies' ? 'doublons_exacts' : 'doublons';
    agirGroupe(
      acceptes.map((g) => g.cle),
      accepter(plan, acceptes),
      texteEcartees(n, raison),
    );
  };

  // Clavier : J / K (ou ↓ ↑) d'un groupe à l'autre, ← → d'une photo à l'autre, Espace pour garder ou écarter
  // (la photo est un bouton), A pour accepter, C pour comparer, N / P pour la section suivante ou précédente.
  const nav = useRef({ liste, section, choisir });
  nav.current = { liste, section, choisir };
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.defaultPrevented || estChampDeSaisie(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      const conteneur = zone.current;
      if (!conteneur) return;
      const actif = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      const dedans = !!actif && conteneur.contains(actif);
      if (actif && !dedans) return;
      const cartes = [...conteneur.querySelectorAll<HTMLElement>('.carte-doublons')];
      const carte = actif?.closest<HTMLElement>('.carte-doublons') ?? null;
      const i = carte ? cartes.indexOf(carte) : -1;
      const aller = (j: number) => cartes[Math.max(0, Math.min(cartes.length - 1, j))]?.querySelector<HTMLElement>('.tuile-doublon, button')?.focus();
      const voisine = (d: number) => {
        const { liste: l, section: x, choisir: c } = nav.current;
        const v = x && l[l.indexOf(x) + d];
        if (v) c(v.cle);
      };
      const k = e.key.toLowerCase();
      if (k === 'j' || (dedans && e.key === 'ArrowDown')) aller(i + 1);
      else if (k === 'k' || (dedans && e.key === 'ArrowUp')) aller(i < 0 ? 0 : i - 1);
      else if (carte && actif?.classList.contains('tuile-doublon') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const tuiles = [...carte.querySelectorAll<HTMLElement>('.tuile-doublon')];
        const j = tuiles.indexOf(actif) + (e.key === 'ArrowRight' ? 1 : -1);
        tuiles[(j + tuiles.length) % tuiles.length]?.focus();
      } else if (k === 'a' && carte) carte.querySelector<HTMLElement>('[data-action="accepter"]')?.click();
      else if (k === 'c' && carte) carte.querySelector<HTMLElement>('[data-action="comparer"]')?.click();
      else if (k === 'n') voisine(1);
      else if (k === 'p') voisine(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);

  if (!groupes.length) return null;
  const iComparee = visibles.findIndex((e) => e.g.cle === comparee);
  // Prochaine section qui reste à relire, après celle-ci (sinon la première).
  const iSection = section ? liste.indexOf(section) : -1;
  const suite = [...liste.slice(iSection + 1), ...liste.slice(0, Math.max(0, iSection))].find((x) => x.aRelire > 0);
  // Le groupe comparé reste ouvert même s'il quitte la liste (relu par une touche, avec « À relire ») (D100).
  const gComparee = visibles[iComparee]?.g ?? groupes.find((g) => g.cle === comparee);
  const pct = total ? Math.round((relus / total) * 100) : 100;

  const photosOnglet = enAttenteOnglet.reduce((n, g) => n + aEcarter(g, fichier).length, 0);
  // L'IA de la section : seulement si elle ne couvre pas déjà tout l'onglet (le bouton de la rangée suffit).
  const ciblesSectionBrutes = onglet === 'rafales' ? ciblesIA(s, enAttente) : [];
  const ciblesSection = ciblesSectionBrutes.length < ciblesIA(s, groupes).length ? ciblesSectionBrutes : [];
  const ceci = section?.cle.startsWith('jour:') ? t`de cette journée` : section?.cle.startsWith('mois:') ? t`de ce mois` : section && estDossier(section) ? t`de ce dossier` : t`ci-dessous`;

  return (
    <>
      {/* Tout l'onglet : entre son explication et les filtres ; ses boutons seulement pour les copies (D71, D98). */}
      <div class="rangee-onglet">
        <span class="etiquette-portee">{t`Tout l’onglet`}</span>
        <strong>{titre}</strong>
        <span class="avance-doublons">
          {total ? t`Validés : ${nombre(relus)} sur ${nombre(total)}` : t`Rien à valider`}
          {total > 0 && (
            <span class="jauge-doublons" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
          )}
        </span>
        <span class="espace" />
        {onglet === 'rafales' && (
          <span class="actions">
            <BoutonIARafales cibles={ciblesIA(s, groupes)} libelle={t`Choisir avec l’IA dans ${pluriel(ciblesIA(s, groupes).length, 'rafale')}`} />
          </span>
        )}
        {enAttenteOnglet.length > 0 && (
          <span class="actions">
            <button
              type="button"
              class="contour"
              onClick={() =>
                agirGroupe(
                  acceptablesSansVider(enAttenteOnglet, fichier).map((g) => g.cle),
                  accepter(plan, acceptablesSansVider(enAttenteOnglet, fichier)),
                  texteEcartees(photosOnglet, 'doublons_exacts'),
                )
              }
            >
              {enAttenteOnglet.length === 1 ? t`Accepter la proposition` : t`Accepter les ${nombre(enAttenteOnglet.length)} propositions`}
            </button>
            <button
              type="button"
              onClick={() =>
                agirGroupe(
                  enAttenteOnglet.map((g) => g.cle),
                  garderTout(plan, enAttenteOnglet),
                  t`Tous les exemplaires sont gardés.`,
                )
              }
            >
              {t`Garder tous les exemplaires`}
            </button>
          </span>
        )}
      </div>

      <div class="outils-doublons">
        <span class="discret">{t`Afficher`}</span>
        <div class="choix-segmente" role="radiogroup" aria-label={t`Groupes affichés`}>
          {(
            [
              ['a_relire', t`À valider`],
              ['relus', t`Validés`],
              ['tous', t`Tous`],
            ] as const
          ).map(([v, libelle]) => (
            <button key={v} type="button" role="radio" aria-checked={filtre === v} onClick={() => setFiltre(v)}>
              {libelle}
            </button>
          ))}
        </div>
        <ChoixGroupement valeur={groupement} choisir={choisirGroupement} />
        <CurseurTaille />
        <label class="discret">
          {t`Classer`}{' '}
          <select value={ordre} onChange={(e) => setOrdre(e.currentTarget.value as Ordre)}>
            <option value="heure">{t`par heure`}</option>
            <option value="taille">{t`les plus grands groupes d’abord`}</option>
          </select>
        </label>
      </div>
      <p class="discret aide-doublons">{t`Un clic sur une photo la choisit (dans une rafale, à la place des autres ; Ctrl+clic : en plus) ; « Accepter » valide le groupe. Clavier : J et K d’un groupe à l’autre, Espace pour choisir, A pour accepter, N et P pour avancer dans la liste de gauche.`}</p>

      {section && (
        <TeteSection
          section={section}
          detail={detail}
          actions={
            (boutonSection || ciblesSection.length > 0) && (
              <span class="actions">
                {ciblesSection.length > 0 && <BoutonIARafales cibles={ciblesSection} libelle={t`Choisir avec l’IA ${ceci}`} />}
                {boutonSection && (
                  <button type="button" class="contour" onClick={accepterSection} disabled={!validables.length}>
                    {t`Valider les ${nombre(validables.length)} groupes ${ceci}`}
                  </button>
                )}
                {boutonSection && sansChoix > 0 && <span class="discret">{t`dont ${nombre(sansChoix)} où vous n’avez rien choisi`}</span>}
              </span>
            )
          }
        />
      )}
      <div class="corps-doublons">
        <ListeSections liste={liste} choisie={section?.cle} choisir={choisir} />
        <section class="contenu-doublons" ref={zone}>
          {visibles.length === 0 && (
            <div class="encart">
              <p>{filtre === 'a_relire' ? t`Tout est validé ici.` : t`Aucun groupe à montrer ici.`}</p>
              {filtre === 'a_relire' && liste.some((x) => x.aRelire > 0) && (
                <button type="button" onClick={() => choisir(liste.find((x) => x.aRelire > 0)!.cle)}>
                  {t`Aller à la suite à valider`}
                </button>
              )}
            </div>
          )}
          {visibles.map(({ g }, i) => [
            i === iPartout && (
              <h3 key="partout" class="titre-partout">
                {t`Aussi dans d’autres dossiers gardés : tout est gardé`}
              </h3>
            ),
            <CarteGroupe
              key={g.cle}
              g={g}
              ouverte={ouverte(g)}
              ordonner={ordonner}
              replier={() => replier(g.cle)}
              plusieurs={plusieurs.has(g.cle)}
              changerPlusieurs={(oui) => setPlusieurs(new Set(oui ? [...plusieurs, g.cle] : [...plusieurs].filter((c) => c !== g.cle)))}
              avecJour={!!section && !section.cle.startsWith('jour:')}
              agir={appliquer}
              agirGroupe={(m, message) => agirGroupe([g.cle], m, message)}
              rouvrir={() => setRouvertes(new Set([...rouvertes, g.cle]))}
              comparer={() => setComparee(g.cle)}
            />,
          ])}
          {visibles.length > 0 && enAttente.length === 0 && suite && (
            <p class="suite-doublons">
              <button type="button" class="principal" onClick={() => choisir(suite.cle)}>
                {t`Suite à valider : ${suite.nom} ›`}
              </button>
            </p>
          )}
        </section>
      </div>

      {gComparee && (
        <Comparateur
          key={gComparee.cle}
          titre={titreGroupe(gComparee, photosDuGroupe(gComparee, fichier), fichier(gComparee.etoile))}
          photos={ordonner(photosDuGroupe(gComparee, fichier)).map((x) => x.f)}
          fermer={() => setComparee(null)}
          entete={(f) => {
            const x = photosDuGroupe(gComparee, fichier).find((p) => p.f.id === f.id);
            return (
              x && (
                <>
                  <span class={`etat-photo ${libelleEtat(x.etat, !aRelire(gComparee, fichier))[0]}`}>{libelleEtat(x.etat, !aRelire(gComparee, fichier))[1]}</span>
                  <span class="legende-doublon">
                    <RaisonIA avis={avisDe(s, gComparee)} id={f.id} />
                    <Emplacement f={f} />
                  </span>
                </>
              )
            );
          }}
          basculer={(f) => appliquer(choisirPhoto(plan, gComparee, f.id, uneSeule(gComparee)))}
          actions={(f) => {
            const x = photosDuGroupe(gComparee, fichier).find((p) => p.f.id === f.id);
            return (
              x && (
                <button type="button" onClick={() => appliquer(choisirPhoto(plan, gComparee, f.id, !aGarder(x.etat) && uneSeule(gComparee)))}>
                  {aGarder(x.etat) ? t`Écarter` : uneSeule(gComparee) ? t`Garder celle-ci` : t`Garder`}
                </button>
              )
            );
          }}
          navigation={{
            texte: t`Groupe ${iComparee + 1} sur ${visibles.length}`,
            precedent: iComparee > 0 ? () => setComparee(visibles[iComparee - 1].g.cle) : undefined,
            suivant: iComparee < visibles.length - 1 ? () => setComparee(visibles[iComparee + 1].g.cle) : undefined,
            accepter: aRelire(gComparee, fichier)
              ? () => {
                  const n = aEcarter(gComparee, fichier).length;
                  agirGroupe([gComparee.cle], accepter(plan, [gComparee]), texteEcartees(n, raisonDe(gComparee)));
                  setComparee(visibles[iComparee + 1]?.g.cle ?? null);
                }
              : undefined,
            outils: <BoutonIARafales cibles={ciblesIA(s, [gComparee])} libelle={t`Choisir avec l’IA`} />,
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Onglet « Mis de côté »
// ---------------------------------------------------------------------------

function MisDeCote() {
  const s = session.value!;
  versionPlan.value;
  const plan = s.plan;
  // Instantané à l'ouverture de l'onglet : une photo remise reste affichée, on peut encore changer d'avis.
  const [ecartees] = useState(() =>
    [...plan.fichiers.values()]
      .filter((f) => f.statut === 'mis_de_cote' && (f.raison === 'doublons' || f.raison === 'doublons_exacts'))
      .map((f) => ({ id: f.id, raison: f.raison as 'doublons' | 'doublons_exacts', doublon: f.doublon as InfoDoublon | undefined })),
  );
  const [groupement, choisirGroupement] = useGroupement(
    'mis_de_cote',
    ecartees.map((x) => plan.fichiers.get(x.id)),
  );
  const elements = ecartees.flatMap((x) => {
    const f = plan.fichiers.get(x.id);
    return f ? [{ ...x, f, section: sectionSelon(groupement, f) }] : [];
  });
  const liste = sections(
    elements.map((e) => ({ section: e.section, aRelire: false })),
    plan,
    s.projet.mode === 'vrac',
  );
  const [section, choisir] = useSection('mis_de_cote', liste);
  if (!elements.length) return <p class="encart">{t`Aucune photo mise de côté à cette étape.`}</p>;
  const dans = elements.filter((e) => e.section === section?.cle).sort((a, b) => (a.f.date ?? '').localeCompare(b.f.date ?? '') || a.id.localeCompare(b.id));
  const aRemettre = dans.filter((e) => e.f.statut === 'mis_de_cote').map((e) => e.id);
  const basculerPhoto = (e: (typeof dans)[number]) =>
    appliquer(e.f.statut === 'mis_de_cote' ? garderAussi(plan, [e.id]) : ecarterDoublons(plan, [{ id: e.id, raison: e.raison, doublon: e.doublon }]));
  const heureDe = (id: string) => plan.fichiers.get(id)?.date?.slice(11, 16) ?? '';
  const cote = reglages.value.tailleMiniatures;

  return (
    <>
      <div class="outils-doublons">
        <ChoixGroupement valeur={groupement} choisir={choisirGroupement} />
        <CurseurTaille />
      </div>
      <p class="discret aide-doublons">{t`Les photos écartées à cette étape. Un clic remet une photo à sa place, un second l’écarte de nouveau.`}</p>
      {section && <TeteSection section={section} detail={pluriel(section.total, 'photo')} />}
      <div class="corps-doublons">
        <ListeSections liste={liste} choisie={section?.cle} choisir={choisir} avancement={false} />
        <section class="contenu-doublons">
          {aRemettre.length > 0 && (
            <p>
              <button type="button" onClick={() => appliquer(garderAussi(plan, aRemettre))}>
                {t`Tout remettre (${nombre(aRemettre.length)})`}
              </button>
            </p>
          )}
          <div class="grille-mis-de-cote">
            {dans.map((e) => {
              const etat = e.f.statut === 'mis_de_cote' ? 'ecartee' : 'gardee';
              return (
                <div key={e.id} class="photo-doublon" style={{ width: `${cote}px` }}>
                  <button
                    type="button"
                    class={`tuile-doublon ${etat}`}
                    aria-pressed={etat === 'gardee'}
                    aria-label={`${e.f.nom} : ${etat === 'gardee' ? t`Remise` : t`Écartée`}`}
                    title={etat === 'gardee' ? t`Cliquer pour l’écarter de nouveau` : t`Cliquer pour la remettre à sa place`}
                    onClick={() => basculerPhoto(e)}
                  >
                    <span class="cadre-tuile" style={{ width: `${cote}px`, height: `${cote}px` }}>
                      <Miniature f={e.f} taille={cote} rotation={e.f.rotation} />
                    </span>
                    <span class={`etat-photo ${etat}`}>{etat === 'gardee' ? t`Remise` : t`Écartée`}</span>
                  </button>
                  <span class="legende-doublon">
                    {section && !section.cle.startsWith('jour:') && e.f.date ? `${nomJour(e.f.date.slice(0, 10))} · ` : ''}
                    {e.f.date && e.f.date.length > 10 ? `${e.f.date.slice(11, 16)} · ` : ''}
                    {e.raison === 'doublons_exacts' ? t`copie exacte` : e.doublon?.garde ? t`doublon de la photo de ${heureDe(e.doublon.garde)}` : t`doublon`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// La page
// ---------------------------------------------------------------------------

export function PageDoublons() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const plan = s.plan;
  const fichier = (id: string) => plan.fichiers.get(id);
  const [strict, setStrict] = useState(s.doublons?.strict ?? false);
  const [modele, setModele] = useState(s.doublons?.modele ?? reglages.value.modeles.standard);
  const [progres, setProgres] = useState<{ faits: number; total: number; texte: string; avecIA: boolean } | null>(null);
  const arreter = useRef(false);

  const listeLots = useMemo(() => lots(s), [versionPlan.value]);
  const dossiers = listeLots.map((l) => l.id);
  const [un, plusieurs] = unite(s);
  const toutes = useMemo(() => [...plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive'), [versionPlan.value]);
  const estimation = useMemo(() => estimerDoublons(plan, s.analyses, dossiers, modele, s.ia), [versionPlan.value, versionIA.value, modele]);
  const chf = estimation.usd * reglages.value.tauxUsdChf;
  const analysesManquantes = s.analyses.manquantes(toutes).length;

  const copies = useCopiesExactes();
  const groupesC = useMemo(() => (copies ? groupesCopies(copies, fichier) : []), [copies]);
  const groupesS = useMemo(() => groupesScenes(s.doublons?.dossiers ?? {}, fichier), [s.doublons, versionIA.value]);
  const parSorte = (sorte: Sorte) => (sorte === 'copies' || sorte === 'dossiers' ? groupesC : groupesS).filter((g) => g.sorte === sorte && groupeVisible(g, fichier));
  const groupes: Record<Sorte, GroupeDoublons[]> = { copies: parSorte('copies'), dossiers: parSorte('dossiers'), rafales: parSorte('rafales'), ia: parSorte('ia') };
  const avancement = (sorte: Sorte) => avancementGroupes(groupes[sorte], fichier);
  const iaLancee = !!s.doublons && Object.values(s.doublons.dossiers).some((d) => d.modele || d.propositions.some((p) => p.source === 'ia'));
  const nbEcartees = [...plan.fichiers.values()].filter((f) => f.statut === 'mis_de_cote' && (f.raison === 'doublons' || f.raison === 'doublons_exacts')).length;
  const intouches = s.projet.mode === 'vrac' ? [...plan.dossiers.values()].filter((d) => d.traitement === 'garder' || d.traitement === 'ignorer').length : 0;

  const premier: Onglet = (['copies', 'rafales', 'ia'] as const).find((o) => groupes[o].some((g) => aRelire(g, fichier))) ?? (groupes.copies.length || groupes.dossiers.length ? 'copies' : 'rafales');
  const onglet = ongletsChoisis.value[s.projet.nom] ?? premier;
  // L'onglet d'arrivée est retenu dès que tout est cherché : il ne change plus de lui-même.
  useEffect(() => {
    if (!ongletsChoisis.value[s.projet.nom] && copies !== null && s.doublons) choisirOnglet(s.projet.nom, premier);
  }, [copies !== null, !!s.doublons]);

  /** `lots` : seulement ces lots (journées ou dossiers) ; par défaut, tous. */
  const lancer = async (avecIA: boolean, lots: string[] = dossiers) => {
    if (avecIA && !cleApi()) {
      notifier('erreur', t`Saisissez d’abord votre clé API dans Réglages.`, { libelle: t`Réglages`, faire: () => (page.value = { nom: 'reglages' }) });
      return;
    }
    if (avecIA && chf > s.ia.resteUSD() * reglages.value.tauxUsdChf) {
      notifier('erreur', t`Le budget restant du projet ne suffit pas (environ ${nombre(chf, 2)} CHF nécessaires) : augmentez-le à l’étape 1.`);
      return;
    }
    if (
      avecIA &&
      chf >= reglages.value.seuilConfirmationChf &&
      !(await confirmer(
        t`Lancer l’analyse IA des doublons ?`,
        estimation.enCache
          ? t`Environ ${nombre(chf, 2)} CHF (au plus) pour ${pluriel(estimation.dossiers, un, plusieurs)} ; ${un === 'journée' ? pluriel(estimation.enCache, 'journée déjà analysée, gratuite', 'journées déjà analysées, gratuites') : pluriel(estimation.enCache, 'dossier déjà analysé, gratuit', 'dossiers déjà analysés, gratuits')}. Des planches de miniatures sont envoyées à l’IA (api.anthropic.com).`
          : t`Environ ${nombre(chf, 2)} CHF (au plus) pour ${pluriel(estimation.dossiers, un, plusieurs)}. Des planches de miniatures sont envoyées à l’IA (api.anthropic.com).`,
        t`Lancer`,
      ))
    )
      return;
    arreter.current = false;
    const debut = performance.now();
    try {
      const res = await analyserDoublons(
        {
          plan,
          etat: s.etat,
          analyses: s.analyses,
          dossiers: lots,
          actuels: dossiers,
          strict,
          ia: avecIA ? { service: s.ia, modele } : null,
          miniature: async (f) => {
            const url = await serviceMiniatures().url(cleMiniature(f.id, f.taille, f.modifie), () => s.source.fichier(f.id));
            return url ? await (await fetch(url)).blob() : await s.source.fichier(f.id);
          },
          original: (f) => s.source.fichier(f.id),
          progres: (faits, total, texte) => setProgres({ faits, total, texte, avecIA }),
          arreter: () => arreter.current,
        },
        s.doublons,
      );
      s.doublons = res.etat;
      const n = groupesARelire(res.etat, plan);
      journal('doublons', t`Doublons (${avecIA ? t`IA, ${modele}` : t`rafales`}, ${strict ? t`strict` : t`prudent`}) : ${pluriel(n, 'groupe à valider', 'groupes à valider')} en ${Math.round((performance.now() - debut) / 1000)} s`);
      if (res.budgetAtteint) notifier('erreur', new BudgetAtteint().message);
      else if (res.arrete) notifier('info', texteArret(un === 'journée', res.faits, lots.length));
      else if (res.erreurs.length)
        notifier('erreur', t`${un === 'journée' ? pluriel(res.erreurs.length, 'journée non analysée', 'journées non analysées') : pluriel(res.erreurs.length, 'dossier non analysé', 'dossiers non analysés')} : ${res.erreurs[0]}`);
      else if (avecIA) notifier('ok', n === 0 ? t`Aucun groupe à valider.` : t`${pluriel(n, 'groupe à valider', 'groupes à valider')} : voyez les onglets « Rafales » et « Même scène (IA) ».`);
      changerEtape(ETAPE.doublons, 'en_cours');
    } catch (err) {
      notifier('erreur', t`Analyse interrompue : ${texteErreur(err)}`);
    } finally {
      setProgres(null);
      versionIA.value++;
    }
  };

  // Les rafales se cherchent avec l'analyse du dossier, dès l'inventaire (D81). Au cas où des journées
  // auraient changé depuis (recherche arrêtée en route, nouvelles photos), l'arrivée sur la page les complète.
  useEffect(() => {
    if (!progres && !analyseEnCours.value && rafalesAChercher(s)) void lancerAnalyseDossier();
  }, [analysesManquantes === 0, !!analyseEnCours.value]);

  const modeleInfo = MODELES.find((m) => m.id === modele);
  const cout = estimation.dossiers ? t`environ ${chf < 0.01 ? `< ${nombre(0.01, 2)}` : nombre(chf, 2)} CHF` : t`gratuit (déjà fait)`;

  const reglagesIA = (
    <>
      <fieldset class="choix-mode">
        <legend>{t`Que considérer comme doublon ?`}</legend>
        <label>
          <input type="radio" name="mode" checked={!strict} onChange={() => setStrict(false)} /> <strong>{t`Prudent`}</strong>
          {t` (conseillé) : des expressions ou des poses différentes sont gardées`}
        </label>
        <label>
          <input type="radio" name="mode" checked={strict} onChange={() => setStrict(true)} /> <strong>{t`Strict`}</strong>
          {t` : une seule photo par scène, même si les expressions changent`}
        </label>
      </fieldset>
      <div class="actions-etape">
        <button type="button" class="principal" disabled={!!progres || analysesManquantes > 0 || !modeleInfo} onClick={() => void lancer(true)}>
          {t`Analyser avec l’IA — ${cout}`}
        </button>
        <span class="discret">{t`${pluriel(dossiers.length, un, plusieurs)} · dépensé : ${nombre(s.ia.depenseCHF(), 2)} / ${s.projet.budget_chf} CHF`}</span>
      </div>
      <details class="avances">
        <summary>{t`Réglages avancés`}</summary>
        <label>
          {t`Modèle IA`}{' '}
          <select value={modele} onChange={(e) => setModele(e.currentTarget.value)}>
            {MODELES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </select>
        </label>
        <p class="discret">
          {t`Les consignes viennent du script 06, réglé avec Claude Sonnet 4.6 ; les réponses sont mises en cache par modèle. Réglages du script : rafales à moins de 10 min et distance ≤ 12 ; scènes locales à distance ≤ 20 ; vérification par 6 photos au plus.`}
        </p>
        <button
          type="button"
          onClick={() =>
            void s.ia.oublierInexploitables().then((n) => notifier('info', n ? t`${pluriel(n, 'réponse illisible oubliée', 'réponses illisibles oubliées')} : relancez l’analyse.` : t`Aucune réponse illisible.`))
          }
        >
          {t`Redemander les réponses illisibles`}
        </button>
      </details>
    </>
  );

  /** Compteur d'un onglet : ce qui reste à relire, ✓ quand tout l'est. */
  const compte = (o: Onglet): ComponentChildren => {
    if (o === 'mis_de_cote') return <span class="compte gris">{nombre(nbEcartees)}</span>;
    if (o === 'copies' && copies === null) return <span class="compte gris">…</span>;
    if (o === 'ia' && !iaLancee) return <span class="compte gris">{t`pas lancée`}</span>;
    const { relus, total } = avancement(o);
    // Copies : celles dans plusieurs dossiers gardés n'ont rien à relire ; elles comptent quand il ne reste qu'elles.
    if (!total) return <span class="compte gris">{nombre(o === 'copies' ? groupes.dossiers.length : 0)}</span>;
    return relus === total ? <span class="compte fini">✓ {nombre(total)}</span> : <span class="compte">{t`${nombre(total - relus)} à valider`}</span>;
  };
  const ONGLETS: [Onglet, string][] = [
    ['copies', t`Copies exactes`],
    ['rafales', t`Rafales`],
    ['ia', t`Même scène (IA)`],
    ['mis_de_cote', t`Mis de côté`],
  ];

  const enAttente = (['copies', 'rafales', 'ia'] as const).reduce((n, o) => n + avancement(o).total - avancement(o).relus, 0);
  const resumeOnglet = (o: Sorte, nom: string) => {
    const { relus, total } = avancement(o);
    return `${nom} ${nombre(relus)} / ${nombre(total)}`;
  };

  return (
    <div class="page large avec-barre page-doublons">
      <TeteEtape numero={ETAPE.doublons} titre={nomEtape(ETAPE.doublons)} cle="doublons">
        {t`Les photos en double sont rangées par sorte, dans les onglets ci-dessous. Dans chaque groupe, un clic choisit la photo à garder ; « Accepter » valide le groupe. Les photos écartées vont dans « ${nomsSortie().misDeCote} » : rien n’est supprimé, et Ctrl+Z annule.`}
        {s.projet.mode === 'vrac' && t` Le dossier n’étant pas encore trié, les rafales sont cherchées journée par journée.`}
      </TeteEtape>

      <EncartAnalyse photos={toutes} pourquoi={t`la ressemblance et la netteté de chaque photo servent à repérer les doublons et à garder la plus nette.`} />

      <nav class="onglets-doublons" aria-label={t`Sortes de doublons`}>
        {ONGLETS.map(([o, nom]) => (
          <button
            key={o}
            type="button"
            class={`onglet-doublons${o === onglet ? ' actif' : ''}`}
            aria-current={o === onglet ? 'page' : undefined}
            onClick={() => choisirOnglet(s.projet.nom, o)}
          >
            {nom} {compte(o)}
          </button>
        ))}
      </nav>

      {progres && (
        <div class="encart">
          <BarreProgression faits={progres.faits} total={progres.total} texte={`${progres.avecIA ? t`Analyse IA` : t`Recherche des rafales`} · ${progres.faits} / ${progres.total} ${t(plusieurs)}${progres.texte ? ` · ${progres.texte}` : ''}`} />
          <button type="button" onClick={() => (arreter.current = true)}>
            {t`Arrêter (les réponses déjà reçues sont gardées)`}
          </button>
        </div>
      )}

      {onglet === 'copies' &&
        (copies === null ? (
          <p class="encart">{t`Recherche des copies en cours, pendant l’analyse des photos…`}</p>
        ) : !groupes.copies.length && !groupes.dossiers.length ? (
          <p class="encart">{t`Aucune copie exacte : chaque photo n’existe qu’en un exemplaire.`}</p>
        ) : (
          <>
            <div class="encart encart-onglet">
              <p>
                {t`La même photo en plusieurs exemplaires : le même fichier copié, ou une copie réduite envoyée par WhatsApp. Proposition : écarter un exemplaire qui ferait double emploi au même endroit (deux fois dans un dossier, ou une photo à trier déjà rangée dans un dossier) ; il ira dans « ${dossierMisDeCote('doublons_exacts')} ». Une photo présente dans plusieurs dossiers que vous gardez y reste partout : à vous de décider, photo par photo.`}
                {intouches > 0 && t` Les dossiers « Ne pas toucher » ne sont pas examinés : leurs copies sont voulues.`}
              </p>
            </div>
            <ListeGroupes key="copies" onglet="copies" groupes={[...groupes.copies, ...groupes.dossiers]} titre={t`Toutes les copies exactes`} />
          </>
        ))}

      {onglet === 'rafales' &&
        (!s.doublons ? (
          <p class="encart">{t`Recherche des rafales dès que l’analyse des photos est finie…`}</p>
        ) : !groupes.rafales.length ? (
          <p class="encart">{t`Aucune rafale : pas de photos quasi identiques prises à la suite.`}</p>
        ) : (
          <>
            <p class="encart encart-onglet">
              {t`Photos quasi identiques prises à la suite (quelques minutes au plus), repérées sur l’ordinateur (gratuit). La ★ va à la plus nette ; quand les photos se valent, gardez celle que vous préférez. « Plus nette », « plus sombre »… sous une photo signalent un écart visible. « Choisir avec l’IA » : l’IA choisit dans chaque rafale et dit pourquoi, vous validez.`}
            </p>
            <ListeGroupes key="rafales" onglet="rafales" groupes={groupes.rafales} titre={t`Toutes les rafales`} />
          </>
        ))}

      {onglet === 'ia' &&
        (!iaLancee ? (
          <div class="encart encart-ia">
            <p>
              {t`Facultatif : l’IA repère la même scène photographiée plusieurs fois (pas seulement les rafales), puis vérifie chaque groupe en grand. Coût :`} <strong>{cout}</strong>
            </p>
            {reglagesIA}
          </div>
        ) : (
          <>
            <details class="avances encart-ia">
              <summary>{t`Analyse IA faite — la relancer : ${cout}`}</summary>
              {reglagesIA}
            </details>
            {groupes.ia.length ? <ListeGroupes key="ia" onglet="ia" groupes={groupes.ia} titre={t`Toutes les scènes en double`} /> : <p class="encart">{t`L’IA n’a trouvé aucune autre scène en double.`}</p>}
          </>
        ))}

      {onglet === 'mis_de_cote' && <MisDeCote />}

      <BarreValidation
        resume={[
          resumeOnglet('copies', t`Copies exactes`),
          resumeOnglet('rafales', t`Rafales`),
          iaLancee ? resumeOnglet('ia', t`IA`) : t`IA pas lancée`,
          pluriel(nbEcartees, 'photo écartée', 'photos écartées'),
        ].join(' · ')}
        alertes={enAttente ? [t`${pluriel(enAttente, 'groupe pas encore validé', 'groupes pas encore validés')} : leurs photos restent dans l’archive`] : []}
        revenir={() => revenirDe('doublons')}
        valider={() => validerEtape('doublons')}
      />
    </div>
  );
}
