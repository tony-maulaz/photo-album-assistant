// Cadre des pages d'étape. Forme E (retours du 29.10, D112 point 8) : la page défile en entier, avec une seule
// barre de défilement ; la barre du projet (logo, frise, compteur IA) part avec elle ; la ligne de l'étape
// (`LigneEtape` : titre, message, Taille, ↶ ↷, Aide et Menu) reste collée en haut sur les 13 étapes, et
// « Valider et continuer » en bas. La liste de gauche, le panneau de droite, l'Aide ouverte et les têtes de
// table se collent sous la ligne, à la hauteur de ce qu'on voit (`--haut-visible`).
//
// Les pages passent au cadre commun (lot 4, D111 : liste, table, panneau, colonne d'Aide) une par une
// (`PAGES_CADRE`) : `.app` porte alors `data-cadre="commun"`, les autres `data-cadre="ancien"`.

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { cranTaille, PAS_TAILLE } from '../../lib/grille';
import { t } from '../../lib/langue';
import { nomCourtEtape, nomEtape, type CodeEtape } from '../../navigateur/projet';
import { annuler, changerReglages, messages, notifier, page, reglages, retablir, session, versionPlan, versionProjet } from '../etat';
import { aideOuverte, aideVue, explicationOuverte, ouvrirAide, ouvrirExplication, useExplicationVue } from '../explications';
import { decouperMessage, minusculeInitiale } from '../format';
import { ETAPES_EN_ESSAI, MenuPrincipal, PastilleEssai, useDeroulant } from './Cadre';
import { Icone } from './Icones';

/** Étapes passées au cadre commun (liste, table, panneau, colonne d'Aide) ; les autres gardent leur disposition. */
export const PAGES_CADRE: ReadonlySet<CodeEtape> = new Set<CodeEtape>(['selection', 'doublons']);

/** Largeur de la fenêtre, relue à chaque changement de taille (palier, Aide). */
export const largeurFenetre = signal(typeof window === 'undefined' ? 1440 : window.innerWidth);
if (typeof window !== 'undefined') window.addEventListener('resize', () => (largeurFenetre.value = window.innerWidth));

/** Palier « texte agrandi » (C-7.6) : la largeur du contenu, Aide déduite, est de 1180 px ou moins. */
export const PALIER = 1180;

/** Largeur de la colonne de l'Aide : 320 px à 1440 et plus, 304 en dessous. */
export function largeurAide(): number {
  return largeurFenetre.value >= 1440 ? 320 : 304;
}

/**
 * État du cadre d'une page : l'Aide ouverte ou non, le palier (liste de gauche en menu) et l'écran étroit
 * (l'Aide prend la place du panneau de droite). L'Aide ouverte d'elle-même à la première visite (1440 px et
 * plus) est notée « vue ».
 */
export function useCadre(cle: string) {
  const largeur = largeurFenetre.value;
  const ouverte = aideOuverte(cle, largeur);
  useEffect(() => {
    if (ouverte && !aideVue(cle)) ouvrirAide(cle, true);
  }, [cle, ouverte]);
  const etroit = largeur <= PALIER;
  return { aide: ouverte, etroit, palier: etroit || largeur - (ouverte ? largeurAide() : 0) <= PALIER };
}

/**
 * La liste de gauche en menu, au palier : ouverte, elle reçoit le focus (sur l'élément choisi) ; Échap ou un clic
 * à côté la referment, et le focus revient au bouton [data-action=menu-liste] (WCAG 2.1.1, 2.4.3 ; tour 1 du lot 4).
 * Échap ne fait alors rien d'autre (à la Sélection, il ne vide pas la sélection de photos) ; Tab hors de la liste la referme.
 */
export function useMenuListe(ouverte: boolean, fermer: () => void) {
  useEffect(() => {
    if (!ouverte) return;
    // Ouverte, la liste se pose sous la ligne de l'étape : on y amène d'abord le haut du corps (la barre du projet
    // et les onglets partent), sans quoi elle couvrirait la barre d'outils. On vise la hauteur de la ligne une fois
    // collée, pas son bas actuel : en haut de la page, elle est encore sous la barre du projet.
    const corps = document.querySelector('.page-cadre .corps-cadre')?.getBoundingClientRect();
    const ligne = document.querySelector('.ligne-etape')?.getBoundingClientRect().height ?? 0;
    const ecart = corps ? corps.top - ligne : 0;
    if (ecart > 0) window.scrollBy(0, ecart);
    const liste = () => document.querySelector<HTMLElement>('.page-cadre[data-liste="ouverte"] .colonne-liste');
    const bouton = () => document.querySelector<HTMLElement>('[data-action="menu-liste"]');
    const image = requestAnimationFrame(() => {
      const l = liste();
      const FOCUS = 'button:not(:disabled), a[href], input, select, [tabindex="0"]';
      const choisi = l?.querySelector<HTMLElement>('[aria-current="true"], [aria-current="page"], .choisie, .actif, .active');
      const cible = (choisi?.matches(FOCUS) ? choisi : choisi?.querySelector<HTMLElement>(FOCUS)) ?? l?.querySelector<HTMLElement>(FOCUS);
      cible?.focus();
    });
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      e.stopPropagation();
      fermer();
      bouton()?.focus();
    };
    const clic = (e: PointerEvent) => {
      const c = e.target as Node;
      if (liste()?.contains(c) || bouton()?.contains(c)) return;
      fermer();
    };
    // Tab hors de la liste la referme : elle ne reste pas posée sur l'élément qui reçoit le focus (WCAG 2.4.11).
    const focus = (e: FocusEvent) => {
      const c = e.target as Node;
      if (c === document.body || liste()?.contains(c) || bouton()?.contains(c)) return;
      fermer();
    };
    window.addEventListener('keydown', touche, true);
    window.addEventListener('pointerdown', clic, true);
    window.addEventListener('focusin', focus, true);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener('keydown', touche, true);
      window.removeEventListener('pointerdown', clic, true);
      window.removeEventListener('focusin', focus, true);
    };
  }, [ouverte]);
}

/** L'étape affichée (sur toute page d'étape, une fois l'inventaire fait) : la règle du choix 6 A s'y applique. */
function etapeAffichee(): number | undefined {
  const p = page.value;
  const s = session.value;
  if (p.nom !== 'etape' || !s?.projet.inventaire) return undefined;
  return p.numero;
}

/** « Y aller » : le lien d'un message qui parle d'un geste fait à l'étape `n` (choix 6 de D111). */
function allerA(n: number) {
  return { libelle: t`Y aller`, faire: () => (page.value = { nom: 'etape', numero: n }) };
}

/** Le texte « Votre dernier changement est à l'étape N, Nom : allez-y pour l'annuler. ». */
function texteAilleurs(n: number): string {
  return t`Votre dernier changement est à l’étape ${n}, ${nomEtape(n)} : allez-y pour l’annuler.`;
}

/**
 * Ctrl+Z (choix 6 A, lot 4 ; forme E, D112 : sur les 13 étapes) : la touche suit la règle du bouton ↶ de la ligne
 * de l'étape ; elle ne défait pas sans le montrer un geste fait à une autre étape (tour 3 du lot 4, accessibilité
 * N2). Hors des étapes, elle reste globale.
 */
export function annulerIci() {
  const s = session.value;
  if (!s) return;
  const h = s.historique;
  const ici = etapeAffichee();
  const n = h.etapeAnnulation;
  if (ici !== undefined && h.peutAnnuler && n !== undefined && n !== ici) notifier('info', t`Rien à annuler ici. ${texteAilleurs(n)}`, allerA(n));
  else if (h.peutAnnuler) annuler();
  else notifier('info', t`Rien à annuler.`);
}

/** Ctrl+Y : la même règle que ↷ de la ligne de l'étape. */
export function retablirIci() {
  const s = session.value;
  if (!s) return;
  const h = s.historique;
  const ici = etapeAffichee();
  const n = h.etapeRetablissement;
  if (ici !== undefined && h.peutRetablir && n !== undefined && n !== ici) notifier('info', t`Rien à rétablir ici : le dernier changement annulé est à l’étape ${n}, ${nomEtape(n)}.`, allerA(n));
  else if (h.peutRetablir) retablir();
  else notifier('info', t`Rien à rétablir.`);
}

// ---------------------------------------------------------------------------
// Forme E (retours du 29.10, D112 point 8) : la page défile en entier ; la barre du projet part avec elle ;
// la ligne de l'étape reste collée en haut, sur les 13 étapes.
// ---------------------------------------------------------------------------

/**
 * Où chaque page pose sa ligne d'étape (portail) : un élément créé une fois, rangé dans la bande collée de
 * l'application (`HautEtape`), entre la barre du projet et la page. La ligne n'est donc ni dans le cadre ni
 * dans les marges de la page : même largeur et ↶ au même pixel partout, sans attendre un premier rendu.
 */
const placeLigne = typeof document === 'undefined' ? null : document.createElement('div');

/** La bande collée en haut de la fenêtre (vide hors des étapes). */
export function HautEtape() {
  return (
    <div
      class="haut-etape"
      ref={(el) => {
        if (el && placeLigne && placeLigne.parentNode !== el) el.appendChild(placeLigne);
      }}
    />
  );
}

/** La vue en cours d'une page dont les onglets ou les filtres ne tiennent pas dans la ligne (C-4.12). */
export interface VueLigne {
  /** Nom lu du menu (« Sortes de doublons », « Choix »). */
  nom: string;
  choix: { cle: string; libelle: string }[];
  actuelle: string;
  /** Libellé écrit quand la vue en cours n'est pas un des choix (« Grandes » à la Sélection). */
  libelle?: string;
  choisir: (cle: string) => void;
  /** Ce qui porte les onglets ou les filtres dans la page : le menu paraît quand il passe sous la ligne. */
  repere?: string;
}

/** Ce qu'on voit vraiment de la page, en px depuis le haut de la fenêtre : sous la ligne de l'étape, au-dessus de la barre du bas. */
export function bornesFenetre(): { haut: number; bas: number } {
  const ligne = document.querySelector('.ligne-etape')?.getBoundingClientRect();
  const barre = document.querySelector('.barre-validation')?.getBoundingClientRect();
  return { haut: Math.max(0, ligne ? ligne.bottom : 0), bas: Math.min(innerHeight, barre && barre.height ? barre.top : innerHeight) };
}

/** Vrai quand l'élément `repere` est passé (même en partie) sous la ligne de l'étape. */
function useSousLaLigne(repere: string | undefined): boolean {
  const [sous, setSous] = useState(false);
  useEffect(() => {
    if (!repere) return;
    let attente = 0;
    const mesurer = () => {
      attente = 0;
      const r = document.querySelector(repere)?.getBoundingClientRect();
      const ligne = document.querySelector('.ligne-etape')?.getBoundingClientRect();
      setSous(!!r && !!ligne && r.height > 0 && r.top < ligne.bottom - 1);
    };
    const plusTard = () => {
      if (!attente) attente = requestAnimationFrame(mesurer);
    };
    mesurer();
    window.addEventListener('scroll', plusTard, { passive: true });
    window.addEventListener('resize', plusTard);
    return () => {
      window.removeEventListener('scroll', plusTard);
      window.removeEventListener('resize', plusTard);
      cancelAnimationFrame(attente);
    };
  }, [repere]);
  return sous;
}

/**
 * Le focus, après le menu de la vue (choix, Échap, ou menu parti parce qu'on est remonté) : sur « Rafales ▾ » s'il
 * est encore là, sinon sur l'onglet ou le filtre en cours de la page, revenu en vue. Jamais perdu sur la page (WCAG 2.4.3).
 */
function rendreFocusVue(repere: string) {
  requestAnimationFrame(() => {
    const actif = document.activeElement;
    if (actif && actif !== document.body && actif.isConnected) return;
    const bouton = document.querySelector<HTMLElement>('.ligne-etape .bouton-vue');
    const outils = document.querySelector(repere);
    const enCours = outils?.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"], [aria-current="true"], [aria-checked="true"]') ?? outils?.querySelector<HTMLElement>('button:not(:disabled)');
    (bouton ?? enCours)?.focus({ preventScroll: true });
  });
}

/** « Rafales ▾ » : la vue en cours, écrite dans la ligne quand les onglets sont partis avec la page ; on en change sans remonter. */
function MenuVue({ vue, repere }: { vue: VueLigne; repere: string }) {
  const [ouvert, basculer, zone] = useDeroulant();
  const libelle = vue.choix.find((c) => c.cle === vue.actuelle)?.libelle ?? vue.libelle ?? '';
  // Ouvert, le menu reçoit le focus sur la vue en cours ; fermé (choix, Échap), il le rend à « Rafales ▾ ».
  const etaitOuvert = useRef(false);
  useEffect(() => {
    if (ouvert) zone.current?.querySelector<HTMLElement>('[aria-checked="true"], [role="menuitemradio"]')?.focus();
    else if (etaitOuvert.current) rendreFocusVue(repere);
    etaitOuvert.current = ouvert;
  }, [ouvert]);
  // Le menu part (on est remonté, les onglets sont revenus) alors qu'il avait le focus : il revient à l'onglet en cours.
  useEffect(
    () => () => {
      if (zone.current?.contains(document.activeElement)) rendreFocusVue(repere);
    },
    [],
  );
  return (
    <div class="menu-vue" ref={zone}>
      <button type="button" class="bouton-vue" data-action="menu-vue" aria-haspopup="menu" aria-expanded={ouvert} aria-label={t`${vue.nom} : ${libelle}`} onClick={() => basculer()}>
        <span class="nom-vue">{libelle}</span>
        <Icone nom={ouvert ? 'chevronHaut' : 'chevronBas'} taille={16} />
      </button>
      {ouvert && (
        <div class="menu-deroulant" role="menu" aria-label={vue.nom}>
          {vue.choix.map((c) => (
            <button
              key={c.cle}
              type="button"
              role="menuitemradio"
              aria-checked={c.cle === vue.actuelle}
              class={c.cle === vue.actuelle ? 'actif' : ''}
              onClick={() => {
                basculer(false);
                vue.choisir(c.cle);
              }}
            >
              {c.libelle}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** L'Aide de l'étape : une colonne (pages du cadre commun) ou le texte de l'étape sous la ligne (les autres). */
export interface AideLigne {
  cle: string;
  /** Colonne de l'Aide du cadre commun (« à lire » tant qu'elle n'a pas été ouverte). */
  colonne?: boolean;
  /** Texte sous la ligne : ouvert quoi qu'il arrive (sauf si on le replie), par exemple tant que la première action reste à faire. */
  ouverte?: boolean;
}

/** « Aide », à droite de la ligne de l'étape, juste avant Menu (C-8.1, D112) ; un point bleu tant qu'elle reste « à lire ». */
function BoutonAideLigne({ aide }: { aide: AideLigne }) {
  const ouverte = aide.colonne ? aideOuverte(aide.cle, largeurFenetre.value) : explicationOuverte(aide.cle, aide.ouverte);
  const aLire = !!aide.colonne && !ouverte && !aideVue(aide.cle);
  const basculer = () => {
    if (aide.colonne) return ouvrirAide(aide.cle, !ouverte);
    ouvrirExplication(aide.cle, !ouverte);
    // Le texte s'ouvre en haut de la page : on l'amène sous la ligne, même si l'on avait défilé.
    if (!ouverte) requestAnimationFrame(() => document.getElementById('aide-etape')?.scrollIntoView({ block: 'nearest' }));
  };
  return (
    <button
      type="button"
      class={`bouton-aide aide-ligne${aLire ? ' a-lire' : ''}`}
      data-place="aide"
      aria-expanded={ouverte}
      aria-controls={ouverte ? (aide.colonne ? 'panneau-aide' : 'aide-etape') : undefined}
      onClick={basculer}
      title={ouverte ? (aide.colonne ? t`Fermer l’aide de l’étape (Échap)` : t`Fermer l’aide de l’étape`) : t`Ouvrir l’aide de l’étape`}
    >
      <Icone nom="aide" taille={16} />
      {t`Aide`}
      {aLire && (
        <span class="point-a-lire">
          <span class="texte-masque">{t`à lire`}</span>
        </span>
      )}
    </button>
  );
}

/** ↶ et ↷ en icônes seules (D112) : le geste dans l'infobulle et le nom lu ; « Rien à annuler ici », grisé, quand il est ailleurs. */
function AnnulerRetablirLigne() {
  const s = session.value!;
  // L'historique est modifié sur place : sans lire ces signaux, @preact/signals sauterait le rendu et ↶ garderait
  // un geste périmé (tour 1 du lot 4, B1).
  void versionPlan.value;
  void versionProjet.value;
  const h = s.historique;
  const ici = etapeAffichee();
  const ailleurs = (n: number | undefined) => ici !== undefined && n !== undefined && n !== ici;
  const annulerAilleurs = h.peutAnnuler && ailleurs(h.etapeAnnulation);
  const retablirAilleurs = h.peutRetablir && ailleurs(h.etapeRetablissement);
  const peutAnnuler = h.peutAnnuler && !annulerAilleurs;
  const peutRetablir = h.peutRetablir && !retablirAilleurs;
  const geste = h.detailAnnulation ?? h.prochaineAnnulation;
  const nomAnnuler = peutAnnuler ? (geste ? t`Annuler : ${minusculeInitiale(geste)}` : t`Annuler`) : annulerAilleurs ? t`Rien à annuler ici` : t`Rien à annuler`;
  const nomRetablir = peutRetablir ? t`Rétablir` : retablirAilleurs ? t`Rien à rétablir ici` : t`Rien à rétablir`;
  return (
    <span class="annuler-retablir icones-seules">
      <button
        type="button"
        class="bouton-annuler icone-seule"
        data-place="annuler"
        disabled={!peutAnnuler}
        data-raison={peutAnnuler ? undefined : 'libelle'}
        aria-keyshortcuts="Control+Z"
        onClick={annuler}
        title={peutAnnuler ? `${nomAnnuler}\nCtrl+Z` : annulerAilleurs ? `${nomAnnuler}. ${texteAilleurs(h.etapeAnnulation!)}` : nomAnnuler}
      >
        <Icone nom="annuler" taille={20} />
        <span class="texte-masque">{nomAnnuler}</span>
      </button>
      <button
        type="button"
        class="bouton-retablir icone-seule"
        data-place="retablir"
        disabled={!peutRetablir}
        data-raison={peutRetablir ? undefined : 'libelle'}
        aria-keyshortcuts="Control+Y"
        onClick={retablir}
        title={`${nomRetablir}\nCtrl+Y`}
      >
        <Icone nom="retablir" taille={20} />
        <span class="texte-masque">{nomRetablir}</span>
      </button>
    </span>
  );
}

/**
 * Le message passager, dans la ligne de l'étape (jamais sur les photos, le plein ou la barre du bas) : deux lignes
 * au plus, ce qui s'est passé en gras ; une erreur passe avant. Après un geste de la page, il finit par « ↶ ou
 * Ctrl+Z pour l'annuler » (↶ de la ligne le défait) ; après un geste d'une autre étape (« 12 photos écartées » de
 * Floues, à l'arrivée sur Doublons), il commence par le nom de cette étape et son lien « Y aller » y mène, où ↶ le
 * défait (choix 6 de D111).
 */
function MessageLigne() {
  const s = session.value!;
  const liste = messages.value;
  const m = [...liste].reverse().find((x) => x.type === 'erreur') ?? liste.at(-1);
  const h = s.historique;
  const ici = etapeAffichee();
  const n = h.etapeAnnulation;
  const geste = m?.action?.faire === annuler;
  const ailleurs = geste && h.peutAnnuler && ici !== undefined && n !== undefined && n !== ici;
  const [gras, suite] = m ? decouperMessage(m.texte) : ['', ''];
  return (
    // Toujours dans l'arbre d'accessibilité, même vide (masqué à l'écran, jamais `display: none`) : une région
    // vivante qui apparaît avec son texte n'est pas lue (WCAG 4.1.3). Chaque message est un nouveau nœud (`key`) :
    // deux « 1 photo écartée » de suite sont lus deux fois (tour 3 du lot 4, accessibilité N1).
    <p class={`message-entete${m ? ` ${m.type}` : ''}`} role="status" title={m?.texte}>
      {m && (
        <span class="contenu-message" key={m.id}>
          <span class="texte-message">
            {/* Venu d'une autre étape, il commence par son nom (« Floues : 6 photos écartées », É12 g). */}
            <strong>{ailleurs ? t`${nomCourtEtape(n!)} : ${gras}` : gras}</strong>
            {/* Après le nom de l'étape, une virgule plutôt qu'un second deux-points. */}
            {ailleurs ? suite.replace(/^[\s\u00a0\u202f]?:\s/u, ', ') : suite}
            {geste && h.peutAnnuler && !ailleurs && (
              <span class="rappel-annuler">
                {' '}
                <Icone nom="annuler" taille={14} titre={t`Annuler`} /> {t`ou Ctrl+Z pour l’annuler`}
              </span>
            )}
          </span>
          {ailleurs ? (
            <button type="button" class="lien" data-action="y-aller" onClick={allerA(n!).faire} title={t`Aller à l’étape ${n!}, ${nomEtape(n!)}, pour l’annuler`}>
              {t`Y aller`}
            </button>
          ) : (
            m.action &&
            !geste && (
              <button type="button" class="lien" onClick={m.action.faire}>
                {m.action.libelle}
              </button>
            )
          )}
        </span>
      )}
    </p>
  );
}

/**
 * La ligne de l'étape (forme E, D112), collée en haut de la fenêtre sur les 13 étapes, sur une ligne de 48 px :
 * le titre, la vue en cours quand ses onglets sont partis avec la page, le message passager ; à droite, toujours
 * dans le même ordre et aux mêmes largeurs (↶ au même pixel sur chaque page) : la Taille des photos (sa place
 * reste vide sur une page qui n'en a pas), ↶ ↷, Aide et Menu. Sa hauteur est fixe (`--h-ligne-etape`, 48 px) :
 * ce qui se colle dessous (liste de gauche, panneau, Aide, têtes de table et de groupe) s'y règle.
 */
export function LigneEtape({
  titre,
  aide,
  taille,
  vue,
}: {
  titre: string;
  aide?: AideLigne;
  /** La Taille des photos ; une fonction : la taille vraiment montrée (vignettes de dossier à 0,6). */
  taille?: boolean | ((v: number) => number);
  vue?: VueLigne;
}) {
  const p = page.value;
  const numero = p.nom === 'etape' ? p.numero : 0;
  const repere = vue ? (vue.repere ?? '.outils-cadre') : undefined;
  const sous = useSousLaLigne(repere);
  if (!placeLigne) return null;
  return createPortal(
    <div class="ligne-etape">
      <div class="gauche-ligne">
        <h1>
          {titre}
          {ETAPES_EN_ESSAI.has(numero) && <PastilleEssai />}
        </h1>
        {vue && sous && <MenuVue vue={vue} repere={repere!} />}
        <MessageLigne />
      </div>
      <div class="droite-ligne">
        <div class="place-taille">{taille && <CurseurTaille vraie={typeof taille === 'function' ? taille : undefined} />}</div>
        <span class="separateur-ligne" aria-hidden="true" />
        <AnnulerRetablirLigne />
        <span class="separateur-ligne" aria-hidden="true" />
        {aide ? <BoutonAideLigne aide={aide} /> : <span class="place-aide" />}
        <MenuPrincipal />
      </div>
    </div>,
    placeLigne,
  );
}

/**
 * L'Aide d'une étape pas encore passée au cadre commun : son texte, sous la ligne de l'étape, ouvert à la première
 * visite puis replié ; « Aide » de la ligne le rouvre (D53, D56). La phrase de consigne a quitté l'en-tête
 * (D112, question 21) : elle est ici.
 */
export function AideEtape({ cle, ouverte = false, children }: { cle: string; ouverte?: boolean; children: ComponentChildren }) {
  useExplicationVue(cle);
  if (!explicationOuverte(cle, ouverte)) return null;
  return (
    <section class="aide-etape" id="aide-etape" aria-label={t`Aide`}>
      <div class="texte-aide-etape">{children}</div>
      <div class="bas-aide-etape">
        <button type="button" class="lien" onClick={() => (page.value = { nom: 'aide' })}>
          {t`Tout le mode d’emploi`}
        </button>
        <button
          type="button"
          class="fermer-aide"
          onClick={() => {
            ouvrirExplication(cle, false);
            // Le bouton part avec le texte : le focus revient à « Aide » de la ligne, pas sur la page (WCAG 2.4.3).
            document.querySelector<HTMLElement>('.ligne-etape [data-place="aide"]')?.focus();
          }}
        >
          <Icone nom="croix" taille={16} />
          {t`Fermer`}
        </button>
      </div>
    </section>
  );
}

/**
 * Taille des photos (retours du 29.10, question 11) : une petite photo, un curseur gris de 12 crans, une grande
 * photo ; les deux photos sont des boutons d'un cran, le clavier passe par le curseur (← → un cran, Origine, Fin).
 * Un seul réglage pour toutes les étapes, au même endroit sur chaque page : dans la ligne de l'étape, à gauche
 * de ↶. `vraie` : la taille réellement montrée (vignettes de dossier à 0,6), lue dans l'infobulle et
 * par le lecteur d'écran ; `id` : celui du curseur, pour une étiquette de formulaire (Réglages).
 */
export function CurseurTaille({ vraie, id }: { vraie?: (v: number) => number; id?: string }) {
  const i = cranTaille(reglages.value.tailleMiniatures);
  const dernier = PAS_TAILLE.length - 1;
  const v = PAS_TAILLE[i];
  const n = vraie ? vraie(v) : v;
  const changer = (j: number) => {
    if (j >= 0 && j <= dernier && PAS_TAILLE[j] !== reglages.value.tailleMiniatures) changerReglages({ ...reglages.value, tailleMiniatures: PAS_TAILLE[j] });
  };
  return (
    <div class="taille-cadre" data-place="taille" role="group" aria-label={t`Taille des photos`} title={vraie ? t`Taille des vignettes : ${n} px` : t`Taille des photos : ${v} px (de 100 à 600)`} data-valeur={v}>
      <button
        type="button"
        class="bout-taille"
        data-action="plus-petites"
        disabled={i === 0}
        data-raison={i === 0 ? 'libelle' : undefined}
        aria-label={i === 0 ? t`Photos plus petites : déjà la plus petite taille` : t`Photos plus petites`}
        title={i === 0 ? t`Photos plus petites : déjà la plus petite taille` : t`Photos plus petites`}
        onClick={() => changer(i - 1)}
      >
        <Icone nom="photo" taille={14} />
      </button>
      <input
        type="range"
        id={id}
        class="curseur-taille"
        min={0}
        max={dernier}
        step={1}
        value={i}
        aria-label={t`Taille des photos`}
        aria-valuetext={vraie ? t`vignettes de ${n} px` : t`${n} px`}
        style={{ '--parcouru': `${(i / dernier) * 100}%` }}
        onInput={(e) => changer(Number(e.currentTarget.value))}
      />
      <button
        type="button"
        class="bout-taille"
        data-action="plus-grandes"
        disabled={i === dernier}
        data-raison={i === dernier ? 'libelle' : undefined}
        aria-label={i === dernier ? t`Photos plus grandes : déjà la plus grande taille` : t`Photos plus grandes`}
        title={i === dernier ? t`Photos plus grandes : déjà la plus grande taille` : t`Photos plus grandes`}
        onClick={() => changer(i + 1)}
      >
        <Icone nom="photo" taille={20} />
      </button>
    </div>
  );
}

/** Barre d'outils : onglets ou filtres (la Taille est dans l'en-tête de l'étape). */
export function OutilsCadre({ children }: { children: ComponentChildren }) {
  return (
    <nav class="outils-cadre" aria-label={t`Outils`}>
      <div class="gauche-outils">{children}</div>
    </nav>
  );
}

/** Colonne de l'Aide (320 / 304 px) : elle pousse le contenu ; « Fermer » (avec le mot) ou Échap la ferment. */
export function PanneauAide({ cle, titre, children }: { cle: string; titre: string; children: ComponentChildren }) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !(document.activeElement as HTMLElement | null)?.closest('#panneau-aide')) return;
      ouvrirAide(cle, false);
      document.querySelector<HTMLElement>('[data-place="aide"]')?.focus();
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  }, [cle]);
  return (
    <aside class="panneau-aide" id="panneau-aide" aria-label={t`Aide`}>
      <div class="tete-col">
        <h2>{t`Aide : ${titre}`}</h2>
        <button type="button" class="fermer-aide" onClick={() => ouvrirAide(cle, false)} title={t`Échap`}>
          <Icone nom="croix" taille={16} />
          {t`Fermer`}
        </button>
      </div>
      <div class="defile-col corps-aide">
        {children}
        <p>
          <button type="button" class="lien" onClick={() => (page.value = { nom: 'aide' })}>
            {t`Tout le mode d’emploi`}
          </button>
        </p>
      </div>
    </aside>
  );
}
