// Actions de projet : créer, construire le plan, rouvrir, autorisations à reprendre.

import exemple from '../../../config.exemple/config.json';
import { configAlbumDefaut, type ConfigAlbum } from '../lib/album';
import { VERSION_CONFIG, type Config } from '../lib/config';
import { t, type Langue } from '../lib/langue';
import { reprendreOrigines } from '../lib/origines';
import { depuisJson, Historique, planVide, RACINE, versJson, type PlanJson } from '../lib/plan';
import { definirLangueSortie, etatVide, type EtatSortie } from '../lib/sortie';
import { comparerSource, integrerSource, planInitial, type ChangementsSource } from '../lib/source';
import { ResultatsAides } from '../navigateur/aides';
import { Analyses } from '../navigateur/analyses';
import { DossierConfig } from '../navigateur/configuration';
import { AccesDossier, choisirDossier, dossierMemorise, etatAutorisation, memoriserDossier, relation, type Mode } from '../navigateur/dossiers';
import { lireDoublons } from '../navigateur/doublons';
import { Geocodage } from '../navigateur/geocodage';
import { ServiceIA } from '../navigateur/ia';
import { inventorier, lireDetails, listerSource, type Progression } from '../navigateur/inventaire';
import { ETAPE, EtatProjet, migrerEtapes, noterProjetRecent, nouveauProjet, projetsRecents, type Projet } from '../navigateur/projet';
import { appliquer, changementsSource, changerEtape, chargerEvenements, configuration, enregistrerMaintenant, enregistrerProjet, journal, notifier, page, pageApresRechargement, reglages, session, versionIA, versionPlan, versionProjet } from './etat';

/** Services du projet ouvert : analyses des photos et appels IA (cache, budget). */
async function services(etat: EtatProjet, projet: Projet) {
  const analyses = new Analyses(etat);
  const ia = new ServiceIA(
    etat,
    projet,
    () => reglages.value.tauxUsdChf,
    (alerte) => {
      versionIA.value++;
      if (alerte) notifier('info', alerte);
      // Dépense écrite tout de suite : un rechargement ne doit pas l'oublier (la réponse, elle, est déjà payée).
      return enregistrerProjet(etat, projet);
    },
    journal,
  );
  const geocodage = new Geocodage(etat, projet.langue ?? 'fr');
  const aides = new ResultatsAides(etat);
  await Promise.all([analyses.charger(), ia.charger(), geocodage.charger(), aides.charger()]);
  const album = { ...configAlbumDefaut(), ...((await etat.lire<Partial<ConfigAlbum>>('album.json').catch(() => undefined)) ?? {}) };
  return { analyses, ia, geocodage, aides, album, doublons: await lireDoublons(etat) };
}

export interface NouveauProjet {
  source: FileSystemDirectoryHandle;
  sortie: FileSystemDirectoryHandle;
  nom: string;
  mode: Projet['mode'];
  contexte: string;
  prereglage: string;
  budget: number;
  langue: Langue;
}

/** Message d'erreur si le couple source / sortie est refusé (§ 6.1), sinon `null`. */
export async function verifierDossiers(source: FileSystemDirectoryHandle, sortie: FileSystemDirectoryHandle): Promise<string | null> {
  const r = await relation(source, sortie);
  if (r === 'identiques') return t`Le dossier de sortie doit être différent du dossier à trier.`;
  if (r === 'b-dans-a') return t`Le dossier de sortie ne peut pas être à l’intérieur du dossier à trier.`;
  if (r === 'a-dans-b') return t`Le dossier à trier ne peut pas être à l’intérieur du dossier de sortie.`;
  return null;
}

/** Le dossier de sortie contient-il déjà des fichiers (hors projet) ? */
export async function sortieNonVide(sortie: FileSystemDirectoryHandle): Promise<boolean> {
  for await (const nom of sortie.keys()) if (nom !== '.album') return true;
  return false;
}

export async function creerProjet(o: NouveauProjet): Promise<void> {
  const erreur = await verifierDossiers(o.source, o.sortie);
  if (erreur) throw new Error(erreur);
  const etat = new EtatProjet(o.sortie);
  if (await etat.existe()) throw new Error(t`Ce dossier de sortie contient déjà un projet : ouvrez-le avec « Reprendre un projet ».`);
  const projet = nouveauProjet(o.nom.trim() || o.source.name, o.mode, { nom: o.source.name, fichiers: 0, octets: 0 }, o.budget, o.langue);
  definirLangueSortie(projet.langue ?? 'fr');
  projet.contexte = o.contexte;
  projet.prereglage = o.prereglage;
  await etat.ecrire('projet.json', projet);
  await noterProjetRecent({ id: projet.id, nom: projet.nom, source: o.source, sortie: o.sortie, etapes: [...projet.etapes] });
  session.value = {
    projet,
    plan: planVide(),
    historique: new Historique(),
    source: new AccesDossier(o.source),
    sortie: new AccesDossier(o.sortie),
    etat,
    etatSortie: etatVide(),
    ...(await services(etat, projet)),
  };
  changerEtape(ETAPE.projet, 'validee');
  changerEtape(ETAPE.inventaire, 'en_cours');
  journal('projet', t`Projet « ${projet.nom} » créé`, { source: o.source.name, sortie: o.sortie.name, mode: o.mode });
  page.value = { nom: 'etape', numero: ETAPE.inventaire };
}

export interface ResumeInventaire {
  fichiers: number;
  dossiers: number;
  octets: number;
  dureeMs: number;
  ignores: string[];
}

/** Inventaire de la source, puis plan initial (les sous-dossiers deviennent les dossiers du plan). */
export async function construirePlan(progres: (p: Progression) => void, arreter: () => boolean): Promise<ResumeInventaire> {
  const s = session.value;
  if (!s) throw new Error(t`Aucun projet ouvert.`);
  const inv = await inventorier(s.source.racine, progres, arreter);
  const { plan, ignores } = planInitial(inv.elements);
  // Dossier en vrac : les photos de la racine sont à trier ; les sous-dossiers
  // (nommés ou de mois) gardent leur place et sont nettoyés par défaut (D61), modifiable à l'étape « Dossiers ».
  if (s.projet.mode === 'vrac') {
    for (const d of plan.dossiers.values()) if (d.parent === RACINE && d.origine === 'source') plan.dossiers.set(d.id, { ...d, traitement: 'nettoyer' });
  }
  const octets = inv.elements.reduce((t, e) => t + e.taille, 0);
  s.plan = plan;
  s.historique = new Historique();
  s.projet.source = { nom: s.source.racine.name, fichiers: inv.elements.length, octets };
  const resume = { fichiers: inv.elements.length, dossiers: inv.dossiers, octets, dureeMs: inv.dureeMs, ignores };
  s.projet.inventaire = { quand: new Date().toISOString(), ...resume };
  await s.etat.ecrire('plan.json', versJson(plan));
  await s.etat.ecrire('projet.json', s.projet);
  journal('inventaire', t`Inventaire : ${inv.elements.length} fichiers en ${Math.round(inv.dureeMs / 1000)} s`, resume);
  versionPlan.value++;
  versionProjet.value++;
  return resume;
}

/**
 * Relit rapidement la source (chemins, tailles, dates) et note ce qui a changé
 * depuis l'inventaire (D63) : un bandeau propose alors la mise à jour.
 */
export async function verifierSource(): Promise<ChangementsSource | null> {
  const s = session.value;
  if (!s?.projet.inventaire) return null;
  try {
    const { fichiers } = await listerSource(s.source.racine, () => undefined);
    if (session.value !== s) return null;
    const c = comparerSource(s.plan, fichiers.map((f) => ({ chemin: f.chemin, taille: f.fichier.size, modifie: f.fichier.lastModified })));
    changementsSource.value = c;
    return c;
  } catch {
    return null;
  }
}

export interface ResumeMiseAJour {
  ajoutes: number;
  modifies: number;
  retires: string[];
  gardesSansSource: string[];
}

/**
 * Mise à jour de l'inventaire (D63) : seuls les fichiers nouveaux ou modifiés
 * sont lus ; ils rejoignent le plan sans rien changer à ce qui est décidé.
 * Les étapes déjà validées repassent « à revoir » : elles ne traiteront que le nouveau.
 */
export async function mettreAJourInventaire(progres: (p: Progression) => void, arreter: () => boolean): Promise<ResumeMiseAJour> {
  const s = session.value;
  if (!s) throw new Error(t`Aucun projet ouvert.`);
  const debut = performance.now();
  const { fichiers, dossiers } = await listerSource(s.source.racine, progres, arreter);
  const c = comparerSource(s.plan, fichiers.map((f) => ({ chemin: f.chemin, taille: f.fichier.size, modifie: f.fichier.lastModified })));
  const aLire = new Set([...c.nouveaux, ...c.modifies]);
  const elements = await lireDetails(fichiers.filter((f) => aLire.has(f.chemin)), progres, arreter);
  if (session.value !== s) throw new DOMException('Projet fermé', 'AbortError');
  const quand = new Date().toISOString();
  const r = integrerSource(s.plan, elements, c.disparus, { quand, vrac: s.projet.mode === 'vrac', dansLaSortie: (id) => id in s.etatSortie.fichiers });
  appliquer(r.modification);
  const octets = fichiers.reduce((n, f) => n + f.fichier.size, 0);
  s.projet.source = { ...s.projet.source, fichiers: fichiers.length, octets };
  s.projet.inventaire = { ...s.projet.inventaire!, fichiers: fichiers.length, dossiers, octets };
  s.projet.mises_a_jour = [...(s.projet.mises_a_jour ?? []), { quand, ajoutes: r.ajoutes, modifies: r.modifies, retires: r.retires.length }];
  // Ce qui était validé est à revoir : les étapes ne traiteront que le nouveau, le reste est gardé.
  if (r.modification) for (let n = ETAPE.inventaire + 1; n <= s.projet.etapes.length; n++) if (s.projet.etapes[n - 1] === 'validee') changerEtape(n, 'a_revoir');
  changementsSource.value = { nouveaux: [], modifies: [], disparus: r.gardesSansSource };
  await s.etat.ecrire('plan.json', versJson(s.plan));
  await s.etat.ecrire('projet.json', s.projet);
  journal('inventaire', t`Mise à jour de l’inventaire : ${r.ajoutes} ajoutés, ${r.modifies} modifiés, ${r.retires.length} retirés en ${Math.round((performance.now() - debut) / 1000)} s`, {
    ajoutes: c.nouveaux,
    modifies: c.modifies,
    retires: r.retires,
    gardesSansSource: r.gardesSansSource,
  });
  versionPlan.value++;
  versionProjet.value++;
  return { ajoutes: r.ajoutes, modifies: r.modifies, retires: r.retires, gardesSansSource: r.gardesSansSource };
}

/** Première étape à reprendre : la première en cours ou à revoir, sinon la dernière validée. */
export function etapeAReprendre(p: Pick<Projet, 'etapes'>): number {
  const i = p.etapes.findIndex((e) => e === 'en_cours' || e === 'a_revoir');
  if (i >= 0) return i + 1;
  const derniere = p.etapes.lastIndexOf('validee');
  return derniere >= 0 ? derniere + 1 : 1;
}

/**
 * Ouvre le projet enregistré dans `sortie`. La source doit être celle du
 * projet (même nom) : sinon, l'appelant demande confirmation.
 */
export async function ouvrirProjet(source: FileSystemDirectoryHandle, sortie: FileSystemDirectoryHandle): Promise<void> {
  const etat = new EtatProjet(sortie);
  const projet = await etat.lire<Projet>('projet.json');
  if (!projet) throw new Error(t`Ce dossier ne contient pas de projet (pas de .album/projet.json).`);
  // Projet commencé avec l'ancien ordre des étapes (11 étapes) : converti, puis enregistré.
  if (migrerEtapes(projet)) await etat.ecrire('projet.json', projet);
  // Noms écrits dans la sortie : ceux de la langue du projet (D60), un projet d'avant étant en français.
  definirLangueSortie(projet.langue ?? 'fr');
  const planJson = await etat.lire<PlanJson>('plan.json');
  const etatSortie = (await etat.lire<EtatSortie>('etat_sortie.json')) ?? etatVide();
  session.value = {
    projet,
    plan: planJson ? depuisJson(planJson) : planVide(),
    historique: new Historique(),
    source: new AccesDossier(source),
    sortie: new AccesDossier(sortie),
    etat,
    etatSortie,
    ...(await services(etat, projet)),
  };
  // Projet ouvert avant les badges (D112) : chaque décision reçoit son origine, écrite tout de suite (règle d'or 7).
  const s = session.value!;
  const reprises = reprendreOrigines(s.plan, s.aides.get<Record<string, unknown>>('IA1') ?? {});
  if (reprises) await enregistrerMaintenant();
  await noterProjetRecent({ id: projet.id, nom: projet.nom, source, sortie, etapes: [...projet.etapes], fichiers: projet.inventaire?.fichiers });
  journal('projet', t`Projet « ${projet.nom} » ouvert`, reprises ? { originesReprises: reprises } : undefined);
  versionPlan.value++;
  versionProjet.value++;
  // Après un rechargement de l'onglet, on reste sur la page regardée ; sinon, l'étape à reprendre.
  page.value = pageApresRechargement(projet.id) ?? { nom: 'etape', numero: etapeAReprendre(projet) };
  // La source a-t-elle changé depuis (photos ajoutées pour trier en plusieurs fois, D63) ?
  changementsSource.value = null;
  void verifierSource();
}

/** Lit le projet d'un dossier de sortie sans l'ouvrir (pour vérifier la source). */
export async function lireProjet(sortie: FileSystemDirectoryHandle): Promise<Projet | undefined> {
  return new EtatProjet(sortie).lire<Projet>('projet.json');
}

export function fermerProjet() {
  session.value = null;
  page.value = { nom: 'accueil' };
}

// ---------------------------------------------------------------------------
// Configuration et reprise de session (écran « Reprendre », D26)
// ---------------------------------------------------------------------------

export async function chargerConfiguration(dossier: FileSystemDirectoryHandle): Promise<void> {
  const d = new DossierConfig(dossier);
  configuration.value = { dossier: d, lecture: await d.lire() };
  void chargerEvenements();
}

/**
 * Configuration vide. Les préréglages de l'exemple restent écrits : plus
 * modifiables depuis D58, ils sont encore exigés par la lecture de config.json.
 */
export function configVide(): Config {
  return { version: VERSION_CONFIG, modifie_le: '', lieux_connus: [], appareils: [], calendriers: [], prereglages: structuredClone(exemple.prereglages) };
}

/** Choisit un dossier « config » existant et le charge (page Configuration, ou sans quitter une étape). */
export async function choisirDossierConfig(): Promise<void> {
  await chargerConfiguration(await choisirDossier('config', 'readwrite'));
}

/** Crée « config » (avec un config.json vide) dans le dossier choisi, ou reprend celui qui s'y trouve ; rend le nom du dossier choisi. */
export async function creerDossierConfig(): Promise<string> {
  const parent = await choisirDossier('config-parent', 'readwrite');
  const d = await parent.getDirectoryHandle('config', { create: true });
  await memoriserDossier('config', d);
  const dc = new DossierConfig(d);
  if (!(await dc.lire())) await dc.ecrire(configVide(), null);
  await chargerConfiguration(d);
  return parent.name;
}

export interface Autorisation {
  libelle: string;
  poignee: FileSystemDirectoryHandle;
  mode: Mode;
}

/** Dossiers mémorisés dont Chrome redemande l'accès : config/ et le dernier projet. */
export async function autorisationsEnAttente(): Promise<Autorisation[]> {
  const liste: Autorisation[] = [];
  const config = await dossierMemorise('config');
  if (config) liste.push({ libelle: t`Configuration (« ${config.name} »)`, poignee: config, mode: 'readwrite' });
  const [dernier] = await projetsRecents();
  if (dernier) {
    liste.push({ libelle: t`Dossier à trier du projet « ${dernier.nom} » (« ${dernier.source.name} »)`, poignee: dernier.source, mode: 'read' });
    liste.push({ libelle: t`Dossier de sortie du projet « ${dernier.nom} » (« ${dernier.sortie.name} »)`, poignee: dernier.sortie, mode: 'readwrite' });
  }
  const attente: Autorisation[] = [];
  for (const a of liste) if ((await etatAutorisation(a.poignee, a.mode)) !== 'granted') attente.push(a);
  return attente;
}
