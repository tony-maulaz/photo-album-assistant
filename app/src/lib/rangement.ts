// Calculs de l'étape « Lieux et sorties » (SPEC § 6.4) : quel dossier ouvrir,
// ce que montre un dossier fait seulement de sous-dossiers, les nouveautés
// d'une mise à jour de l'inventaire (D63), les repères de la ligne de temps.

import { enfants, estDescendant, RACINE, type FichierPlan, type Plan } from './plan';

const dansLaVue = (f: FichierPlan) => f.statut === 'archive' && f.categorie !== 'autre';

/**
 * Premier dossier qui contient directement des photos ou des vidéos, dans
 * l'ordre du panneau (par nom, chaque dossier suivi de ses sous-dossiers) ;
 * les dossiers techniques (« _videos_non_classees ») en dernier recours.
 * `null` s'il n'y en a aucun.
 */
export function premierDossierAvecPhotos(plan: Plan): string | null {
  const pleins = new Set<string>();
  for (const f of plan.fichiers.values()) if (dansLaVue(f)) pleins.add(f.dossier);
  let technique: string | null = null;
  const parcourir = (id: string, sousTechnique: boolean): string | null => {
    for (const e of enfants(plan, id)) {
      const tech = sousTechnique || e.nom.startsWith('_');
      if (pleins.has(e.id)) {
        if (!tech) return e.id;
        technique ??= e.id;
      }
      const trouve = parcourir(e.id, tech);
      if (trouve) return trouve;
    }
    return null;
  };
  return parcourir(RACINE, false) ?? technique;
}

/** Photos et vidéos des sous-dossiers d'un dossier (pas les siennes), par date : ce que montre un dossier fait seulement de sous-dossiers. */
export function fichiersSousDossiers(plan: Plan, id: string): FichierPlan[] {
  return [...plan.fichiers.values()]
    .filter((f) => dansLaVue(f) && f.dossier !== id && (id === RACINE || estDescendant(plan, f.dossier, id)))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id));
}

/**
 * Nouveautés d'une mise à jour de l'inventaire (D63) : pour chaque dossier,
 * le nombre de photos et vidéos ajoutées à la source après le premier tri et
 * pas encore écrites dans la sortie.
 */
export function dossiersNouveaux(plan: Plan, dansLaSortie: (id: string) => boolean): Map<string, number> {
  const n = new Map<string, number>();
  for (const f of plan.fichiers.values()) if (f.ajout && dansLaVue(f) && !dansLaSortie(f.id)) n.set(f.dossier, (n.get(f.dossier) ?? 0) + 1);
  return n;
}

/** Le jour suivant, « AAAA-MM-JJ ». */
export function lendemain(j: string): string {
  const d = new Date(`${j}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Dates écrites sous les colonnes de la ligne de temps (une colonne par jour
 * avec photos, « AAAA-MM-JJ », triées) : la première, chaque début de mois et
 * chaque saut de jours d'abord, puis une par semaine de colonnes, jamais à
 * moins de `ecart` colonnes l'une de l'autre (elles se chevauchaient :
 * « 28.0615.07 »). Un début de mois trop près d'une autre date glisse aux
 * jours suivants du même mois. « JJ.MM », avec l'année à la première et
 * quand elle change.
 */
export function etiquettesJours(colonnes: string[], ecart = 3, semaine = 7): Map<number, string> {
  const choisies: number[] = [];
  const libre = (i: number) => choisies.every((k) => Math.abs(k - i) >= ecart);
  const prioritaires: [number, number][] = [];
  colonnes.forEach((j, i) => {
    if (i === 0) prioritaires.push([0, i]);
    else if (colonnes[i - 1].slice(0, 7) !== j.slice(0, 7)) prioritaires.push([1, i]);
    else if (lendemain(colonnes[i - 1]) !== j) prioritaires.push([2, i]);
  });
  prioritaires.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [, i] of prioritaires) {
    let k = i;
    while (k < colonnes.length && !libre(k) && colonnes[k].slice(0, 7) === colonnes[i].slice(0, 7)) k++;
    if (k < colonnes.length && libre(k) && colonnes[k].slice(0, 7) === colonnes[i].slice(0, 7)) choisies.push(k);
  }
  choisies.sort((a, b) => a - b);
  // Entre deux repères éloignés, une date par semaine de colonnes.
  for (let i = 0, derniere = -Infinity; i < colonnes.length; i++) {
    if (choisies.includes(i)) derniere = i;
    else if (i - derniere >= semaine && libre(i)) {
      choisies.push(i);
      derniere = i;
    }
  }
  choisies.sort((a, b) => a - b);
  const textes = new Map<number, string>();
  let annee = '';
  for (const i of choisies) {
    const j = colonnes[i];
    textes.set(i, `${j.slice(8, 10)}.${j.slice(5, 7)}${j.slice(0, 4) !== annee ? `.${j.slice(2, 4)}` : ''}`);
    annee = j.slice(0, 4);
  }
  return textes;
}

/**
 * Rangées des événements du calendrier dans la ligne de temps : chacun
 * occupe de `debut` à `fin` (en pixels, son nom compris) ; deux événements
 * d'une même rangée ne se touchent pas. Rend la rangée de chacun, dans l'ordre reçu.
 */
export function rangsEvenements(places: { debut: number; fin: number }[], marge = 6): number[] {
  const finsRangees: number[] = [];
  const rangs = new Array<number>(places.length);
  const ordre = places.map((_, i) => i).sort((a, b) => places[a].debut - places[b].debut || a - b);
  for (const i of ordre) {
    let r = finsRangees.findIndex((fin) => fin + marge <= places[i].debut);
    if (r < 0) r = finsRangees.push(0) - 1;
    finsRangees[r] = places[i].fin;
    rangs[i] = r;
  }
  return rangs;
}
