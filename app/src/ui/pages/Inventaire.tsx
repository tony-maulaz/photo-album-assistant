// Étape 2 — Inventaire (SPEC § 6.2, version de la phase 1).

import { useEffect, useRef, useState } from 'preact/hooks';
import { changerTraitement, RACINE, resumes, type TraitementDossier } from '../../lib/plan';
import type { Progression } from '../../navigateur/inventaire';
import { ETAPE, type CodeEtape } from '../../navigateur/projet';
import { BarreProgression, BarreValidation, TeteEtape } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { ExtrasInventaire } from '../composants/ExtrasInventaire';
import { Miniature } from '../composants/GrillePhotos';
import { allerEtape, appliquer, changerEtape, notifier, session, texteErreur, validerEtape, versionPlan, versionProjet } from '../etat';
import { duree, jourCourt, nombre, periode, pluriel, taille } from '../format';
import { construirePlan } from '../projets';

const ETAPES_INVENTAIRE: Record<Progression['etape'], string> = {
  parcours: 'Parcours des dossiers',
  tailles: 'Taille et date des fichiers',
  exif: 'Date, appareil et GPS des photos',
  videos: 'Date des vidéos',
};

const TRAITEMENTS: [TraitementDossier, string][] = [
  ['trier', 'À trier par lieux et sorties'],
  ['garder', 'Garder tel quel'],
  ['ignorer', 'Garder tel quel, hors de l’album'],
];

/** Sous-dossiers déjà présents dans un dossier en vrac (§ 6.2) : trier, garder tel quel, ou hors album. */
function SousDossiers() {
  const s = session.value!;
  const r = resumes(s.plan);
  const dossiers = [...s.plan.dossiers.values()].filter((d) => d.parent === RACINE && d.origine === 'source').sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  const racine = r.get(RACINE)!;
  if (!dossiers.length) return null;
  return (
    <>
      <h2>Sous-dossiers déjà présents</h2>
      <p class="discret">
        Les {pluriel(racine.photos + racine.videos, 'élément')} en vrac à la racine seront triés. Les sous-dossiers déjà nommés (ou les dossiers de mois) sont gardés
        tels quels, sauf si vous choisissez de les trier aussi. Un dossier gardé tel quel n’est jamais modifié (ni floues, ni doublons exacts retirés).
      </p>
      <table class="tableau sous-dossiers">
        <thead>
          <tr>
            <th>Dossier</th>
            <th>Période</th>
            <th class="n">Photos</th>
            <th class="n">Vidéos</th>
            <th>Traitement</th>
          </tr>
        </thead>
        <tbody>
          {dossiers.map((d) => {
            const x = r.get(d.id)!;
            return (
              <tr key={d.id}>
                <td>{d.nom}</td>
                <td>{periode(x.duTotal, x.auTotal)}</td>
                <td class="n">{nombre(x.photosTotal)}</td>
                <td class="n">{nombre(x.videosTotal)}</td>
                <td>
                  <select value={d.traitement ?? 'garder'} onChange={(e) => appliquer(changerTraitement(s.plan, [d.id], e.currentTarget.value as TraitementDossier))} aria-label={`Traitement de ${d.nom}`}>
                    {TRAITEMENTS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p class="actions">
        <button type="button" onClick={() => appliquer(changerTraitement(s.plan, dossiers.map((d) => d.id), 'trier'))}>
          Tout trier
        </button>
        <button type="button" onClick={() => appliquer(changerTraitement(s.plan, dossiers.map((d) => d.id), 'garder'))}>
          Tout garder tel quel
        </button>
      </p>
    </>
  );
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function PageInventaire() {
  const s = session.value!;
  versionPlan.value;
  versionProjet.value;
  const [progression, setProgression] = useState<Progression | null>(null);
  const [debut, setDebut] = useState(0);
  const arreter = useRef(false);

  const lancer = async () => {
    arreter.current = false;
    setDebut(performance.now());
    setProgression({ etape: 'parcours', faits: 0, total: 0 });
    try {
      await construirePlan(setProgression, () => arreter.current);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    } finally {
      setProgression(null);
    }
  };

  // Projet tout neuf : l'inventaire part tout seul.
  useEffect(() => {
    if (!s.projet.inventaire && !progression) void lancer();
  }, [s.projet.id]);

  if (progression || !s.projet.inventaire) {
    const p = progression;
    return (
      <div class="page etroite">
        <TeteEtape numero={ETAPE.inventaire} titre="Inventaire">
          L’application lit chaque fichier du dossier à trier : taille, date de prise de vue, appareil. Rien n’est modifié.
        </TeteEtape>
        {p && (
          <>
            <BarreProgression
              faits={p.faits}
              total={p.total}
              texte={`${ETAPES_INVENTAIRE[p.etape]} : ${nombre(p.faits)}${p.total ? ` / ${nombre(p.total)}` : ''} — ${duree(performance.now() - debut)}`}
            />
            <button type="button" onClick={() => (arreter.current = true)}>
              Arrêter
            </button>
          </>
        )}
        {!p && (
          <button type="button" class="principal" onClick={() => void lancer()}>
            Lancer l’inventaire
          </button>
        )}
      </div>
    );
  }

  const plan = s.plan;
  const fichiers = [...plan.fichiers.values()];
  const archive = fichiers.filter((f) => f.statut === 'archive' && f.categorie !== 'autre');
  const photos = archive.filter((f) => f.categorie === 'photo');
  const videos = archive.filter((f) => f.categorie === 'video');
  const autres = fichiers.filter((f) => f.categorie === 'autre');
  const misDeCote = fichiers.filter((f) => f.statut === 'mis_de_cote');
  const dates = archive.map((f) => f.date).filter((d): d is string => !!d).sort();
  const origines = { exif: 0, nom: 0, video: 0, fichier: 0 };
  for (const f of archive) origines[f.origineDate ?? 'fichier']++;
  const parMois = new Map<string, number>();
  for (const f of photos) if (f.date) parMois.set(f.date.slice(0, 7), (parMois.get(f.date.slice(0, 7)) ?? 0) + 1);
  const mois = [...parMois].sort((a, b) => a[0].localeCompare(b[0]));
  const maxMois = Math.max(1, ...mois.map(([, n]) => n));
  const r = resumes(plan);
  const dossiers = [...plan.dossiers.values()].filter((d) => d.parent !== null);
  const petits = dossiers.filter((d) => {
    const x = r.get(d.id)!;
    return x.photos + x.videos > 0 && x.photos + x.videos < 3;
  });
  const racine = r.get(RACINE)!;
  const inv = s.projet.inventaire;

  return (
    <div class="page avec-barre">
      <TeteEtape numero={ETAPE.inventaire} titre="Inventaire">
        Le contenu du dossier à trier. Vérifiez les nombres et la période, puis passez à l’arborescence.
      </TeteEtape>

      <div class="tableau-bord">
        <div class="tuile-chiffre">
          <strong>{nombre(photos.length)}</strong> photos
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(videos.length)}</strong> vidéos
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(autres.length)}</strong> autres fichiers
        </div>
        <div class="tuile-chiffre">
          <strong>{nombre(dossiers.length)}</strong> dossiers
        </div>
        <div class="tuile-chiffre">
          <strong>{taille(inv.octets)}</strong> au total
        </div>
      </div>

      <p>
        Période : {dates.length ? `du ${jourCourt(dates[0])} au ${jourCourt(dates.at(-1))}` : 'inconnue'}. Inventaire fait en {duree(inv.dureeMs)}.
      </p>

      {mois.length > 0 && (
        <div class="histogramme" aria-label="Photos par mois">
          {mois.map(([m, n]) => (
            <div key={m} class="barre-mois" title={`${MOIS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)} : ${pluriel(n, 'photo')}`}>
              <div class="valeur" style={{ height: `${Math.max(2, (n / maxMois) * 100)}%` }} />
              <span>{MOIS[Number(m.slice(5)) - 1]}</span>
            </div>
          ))}
        </div>
      )}

      <h2>Dates de prise de vue</h2>
      <ul>
        <li>{pluriel(origines.exif, 'photo datée', 'photos datées')} par l’appareil (EXIF) ;</li>
        <li>{nombre(origines.nom)} datées par leur nom de fichier ;</li>
        <li>{nombre(origines.video)} vidéos datées par leurs données internes ;</li>
        <li class={origines.fichier ? 'attention' : ''}>
          {nombre(origines.fichier)} sans autre date que celle du fichier : cette date sera notée dans le rapport, car la copie ne la conserve pas.
        </li>
      </ul>

      {s.projet.mode === 'vrac' && <SousDossiers />}
      {s.projet.mode === 'deja_trie' && (
        <div class="encart">
          <p>
            Ce dossier est déjà trié : vous pouvez chercher les doublons puis réorganiser les dossiers, ou commencer directement là où vous en avez besoin.
          </p>
          <div class="actions">
            {(
              [
                ['doublons', 'Chercher les doublons'],
                ['lieux', 'Réorganiser les dossiers'],
                ['nommage', 'Nommer les dossiers'],
                ['selection', 'Choisir les photos de l’album'],
              ] as [CodeEtape, string][]
            ).map(([code, libelle]) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  changerEtape(ETAPE.inventaire, 'validee');
                  // Commencer ailleurs qu'aux lieux, c'est garder l'arborescence telle quelle : la sortie peut alors être créée.
                  if (code !== 'lieux' && code !== 'doublons') changerEtape(ETAPE.lieux, 'validee');
                  if (s.projet.etapes[ETAPE[code] - 1] !== 'validee') changerEtape(ETAPE[code], 'en_cours');
                  allerEtape(code);
                }}
              >
                {libelle}
              </button>
            ))}
          </div>
        </div>
      )}
      <ExtrasInventaire />

      {(() => {
        const incertaines = photos.filter((f) => f.origineDate === 'fichier');
        const sansGps = photos.filter((f) => !f.gps).length;
        return (
          <>
            <h2>Dates et positions</h2>
            <p>
              {pluriel(photos.length - sansGps, 'photo avec position GPS', 'photos avec position GPS')}, {pluriel(sansGps, 'sans', 'sans')} (rangées avec les photos
              du même jour par le tri automatique ; l’IA peut aider à les situer).
            </p>
            {incertaines.length > 0 && (
              <>
                <p class="attention">
                  {pluriel(incertaines.length, 'photo à date incertaine', 'photos à date incertaine')} (ni EXIF, ni nom daté) : elles sont classées d’après la date
                  du fichier.
                </p>
                <div class="bande-miniatures">
                  {incertaines.slice(0, 12).map((f) => (
                    <span key={f.id} title={f.id}>
                      <Miniature f={f} taille={72} />
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        );
      })()}

      <h2>À savoir</h2>
      <ul>
        {racine.photos + racine.videos > 0 && <li>{pluriel(racine.photos + racine.videos, 'élément')} directement à la racine du dossier (pas dans un sous-dossier).</li>}
        {petits.length > 0 && <li>{pluriel(petits.length, 'petit dossier', 'petits dossiers')} (1 ou 2 photos) : à rattacher ailleurs à l’étape suivante si besoin.</li>}
        {misDeCote.length > 0 && <li>{nombre(misDeCote.length)} élément(s) déjà mis de côté par les anciens scripts (floues, doublons) : ils iront dans « _mis_de_cote ».</li>}
        {inv.ignores.length > 0 && <li>{pluriel(inv.ignores.length, 'fichier ignoré', 'fichiers ignorés')} : l’état d’un ancien projet (dossier « .album »).</li>}
        <li>Les fichiers système masqués par le navigateur (comme « Thumbs.db ») ne sont pas vus : Windows les recrée.</li>
      </ul>

      <BarreValidation
        resume={`${pluriel(inv.fichiers, 'fichier')} dans « ${s.source.racine.name} »`}
        revenir={() => allerEtape('projet')}
        // Dossier en vrac : on enchaîne avec les floues ; dossier déjà trié : avec les doublons.
        valider={() => validerEtape('inventaire')}
      />
      <p class="discret pied">
        <button
          type="button"
          class="lien"
          onClick={async () => {
            if (await confirmer('Refaire l’inventaire ?', 'Le dossier à trier sera relu entièrement. Les changements faits dans l’arborescence seront perdus.', 'Refaire l’inventaire', true)) {
              s.projet.inventaire = undefined;
              versionProjet.value++;
              void lancer();
            }
          }}
        >
          Refaire l’inventaire
        </button>
      </p>
    </div>
  );
}
