// Inventaire de la source : tous les fichiers, leur taille et leur date,
// l'EXIF des photos et les métadonnées des vidéos (SPEC § 6.2).

import { categorie } from '../lib/fichiers';
import { dimensionsJpeg } from '../lib/jpeg';
import type { ElementSource } from '../lib/source';
import { lireInfosVideo } from '../lib/video';
import { lecteurBlob, parcourir } from './dossiers';
import { lireExif } from './exif';
import { enParallele } from './workers';

export interface Progression {
  etape: 'parcours' | 'tailles' | 'exif' | 'videos';
  faits: number;
  total: number;
}

export interface Inventaire {
  elements: ElementSource[];
  dossiers: number;
  dureeMs: number;
}

export async function inventorier(
  source: FileSystemDirectoryHandle,
  progres: (p: Progression) => void,
  arreter: () => boolean = () => false,
): Promise<Inventaire> {
  const debut = performance.now();
  const entrees: { chemin: string; poignee: FileSystemFileHandle }[] = [];
  let dossiers = 0;
  for await (const e of parcourir(source, () => dossiers++)) {
    entrees.push({ chemin: e.chemin, poignee: e.fichier });
    if (entrees.length % 250 === 0) progres({ etape: 'parcours', faits: entrees.length, total: 0 });
    if (arreter()) throw new DOMException('Inventaire arrêté', 'AbortError');
  }

  let faits = 0;
  const avecFichier = await enParallele(entrees, 16, async (e) => {
    const fichier = await e.poignee.getFile();
    if (++faits % 250 === 0) progres({ etape: 'tailles', faits, total: entrees.length });
    return { e, fichier };
  });
  const elements: ElementSource[] = avecFichier.map(({ e, fichier }) => ({
    chemin: e.chemin,
    taille: fichier.size,
    modifie: fichier.lastModified,
    categorie: categorie(e.chemin),
  }));

  const photos = avecFichier.map((x, i) => ({ ...x, i })).filter((x) => elements[x.i].categorie === 'photo');
  faits = 0;
  await enParallele(photos, 8, async ({ e, fichier, i }) => {
    if (arreter()) throw new DOMException('Inventaire arrêté', 'AbortError');
    try {
      const exif = await lireExif(fichier);
      elements[i].exif = exif
        ? { date: exif.date, decalage: exif.decalage, modele: exif.modele, marque: exif.marque, lat: exif.lat, lon: exif.lon, largeur: exif.largeur, hauteur: exif.hauteur }
        : null;
      // Sans dimensions EXIF (capture d'écran, WhatsApp) : on les lit dans l'en-tête JPEG.
      if (!exif?.largeur && /\.jpe?g$/i.test(e.chemin)) {
        const d = await dimensionsJpeg(lecteurBlob(fichier), fichier.size);
        if (d) elements[i].dims = { l: d.largeur, h: d.hauteur };
      }
    } catch {
      elements[i].exif = null;
    }
    if (++faits % 100 === 0) progres({ etape: 'exif', faits, total: photos.length });
  });

  const videos = avecFichier.map((x, i) => ({ ...x, i })).filter((x) => elements[x.i].categorie === 'video');
  faits = 0;
  await enParallele(videos, 4, async ({ fichier, i }) => {
    if (arreter()) throw new DOMException('Inventaire arrêté', 'AbortError');
    try {
      const infos = await lireInfosVideo(lecteurBlob(fichier), fichier.size);
      elements[i].video = infos ? { dateUTC: infos.dateUTC, dureeSecondes: infos.dureeSecondes, gps: infos.gps } : null;
    } catch {
      elements[i].video = null;
    }
    if (++faits % 20 === 0) progres({ etape: 'videos', faits, total: videos.length });
  });

  return { elements, dossiers, dureeMs: performance.now() - debut };
}
