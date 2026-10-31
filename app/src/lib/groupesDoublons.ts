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
import { choisirDoublons, combiner, dateSure, deplacerFichiers, ecarterDoublons, garderAussi, type FichierPlan, type InfoDoublon, type Modification, type OrigineDecision, type Plan } from './plan';
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

/**
 * Un choix attend sur une photo du groupe (pas seulement la proposition) : de l'utilisateur ou de « Choisir avec
 * l'IA » ; `deVous` : de l'utilisateur seulement (un geste).
 */
export function choixEnAttente(g: GroupeDoublons, fichier: Fichiers, deVous = false): boolean {
  const raison = raisonDe(g);
  return photosDuGroupe(g, fichier).some((x) => x.f.choixDoublons?.[raison] !== undefined && !(deVous && x.f.choixIA?.[raison]));
}

/** Groupes relus et groupes en tout (visibles seulement). */
export function avancementGroupes(groupes: GroupeDoublons[], fichier: Fichiers): { relus: number; total: number } {
  const visibles = groupes.filter((g) => groupeVisible(g, fichier));
  return { relus: visibles.filter((g) => !aRelire(g, fichier)).length, total: visibles.length };
}

// ---------------------------------------------------------------------------
// Décisions
// ---------------------------------------------------------------------------

/**
 * Met de côté `ids` ; un doublon note la photo gardée à sa place (la ★ si elle reste). `origine` : d'où vient la
 * décision de chaque photo (D112) ; par défaut, l'utilisateur.
 */
function ecarter(plan: Plan, g: GroupeDoublons, ids: string[], origine: (id: string) => OrigineDecision = () => 'vous'): Modification | null {
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
      return { id, raison, doublon, origine: origine(id) };
    }),
  );
}

/**
 * Un clic sur une photo (D101) : un choix en attente, rien n'est mis de côté avant « Accepter ».
 * `seule` (rafale, même scène) : cette photo est choisie et les autres passent « à écarter » ; sinon
 * (copies, « Garder plusieurs photos ») seule cette photo change, les choix des autres restent. Un choix égal à
 * ce que ferait « Accepter » sans lui n'est pas noté. `par` : « ia » pour « Choisir avec l'IA » (une proposition de
 * l'IA, pas un geste : règle d'or 3).
 */
export function choisir(plan: Plan, g: GroupeDoublons, id: string, seule: boolean, par: 'vous' | 'ia' = 'vous'): Modification | null {
  const fichier = (x: string) => plan.fichiers.get(x);
  const photos = photosDuGroupe(g, fichier);
  const cliquee = photos.find((x) => x.m.id === id);
  if (!cliquee) return null;
  return choisirDoublons(
    plan,
    raisonDe(g),
    (seule ? photos : [cliquee]).map((x) => {
      const garder = seule ? x.m.id === id : !aGarder(x.etat);
      return { id: x.m.id, garder: garder === parDefaut(x) ? undefined : garder };
    }),
    par,
  );
}

/** Ce que deviendrait la photo sans choix : écartée si elle l'est, sinon selon sa proposition. */
function parDefaut(x: PhotoDuGroupe): boolean {
  return x.f.statut === 'mis_de_cote' ? false : x.m.garder || !!x.f.protegee;
}

/**
 * « choisir : toutes · aucune » après « Garder plusieurs photos », et Ctrl+A (D112, question 3) : chaque photo du
 * groupe est choisie pour être gardée (`garder`), ou aucune ne l'est. Un choix en attente, comme un clic : rien
 * n'est mis de côté avant « Accepter ». Tout le groupe est fixé « par vous » (punaise, en plein), même les photos
 * dont la proposition donnait déjà ce sort (D112, précision du 31.10). Dans un groupe accepté (« Revoir »), comme
 * le clic sur la bande : l'autre sort, par vous, tout de suite et sans rouvrir le groupe (C-9.12, `basculerAccepte`).
 */
export function choisirTous(plan: Plan, g: GroupeDoublons, garder: boolean): Modification | null {
  const fichier = (x: string) => plan.fichiers.get(x);
  const photos = photosDuGroupe(g, fichier);
  const libelle = garder ? t`Choisir toutes les photos` : t`N’en choisir aucune`;
  if (!aRelire(g, fichier)) {
    const ids = photos.filter((x) => aGarder(x.etat) !== garder).map((x) => x.m.id);
    return ids.length ? combiner(libelle, garder ? garderAussi(plan, ids, raisonDe(g), 'vous') : ecarter(plan, g, ids)) : null;
  }
  const m = choisirDoublons(
    plan,
    raisonDe(g),
    photos.map((x) => ({ id: x.m.id, garder })),
  );
  return combiner(libelle, m);
}

/**
 * G ou X sur une photo (D112) : son sort est fixé par l'utilisateur, même s'il est celui de la proposition (la
 * bande passe en plein, avec la punaise). `seule` (rafale sans « Garder plusieurs photos ») : la garder écarte
 * les autres, comme un clic. Dans un groupe accepté, G et X font comme le clic sur la bande (`basculerAccepte`).
 */
export function fixer(plan: Plan, g: GroupeDoublons, id: string, garder: boolean, seule: boolean): Modification | null {
  const raison = raisonDe(g);
  const photos = photosDuGroupe(g, (x) => plan.fichiers.get(x));
  const cible = photos.find((x) => x.m.id === id);
  if (!cible) return null;
  // Groupe accepté : comme le clic sur sa bande, l'autre sort tout de suite, sans rouvrir le groupe (C-9.12) ;
  // rien si la photo a déjà le sort demandé.
  if (!aRelire(g, (x) => plan.fichiers.get(x))) return aGarder(cible.etat) === garder ? null : basculerAccepte(plan, g, id);
  // Les autres photos ne changent pas (leur choix, de vous ou de l'IA, reste), sauf « la garder seule ».
  const m = choisirDoublons(
    plan,
    raison,
    photos
      .filter((x) => x.m.id === id || (seule && garder))
      .map((x) => (x.m.id === id ? { id, garder } : { id: x.m.id, garder: parDefaut(x) === false ? undefined : false })),
  );
  return combiner(garder ? t`Garder une photo` : t`Écarter une photo`, m);
}

/**
 * Second clic sur la bande d'une photo choisie par l'utilisateur (D112, réponse 20) : elle revient à la
 * proposition. `groupe` (rafale sans « Garder plusieurs photos ») : un clic avait choisi une photo à la place des
 * autres, tout le groupe y revient ; sinon cette photo seulement.
 */
export function revenirProposition(plan: Plan, g: GroupeDoublons, id: string, groupe: boolean): Modification | null {
  const photos = photosDuGroupe(g, (x) => plan.fichiers.get(x));
  const m = choisirDoublons(
    plan,
    raisonDe(g),
    photos.filter((x) => groupe || x.m.id === id).map((x) => ({ id: x.m.id, garder: undefined })),
  );
  return combiner(t`Revenir à la proposition`, m);
}

/**
 * Clic sur la bande d'une photo d'un groupe déjà accepté (« Revoir ») : l'autre sort, par vous, tout de suite et
 * sans rouvrir le groupe (CHARTE C-9.12) ; une photo gardée est écartée (rien n'est supprimé), une écartée revient.
 */
export function basculerAccepte(plan: Plan, g: GroupeDoublons, id: string): Modification | null {
  const x = photosDuGroupe(g, (y) => plan.fichiers.get(y)).find((y) => y.m.id === id);
  if (!x) return null;
  return aGarder(x.etat) ? combiner(t`Écarter une photo`, ecarter(plan, g, [id])) : combiner(t`Garder une photo`, garderAussi(plan, [id], raisonDe(g), 'vous'));
}

/** D'où vient le sort d'une photo d'un groupe, pour son badge (D112) : décidé (plein) ou proposé (bordure). */
export interface OrigineBadgeDoublon {
  sort: 'garder' | 'ecarter';
  origine: 'vous' | 'application' | 'ia' | 'verifier';
  decide: boolean;
  /** Un choix de l'utilisateur attend « Accepter » (un second clic revient à la proposition). */
  enAttente: boolean;
  /**
   * Le sort vient de « Choisir avec l'IA », pas encore accepté : une proposition (en bordure) ; un clic fixe
   * l'autre sort par vous (`fixer`), comme sur toute proposition.
   */
  choixIA?: boolean;
  /** Groupe « Dans plusieurs dossiers » (D86) : gardée d'office dans chaque dossier, sans geste ni « Accepter ». */
  partout?: boolean;
}

/**
 * Le badge d'une photo (D112) : un choix de l'utilisateur (clic, G, X) est « par vous », en plein, même avant
 * « Accepter » ; un choix posé par « Choisir avec l'IA » est une proposition de l'IA (✦, en bordure, règle d'or 3)
 * jusqu'à « Accepter » ; une photo écartée garde l'origine écrite dans le plan ; une photo gardée d'un groupe accepté vient
 * du groupe (l'application, l'IA pour une même scène ou une rafale où l'IA l'a choisie), ou de vous si vous
 * l'aviez gardée. Avant « Accepter », la proposition est en bordure ; si l'IA conseille une autre photo que la
 * proposition, les deux photos en désaccord sont « à vérifier ». Un exemplaire d'un groupe « Dans plusieurs
 * dossiers » reste en bordure : gardé d'office, jamais accepté. `iaPrefere` : la photo conseillée par l'IA.
 */
export function origineBadgeDoublon(g: GroupeDoublons, x: PhotoDuGroupe, valide: boolean, iaPrefere?: string): OrigineBadgeDoublon {
  const raison = raisonDe(g);
  const sort = aGarder(x.etat) ? 'garder' : 'ecarter';
  const lue = (o: OrigineDecision | undefined): 'vous' | 'application' | 'ia' => (o === 'vous' ? 'vous' : o === 'ia' ? 'ia' : 'application');
  if (x.f.choixDoublons?.[raison] !== undefined)
    return x.f.choixIA?.[raison] ? { sort, origine: 'ia', decide: false, enAttente: false, choixIA: true } : { sort, origine: 'vous', decide: true, enAttente: true };
  if (x.etat === 'ecartee') return { sort, origine: lue(x.f.origine?.[raison]), decide: true, enAttente: false };
  if (x.f.protegee && x.f.origine?.[raison]) return { sort, origine: lue(x.f.origine[raison]), decide: true, enAttente: false };
  // Présente dans plusieurs dossiers gardés : l'application la garde partout (D86) ; aucun geste, donc en bordure.
  if (g.sorte === 'dossiers' && sort === 'garder') return { sort, origine: 'application', decide: false, enAttente: false, partout: true };
  const proposee = g.sorte === 'ia' || (iaPrefere !== undefined && iaPrefere === x.m.id) ? 'ia' : 'application';
  if (valide) return { sort, origine: proposee, decide: true, enAttente: false };
  if (iaPrefere !== undefined && iaPrefere !== g.etoile && (x.m.id === iaPrefere) !== (sort === 'garder')) return { sort, origine: 'verifier', decide: false, enAttente: false };
  return { sort, origine: iaPrefere !== undefined && iaPrefere === g.etoile ? 'ia' : proposee, decide: false, enAttente: false };
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
    // Origine (D112) : ce que l'utilisateur a choisi photo par photo est « par vous », ce que « Choisir avec l'IA » a
    // choisi est de l'IA ; le reste suit la proposition acceptée, de l'IA pour une même scène, sinon de l'application.
    const raison = raisonDe(g);
    const proposee: OrigineDecision = g.sorte === 'ia' ? 'ia' : 'application';
    const parIA = (id: string) => !!fichier(id)?.choixIA?.[raison];
    modifications.push(ecarter(plan, g, ids, (id) => (fichier(id)?.choixDoublons?.[raison] === undefined ? proposee : parIA(id) ? 'ia' : 'vous')));
    const choisiesIA = choisies.filter(parIA);
    const choisiesVous = choisies.filter((id) => !parIA(id));
    if (choisiesVous.length) modifications.push(garderAussi(plan, choisiesVous, raison));
    if (choisiesIA.length) modifications.push(garderAussi(plan, choisiesIA, raison, 'ia'));
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

/**
 * Ce que chiffre la fenêtre d'une acceptation groupée (D112, règle d'or 3) : `n` photos écartées, dont `sansRegard`
 * dans des groupes où vous n'avez rien choisi (la proposition, ou un choix de « Choisir avec l'IA » seul, acceptés
 * sans geste de votre part).
 */
export function comptesAcceptation(acceptes: GroupeDoublons[], fichier: Fichiers): { n: number; sansRegard: number } {
  const n = acceptes.reduce((a, g) => a + aEcarter(g, fichier).length, 0);
  const sansRegard = acceptes.filter((g) => !choixEnAttente(g, fichier, true)).reduce((a, g) => a + aEcarter(g, fichier).length, 0);
  return { n, sansRegard };
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
