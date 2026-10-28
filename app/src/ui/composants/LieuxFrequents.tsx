// Suggestion de lieux connus (étape « Tri automatique », § 6.4) : un endroit photographié sur de
// nombreux jours (maison, grands-parents, école, club) peut être enregistré
// comme lieu connu sans quitter la page, même s'il faut d'abord choisir ou
// créer le dossier de configuration. Dans une grande fenêtre, une carte par
// endroit (D107) : ses photos, son adresse, un nom, « C'est notre maison ».

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
import { RaisonDesactivee } from './Cadre';
import { Fenetre } from './Dialogues';
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

/** Nombre de lieux fréquents proposés au tri (ni enregistrés, ni écartés pour la séance). */
export function useLieuxProposes(): number {
  const s = session.value!;
  const lieux = configuration.value?.lecture?.config?.lieux_connus ?? [];
  const caches = ignores.value;
  return useMemo(() => suggestions(s.plan, lieux).filter((l) => !caches.has(cleLieu(l))).length, [versionPlan.value, lieux.length, caches]);
}

/** La fenêtre des lieux fréquents ; `fermer` la ferme (aussi quand il n'en reste plus). */
export function LieuxFrequents({ fermer }: { fermer: () => void }) {
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
  // Plus rien à nommer (le dernier vient d'être enregistré ou écarté) : la fenêtre se ferme.
  useEffect(() => {
    if (!visibles.length) fermer();
  }, [visibles.length]);
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
          ? t`« ${nom} » enregistré comme votre maison : les voyages sont maintenant reconnus.`
          : t`« ${nom} » enregistré : il servira pour les noms de vos dossiers (rangez à nouveau si c’est déjà fait).`,
      );
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  return (
    <Fenetre
      titre={t`Endroits qui reviennent souvent`}
      intro={
        sansDomicile
          ? t`Photographiés sur de nombreux jours. Donnez-leur un nom : il servira pour vos dossiers (« Chez_Mamie_12.03.25 » plutôt que le nom de la commune). Indiquez aussi lequel est votre maison.`
          : t`Photographiés sur de nombreux jours. Donnez-leur un nom : il servira pour vos dossiers (« Chez_Mamie_12.03.25 » plutôt que le nom de la commune).`
      }
      pied={t`Un nom enregistré sert à tous vos albums. « Pas maintenant » : l’endroit n’est plus proposé pendant cette séance. L’adresse vient d’OpenStreetMap : seule la position est envoyée.`}
      fermer={fermer}
    >
      <ul class="lieux-frequents">
        {visibles.map((l) => {
          const cle = cleLieu(l);
          const photos = l.photos.map((id) => s.plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f);
          const toutes = deplies.has(cle);
          const estDomicile = sansDomicile && domicile === cle;
          const nom = noms[cle] ?? '';
          return (
            <li key={cle} class="lieu-frequent">
              <div class="vignettes-lieu">
                {unParJour(photos, 6).map((f) => (
                  <span key={f.id} title={`${f.nom} — ${dateHeure(f.date)}`}>
                    <Miniature f={f} taille={84} />
                  </span>
                ))}
              </div>
              <div class="infos-lieu">
                <strong class={`adresse-lieu${adresses[cle] ? '' : ' discret'}`} title={t`Coordonnées : ${l.lat.toFixed(4)}, ${l.lon.toFixed(4)}`}>
                  {adresses[cle] ?? (sansAdresse ? t`Adresse indisponible (pas de connexion)` : t`Recherche de l’adresse…`)}
                </strong>
                <span class="discret">
                  {t`${pluriel(photos.length, 'photo')} sur ${nombre(l.jours)} jours`} ·{' '}
                  <button type="button" class="lien" onClick={() => setDeplies(new Set(toutes ? [...deplies].filter((x) => x !== cle) : [...deplies, cle]))}>
                    {toutes ? t`Moins de photos` : t`Voir toutes les photos`}
                  </button>
                </span>
                {toutes && (
                  <div class="bande-miniatures">
                    {photos.slice(0, 120).map((f) => (
                      <span key={f.id} title={`${f.nom} — ${dateHeure(f.date)}`}>
                        <Miniature f={f} taille={Math.round(reglages.value.tailleMiniatures * 0.5)} />
                      </span>
                    ))}
                  </div>
                )}
                <div class="champ-lieu">
                  <input
                    type="text"
                    aria-label={t`Nom de l’endroit`}
                    placeholder={estDomicile ? t`Maison` : t`Son nom, par exemple « Chez Mamie »`}
                    value={nom}
                    onInput={(e) => setNoms({ ...noms, [cle]: e.currentTarget.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (nom.trim() || estDomicile) && void enregistrer(l.lat, l.lon, cle)}
                  />
                  {/* Contour : une ligne par endroit, aucun ne prend le seul bouton plein (C-4.1) ; désactivé, il garde son nom et sa raison est écrite à côté (C-4.7). */}
                  <button type="button" disabled={!nom.trim() && !estDomicile} aria-describedby={!nom.trim() && !estDomicile ? `raison-lieu-${cle}` : undefined} onClick={() => void enregistrer(l.lat, l.lon, cle)}>
                    {t`Enregistrer`}
                  </button>
                  <RaisonDesactivee id={`raison-lieu-${cle}`} raison={!nom.trim() && !estDomicile && t`Donnez-lui d’abord un nom`} />
                </div>
                {sansDomicile && (
                  <label class="case" title={t`La maison sert à reconnaître les voyages et les sorties.`}>
                    <input type="radio" name="domicile-propose" checked={estDomicile} onChange={() => setDomicile(cle)} /> {t`C’est notre maison`}
                  </label>
                )}
                <button type="button" class="petit pas-maintenant" onClick={() => (ignores.value = new Set([...ignores.value, cle]))}>
                  {t`Pas maintenant`}
                </button>
                {attente === cle && (
                  <ChoixConfiguration
                    pourquoi={t`Les lieux connus sont gardés dans un dossier de configuration : choisissez-le ou créez-le, le lieu sera enregistré aussitôt.`}
                    apres={() => enregistrer(l.lat, l.lon, cle)}
                    annuler={() => setAttente(null)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Fenetre>
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
