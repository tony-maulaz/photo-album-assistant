// Groupes de l'étape « Doublons » (D71) : copies exactes, photos présentes
// dans plusieurs dossiers, rafales et scènes vérifiées par l'IA, présentés de
// la même façon. Chaque photo d'un groupe porte une proposition (la garder ou
// l'écarter) ; son état se lit dans le plan : écartée par cette étape,
// gardée, ou « à écarter » tant que la proposition n'est pas acceptée. Un clic
// inverse ce que l'on voit, « Accepter » applique les propositions qui
// restent : rien n'est écarté sans action de l'utilisateur (règle d'or 3), et
// chaque choix, écrit dans le plan, est enregistré et annulable.

import type { Proposition } from './doublons';
import type { GroupeExact } from './doublonsExacts';
import { t } from './langue';
import { combiner, dateSure, deplacerFichiers, ecarterDoublons, garderAussi, type FichierPlan, type InfoDoublon, type Modification, type Plan } from './plan';
import { pluriel } from '../ui/format';

/** Onglets de l'étape : une sorte de doublons chacun. */
export type Sorte = 'copies' | 'dossiers' | 'rafales' | 'ia';
export type EtatPhoto = 'gardee' | 'ecartee' | 'a_ecarter';

export interface MembreGroupe {
  id: string;
  /** Proposition : garder (la photo ★, un exemplaire par dossier, un refus du garde-fou) ou écarter. */
  garder: boolean;
  /** Copie réduite (WhatsApp) d'une photo. */
  reduite?: boolean;
  /** Pourquoi l'écarter (rafale, IA). */
  raison?: string;
  description?: string;
  /** Gardée par le garde-fou de l'IA (une autre scène ?) : affichée pour pouvoir l'écarter quand même. */
  refus?: boolean;
}

export interface GroupeDoublons {
  /** Identifiant stable d'une recherche à l'autre : les décisions ne le changent pas. */
  cle: string;
  sorte: Sorte;
  /** La photo proposée (★) : la plus nette d'une rafale, le meilleur exemplaire d'une copie. */
  etoile: string;
  /** Photos dans un ordre qui ne change jamais : chronologique (rafales, IA), la meilleure d'abord (copies). */
  membres: MembreGroupe[];
  /** Section de la page : « jour:AAAA-MM-JJ », « dossier:<id> » ou « sans » (sans date). */
  section: string;
  /** Copie réduite rangée dans un dossier « Garder, nettoyer » : l'original y prend sa place. */
  remplacement?: { original: string; copie: string; dossier: string };
  /** Rafale ou IA : la scène, et la description de la photo ★. */
  scene?: string;
  descriptionGardee?: string;
}

type Fichiers = (id: string) => FichierPlan | undefined;

/** Raison de mise de côté des photos écartées par un groupe. */
export function raisonDe(g: GroupeDoublons): 'doublons' | 'doublons_exacts' {
  return g.sorte === 'copies' || g.sorte === 'dossiers' ? 'doublons_exacts' : 'doublons';
}

/**
 * État d'une photo dans un groupe ; `undefined` si elle a quitté le groupe
 * (écartée ailleurs : floue, ou copie exacte d'une photo d'une rafale).
 */
export function etatPhoto(g: GroupeDoublons, m: MembreGroupe, f: FichierPlan | undefined): EtatPhoto | undefined {
  if (!f) return undefined;
  if (f.statut === 'mis_de_cote') return f.raison === raisonDe(g) ? 'ecartee' : undefined;
  return !m.garder && !f.protegee ? 'a_ecarter' : 'gardee';
}

export interface PhotoDuGroupe {
  m: MembreGroupe;
  f: FichierPlan;
  etat: EtatPhoto;
}

/** Photos encore dans le groupe, avec leur état. */
export function photosDuGroupe(g: GroupeDoublons, fichier: Fichiers): PhotoDuGroupe[] {
  return g.membres.flatMap((m) => {
    const f = fichier(m.id);
    const etat = etatPhoto(g, m, f);
    return f && etat ? [{ m, f, etat }] : [];
  });
}

/** Un groupe s'affiche tant qu'il lui reste deux photos. */
export function groupeVisible(g: GroupeDoublons, fichier: Fichiers): boolean {
  return photosDuGroupe(g, fichier).length >= 2;
}

/** Photos que la proposition écarterait encore (« à écarter »). */
export function aEcarter(g: GroupeDoublons, fichier: Fichiers): string[] {
  return photosDuGroupe(g, fichier)
    .filter((x) => x.etat === 'a_ecarter')
    .map((x) => x.m.id);
}

/** À relire : une proposition d'écarter attend encore. */
export function aRelire(g: GroupeDoublons, fichier: Fichiers): boolean {
  return aEcarter(g, fichier).length > 0;
}

/** Groupes relus et groupes en tout (visibles seulement). */
export function avancementGroupes(groupes: GroupeDoublons[], fichier: Fichiers): { relus: number; total: number } {
  const visibles = groupes.filter((g) => groupeVisible(g, fichier));
  return { relus: visibles.filter((g) => !aRelire(g, fichier)).length, total: visibles.length };
}

// ---------------------------------------------------------------------------
// Décisions
// ---------------------------------------------------------------------------

/** Met de côté `ids` ; un doublon note la photo gardée à sa place (la ★ si elle reste). */
function ecarter(plan: Plan, g: GroupeDoublons, ids: string[]): Modification | null {
  if (!ids.length) return null;
  const sauf = new Set(ids);
  const restent = photosDuGroupe(g, (id) => plan.fichiers.get(id)).filter((x) => x.etat === 'gardee' && !sauf.has(x.m.id));
  const garde = restent.find((x) => x.m.id === g.etoile)?.m.id ?? restent[0]?.m.id ?? g.etoile;
  const membres = new Map(g.membres.map((m) => [m.id, m]));
  const raison = raisonDe(g);
  return ecarterDoublons(
    plan,
    ids.map((id) => {
      const m = membres.get(id);
      const doublon: InfoDoublon | undefined =
        raison === 'doublons'
          ? { garde, source: g.sorte === 'ia' ? 'ia' : 'rafale', raison: m?.raison, description: m?.description, descriptionGardee: membres.get(garde)?.description ?? g.descriptionGardee }
          : undefined;
      return { id, raison, doublon };
    }),
  );
}

/** Un clic sur une photo : ce que l'on voit s'inverse (gardée ↔ écartée ; « à écarter » devient gardée). */
export function basculer(plan: Plan, g: GroupeDoublons, id: string): Modification | null {
  const m = g.membres.find((x) => x.id === id);
  const etat = m && etatPhoto(g, m, plan.fichiers.get(id));
  if (!etat) return null;
  return etat === 'gardee' ? ecarter(plan, g, [id]) : garderAussi(plan, [id]);
}

/**
 * « Accepter » : les photos encore « à écarter » le sont ; l'original d'une
 * copie réduite rangée dans un dossier « Garder, nettoyer » y prend sa place.
 */
export function accepter(plan: Plan, groupes: GroupeDoublons[]): Modification | null {
  const fichier = (id: string) => plan.fichiers.get(id);
  const modifications: (Modification | null)[] = [];
  let n = 0;
  for (const g of groupes) {
    const ids = aEcarter(g, fichier);
    if (!ids.length) continue;
    n++;
    const r = g.remplacement;
    const original = r && photosDuGroupe(g, fichier).find((x) => x.m.id === r.original);
    const deplacer = r && ids.includes(r.copie) && original?.etat === 'gardee' && original.f.dossier !== r.dossier && plan.dossiers.has(r.dossier);
    modifications.push(ecarter(plan, g, ids));
    if (deplacer) modifications.push(deplacerFichiers(plan, [r.original], r.dossier));
  }
  return combiner(t`Accepter ${pluriel(n, 'proposition')}`, ...modifications);
}

/** « Tout garder » : les photos écartées reviennent, celles « à écarter » sont gardées. */
export function garderTout(plan: Plan, groupes: GroupeDoublons[]): Modification | null {
  const fichier = (id: string) => plan.fichiers.get(id);
  const ids = [...new Set(groupes.flatMap((g) => photosDuGroupe(g, fichier).filter((x) => x.etat !== 'gardee').map((x) => x.m.id)))];
  return ids.length ? garderAussi(plan, ids) : null;
}

/** « Tout écarter » : toutes les photos du groupe, la ★ comprise, vont dans `_mis_de_cote/` (rien n'est supprimé). */
export function ecarterTout(plan: Plan, groupes: GroupeDoublons[]): Modification | null {
  const fichier = (id: string) => plan.fichiers.get(id);
  return combiner(
    t`Tout écarter`,
    ...groupes.map((g) =>
      ecarter(
        plan,
        g,
        photosDuGroupe(g, fichier)
          .filter((x) => x.etat !== 'ecartee')
          .map((x) => x.m.id),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Construction des groupes
// ---------------------------------------------------------------------------

/** Section d'une photo : sa journée, ou « sans » quand elle n'a que la date du fichier. */
export function sectionJour(f: FichierPlan | undefined): string {
  const d = f && dateSure(f);
  return d ? `jour:${d.slice(0, 10)}` : 'sans';
}

/** Copies exactes : un groupe par photo ; tous les exemplaires gardés = « Dans plusieurs dossiers ». */
export function groupesCopies(groupes: GroupeExact[], fichier: Fichiers): GroupeDoublons[] {
  return groupes.map((g) => {
    const ids = [g.garde, ...g.copies.map((c) => c.id)];
    const garder = new Set(g.aGarder);
    const reduites = new Set(g.copies.filter((c) => c.type === 'reduite').map((c) => c.id));
    return {
      cle: `copie:${g.garde}`,
      sorte: ids.every((id) => garder.has(id)) ? 'dossiers' : 'copies',
      etoile: g.garde,
      membres: ids.map((id) => ({ id, garder: garder.has(id), ...(reduites.has(id) && { reduite: true }) })),
      section: sectionJour(ids.map(fichier).find((f) => f && dateSure(f))),
      ...(g.remplacement && { remplacement: g.remplacement }),
    };
  });
}

/** Rafales et scènes de l'IA, lot par lot (une journée, ou un dossier). */
export function groupesScenes(lots: Record<string, { propositions: Proposition[] }>, fichier: Fichiers): GroupeDoublons[] {
  const resultat: GroupeDoublons[] = [];
  const cles = new Set<string>();
  const date = (id: string) => fichier(id)?.date ?? '';
  for (const [lot, d] of Object.entries(lots)) {
    const section = lot === 'jour:sans' ? 'sans' : lot.startsWith('jour:') ? lot : `dossier:${lot}`;
    for (const p of d.propositions) {
      const membres = new Map<string, MembreGroupe>([[p.garde, { id: p.garde, garder: true, description: p.descriptionGardee }]]);
      for (const x of p.doublons) if (!membres.has(x.id)) membres.set(x.id, { id: x.id, garder: false, raison: x.raison, description: x.description });
      for (const r of p.refus ?? []) if (!membres.has(r.id)) membres.set(r.id, { id: r.id, garder: true, refus: true });
      const base = `${p.source}:${p.garde}:${p.doublons[0]?.id ?? ''}`;
      let cle = base;
      for (let i = 2; cles.has(cle); i++) cle = `${base}#${i}`;
      cles.add(cle);
      resultat.push({
        cle,
        sorte: p.source === 'ia' ? 'ia' : 'rafales',
        etoile: p.garde,
        membres: [...membres.values()].sort((a, b) => date(a.id).localeCompare(date(b.id)) || a.id.localeCompare(b.id)),
        section,
        ...(p.scene && { scene: p.scene }),
        ...(p.descriptionGardee && { descriptionGardee: p.descriptionGardee }),
      });
    }
  }
  return resultat;
}
