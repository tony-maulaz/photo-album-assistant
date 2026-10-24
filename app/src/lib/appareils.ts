// Appareils photo du projet (SPEC § 6.2, § 8.5) : modèles détectés avec leur
// période, mesure d'un décalage d'horloge sur une scène photographiée par
// deux appareils, et correction des dates (`--decalage-appareil` du script 03).

import { distanceHamming } from './phash';

export interface AppareilDetecte {
  modele: string;
  marque?: string;
  /** Nombre de photos et de vidéos. */
  n: number;
  /** Première et dernière prise de vue (heure locale). */
  du?: string;
  au?: string;
}

/** Appareils du projet, du plus utilisé au moins utilisé ; les fichiers sans modèle sont ignorés. */
export function appareilsDetectes(fichiers: { id: string; appareil?: string; marque?: string; date?: string }[]): AppareilDetecte[] {
  const parModele = new Map<string, { marques: Map<string, number>; n: number; dates: string[] }>();
  for (const f of fichiers) {
    const modele = f.appareil?.trim();
    if (!modele) continue;
    const a = parModele.get(modele) ?? { marques: new Map<string, number>(), n: 0, dates: [] as string[] };
    a.n++;
    const marque = f.marque?.trim();
    if (marque) a.marques.set(marque, (a.marques.get(marque) ?? 0) + 1);
    if (f.date) a.dates.push(f.date);
    parModele.set(modele, a);
  }
  return [...parModele]
    .map(([modele, a]) => {
      const dates = a.dates.sort();
      const marque = [...a.marques].sort((x, y) => y[1] - x[1])[0]?.[0];
      return { modele, ...(marque ? { marque } : {}), n: a.n, ...(dates.length ? { du: dates[0], au: dates.at(-1) } : {}) };
    })
    .sort((x, y) => y.n - x.n || x.modele.localeCompare(y.modele));
}

/** Secondes d'une date locale « AAAA-MM-JJTHH:MM:SS » (horloge sans fuseau), ou `null` sans heure. */
function secondes(date?: string): number | null {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) / 1000;
}

function texteSecondes(s: number): string {
  const d = new Date(s * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** « +HH:MM » ou « -HH:MM » en minutes, ou `null` s'il est illisible. */
export function minutesDecalage(decalage: string): number | null {
  const m = /^([+-])(\d{1,3}):([0-5]\d)$/.exec(decalage.trim());
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : null;
}

/** Minutes en « +HH:MM » (les heures peuvent dépasser 24 : une horloge peut avoir un jour de retard). */
export function texteDecalage(minutes: number): string {
  const a = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/**
 * Date corrigée de l'horloge de l'appareil : on AJOUTE le décalage, comme
 * `read_dt_model` du script 03 (« Galaxy A54=+16:01 » avance les dates de
 * 16 h 01). Une date au jour près n'est pas corrigée.
 */
export function appliquerDecalage(date: string, decalage: string): string {
  const s = secondes(date);
  const m = minutesDecalage(decalage);
  if (s === null || m === null || m === 0) return date;
  return texteSecondes(s + m * 60);
}

/**
 * Décalage enregistré pour un appareil dans `config.json` : modèle identique
 * (sans tenir compte de la casse), sinon contenu dans le nom du modèle, comme
 * le script 03 qui cherchait une sous-chaîne.
 */
export function decalageAppareil(modele: string | undefined, appareils: { modele: string; decalage: string }[]): string | null {
  const m = modele?.trim().toLowerCase();
  if (!m) return null;
  const exact = appareils.find((a) => a.modele.trim().toLowerCase() === m);
  if (exact) return exact.decalage;
  return appareils.find((a) => a.modele.trim() && m.includes(a.modele.trim().toLowerCase()))?.decalage ?? null;
}

export interface PhotoHorloge {
  id: string;
  date?: string;
  phash?: string;
}

export interface MesureDecalage {
  /** Décalage à appliquer à l'appareil B pour le caler sur A (« +HH:MM »). */
  decalage: string;
  minutes: number;
  /** Paires concordantes (même écart à 5 min près) : plus il y en a, plus la mesure est sûre. */
  paires: number;
  /** Paires semblables trouvées dans la fenêtre, concordantes ou non. */
  candidates: number;
}

/**
 * Décalage d'horloge de l'appareil B par rapport à A, d'après les photos de
 * la même scène (phash à distance ≤ 12) prises à moins de `fenetreHeures`
 * selon les deux horloges. Chaque photo de B est appariée à la photo de A la
 * plus semblable ; les écarts concordants (à 5 min près) l'emportent sur les
 * ressemblances de hasard, et leur médiane, arrondie à la minute, donne le
 * décalage. Pour une horloge en retard d'un jour, élargir la fenêtre.
 */
export function mesurerDecalage(a: PhotoHorloge[], b: PhotoHorloge[], o: { fenetreHeures?: number; distance?: number } = {}): MesureDecalage | null {
  const fenetre = (o.fenetreHeures ?? 3) * 3600;
  const seuil = o.distance ?? 12;
  const valide = (h?: string): h is string => !!h && /^[0-9a-f]{16}$/i.test(h);
  const A = a.map((p) => ({ s: secondes(p.date), h: p.phash })).filter((p): p is { s: number; h: string } => p.s !== null && valide(p.h));
  const ecarts: number[] = [];
  for (const p of b) {
    const s = secondes(p.date);
    if (s === null || !valide(p.phash)) continue;
    let meilleure: { d: number; ecart: number } | null = null;
    for (const q of A) {
      const ecart = q.s - s;
      if (Math.abs(ecart) > fenetre) continue;
      const d = distanceHamming(q.h, p.phash);
      if (d <= seuil && (!meilleure || d < meilleure.d || (d === meilleure.d && Math.abs(ecart) < Math.abs(meilleure.ecart)))) meilleure = { d, ecart };
    }
    if (meilleure) ecarts.push(meilleure.ecart);
  }
  if (!ecarts.length) return null;
  // L'écart qui a le plus de voisins à 5 min près, puis la médiane de ces voisins.
  const voisins = (e: number) => ecarts.filter((x) => Math.abs(x - e) <= 300);
  const centre = ecarts.reduce((meilleur, e) => (voisins(e).length > voisins(meilleur).length ? e : meilleur), ecarts[0]);
  const groupe = voisins(centre).sort((x, y) => x - y);
  const milieu = groupe.length % 2 ? groupe[(groupe.length - 1) / 2] : (groupe[groupe.length / 2 - 1] + groupe[groupe.length / 2]) / 2;
  const minutes = Math.round(milieu / 60);
  return { decalage: texteDecalage(minutes), minutes, paires: groupe.length, candidates: ecarts.length };
}
