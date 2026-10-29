// Tri rapide (SPEC § 6.9) : plein écran, photo par photo. Espace = ★,
// 2 = ★★, X = pas pour l’album, Retour arrière = à décider, ← → pour naviguer, R pour
// tourner. Chaque choix passe à la photo suivante ; après la dernière, un
// encart dit si tout est décidé ou mène à la première photo encore à décider.

import { useEffect, useRef, useState } from 'preact/hooks';
import { LIBELLES_SIGNAUX } from '../../lib/indicateurs';
import { aTraduire, t } from '../../lib/langue';
import { cheminDossier } from '../../lib/plan';
import { session, versionPlan } from '../etat';
import { dateHeure, nombre, pluriel } from '../format';
import { choisir, triRapide, tournerPhotos, type InfoPhoto } from '../selection';
import { lignesIA } from '../pages/AidesPhotos';
import { Icone } from './Icones';
import { useOriginal } from './Comparateur';
import { useZoom } from './Zoom';

const ETAT = { 0: aTraduire('Pas pour l’album'), 1: aTraduire('★ Dans l’album'), 2: aTraduire('★★ Grande photo') } as const;

export function TriRapide({ infos }: { infos: Map<string, InfoPhoto> }) {
  const s = session.value!;
  versionPlan.value;
  const tri = triRapide.value!;
  const ids = tri.ids.filter((id) => s.plan.fichiers.has(id));
  const index = Math.min(tri.index, ids.length - 1);
  const f = s.plan.fichiers.get(ids[index]);
  const url = useOriginal(f);
  const z = useZoom(f?.id ?? '');
  const reste = ids.filter((id) => s.plan.fichiers.get(id)?.album === undefined).length;
  // Fin de la liste atteinte (choix ou → sur la dernière photo) : l'encart de fin s'affiche.
  const [fin, setFin] = useState(false);
  const finRef = useRef(fin);
  finRef.current = fin;

  /** Liste et position au moment de l'appel : des touches pressées vite n'agissent pas sur une photo déjà passée. */
  const courant = () => {
    const tr = triRapide.value;
    const plan = session.value?.plan;
    if (!tr || !plan) return null;
    const liste = tr.ids.filter((id) => plan.fichiers.has(id));
    const i = Math.min(tr.index, liste.length - 1);
    return i < 0 ? null : { tr, liste, i, id: liste[i] };
  };
  const aller = (i: number) => {
    const c = courant();
    if (!c) return;
    setFin(false);
    triRapide.value = { ids: c.tr.ids, index: Math.max(0, Math.min(c.liste.length - 1, i)) };
  };
  const suivante = () => {
    const c = courant();
    if (c && c.i >= c.liste.length - 1) setFin(true);
    else if (c) aller(c.i + 1);
  };
  const premiere = () => {
    const c = courant();
    const plan = session.value?.plan;
    const i = c && plan ? c.liste.findIndex((id) => plan.fichiers.get(id)?.album === undefined) : -1;
    if (i >= 0) aller(i);
    else triRapide.value = null;
  };

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const c = courant();
      if (!c) return;
      const k = e.key;
      if (k === 'Escape') triRapide.value = null;
      else if (finRef.current && k === 'Enter') premiere();
      else if (k === 'ArrowRight') suivante();
      else if (k === 'ArrowLeft') aller(finRef.current ? c.i : c.i - 1);
      else if (k === ' ' || k === '1') {
        choisir([c.id], 1);
        suivante();
      } else if (k === '2') {
        choisir([c.id], 2);
        suivante();
      } else if (k.toLowerCase() === 'x') {
        choisir([c.id], 0);
        suivante();
      } else if (k === 'Backspace' || k === 'Delete') choisir([c.id], undefined);
      else if (k.toLowerCase() === 'r') tournerPhotos([c.id], e.shiftKey ? -90 : 90);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, []);

  if (!f) {
    triRapide.value = null;
    return null;
  }
  const info = infos.get(f.id);
  return (
    <div class="tri-rapide" role="dialog" aria-label={t`Tri rapide`}>
      <div class={`tri-image${z.zoom > 1 ? ' zoomee' : ''}`} ref={z.zone} {...z.proprietes} title={t`Molette : zoom · glisser : déplacer · double-clic ou 0 : taille de l’écran`}>
        {url ? (
          <img src={url} alt={f.nom} draggable={false} class={f.rotation === 90 || f.rotation === 270 ? 'quart' : ''} style={{ transform: z.transformation(f.rotation ?? 0) }} />
        ) : (
          <p>{t`Chargement…`}</p>
        )}
      </div>
      <div class="tri-infos">
        <span>
          {index + 1} / {ids.length}
        </span>
        <strong class={`choix-actuel a${f.album ?? 'x'}`}>{f.album === undefined ? t`À décider` : t(ETAT[f.album])}</strong>
        <span>{dateHeure(f.date)}</span>
        <span class="discret">{cheminDossier(s.plan, f.dossier) || 'Photos'}</span>
        {info?.indicateurs && <span class="discret">{t`netteté ${nombre(info.indicateurs.nettete)}`}</span>}
        {info?.signaux.map((sg) => (
          <span key={sg} class="badge signal">
            {t(LIBELLES_SIGNAUX[sg])}
          </span>
        ))}
        <span class="espace" />
        {reste ? <strong>{t`Reste à décider : ${nombre(reste)}`}</strong> : <strong class="tout-decide">
            <Icone nom="coche" taille={16} />
            {t`Tout est décidé`}
          </strong>}
      </div>
      {fin && (
        <div class="fin-tri" role="status">
          {reste ? (
            <>
              <strong>{t`Fin de la liste`}</strong>
              <p>{t`${pluriel(reste, 'photo reste', 'photos restent')} à décider.`}</p>
              <div class="actions">
                <button type="button" class="principal" onClick={premiere}>
                  {t`Aller à la première à décider`} <kbd>{t`Entrée`}</kbd>
                </button>
                <button type="button" onClick={() => (triRapide.value = null)}>
                  {t`Fermer le tri rapide`} <kbd>{t`Échap`}</kbd>
                </button>
              </div>
            </>
          ) : (
            <>
              <strong class="tout-decide">
                <Icone nom="coche" taille={16} />
                {t`Tout est décidé`}
              </strong>
              <p>{t`Chaque photo de cette liste a son choix : ★, ★★ ou pas pour l’album.`}</p>
              <div class="actions">
                <button type="button" class="principal" onClick={() => (triRapide.value = null)}>
                  {t`Terminer`} <kbd>{t`Entrée`}</kbd>
                </button>
                <button type="button" onClick={() => aller(0)}>
                  {t`Revoir depuis le début`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {lignesIA(s, f.id).length > 0 && (
        <div class="tri-ia">
          {lignesIA(s, f.id).map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
      <div class="tri-touches">
        <button type="button" onClick={() => (choisir([f.id], 1), suivante())}>
          <kbd>{t`Espace`}</kbd> {t`★ dans l’album`}
        </button>
        <button type="button" onClick={() => (choisir([f.id], 2), suivante())}>
          <kbd>2</kbd> {t`★★ grande photo`}
        </button>
        <button type="button" onClick={() => (choisir([f.id], 0), suivante())}>
          <kbd>X</kbd> {t`pas dans l’album`}
        </button>
        <button type="button" onClick={() => choisir([f.id], undefined)}>
          <kbd>
            <Icone nom="effacer" taille={16} titre={t`Retour arrière`} />
          </kbd>{' '}
          {t`à décider`}
        </button>
        <button type="button" onClick={() => tournerPhotos([f.id], 90)}>
          <kbd>R</kbd> {t`tourner`}
        </button>
        <button type="button" onClick={() => aller(index - 1)} disabled={index === 0} data-raison={index === 0 ? 'libelle' : undefined}>
          <kbd>←</kbd> {index === 0 ? t`c’est la première` : t`précédente`}
        </button>
        <button type="button" onClick={suivante} disabled={fin} data-raison={fin ? 'libelle' : undefined}>
          <kbd>→</kbd> {fin ? t`c’est la dernière` : t`suivante`}
        </button>
        <button type="button" onClick={() => (triRapide.value = null)}>
          <kbd>{t`Échap`}</kbd> {t`fermer`}
        </button>
      </div>
    </div>
  );
}
