// Noms de lieux des groupes GPS (étape « Tri automatique ») : Nominatim, une requête par
// seconde, français puis anglais si le nom n'est pas en écriture latine (I3),
// cache dans `.album/geocodage.json` par coordonnée arrondie (script 01).
// Adresses précises des lieux fréquents, pour les reconnaître : `.album/adresses.json`.

import { adresseCourte } from '../lib/noms';
import { inverse, nomDeLieu } from './nominatim';
import type { EtatProjet } from './projet';

const FICHIER = 'geocodage.json';
const FICHIER_ADRESSES = 'adresses.json';

type Entree = { nom: string | null; precis: boolean; langue: string | null };

/** Clé de cache : coordonnée arrondie à 4 décimales (environ 10 m), comme le script 01. */
export function cleGeocodage(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export class Geocodage {
  private cache: Record<string, Entree> = {};
  private adresses: Record<string, string | null> = {};
  /** `langue` : celle du projet (D60), pour les noms de lieux et les adresses. */
  constructor(
    private etat: EtatProjet,
    private langue: string,
  ) {}

  async charger(): Promise<void> {
    this.cache = (await this.etat.lire<Record<string, Entree>>(FICHIER).catch(() => undefined)) ?? {};
    this.adresses = (await this.etat.lire<Record<string, string | null>>(FICHIER_ADRESSES).catch(() => undefined)) ?? {};
  }

  /** Adresse précise de chaque point (`null` si Nominatim n'en donne pas), dans l'ordre ; enregistrée au fil de l'eau. */
  async adresser(points: { lat: number; lon: number }[], email: string, arreter: () => boolean): Promise<(string | null)[]> {
    const resultat: (string | null)[] = [];
    for (const p of points) {
      const cle = cleGeocodage(p.lat, p.lon);
      if (!(cle in this.adresses)) {
        if (arreter()) throw new DOMException('Géocodage arrêté', 'AbortError');
        const r = await inverse(Number(p.lat.toFixed(4)), Number(p.lon.toFixed(4)), this.langue, email || undefined, 18);
        this.adresses[cle] = adresseCourte(r.donnees);
        await this.etat.ecrire(FICHIER_ADRESSES, this.adresses);
      }
      resultat.push(this.adresses[cle]);
    }
    return resultat;
  }

  connu(lat: number, lon: number): Entree | undefined {
    return this.cache[cleGeocodage(lat, lon)];
  }

  /**
   * Nom déjà connu le plus proche, à `km` au plus, sans réseau : pour montrer
   * le tri avant de ranger (D104), quand un réglage déplace un peu le centre
   * d'une sortie. `null` si aucun nom connu n'est assez proche.
   */
  procheConnu(lat: number, lon: number, km = 1): string | null {
    const exact = this.connu(lat, lon);
    if (exact) return exact.nom;
    let meilleur: { d: number; nom: string } | null = null;
    const r = Math.PI / 180;
    for (const [cle, e] of Object.entries(this.cache)) {
      if (!e.nom) continue;
      const [a, b] = cle.split(',').map(Number);
      const x = (b - lon) * r * Math.cos(((a + lat) / 2) * r);
      const d = Math.hypot(x, (a - lat) * r) * 6371;
      if (d <= km && (!meilleur || d < meilleur.d)) meilleur = { d, nom: e.nom };
    }
    return meilleur?.nom ?? null;
  }

  /** Points qu'il faudra demander à Nominatim (pour annoncer la durée : environ 1 à 2 s chacun). */
  manquants(points: { lat: number; lon: number }[]): number {
    return new Set(points.filter((p) => !this.connu(p.lat, p.lon)).map((p) => cleGeocodage(p.lat, p.lon))).size;
  }

  /** Nom de chaque point (`null` si Nominatim n'en donne pas), dans l'ordre ; enregistré au fil de l'eau. */
  async nommer(points: { lat: number; lon: number }[], email: string, progres: (faits: number, total: number) => void, arreter: () => boolean): Promise<(string | null)[]> {
    const total = this.manquants(points);
    let faits = 0;
    const noms: (string | null)[] = [];
    for (const p of points) {
      const cle = cleGeocodage(p.lat, p.lon);
      if (!(cle in this.cache)) {
        if (arreter()) throw new DOMException('Géocodage arrêté', 'AbortError');
        const r = await nomDeLieu(Number(p.lat.toFixed(4)), Number(p.lon.toFixed(4)), email || undefined, this.langue);
        this.cache[cle] = { nom: r.nom, precis: r.precis, langue: r.langue };
        await this.etat.ecrire(FICHIER, this.cache);
        progres(++faits, total);
      }
      noms.push(this.cache[cle].nom);
    }
    return noms;
  }
}
