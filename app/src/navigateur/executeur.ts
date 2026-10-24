// Exécution des demandes IA des modules d'organisation (`RequeteIA`) et de
// sélection et d'album (`DemandeIA`) : fabrication des images (photos à
// l'endroit, planches), puis appel par le service IA (cache, budget, coûts).

import type { DemandeIA } from '../lib/aidesSelection';
import { estimerDemandes } from '../lib/aidesSelection';
import { t } from '../lib/langue';
import type { BlocContenu, RequeteIA } from '../lib/nommage';
import type { FichierPlan, Plan } from '../lib/plan';
import { modele as infoModele } from '../lib/tarifs';
import { imageBase64 } from './claude';
import type { AccesDossier } from './dossiers';
import type { ServiceIA } from './ia';
import { cleMiniature, type Miniatures } from './miniatures';
import { enBase64, fabriquerPlanche } from './planches';

/** Hauteur des miniatures du cache : au-delà, les vignettes partent des originaux. */
const COTE_MINIATURE = 256;

export interface ContexteExecution {
  plan: Plan;
  source: AccesDossier;
  ia: ServiceIA;
  miniatures: Miniatures;
}

function fichier(c: ContexteExecution, id: string): FichierPlan {
  const f = c.plan.fichiers.get(id);
  if (!f) throw new Error(t`Photo inconnue : ${id}`);
  return f;
}

async function vignetteSource(c: ContexteExecution, id: string, cellule: number): Promise<Blob> {
  const f = fichier(c, id);
  if (cellule <= COTE_MINIATURE) {
    const url = await c.miniatures.url(cleMiniature(f.id, f.taille, f.modifie), () => c.source.fichier(f.id));
    if (url) return (await fetch(url)).blob();
  }
  return c.source.fichier(f.id);
}

/** Image de remplacement d'une photo que le navigateur ne sait pas décoder (HEIC, TIFF, fichier abîmé). */
async function remplacement(nom: string): Promise<string> {
  const canevas = new OffscreenCanvas(512, 384);
  const ctx = canevas.getContext('2d')!;
  ctx.fillStyle = 'rgb(90,90,90)';
  ctx.fillRect(0, 0, 512, 384);
  ctx.fillStyle = 'rgb(255,255,255)';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('photo illisible', 40, 180);
  ctx.font = '18px sans-serif';
  ctx.fillText(nom.slice(0, 40), 40, 220);
  return enBase64(await canevas.convertToBlob({ type: 'image/jpeg', quality: 0.8 }));
}

/**
 * Une photo à l'endroit, réduite à `cote` px. Si elle ne peut pas être
 * décodée, une image « photo illisible » prend sa place : les autres photos
 * de la demande restent traitées.
 */
async function photo(c: ContexteExecution, id: string, cote: number): Promise<string> {
  const f = fichier(c, id);
  try {
    return (await imageBase64(await c.source.fichier(f.id), cote)).donnees;
  } catch {
    return remplacement(f.nom);
  }
}

async function planche(c: ContexteExecution, ids: string[], o: { cellule: number; colonnes: number; marge?: number; qualite?: number; numeros?: (number | string)[] | null; flous?: (number | string)[]; etiquettes?: Record<string | number, string> }) {
  const etiquettes = o.etiquettes ? new Map(Object.entries(o.etiquettes).map(([k, v]) => [String(k), v])) : undefined;
  const blob = await fabriquerPlanche(
    ids.map((id) => () => vignetteSource(c, id, o.cellule)),
    o.numeros ?? null,
    new Set((o.flous ?? []).map(String)),
    { cellule: o.cellule, colonnes: o.colonnes, marge: o.marge, qualite: o.qualite, etiquettes },
  );
  return enBase64(blob);
}

/** Demande d'un module d'organisation (IA1 à IA6) : contenu ordonné, outils fournis. */
export async function executerRequete(c: ContexteExecution, r: RequeteIA, modele: string): Promise<unknown | null> {
  if (r.cle && c.ia.enCache(r.cle)) return c.ia.appeler({ fonction: r.fonction, modele, systeme: r.systeme, consigne: '', cle: r.cle, estimationUSD: 0 });
  const blocs: ({ type: 'texte'; texte: string } | { type: 'image'; donnees: string })[] = [];
  for (const b of r.contenu as BlocContenu[]) {
    if (b.type === 'texte') blocs.push({ type: 'texte', texte: b.texte });
    else if (b.type === 'photo') blocs.push({ type: 'image', donnees: await photo(c, b.id, b.cote) });
    else blocs.push({ type: 'image', donnees: await planche(c, b.ids, b) });
  }
  return c.ia.appeler({
    fonction: r.fonction,
    modele,
    systeme: r.systeme,
    blocs,
    consigne: '',
    cle: r.cle,
    estimationUSD: r.estimationUSD,
    schema: r.schema,
    effort: r.effort,
    maxTokens: r.maxTokens,
    outils: r.outils ?? undefined,
  });
}

/** Demande d'un module de sélection ou d'album (IA8 à IA15) : images annoncées par leur libellé, puis la consigne. */
export async function executerDemande(c: ContexteExecution, d: DemandeIA, modele: string): Promise<unknown | null> {
  const cle = `${d.fonction}|${modele}|${d.cle}`;
  const m = infoModele(modele);
  const estimation = m ? estimerDemandes([d], m).usd : 0;
  if (c.ia.enCache(cle)) return c.ia.appeler({ fonction: d.fonction, modele, systeme: d.systeme, consigne: '', cle, estimationUSD: 0 });
  const blocs: ({ type: 'texte'; texte: string } | { type: 'image'; donnees: string })[] = [];
  for (const im of d.images) {
    blocs.push({ type: 'texte', texte: im.libelle });
    blocs.push({ type: 'image', donnees: im.type === 'photo' ? await photo(c, im.id, im.cote) : await planche(c, im.ids, im) });
  }
  return c.ia.appeler({
    fonction: d.fonction,
    modele,
    systeme: d.systeme,
    blocs,
    consigne: d.consigne,
    cle,
    estimationUSD: estimation,
    schema: d.schema,
    effort: d.effort,
    maxTokens: d.maxTokens,
    rechercheWeb: d.rechercheWeb || undefined,
  });
}
