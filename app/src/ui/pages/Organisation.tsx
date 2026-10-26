// Étape « Consolidation » (IA6, script 05) : chaque proposition est montrée à
// côté des dossiers concernés, avec sa raison ; rien n'est fusionné sans
// « Fusionner ». Les exclusions servent aussi à l'étape « Petits dossiers »
// (PetitsDossiers.tsx).

import { estNomDeSortie } from '../../lib/sortie';
import { useMemo } from 'preact/hooks';
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
import { estDossierMois } from '../../lib/tri';
import { creerDossier, enchainer, fusionnerDossiers, gardeSaPlace, renommerDossier, type Modification, type Plan } from '../../lib/plan';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { Miniature } from '../composants/GrillePhotos';
import { annuler, appliquer, contexteExecution, notifier, revenirDe, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { aTraduire, t } from '../../lib/langue';
import { jourCourt, pluriel } from '../format';
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
export function exclusDe(s: Session): ReadonlySet<string> {
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

type ResultatIA6 = Consolidation & { cle: string };

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
