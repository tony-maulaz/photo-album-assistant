// Groupes de l'étape « Doublons » (D71) : copies exactes (dont les photos
// présentes dans plusieurs dossiers gardés, toutes gardées, D86), rafales et
// scènes vérifiées par l'IA, présentés de la même façon. Chaque photo d'un groupe porte une proposition (la garder ou
// l'écarter) ; son état se lit dans le plan : écartée par cette étape,
// gardée, ou « à écarter » tant que la proposition n'est pas acceptée. Un clic
// pose un choix en attente (D101 : dans une rafale ou une même scène, il
// choisit cette photo seule, sauf « Garder plusieurs photos ») ; seul
// « Accepter » l'applique et valide le groupe : rien n'est écarté sans action
// de l'utilisateur (règle d'or 3), et chaque choix, écrit dans le plan, est
// enregistré et annulable.

import type { Proposition } from './doublons';
import type { GroupeExact } from './doublonsExacts';
import { t } from './langue';
import { choisirDoublons, combiner, dateSure, deplacerFichiers, ecarterDoublons, garderAussi, type FichierPlan, type InfoDoublon, type Modification, type Plan } from './plan';
import { pluriel } from '../ui/format';

/**
 * Sorte de doublons : un onglet chacune, sauf `dossiers` (une photo dans
 * plusieurs dossiers gardés, toute gardée), montrée avec les copies (D86).
 */
export type Sorte = 'copies' | 'dossiers' | 'rafales' | 'ia';
/**
 * Validé : « gardée », « écartée ». En attente : « à écarter » (proposition ou choix pas encore acceptés),
 * « choisie » (choisie pour être gardée, pas encore acceptée : une photo écartée qu'on reprend, ou une photo
 * proposée à l'écart qu'on garde) (D101).
 */
export type EtatPhoto = 'gardee' | 'ecartee' | 'a_ecarter' | 'choisie';

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
  const raison = raisonDe(g);
  const choix = f.choixDoublons?.[raison];
  if (f.statut === 'mis_de_cote') return f.raison !== raison ? undefined : choix === true ? 'choisie' : 'ecartee';
  if (choix !== undefined) return choix ? 'choisie' : 'a_ecarter';
  return !m.garder && !f.protegee ? 'a_ecarter' : 'gardee';
}

/** Gardée après « Accepter » : gardée, ou choisie. */
export function aGarder(etat: EtatPhoto): boolean {
  return etat === 'gardee' || etat === 'choisie';
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

/**
 * Groupes dont une photo encore « à écarter » est parmi `ids` (les photos que le
 * tri range) : sans les écarter d'abord, le tri rangerait une seconde fois une
 * photo déjà gardée ailleurs (D85).
 */
export function copiesEnAttente(groupes: GroupeDoublons[], ids: ReadonlySet<string>, fichier: Fichiers): GroupeDoublons[] {
  return groupes.filter((g) => aEcarter(g, fichier).some((id) => ids.has(id)));
}

/**
 * « Écarter les exemplaires de ce dossier » (D86) : ceux qui sont gardés dans
 * le dossier (`dans`) alors que leur photo reste gardée dans un autre ; jamais
 * le dernier exemplaire d'une photo, ni une photo qui n'est que là.
 */
export function exemplairesAEcarterDans(groupes: GroupeDoublons[], dans: (f: FichierPlan) => boolean, fichier: Fichiers): string[] {
  return groupes.flatMap((g) => {
    const gardees = photosDuGroupe(g, fichier).filter((x) => x.etat === 'gardee');
    return gardees.some((x) => !dans(x.f)) ? gardees.filter((x) => dans(x.f)).map((x) => x.m.id) : [];
  });
}

/** « Remettre les exemplaires de ce dossier » : ceux du dossier que cette étape a écartés. */
export function exemplairesEcartesDans(groupes: GroupeDoublons[], dans: (f: FichierPlan) => boolean, fichier: Fichiers): string[] {
  return groupes.flatMap((g) =>
    photosDuGroupe(g, fichier)
      .filter((x) => x.etat === 'ecartee' && dans(x.f))
      .map((x) => x.m.id),
  );
}

/**
 * À valider : une proposition ou un choix attend encore « Accepter » ; un clic sur une photo ne valide
 * jamais le groupe (D101).
 */
export function aRelire(g: GroupeDoublons, fichier: Fichiers): boolean {
  return photosDuGroupe(g, fichier).some((x) => x.etat === 'a_ecarter' || x.etat === 'choisie');
}

/** Un choix de l'utilisateur attend sur une photo du groupe (pas seulement la proposition). */
export function choixEnAttente(g: GroupeDoublons, fichier: Fichiers): boolean {
  const raison = raisonDe(g);
  return photosDuGroupe(g, fichier).some((x) => x.f.choixDoublons?.[raison] !== undefined);
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
  const restent = photosDuGroupe(g, (id) => plan.fichiers.get(id)).filter((x) => aGarder(x.etat) && !sauf.has(x.m.id));
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

/**
 * Un clic sur une photo (D101) : un choix en attente, rien n'est mis de côté avant « Accepter ».
 * `seule` (rafale, même scène) : cette photo est choisie et les autres passent « à écarter » ; sinon
 * (copies, « Garder plusieurs photos ») seule cette photo change. Un choix égal à ce que ferait
 * « Accepter » sans lui n'est pas noté.
 */
export function choisir(plan: Plan, g: GroupeDoublons, id: string, seule: boolean): Modification | null {
  const fichier = (x: string) => plan.fichiers.get(x);
  const photos = photosDuGroupe(g, fichier);
  const cliquee = photos.find((x) => x.m.id === id);
  if (!cliquee) return null;
  return choisirDoublons(
    plan,
    raisonDe(g),
    photos.map((x) => {
      const garder = seule ? x.m.id === id : x.m.id === id ? !aGarder(x.etat) : aGarder(x.etat);
      // Ce que deviendrait la photo sans choix : écartée si elle l'est, sinon selon sa proposition.
      const parDefaut = x.f.statut === 'mis_de_cote' ? false : x.m.garder || !!x.f.protegee;
      return { id: x.m.id, garder: garder === parDefaut ? undefined : garder };
    }),
  );
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
    if (!aRelire(g, fichier)) continue;
    const ids = aEcarter(g, fichier);
    // Les photos choisies (reprises ou gardées contre la proposition) reviennent ou sont gardées ; les choix s'effacent.
    const choisies = photosDuGroupe(g, fichier)
      .filter((x) => x.etat === 'choisie')
      .map((x) => x.m.id);
    n++;
    const r = g.remplacement;
    const original = r && photosDuGroupe(g, fichier).find((x) => x.m.id === r.original);
    const deplacer = r && ids.includes(r.copie) && original && aGarder(original.etat) && original.f.dossier !== r.dossier && plan.dossiers.has(r.dossier);
    modifications.push(ecarter(plan, g, ids));
    if (choisies.length) modifications.push(garderAussi(plan, choisies, raisonDe(g)));
    if (deplacer) modifications.push(deplacerFichiers(plan, [r.original], r.dossier));
  }
  // « Annuler : accepter 1 rafale » dit ce qu'il défait (C-8.2) : la sorte des groupes, s'ils sont tous de la même.
  const sortes = new Set(groupes.map((g) => (g.sorte === 'dossiers' ? 'copies' : g.sorte)));
  const sorte = sortes.size === 1 ? [...sortes][0] : null;
  const quoi = sorte === 'rafales' ? pluriel(n, 'rafale') : sorte === 'copies' ? pluriel(n, 'copie') : pluriel(n, 'groupe');
  return combiner(t`Accepter ${quoi}`, ...modifications);
}

/**
 * Groupes qu'un « Accepter » groupé (section, onglet) valide : au moins une photo y sera gardée. Celui où
 * aucune n'est choisie écarterait tout sans avoir été vu ; il reste à valider, avec son alerte (D99, D101).
 */
export function acceptablesSansVider(groupes: GroupeDoublons[], fichier: Fichiers): GroupeDoublons[] {
  return groupes.filter((g) => photosDuGroupe(g, fichier).some((x) => aGarder(x.etat)));
}

/** « Tout garder » : les photos écartées reviennent, celles « à écarter » sont gardées ; le groupe est validé. */
export function garderTout(plan: Plan, groupes: GroupeDoublons[]): Modification | null {
  const fichier = (id: string) => plan.fichiers.get(id);
  return combiner(
    t`Tout garder`,
    ...groupes.map((g) => {
      const ids = photosDuGroupe(g, fichier)
        .filter((x) => x.etat !== 'gardee')
        .map((x) => x.m.id);
      return ids.length ? garderAussi(plan, ids, raisonDe(g)) : null;
    }),
  );
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

/**
 * Le groupe dont « Accepter » est le bouton plein (C-4.1) : le groupe en cours s'il reste à accepter, sinon
 * le suivant à accepter dans la liste (en repartant du début), en partant de la place du groupe en cours même
 * s'il n'est plus affiché (accepté, avec le filtre « À accepter ») ; sans groupe en cours, le premier.
 */
export function prochainAAccepter<T>(liste: T[], cle: (x: T) => string, enCours: string | null | undefined, affiche: (x: T) => boolean, aAccepter: (x: T) => boolean): T | undefined {
  const i = enCours ? liste.findIndex((x) => cle(x) === enCours) : -1;
  const depart = Math.max(0, i);
  return [...liste.slice(depart), ...liste.slice(0, depart)].find((x) => affiche(x) && aAccepter(x));
}
