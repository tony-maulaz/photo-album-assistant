// Analyse locale des photos (netteté, ressemblance, exposition) : gratuite,
// faite une fois dans les workers et gardée dans `.album/analyse.json`.

import { useRef, useState } from 'preact/hooks';
import type { FichierPlan } from '../../lib/plan';
import { groupeWorkers, journal, notifier, session, texteErreur, versionIA } from '../etat';
import { duree, pluriel } from '../format';
import { BarreProgression } from './Cadre';

export function useAnalyse() {
  const [progres, setProgres] = useState<{ faits: number; total: number } | null>(null);
  const arreter = useRef(false);
  const debut = useRef(0);

  const lancer = async (photos: FichierPlan[]): Promise<boolean> => {
    const s = session.value;
    if (!s) return false;
    arreter.current = false;
    debut.current = performance.now();
    try {
      const r = await s.analyses.analyser(photos, groupeWorkers(), (f) => s.source.fichier(f.id), (faits, total) => setProgres({ faits, total }), () => arreter.current);
      journal('analyse', `Analyse de ${r.analysees} photos en ${Math.round((performance.now() - debut.current) / 1000)} s`, r);
      if (r.erreurs) notifier('info', `${pluriel(r.erreurs, 'photo n’a pas pu être lue', 'photos n’ont pas pu être lues')} (format non reconnu ?).`);
      return !arreter.current;
    } catch (err) {
      notifier('erreur', `Analyse interrompue : ${texteErreur(err)}`);
      return false;
    } finally {
      setProgres(null);
      versionIA.value++;
    }
  };
  return { progres, lancer, arreter: () => (arreter.current = true), debut };
}

/** Encart « N photos à analyser » avec bouton, progression et arrêt. */
export function EncartAnalyse({ photos, pourquoi }: { photos: FichierPlan[]; pourquoi: string }) {
  const s = session.value!;
  versionIA.value;
  const { progres, lancer, arreter, debut } = useAnalyse();
  const manquantes = s.analyses.manquantes(photos);
  if (!manquantes.length && !progres) return null;
  const ecoule = performance.now() - debut.current;
  const restant = progres && progres.faits > 5 ? (ecoule / progres.faits) * (progres.total - progres.faits) : 0;
  return (
    <div class="encart analyse">
      {progres ? (
        <>
          <BarreProgression faits={progres.faits} total={progres.total} texte={`${progres.faits} / ${progres.total} photos analysées${restant ? ` · encore ${duree(restant)}` : ''}`} />
          <button type="button" onClick={arreter}>
            Arrêter (reprendra là où il s’est arrêté)
          </button>
        </>
      ) : (
        <>
          <p>
            <strong>{pluriel(manquantes.length, 'photo à analyser', 'photos à analyser')}</strong> : {pourquoi} L’analyse est gratuite et se fait sur cet ordinateur
            (environ {duree(manquantes.length * 40)}).
          </p>
          <button type="button" class="principal" onClick={() => void lancer(manquantes)}>
            Analyser les photos
          </button>
        </>
      )}
    </div>
  );
}
