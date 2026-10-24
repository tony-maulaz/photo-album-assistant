// Suggestion de lieux connus (étape « Tri automatique », § 6.4) : un endroit photographié sur de
// nombreux jours (maison, grands-parents, école, club) peut être enregistré
// comme lieu connu sans quitter la page, même s'il faut d'abord choisir ou
// créer le dossier de configuration.

import { signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { LieuConnu } from '../../lib/config';
import { t } from '../../lib/langue';
import type { FichierPlan, Plan } from '../../lib/plan';
import { nomAscii, nouvelIdLieu } from '../../lib/noms';
import { nomsSortie } from '../../lib/sortie';
import { distanceM, lieuxFrequents, type LieuFrequent } from '../../lib/tri';
import { configuration, notifier, reglages, session, texteErreur, versionPlan } from '../etat';
import { dateHeure, nombre, pluriel } from '../format';
import { ChoixConfiguration } from './ChoixConfiguration';
import { Miniature } from './GrillePhotos';

/** Lieux écartés d'un clic (« ignorer ») pendant la session. */
const ignores = signal<ReadonlySet<string>>(new Set());

const cleLieu = (l: { lat: number; lon: number }) => `${l.lat},${l.lon}`;

/** Lieux qui reviennent souvent (six au plus), pas encore enregistrés. */
function suggestions(plan: Plan, lieux: LieuConnu[]): LieuFrequent[] {
  return lieuxFrequents(
    [...plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.gps).map((f) => ({ id: f.id, nom: f.nom, date: f.date, gps: f.gps })),
    lieux,
  ).slice(0, 6);
}

/** Des lieux fréquents sont-ils proposés au-dessus des réglages du tri (ni enregistrés, ni ignorés) ? */
export function useLieuxProposes(): boolean {
  const s = session.value!;
  const lieux = configuration.value?.lecture?.config?.lieux_connus ?? [];
  const caches = ignores.value;
  return useMemo(() => suggestions(s.plan, lieux).some((l) => !caches.has(cleLieu(l))), [versionPlan.value, lieux.length, caches]);
}

/** `ouvert` : la liste est dépliée (avant le calcul, c'est le moment de les enregistrer). */
export function LieuxFrequents({ ouvert = false }: { ouvert?: boolean }) {
  const s = session.value!;
  versionPlan.value;
  const lieux = configuration.value?.lecture?.config?.lieux_connus ?? [];
  const [noms, setNoms] = useState<Record<string, string>>({});
  const proposes = useMemo(() => suggestions(s.plan, lieux), [versionPlan.value, lieux.length]);
  const visibles = proposes.filter((l) => !ignores.value.has(cleLieu(l)));
  const [deplies, setDeplies] = useState<Set<string>>(new Set());
  // Adresse précise (OpenStreetMap, mise en cache) : aide à reconnaître l'endroit (D59).
  const [adresses, setAdresses] = useState<Record<string, string>>({});
  // Sans connexion, l'adresse ne viendra pas : on le dit au lieu de la chercher indéfiniment.
  const [sansAdresse, setSansAdresse] = useState(false);
  useEffect(() => {
    if (!proposes.length) return;
    let actif = true;
    void s.geocodage
      .adresser(proposes, reglages.value.emailNominatim, () => !actif)
      .then((r) => actif && setAdresses(Object.fromEntries(proposes.flatMap((l, i) => (r[i] ? [[cleLieu(l), r[i]!]] : [])))))
      .catch(() => actif && setSansAdresse(true));
    return () => {
      actif = false;
    };
  }, [proposes]);
  // Le domicile sert à repérer les voyages : proposé tant qu'aucun lieu ne l'est.
  const [domicile, setDomicile] = useState<string | null>(null);
  const sansDomicile = !lieux.some((l) => l.domicile);
  // Lieu à enregistrer qui attend le dossier de configuration (choisi ou créé sans quitter l'étape).
  const [attente, setAttente] = useState<string | null>(null);
  if (!visibles.length) return null;

  const enregistrer = async (lat: number, lon: number, cle: string) => {
    const estDomicile = sansDomicile && domicile === cle;
    const nom = nomAscii(noms[cle] || (estDomicile ? nomsSortie().maison : '')).replace(/^_+|_+$/g, '');
    if (!nom) {
      notifier('erreur', t`Donnez d’abord un nom au lieu (ex. Chez_Grands_Parents).`);
      return;
    }
    // Lue au moment d'enregistrer : elle vient peut-être d'être choisie.
    const c = configuration.value;
    if (!c?.lecture?.config) {
      setAttente(cle);
      return;
    }
    setAttente(null);
    const deja = c.lecture.config.lieux_connus.find((l) => distanceM(lat, lon, l.lat, l.lon) <= l.rayon_m);
    if (deja) {
      notifier('info', t`Ce lieu est déjà enregistré dans la configuration : « ${deja.nom} ».`);
      return;
    }
    try {
      const cfg = structuredClone(c.lecture.config);
      // La configuration choisie a peut-être déjà un domicile : un seul.
      const commeDomicile = estDomicile && !cfg.lieux_connus.some((l) => l.domicile);
      cfg.lieux_connus.push({
        id: nouvelIdLieu(nom, cfg.lieux_connus.map((l) => l.id)),
        nom,
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        rayon_m: 150,
        domicile: commeDomicile,
        un_seul_dossier: false,
        notes: 'suggéré au tri automatique',
      });
      configuration.value = { dossier: c.dossier, lecture: await c.dossier.ecrire(cfg, c.lecture) };
      notifier(
        'ok',
        commeDomicile
          ? t`Domicile « ${nom} » enregistré : les voyages seront repérés au prochain calcul de l’arborescence.`
          : t`Lieu « ${nom} » enregistré : recalculez l’arborescence pour en tenir compte.`,
      );
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  return (
    <details class="tri-auto" open={ouvert}>
      <summary>
        <strong>{pluriel(visibles.length, 'lieu qui revient souvent', 'lieux qui reviennent souvent')}</strong> {t`— à enregistrer comme lieu connu (maison, grands-parents, école…)`}
      </summary>
      <p class="discret">
        {t`Un lieu enregistré reçoit son propre dossier (« Maison », « Chez_Grands_Parents »…), rangé par sortie. L’adresse vient d’OpenStreetMap (seules les coordonnées sont envoyées).`}
      </p>
      <ul class="lieux-frequents">
        {visibles.map((l) => {
          const cle = cleLieu(l);
          const photos = l.photos.map((id) => s.plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f);
          const toutes = deplies.has(cle);
          return (
            <li key={cle} class="lieu-frequent">
              <div class="tete-lieu">
                <strong>{pluriel(photos.length, 'photo')}</strong>
                <span class="discret">{t`sur ${nombre(l.jours)} jours ·`}</span>
                <span class="adresse-lieu" title={t`Coordonnées : ${l.lat.toFixed(4)}, ${l.lon.toFixed(4)}`}>
                  {adresses[cle] ?? (sansAdresse ? t`Adresse indisponible (OpenStreetMap injoignable)` : t`Recherche de l’adresse…`)}
                </span>
              </div>
              {/* Une photo par jour, pour reconnaître l'endroit d'un coup d'œil ; toutes sur demande. */}
              <div class="bande-miniatures">
                {(toutes ? photos.slice(0, 120) : unParJour(photos, 8)).map((f) => (
                  <span key={f.id} title={`${f.nom} — ${dateHeure(f.date)}`}>
                    <Miniature f={f} taille={Math.round(reglages.value.tailleMiniatures * (toutes ? 0.6 : 0.5))} />
                  </span>
                ))}
              </div>
              <div class="actions-lieu">
                <button type="button" class="lien" onClick={() => setDeplies(new Set(toutes ? [...deplies].filter((x) => x !== cle) : [...deplies, cle]))}>
                  {toutes ? t`Moins de photos` : t`Voir les ${nombre(photos.length)} photos`}
                </button>
                <span class="espace" />
                <input placeholder={t`Nom du lieu (ex. Maison)`} value={noms[cle] ?? ''} onInput={(e) => setNoms({ ...noms, [cle]: e.currentTarget.value })} />
                {sansDomicile && (
                  <label class="case" title={t`Le domicile sert à repérer les voyages (sorties loin de la maison qui s’enchaînent).`}>
                    <input type="checkbox" checked={domicile === cle} onChange={(e) => setDomicile(e.currentTarget.checked ? cle : null)} /> {t`C’est notre domicile`}
                  </label>
                )}
                <button type="button" onClick={() => void enregistrer(l.lat, l.lon, cle)}>
                  {t`Enregistrer comme lieu connu`}
                </button>
                <button type="button" class="lien" onClick={() => (ignores.value = new Set([...ignores.value, cle]))}>
                  {t`ignorer`}
                </button>
              </div>
              {attente === cle && (
                <ChoixConfiguration
                  pourquoi={t`Les lieux connus sont gardés dans un dossier de configuration : choisissez-le ou créez-le, le lieu sera enregistré aussitôt.`}
                  apres={() => enregistrer(l.lat, l.lon, cle)}
                  annuler={() => setAttente(null)}
                />
              )}
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
