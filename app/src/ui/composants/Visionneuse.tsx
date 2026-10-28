// Visionneuse plein écran (SPEC § 5.4) et dialogue « Déplacer vers… » (touche M).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { aTraduire, t } from '../../lib/langue';
import { avecDetail, cheminDossier, creerDossier, combiner, deplacerFichiers, type FichierPlan } from '../../lib/plan';
import { verifierNomDossier } from '../../lib/noms';
import { appliquer, notifier, session, texteErreur, versionPlan } from '../etat';
import { dateHeure, pluriel, taille as tailleTexte } from '../format';
import { deplacerOuvert, deplacerVers, recents, recentsValides, selection, simplifier, visionneuse } from '../organiser';
import { lignesIA } from '../pages/AidesPhotos';
import { useZoom } from './Zoom';
import { Icone } from './Icones';

const ORIGINES: Record<string, string> = { exif: aTraduire('appareil (EXIF)'), nom: aTraduire('nom du fichier'), video: aTraduire('données de la vidéo'), fichier: aTraduire('date du fichier (incertaine)') };

/** Sans `rangement` (étape Dossiers), l'aide ne promet pas M et Suppr, qui n'y font rien. */
export function Visionneuse({ elements, rangement = true }: { elements: FichierPlan[]; rangement?: boolean }) {
  const s = session.value!;
  const index = visionneuse.value;
  const [url, setUrl] = useState<string | null>(null);
  const f = index !== null ? elements[Math.min(index, elements.length - 1)] : undefined;
  const z = useZoom(f?.id ?? '');

  // La photo affichée est la sélection : M et Suppr agissent sur elle.
  useEffect(() => {
    if (!f) {
      visionneuse.value = null;
      return;
    }
    selection.value = new Set([f.id]);
    let actif = true;
    let u: string | null = null;
    setUrl(null);
    void s.source.fichier(f.id).then((fichier) => {
      if (!actif) return;
      u = URL.createObjectURL(fichier);
      setUrl(u);
    });
    return () => {
      actif = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [f?.id]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') visionneuse.value = null;
      else if (e.key === 'ArrowRight' && index !== null) visionneuse.value = Math.min(elements.length - 1, index + 1);
      else if (e.key === 'ArrowLeft' && index !== null) visionneuse.value = Math.max(0, index - 1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [index, elements.length]);

  if (!f || index === null) return null;
  const origine = ORIGINES[f.origineDate ?? 'fichier'];
  return (
    <div class="visionneuse" role="dialog" aria-label={t`Visionneuse`}>
      <div class="image-visionneuse" ref={z.zone} onClick={() => z.zoom === 1 && (visionneuse.value = null)}>
        {url && f.categorie === 'video' ? (
          <video src={url} controls autoplay onClick={(e) => e.stopPropagation()} />
        ) : url ? (
          <img
            src={url}
            alt={f.nom}
            draggable={false}
            style={{ transform: z.transformation(f.rotation ?? 0) }}
            onClick={(e) => e.stopPropagation()}
            {...z.proprietes}
            title={t`Molette : zoom · glisser : déplacer · double-clic ou 0 : taille de l’écran`}
          />
        ) : (
          <p>{t`Chargement…`}</p>
        )}
      </div>
      <div class="infos-visionneuse">
        <span>
          {index + 1} / {elements.length}
        </span>
        <strong>{f.nom}</strong>
        <span>{dateHeure(f.date)}</span>
        <span class="discret">{t`date : ${origine ? t(origine) : ''}`}</span>
        {f.appareil && <span class="discret">{f.appareil}</span>}
        {f.gps && (
          <span class="discret">
            GPS {f.gps.lat.toFixed(4)}, {f.gps.lon.toFixed(4)}
          </span>
        )}
        {s.analyses.get(f) && <span class="discret">{t`netteté ${Math.round(s.analyses.get(f)!.nettete)}`}</span>}
        {lignesIA(s, f.id).map((l) => (
          <span key={l} class="texte-ia">
            {l}
          </span>
        ))}
        <span class="discret">{tailleTexte(f.taille)}</span>
        <span class="discret">{t`source : ${f.id}`}</span>
        <span class="aide-touches">{rangement ? t`← → pour naviguer · M pour déplacer · Suppr pour mettre de côté · Échap pour fermer` : t`← → pour naviguer · Échap pour fermer`}</span>
      </div>
      {/* Quitter la vue : « Fermer », la croix SVG avec son mot (C-5.2, C-5.3). */}
      <button type="button" class="fermer" onClick={() => (visionneuse.value = null)} title={t`Échap`}>
        <Icone nom="croix" taille={20} />
        {t`Fermer`}
      </button>
    </div>
  );
}

export function DialogueDeplacer() {
  const s = session.value!;
  versionPlan.value;
  const [requete, setRequete] = useState('');
  const [index, setIndex] = useState(0);
  const champ = useRef<HTMLInputElement>(null);
  const ids = [...selection.value];

  // Focus immédiat : les lettres tapées juste après M ne doivent pas se perdre.
  useLayoutEffect(() => champ.current?.focus(), []);

  const dossiers = useMemo(
    () =>
      [...s.plan.dossiers.values()].map((d) => ({ id: d.id, chemin: d.parent === null ? t`Photos (racine)` : cheminDossier(s.plan, d.id) })).sort((a, b) => a.chemin.localeCompare(b.chemin, 'fr', { numeric: true })),
    [versionPlan.value],
  );
  const q = simplifier(requete.trim());
  const proposes = q
    ? dossiers.filter((d) => simplifier(d.chemin).includes(q))
    : [...recentsValides().map((id) => dossiers.find((d) => d.id === id)).filter((d): d is (typeof dossiers)[number] => !!d), ...dossiers.filter((d) => !recents.value.includes(d.id))];
  const creation = requete.trim() && !dossiers.some((d) => simplifier(d.chemin.split('/').at(-1)!) === q) && !verifierNomDossier(requete.trim());
  const options = [...proposes.map((d) => ({ type: 'dossier' as const, ...d })), ...(creation ? [{ type: 'creer' as const, id: '', chemin: requete.trim() }] : [])];
  const choix = Math.min(index, options.length - 1);

  const fermer = () => (deplacerOuvert.value = false);
  const valider = (o = options[choix]) => {
    if (!o) return;
    fermer();
    if (o.type === 'dossier') deplacerVers(o.id, ids);
    else {
      try {
        const { id, modification } = creerDossier(s.plan, o.chemin);
        appliquer(avecDetail(combiner(t`Créer 1 dossier`, modification, deplacerFichiers(s.plan, ids, id)), t`Nouveau dossier « ${o.chemin} »`));
        recents.value = [id, ...recents.value].slice(0, 9);
        selection.value = new Set();
        notifier('ok', t`Dossier « ${o.chemin} » créé avec ${ids.length} élément(s).`);
      } catch (err) {
        notifier('erreur', texteErreur(err));
      }
    }
  };

  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div class="dialogue deplacer" role="dialog" aria-label={t`Déplacer vers un dossier`}>
        <h2>{t`Déplacer ${pluriel(ids.length, 'élément')} vers…`}</h2>
        <input
          ref={champ}
          class="large"
          placeholder={t`Tapez une partie du nom du dossier`}
          value={requete}
          onInput={(e) => {
            setRequete(e.currentTarget.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') fermer();
            else if (e.key === 'ArrowDown') setIndex(Math.min(options.length - 1, choix + 1));
            else if (e.key === 'ArrowUp') setIndex(Math.max(0, choix - 1));
            else if (e.key === 'Enter') valider();
            else return;
            e.preventDefault();
          }}
        />
        <ul class="choix-dossiers">
          {options.slice(0, 200).map((o, i) => (
            <li key={`${o.type}${o.id}`} class={i === choix ? 'actif' : ''} onMouseEnter={() => setIndex(i)} onClick={() => valider(o)}>
              {o.type === 'creer' ? (
                <>
                  {t`+ Créer le dossier « `}
                  <strong>{o.chemin}</strong>
                  {t` »`}
                </>
              ) : (
                <>
                  {recentsValides().indexOf(o.id) >= 0 && !q && <span class="touche">{recentsValides().indexOf(o.id) + 1}</span>}
                  {o.chemin}
                </>
              )}
            </li>
          ))}
        </ul>
        <p class="discret">{t`↑ ↓ pour choisir, Entrée pour déplacer, Échap pour fermer.`}</p>
      </div>
    </div>
  );
}
