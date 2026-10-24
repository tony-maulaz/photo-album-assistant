// Mise en forme des nombres, tailles, durées et dates pour l'affichage, dans la
// langue de l'interface.

import { langue, t } from '../lib/langue';

const nf = (d: number) => new Intl.NumberFormat(langue() === 'en' ? 'en-GB' : 'fr-CH', { maximumFractionDigits: d, minimumFractionDigits: d });

export function nombre(n: number, decimales = 0): string {
  return nf(decimales).format(n);
}

/** Montant en CHF sans l'unité : « 50 », « 0,45 » (deux décimales seulement s'il en a). */
export function montantChf(n: number): string {
  return nombre(n, Number.isInteger(n) ? 0 : 2);
}

/**
 * « 3 photos », « 1 photo », « 0 photo » ; les deux formes sont traduites
 * (en anglais : « 0 photos »). Sans forme plurielle, c'est le singulier suivi
 * de « s », à traduire lui aussi.
 */
export function pluriel(n: number, singulier: string, plurielTexte = `${singulier}s`): string {
  const un = langue() === 'en' ? n === 1 : n <= 1;
  return `${nombre(n)} ${t(un ? singulier : plurielTexte)}`;
}

export function taille(octets: number): string {
  const unites = langue() === 'en' ? ['B', 'KB', 'MB', 'GB', 'TB'] : ['o', 'Ko', 'Mo', 'Go', 'To'];
  let v = octets;
  let i = 0;
  while (v >= 1024 && i < unites.length - 1) {
    v /= 1024;
    i++;
  }
  return `${nombre(v, i === 0 ? 0 : 1)} ${unites[i]}`;
}

export function duree(ms: number): string {
  if (ms < 1000) return `${nombre(ms)} ms`;
  if (ms < 60_000) return `${nombre(ms / 1000, 1)} s`;
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')} s`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** « 27.06.25 » depuis « 2025-06-27… ». */
export function jourCourt(d?: string): string {
  if (!d) return '';
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}`;
}

/** « 27.06 – 29.06.25 », « 24.07.25 » ou « 28.12.24 – 02.01.25 ». */
export function periode(du?: string, au?: string): string {
  if (!du || !au) return '';
  if (du === au) return jourCourt(du);
  if (du.slice(0, 4) === au.slice(0, 4)) return `${du.slice(8, 10)}.${du.slice(5, 7)} – ${jourCourt(au)}`;
  return `${jourCourt(du)} – ${jourCourt(au)}`;
}

/** « 27.06.2025 à 10:10 » depuis « 2025-06-27T10:10:10 ». */
export function dateHeure(d?: string): string {
  if (!d) return t`date inconnue`;
  const jour = `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  return d.length > 10 ? t`${jour} à ${d.slice(11, 16)}` : jour;
}
