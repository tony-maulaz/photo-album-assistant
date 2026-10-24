// Noms de dossiers et noms de lieux (scripts 01 et 05).

/** Nom ASCII sans espaces ni caractères spéciaux (`sanitize` du script 01), ou chaîne vide. */
export function nomAscii(nom: string): string {
  return nom
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .replace(/[^\w\- ]/g, '')
    .trim()
    .replace(/ /g, '_');
}

/**
 * Un nom de lieu est utilisable s'il reste des lettres après passage en ASCII.
 * Nominatim répond dans la langue locale : un nom thaï est vidé entièrement
 * (incident I3), il faut alors redemander en anglais.
 */
export function nomUtilisable(nom: unknown): nom is string {
  return typeof nom === 'string' && /[A-Za-z]/.test(nomAscii(nom));
}

/** Clés d'adresse Nominatim, de la plus précise à la plus large (script 01). */
export const CLES_PRECISES = ['village', 'town', 'city', 'hamlet', 'municipality', 'suburb', 'county', 'district'];
export const CLES_LARGES = ['state_district', 'province', 'state', 'region', 'country'];

/**
 * Adresse courte d'une réponse Nominatim précise (zoom 18), pour reconnaître un
 * lieu : nom de l'endroit s'il en a un, rue et numéro, localité
 * (« Collège des Tilleuls, 12 Rue du Lac, Annecy »), ou `null`.
 */
export function adresseCourte(reponse: { name?: unknown; address?: Record<string, unknown> }): string | null {
  const texte = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const a = reponse.address ?? {};
  const rue = ['road', 'pedestrian', 'footway', 'path', 'square'].map((k) => texte(a[k])).find(Boolean) ?? null;
  const numero = texte(a.house_number);
  const localite = ['village', 'town', 'city', 'hamlet', 'municipality', 'suburb'].map((k) => texte(a[k])).find(Boolean) ?? null;
  const parties = [texte(reponse.name), rue && numero ? `${numero} ${rue}` : rue, localite].filter((p): p is string => !!p);
  // Le nom de l'endroit est souvent celui de la rue ou de la localité : pas de répétition.
  const uniques = parties.filter((p, i) => !parties.slice(0, i).some((q) => q.toLowerCase() === p.toLowerCase()));
  return uniques.length ? uniques.join(', ') : null;
}

/** Identifiant d'un nouveau lieu connu, d'après son nom, différent de ceux déjà pris. */
export function nouvelIdLieu(nom: string, pris: string[]): string {
  const base = nomAscii(nom).toLowerCase() || 'lieu';
  let id = base;
  for (let n = 2; pris.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** Nom le plus précis utilisable d'une adresse Nominatim, et s'il est précis ou large. */
export function nomDepuisAdresse(adresse: Record<string, unknown>): { nom: string; precis: boolean } | null {
  for (const cle of CLES_PRECISES) if (nomUtilisable(adresse[cle])) return { nom: adresse[cle] as string, precis: true };
  for (const cle of CLES_LARGES) if (nomUtilisable(adresse[cle])) return { nom: adresse[cle] as string, precis: false };
  return null;
}

// ---------------------------------------------------------------------------
// Noms de fichiers et de dossiers dans la sortie
// ---------------------------------------------------------------------------

/**
 * Clé de comparaison d'un nom : Windows ne distingue pas majuscules et
 * minuscules, et macOS écrit les accents décomposés (NFD).
 */
export function cleNom(nom: string): string {
  return nom.normalize('NFC').toLowerCase();
}

const RESERVES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Message d'erreur si le nom ne peut pas servir de nom de dossier (Windows compris), sinon `null`. */
export function verifierNomDossier(nom: string): string | null {
  if (!nom.trim()) return 'Le nom est vide.';
  if (nom.length > 120) return 'Le nom est trop long (120 caractères au plus).';
  const interdit = nom.match(/[<>:"/\\|?*\u0000-\u001f]/);
  if (interdit) return `Le caractère « ${interdit[0]} » n’est pas permis dans un nom de dossier.`;
  if (/[. ]$/.test(nom)) return 'Le nom ne peut pas finir par un point ou une espace.';
  if (nom === '.' || nom === '..' || RESERVES.test(nom)) return `« ${nom} » est un nom réservé par Windows.`;
  return null;
}

/** `nom` s'il est libre, sinon « base_2.ext », « base_3.ext »… (collisions, comme le script 05). */
export function nomLibre(nom: string, pris: Set<string>): string {
  if (!pris.has(cleNom(nom))) return nom;
  const i = nom.lastIndexOf('.');
  const base = i > 0 ? nom.slice(0, i) : nom;
  const ext = i > 0 ? nom.slice(i) : '';
  for (let n = 2; ; n++) {
    const candidat = `${base}_${n}${ext}`;
    if (!pris.has(cleNom(candidat))) return candidat;
  }
}
