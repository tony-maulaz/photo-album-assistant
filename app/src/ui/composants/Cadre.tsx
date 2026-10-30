// Cadre de l'application : en-tête (avec l'avancement des étapes), messages, barres.

import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { arborescenceValidee, CODES_ETAPES, ETAPE, ETAPES, etapeInutile, nomCourtEtape, nomEtape } from '../../navigateur/projet';
import { aTraduire, t } from '../../lib/langue';
import { messages, page, reglages, sansSousDossiers, session, versionIA, versionPlan, versionProjet, type Page } from '../etat';
import { minusculeInitiale, montantChf, nombre } from '../format';
import { fermerProjet } from '../projets';
import { Icone } from './Icones';
import { Logo } from './Logo';

/** Étapes dont la présentation peut encore changer : la pastille « En essai » suit leur titre et la frise. */
export const ETAPES_EN_ESSAI: ReadonlySet<number> = new Set([ETAPE.album]);

/**
 * « En essai » (gris neutre, ni orange ni vert) : l'étape marche, sa présentation peut changer ; la phrase est dans
 * la bulle, et lue après le titre (`lue`) ; dans « Étape n sur 13 ▾ », le mot seul.
 */
export function PastilleEssai({ lue = true }: { lue?: boolean }) {
  const phrase = t`Cette étape marche, mais sa présentation peut encore changer. Vos réglages et vos choix sont gardés.`;
  return (
    <span class="pastille-essai" title={phrase}>
      {t`En essai`}
      {lue && <span class="texte-masque">{` : ${phrase}`}</span>}
    </span>
  );
}

/** Ouvert / fermé, refermé par un clic ailleurs ou Échap. */
export function useDeroulant(): [boolean, (v?: boolean) => void, RefObject<HTMLDivElement | null>] {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!zone.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', clic);
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('mousedown', clic);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);
  return [ouvert, (v) => setOuvert(v ?? !ouvert), zone];
}

// Étape faite : la coche en icône SVG (C-1.4, C-5.3), avec son mot (« validée ») dans l'infobulle et le résumé.
const SYMBOLES = { validee: <Icone nom="coche" taille={14} />, en_cours: '', a_faire: '', a_revoir: '!' } as const;
const LIBELLES = { validee: aTraduire('validée'), en_cours: aTraduire('en cours'), a_faire: aTraduire('à faire'), a_revoir: aTraduire('à revoir') } as const;

/**
 * Avancement du projet, sur la ligne de l'en-tête : un rectangle par étape
 * (couleur = état, nom en infobulle, clic = y aller), puis le nom de l'étape
 * en cours ; un clic sur ce nom déroule la liste des étapes.
 */
function Avancement() {
  const s = session.value!;
  const p = page.value;
  // Lus ici : sans eux, la frise (composant à signaux) ne se redessinerait pas quand l'état des étapes change
  // (mise à jour de l'inventaire : étapes « à revoir »), mais seulement au changement de page.
  versionProjet.value;
  versionPlan.value;
  const [ouvert, basculer, zone] = useDeroulant();
  const courante = p.nom === 'etape' ? p.numero : 0;
  const etats = s.projet.etapes;
  const etapes = ETAPES.map((_, i) => {
    const n = i + 1;
    const nom = nomEtape(n);
    const code = CODES_ETAPES[i];
    // La création de la sortie suppose l'arborescence validée (§ 4.2).
    const verrouillee = code === 'sortie' && !arborescenceValidee(s.projet);
    const inutile = etapeInutile(s.projet.mode, code, sansSousDossiers(s));
    const etat = etats[i];
    const detail = inutile ? (s.projet.mode === 'vrac' ? t`rien à décider : aucun sous-dossier` : t`inutile pour un dossier déjà trié`) : verrouillee ? t`validez d’abord l’étape ${ETAPE.lieux} (${nomEtape(ETAPE.lieux)})` : t(LIBELLES[etat]);
    // Dans la liste déroulante, un mot ou deux : la phrase entière reste en infobulle.
    const resume = inutile ? (s.projet.mode === 'vrac' ? t`rien à décider` : t`inutile ici`) : verrouillee ? t`après l’étape ${ETAPE.lieux}` : detail;
    const symbole = inutile ? '–' : verrouillee ? '' : SYMBOLES[etat];
    const classe = `etape ${etat}${n === courante ? ' courante' : ''}${inutile ? ' inutile' : ''}${verrouillee ? ' verrouillee' : ''}`;
    return { n, nom, court: nomCourtEtape(n), etat, detail, resume, symbole, classe };
  });
  const aller = (n: number) => {
    page.value = { nom: 'etape', numero: n };
    basculer(false);
  };
  return (
    <div class="avancement-etapes" ref={zone}>
      <ol class="bandeau" aria-label={t`Étapes`}>
        {etapes.map((e) => (
          <li key={e.n}>
            <button type="button" class={e.classe} title={t`${e.n}. ${e.nom} : ${e.detail}`} aria-current={e.n === courante ? 'step' : undefined} onClick={() => aller(e.n)}>
              {/* Le texte reste lisible par les lecteurs d'écran ; à l'écran, la couleur suffit. */}
              <span class="texte-masque">
                {e.symbole && <span class="symbole">{e.symbole}</span>}
                <span class="numero">{e.n}</span>
                <span class="nom">{e.court}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" class="etape-courante" aria-expanded={ouvert} aria-haspopup="menu" onClick={() => basculer()} title={t`Toutes les étapes`}>
        {courante ? (
          <>
            {t`Étape ${courante} sur ${ETAPES.length}`} · <strong>{nomCourtEtape(courante)}</strong>
            {ETAPES_EN_ESSAI.has(courante) && <PastilleEssai lue={false} />}
          </>
        ) : (
          t`Étapes`
        )}
        <Icone nom="chevronBas" taille={16} />
      </button>
      {ouvert && (
        <ul class="liste-etapes" role="menu" aria-label={t`Étapes`}>
          {etapes.map((e) => (
            <li key={e.n}>
              <button type="button" role="menuitem" class={`choix-${e.classe}`} title={e.detail} onClick={() => aller(e.n)}>
                <span class="rond">{e.symbole || e.n}</span>
                <span class="nom">{e.nom}</span>
                <span class="etat-etape">{e.resume}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Menu (trois traits) : les pages consultées de temps en temps, et fermer le projet ; sur une étape, au bout de sa ligne. */
export function MenuPrincipal() {
  const s = session.value;
  const p = page.value;
  const [ouvert, basculer, zone] = useDeroulant();
  const aller = (v: Page) => {
    page.value = v;
    basculer(false);
  };
  const entrees: [Page, string][] = [
    [{ nom: 'ia' }, t`Fonctions IA`],
    [{ nom: 'configuration' }, t`Configuration`],
    [{ nom: 'reglages' }, t`Réglages`],
    ...(s ? ([[{ nom: 'journal' }, t`Journal`]] as [Page, string][]) : []),
    [{ nom: 'aide' }, t`Aide`],
  ];
  return (
    <div class="menu-principal" ref={zone}>
      <button type="button" class="bouton-menu" aria-haspopup="menu" aria-expanded={ouvert} onClick={() => basculer()}>
        <Icone nom="menu" taille={16} />
        {t`Menu`}
      </button>
      {ouvert && (
        <div class="menu-deroulant" role="menu" aria-label={t`Menu`}>
          {entrees.map(([vers, libelle]) => (
            <button key={libelle} type="button" role="menuitem" class={p.nom === vers.nom ? 'actif' : ''} onClick={() => aller(vers)}>
              {libelle}
            </button>
          ))}
          {s && (
            <>
              <hr />
              <button
                type="button"
                role="menuitem"
                title={t`Tout est déjà enregistré`}
                onClick={() => {
                  basculer(false);
                  fermerProjet();
                }}
              >
                {t`Fermer le projet`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Barre du projet, sur une seule ligne : logo (accueil), projet, avancement des étapes, budget IA ; Menu au bout,
 * sauf sur une étape, où Aide et Menu sont dans la ligne de l'étape et cette barre part avec la page (D112).
 */
export function Entete() {
  const s = session.value;
  const surEtape = page.value.nom === 'etape' && !!s;
  versionProjet.value;
  versionIA.value;
  const depense = s ? s.ia.depenseCHF() : 0;
  const part = s && s.projet.budget_chf > 0 ? depense / s.projet.budget_chf : 0;
  return (
    <header class="entete">
      <button type="button" class="marque" onClick={() => (page.value = { nom: 'accueil' })} title={t`Accueil`}>
        <Logo />
        {!s && t`Album photos`}
      </button>
      {s && (
        <span class="projet" title={t`Projet « ${s.projet.nom} » — source : ${s.source.racine.name}, sortie : ${s.sortie.racine.name}`}>
          {s.projet.nom}
        </span>
      )}
      {s ? <Avancement /> : <span class="espace" />}
      {s && (
        <span
          class={`budget${part >= 0.8 ? ' alerte' : part >= 0.5 ? ' moitie' : ''}`}
          title={t`Dépenses IA du projet : ${nombre(depense, 2)} CHF sur un budget de ${montantChf(s.projet.budget_chf)} CHF (taux ${nombre(reglages.value.tauxUsdChf, 2)} CHF par USD). Détail dans le Journal.`}
        >
          <span class="anneau" style={{ '--part': `${Math.min(100, part * 100).toFixed(1)}%` }} aria-hidden="true" />
          {t`IA ${nombre(depense, 2)} / ${montantChf(s.projet.budget_chf)} CHF`}
        </span>
      )}
      {!surEtape && <MenuPrincipal />}
    </header>
  );
}

export function Messages() {
  return (
    <div class="messages" aria-live="polite">
      {messages.value.map((m) => (
        <div key={m.id} class={`message ${m.type}`}>
          <span class="pastille-message">
            <Icone nom={m.type === 'ok' ? 'coche' : m.type === 'erreur' ? 'alerte' : 'info'} taille={14} titre={m.type === 'ok' ? t`Fait` : m.type === 'erreur' ? t`Erreur` : t`Information`} />
          </span>
          <span class="texte-message">{m.texte}</span>
          {m.action && (
            <button type="button" onClick={m.action.faire}>
              {m.action.libelle}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** En-tête des pages sans ligne d'étape (Configuration, Réglages, Journal…) et de la création du projet : le titre et une phrase. */
export function TeteEtape({ numero, titre, children }: { numero?: number; titre: string; children: ComponentChildren }) {
  return (
    <div class="tete-etape">
      <h1>
        {numero !== undefined && <span class="numero-etape">{t`Étape ${numero}`}</span>}
        {titre}
        {numero !== undefined && ETAPES_EN_ESSAI.has(numero) && <PastilleEssai />}
      </h1>
      <p class="explication">{children}</p>
    </div>
  );
}

/**
 * « Annuler : ce qu'il défait » (C-8.2) : le dernier geste, court (un verbe et
 * un nombre), sur une ligne de 40 px et une largeur fixe : la barre ne bouge
 * pas sous la souris quand le geste change ; le geste avec ses noms est dans
 * l'infobulle. Sans rien à annuler, il le dit (C-4.7).
 */
export function BoutonAnnuler({ historique, annuler }: { historique: { peutAnnuler: boolean; prochaineAnnulation?: string; detailAnnulation?: string }; annuler: () => void }) {
  const quoi = historique.prochaineAnnulation;
  if (!historique.peutAnnuler)
    return (
      <button type="button" class="bouton-annuler" disabled data-raison="libelle" title={t`Annuler (Ctrl+Z)`}>
        <Icone nom="annuler" taille={16} />
        <span class="texte-annuler">{t`Rien à annuler`}</span>
      </button>
    );
  const detail = historique.detailAnnulation ?? quoi;
  return (
    <button type="button" class="bouton-annuler" onClick={annuler} title={detail ? t`Annuler : ${minusculeInitiale(detail)} (Ctrl+Z)` : t`Annuler (Ctrl+Z)`}>
      <Icone nom="annuler" taille={16} />
      <span class="texte-annuler">{quoi ? t`Annuler : ${minusculeInitiale(quoi)}` : t`Annuler`}</span>
    </button>
  );
}

/** « Rétablir » (Ctrl+Y), à côté d'« Annuler ». */
export function BoutonRetablir({ peutRetablir, retablir }: { peutRetablir: boolean; retablir: () => void }) {
  return (
    <button type="button" class="bouton-retablir" disabled={!peutRetablir} data-raison={peutRetablir ? undefined : 'libelle'} onClick={retablir} title={t`Rétablir (Ctrl+Y)`}>
      <Icone nom="retablir" taille={16} />
      {peutRetablir ? t`Rétablir` : t`Rien à rétablir`}
    </button>
  );
}

/** « Annuler : … » et « Rétablir », toujours ensemble et sans passer à la ligne entre eux (C-8.2) : Comparer en grand et Recadreur (sur les étapes, ↶ ↷ de la ligne). */
export function AnnulerRetablir({
  historique,
  annuler,
  retablir,
}: {
  historique: { peutAnnuler: boolean; peutRetablir: boolean; prochaineAnnulation?: string; detailAnnulation?: string };
  annuler: () => void;
  retablir: () => void;
}) {
  return (
    <span class="annuler-retablir">
      <BoutonAnnuler historique={historique} annuler={annuler} />
      <BoutonRetablir peutRetablir={historique.peutRetablir} retablir={retablir} />
    </span>
  );
}

/**
 * Sur un bouton de décision ou d'outil (Sélection, Recadreur) : un clic à la souris laisse le focus où il était
 * (la grille) ; Espace et Entrée gardent alors le sens que la page leur donne, au lieu de refaire ce clic
 * (proposition validée, avocat B1). Au clavier (Tab jusqu'au bouton), Espace et Entrée activent bien le bouton.
 */
export function garderFocus(e: MouseEvent) {
  if (e.button === 0) e.preventDefault();
}


/** Raison écrite d'une commande désactivée (C-4.7), reliée au bouton par `aria-describedby`. */
export function RaisonDesactivee({ id, raison }: { id: string; raison: string | false | null | undefined }) {
  return raison ? (
    <span id={id} class="raison-desactivee">
      {raison}
    </span>
  ) : null;
}

/**
 * Barre de validation fixée en bas (§ 5.2, C-8.4, C-8.5) : ligne 1, ce que
 * devient ce qui reste ; ligne 2, « Rien n'est supprimé » sur les étapes où
 * l'on écarte ; puis Revenir et Valider et continuer. Ce dernier n'est plein
 * qu'une fois l'étape finie (C-4.1) : avant, la prochaine action utile est
 * ailleurs sur la page ; désactivé, sa raison est écrite (C-4.7).
 */
export function BarreValidation({
  resume,
  alertes = [],
  revenir,
  valider,
  libelleValider = t`Valider et continuer`,
  validerActif = true,
  raisonInactif,
  fini = true,
  ecarte = false,
  court = false,
  devantL2,
}: {
  /** Ligne 1 : ce que devient ce qui reste (« 12 groupes pas encore acceptés : toutes leurs photos sont gardées »). */
  resume: ComponentChildren;
  alertes?: string[];
  revenir?: () => void;
  valider?: () => void;
  libelleValider?: string;
  validerActif?: boolean;
  /** Pourquoi « Valider et continuer » est désactivé, écrit dans la barre. */
  raisonInactif?: string;
  /** L'étape est finie : « Valider et continuer » devient le bouton plein (C-4.1). */
  fini?: boolean;
  /** On écarte des photos sur cette étape : ligne 2 « Rien n'est supprimé » (C-8.4). */
  ecarte?: boolean;
  /** Pages du cadre commun (lot 4) : la phrase courte de 66 signes ; la suite est dans l'infobulle et l'Aide. */
  court?: boolean;
  /** Une phrase en tête de la ligne 2, devant le bouclier (Floues : « Les photos en bordure suivront le réglage. »). */
  devantL2?: ComponentChildren;
}) {
  const raison = valider && !validerActif ? (raisonInactif ?? '') : '';
  // Sa hauteur, lue par les messages passagers : ils se posent au-dessus d'elle, jamais sur la ligne
  // « Rien n'est supprimé » ni sur un bouton (C-8.4).
  const barre = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = barre.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const racine = document.documentElement;
    const noter = () => racine.style.setProperty('--haut-barre-validation', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    noter();
    const obs = new ResizeObserver(noter);
    obs.observe(el);
    return () => {
      obs.disconnect();
      racine.style.removeProperty('--haut-barre-validation');
    };
  }, []);
  return (
    <footer class="barre-validation" ref={barre}>
      <div class="resume">
        {/* Les alertes et la raison d'un « Valider » désactivé suivent la ligne 1 : la ligne 2 garde toute la largeur. */}
        <p class="l1">
          <span class="texte-l1">{resume}</span>
          {(alertes.length > 0 || raison) && (
            <span class="alertes">
              {alertes.map((a) => (
                <span key={a} class="alerte">
                  {a}
                </span>
              ))}
              <RaisonDesactivee id="raison-valider" raison={raison} />
            </span>
          )}
        </p>
        {ecarte &&
          (() => {
            const bulle = court ? t`Rien n’est supprimé : ce que vous écartez va dans « Mis de côté ». Vos photos d’origine ne bougent pas.` : undefined;
            const bouclier = (
              <>
                <Icone nom="bouclier" taille={16} />
                {court ? t`Rien n’est supprimé : ce que vous écartez va dans « Mis de côté ».` : t`Rien n’est supprimé : ce que vous écartez va dans « Mis de côté ». Vos photos d’origine ne bougent pas.`}
              </>
            );
            // Avec une phrase en tête, « Rien n'est supprimé » garde son propre élément (et son infobulle) derrière elle.
            return devantL2 ? (
              <p class="l2">
                {devantL2}
                <span class="rien-supprime" title={bulle}>
                  {bouclier}
                </span>
              </p>
            ) : (
              <p class="l2 rien-supprime" title={bulle}>
                {bouclier}
              </p>
            );
          })()}
      </div>
      <div class="actions">
        {revenir && (
          <button type="button" class="bouton-revenir" data-action="revenir" onClick={revenir}>
            {t`Revenir`}
          </button>
        )}
        {valider && (
          <button
            type="button"
            class={`bouton-valider ${fini && validerActif ? 'principal' : 'contour'}`}
            data-action="valider"
            data-fini={fini ? 'oui' : 'non'}
            disabled={!validerActif}
            aria-describedby={raison ? 'raison-valider' : undefined}
            onClick={valider}
          >
            {libelleValider}
            <Icone nom="fleche" taille={16} />
          </button>
        )}
      </div>
    </footer>
  );
}

export function BarreProgression({ faits, total, texte }: { faits: number; total: number; texte?: string }) {
  const pct = total > 0 ? Math.min(100, (faits / total) * 100) : 0;
  return (
    <div class="progression">
      <div class="jauge" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div class="rempli" style={{ width: total > 0 ? `${pct}%` : '30%' }} data-indetermine={total > 0 ? undefined : ''} />
      </div>
      {texte && <span class="texte">{texte}</span>}
    </div>
  );
}
