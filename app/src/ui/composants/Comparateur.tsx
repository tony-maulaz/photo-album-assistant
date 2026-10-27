// Comparateur (SPEC § 5.4) : 2 à 4 photos côte à côte, zoom (molette) et
// déplacement (glisser) synchronisés pour vérifier visages et netteté. Mode
// « une à une » (double-clic ou Entrée) : une photo en plein écran, ← → pour
// passer à la suivante en gardant le même zoom et le même cadrage, ce qui fait
// sauter aux yeux la plus nette ou les yeux fermés. Avec des groupes (Doublons,
// D100) : ← → passent d'un groupe à l'autre, 1, 2, 3… gardent ou écartent la
// photo de ce numéro.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../lib/langue';
import type { FichierPlan } from '../../lib/plan';
import { session } from '../etat';
import { dateHeure, pluriel } from '../format';

/** Adresse `blob:` de l'original d'une photo, libérée quand le composant disparaît. */
export function useOriginal(f: FichierPlan | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const s = session.value;
    if (!f || !s) return;
    let actif = true;
    let u: string | null = null;
    setUrl(null);
    void s.source
      .fichier(f.id)
      .then((fichier) => {
        if (!actif) return;
        u = URL.createObjectURL(fichier);
        setUrl(u);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [f?.id]);
  return url;
}

interface Vue {
  zoom: number;
  x: number;
  y: number;
}

function Volet({
  f,
  vue,
  rotation,
  actions,
  entete,
  agrandir,
  numero,
}: {
  f: FichierPlan;
  vue: Vue;
  rotation: number;
  actions?: ComponentChildren;
  entete?: ComponentChildren;
  agrandir?: () => void;
  /** Touche qui garde ou écarte cette photo. */
  numero?: number;
}) {
  const url = useOriginal(f);
  return (
    <div class="volet" onDblClick={agrandir} title={agrandir ? t`Double-clic : cette photo seule, en grand` : undefined}>
      <div class="volet-entete">
        {numero !== undefined && (
          <kbd class="numero-volet" title={t`Touche ${numero} : garder ou écarter cette photo`}>
            {numero}
          </kbd>
        )}
        <strong>{f.date ? dateHeure(f.date) : f.nom}</strong>
        <span class="discret">{f.nom}</span>
        {entete}
      </div>
      <div class="volet-image">
        {url ? (
          <img
            src={url}
            alt={f.nom}
            class={rotation % 180 ? 'quart' : undefined}
            draggable={false}
            style={{ transform: `translate(-50%, -50%) translate(${vue.x}px, ${vue.y}px) scale(${vue.zoom}) rotate(${rotation}deg)` }}
          />
        ) : (
          <p class="discret">{t`Chargement…`}</p>
        )}
      </div>
      {actions && <div class="volet-actions">{actions}</div>}
    </div>
  );
}

/** Passer d'un groupe de photos à l'autre sans fermer (étape « Doublons ») : Page préc. / Page suiv., A pour accepter. */
export interface NavigationGroupes {
  texte: string;
  precedent?: () => void;
  suivant?: () => void;
  /** Accepter la proposition du groupe, puis passer au suivant. */
  accepter?: () => void;
  /** Libellé chiffré du bouton (« Accepter : garder 1, écarter 2 »), comme sur la carte du groupe. */
  libelleAccepter?: string;
  /** Avertissement avant d'accepter (aucune photo gardée : tout le groupe sera mis de côté). */
  alerte?: string;
  /** Outils du groupe affiché, après la navigation (« Choisir avec l'IA », D102). */
  outils?: ComponentChildren;
}

export function Comparateur({
  photos,
  fermer,
  actions,
  entete,
  titre = t`Comparer`,
  navigation,
  basculer,
}: {
  photos: FichierPlan[];
  fermer: () => void;
  actions?: (f: FichierPlan) => ComponentChildren;
  entete?: (f: FichierPlan) => ComponentChildren;
  titre?: string;
  navigation?: NavigationGroupes;
  /** Garder ou écarter une photo : touches 1 à 9, selon son numéro. */
  basculer?: (f: FichierPlan) => void;
}) {
  const [vue, setVue] = useState<Vue>({ zoom: 1, x: 0, y: 0 });
  // Mode « une à une » : l'indice de la photo affichée seule, ou `null` pour le côte à côte.
  const [seule, setSeule] = useState<number | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const n = photos.length;
  // Touches 1 à 9 : seulement les photos affichées (4 au plus côte à côte, une seule en mode « une à une »).
  const toucheVisible = (k: number) => (seule === null ? k <= Math.min(4, n) : k === seule + 1);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (seule !== null) setSeule(null);
        else fermer();
      } else if (e.key === '0') setVue({ zoom: 1, x: 0, y: 0 });
      else if (e.key === 'Enter' && seule === null) setSeule(0);
      else if (e.key === 'ArrowRight' && seule !== null) setSeule((seule + 1) % n);
      else if (e.key === 'ArrowLeft' && seule !== null) setSeule((seule - 1 + n) % n);
      else if ((e.key === 'PageDown' || e.key === 'ArrowRight') && navigation?.suivant) navigation.suivant();
      else if ((e.key === 'PageUp' || e.key === 'ArrowLeft') && navigation?.precedent) navigation.precedent();
      else if (basculer && /^[1-9]$/.test(e.key) && toucheVisible(Number(e.key)) && !e.ctrlKey && !e.metaKey) basculer(photos[Number(e.key) - 1]);
      else if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey && navigation?.accepter) navigation.accepter();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [fermer, seule, n, navigation, basculer, photos]);

  // Zoom vers le pointeur : le point visé reste sous la souris, dans chaque volet.
  const molette = (e: WheelEvent) => {
    e.preventDefault();
    const volet = (e.target as HTMLElement).closest('.volet-image');
    if (!volet) return;
    const b = volet.getBoundingClientRect();
    const px = e.clientX - (b.left + b.width / 2);
    const py = e.clientY - (b.top + b.height / 2);
    setVue((v) => {
      const zoom = Math.min(10, Math.max(1, v.zoom * (e.deltaY < 0 ? 1.25 : 0.8)));
      const k = zoom / v.zoom;
      return zoom === 1 ? { zoom, x: 0, y: 0 } : { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };

  const glisser = (e: MouseEvent) => {
    if (e.button !== 0 || !(e.target as HTMLElement).closest('.volet-image')) return;
    e.preventDefault();
    const bouger = (ev: MouseEvent) => setVue((v) => ({ ...v, x: v.x + ev.movementX, y: v.y + ev.movementY }));
    const lacher = () => {
      window.removeEventListener('mousemove', bouger);
      window.removeEventListener('mouseup', lacher);
    };
    window.addEventListener('mousemove', bouger);
    window.addEventListener('mouseup', lacher);
  };

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    el.addEventListener('wheel', molette, { passive: false });
    return () => el.removeEventListener('wheel', molette);
  }, []);

  return (
    <div class="comparateur" role="dialog" aria-label={titre} data-annulable>
      <div class="comparateur-tete">
        <h2>{seule === null ? titre : t`Photo ${seule + 1} sur ${n}`}</h2>
        <span class="discret">
          {seule !== null
            ? t`← → : photo précédente ou suivante, même zoom · molette : zoom · Échap : revenir au côte à côte`
            : basculer
              ? t`← → : groupe précédent ou suivant · 1, 2, 3… : garder ou écarter la photo de ce numéro · Entrée : une à une · molette : zoom · Échap : fermer`
              : t`Double-clic ou Entrée : une à une, en grand · molette : zoom · glisser : déplacer · Échap : fermer`}
        </span>
        {navigation && (
          <span class="navigation-groupes">
            <button type="button" disabled={!navigation.precedent} onClick={navigation.precedent} title={t`Flèche gauche`}>
              {t`‹ Groupe précédent`}
            </button>
            <span class="discret">{navigation.texte}</span>
            <button type="button" disabled={!navigation.suivant} onClick={navigation.suivant} title={t`Flèche droite`}>
              {t`Groupe suivant ›`}
            </button>
            {navigation.accepter && (
              <button type="button" class="principal" onClick={navigation.accepter} title={t`Touche A, puis groupe suivant`}>
                {navigation.libelleAccepter ?? t`Accepter et groupe suivant`}
              </button>
            )}
            {navigation.accepter && navigation.alerte && <span class="alerte-doublons">{navigation.alerte}</span>}
            {navigation.outils}
          </span>
        )}
        <span class="espace" />
        {seule !== null && (
          <>
            <button type="button" onClick={() => setSeule((seule - 1 + n) % n)} aria-label={t`Photo précédente`} title={t`Flèche gauche`}>
              ←
            </button>
            <button type="button" onClick={() => setSeule((seule + 1) % n)} aria-label={t`Photo suivante`} title={t`Flèche droite`}>
              →
            </button>
            <button type="button" onClick={() => setSeule(null)}>
              {t`Côte à côte`}
            </button>
          </>
        )}
        <button type="button" onClick={() => setVue({ zoom: 1, x: 0, y: 0 })} disabled={vue.zoom === 1}>
          {t`Taille normale`}
        </button>
        <button type="button" class="fermer-comparateur" onClick={fermer}>
          {t`Fermer`}
        </button>
      </div>
      <div class={`volets n${seule === null ? Math.min(4, n) : 1}`} ref={zone} onMouseDown={glisser}>
        {seule === null ? (
          photos
            .slice(0, 4)
            .map((f, i) => (
              <Volet key={f.id} f={f} vue={vue} rotation={f.rotation ?? 0} actions={actions?.(f)} entete={entete?.(f)} agrandir={() => setSeule(i)} numero={basculer ? i + 1 : undefined} />
            ))
        ) : (
          <Volet
            key={photos[seule].id}
            f={photos[seule]}
            vue={vue}
            rotation={photos[seule].rotation ?? 0}
            actions={actions?.(photos[seule])}
            entete={entete?.(photos[seule])}
            numero={basculer ? seule + 1 : undefined}
          />
        )}
      </div>
      {seule === null && n > 4 && <p class="discret plus-de-photos">{t`${pluriel(n - 4, 'autre photo', 'autres photos')} : double-clic ou Entrée pour les voir une à une.`}</p>}
    </div>
  );
}
