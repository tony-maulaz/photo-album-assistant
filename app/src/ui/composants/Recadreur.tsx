// Recadrage d'une photo pour l'album (étape « Sélection », D62) : un cadre à
// tirer (le déplacer, ou tirer un coin), des formats tout faits et un
// redressement de l'horizon. Seule la copie dans Album/ sera recadrée.

import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t, tc } from '../../lib/langue';
import { recadrer, type FichierPlan } from '../../lib/plan';
import { ANGLE_MAX, auFormat, cadre, dessinerRecadrage, FORMATS, normaliser, RECADRAGE_COMPLET, type Recadrage } from '../../lib/recadrage';
import { appliquer, session, texteErreur } from '../etat';
import { nombre } from '../format';

type Prise = 'deplacer' | 'no' | 'ne' | 'so' | 'se';

/** Format affiché : « libre », « 3:2 »… */
const nomFormat = (cle: string) => (cle === 'libre' ? t`Libre` : cle === '1:1' ? t`Carré` : cle);

export function Recadreur({ f, fermer }: { f: FichierPlan; fermer: () => void }) {
  const s = session.value!;
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [r, setR] = useState<Recadrage>(f.recadrage ?? RECADRAGE_COMPLET);
  const [ratio, setRatio] = useState(0);
  const [portrait, setPortrait] = useState(false);
  const toile = useRef<HTMLCanvasElement>(null);
  const prise = useRef<{ type: Prise; x: number; y: number; depart: Recadrage } | null>(null);
  const rotation = f.rotation ?? 0;

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

  // Taille d'affichage : le cadre entier (après quart de tour) tient dans la fenêtre.
  const c = image ? cadre(image.width, image.height, rotation, 0) : { l: 4, h: 3 };
  const facteur = Math.min((Math.min(window.innerWidth * 0.9, 1400) - 40) / c.l, (window.innerHeight * 0.68) / c.h);
  const affiche = { l: Math.round(c.l * facteur), h: Math.round(c.h * facteur) };

  // L'image redressée (le cadre entier), redessinée quand l'angle change.
  useLayoutEffect(() => {
    const el = toile.current;
    if (!el || !image) return;
    el.width = affiche.l;
    el.height = affiche.h;
    const ctx = el.getContext('2d')!;
    ctx.clearRect(0, 0, el.width, el.height);
    dessinerRecadrage(ctx, image, image.width, image.height, rotation, { ...RECADRAGE_COMPLET, angle: r.angle }, facteur);
  }, [image, r.angle, affiche.l, affiche.h]);

  // Rapport largeur / hauteur demandé, en pixels (portrait : inversé).
  const rapport = ratio && portrait && ratio !== 1 ? 1 / ratio : ratio;
  const choisirFormat = (nouveau: number, enPortrait = portrait) => {
    setRatio(nouveau);
    setPortrait(enPortrait);
    const rp = nouveau && enPortrait && nouveau !== 1 ? 1 / nouveau : nouveau;
    if (rp) setR(auFormat(r, rp, c.l, c.h));
  };

  const commencer = (type: Prise) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
  const lacher = () => (prise.current = null);

  const valider = () => {
    appliquer(recadrer(s.plan, f.id, normaliser(r)));
    fermer();
  };

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
      else if (e.key === 'Enter') valider();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [r]);

  const pixels = image ? { l: Math.round(c.l * r.l), h: Math.round(c.h * r.h) } : null;
  // Directement dans le document : aucun style de la page ne s'applique à l'éditeur plein écran.
  return createPortal(
    <div class="recadreur" role="dialog" aria-label={t`Recadrer la photo`}>
      <div class="tete-recadreur">
        <strong>{t`Recadrer « ${f.nom} »`}</strong>
        <span class="discret">{t`Seule la copie de l’album est recadrée : la photo de l’archive reste entière.`}</span>
      </div>
      {erreur ? (
        <p class="encart erreur">{t`Cette photo ne peut pas être affichée ici (${erreur}).`}</p>
      ) : (
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
      )}
      <div class="outils-recadrage">
        <div class="formats" role="radiogroup" aria-label={t`Format`}>
          {FORMATS.map((x) => (
            // Depuis « Libre » ou « Carré », le format suit le sens de la photo (portrait ou paysage) ; ensuite, celui choisi.
            <button key={x.cle} type="button" role="radio" aria-checked={ratio === x.ratio} onClick={() => choisirFormat(x.ratio, ratio && ratio !== 1 ? portrait : c.h > c.l)}>
              {nomFormat(x.cle)}
            </button>
          ))}
          {ratio !== 0 && ratio !== 1 && (
            <button type="button" class="lien" onClick={() => choisirFormat(ratio, !portrait)}>
              {portrait ? t`En paysage` : t`En portrait`}
            </button>
          )}
        </div>
        <label class="redresser">
          {t`Redresser : ${nombre(r.angle, 1)}°`}
          <input type="range" min={-ANGLE_MAX} max={ANGLE_MAX} step="0.1" value={r.angle} onInput={(e) => setR({ ...r, angle: Number(e.currentTarget.value) })} />
          <button type="button" class="lien" disabled={r.angle === 0} onClick={() => setR({ ...r, angle: 0 })}>
            0°
          </button>
        </label>
        {pixels && <span class="discret">{t`${nombre(pixels.l)} × ${nombre(pixels.h)} pixels`}</span>}
      </div>
      <div class="actions-recadrage">
        <button type="button" onClick={() => (setR(RECADRAGE_COMPLET), setRatio(0))}>
          {t`Tout reprendre`}
        </button>
        <span class="espace" />
        <button type="button" onClick={fermer}>
          {tc('dialogue', 'Annuler')}
        </button>
        <button type="button" class="principal" disabled={!image} onClick={valider}>
          {t`Valider le recadrage`}
        </button>
      </div>
    </div>,
    document.body,
  );
}
