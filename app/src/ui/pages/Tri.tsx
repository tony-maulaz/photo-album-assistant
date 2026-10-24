// Étape « Tri automatique » (SPEC § 6.4, script 01) : pour un dossier en
// vrac, les photos sont rangées par lieu et par sortie. Les lieux fréquents
// s'enregistrent d'abord, puis le calcul ; l'étape suivante, « Lieux et
// sorties », sert à vérifier et corriger le résultat (D54).

import { t } from '../../lib/langue';
import { resumes } from '../../lib/plan';
import { ETAPE } from '../../navigateur/projet';
import { SansGps } from '../composants/AidesTri';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { Captures } from '../composants/Captures';
import { CurseurTaille } from '../composants/GrillePhotos';
import { LieuxFrequents } from '../composants/LieuxFrequents';
import { SEUIL_PETIT } from '../composants/PanneauDossiers';
import { dossiersProposes, fichiersARanger, TriAuto } from '../composants/TriAuto';
import { allerEtape, revenirDe, session, validerEtape, versionPlan } from '../etat';
import { pluriel } from '../format';

export function PageTri() {
  const s = session.value!;
  versionPlan.value;
  if (s.projet.mode === 'deja_trie')
    return (
      <div class="page etroite">
        <TeteEtape numero={ETAPE.tri} titre={t`Tri automatique`}>
          {t`Ce dossier est déjà trié : ses sous-dossiers sont les sorties, il n’y a rien à calculer. Vous pouvez les réorganiser à l’étape suivante.`}
        </TeteEtape>
        <button type="button" class="principal" onClick={() => allerEtape('lieux')}>
          {t`Aller aux lieux et sorties`}
        </button>
      </div>
    );

  const r = resumes(s.plan);
  const proposes = dossiersProposes(s.plan);
  const calcule = [...s.plan.dossiers.values()].some((d) => d.origine === 'tri');
  const photos = proposes.reduce((a, d) => a + r.get(d.id)!.photos, 0);
  const petits = proposes.filter((d) => r.get(d.id)!.photos + r.get(d.id)!.videos < SEUIL_PETIT).length;
  // Photos arrivées après le premier tri (D63) : à ranger avant de continuer.
  const nonRangees = calcule ? fichiersARanger(s.plan).length : 0;

  return (
    <div class="page etroite avec-barre">
      <TeteEtape numero={ETAPE.tri} titre={t`Tri automatique par lieux et sorties`} outils={<CurseurTaille />}>
        {t`L’application range les photos par lieu (position GPS) et par sortie (les jours passés au même endroit). Rangez d’abord à part les captures d’écran et enregistrez les lieux qui reviennent souvent (maison, grands-parents…), ajustez les réglages si besoin, puis calculez : vous vérifierez et corrigerez le résultat à l’étape suivante.`}
      </TeteEtape>
      <Captures />
      <LieuxFrequents ouvert={!calcule} />
      <TriAuto />
      {calcule && (
        <div class="encart resume-tri">
          <strong>{pluriel(proposes.length, 'dossier proposé', 'dossiers proposés')}</strong>
          {t` pour ${pluriel(photos, 'photo')}${petits ? t` · ${pluriel(petits, 'petit dossier', 'petits dossiers')} (moins de ${SEUIL_PETIT} photos), à rattacher plus loin` : ''}. Vérifiez-les et corrigez-les à l’étape suivante, en glissant les photos d’un dossier à l’autre.`}
        </div>
      )}
      {calcule && <SansGps />}
      <BarreValidation
        resume={calcule ? `${pluriel(proposes.length, 'dossier proposé', 'dossiers proposés')} · ${pluriel(photos, 'photo')}` : t`Arborescence pas encore calculée`}
        alertes={!calcule ? [t`Calculez l’arborescence pour continuer`] : nonRangees ? [pluriel(nonRangees, 'nouvelle photo pas encore rangée', 'nouvelles photos pas encore rangées')] : []}
        revenir={() => revenirDe('tri')}
        valider={() => validerEtape('tri')}
        validerActif={calcule}
      />
    </div>
  );
}
