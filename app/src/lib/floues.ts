// Étape 3 — Photos floues (SPEC § 6.3, script 01 `--seuil-flou`) : une photo
// est écartée si sa netteté (variance du Laplacien à 1024 px, D29) est sous le
// seuil, sauf si l'utilisateur l'a gardée ; il peut aussi en écarter une nette
// mais ratée. Les décisions s'appliquent au plan en une opération annulable.
//
// Badges (D112) : sous chaque photo, ce qui lui arrivera (gardée ou écartée) et
// d'où vient l'idée : le réglage (proposé), l'IA (proposé, ou suivi), l'utilisateur
// (décidé, la punaise) ou les anciens scripts (« Écartée avant »). Une proposition
// reste distincte d'une décision (règle d'or 3).

import { pluriel } from '../ui/format';
import { casLimites, type VerdictNettete } from './aidesTri';
import { t } from './langue';
import { ressembleACapture } from './inventaire';
import { avecDetail, avecOrigine, combiner, mettreDeCote, nePasToucher, remettre, Transaction, type FichierPlan, type Modification, type OrigineDecision, type Plan } from './plan';

/** Seuil calibré du script 01 (variance du Laplacien à 1024 px). */
export const SEUIL_FLOU = 60;

/** Ce qui arrive à une photo : elle reste, ou elle part dans « Mis de côté ». */
export type SortPhoto = 'garder' | 'ecarter';

/**
 * L'avis de l'IA sur un cas limite (IA1), tel qu'il est gardé dans `.album/aides.json`. Seul le verdict est vérifié
 * (`avisValide`) ; la raison se lit par `raisonAvis`, jamais telle quelle (règle d'or 6).
 */
export type AvisFlou = { verdict: VerdictNettete; raison?: unknown };

/**
 * Photos concernées par l'étape : dans l'archive ou déjà écartées pour flou, hors dossiers « Ne pas toucher ».
 * Une capture d'écran, rangée ou non, n'est jamais une photo floue : une image d'écran est nette mais
 * « plate », la mesure la prendrait pour floue (D61).
 */
export function photosConcernees(plan: Plan): FichierPlan[] {
  return [...plan.fichiers.values()].filter(
    (f) => f.categorie === 'photo' && !f.capture && !ressembleACapture(f) && (f.statut === 'archive' || f.raison === 'floues') && !nePasToucher(plan, f.dossier),
  );
}

/**
 * Écartée comme floue par les anciens scripts (`_a_supprimer`), sans marque du réglage : elle reste écartée,
 * « Écartée avant » (D112, question 9), quel que soit le réglage ; seule une décision la fait revenir. La marque
 * `avant` tombe quand l'utilisateur la remet ou la déplace hors de « Mis de côté » (`ranger`, plan.ts).
 */
export function estAvant(f: FichierPlan): boolean {
  return !!f.avant || (f.statut === 'mis_de_cote' && f.raison === 'floues' && !f.flou);
}

/** La décision prise pour la photo (gardée ou écartée, par l'utilisateur ou un avis suivi), sinon `undefined`. */
export function decisionFlou(f: FichierPlan): SortPhoto | undefined {
  return f.flou === 'sauvee' ? 'garder' : f.flou === 'ecartee' ? 'ecarter' : undefined;
}

/** Ce que propose l'étape, sans décision : « Écartée avant », sinon le réglage (une photo sans mesure est gardée). */
export function propositionFlou(f: FichierPlan, nettete: number | undefined, seuil: number): SortPhoto {
  if (estAvant(f)) return 'ecarter';
  return nettete !== undefined && nettete < seuil ? 'ecarter' : 'garder';
}

/** Doit-elle être écartée, au seuil donné ? La décision d'abord, puis « Écartée avant », puis le réglage. */
export function estFloue(f: FichierPlan, nettete: number | undefined, seuil: number): boolean {
  return (decisionFlou(f) ?? propositionFlou(f, nettete, seuil)) === 'ecarter';
}

/** Le sort que donne l'avis de l'IA : « ratée » part, « nette » et « flou voulu » restent. */
export function sortAvis(a: AvisFlou): SortPhoto {
  return a.verdict === 'ratee' ? 'ecarter' : 'garder';
}

/** Un avis gardé dans `.album/aides.json`, relu sans lui faire confiance (règle d'or 6). */
export function avisValide(a: unknown): a is AvisFlou {
  const v = (a as { verdict?: unknown } | null)?.verdict;
  return v === 'ratee' || v === 'nette' || v === 'flou_voulu';
}

/** La raison donnée par l'IA, si elle est un texte non vide ; sinon `undefined` (la bulle n'en dit rien). */
export function raisonAvis(a: AvisFlou): string | undefined {
  return typeof a.raison === 'string' && a.raison.trim() ? a.raison.trim() : undefined;
}

/** L'origine de la décision de la photo (D112) : la sienne, ou celle d'avant les badges (la reprise). */
export function origineFlou(f: FichierPlan): OrigineDecision | undefined {
  if (decisionFlou(f)) return f.origine?.flou === 'ia' ? 'ia' : 'vous';
  return estAvant(f) ? 'avant' : undefined;
}

/**
 * L'état écrit sous une photo de l'étape (D112) :
 * - `decidee` : la photo a une décision (punaise : par vous ; ✦ : avis de l'IA suivi), le réglage n'y touche plus ;
 * - `avant` : écartée par les anciens scripts, laissée écartée ;
 * - `verifier` : proposée par le réglage, mais proche du seuil sans avis de l'IA, ou l'IA n'est pas d'accord ;
 * - `ia` : proposée, et l'IA (pas encore suivie) dit la même chose ;
 * - `reglage` : proposée par le réglage.
 */
export interface EtatFlou {
  sort: SortPhoto;
  /** Ce que propose l'étape sans décision (le second clic sur la bande y revient). */
  proposition: SortPhoto;
  qui: 'vous' | 'ia-suivi' | 'avant' | 'verifier' | 'ia' | 'reglage';
  /** L'avis de l'IA, s'il n'est pas encore suivi (remarque sous la photo). */
  avisEnAttente?: AvisFlou;
}

export function etatFlou(f: FichierPlan, nettete: number | undefined, seuil: number, avis: AvisFlou | undefined, limite: boolean): EtatFlou {
  const proposition = propositionFlou(f, nettete, seuil);
  const decision = decisionFlou(f);
  if (decision) return { sort: decision, proposition, qui: origineFlou(f) === 'ia' ? 'ia-suivi' : 'vous' };
  if (estAvant(f)) return { sort: 'ecarter', proposition, qui: 'avant' };
  if (avis) return { sort: proposition, proposition, qui: sortAvis(avis) === proposition ? 'ia' : 'verifier', avisEnAttente: avis };
  return { sort: proposition, proposition, qui: limite && nettete !== undefined ? 'verifier' : 'reglage' };
}

/**
 * Les photos « à vérifier » sans avis, au seuil donné : les cas limites que l'IA jugerait (IA1), parmi les photos
 * encore proposées (sans décision, pas « Écartée avant ») qui n'ont pas déjà son avis.
 */
export function aJugerParIA(photos: FichierPlan[], nettete: (f: FichierPlan) => number | undefined, seuil: number, avis: Record<string, unknown>): FichierPlan[] {
  const libres = photos.filter((f) => !decisionFlou(f) && !estAvant(f) && !avisValide(avis[f.id]) && nettete(f) !== undefined);
  const parId = new Map(libres.map((f) => [f.id, f]));
  return casLimites(
    libres.map((f) => ({ id: f.id, dossier: f.dossier, date: f.date, nettete: nettete(f)! })),
    seuil,
  ).map((p) => parId.get(p.id)!);
}

/** Les comptes de l'étape (proposition.md § 3), définis une fois : filtres, panneau, titres de partie, barre du bas. */
export interface ResumeFloues {
  total: number;
  /** Ce qui sera écarté à « Valider » (le réglage, moins les gardées, plus les écartées par vous ou l'IA, plus « avant »). */
  seront: number;
  /** Écartées par le seul réglage (photos sans décision, hors « avant »). */
  parReglage: number;
  parVous: { gardees: number; ecartees: number };
  parIA: { gardees: number; ecartees: number };
  avant: number;
  /** Décidées par vous (la punaise) : le filtre « Par vous » ; un avis de l'IA suivi n'y est pas. */
  faitesParVous: number;
  aVerifier: number;
  sansMesure: number;
}

export function resumeFloues(photos: FichierPlan[], etats: Map<string, EtatFlou>, nettete: (f: FichierPlan) => number | undefined): ResumeFloues {
  const r: ResumeFloues = { total: photos.length, seront: 0, parReglage: 0, parVous: { gardees: 0, ecartees: 0 }, parIA: { gardees: 0, ecartees: 0 }, avant: 0, faitesParVous: 0, aVerifier: 0, sansMesure: 0 };
  for (const f of photos) {
    const e = etats.get(f.id);
    if (!e) continue;
    if (nettete(f) === undefined) r.sansMesure++;
    if (e.sort === 'ecarter') r.seront++;
    if (e.qui === 'vous' || e.qui === 'ia-suivi') {
      if (e.qui === 'vous') r.faitesParVous++;
      const quiDecide = e.qui === 'vous' ? r.parVous : r.parIA;
      if (e.sort === 'ecarter') quiDecide.ecartees++;
      else quiDecide.gardees++;
    } else if (e.qui === 'avant') r.avant++;
    else if (e.sort === 'ecarter') r.parReglage++;
    if (e.qui === 'verifier') r.aVerifier++;
  }
  return r;
}

/**
 * Applique le seuil : les photos floues vont dans `_mis_de_cote/floues/`, celles
 * qu'un seuil précédent avait écartées et qui ne le sont plus reviennent. Les
 * photos écartées par un ancien script (`_a_supprimer`) ne reviennent que si
 * l'utilisateur les garde. « Annuler : … » dit ce qu'il défait : les photos floues écartées la
 * première fois, la tolérance changée ensuite (des photos déjà écartées pour flou).
 */
export function appliquerFloues(plan: Plan, nettete: (f: FichierPlan) => number | undefined, seuil: number): Modification | null {
  const aEcarter: string[] = [];
  const aRemettre: string[] = [];
  const marques = new Transaction(plan);
  let dejaAppliquee = false;
  for (const f of photosConcernees(plan)) {
    if (f.statut === 'mis_de_cote' && f.flou === 'auto') dejaAppliquee = true;
    const floue = estFloue(f, nettete(f), seuil);
    if (floue && f.statut === 'archive') {
      aEcarter.push(f.id);
      // « Écartée avant » garde sa marque : le réglage ne la fera pas revenir.
      if (!f.flou && !estAvant(f)) marques.fichier({ ...f, flou: 'auto' });
    } else if (!floue && f.statut === 'mis_de_cote' && (f.flou === 'auto' || f.flou === 'sauvee')) {
      aRemettre.push(f.id);
      if (f.flou === 'auto') {
        const { flou: _f, ...reste } = f;
        marques.fichier(reste);
      }
    }
  }
  return avecDetail(
    combiner(dejaAppliquee ? t`Changer la tolérance au flou` : t`Écarter les photos floues`, marques.terminer(''), aEcarter.length ? mettreDeCote(plan, aEcarter, 'floues') : null, aRemettre.length ? remettre(plan, aRemettre, true) : null),
    t`Photos floues : ${pluriel(aEcarter.length, 'écartée')}, ${pluriel(aRemettre.length, 'remise')}`,
  );
}

/**
 * « Garder » (reste dans le tri), « Écarter » (nette mais ratée), ou « Retirer mon choix » (`undefined`) : la photo
 * revient à la proposition. `origine` : qui décide (l'utilisateur, ou l'IA dont on suit l'avis). Une photo
 * « Écartée avant » le reste quand on retire le choix ; une photo déjà écartée par le seuil est marquée « auto » :
 * le seuil pourra la remettre.
 */
export function deciderFlou(plan: Plan, ids: string[], decision: 'sauvee' | 'ecartee' | undefined, origine: 'vous' | 'ia' = 'vous'): Modification | null {
  const tx = new Transaction(plan);
  for (const id of ids) {
    const f = plan.fichiers.get(id);
    if (!f || f.categorie !== 'photo') continue;
    // Sans décision, rien à retirer.
    if (!decision && !decisionFlou(f)) continue;
    const avant = estAvant(f);
    const voulu = decision ?? (!avant && f.statut === 'mis_de_cote' && f.raison === 'floues' ? 'auto' : undefined);
    const origineVoulue = decision ? origine : undefined;
    if (f.flou === voulu && f.origine?.flou === origineVoulue && (!avant || f.avant)) continue;
    const { flou: _f, avant: _a, ...reste } = avecOrigine(f, 'flou', origineVoulue);
    tx.fichier({ ...reste, ...(voulu ? { flou: voulu } : {}), ...(avant ? { avant: true as const } : {}) });
  }
  const n = pluriel(ids.length, 'photo');
  return tx.terminer(decision === 'sauvee' ? t`Garder ${n}` : decision === 'ecartee' ? t`Écarter ${n}` : t`Retirer mon choix sur ${n}`);
}

/**
 * Un clic sur la bande d'une photo (D112, réponse 20) : sans décision, elle prend l'autre sort que la proposition,
 * décidé par vous ; décidée, elle revient à la proposition (réglage, avis de l'IA ou « Écartée avant »).
 */
export function basculerFlou(plan: Plan, id: string, nettete: number | undefined, seuil: number): Modification | null {
  const f = plan.fichiers.get(id);
  if (!f) return null;
  if (decisionFlou(f)) return deciderFlou(plan, [id], undefined);
  return deciderFlou(plan, [id], propositionFlou(f, nettete, seuil) === 'ecarter' ? 'sauvee' : 'ecartee');
}

/**
 * « Suivre l'avis de l'IA » : chaque photo prend le sort que lui donne l'IA, une décision dont l'origine est l'IA
 * (le plein ✦, D112). Un seul Ctrl+Z.
 */
export function suivreAvisFlou(plan: Plan, ids: string[], avis: Record<string, unknown>): Modification | null {
  const valides = ids.filter((id) => avisValide(avis[id]));
  const ecartees = valides.filter((id) => sortAvis(avis[id] as AvisFlou) === 'ecarter');
  const gardees = valides.filter((id) => sortAvis(avis[id] as AvisFlou) === 'garder');
  return combiner(t`Suivre l’avis de l’IA`, deciderFlou(plan, ecartees, 'ecartee', 'ia'), deciderFlou(plan, gardees, 'sauvee', 'ia'));
}
