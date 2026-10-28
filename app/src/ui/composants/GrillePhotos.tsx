// Grille de photos virtualisée (SPEC § 5.4) : seules les cases visibles
// existent. Sélection au clic, Ctrl+clic, Maj+clic et rectangle ; glisser
// la sélection sur un dossier du panneau. Titres de groupe en option (une
// journée) ; « nouveau » devant la légende des photos arrivées à la dernière
// mise à jour de l'inventaire (D63). Sur les pages où une photo a un état
// (Sélection, Floues, « Mis de côté »), il est écrit dans une bande de 28 px
// sous la photo, ses marques (↻ ✂ ▣) au bout, une remarque dessous ; rien
// n'est posé sur l'image (CHARTE C-9).

import { signal } from '@preact/signals';
import { dessinerRecadrage, recadrageUtile, tailleRecadree, type Recadrage } from '../../lib/recadrage';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { disposer, elementsVisibles, voisinVertical } from '../../lib/grille';
import { aTraduire, t } from '../../lib/langue';
import { cheminDossier, type FichierPlan } from '../../lib/plan';
import { arrivees, jourArrivee } from '../../lib/selection';
import { cleGrande, cleMiniature, HAUTEUR_GRANDE, HAUTEUR_MINIATURE } from '../../navigateur/miniatures';
import { changerReglages, reglages, serviceMiniatures, session, versionPlan } from '../etat';
import { dateHeure, jourCourt, pluriel } from '../format';
import { ancre, glisse, selection, visionneuse, vue, VUE_MIS_DE_COTE } from '../organiser';
import { Icone } from './Icones';

const MARGE = 20;
const ESPACE = 14;
const LEGENDE = 22;
/** Bande d'état sous la photo (C-9.1), puis remarque de 20 px par ligne (C-9.6). */
const BANDE = 28;
const LIGNE_REMARQUE = 20;
/** Hauteur d'un titre de groupe (« Samedi 27 juin 2025 »). */
const TITRE = 40;
/** Place libre sous la dernière ligne, pour la barre d'action flottante. */
const PIED = 72;

const RAISONS: Record<string, string> = { floues: aTraduire('floue'), doublons: aTraduire('doublon'), doublons_exacts: aTraduire('doublon exact'), autres: aTraduire('écartée') };

/** Raison de la mise de côté, dans la langue de l'interface. */
function texteRaison(f: FichierPlan): string {
  const r = RAISONS[f.raison ?? 'autres'];
  return r ? t(r) : '';
}

/**
 * Curseur de la taille des photos (réglage `tailleMiniatures`, 100 à 600 px) :
 * le même pour toutes les pages, réglé une fois. Une page aux miniatures plus
 * petites (Tri automatique) les met à l'échelle de ce réglage.
 */
export function CurseurTaille() {
  return (
    <label class="curseur" title={t`Taille des photos (jusqu’à 600 px)`}>
      <Icone nom="loupe" taille={16} />
      <span>{t`Taille`}</span>
      <input
        type="range"
        min="100"
        max="600"
        step="20"
        aria-label={t`Taille des photos (jusqu’à 600 px)`}
        value={reglages.value.tailleMiniatures}
        onInput={(e) => changerReglages({ ...reglages.value, tailleMiniatures: Number(e.currentTarget.value) })}
      />
    </label>
  );
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
  return <div class={`sans-miniature${url === undefined ? ' chargement' : ''}`}>{f.categorie === 'video' ? (
        <>
          <Icone nom="lecture" taille={20} />
          {t`vidéo`}
        </>
      ) : url === null ? t`aperçu indisponible` : ''}</div>;
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

/** Photo à amener à l'écran dans la grille affichée (résultat d'une aide IA, « voir ») ; remise à `null` une fois montrée. */
export const photoAMontrer = signal<string | null>(null);

/** État écrit sous une photo (C-9.2) : la classe de la bande (garder, ecarter, pas, mis, album, grande, decider) et son mot. */
export interface EtatGrille {
  classe: string;
  libelle: ComponentChildren;
}

export interface OptionsGrille {
  /** État de chaque photo, écrit dans la bande sous elle (C-9.1). */
  etat?: (f: FichierPlan) => EtatGrille;
  /** Marques au bout de la bande : tournée, recadrée, pile (C-9.6). */
  finBande?: (f: FichierPlan) => ComponentChildren;
  /** La miniature telle qu'elle sera dans l'album : tournée et recadrée (D62). */
  telleQuAlbum?: boolean;
  /** Largeur minimale d'une case : le mot de la bande y tient toujours (C-10.4). */
  largeurMin?: number;
  /** Texte sous la miniature (par défaut : l'heure, ou le nom) ; avec un état, la remarque sous la bande. */
  legende?: (f: FichierPlan) => ComponentChildren;
  /** Lignes de légende (2 : l'heure et la description de l'IA). */
  lignesLegende?: number;
  /** Titres de groupe : chacun ouvre une nouvelle ligne avant l'élément `debut` (indices croissants). */
  groupes?: { debut: number; titre: ComponentChildren }[];
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
  const largeurTuile = Math.max(taille, options.largeurMin ?? 0);
  const largeurCase = largeurTuile + ESPACE;
  const lignesLegende = options.lignesLegende ?? 1;
  const enMisDeCote = vue.value === VUE_MIS_DE_COTE;
  // Une bande d'état sous chaque photo : la page dit l'état, ou la vue « Mis de côté » dit pourquoi.
  const avecBande = !!options.etat || enMisDeCote;
  const hauteurLegende = avecBande ? BANDE + 4 + LIGNE_REMARQUE * lignesLegende : LEGENDE * lignesLegende;
  const hauteurCase = taille + hauteurLegende + ESPACE;
  const colonnes = Math.max(1, Math.floor((dims.largeur - 2 * MARGE + ESPACE) / largeurCase));
  const groupes = options.groupes;
  const disposition = useMemo(
    () => disposer(elements.length, colonnes, groupes?.map((g) => g.debut) ?? [], { marge: MARGE, case: hauteurCase, titre: TITRE }),
    [elements, colonnes, hauteurCase, groupes],
  );
  const choisis = selection.value;
  // Jour de la dernière arrivée de photos (mise à jour de l'inventaire) : ses photos portent le badge « nouveau ».
  const derniere = useMemo(() => {
    const s = session.value;
    return s ? arrivees([...s.plan.fichiers.values()]).at(-1)?.jour : undefined;
  }, [versionPlan.value, session.value]);
  const position = (i: number) => ({ x: MARGE + disposition.colonne[i] * largeurCase, y: disposition.haut[disposition.ligne[i]] });

  useLayoutEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setDims({ largeur: el.clientWidth, hauteur: el.clientHeight }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Le mot de l'état ne se coupe jamais (C-10.4) : une bande trop étroite pour le mot et ses marques ↻ ✂ ▣
  // les passe en tête de la remarque (C-9.7). Mesuré après chaque rendu, sur les cases affichées.
  const [serrees, setSerrees] = useState<Set<string>>(() => new Set());
  useLayoutEffect(() => {
    const el = conteneur.current;
    if (!el) return;
    const nouvelles = new Set<string>();
    for (const tuile of el.querySelectorAll<HTMLElement>('.tuile[data-id]')) {
      const bande = tuile.querySelector<HTMLElement>('.bande-etat');
      const mot = bande?.querySelector<HTMLElement>('.mot-bande');
      const marques = tuile.querySelector<HTMLElement>('.bande-etat .fin-bande, .marques-remarque');
      if (!bande || !mot || !marques || !marques.childElementCount) continue;
      const style = getComputedStyle(bande);
      const place = bande.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (mot.scrollWidth + marques.scrollWidth + (parseFloat(style.columnGap) || 0) > place + 0.5) nouvelles.add(tuile.dataset.id!);
    }
    if (nouvelles.size !== serrees.size || [...nouvelles].some((id) => !serrees.has(id))) setSerrees(nouvelles);
  });

  // Nouvelle vue : on remonte en haut.
  useEffect(() => {
    if (conteneur.current) conteneur.current.scrollTop = 0;
    setDefile(0);
  }, [options.cleVue ?? vue.value]);

  // Photo demandée ailleurs (« voir ») : on la fait venir au milieu de la grille, si elle y est.
  const aMontrer = photoAMontrer.value;
  useEffect(() => {
    const el = conteneur.current;
    const i = aMontrer ? elements.findIndex((f) => f.id === aMontrer) : -1;
    if (!el || i < 0) return;
    el.scrollTop = Math.max(0, position(i).y - (el.clientHeight - hauteurCase) / 2);
    photoAMontrer.value = null;
  }, [aMontrer, elements, disposition]);

  // Flèches du clavier : ← → d'une photo à l'autre, ↑ ↓ d'une ligne à l'autre ; Maj étend la sélection.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      const cible = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName) || cible.isContentEditable) return;
      if (document.querySelector('.visionneuse, .tri-rapide, .comparateur, .voile') || !elements.length) return;
      const actuel = elements.findIndex((f) => f.id === ancre.value);
      const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      const i =
        actuel < 0
          ? 0
          : horizontal
            ? Math.max(0, Math.min(elements.length - 1, actuel + (e.key === 'ArrowLeft' ? -1 : 1)))
            : voisinVertical(disposition, actuel, e.key === 'ArrowUp' ? -1 : 1);
      const id = elements[i].id;
      selection.value = e.shiftKey ? new Set([...selection.value, id]) : new Set([id]);
      ancre.value = id;
      const el = conteneur.current;
      if (el) {
        const { y } = position(i);
        // En remontant, on montre aussi le titre de la journée au-dessus de la ligne.
        const titre = disposition.titres.some((g) => g.debut === disposition.premier[disposition.ligne[i]]) ? TITRE : 0;
        if (y - titre < el.scrollTop) el.scrollTop = y - titre - MARGE;
        else if (y + hauteurCase > el.scrollTop + el.clientHeight) el.scrollTop = y + hauteurCase - el.clientHeight + MARGE;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [elements, disposition, hauteurCase]);

  const { debut, fin } = elementsVisibles(disposition, defile - 2 * hauteurCase, defile + dims.hauteur + 2 * hauteurCase, hauteurCase);

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
    if (!el || e.button !== 0 || (e.target as HTMLElement).closest('.tuile, button')) return;
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
      for (let l = 0; l < disposition.haut.length && disposition.haut[l] < r.y1; l++) {
        if (disposition.haut[l] + taille + hauteurLegende <= r.y0) continue;
        for (let i = disposition.premier[l]; i < disposition.premier[l + 1]; i++) {
          const { x } = position(i);
          if (x < r.x1 && x + largeurTuile > r.x0) n.add(elements[i].id);
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
    const nouveau = !!derniere && !!f.ajout && jourArrivee(f.ajout) === derniere;
    const etat = options.etat?.(f) ?? (enMisDeCote ? { classe: 'mis', libelle: texteRaison(f) } : null);
    const marques = options.finBande?.(f);
    const serree = !!marques && serrees.has(f.id);
    const marqueNouveau = nouveau && (
      <span class="pastille-nouveau" title={t`Arrivée le ${jourCourt(derniere)}, à la dernière mise à jour de l’inventaire`}>
        {t`nouveau`}
      </span>
    );
    const texte = options.legende ? options.legende(f) : enMisDeCote ? dateHeure(f.date) : f.date && f.date.length > 10 ? f.date.slice(11, 16) : f.nom;
    cases.push(
      <div
        key={f.id}
        data-id={f.id}
        data-serree={serree ? '' : undefined}
        class={`tuile${choisis.has(f.id) ? ' choisie' : ''}${options.classe ? ` ${options.classe(f)}` : ''}`}
        style={{ left: `${x}px`, top: `${y}px`, width: `${largeurTuile}px` }}
        draggable={options.glisser !== false}
        onClick={(e) => cliquer(e, i)}
        onDblClick={() => (options.ouvrir ? options.ouvrir(i) : (visionneuse.value = i))}
        onDragStart={(e) => commencerGlisse(e, i)}
        onDragEnd={glisse.finir}
        title={[
          `${f.nom}`,
          `${dateHeure(f.date)}${f.origineDate === 'fichier' ? t` (date du fichier)` : ''}`,
          // Le dossier de la photo, sur toute page où elle a un état (choix de l'utilisateur, D96 levée ; C-9.6).
          ...(avecBande ? [t`Dossier : ${(session.value && cheminDossier(session.value.plan, f.dossier)) || t`Photos`}`] : []),
          ...(options.infobulle?.(f) ?? []),
        ].join('\n')}
      >
        <div class="cadre-miniature" style={{ height: `${taille}px` }}>
          <Miniature f={f} taille={taille} rotation={options.telleQuAlbum ? f.rotation : 0} recadrage={options.telleQuAlbum ? f.recadrage : undefined} />
        </div>
        {avecBande ? (
          <>
            {/* L'état écrit, ses marques au bout ; jamais la forme d'un bouton (C-9.2). */}
            <div class={`etat-photo bande-etat ${etat?.classe ?? 'decider'}`}>
              <span class="mot-bande">{etat?.libelle}</span>
              {marques && !serree && <span class="fin-bande">{marques}</span>}
            </div>
            <div class="remarque" style={{ WebkitLineClamp: lignesLegende, maxHeight: `${LIGNE_REMARQUE * lignesLegende}px` }}>
              {/* Les marques, ici quand la bande n'a pas la place pour elles et le mot entier (data-serree). */}
              {serree && <span class="marques-remarque">{marques}</span>}
              {marqueNouveau}
              {marqueNouveau && ' '}
              {texte}
            </div>
          </>
        ) : (
          <div class={`legende${lignesLegende > 1 ? ' plusieurs-lignes' : ''}`} style={lignesLegende > 1 ? { height: `${hauteurLegende}px` } : undefined}>
            {marqueNouveau}
            {marqueNouveau && ' '}
            {texte}
          </div>
        )}
      </div>,
    );
  }
  // Titres de groupe visibles (les autres ne sont pas dessinés, comme les cases).
  const titreDe = new Map(groupes?.map((g) => [g.debut, g.titre]));
  const titres = disposition.titres
    .filter((g) => g.y + TITRE >= defile - hauteurCase && g.y <= defile + dims.hauteur + hauteurCase)
    .map((g) => (
      <div key={`titre:${g.debut}`} class="titre-groupe" style={{ top: `${g.y}px`, left: `${MARGE}px`, right: `${MARGE}px`, height: `${TITRE}px` }}>
        {titreDe.get(g.debut)}
      </div>
    ));

  return (
    <div
      class="grille-photos"
      ref={conteneur}
      tabIndex={0}
      onScroll={(e) => setDefile(e.currentTarget.scrollTop)}
      onMouseDown={commencerRectangle}
      aria-label={t`Photos du dossier`}
    >
      <div class="plateau" style={{ height: `${disposition.hauteur + PIED}px` }}>
        {titres}
        {cases}
        {rect && <div class="rectangle" style={{ left: `${rect.x0}px`, top: `${rect.y0}px`, width: `${rect.x1 - rect.x0}px`, height: `${rect.y1 - rect.y0}px` }} />}
      </div>
      {elements.length === 0 && <p class="vide-grille">{t`Aucune photo ni vidéo dans ce dossier.`}</p>}
    </div>
  );
}
