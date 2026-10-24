// Recherche en langage naturel (SPEC § 6.9) : « les enfants sur un éléphant »,
// « coucher de soleil sur la plage ». Locale et gratuite : elle cherche dans
// les descriptions et étiquettes déjà produites par l'IA8, sans nouvel appel.

/** Mots sans contenu, ignorés dans la requête. */
const VIDES = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'au', 'aux', 'a', 'et', 'ou', 'en', 'sur', 'sous', 'dans', 'avec', 'pour', 'par', 'chez',
  'ce', 'cet', 'cette', 'ces', 'qui', 'que', 'quand', 'son', 'sa', 'ses', 'leur', 'leurs', 'mon', 'ma', 'mes', 'nos', 'notre', 'est', 'sont',
  'photo', 'photos', 'image', 'images', 'montre', 'montrant', 'voir', 'trouve', 'cherche',
]);

/** Expressions de plusieurs mots ramenées à un seul terme. */
const EXPRESSIONS: [RegExp, string][] = [
  [/\b(coucher|couchers) de soleil\b|\bsoleil couchant\b|\bcrepuscule\b/g, 'couchersoleil'],
  [/\b(lever|levers) de soleil\b|\bsoleil levant\b|\baube\b/g, 'leversoleil'],
  [/\bbord de (la )?mer\b|\bbord de l ocean\b/g, 'mer'],
  [/\bpique[ -]nique\b/g, 'piquenique'],
  [/\bfeu d artifice\b|\bfeux d artifice\b/g, 'artifice'],
  [/\bphoto de groupe\b/g, 'groupe'],
];

/** Termes équivalents (au singulier, sans accents). */
const SYNONYMES: string[][] = [
  ['enfant', 'gamin', 'gamine', 'fillette', 'garcon', 'fils', 'bebe', 'ado', 'adolescent', 'fille'],
  ['plage', 'mer', 'sable', 'ocean', 'baignade', 'vague'],
  ['couchersoleil', 'couchant'],
  ['montagne', 'sommet', 'alpe', 'pic', 'col'],
  ['repas', 'diner', 'dejeuner', 'souper', 'restaurant', 'table', 'piquenique', 'manger'],
  ['bateau', 'barque', 'voilier', 'kayak', 'pirogue', 'ferry', 'navire'],
  ['velo', 'bicyclette', 'vtt'],
  ['voiture', 'auto'],
  ['piscine', 'bassin'],
  ['neige', 'ski', 'piste'],
  ['foret', 'bois', 'jungle'],
  ['riviere', 'fleuve', 'cascade', 'chute'],
  ['chien', 'chiot'],
  ['chat', 'chaton'],
  ['anniversaire', 'gateau', 'bougie'],
];

/** Termes génériques : la requête « animal » trouve un chien, pas l'inverse. */
const GENERIQUES: Record<string, string[]> = {
  animal: ['chien', 'chiot', 'chat', 'chaton', 'cheval', 'oiseau', 'elephant', 'singe', 'vache', 'poisson', 'tortue', 'mouton', 'chevre', 'lapin', 'poule', 'canard'],
  monument: ['temple', 'pagode', 'eglise', 'cathedrale', 'chateau', 'statue', 'pont', 'tour', 'palais', 'ruine'],
  famille: ['enfant', 'parent', 'groupe', 'mere', 'pere', 'grand'],
  eau: ['mer', 'lac', 'riviere', 'piscine', 'plage', 'cascade'],
};

/** Singulier approximatif : chevaux → cheval, bateaux → bateau, enfants → enfant. */
export function singulier(mot: string): string {
  if (mot.length > 4 && mot.endsWith('eaux')) return mot.slice(0, -1);
  if (mot.length > 4 && mot.endsWith('aux')) return `${mot.slice(0, -3)}al`;
  if (mot.length > 3 && (mot.endsWith('s') || mot.endsWith('x')) && !mot.endsWith('ss')) return mot.slice(0, -1);
  return mot;
}

/** Mots d'un texte : minuscules, sans accents, expressions regroupées. */
function mots(texte: string): string[] {
  let t = texte
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
  for (const [motif, terme] of EXPRESSIONS) t = t.replace(motif, ` ${terme} `);
  return t.split(' ').filter(Boolean);
}

/** Termes d'un texte, au singulier. */
export function termes(texte: string): string[] {
  return mots(texte).map(singulier);
}

const EQUIVALENTS = new Map<string, Set<string>>();
for (const groupe of SYNONYMES.map((g) => g.map(singulier))) {
  for (const m of groupe) EQUIVALENTS.set(m, new Set([...(EQUIVALENTS.get(m) ?? []), ...groupe.filter((x) => x !== m)]));
}
const PRECIS = new Map(Object.entries(GENERIQUES).map(([g, liste]) => [singulier(g), liste.map(singulier)]));

export interface DocumentRecherche {
  id: string;
  /** Description et étiquettes de la photo (voir `texteEtiquettes`). */
  texte: string;
}

export interface ResultatRecherche {
  id: string;
  score: number;
  /** Tous les mots de la requête ont été trouvés. */
  complet: boolean;
  /** Mots de la requête trouvés (tels que normalisés). */
  trouves: string[];
}

/**
 * Photos correspondant à la requête, les plus pertinentes d'abord : d'abord
 * celles qui contiennent tous les mots, puis par score (mot exact 1, synonyme
 * 0,7, terme plus précis qu'un mot générique 0,5).
 */
export function rechercher(requete: string, documents: DocumentRecherche[]): ResultatRecherche[] {
  const demandes = [...new Set(mots(requete).filter((m) => !VIDES.has(m) && m.length > 1).map(singulier))];
  if (!demandes.length) return [];
  const resultats: ResultatRecherche[] = [];
  for (const d of documents) {
    const presents = new Set(termes(d.texte));
    let score = 0;
    const trouves: string[] = [];
    for (const m of demandes) {
      let poids = 0;
      if (presents.has(m)) poids = 1;
      else if ([...(EQUIVALENTS.get(m) ?? [])].some((x) => presents.has(x))) poids = 0.7;
      else if ((PRECIS.get(m) ?? []).some((x) => presents.has(x))) poids = 0.5;
      if (poids) {
        score += poids;
        trouves.push(m);
      }
    }
    if (score > 0) resultats.push({ id: d.id, score: Math.round(score * 100) / 100, complet: trouves.length === demandes.length, trouves });
  }
  return resultats.sort((a, b) => Number(b.complet) - Number(a.complet) || b.score - a.score || a.id.localeCompare(b.id));
}
