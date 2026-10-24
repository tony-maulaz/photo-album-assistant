// Lecture et validation de config/config.json (SPEC § 8.2).
// Version minimale pour la phase 0 : structure et valeurs essentielles.

export interface LieuConnu {
  id: string;
  nom: string;
  lat: number;
  lon: number;
  rayon_m: number;
  domicile: boolean;
  un_seul_dossier: boolean;
  notes: string;
}

export interface Config {
  version: number;
  modifie_le: string;
  lieux_connus: LieuConnu[];
  appareils: { modele: string; decalage: string; surnom: string }[];
  calendriers: { fichier: string; nom: string; actif: boolean; inclure_recurrents: boolean }[];
  prereglages: Record<string, unknown>;
}

export const VERSION_CONFIG = 1;

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Liste des problèmes trouvés (vide si la configuration est valide). */
export function validerConfig(v: unknown): string[] {
  const erreurs: string[] = [];
  if (!estObjet(v)) return ['Le fichier ne contient pas un objet JSON.'];
  if (v.version !== VERSION_CONFIG) erreurs.push(`Version ${String(v.version)} inconnue (attendue : ${VERSION_CONFIG}).`);
  if (typeof v.modifie_le !== 'string') erreurs.push('Date de modification absente.');
  for (const cle of ['lieux_connus', 'appareils', 'calendriers']) {
    if (!Array.isArray(v[cle])) erreurs.push(`« ${cle} » doit être une liste.`);
  }
  if (!estObjet(v.prereglages)) erreurs.push('« prereglages » doit être un objet.');
  if (Array.isArray(v.lieux_connus)) {
    let domiciles = 0;
    v.lieux_connus.forEach((l, i) => {
      const ou = `Lieu ${i + 1}`;
      if (!estObjet(l)) {
        erreurs.push(`${ou} : objet attendu.`);
        return;
      }
      if (typeof l.nom !== 'string' || !l.nom) erreurs.push(`${ou} : nom manquant.`);
      if (typeof l.lat !== 'number' || Math.abs(l.lat) > 90) erreurs.push(`${ou} : latitude invalide.`);
      if (typeof l.lon !== 'number' || Math.abs(l.lon) > 180) erreurs.push(`${ou} : longitude invalide.`);
      if (typeof l.rayon_m !== 'number' || l.rayon_m <= 0) erreurs.push(`${ou} : rayon invalide.`);
      if (l.domicile === true) domiciles++;
    });
    if (domiciles > 1) erreurs.push('Un seul lieu peut être le domicile.');
  }
  if (Array.isArray(v.appareils)) {
    v.appareils.forEach((a, i) => {
      if (!estObjet(a) || typeof a.decalage !== 'string' || !/^[+-]\d{2}:\d{2}$/.test(a.decalage)) {
        erreurs.push(`Appareil ${i + 1} : décalage attendu au format +HH:MM.`);
      }
    });
  }
  return erreurs;
}

/** Nom horodaté d'une sauvegarde : config_AAAAMMJJ-HHMMSS.json (heure locale). */
export function nomSauvegarde(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `config_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
}

/** Sauvegardes à supprimer pour n'en garder que `garder` (les plus récentes). */
export function sauvegardesEnTrop(noms: string[], garder = 10): string[] {
  const tries = noms.filter((n) => /^config_\d{8}-\d{6}\.json$/.test(n)).sort();
  return tries.slice(0, Math.max(0, tries.length - garder));
}
