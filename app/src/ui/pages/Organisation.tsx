// Étape « Consolidation » (IA6, script 05, D91) : en tête, ce qu'il faut
// proposer (une sortie coupée en plusieurs dossiers, les week-ends et petits
// voyages), avec le résultat sous les yeux ; puis une proposition à la fois,
// ses dossiers côte à côte avec leurs photos et leurs heures. On réunit en un
// dossier, en un dossier de voyage avec ses étapes, ou on laisse séparé ; la
// liste de gauche garde chaque décision (rien ne disparaît, tout se défait).
// Les exclusions servent aussi à l'étape « Petits dossiers » (PetitsDossiers.tsx).

import { signal } from '@preact/signals';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import {
  avecIA,
  clePaire,
  CRANS_HEURES,
  CRANS_JOURS_VOYAGE,
  CRANS_KM,
  DISTANCE_MAISON_KM,
  estimationConsolidation,
  groupesDeFreres,
  instantsALaMaison,
  JOURS_MAX_NOMS_PROCHES,
  lireConsolidation,
  lireReglages,
  nomPropose,
  paires,
  propositions,
  rayonDuProjet,
  requeteConsolidation,
  voisinage,
  type Consolidation,
  type ContexteReunions,
  type DossierInfo,
  type GroupeFreres,
  type Proposition,
  type ReglagesConsolidation,
} from '../../lib/consolidation';
import { raisonExclusion } from '../../lib/fragments';
import { estNomAutomatique } from '../../lib/nommage';
import { renommerDossier, type FichierPlan, type Modification, type Plan } from '../../lib/plan';
import { defaireReunion, rangerEnVoyage, reunionEnPlace, reunirEnUn, type Reunion } from '../../lib/reunions';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { BarreValidation, RaisonDesactivee } from '../composants/Cadre';
import { Icone } from '../composants/Icones';
import { AideEtape, LigneEtape } from '../composants/CadreCommun';
import { Miniature } from '../composants/GrillePhotos';
import { Visionneuse } from '../composants/Visionneuse';
import { annuler, appliquer, configuration, contexteExecution, evenements, notifier, page, reglages, revenirDe, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { aTraduire, t } from '../../lib/langue';
import { jourCourt, nombre, nomJour, pluriel } from '../format';
import { exclusDe, visionneuse } from '../organiser';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs } from './AidesIA';

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

// ---------------------------------------------------------------------------
// Étape « Consolidation » (D91)
// ---------------------------------------------------------------------------

/** Réglages, décisions et réunions de l'étape (`.album/aides.json`). */
const CLES = {
  reglages: 'consolidation_reglages',
  /** Paires refusées comme sortie (D70). */
  ignorees: 'consolidation_paires_ignorees',
  /** Paires refusées comme étapes d'un même voyage. */
  voyagesIgnores: 'consolidation_voyages_ignores',
  refus: 'consolidation_refus',
  reunions: 'consolidation_reunions',
  renommagesRefuses: 'consolidation_renommages_refuses',
} as const;

/** Une proposition refusée (« Pas ensemble ») : de quoi l'afficher, et les paires à rendre si l'on se ravise. */
interface Refus {
  cle: string;
  sorte: Proposition['sorte'];
  noms: string[];
  du?: string;
  au?: string;
  paires: string[];
}

const ensemble = (s: Session, cle: string) => new Set(s.aides.get<string[]>(cle) ?? []);

function changerEnsemble(s: Session, cle: string, ajout: string[], retrait: string[] = []): Promise<void> {
  const x = ensemble(s, cle);
  for (const p of ajout) x.add(p);
  for (const p of retrait) x.delete(p);
  return s.aides.set(cle, [...x]);
}

function changerRegistre<T>(s: Session, cle: string, id: string, valeur: T | null): Promise<void> {
  const x = { ...(s.aides.get<Record<string, T>>(cle) ?? {}) };
  if (valeur === null) delete x[id];
  else x[id] = valeur;
  return s.aides.set(cle, x);
}

const dossierDe = (s: Session, id: string) => s.plan.dossiers.get(id);

/** Ce dont le moteur a besoin pour proposer : refus, domicile, photos prises à la maison, dossiers de voyage. */
function contexteDe(s: Session, reunions: Reunion[], aLaMaison: number[]): ContexteReunions {
  const dom = configuration.value?.lecture?.config?.lieux_connus.find((l) => l.domicile);
  const voyages = new Map<string, 'tri' | 'choisi'>();
  for (const d of s.plan.dossiers.values()) if (d.tri?.origine === 'voyage') voyages.set(d.id, 'tri');
  for (const r of reunions) if (r.choix === 'etapes') voyages.set(r.cible, 'choisi');
  return {
    ignorees: ensemble(s, CLES.ignorees),
    voyagesIgnores: ensemble(s, CLES.voyagesIgnores),
    maison: dom ? { lat: dom.lat, lon: dom.lon, km: DISTANCE_MAISON_KM } : null,
    aLaMaison,
    nomDonne: (d) => !estNomAutomatique(d.nom, dossierDe(s, d.id)?.tri?.nom),
    voyages,
    evts: evenements.value,
  };
}

/** « 28 juin », « sam. 28 – dim. 29 juin 2025 ». */
function jours(du?: string, au?: string): string {
  if (!du) return t`date inconnue`;
  if (!au || au.slice(0, 10) === du.slice(0, 10)) return nomJour(du.slice(0, 10), true);
  return `${nomJour(du.slice(0, 10))} – ${nomJour(au.slice(0, 10), false, true)}`;
}

/** « sam. 28 juin, 10:00 – 18:12 », ou du premier au dernier jour. */
function moment(d: DossierInfo): string {
  if (!d.du) return t`date inconnue`;
  const h = (x?: string) => (x && x.length > 10 ? x.slice(11, 16) : '');
  if (d.au && d.au.slice(0, 10) !== d.du.slice(0, 10)) return `${nomJour(d.du.slice(0, 10))} ${h(d.du)} – ${nomJour(d.au.slice(0, 10))} ${h(d.au)}`;
  return [nomJour(d.du.slice(0, 10)), [h(d.du), h(d.au)].filter((x, i, l) => x && l.indexOf(x) === i).join(' – ')].filter(Boolean).join(', ');
}

const heure = (f: FichierPlan) => (f.date && f.date.length > 10 ? f.date.slice(11, 16) : '');

/** Au plus `n` photos réparties sur tout le dossier, la première et la dernière comprises. */
function echantillon(photos: FichierPlan[], n: number): FichierPlan[] {
  if (photos.length <= n) return photos;
  return Array.from({ length: n }, (_, i) => photos[Math.round((i * (photos.length - 1)) / (n - 1))]);
}

/** Pourquoi ces dossiers sont proposés, en mots. */
function raison(p: Proposition): string {
  if (p.sorte === 'voyage') {
    const n = p.du && p.au ? Math.round((Date.parse(p.au.slice(0, 10)) - Date.parse(p.du.slice(0, 10))) / 86_400_000) + 1 : 0;
    return p.voyageEntier
      ? t`Les ${pluriel(p.dossiers.length, 'étape')} d’un voyage de ${pluriel(n, 'jour')} : vous pouvez les réunir en un seul dossier.`
      : t`${pluriel(n, 'jour')} loin de la maison, sans photo prise à la maison entre-temps.`;
  }
  const r = p.rencontre;
  // Le calendrier (D106) : seul, ou en plus de ce que disent les photos.
  const calendrier = p.evenement ? t`Pris pendant « ${p.evenement} » (votre calendrier), au même endroit.` : '';
  if (!r) return [p.noms ? t`Des noms proches, à moins de ${JOURS_MAX_NOMS_PROCHES} jours d’écart.` : '', calendrier].filter(Boolean).join(' ');
  const ecart = r.minutes < 1 ? t`moins d’une minute` : r.minutes < 60 ? t`${nombre(r.minutes)} min` : t`${nombre(r.minutes / 60, r.minutes < 600 ? 1 : 0)} h`;
  if (r.km === null) return [t`Des photos prises à ${ecart} d’écart (lieu inconnu pour l’un des dossiers).`, calendrier].filter(Boolean).join(' ');
  const distance = r.km < 1 ? t`${nombre(Math.max(10, Math.round(r.km * 100) * 10))} m` : t`${nombre(r.km, r.km < 10 ? 1 : 0)} km`;
  return [t`Des photos prises à ${ecart} et ${distance} d’écart.`, calendrier].filter(Boolean).join(' ');
}

/** Le titre d'une proposition selon sa sorte. */
function titreSorte(p: Proposition): string {
  if (p.sorte === 'sortie' && p.evenement && !p.rencontre && !p.noms) return t`Un même événement en plusieurs dossiers ?`;
  if (p.sorte === 'sortie') return t`Une sortie coupée en plusieurs dossiers ?`;
  return p.voyageEntier ? t`Un voyage en un seul dossier ?` : t`Un week-end ou un petit voyage ?`;
}

// ---------------------------------------------------------------------------
// Réglages, avec le résultat sous les yeux
// ---------------------------------------------------------------------------

const TEXTE_HEURES: Record<number, string> = { 1: aTraduire('1 h'), 3: aTraduire('3 h'), 6: aTraduire('6 h'), 12: aTraduire('la journée') };
const TEXTE_JOURS: Record<number, string> = { 3: aTraduire('3 jours'), 4: aTraduire('4 jours'), 7: aTraduire('1 semaine'), 14: aTraduire('2 semaines') };

/** Crans d'un réglage ; `inactif` : la raison écrite à côté (C-4.7). */
function Crans({ valeurs, valeur, texte, changer, libelle, inactif }: { valeurs: readonly number[]; valeur: number; texte: (v: number) => string; changer: (v: number) => void; libelle: string; inactif?: string }) {
  const id = useId();
  return (
    <>
      <div class="choix-segmente choix-tri" role="radiogroup" aria-label={libelle}>
        {valeurs.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={valeur === v} disabled={!!inactif} aria-describedby={inactif ? id : undefined} onClick={() => changer(v)}>
            {texte(v)}
          </button>
        ))}
      </div>
      <RaisonDesactivee id={id} raison={inactif} />
    </>
  );
}

function Reglages({ r, changer, resume, sansMaison, refusees, reproposer }: { r: ReglagesConsolidation; changer: (m: Partial<ReglagesConsolidation>) => void; resume: string; sansMaison: boolean; refusees: number; reproposer: () => void }) {
  return (
    <section class="reglages-reunion" aria-label={t`Que proposer ?`}>
      <div class="options-tri">
        <div class="option-tri">
          <strong>{t`Une sortie coupée en plusieurs dossiers : des photos prises à moins de…`}</strong>
          <div class="ligne-crans">
            <Crans valeurs={CRANS_HEURES} valeur={r.heures} texte={(v) => t(TEXTE_HEURES[v])} changer={(heures) => changer({ heures })} libelle={t`Écart de temps`} />
            <span>{t`et de`}</span>
            <Crans valeurs={CRANS_KM} valeur={r.km} texte={(v) => t`${nombre(v)} km`} changer={(km) => changer({ km })} libelle={t`Distance`} />
          </div>
          <p class="aide-option">{t`Deux dossiers dont des photos se suivent ainsi sont proposés ensemble : une balade qui passe par deux villages, un départ en avion.`}</p>
        </div>
        <div class="option-tri">
          <label class="case">
            <input type="checkbox" checked={r.voyages} onChange={(e) => changer({ voyages: e.currentTarget.checked })} /> <strong>{t`Les week-ends et petits voyages, jusqu’à…`}</strong>
          </label>
          <Crans valeurs={CRANS_JOURS_VOYAGE} valeur={r.joursVoyage} texte={(v) => t(TEXTE_JOURS[v])} changer={(joursVoyage) => changer({ joursVoyage })} libelle={t`Durée d’un petit voyage`} inactif={r.voyages ? undefined : t`Cochez la case pour choisir la durée.`} />
          <p class="aide-option">
            {t`Des dossiers à plus de ${DISTANCE_MAISON_KM} km de la maison, sur des jours qui se suivent, sans photo prise à la maison entre-temps. Vous choisirez d’en faire un seul dossier, ou un dossier de voyage avec une étape par dossier.`}
            {sansMaison && (
              <>
                {' '}
                <strong>{t`Sans effet pour l’instant : aucun domicile n’est enregistré.`}</strong>{' '}
                <button type="button" class="lien" onClick={() => (page.value = { nom: 'configuration' })}>
                  {t`Indiquer le domicile dans la Configuration`}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
      <details class="avances">
        <summary>{t`Réglages avancés`}</summary>
        <label class="case">
          <input type="checkbox" checked={r.noms} onChange={(e) => changer({ noms: e.currentTarget.checked })} /> {t`Proposer aussi les dossiers aux noms proches, à moins de ${JOURS_MAX_NOMS_PROCHES} jours d’écart (noms donnés au Nommage)`}
        </label>
        {refusees > 0 && (
          <p class="discret">
            {t`${pluriel(refusees, 'proposition refusée', 'propositions refusées')} : elles ne sont plus proposées.`}{' '}
            <button type="button" class="lien" onClick={reproposer}>
              {t`les proposer à nouveau`}
            </button>
          </p>
        )}
      </details>
      <p class="resultat-reglages" aria-live="polite">
        {resume}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Une proposition
// ---------------------------------------------------------------------------

function CarteProposition({ p, nomParent, reunir, refuser }: { p: Proposition; nomParent: string; reunir: (dossiers: DossierInfo[], choix: 'un' | 'etapes', nom: string, retires: DossierInfo[]) => void; refuser: () => void }) {
  const [retires, setRetires] = useState<ReadonlySet<string>>(new Set());
  const [choix, setChoix] = useState<'un' | 'etapes'>('un');
  const [nomTape, setNomTape] = useState<string | null>(null);
  const gardes = p.dossiers.filter((d) => !retires.has(d.id));
  const sousProposition = { ...p, dossiers: gardes.length ? gardes : p.dossiers };
  const nom = nomTape ?? nomPropose(sousProposition, choix, nomParent);
  const photos = gardes.reduce((n, d) => n + d.photos.length, 0);
  const cote = Math.max(96, Math.round(reglages.value.tailleMiniatures * 0.6));
  const toutes = p.dossiers.flatMap((d) => d.photos);
  const etapes = p.sorte === 'voyage' && !p.voyageEntier;
  return (
    <>
      <header class="tete-reunion">
        <span class={`sorte-reunion ${p.sorte}`}>{titreSorte(p)}</span>
        <h2>{jours(p.du, p.au)}</h2>
        <p class="discret">{raison(p)}</p>
        {p.ia && (
          <p class="proposition-ia">
            <Icone nom="etincelle" taille={16} />
            {t`L’IA propose de les réunir dans « ${p.ia.cible} »`} : {p.ia.raison}
          </p>
        )}
      </header>
      <div class="colonnes-reunion">
        {p.dossiers.map((d) => {
          const retire = retires.has(d.id);
          const montrees = echantillon(d.photos, 6);
          return (
            <section key={d.id} class={`dossier-reunion${retire ? ' retire' : ''}`}>
              <label class="case nom-reunion">
                <input
                  type="checkbox"
                  checked={!retire}
                  onChange={() => setRetires(new Set(retire ? [...retires].filter((x) => x !== d.id) : [...retires, d.id]))}
                  title={retire ? t`Le remettre avec les autres` : t`Le laisser à part`}
                />{' '}
                <strong>{d.nom}</strong>
              </label>
              <p class="discret">
                {pluriel(d.photos.length, 'photo')} · {moment(d)}
              </p>
              <div class="photos-reunion">
                {montrees.map((f) => (
                  <figure key={f.id}>
                    <button type="button" class="photo-petit" onClick={() => (visionneuse.value = toutes.indexOf(f))} title={t`Voir en grand`}>
                      <Miniature f={f} taille={cote} />
                    </button>
                    <figcaption>{heure(f)}</figcaption>
                  </figure>
                ))}
                {d.photos.length > montrees.length && <span class="plus-photos">{t`+${nombre(d.photos.length - montrees.length)}`}</span>}
              </div>
            </section>
          );
        })}
      </div>
      <footer class="pied-reunion">
        {etapes && (
          <div class="choix-segmente choix-tri" role="radiogroup" aria-label={t`Comment les ranger ?`}>
            <button type="button" role="radio" aria-checked={choix === 'un'} onClick={() => setChoix('un')}>
              {t`Un seul dossier`}
            </button>
            <button type="button" role="radio" aria-checked={choix === 'etapes'} onClick={() => setChoix('etapes')}>
              {t`Un dossier de voyage, une étape par dossier`}
            </button>
          </div>
        )}
        <label class="nom-reuni">
          {choix === 'etapes' ? t`Nom du dossier de voyage` : t`Nom du dossier réuni`}
          <input class="large" value={nom} onInput={(e) => setNomTape(e.currentTarget.value)} />
        </label>
        <p class="discret apres-choix" id="raison-reunir">
          {gardes.length < 2
            ? t`Cochez au moins deux dossiers.`
            : !nom.trim()
              ? t`Donnez d’abord un nom au dossier.`
              : choix === 'etapes'
              ? t`Un dossier « ${nom} » est créé ; les ${nombre(gardes.length)} dossiers y deviennent des étapes, avec leurs photos.`
              : t`Les ${nombre(gardes.length)} dossiers deviennent un seul dossier « ${nom} » (${pluriel(photos, 'photo')}).`}
        </p>
        <div class="actions">
          <button type="button" class="doux" onClick={refuser} title={t`Touche N`}>
            {p.sorte === 'sortie' ? t`Pas la même sortie` : p.voyageEntier ? t`Garder les étapes` : t`Pas un même voyage`}
          </button>
          <span class="espace" />
          <button type="button" class="principal" disabled={gardes.length < 2 || !nom.trim()} aria-describedby={gardes.length < 2 || !nom.trim() ? 'raison-reunir' : undefined} onClick={() => reunir(gardes, choix, nom.trim(), p.dossiers.filter((d) => retires.has(d.id)))}>
            {choix === 'etapes' ? t`Ranger ensemble` : t`Réunir ${pluriel(gardes.length, 'dossier')}`}
          </button>
        </div>
      </footer>
      {/* Seulement ouverte : montée, la visionneuse prend Échap et les flèches à toute la page. */}
      {visionneuse.value !== null && <Visionneuse elements={toutes} />}
    </>
  );
}

/** Proposition de renommage de l'IA (dossiers non identifiés, IA6). */
interface RenommageIA {
  dossier: string;
  nom: string;
  raison: string;
}

type Element = { cle: string; du?: string; libelle: string; p?: Proposition; renommage?: RenommageIA; reunion?: Reunion; refus?: Refus };

/** Élément affiché : retenu le temps de la session, d'une visite de l'étape à l'autre. */
const choisi = signal<string | null>(null);

/** Les photos prises à la maison (pour couper les voyages), recalculées quand le plan change. */
function useALaMaison(s: Session): number[] {
  const dom = configuration.value?.lecture?.config?.lieux_connus.find((l) => l.domicile);
  return useMemo(() => (dom ? instantsALaMaison(s.plan.fichiers.values(), { lat: dom.lat, lon: dom.lon, km: DISTANCE_MAISON_KM }) : []), [versionPlan.value, dom?.lat, dom?.lon]);
}

export function PageConsolidation() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const rayonKm = rayonDuProjet(s.projet.tri);
  const [r, setR] = useState<ReglagesConsolidation>(() => lireReglages(s.aides.get(CLES.reglages), rayonKm));
  const changerReglages = (m: Partial<ReglagesConsolidation>) => {
    const nouveaux = { ...r, ...m };
    setR(nouveaux);
    void s.aides.set(CLES.reglages, nouveaux);
  };

  // Ce qui ne dépend pas des réglages : une fois par version du plan (les rencontres des dossiers voisins).
  const v = useMemo(() => voisinage(groupesUtiles(s.plan, exclusDe(s))), [versionPlan.value, versionIA.value]);
  const aLaMaison = useALaMaison(s);
  const reunions = Object.values(s.aides.get<Record<string, Reunion>>(CLES.reunions) ?? {}).filter((x) => reunionEnPlace(s.plan, x));
  const refus = Object.values(s.aides.get<Record<string, Refus>>(CLES.refus) ?? {});
  const c = contexteDe(s, reunions, aLaMaison);
  const resultatsIA = s.aides.get<Record<string, ResultatIA6>>('IA6') ?? {};
  const fusionsIA = Object.entries(resultatsIA).flatMap(([parent, x]) => (Array.isArray(x?.fusions) ? x.fusions.map((f) => ({ parent, f })) : []));
  const liste = avecIA(propositions(v, r, c), v, fusionsIA, c.ignorees);
  const refusesIA = ensemble(s, CLES.renommagesRefuses);
  const renommages: RenommageIA[] = Object.values(resultatsIA)
    .flatMap((x) => (Array.isArray(x?.renommages) ? x.renommages : []))
    .filter((x) => dossierDe(s, x.dossier) && dossierDe(s, x.dossier)!.nom !== x.nom && !refusesIA.has(x.dossier));

  const libelleDe = (noms: string[]) => (noms.length > 2 ? t`${noms[0]} et ${nombre(noms.length - 1)} autres` : noms.join(t` et `));
  const elements: Element[] = [
    ...liste.map((p) => ({ cle: p.cle, du: p.du, libelle: libelleDe(p.dossiers.map((d) => d.nom)), p })),
    ...renommages.map((x) => ({ cle: `renommage:${x.dossier}`, du: v.groupes.flatMap((g) => g.dossiers).find((d) => d.id === x.dossier)?.du, libelle: dossierDe(s, x.dossier)!.nom, renommage: x })),
    ...reunions.map((x) => ({ cle: `reunion:${x.cle}`, du: x.du, libelle: x.nom, reunion: x })),
    ...refus.map((x) => ({ cle: `refus:${x.cle}`, du: x.du, libelle: libelleDe(x.noms), refus: x })),
  ].sort((a, b) => (a.du ?? '9').localeCompare(b.du ?? '9') || a.cle.localeCompare(b.cle));
  const aDecider = (e: Element) => !!e.p || !!e.renommage;
  const restants = elements.filter(aDecider);
  const courant = elements.find((e) => e.cle === choisi.value) ?? restants[0] ?? elements[0];

  /** Après une décision : l'élément suivant à décider (dans l'ordre de la liste, puis depuis le début). */
  const suivant = () => {
    const i = elements.findIndex((e) => e.cle === courant?.cle);
    const prochain = [...elements.slice(i + 1), ...elements.slice(0, Math.max(0, i))].find((e) => aDecider(e) && e.cle !== courant?.cle);
    choisi.value = prochain?.cle ?? null;
  };

  const reunir = (p: Proposition, dossiers: DossierInfo[], choix: 'un' | 'etapes', nom: string, retires: DossierInfo[]) => {
    let fait: { modification: Modification | null; reunion: Reunion };
    try {
      fait =
        choix === 'etapes'
          ? rangerEnVoyage(s.plan, p.cle, dossiers, p.parent, nom)
          : reunirEnUn(s.plan, p.cle, dossiers, nom, p.voyageEntier ? p.parent : undefined);
      appliquer(fait.modification);
    } catch (err) {
      notifier('erreur', texteErreur(err));
      return;
    }
    const { reunion } = fait;
    // Les dossiers décochés restent à part : ils ne sont plus proposés avec le dossier réuni.
    const separes = retires.map((d) => clePaire(d.id, reunion.cible));
    void Promise.all([
      changerRegistre(s, CLES.reunions, reunion.cle, { ...reunion, ...(separes.length ? { separes } : {}) }),
      separes.length ? changerEnsemble(s, p.sorte === 'sortie' ? CLES.ignorees : CLES.voyagesIgnores, separes) : null,
    ]).then(() => versionIA.value++);
    notifier('ok', choix === 'etapes' ? t`Rangés ensemble dans « ${nom} ».` : t`Réunis dans « ${nom} ».`, { libelle: t`Annuler`, faire: annuler });
    suivant();
  };

  const refuser = (p: Proposition) => {
    // Une sortie : toutes ses paires ; un voyage : ses étapes qui se suivent (la chaîne est coupée).
    const ids = p.dossiers.map((d) => d.id);
    const lesPaires = p.sorte === 'sortie' ? paires(ids) : ids.slice(1).map((id, i) => clePaire(ids[i], id));
    const x: Refus = { cle: p.cle, sorte: p.sorte, noms: p.dossiers.map((d) => d.nom), du: p.du, au: p.au, paires: lesPaires };
    void Promise.all([changerEnsemble(s, p.sorte === 'sortie' ? CLES.ignorees : CLES.voyagesIgnores, lesPaires), changerRegistre(s, CLES.refus, p.cle, x)]).then(() => versionIA.value++);
    suivant();
  };

  const annulerRefus = (x: Refus) => {
    choisi.value = x.cle;
    void Promise.all([changerEnsemble(s, x.sorte === 'sortie' ? CLES.ignorees : CLES.voyagesIgnores, [], x.paires), changerRegistre<Refus>(s, CLES.refus, x.cle, null)]).then(() => versionIA.value++);
  };

  const defaire = (x: Reunion) => {
    try {
      const m = defaireReunion(s.plan, x);
      if (!m) {
        notifier('erreur', t`Rien à défaire : les dossiers ont été changés depuis.`);
        return;
      }
      appliquer(m);
    } catch (err) {
      notifier('erreur', texteErreur(err));
      return;
    }
    choisi.value = x.cle;
    const ensembleSepares = x.choix === 'etapes' || x.cle.startsWith('voyage:') ? CLES.voyagesIgnores : CLES.ignorees;
    void Promise.all([changerRegistre<Reunion>(s, CLES.reunions, x.cle, null), x.separes ? changerEnsemble(s, ensembleSepares, [], x.separes) : null]).then(() => versionIA.value++);
    notifier('ok', t`« ${x.nom} » est défait.`, { libelle: t`Annuler`, faire: annuler });
  };

  const renommer = (x: RenommageIA) => {
    try {
      appliquer(renommerDossier(s.plan, x.dossier, x.nom));
      notifier('ok', t`Renommé « ${x.nom} ».`, { libelle: t`Annuler`, faire: annuler });
      suivant();
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const reproposer = () => {
    void Promise.all([s.aides.set(CLES.ignorees, []), s.aides.set(CLES.voyagesIgnores, []), s.aides.set(CLES.refus, {}), s.aides.set(CLES.renommagesRefuses, [])]).then(() => versionIA.value++);
  };

  // Clavier : J et K d'un élément à l'autre, N « Pas ensemble ».
  const etat = useRef({ courant, elements, refuser });
  etat.current = { courant, elements, refuser };
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || visionneuse.value !== null || document.querySelector('[role="dialog"]')) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const { courant: x, elements: l, refuser: n } = etat.current;
      const i = l.findIndex((y) => y.cle === x?.cle);
      const k = e.key.toLowerCase();
      if (k === 'j' && l[i + 1]) choisi.value = l[i + 1].cle;
      else if (k === 'k' && i > 0) choisi.value = l[i - 1].cle;
      else if (k === 'n' && x?.p) n(x.p);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);

  const sorties = liste.filter((p) => p.sorte === 'sortie').length;
  const resume =
    liste.length === 0
      ? t`Avec ces réglages : rien à proposer.`
      : t`Avec ces réglages : ${pluriel(liste.length, 'proposition')} (${pluriel(sorties, 'sortie coupée', 'sorties coupées')}, ${pluriel(liste.length - sorties, 'week-end ou voyage', 'week-ends ou voyages')}).`;

  return (
    <div class="page large avec-barre page-consolidation">
      <LigneEtape titre={nomEtape(ETAPE.consolidation)} aide={{ cle: 'consolidation' }} taille={(v) => Math.max(96, Math.round(v * 0.6))} />
      <AideEtape cle="consolidation">
        {t`Le tri coupe parfois une sortie en plusieurs dossiers (une balade qui passe par deux villages) et range un week-end en un dossier par endroit. Choisissez ce qui doit être proposé, puis, pour chaque proposition, réunissez les dossiers ou laissez-les séparés. Rien n’est réuni sans votre accord.`}
      </AideEtape>
      <Reglages r={r} changer={changerReglages} resume={resume} sansMaison={!c.maison} refusees={refus.length + refusesIA.size} reproposer={reproposer} />
      <AideIA fonction="IA6" />
      <DossiersExclus />
      {elements.length === 0 ? (
        <p class="encart">{t`Rien à réunir avec ces réglages : vous pouvez continuer.`}</p>
      ) : (
        <div class="corps-petits">
          <nav class="liste-petits" aria-label={t`Propositions`}>
            <h2>{t`Dans l’ordre du temps`}</h2>
            {elements.map((e) => {
              const fait = !aDecider(e);
              return (
                <button key={e.cle} type="button" class={`ligne-liste-petit${e.cle === courant?.cle ? ' choisie' : ''}${fait ? ' fait' : ''}`} aria-current={e.cle === courant?.cle ? 'true' : undefined} onClick={() => (choisi.value = e.cle)}>
                  <span class="etat-petit">
                    <Icone nom={e.reunion ? 'coche' : e.refus ? 'croix' : 'cercle'} taille={16} titre={e.reunion ? t`réunis` : e.refus ? t`laissés séparés` : t`à décider`} />
                  </span>
                  <span class="nom-liste-petit">
                    <span class="discret">{e.du ? jourCourt(e.du) : ''}</span> {e.libelle}
                  </span>
                </button>
              );
            })}
          </nav>
          <section class="contenu-petits">
            {courant?.p ? (
              <CarteProposition
                key={courant.p.cle}
                p={courant.p}
                nomParent={dossierDe(s, courant.p.parent)?.nom ?? ''}
                reunir={(dossiers, choix, nom, retires) => reunir(courant.p!, dossiers, choix, nom, retires)}
                refuser={() => refuser(courant.p!)}
              />
            ) : courant?.renommage ? (
              <div class="encart">
                <p>
                  <span class="proposition-ia">
                    <Icone nom="etincelle" taille={16} />
                    {t`L’IA propose de renommer « ${dossierDe(s, courant.renommage.dossier)?.nom ?? ''} » en « ${courant.renommage.nom} »`}
                  </span>
                </p>
                <p class="discret">{courant.renommage.raison}</p>
                <div class="photos-reunion">
                  {echantillon(v.groupes.flatMap((g) => g.dossiers).find((d) => d.id === courant.renommage!.dossier)?.photos ?? [], 6).map((f) => (
                    <figure key={f.id}>
                      <Miniature f={f} taille={Math.max(96, Math.round(reglages.value.tailleMiniatures * 0.6))} />
                      <figcaption>{heure(f)}</figcaption>
                    </figure>
                  ))}
                </div>
                <p class="actions">
                  <button type="button" class="doux" onClick={() => void changerEnsemble(s, CLES.renommagesRefuses, [courant.renommage!.dossier]).then(() => versionIA.value++)}>
                    {t`Non merci`}
                  </button>
                  <button type="button" class="principal" onClick={() => renommer(courant.renommage!)}>
                    {t`Renommer`}
                  </button>
                </p>
              </div>
            ) : courant?.reunion ? (
              <div class="encart decide-petit">
                <p>
                  <Icone nom="coche" taille={16} /> {courant.reunion.choix === 'etapes' ? t`Rangés ensemble dans « ${courant.reunion.nom} » :` : t`Réunis dans « ${courant.reunion.nom} » :`} {courant.reunion.noms.join(t` et `)}.
                </p>
                <button type="button" onClick={() => defaire(courant.reunion!)}>
                  {t`Défaire`}
                </button>
              </div>
            ) : courant?.refus ? (
              <div class="encart decide-petit">
                <p>
                  <Icone nom="croix" taille={16} /> {courant.refus.sorte === 'sortie' ? t`Pas la même sortie :` : t`Pas un même voyage :`} {courant.refus.noms.join(t` et `)}.
                </p>
                <button type="button" onClick={() => annulerRefus(courant.refus!)}>
                  {t`Annuler ce choix`}
                </button>
              </div>
            ) : null}
            {restants.length === 0 && <p class="encart">{t`Tout est décidé : vous pouvez continuer.`}</p>}
            <p class="discret aide-petits">{t`Clavier : J et K proposition suivante ou précédente, N pas ensemble, Ctrl+Z annuler.`}</p>
          </section>
        </div>
      )}
      <BarreValidation
        resume={`${
          restants.length === 0
            ? t`Aucune proposition à décider`
            : restants.length === 1
              ? t`1 proposition à décider : ses dossiers restent séparés`
              : t`${nombre(restants.length)} propositions à décider : leurs dossiers restent séparés`
        } · ${pluriel(reunions.length, 'réunion', 'réunions')} · ${pluriel(refus.length, 'refusée', 'refusées')}`}
        fini={restants.length === 0}
        revenir={() => revenirDe('consolidation')}
        valider={() => validerEtape('consolidation')}
      />
    </div>
  );
}
