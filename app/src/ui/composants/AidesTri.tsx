// Aides IA du tri : IA1 (cas limites de netteté, étape « Photos floues ») et
// IA2 (situer les photos sans GPS, étape « Tri automatique »). Elles
// proposent ; l'utilisateur applique.

import { casLimites, estimationCasLimites, estimationSituer, groupesSansGps, lireCasLimites, lireSituation, lotsCasLimites, requeteCasLimites, requeteSituer, voisinesDuGroupe, type PhotoLieu, type VerdictNettete } from '../../lib/aidesTri';
import { photosConcernees } from '../../lib/floues';
import { deplacerFichiers, enchainer, traitementDe, type Modification } from '../../lib/plan';
import { cleAnalyse } from '../../navigateur/analyses';
import { ETAPE } from '../../navigateur/projet';
import { executerRequete } from '../../navigateur/executeur';
import { enParallele } from '../../navigateur/workers';
import { annuler, appliquer, contexteExecution, notifier, session, versionIA, versionPlan, type Session } from '../etat';
import { nombre, pluriel } from '../format';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs } from '../pages/AidesIA';

// ---------------------------------------------------------------------------
// IA1 — cas limites de netteté
// ---------------------------------------------------------------------------

/** Seuil affiché à l'étape « Photos floues » (le curseur), pour choisir les cas limites. */
export const etatFloues = { seuil: 60 };

export type VerdictIA1 = { verdict: VerdictNettete; raison: string };

function lotsIA1(s: Session) {
  const photos = photosConcernees(s.plan)
    .map((f) => ({ id: f.id, dossier: f.dossier, date: f.date, nettete: s.analyses.get(f)?.nettete ?? NaN }))
    .filter((p) => Number.isFinite(p.nettete));
  return lotsCasLimites(casLimites(photos, etatFloues.seuil));
}

const identite = (s: Session) => (id: string) => {
  const f = s.plan.fichiers.get(id);
  return f ? cleAnalyse(f) : id;
};

enregistrerAide({
  id: 'IA1',
  nom: 'Faire juger les cas limites par l’IA',
  etape: ETAPE.floues,
  description: 'Les photos juste autour du seuil de netteté : flou artistique, mouvement voulu, ou ratée ? L’IA donne son avis, vous décidez.',
  envoi: 'planches des photos à la limite (6 par appel, 520 px)',
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const lots = lotsIA1(s);
    if (!lots.length) return null;
    const modele = modeleDe('standard');
    const aFaire = lots.filter((lot) => !s.ia.enCache(requeteCasLimites(lot, modele, identite(s)).cle));
    const e = estimationCasLimites(aFaire.map((l) => l.length), modele);
    return { usd: e.usd, appels: e.appels, detail: pluriel(lots.reduce((a, l) => a + l.length, 0), 'photo à la limite', 'photos à la limite') };
  },
  lancer: async (s, l) => {
    const lots = lotsIA1(s);
    const ctx = contexteExecution(s);
    const ajouts: Record<string, VerdictIA1> = {};
    const bilan: BilanEchecs = { echecs: 0 };
    let faits = 0;
    try {
      await enParallele(lots, 3, async (lot) => {
        if (l.arreter()) return;
        const v = await essai(() => executerRequete(ctx, requeteCasLimites(lot, l.modele, identite(s)), l.modele), bilan);
        if (v !== undefined) for (const [id, x] of lireCasLimites(v, lot)) ajouts[id] = x;
        l.progres(++faits, lots.length);
      });
    } finally {
      await s.aides.fusionner('IA1', ajouts);
    }
    return `${pluriel(Object.keys(ajouts).length, 'avis', 'avis')} sur les cas limites : voir les badges « IA ».${texteEchecs(bilan)}`;
  },
});

export function verdictsIA1(s: Session): Record<string, VerdictIA1> {
  return s.aides.get<Record<string, VerdictIA1>>('IA1') ?? {};
}

// ---------------------------------------------------------------------------
// IA2 — situer les photos sans GPS
// ---------------------------------------------------------------------------

export interface SituationIA2 {
  ids: string[];
  dossier: string | null;
  confiance: number | null;
  raison: string;
}

/** Nombre de photos sans GPS à ranger (alerte de l'étape « Lieux et sorties »). */
export function nombreSansGps(s: Session): number {
  return photosLieu(s).filter((p) => !p.gps).length;
}

function photosLieu(s: Session): PhotoLieu[] {
  return [...s.plan.fichiers.values()]
    .filter((f) => f.categorie === 'photo' && f.statut === 'archive' && !f.capture && !['garder', 'ignorer'].includes(traitementDe(s.plan, f.dossier) ?? ''))
    .map((f) => ({ id: f.id, date: f.date, gps: f.gps, dossier: f.dossier }));
}

function requetesIA2(s: Session, modele: string) {
  const photos = photosLieu(s);
  const nomDossier = (id: string) => {
    const d = s.plan.dossiers.get(s.plan.fichiers.get(id)?.dossier ?? '');
    return { nom: d?.nom ?? '?', lieu: d?.tri?.lieu };
  };
  return groupesSansGps(photos).flatMap((groupe) => {
    const voisines = voisinesDuGroupe(groupe, photos);
    const r = voisines.length ? requeteSituer(groupe, voisines, nomDossier, modele, identite(s)) : null;
    return r ? [{ groupe, voisines, r }] : [];
  });
}

enregistrerAide({
  id: 'IA2',
  nom: 'Situer les photos sans GPS avec l’IA',
  etape: ETAPE.tri,
  description: 'Pour les photos sans position, l’IA compare leur contenu aux photos prises juste avant et après, et propose un dossier.',
  envoi: 'les photos sans GPS et leurs voisines dans le temps, avec le nom de leur dossier',
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const modele = modeleDe('standard');
    const liste = requetesIA2(s, modele);
    if (!liste.length) return null;
    const aFaire = liste.filter((x) => !s.ia.enCache(x.r.cle));
    const e = estimationSituer(aFaire.map((x) => x.groupe.length + x.voisines.length), modele);
    return { usd: e.usd, appels: e.appels, detail: pluriel(liste.reduce((a, x) => a + x.groupe.length, 0), 'photo sans GPS', 'photos sans GPS') };
  },
  lancer: async (s, l) => {
    const liste = requetesIA2(s, l.modele);
    const ctx = contexteExecution(s);
    const ajouts: Record<string, SituationIA2> = {};
    const bilan: BilanEchecs = { echecs: 0 };
    let faits = 0;
    try {
      await enParallele(liste, 3, async (x) => {
        if (l.arreter()) return;
        const v = await essai(() => executerRequete(ctx, x.r, l.modele), bilan);
        const sit = v === undefined ? null : lireSituation(v, x.voisines);
        if (sit) ajouts[x.groupe[0].id] = { ids: x.groupe.map((p) => p.id), dossier: sit.dossier, confiance: sit.confiance, raison: sit.raison };
        l.progres(++faits, liste.length);
      });
    } finally {
      await s.aides.fusionner('IA2', ajouts);
    }
    return `${pluriel(Object.values(ajouts).filter((x) => x.dossier).length, 'proposition')} pour les photos sans GPS.${texteEchecs(bilan)}`;
  },
});

/** Propositions IA2 encore utiles (le dossier existe, les photos n'y sont pas déjà). */
function propositionsIA2(s: Session): SituationIA2[] {
  return Object.values(s.aides.get<Record<string, SituationIA2>>('IA2') ?? {}).filter(
    (p) => p.dossier && s.plan.dossiers.has(p.dossier) && p.ids.some((id) => s.plan.fichiers.get(id)?.dossier !== p.dossier && s.plan.fichiers.get(id)?.statut === 'archive'),
  );
}

/** Encart du tri automatique : photos sans GPS, aide IA2 et ses propositions. */
export function SansGps() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const sans = photosLieu(s).filter((p) => !p.gps).length;
  if (!sans) return null;
  const propositions = propositionsIA2(s);
  const deplacer = (p: SituationIA2): Modification | null => deplacerFichiers(s.plan, p.ids.filter((id) => s.plan.fichiers.get(id)?.statut === 'archive'), p.dossier!);
  const surs = propositions.filter((p) => (p.confiance ?? 0) >= 8);
  return (
    <details class="tri-auto">
      <summary>
        <strong>{pluriel(sans, 'photo sans GPS', 'photos sans GPS')}</strong> — rangées avec les photos du même jour ; l’IA peut proposer un meilleur dossier
      </summary>
      <AideIA fonction="IA2" />
      {surs.length > 0 && (
        <button
          type="button"
          onClick={() => {
            appliquer(enchainer(s.plan, `Ranger ${surs.length} groupes de photos sans GPS`, surs.map((p) => () => deplacer(p))));
            notifier('ok', `${pluriel(surs.length, 'groupe rangé', 'groupes rangés')}.`, { libelle: 'Annuler', faire: annuler });
          }}
        >
          Accepter les {nombre(surs.length)} propositions sûres (confiance 8 ou plus)
        </button>
      )}
      <ul class="liste-courte">
        {propositions.map((p) => (
          <li key={p.ids[0]}>
            {pluriel(p.ids.length, 'photo')} ({s.plan.fichiers.get(p.ids[0])?.nom}…) → « {s.plan.dossiers.get(p.dossier!)?.nom} »{p.confiance !== null ? ` (confiance ${p.confiance}/10)` : ''} —{' '}
            <span class="discret">{p.raison}</span>{' '}
            <button type="button" class="lien" onClick={() => appliquer(deplacer(p))}>
              déplacer
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
