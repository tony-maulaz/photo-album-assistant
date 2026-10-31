// Badge d'origine sous la photo (D112, réponses 6 et 20) : une seule bande de 28 px, commune aux pages où une
// photo est gardée ou écartée (Floues d'abord ; Doublons, Comparer en grand, la Sélection et « Mis de côté »
// ensuite). Elle se lit en deux temps :
// - le mot et sa couleur disent ce qui arrive à la photo : vert, elle reste ; gris, elle part ;
// - l'icône dit d'où vient l'idée : la punaise, vous ; ✓ ou ✕, l'application ; ✦, l'IA ; « ? » brun, à vérifier.
// Plein franc : c'est décidé (un geste de l'utilisateur : clic, G, X, « Accepter », « Suivre l'avis de l'IA »), cela
// ne changera plus sans vous ; bordure fine et pâle : c'est proposé (règle d'or 3). Rien n'est posé sur l'image (C-9.1).
//
// Au survol, la bande devient un bouton et son mot dit l'effet du clic (« ⇄ Garder », « ↺ Revenir à la
// proposition »). Elle arrête le clic (la case ne se choisit pas), ignore le double-clic (pas de vue en grand) et un
// second clic pendant 0,5 s, ne prend pas le focus et ne se glisse pas (`appuiSurBadge`, lu par la case) ; elle n'est
// pas un arrêt de Tab : le clavier passe par la photo choisie (G, X, Suppr).

import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icone, type NomIcone } from './Icones';

/** D'où vient l'idée : vous, l'application (réglage, groupe), l'IA, les anciens scripts, ou à vérifier. */
export type OrigineBadge = 'vous' | 'application' | 'ia' | 'avant' | 'verifier';

export interface DescriptionBadge {
  /**
   * Ce qui arrive à la photo : elle reste (vert), ou elle part (gris) ; à la Sélection, l'album (ambre : « Dans
   * l'album », « Grande ») ou rien de décidé (« À décider »).
   */
  sort: 'garder' | 'ecarter' | 'album' | 'grande' | 'decider';
  origine: OrigineBadge;
  /** Plein : décidé ; sinon bordure fine : proposé. */
  decide: boolean;
  /** Le mot entier (« Gardée par vous ») ; `motCourt` (« Gardée ») s'il ne tient pas. Sans mot court, l'icône part d'abord. */
  mot: string;
  motCourt?: string;
  /** L'effet du clic, écrit au survol ; absent, la bande ne se clique pas (un état seulement). */
  effet?: { icone: 'echanger' | 'revenir'; mot: string; motCourt?: string };
  /** L'infobulle : l'état, d'où vient l'idée, ce que fait un clic. */
  bulle: string;
  /** Le nom lu : l'état entier (« par vous » compris, même quand la bande ne l'écrit pas) et l'effet du clic. */
  nom: string;
  /** Le geste du clic. */
  basculer?: () => void;
  /**
   * La tête de la bande, à la place de l'icône d'origine : les étoiles de la Sélection (★, ★★ ; tout y est de
   * l'utilisateur, elles tiennent lieu de punaise) ; `null` : pas d'icône (« À décider »).
   */
  tete?: ComponentChildren | null;
}

/** L'icône de tête : une seule par bande, dans l'ordre punaise, ✦, ?, puis ✓ ou ✕. */
export function iconeBadge(b: Pick<DescriptionBadge, 'origine' | 'sort'>): NomIcone {
  if (b.sort === 'album' || b.sort === 'grande' || b.sort === 'decider') return 'coche';
  if (b.origine === 'vous') return 'punaise';
  if (b.origine === 'ia') return 'etincelle';
  if (b.origine === 'verifier') return 'question';
  return b.sort === 'garder' ? 'coche' : 'croix';
}

/** Garde contre le second clic (double-clic, clic répété) : 0,5 s, comme le plein de Doublons. */
const GARDE_MS = 500;
/** Écart de la souris (px) sous lequel un second clic est « au même endroit ». */
const MEME_ENDROIT = 12;

/**
 * Le dernier clic sur une bande, toutes bandes confondues. Dans un filtre (« À écarter », « ? », « Par vous »), la
 * photo cliquée en sort et la suivante prend sa place sous la souris : le second clic tomberait sur une bande neuve.
 * Il est donc ignoré s'il vient au même endroit ; la bande d'une autre photo, cliquée ailleurs, agit aussitôt.
 */
let dernierClic = { quand: 0, x: 0, y: 0 };

/** Bouton de la souris appuyé sur une bande : la case qui la porte ne commence pas de glisser (`dragstart` part d'elle). */
let appui = false;
export function appuiSurBadge(): boolean {
  return appui;
}
function finAppui() {
  appui = false;
}

/** Largeur d'un texte dans la police de la bande (le mot long ne s'écrit que s'il tient : mesuré, pas deviné). */
let toile: CanvasRenderingContext2D | null = null;
function largeurTexte(texte: string, police: string): number {
  toile ??= document.createElement('canvas').getContext('2d');
  if (!toile) return texte.length * 8;
  toile.font = police;
  return toile.measureText(texte).width;
}

/** La forme qui tient : le mot entier avec l'icône, le mot court avec l'icône, ou le mot entier sans l'icône. */
type Forme = { court: boolean; icone: boolean; fin: boolean };

function formeQuiTient(place: number, police: string, mot: string, motCourt: string | undefined, fin: string | undefined): Forme {
  const ICONE = 16 + 6;
  const avecFin = fin ? largeurTexte(fin, police) + 8 : 0;
  const long = largeurTexte(mot, police);
  if (ICONE + long + avecFin <= place) return { court: false, icone: true, fin: !!fin };
  if (ICONE + long <= place) return { court: false, icone: true, fin: false };
  if (motCourt) return { court: true, icone: true, fin: false };
  return { court: false, icone: false, fin: false };
}

/**
 * La bande d'une photo. `largeur` : celle de la case, pour remesurer quand la Taille change ; `fin` : une marque
 * courte au bout (« nouveau »), écrite seulement si elle tient (sinon elle reste dans la bulle de la case) ;
 * `marques` : les marques de la Sélection (↻ ✂ ▣), au bout, après le mot ; `enLigne` : dans un bouton (la ligne
 * d'un exemplaire de copie, une vignette de Comparer), la bande est un `span` qui ne se clique pas.
 */
export function BandeBadge({ badge, largeur, fin, marques, enLigne = false }: { badge: DescriptionBadge; largeur: number; fin?: string; marques?: ComponentChildren; enLigne?: boolean }) {
  const zone = useRef<HTMLElement>(null);
  // Le dernier clic sur cette bande-ci : un second clic sur elle est ignoré pendant 0,5 s, où qu'il tombe.
  const dernierIci = useRef(0);
  const [forme, setForme] = useState<Forme>({ court: false, icone: true, fin: !!fin });
  const [formeEffet, setFormeEffet] = useState<Forme>({ court: false, icone: true, fin: false });
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    const style = getComputedStyle(el);
    // Les marques au bout (Sélection) gardent leur place : le mot se mesure dans ce qui reste.
    const bout = el.querySelector<HTMLElement>(':scope > .fin-bande');
    const place = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - (bout && bout.childElementCount ? bout.offsetWidth + 8 : 0);
    // Mesuré en gras : la bande pleine et le survol le sont, la proposition l'est moins (la marge est gardée).
    const police = `600 ${style.fontSize} ${style.fontFamily}`;
    const f = formeQuiTient(place, police, badge.mot, badge.motCourt, fin);
    if (f.court !== forme.court || f.icone !== forme.icone || f.fin !== forme.fin) setForme(f);
    if (badge.effet) {
      const e = formeQuiTient(place, police, badge.effet.mot, badge.effet.motCourt, undefined);
      if (e.court !== formeEffet.court || e.icone !== formeEffet.icone) setFormeEffet(e);
    }
  }, [badge.mot, badge.motCourt, badge.effet?.mot, fin, largeur, !!marques]);

  const cliquable = !!badge.basculer && !enLigne;
  const tete = badge.tete === undefined ? <Icone nom={iconeBadge(badge)} taille={16} /> : badge.tete;
  const contenu = (
    <>
      <span class="etat-badge">
        {forme.icone && tete}
        <span class="mot-badge">{forme.court ? badge.motCourt : badge.mot}</span>
        {forme.fin && fin && <span class="fin-badge">{fin}</span>}
      </span>
      {badge.effet && (
        <span class="effet-badge" aria-hidden="true">
          {formeEffet.icone && <Icone nom={badge.effet.icone} taille={16} />}
          <span class="mot-badge">{formeEffet.court ? badge.effet.motCourt : badge.effet.mot}</span>
        </span>
      )}
    </>
  );
  const attributs = {
    class: 'etat-photo bande-etat badge-photo',
    'data-sort': badge.sort,
    'data-origine': badge.origine,
    'data-decide': badge.decide ? '' : undefined,
    title: badge.bulle,
  };
  if (enLigne)
    return (
      <span ref={zone} {...attributs}>
        {contenu}
        {marques}
      </span>
    );
  if (!cliquable)
    return (
      <div ref={zone as { current: HTMLDivElement | null }} {...attributs} role="img" aria-label={badge.nom}>
        {contenu}
        {marques}
      </div>
    );
  return (
    <div ref={zone as { current: HTMLDivElement | null }} {...attributs} data-cliquable="">
      <button
        type="button"
        class="clic-badge"
        tabIndex={-1}
        draggable={false}
        aria-label={badge.nom}
        onMouseDown={(e) => {
          // Ni choix de la case, ni rectangle de sélection, ni focus : la photo écartée se délave aussitôt, et Entrée
          // reste à la photo choisie (vue en grand).
          e.preventDefault();
          e.stopPropagation();
          appui = true;
          // Relâché, ou relâché hors de la fenêtre (le prochain appui le dit) : la case se glisse de nouveau.
          window.addEventListener('mouseup', finAppui, { once: true });
          window.addEventListener('mousedown', finAppui, { capture: true, once: true });
        }}
        onDblClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const maintenant = Date.now();
          const d = dernierClic;
          if (maintenant - dernierIci.current < GARDE_MS) return;
          if (maintenant - d.quand < GARDE_MS && Math.abs(e.clientX - d.x) <= MEME_ENDROIT && Math.abs(e.clientY - d.y) <= MEME_ENDROIT) return;
          dernierIci.current = maintenant;
          dernierClic = { quand: maintenant, x: e.clientX, y: e.clientY };
          badge.basculer!();
        }}
      >
        {contenu}
      </button>
      {marques}
    </div>
  );
}

