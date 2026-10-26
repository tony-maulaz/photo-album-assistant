// IA16 — choisir dans les rafales avec l'IA (D102), depuis l'étape
// « Doublons » : toutes les rafales à valider, celles de la section affichée,
// ou une seule depuis « Comparer en grand ». Le choix de l'IA s'applique comme
// un clic de l'utilisateur, en une seule modification annulable, et seulement
// sur les rafales qu'il n'a pas touchées ; la ★ du groupe (sa clé) ne change pas.

import { signal } from '@preact/signals';
import { estimerDemandes, type DemandeIA, type PhotoIA } from '../lib/aidesSelection';
import { aRelire, choisir, choixEnAttente, groupeVisible, photosDuGroupe, type GroupeDoublons } from '../lib/groupesDoublons';
import { avisValable, demandeRafale, lireRafale, rafaleDemandable, signatureRafale, type AvisRafale } from '../lib/iaRafales';
import { t } from '../lib/langue';
import { combiner } from '../lib/plan';
import { modele as infoModele } from '../lib/tarifs';
import { cleAnalyse } from '../navigateur/analyses';
import { cleApi } from '../navigateur/cle';
import { executerDemande } from '../navigateur/executeur';
import { enParallele } from '../navigateur/workers';
import { confirmer } from './composants/Dialogues';
import { annuler, appliquer, contexteExecution, journal, notifier, page, reglages, session, texteErreur, versionIA, versionPlan, type Session } from './etat';
import { nombre, pluriel } from './format';
import { essai, texteCout, texteEchecs, type BilanEchecs } from './pages/AidesIA';

/** Table des avis dans `aides.json`, indexée par la signature des photos de la rafale. */
export const AIDE_RAFALES = 'IA16';

/** Rafales en cours d'examen par l'IA (une seule fois à la fois). */
export const iaRafales = signal<{ faits: number; total: number } | null>(null);
let arret = false;

/** L'avis de l'IA sur cette rafale, s'il vaut pour exactement ses photos actuelles. */
export function avisDe(s: Session, g: GroupeDoublons): AvisRafale | undefined {
  if (g.sorte !== 'rafales') return undefined;
  const ids = photosDuGroupe(g, (id) => s.plan.fichiers.get(id)).map((x) => x.m.id);
  const a = s.aides.get<Record<string, AvisRafale>>(AIDE_RAFALES)?.[signatureRafale(ids)];
  return avisValable(a, ids) ? a : undefined;
}

/** Rafales que l'IA peut examiner : à valider, pas touchées, sans avis, de 2 à 6 photos. */
export function ciblesIA(s: Session, groupes: GroupeDoublons[]): GroupeDoublons[] {
  const fichier = (id: string) => s.plan.fichiers.get(id);
  return groupes.filter(
    (g) => g.sorte === 'rafales' && groupeVisible(g, fichier) && aRelire(g, fichier) && !choixEnAttente(g, fichier) && rafaleDemandable(photosDuGroupe(g, fichier).length) && !avisDe(s, g),
  );
}

function demandes(s: Session, cibles: GroupeDoublons[]): DemandeIA[] {
  return cibles.map((g) =>
    demandeRafale(
      photosDuGroupe(g, (id) => s.plan.fichiers.get(id)).map((x): PhotoIA => ({ id: x.m.id, identite: cleAnalyse(x.f), date: x.f.date })),
      { contexte: s.projet.contexte },
    ),
  );
}

/** Coût des demandes qui ne sont pas encore en cache (relancer est gratuit). */
function estimer(s: Session, ds: DemandeIA[]): { usd: number; appels: number } {
  const modele = reglages.value.modeles.rapide;
  const m = infoModele(modele);
  const aFaire = ds.filter((d) => !s.ia.enCache(`${d.fonction}|${modele}|${d.cle}`));
  return m ? estimerDemandes(aFaire, m) : { usd: 0, appels: aFaire.length };
}

export function estimationIA(s: Session, cibles: GroupeDoublons[]): { usd: number; appels: number } {
  return estimer(s, demandes(s, cibles));
}

/**
 * Demande l'avis de l'IA sur ces rafales, l'enregistre au fil de l'eau, puis
 * choisit sa photo dans celles qui sont encore à valider et pas touchées.
 */
export async function choisirAvecIA(s: Session, cibles: GroupeDoublons[]): Promise<void> {
  if (iaRafales.value || !cibles.length) return;
  if (!cleApi()) {
    notifier('erreur', t`Saisissez d’abord votre clé API dans Réglages.`, { libelle: t`Réglages`, faire: () => (page.value = { nom: 'reglages' }) });
    return;
  }
  const modele = reglages.value.modeles.rapide;
  const ds = demandes(s, cibles);
  const chf = estimer(s, ds).usd * reglages.value.tauxUsdChf;
  if (chf > s.ia.resteUSD() * reglages.value.tauxUsdChf) {
    notifier('erreur', t`Le budget restant du projet ne suffit pas (environ ${nombre(chf, 2)} CHF nécessaires) : augmentez-le à l’étape 1.`);
    return;
  }
  if (
    chf >= reglages.value.seuilConfirmationChf &&
    !(await confirmer(
      t`Choisir avec l’IA dans ${pluriel(cibles.length, 'rafale')} ?`,
      t`Environ ${nombre(chf, 2)} CHF (au plus). Les photos de chaque rafale sont envoyées en 1568 px à l’IA (api.anthropic.com).`,
      t`Lancer`,
    ))
  )
    return;

  arret = false;
  let faits = 0;
  iaRafales.value = { faits, total: ds.length };
  const bilan: BilanEchecs = { echecs: 0 };
  const ctx = contexteExecution(s);
  try {
    await enParallele(ds, 3, async (d) => {
      if (arret) return;
      const v = await essai(() => executerDemande(ctx, d, modele), bilan);
      if (v !== undefined && v !== null) {
        const avis = lireRafale(v, d.ids);
        if (avis) await s.aides.fusionner(AIDE_RAFALES, { [signatureRafale(d.ids)]: avis });
        else {
          // Lisible mais pas exploitable : « Choisir avec l'IA » la redemandera.
          await s.ia.marquerInexploitable(`${d.fonction}|${modele}|${d.cle}`);
          bilan.echecs++;
        }
      }
      iaRafales.value = { faits: ++faits, total: ds.length };
    });
  } catch (err) {
    notifier('erreur', t`IA interrompue : ${texteErreur(err)}`);
  } finally {
    iaRafales.value = null;
    versionIA.value++;
  }

  // Le choix ne touche que les rafales encore à valider et pas touchées pendant l'attente.
  const plan = s.plan;
  const fichier = (id: string) => plan.fichiers.get(id);
  let choisies = 0;
  let tropDeMonde = 0;
  const modifications = cibles.map((g) => {
    const a = avisDe(s, g);
    if (!a) return null;
    if (!a.meilleure) {
      tropDeMonde++;
      return null;
    }
    if (choixEnAttente(g, fichier) || !aRelire(g, fichier)) return null;
    choisies++;
    return choisir(plan, g, a.meilleure, true);
  });
  const m = combiner(t`Choix de l’IA dans ${pluriel(choisies, 'rafale')}`, ...modifications);
  if (m) appliquer(m);
  versionPlan.value++;
  const examinees = cibles.filter((g) => avisDe(s, g)).length;
  journal('doublons', t`Rafales (IA, ${modele}) : ${pluriel(examinees, 'rafale examinée', 'rafales examinées')}`);
  if (!examinees && !bilan.echecs) return;
  const suite = tropDeMonde ? t` ${pluriel(tropDeMonde, 'rafale', 'rafales')} avec trop de monde : à vous de choisir.` : '';
  notifier(
    bilan.echecs ? 'erreur' : 'ok',
    t`L’IA a examiné ${pluriel(examinees, 'rafale')} : sa photo est choisie, à valider.${suite}${texteEchecs(bilan)}`,
    m ? { libelle: t`Annuler`, faire: annuler } : undefined,
  );
}

/** Bouton « Choisir avec l'IA » d'une portée (l'onglet, la section, une rafale), avec son coût. */
export function BoutonIARafales({ cibles, libelle }: { cibles: GroupeDoublons[]; libelle: string }) {
  const s = session.value!;
  versionIA.value;
  versionPlan.value;
  const enCours = iaRafales.value;
  if (enCours)
    return (
      <span class="ia-rafales-en-cours">
        {t`IA : ${nombre(enCours.faits)} rafales sur ${nombre(enCours.total)}…`}{' '}
        <button type="button" class="lien" onClick={() => (arret = true)}>
          {t`Arrêter`}
        </button>
      </span>
    );
  if (!cibles.length) return null;
  return (
    <button type="button" class="contour" onClick={() => void choisirAvecIA(s, cibles)} title={t`L’IA choisit la meilleure photo de chaque rafale (yeux fermés, regards, flou, personne qui manque) et dit pourquoi ; vous validez.`}>
      {libelle} · {texteCout(estimationIA(s, cibles))}
    </button>
  );
}
