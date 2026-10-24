// Actions de projet : créer, construire le plan, rouvrir, autorisations à reprendre.

import { configAlbumDefaut, type ConfigAlbum } from '../lib/album';
import { t } from '../lib/langue';
import { depuisJson, Historique, planVide, RACINE, versJson, type PlanJson } from '../lib/plan';
import { etatVide, type EtatSortie } from '../lib/sortie';
import { planInitial } from '../lib/source';
import { ResultatsAides } from '../navigateur/aides';
import { Analyses } from '../navigateur/analyses';
import { DossierConfig } from '../navigateur/configuration';
import { AccesDossier, dossierMemorise, etatAutorisation, relation, type Mode } from '../navigateur/dossiers';
import { lireDoublons } from '../navigateur/doublons';
import { Geocodage } from '../navigateur/geocodage';
import { ServiceIA } from '../navigateur/ia';
import { inventorier, type Progression } from '../navigateur/inventaire';
import { ETAPE, EtatProjet, migrerEtapes, noterProjetRecent, nouveauProjet, projetsRecents, type Projet } from '../navigateur/projet';
import { changerEtape, chargerEvenements, configuration, journal, notifier, page, planifierEnregistrement, reglages, session, versionIA, versionPlan, versionProjet } from './etat';

/** Services du projet ouvert : analyses des photos et appels IA (cache, budget). */
async function services(etat: EtatProjet, projet: Projet) {
  const analyses = new Analyses(etat);
  const ia = new ServiceIA(
    etat,
    projet,
    () => reglages.value.tauxUsdChf,
    (alerte) => {
      versionIA.value++;
      planifierEnregistrement();
      if (alerte) notifier('info', alerte);
    },
    journal,
  );
  const geocodage = new Geocodage(etat);
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
  const projet = nouveauProjet(o.nom.trim() || o.source.name, o.mode, { nom: o.source.name, fichiers: 0, octets: 0 }, o.budget);
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
  // (nommés ou de mois) sont gardés tels quels par défaut (§ 6.2), modifiable à l'étape 2.
  if (s.projet.mode === 'vrac') {
    for (const d of plan.dossiers.values()) if (d.parent === RACINE && d.origine === 'source') plan.dossiers.set(d.id, { ...d, traitement: 'garder' });
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

/** Première étape à reprendre : la première en cours ou à revoir, sinon la dernière validée. */
export function etapeAReprendre(p: Projet): number {
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
  await noterProjetRecent({ id: projet.id, nom: projet.nom, source, sortie, etapes: [...projet.etapes], fichiers: projet.inventaire?.fichiers });
  journal('projet', t`Projet « ${projet.nom} » ouvert`);
  versionPlan.value++;
  versionProjet.value++;
  page.value = { nom: 'etape', numero: etapeAReprendre(projet) };
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
