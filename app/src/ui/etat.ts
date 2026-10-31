// État partagé de l'interface : page affichée, projet ouvert, plan et
// annulation, réglages, messages. Le plan est enregistré au fil de l'eau
// dans `.album/` (règle d'or 7).

import type { ChangementsSource } from '../lib/source';
import { t, type Langue } from '../lib/langue';
import { lirePageVue, textePageVue } from '../lib/navigation';
import { effect, signal } from '@preact/signals';
import type { ConfigAlbum } from '../lib/album';
import type { EvenementCalendrier } from '../lib/ics';
import { evenementsCalendriers } from '../navigateur/calendriers';
import type { ContexteExecution } from '../navigateur/executeur';
import { Historique, RACINE, versJson, type Modification, type Plan } from '../lib/plan';
import type { EtatSortie } from '../lib/sortie';
import type { ResultatsAides } from '../navigateur/aides';
import type { Analyses } from '../navigateur/analyses';
import type { DossierConfig, LectureConfig } from '../navigateur/configuration';
import type { AccesDossier } from '../navigateur/dossiers';
import type { EtatDoublons } from '../navigateur/doublons';
import type { Geocodage } from '../navigateur/geocodage';
import type { ServiceIA } from '../navigateur/ia';
import { expliquerErreur } from '../navigateur/claude';
import { Miniatures } from '../navigateur/miniatures';
import { ETAPE, ETAPES, etapePrecedente, etapeSuivante, noterProjetRecent, type CodeEtape, type EtatProjet, type EtatEtape, type Projet } from '../navigateur/projet';
import { enregistrerReglages, lireReglages, type Reglages } from '../navigateur/reglages';
import { GroupeWorkers } from '../navigateur/workers';
import { minusculeInitiale } from './format';

export type Page =
  | { nom: 'reprendre' }
  | { nom: 'accueil' }
  | { nom: 'nouveau'; mode: Projet['mode'] }
  | { nom: 'etape'; numero: number }
  | { nom: 'ia' }
  | { nom: 'configuration' }
  | { nom: 'reglages' }
  | { nom: 'journal' }
  | { nom: 'aide' };

export const page = signal<Page>({ nom: 'accueil' });

// Page retrouvée après un rechargement de l'onglet : gardée pour l'onglet
// seulement (sessionStorage), relue une fois au chargement.
const CLE_PAGE_VUE = 'album:page_vue';

function lirePageGardee(): string | null {
  try {
    return sessionStorage.getItem(CLE_PAGE_VUE);
  } catch {
    return null;
  }
}

let pageAvantRechargement = lirePageGardee();

/** Garde la page regardée dans le projet ouvert (`null` : projet fermé, on oublie). */
export function garderPageVue(projet: string | null, p: Page) {
  try {
    if (projet) sessionStorage.setItem(CLE_PAGE_VUE, textePageVue(projet, p));
    else sessionStorage.removeItem(CLE_PAGE_VUE);
  } catch {
    // Stockage indisponible : un rechargement rouvrira l'étape à reprendre.
  }
}

/** Page regardée avant le rechargement de l'onglet, pour ce projet ; une seule fois (ensuite, l'étape à reprendre). */
export function pageApresRechargement(projet: string): Page | null {
  const p = lirePageVue(pageAvantRechargement, projet, ETAPES.length) as Page | null;
  pageAvantRechargement = null;
  return p;
}

export interface Session {
  projet: Projet;
  plan: Plan;
  historique: Historique;
  source: AccesDossier;
  sortie: AccesDossier;
  etat: EtatProjet;
  etatSortie: EtatSortie;
  /** Netteté, ressemblance et exposition des photos (`.album/analyse.json`). */
  analyses: Analyses;
  ia: ServiceIA;
  /** Propositions et remarques des aides IA (`.album/aides.json`). */
  aides: ResultatsAides;
  /** Noms de lieux déjà demandés à OpenStreetMap (`.album/geocodage.json`). */
  geocodage: Geocodage;
  /** Réglages de l'album (étape « Album », `.album/album.json`). */
  album: ConfigAlbum;
  /** Propositions de l'étape « Doublons » (`.album/doublons.json`). */
  doublons?: EtatDoublons;
}

export const session = signal<Session | null>(null);
/** Incrémenté à chaque changement du plan, pour rafraîchir l'affichage. */
export const versionPlan = signal(0);
/** Incrémenté à chaque changement du projet (étapes, nom…). */
export const versionProjet = signal(0);
/** Incrémenté après chaque dépense IA et à chaque analyse terminée. */
export const versionIA = signal(0);

export const reglages = signal<Reglages>(lireReglages());
/** Ce qui a changé dans la source depuis l'inventaire (D63), vérifié à l'ouverture du projet ; `null` : pas encore vérifié. */
export const changementsSource = signal<ChangementsSource | null>(null);
/** Langue affichée (celle choisie dans les réglages, ou celle du navigateur) ; mise à jour par main.tsx. */
export const langueInterface = signal<Langue>('fr');
export function changerReglages(r: Reglages) {
  reglages.value = r;
  enregistrerReglages(r);
}

export const configuration = signal<{ dossier: DossierConfig; lecture: LectureConfig | null } | null>(null);

/** Événements des calendriers actifs (lieux et sorties, nommage, album), relus quand la configuration change. */
export const evenements = signal<EvenementCalendrier[]>([]);
export async function chargerEvenements() {
  const c = configuration.value;
  evenements.value = await evenementsCalendriers(c?.dossier, c?.lecture?.config).catch(() => []);
}

/** Ce qu'il faut pour exécuter une demande IA dans le projet ouvert. */
export function contexteExecution(s: Session): ContexteExecution {
  return { plan: s.plan, source: s.source, ia: s.ia, miniatures: serviceMiniatures() };
}

// ---------------------------------------------------------------------------
// Messages passagers
// ---------------------------------------------------------------------------

export interface Message {
  id: number;
  type: 'info' | 'ok' | 'erreur';
  texte: string;
  action?: { libelle: string; faire: () => void };
  /**
   * Le geste que le message propose d'annuler (`action.faire === annuler`) : le rappel « ↶ ou Ctrl+Z » et le lien
   * « Annuler » ne s'affichent que tant qu'il est le dernier de l'historique (sinon ils déferaient un autre geste).
   */
  geste?: object;
}

export const messages = signal<Message[]>([]);
let prochainMessage = 1;

/** Messages de l'action en cours (jusqu'à la fin de la tâche) : ils suivent sur la page où elle mène. */
const messagesDeLAction = new Set<number>();

/** Affiche un message passager ; renvoie son identifiant (pour le retirer plus tôt). */
export function notifier(type: Message['type'], texte: string, action?: Message['action']): number {
  const id = prochainMessage++;
  // Le même message deux fois de suite (ranger, puis ranger à nouveau) ne s'empile pas : le nouveau remplace l'ancien.
  const m: Message = { id, type, texte, action };
  if (action?.faire === annuler) {
    // Le geste est d'ordinaire appliqué juste avant le message ; s'il l'est juste après, dans la même action, il est relu.
    m.geste = session.value?.historique.dernier;
    queueMicrotask(() => (m.geste = session.value?.historique.dernier));
  }
  messages.value = [...messages.value.filter((x) => x.texte !== texte).slice(-2), m];
  messagesDeLAction.add(id);
  queueMicrotask(() => messagesDeLAction.delete(id));
  setTimeout(() => retirerMessage(id), type === 'erreur' ? 9000 : 5000);
  return id;
}

/** Le message propose-t-il encore d'annuler son geste (toujours le dernier de l'historique) ? */
export function gesteActuel(m: Message): boolean {
  const h = session.value?.historique;
  return m.action?.faire === annuler && !!h?.peutAnnuler && m.geste !== undefined && m.geste === h.dernier;
}

// Changer de page périme les messages de la précédente (« vérifiez-les à l'étape suivante » restait affiché à
// cette étape, D94) ; restent les erreurs et ceux de l'action qui y mène (« 12 photos écartées », puis l'étape suivante).
effect(() => {
  page.value;
  const restants = messages.peek().filter((m) => m.type === 'erreur' || messagesDeLAction.has(m.id));
  if (restants.length !== messages.peek().length) messages.value = restants;
});

/** Retire un message devenu faux (« Saisissez d'abord votre clé API » une fois la clé saisie). */
export function retirerMessage(id: number) {
  if (messages.value.some((m) => m.id === id)) messages.value = messages.value.filter((m) => m.id !== id);
}

/** Message compréhensible pour une erreur (celles de l'API Claude sont expliquées, sans leur JSON brut). */
export function texteErreur(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') return t`Action annulée.`;
  return expliquerErreur(err);
}

// ---------------------------------------------------------------------------
// Outils partagés : workers et miniatures
// ---------------------------------------------------------------------------

let groupe: GroupeWorkers | null = null;
let miniatures: Miniatures | null = null;

export function groupeWorkers(): GroupeWorkers {
  groupe ??= new GroupeWorkers();
  return groupe;
}

export function serviceMiniatures(): Miniatures {
  miniatures ??= new Miniatures(groupeWorkers());
  return miniatures;
}

// ---------------------------------------------------------------------------
// Modifications du plan et enregistrement
// ---------------------------------------------------------------------------

let minuterie: ReturnType<typeof setTimeout> | null = null;
let enregistrement: Promise<void> = Promise.resolve();

/** Enregistre le plan dans `.album/plan.json`, au plus tard 400 ms après la dernière modification. */
export function planifierEnregistrement() {
  if (minuterie) clearTimeout(minuterie);
  minuterie = setTimeout(() => void enregistrerMaintenant(), 400);
}

export function enregistrerMaintenant(): Promise<void> {
  if (minuterie) clearTimeout(minuterie);
  minuterie = null;
  const s = session.value;
  if (!s) return enregistrement;
  enregistrement = enregistrement
    .then(async () => {
      s.projet.modifie_le = new Date().toISOString();
      // Le projet d'abord : petit, il porte les dépenses IA et l'état des étapes (onglet fermé en pleine écriture).
      await s.etat.ecrire('projet.json', s.projet);
      await s.etat.ecrire('plan.json', versJson(s.plan));
    })
    .catch((err) => void notifier('erreur', t`Enregistrement impossible : ${texteErreur(err)}`));
  return enregistrement;
}

/**
 * Écrit `.album/projet.json` tout de suite, à la suite des autres écritures :
 * une dépense IA est enregistrée avant que sa réponse entre dans le cache, et
 * un rechargement juste après ne la fait pas oublier (règle d'or 7).
 */
export function enregistrerProjet(etat: EtatProjet, projet: Projet): Promise<void> {
  enregistrement = enregistrement.then(() => etat.ecrire('projet.json', projet)).catch((err) => void notifier('erreur', t`Enregistrement impossible : ${texteErreur(err)}`));
  return enregistrement;
}

// Un onglet fermé ne doit rien perdre : on enregistre dès que la page est masquée.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && minuterie) void enregistrerMaintenant();
});

/** Applique une modification du plan : annulable, affichée et enregistrée. */
export function appliquer(m: Modification | null) {
  const s = session.value;
  if (!s || !m) return;
  const p = page.value;
  if (p.nom === 'etape' && m.etape === undefined) m.etape = p.numero;
  s.historique.enregistrer(m);
  apresChangement();
}

function apresChangement() {
  versionPlan.value++;
  const s = session.value;
  // Revenir sur une étape marque les étapes suivantes déjà validées « à revoir » (§ 4.4) ;
  // leurs décisions encore valables sont gardées (une photo déplacée garde son étoile).
  if (s) {
    const p = page.value;
    const courante = p.nom === 'etape' ? p.numero : 0;
    for (let n = Math.max(courante + 1, 2); n <= ETAPES.length; n++) if (s.projet.etapes[n - 1] === 'validee') changerEtape(n, 'a_revoir');
  }
  planifierEnregistrement();
}

/** Nombre d'annulations faites : une page y voit qu'un changement vient d'« Annuler » (Doublons rend le plein au groupe rouvert). */
export const annulations = signal(0);

export function annuler() {
  const s = session.value;
  const m = s?.historique.annuler(s.plan);
  if (m) {
    annulations.value++;
    apresChangement();
    notifier('info', t`Annulé : ${minusculeInitiale(m.detail ?? m.libelle)}`);
  }
}

export function retablir() {
  const s = session.value;
  const m = s?.historique.retablir(s.plan);
  if (m) {
    apresChangement();
    notifier('info', t`Rétabli : ${minusculeInitiale(m.detail ?? m.libelle)}`);
  }
}

export function changerEtape(numero: number, etat: EtatEtape) {
  const s = session.value;
  if (!s || s.projet.etapes[numero - 1] === etat) return;
  s.projet.etapes[numero - 1] = etat;
  versionProjet.value++;
  planifierEnregistrement();
  // Instantané de la configuration utilisée à chaque validation (§ 8.7) : le projet reste reproductible.
  const config = configuration.value?.lecture?.config;
  if (etat === 'validee' && config) void s.etat.ecrire('config_utilisee.json', config).catch(() => undefined);
  // Avancement affiché sur la carte du projet, à l'accueil.
  const { id, nom, inventaire } = s.projet;
  void noterProjetRecent({ id, nom, source: s.source.racine, sortie: s.sortie.racine, etapes: [...s.projet.etapes], fichiers: inventaire?.fichiers }).catch(() => undefined);
}

/** Ouvre une étape. */
export function allerEtape(code: CodeEtape | null) {
  if (code) page.value = { nom: 'etape', numero: ETAPE[code] };
}

/** Dossier en vrac sans aucun sous-dossier (inventaire fait) : l'étape « Dossiers » n'a rien à demander. */
export function sansSousDossiers(s: Session): boolean {
  return !!s.projet.inventaire && ![...s.plan.dossiers.values()].some((d) => d.parent === RACINE && d.origine === 'source');
}

/** « Revenir » : l'étape précédente du parcours (un dossier déjà trié saute le tri et ses suites). */
export function revenirDe(code: CodeEtape) {
  const s = session.value;
  if (s) allerEtape(etapePrecedente(s.projet.mode, code, sansSousDossiers(s)));
}

/** « Valider et continuer » : l'étape est validée, la suivante du parcours s'ouvre (en cours si elle ne l'était pas). */
export function validerEtape(code: CodeEtape) {
  const s = session.value;
  if (!s) return;
  changerEtape(ETAPE[code], 'validee');
  const suivante = etapeSuivante(s.projet.mode, code, sansSousDossiers(s));
  if (!suivante) return;
  if (s.projet.etapes[ETAPE[suivante] - 1] !== 'validee') changerEtape(ETAPE[suivante], 'en_cours');
  allerEtape(suivante);
}

let ecritureAlbum: Promise<void> = Promise.resolve();

/** Change les réglages de l'album et les enregistre dans `.album/album.json`. */
export function changerAlbum(modif: Partial<ConfigAlbum>) {
  const s = session.value;
  if (!s) return;
  s.album = { ...s.album, ...modif };
  versionPlan.value++;
  if (s.projet.etapes[ETAPE.sortie - 1] === 'validee') changerEtape(ETAPE.sortie, 'a_revoir');
  const config = s.album;
  ecritureAlbum = ecritureAlbum.then(() => s.etat.ecrire('album.json', config)).catch((err) => void notifier('erreur', t`Enregistrement impossible : ${texteErreur(err)}`));
}

export function journal(type: string, texte: string, donnees?: unknown) {
  void session.value?.etat.journal(type, texte, donnees).catch(() => undefined);
}
