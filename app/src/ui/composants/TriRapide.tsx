// Tri rapide (SPEC § 6.9) : plein écran, photo par photo. Espace = ★,
// 2 = ★★, X = non, Retour arrière = à décider, ← → pour naviguer, R pour
// tourner. Chaque choix passe à la photo suivante.

import { useEffect } from 'preact/hooks';
import { LIBELLES_SIGNAUX } from '../../lib/indicateurs';
import { cheminDossier } from '../../lib/plan';
import { session, versionPlan } from '../etat';
import { dateHeure, nombre } from '../format';
import { choisir, triRapide, tournerPhotos, type InfoPhoto } from '../selection';
import { lignesIA } from '../pages/AidesPhotos';
import { useOriginal } from './Comparateur';
import { useZoom } from './Zoom';

const ETAT = { 0: 'Pas dans l’album', 1: '★ Dans l’album', 2: '★★ Grande photo' } as const;

export function TriRapide({ infos }: { infos: Map<string, InfoPhoto> }) {
  const s = session.value!;
  versionPlan.value;
  const t = triRapide.value!;
  const ids = t.ids.filter((id) => s.plan.fichiers.has(id));
  const index = Math.min(t.index, ids.length - 1);
  const f = s.plan.fichiers.get(ids[index]);
  const url = useOriginal(f);
  const z = useZoom(f?.id ?? '');
  const reste = ids.filter((id) => s.plan.fichiers.get(id)?.album === undefined).length;

  const aller = (i: number) => (triRapide.value = { ids: t.ids, index: Math.max(0, Math.min(ids.length - 1, i)) });

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (!f) return;
      const k = e.key;
      if (k === 'Escape') triRapide.value = null;
      else if (k === 'ArrowRight') aller(index + 1);
      else if (k === 'ArrowLeft') aller(index - 1);
      else if (k === ' ' || k === '1') {
        choisir([f.id], 1);
        aller(index + 1);
      } else if (k === '2') {
        choisir([f.id], 2);
        aller(index + 1);
      } else if (k.toLowerCase() === 'x') {
        choisir([f.id], 0);
        aller(index + 1);
      } else if (k === 'Backspace' || k === 'Delete') choisir([f.id], undefined);
      else if (k.toLowerCase() === 'r') tournerPhotos([f.id], e.shiftKey ? -90 : 90);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [f?.id, index, ids.length]);

  if (!f) {
    triRapide.value = null;
    return null;
  }
  const info = infos.get(f.id);
  return (
    <div class="tri-rapide" role="dialog" aria-label="Tri rapide">
      <div class={`tri-image${z.zoom > 1 ? ' zoomee' : ''}`} ref={z.zone} {...z.proprietes} title="Molette : zoom · glisser : déplacer · double-clic ou 0 : taille de l’écran">
        {url ? (
          <img src={url} alt={f.nom} draggable={false} class={f.rotation === 90 || f.rotation === 270 ? 'quart' : ''} style={{ transform: z.transformation(f.rotation ?? 0) }} />
        ) : (
          <p>Chargement…</p>
        )}
      </div>
      <div class="tri-infos">
        <span>
          {index + 1} / {ids.length}
        </span>
        <strong class={`choix-actuel a${f.album ?? 'x'}`}>{f.album === undefined ? 'À décider' : ETAT[f.album]}</strong>
        <span>{dateHeure(f.date)}</span>
        <span class="discret">{cheminDossier(s.plan, f.dossier) || 'Photos'}</span>
        {info?.indicateurs && <span class="discret">netteté {nombre(info.indicateurs.nettete)}</span>}
        {info?.signaux.map((sg) => (
          <span key={sg} class="badge signal">
            {LIBELLES_SIGNAUX[sg]}
          </span>
        ))}
        <span class="espace" />
        <strong>Reste à décider : {nombre(reste)}</strong>
      </div>
      {lignesIA(s, f.id).length > 0 && (
        <div class="tri-ia">
          {lignesIA(s, f.id).map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
      <div class="tri-touches">
        <button type="button" onClick={() => (choisir([f.id], 1), aller(index + 1))}>
          <kbd>Espace</kbd> ★ dans l’album
        </button>
        <button type="button" onClick={() => (choisir([f.id], 2), aller(index + 1))}>
          <kbd>2</kbd> ★★ grande photo
        </button>
        <button type="button" onClick={() => (choisir([f.id], 0), aller(index + 1))}>
          <kbd>X</kbd> pas dans l’album
        </button>
        <button type="button" onClick={() => choisir([f.id], undefined)}>
          <kbd>⌫</kbd> à décider
        </button>
        <button type="button" onClick={() => tournerPhotos([f.id], 90)}>
          <kbd>R</kbd> tourner
        </button>
        <button type="button" onClick={() => aller(index - 1)} disabled={index === 0}>
          <kbd>←</kbd> précédente
        </button>
        <button type="button" onClick={() => aller(index + 1)} disabled={index >= ids.length - 1}>
          <kbd>→</kbd> suivante
        </button>
        <button type="button" onClick={() => (triRapide.value = null)}>
          <kbd>Échap</kbd> fermer
        </button>
      </div>
    </div>
  );
}
