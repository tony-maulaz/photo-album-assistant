// Analyse locale des photos (netteté, ressemblance, exposition) : gratuite,
// faite une fois dans les workers et gardée dans `.album/analyse.json`. Elle se
// lance toute seule (D56) : pas de bouton, seulement sa progression.

import { useEffect } from 'preact/hooks';
import { aTraduire, t } from '../../lib/langue';
import type { FichierPlan } from '../../lib/plan';
import { analyseEnCours, lancerAnalyseDossier } from '../analyseDossier';
import { session, versionIA, versionPlan } from '../etat';
import { duree, nombre } from '../format';
import { BarreProgression } from './Cadre';

const PHASES = { photos: aTraduire('Analyse des photos (netteté, ressemblance)'), copies: aTraduire('Recherche des copies exactes') } as const;

/** Barre de progression de l'analyse du dossier, avec le temps restant estimé. */
export function ProgressionAnalyse() {
  const a = analyseEnCours.value;
  if (!a) return <BarreProgression faits={0} total={0} texte={t`Préparation de l’analyse…`} />;
  const ecoule = performance.now() - a.debut;
  const restant = a.faits > 5 ? (ecoule / a.faits) * (a.total - a.faits) : 0;
  return (
    <BarreProgression
      faits={a.faits}
      total={a.total}
      texte={t`${t(PHASES[a.phase])} : ${nombre(a.faits)} / ${nombre(a.total)}` + (restant ? t` · encore ${duree(restant)}` : '')}
    />
  );
}

/** Sur une page qui a besoin de l'analyse : la lance si elle manque, et montre sa progression. */
export function EncartAnalyse({ photos, pourquoi }: { photos: FichierPlan[]; pourquoi: string }) {
  const s = session.value!;
  versionIA.value;
  versionPlan.value;
  const manquantes = s.analyses.manquantes(photos).length;
  useEffect(() => {
    if (manquantes > 0) void lancerAnalyseDossier();
  }, [manquantes > 0]);
  if (!manquantes && !analyseEnCours.value) return null;
  return (
    <div class="encart analyse">
      <ProgressionAnalyse />
      <p class="discret">{t`L’analyse est gratuite et se fait sur cet ordinateur : ${pourquoi}`}</p>
    </div>
  );
}
