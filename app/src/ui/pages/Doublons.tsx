// Étape « Doublons » (SPEC § 6.8, D71) : un onglet par sorte de doublons —
// copies exactes (avec les photos présentes dans plusieurs dossiers gardés,
// D86), rafales (repérées sur l'ordinateur, gratuit), même scène (IA, à la
// demande) — et un onglet des photos mises de côté. Les groupes se relisent journée par journée (ou
// dossier par dossier) ; un clic sur une photo la garde ou l'écarte, rien ne
// disparaît de l'écran et tout s'annule (Ctrl+Z). Rien n'est écarté sans
// action de l'utilisateur (règle d'or 3).

import { signal } from '@preact/signals';
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
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
  prochainAAccepter,
  sectionJour,
  type GroupeDoublons,
  type EtatPhoto,
  type PhotoDuGroupe,
  type Sorte,
} from '../../lib/groupesDoublons';
import { aTraduire, t } from '../../lib/langue';
import { comparerPhotos, LIBELLES_REMARQUES, type Comparaison } from '../../lib/comparerPhotos';
import { cheminDossier, comparerNoms, dossierSource, ecarterDoublons, garderAussi, RACINE, traitementDe, type FichierPlan, type InfoDoublon, type Modification, type Plan } from '../../lib/plan';
import type { Presentation } from '../../lib/presentationComparer';
import { MODELES } from '../../lib/tarifs';
import { cleApi } from '../../navigateur/cle';
import { analyserDoublons, estimerDoublons, lotsDoublons, type EtatDoublons } from '../../navigateur/doublons';
import { BudgetAtteint } from '../../navigateur/ia';
import { cleMiniature } from '../../navigateur/miniatures';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { analyseEnCours, lancerAnalyseDossier, rafalesAChercher } from '../analyseDossier';
import { EncartAnalyse } from '../composants/Analyse';
import { BarreProgression, BarreValidation, RaisonDesactivee, useDeroulant } from '../composants/Cadre';
import { EnteteCadre, largeurFenetre, OutilsCadre, PanneauAide, useCadre, useMenuListe } from '../composants/CadreCommun';
import { Comparateur, type NavigationGroupes, type PresentationGardee } from '../composants/Comparateur';
import { confirmer } from '../composants/Dialogues';
import { Miniature } from '../composants/GrillePhotos';
import { Icone } from '../composants/Icones';
import { redimensionner, styleLargeurPanneau } from '../composants/PanneauDossiers';
import { REGLAGES_DEFAUT } from '../../navigateur/reglages';
import { useCopiesExactes } from '../copiesExactes';
import { allerEtape, annulations, annuler, appliquer, changerEtape, changerReglages, journal, notifier, page, reglages, revenirDe, serviceMiniatures, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { dateHeure, nombre, nomJour, nomMois, pluriel, taille as texteTaille } from '../format';
import { simplifier } from '../organiser';
import { enregistrerAide } from './AidesIA';
import { avisDe, BoutonIARafales, ciblesIA, estimationIA, iaRafales } from '../iaRafales';
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
  description: aTraduire('Dans chaque rafale pas encore acceptée, l’IA choisit la meilleure photo (yeux fermés, regards, flou, personne qui manque) et dit pourquoi ; vous acceptez.'),
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

/** Un champ où l'on tape du texte (une case à cocher n'en est pas un : elle suit le plein comme un bouton). */
function estChampDeSaisie(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  if (el instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(el.type);
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

// ---------------------------------------------------------------------------
// Cadre commun (lot 4, D111) : la page, l'Aide, la liste de gauche en menu au palier
// ---------------------------------------------------------------------------

/** Ce que la page donne à chaque onglet : les onglets (barre d'outils), l'Aide, le palier et le menu de la liste. */
interface CadreDoublons {
  onglets: ComponentChildren;
  aide: boolean;
  palier: boolean;
  /** Le texte de l'Aide de l'onglet affiché. */
  texteAide: ComponentChildren;
  listeOuverte: boolean;
  ouvrirListe: (oui: boolean) => void;
  /** Le prochain onglet qui reste à accepter (son nom, ce qui y reste), pour le plein d'un onglet fini. */
  ongletSuivant: { nom: string; reste: number; aller: () => void } | null;
}
const ContexteCadre = createContext<CadreDoublons | null>(null);

/**
 * Le corps d'un onglet : la liste de gauche (une colonne, ou un menu au palier : le même composant, un seul
 * exemplaire), la table (sa tête fixe, puis ce qui défile) et l'Aide en colonne. Seule la zone de contenu défile.
 */
function CorpsCadre({ liste, nomListe, tete, zone, children }: { liste?: ComponentChildren; nomListe?: ComponentChildren; tete?: ComponentChildren; zone?: { current: HTMLDivElement | null }; children: ComponentChildren }) {
  const c = useContext(ContexteCadre)!;
  return (
    <div class="corps-cadre">
      {liste && <div class="colonne-liste">{liste}</div>}
      <section class="table-cadre">
        {(tete || (c.palier && liste)) && (
          <div class="tete-col tete-table">
            {c.palier && liste && (
              <button type="button" class="menu-liste" data-action="menu-liste" aria-expanded={c.listeOuverte} aria-haspopup="true" onClick={() => c.ouvrirListe(!c.listeOuverte)} title={t`Choisir la journée ou le dossier affiché (N : suivant, P : précédent)`}>
                <span class="nom-menu-liste">{nomListe}</span>
                <Icone nom={c.listeOuverte ? 'chevronHaut' : 'chevronBas'} taille={16} />
              </button>
            )}
            {tete}
          </div>
        )}
        <div class="defile-col contenu-doublons" ref={zone}>
          {children}
        </div>
      </section>
      {c.aide && (
        <PanneauAide cle="doublons" titre={nomEtape(ETAPE.doublons)}>
          {c.texteAide}
        </PanneauAide>
      )}
    </div>
  );
}

/**
 * Un menu nommé de la barre d'outils ou de la tête de la table (« Toutes les copies ▾ », « Cette journée ▾ ») :
 * les actions d'une portée, dites par son nom ; ✦ quand une aide IA y est (C-4.6, son prix est sur sa ligne).
 */
function MenuPortee({ libelle, ia = false, children }: { libelle: string; ia?: boolean; children: ComponentChildren }) {
  const [ouvert, basculer, zone] = useDeroulant();
  return (
    <div class="menu-portee" ref={zone}>
      <button type="button" class="bouton-portee" aria-expanded={ouvert} aria-haspopup="true" onClick={() => basculer()}>
        {ia && <Icone nom="etincelle" taille={20} />}
        {libelle}
        <Icone nom={ouvert ? 'chevronHaut' : 'chevronBas'} taille={16} />
      </button>
      {ouvert && (
        <div class="menu-deroulant menu-actions" onClick={(e) => (e.target as HTMLElement).closest('button:not(:disabled)') && basculer(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Un onglet fini (ou « Mis de côté ») : le plein mène au prochain onglet qui reste à accepter (« Rafales : 6 à
 * accepter › », É1) ; quand tout est accepté, c'est « Valider et continuer » qui est plein (tour 1 du lot 4).
 */
function BoutonOngletSuivant() {
  const c = useContext(ContexteCadre)!;
  if (!c.ongletSuivant) return null;
  const { nom, reste, aller } = c.ongletSuivant;
  return (
    <button type="button" class="principal" data-action="onglet-suivant" onClick={aller}>
      {t`${nom} : ${nombre(reste)} à accepter`}
      <Icone nom="chevronDroite" taille={20} />
    </button>
  );
}

/** La zone qui défile vraiment : la colonne des groupes, ou la page sous 440 px de haut. */
function defileur(z: HTMLElement): HTMLElement | null {
  return getComputedStyle(z).overflowY === 'visible' ? null : z;
}

/** Ce qu'on voit de la zone des groupes : sous la tête de la table, au-dessus de la barre du bas. */
function bornesVisibles(z: HTMLElement): { haut: number; bas: number } {
  const r = z.getBoundingClientRect();
  const tete = z.closest('.table-cadre')?.querySelector('.tete-table')?.getBoundingClientRect();
  const barre = document.querySelector('.barre-validation')?.getBoundingClientRect();
  return { haut: Math.max(r.top, 0, tete ? tete.bottom : 0), bas: Math.min(r.bottom, innerHeight, barre ? barre.top : innerHeight) };
}

function entier(e: Element | null | undefined, haut: number, bas: number): boolean {
  if (!e) return false;
  const q = e.getBoundingClientRect();
  return q.height > 0 && q.top >= haut - 1 && q.bottom <= bas + 1;
}

/**
 * Fait défiler pour que `e` commence en haut de ce qu'on voit (défilement de l'application, pas un geste) ;
 * `commeArrivee` : sous la marge du haut, là où le premier groupe est à l'arrivée (après « Accepter »).
 */
function amenerEnHaut(z: HTMLElement, e: Element, commeArrivee = false) {
  const { haut } = bornesVisibles(z);
  const marge = commeArrivee ? parseFloat(getComputedStyle(z).paddingTop) || 0 : 0;
  const d = e.getBoundingClientRect().top - haut - marge;
  if (Math.abs(d) < 1) return;
  const zone = defileur(z);
  if (zone) zone.scrollTop += d;
  else window.scrollBy(0, d);
}

/**
 * Taille des photos de Doublons : le réglage « Taille », réduit d'un quart au palier « texte agrandi » (160 → 120,
 * § 1.4) pour que l'en-tête, la photo et sa bande « À garder » tiennent ensemble à 1024×464 (tour 1 du lot 4).
 */
function coteDoublons(palier: boolean): number {
  const v = reglages.value.tailleMiniatures;
  return palier ? Math.max(100, Math.round((v * 0.75) / 4) * 4) : v;
}

/** Le plein et ses repères dans la zone des groupes. */
const PLEIN = 'article.carte-doublons > header [data-action=accepter].principal';

/** Les photos de la racine : celles à trier, tant que le dossier est en vrac. */
function nomRacine(vrac: boolean): string {
  return vrac ? t`Photos à trier` : t`Photos (racine)`;
}

/** « 2 photos écartées : dans « Mis de côté » » (le mot de la barre du bas, C-10.2 ; le dossier technique est dans l'infobulle de « Mis de côté »). */
function texteEcartees(n: number): string {
  return t`${pluriel(n, 'photo écartée', 'photos écartées')} : dans « Mis de côté »`;
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

/**
 * Liste de gauche : en haut, ce qu'on montre (Afficher, Grouper, Classer) et « Chercher » ; dessous, chaque
 * journée (ou dossier), ce qui reste à accepter, ✓ quand c'est fait. Au palier, le même composant est le menu
 * de la tête de la table (un seul exemplaire dans la page).
 */
function ListeSections({ liste, choisie, choisir, avancement = true, outils }: { liste: Section[]; choisie?: string; choisir: (cle: string) => void; avancement?: boolean; outils?: ComponentChildren }) {
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
    <nav class="sections-doublons" aria-label={t`Journées et dossiers`}>
      <div
        class="poignee-panneau"
        role="separator"
        aria-orientation="vertical"
        title={t`Tirer pour élargir le panneau (double-clic : largeur d’origine)`}
        onPointerDown={redimensionner}
        onDblClick={() => changerReglages({ ...reglages.value, largeurPanneau: REGLAGES_DEFAUT.largeurPanneau })}
      />
      {outils && <div class="outils-doublons">{outils}</div>}
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
      <div class="defile-col liste-sections">
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
                      <span class="reste" title={t`groupes à accepter`}>
                        {nombre(x.aRelire)}
                      </span>
                    ) : (
                      <span class="fait" title={t`tout est accepté`}>
                        <Icone nom="coche" taille={16} />
                      </span>
                    )}
                  </button>,
                ];
              })}
            </div>
          ))}
      </div>
    </nav>
  );
}

/** Le nom de la section dans le menu de la liste (palier) : son nom et ce qui y reste à accepter. */
function NomSection({ section, avancement = true }: { section: Section; avancement?: boolean }) {
  return (
    <>
      {section.nom}
      {avancement && section.aRelire > 0 && <span class="reste-menu">{t`${nombre(section.aRelire)} à accepter`}</span>}
    </>
  );
}

/** Ce que désigne une section, pour dire la portée de ses boutons : « Ce mois », « Cette journée »… */
function porteeSection(x: Section): string {
  if (x.cle.startsWith('jour:')) return t`Cette journée`;
  if (x.cle.startsWith('mois:')) return t`Ce mois`;
  if (estDossier(x)) return t`Ce dossier`;
  return t`Sans date`;
}

/** La tête de la table : le titre de la section et son détail (au palier, le menu de la liste les remplace). */
function TeteSection({ section, detail }: { section: Section; detail: string }) {
  const c = useContext(ContexteCadre)!;
  if (c.palier) return <span class="discret detail-section">{detail}</span>;
  return (
    <>
      <h2 class="titre-section" title={section.titre}>
        {section.titre}
      </h2>
      <span class="discret detail-section">{detail}</span>
    </>
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

/** Où est la photo proposée d'une rafale : son dossier, ou les photos à trier. */
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

function titreGroupe(g: GroupeDoublons, photos: PhotoDuGroupe[]): string {
  const n = photos.length;
  // Copies : « 3 exemplaires » (le nom du fichier est sur la ligne de chaque exemplaire ; « de la même photo » dans l'infobulle).
  if (g.sorte === 'copies' || g.sorte === 'dossiers') return pluriel(n, 'exemplaire');
  // La durée (« en moins d'une seconde ») est dans l'infobulle du titre : l'en-tête garde la place de « Comparer
  // en grand » avec son mot (É7, tour 1 du lot 4).
  if (g.sorte === 'rafales') return t`Rafale de ${nombre(n)} photos`;
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

function texteProposition(g: GroupeDoublons, n: number, c: Comparaison, avis?: AvisRafale, vue = false): string {
  // Sans choix posé, c'est g.etoile qui est gardée : si l'IA en préfère une autre (son choix annulé), on le dit.
  // Pas de ★ à Doublons (C-3.5) : la photo conseillée le dit sous elle, « Conseillée par l'IA ».
  // Dans « Comparer en grand », un clic sur la photo ne la choisit pas : c'est « À garder » ou sa touche.
  if (avis)
    return !avis.meilleure
      ? t`L’IA ne départage pas (trop de monde) : à vous de choisir`
      : avis.meilleure === g.etoile
        ? t`Proposition de l’IA : garder la photo conseillée`
        : vue
          ? t`L’IA conseille une autre photo : « À garder » sous elle la choisit`
          : t`L’IA conseille une autre photo : cliquez-la pour la choisir`;
  if (g.sorte === 'rafales') {
    if (c.plusNette === g.etoile) return t`Proposition : garder la plus nette`;
    if (c.plusNette) return t`Une photo est choisie ; une autre paraît plus nette`;
    return vue ? t`Elles se valent : choisissez celle à garder` : t`Elles se valent : une photo est choisie, cliquez celle que vous préférez`;
  }
  if (g.sorte === 'ia') return t`Proposition de l’IA : garder la photo conseillée`;
  return t`Proposition : écarter ${pluriel(n, 'exemplaire')}`;
}

/**
 * Où est la photo : son dossier dans la source (chemin), et celui où le plan
 * la range s'il est autre (après le tri, un déplacement) ; pour choisir quoi
 * garder (D96) : dans l'infobulle de chaque photo et dans « Comparer en grand ».
 */
function Emplacement({ f }: { f: FichierPlan }) {
  const s = session.value!;
  const source = dossierSource(f);
  const rangee = rangeeDans(s, f);
  return (
    <>
      <strong class="chemin-doublon">{source || nomRacine(s.projet.mode === 'vrac')}</strong>
      {rangee !== null && <span class="chemin-doublon">{` · ${t`rangée dans « ${rangee} »`}`}</span>}
    </>
  );
}

/** Le dossier où le plan range la photo, s'il n'est pas celui de la source ; sinon `null`. */
function rangeeDans(s: Session, f: FichierPlan): string | null {
  const rangee = cheminDossier(s.plan, f.dossier);
  return f.statut === 'archive' && rangee !== dossierSource(f) ? rangee || t`Photos (racine)` : null;
}

/**
 * La photo conseillée d'un groupe, et pourquoi : l'IA (rafale examinée, même scène), la plus nette
 * d'une rafale, l'original d'une copie réduite. Rien quand les photos se valent (D101) : pas de ★ à
 * Doublons, le conseil se dit en mots sous la photo (C-3.5).
 */
type Conseil = { id: string; pourquoi: 'ia' | 'nette' | 'original' };
function conseilDe(g: GroupeDoublons, c: Comparaison, avis?: AvisRafale): Conseil | undefined {
  if (avis) return avis.meilleure ? { id: avis.meilleure, pourquoi: 'ia' } : undefined;
  if (g.sorte === 'rafales') return c.plusNette === g.etoile ? { id: g.etoile, pourquoi: 'nette' } : undefined;
  if (g.sorte === 'ia') return { id: g.etoile, pourquoi: 'ia' };
  return g.membres.some((m) => m.reduite) ? { id: g.etoile, pourquoi: 'original' } : undefined;
}

const TEXTES_CONSEIL = { ia: aTraduire('Conseillée par l’IA'), nette: aTraduire('La plus nette'), original: aTraduire('L’original, pas réduit') } as const;

/** Ce qui distingue la photo, en mots courts (C-9.6) : sous la photo, et sur la ligne de « Comparer en grand ». */
function RemarqueDoublon({ g, x, c, avis, conseil }: { g: GroupeDoublons; x: PhotoDuGroupe; c: Comparaison; avis?: AvisRafale; conseil?: Conseil }) {
  const s = session.value!;
  const { m, f } = x;
  const remarque = c.remarques.get(m.id);
  const conseillee = conseil?.id === m.id;
  const raison = avis?.photos[m.id]?.raison;
  const morceaux: ComponentChildren[] = [];
  if (g.sorte === 'copies' || g.sorte === 'dossiers') {
    // Une copie se désigne par son dossier dans la source (le tri a pu la ranger ailleurs : infobulle),
    // puis ce qui la distingue des autres exemplaires : copie réduite, poids, nom s'il diffère.
    morceaux.push(<strong class="chemin-doublon">{dossierSource(f) || nomRacine(s.projet.mode === 'vrac')}</strong>);
    if (m.reduite) morceaux.push(<span class="alerte-legende">{t`copie réduite`}</span>);
    morceaux.push(<span class="num">{texteTaille(f.taille)}</span>);
    const noms = new Set(g.membres.map((x) => s.plan.fichiers.get(x.id)?.nom));
    if (noms.size > 1) morceaux.push(<span>{f.nom}</span>);
  }
  // Ce qui compare la photo aux autres d'abord : c'est ce qui décide (« plus nette »).
  if (remarque && !(remarque === 'plus_nette' && conseillee && conseil?.pourquoi === 'nette')) morceaux.push(<span class={`remarque-doublon ${remarque === 'plus_nette' ? 'qualite' : 'defaut'}`}>{t(LIBELLES_REMARQUES[remarque])}</span>);
  if (conseillee && conseil)
    morceaux.push(
      <span class="etoile-doublon">
        {conseil.pourquoi === 'ia' && <Icone nom="etincelle" taille={14} />}
        {t(TEXTES_CONSEIL[conseil.pourquoi])}
      </span>,
    );
  if (raison)
    morceaux.push(
      <span class="raison-ia">
        <Icone nom="etincelle" taille={14} titre={t`Selon l’IA`} />
        {raison}
      </span>,
    );
  if (g.sorte === 'ia' && m.description)
    morceaux.push(
      <span>
        <Icone nom="etincelle" taille={14} titre={t`Selon l’IA`} />
        {m.description}
      </span>,
    );
  if (m.refus) morceaux.push(<em class="refus">{t`Gardée par le garde-fou : l’IA la décrit autrement.`}</em>);
  return <>{morceaux.flatMap((x, i) => (i ? [' · ', x] : [x]))}</>;
}

/** Tout ce qu'on sait de la photo, en texte entier : l'infobulle de la photo et de sa légende dans « Comparer en grand ». */
function lignesPhoto(g: GroupeDoublons, x: PhotoDuGroupe, c: Comparaison, avis?: AvisRafale, conseil?: Conseil): string[] {
  const s = session.value!;
  const { m, f } = x;
  const r = g.remplacement;
  const nomDossier = (id: string) => cheminDossier(s.plan, id) || t`Photos (racine)`;
  const remarque = c.remarques.get(m.id);
  const rangee = rangeeDans(s, f);
  return [
    f.nom,
    dateHeure(f.date),
    t`Dossier : ${dossierSource(f) || nomRacine(s.projet.mode === 'vrac')}`,
    ...(rangee !== null ? [t`rangée dans « ${rangee} »`] : []),
    ...(g.sorte === 'copies' || g.sorte === 'dossiers' ? [`${f.dims ? `${nombre(f.dims.l)} × ${nombre(f.dims.h)} · ` : ''}${texteTaille(f.taille)}`] : []),
    ...(s.projet.mode === 'vrac' && (g.sorte === 'copies' || g.sorte === 'dossiers') && traitementDe(s.plan, f.dossier) === 'nettoyer' ? [t`dossier gardé, nettoyé`] : []),
    ...(m.reduite ? [t`copie réduite`] : []),
    ...(r && m.id === r.original ? [f.dossier === r.dossier ? t`placée dans « ${nomDossier(r.dossier)} », à la place de la copie réduite` : t`ira dans « ${nomDossier(r.dossier)} », à la place de la copie réduite`] : []),
    ...(conseil?.id === m.id ? [t(TEXTES_CONSEIL[conseil.pourquoi])] : []),
    ...(avis?.photos[m.id]?.raison ? [t`IA : ${avis.photos[m.id]!.raison}`] : []),
    ...(g.sorte === 'ia' && m.description ? [t`IA : ${m.description}`] : []),
    ...(remarque ? [t(LIBELLES_REMARQUES[remarque])] : []),
    ...(m.refus ? [t`Gardée par le garde-fou : l’IA la décrit autrement.`] : []),
  ].filter(Boolean);
}

/**
 * Ce que fait « Accepter », dit en entier (É9, § 1.7) : la même chose sur la carte du groupe et dans
 * « Comparer en grand ». Une photo gardée : sa place et sa vignette (« garder la 4 [v], écarter 5 autres ») ;
 * plusieurs : « garder 3 photos, écarter 9 autres » ; aux Copies, le nom exact du dossier de l'exemplaire
 * gardé (« garder celle de « Vacances à Annecy », écarter 2 »). Jamais un nombre nu à côté des places.
 */
function libelleAccepter(g: GroupeDoublons, photos: PhotoDuGroupe[]): { contenu: ComponentChildren; lecteur: string } {
  const s = session.value!;
  const gardees = photos.filter((x) => aGarder(x.etat));
  const n = photos.length;
  const m = photos.filter((x) => x.etat === 'a_ecarter').length;
  const k = gardees.length;
  const copie = g.sorte === 'copies' || g.sorte === 'dossiers';
  const texte = (x: string) => ({ contenu: x, lecteur: x });
  if (!k) return texte(t`Accepter : écarter les ${nombre(n)}`);
  if (!m) return texte(t`Accepter : garder les ${nombre(k)}`);
  if (copie) {
    if (k > 1) return texte(t`Accepter : garder ${nombre(k)} exemplaires, écarter ${nombre(m)}`);
    // Le nom exact du dossier ; s'il manque de place (Comparer en grand, nom très long), il se raccourcit, entier dans l'infobulle.
    const dossierDe = (f: FichierPlan) => dossierSource(f) || nomRacine(s.projet.mode === 'vrac');
    const dossier = dossierDe(gardees[0].f);
    // Un autre exemplaire dans le même dossier : le dossier ne dit plus lequel est gardé ; le nom du fichier le
    // dit (raccourci au milieu, entier dans l'infobulle et pour le lecteur d'écran ; tour 1 du lot 4).
    if (photos.some((x) => x !== gardees[0] && dossierDe(x.f) === dossier)) {
      const fichier = gardees[0].f.nom;
      return {
        contenu: (
          <>
            {t`Accepter : garder « `}
            <span class="nom-libelle" title={fichier}>
              {raccourcirMilieu(fichier, 28)}
            </span>
            {t` », écarter ${nombre(m)}`}
          </>
        ),
        lecteur: t`Accepter : garder « ${fichier} », écarter ${nombre(m)}`,
      };
    }
    return {
      contenu: (
        <>
          {/* Espaces insécables : ils restent autour du nom, qui est un élément à part. */}
          {t`Accepter : garder celle de « `}
          <span class="nom-libelle" title={dossier}>
            {dossier}
          </span>
          {t` », écarter ${nombre(m)}`}
        </>
      ),
      lecteur: t`Accepter : garder celle de « ${dossier} », écarter ${nombre(m)}`,
    };
  }
  const places = gardees.map((x) => nombre(photos.indexOf(x) + 1));
  if (k > 1)
    return {
      contenu: m === 1 ? t`Accepter : garder ${nombre(k)} photos, écarter 1 autre` : t`Accepter : garder ${nombre(k)} photos, écarter ${nombre(m)} autres`,
      // Le nom lu commence par le texte visible (WCAG 2.5.3) ; les places suivent entre parenthèses.
      lecteur:
        (m === 1 ? t`Accepter : garder ${nombre(k)} photos, écarter 1 autre` : t`Accepter : garder ${nombre(k)} photos, écarter ${nombre(m)} autres`) +
        ` (${places.map((p) => t`la ${p}`).join(', ')})`,
    };
  const x = gardees[0];
  const heure = x.f.date && x.f.date.length > 10 ? x.f.date.slice(11, 19) : '';
  return {
    contenu: (
      <>
        {t`Accepter : garder la ${places[0]}`}
        <Miniature f={x.f} taille={24} rotation={x.f.rotation} />
        <span class="suite-libelle">{m === 1 ? t`, écarter 1 autre` : t`, écarter ${nombre(m)} autres`}</span>
      </>
    ),
    // Le nom lu commence par le texte visible (WCAG 2.5.3) ; l'heure de la photo gardée suit entre parenthèses.
    lecteur: (m === 1 ? t`Accepter : garder la ${places[0]}, écarter 1 autre` : t`Accepter : garder la ${places[0]}, écarter ${nombre(m)} autres`) + (heure ? t` (photo de ${heure})` : ''),
  };
}

/** Un nom trop long raccourci au milieu (« 0140_2025…25.jpg ») : le début et l'extension restent lisibles. */
function raccourcirMilieu(nom: string, max: number): string {
  if (nom.length <= max) return nom;
  const fin = Math.floor((max - 1) / 2);
  return `${nom.slice(0, max - 1 - fin)}…${nom.slice(nom.length - fin)}`;
}

/** Entrée gardée enfoncée sur un plein : seul le premier appui compte (garde du § 1.7, comme pour A). */
export function entreeRepetee(e: KeyboardEvent): void {
  if ((e.key === 'Enter' || e.key === ' ') && e.repeat) e.preventDefault();
}

/** Alerte quand aucune photo du groupe n'est choisie : « Accepter » mettrait tout de côté. */
function alerteRienGarde(): string {
  return t`Aucune photo choisie : tout le groupe ira dans « Mis de côté ».`;
}

/** L'état écrit d'une photo (C-9.2) ; dans un groupe pas encore accepté, une photo gardée est « À garder » (D101). */
function libelleEtat(etat: EtatPhoto, valide: boolean): [classe: EtatPhoto, libelle: string] {
  if (etat === 'gardee' && !valide) return ['choisie', t`À garder`];
  return [etat, etat === 'gardee' ? t`Gardée` : etat === 'ecartee' ? t`Écartée` : etat === 'choisie' ? t`À garder` : t`À écarter`];
}

/** La bande d'état sous une photo (C-9.1) : un état, écrit, jamais la forme d'un bouton. */
function BandeEtat({ classe, libelle, autre = '', place }: { classe: string; libelle: string; autre?: string; place?: number }) {
  const garde = classe === 'gardee' || classe === 'choisie';
  // Dans une rafale, la place de la photo au début de sa bande (« 4 · À garder ») : le chiffre de la touche de
  // Comparer et du bouton « Accepter » ; elle prend la place de l'icône, rien n'est posé sur l'image (C-9.1).
  return (
    <span class={`etat-photo bande-etat ${classe}${autre ? ` ${autre}` : ''}`}>
      {place !== undefined ? <span class="place-photo num">{`${nombre(place)} · `}</span> : <Icone nom={garde ? 'coche' : 'croix'} taille={16} />}
      {libelle}
    </span>
  );
}

/**
 * Une photo : un clic la choisit (D101). Dans une rafale ou une même scène, sans « Garder plusieurs
 * photos », elle est choisie seule ; Ctrl+clic l'ajoute ou la retire sans toucher aux autres. Son état
 * est écrit dans la bande dessous, une remarque courte suit ; le reste est dans l'infobulle (C-9).
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
  conseil,
  place,
}: {
  g: GroupeDoublons;
  x: PhotoDuGroupe;
  c: Comparaison;
  avis?: AvisRafale;
  cote: number;
  agir: (faire: () => Modification | null) => void;
  valide: boolean;
  seule: boolean;
  /** Sa place dans la rafale (1, 2, 3…), écrite au début de sa bande. */
  place?: number;
  /** La photo conseillée (vraiment meilleure, ou choisie par l'IA), s'il y en a une. */
  conseil: Conseil | undefined;
}) {
  const { m, f, etat } = x;
  const [classe, libelle] = libelleEtat(etat, valide);
  const garde = aGarder(etat);
  const geste = garde ? t`Cliquer pour l’écarter` : seule ? t`Cliquer pour garder celle-ci seule (Ctrl+clic : en plus)` : t`Cliquer pour la garder`;
  // « 12 · À écarter » tient dans la bande, même à la plus petite taille (C-10.4).
  const largeur = Math.max(cote, place !== undefined ? 116 : 0);
  return (
    <div class="photo-doublon" style={{ width: `${largeur}px` }}>
      <button
        type="button"
        class={`tuile-doublon ${classe}`}
        aria-pressed={garde}
        aria-label={place !== undefined ? `${nombre(place)} · ${libelle} · ${f.nom}` : `${libelle} · ${f.nom}`}
        title={[...lignesPhoto(g, x, c, avis, conseil), '', geste].join('\n')}
        onClick={(e) => agir(() => choisirPhoto(session.value!.plan, g, m.id, seule && !(e.ctrlKey || e.metaKey)))}
        onKeyDown={entreeRepetee}
      >
        <span class="cadre-tuile" style={{ width: `${largeur}px`, height: `${cote}px` }}>
          <Miniature f={f} taille={cote} rotation={f.rotation} />
        </span>
        <BandeEtat classe={classe} libelle={libelle} place={place} />
      </button>
      <p class="remarque legende-doublon">
        <RemarqueDoublon g={g} x={x} c={c} avis={avis} conseil={conseil} />
      </p>
    </div>
  );
}

/**
 * Copies exactes : la photo est montrée une fois ; dessous, une ligne par exemplaire, avec son état, son
 * dossier, son nom et son poids (« copie réduite ») ; un clic sur la ligne garde ou écarte cet exemplaire.
 */
function LigneExemplaire({ g, x, c, conseil, agir, valide }: { g: GroupeDoublons; x: PhotoDuGroupe; c: Comparaison; conseil?: Conseil; agir: (faire: () => Modification | null) => void; valide: boolean }) {
  const s = session.value!;
  const { m, f, etat } = x;
  const [classe, libelle] = libelleEtat(etat, valide);
  const garde = aGarder(etat);
  const detail = [f.nom, f.date ? dateHeure(f.date) : '', m.reduite ? t`copie réduite` : '', conseil?.id === m.id ? t(TEXTES_CONSEIL[conseil.pourquoi]) : ''].filter(Boolean);
  const remarque = c.remarques.get(m.id);
  return (
    <button
      type="button"
      class={`tuile-doublon exemplaire ${classe}`}
      aria-pressed={garde}
      aria-label={`${libelle} · ${dossierSource(f) || nomRacine(s.projet.mode === 'vrac')} · ${f.nom}`}
      title={[...lignesPhoto(g, x, c, undefined, conseil), '', garde ? t`Cliquer pour l’écarter` : t`Cliquer pour garder cet exemplaire`].join('\n')}
      onClick={() => agir(() => choisirPhoto(s.plan, g, m.id, false))}
      onKeyDown={entreeRepetee}
    >
      <BandeEtat classe={classe} libelle={libelle} />
      <span class="texte-exemplaire">
        <span class="dossier-exemplaire">
          <Emplacement f={f} />
        </span>
        <span class="detail-exemplaire">
          {detail.join(' · ')}
          {remarque && <span class={`remarque-doublon ${remarque === 'plus_nette' ? 'qualite' : 'defaut'}`}>{` · ${t(LIBELLES_REMARQUES[remarque])}`}</span>}
          {m.refus && <em class="refus">{` · ${t`Gardée par le garde-fou : l’IA la décrit autrement.`}`}</em>}
        </span>
      </span>
      <span class="num poids-exemplaire">{texteTaille(f.taille)}</span>
    </button>
  );
}

/** « Tout écarter » (et ce qui viendra) : le menu « Autres choix » d'un groupe, pour garder la ligne courte. */
function AutresChoix({ children }: { children: ComponentChildren }) {
  const [ouvert, basculer, zone] = useDeroulant();
  return (
    <div class="menu-portee autres-choix" ref={zone}>
      <button type="button" aria-expanded={ouvert} aria-haspopup="true" onClick={() => basculer()}>
        {t`Autres choix`}
        <Icone nom={ouvert ? 'chevronHaut' : 'chevronBas'} taille={16} />
      </button>
      {ouvert && (
        <div class="menu-deroulant menu-actions" onClick={(e) => (e.target as HTMLElement).closest('button:not(:disabled)') && basculer(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

/** « Journée / Mois / Dossier suivant à accepter : … » : le même nom sur la ligne du dernier groupe et dans la tête. */
function libelleSuite(suite: Section): string {
  return suite.cle.startsWith('jour:')
    ? t`Journée suivante à accepter : ${suite.nom}`
    : suite.cle.startsWith('mois:')
      ? t`Mois suivant à accepter : ${suite.nom}`
      : estDossier(suite)
        ? t`Dossier suivant à accepter : ${suite.nom}`
        : t`Suite à accepter : ${suite.nom}`;
}

/** « Journée suivante à accepter : sam. 2 août › » : sur la ligne du dernier groupe (§ 1.7). */
function LienSuite({ suite, choisir }: { suite: Section; choisir: (cle: string) => void }) {
  const libelle = libelleSuite(suite);
  return (
    <button type="button" class="lien lien-suite" data-action="journee-suivante" onClick={() => choisir(suite.cle)}>
      {libelle}
      <Icone nom="chevronDroite" taille={16} />
    </button>
  );
}

function CarteGroupe({
  g,
  ouverte,
  avecJour,
  agir,
  agirGroupe,
  accepterIci,
  rouvrir,
  replier,
  comparer,
  ordonner = (p) => p,
  plusieurs,
  changerPlusieurs,
  prochaine = false,
  enCours = false,
  compacte = false,
  fondu = false,
  toucher,
  suite,
}: {
  g: GroupeDoublons;
  ouverte: boolean;
  /** Ce groupe porte le bouton plein de l'écran (C-4.1) : le dernier touché, sinon le suivant à accepter. */
  prochaine?: boolean;
  /** Le groupe en cours (filet vert). */
  enCours?: boolean;
  /** « Comparer en grand » en icône seule, dans toute la liste, si un en-tête manque de place (É7). */
  compacte?: boolean;
  /** Le plein vient d'arriver après « Accepter » : il ignore les clics 0,5 s et apparaît en fondu. */
  fondu?: boolean;
  /** « Garder plusieurs photos » cochée à la main pour ce groupe (le temps de la page). */
  plusieurs: boolean;
  changerPlusieurs: (oui: boolean) => void;
  /** Ordre des photos : groupé par dossier, celle du dossier choisi d'abord. */
  ordonner?: (photos: PhotoDuGroupe[]) => PhotoDuGroupe[];
  replier: () => void;
  /** La section est un mois : la journée est dite devant l'heure. */
  avecJour: boolean;
  agir: (faire: () => Modification | null) => void;
  /** Un geste sur tout le groupe, calculé seulement s'il passe la garde de 0,5 s (il modifie déjà le plan). */
  agirGroupe: (faire: () => Modification | null, message: string) => void;
  /** « Accepter » du groupe (garde de 0,5 s comprise). */
  accepterIci: () => void;
  rouvrir: () => void;
  comparer: () => void;
  /** Un clic, une touche ou le focus dans ce groupe : il devient le groupe en cours, sans défilement. */
  toucher: () => void;
  /** Dernier groupe de la liste : le lien vers la section suivante à accepter. */
  suite?: ComponentChildren;
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
  // Rafale, même scène : un clic choisit une seule photo, sauf « Garder plusieurs photos » (cochée d'office dès deux).
  const unePhoto = g.sorte === 'rafales' || g.sorte === 'ia';
  const multiple = plusieurs || nGarder >= 2;
  const seule = unePhoto && !multiple;
  // Avis de l'IA sur une rafale (D102) : sa photo est « Conseillée par l'IA », avec sa raison ; g.etoile (la clé du groupe) ne change pas.
  const avis = avisDe(s, g);
  const choixIA = !!avis?.meilleure && photos.every((x) => aGarder(x.etat) === (x.m.id === avis.meilleure));
  const copie = g.sorte === 'copies' || g.sorte === 'dossiers';
  const heureSeule = etoile?.date && etoile.date.length > 10 ? etoile.date.slice(11, 16) : '';
  const heure = copie ? '' : avecJour && etoile?.date ? [nomJour(etoile.date.slice(0, 10)), heureSeule].filter(Boolean).join(' · ') : heureSeule;
  const titre = titreGroupe(g, photos);
  const comparaison = comparaisonDe(s, g, photos);
  // Conseil seulement quand une photo est vraiment meilleure : la plus nette d'une rafale, le choix de l'IA, l'original d'une copie réduite.
  const conseil = conseilDe(g, comparaison, avis);
  // Des exemplaires (masculin) pour les copies, des photos sinon.
  const resume = copie ? `${pluriel(gardees, 'gardé', 'gardés')}, ${pluriel(ecartees, 'écarté', 'écartés')}` : `${pluriel(gardees, 'gardée', 'gardées')}, ${pluriel(ecartees, 'écartée', 'écartées')}`;
  const libelle = libelleAccepter(g, photos);
  const cote = coteDoublons(useContext(ContexteCadre)!.palier);

  if (!ouverte)
    return (
      <div class="carte-doublons repliee" data-cle={g.cle}>
        <span class="vu" aria-hidden="true">
          <Icone nom="coche" taille={16} />
        </span>
        <span class="heure">{heure}</span>
        <span class="resume">
          {titre} · {resume}
        </span>
        <button type="button" class="lien" onClick={rouvrir}>
          {t`Revoir`}
        </button>
        {suite && <span class="espace" />}
        {suite}
      </div>
    );

  // L'état du groupe, en mots, sur la ligne des boutons : l'en-tête garde une seule ligne (§ 1.7).
  const etat = touche ? (
    <span class="pastille-attente">{choixIA ? t`Choix de l’IA · pas encore accepté` : t`Votre choix · pas encore accepté`}</span>
  ) : !valide ? (
    <span class="pastille-proposition">{texteProposition(g, enAttente, comparaison, avis)}</span>
  ) : null;

  return (
    <article
      class={`carte-doublons${enAttente ? ' en-attente' : ' relue'}${enCours ? ' en-cours' : ''}`}
      data-cle={g.cle}
      data-photos={photos.length}
      aria-label={heure ? `${heure} · ${titre}` : titre}
      onClick={toucher}
    >
      <header>
        {heure && <span class="heure">{heure}</span>}
        <span class="titre" title={copie ? t`${pluriel(photos.length, 'exemplaire')} de la même photo` : [titre, g.sorte === 'rafales' ? dureeRafale(photos) : ''].filter(Boolean).join(' ')}>
          {heure ? `· ${titre}` : titre}
        </span>
        <span class="espace" />
        <button type="button" class={`bouton-comparer${compacte ? ' icone-seule' : ''}`} data-action="comparer" onClick={comparer} aria-label={t`Comparer en grand`} title={t`Comparer en grand (touche C)`}>
          <Icone nom="comparer" taille={20} />
          {!compacte && t`Comparer en grand`}
        </button>
        {!valide ? (
          <button type="button" class={`${prochaine ? 'principal' : 'contour'}${prochaine && fondu ? ' fondu' : ''}`} data-action="accepter" onClick={accepterIci} onKeyDown={entreeRepetee} aria-label={libelle.lecteur} title={t`Touche A`}>
            {libelle.contenu}
          </button>
        ) : (
          <>
            {g.sorte === 'dossiers' && !ecartees ? (
              <span class="pastille-relue">{t`Gardée dans chaque dossier`}</span>
            ) : (
              <span class="pastille-relue">
                <Icone nom="coche" taille={14} />
                {t`Accepté`}
              </span>
            )}
            <button type="button" class="lien" onClick={replier}>
              {t`Replier`}
            </button>
          </>
        )}
      </header>
      {g.sorte === 'ia' && g.scene && <p class="scene-doublons">{g.scene}</p>}
      {avis?.justification && (
        <p class="scene-doublons avis-ia">
          {t`IA : ${avis.justification}`}
          {avis.equivalentes && <span class="discret">{t` (photos presque équivalentes)`}</span>}
        </p>
      )}
      {copie ? (
        <div class="corps-copie">
          {etoile && (
            <div class="photo-doublon photo-copie" title={lignesPhoto(g, photos.find((x) => x.m.id === g.etoile) ?? photos[0], comparaison, avis, conseil).join('\n')}>
              <span class="cadre-tuile" style={{ width: `${cote}px`, height: `${cote}px` }}>
                <Miniature f={etoile} taille={cote} rotation={etoile.rotation} />
              </span>
            </div>
          )}
          <div class="lignes-exemplaires">
            {photos.map((x) => (
              <LigneExemplaire key={x.m.id} g={g} x={x} c={comparaison} conseil={conseil} agir={agir} valide={valide} />
            ))}
          </div>
        </div>
      ) : (
        <div class="photos-doublons">
          {photos.map((x, i) => (
            <TuileDoublon key={x.m.id} g={g} x={x} c={comparaison} avis={avis} cote={cote} agir={agir} valide={valide} seule={seule} conseil={conseil} place={unePhoto ? i + 1 : undefined} />
          ))}
        </div>
      )}
      {nGarder === 0 && <p class="alerte-doublons">{alerteRienGarde()}</p>}
      <footer>
        {unePhoto && photos.length > 1 && <CasePlusieurs g={g} photos={photos} plusieurs={plusieurs} changer={changerPlusieurs} />}
        {/* Désactivés, ils disent pourquoi dans leur libellé (C-4.7). */}
        <button type="button" disabled={gardees === photos.length} data-raison={gardees === photos.length ? 'libelle' : undefined} onClick={() => agirGroupe(() => garderTout(plan, [g]), t`Toutes les photos du groupe sont gardées.`)}>
          {gardees === photos.length ? t`Tout est gardé` : t`Tout garder`}
        </button>
        <AutresChoix>
          <button type="button" role="menuitem" disabled={ecartees === photos.length} data-raison={ecartees === photos.length ? 'libelle' : undefined} onClick={() => agirGroupe(() => ecarterTout(plan, [g]), texteEcartees(photos.length - ecartees))}>
            {ecartees === photos.length ? t`Tout est écarté` : t`Tout écarter`}
          </button>
        </AutresChoix>
        {etat}
        {!copie && etoile && <span class="discret lieu-groupe">{lieuDe(s, etoile)}</span>}
        {suite && <span class="espace" />}
        {suite}
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Les groupes d'un onglet
// ---------------------------------------------------------------------------

function ListeGroupes({ onglet, groupes, titre, avant }: { onglet: Exclude<Onglet, 'mis_de_cote'>; groupes: GroupeDoublons[]; titre: string; avant?: ComponentChildren }) {
  const s = session.value!;
  versionPlan.value;
  const plan = s.plan;
  const fichier = (id: string) => plan.fichiers.get(id);
  const cadre = useContext(ContexteCadre)!;
  // « Tous » allumé par défaut (C-4.8, choix de l'utilisateur du 27.10).
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [ordre, setOrdre] = useState<Ordre>('heure');
  // Cartes repliées après « Accepter », « Tout garder »… ; et cartes déjà relues rouvertes (« Revoir »).
  const [fermees, setFermees] = useState<ReadonlySet<string>>(new Set());
  const [rouvertes, setRouvertes] = useState<ReadonlySet<string>>(new Set());
  const [comparee, setComparee] = useState<string | null>(null);
  // « Côte à côte / Une à la fois » choisi à la main : gardé d'un groupe à l'autre (← →) pour les groupes du même
  // nombre de photos, jusqu'à la fermeture de la vue ; à la réouverture, la présentation calculée revient.
  const [presentations, setPresentations] = useState<Map<number, Presentation>>(new Map());
  useEffect(() => {
    if (!comparee) setPresentations((m) => (m.size ? new Map() : m));
  }, [comparee]);
  // Groupes où « Garder plusieurs photos » a été cochée à la main (D101).
  const [plusieurs, setPlusieurs] = useState<ReadonlySet<string>>(new Set());
  /** Rafale, même scène : un clic (ou une touche) choisit une seule photo, sauf « Garder plusieurs photos ». */
  const changerPlusieurs = (cle: string) => (oui: boolean) => setPlusieurs(new Set(oui ? [...plusieurs, cle] : [...plusieurs].filter((c) => c !== cle)));
  const uneSeule = (g: GroupeDoublons) => (g.sorte === 'rafales' || g.sorte === 'ia') && !plusieurs.has(g.cle) && photosDuGroupe(g, fichier).filter((x) => aGarder(x.etat)).length < 2;
  const zone = useRef<HTMLDivElement>(null);

  // Le groupe en cours (§ 1.7, « le dernier geste gagne ») : le dernier touché (clic, touche, focus venu du
  // clavier), sur place, sans défilement ; après la molette, s'il est sorti de la vue, le premier groupe dont on
  // voit la bande « À garder ». Il porte le plein ; A et C le visent.
  const [enCours, setEnCours] = useState<string | null>(null);
  const enCoursRef = useRef<string | null>(null);
  const toucher = (cle: string) => {
    if (cle === enCoursRef.current) return;
    enCoursRef.current = cle;
    setEnCours(cle);
  };
  // Le groupe dont le bouton « Comparer en grand » a ouvert la vue.
  const ouvreur = useRef<string | null>(null);
  // Défilement fait par l'application (arrivée, après « Accepter », retour de Comparer) : ce n'est pas un geste.
  const defilementAppli = useRef(0);
  // Après « Accepter » : le plein suivant ignore les clics, A et Entrée 0,5 s (double-clic, A deux fois).
  const derniereAcceptation = useRef(-1e9);
  const [fondu, setFondu] = useState(false);
  // À faire après le prochain rendu : montrer le plein (et lui rendre le focus s'il était dans la table).
  // `focus: 'garde'` : sur la photo gardée du groupe (à défaut la première), pas sur son plein (tour 3, usage B1).
  const apres = useRef<{ montrer?: string | 'plein'; focus?: 'plein' | 'comparer' | 'garde'; enHaut?: boolean } | null>({ montrer: 'plein' });
  // « Comparer en grand » en icône seule dans toute la liste, si un en-tête manque de place (É7).
  const [compacte, setCompacte] = useState(false);

  const [groupement, choisirGroupement] = useGroupement(
    onglet,
    groupes.map((g) => fichier(g.etoile)),
  );
  const copies = onglet === 'copies';
  // « Grouper et classer » : ouvert d'office par dossier ou par taille ; il reste ouvert quand on revient à
  // « par journée » (il ne se referme pas sous la souris), et se referme ou s'ouvre à la main.
  const groupementVoulu = groupement === 'dossier' || ordre !== 'heure';
  const [grouperOuvert, setGrouperOuvert] = useState(groupementVoulu);
  useEffect(() => {
    if (groupementVoulu) setGrouperOuvert(true);
  }, [groupementVoulu]);
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
  const [section, choisirSection] = useSection(onglet, liste);
  const choisir = (cle: string) => {
    choisirSection(cle);
    cadre.ouvrirListe(false);
  };
  const signature = groupes.map((g) => g.cle).join('|');
  // Instantané des groupes montrés, figé tant qu'on reste sur cette section et ce filtre : un clic sur une photo
  // ne fait rien disparaître (D71). Les groupes déjà relus à l'arrivée sont repliés ; un groupe validé (Accepter,
  // Tout garder, Tout écarter, Replier) se replie à sa place, avec tous les filtres (D100 levée le 27.10 :
  // « il reste visible, replié ») ; « Annuler » le rouvre.
  const montres = useMemo(
    () => new Set(elements.filter((e) => e.section === section?.cle && (filtre === 'tous' || partout(e.g) || (filtre === 'a_relire') === e.relire)).map((e) => e.g.cle)),
    [section?.cle, filtre, signature],
  );
  const relusAuDepart = useMemo(() => new Set(elements.filter((e) => e.section === section?.cle && !e.relire && !partout(e.g)).map((e) => e.g.cle)), [section?.cle, signature]);
  const parDate = (a: (typeof elements)[number], b: (typeof elements)[number]) => (a.date ?? '').localeCompare(b.date ?? '') || a.g.cle.localeCompare(b.g.cle);
  const dansOrdre = (a: (typeof elements)[number], b: (typeof elements)[number]) => Number(partout(a.g)) - Number(partout(b.g)) || (ordre === 'taille' ? b.g.membres.length - a.g.membres.length || parDate(a, b) : parDate(a, b));
  // Tous les groupes de la section dans l'ordre affiché, cachés compris (pour trouver le suivant d'un groupe qui vient de s'en aller).
  const ordonnes = elements.filter((e) => e.section === section?.cle).sort(dansOrdre);
  const visibles = ordonnes.filter((e) => montres.has(e.g.cle));
  const iPartout = visibles.findIndex((e) => partout(e.g));
  const enAttente = visibles.filter((e) => aRelire(e.g, fichier)).map((e) => e.g);
  // Copies : tout l'onglet a ses boutons (menu de l'onglet) ; à relire dans l'onglet entier, hors photos dans plusieurs dossiers.
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
  const detail = [nGroupes > 0 && (nRelus ? t`${pluriel(nGroupes, 'groupe')}, dont ${pluriel(nRelus, 'accepté', 'acceptés')}` : t`${pluriel(nGroupes, 'groupe')}, aucun accepté`), nPartout > 0 && pluriel(nPartout, 'photo dans plusieurs dossiers', 'photos dans plusieurs dossiers')]
    .filter(Boolean)
    .join(' · ');

  /**
   * Après une action sur tout un groupe (Accepter, Tout garder, Tout écarter, la section, l'onglet) : la carte se
   * replie à sa place (avec tous les filtres), le groupe suivant à accepter prend le plein et vient en haut de la
   * zone. Toutes passent par la garde de 0,5 s : le groupe suivant arrive au même y, son bouton est sous la souris
   * (double-clic sur « Tout garder », tour 3 du lot 4, critique T1). Le geste n'est calculé qu'après la garde : il
   * modifie déjà le plan. Le focus ne suit que s'il était dans la table, et il va sur la photo gardée du groupe
   * suivant, jamais sur son plein : Espace y garde le sens « choisir », → passe à la photo d'à côté, A vise le plein
   * (tour 3 du lot 4, usage B1).
   */
  const agirGroupe = (cles: string[], faire: () => Modification | null, message: string) => {
    if (performance.now() - derniereAcceptation.current < 500) return false;
    const dedans = !!zone.current?.contains(document.activeElement);
    const m = faire();
    if (!m) return false;
    derniereAcceptation.current = performance.now();
    appliquer(m);
    setFermees(new Set([...fermees, ...cles]));
    setRouvertes(new Set([...rouvertes].filter((c) => !cles.includes(c))));
    notifier('ok', message, { libelle: t`Annuler`, faire: annuler });
    // Le groupe qui prend le plein vient en haut de la zone, au même y qu'à l'arrivée : le plein ne descend pas
    // d'une ligne repliée à chaque acceptation, et sa bande « À garder » se voit (C-7.1 ter, tour 2 du lot 4).
    apres.current = { montrer: 'plein', focus: dedans ? 'garde' : undefined, enHaut: true };
    return true;
  };
  /** « Accepter » d'un groupe : ignoré 0,5 s après une acceptation (un double-clic, A deux fois). */
  const accepterGroupe = (g: GroupeDoublons) => {
    // Compté avant le geste : `accepter` modifie déjà le plan (tour 2 du lot 4, « 0 photo écartée »).
    const n = aEcarter(g, fichier).length;
    if (!agirGroupe([g.cle], () => accepter(plan, [g]), texteEcartees(n))) return false;
    setFondu(true);
    return true;
  };
  useEffect(() => {
    if (!fondu) return;
    const minuterie = setTimeout(() => setFondu(false), 500);
    return () => clearTimeout(minuterie);
  }, [fondu]);
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
    agirGroupe(
      acceptes.map((g) => g.cle),
      () => accepter(plan, acceptes),
      texteEcartees(n),
    );
  };

  // Une annulation qui rouvre un groupe de la page (Ctrl+Z, « Annuler » de l'en-tête ou du message) lui rend le
  // plein et le montre en haut de la zone, comme après « Accepter » : A vise alors ce groupe, pas le suivant qu'on
  // ne voit plus (tour 3 du lot 4, usage M1, novice M-T3-1). Avant l'effet « après le rendu » ci-dessous.
  const nAnnulations = annulations.value;
  const aAccepterIci = visibles.filter((e) => aRelire(e.g, fichier)).map((e) => e.g.cle);
  const vusAvant = useRef({ n: nAnnulations, cles: new Set(aAccepterIci) });
  useLayoutEffect(() => {
    const avant = vusAvant.current;
    vusAvant.current = { n: nAnnulations, cles: new Set(aAccepterIci) };
    if (avant.n === nAnnulations) return;
    const rouvert = aAccepterIci.find((c) => !avant.cles.has(c));
    if (!rouvert) return;
    const dedans = !!zone.current?.contains(document.activeElement);
    enCoursRef.current = rouvert;
    setEnCours(rouvert);
    apres.current = { montrer: rouvert, enHaut: true, focus: dedans ? 'garde' : undefined };
  });
  // À l'arrivée, puis à chaque section ou filtre : la table montre le groupe qui porte le plein.
  useLayoutEffect(() => {
    apres.current = { ...apres.current, montrer: 'plein' };
  }, [section?.cle, filtre, ordre]);
  // Après le rendu : montrer ce qu'il faut (défilement de l'application), puis rendre le focus.
  useLayoutEffect(() => {
    const z = zone.current;
    const a = apres.current;
    if (!z || !a || comparee) return;
    apres.current = null;
    const article = a.montrer === 'plein' ? z.querySelector(PLEIN)?.closest('article') : a.montrer ? z.querySelector(`.carte-doublons[data-cle="${CSS.escape(a.montrer)}"]`) : null;
    if (article) {
      const { haut, bas } = bornesVisibles(z);
      const tete = article.querySelector(':scope > header') ?? article;
      if (a.enHaut || !entier(tete, haut, bas) || article.getBoundingClientRect().top < haut - 1) {
        defilementAppli.current = performance.now();
        amenerEnHaut(z, article, a.enHaut);
      }
      // Après « Accepter », la photo gardée du groupe suivant se voit avec sa bande, même au fond d'une grande rafale
      // (l'en-tête du groupe reste collé en haut, avec son plein ; C-7.1 ter, tour 2 du lot 4).
      if (a.enHaut) {
        const garde = [...article.querySelectorAll('.bande-etat.choisie, .bande-etat.gardee')].find((b) => !b.closest('[data-action=accepter]'));
        const q = garde?.getBoundingClientRect();
        if (q && q.bottom > bas + 1) {
          const d = q.bottom - bas + 4;
          const zone = defileur(z);
          if (zone) zone.scrollTop += d;
          else window.scrollBy(0, d);
        }
      }
      const cible =
        a.focus === 'plein'
          ? article.querySelector<HTMLElement>('[data-action=accepter]')
          : a.focus === 'comparer'
            ? article.querySelector<HTMLElement>('[data-action=comparer]')
            : a.focus === 'garde'
              ? (article.querySelector<HTMLElement>('.tuile-doublon[aria-pressed="true"]') ?? article.querySelector<HTMLElement>('.tuile-doublon'))
              : null;
      (cible ?? (a.focus ? article.querySelector<HTMLElement>('button') : null))?.focus({ preventScroll: true });
    }
  });
  // Un en-tête qui manque de place : « Comparer en grand » en icône seule dans toute la liste (É7) ;
  // recalculé quand la largeur, l'Aide, la section ou la taille des photos changent.
  useEffect(() => setCompacte(false), [largeurFenetre.value, cadre.aide, section?.cle, onglet, filtre]);
  useLayoutEffect(() => {
    if (compacte || !zone.current) return;
    const manque = [...zone.current.querySelectorAll<HTMLElement>('article.carte-doublons > header')].some((h) => {
      const st = getComputedStyle(h);
      const place = h.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      const enfants = [...h.children].filter((c) => !c.classList.contains('espace') && c.getBoundingClientRect().width > 0) as HTMLElement[];
      const largeur = enfants.reduce((n, c) => n + (c.classList.contains('titre') ? c.scrollWidth : c.getBoundingClientRect().width), 0) + parseFloat(st.columnGap || '0') * Math.max(0, enfants.length - 1);
      // Une marge pour le texte le plus long (« garder la 11, écarter 11 autres »).
      return largeur > place - 24;
    });
    if (manque) setCompacte(true);
  });
  // La molette (ou la barre de défilement) : si le groupe en cours est sorti de la vue, le plein passe au
  // premier groupe dont on voit la bande « À garder » entière, à défaut à celui dont l'en-tête est collé en haut.
  // Le focus ne bouge pas (il ne quitte jamais un champ, la liste de gauche, un menu ni l'Aide).
  useEffect(() => {
    let attente = 0;
    const suivre = () => {
      attente = 0;
      const z = zone.current;
      if (!z || !z.isConnected || performance.now() - defilementAppli.current < 400 || document.querySelector('.comparateur')) return;
      const { haut, bas } = bornesVisibles(z);
      if (entier(z.querySelector(PLEIN), haut, bas)) return;
      let hb = haut;
      for (const h of z.querySelectorAll('article.carte-doublons > header')) {
        const q = h.getBoundingClientRect();
        if (q.height && q.top <= haut + 1 && q.bottom > hb && q.bottom < bas) hb = q.bottom;
      }
      const articles = [...z.querySelectorAll<HTMLElement>('article.carte-doublons')].filter((a) => a.querySelector(':scope > header [data-action=accepter]'));
      const enteteVue = (a: HTMLElement) => entier(a.querySelector(':scope > header [data-action=accepter]'), haut, bas);
      const gardeeVue = (a: HTMLElement) => [...a.querySelectorAll('.bande-etat.choisie, .bande-etat.gardee')].some((b) => entier(b, hb, bas));
      const choix = articles.find((a) => enteteVue(a) && gardeeVue(a)) ?? articles.find(enteteVue);
      const cle = choix?.dataset.cle;
      if (cle && cle !== enCoursRef.current) {
        enCoursRef.current = cle;
        setEnCours(cle);
      }
    };
    const surDefilement = () => {
      if (!attente) attente = requestAnimationFrame(suivre);
    };
    window.addEventListener('scroll', surDefilement, true);
    window.addEventListener('resize', surDefilement);
    return () => {
      window.removeEventListener('scroll', surDefilement, true);
      window.removeEventListener('resize', surDefilement);
      cancelAnimationFrame(attente);
    };
  }, []);

  // Clavier : J / K (ou ↓ ↑) d'un groupe à l'autre, ← → d'une photo à l'autre, Espace pour garder ou écarter
  // (la photo est un bouton), N / P pour la section suivante ou précédente. A et C visent toujours le groupe qui
  // porte le plein, où que soit le focus, sauf dans un champ de texte ou un menu ouvert ; A gardée enfoncée
  // n'accepte qu'une fois, et pas dans les 0,5 s qui suivent une acceptation.
  const nav = useRef({ liste, section, choisir });
  nav.current = { liste, section, choisir };
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.defaultPrevented || estChampDeSaisie(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"], .comparateur')) return;
      const conteneur = zone.current;
      if (!conteneur) return;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'c') {
        // Ni dans un menu ouvert, ni sous la liste de gauche ouverte en menu au palier (elle cache le groupe du plein).
        if (document.querySelector('.menu-deroulant, .page-cadre[data-palier][data-liste="ouverte"]')) return;
        e.preventDefault();
        if (e.repeat) return;
        const plein = conteneur.querySelector<HTMLElement>(PLEIN);
        plein?.closest('article')?.querySelector<HTMLElement>(k === 'a' ? '[data-action="accepter"]' : '[data-action="comparer"]')?.click();
        return;
      }
      const actif = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      const dedans = !!actif && conteneur.contains(actif);
      if (actif && !dedans) return;
      const cartes = [...conteneur.querySelectorAll<HTMLElement>('.carte-doublons')];
      const carte = actif?.closest<HTMLElement>('.carte-doublons') ?? null;
      const i = carte ? cartes.indexOf(carte) : -1;
      const aller = (j: number) => {
        const c = cartes[Math.max(0, Math.min(cartes.length - 1, j))];
        (c?.querySelector<HTMLElement>('.tuile-doublon') ?? c?.querySelector<HTMLElement>('button'))?.focus();
      };
      const voisine = (d: number) => {
        const { liste: l, section: x, choisir: c } = nav.current;
        const v = x && l[l.indexOf(x) + d];
        if (v) c(v.cle);
      };
      if (k === 'j' || (dedans && e.key === 'ArrowDown')) aller(i + 1);
      else if (k === 'k' || (dedans && e.key === 'ArrowUp')) aller(i < 0 ? 0 : i - 1);
      else if (carte && actif?.classList.contains('tuile-doublon') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const tuiles = [...carte.querySelectorAll<HTMLElement>('.tuile-doublon')];
        const j = tuiles.indexOf(actif) + (e.key === 'ArrowRight' ? 1 : -1);
        tuiles[(j + tuiles.length) % tuiles.length]?.focus();
      } else if (k === 'n') voisine(1);
      else if (k === 'p') voisine(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);

  if (!groupes.length) return null;
  // « Comparer en grand » va d'un groupe à l'autre (← →) parmi ceux de la liste ; avec « À accepter », un groupe
  // accepté (replié à sa place) n'y est plus : « Groupe k sur N » compte les groupes encore à accepter de l'instantané.
  const navigables = filtre === 'a_relire' ? visibles.filter((e) => !(fermees.has(e.g.cle) && !aRelire(e.g, fichier))) : visibles;
  const iComparee = navigables.findIndex((e) => e.g.cle === comparee);
  // Prochaine section qui reste à relire, après celle-ci (sinon la première).
  const iSection = section ? liste.indexOf(section) : -1;
  const suite = [...liste.slice(iSection + 1), ...liste.slice(0, Math.max(0, iSection))].find((x) => x.aRelire > 0);
  // Le groupe comparé reste ouvert même s'il quitte la liste (relu par une touche, avec « À relire ») (D100).
  const gComparee = navigables[iComparee]?.g ?? groupes.find((g) => g.cle === comparee);
  // « Accepter » de la vue en grand : le même libellé que sur la carte du groupe.
  const photosComparee = gComparee ? ordonner(photosDuGroupe(gComparee, fichier)) : [];
  const nGarderComparee = photosComparee.filter((x) => aGarder(x.etat)).length;
  const libelleComparee = gComparee ? libelleAccepter(gComparee, photosComparee) : null;
  // Un seul bouton plein (C-4.1) : « Accepter » du groupe en cours s'il reste à accepter, sinon du suivant à
  // accepter dans la liste, sinon du premier. Le groupe en cours peut avoir quitté la liste (accepté, avec
  // « À accepter ») : on part de sa place, pas du début.
  const cles = new Set(visibles.map((e) => e.g.cle));
  const prochaine = prochainAAccepter(ordonnes, (e) => e.g.cle, enCours, (e) => cles.has(e.g.cle), (e) => aRelire(e.g, fichier))?.g.cle;
  // Fermer Comparer : la table montre le dernier groupe regardé, et il prend le plein (accepté dans la vue :
  // le suivant à accepter) ; le focus va sur ce groupe (§ 1.7).
  const fermerComparer = (ouvreur: string | null) => {
    const cle = comparee;
    setComparee(null);
    if (!cle) return;
    const g = groupes.find((x) => x.cle === cle);
    const reste = g && aRelire(g, fichier) && cles.has(cle);
    toucher(cle);
    apres.current = reste ? { montrer: cle, focus: cle === ouvreur ? 'comparer' : 'plein' } : { montrer: 'plein', focus: 'plein' };
  };

  const photosOnglet = enAttenteOnglet.reduce((n, g) => n + aEcarter(g, fichier).length, 0);
  // L'IA de la section : seulement si elle ne couvre pas déjà tout l'onglet (le menu de l'onglet suffit).
  const ciblesOnglet = onglet === 'rafales' ? ciblesIA(s, groupes) : [];
  const ciblesSectionBrutes = onglet === 'rafales' ? ciblesIA(s, enAttente) : [];
  const ciblesSection = ciblesSectionBrutes.length < ciblesOnglet.length ? ciblesSectionBrutes : [];
  const ceci = section?.cle.startsWith('jour:') ? t`de cette journée` : section?.cle.startsWith('mois:') ? t`de ce mois` : section && estDossier(section) ? t`de ce dossier` : t`ci-dessous`;
  const finie = enAttente.length === 0;

  // Barre d'outils : les onglets, puis ce qui touche tout l'onglet, dans un menu nommé (portée dite, D98).
  const porteeOnglet =
    copies && enAttenteOnglet.length > 0 ? (
      <span class="rangee-onglet" title={total ? t`Acceptés : ${nombre(relus)} sur ${nombre(total)}` : undefined}>
        <MenuPortee libelle={t`Toutes les copies`}>
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              agirGroupe(
                acceptablesSansVider(enAttenteOnglet, fichier).map((g) => g.cle),
                () => accepter(plan, acceptablesSansVider(enAttenteOnglet, fichier)),
                texteEcartees(photosOnglet),
              )
            }
          >
            {enAttenteOnglet.length === 1 ? t`Accepter la proposition` : t`Accepter les ${nombre(enAttenteOnglet.length)} propositions`}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              agirGroupe(
                enAttenteOnglet.map((g) => g.cle),
                () => garderTout(plan, enAttenteOnglet),
                t`Tous les exemplaires sont gardés.`,
              )
            }
          >
            {t`Garder tous les exemplaires`}
          </button>
        </MenuPortee>
      </span>
    ) : onglet === 'rafales' && (ciblesOnglet.length > 0 || iaRafales.value) ? (
      <span class="rangee-onglet" title={total ? t`Acceptés : ${nombre(relus)} sur ${nombre(total)}` : undefined}>
        <MenuPortee libelle={t`Toutes les rafales`} ia>
          <BoutonIARafales cibles={ciblesOnglet} libelle={t`Choisir avec l’IA dans ${pluriel(ciblesOnglet.length, 'rafale')}`} />
        </MenuPortee>
      </span>
    ) : null;
  // Tête de la table : ce qui touche la section (« Cette journée ▾ »), et le plein « Journée suivante » quand elle est finie.
  const menuSection =
    section && (boutonSection || ciblesSection.length > 0) ? (
      <MenuPortee libelle={porteeSection(section)} ia={ciblesSection.length > 0}>
        {ciblesSection.length > 0 && <BoutonIARafales cibles={ciblesSection} libelle={t`Choisir avec l’IA ${ceci}`} />}
        {boutonSection && (
          <button type="button" role="menuitem" onClick={accepterSection} disabled={!validables.length} data-raison={validables.length ? undefined : 'libelle'}>
            {validables.length ? t`Accepter les ${nombre(validables.length)} groupes ${ceci}` : t`Accepter : aucune photo choisie dans ces groupes`}
            {validables.length > 0 && sansChoix > 0 && <span class="discret">{t`dont ${nombre(sansChoix)} où vous n’avez rien choisi`}</span>}
          </button>
        )}
      </MenuPortee>
    ) : null;

  return (
    <>
      <OutilsCadre>
        {cadre.onglets}
        {porteeOnglet}
      </OutilsCadre>
      <CorpsCadre
        zone={zone}
        liste={
          <ListeSections
            liste={liste}
            choisie={section?.cle}
            choisir={choisir}
            outils={
              <>
                <div class="ligne-outil">
                  <span class="discret">{t`Afficher`}</span>
                  <div class="choix-segmente" role="radiogroup" aria-label={t`Groupes affichés`}>
                    {(
                      [
                        ['a_relire', t`À accepter`],
                        ['relus', t`Acceptés`],
                        ['tous', t`Tous`],
                      ] as const
                    ).map(([v, libelle]) => (
                      <button key={v} type="button" role="radio" aria-checked={filtre === v} onClick={() => setFiltre(v)}>
                        {libelle}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Repliés (maquette v2) : la liste montre plus de journées ; ouverts d'office par dossier ou par taille. */}
                <details class="grouper-classer" open={grouperOuvert} onToggle={(e) => setGrouperOuvert(e.currentTarget.open)}>
                  <summary class="discret">{t`Grouper et classer`}</summary>
                  {/* Le contenu dans sa propre grille : un <details> ne range pas ses enfants (tour 2 du lot 4). */}
                  <div class="contenu-grouper">
                    <ChoixGroupement valeur={groupement} choisir={choisirGroupement} />
                    <label class="discret">
                      {t`Classer`}{' '}
                      <select value={ordre} onChange={(e) => setOrdre(e.currentTarget.value as Ordre)}>
                        <option value="heure">{t`par heure`}</option>
                        <option value="taille">{t`les plus grands groupes d’abord`}</option>
                      </select>
                    </label>
                  </div>
                </details>
              </>
            }
          />
        }
        nomListe={section ? <NomSection section={section} /> : titre}
        tete={
          <>
            {section && <TeteSection section={section} detail={detail} />}
            <span class="espace" />
            {menuSection}
            {finie && suite && (
              <button type="button" class="principal" data-action="journee-suivante" onClick={() => choisir(suite.cle)}>
                {libelleSuite(suite)}
                <Icone nom="chevronDroite" taille={20} />
              </button>
            )}
            {finie && !suite && <BoutonOngletSuivant />}
          </>
        }
      >
        {avant}
        {visibles.length === 0 && (
          <div class="encart">
            <p>{filtre === 'a_relire' ? t`Tout est accepté ici.` : t`Aucun groupe à montrer ici.`}</p>
            {filtre === 'a_relire' && liste.some((x) => x.aRelire > 0) && !suite && (
              <button type="button" onClick={() => choisir(liste.find((x) => x.aRelire > 0)!.cle)}>
                {t`Aller à la suite à accepter`}
              </button>
            )}
          </div>
        )}
        <div
          class="groupes-doublons"
          onFocusIn={(e) => {
            const cle = (e.target as HTMLElement).closest<HTMLElement>('.carte-doublons')?.dataset.cle;
            if (cle) toucher(cle);
          }}
        >
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
              changerPlusieurs={changerPlusieurs(g.cle)}
              avecJour={!!section && !section.cle.startsWith('jour:')}
              agir={(faire) => {
                // Un clic sur une photo juste après « Accepter » (un double-clic) ne choisit rien dans le groupe suivant ;
                // vérifié avant de calculer le choix, qui modifie déjà le plan (tour 2 du lot 4).
                if (performance.now() - derniereAcceptation.current < 500) return;
                appliquer(faire());
              }}
              agirGroupe={(faire, message) => agirGroupe([g.cle], faire, message)}
              accepterIci={() => accepterGroupe(g)}
              rouvrir={() => {
                // Le second clic d'un double-clic sur « Accepter » ne rouvre pas le groupe (proposition, avocat N1).
                if (performance.now() - derniereAcceptation.current < 500) return;
                setRouvertes(new Set([...rouvertes, g.cle]));
              }}
              comparer={() => {
                ouvreur.current = g.cle;
                toucher(g.cle);
                setComparee(g.cle);
              }}
              toucher={() => toucher(g.cle)}
              prochaine={g.cle === prochaine}
              enCours={g.cle === prochaine}
              compacte={compacte}
              fondu={fondu}
              suite={i === visibles.length - 1 && suite && !finie ? <LienSuite suite={suite} choisir={choisir} /> : undefined}
            />,
          ])}
        </div>
      </CorpsCadre>

      {gComparee && (
        <ComparerGroupe
          g={gComparee}
          ordonner={ordonner}
          fermer={() => fermerComparer(ouvreur.current)}
          plusieurs={plusieurs.has(gComparee.cle)}
          changerPlusieurs={changerPlusieurs(gComparee.cle)}
          uneSeule={uneSeule(gComparee)}
          gardee={{
            valeur: presentations.get(photosComparee.length) ?? null,
            changer: (p) => setPresentations((m) => new Map(m).set(photosComparee.length, p)),
          }}
          navigation={{
            texte: t`Groupe ${iComparee + 1} sur ${navigables.length}`,
            precedent: iComparee > 0 ? () => setComparee(navigables[iComparee - 1].g.cle) : undefined,
            suivant: iComparee < navigables.length - 1 ? () => setComparee(navigables[iComparee + 1].g.cle) : undefined,
            accepter: aRelire(gComparee, fichier)
              ? () => {
                  if (accepterGroupe(gComparee)) setComparee(navigables[iComparee + 1]?.g.cle ?? null);
                }
              : undefined,
            // Le même libellé, vignette comprise, et la même alerte que sur la carte du groupe (É9).
            libelleAccepter: libelleComparee?.contenu,
            lecteurAccepter: libelleComparee?.lecteur,
            alerte: nGarderComparee === 0 ? alerteRienGarde() : undefined,
          }}
        />
      )}
    </>
  );
}

/** « Garder plusieurs photos » d'une rafale ou d'une même scène (D101) : cochée d'office dès deux photos choisies. */
function CasePlusieurs({ g, photos, plusieurs, changer }: { g: GroupeDoublons; photos: PhotoDuGroupe[]; plusieurs: boolean; changer: (oui: boolean) => void }) {
  const nGarder = photos.filter((x) => aGarder(x.etat)).length;
  return (
    <label class="plusieurs-photos">
      <input
        type="checkbox"
        checked={plusieurs || nGarder >= 2}
        onChange={(e) => {
          const oui = e.currentTarget.checked;
          changer(oui);
          // Décocher : seule la première photo choisie reste à garder (la photo proposée si elle l'est).
          const premiere = photos.find((x) => x.m.id === g.etoile && aGarder(x.etat)) ?? photos.find((x) => aGarder(x.etat));
          if (!oui && nGarder >= 2 && premiere) appliquer(choisirPhoto(session.value!.plan, g, premiere.m.id, true));
        }}
      />{' '}
      {t`Garder plusieurs photos`}
    </label>
  );
}

/**
 * « Comparer en grand » d'un groupe (C-7.5) : chaque photo avec son état (« À garder » / « À écarter »),
 * une remarque, son dossier ; la proposition, l'avis de l'IA et son aide sur la ligne d'information ;
 * « Accepter : garder N, écarter M » en bas, comme sur la carte.
 */
function ComparerGroupe({
  g,
  ordonner,
  fermer,
  plusieurs,
  changerPlusieurs,
  uneSeule,
  navigation,
  gardee,
}: {
  g: GroupeDoublons;
  ordonner: (photos: PhotoDuGroupe[]) => PhotoDuGroupe[];
  fermer: () => void;
  plusieurs: boolean;
  changerPlusieurs: (oui: boolean) => void;
  uneSeule: boolean;
  navigation: NavigationGroupes;
  gardee: PresentationGardee;
}) {
  const s = session.value!;
  const plan = s.plan;
  const fichier = (id: string) => plan.fichiers.get(id);
  const photos = ordonner(photosDuGroupe(g, fichier));
  const de = (f: FichierPlan) => photos.find((p) => p.f.id === f.id)!;
  const avis = avisDe(s, g);
  const comparaison = comparaisonDe(s, g, photos);
  const conseil = conseilDe(g, comparaison, avis);
  const valide = !aRelire(g, fichier);
  const touche = choixEnAttente(g, fichier);
  const etoile = fichier(g.etoile);
  const unePhoto = g.sorte === 'rafales' || g.sorte === 'ia';
  const enAttente = photos.filter((x) => x.etat === 'a_ecarter').length;
  // Le même état que sur la carte (C-10.2) : « Choix de l'IA » ou « Votre choix », écrit une fois, à droite.
  const choixIA = !!avis?.meilleure && photos.every((x) => aGarder(x.etat) === (x.m.id === avis.meilleure));
  const proposition = valide || touche ? null : texteProposition(g, enAttente, comparaison, avis, true);
  const etatGroupe = valide ? t`Accepté` : touche ? (choixIA ? t`Choix de l’IA · pas encore accepté` : t`Votre choix · pas encore accepté`) : t`Pas encore accepté`;
  const heure = (f: FichierPlan) => (f.date && f.date.length > 10 ? f.date.slice(11, 19) : '');
  return (
    <Comparateur
      key={g.cle}
      // Des copies : le nom de leur fichier est dans la légende de chaque photo ; le titre dit ce qu'on compare.
      titre={g.sorte === 'copies' || g.sorte === 'dossiers' ? t`Copies exactes · ${pluriel(photos.length, 'exemplaire')}` : titreGroupe(g, photos)}
      // La date courte (« Sam. 1 août ») : le titre tient sans être coupé (C-10.4).
      sousTitre={etoile?.date ? nomJour(etoile.date.slice(0, 10)) : undefined}
      photos={photos.map((x) => x.f)}
      fermer={fermer}
      gardee={gardee}
      // Ouverture sur la photo conseillée : l'IA, ou la plus nette (même quand une autre est proposée) ;
      // sinon la première « À garder », sinon la 1.
      conseillee={conseil?.id ?? comparaison.plusNette ?? photos.find((x) => aGarder(x.etat))?.f.id}
      suivre={avis?.meilleure}
      etat={(f) => {
        const [classe, libelle] = libelleEtat(de(f).etat, valide);
        return { classe, libelle, icone: aGarder(de(f).etat) ? 'coche' : 'croix' };
      }}
      choix={(f, vertical) => {
        const x = de(f);
        const garde = aGarder(x.etat);
        // L'état allumé est le choix (C-4.9) : « À garder » vert doux, « À écarter » neutre ; ils ne se ressemblent pas (C-9.2).
        return (
          <>
            <button type="button" class={`garder${garde ? ' on' : ''}`} aria-pressed={garde} onClick={() => !garde && appliquer(choisirPhoto(plan, g, f.id, uneSeule))} title={uneSeule ? t`Garder celle-ci seule : les autres passent à écarter (touche ${photos.indexOf(x) + 1})` : t`Touche ${photos.indexOf(x) + 1}`}>
              <Icone nom="coche" taille={vertical ? 20 : 16} />
              {x.etat === 'gardee' && valide ? t`Gardée` : t`À garder`}
            </button>
            <button type="button" class={`ecarter${garde ? '' : ' on'}`} aria-pressed={!garde} onClick={() => garde && appliquer(choisirPhoto(plan, g, f.id, false))} title={t`Touche ${photos.indexOf(x) + 1}`}>
              <Icone nom="croix" taille={vertical ? 20 : 16} />
              {x.etat === 'ecartee' ? t`Écartée` : t`À écarter`}
            </button>
          </>
        );
      }}
      resume={(f) => {
        const x = de(f);
        const h = heure(f);
        return (
          <>
            <span class="resume-remarque">
              <RemarqueDoublon g={g} x={x} c={comparaison} avis={avis} conseil={conseil} />
            </span>
            {h && <span class="num">{h}</span>}
          </>
        );
      }}
      // Le dossier d'une photo de rafale ; celui d'une copie est déjà en tête de sa remarque, reste « rangée dans … ».
      lieu={(f) => {
        if (g.sorte !== 'copies' && g.sorte !== 'dossiers') return <Emplacement f={f} />;
        const rangee = rangeeDans(s, f);
        return rangee === null ? null : <span class="chemin-doublon">{t`rangée dans « ${rangee} »`}</span>;
      }}
      infobulle={(f) => lignesPhoto(g, de(f), comparaison, avis, conseil).join('\n')}
      details={(f) => lignesPhoto(g, de(f), comparaison, avis, conseil).map((l, i) => (i === 2 ? <span class="chemin-doublon">{l}</span> : <span>{l}</span>))}
      ligne={
        <>
          {avis?.justification ? (
            <span class="avis-ia-ligne">
              <Icone nom="etincelle" taille={16} titre={t`Selon l’IA`} />
              {avis.justification}
            </span>
          ) : (
            g.sorte === 'ia' && g.scene && <span>{g.scene}</span>
          )}
          {proposition && <span class="discret">{proposition}</span>}
          <BoutonIARafales cibles={ciblesIA(s, [g])} libelle={t`Choisir avec l’IA`} />
        </>
      }
      plusieurs={unePhoto && photos.length > 1 && <CasePlusieurs g={g} photos={photos} plusieurs={plusieurs} changer={changerPlusieurs} />}
      rienSupprime={etatGroupe}
      basculer={(f) => appliquer(choisirPhoto(plan, g, f.id, uneSeule))}
      navigation={navigation}
    />
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
  const cadre = useContext(ContexteCadre)!;
  const [section, choisirSection] = useSection('mis_de_cote', liste);
  const choisir = (cle: string) => {
    choisirSection(cle);
    cadre.ouvrirListe(false);
  };
  if (!elements.length)
    return (
      <>
        <OutilsCadre>{cadre.onglets}</OutilsCadre>
        <CorpsCadre>
          <p class="encart">{t`Aucune photo mise de côté à cette étape.`}</p>
          <BoutonOngletSuivant />
        </CorpsCadre>
      </>
    );
  const dans = elements.filter((e) => e.section === section?.cle).sort((a, b) => (a.f.date ?? '').localeCompare(b.f.date ?? '') || a.id.localeCompare(b.id));
  const aRemettre = dans.filter((e) => e.f.statut === 'mis_de_cote').map((e) => e.id);
  const basculerPhoto = (e: (typeof dans)[number]) =>
    appliquer(e.f.statut === 'mis_de_cote' ? garderAussi(plan, [e.id]) : ecarterDoublons(plan, [{ id: e.id, raison: e.raison, doublon: e.doublon }]));
  const heureDe = (id: string) => plan.fichiers.get(id)?.date?.slice(11, 16) ?? '';
  const cote = coteDoublons(cadre.palier);

  return (
    <>
      <OutilsCadre>{cadre.onglets}</OutilsCadre>
      <CorpsCadre
        liste={<ListeSections liste={liste} choisie={section?.cle} choisir={choisir} avancement={false} outils={<ChoixGroupement valeur={groupement} choisir={choisirGroupement} />} />}
        nomListe={section ? <NomSection section={section} avancement={false} /> : null}
        tete={
          <>
            {section && <TeteSection section={section} detail={pluriel(section.total, 'photo')} />}
            <span class="espace" />
            {aRemettre.length > 0 && (
              <button type="button" class="contour" onClick={() => appliquer(garderAussi(plan, aRemettre))}>
                {t`Tout remettre (${nombre(aRemettre.length)})`}
              </button>
            )}
            <BoutonOngletSuivant />
          </>
        }
      >
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
                  title={[e.f.nom, dateHeure(e.f.date), t`Dossier : ${dossierSource(e.f) || nomRacine(s.projet.mode === 'vrac')}`, '', etat === 'gardee' ? t`Cliquer pour l’écarter de nouveau` : t`Cliquer pour la remettre à sa place`].join('\n')}
                  onClick={() => basculerPhoto(e)}
                >
                  <span class="cadre-tuile" style={{ width: `${cote}px`, height: `${cote}px` }}>
                    <Miniature f={e.f} taille={cote} rotation={e.f.rotation} />
                  </span>
                  <BandeEtat classe={etat} libelle={etat === 'gardee' ? t`Remise` : t`Écartée`} autre={etat === 'ecartee' ? 'mis' : ''} />
                </button>
                <p class="remarque legende-doublon">
                  {section && !section.cle.startsWith('jour:') && e.f.date ? `${nomJour(e.f.date.slice(0, 10))} · ` : ''}
                  {e.f.date && e.f.date.length > 10 ? `${e.f.date.slice(11, 16)} · ` : ''}
                  {e.raison === 'doublons_exacts' ? t`copie exacte` : e.doublon?.garde ? t`doublon de la photo de ${heureDe(e.doublon.garde)}` : t`doublon`}
                </p>
              </div>
            );
          })}
        </div>
      </CorpsCadre>
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
      journal('doublons', t`Doublons (${avecIA ? t`IA, ${modele}` : t`rafales`}, ${strict ? t`strict` : t`prudent`}) : ${pluriel(n, 'groupe à accepter', 'groupes à accepter')} en ${Math.round((performance.now() - debut) / 1000)} s`);
      if (res.budgetAtteint) notifier('erreur', new BudgetAtteint().message);
      else if (res.arrete) notifier('info', texteArret(un === 'journée', res.faits, lots.length));
      else if (res.erreurs.length)
        notifier('erreur', t`${un === 'journée' ? pluriel(res.erreurs.length, 'journée non analysée', 'journées non analysées') : pluriel(res.erreurs.length, 'dossier non analysé', 'dossiers non analysés')} : ${res.erreurs[0]}`);
      else if (avecIA) notifier('ok', n === 0 ? t`Aucun groupe à accepter.` : t`${pluriel(n, 'groupe à accepter', 'groupes à accepter')} : voyez les onglets « Rafales » et « Même scène (IA) ».`);
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
  const cout = !estimation.dossiers ? t`gratuit (déjà fait)` : chf < 0.01 ? t`moins de ${nombre(0.01, 2)} CHF` : t`environ ${nombre(chf, 2)} CHF`;
  // Raison écrite à côté du bouton désactivé (C-4.7).
  const raisonIA = progres
    ? t`Analyse en cours.`
    : analysesManquantes > 0
      ? t`Attendez la fin de l’analyse des photos (encore ${nombre(analysesManquantes)}).`
      : !modeleInfo
        ? t`Modèle IA inconnu : choisissez-en un dans « Réglages avancés ».`
        : '';

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
        <button type="button" class="bouton-ia" disabled={!!raisonIA} aria-describedby={raisonIA ? 'raison-analyse-ia' : undefined} onClick={() => void lancer(true)}>
          <Icone nom="etincelle" taille={20} />
          <span>
            {t`Analyser avec l’IA`}
            <span class="cout-aide"> — {cout}</span>
          </span>
        </button>
        <RaisonDesactivee id="raison-analyse-ia" raison={raisonIA} />
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
          {t`Les consignes viennent du script 06, réglé avec Claude Sonnet 4.6 ; les réponses sont mises en cache par modèle. Réglages du script : rafales à moins de 10 min et à une distance de 12 au plus ; scènes locales à une distance de 20 au plus ; vérification par 6 photos au plus.`}
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
    if (o === 'mis_de_cote') return <span class="compte gris">{pluriel(nbEcartees, 'photo')}</span>;
    if (o === 'copies' && copies === null) return <span class="compte gris">…</span>;
    if (o === 'ia' && !iaLancee) return <span class="compte gris">{t`pas lancée`}</span>;
    const { relus, total } = avancement(o);
    // Copies : celles dans plusieurs dossiers gardés n'ont rien à relire ; elles comptent quand il ne reste qu'elles.
    if (!total) return <span class="compte gris">{nombre(o === 'copies' ? groupes.dossiers.length : 0)}</span>;
    return relus === total ? <span class="compte fini">
        <Icone nom="coche" taille={14} />
        {nombre(total)}
      </span> : <span class="compte">{t`${nombre(total - relus)} à accepter`}</span>;
  };
  const ONGLETS: [Onglet, string][] = [
    ['copies', t`Copies exactes`],
    ['rafales', t`Rafales`],
    ['ia', t`Même scène (IA)`],
    ['mis_de_cote', t`Mis de côté`],
  ];

  const enAttente = (['copies', 'rafales', 'ia'] as const).reduce((n, o) => n + avancement(o).total - avancement(o).relus, 0);
  // Le prochain onglet qui reste à accepter, après celui-ci (le premier depuis « Mis de côté »).
  const ordreOnglets = ['copies', 'rafales', 'ia'] as const;
  const iOnglet = ordreOnglets.indexOf(onglet as (typeof ordreOnglets)[number]);
  const prochainOnglet = [...ordreOnglets.slice(iOnglet + 1), ...ordreOnglets.slice(0, Math.max(0, iOnglet))].find((o) => o !== onglet && (o !== 'ia' || iaLancee) && avancement(o).total > avancement(o).relus);
  const ongletSuivant = prochainOnglet
    ? { nom: ONGLETS.find(([o]) => o === prochainOnglet)![1], reste: avancement(prochainOnglet).total - avancement(prochainOnglet).relus, aller: () => choisirOnglet(s.projet.nom, prochainOnglet) }
    : null;

  // Cadre commun (lot 4, D111) : bandes fixes, seule la zone de contenu défile ; Aide « à lire » sous 1440 px.
  const { aide, etroit, palier } = useCadre('doublons');
  const [listeOuverte, setListeOuverte] = useState(false);
  useEffect(() => setListeOuverte(false), [onglet, palier]);
  useMenuListe(listeOuverte, () => setListeOuverte(false));
  const onglets = (
    <nav class="onglets-doublons" aria-label={t`Sortes de doublons`}>
      {ONGLETS.map(([o, nom]) => (
        <button
          key={o}
          type="button"
          class={`onglet-doublons${o === onglet ? ' actif' : ''}`}
          aria-current={o === onglet ? 'page' : undefined}
          onClick={() => choisirOnglet(s.projet.nom, o)}
        >
          <span class="nom-onglet">{nom}</span> {compte(o)}
        </button>
      ))}
    </nav>
  );
  // L'Aide de l'étape : l'explication de la page et de l'onglet, le clavier (elle remplace la ligne grise « Clavier : … »).
  const explicationOnglet =
    onglet === 'copies'
      ? t`La même photo en plusieurs exemplaires : le même fichier copié, ou une copie réduite envoyée par WhatsApp. Proposition : écarter un exemplaire qui ferait double emploi au même endroit (deux fois dans un dossier, ou une photo à trier déjà rangée dans un dossier) ; il ira dans « Mis de côté ». Une photo présente dans plusieurs dossiers que vous gardez y reste partout : à vous de décider, photo par photo.`
      : onglet === 'rafales'
        ? t`Photos quasi identiques prises à la suite (quelques minutes au plus), repérées sur l’ordinateur (gratuit). La plus nette est proposée ; quand les photos se valent, gardez celle que vous préférez. « Plus nette », « plus sombre »… sous une photo signalent un écart visible. « Choisir avec l’IA » : l’IA choisit dans chaque rafale et dit pourquoi, vous acceptez.`
        : onglet === 'ia'
          ? t`Facultatif : l’IA repère la même scène photographiée plusieurs fois (pas seulement les rafales), puis vérifie chaque groupe en grand.`
          : t`Les photos écartées à cette étape. Un clic remet une photo à sa place, un second l’écarte de nouveau.`;
  const texteAide = (
    <>
      <p>
        {t`Les photos en double sont rangées par sorte, dans les onglets. Dans chaque groupe, un clic choisit la photo à garder ; « Accepter » garde les photos choisies et écarte les autres. Les photos écartées vont dans « Mis de côté » : rien n’est supprimé, et Ctrl+Z annule.`}
        {s.projet.mode === 'vrac' && t` Le dossier n’étant pas encore trié, les rafales sont cherchées journée par journée.`}
      </p>
      <p class="encart-onglet">
        {explicationOnglet}
        {onglet === 'copies' && intouches > 0 && t` Les dossiers « Ne pas toucher » ne sont pas examinés : leurs copies sont voulues.`}
      </p>
      {onglet !== 'mis_de_cote' && (
        <p>{t`Un clic sur une photo la choisit (dans une rafale, à la place des autres ; Ctrl+clic : en plus) ; « Accepter » garde les photos choisies et écarte les autres. Clavier : J et K (ou ↓ et ↑) d’un groupe à l’autre, ← et → d’une photo à l’autre, Espace pour choisir, A pour accepter, C pour comparer en grand, N et P pour avancer dans la liste de gauche.`}</p>
      )}
      <p>{t`Rien n’est supprimé : ce que vous écartez va dans « Mis de côté ». Vos photos d’origine ne bougent pas.`}</p>
    </>
  );
  const consigne =
    onglet === 'copies' ? t`Gardez un exemplaire, puis « Accepter ».` : onglet === 'mis_de_cote' ? t`Un clic remet une photo à sa place.` : t`Cliquez la photo à garder, puis « Accepter ».`;
  const seul = (contenu: ComponentChildren) => (
    <>
      <OutilsCadre>{onglets}</OutilsCadre>
      <CorpsCadre>{contenu}</CorpsCadre>
    </>
  );

  return (
    <ContexteCadre.Provider value={{ onglets, aide, palier, texteAide, listeOuverte, ouvrirListe: setListeOuverte, ongletSuivant }}>
      <div
        class="page-cadre page-doublons"
        data-gabarit="photos"
        data-palier={palier ? '' : undefined}
        data-etroit={etroit ? '' : undefined}
        data-aide={aide ? '' : undefined}
        data-liste={listeOuverte ? 'ouverte' : undefined}
        style={styleLargeurPanneau()}
      >
        <EnteteCadre titre={nomEtape(ETAPE.doublons)} consigne={consigne} />

        {/* L'analyse en cours et la recherche des rafales (avec « Arrêter ») : une bande sous la barre d'outils. */}
        <div class="bande-analyse">
          <EncartAnalyse photos={toutes} pourquoi={t`la ressemblance et la netteté de chaque photo servent à repérer les doublons et à garder la plus nette.`} />
          {progres && (
            <div class="encart">
              <BarreProgression faits={progres.faits} total={progres.total} texte={`${progres.avecIA ? t`Analyse IA` : t`Recherche des rafales`} · ${progres.faits} / ${progres.total} ${t(plusieurs)}${progres.texte ? ` · ${progres.texte}` : ''}`} />
              <button type="button" onClick={() => (arreter.current = true)}>
                {t`Arrêter (les réponses déjà reçues sont gardées)`}
              </button>
            </div>
          )}
        </div>

        {onglet === 'copies' &&
          (copies === null
            ? seul(<p class="encart">{t`Recherche des copies en cours, pendant l’analyse des photos…`}</p>)
            : !groupes.copies.length && !groupes.dossiers.length
              ? seul(<p class="encart">{t`Aucune copie exacte : chaque photo n’existe qu’en un exemplaire.`}</p>)
              : <ListeGroupes key="copies" onglet="copies" groupes={[...groupes.copies, ...groupes.dossiers]} titre={t`Toutes les copies exactes`} />)}

        {onglet === 'rafales' &&
          (!s.doublons
            ? seul(<p class="encart">{t`Recherche des rafales dès que l’analyse des photos est finie…`}</p>)
            : !groupes.rafales.length
              ? seul(<p class="encart">{t`Aucune rafale : pas de photos quasi identiques prises à la suite.`}</p>)
              : <ListeGroupes key="rafales" onglet="rafales" groupes={groupes.rafales} titre={t`Toutes les rafales`} />)}

        {onglet === 'ia' &&
          (!iaLancee
            ? seul(
                <div class="encart encart-ia">
                  <p>
                    {t`Facultatif : l’IA repère la même scène photographiée plusieurs fois (pas seulement les rafales), puis vérifie chaque groupe en grand. Coût :`} <strong>{cout}</strong>
                  </p>
                  {reglagesIA}
                </div>,
              )
            : (() => {
                const relancer = (
                  <details class="avances encart-ia">
                    <summary>{t`Analyse IA faite — la relancer : ${cout}`}</summary>
                    {reglagesIA}
                  </details>
                );
                return groupes.ia.length ? <ListeGroupes key="ia" onglet="ia" groupes={groupes.ia} titre={t`Toutes les scènes en double`} avant={relancer} /> : seul(<>{relancer}<p class="encart">{t`L’IA n’a trouvé aucune autre scène en double.`}</p></>);
              })())}

        {onglet === 'mis_de_cote' && <MisDeCote />}

        {/* C-8.5 : ce que devient ce qui reste ; « Valider et continuer » plein une fois tout accepté (C-4.1). */}
        <BarreValidation
          // Ce que devient ce qui reste (C-8.5), sur une ligne même au palier ; le compte des photos écartées est sur l'onglet « Mis de côté ».
          resume={enAttente ? t`${pluriel(enAttente, 'groupe pas encore accepté', 'groupes pas encore acceptés')} : toutes leurs photos sont gardées.` : t`Tous les groupes sont acceptés.`}
          ecarte
          court
          fini={!enAttente && copies !== null && !!s.doublons}
          revenir={() => revenirDe('doublons')}
          valider={() => validerEtape('doublons')}
        />
      </div>
    </ContexteCadre.Provider>
  );
}
