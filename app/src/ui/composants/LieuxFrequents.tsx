// Suggestion de lieux connus (étape « Tri automatique », § 6.4) : un endroit photographié sur de
// nombreux jours (maison, grands-parents, école, club) peut être enregistré
// comme lieu connu sans quitter la page.

import { useMemo, useState } from 'preact/hooks';
import { nomAscii } from '../../lib/noms';
import { lieuxFrequents } from '../../lib/tri';
import { configuration, notifier, session, texteErreur, versionPlan } from '../etat';
import { nombre, pluriel } from '../format';
import { Miniature } from './GrillePhotos';

/** `ouvert` : la liste est dépliée (avant le calcul, c'est le moment de les enregistrer). */
export function LieuxFrequents({ ouvert = false }: { ouvert?: boolean }) {
  const s = session.value!;
  versionPlan.value;
  const c = configuration.value;
  const lieux = c?.lecture?.config?.lieux_connus ?? [];
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [ignores, setIgnores] = useState<Set<string>>(new Set());
  const suggestions = useMemo(
    () =>
      lieuxFrequents(
        [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.gps).map((f) => ({ id: f.id, nom: f.nom, date: f.date, gps: f.gps })),
        lieux,
      ).slice(0, 6),
    [versionPlan.value, lieux.length],
  );
  const visibles = suggestions.filter((l) => !ignores.has(`${l.lat},${l.lon}`));
  if (!visibles.length) return null;

  const enregistrer = async (lat: number, lon: number, cle: string) => {
    const nom = nomAscii(noms[cle] ?? '').replace(/^_+|_+$/g, '');
    if (!nom) {
      notifier('erreur', 'Donnez d’abord un nom au lieu (ex. Chez_Grands_Parents).');
      return;
    }
    if (!c?.lecture?.config) {
      notifier('erreur', 'Choisissez d’abord le dossier de configuration (page Configuration).');
      return;
    }
    try {
      const cfg = structuredClone(c.lecture.config);
      cfg.lieux_connus.push({ id: nom.toLowerCase(), nom, lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)), rayon_m: 150, domicile: false, un_seul_dossier: false, notes: 'suggéré au tri automatique' });
      configuration.value = { dossier: c.dossier, lecture: await c.dossier.ecrire(cfg, c.lecture) };
      notifier('ok', `Lieu « ${nom} » enregistré : recalculez l’arborescence pour en tenir compte.`);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  return (
    <details class="tri-auto" open={ouvert}>
      <summary>
        <strong>{pluriel(visibles.length, 'lieu qui revient souvent', 'lieux qui reviennent souvent')}</strong> — à enregistrer comme lieu connu (maison,
        grands-parents, école…)
      </summary>
      <ul class="lieux-frequents">
        {visibles.map((l) => {
          const cle = `${l.lat},${l.lon}`;
          const exemple = s.plan.fichiers.get(l.photos[0]);
          return (
            <li key={cle}>
              {exemple && <Miniature f={exemple} taille={56} />}
              <span>
                {nombre(l.jours)} jours, {pluriel(l.photos.length, 'photo')} ({l.lat.toFixed(4)}, {l.lon.toFixed(4)})
              </span>
              <input placeholder="Nom du lieu" value={noms[cle] ?? ''} onInput={(e) => setNoms({ ...noms, [cle]: e.currentTarget.value })} />
              <button type="button" onClick={() => void enregistrer(l.lat, l.lon, cle)}>
                Enregistrer comme lieu connu
              </button>
              <button type="button" class="lien" onClick={() => setIgnores(new Set([...ignores, cle]))}>
                ignorer
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
