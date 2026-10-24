// Étapes 5 (petits dossiers, IA3) et 7 (consolidation, IA6), script 05 :
// chaque proposition est montrée à côté des dossiers concernés, avec sa
// raison ; rien n'est fusionné sans « Rattacher » ou « Fusionner ».

import { estNomDeSortie } from '../../lib/sortie';
import { useMemo } from 'preact/hooks';
import { estimationConsolidation, groupesDeFreres, lireConsolidation, rapprochementsLocaux, requeteConsolidation, type Consolidation, type DossierInfo, type FusionProposee, type GroupeFreres } from '../../lib/consolidation';
import { estimationFragments, fragments, lireFragment, requeteFragment, type DecisionFragment, type Fragment } from '../../lib/fragments';
import { estDossierMois } from '../../lib/tri';
import { creerDossier, enchainer, fusionnerDossiers, gardeSaPlace, renommerDossier, type Modification, type Plan } from '../../lib/plan';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { enParallele } from '../../navigateur/workers';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { Miniature } from '../composants/GrillePhotos';
import { annuler, appliquer, contexteExecution, notifier, revenirDe, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { aTraduire, t } from '../../lib/langue';
import { jourCourt, nombre, pluriel } from '../format';
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

function Vignettes({ d, n = 6 }: { d: DossierInfo; n?: number }) {
  return (
    <div class="bande-miniatures">
      {d.photos.slice(0, n).map((f) => (
        <Miniature key={f.id} f={f} taille={84} />
      ))}
    </div>
  );
}

function periode(d: DossierInfo): string {
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

export function PagePetitsDossiers() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const liste = useMemo(() => tousFragments(s), [versionPlan.value, versionIA.value]);
  const decisions = s.aides.get<Record<string, DecisionIA3>>('IA3') ?? {};
  const gardes = new Set(s.aides.get<string[]>('fragments_gardes') ?? []);
  // Sans aucune sortie voisine (et sans proposition de l'IA), il n'y a rien à choisir : le dossier reste à part, sans carte.
  const seuls = liste.filter((f) => !gardes.has(f.dossier.id) && f.voisins.length === 0 && !decisions[f.dossier.id]);
  const visibles = liste.filter((f) => !gardes.has(f.dossier.id) && !seuls.includes(f));
  const surs = visibles.filter(
    (f) => decisions[f.dossier.id]?.absorber && decisions[f.dossier.id].cible && s.plan.dossiers.has(decisions[f.dossier.id].cible!) && (decisions[f.dossier.id].confiance ?? 0) >= 8,
  );

  const garder = (id: string) => void s.aides.set('fragments_gardes', [...gardes, id]).then(() => (versionIA.value++));

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
              essayer(
                () => enchainer(s.plan, t`Rattacher ${surs.length} petits dossiers`, surs.map((f) => () => fusionnerDossiers(s.plan, f.dossier.id, decisions[f.dossier.id].cible!))),
                `${pluriel(surs.length, 'petit dossier rattaché', 'petits dossiers rattachés')}.`,
              )
            }
          >
            {t`Tout accepter : rattacher les ${nombre(surs.length)} propositions sûres (confiance 8 ou plus)`}
          </button>
        </p>
      )}
      {visibles.length === 0 && <p class="encart">{t`Aucun petit dossier (moins de 5 photos) à rattacher.`}</p>}
      {seuls.length > 0 && (
        <details class="avances petits-seuls">
          <summary>
            {seuls.length > 1
              ? t`${pluriel(seuls.length, 'petit dossier sans sortie voisine', 'petits dossiers sans sortie voisine')} (à moins de 12 h) : ils restent à part`
              : t`${pluriel(seuls.length, 'petit dossier sans sortie voisine', 'petits dossiers sans sortie voisine')} (à moins de 12 h) : il reste à part`}
          </summary>
          <ul class="liste-seuls">
            {seuls.map((f) => (
              <li key={f.dossier.id}>
                <Vignettes d={f.dossier} n={3} />
                <span>
                  <strong>{f.dossier.nom}</strong>{' '}
                  <span class="discret">
                    {pluriel(f.dossier.photos.length, 'photo')} · {periode(f.dossier)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p class="discret">{t`Pour en rattacher un quand même, glissez-le sur un autre dossier à l’étape ${ETAPE.lieux}.`}</p>
        </details>
      )}
      <div class="groupes">
        {visibles.map((f) => {
          const d = decisions[f.dossier.id];
          const cible = d?.cible ? f.voisins.find((v) => v.dossier.id === d.cible)?.dossier : undefined;
          return (
            <article key={f.dossier.id} class="carte-groupe">
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
                {f.voisins.slice(0, 3).map((v) => (
                  <div key={v.dossier.id} class={`voisin${cible?.id === v.dossier.id ? ' propose' : ''}`}>
                    <div>
                      <strong>{v.dossier.nom}</strong>{' '}
                      <span class="discret">
                        {pluriel(v.dossier.photos.length, 'photo')} · {periode(v.dossier)} · {t`à ${nombre(Math.abs(v.ecart) / 60, 1)} h`}
                        {v.ressemblance < 99 ? t` · ressemblance ${v.ressemblance}` : ''}
                      </span>
                    </div>
                    <Vignettes d={v.dossier} n={4} />
                    <button type="button" onClick={() => essayer(() => fusionnerDossiers(s.plan, f.dossier.id, v.dossier.id), t`« ${f.dossier.nom} » rattaché à « ${v.dossier.nom} ».`)}>
                      {t`Rattacher ici`}
                    </button>
                  </div>
                ))}
                {f.voisins.length === 0 && <p class="discret">{t`Aucune sortie voisine à moins de 12 h.`}</p>}
              </div>
              <footer>
                {d?.nomPropose && !d.absorber && (
                  <button type="button" onClick={() => essayer(() => renommerDossier(s.plan, f.dossier.id, d.nomPropose!), t`Renommé « ${d.nomPropose} ».`)}>
                    {t`Renommer « ${d.nomPropose} »`}
                  </button>
                )}
                <span class="espace" />
                <button type="button" onClick={() => garder(f.dossier.id)}>
                  {t`Garder à part`}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
      <BarreValidation
        resume={t`${pluriel(visibles.length, 'petit dossier', 'petits dossiers')} à examiner`}
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

export function PageConsolidation() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const groupes = useMemo(() => groupesUtiles(s.plan, exclusDe(s)), [versionPlan.value, versionIA.value]);
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
      {groupes.length === 0 && <p class="encart">{t`Aucun répertoire ne contient plusieurs dossiers à comparer.`}</p>}
      {groupes.map((g) => {
        const r = resultats[g.parent];
        const fusions = (r?.fusions ?? []).filter((f) => f.sources.every((x) => s.plan.dossiers.has(x)) && (!f.cibleId || s.plan.dossiers.has(f.cibleId)));
        const renommages = (r?.renommages ?? []).filter((x) => s.plan.dossiers.has(x.dossier) && nomDe(x.dossier) !== x.nom);
        const locaux = rapprochementsLocaux(g);
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
