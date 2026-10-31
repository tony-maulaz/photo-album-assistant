// Étape « Petits dossiers » (SPEC § 6.5, IA3, D90) : un petit dossier à la
// fois, ses photos en grand, entre le dossier juste avant et juste après lui
// dans le temps, chacun avec ses photos du même moment, l'écart et la
// distance, et un bouton sous chacun. La liste de gauche garde chaque
// décision (rien ne disparaît, Ctrl+Z annule) ; après un choix, on passe au
// suivant ; les cas évidents se règlent d'un coup après vérification ; l'aide
// IA est facultative. Rien n'est rattaché sans un clic. La liste prend la
// ligne de dossier commune (C-7.7, D112 point 10) : le nom, puis la date et
// l'état écrit ; le petit dossier ouvert se renomme (crayon, F2, menu « … »).

import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { DossierInfo } from '../../lib/consolidation';
import {
  candidatsRattachement,
  cibleEvidente,
  dossiersAvecPhotos,
  estimationFragments,
  fragments,
  lireFragment,
  niveauRessemblance,
  noterRattachement,
  requeteFragment,
  ressortirFragment,
  SEUIL_PETIT_DOSSIER,
  type DecisionFragment,
  type Fragment,
  type FragmentRattache,
  type Voisin,
} from '../../lib/fragments';
import { aTraduire, t } from '../../lib/langue';
import { avecDetail, enchainer, fusionnerDossiers, modificationHorsPlan, renommerDossier, type FichierPlan } from '../../lib/plan';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { enParallele } from '../../navigateur/workers';
import { BarreValidation, RaisonDesactivee } from '../composants/Cadre';
import { AideEtape, LigneEtape } from '../composants/CadreCommun';
import { Miniature } from '../composants/GrillePhotos';
import { Icone } from '../composants/Icones';
import { MenuActions, type ActionMenu } from '../composants/MenuActions';
import { ChampRenommer, redimensionner, renommerVers, styleLargeurPanneau } from '../composants/PanneauDossiers';
import { Visionneuse } from '../composants/Visionneuse';
import { annuler, appliquer, changerReglages, contexteExecution, notifier, reglages, revenirDe, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { REGLAGES_DEFAUT } from '../../navigateur/reglages';
import { jourCourt, nombre, nomJour, pluriel } from '../format';
import { simplifier, visionneuse } from '../organiser';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs } from './AidesIA';
import { petitsDe } from './Organisation';

const phash = (s: Session) => (f: FichierPlan) => s.analyses.get(f)?.phash;

function tousFragments(s: Session): Fragment[] {
  return fragments(petitsDe(s), dossiersAvecPhotos(s.plan), s.plan, phash(s));
}

type DecisionIA3 = DecisionFragment & { cle: string };

enregistrerAide({
  id: 'IA3',
  nom: aTraduire('Proposer un rattachement avec l’IA'),
  etape: ETAPE.petits,
  description: aTraduire('Pour chaque petit dossier, l’IA compare ses photos à celles du dossier juste avant et juste après dans le temps, et propose de le rattacher à l’un d’eux ou de le garder seul.'),
  envoi: aTraduire('planches de miniatures du petit dossier et de ses deux voisins dans le temps'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const liste = tousFragments(s).filter((f) => f.voisins.length);
    if (!liste.length) return null;
    const modele = modeleDe('standard');
    const aFaire = liste.filter((f) => {
      const r = requeteFragment(f, modele, cleAnalyse);
      return r && !s.ia.enCache(r.cle);
    });
    const e = estimationFragments(aFaire, modele);
    return { usd: e.usd, appels: e.appels, detail: pluriel(aFaire.length, 'petit dossier', 'petits dossiers') };
  },
  lancer: async (s, l) => {
    const liste = tousFragments(s).filter((f) => f.voisins.length);
    const ctx = contexteExecution(s);
    const ajouts: Record<string, DecisionIA3> = {};
    const bilan: BilanEchecs = { echecs: 0 };
    let faits = 0;
    try {
      await enParallele(liste, 3, async (f) => {
        if (l.arreter()) return;
        const r = requeteFragment(f, l.modele, cleAnalyse);
        if (r) {
          const v = await essai(() => executerRequete(ctx, r, l.modele), bilan);
          const d = v === undefined ? null : lireFragment(v, f);
          if (d) ajouts[f.dossier.id] = { ...d, cle: r.cle };
        }
        l.progres(++faits, liste.length, f.dossier.nom);
      });
    } finally {
      await s.aides.fusionner('IA3', ajouts);
    }
    return t`${pluriel(Object.keys(ajouts).length, 'proposition')} pour ${pluriel(liste.length, 'petit dossier', 'petits dossiers')}.${texteEchecs(bilan)}`;
  },
});

// ---------------------------------------------------------------------------
// Décisions (gardées dans `.album/aides.json`, annulables)
// ---------------------------------------------------------------------------

/** Petits dossiers rattachés depuis cette étape : affichés avec leur décision, et ressortables. */
function rattachesDe(s: Session): Record<string, FragmentRattache> {
  return s.aides.get<Record<string, FragmentRattache>>('fragments_rattaches') ?? {};
}

/** Rattache des petits dossiers (une seule opération, Ctrl+Z annule) et note chacun pour pouvoir le ressortir. */
function rattacher(s: Session, paires: { f: Fragment; cible: string }[], libelle: string, ok: string): boolean {
  const notes = paires.map(({ f, cible }) => noterRattachement(s.plan, f.dossier, cible, f.voisins.length > 0)).filter((r): r is FragmentRattache => !!r);
  try {
    appliquer(avecDetail(enchainer(s.plan, t`Ranger ${pluriel(paires.length, 'petit dossier', 'petits dossiers')}`, paires.map(({ f, cible }) => () => fusionnerDossiers(s.plan, f.dossier.id, cible))), libelle));
  } catch (err) {
    notifier('erreur', texteErreur(err));
    return false;
  }
  void s.aides.fusionner('fragments_rattaches', Object.fromEntries(notes.map((r) => [r.dossier.id, r]))).then(() => versionIA.value++);
  notifier('ok', ok, { libelle: t`Annuler`, faire: annuler });
  return true;
}

/** Défait un rattachement fait ici, même après d'autres changements (le dossier revient avec ses photos). */
function ressortir(s: Session, r: FragmentRattache) {
  const m = ressortirFragment(s.plan, r);
  if (!m) {
    notifier('erreur', t`Impossible de ressortir « ${r.dossier.nom} » : ses photos ont été déplacées depuis.`);
    return;
  }
  appliquer(m);
  notifier('ok', t`« ${r.dossier.nom} » est ressorti de « ${r.cibleNom} ».`, { libelle: t`Annuler`, faire: annuler });
}

// ---------------------------------------------------------------------------
// Textes
// ---------------------------------------------------------------------------

/** « 31 min plus tôt », « 2 h 10 plus tard », « la veille », « 3 jours plus tard ». */
function texteEcart(v: Voisin): string {
  if (v.pendant) return t`pris pendant cette sortie`;
  const m = v.ecart;
  const avant = v.cote === 'avant';
  if (m < 60) return avant ? t`${nombre(m)} min plus tôt` : t`${nombre(m)} min plus tard`;
  if (m < 24 * 60) {
    const h = `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`;
    return avant ? t`${h} plus tôt` : t`${h} plus tard`;
  }
  const j = Math.round(m / (24 * 60));
  if (j <= 1) return avant ? t`la veille` : t`le lendemain`;
  return avant ? t`${nombre(j)} jours plus tôt` : t`${nombre(j)} jours plus tard`;
}

/** « à 2,4 km », « à 300 m », ou rien sans position. */
function texteDistance(v: Voisin): string {
  if (v.distanceKm === null) return '';
  return v.distanceKm < 1 ? t` · à ${nombre(Math.max(10, Math.round(v.distanceKm * 100) * 10))} m` : t` · à ${nombre(v.distanceKm, v.distanceKm < 10 ? 1 : 0)} km`;
}

/** « dim. 14 déc., 15:42 – 15:50 ». */
function moment(d: DossierInfo): string {
  if (!d.du) return t`date inconnue`;
  const h = (x?: string) => (x && x.length > 10 ? x.slice(11, 16) : '');
  const jour = nomJour(d.du.slice(0, 10), false, true);
  if (d.au && d.au.slice(0, 10) !== d.du.slice(0, 10)) return `${jour} – ${nomJour(d.au.slice(0, 10), false, true)}`;
  return [jour, [h(d.du), h(d.au)].filter((x, i, l) => x && l.indexOf(x) === i).join(' – ')].filter(Boolean).join(', ');
}

const heure = (f: FichierPlan) => (f.date && f.date.length > 10 ? f.date.slice(11, 16) : '');

// ---------------------------------------------------------------------------
// « Autre dossier… »
// ---------------------------------------------------------------------------

function ChoixRattachement({ f, fermer, fait }: { f: Fragment; fermer: () => void; fait: () => void }) {
  const s = session.value!;
  const [requete, setRequete] = useState('');
  const [index, setIndex] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => champ.current?.focus(), []);
  const candidats = useMemo(() => candidatsRattachement(s.plan, f.dossier, dossiersAvecPhotos(s.plan)), [f.dossier.id, versionPlan.value]);
  const q = simplifier(requete.trim());
  const proposes = (q ? candidats.filter((c) => simplifier(c.chemin).includes(q)) : candidats).slice(0, 200);
  const choix = Math.min(index, proposes.length - 1);
  const n = f.dossier.photos.length;
  const valider = (c = proposes[choix]) => {
    if (!c) return;
    fermer();
    if (rattacher(s, [{ f, cible: c.id }], t`Mettre « ${f.dossier.nom} » avec « ${c.nom} »`, t`Rangé avec « ${c.nom} ».`)) fait();
  };
  const ecart = (m: number | null) =>
    m === null ? '' : m === 0 ? t` · pendant` : m < 60 ? t` · à ${nombre(m)} min` : m < 24 * 60 ? t` · à ${nombre(m / 60, 1)} h` : t` · à ${pluriel(Math.round(m / 1440), 'jour')}`;
  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div class="dialogue deplacer" role="dialog" aria-modal="true" aria-label={t`Mettre « ${f.dossier.nom} » dans…`}>
        <h2>{n === 1 ? t`Mettre la photo de « ${f.dossier.nom} » dans…` : t`Mettre les ${nombre(n)} photos de « ${f.dossier.nom} » dans…`}</h2>
        <p class="discret">{t`Le petit dossier disparaît, ses photos rejoignent le dossier choisi. Les dossiers pris au plus près dans le temps sont en tête.`}</p>
        <input
          ref={champ}
          class="large"
          placeholder={t`Tapez une partie du nom du dossier`}
          value={requete}
          onInput={(e) => {
            setRequete(e.currentTarget.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') fermer();
            else if (e.key === 'ArrowDown') setIndex(Math.min(proposes.length - 1, choix + 1));
            else if (e.key === 'ArrowUp') setIndex(Math.max(0, choix - 1));
            else if (e.key === 'Enter') valider();
            else return;
            e.preventDefault();
          }}
        />
        <ul class="choix-dossiers avec-photo">
          {proposes.map((c, i) => (
            <li key={c.id} class={i === choix ? 'actif' : ''} onMouseEnter={() => setIndex(i)} onClick={() => valider(c)}>
              {c.photo ? <Miniature f={c.photo} taille={40} /> : <span class="sans-photo" />}
              <span>
                {c.chemin}
                <span class="discret">
                  {c.du ? ` · ${jourCourt(c.du)}` : ''}
                  {ecart(c.ecart)}
                </span>
              </span>
            </li>
          ))}
          {!proposes.length && <li class="discret">{t`Aucun dossier ne correspond.`}</li>}
        </ul>
        <div class="actions droite">
          <button type="button" onClick={fermer}>
            {t`Fermer`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Les cas évidents, d'un coup
// ---------------------------------------------------------------------------

function DialogueEvidents({ liste, fermer, fait }: { liste: { f: Fragment; v: Voisin }[]; fermer: () => void; fait: () => void }) {
  const s = session.value!;
  const [retires, setRetires] = useState<ReadonlySet<string>>(new Set());
  const gardes = liste.filter((x) => !retires.has(x.f.dossier.id));
  const appliquerTout = () => {
    fermer();
    if (
      rattacher(
        s,
        gardes.map(({ f, v }) => ({ f, cible: v.dossier.id })),
        t`Mettre ${pluriel(gardes.length, 'petit dossier', 'petits dossiers')} avec leur dossier`,
        t`${pluriel(gardes.length, 'petit dossier rangé', 'petits dossiers rangés')} avec leur dossier.`,
      )
    )
      fait();
  };
  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div class="dialogue evidents" role="dialog" aria-modal="true" aria-label={t`Petits dossiers au dossier évident`}>
        <h2>{t`Mettre ces petits dossiers avec leur dossier`}</h2>
        <p class="discret">{t`Chacun a été pris à moins d’une heure et de 10 km d’un autre dossier. Retirez ceux qui ne vont pas.`}</p>
        <ul class="liste-evidents">
          {liste.map(({ f, v }) => {
            const retire = retires.has(f.dossier.id);
            return (
              <li key={f.dossier.id} class={retire ? 'retire' : ''}>
                <span class="bande-evident">
                  {f.dossier.photos.slice(0, 3).map((p) => (
                    <Miniature key={p.id} f={p} taille={56} />
                  ))}
                </span>
                <span class="texte-evident">
                  <strong>{f.dossier.nom}</strong> → <strong>{v.dossier.nom}</strong>
                  <span class="discret">
                    {' '}
                    · {texteEcart(v)}
                    {texteDistance(v)}
                  </span>
                </span>
                <button type="button" class="doux" onClick={() => setRetires(new Set(retire ? [...retires].filter((x) => x !== f.dossier.id) : [...retires, f.dossier.id]))}>
                  {retire ? t`Remettre` : t`Retirer`}
                </button>
              </li>
            );
          })}
        </ul>
        <div class="actions droite">
          <button type="button" onClick={fermer}>
            {t`Fermer`}
          </button>
          <RaisonDesactivee id="raison-evidents" raison={!gardes.length && t`Tous sont retirés : remettez-en un.`} />
          <button type="button" class="principal" disabled={!gardes.length} aria-describedby={gardes.length ? undefined : 'raison-evidents'} onClick={appliquerTout}>
            {gardes.length === 1 ? t`Mettre ce petit dossier avec son dossier` : t`Mettre les ${nombre(gardes.length)} avec leur dossier`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Un petit dossier entre ses deux voisins
// ---------------------------------------------------------------------------

/**
 * Un voisin : son rôle en titre (16 px / 600, avec la flèche de son côté : « ← Pendant cette sortie »,
 * « Juste après → »), son nom, puis l'écart en gris ; ses photos du même moment et « Mettre avec ce dossier »,
 * dont l'effet est dans l'infobulle.
 */
function Cote({ f, v, ia, mettre, plein }: { f: Fragment; v: Voisin; ia?: DecisionIA3; mettre: () => void; plein: boolean }) {
  const n = f.dossier.photos.length;
  const propose = !!ia?.absorber && ia.cible === v.dossier.id;
  const parent = v.chemin.includes('/') ? v.chemin.slice(0, v.chemin.lastIndexOf('/')) : '';
  const semblable = niveauRessemblance(v.ressemblance);
  const cote = Math.round(reglages.value.tailleMiniatures * 0.6);
  const avant = v.cote === 'avant';
  return (
    <section class={`cote-petit${propose ? ' propose' : ''}`} aria-label={avant ? t`Juste avant` : t`Juste après`}>
      <h3 class="role-petit">
        {avant && <Icone nom="flecheGauche" taille={16} />}
        {v.pendant ? t`Pendant cette sortie` : avant ? t`Juste avant` : t`Juste après`}
        {!avant && <Icone nom="fleche" taille={16} />}
      </h3>
      <p class="nom-voisin">
        <strong>{v.dossier.nom}</strong>
        {parent && <span class="discret"> · {t`dans « ${parent} »`}</span>}
        {v.petit && <span class="badge petit">{t`petit aussi`}</span>}
      </p>
      <p class="ecart-petit discret" title={semblable ? t`Ressemblance des photos : ${semblable === 'tres' ? t`très semblables` : semblable === 'oui' ? t`semblables` : t`peu semblables`}` : undefined}>
        {texteEcart(v)}
        {texteDistance(v)}
      </p>
      <div class="bande-voisin">
        {v.proches.map((p) => (
          <figure key={p.id}>
            <Miniature f={p} taille={cote} />
            <figcaption>{heure(p)}</figcaption>
          </figure>
        ))}
      </div>
      {propose && (
        <p class="proposition-ia">
          <Icone nom="etincelle" taille={16} />
          {t`L’IA propose ce dossier`}
          {ia.confiance !== null ? t` (sûre à ${ia.confiance} sur 10)` : ''} : {ia.raison}
        </p>
      )}
      <button
        type="button"
        class={propose && plein ? 'principal' : ''}
        onClick={mettre}
        title={
          (n === 1
            ? t`Sa photo ira dans « ${v.dossier.nom} » (${pluriel(v.dossier.photos.length + n, 'photo')} ensuite). Le petit dossier disparaît.`
            : t`Ses ${nombre(n)} photos iront dans « ${v.dossier.nom} » (${pluriel(v.dossier.photos.length + n, 'photo')} ensuite). Le petit dossier disparaît.`) + ` (${avant ? t`Touche ←` : t`Touche →`})`
        }
      >
        {avant && <Icone nom="chevronGauche" taille={16} />}
        {t`Mettre avec ce dossier`}
        {!avant && <Icone nom="chevronDroite" taille={16} />}
      </button>
    </section>
  );
}

/** Petit dossier affiché : retenu le temps de la session, d'une visite de l'étape à l'autre. */
const choisi = signal<string | null>(null);

type Element = { cle: string; nom: string; du?: string; f?: Fragment; r?: FragmentRattache };

export function PagePetitsDossiers() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const liste = useMemo(() => tousFragments(s), [versionPlan.value, versionIA.value]);
  const [autre, setAutre] = useState<Fragment | null>(null);
  const [evidents, setEvidents] = useState(false);
  const decisions = s.aides.get<Record<string, DecisionIA3>>('IA3') ?? {};
  const gardes = new Set(s.aides.get<string[]>('fragments_gardes') ?? []);
  // Rattachés depuis cette étape : affichés avec leur décision tant que leurs photos sont dans la cible (Ctrl+Z les fait revenir).
  const rattaches = Object.values(rattachesDe(s)).filter((r) => !s.plan.dossiers.has(r.dossier.id) && r.fichiers.some((x) => s.plan.fichiers.get(x.id)?.dossier === r.cible));
  const elements: Element[] = [
    ...liste.map((f) => ({ cle: f.dossier.id, nom: f.dossier.nom, du: f.dossier.du, f })),
    ...rattaches.map((r) => ({ cle: r.dossier.id, nom: r.dossier.nom, du: r.du, r })),
  ].sort((a, b) => (a.du ?? '9').localeCompare(b.du ?? '9') || a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  const aDecider = (e: Element) => !!e.f && !gardes.has(e.f.dossier.id);
  const restants = elements.filter(aDecider);
  const courant = elements.find((e) => e.cle === choisi.value) ?? restants[0] ?? elements[0];
  const surs = restants.filter((e) => {
    const d = decisions[e.f!.dossier.id];
    return d?.absorber && d.cible && e.f!.voisins.some((v) => v.dossier.id === d.cible) && (d.confiance ?? 0) >= 8;
  });
  const listeEvidents = restants.flatMap((e) => {
    const v = cibleEvidente(e.f!, s.plan);
    return v ? [{ f: e.f!, v }] : [];
  });

  /** Après une décision : le petit dossier suivant à décider (dans l'ordre de la liste, puis depuis le début). */
  const suivant = () => {
    const i = elements.findIndex((e) => e.cle === courant?.cle);
    const prochain = [...elements.slice(i + 1), ...elements.slice(0, Math.max(0, i))].find(aDecider);
    if (prochain) choisi.value = prochain.cle;
  };
  const mettre = (f: Fragment, v: Voisin) => {
    if (rattacher(s, [{ f, cible: v.dossier.id }], t`Mettre « ${f.dossier.nom} » avec « ${v.dossier.nom} »`, t`Rangé avec « ${v.dossier.nom} ».`)) suivant();
  };
  // « Garder seul » et « Annuler ce choix » entrent dans l'historique comme les autres gestes : Ctrl+Z et
  // « Annuler » de l'en-tête les défont (la décision est gardée dans `.album/aides.json`, hors du plan).
  const garder = (id: string, oui: boolean) => {
    const nom = elements.find((e) => e.cle === id)?.nom ?? '';
    const ecrire = (garde: boolean) => {
      const avant = s.aides.get<string[]>('fragments_gardes') ?? [];
      void s.aides.set('fragments_gardes', garde ? [...new Set([...avant, id])] : avant.filter((x) => x !== id)).then(() => versionIA.value++);
    };
    ecrire(oui);
    appliquer(
      modificationHorsPlan(
        s.plan,
        oui ? t`Garder seul 1 petit dossier` : t`Remettre 1 petit dossier à décider`,
        (sens) => ecrire(sens === 'annuler' ? !oui : oui),
        oui ? t`Garder seul « ${nom} »` : t`Remettre « ${nom} » à décider`,
      ),
    );
    if (oui) {
      notifier('ok', t`Gardé seul.`, { libelle: t`Annuler`, faire: annuler });
      suivant();
    }
  };

  // Renommer le petit dossier ouvert (crayon, F2, menu « … ») : la saisie se fait dans sa tête.
  const [renommer, setRenommer] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; retour: HTMLElement | null } | null>(null);
  const nomIA = (f: Fragment) => (decisions[f.dossier.id] && !decisions[f.dossier.id].absorber ? decisions[f.dossier.id].nomPropose : undefined);
  const prendreNomIA = (f: Fragment) => {
    const nom = nomIA(f);
    if (!nom) return;
    try {
      appliquer(renommerDossier(s.plan, f.dossier.id, nom));
      notifier('ok', t`Renommé « ${nom} ».`, { libelle: t`Annuler`, faire: annuler });
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };
  /** Le menu « … » du petit dossier ouvert (C-4.14) : Renommer, Réunir avec un autre dossier, le nom proposé par l'IA. */
  const actionsPetit = (f: Fragment): ActionMenu[] => [
    { libelle: t`Renommer`, icone: 'crayon', touche: 'F2', faire: () => setRenommer(true) },
    { libelle: t`Réunir avec un autre dossier…`, icone: 'reunir', detail: t`Ses photos y vont ; ce petit dossier disparaît.`, faire: () => setAutre(f) },
    ...(nomIA(f) ? [{ libelle: t`Le renommer « ${nomIA(f)!} »`, icone: 'etincelle' as const, detail: t`Nom proposé par l’IA.`, faire: () => prendreNomIA(f) }] : []),
  ];
  const ouvrirMenu = (b: HTMLElement | null) => {
    const r = b?.getBoundingClientRect();
    setMenu({ x: r?.left ?? 320, y: (r?.bottom ?? 160) + 4, retour: b });
  };

  // Clavier : ← et → mettent avec le dossier d'avant ou d'après, G garde seul, J et K passent d'un petit dossier à
  // l'autre, F2 le renomme, Maj+F10 ouvre son menu « … ».
  const etat = useRef({ courant, elements, mettre, garder, gardes });
  etat.current = { courant, elements, mettre, garder, gardes };
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || visionneuse.value !== null || document.querySelector('[role="dialog"], [role="menu"]')) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const { courant: c, elements: l, mettre: m, garder: g, gardes: gs } = etat.current;
      const f = c?.f && !gs.has(c.f.dossier.id) ? c.f : undefined;
      const i = l.findIndex((x) => x.cle === c?.cle);
      const k = e.key.toLowerCase();
      if (k === 'j' && l[i + 1]) choisi.value = l[i + 1].cle;
      else if (k === 'k' && i > 0) choisi.value = l[i - 1].cle;
      else if (e.key === 'ArrowLeft' && f?.voisins.find((v) => v.cote === 'avant')) m(f, f.voisins.find((v) => v.cote === 'avant')!);
      else if (e.key === 'ArrowRight' && f?.voisins.find((v) => v.cote === 'apres')) m(f, f.voisins.find((v) => v.cote === 'apres')!);
      else if (k === 'g' && f) g(f.dossier.id, true);
      else if (e.key === 'F2' && c?.f) setRenommer(true);
      else if (((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') && c?.f) ouvrirMenu(document.querySelector<HTMLElement>('.tete-petit .plus-dossier'));
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);
  // Un autre petit dossier : la saisie du nom et le menu se ferment.
  useEffect(() => {
    setRenommer(false);
    setMenu(null);
  }, [courant?.cle]);

  const nbRattaches = rattaches.length;
  const nbGardes = liste.filter((f) => gardes.has(f.dossier.id)).length;
  const photosCentre = courant?.f?.dossier.photos ?? [];

  /** L'état de chaque petit dossier, écrit (plus de petits ronds qui ressemblaient à des cases à cocher). */
  const etatEcrit = (e: Element) =>
    e.r ? (
      <span class="etat-liste-petit fait">
        <Icone nom="coche" taille={14} />
        {t`mis avec « ${e.r.cibleNom} »`}
      </span>
    ) : e.f && gardes.has(e.f.dossier.id) ? (
      <span class="etat-liste-petit fait">{t`gardé seul`}</span>
    ) : (
      <span class="etat-liste-petit">{t`à décider`}</span>
    );

  return (
    <div class="page large avec-barre page-petits" style={styleLargeurPanneau()}>
      <LigneEtape titre={nomEtape(ETAPE.petits)} aide={{ cle: 'petits' }} taille={(v) => Math.round(v * 0.6)} />
      <AideEtape cle="petits">
        {t`Le tri a laissé quelques photos seules dans de petits dossiers (un arrêt en route, une photo sans position). Pour chacun, vous voyez les photos prises juste avant et juste après : mettez-le avec le bon dossier, ou gardez-le seul.`}
      </AideEtape>
      {/* La barre d'outils (D112 point 10) : l'aide IA et les cas évidents sur une ligne, pour que « Mettre avec ce
          dossier » se voie sans défiler à 1280×580. */}
      <div class="barre-outils-petits" role="toolbar" aria-label={t`Outils des petits dossiers`}>
        <AideIA fonction="IA3" />
        {listeEvidents.length > 0 && (
          <button type="button" onClick={() => setEvidents(true)} title={t`Pris à moins d’une heure et de 10 km d’un autre dossier`}>
            {listeEvidents.length === 1 ? t`1 petit dossier a un voisin évident : voir` : t`${nombre(listeEvidents.length)} petits dossiers ont un voisin évident : les voir`}
            <Icone nom="chevronDroite" taille={16} />
          </button>
        )}
        {surs.length > 0 && (
          <button
            type="button"
            onClick={() =>
              rattacher(
                s,
                surs.map((e) => ({ f: e.f!, cible: decisions[e.f!.dossier.id].cible! })),
                t`Mettre ${pluriel(surs.length, 'petit dossier', 'petits dossiers')} avec leur dossier`,
                t`${pluriel(surs.length, 'petit dossier rangé', 'petits dossiers rangés')} avec leur dossier.`,
              )
            }
          >
            {surs.length === 1 ? t`Accepter la proposition sûre de l’IA (8 sur 10 ou plus)` : t`Accepter les ${nombre(surs.length)} propositions sûres de l’IA (8 sur 10 ou plus)`}
          </button>
        )}
      </div>
      {elements.length === 0 ? (
        <p class="encart">{t`Aucun petit dossier (moins de ${SEUIL_PETIT_DOSSIER} photos) à examiner.`}</p>
      ) : (
        <div class="corps-petits">
          {/* La même liste et la même poignée qu'à Lieux et sorties (C-7.7) : le nom, puis la date et l'état. */}
          <nav class="liste-petits" aria-label={t`Petits dossiers`}>
            <div
              class="poignee-panneau"
              role="separator"
              aria-orientation="vertical"
              title={t`Tirer pour élargir le panneau (double-clic : largeur d’origine)`}
              onPointerDown={redimensionner}
              onDblClick={() => changerReglages({ ...reglages.value, largeurPanneau: REGLAGES_DEFAUT.largeurPanneau })}
            />
            <h2>
              {t`Dans l’ordre du temps`}
              <span class="discret">{t`${nombre(elements.length - restants.length)} sur ${nombre(elements.length)} décidés`}</span>
            </h2>
            {elements.map((e) => {
              const fait = !aDecider(e);
              const choisie = e.cle === courant?.cle;
              const n = e.f ? e.f.dossier.photos.length : (e.r?.fichiers.length ?? 0);
              return (
                <button
                  key={e.cle}
                  type="button"
                  class={`ligne-liste-petit ligne-dossier${choisie ? ' choisie actif' : ''}${fait ? ' fait' : ''}`}
                  aria-current={choisie ? 'true' : undefined}
                  title={e.nom}
                  onClick={() => (choisi.value = e.cle)}
                >
                  <span class="texte-dossier">
                    <span class="nom-dossier">{e.nom}</span>
                    <span class="infos-dossier">
                      <span class="dates-dossier">{e.du ? `${jourCourt(e.du)}${e.du.length > 10 ? ` · ${e.du.slice(11, 16)}` : ''}` : t`sans date`}</span>
                      {etatEcrit(e)}
                    </span>
                  </span>
                  <span class="nombre-dossier">{nombre(n)}</span>
                </button>
              );
            })}
          </nav>
          <section class="contenu-petits">
            {courant?.r ? (
              <div class="encart decide-petit">
                <p>
                  <strong>{courant.r.dossier.nom}</strong> — {t`Rangé avec « ${courant.r.cibleNom} ».`}
                </p>
                <button type="button" onClick={() => ressortir(s, courant.r!)}>
                  {t`Annuler ce choix`}
                </button>
              </div>
            ) : courant?.f ? (
              <>
                <header class="tete-petit">
                  {renommer ? (
                    <ChampRenommer
                      nom={courant.f.dossier.nom}
                      classe="renommage-tete"
                      terminer={(nom) => {
                        setRenommer(false);
                        renommerVers(courant.f!.dossier.id, nom);
                      }}
                    />
                  ) : (
                    <h2>{courant.f.dossier.nom}</h2>
                  )}
                  <span class="actions-dossier">
                    <button type="button" class="bouton-icone" aria-label={t`Renommer « ${courant.f.dossier.nom} » (F2)`} title={t`Renommer (F2)`} onClick={() => setRenommer(true)}>
                      <Icone nom="crayon" taille={16} />
                    </button>
                    <button
                      type="button"
                      class="bouton-icone plus-dossier"
                      aria-label={t`Actions sur « ${courant.f.dossier.nom} »`}
                      aria-haspopup="menu"
                      aria-expanded={!!menu}
                      title={t`Renommer, réunir avec un autre dossier… (Maj+F10)`}
                      onClick={(e) => (menu ? setMenu(null) : ouvrirMenu(e.currentTarget))}
                    >
                      <Icone nom="points" taille={16} />
                    </button>
                  </span>
                  <span class="discret">
                    {pluriel(courant.f.dossier.photos.length, 'photo')} · {moment(courant.f.dossier)}
                  </span>
                </header>
                {menu && <MenuActions titre={courant.f.dossier.nom} actions={actionsPetit(courant.f)} x={menu.x} y={menu.y} retour={menu.retour} fermer={() => setMenu(null)} />}
                {gardes.has(courant.f.dossier.id) && (
                  <div class="encart decide-petit">
                    <p>{t`Gardé seul.`}</p>
                    <button type="button" onClick={() => garder(courant.f!.dossier.id, false)}>
                      {t`Annuler ce choix`}
                    </button>
                  </div>
                )}
                <div class="trio-petit">
                  {courant.f.voisins.find((v) => v.cote === 'avant') ? (
                    <Cote plein={!listeEvidents.length} f={courant.f} v={courant.f.voisins.find((v) => v.cote === 'avant')!} ia={decisions[courant.f.dossier.id]} mettre={() => mettre(courant.f!, courant.f!.voisins.find((v) => v.cote === 'avant')!)} />
                  ) : (
                    <section class="cote-petit vide">
                      <h3 class="role-petit">
                        <Icone nom="flecheGauche" taille={16} />
                        {t`Juste avant`}
                      </h3>
                      <p class="discret">{t`Aucun dossier avant celui-ci.`}</p>
                    </section>
                  )}
                  <section class="centre-petit" aria-label={t`Ce petit dossier`}>
                    <h3 class="role-petit">{t`Ce petit dossier`}</h3>
                    <div class="photos-petit">
                      {photosCentre.map((p, i) => (
                        <figure key={p.id}>
                          <button type="button" class="photo-petit" onClick={() => (visionneuse.value = i)} title={t`Voir en grand`}>
                            <Miniature f={p} taille={reglages.value.tailleMiniatures} />
                          </button>
                          <figcaption>{heure(p)}</figcaption>
                        </figure>
                      ))}
                    </div>
                    {decisions[courant.f.dossier.id] && !decisions[courant.f.dossier.id].absorber && (
                      <p class="proposition-ia a-part">
                        <Icone nom="etincelle" taille={16} />
                        {t`L’IA propose de le garder seul`}
                        {decisions[courant.f.dossier.id].nomPropose ? t`, sous le nom « ${decisions[courant.f.dossier.id].nomPropose!} »` : ''} : {decisions[courant.f.dossier.id].raison}
                      </p>
                    )}
                    <p class="actions choix-centre">
                      <button type="button" onClick={() => garder(courant.f!.dossier.id, true)} disabled={gardes.has(courant.f.dossier.id)} data-raison={gardes.has(courant.f.dossier.id) ? 'libelle' : undefined} title={t`Touche G`}>
                        {gardes.has(courant.f.dossier.id) ? t`Déjà gardé seul` : t`Garder seul`}
                      </button>
                      {nomIA(courant.f) && (
                        <button type="button" onClick={() => prendreNomIA(courant.f!)}>
                          {t`Le renommer « ${nomIA(courant.f)!} »`}
                        </button>
                      )}
                    </p>
                  </section>
                  {courant.f.voisins.find((v) => v.cote === 'apres') ? (
                    <Cote plein={!listeEvidents.length} f={courant.f} v={courant.f.voisins.find((v) => v.cote === 'apres')!} ia={decisions[courant.f.dossier.id]} mettre={() => mettre(courant.f!, courant.f!.voisins.find((v) => v.cote === 'apres')!)} />
                  ) : (
                    <section class="cote-petit vide">
                      <h3 class="role-petit">
                        {t`Juste après`}
                        <Icone nom="fleche" taille={16} />
                      </h3>
                      <p class="discret">{t`Aucun dossier après celui-ci.`}</p>
                    </section>
                  )}
                </div>
                <p class="discret aide-petits">{t`Clavier : ← avec le dossier d’avant, → avec celui d’après, G garder seul, J et K petit dossier suivant ou précédent, F2 renommer, Ctrl+Z annuler.`}</p>
              </>
            ) : null}
            {restants.length === 0 && elements.length > 0 && <p class="encart">{t`Chaque petit dossier a sa décision : vous pouvez continuer.`}</p>}
          </section>
        </div>
      )}
      {/* Seulement ouverte : montée, la visionneuse prend Échap et les flèches à toute la page (renommer, « Autre dossier »). */}
      {photosCentre.length > 0 && visionneuse.value !== null && <Visionneuse elements={photosCentre} />}
      {autre && <ChoixRattachement f={autre} fermer={() => setAutre(null)} fait={suivant} />}
      {evidents && <DialogueEvidents liste={listeEvidents} fermer={() => setEvidents(false)} fait={suivant} />}
      <BarreValidation
        resume={`${
          restants.length === 0
            ? t`Aucun petit dossier à décider`
            : restants.length === 1
              ? t`1 petit dossier à décider : il reste tel quel`
              : t`${nombre(restants.length)} petits dossiers à décider : ils restent tels quels`
        } · ${pluriel(nbRattaches, 'rangé', 'rangés')} · ${pluriel(nbGardes, 'gardé seul', 'gardés seuls')}`}
        fini={restants.length === 0}
        revenir={() => revenirDe('petits')}
        valider={() => validerEtape('petits')}
      />
    </div>
  );
}
