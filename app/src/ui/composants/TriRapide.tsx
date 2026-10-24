// Tri rapide (SPEC § 6.9) : plein écran, photo par photo. Espace = ★,
// 2 = ★★, X = pas pour l’album, Retour arrière = à décider, ← → pour naviguer, R pour
// tourner. Chaque choix passe à la photo suivante.

import { useEffect } from 'preact/hooks';
import { LIBELLES_SIGNAUX } from '../../lib/indicateurs';
import { aTraduire, t } from '../../lib/langue';
import { cheminDossier } from '../../lib/plan';
import { session, versionPlan } from '../etat';
import { dateHeure, nombre } from '../format';
import { choisir, triRapide, tournerPhotos, type InfoPhoto } from '../selection';
import { lignesIA } from '../pages/AidesPhotos';
import { useOriginal } from './Comparateur';
import { useZoom } from './Zoom';

const ETAT = { 0: aTraduire('Pas dans l’album'), 1: aTraduire('★ Dans l’album'), 2: aTraduire('★★ Grande photo') } as const;

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

  const aller = (i: number) => (triRapide.value = { ids: tri.ids, index: Math.max(0, Math.min(ids.length - 1, i)) });

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
        <strong>{t`Reste à décider : ${nombre(reste)}`}</strong>
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
          <kbd>{t`Espace`}</kbd> {t`★ dans l’album`}
        </button>
        <button type="button" onClick={() => (choisir([f.id], 2), aller(index + 1))}>
          <kbd>2</kbd> {t`★★ grande photo`}
        </button>
        <button type="button" onClick={() => (choisir([f.id], 0), aller(index + 1))}>
          <kbd>X</kbd> {t`pas dans l’album`}
        </button>
        <button type="button" onClick={() => choisir([f.id], undefined)}>
          <kbd>⌫</kbd> {t`à décider`}
        </button>
        <button type="button" onClick={() => tournerPhotos([f.id], 90)}>
          <kbd>R</kbd> {t`tourner`}
        </button>
        <button type="button" onClick={() => aller(index - 1)} disabled={index === 0}>
          <kbd>←</kbd> {t`précédente`}
        </button>
        <button type="button" onClick={() => aller(index + 1)} disabled={index >= ids.length - 1}>
          <kbd>→</kbd> {t`suivante`}
        </button>
        <button type="button" onClick={() => (triRapide.value = null)}>
          <kbd>{t`Échap`}</kbd> {t`fermer`}
        </button>
      </div>
    </div>
  );
}
