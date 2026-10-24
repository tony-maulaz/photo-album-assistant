// Grille de photos virtualisée (SPEC § 5.4) : seules les cases visibles
// existent. Sélection au clic, Ctrl+clic, Maj+clic et rectangle ; glisser
// la sélection sur un dossier du panneau.

import { dessinerRecadrage, recadrageUtile, tailleRecadree, type Recadrage } from '../../lib/recadrage';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { aTraduire, t } from '../../lib/langue';
import type { FichierPlan } from '../../lib/plan';
import { cleGrande, cleMiniature, HAUTEUR_GRANDE, HAUTEUR_MINIATURE } from '../../navigateur/miniatures';
import { reglages, serviceMiniatures, session } from '../etat';
import { dateHeure, pluriel } from '../format';
import { ancre, glisse, selection, visionneuse, vue, VUE_MIS_DE_COTE } from '../organiser';

const MARGE = 20;
const ESPACE = 14;
const LEGENDE = 22;
/** Place libre sous la dernière ligne, pour la barre d'action flottante. */
const PIED = 72;

const RAISONS: Record<string, string> = { floues: aTraduire('floue'), doublons: aTraduire('doublon'), doublons_exacts: aTraduire('doublon exact'), autres: aTraduire('écartée') };

/** Raison de la mise de côté, dans la langue de l'interface. */
function texteRaison(f: FichierPlan): string {
  const r = RAISONS[f.raison ?? 'autres'];
  return r ? t(r) : '';
}

/** Miniature d'une photo ; avec `recadrage`, telle qu'elle sera dans l'album (D62). */
export function Miniature({ f, taille, rotation = 0, recadrage }: { f: FichierPlan; taille: number; rotation?: number; recadrage?: Recadrage }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (f.categorie !== 'photo') {
      setUrl(null);
      return;
    }
    const s = session.value;
    if (!s) return;
    let actif = true;
    const service = serviceMiniatures();
    // Au-delà de 256 px, une version plus grande, pour que la photo reste nette.
    const grande = taille > HAUTEUR_MINIATURE;
    const cle = grande ? cleGrande(cleMiniature(f.id, f.taille, f.modifie)) : cleMiniature(f.id, f.taille, f.modifie);
    setUrl(undefined);
    void service.url(cle, () => s.source.fichier(f.id), grande ? HAUTEUR_GRANDE : HAUTEUR_MINIATURE).then((u) => actif && setUrl(u));
    return () => {
      actif = false;
      service.abandonner(cle);
    };
  }, [f.id, f.taille, f.modifie, taille > HAUTEUR_MINIATURE]);

  if (url && recadrageUtile(recadrage)) return <MiniatureRecadree url={url} taille={taille} rotation={rotation} recadrage={recadrage} />;
  if (url) return <img src={url} alt="" draggable={false} style={{ maxWidth: `${taille}px`, maxHeight: `${taille}px`, ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}) }} />;
  return <div class={`sans-miniature${url === undefined ? ' chargement' : ''}`}>{f.categorie === 'video' ? t`▶ vidéo` : url === null ? t`aperçu indisponible` : ''}</div>;
}

/** La miniature dessinée avec le recadrage, par le même calcul que la copie de l'album. */
function MiniatureRecadree({ url, taille, rotation, recadrage }: { url: string; taille: number; rotation: number; recadrage: Recadrage }) {
  const toile = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const el = toile.current;
      if (!el) return;
      const dim = tailleRecadree(img.naturalWidth, img.naturalHeight, rotation, recadrage);
      const facteur = Math.min(1, taille / Math.max(dim.l, dim.h)) * (window.devicePixelRatio || 1);
      el.width = Math.max(1, Math.round(dim.l * facteur));
      el.height = Math.max(1, Math.round(dim.h * facteur));
      el.style.width = `${el.width / (window.devicePixelRatio || 1)}px`;
      dessinerRecadrage(el.getContext('2d')!, img, img.naturalWidth, img.naturalHeight, rotation, recadrage, facteur);
    };
    img.src = url;
  }, [url, taille, rotation, recadrage.x, recadrage.y, recadrage.l, recadrage.h, recadrage.angle]);
  return <canvas ref={toile} class="miniature-recadree" />;
}

/** Petite étiquette « 12 photos » qui suit la souris pendant le glisser. */
function etiquetteGlisse(n: number): HTMLElement {
  const e = document.createElement('div');
  e.className = 'etiquette-glisse';
  e.textContent = pluriel(n, 'élément');
  document.body.appendChild(e);
  setTimeout(() => e.remove(), 0);
  return e;
}

export interface OptionsGrille {
  /** Badges supplémentaires sur la miniature (étoiles, alertes…). */
  badges?: (f: FichierPlan) => ComponentChildren;
  /** Texte sous la miniature (par défaut : l'heure, ou le nom). */
  legende?: (f: FichierPlan) => string;
  /** Lignes ajoutées à l'infobulle de la case (ce que l'IA dit de la photo…). */
  infobulle?: (f: FichierPlan) => string[];
  /** Classe CSS supplémentaire d'une case. */
  classe?: (f: FichierPlan) => string;
  /** Double-clic ou Entrée (par défaut : la visionneuse). */
  ouvrir?: (index: number) => void;
  /** Change quand la liste affichée change de nature : on remonte en haut. */
  cleVue?: string;
  /** Glisser la sélection vers le panneau des dossiers (défaut : oui). */
  glisser?: boolean;
  taille?: number;
}

export function GrillePhotos({ elements, options = {} }: { elements: FichierPlan[]; options?: OptionsGrille }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ largeur: 900, hauteur: 600 });
  const [defile, setDefile] = useState(0);
  const [rect, setRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const taille = options.taille ?? reglages.value.tailleMiniatures;
  const largeurCase = taille + ESPACE;
  const hauteurCase = taille + LEGENDE + ESPACE;
  const colonnes = Math.max(1, Math.floor((dims.largeur - 2 * MARGE + ESPACE) / largeurCase));
  const lignes = Math.ceil(elements.length / colonnes);
  const choisis = selection.value;
  const enMisDeCote = vue.value === VUE_MIS_DE_COTE;

  useLayoutEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setDims({ largeur: el.clientWidth, hauteur: el.clientHeight }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Nouvelle vue : on remonte en haut.
  useEffect(() => {
    if (conteneur.current) conteneur.current.scrollTop = 0;
    setDefile(0);
  }, [options.cleVue ?? vue.value]);

  // Flèches du clavier : ← → d'une photo à l'autre, ↑ ↓ d'une ligne à l'autre ; Maj étend la sélection.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      const cible = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName) || cible.isContentEditable) return;
      if (document.querySelector('.visionneuse, .tri-rapide, .comparateur, .voile') || !elements.length) return;
      const actuel = elements.findIndex((f) => f.id === ancre.value);
      const pas = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -colonnes : colonnes;
      const i = actuel < 0 ? 0 : Math.max(0, Math.min(elements.length - 1, actuel + pas));
      const id = elements[i].id;
      selection.value = e.shiftKey ? new Set([...selection.value, id]) : new Set([id]);
      ancre.value = id;
      const el = conteneur.current;
      if (el) {
        const y = MARGE + Math.floor(i / colonnes) * hauteurCase;
        if (y < el.scrollTop) el.scrollTop = y - MARGE;
        else if (y + hauteurCase > el.scrollTop + el.clientHeight) el.scrollTop = y + hauteurCase - el.clientHeight + MARGE;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [elements, colonnes, hauteurCase]);

  const debut = Math.max(0, Math.floor((defile - MARGE) / hauteurCase) - 2) * colonnes;
  const fin = Math.min(elements.length, (Math.ceil((defile + dims.hauteur) / hauteurCase) + 2) * colonnes);
  const position = (i: number) => ({ x: MARGE + (i % colonnes) * largeurCase, y: MARGE + Math.floor(i / colonnes) * hauteurCase });

  const cliquer = (e: MouseEvent, i: number) => {
    const id = elements[i].id;
    const index = ancre.value ? elements.findIndex((f) => f.id === ancre.value) : -1;
    if (e.shiftKey && index >= 0) {
      const [a, b] = index < i ? [index, i] : [i, index];
      const plage = elements.slice(a, b + 1).map((f) => f.id);
      selection.value = new Set(e.ctrlKey || e.metaKey ? [...choisis, ...plage] : plage);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const n = new Set(choisis);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      selection.value = n;
    } else selection.value = new Set([id]);
    ancre.value = id;
  };

  const commencerGlisse = (e: DragEvent, i: number) => {
    const id = elements[i].id;
    if (!choisis.has(id)) {
      selection.value = new Set([id]);
      ancre.value = id;
    }
    const ids = choisis.has(id) ? [...choisis] : [id];
    glisse.commencer({ type: 'fichiers', ids }, e);
    e.dataTransfer?.setDragImage(etiquetteGlisse(ids.length), -12, -12);
  };

  // Sélection par rectangle, en partant d'un espace vide de la grille.
  const commencerRectangle = (e: MouseEvent) => {
    const el = conteneur.current;
    if (!el || e.button !== 0 || (e.target as HTMLElement).closest('.tuile')) return;
    e.preventDefault();
    const boite = el.getBoundingClientRect();
    const point = (ev: MouseEvent) => ({ x: ev.clientX - boite.left, y: ev.clientY - boite.top + el.scrollTop });
    const depart = point(e);
    const base = e.ctrlKey || e.metaKey ? new Set(choisis) : new Set<string>();
    if (!e.ctrlKey && !e.metaKey) selection.value = new Set();
    let dernier = e;
    const mettreAJour = (ev: MouseEvent) => {
      const p = point(ev);
      const r = { x0: Math.min(depart.x, p.x), y0: Math.min(depart.y, p.y), x1: Math.max(depart.x, p.x), y1: Math.max(depart.y, p.y) };
      setRect(r);
      const n = new Set(base);
      const l0 = Math.max(0, Math.floor((r.y0 - MARGE) / hauteurCase));
      const l1 = Math.min(lignes - 1, Math.floor((r.y1 - MARGE) / hauteurCase));
      for (let l = l0; l <= l1; l++) {
        for (let c = 0; c < colonnes; c++) {
          const i = l * colonnes + c;
          if (i >= elements.length) break;
          const { x, y } = position(i);
          if (x < r.x1 && x + taille > r.x0 && y < r.y1 && y + taille + LEGENDE > r.y0) n.add(elements[i].id);
        }
      }
      selection.value = n;
    };
    const bouger = (ev: MouseEvent) => {
      dernier = ev;
      if (ev.clientY > boite.bottom - 30) el.scrollTop += 24;
      if (ev.clientY < boite.top + 30) el.scrollTop -= 24;
      mettreAJour(ev);
    };
    const relacher = () => {
      window.removeEventListener('mousemove', bouger);
      window.removeEventListener('mouseup', relacher);
      el.removeEventListener('scroll', defiler);
      setRect(null);
    };
    const defiler = () => mettreAJour(dernier);
    window.addEventListener('mousemove', bouger);
    window.addEventListener('mouseup', relacher);
    el.addEventListener('scroll', defiler);
  };

  const cases = [];
  for (let i = debut; i < fin; i++) {
    const f = elements[i];
    const { x, y } = position(i);
    cases.push(
      <div
        key={f.id}
        class={`tuile${choisis.has(f.id) ? ' choisie' : ''}${options.classe ? ` ${options.classe(f)}` : ''}`}
        style={{ left: `${x}px`, top: `${y}px`, width: `${taille}px` }}
        draggable={options.glisser !== false}
        onClick={(e) => cliquer(e, i)}
        onDblClick={() => (options.ouvrir ? options.ouvrir(i) : (visionneuse.value = i))}
        onDragStart={(e) => commencerGlisse(e, i)}
        onDragEnd={glisse.finir}
        title={[`${f.nom}`, `${dateHeure(f.date)}${f.origineDate === 'fichier' ? t` (date du fichier)` : ''}`, ...(options.infobulle?.(f) ?? [])].join('\n')}
      >
        <div class="cadre-miniature" style={{ height: `${taille}px` }}>
          <Miniature f={f} taille={taille} rotation={options.badges ? f.rotation : 0} recadrage={options.badges ? f.recadrage : undefined} />
          {f.categorie === 'video' && <span class="badge video">{t`vidéo`}</span>}
          {enMisDeCote && !options.badges && <span class="badge raison">{texteRaison(f)}</span>}
          {options.badges?.(f)}
        </div>
        <div class="legende">{options.legende ? options.legende(f) : enMisDeCote ? dateHeure(f.date) : f.date && f.date.length > 10 ? f.date.slice(11, 16) : f.nom}</div>
      </div>,
    );
  }

  return (
    <div
      class="grille-photos"
      ref={conteneur}
      tabIndex={0}
      onScroll={(e) => setDefile(e.currentTarget.scrollTop)}
      onMouseDown={commencerRectangle}
      aria-label={t`Photos du dossier`}
    >
      <div class="plateau" style={{ height: `${lignes * hauteurCase + 2 * MARGE + PIED}px` }}>
        {cases}
        {rect && <div class="rectangle" style={{ left: `${rect.x0}px`, top: `${rect.y0}px`, width: `${rect.x1 - rect.x0}px`, height: `${rect.y1 - rect.y0}px` }} />}
      </div>
      {elements.length === 0 && <p class="vide-grille">{t`Aucune photo ni vidéo dans ce dossier.`}</p>}
    </div>
  );
}
