// Aides IA à la carte (SPEC § 7) : catalogue commun à la page « Fonctions IA »
// et aux boutons des étapes. Chaque aide dit ce qu'elle fait, ce qu'elle envoie,
// son coût estimé pour le projet ; elle ne se lance que sur action de
// l'utilisateur, après confirmation au-delà du seuil (§ 7.2).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../../lib/langue';
import { expliquerErreur } from '../../navigateur/claude';
import { cleApi } from '../../navigateur/cle';
import { BudgetAtteint } from '../../navigateur/ia';
import { BarreProgression } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { Icone } from '../composants/Icones';
import { evenements, journal, notifier, page, reglages, retirerMessage, session, texteErreur, versionIA, versionPlan, type Session } from '../etat';
import { selection, vue } from '../organiser';
import { nombre, pluriel } from '../format';

export type Usage = 'rapide' | 'standard' | 'avance';

export interface Estimation {
  usd: number;
  appels: number;
  /** Précision affichée à côté du coût (« 12 dossiers », « déjà fait »…). */
  detail?: string;
}

export interface Lancement {
  modele: string;
  progres: (faits: number, total: number, texte?: string) => void;
  arreter: () => boolean;
}

/** `nom`, `description`, `envoi` et `siRien` : textes marqués `aTraduire('…')`, traduits là où ils sont affichés. */
export interface Aide {
  id: string;
  nom: string;
  etape: number;
  description: string;
  /** Ce qui part vers l'IA (transparence, § 7.3). */
  envoi: string;
  /** Recherche web : toujours, jamais, ou selon une option de la page (fonction qui lit l'option). */
  web: boolean | (() => boolean);
  usage: Usage;
  /** Coût estimé pour le projet ouvert, ou `null` si rien à faire. */
  estimer: (s: Session) => Estimation | null;
  /**
   * Options de la page qui changent l'estimation (ton, recherche web…), lues
   * à chaque affichage : l'estimation n'est recalculée que si elles changent.
   * Sans cette fonction, elle est recalculée à chaque affichage de la page.
   */
  options?: () => unknown;
  /** Ce qu'il faut faire pour que l'aide ait du travail (« sélectionnez 2 à 12 photos »). */
  siRien?: string;
  /** L'estimation dépend des photos sélectionnées (IA10). */
  selectionDependante?: boolean;
  /** Lance l'aide ; renvoie le message de fin. */
  lancer: (s: Session, l: Lancement) => Promise<string>;
}

const AIDES = new Map<string, Aide>();

/** Aides en cours d'exécution (même si l'on a changé de page entre-temps) : on ne les relance pas. */
export const aidesEnCours = signal<ReadonlySet<string>>(new Set());

/** Bilan des échecs isolés d'une aide (une demande qui échoue n'arrête pas les autres). */
export interface BilanEchecs {
  echecs: number;
  erreur?: string;
}

/**
 * Exécute une demande d'une aide : un échec isolé (réseau, réponse refusée)
 * est compté et l'aide continue ; le budget atteint, une clé refusée ou un
 * arrêt demandé interrompent tout.
 */
export async function essai<T>(f: () => Promise<T>, bilan: BilanEchecs): Promise<T | undefined> {
  try {
    return await f();
  } catch (err) {
    const statut = (err as { status?: number })?.status;
    if (err instanceof BudgetAtteint || statut === 401 || statut === 403 || (err instanceof DOMException && err.name === 'AbortError')) throw err;
    bilan.echecs++;
    bilan.erreur ??= expliquerErreur(err);
    return undefined;
  }
}

/** Phrases ajoutées au message de fin quand des demandes ont échoué : combien, pourquoi et quoi faire (expliquerErreur). */
export function texteEchecs(b: BilanEchecs): string {
  if (!b.echecs) return '';
  const erreur = b.erreur && !/[.!?]$/.test(b.erreur) ? `${b.erreur}.` : (b.erreur ?? '');
  return t` ${pluriel(b.echecs, 'demande a échoué', 'demandes ont échoué')}. ${erreur} Le reste est gardé : relancez l’aide plus tard.`;
}

export function enregistrerAide(a: Aide) {
  AIDES.set(a.id, a);
}

export function aides(): Aide[] {
  return [...AIDES.values()].sort((a, b) => a.etape - b.etape || Number(a.id.slice(2)) - Number(b.id.slice(2)));
}

/** L'aide fait-elle une recherche web, avec les options actuelles de sa page ? */
export function avecWeb(a: Aide): boolean {
  return typeof a.web === 'function' ? a.web() : a.web;
}

export function modeleDe(u: Usage): string {
  const m = reglages.value.modeles;
  return u === 'rapide' ? m.rapide : u === 'avance' ? m.avance : m.standard;
}

/** Texte du coût : « environ 1,20 CHF », « gratuit (déjà fait) ». */
export function texteCout(e: Estimation | null): string {
  if (!e || e.appels === 0) return t`gratuit (déjà fait)`;
  const chf = e.usd * reglages.value.tauxUsdChf;
  return t`environ ${chf < 0.01 ? `< ${nombre(0.01, 2)}` : nombre(chf, 2)} CHF`;
}

/** « Saisissez d'abord votre clé API » affiché : retiré dès que la clé est là (il resterait sinon après une aide réussie). */
let avisCle: number | null = null;

export function retirerAvisCle() {
  if (avisCle !== null) retirerMessage(avisCle);
  avisCle = null;
}

/** Phrase ajoutée au message de fin quand des réponses de l'aide sont illisibles. */
export function texteIllisibles(n: number): string {
  return n ? t` ${pluriel(n, 'réponse illisible', 'réponses illisibles')} : cliquez sur « Redemander » sous le bouton de l’aide.` : '';
}

/** Lance une aide : clé, budget, confirmation au-delà du seuil, progression, journal. */
export function useLancerAide(id: string) {
  const [progres, setProgres] = useState<{ faits: number; total: number; texte?: string } | null>(null);
  const arreter = useRef(false);
  const lancer = async (): Promise<boolean> => {
    const s = session.value;
    const a = AIDES.get(id);
    if (!s || !a || aidesEnCours.value.has(id)) return false;
    if (!cleApi()) {
      retirerAvisCle();
      avisCle = notifier('erreur', t`Saisissez d’abord votre clé API dans Réglages.`, { libelle: t`Réglages`, faire: () => (page.value = { nom: 'reglages' }) });
      return false;
    }
    retirerAvisCle();
    const e = a.estimer(s);
    const chf = (e?.usd ?? 0) * reglages.value.tauxUsdChf;
    if (e && e.usd > s.ia.resteUSD()) {
      notifier('erreur', t`Le budget restant du projet ne suffit pas (environ ${nombre(chf, 2)} CHF nécessaires) : augmentez-le à l’étape 1.`);
      return false;
    }
    if (
      chf >= reglages.value.seuilConfirmationChf &&
      !(await confirmer(
        t`${t(a.nom)} ?`,
        t`Environ ${nombre(chf, 2)} CHF (au plus)${e?.detail ? `, ${e.detail}` : ''}. Envoyé à l’IA (api.anthropic.com) : ${t(a.envoi)}.`,
        t`Lancer`,
      ))
    )
      return false;
    arreter.current = false;
    setProgres({ faits: 0, total: e?.appels ?? 0 });
    aidesEnCours.value = new Set([...aidesEnCours.value, id]);
    try {
      const fin = await a.lancer(s, { modele: modeleDe(a.usage), progres: (faits, total, texte) => setProgres({ faits, total, texte }), arreter: () => arreter.current });
      // Des réponses illisibles ne passent pas inaperçues : elles sont dites, et « Redemander » les redemande.
      const illisibles = s.ia.inexploitables(a.id);
      const message = fin + texteIllisibles(illisibles);
      journal('ia', t`${a.id} ${t(a.nom)} : ${message}`);
      notifier(illisibles ? 'info' : 'ok', message);
      return true;
    } catch (err) {
      notifier('erreur', err instanceof BudgetAtteint ? err.message : t`${t(a.nom)} interrompue : ${texteErreur(err)}`);
      return false;
    } finally {
      const n = new Set(aidesEnCours.value);
      n.delete(id);
      aidesEnCours.value = n;
      setProgres(null);
      versionIA.value++;
    }
  };
  return { progres, lancer, arreter: () => (arreter.current = true) };
}

/**
 * Bouton d'une aide IA dans une étape (§ 5.2) : nom, coût estimé, progression,
 * réponses illisibles à redemander.
 *
 * Ce composant ne lit aucun signal et n'a pas d'état : il est donc redessiné
 * avec sa page (un composant à signaux, lui, ne l'est que si ses propriétés
 * changent), et relit les options de la page (cases, curseur) qui changent le
 * coût. Le coût affiché suit toujours ce qui sera envoyé (règle d'or 5).
 */
export function AideIA({ fonction, children }: { fonction: string; children?: ComponentChildren }) {
  const a = AIDES.get(fonction);
  // Options déclarées : réestimé quand elles changent ; sinon, à chaque affichage de la page (objet neuf).
  const options = a?.options ? JSON.stringify(a.options() ?? null) : {};
  return (
    <BoutonAideIA fonction={fonction} options={options}>
      {children}
    </BoutonAideIA>
  );
}

function BoutonAideIA({ fonction, options, children }: { fonction: string; options: unknown; children?: ComponentChildren }) {
  const s = session.value;
  const a = AIDES.get(fonction);
  const { progres, lancer, arreter } = useLancerAide(fonction);
  const deps = [s, a, versionPlan.value, versionIA.value, a?.selectionDependante ? selection.value : null, vue.value, reglages.value, evenements.value, options];
  const e = useMemo(() => (s && a ? a.estimer(s) : null), deps);
  const illisibles = useMemo(() => (s ? s.ia.inexploitables(fonction) : 0), [s, versionIA.value]);
  // Coût pour les redemander : l'estimation, les réponses illisibles comptées comme absentes.
  const eRedemande = useMemo(() => (s && a && illisibles ? s.ia.sansInexploitables(() => a.estimer(s)) : null), [...deps, illisibles]);
  if (!s || !a) return null;
  const enCours = aidesEnCours.value.has(fonction);
  const redemander = async () => {
    await s.ia.oublierInexploitables(fonction);
    versionIA.value++;
    // Rien à redemander si ces réponses concernaient des photos qui ont changé depuis : elles sont seulement oubliées.
    if (a.estimer(s)?.appels) await lancer();
  };
  return (
    <div class="aide-ia">
      <button type="button" class="bouton-ia" disabled={!!progres || enCours || e === null} onClick={() => void lancer()} title={t`${t(a.description)} Envoyé : ${t(a.envoi)}.`}>
        <Icone nom="etincelle" taille={16} />
        <span>
          {t(a.nom)}
          <span class="cout-aide"> — {enCours && !progres ? t`en cours…` : e === null ? (a.siRien === undefined ? t`rien à faire` : t(a.siRien)) : texteCout(e)}</span>
        </span>
      </button>
      {avecWeb(a) && <span class="discret">{t`avec recherche web`}</span>}
      {illisibles > 0 && !progres && !enCours && (
        <span class="illisibles-aide" title={t`Réponses de l’IA impossibles à lire, ou refusées : gardées pour ne pas les payer deux fois. « Redemander » les envoie à nouveau.`}>
          <Icone nom="alerte" taille={14} />
          {pluriel(illisibles, 'réponse illisible', 'réponses illisibles')}
          <button type="button" class="lien" onClick={() => void redemander()}>
            {eRedemande && eRedemande.appels > 0 ? t`Redemander (${texteCout(eRedemande)})` : t`Redemander`}
          </button>
        </span>
      )}
      {children}
      {progres && (
        <>
          <BarreProgression
            faits={progres.faits}
            total={progres.total}
            texte={t`${pluriel(progres.faits, 'appel')} sur ${nombre(progres.total)}` + (progres.texte ? ` · ${progres.texte}` : '')}
          />
          <button type="button" onClick={arreter}>
            {t`Arrêter (les réponses déjà reçues sont gardées)`}
          </button>
        </>
      )}
    </div>
  );
}
