// Aides IA à la carte (SPEC § 7) : catalogue commun à la page « Fonctions IA »
// et aux boutons des étapes. Chaque aide dit ce qu'elle fait, ce qu'elle envoie,
// son coût estimé pour le projet ; elle ne se lance que sur action de
// l'utilisateur, après confirmation au-delà du seuil (§ 7.2).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../../lib/langue';
import { cleApi } from '../../navigateur/cle';
import { BudgetAtteint } from '../../navigateur/ia';
import { BarreProgression } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { Icone } from '../composants/Icones';
import { journal, notifier, page, reglages, session, texteErreur, versionIA, versionPlan, type Session } from '../etat';
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
  web: boolean;
  usage: Usage;
  /** Coût estimé pour le projet ouvert, ou `null` si rien à faire. */
  estimer: (s: Session) => Estimation | null;
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
    bilan.erreur ??= err instanceof Error ? err.message : String(err);
    return undefined;
  }
}

/** Phrase ajoutée au message de fin quand des demandes ont échoué. */
export function texteEchecs(b: BilanEchecs): string {
  return b.echecs ? t` ${pluriel(b.echecs, 'demande a échoué', 'demandes ont échoué')} (${b.erreur}) : relancez plus tard, le reste est gardé.` : '';
}

export function enregistrerAide(a: Aide) {
  AIDES.set(a.id, a);
}

export function aides(): Aide[] {
  return [...AIDES.values()].sort((a, b) => a.etape - b.etape || Number(a.id.slice(2)) - Number(b.id.slice(2)));
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

/** Lance une aide : clé, budget, confirmation au-delà du seuil, progression, journal. */
export function useLancerAide(id: string) {
  const [progres, setProgres] = useState<{ faits: number; total: number; texte?: string } | null>(null);
  const arreter = useRef(false);
  const lancer = async (): Promise<boolean> => {
    const s = session.value;
    const a = AIDES.get(id);
    if (!s || !a || aidesEnCours.value.has(id)) return false;
    if (!cleApi()) {
      notifier('erreur', t`Saisissez d’abord votre clé API dans Réglages.`, { libelle: t`Réglages`, faire: () => (page.value = { nom: 'reglages' }) });
      return false;
    }
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
      const message = await a.lancer(s, { modele: modeleDe(a.usage), progres: (faits, total, texte) => setProgres({ faits, total, texte }), arreter: () => arreter.current });
      journal('ia', t`${a.id} ${t(a.nom)} : ${message}`);
      notifier('ok', message);
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

/** Bouton d'une aide IA dans une étape (§ 5.2) : nom, coût estimé, progression. */
export function AideIA({ fonction, children }: { fonction: string; children?: ComponentChildren }) {
  const s = session.value;
  const a = AIDES.get(fonction);
  const { progres, lancer, arreter } = useLancerAide(fonction);
  // L'estimation n'est recalculée que si le plan, les résultats IA, la sélection (IA10) ou la sortie affichée (IA8, IA9, IA11) changent.
  const e = useMemo(() => (s && a ? a.estimer(s) : null), [s, a, versionPlan.value, versionIA.value, a?.selectionDependante ? selection.value : null, vue.value, reglages.value]);
  if (!s || !a) return null;
  const enCours = aidesEnCours.value.has(fonction);
  return (
    <div class="aide-ia">
      <button type="button" class="bouton-ia" disabled={!!progres || enCours || e === null} onClick={() => void lancer()} title={t`${t(a.description)} Envoyé : ${t(a.envoi)}.`}>
        <Icone nom="etincelle" taille={16} />
        <span>
          {t(a.nom)}
          <span class="cout-aide"> — {enCours && !progres ? t`en cours…` : e === null ? (a.siRien === undefined ? t`rien à faire` : t(a.siRien)) : texteCout(e)}</span>
        </span>
      </button>
      {a.web && <span class="discret">{t`avec recherche web`}</span>}
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
