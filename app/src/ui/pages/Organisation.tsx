// Étapes 5 (petits dossiers, IA3) et 7 (consolidation, IA6), script 05 :
// chaque proposition est montrée à côté des dossiers concernés, avec sa
// raison ; rien n'est fusionné sans « Rattacher » ou « Fusionner ».

import { estNomDeSortie } from '../../lib/sortie';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  clePaire,
  estimationConsolidation,
  groupesDeFreres,
  lireConsolidation,
  rapprochementsLocaux,
  requeteConsolidation,
  type Consolidation,
  type DossierInfo,
  type FusionProposee,
  type GroupeFreres,
} from '../../lib/consolidation';
import {
  candidatsRattachement,
  estimationFragments,
  fragments,
  lireFragment,
  niveauRessemblance,
  noterRattachement,
  petitsDuMemeJour,
  receveur,
  requeteFragment,
  ressortirFragment,
  SEUIL_PETIT_DOSSIER,
  type DecisionFragment,
  type Fragment,
  type FragmentRattache,
  type Voisin,
} from '../../lib/fragments';
import { estDossierMois } from '../../lib/tri';
import { creerDossier, enchainer, fusionnerDossiers, gardeSaPlace, renommerDossier, type FichierPlan, type Modification, type Plan } from '../../lib/plan';
import { simplifier } from '../organiser';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { enParallele } from '../../navigateur/workers';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { Miniature } from '../composants/GrillePhotos';
import { annuler, appliquer, contexteExecution, notifier, revenirDe, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { aTraduire, t, tc } from '../../lib/langue';
import { Icone } from '../composants/Icones';
import { jourCourt, nombre, periode as periodeJours, pluriel } from '../format';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs } from './AidesIA';

/** Au-delà de cette durée, un dossier n'est pas une sortie (une année, « Maison ») : pas de consolidation. */
export const DUREE_MAX_SORTIE_JOURS = 31;

/** Pourquoi un dossier n'entre pas dans la consolidation (petits dossiers et consolidation), ou `null` s'il y entre. */
export function raisonExclusion(plan: Plan, d: DossierInfo, exclus: ReadonlySet<string>): string | null {
  if (d.nom.startsWith('_') || estNomDeSortie('captures', d.nom)) return aTraduire('dossier technique');
  if (gardeSaPlace(plan, d.id)) return aTraduire('dossier gardé');
  if (exclus.has(d.id)) return aTraduire('exclu à la main');
  if (estDossierMois(d.nom)) return aTraduire('dossier de mois');
  if (d.du && d.au && (Date.parse(d.au.slice(0, 10)) - Date.parse(d.du.slice(0, 10))) / 86_400_000 > DUREE_MAX_SORTIE_JOURS) return aTraduire('plus d’un mois');
  return null;
}

/** Dossiers exclus à la main de la consolidation (`.album/aides.json`). */
function exclusDe(s: Session): ReadonlySet<string> {
  return new Set(s.aides.get<string[]>('consolidation_exclus') ?? []);
}

/** Répertoires à consolider, sans les dossiers techniques, gardés tels quels, de mois, de plus d'un mois ou exclus à la main. */
export function groupesUtiles(plan: Plan, exclus: ReadonlySet<string> = new Set()): GroupeFreres[] {
  return groupesDeFreres(plan)
    .map((g) => ({ ...g, dossiers: g.dossiers.filter((d) => raisonExclusion(plan, d, exclus) === null) }))
    .filter((g) => g.dossiers.length >= 2);
}

/** Inclure ou exclure un dossier de la consolidation. */
function basculerExclusion(s: Session, id: string) {
  const exclus = new Set(exclusDe(s));
  if (exclus.has(id)) exclus.delete(id);
  else exclus.add(id);
  void s.aides.set('consolidation_exclus', [...exclus]).then(() => versionIA.value++);
}

/** Dossiers laissés de côté par la consolidation, avec la raison ; on peut les inclure ou en exclure d'autres. */
function DossiersExclus() {
  const s = session.value!;
  const exclus = exclusDe(s);
  const liste = groupesDeFreres(s.plan)
    .flatMap((g) => g.dossiers)
    .map((d) => ({ d, raison: raisonExclusion(s.plan, d, exclus) }))
    .filter((x) => x.raison && x.raison !== 'dossier technique');
  if (!liste.length) return null;
  return (
    <details class="tri-auto">
      <summary>
        <strong>{pluriel(liste.length, 'dossier non pris en compte', 'dossiers non pris en compte')}</strong>
        {t` (de mois, de plus d’un mois, gardés tels quels ou exclus à la main)`}
      </summary>
      <ul class="liste-courte">
        {liste.map(({ d, raison }) => (
          <li key={d.id}>
            {d.nom} — <span class="discret">{raison && t(raison)}</span>{' '}
            {raison === 'exclu à la main' && (
              <button type="button" class="lien" onClick={() => basculerExclusion(s, d.id)}>
                {t`inclure à nouveau`}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

const phash = (s: Session) => (f: Parameters<Session['analyses']['get']>[0]) => s.analyses.get(f)?.phash;

function tousFragments(s: Session): Fragment[] {
  return groupesUtiles(s.plan, exclusDe(s)).flatMap((g) => fragments(g, phash(s)));
}

type DecisionIA3 = DecisionFragment & { cle: string };
type ResultatIA6 = Consolidation & { cle: string };

enregistrerAide({
  id: 'IA3',
  nom: aTraduire('Proposer un rattachement avec l’IA'),
  etape: ETAPE.petits,
  description: aTraduire('Pour chaque petit dossier, l’IA compare ses photos à celles des sorties voisines dans le temps et propose de le rattacher ou de le garder à part.'),
  envoi: aTraduire('planches de miniatures du petit dossier et de ses 3 voisins les plus semblables'),
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

enregistrerAide({
  id: 'IA6',
  nom: aTraduire('Proposer des fusions avec l’IA'),
  etape: ETAPE.consolidation,
  description: aTraduire('Pour chaque répertoire, l’IA lit la liste des dossiers (nom, nombre de photos, période) et propose de fusionner ceux qui couvrent la même activité.'),
  envoi: aTraduire('liste des dossiers, planches des petits dossiers et des dossiers non identifiés'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const groupes = groupesUtiles(s.plan, exclusDe(s));
    if (!groupes.length) return null;
    const modele = modeleDe('standard');
    const aFaire = groupes.filter((g) => !s.ia.enCache(requeteConsolidation(g, modele, cleAnalyse).cle));
    const e = estimationConsolidation(aFaire, modele);
    return { usd: e.usd, appels: e.appels, detail: pluriel(aFaire.length, 'répertoire') };
  },
  lancer: async (s, l) => {
    const groupes = groupesUtiles(s.plan, exclusDe(s));
    const ctx = contexteExecution(s);
    const ajouts: Record<string, ResultatIA6> = {};
    const bilan: BilanEchecs = { echecs: 0 };
    let faits = 0;
    let n = 0;
    try {
      for (const g of groupes) {
        if (l.arreter()) break;
        const r = requeteConsolidation(g, l.modele, cleAnalyse);
        const v = await essai(() => executerRequete(ctx, r, l.modele), bilan);
        if (v !== undefined) {
          const c = lireConsolidation(v, g);
          ajouts[g.parent] = { ...c, cle: r.cle };
          n += c.fusions.length + c.renommages.length;
        }
        l.progres(++faits, groupes.length);
      }
    } finally {
      await s.aides.fusionner('IA6', ajouts);
    }
    return t`${pluriel(n, 'proposition')} dans ${pluriel(groupes.length, 'répertoire')}.${texteEchecs(bilan)}`;
  },
});

function Vignettes({ d, n = 6, taille = 84 }: { d: Pick<DossierInfo, 'photos'>; n?: number; taille?: number }) {
  return (
    <div class="bande-miniatures">
      {d.photos.slice(0, n).map((f) => (
        <Miniature key={f.id} f={f} taille={taille} />
      ))}
    </div>
  );
}

function periode(d: Pick<DossierInfo, 'du' | 'au'>): string {
  if (!d.du) return t`date inconnue`;
  return d.du.slice(0, 10) === d.au?.slice(0, 10) ? jourCourt(d.du) : `${jourCourt(d.du)} – ${jourCourt(d.au)}`;
}

function essayer(m: () => Modification | null, ok: string) {
  try {
    appliquer(m());
    notifier('ok', ok, { libelle: t`Annuler`, faire: annuler });
  } catch (err) {
    notifier('erreur', texteErreur(err));
  }
}

// ---------------------------------------------------------------------------
// Étape « Petits dossiers »
// ---------------------------------------------------------------------------

/** Petits dossiers rattachés depuis cette étape, par identifiant (`.album/aides.json`) : affichés avec leur décision, et ressortables. */
function rattachesDe(s: Session): Record<string, FragmentRattache> {
  return s.aides.get<Record<string, FragmentRattache>>('fragments_rattaches') ?? {};
}

/**
 * Rattache des petits dossiers (une seule opération, annulable par Ctrl+Z)
 * et note chacun : il reste affiché avec sa décision, et « Annuler » le ressort.
 */
function rattacher(s: Session, paires: { f: Fragment; cible: string }[], libelle: string, ok: string) {
  const notes = paires.map(({ f, cible }) => noterRattachement(s.plan, f.dossier, cible, f.voisins.length > 0)).filter((r): r is FragmentRattache => !!r);
  try {
    appliquer(enchainer(s.plan, libelle, paires.map(({ f, cible }) => () => fusionnerDossiers(s.plan, f.dossier.id, cible))));
  } catch (err) {
    notifier('erreur', texteErreur(err));
    return;
  }
  void s.aides.fusionner('fragments_rattaches', Object.fromEntries(notes.map((r) => [r.dossier.id, r]))).then(() => versionIA.value++);
  notifier('ok', ok, { libelle: t`Annuler`, faire: annuler });
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

/** Choix du dossier où rattacher un petit dossier : recherche par nom, les plus proches dans le temps d'abord. */
function ChoixRattachement({ f, fermer }: { f: Fragment; fermer: () => void }) {
  const s = session.value!;
  const [requete, setRequete] = useState('');
  const [index, setIndex] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => champ.current?.focus(), []);
  const candidats = useMemo(() => candidatsRattachement(s.plan, f.dossier), [f.dossier.id, versionPlan.value]);
  const q = simplifier(requete.trim());
  const proposes = (q ? candidats.filter((c) => simplifier(c.chemin).includes(q)) : candidats).slice(0, 200);
  const choix = Math.min(index, proposes.length - 1);
  const valider = (c = proposes[choix]) => {
    if (!c) return;
    fermer();
    rattacher(s, [{ f, cible: c.id }], t`Rattacher « ${f.dossier.nom} » à « ${c.nom} »`, t`« ${f.dossier.nom} » rattaché à « ${c.nom} ».`);
  };
  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div class="dialogue deplacer" role="dialog" aria-modal="true" aria-label={t`Rattacher « ${f.dossier.nom} » à…`}>
        <h2>{t`Rattacher « ${f.dossier.nom} » à…`}</h2>
        <p class="discret">{t`Ses photos rejoignent le dossier choisi, puis « ${f.dossier.nom} » disparaît. Les dossiers les plus proches dans le temps sont en tête.`}</p>
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
        <ul class="choix-dossiers">
          {proposes.map((c, i) => (
            <li key={c.id} class={i === choix ? 'actif' : ''} onMouseEnter={() => setIndex(i)} onClick={() => valider(c)}>
              {c.chemin}{' '}
              <span class="discret">
                {c.du ? periodeJours(c.du, c.au) : t`vide`}
                {c.jours === 0 ? t` · même période` : c.jours !== null ? t` · à ${pluriel(c.jours, 'jour')}` : ''}
              </span>
            </li>
          ))}
          {!proposes.length && <li class="discret">{t`Aucun dossier ne correspond.`}</li>}
        </ul>
        <div class="actions droite">
          <button type="button" onClick={fermer}>
            {tc('dialogue', 'Annuler')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Un petit dossier dont le sort est décidé : il reste visible, avec sa décision et de quoi l'annuler. */
function LigneDecidee({ photos, nom, du, au, decision, defaire }: { photos: FichierPlan[]; nom: string; du?: string; au?: string; decision: string; defaire: () => void }) {
  return (
    <div class="petit-decide">
      <Vignettes d={{ photos }} n={3} taille={56} />
      <span class="nom-petit">
        <strong>{nom}</strong>{' '}
        <span class="discret">
          {pluriel(photos.length, 'photo')} · {periode({ du, au })}
        </span>
      </span>
      <span class="decision-petit">
        <Icone nom="coche" taille={16} /> {decision}
      </span>
      <span class="espace" />
      <button type="button" class="doux" onClick={defaire}>
        {t`Annuler`}
      </button>
    </div>
  );
}

/** Écart dans le temps avec une sortie voisine. */
function texteEcart(v: Voisin): string {
  if (v.ecart === 0) return t`pendant cette sortie`;
  return v.ecart < 60 ? t`à ${v.ecart} min` : t`à ${nombre(v.ecart / 60, 1)} h`;
}

/** Ressemblance des photos en mots (la distance de hachage, 0 = identiques, reste dans la bulle). */
function texteRessemblance(v: Voisin): string | null {
  const n = niveauRessemblance(v.ressemblance);
  return n === 'tres' ? t`photos très semblables` : n === 'oui' ? t`photos semblables` : n === 'peu' ? t`photos peu semblables` : null;
}

type ElementPetit = { cle: string; nom: string; du?: string; f?: Fragment; r?: FragmentRattache };

export function PagePetitsDossiers() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const liste = useMemo(() => tousFragments(s), [versionPlan.value, versionIA.value]);
  const [aRattacher, setARattacher] = useState<Fragment | null>(null);
  const decisions = s.aides.get<Record<string, DecisionIA3>>('IA3') ?? {};
  const gardes = new Set(s.aides.get<string[]>('fragments_gardes') ?? []);
  // Rattachés depuis cette étape : affichés avec leur décision tant que leurs photos sont dans la cible (Ctrl+Z les fait revenir).
  const rattaches = Object.values(rattachesDe(s)).filter((r) => !s.plan.dossiers.has(r.dossier.id) && r.fichiers.some((x) => s.plan.fichiers.get(x.id)?.dossier === r.cible));
  const aExaminer = liste.filter((f) => !gardes.has(f.dossier.id));
  const surs = aExaminer.filter((f) => {
    const d = decisions[f.dossier.id];
    return d?.absorber && d.cible && s.plan.dossiers.has(d.cible) && (d.confiance ?? 0) >= 8;
  });
  // Une carte avec les sorties voisines, ou une ligne quand il n'y en a aucune à moins de 12 h.
  const avecVoisins = (f: Fragment) => f.voisins.length > 0 || !!decisions[f.dossier.id];
  const elements = (voisins: boolean): ElementPetit[] =>
    [
      ...liste.filter((f) => avecVoisins(f) === voisins).map((f) => ({ cle: f.dossier.id, nom: f.dossier.nom, du: f.dossier.du, f })),
      ...rattaches.filter((r) => r.avecVoisins === voisins).map((r) => ({ cle: r.dossier.id, nom: r.dossier.nom, du: r.du, r })),
    ].sort((a, b) => (a.du ?? '9').localeCompare(b.du ?? '9') || a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  const cartes = elements(true);
  const lignes = elements(false);
  // Petits dossiers d'une même journée, sans sortie voisine : on propose de les réunir.
  const memeJour = new Map(petitsDuMemeJour(aExaminer.filter((f) => !avecVoisins(f))).flatMap((g) => g.map((f) => [f.dossier.id, g] as const)));

  const garder = (id: string, oui: boolean) => void s.aides.set('fragments_gardes', oui ? [...gardes, id] : [...gardes].filter((x) => x !== id)).then(() => versionIA.value++);
  const photosDe = (r: FragmentRattache) =>
    r.fichiers.map((x) => s.plan.fichiers.get(x.id)).filter((f): f is FichierPlan => !!f && f.categorie === 'photo' && f.statut === 'archive');
  const reunir = (g: Fragment[]) => {
    const dest = receveur(g);
    const autres = g.filter((f) => f !== dest);
    rattacher(
      s,
      autres.map((f) => ({ f, cible: dest.dossier.id })),
      t`Réunir les petits dossiers du ${jourCourt(dest.dossier.du)}`,
      t`${pluriel(autres.length, 'petit dossier réuni', 'petits dossiers réunis')} dans « ${dest.dossier.nom} ».`,
    );
  };

  /** Ligne d'un petit dossier déjà décidé (gardé à part ou rattaché), ou `null`. */
  const decide = (e: ElementPetit) => {
    if (e.r) {
      const r = e.r;
      return <LigneDecidee photos={photosDe(r)} nom={r.dossier.nom} du={r.du} au={r.au} decision={t`rattaché à « ${r.cibleNom} »`} defaire={() => ressortir(s, r)} />;
    }
    if (e.f && gardes.has(e.f.dossier.id)) {
      const f = e.f;
      return <LigneDecidee photos={f.dossier.photos} nom={f.dossier.nom} du={f.dossier.du} au={f.dossier.au} decision={t`gardé à part`} defaire={() => garder(f.dossier.id, false)} />;
    }
    return null;
  };

  return (
    <div class="page large avec-barre page-fragments">
      <TeteEtape numero={ETAPE.petits} titre={nomEtape(ETAPE.petits)} cle="petits">
        {t`Le tri par lieux isole parfois quelques photos dans un petit dossier (un arrêt en route, une photo sans GPS). Chacun est montré à côté des sorties voisines dans le temps, les plus ressemblantes d’abord : rattachez-le, ou gardez-le à part.`}
      </TeteEtape>
      <AideIA fonction="IA3" />
      {surs.length > 0 && (
        <p>
          <button
            type="button"
            class="principal"
            onClick={() =>
              rattacher(
                s,
                surs.map((f) => ({ f, cible: decisions[f.dossier.id].cible! })),
                t`Rattacher ${pluriel(surs.length, 'petit dossier', 'petits dossiers')}`,
                `${pluriel(surs.length, 'petit dossier rattaché', 'petits dossiers rattachés')}.`,
              )
            }
          >
            {surs.length > 1
              ? t`Tout accepter : rattacher les ${nombre(surs.length)} propositions sûres (confiance 8 ou plus)`
              : t`Accepter la proposition sûre (confiance 8 ou plus)`}
          </button>
        </p>
      )}
      {liste.length === 0 && rattaches.length === 0 && <p class="encart">{t`Aucun petit dossier (moins de ${SEUIL_PETIT_DOSSIER} photos) à rattacher.`}</p>}
      {aExaminer.length === 0 && (liste.length > 0 || rattaches.length > 0) && <p class="encart">{t`Chaque petit dossier a sa décision : vous pouvez continuer.`}</p>}
      {cartes.length > 0 && <h2 class="titre-petits">{t`Près d’autres sorties`}</h2>}
      <div class="groupes">
        {cartes.map((e) => {
          const ligne = decide(e);
          if (ligne || !e.f) return <div key={e.cle}>{ligne}</div>;
          const f = e.f;
          const d = decisions[f.dossier.id];
          const cible = d?.cible ? f.voisins.find((v) => v.dossier.id === d.cible)?.dossier : undefined;
          return (
            <article key={e.cle} class="carte-groupe">
              <header>
                <strong>{f.dossier.nom}</strong>
                <span class="discret">
                  {pluriel(f.dossier.photos.length, 'photo')} · {periode(f.dossier)}
                </span>
              </header>
              <Vignettes d={f.dossier} />
              {d && (
                <p class={`proposition-ia${d.absorber ? '' : ' a-part'}`}>
                  <strong>{t`IA :`}</strong> {d.absorber && cible ? t`rattacher à « ${cible.nom} »` : d.nomPropose ? t`garder à part, sous le nom « ${d.nomPropose} »` : t`garder à part`}
                  {d.confiance !== null ? t` (confiance ${d.confiance}/10)` : ''} — {d.raison}
                </p>
              )}
              <div class="voisins">
                {f.voisins.slice(0, 3).map((v) => {
                  const semblable = texteRessemblance(v);
                  return (
                    <div key={v.dossier.id} class={`voisin${cible?.id === v.dossier.id ? ' propose' : ''}`}>
                      <div>
                        <strong>{v.dossier.nom}</strong>{' '}
                        <span class="discret">
                          {pluriel(v.dossier.photos.length, 'photo')} · {periode(v.dossier)} · {texteEcart(v)}
                          {semblable && <span title={t`Différence entre les photos : ${v.ressemblance} (0 = identiques)`}> · {semblable}</span>}
                        </span>
                      </div>
                      <Vignettes d={v.dossier} n={4} />
                      <button
                        type="button"
                        onClick={() => rattacher(s, [{ f, cible: v.dossier.id }], t`Rattacher « ${f.dossier.nom} » à « ${v.dossier.nom} »`, t`« ${f.dossier.nom} » rattaché à « ${v.dossier.nom} ».`)}
                      >
                        {t`Rattacher ici`}
                      </button>
                    </div>
                  );
                })}
                {f.voisins.length === 0 && <p class="discret">{t`Aucune sortie voisine à moins de 12 h.`}</p>}
              </div>
              <footer>
                {d?.nomPropose && !d.absorber && (
                  <button type="button" onClick={() => essayer(() => renommerDossier(s.plan, f.dossier.id, d.nomPropose!), t`Renommé « ${d.nomPropose} ».`)}>
                    {t`Renommer « ${d.nomPropose} »`}
                  </button>
                )}
                <span class="espace" />
                <button type="button" onClick={() => setARattacher(f)} title={t`Choisir n’importe quel dossier`}>
                  {t`Rattacher à…`}
                </button>
                <button type="button" onClick={() => garder(f.dossier.id, true)}>
                  {t`Garder à part`}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      {lignes.length > 0 && (
        <section class="petits-seuls">
          <h2 class="titre-petits">{t`Sans sortie voisine à moins de 12 h`}</h2>
          <p class="discret">{t`Rattachez-les au dossier de votre choix (les plus proches dans le temps sont proposés d’abord), réunissez ceux d’une même journée, ou gardez-les à part.`}</p>
          <ul class="liste-seuls">
            {lignes.map((e) => {
              const ligne = decide(e);
              if (ligne || !e.f) return <li key={e.cle}>{ligne}</li>;
              const f = e.f;
              const groupe = memeJour.get(f.dossier.id);
              // Le premier d'une même journée est précédé de la proposition de les réunir.
              return [
                groupe?.[0] === f && (
                  <li key={`jour:${e.cle}`} class="groupe-jour">
                    <span>{t`Le ${jourCourt(f.dossier.du)} : ${pluriel(groupe.length, 'petit dossier', 'petits dossiers')} le même jour`}</span>
                    <button type="button" onClick={() => reunir(groupe)}>
                      {t`Les réunir dans « ${receveur(groupe).dossier.nom} »`}
                    </button>
                  </li>
                ),
                <li key={e.cle} class={`ligne-petit${groupe ? ' dans-groupe' : ''}`}>
                  <Vignettes d={f.dossier} n={3} taille={56} />
                  <span class="nom-petit">
                    <strong>{f.dossier.nom}</strong>{' '}
                    <span class="discret">
                      {pluriel(f.dossier.photos.length, 'photo')} · {periode(f.dossier)}
                    </span>
                  </span>
                  <span class="espace" />
                  <button type="button" onClick={() => setARattacher(f)}>
                    {t`Rattacher à…`}
                  </button>
                  <button type="button" onClick={() => garder(f.dossier.id, true)}>
                    {t`Garder à part`}
                  </button>
                </li>,
              ];
            })}
          </ul>
        </section>
      )}
      {aRattacher && <ChoixRattachement f={aRattacher} fermer={() => setARattacher(null)} />}
      <BarreValidation
        resume={t`${pluriel(aExaminer.length, 'petit dossier', 'petits dossiers')} à examiner`}
        revenir={() => revenirDe('petits')}
        valider={() => validerEtape('petits')}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape « Consolidation »
// ---------------------------------------------------------------------------

/** Applique une fusion proposée : vers le dossier cible existant, ou un nouveau dossier au nom proposé. */
function fusion(plan: Plan, parent: string, f: FusionProposee): Modification | null {
  const libelle = t`Fusionner dans « ${f.cible} »`;
  if (f.cibleId) {
    const cible = f.cibleId;
    return enchainer(plan, libelle, f.sources.map((src) => () => fusionnerDossiers(plan, src, cible)));
  }
  let cible = '';
  return enchainer(plan, libelle, [
    () => {
      const r = creerDossier(plan, f.cible, parent);
      cible = r.id;
      return r.modification;
    },
    ...f.sources.map((src) => () => fusionnerDossiers(plan, src, cible)),
  ]);
}

/** Paires « Même activité ? » que l'utilisateur a écartées : plus jamais proposées (`.album/aides.json`). */
function pairesIgnorees(s: Session): Set<string> {
  return new Set(s.aides.get<string[]>('consolidation_paires_ignorees') ?? []);
}

function changerPairesIgnorees(s: Session, cles: Set<string>) {
  void s.aides.set('consolidation_paires_ignorees', [...cles]).then(() => versionIA.value++);
}

function ignorerPaire(s: Session, a: DossierInfo, b: DossierInfo) {
  const cle = clePaire(a.id, b.id);
  changerPairesIgnorees(s, new Set([...pairesIgnorees(s), cle]));
  notifier('ok', t`« ${a.nom} » et « ${b.nom} » ne seront plus proposés ensemble.`, {
    libelle: t`Annuler`,
    faire: () => changerPairesIgnorees(s, new Set([...pairesIgnorees(s)].filter((x) => x !== cle))),
  });
}

export function PageConsolidation() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const groupes = useMemo(() => groupesUtiles(s.plan, exclusDe(s)), [versionPlan.value, versionIA.value]);
  const ignorees = pairesIgnorees(s);
  const resultats = s.aides.get<Record<string, ResultatIA6>>('IA6') ?? {};
  const nomDe = (id: string) => s.plan.dossiers.get(id)?.nom ?? '';
  const total = groupes.reduce((a, g) => {
    const r = resultats[g.parent];
    return a + (r ? r.fusions.filter((f) => f.sources.every((x) => s.plan.dossiers.has(x))).length + r.renommages.filter((x) => s.plan.dossiers.has(x.dossier) && nomDe(x.dossier) !== x.nom).length : 0);
  }, 0);

  return (
    <div class="page large avec-barre page-consolidation">
      <TeteEtape numero={ETAPE.consolidation} titre={nomEtape(ETAPE.consolidation)} cle="consolidation">
        {t`Plusieurs dossiers couvrent parfois la même activité (une journée à la plage coupée en deux par le tri). Les propositions sont montrées côte à côte ; vous pouvez aussi fusionner à la main en glissant un dossier sur un autre à l’étape ${ETAPE.lieux}.`}
      </TeteEtape>
      <AideIA fonction="IA6" />
      <DossiersExclus />
      {ignorees.size > 0 && (
        <p class="discret">
          {t`${pluriel(ignorees.size, 'paire ignorée', 'paires ignorées')} : elles ne sont plus proposées.`}{' '}
          <button type="button" class="lien" onClick={() => changerPairesIgnorees(s, new Set())}>
            {t`les proposer à nouveau`}
          </button>
        </p>
      )}
      {groupes.length === 0 &&<p class="encart">{t`Aucun répertoire ne contient plusieurs dossiers à comparer.`}</p>}
      {groupes.map((g) => {
        const r = resultats[g.parent];
        const fusions = (r?.fusions ?? []).filter((f) => f.sources.every((x) => s.plan.dossiers.has(x)) && (!f.cibleId || s.plan.dossiers.has(f.cibleId)));
        const renommages = (r?.renommages ?? []).filter((x) => s.plan.dossiers.has(x.dossier) && nomDe(x.dossier) !== x.nom);
        const locaux = rapprochementsLocaux(g, ignorees);
        const parId = new Map(g.dossiers.map((d) => [d.id, d]));
        if (!fusions.length && !renommages.length && !locaux.length) return null;
        return (
          <section key={g.parent} class="groupe-consolidation">
            <h2>{g.parent === 'racine' ? t`Photos (racine)` : nomDe(g.parent)}</h2>
            {fusions.map((f) => (
              <article key={`${f.cible}${f.sources.join()}`} class="carte-groupe">
                <header>
                  <span class="source ia">{t`IA`}</span> {t`Fusionner ${f.sources.map((x) => t`« ${nomDe(x)} »`).join(', ')} dans « ${f.cible} »`}
                  {!f.cibleId && t` (nouveau dossier)`}
                </header>
                <p class="discret">{f.raison}</p>
                <div class="cote-a-cote">
                  {[...(f.cibleId ? [f.cibleId] : []), ...f.sources].map((id) => parId.get(id)).filter((d): d is DossierInfo => !!d).map((d) => (
                    <div key={d.id}>
                      <strong>{d.nom}</strong> <span class="discret">{pluriel(d.photos.length, 'photo')} · {periode(d)}</span>{' '}
                      <button type="button" class="lien" onClick={() => basculerExclusion(s, d.id)} title={t`Ne plus proposer ce dossier à la consolidation`}>
                        {t`exclure`}
                      </button>
                      <Vignettes d={d} n={4} />
                    </div>
                  ))}
                </div>
                <footer>
                  <span class="espace" />
                  <button type="button" class="principal" onClick={() => essayer(() => fusion(s.plan, g.parent, f), t`Fusionné dans « ${f.cible} ».`)}>
                    {t`Fusionner`}
                  </button>
                </footer>
              </article>
            ))}
            {renommages.map((x) => (
              <p key={x.dossier}>
                <span class="source ia">{t`IA`}</span> {t`Renommer « ${nomDe(x.dossier)} » en « ${x.nom} »`} — <span class="discret">{x.raison}</span>{' '}
                <button type="button" onClick={() => essayer(() => renommerDossier(s.plan, x.dossier, x.nom), t`Renommé « ${x.nom} ».`)}>
                  {t`Renommer`}
                </button>
              </p>
            ))}
            {locaux.map((p) => {
              const a = parId.get(p.a);
              const b = parId.get(p.b);
              if (!a || !b) return null;
              return (
                <article key={`${p.a}|${p.b}`} class="carte-groupe locale">
                  <header>
                    <span class="source">{t`Même activité ?`}</span>{' '}
                    {p.raisons.length === 2 ? t`noms proches et périodes qui se chevauchent` : p.raisons.includes('noms_proches') ? t`noms proches` : t`périodes qui se chevauchent`}
                  </header>
                  <div class="cote-a-cote">
                    {[a, b].map((d) => (
                      <div key={d.id}>
                        <strong>{d.nom}</strong> <span class="discret">{pluriel(d.photos.length, 'photo')} · {periode(d)}</span>{' '}
                        <button type="button" class="lien" onClick={() => basculerExclusion(s, d.id)} title={t`Ne plus proposer ce dossier à la consolidation`}>
                          {t`exclure`}
                        </button>
                        <Vignettes d={d} n={4} />
                      </div>
                    ))}
                  </div>
                  <footer>
                    <button type="button" class="doux" onClick={() => ignorerPaire(s, a, b)} title={t`Ce ne sont pas les mêmes sorties : ne plus proposer ces deux dossiers ensemble`}>
                      {t`Ignorer cette paire`}
                    </button>
                    <span class="espace" />
                    <button type="button" onClick={() => essayer(() => fusionnerDossiers(s.plan, b.id, a.id), t`« ${b.nom} » fusionné dans « ${a.nom} ».`)}>
                      {t`Fusionner dans « ${a.nom} »`}
                    </button>
                    <button type="button" onClick={() => essayer(() => fusionnerDossiers(s.plan, a.id, b.id), t`« ${a.nom} » fusionné dans « ${b.nom} ».`)}>
                      {t`Fusionner dans « ${b.nom} »`}
                    </button>
                  </footer>
                </article>
              );
            })}
          </section>
        );
      })}
      <BarreValidation
        resume={t`${pluriel(total, 'proposition IA', 'propositions IA')} à examiner`}
        revenir={() => revenirDe('consolidation')}
        valider={() => validerEtape('consolidation')}
      />
    </div>
  );
}
