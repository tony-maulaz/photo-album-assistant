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
import { BarreValidation } from '../composants/Cadre';
import { AideEtape, LigneEtape } from '../composants/CadreCommun';
import { ResultatTri } from '../composants/ResultatTri';
import { dossiersProposes, memesReglages, restantsTri, TriAuto, useApercuTri, useEtatTri } from '../composants/TriAuto';
import { allerEtape, revenirDe, session, validerEtape, versionPlan } from '../etat';
import { pluriel } from '../format';

export function PageTri() {
  const s = session.value!;
  versionPlan.value;
  if (s.projet.mode === 'deja_trie')
    return (
      <div class="page etroite">
        <LigneEtape titre={t`Tri automatique`} />
        <p>{t`Ce dossier est déjà trié : ses sous-dossiers sont les sorties, il n’y a rien à calculer. Vous pouvez les réorganiser à l’étape suivante.`}</p>
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
      <LigneEtape titre={t`Tri automatique`} aide={{ cle: 'tri' }} taille />
      <AideEtape cle="tri">
        {t`Rangez vos photos en dossiers : un par voyage, un par sortie, et la maison mois par mois. Vos photos d’origine ne bougent pas : l’application prépare un plan, la copie se fait à la dernière étape.`}
      </AideEtape>
      <div class="colonnes-tri">
        <TriAuto e={e} o={o} setO={setO} ap={ap} apercu={apercu} actuel={actuel} />
        <ResultatTri r={actuel ?? apercu} apercu={!actuel} />
      </div>
      <BarreValidation
        resume={e.range ? `${pluriel(photos, 'photo rangée', 'photos rangées')} dans ${pluriel(proposes.length, 'dossier')}` : t`Photos pas encore rangées`}
        alertes={restants.length ? [restants.length === 1 ? t`Encore 1 chose à faire : ${restants[0]}` : t`Encore ${restants.length} choses à faire`] : []}
        revenir={() => revenirDe('tri')}
        valider={() => validerEtape('tri')}
        validerActif={e.range}
        raisonInactif={t`Rangez d’abord les photos.`}
        // Plein une fois rien à faire sur la page (C-4.1) : avant, le plein est sur la prochaine chose à faire.
        fini={e.range && !restants.length && memesReglages(o, optionsDuProjet(s.projet.tri))}
        ecarte
      />
    </div>
  );
}
