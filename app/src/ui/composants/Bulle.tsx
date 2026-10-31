// Bulle d'information d'une icône (C-4.13, É15 ; D112 points 9 et 10) : au Tri, l'icône calendrier d'une ligne ;
// à Lieux et sorties et à la Sélection, l'icône calendrier et l'icône « petit dossier » de la liste des dossiers.
// L'icône seule, son nom lu dit tout ; la bulle s'ouvre au survol (après 300 ms) et au focus du clavier ; un clic
// ou Entrée l'épinglent ; Échap ou un clic ailleurs la ferment, le focus reste sur l'icône. Fixe dans la fenêtre et
// posée à la fin de la page (portail) : ni la colonne qui défile ni une liste collée ne la coupent ou la recouvrent.

import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { joursEvenement, type EvenementCalendrier } from '../../lib/ics';
import { t } from '../../lib/langue';
import { nombre, nomJour, pluriel } from '../format';
import { Icone, type NomIcone, type TailleIcone } from './Icones';

let prochaineBulle = 0;

/**
 * Une icône et sa bulle. `classe` nomme la sorte (« calendrier », « petit ») : la racine porte `{classe}-ligne`,
 * le bouton `bouton-{classe}`, la bulle `bulle-{classe}`, en plus des classes communes.
 */
export function BulleIcone({
  icone,
  classe,
  nom,
  enTete,
  compte,
  taille = 16,
  children,
}: {
  icone: NomIcone;
  classe: string;
  /** Nom lu de l'icône. */
  nom: string;
  /** Première ligne de la bulle, en gras. */
  enTete: string;
  /** Nombre écrit après l'icône (événements), à partir de 2. */
  compte?: number;
  taille?: TailleIcone;
  children?: ComponentChildren;
}) {
  const [mode, setMode] = useState<'survol' | 'focus' | 'epingle' | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const [id] = useState(() => `bulle-${classe}-${prochaineBulle++}`);
  const racine = useRef<HTMLSpanElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const bulle = useRef<HTMLDivElement>(null);
  const minuterie = useRef<number | undefined>(undefined);
  const ouvert = mode !== null;
  const attendre = (f: () => void, ms: number) => {
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(f, ms);
  };
  useEffect(() => () => window.clearTimeout(minuterie.current), []);
  // Placée sous l'icône, au-dessus si elle ne tient pas dessous ; jamais hors de la fenêtre.
  useLayoutEffect(() => {
    if (!ouvert) return;
    const placer = () => {
      const r = bouton.current?.getBoundingClientRect();
      const b = bulle.current?.getBoundingClientRect();
      if (!r || !b) return;
      const left = Math.max(16, Math.min(r.left, window.innerWidth - b.width - 16));
      const dessous = r.bottom + 6;
      setPlace({ left, top: dessous + b.height <= window.innerHeight - 8 ? dessous : Math.max(8, r.top - 6 - b.height) });
    };
    placer();
    window.addEventListener('scroll', placer, true);
    window.addEventListener('resize', placer);
    return () => {
      window.removeEventListener('scroll', placer, true);
      window.removeEventListener('resize', placer);
    };
  }, [ouvert]);
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => !racine.current?.contains(e.target as Node) && !bulle.current?.contains(e.target as Node) && setMode(null);
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMode(null);
      // Échap n'est pris que si le focus est sur l'icône ou dans la bulle ; sinon la bulle se ferme et la touche
      // va aussi à ce qui a le focus (un renommage en cours, F2, est abandonné du même Échap).
      const dedans = racine.current?.contains(document.activeElement) || bulle.current?.contains(document.activeElement);
      if (!dedans) return;
      e.stopPropagation();
      if (racine.current?.contains(document.activeElement)) bouton.current?.focus();
    };
    document.addEventListener('mousedown', clic);
    window.addEventListener('keydown', touche, true);
    return () => {
      document.removeEventListener('mousedown', clic);
      window.removeEventListener('keydown', touche, true);
    };
  }, [ouvert]);
  return (
    <span
      class={`icone-bulle ${classe}-ligne`}
      ref={racine}
      onMouseEnter={() => attendre(() => setMode((m) => m ?? 'survol'), 300)}
      onMouseLeave={() => attendre(() => setMode((m) => (m === 'survol' ? null : m)), 150)}
      // Dans une ligne de dossier : l'icône renseigne, elle n'ouvre pas le dossier ni ne le renomme.
      onDblClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        ref={bouton}
        class={`bouton-bulle bouton-${classe}`}
        aria-label={nom}
        aria-expanded={ouvert}
        aria-controls={ouvert ? id : undefined}
        draggable={false}
        onFocus={(e) => (e.currentTarget as HTMLElement).matches(':focus-visible') && setMode((m) => m ?? 'focus')}
        onBlur={(e) => !racine.current?.contains(e.relatedTarget as Node | null) && setMode((m) => (m === 'focus' ? null : m))}
        onClick={(e) => {
          e.stopPropagation();
          setMode((m) => (m === 'epingle' ? null : 'epingle'));
        }}
      >
        <Icone nom={icone} taille={taille} />
        {(compte ?? 0) > 1 && <span class={`nombre-bulle nombre-${classe}`}>{nombre(compte!)}</span>}
      </button>
      {ouvert &&
        createPortal(
        <div
          ref={bulle}
          id={id}
          class={`bulle-info bulle-${classe}`}
          role="group"
          aria-label={enTete}
          style={place ? { left: `${place.left}px`, top: `${place.top}px` } : { visibility: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
          // La souris passe de l'icône à la bulle sans la fermer.
          onMouseEnter={() => window.clearTimeout(minuterie.current)}
          onMouseLeave={() => attendre(() => setMode((m) => (m === 'survol' ? null : m)), 150)}
        >
          <strong class="tete-bulle">{enTete}</strong>
          {children}
          {mode === 'epingle' && <p class="discret pied-bulle">{t`Échap ou un clic ailleurs pour fermer`}</p>}
        </div>,
          document.body,
        )}
    </span>
  );
}

/** Événements montrés dans la bulle ; au-delà, « et 2 autres ». */
const EVENEMENTS_MONTRES = 3;

/** « sam. 9 août », en milieu de phrase. */
export const jourMin = (j: string) => nomJour(j).replace(/^./, (c) => c.toLowerCase());

/** « 24 juillet », « 24 juillet → 7 août » ; rien sans dates. */
export function periodeCourte(du?: string, au?: string): string {
  if (!du || !au) return '';
  const f = (j: string) => nomJour(j).replace(/^\S+ /, '');
  return du === au ? f(du) : `${f(du)} → ${f(au)}`;
}

/**
 * L'icône calendrier (C-4.13) et sa bulle : 3 événements au plus, puis « et 2 autres », celui de la plupart des
 * photos (`retenu`) d'abord, avec la coche. `enTete` : « Votre calendrier pendant ce voyage ».
 */
export function BulleCalendrier({ liste, retenu, enTete, taille = 16 }: { liste: EvenementCalendrier[]; retenu?: EvenementCalendrier; enTete: string; taille?: TailleIcone }) {
  const nom = liste.length === 1 ? t`Votre calendrier : « ${liste[0].titre} »` : t`Votre calendrier : ${nombre(liste.length)} événements pendant ce dossier`;
  return (
    <BulleIcone icone="calendrier" classe="calendrier" nom={nom} enTete={enTete} compte={liste.length} taille={taille}>
      <ul>
        {liste.slice(0, EVENEMENTS_MONTRES).map((e) => {
          const [d1, d2] = joursEvenement(e);
          return (
            <li key={`${e.titre}|${e.debut}`} class={e === retenu ? 'retenu' : ''}>
              <span class="marque-bulle" aria-hidden="true">
                {e === retenu && <Icone nom="coche" taille={16} />}
              </span>
              <span>
                <strong>{e.titre}</strong>
                <span class="discret">
                  {d1 === d2 ? jourMin(d1) : periodeCourte(d1, d2)}
                  {e === retenu && ` · ${t`la plupart des photos`}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {liste.length > EVENEMENTS_MONTRES && <p class="discret">{t`et ${pluriel(liste.length - EVENEMENTS_MONTRES, 'autre', 'autres')}`}</p>}
    </BulleIcone>
  );
}
