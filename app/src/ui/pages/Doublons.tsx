// Étape « Doublons » (SPEC § 6.8, D71) : un onglet par sorte de doublons —
// copies exactes, photos présentes dans plusieurs dossiers, rafales (repérées
// sur l'ordinateur, gratuit), même scène (IA, à la demande) — et un onglet des
// photos mises de côté. Les groupes se relisent journée par journée (ou
// dossier par dossier) ; un clic sur une photo la garde ou l'écarte, rien ne
// disparaît de l'écran et tout s'annule (Ctrl+Z). Rien n'est écarté sans
// action de l'utilisateur (règle d'or 3).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  accepter,
  aEcarter,
  aRelire,
  avancementGroupes,
  basculer,
  ecarterTout,
  garderTout,
  groupesCopies,
  groupesScenes,
  groupeVisible,
  photosDuGroupe,
  raisonDe,
  sectionJour,
  type GroupeDoublons,
  type PhotoDuGroupe,
  type Sorte,
} from '../../lib/groupesDoublons';
import { aTraduire, t } from '../../lib/langue';
import { cheminDossier, ecarterDoublons, garderAussi, RACINE, traitementDe, type FichierPlan, type InfoDoublon, type Modification, type Plan } from '../../lib/plan';
import { dossierMisDeCote, nomsSortie } from '../../lib/sortie';
import { MODELES } from '../../lib/tarifs';
import { cleApi } from '../../navigateur/cle';
import { analyserDoublons, estimerDoublons, lotsANouveau, lotsDoublons, type EtatDoublons } from '../../navigateur/doublons';
import { BudgetAtteint } from '../../navigateur/ia';
import { cleMiniature } from '../../navigateur/miniatures';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { analyseEnCours } from '../analyseDossier';
import { EncartAnalyse } from '../composants/Analyse';
import { BarreProgression, BarreValidation, TeteEtape } from '../composants/Cadre';
import { Comparateur } from '../composants/Comparateur';
import { confirmer } from '../composants/Dialogues';
import { Miniature } from '../composants/GrillePhotos';
import { useCopiesExactes } from '../copiesExactes';
import { allerEtape, annuler, appliquer, changerEtape, journal, notifier, page, reglages, revenirDe, serviceMiniatures, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { nombre, nomJour, nomMois, pluriel, taille as texteTaille } from '../format';
import { enregistrerAide } from './AidesIA';

type Onglet = Sorte | 'mis_de_cote';
type Filtre = 'a_relire' | 'relus' | 'tous';
type Ordre = 'heure' | 'taille';

/** Onglet (par projet) et section affichés : gardés le temps de la session, d'une visite de l'étape à l'autre. */
const ongletsChoisis = signal<Record<string, Onglet>>({});
const sectionsChoisies = signal<Partial<Record<Onglet, string>>>({});
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

/** « 2 photos écartées → « _mis_de_cote/doublons » ». */
function texteEcartees(n: number, raison: 'doublons' | 'doublons_exacts'): string {
  return t`${pluriel(n, 'photo écartée', 'photos écartées')} → « ${dossierMisDeCote(raison)} »`;
}

// ---------------------------------------------------------------------------
// Sections : les journées (ou les mois), puis les dossiers gardés, puis les photos sans date
// ---------------------------------------------------------------------------

/**
 * Au-delà de 20 journées et dossiers (une année), la liste de gauche passe aux
 * mois, dans l'ordre du temps : une journée ou un dossier n'a souvent qu'un
 * groupe. Chaque carte dit alors sa journée et son dossier.
 */
const SECTIONS_MAX = 20;

/** Section d'affichage d'un élément : la sienne, ou le mois de sa date quand il y en a trop. */
function regroupement(elements: { section: string; date?: string }[]): (e: { section: string; date?: string }) => string {
  const parMois = new Set(elements.map((e) => e.section)).size > SECTIONS_MAX;
  return (e) => (parMois && e.section !== 'sans' && e.date ? `mois:${e.date.slice(0, 7)}` : e.section);
}

interface Section {
  cle: string;
  /** Nom court (liste de gauche), et titre complet (en tête de la section). */
  nom: string;
  titre: string;
  total: number;
  aRelire: number;
  debut: string;
}

function sections(elements: { section: string; date?: string; aRelire: boolean }[], plan: Plan): Section[] {
  const parCle = new Map<string, Section>();
  for (const e of elements) {
    const x = parCle.get(e.section) ?? { cle: e.section, nom: '', titre: '', total: 0, aRelire: 0, debut: '9999' };
    x.total++;
    if (e.aRelire) x.aRelire++;
    if (e.date && e.date < x.debut) x.debut = e.date;
    parCle.set(e.section, x);
  }
  const liste = [...parCle.values()];
  const annees = new Set(liste.filter((x) => x.cle.startsWith('jour:')).map((x) => x.cle.slice(5, 9)));
  for (const x of liste) {
    if (x.cle.startsWith('jour:')) {
      x.nom = nomJour(x.cle.slice(5), false, annees.size > 1);
      x.titre = nomJour(x.cle.slice(5), true);
    } else if (x.cle.startsWith('mois:')) x.nom = x.titre = nomMois(x.cle.slice(5));
    else if (x.cle.startsWith('dossier:')) x.nom = x.titre = cheminDossier(plan, x.cle.slice(8)) || t`Photos (racine)`;
    else x.nom = x.titre = t`Photos sans date`;
  }
  const rang = (x: Section) => (x.cle.startsWith('jour:') || x.cle.startsWith('mois:') ? 0 : x.cle.startsWith('dossier:') ? 1 : 2);
  return liste.sort((a, b) => rang(a) - rang(b) || (rang(a) === 0 ? a.cle.localeCompare(b.cle) : a.debut.localeCompare(b.debut) || a.nom.localeCompare(b.nom)));
}

/** Liste de gauche : chaque journée (ou dossier), ce qui reste à relire, ✓ quand c'est fait. */
function ListeSections({ liste, choisie, choisir, avancement = true }: { liste: Section[]; choisie?: string; choisir: (cle: string) => void; avancement?: boolean }) {
  const blocs: [string, Section[]][] = [
    [t`Journées`, liste.filter((x) => x.cle.startsWith('jour:'))],
    [t`Mois`, liste.filter((x) => x.cle.startsWith('mois:'))],
    [t`Dossiers`, liste.filter((x) => x.cle.startsWith('dossier:'))],
    [t`Sans date`, liste.filter((x) => x.cle === 'sans')],
  ];
  return (
    <nav class="sections-doublons" aria-label={t`Journées et dossiers`}>
      {blocs
        .filter(([, l]) => l.length)
        .map(([titre, l]) => (
          <div key={titre}>
            <h2>{titre}</h2>
            {l.map((x) => (
              <button key={x.cle} type="button" class={`section-doublons${x.cle === choisie ? ' choisie' : ''}`} aria-current={x.cle === choisie ? 'true' : undefined} onClick={() => choisir(x.cle)}>
                <span>{x.nom}</span>
                {!avancement ? (
                  <span class="compte">{nombre(x.total)}</span>
                ) : x.aRelire ? (
                  <span class="reste" title={t`groupes à relire`}>
                    {nombre(x.aRelire)}
                  </span>
                ) : (
                  <span class="fait" title={t`tout est relu`}>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
    </nav>
  );
}

/** En tête de la section : son titre, et les sections voisines. */
function TeteSection({ liste, section, choisir, detail }: { liste: Section[]; section: Section; choisir: (cle: string) => void; detail: string }) {
  const i = liste.indexOf(section);
  const avant = liste[i - 1];
  const apres = liste[i + 1];
  return (
    <div class="tete-section-doublons">
      <h2>{section.titre}</h2>
      <span class="discret">{detail}</span>
      <span class="espace" />
      <button type="button" disabled={!avant} onClick={() => avant && choisir(avant.cle)} title={t`Touche P`}>
        ‹ {avant?.nom ?? ''}
      </button>
      <button type="button" disabled={!apres} onClick={() => apres && choisir(apres.cle)} title={t`Touche N`}>
        {apres?.nom ?? ''} ›
      </button>
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
  if (f.dossier === RACINE) return s.projet.mode === 'vrac' ? t`Photos à trier` : t`Photos (racine)`;
  return cheminDossier(s.plan, f.dossier);
}

function titreGroupe(g: GroupeDoublons, n: number, etoile: FichierPlan | undefined): string {
  if (g.sorte === 'copies' || g.sorte === 'dossiers') return `${etoile?.nom ?? ''} · ${pluriel(n, 'exemplaire')}`;
  if (g.sorte === 'rafales') return t`Rafale de ${nombre(n)} photos`;
  return t`Même scène · ${nombre(n)} photos`;
}

function texteProposition(g: GroupeDoublons, n: number): string {
  if (g.sorte === 'rafales') return t`Proposition : garder la plus nette ★`;
  if (g.sorte === 'ia') return t`Proposition de l’IA : garder la photo ★`;
  return t`Proposition : écarter ${pluriel(n, 'exemplaire')}`;
}

/** Ce qu'on sait d'une photo pour choisir : l'heure, l'emplacement d'une copie, la description de l'IA. */
function Legende({ g, x }: { g: GroupeDoublons; x: PhotoDuGroupe }) {
  const s = session.value!;
  const { m, f } = x;
  const heure = f.date && f.date.length > 10 ? f.date.slice(11, 19) : '';
  if (g.sorte === 'rafales') return <span class="legende-doublon">{m.id === g.etoile ? t`${heure} · la plus nette` : heure}</span>;
  if (g.sorte === 'ia')
    return (
      <span class="legende-doublon">
        {heure.slice(0, 5)}
        {m.description && ` · ${m.description}`}
        {m.refus && <em class="refus">{t`Gardée par le garde-fou : l’IA la décrit autrement.`}</em>}
      </span>
    );
  const r = g.remplacement;
  const nomDossier = (id: string) => cheminDossier(s.plan, id) || t`Photos (racine)`;
  const tr = traitementDe(s.plan, f.dossier);
  return (
    <span class="legende-doublon">
      <strong>{lieuDe(s, f)}</strong>
      {s.projet.mode === 'vrac' && tr === 'nettoyer' && <span>{t`dossier gardé, nettoyé`}</span>}
      {s.projet.mode === 'vrac' && (tr === 'garder' || tr === 'ignorer') && <span>{t`dossier à ne pas toucher`}</span>}
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

function TuileDoublon({ g, x, cote, agir }: { g: GroupeDoublons; x: PhotoDuGroupe; cote: number; agir: (m: Modification | null) => void }) {
  const { m, f, etat } = x;
  const libelle = etat === 'gardee' ? t`Gardée` : etat === 'ecartee' ? t`Écartée` : t`à écarter`;
  return (
    <div class="photo-doublon" style={{ width: `${cote}px` }}>
      <button
        type="button"
        class={`tuile-doublon ${etat}`}
        aria-pressed={etat === 'gardee'}
        aria-label={`${f.nom} : ${libelle}`}
        title={etat === 'gardee' ? t`Cliquer pour l’écarter` : t`Cliquer pour la garder`}
        onClick={() => agir(basculer(session.value!.plan, g, m.id))}
      >
        <span class="cadre-tuile" style={{ width: `${cote}px`, height: `${cote}px` }}>
          <Miniature f={f} taille={cote} rotation={f.rotation} />
        </span>
        <span class={`etat-photo ${etat}`}>{libelle}</span>
        {m.id === g.etoile && (
          <span class="etoile-doublon" title={g.sorte === 'rafales' ? t`La plus nette : proposée` : t`La photo proposée`}>
            ★
          </span>
        )}
      </button>
      <Legende g={g} x={x} />
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
  comparer,
}: {
  g: GroupeDoublons;
  ouverte: boolean;
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
  const photos = photosDuGroupe(g, fichier);
  const etoile = fichier(g.etoile);
  const enAttente = photos.filter((x) => x.etat === 'a_ecarter').length;
  const gardees = photos.filter((x) => x.etat === 'gardee').length;
  const ecartees = photos.filter((x) => x.etat === 'ecartee').length;
  const copie = g.sorte === 'copies' || g.sorte === 'dossiers';
  const heureSeule = etoile?.date && etoile.date.length > 10 ? etoile.date.slice(11, 16) : '';
  const heure = avecJour && etoile?.date ? [nomJour(etoile.date.slice(0, 10)), heureSeule].filter(Boolean).join(' · ') : heureSeule;
  const titre = titreGroupe(g, photos.length, etoile);
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
        {enAttente ? <span class="pastille-proposition">{texteProposition(g, enAttente)}</span> : <span class="pastille-relue">{t`✓ Relu`}</span>}
      </header>
      {g.sorte === 'ia' && g.scene && <p class="scene-doublons">{g.scene}</p>}
      <div class="photos-doublons">
        {photos.map((x) => (
          <TuileDoublon key={x.m.id} g={g} x={x} cote={copie ? 120 : 168} agir={agir} />
        ))}
      </div>
      {gardees === 0 && <p class="alerte-doublons">{t`Aucune photo gardée : tout le groupe ira dans « ${dossierMisDeCote(raisonDe(g))} ».`}</p>}
      <footer>
        {enAttente > 0 && (
          <button type="button" class="principal" data-action="accepter" onClick={() => agirGroupe(accepter(plan, [g]), texteEcartees(enAttente, raisonDe(g)))} title={t`Touche A`}>
            {t`Accepter`}
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
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Les groupes d'un onglet
// ---------------------------------------------------------------------------

function ListeGroupes({ onglet, groupes }: { onglet: Sorte; groupes: GroupeDoublons[] }) {
  const s = session.value!;
  versionPlan.value;
  const plan = s.plan;
  const fichier = (id: string) => plan.fichiers.get(id);
  const [filtre, setFiltre] = useState<Filtre>(onglet === 'dossiers' ? 'tous' : 'a_relire');
  const [ordre, setOrdre] = useState<Ordre>('heure');
  // Cartes repliées après « Accepter », « Tout garder »… ; et cartes déjà relues rouvertes (« Revoir »).
  const [fermees, setFermees] = useState<ReadonlySet<string>>(new Set());
  const [rouvertes, setRouvertes] = useState<ReadonlySet<string>>(new Set());
  const [comparee, setComparee] = useState<string | null>(null);
  const zone = useRef<HTMLDivElement>(null);

  const bruts = groupes.map((g) => ({ g, section: g.section, relire: aRelire(g, fichier), date: fichier(g.etoile)?.date }));
  const regrouper = regroupement(bruts);
  const elements = bruts.map((e) => ({ ...e, section: regrouper(e) }));
  const liste = sections(
    elements.map((e) => ({ section: e.section, date: e.date, aRelire: e.relire })),
    plan,
  );
  const [section, choisir] = useSection(onglet, liste);
  const signature = groupes.map((g) => g.cle).join('|');
  // Instantané des groupes montrés, figé tant qu'on reste sur cette section et ce filtre : une décision
  // ne fait rien disparaître (D71). Les groupes déjà relus à l'arrivée sont repliés.
  const montres = useMemo(
    () => new Set(elements.filter((e) => e.section === section?.cle && (filtre === 'tous' || (filtre === 'a_relire') === e.relire)).map((e) => e.g.cle)),
    [section?.cle, filtre, signature],
  );
  const relusAuDepart = useMemo(() => new Set(elements.filter((e) => e.section === section?.cle && !e.relire).map((e) => e.g.cle)), [section?.cle, signature]);
  const parDate = (a: (typeof elements)[number], b: (typeof elements)[number]) => (a.date ?? '').localeCompare(b.date ?? '') || a.g.cle.localeCompare(b.g.cle);
  const visibles = elements.filter((e) => montres.has(e.g.cle)).sort((a, b) => (ordre === 'taille' ? b.g.membres.length - a.g.membres.length || parDate(a, b) : parDate(a, b)));
  const enAttente = visibles.filter((e) => aRelire(e.g, fichier)).map((e) => e.g);
  // Copies : quand toute la journée est tout l'onglet, le bouton de l'encart (« Accepter les N propositions ») suffit.
  const commeLOnglet = onglet === 'copies' && enAttente.length === elements.filter((e) => e.relire).length;
  const { relus, total } = avancementGroupes(groupes, fichier);
  const ouverte = (cle: string) => rouvertes.has(cle) || !(fermees.has(cle) || relusAuDepart.has(cle));

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
  const accepterSection = () => {
    const n = enAttente.reduce((a, g) => a + aEcarter(g, fichier).length, 0);
    const raison = onglet === 'copies' || onglet === 'dossiers' ? 'doublons_exacts' : 'doublons';
    agirGroupe(
      enAttente.map((g) => g.cle),
      accepter(plan, enAttente),
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
  const gComparee = visibles[iComparee]?.g;
  const pct = total ? Math.round((relus / total) * 100) : 100;

  return (
    <>
      <div class="outils-doublons">
        <span class="discret">{t`Afficher`}</span>
        <div class="choix-segmente" role="radiogroup" aria-label={t`Groupes affichés`}>
          {(
            [
              ['a_relire', t`À relire`],
              ['relus', t`Relus`],
              ['tous', t`Tous`],
            ] as const
          ).map(([v, libelle]) => (
            <button key={v} type="button" role="radio" aria-checked={filtre === v} onClick={() => setFiltre(v)}>
              {libelle}
            </button>
          ))}
        </div>
        <label class="discret">
          {t`Classer`}{' '}
          <select value={ordre} onChange={(e) => setOrdre(e.currentTarget.value as Ordre)}>
            <option value="heure">{t`par heure`}</option>
            <option value="taille">{t`les plus grands groupes d’abord`}</option>
          </select>
        </label>
        {onglet !== 'dossiers' && (
          <span class="avance-doublons">
            {t`Relus : ${nombre(relus)} sur ${nombre(total)}`}
            <span class="jauge-doublons" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
          </span>
        )}
        <span class="espace" />
        {enAttente.length > 0 && section && !commeLOnglet && (
          <button type="button" class="principal" onClick={accepterSection}>
            {enAttente.length === 1 ? t`Accepter la proposition · ${section.nom}` : t`Accepter les ${nombre(enAttente.length)} propositions · ${section.nom}`}
          </button>
        )}
      </div>
      <p class="discret aide-doublons">{t`Un clic sur une photo la garde ou l’écarte, la photo ★ comprise. Clavier : J et K d’un groupe à l’autre, Espace pour garder ou écarter, A pour accepter, N et P pour avancer dans la liste de gauche.`}</p>

      <div class="corps-doublons">
        <ListeSections liste={liste} choisie={section?.cle} choisir={choisir} />
        <section class="contenu-doublons" ref={zone}>
          {section && (
            <TeteSection
              liste={liste}
              section={section}
              choisir={choisir}
              detail={onglet === 'dossiers' ? pluriel(section.total, 'groupe') : `${pluriel(section.total, 'groupe')} · ${pluriel(section.total - section.aRelire, 'relu', 'relus')}`}
            />
          )}
          {visibles.length === 0 && (
            <div class="encart">
              <p>{filtre === 'a_relire' ? t`Tout est relu ici.` : t`Aucun groupe à montrer ici.`}</p>
              {filtre === 'a_relire' && liste.some((x) => x.aRelire > 0) && (
                <button type="button" onClick={() => choisir(liste.find((x) => x.aRelire > 0)!.cle)}>
                  {t`Aller à la suite à relire`}
                </button>
              )}
            </div>
          )}
          {visibles.map(({ g }) => (
            <CarteGroupe
              key={g.cle}
              g={g}
              ouverte={ouverte(g.cle)}
              avecJour={!!section?.cle.startsWith('mois:')}
              agir={appliquer}
              agirGroupe={(m, message) => agirGroupe([g.cle], m, message)}
              rouvrir={() => setRouvertes(new Set([...rouvertes, g.cle]))}
              comparer={() => setComparee(g.cle)}
            />
          ))}
          {visibles.length > 0 && enAttente.length === 0 && suite && (
            <p class="suite-doublons">
              <button type="button" class="principal" onClick={() => choisir(suite.cle)}>
                {t`Suite à relire : ${suite.nom} ›`}
              </button>
            </p>
          )}
        </section>
      </div>

      {gComparee && (
        <Comparateur
          key={gComparee.cle}
          titre={titreGroupe(gComparee, photosDuGroupe(gComparee, fichier).length, fichier(gComparee.etoile))}
          photos={photosDuGroupe(gComparee, fichier).map((x) => x.f)}
          fermer={() => setComparee(null)}
          entete={(f) => {
            const x = photosDuGroupe(gComparee, fichier).find((p) => p.f.id === f.id);
            return x && <span class={`etat-photo ${x.etat}`}>{x.etat === 'gardee' ? t`Gardée` : x.etat === 'ecartee' ? t`Écartée` : t`à écarter`}</span>;
          }}
          actions={(f) => {
            const x = photosDuGroupe(gComparee, fichier).find((p) => p.f.id === f.id);
            return (
              x && (
                <button type="button" onClick={() => appliquer(basculer(plan, gComparee, f.id))}>
                  {x.etat === 'gardee' ? t`Écarter` : t`Garder`}
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
  const bruts = ecartees.flatMap((x) => {
    const f = plan.fichiers.get(x.id);
    return f ? [{ ...x, f, section: sectionJour(f), date: f.date }] : [];
  });
  const regrouper = regroupement(bruts);
  const elements = bruts.map((e) => ({ ...e, section: regrouper(e) }));
  const liste = sections(
    elements.map((e) => ({ section: e.section, date: e.f.date, aRelire: false })),
    plan,
  );
  const [section, choisir] = useSection('mis_de_cote', liste);
  if (!elements.length) return <p class="encart">{t`Aucune photo mise de côté à cette étape.`}</p>;
  const dans = elements.filter((e) => e.section === section?.cle).sort((a, b) => (a.f.date ?? '').localeCompare(b.f.date ?? '') || a.id.localeCompare(b.id));
  const aRemettre = dans.filter((e) => e.f.statut === 'mis_de_cote').map((e) => e.id);
  const basculerPhoto = (e: (typeof dans)[number]) =>
    appliquer(e.f.statut === 'mis_de_cote' ? garderAussi(plan, [e.id]) : ecarterDoublons(plan, [{ id: e.id, raison: e.raison, doublon: e.doublon }]));
  const heureDe = (id: string) => plan.fichiers.get(id)?.date?.slice(11, 16) ?? '';

  return (
    <>
      <p class="discret aide-doublons">{t`Les photos écartées à cette étape. Un clic remet une photo à sa place, un second l’écarte de nouveau.`}</p>
      <div class="corps-doublons">
        <ListeSections liste={liste} choisie={section?.cle} choisir={choisir} avancement={false} />
        <section class="contenu-doublons">
          {section && <TeteSection liste={liste} section={section} choisir={choisir} detail={pluriel(section.total, 'photo')} />}
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
                <div key={e.id} class="photo-doublon" style={{ width: '150px' }}>
                  <button
                    type="button"
                    class={`tuile-doublon ${etat}`}
                    aria-pressed={etat === 'gardee'}
                    aria-label={`${e.f.nom} : ${etat === 'gardee' ? t`Remise` : t`Écartée`}`}
                    title={etat === 'gardee' ? t`Cliquer pour l’écarter de nouveau` : t`Cliquer pour la remettre à sa place`}
                    onClick={() => basculerPhoto(e)}
                  >
                    <span class="cadre-tuile" style={{ width: '150px', height: '150px' }}>
                      <Miniature f={e.f} taille={150} rotation={e.f.rotation} />
                    </span>
                    <span class={`etat-photo ${etat}`}>{etat === 'gardee' ? t`Remise` : t`Écartée`}</span>
                  </button>
                  <span class="legende-doublon">
                    {section?.cle.startsWith('mois:') && e.f.date ? `${nomJour(e.f.date.slice(0, 10))} · ` : ''}
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

  const premier: Onglet = (['copies', 'rafales', 'ia'] as const).find((o) => groupes[o].some((g) => aRelire(g, fichier))) ?? (groupes.copies.length ? 'copies' : 'rafales');
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
      journal('doublons', t`Doublons (${avecIA ? t`IA, ${modele}` : t`rafales`}, ${strict ? t`strict` : t`prudent`}) : ${pluriel(n, 'groupe à relire', 'groupes à relire')} en ${Math.round((performance.now() - debut) / 1000)} s`);
      if (res.budgetAtteint) notifier('erreur', new BudgetAtteint().message);
      else if (res.arrete) notifier('info', texteArret(un === 'journée', res.faits, lots.length));
      else if (res.erreurs.length)
        notifier('erreur', t`${un === 'journée' ? pluriel(res.erreurs.length, 'journée non analysée', 'journées non analysées') : pluriel(res.erreurs.length, 'dossier non analysé', 'dossiers non analysés')} : ${res.erreurs[0]}`);
      else if (avecIA) notifier('ok', n === 0 ? t`Aucun groupe à relire.` : t`${pluriel(n, 'groupe à relire', 'groupes à relire')} : voyez les onglets « Rafales » et « Même scène (IA) ».`);
      changerEtape(ETAPE.doublons, 'en_cours');
    } catch (err) {
      notifier('erreur', t`Analyse interrompue : ${texteErreur(err)}`);
    } finally {
      setProgres(null);
      versionIA.value++;
    }
  };

  // Les rafales se repèrent toutes seules (gratuit, local) dès que l'analyse des photos est prête (D56) ;
  // ensuite, seulement les lots jamais cherchés (recherche arrêtée en route) ou qui ont reçu des photos (D63).
  useEffect(() => {
    if (progres || analyseEnCours.value || analysesManquantes > 0) return;
    if (!s.doublons) {
      void lancer(false);
      return;
    }
    const manquants = dossiers.filter((d) => !s.doublons!.dossiers[d]);
    const nouveaux = lotsANouveau(plan, s.doublons, dossiers, s.analyses);
    const aChercher = [...new Set([...manquants, ...nouveaux])];
    if (aChercher.length) void lancer(false, aChercher);
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
    if ((o === 'copies' || o === 'dossiers') && copies === null) return <span class="compte gris">…</span>;
    if (o === 'ia' && !iaLancee) return <span class="compte gris">{t`pas lancée`}</span>;
    const { relus, total } = avancement(o);
    if (o === 'dossiers' || !total) return <span class="compte gris">{nombre(total)}</span>;
    return relus === total ? <span class="compte fini">✓ {nombre(total)}</span> : <span class="compte">{t`${nombre(total - relus)} à relire`}</span>;
  };
  const ONGLETS: [Onglet, string][] = [
    ['copies', t`Copies exactes`],
    ['dossiers', t`Dans plusieurs dossiers`],
    ['rafales', t`Rafales`],
    ['ia', t`Même scène (IA)`],
    ['mis_de_cote', t`Mis de côté`],
  ];

  const enAttente = (['copies', 'rafales', 'ia'] as const).reduce((n, o) => n + avancement(o).total - avancement(o).relus, 0);
  const resumeOnglet = (o: Sorte, nom: string) => {
    const { relus, total } = avancement(o);
    return `${nom} ${nombre(relus)} / ${nombre(total)}`;
  };
  const pending = groupes.copies.filter((g) => aRelire(g, fichier));
  const photosCopies = pending.reduce((n, g) => n + aEcarter(g, fichier).length, 0);

  return (
    <div class="page large avec-barre page-doublons">
      <TeteEtape numero={ETAPE.doublons} titre={nomEtape(ETAPE.doublons)} cle="doublons">
        {t`Les photos en double sont rangées par sorte, dans les onglets ci-dessous. Dans chaque groupe, un clic sur une photo la garde ou l’écarte ; « Accepter » applique la proposition. Les photos écartées vont dans « ${nomsSortie().misDeCote} » : rien n’est supprimé, et Ctrl+Z annule.`}
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
        ) : !groupes.copies.length ? (
          <p class="encart">{t`Aucune copie exacte : chaque photo n’existe qu’en un exemplaire.`}</p>
        ) : (
          <>
            <div class="encart encart-onglet">
              <p>
                {t`La même photo en plusieurs exemplaires : le même fichier copié, ou une copie réduite envoyée par WhatsApp. Proposition : garder un exemplaire, celui qui est déjà rangé dans un dossier, sinon le plus grand ; les autres iront dans « ${dossierMisDeCote('doublons_exacts')} ».`}
              </p>
              {pending.length > 0 && (
                <div class="actions">
                  <button
                    type="button"
                    class="principal"
                    onClick={() => {
                      const m = accepter(plan, pending);
                      if (!m) return;
                      appliquer(m);
                      notifier('ok', texteEcartees(photosCopies, 'doublons_exacts'), { libelle: t`Annuler`, faire: annuler });
                    }}
                  >
                    {pending.length === 1 ? t`Accepter la proposition` : t`Accepter les ${nombre(pending.length)} propositions`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const m = garderTout(plan, pending);
                      if (!m) return;
                      appliquer(m);
                      notifier('ok', t`Tous les exemplaires sont gardés.`, { libelle: t`Annuler`, faire: annuler });
                    }}
                  >
                    {t`Tout garder`}
                  </button>
                </div>
              )}
            </div>
            <ListeGroupes key="copies" onglet="copies" groupes={groupes.copies} />
          </>
        ))}

      {onglet === 'dossiers' &&
        (copies === null ? (
          <p class="encart">{t`Recherche des copies en cours, pendant l’analyse des photos…`}</p>
        ) : !groupes.dossiers.length ? (
          <p class="encart">{t`Aucune photo n’est dans plusieurs dossiers.`}</p>
        ) : (
          <>
            <p class="encart encart-onglet">
              {t`Ces photos sont dans plusieurs dossiers que vous gardez (un « Best of » fait de copies, par exemple) : toutes restent, chacune dans son dossier. Cliquez sur un exemplaire pour l’écarter s’il est de trop.`}
            </p>
            <ListeGroupes key="dossiers" onglet="dossiers" groupes={groupes.dossiers} />
          </>
        ))}

      {onglet === 'rafales' &&
        (!s.doublons ? (
          <p class="encart">{t`Recherche des rafales dès que l’analyse des photos est finie…`}</p>
        ) : !groupes.rafales.length ? (
          <p class="encart">{t`Aucune rafale : pas de photos quasi identiques prises à quelques secondes d’intervalle.`}</p>
        ) : (
          <>
            <p class="encart encart-onglet">
              {t`Photos quasi identiques prises à quelques secondes d’intervalle, repérées sur l’ordinateur (gratuit). Proposition : garder la plus nette ★ de chaque rafale.`}
            </p>
            <ListeGroupes key="rafales" onglet="rafales" groupes={groupes.rafales} />
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
            {groupes.ia.length ? <ListeGroupes key="ia" onglet="ia" groupes={groupes.ia} /> : <p class="encart">{t`L’IA n’a trouvé aucune autre scène en double.`}</p>}
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
        alertes={enAttente ? [t`${pluriel(enAttente, 'groupe pas encore relu', 'groupes pas encore relus')} : leurs photos restent dans l’archive`] : []}
        revenir={() => revenirDe('doublons')}
        valider={() => validerEtape('doublons')}
      />
    </div>
  );
}
