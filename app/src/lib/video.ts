// Métadonnées internes des vidéos MP4 / MOV : date de création (boîte `mvhd`,
// en temps universel) et position GPS (boîte `©xyz` des téléphones Samsung).

/** Lit `longueur` octets à partir de `debut` (Blob.slice dans le navigateur, fichier sous Node). */
export type LecteurOctets = (debut: number, longueur: number) => Promise<Uint8Array>;

export interface InfosVideo {
  /** Date de création en temps universel, ou `null` si absente (valeur 0). */
  dateUTC: Date | null;
  dureeSecondes: number | null;
  gps: { lat: number; lon: number } | null;
}

/** Secondes entre le 1er janvier 1904 (origine MP4) et le 1er janvier 1970. */
const DECALAGE_1904 = 2_082_844_800;
/** Taille maximale de la boîte `moov` lue en entier (quelques centaines de Ko en pratique). */
const MOOV_MAX = 64 * 1024 * 1024;

function type4(o: Uint8Array, i: number): string {
  return String.fromCharCode(o[i], o[i + 1], o[i + 2], o[i + 3]);
}

function u32(o: Uint8Array, i: number): number {
  return ((o[i] << 24) >>> 0) + (o[i + 1] << 16) + (o[i + 2] << 8) + o[i + 3];
}

function u64(o: Uint8Array, i: number): number {
  return u32(o, i) * 2 ** 32 + u32(o, i + 4);
}

interface Boite {
  type: string;
  debut: number; // début du contenu
  fin: number;
}

/** Boîtes filles contenues dans `o[debut, fin)`. */
function boites(o: Uint8Array, debut: number, fin: number): Boite[] {
  const liste: Boite[] = [];
  let i = debut;
  while (i + 8 <= fin) {
    let taille = u32(o, i);
    const type = type4(o, i + 4);
    let entete = 8;
    if (taille === 1 && i + 16 <= fin) {
      taille = u64(o, i + 8);
      entete = 16;
    } else if (taille === 0) {
      taille = fin - i;
    }
    if (taille < entete || i + taille > fin) break;
    liste.push({ type, debut: i + entete, fin: i + taille });
    i += taille;
  }
  return liste;
}

/** « +48.8584+002.2945/ » ou « +48.8584+002.2945+512.3/ » (ISO 6709). */
export function lireIso6709(texte: string): { lat: number; lon: number } | null {
  const m = texte.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  return { lat, lon };
}

function lireMoov(o: Uint8Array): InfosVideo {
  const infos: InfosVideo = { dateUTC: null, dureeSecondes: null, gps: null };
  for (const b of boites(o, 0, o.length)) {
    if (b.type === 'mvhd' && b.fin - b.debut >= 20) {
      const version = o[b.debut];
      let creation: number;
      let echelle: number;
      let duree: number;
      if (version === 1) {
        creation = u64(o, b.debut + 4);
        echelle = u32(o, b.debut + 20);
        duree = u64(o, b.debut + 24);
      } else {
        creation = u32(o, b.debut + 4);
        echelle = u32(o, b.debut + 12);
        duree = u32(o, b.debut + 16);
      }
      if (creation > DECALAGE_1904) infos.dateUTC = new Date((creation - DECALAGE_1904) * 1000);
      if (echelle > 0) infos.dureeSecondes = duree / echelle;
    } else if (b.type === 'udta') {
      for (const u of boites(o, b.debut, b.fin)) {
        if (u.type === '©xyz' && u.fin - u.debut > 4) {
          const longueur = (o[u.debut] << 8) + o[u.debut + 1];
          const texte = new TextDecoder().decode(o.subarray(u.debut + 4, Math.min(u.debut + 4 + longueur, u.fin)));
          infos.gps = lireIso6709(texte);
        }
      }
    }
  }
  return infos;
}

/** Parcourt les boîtes de premier niveau (la boîte `moov` est souvent à la fin chez Samsung). */
export async function lireInfosVideo(lire: LecteurOctets, taille: number): Promise<InfosVideo | null> {
  let i = 0;
  while (i + 8 <= taille) {
    const entete = await lire(i, 16);
    let tailleBoite = u32(entete, 0);
    const type = type4(entete, 4);
    let longueurEntete = 8;
    if (tailleBoite === 1) {
      tailleBoite = u64(entete, 8);
      longueurEntete = 16;
    } else if (tailleBoite === 0) {
      tailleBoite = taille - i;
    }
    if (tailleBoite < longueurEntete) return null;
    if (type === 'moov') {
      const longueur = tailleBoite - longueurEntete;
      if (longueur > MOOV_MAX) return null;
      return lireMoov(await lire(i + longueurEntete, longueur));
    }
    i += tailleBoite;
  }
  return null;
}
