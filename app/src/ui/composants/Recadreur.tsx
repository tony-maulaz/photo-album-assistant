// Recadrer et tourner une photo pour l'album (étape « Sélection », D62, lot 4) :
// un cadre à tirer (le déplacer, ou tirer un coin), des formats tout faits, le
// quart de tour (tout de suite, comme partout) et un redressement de l'horizon.
// Seule la copie dans Album/ sera recadrée. Une vue en grand : barre du haut
// (Fermer, titre, un seul « Annuler »), photo et outils, barre du bas fixe avec
// « Accepter le recadrage », toujours visible.

import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../lib/langue';
import { recadrer, tourner, type FichierPlan } from '../../lib/plan';
import { ANGLE_MAX, auFormat, cadre, dessinerRecadrage, FORMATS, normaliser, RECADRAGE_COMPLET, tournerRecadrage, type Recadrage } from '../../lib/recadrage';
import { annuler, appliquer, retablir, session, texteErreur } from '../etat';
import { nombre } from '../format';
import { AnnulerRetablir, garderFocus } from './Cadre';
import { Icone } from './Icones';

type Prise = 'deplacer' | 'no' | 'ne' | 'so' | 'se';

/** Format affiché : « libre », « 3:2 »… */
const nomFormat = (cle: string) => (cle === 'libre' ? t`Libre` : cle === '1:1' ? t`Carré` : cle);

/** État du cadre en cours de réglage : le rectangle (avec le redressement), le format et son sens. */
interface EtatCadre {
  r: Recadrage;
  ratio: number;
  portrait: boolean;
}

/**
 * Un geste du Recadreur, dans une seule pile (lot 4, C-8.2) : un réglage du cadre (son état d'avant), ou un
 * quart de tour, appliqué tout de suite au plan comme partout ailleurs et défait par l'annulation de l'étape.
 */
type Geste = { sorte: 'cadre'; libelle: string; etat: EtatCadre } | { sorte: 'quart'; sens: 90 | -90 };

const memeEtat = (a: EtatCadre, b: EtatCadre) => a.ratio === b.ratio && a.portrait === b.portrait && (['x', 'y', 'l', 'h', 'angle'] as const).every((k) => Math.abs(a.r[k] - b.r[k]) < 1e-6);

export function Recadreur({ f, fermer }: { f: FichierPlan; fermer: () => void }) {
  const s = session.value!;
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [r, setR] = useState<Recadrage>(f.recadrage ?? RECADRAGE_COMPLET);
  const [ratio, setRatio] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const [zone, setZone] = useState({ l: 0, h: 0 });
  const toile = useRef<HTMLCanvasElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const prise = useRef<{ type: Prise; x: number; y: number; depart: Recadrage } | null>(null);
  const rotation = f.rotation ?? 0;
  // Une seule pile : réglages du cadre et quarts de tour mêlés, défaits dans l'ordre inverse.
  const pile = useRef<Geste[]>([]);
  const refaire = useRef<Geste[]>([]);
  const enCours = useRef<EtatCadre | null>(null);
  const [, setVersion] = useState(0);
  const redessiner = () => setVersion((v) => v + 1);
  const etat = (): EtatCadre => ({ r, ratio, portrait });
  const remettre = (e: EtatCadre) => {
    setR(e.r);
    setRatio(e.ratio);
    setPortrait(e.portrait);
  };
  /** Avant un réglage d'un seul geste (format, sens, remise à zéro) : l'état d'avant entre dans la pile. */
  const noter = (libelle: string) => {
    pile.current.push({ sorte: 'cadre', libelle, etat: etat() });
    refaire.current = [];
    redessiner();
  };
  /** Un réglage qui dure (glisser le cadre, le curseur du redressement) : noté une fois, à sa fin, s'il a changé quelque chose. */
  const debutGeste = () => {
    if (!enCours.current) enCours.current = etat();
  };
  const finGeste = (libelle: string, apres: EtatCadre) => {
    const avant = enCours.current;
    enCours.current = null;
    if (!avant || memeEtat(avant, apres)) return;
    pile.current.push({ sorte: 'cadre', libelle, etat: avant });
    refaire.current = [];
    redessiner();
  };

  // La photo entière, à l'endroit : la précision du cadre ne dépend pas de la taille d'affichage.
  useEffect(() => {
    let actif = true;
    let bitmap: ImageBitmap | null = null;
    void s.source
      .fichier(f.id)
      .then((fichier) => createImageBitmap(fichier, { imageOrientation: 'from-image' }))
      .then((b) => {
        bitmap = b;
        if (actif) setImage(b);
        else b.close();
      })
      .catch((err) => actif && setErreur(texteErreur(err)));
    return () => {
      actif = false;
      bitmap?.close();
    };
  }, [f.id]);

  // La place de la photo : la scène entre la barre du haut, la colonne des outils et la barre du bas.
  useLayoutEffect(() => {
    const el = scene.current;
    if (!el) return;
    const noter = () => setZone({ l: el.clientWidth, h: el.clientHeight });
    noter();
    const obs = new ResizeObserver(noter);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Taille d'affichage : le cadre entier (après quart de tour) tient dans la scène, marges comprises.
  const c = image ? cadre(image.width, image.height, rotation, 0) : { l: 4, h: 3 };
  const facteur = Math.max(0.01, Math.min((zone.l - 48) / c.l, (zone.h - 32) / c.h));
  const affiche = { l: Math.max(1, Math.round(c.l * facteur)), h: Math.max(1, Math.round(c.h * facteur)) };

  // L'image redressée (le cadre entier), redessinée quand l'angle ou le sens change.
  useLayoutEffect(() => {
    const el = toile.current;
    if (!el || !image) return;
    el.width = affiche.l;
    el.height = affiche.h;
    const ctx = el.getContext('2d')!;
    ctx.clearRect(0, 0, el.width, el.height);
    dessinerRecadrage(ctx, image, image.width, image.height, rotation, { ...RECADRAGE_COMPLET, angle: r.angle }, facteur);
  }, [image, r.angle, affiche.l, affiche.h, rotation]);

  // Rapport largeur / hauteur demandé, en pixels (portrait : inversé).
  const rapport = ratio && portrait && ratio !== 1 ? 1 / ratio : ratio;
  const choisirFormat = (nouveau: number, enPortrait = portrait) => {
    // Le format déjà choisi : rien ne change, rien n'entre dans la pile (« Rétablir » n'est pas vidé).
    if (nouveau === ratio && enPortrait === portrait) return;
    noter(t`changer le format`);
    setRatio(nouveau);
    setPortrait(enPortrait);
    const rp = nouveau && enPortrait && nouveau !== 1 ? 1 / nouveau : nouveau;
    if (rp) setR(auFormat(r, rp, c.l, c.h));
  };

  const commencer = (type: Prise) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    debutGeste();
    prise.current = { type, x: e.clientX, y: e.clientY, depart: r };
  };
  const bouger = (e: PointerEvent) => {
    const p = prise.current;
    if (!p) return;
    const dx = (e.clientX - p.x) / affiche.l;
    const dy = (e.clientY - p.y) / affiche.h;
    const d = p.depart;
    if (p.type === 'deplacer') {
      setR({ ...d, x: Math.min(Math.max(d.x + dx, 0), 1 - d.l), y: Math.min(Math.max(d.y + dy, 0), 1 - d.h) });
      return;
    }
    // Un coin bouge, le coin opposé reste en place.
    const gauche = p.type === 'no' || p.type === 'so';
    const haut = p.type === 'no' || p.type === 'ne';
    const fixeX = gauche ? d.x + d.l : d.x;
    const fixeY = haut ? d.y + d.h : d.y;
    let l = Math.max(0.05, gauche ? d.l - dx : d.l + dx);
    let h = Math.max(0.05, haut ? d.h - dy : d.h + dy);
    l = Math.min(l, gauche ? fixeX : 1 - fixeX);
    h = Math.min(h, haut ? fixeY : 1 - fixeY);
    if (rapport) {
      // Format imposé : la hauteur suit la largeur (en fractions, l / h = rapport × hauteur / largeur de l'image).
      const k = (rapport * c.h) / c.l;
      if (l / h > k) l = h * k;
      else h = l / k;
    }
    setR({ ...d, l, h, x: gauche ? fixeX - l : fixeX, y: haut ? fixeY - h : fixeY });
  };
  const lacher = () => {
    if (!prise.current) return;
    prise.current = null;
    finGeste(t`régler le cadre`, etat());
  };

  /** Quart de tour tout de suite, comme partout ailleurs : la photo tourne dans le plan, le cadre tourne avec elle. */
  const quartDeTour = (sens: 90 | -90) => {
    // Rien à tourner (photo absente du plan) : rien dans la pile, sinon Annuler déferait un autre geste de l'étape.
    const m = tourner(s.plan, [f.id], sens);
    if (!m) return;
    appliquer(m);
    setR(tournerRecadrage(r, sens));
    if (ratio && ratio !== 1) setPortrait(!portrait);
    pile.current.push({ sorte: 'quart', sens });
    refaire.current = [];
    redessiner();
  };

  const annulerGeste = () => {
    // Un redressement encore en cours compte comme un geste fini : c'est lui qu'Annuler défait.
    if (enCours.current && !memeEtat(enCours.current, etat())) finGeste(t`redresser la photo`, etat());
    enCours.current = null;
    const g = pile.current.pop();
    if (!g) return;
    if (g.sorte === 'cadre') {
      refaire.current.push({ ...g, etat: etat() });
      remettre(g.etat);
    } else {
      annuler();
      setR(tournerRecadrage(r, g.sens === 90 ? -90 : 90));
      if (ratio && ratio !== 1) setPortrait(!portrait);
      refaire.current.push(g);
    }
    redessiner();
  };
  const retablirGeste = () => {
    const g = refaire.current.pop();
    if (!g) return;
    if (g.sorte === 'cadre') {
      pile.current.push({ ...g, etat: etat() });
      remettre(g.etat);
    } else {
      retablir();
      setR(tournerRecadrage(r, g.sens));
      if (ratio && ratio !== 1) setPortrait(!portrait);
      pile.current.push(g);
    }
    redessiner();
  };
  const dernier = pile.current.at(-1);
  const historique = {
    peutAnnuler: !!dernier,
    peutRetablir: refaire.current.length > 0,
    prochaineAnnulation: dernier ? (dernier.sorte === 'quart' ? t`tourner la photo` : dernier.libelle) : undefined,
  };

  // Accepter sans rien changer n'ajoute pas un geste vide à l'historique de l'étape (« Annuler : enlever 1 recadrage »).
  const valider = () => {
    const nouveau = normaliser(r);
    const avant = f.recadrage ?? RECADRAGE_COMPLET;
    if (!(['x', 'y', 'l', 'h', 'angle'] as const).every((k) => Math.abs(nouveau[k] - avant[k]) < 1e-4)) appliquer(recadrer(s.plan, f.id, nouveau));
    fermer();
  };

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const cible = e.target as HTMLElement | null;
      if (e.key === 'Escape') fermer();
      // Entrée accepte, sauf sur un autre bouton ou un champ du Recadreur venu au clavier : il garde son propre
      // sens (un clic à la souris n'y laisse pas le focus) ; un bouton de la page dessous ne la reçoit pas.
      else if (e.key === 'Enter') {
        if (cible?.closest('.recadreur') && cible.closest('button, input, select') && !cible.closest('.accepter-recadrage')) return;
        if (!image) return;
        valider();
      } else if (ctrl && k === 'z' && !e.shiftKey) annulerGeste();
      else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) retablirGeste();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  });

  const pixels = image ? { l: Math.round(c.l * r.l), h: Math.round(c.h * r.h) } : null;
  const entiere = memeEtat(etat(), { r: RECADRAGE_COMPLET, ratio: 0, portrait });
  // Directement dans le document : aucun style de la page ne s'applique à l'éditeur plein écran.
  return createPortal(
    <div class="recadreur" role="dialog" aria-label={t`Recadrer et tourner`}>
      <div class="barre-haut-recadreur">
        <button type="button" class="fermer-recadreur" onClick={fermer} title={t`Le cadre et le redressement sont abandonnés ; un quart de tour reste fait (Échap)`}>
          <Icone nom="croix" taille={16} />
          {t`Fermer sans recadrer`}
        </button>
        <strong class="titre-recadreur" title={f.nom}>
          {t`Recadrer et tourner · ${f.nom}`}
        </strong>
        <AnnulerRetablir historique={historique} annuler={annulerGeste} retablir={retablirGeste} />
      </div>
      <p class="info-recadreur">
        <Icone nom="info" taille={16} />
        {t`Seule la copie de l’album est recadrée : la photo de l’archive reste entière.`}
      </p>
      <div class="scene-recadreur">
        <div class="zone-photo-recadreur" ref={scene}>
          {erreur ? (
            <p class="encart erreur">{t`Cette photo ne peut pas être affichée ici (${erreur}).`}</p>
          ) : (
            zone.l > 0 && (
              <div class="scene-recadrage" style={{ width: `${affiche.l}px`, height: `${affiche.h}px` }} onPointerMove={bouger} onPointerUp={lacher} onPointerCancel={lacher}>
                <canvas ref={toile} />
                {image && (
                  <div
                    class="cadre-recadrage"
                    style={{ left: `${r.x * affiche.l}px`, top: `${r.y * affiche.h}px`, width: `${r.l * affiche.l}px`, height: `${r.h * affiche.h}px` }}
                    onPointerDown={commencer('deplacer')}
                  >
                    {(['no', 'ne', 'so', 'se'] as Prise[]).map((p) => (
                      <span key={p} class={`poignee ${p}`} onPointerDown={commencer(p)} />
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
        <div class="outils-recadrage">
          <section>
            <h3>{t`Format`}</h3>
            <div class="formats" role="radiogroup" aria-label={t`Format`}>
              {FORMATS.map((x) => (
                // Depuis « Libre » ou « Carré », le format suit le sens de la photo (portrait ou paysage) ; ensuite, celui choisi.
                <button key={x.cle} type="button" role="radio" aria-checked={ratio === x.ratio} onMouseDown={garderFocus} onClick={() => choisirFormat(x.ratio, ratio && ratio !== 1 ? portrait : c.h > c.l)}>
                  {nomFormat(x.cle)}
                </button>
              ))}
            </div>
            {ratio !== 0 && ratio !== 1 && (
              <button type="button" class="lien" onMouseDown={garderFocus} onClick={() => choisirFormat(ratio, !portrait)}>
                {portrait ? t`En paysage` : t`En portrait`}
              </button>
            )}
          </section>
          <section>
            <h3>{t`Tourner`}</h3>
            <div class="quarts">
              <button type="button" data-action="quart-de-tour" onMouseDown={garderFocus} onClick={() => quartDeTour(-90)} title={t`Tourner d’un quart de tour vers la gauche, tout de suite ; Annuler le défait`}>
                <Icone nom="tourner" taille={16} />
                {t`À gauche`}
              </button>
              <button type="button" data-action="quart-de-tour" onMouseDown={garderFocus} onClick={() => quartDeTour(90)} title={t`Tourner d’un quart de tour vers la droite, tout de suite ; Annuler le défait`}>
                <Icone nom="tournerDroite" taille={16} />
                {t`À droite`}
              </button>
            </div>
          </section>
          <section>
            <h3>{t`Redresser : ${nombre(r.angle, 1)}°`}</h3>
            <input
              type="range"
              min={-ANGLE_MAX}
              max={ANGLE_MAX}
              step="0.1"
              value={r.angle}
              aria-label={t`Redresser`}
              onPointerDown={debutGeste}
              onKeyDown={debutGeste}
              onInput={(e) => {
                debutGeste();
                setR({ ...r, angle: Number(e.currentTarget.value) });
              }}
              // Fin du geste : au lâcher, à la touche relâchée ou en quittant le curseur (« change » ne vient pas toujours).
              onChange={(e) => finGeste(t`redresser la photo`, { r: { ...r, angle: Number(e.currentTarget.value) }, ratio, portrait })}
              onPointerUp={() => finGeste(t`redresser la photo`, etat())}
              onKeyUp={() => finGeste(t`redresser la photo`, etat())}
              onBlur={() => finGeste(t`redresser la photo`, etat())}
            />
            <button
              type="button"
              class="lien"
              disabled={r.angle === 0}
              data-raison={r.angle === 0 ? 'libelle' : undefined}
              onMouseDown={garderFocus}
              onClick={() => {
                noter(t`redresser la photo`);
                setR({ ...r, angle: 0 });
              }}
            >
              {r.angle === 0 ? t`déjà droite` : t`Remettre à 0°`}
            </button>
          </section>
          {pixels && <p class="discret">{t`${nombre(pixels.l)} × ${nombre(pixels.h)} pixels gardés`}</p>}
        </div>
      </div>
      <div class="barre-bas-recadreur">
        <span class="discret rappel-recadreur">{t`Entrée : accepter · Échap : fermer · Ctrl+Z : annuler`}</span>
        {/* Le geste de secours, toujours visible à toutes les tailles, à gauche du plein (maquette v2, tour 1 du lot 4). */}
        {/* Déjà entière et droite : désactivé, la raison dans son libellé (C-4.7) ; un geste sans effet
            n'entre pas dans la pile et ne vide pas « Rétablir » (tour 2 du lot 4). */}
        <button
          type="button"
          class="contour remettre-entiere"
          disabled={entiere}
          data-raison={entiere ? 'libelle' : undefined}
          title={t`Remet le cadre sur la photo entière et le redressement à 0° ; Ctrl+Z le défait`}
          onMouseDown={garderFocus}
          onClick={() => {
            if (entiere) return;
            noter(t`remettre la photo entière`);
            setR(RECADRAGE_COMPLET);
            setRatio(0);
          }}
        >
          {entiere ? t`Déjà la photo entière` : t`Remettre la photo entière`}
        </button>
        <button type="button" class="principal accepter-recadrage" disabled={!image} data-raison={image ? undefined : 'libelle'} onClick={valider}>
          {image ? t`Accepter le recadrage` : t`Chargement de la photo…`}
        </button>
      </div>
    </div>,
    document.body,
  );
}
