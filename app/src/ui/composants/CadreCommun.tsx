// Cadre commun des pages d'étape (lot 4 de la charte, D111) : des bandes de hauteur fixe (barre de
// l'application, en-tête d'étape, barre d'outils, barre du bas) ; seule la zone de contenu défile, chaque
// colonne de son côté. « Aide » est dans la barre de l'application, juste avant Menu ; « Annuler » et
// « Rétablir » à droite de l'en-tête d'étape ; « Taille − + » au bout de la barre d'outils. Sous 440 px
// de haut, la page défile en entier et seule la barre du bas reste en place.
//
// Les pages passent au cadre une par une (`PAGES_CADRE`) : `.app` porte alors `data-cadre="commun"`, les
// autres gardent `data-cadre="ancien"` et leur défilement d'avant.

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect } from 'preact/hooks';
import { t } from '../../lib/langue';
import { CODES_ETAPES, nomEtape, type CodeEtape } from '../../navigateur/projet';
import { annuler, changerReglages, messages, notifier, page, reglages, retablir, session, versionPlan, versionProjet } from '../etat';
import { aideOuverte, aideVue, ouvrirAide } from '../explications';
import { AnnulerRetablir } from './Cadre';
import { Icone } from './Icones';

/** Étapes passées au cadre commun ; les autres gardent l'ancien défilement (la page entière). */
export const PAGES_CADRE: ReadonlySet<CodeEtape> = new Set<CodeEtape>(['selection', 'doublons']);

/** Largeur de la fenêtre, relue à chaque changement de taille (palier, Aide). */
export const largeurFenetre = signal(typeof window === 'undefined' ? 1440 : window.innerWidth);
if (typeof window !== 'undefined') window.addEventListener('resize', () => (largeurFenetre.value = window.innerWidth));

/** Palier « texte agrandi » (C-7.6) : la largeur du contenu, Aide déduite, est de 1180 px ou moins. */
export const PALIER = 1180;

/** L'Aide de la page affichée, posée par la page pour le bouton de la barre de l'application. */
const aidePage = signal<string | null>(null);

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
  useLayoutEffect(() => {
    aidePage.value = cle;
    return () => {
      if (aidePage.value === cle) aidePage.value = null;
    };
  }, [cle]);
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

/** « Aide » dans la barre de l'application, juste avant Menu (C-8.1) ; « à lire » tant qu'elle n'a pas été ouverte. */
export function BoutonAideCadre() {
  const cle = aidePage.value;
  if (!cle || page.value.nom !== 'etape' || !session.value) return null;
  const ouverte = aideOuverte(cle, largeurFenetre.value);
  const aLire = !ouverte && !aideVue(cle);
  return (
    <button
      type="button"
      class={`bouton-aide aide-cadre${aLire ? ' a-lire' : ''}`}
      data-place="aide"
      aria-expanded={ouverte}
      aria-controls="panneau-aide"
      onClick={() => ouvrirAide(cle, !ouverte)}
      title={ouverte ? t`Fermer l’aide de l’étape (Échap)` : t`Ouvrir l’aide de l’étape`}
    >
      <Icone nom="aide" taille={20} />
      {t`Aide`}
      {aLire && <span class="marque-a-lire">{t`à lire`}</span>}
    </button>
  );
}

/** L'étape affichée si elle est passée au cadre commun (sinon `undefined`) : la règle du choix 6 A s'y applique. */
function etapeDuCadre(): number | undefined {
  const p = page.value;
  const s = session.value;
  if (p.nom !== 'etape' || !s?.projet.inventaire) return undefined;
  const code = CODES_ETAPES[p.numero - 1];
  return code && PAGES_CADRE.has(code) ? p.numero : undefined;
}

/** Le texte « Votre dernier changement est à l'étape N, Nom : allez-y pour l'annuler. ». */
function texteAilleurs(n: number): string {
  return t`Votre dernier changement est à l’étape ${n}, ${nomEtape(n)} : allez-y pour l’annuler.`;
}

/**
 * Ctrl+Z (choix 6 A, lot 4) : sur une page passée au cadre, la touche suit la règle du bouton de l'en-tête ; elle
 * ne défait pas sans le montrer un geste fait à une autre étape (tour 3 du lot 4, accessibilité N2). Ailleurs, elle
 * reste globale, comme avant le lot.
 */
export function annulerIci() {
  const s = session.value;
  if (!s) return;
  const h = s.historique;
  const ici = etapeDuCadre();
  const n = h.etapeAnnulation;
  if (ici !== undefined && h.peutAnnuler && n !== undefined && n !== ici) notifier('info', t`Rien à annuler ici. ${texteAilleurs(n)}`);
  else if (h.peutAnnuler) annuler();
  else notifier('info', t`Rien à annuler.`);
}

/** Ctrl+Y : la même règle que « Rétablir » de l'en-tête. */
export function retablirIci() {
  const s = session.value;
  if (!s) return;
  const h = s.historique;
  const ici = etapeDuCadre();
  const n = h.etapeRetablissement;
  if (ici !== undefined && h.peutRetablir && n !== undefined && n !== ici) notifier('info', t`Rien à rétablir ici : le dernier changement annulé est à l’étape ${n}, ${nomEtape(n)}.`);
  else if (h.peutRetablir) retablir();
  else notifier('info', t`Rien à rétablir.`);
}

/** En-tête d'étape : le titre (24 px, à 24 px du bord), la consigne d'une ligne, « Annuler : … » et « Rétablir » à droite. */
export function EnteteCadre({ titre, consigne }: { titre: string; consigne: ComponentChildren }) {
  const s = session.value!;
  // L'historique est modifié sur place : sans lire ces signaux, @preact/signals sauterait le rendu (props
  // identiques) et « Annuler : … » garderait un geste périmé (tour 1 du lot 4, B1).
  void versionPlan.value;
  void versionProjet.value;
  // Choix 6 A (lot 4) : le bouton ne défait que les gestes de l'étape affichée ; si le dernier est ailleurs, il le
  // dit (« Rien à annuler ici », l'étape en infobulle). Ctrl+Z et Ctrl+Y suivent la même règle (`annulerIci`).
  const h = s.historique;
  const p = page.value;
  const ici = p.nom === 'etape' ? p.numero : undefined;
  const ailleurs = (n: number | undefined) => ici !== undefined && n !== undefined && n !== ici;
  const annulerAilleurs = h.peutAnnuler && ailleurs(h.etapeAnnulation);
  const retablirAilleurs = h.peutRetablir && ailleurs(h.etapeRetablissement);
  const historique = {
    peutAnnuler: h.peutAnnuler && !annulerAilleurs,
    peutRetablir: h.peutRetablir && !retablirAilleurs,
    prochaineAnnulation: h.prochaineAnnulation,
    detailAnnulation: h.detailAnnulation,
    ailleurs: annulerAilleurs ? texteAilleurs(h.etapeAnnulation!) : undefined,
    retablirAilleurs,
  };
  // Le message passager s'écrit ici, à la place de la consigne et à côté d'« Annuler » : jamais sur les photos,
  // le plein ou la barre du bas (tour 2 du lot 4) ; une erreur passe avant. Son « Annuler » est celui de l'en-tête,
  // sauf quand le geste est à une autre étape (« 12 photos écartées » de Floues, à l'arrivée) : le bouton dit alors
  // « Rien à annuler ici », et le message garde son « Annuler » (tour 3 du lot 4, testeur M2).
  const liste = messages.value;
  const m = [...liste].reverse().find((x) => x.type === 'erreur') ?? liste.at(-1);
  const action = m?.action && (m.action.faire !== annuler || annulerAilleurs) ? m.action : undefined;
  return (
    <header class="entete-cadre">
      <div class="titre-cadre">
        <h1>{titre}</h1>
        {!m && (
          <p class="consigne" title={typeof consigne === 'string' ? consigne : undefined}>
            {consigne}
          </p>
        )}
        {/* Toujours dans l'arbre d'accessibilité, même vide (masqué à l'écran, jamais `display: none`) : une région
            vivante qui apparaît avec son texte n'est pas lue (WCAG 4.1.3). Chaque message est un nouveau nœud (`key`) :
            deux « 1 photo écartée » de suite sont lus deux fois (tour 3 du lot 4, accessibilité N1). */}
        <p class={`consigne message-entete${m ? ` ${m.type}` : ''}`} role="status" title={m?.texte}>
          {m && (
            <span class="contenu-message" key={m.id}>
              <span class="pastille-message">
                <Icone nom={m.type === 'ok' ? 'coche' : m.type === 'erreur' ? 'alerte' : 'info'} taille={14} titre={m.type === 'ok' ? t`Fait` : m.type === 'erreur' ? t`Erreur` : t`Information`} />
              </span>
              <span class="texte-message">{m.texte}</span>
              {action && (
                <button type="button" class="lien" onClick={action.faire}>
                  {action.libelle}
                </button>
              )}
            </span>
          )}
        </p>
      </div>
      <AnnulerRetablir historique={historique} annuler={annuler} retablir={retablir} />
    </header>
  );
}

/** Pas du réglage « Taille − + » (px de la photo), de 100 à 600. */
const PAS_TAILLE = [100, 120, 140, 160, 180, 200, 240, 280, 320, 400, 480, 600];

/** « Taille − + » au bout de la barre d'outils (C-8.3) : un seul réglage pour toutes les étapes. */
export function TailleCadre() {
  const v = reglages.value.tailleMiniatures;
  const plusPetite = [...PAS_TAILLE].reverse().find((x) => x < v);
  const plusGrande = PAS_TAILLE.find((x) => x > v);
  const changer = (x: number | undefined) => x !== undefined && changerReglages({ ...reglages.value, tailleMiniatures: x });
  return (
    <div class="taille-cadre" data-place="taille" role="group" aria-label={t`Taille des photos`} title={t`Taille des photos : ${v} px (de 100 à 600)`} data-valeur={v}>
      <span class="mot-taille">{t`Taille`}</span>
      <button type="button" class="bouton-taille" data-action="plus-petites" disabled={plusPetite === undefined} data-raison={plusPetite === undefined ? 'libelle' : undefined} aria-label={plusPetite === undefined ? t`Photos plus petites : déjà la plus petite taille` : t`Photos plus petites`} onClick={() => changer(plusPetite)}>
        <Icone nom="moins" taille={20} />
      </button>
      <button type="button" class="bouton-taille" data-action="plus-grandes" disabled={plusGrande === undefined} data-raison={plusGrande === undefined ? 'libelle' : undefined} aria-label={plusGrande === undefined ? t`Photos plus grandes : déjà la plus grande taille` : t`Photos plus grandes`} onClick={() => changer(plusGrande)}>
        <Icone nom="plus" taille={20} />
      </button>
    </div>
  );
}

/** Barre d'outils : onglets ou filtres à gauche, « Taille − + » au bout à droite. */
export function OutilsCadre({ children, taille = true }: { children: ComponentChildren; taille?: boolean }) {
  return (
    <nav class="outils-cadre" aria-label={t`Outils`}>
      <div class="gauche-outils">{children}</div>
      {taille && <TailleCadre />}
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
          <Icone nom="croix" taille={20} />
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
