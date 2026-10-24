// Coordonnées collées par l'utilisateur (lieux connus, SPEC § 8.3).

/**
 * Coordonnées collées : « 46.5, 6.6 », « 46.5 6.6 », « 46°30'N 6°36'E » non,
 * ou un lien Google Maps complet (…@46.5,6.6,15z…, …!3d46.5!4d6.6…, ?q=46.5,6.6,
 * ?ll=…, geo:46.5,6.6). Un lien court (maps.app.goo.gl) ne contient pas les
 * coordonnées : voir `lienCourt`.
 */
export function lireCoordonnees(texte: string): { lat: number; lon: number } | null {
  const n = '(-?\\d+(?:\\.\\d+)?)';
  const motifs = [
    new RegExp(`!3d${n}!4d${n}`),
    new RegExp(`@${n},${n}`),
    new RegExp(`[?&](?:q|ll|query|center|destination)=${n}(?:,|%2C)\\s*${n}`),
    new RegExp(`geo:${n},${n}`),
    new RegExp(`^\\s*${n}\\s*[,; ]\\s*${n}\\s*$`),
  ];
  for (const motif of motifs) {
    const m = texte.match(motif);
    if (!m) continue;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon };
  }
  return null;
}

/** Lien court de Google Maps (maps.app.goo.gl, goo.gl/maps) : il faut l'ouvrir pour lire les coordonnées. */
export function lienCourt(texte: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(texte);
}
