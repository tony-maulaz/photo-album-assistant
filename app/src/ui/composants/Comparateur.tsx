// « Comparer en grand » (SPEC § 5.4, CHARTE C-7.5, choix de l'utilisateur du
// 27.10.2026) : une salle sombre, quatre barres (en-tête, ligne d'information,
// scène, barre du bas). La présentation est calculée (lib/presentationComparer) :
// côte à côte si chaque photo y reste assez grande, sinon une photo à la fois,
// sa légende à droite et la bande des autres photos dessous leur état écrit ;
// le bouton « Côte à côte / Une à la fois » et Entrée basculent (Entrée garde ce
// sens sur le choix d'une photo, une vignette ou le bouton de présentation ;
// Espace active le bouton). ↑ ↓ : photo (le clavier va sur la carte, jamais sur un
// choix), ← → : groupe (dans la journée ou le dossier affiché). Zoom (molette, − +) et
// déplacement (glisser) synchronisés entre les photos ; 1 à 9 gardent ou
// écartent la photo de ce numéro, si elle est à l'écran. Aucune photo pâlie,
// rien posé sur l'image : l'état s'écrit sous la photo (C-9).

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../lib/langue';
import type { FichierPlan } from '../../lib/plan';
import { bandeVignettes, choisirPresentation, contenir, dispositionCote, MESURES, photoOuverture, placeUne, proportion, repartir, type MesuresComparer, type Presentation, type Scene } from '../../lib/presentationComparer';
import { cleMiniature } from '../../navigateur/miniatures';
import { annuler, retablir, serviceMiniatures, session } from '../etat';
import { BandeBadge, type DescriptionBadge } from './Badge';
import { AnnulerRetablir } from './Cadre';
import { Miniature } from './GrillePhotos';
import { Icone, type NomIcone } from './Icones';

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

/**
 * Proportions des photos telles qu'affichées : lues sur leurs miniatures (orientation EXIF
 * appliquée), inversées après un quart de tour ; `null` tant qu'elles ne sont pas toutes connues.
 */
function useProportions(photos: FichierPlan[]): number[] | null {
  const cle = photos.map((f) => `${f.id}:${f.rotation ?? 0}`).join('|');
  const [ratios, setRatios] = useState<{ cle: string; r: number[] } | null>(null);
  useEffect(() => {
    const s = session.value;
    if (!s) return;
    let actif = true;
    const service = serviceMiniatures();
    const lire = (f: FichierPlan) =>
      service
        .url(cleMiniature(f.id, f.taille, f.modifie), () => s.source.fichier(f.id))
        .then(
          (url) =>
            new Promise<number>((ok) => {
              if (!url) return ok(proportion(0, 0));
              const img = new Image();
              img.onload = () => ok(proportion(img.naturalWidth, img.naturalHeight, f.rotation ?? 0));
              img.onerror = () => ok(proportion(0, 0));
              img.src = url;
            }),
        )
        .catch(() => proportion(0, 0));
    void Promise.all(photos.map(lire)).then((r) => actif && setRatios({ cle, r }));
    return () => {
      actif = false;
    };
  }, [cle]);
  // Pendant un nouveau calcul (photo tournée), les proportions d'avant : la scène ne se vide pas.
  return ratios?.cle === cle || ratios?.r.length === photos.length ? ratios.r : null;
}

interface Vue {
  zoom: number;
  x: number;
  y: number;
}
const VUE_ENTIERE: Vue = { zoom: 1, x: 0, y: 0 };

/** L'original d'une photo dans sa boîte, au zoom et au cadrage communs. */
function ImageVolet({ f, vue, largeur, hauteur }: { f: FichierPlan; vue: Vue; largeur: number; hauteur: number }) {
  const url = useOriginal(f);
  const rotation = f.rotation ?? 0;
  return (
    <div class="volet-image" style={{ width: `${Math.round(largeur)}px`, height: `${Math.round(hauteur)}px` }}>
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
  );
}

/** Hauteur ajoutée à la légende par le badge : la bande (28 px) et son écart. */
const BANDE_COMPARER = 34;

/** Passer d'un groupe de photos à l'autre sans fermer (étape « Doublons ») ; A pour accepter. */
export interface NavigationGroupes {
  texte: string;
  precedent?: () => void;
  suivant?: () => void;
  /** Accepter la proposition du groupe, puis passer au suivant. */
  accepter?: () => void;
  /** Ce que fera « Accepter → », en gris à sa gauche (« garde la 2 · écarte 1 »), le même que sur la page (D112). */
  ditAccepter?: string;
  /** La phrase entière, pour le lecteur d'écran et l'infobulle. */
  lecteurAccepter?: string;
  /** Avertissement avant d'accepter (aucune photo gardée : tout le groupe sera mis de côté). */
  alerte?: string;
}

/** Présentation choisie à la main, gardée par la page d'un groupe à l'autre (le composant est remonté à chaque groupe). */
export interface PresentationGardee {
  valeur: Presentation | null;
  changer: (p: Presentation) => void;
}

/** État écrit d'une photo (C-9.2) : la classe de la bande et son mot. */
export interface EtatComparer {
  classe: string;
  libelle: string;
  icone?: NomIcone;
}

export function Comparateur({
  photos,
  fermer,
  titre = t`Comparer`,
  sousTitre,
  etat,
  choix,
  resume,
  lieu,
  infobulle,
  details,
  outils,
  conseillee,
  suivre,
  ligne,
  plusieurs,
  rienSupprime,
  navigation,
  basculer,
  mesures,
  gardee,
  badge,
}: {
  photos: FichierPlan[];
  fermer: () => void;
  titre?: string;
  /** Après le titre, en gris : la journée. */
  sousTitre?: string;
  /** État écrit de chaque photo : bande des vignettes, repère `.etat-photo` du choix. */
  etat: (f: FichierPlan) => EtatComparer;
  /** Commande de l'état (son état allumé, C-4.9) : sous la photo, ou dans la légende de « Une à la fois ». */
  choix: (f: FichierPlan, vertical: boolean) => ComponentChildren;
  /** Sous la photo, côte à côte (2 lignes au plus, C-9.6) : remarque, heure ; le texte entier est dans « Une à la fois » et l'infobulle. */
  resume?: (f: FichierPlan) => ComponentChildren;
  /** Où est la photo : son dossier (et « rangée dans … »). */
  lieu?: (f: FichierPlan) => ComponentChildren;
  /** Texte entier de la légende, dans l'infobulle. */
  infobulle?: (f: FichierPlan) => string;
  /** Lignes de la légende de « Une à la fois » (par défaut : le résumé et le dossier). */
  details?: (f: FichierPlan) => ComponentChildren;
  /** Outils de la photo affichée (Tourner, Recadrer…), dans la légende de « Une à la fois ». */
  outils?: (f: FichierPlan) => ComponentChildren;
  /** Photo affichée à l'ouverture : la conseillée (IA, ou la plus nette), sinon la première. */
  conseillee?: string;
  /** Choix de l'IA : quand il arrive ou change, la vue passe sur cette photo. */
  suivre?: string;
  /** Ligne d'information : la proposition, l'avis de l'IA et son aide ; ou ce qu'on sait de la photo courante. Elle passe à la ligne, jamais coupée (C-10.4). */
  ligne?: ComponentChildren | ((f: FichierPlan) => ComponentChildren);
  /** « Garder plusieurs photos » : sur la ligne d'information côte à côte, sous le choix en « Une à la fois ». */
  plusieurs?: ComponentChildren;
  /** Vue où l'on écarte (C-8.4) : l'état du groupe, suivi de « Rien n'est supprimé ». */
  rienSupprime?: string;
  navigation?: NavigationGroupes;
  /** Garder ou écarter une photo : touches 1 à 9, selon son numéro. */
  basculer?: (f: FichierPlan) => void;
  /** Légende plus haute, cartes plus larges (Sélection : quatre choix). */
  mesures?: Partial<MesuresComparer>;
  /** Présentation choisie à la main, gardée d'un groupe à l'autre. */
  gardee?: PresentationGardee;
  /**
   * Le badge de chaque photo (D112, C-9.2) : la même bande que sur la page, sous la photo (elle se clique), et sans
   * clic sur sa vignette de « Une à la fois » ; les boutons de choix restent dessous.
   */
  badge?: (f: FichierPlan) => DescriptionBadge;
}) {
  // La bande de 28 px et son écart s'ajoutent à la légende côte à côte : la photo cède sa place, rien ne déborde.
  const m = { ...MESURES, ...mesures, legendeCote: (mesures?.legendeCote ?? MESURES.legendeCote) + (badge ? BANDE_COMPARER : 0) };
  const n = photos.length;
  const ids = photos.map((f) => f.id);
  const [vue, setVue] = useState<Vue>(VUE_ENTIERE);
  const [courante, setCourante] = useState(() => photoOuverture(ids, conseillee));
  const [choisieIci, setChoisieIci] = useState<Presentation | null>(null);
  const choisie = gardee ? gardee.valeur : choisieIci;
  const setChoisie = (p: Presentation) => (gardee ? gardee.changer(p) : setChoisieIci(p));
  const [scene, setScene] = useState<Scene | null>(null);
  // La place de la règle : la scène comme si la ligne d'information faisait 32 px. Elle passe à la ligne selon
  // la photo courante (Sélection) : la présentation calculée n'en change pas à chaque ↑ ↓.
  const [sceneRegle, setSceneRegle] = useState<Scene | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const ligneInfo = useRef<HTMLDivElement>(null);
  const racine = useRef<HTMLDivElement>(null);
  const ratios = useProportions(photos);
  const c = Math.min(courante, n - 1);
  // Côte à côte : sur une rangée si elle tient, sinon sur deux ou trois (choisi à la main) ; jamais rien hors de la scène.
  const cote = ratios && scene ? dispositionCote(ratios, scene, m) : null;
  const calculee = n < 2 ? 'une' : ratios && sceneRegle ? choisirPresentation(ratios, sceneRegle, m) : null;
  const voulue: Presentation | null = n < 2 ? 'une' : (choisie ?? calculee);
  const presentation: Presentation | null = voulue === 'cote' && cote && cote.hauteur <= 0 ? 'une' : voulue;
  const basculerPresentation = () => n >= 2 && presentation && setChoisie(presentation === 'cote' ? 'une' : 'cote');

  // Une vue plein écran prend le clavier : le focus y entre à l'ouverture, revient au bouton qui l'a ouverte à la fermeture.
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    racine.current?.focus({ preventScroll: true });
    return () => {
      if (avant && avant.isConnected) avant.focus({ preventScroll: true });
    };
  }, []);

  // Place de la scène : relue à chaque changement de taille de la fenêtre.
  useLayoutEffect(() => {
    const el = zone.current;
    if (!el) return;
    const lire = () => {
      setScene({ largeur: el.clientWidth, hauteur: el.clientHeight });
      const enPlus = Math.max(0, (ligneInfo.current?.offsetHeight ?? 33) - 33);
      setSceneRegle((avant) => {
        const r = { largeur: el.clientWidth, hauteur: el.clientHeight + enPlus };
        return avant && avant.largeur === r.largeur && avant.hauteur === r.hauteur ? avant : r;
      });
    };
    lire();
    const obs = new ResizeObserver(lire);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /** La photo de ce numéro est-elle à l'écran (côte à côte, la grande ou sa vignette visible) ? */
  const numeroVisible = (k: number) => {
    if (k > n) return false;
    const el = zone.current?.querySelector<HTMLElement>(`[data-numero="${k}"]`);
    if (!el) return false;
    const b = el.getBoundingClientRect();
    const cadre = el.closest('ol')?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight, left: 0, right: innerWidth };
    return b.width > 0 && b.bottom > cadre.top + 4 && b.top < cadre.bottom - 4 && b.right > 0 && b.left < innerWidth;
  };
  const allerPhoto = (i: number) => {
    const j = Math.max(0, Math.min(n - 1, i));
    setCourante(j);
    // Côte à côte : le clavier passe sur la carte de cette photo, jamais sur un de ses choix (Entrée y garde son sens).
    if (presentation === 'cote') setTimeout(() => zone.current?.querySelector<HTMLElement>(`figure[data-numero="${j + 1}"]`)?.focus(), 0);
  };

  // « Choisir avec l'IA » : la vue passe sur la photo choisie, une fois la réponse arrivée.
  const suiviAvant = useRef(suivre);
  useEffect(() => {
    if (suivre && suivre !== suiviAvant.current && ids.includes(suivre)) allerPhoto(ids.indexOf(suivre));
    suiviAvant.current = suivre;
  }, [suivre]);
  const zoomer = (facteur: number) => setVue((v) => {
    const zoom = Math.min(10, Math.max(1, v.zoom * facteur));
    return zoom === 1 ? VUE_ENTIERE : { zoom, x: (v.x * zoom) / v.zoom, y: (v.y * zoom) / v.zoom };
  });

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      // Le recadrage ou un dialogue (coût d'une aide IA) ouvert par-dessus a la main sur le clavier.
      if (document.querySelector('.recadreur, [role="dialog"]:not(.comparateur), [role="alertdialog"]')) return;
      const k = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const cible = e.target instanceof Element ? e.target : null;
      // Une commande de la vue qu'Entrée active (Fermer, Accepter, l'aide IA, la case…) ; le choix d'une photo,
      // une vignette et le bouton de présentation n'en sont pas : Entrée y bascule, Espace les active.
      const commande = !!cible?.closest('.comparateur') && cible.matches('button, input, select, a') && !cible.closest('.choix-photo, .choix-presentation, .vignette-comparer');
      if (k === 'Escape') fermer();
      else if (k === 'Tab') {
        // Le clavier reste dans la vue : la page dessous est cachée.
        const vue = racine.current;
        const arrets = vue ? [...vue.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter((x) => x.offsetParent !== null) : [];
        if (!arrets.length) return;
        const i = arrets.indexOf(document.activeElement as HTMLElement);
        if (i >= 0 && !(e.shiftKey ? i === 0 : i === arrets.length - 1)) return;
        (e.shiftKey ? arrets.at(-1)! : arrets[0]).focus();
      } else if (ctrl) return;
      // Entrée bascule la présentation, sauf sur une commande de la vue (elle l'active) ; celle de la page, dessous, ne reçoit rien.
      else if (k === 'Enter' && !commande) basculerPresentation();
      else if (k === 'ArrowDown') allerPhoto(c + 1);
      else if (k === 'ArrowUp') allerPhoto(c - 1);
      else if ((k === 'PageDown' || k === 'ArrowRight') && navigation?.suivant) navigation.suivant();
      else if ((k === 'PageUp' || k === 'ArrowLeft') && navigation?.precedent) navigation.precedent();
      else if (k === '0') setVue(VUE_ENTIERE);
      else if (k === '+' || k === '=') zoomer(1.25);
      else if (k === '-') zoomer(0.8);
      else if (basculer && /^[1-9]$/.test(k) && numeroVisible(Number(k))) basculer(photos[Number(k) - 1]);
      else if (k.toLowerCase() === 'a' && navigation?.accepter) {
        // Une touche gardée enfoncée ne s'accepte qu'une fois (lot 4, § 1.7).
        if (!e.repeat) navigation.accepter();
      }
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [fermer, c, n, navigation, basculer, photos, presentation]);

  // Zoom vers le pointeur : le point visé reste sous la souris, dans chaque photo.
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const molette = (e: WheelEvent) => {
      const boite = (e.target as HTMLElement).closest('.volet-image');
      if (!boite) return;
      e.preventDefault();
      const b = boite.getBoundingClientRect();
      const px = e.clientX - (b.left + b.width / 2);
      const py = e.clientY - (b.top + b.height / 2);
      setVue((v) => {
        const zoom = Math.min(10, Math.max(1, v.zoom * (e.deltaY < 0 ? 1.25 : 0.8)));
        const q = zoom / v.zoom;
        return zoom === 1 ? VUE_ENTIERE : { zoom, x: px - (px - v.x) * q, y: py - (py - v.y) * q };
      });
    };
    el.addEventListener('wheel', molette, { passive: false });
    return () => el.removeEventListener('wheel', molette);
  }, []);

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

  const s = session.value;
  // Le numéro est la touche qui garde ou écarte la photo ; sans cette touche (Sélection), il n'est pas affiché.
  const numero = (i: number) =>
    basculer ? (
      <kbd class="numero-volet" title={t`Touche ${i + 1} : garder ou écarter cette photo`}>
        {i + 1}
      </kbd>
    ) : null;
  const choixDe = (f: FichierPlan, vertical: boolean) => (
    <div class={`choix-photo etat-photo ${etat(f).classe}${vertical ? ' vertical' : ''}`} role="group" aria-label={t`Photo ${photos.indexOf(f) + 1}`}>
      {choix(f, vertical)}
    </div>
  );

  let contenu: ComponentChildren = null;
  if (presentation === 'cote' && ratios && scene && cote) {
    const h = cote.hauteur;
    const cartes = photos.map((f, i) => {
      const ou = lieu?.(f);
      return (
      <figure
        key={f.id}
        class={`volet cmp-carte${i === c ? ' courante' : ''}`}
        data-numero={i + 1}
        tabIndex={-1}
        aria-label={t`Photo ${i + 1} sur ${n} : ${etat(f).libelle}`}
        // La carte a la largeur de sa photo, au moins celle de son état et de ses choix : la légende ne l'élargit jamais.
        style={{ width: `${Math.round(Math.max(h * ratios[i] + 2 * m.margeCarte, m.carteMin))}px` }}
        onMouseDown={() => setCourante(i)}
        onDblClick={(e) => {
          if (!(e.target as HTMLElement).closest('.volet-image')) return;
          setCourante(i);
          setChoisie('une');
        }}
        title={t`Double-clic : cette photo seule, en grand`}
      >
        <ImageVolet f={f} vue={vue} largeur={h * ratios[i]} hauteur={h} />
        <figcaption class="legende-comparer" style={{ height: `${m.legendeCote}px` }}>
          {badge && <BandeBadge badge={badge(f)} largeur={Math.round(Math.max(h * ratios[i] + 2 * m.margeCarte, m.carteMin))} />}
          {choixDe(f, false)}
          {(resume || ou || basculer) && (
            // Deux lignes au plus (C-9.6) ; le texte entier est dans l'infobulle et dans « Une à la fois ».
            <p class="ligne-legende" title={infobulle?.(f)}>
              {numero(i)}
              {resume?.(f)}
              {resume && ou && ' · '}
              {ou && <span class="lieu-photo">{ou}</span>}
            </p>
          )}
        </figcaption>
      </figure>
      );
    });
    contenu = repartir(cartes, cote.rangees).map((rangee, k) => (
      <div class="cmp-rangee" key={k}>
        {rangee}
      </div>
    ));
  } else if (presentation === 'une' && ratios && scene) {
    const f = photos[c];
    const place = placeUne(n, scene, m);
    const taille = contenir(ratios[c], place);
    const bande = bandeVignettes(n, scene.hauteur, m);
    contenu = (
      <>
        <div class="volet cmp-grande" data-numero={c + 1} key={`grande:${f.id}`}>
          <ImageVolet f={f} vue={vue} largeur={taille.largeur} hauteur={taille.hauteur} />
        </div>
        <div class="legende-une" title={infobulle?.(f)}>
          <p class="titre-legende">
            {numero(c)}
            {t`Photo ${c + 1} sur ${n}`}
          </p>
          {badge && <BandeBadge badge={badge(f)} largeur={m.legendeUne} />}
          {choixDe(f, true)}
          {plusieurs}
          {outils && <div class="outils-photo">{outils(f)}</div>}
          <div class="infos-une">
            {details ? (
              details(f)
            ) : (
              <>
                {resume && <span>{resume(f)}</span>}
                {lieu && <span>{lieu(f)}</span>}
              </>
            )}
          </div>
        </div>
        {n > 1 && (
          <nav class="vignettes-comparateur" aria-label={t`Les ${n} photos (↑ ↓)`} style={{ width: `${bande.largeur}px` }}>
            <ol style={{ gridTemplateColumns: `repeat(${bande.colonnes}, ${bande.largeurVignette + 2 * m.margeVignette}px)` }}>
              {photos.map((p, i) => {
                const e = etat(p);
                return (
                  <li key={p.id}>
                    <button type="button" class={`vignette-comparer${i === c ? ' affichee' : ''}`} data-numero={i + 1} aria-current={i === c ? 'true' : undefined} onClick={() => setCourante(i)} title={`${p.nom} : ${e.libelle}${basculer ? `\n${t`Touche ${i + 1} : garder ou écarter cette photo`}` : ''}`}>
                      <span class="cadre-vignette" style={{ width: `${bande.largeurVignette}px`, height: `${bande.hauteurVignette}px` }}>
                        {/* La miniature tient dans son cadre : un paysage en prend la largeur, un portrait la hauteur. */}
                        <Miniature f={p} taille={Math.round(ratios[i] >= 1 ? Math.min(bande.largeurVignette, bande.hauteurVignette * ratios[i]) : bande.hauteurVignette)} rotation={p.rotation} />
                      </span>
                      {badge ? (
                        // La vignette : le plein ou la bordure, l'icône d'origine et le numéro ; le mot dans l'infobulle.
                        <BandeBadge badge={{ ...badge(p), basculer: undefined, effet: undefined, mot: `${i + 1}`, motCourt: undefined }} largeur={bande.largeurVignette} enLigne />
                      ) : (
                        <span class={`etat-photo bande-etat ${e.classe}`}>
                          {e.icone && <Icone nom={e.icone} taille={16} />}
                          {i + 1} · {e.libelle}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </>
    );
  }

  return (
    <div class="comparateur" role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} ref={racine} data-annulable data-presentation={presentation ?? undefined}>
      <header class="comparateur-tete">
        <button type="button" class="fermer-comparateur" onClick={fermer} title={t`Échap`}>
          <Icone nom="croix" taille={16} />
          {t`Fermer`}
        </button>
        <span class="separateur" />
        {/* Le titre dit le groupe et sa place (« Groupe 2 sur 4 », comme la maquette) : la barre du bas garde
            la place pour les boutons de groupe, le rappel des touches, le zoom et « Accepter ». */}
        <h2>
          {titre}
          {navigation && (
            <span class="discret position-groupe" id="position-groupe">
              {' · '}
              {navigation.texte}
            </span>
          )}
          {sousTitre && <span class="discret"> · {sousTitre}</span>}
        </h2>
        <span class="espace" />
        {n >= 2 && (
          <span class="choix-segmente choix-presentation" role="radiogroup" aria-label={t`Présentation`}>
            <button
              type="button"
              role="radio"
              aria-checked={presentation === 'cote'}
              // Côte à côte impossible (trop de photos pour la largeur, même sur trois rangées) : la raison est écrite (C-4.7).
              disabled={!!cote && cote.hauteur <= 0}
              data-raison="libelle"
              aria-label={cote && cote.hauteur <= 0 ? t`Côte à côte : les ${n} photos ne tiennent pas à cette taille` : undefined}
              onClick={() => setChoisie('cote')}
              title={t`Entrée : basculer`}
            >
              <Icone nom="comparer" taille={16} />
              {t`Côte à côte`}
            </button>
            <button type="button" role="radio" aria-checked={presentation === 'une'} onClick={() => setChoisie('une')} title={t`Entrée : basculer`}>
              <Icone nom="une" taille={16} />
              {t`Une à la fois`}
            </button>
          </span>
        )}
        {s && <AnnulerRetablir historique={s.historique} annuler={annuler} retablir={retablir} />}
      </header>
      <div class="cmp-ligne" ref={ligneInfo}>
        {ligne && <span class="cmp-ligne-texte">{typeof ligne === 'function' ? ligne(photos[c]) : ligne}</span>}
        <span class="espace" />
        {presentation !== 'une' && plusieurs}
        {/* Seuls l'alerte et l'état du groupe sont annoncés quand ils changent. */}
        <span class="annonce-ligne" aria-live="polite">
          {navigation?.accepter && navigation.alerte && <span class="alerte-doublons">{navigation.alerte}</span>}
          {rienSupprime && (
            <span class="rien-supprime-vue" title={t`Rien n’est supprimé : ce que vous écartez va dans « Mis de côté ». Vos photos d’origine ne bougent pas.`}>
              <Icone nom="bouclier" taille={16} />
              {t`${rienSupprime} · Rien n’est supprimé`}
            </span>
          )}
        </span>
      </div>
      <div class={`volets cmp-scene ${presentation ?? 'calcul'} n${n}`} ref={zone} onMouseDown={glisser}>
        {contenu}
      </div>
      <footer class={`cmp-bas${navigation ? ' navigation-groupes' : ''}`}>
        {navigation && (
          <>
            {/* Désactivé, le bouton garde son nom ; sa raison est écrite dans le titre, « Groupe 1 sur 5 » (C-4.7).
                Au palier « texte agrandi », le mot cède sa place au rappel des flèches (exception nommée de C-5.2 : son nom reste dans aria-label). */}
            <button type="button" class="bouton-groupe" disabled={!navigation.precedent} aria-describedby={navigation.precedent ? undefined : 'position-groupe'} onClick={navigation.precedent} aria-label={t`Groupe précédent`} title={t`Groupe précédent (← ou Page préc.)`}>
              <Icone nom="chevronGauche" taille={16} />
              <span class="mot">{t`Groupe précédent`}</span>
            </button>
            <button type="button" class="bouton-groupe" disabled={!navigation.suivant} aria-describedby={navigation.suivant ? undefined : 'position-groupe'} onClick={navigation.suivant} aria-label={t`Groupe suivant`} title={t`Groupe suivant (→ ou Page suiv.)`}>
              <span class="mot">{t`Groupe suivant`}</span>
              <Icone nom="chevronDroite" taille={16} />
            </button>
          </>
        )}
        {/* Rappel permanent des flèches (C-4.10), à toutes les tailles ; au large, le chemin le plus court en entier. */}
        <span class="touches-comparer">
          {navigation ? (
            <>
              <kbd>↑ ↓</kbd> {t`photo`} · <kbd>← →</kbd> {t`groupe`}
            </>
          ) : (
            <>
              <kbd>↑ ↓</kbd> {t`photo`} · <kbd>{t`Entrée`}</kbd> {t`présentation`}
            </>
          )}
          {basculer && navigation?.accepter && (
            <span class="touches-plus">
              {' · '}
              <kbd>1–{Math.min(9, n)}</kbd> {t`choisir`} · <kbd>A</kbd> {t`accepter`}
            </span>
          )}
        </span>
        <span class="espace" />
        <span class="zoom-comparer">
          <button type="button" class="carre" onClick={() => zoomer(0.8)} aria-label={t`Zoom arrière (−)`} title={t`Zoom arrière (touche −)`}>
            <Icone nom="moins" taille={16} />
          </button>
          <button type="button" onClick={() => setVue(VUE_ENTIERE)} aria-label={t`Photo entière`} title={t`Photo entière (touche 0)`}>
            <Icone nom="entier" taille={16} />
            <span class="mot">{t`Photo entière`}</span>
          </button>
          <button type="button" class="carre" onClick={() => zoomer(1.25)} aria-label={t`Zoom avant (+)`} title={t`Zoom avant (touche +)`}>
            <Icone nom="plus" taille={16} />
          </button>
        </span>
        {navigation?.accepter && navigation.ditAccepter && (
          <span class="dit-accepter" aria-hidden="true" title={navigation.lecteurAccepter}>
            {navigation.ditAccepter}
          </span>
        )}
        {navigation?.accepter && (
          <button
            type="button"
            class="principal bouton-accepter"
            data-action="accepter"
            onClick={navigation.accepter}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.repeat && e.preventDefault()}
            aria-label={navigation.lecteurAccepter}
            title={t`${navigation.lecteurAccepter ?? t`Accepter`} (touche A, puis groupe suivant)`}
          >
            {t`Accepter`}
            <Icone nom="fleche" taille={16} />
          </button>
        )}
      </footer>
    </div>
  );
}
