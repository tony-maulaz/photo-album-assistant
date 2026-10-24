// Suggestion de lieux connus (étape « Tri automatique », § 6.4) : un endroit photographié sur de
// nombreux jours (maison, grands-parents, école, club) peut être enregistré
// comme lieu connu sans quitter la page.

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { FichierPlan } from '../../lib/plan';
import { nomAscii } from '../../lib/noms';
import { lieuxFrequents } from '../../lib/tri';
import { configuration, notifier, reglages, session, texteErreur, versionPlan } from '../etat';
import { dateHeure, nombre, pluriel } from '../format';
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
  const [deplies, setDeplies] = useState<Set<string>>(new Set());
  // Nom du lieu proche (OpenStreetMap, mis en cache comme pour le tri) : aide à reconnaître l'endroit.
  const [procheDe, setProcheDe] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!suggestions.length) return;
    let actif = true;
    void s.geocodage
      .nommer(suggestions, reglages.value.emailNominatim, () => undefined, () => !actif)
      .then((noms) => actif && setProcheDe(Object.fromEntries(suggestions.flatMap((l, i) => (noms[i] ? [[`${l.lat},${l.lon}`, noms[i]!]] : [])))))
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [suggestions]);
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
      <p class="discret">
        Un lieu enregistré reçoit son propre dossier (« Maison », « Chez_Grands_Parents »…), rangé par sortie. Le nom proche vient d’OpenStreetMap (seules les
        coordonnées sont envoyées).
      </p>
      <ul class="lieux-frequents">
        {visibles.map((l) => {
          const cle = `${l.lat},${l.lon}`;
          const photos = l.photos.map((id) => s.plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f);
          const toutes = deplies.has(cle);
          return (
            <li key={cle} class="lieu-frequent">
              <div class="tete-lieu">
                <strong>{pluriel(photos.length, 'photo')}</strong>
                <span class="discret">
                  sur {nombre(l.jours)} jours{procheDe[cle] ? ` · près de « ${procheDe[cle]} »` : ''} · ({l.lat.toFixed(4)}, {l.lon.toFixed(4)})
                </span>
              </div>
              {/* Une photo par jour, pour reconnaître l'endroit d'un coup d'œil ; toutes sur demande. */}
              <div class="bande-miniatures">
                {(toutes ? photos.slice(0, 120) : unParJour(photos, 8)).map((f) => (
                  <span key={f.id} title={`${f.nom} — ${dateHeure(f.date)}`}>
                    <Miniature f={f} taille={toutes ? 96 : 80} />
                  </span>
                ))}
              </div>
              <div class="actions-lieu">
                <button type="button" class="lien" onClick={() => setDeplies(new Set(toutes ? [...deplies].filter((x) => x !== cle) : [...deplies, cle]))}>
                  {toutes ? 'Moins de photos' : `Voir les ${nombre(photos.length)} photos`}
                </button>
                <span class="espace" />
                <input placeholder="Nom du lieu (ex. Maison)" value={noms[cle] ?? ''} onInput={(e) => setNoms({ ...noms, [cle]: e.currentTarget.value })} />
                <button type="button" onClick={() => void enregistrer(l.lat, l.lon, cle)}>
                  Enregistrer comme lieu connu
                </button>
                <button type="button" class="lien" onClick={() => setIgnores(new Set([...ignores, cle]))}>
                  ignorer
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Jusqu'à `n` photos prises des jours différents (la première de chaque jour), réparties sur la période. */
function unParJour(photos: FichierPlan[], n: number): FichierPlan[] {
  const parJour = new Map<string, FichierPlan>();
  for (const f of [...photos].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
    const j = f.date?.slice(0, 10) ?? '';
    if (!parJour.has(j)) parJour.set(j, f);
  }
  const jours = [...parJour.values()];
  if (jours.length <= n) return jours;
  return Array.from({ length: n }, (_, i) => jours[Math.round((i * (jours.length - 1)) / (n - 1))]);
}
