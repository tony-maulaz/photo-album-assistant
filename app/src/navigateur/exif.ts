// Lecture EXIF (date, appareil, GPS, orientation) avec exifr.

import exifr from 'exifr';

export interface ExifPhoto {
  date?: string; // « AAAA:MM:JJ HH:MM:SS » tel qu'écrit par l'appareil
  decalage?: string; // fuseau horaire (OffsetTimeOriginal), ex. « +07:00 »
  marque?: string;
  modele?: string;
  lat?: number;
  lon?: number;
  orientation?: number;
  largeur?: number;
  hauteur?: number;
}

const OPTIONS = {
  tiff: true,
  exif: true,
  gps: true,
  ifd1: false,
  interop: false,
  xmp: false,
  icc: false,
  iptc: false,
  jfif: false,
  makerNote: false,
  userComment: false,
  // Valeurs brutes : la date reste « AAAA:MM:JJ HH:MM:SS », sans fuseau imposé.
  translateValues: false,
  reviveValues: false,
  pick: [
    'DateTimeOriginal',
    'CreateDate',
    'OffsetTimeOriginal',
    'Make',
    'Model',
    'Orientation',
    'ExifImageWidth',
    'ExifImageHeight',
    'GPSLatitude',
    'GPSLatitudeRef',
    'GPSLongitude',
    'GPSLongitudeRef',
  ],
};

/** EXIF utile d'une photo, ou `null` si le fichier n'en contient pas. */
export async function lireExif(fichier: Blob): Promise<ExifPhoto | null> {
  const e = await exifr.parse(fichier, OPTIONS);
  if (!e) return null;
  const date = (e.DateTimeOriginal ?? e.CreateDate) as string | undefined;
  return {
    date: typeof date === 'string' ? date : undefined,
    decalage: typeof e.OffsetTimeOriginal === 'string' ? e.OffsetTimeOriginal : undefined,
    marque: e.Make,
    modele: e.Model,
    lat: typeof e.latitude === 'number' ? e.latitude : undefined,
    lon: typeof e.longitude === 'number' ? e.longitude : undefined,
    orientation: e.Orientation,
    largeur: e.ExifImageWidth,
    hauteur: e.ExifImageHeight,
  };
}
