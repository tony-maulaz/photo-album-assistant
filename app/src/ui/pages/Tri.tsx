// Étape « Tri automatique » (SPEC § 6.4, D103) : pour un dossier en vrac, les
// photos sont rangées dans l'ordre du temps — un dossier par voyage (avec ses
// étapes), par sortie, et la maison mois par mois. En haut, la liste « À
// faire » et les réglages à gauche ; à droite, toujours sous les yeux, les
// dossiers ligne par ligne, avec des onglets comme aux Doublons, en direct
// avant de ranger (D104, D105). L'étape suivante, « Lieux et sorties », sert
// à corriger photo par photo (D54).

import { useMemo, useState } from 'preact/hooks';
import { t } from '../../lib/langue';
import { resumes } from '../../lib/plan';
import { resultatDuPlan, resultatPropose } from '../../lib/resultatTri';
import { optionsDuProjet, type OptionsTri } from '../../lib/tri';
import { ETAPE } from '../../navigateur/projet';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { CurseurTaille } from '../composants/GrillePhotos';
import { ResultatTri } from '../composants/ResultatTri';
import { dossiersProposes, restantsTri, TriAuto, useApercuTri, useEtatTri } from '../composants/TriAuto';
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
  return <PageTriVrac />;
}

function PageTriVrac() {
  const s = session.value!;
  const e = useEtatTri();
  const [o, setO] = useState<OptionsTri>(() => optionsDuProjet(s.projet.tri));
  const ap = useApercuTri(e, o);
  const apercu = useMemo(() => resultatPropose(ap.apercu, (id) => s.plan.fichiers.get(id), e.capturesRangees), [ap.apercu, e.capturesRangees]);
  const actuel = useMemo(() => (e.range ? resultatDuPlan(s.plan, e.domicile) : null), [versionPlan.value, e.range, e.domicile]);
  const r = resumes(s.plan);
  const proposes = dossiersProposes(s.plan);
  const photos = proposes.reduce((a, d) => a + r.get(d.id)!.photos, 0);
  const restants = restantsTri(e);

  return (
    <div class="page avec-barre page-tri">
      <TeteEtape numero={ETAPE.tri} titre={t`Tri automatique`} cle="tri" outils={<CurseurTaille />}>
        {t`L’application range vos photos dans l’ordre du temps : un dossier par voyage (avec ses étapes), un par sortie, et la maison mois par mois. Le calendrier ne découpe rien : il propose des noms, que vous choisirez au Nommage. Faites d’abord ce qui est marqué ● ; ce qui est marqué ○ est facultatif. Vos dossiers se voient à droite, et suivent vos réglages.`}
      </TeteEtape>
      <div class="colonnes-tri">
        <TriAuto e={e} o={o} setO={setO} ap={ap} apercu={apercu} actuel={actuel} />
        <ResultatTri r={actuel ?? apercu} apercu={!actuel} />
      </div>
      <BarreValidation
        resume={e.range ? `${pluriel(photos, 'photo rangée', 'photos rangées')} dans ${pluriel(proposes.length, 'dossier')}` : t`Photos pas encore rangées`}
        alertes={restants.length ? [restants.length === 1 ? t`● Encore 1 chose à faire : ${restants[0]}` : t`● Encore ${restants.length} choses à faire : ${restants.join(', ')}`] : []}
        revenir={() => revenirDe('tri')}
        valider={() => validerEtape('tri')}
        validerActif={e.range}
      />
    </div>
  );
}
