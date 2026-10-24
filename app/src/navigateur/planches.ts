// Planches-contact envoyées à l'IA (script 06, `fabriquer_planche`) : vignettes
// à l'endroit (I14), numéro en jaune sur fond noir, marque [flou?] et heure.

export interface OptionsPlanche {
  cellule: number;
  colonnes: number;
  /** Espace entre les vignettes (6 px pour le script 06). */
  marge?: number;
  /** Qualité JPEG (0,78 pour le script 06). */
  qualite?: number;
  /** Texte ajouté après le numéro (l'heure, pour la vérification), par numéro écrit en texte. */
  etiquettes?: Map<string, string>;
}

/** Image réduite pour tenir dans `cote` × `cote`, sans jamais l'agrandir (comme `thumbnail` de Pillow). */
async function vignette(source: Blob, cote: number): Promise<ImageBitmap | null> {
  try {
    const brute = await createImageBitmap(source, { imageOrientation: 'from-image' });
    const e = Math.min(1, cote / Math.max(brute.width, brute.height));
    if (e === 1) return brute;
    const largeur = Math.max(1, Math.round(brute.width * e));
    const hauteur = Math.max(1, Math.round(brute.height * e));
    brute.close();
    return await createImageBitmap(source, { imageOrientation: 'from-image', resizeWidth: largeur, resizeHeight: hauteur, resizeQuality: 'high' });
  } catch {
    return null;
  }
}

export async function enBase64(blob: Blob): Promise<string> {
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

/**
 * Planche en JPEG : `images` fournit chaque photo (l'original, ou une
 * miniature assez grande pour la cellule). Sans `numeros`, pas de pastille
 * (planches du script 05).
 */
export async function fabriquerPlanche(images: (() => Promise<Blob>)[], numeros: (number | string)[] | null, flous: Set<string>, o: OptionsPlanche): Promise<Blob> {
  const MARGE = o.marge ?? 6;
  const lignes = Math.ceil(images.length / o.colonnes);
  const largeur = o.colonnes * o.cellule + (o.colonnes + 1) * MARGE;
  const hauteur = lignes * o.cellule + (lignes + 1) * MARGE;
  const canevas = new OffscreenCanvas(largeur, hauteur);
  const ctx = canevas.getContext('2d')!;
  ctx.fillStyle = 'rgb(24,24,24)';
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.font = 'bold 34px "DejaVu Sans", Verdana, Arial, sans-serif';
  ctx.textBaseline = 'top';
  const bitmaps = await Promise.all(images.map(async (obtenir) => vignette(await obtenir().catch(() => new Blob()), o.cellule)));
  bitmaps.forEach((bmp, i) => {
    const bx = MARGE + (i % o.colonnes) * (o.cellule + MARGE);
    const by = MARGE + Math.floor(i / o.colonnes) * (o.cellule + MARGE);
    if (bmp) {
      ctx.drawImage(bmp, bx + Math.floor((o.cellule - bmp.width) / 2), by + Math.floor((o.cellule - bmp.height) / 2));
      bmp.close();
    } else {
      ctx.fillStyle = 'rgb(60,60,60)';
      ctx.fillRect(bx, by, o.cellule, o.cellule);
    }
    if (!numeros) return;
    const n = String(numeros[i]);
    let badge = n;
    if (o.etiquettes?.has(n)) badge += `  ${o.etiquettes.get(n)}`;
    if (flous.has(n)) badge += '  [flou?]';
    const m = ctx.measureText(badge);
    const haut = m.actualBoundingBoxDescent || 34;
    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.fillRect(bx + 8 - 6, by + 4 - 3, m.width + 12, haut + 6);
    ctx.fillStyle = 'rgb(255,220,40)';
    ctx.fillText(badge, bx + 8, by + 4);
  });
  return canevas.convertToBlob({ type: 'image/jpeg', quality: o.qualite ?? 0.78 });
}
