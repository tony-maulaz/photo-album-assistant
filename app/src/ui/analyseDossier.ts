// Analyse du dossier, lancée toute seule après l'inventaire (D56) : netteté,
// ressemblance et exposition de chaque photo (dans les workers), empreinte des
// photos de même taille (les seules qui peuvent être des copies exactes), puis
// recherche des rafales (D81). Tout est gratuit, local et ne décide rien : les
// pages montrent ensuite des propositions à valider. Les résultats sont
// enregistrés au fil de l'eau : un onglet fermé reprend là où il s'était arrêté.
// Relancée après les étapes « Dossiers » et « Photos floues », elle ne refait
// que les rafales des journées (ou dossiers) dont les photos ont changé.

import { signal } from '@preact/signals';
import { candidatsEmpreinte } from '../lib/doublonsExacts';
import { aRelire, groupesScenes, groupeVisible } from '../lib/groupesDoublons';
import { t } from '../lib/langue';
import type { FichierPlan } from '../lib/plan';
import { analyserDoublons, lotsAChercher, lotsDisparus, lotsDoublons } from '../navigateur/doublons';
import { groupeWorkers, journal, notifier, planifierEnregistrement, session, texteErreur, versionIA, versionPlan, type Session } from './etat';
import { pluriel } from './format';

export interface AvancementAnalyse {
  phase: 'photos' | 'copies' | 'rafales';
  faits: number;
  total: number;
  /** `performance.now()` au début de la phase, pour estimer le temps restant. */
  debut: number;
}

/** Avancement de l'analyse en cours, ou `null`. */
export const analyseEnCours = signal<AvancementAnalyse | null>(null);

function photosDuProjet(s: Session): FichierPlan[] {
  return [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive');
}

function empreintesManquantes(s: Session): string[] {
  const candidats = candidatsEmpreinte(photosDuProjet(s).map((f) => ({ id: f.id, taille: f.taille }))).flat();
  return candidats.filter((id) => !s.plan.fichiers.get(id)?.empreinte);
}

/** Reste-t-il des photos à analyser ou des empreintes à calculer ? */
export function analyseAFaire(s: Session): boolean {
  return s.analyses.manquantes(photosDuProjet(s)).length > 0 || empreintesManquantes(s).length > 0;
}

/** Lots actuels (journées tant que le dossier est en vrac, sinon dossiers) et ceux où chercher les rafales. */
function lotsRafales(s: Session): { actuels: string[]; aChercher: string[]; disparus: string[] } {
  const actuels = lotsDoublons(s.plan, s.projet.mode === 'vrac').map((l) => l.id);
  return { actuels, aChercher: lotsAChercher(s.plan, s.doublons, actuels, s.analyses), disparus: lotsDisparus(s.doublons, actuels) };
}

/** Faut-il (re)chercher des rafales ? Seulement une fois les photos analysées. */
export function rafalesAChercher(s: Session): boolean {
  if (s.analyses.manquantes(photosDuProjet(s)).length) return false;
  const l = lotsRafales(s);
  return l.aChercher.length > 0 || l.disparus.length > 0;
}

async function empreinte(fichier: Blob): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', await fichier.arrayBuffer()));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let enCours: Promise<void> | null = null;

/** Lance l'analyse du dossier (une seule à la fois) ; sans effet s'il ne reste rien à faire. */
export function lancerAnalyseDossier(): Promise<void> {
  enCours ??= analyser().finally(() => {
    enCours = null;
    analyseEnCours.value = null;
    versionIA.value++;
  });
  return enCours;
}

async function analyser() {
  const s = session.value;
  if (!s) return;
  // Le projet fermé (ou un autre ouvert), l'analyse s'arrête ; elle reprendra à la réouverture.
  const arreter = () => session.value !== s;
  try {
    const manquantes = s.analyses.manquantes(photosDuProjet(s));
    if (manquantes.length) {
      const debut = performance.now();
      analyseEnCours.value = { phase: 'photos', faits: 0, total: manquantes.length, debut };
      const r = await s.analyses.analyser(
        manquantes,
        groupeWorkers(),
        (f) => s.source.fichier(f.id),
        (faits, total) => (analyseEnCours.value = { phase: 'photos', faits, total, debut }),
        arreter,
      );
      journal('analyse', t`Analyse de ${r.analysees} photos en ${Math.round((performance.now() - debut) / 1000)} s`, r);
      if (r.erreurs) notifier('info', t`${pluriel(r.erreurs, 'photo n’a pas pu être lue', 'photos n’ont pas pu être lues')} (format non reconnu ?).`);
    }
    if (arreter()) return;
    const aCalculer = empreintesManquantes(s);
    if (aCalculer.length) {
      const debut = performance.now();
      let faits = 0;
      analyseEnCours.value = { phase: 'copies', faits, total: aCalculer.length, debut };
      for (const id of aCalculer) {
        if (arreter()) return;
        const e = await empreinte(await s.source.fichier(id));
        // Relu après le calcul : un changement fait entre-temps sur ce fichier n'est pas écrasé.
        const f = s.plan.fichiers.get(id);
        if (f) s.plan.fichiers.set(id, { ...f, empreinte: e });
        analyseEnCours.value = { phase: 'copies', faits: ++faits, total: aCalculer.length, debut };
      }
      planifierEnregistrement();
      versionPlan.value++;
    }
    if (arreter() || !rafalesAChercher(s)) return;
    // Rafales (local, gratuit) : seulement dans les lots jamais cherchés ou dont les photos ont changé.
    const { actuels, aChercher } = lotsRafales(s);
    const debut = performance.now();
    analyseEnCours.value = { phase: 'rafales', faits: 0, total: aChercher.length, debut };
    const r = await analyserDoublons(
      {
        plan: s.plan,
        etat: s.etat,
        analyses: s.analyses,
        dossiers: aChercher,
        actuels,
        strict: s.doublons?.strict ?? false,
        ia: null,
        miniature: (f) => s.source.fichier(f.id),
        original: (f) => s.source.fichier(f.id),
        progres: (faits, total) => (analyseEnCours.value = { phase: 'rafales', faits, total, debut }),
        arreter,
      },
      s.doublons,
    );
    if (arreter()) return;
    s.doublons = r.etat;
    const fichier = (id: string) => s.plan.fichiers.get(id);
    const n = groupesScenes(r.etat.dossiers, fichier).filter((g) => g.sorte === 'rafales' && groupeVisible(g, fichier) && aRelire(g, fichier)).length;
    if (aChercher.length) journal('doublons', t`Rafales cherchées en ${Math.round((performance.now() - debut) / 1000)} s : ${pluriel(n, 'groupe à relire', 'groupes à relire')}`);
  } catch (err) {
    notifier('erreur', t`Analyse interrompue : ${texteErreur(err)}`);
  }
}
