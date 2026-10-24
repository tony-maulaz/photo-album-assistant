// Calendriers `.ics` (SPEC § 8.4) : événements de la famille, utilisés aux
// étapes « Lieux et sorties » (information), « Nommage » et « Album » (textes). Lecture tolérante
// (exports Google Agenda, Outlook, Apple) ; la sélection autour des dates et
// le texte injecté dans les consignes reprennent les scripts 03 et 04.

export interface EvenementCalendrier {
  titre: string;
  lieu?: string;
  description?: string;
  /** Heure locale : « AAAA-MM-JJ » (journée entière) ou « AAAA-MM-JJTHH:MM:SS ». */
  debut: string;
  /** Dernier jour inclus (journée entière) ou fin de l'événement (date-heure). */
  fin: string;
  journee: boolean;
  /** Occurrence d'un événement récurrent (RRULE). */
  recurrent: boolean;
}

export interface OptionsIcs {
  /** Développer les événements récurrents (anniversaires, cours…) ; ignorés sinon, comme dans les scripts. */
  inclureRecurrents: boolean;
  /** Période utile (« AAAA-MM-JJ ») : seuls les événements qui la chevauchent sont gardés. */
  du?: string;
  au?: string;
  /** Fuseau des heures données en temps universel (« …Z ») ; défaut : Europe/Zurich. */
  fuseau?: string;
}

/** Nombre maximal d'événements du calendrier cités dans une consigne (scripts 03 et 04). */
export const LIMITE_CALENDRIER = 12;
/** Garde-fou du développement des récurrences. */
const MAX_OCCURRENCES = 1000;

const deux = (n: number) => String(n).padStart(2, '0');
const quatre = (n: number) => String(n).padStart(4, '0');

// ---------------------------------------------------------------------------
// Jours : nombre de jours depuis le 1er janvier 1970, sans fuseau
// ---------------------------------------------------------------------------

function jourDepuis(texte: string): number {
  return Date.UTC(Number(texte.slice(0, 4)), Number(texte.slice(5, 7)) - 1, Number(texte.slice(8, 10))) / 86_400_000;
}

function texteJour(jour: number): string {
  const d = new Date(jour * 86_400_000);
  return `${quatre(d.getUTCFullYear())}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
}

/** Jour de la semaine, 0 = lundi. */
function jourSemaine(jour: number): number {
  return (new Date(jour * 86_400_000).getUTCDay() + 6) % 7;
}

/** Secondes depuis 1970 d'une date-heure locale « AAAA-MM-JJTHH:MM:SS », traitée comme une horloge sans fuseau. */
function secondes(texte: string): number {
  const h = texte.length > 10 ? texte.slice(11) : '00:00:00';
  return jourDepuis(texte) * 86_400 + Number(h.slice(0, 2)) * 3600 + Number(h.slice(3, 5)) * 60 + Number(h.slice(6, 8) || 0);
}

function texteSecondes(s: number): string {
  const jour = Math.floor(s / 86_400);
  const r = s - jour * 86_400;
  return `${texteJour(jour)}T${deux(Math.floor(r / 3600))}:${deux(Math.floor((r % 3600) / 60))}:${deux(r % 60)}`;
}

// ---------------------------------------------------------------------------
// Lecture des lignes
// ---------------------------------------------------------------------------

interface Propriete {
  nom: string;
  params: Record<string, string>;
  valeur: string;
}

/** « NOM;PARAM=x;PARAM2="a:b":valeur » ; les deux-points entre guillemets ne coupent pas. */
function lireLigne(ligne: string): Propriete | null {
  let guillemets = false;
  let fin = -1;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') guillemets = !guillemets;
    else if (c === ':' && !guillemets) {
      fin = i;
      break;
    }
  }
  if (fin < 0) return null;
  const tete = ligne.slice(0, fin).split(';');
  const params: Record<string, string> = {};
  for (const p of tete.slice(1)) {
    const i = p.indexOf('=');
    if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, '');
  }
  return { nom: tete[0].toUpperCase(), params, valeur: ligne.slice(fin + 1) };
}

/** Texte d'une valeur : `\,` `\;` `\\` et `\n` (en espace pour un titre ou un lieu). */
function texteIcs(valeur: string, retourLigne = '\n'): string {
  return valeur
    .replace(/\\([\\,;nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? retourLigne : c))
    .trim();
}

interface Instant {
  /** « AAAA-MM-JJ » ou « AAAA-MM-JJTHH:MM:SS », heure locale. */
  texte: string;
  journee: boolean;
}

/** Heure locale dans `fuseau` d'un instant UTC. */
function versFuseau(utc: number, fuseau: string): string {
  const parties = new Intl.DateTimeFormat('en-GB', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utc));
  const v = (t: string) => parties.find((p) => p.type === t)?.value ?? '00';
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}`;
}

/**
 * Date ou date-heure iCalendar. Une heure en temps universel (« Z ») est
 * convertie dans le fuseau du calendrier familial ; une heure avec TZID ou
 * « flottante » est gardée telle quelle : c'est l'heure du lieu, comme celle
 * des photos.
 */
function lireInstant(p: Propriete, fuseau: string): Instant | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z?))?/.exec(p.valeur.trim());
  if (!m) return null;
  const jour = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4] || p.params.VALUE === 'DATE') return { texte: jour, journee: true };
  if (m[7] === 'Z') return { texte: versFuseau(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)), fuseau), journee: false };
  return { texte: `${jour}T${m[4]}:${m[5]}:${m[6] ?? '00'}`, journee: false };
}

/** Durée iCalendar (« P1D », « PT1H30M », « P1W ») en secondes. */
function lireDuree(valeur: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(valeur.trim());
  if (!m) return null;
  const s = (+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86_400 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0);
  return m[1] === '-' ? -s : s;
}

// ---------------------------------------------------------------------------
// Récurrences
// ---------------------------------------------------------------------------

const JOURS_ICS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

interface Regle {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  intervalle: number;
  nombre?: number;
  /** Dernier jour possible (« AAAA-MM-JJ »). */
  jusqua?: string;
  /** Jours de la semaine (0 = lundi), avec rang éventuel (2 = deuxième, -1 = dernier). */
  jours: { jour: number; rang?: number }[];
  joursDuMois: number[];
  mois: number[];
}

function lireRegle(valeur: string, fuseau: string): Regle | null {
  const p: Record<string, string> = {};
  for (const morceau of valeur.split(';')) {
    const i = morceau.indexOf('=');
    if (i > 0) p[morceau.slice(0, i).toUpperCase()] = morceau.slice(i + 1);
  }
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(p.FREQ)) return null;
  const jours = (p.BYDAY ?? '')
    .split(',')
    .map((j) => /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(j.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ jour: JOURS_ICS.indexOf(m[2]), ...(m[1] ? { rang: Number(m[1]) } : {}) }));
  const jusqua = p.UNTIL ? lireInstant({ nom: 'UNTIL', params: {}, valeur: p.UNTIL }, fuseau)?.texte.slice(0, 10) : undefined;
  const nombres = (v?: string) => (v ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n !== 0);
  return {
    freq: p.FREQ as Regle['freq'],
    intervalle: Math.max(1, Number(p.INTERVAL) || 1),
    ...(p.COUNT && Number(p.COUNT) > 0 ? { nombre: Number(p.COUNT) } : {}),
    ...(jusqua ? { jusqua } : {}),
    jours,
    joursDuMois: nombres(p.BYMONTHDAY),
    mois: nombres(p.BYMONTH).filter((n) => n >= 1 && n <= 12),
  };
}

function joursDansMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** Jour du `rang`-ième `jourSem` (0 = lundi) du mois, ou `null` s'il n'existe pas. */
function nieme(annee: number, mois: number, jourSem: number, rang: number): number | null {
  const n = joursDansMois(annee, mois);
  const premier = Date.UTC(annee, mois - 1, 1) / 86_400_000;
  const candidats: number[] = [];
  for (let d = 0; d < n; d++) if (jourSemaine(premier + d) === jourSem) candidats.push(premier + d);
  const i = rang > 0 ? rang - 1 : candidats.length + rang;
  return candidats[i] ?? null;
}

/** Jours des occurrences d'un mois (règles mensuelles et annuelles). */
function joursDuMois(r: Regle, annee: number, mois: number, jourDebut: number): number[] {
  const premier = Date.UTC(annee, mois - 1, 1) / 86_400_000;
  const n = joursDansMois(annee, mois);
  const jours: number[] = [];
  for (const j of r.joursDuMois) {
    const d = j > 0 ? j : n + 1 + j;
    if (d >= 1 && d <= n) jours.push(premier + d - 1);
  }
  for (const j of r.jours) {
    if (j.rang !== undefined) {
      const d = nieme(annee, mois, j.jour, j.rang);
      if (d !== null) jours.push(d);
    } else for (let d = 0; d < n; d++) if (jourSemaine(premier + d) === j.jour) jours.push(premier + d);
  }
  if (!r.joursDuMois.length && !r.jours.length) {
    const d = new Date(jourDebut * 86_400_000).getUTCDate();
    // Le 31 n'existe pas en avril : le mois est sauté (RFC 5545).
    if (d <= n) jours.push(premier + d - 1);
  }
  return [...new Set(jours)].sort((a, b) => a - b);
}

/**
 * Jours de début des occurrences, dans l'ordre, le premier étant toujours
 * celui de DTSTART (RFC 5545) ; bornés par COUNT, UNTIL et `au`.
 */
function occurrences(r: Regle, debut: string, au?: string): number[] {
  const jourDebut = jourDepuis(debut);
  const borne = Math.min(r.jusqua ? jourDepuis(r.jusqua) : Infinity, au ? jourDepuis(au) : Infinity);
  const resultat: number[] = [jourDebut];
  const ajouter = (j: number): boolean => {
    if (j <= jourDebut) return true;
    if (j > borne || resultat.length >= (r.nombre ?? MAX_OCCURRENCES)) return false;
    resultat.push(j);
    return true;
  };
  const d0 = new Date(jourDebut * 86_400_000);
  for (let k = 0; resultat.length < (r.nombre ?? MAX_OCCURRENCES) && k < MAX_OCCURRENCES; k++) {
    let candidats: number[];
    if (r.freq === 'DAILY') candidats = [jourDebut + k * r.intervalle];
    else if (r.freq === 'WEEKLY') {
      const lundi = jourDebut - jourSemaine(jourDebut) + 7 * k * r.intervalle;
      candidats = r.jours.length ? [...new Set(r.jours.map((j) => lundi + j.jour))].sort((a, b) => a - b) : [jourDebut + 7 * k * r.intervalle];
    } else if (r.freq === 'MONTHLY') {
      const m = d0.getUTCMonth() + k * r.intervalle;
      candidats = joursDuMois(r, d0.getUTCFullYear() + Math.floor(m / 12), (m % 12) + 1, jourDebut);
    } else {
      // Annuelle : les mois de BYMONTH, sinon celui de DTSTART ; le 29 février ne revient que les années bissextiles.
      const annee = d0.getUTCFullYear() + k * r.intervalle;
      const mois = r.mois.length ? r.mois : [d0.getUTCMonth() + 1];
      candidats = mois.flatMap((m) => joursDuMois(r, annee, m, jourDebut)).sort((a, b) => a - b);
    }
    if (candidats.length && candidats[0] > borne) break;
    for (const j of candidats) if (!ajouter(j)) return resultat;
  }
  return resultat;
}

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------

/** Premier et dernier jour couverts par un événement. */
/** Premier et dernier jour d'un événement (« AAAA-MM-JJ »). */
export function joursEvenement(e: EvenementCalendrier): [string, string] {
  return jours(e);
}

function jours(e: EvenementCalendrier): [string, string] {
  const d1 = e.debut.slice(0, 10);
  let d2 = e.fin.slice(0, 10);
  // Un événement qui finit à minuit pile ne déborde pas sur le lendemain.
  if (!e.journee && e.fin.slice(11) === '00:00:00' && d2 > d1) d2 = texteJour(jourDepuis(d2) - 1);
  return [d1, d2 < d1 ? d1 : d2];
}

function chevauche(e: EvenementCalendrier, du?: string, au?: string): boolean {
  const [d1, d2] = jours(e);
  return (!au || d1 <= au.slice(0, 10)) && (!du || d2 >= du.slice(0, 10));
}

/** Événements d'un fichier `.ics`, triés par début ; les événements annulés ou sans titre sont ignorés. */
export function lireIcs(texte: string, o: OptionsIcs): EvenementCalendrier[] {
  const fuseau = o.fuseau ?? 'Europe/Zurich';
  // RFC 5545 : une ligne longue continue sur la suivante, qui commence par une espace ou une tabulation.
  const lignes = texte.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const blocs: Propriete[][] = [];
  let courant: Propriete[] | null = null;
  let profondeur = 0;
  for (const ligne of lignes) {
    const p = lireLigne(ligne);
    if (!p) continue;
    const v = p.valeur.trim().toUpperCase();
    if (p.nom === 'BEGIN' && v === 'VEVENT') {
      courant = [];
      profondeur = 0;
    } else if (p.nom === 'END' && v === 'VEVENT') {
      if (courant) blocs.push(courant);
      courant = null;
    } else if (courant) {
      // Composants imbriqués (VALARM) : leurs propriétés ne sont pas celles de l'événement.
      if (p.nom === 'BEGIN') profondeur++;
      else if (p.nom === 'END') profondeur--;
      else if (profondeur === 0) courant.push(p);
    }
  }

  // Une occurrence modifiée (RECURRENCE-ID) remplace celle de la règle.
  const modifiees = new Map<string, Set<string>>();
  for (const b of blocs) {
    const uid = b.find((p) => p.nom === 'UID')?.valeur.trim();
    const rid = b.find((p) => p.nom === 'RECURRENCE-ID');
    const jour = rid && lireInstant(rid, fuseau)?.texte.slice(0, 10);
    if (uid && jour) modifiees.set(uid, new Set([...(modifiees.get(uid) ?? []), jour]));
  }

  const resultat: EvenementCalendrier[] = [];
  for (const b of blocs) {
    const prop = (nom: string) => b.find((p) => p.nom === nom);
    const titre = prop('SUMMARY') ? texteIcs(prop('SUMMARY')!.valeur, ' ') : '';
    if (!titre || prop('STATUS')?.valeur.trim().toUpperCase() === 'CANCELLED') continue;
    const debut = prop('DTSTART') && lireInstant(prop('DTSTART')!, fuseau);
    if (!debut) continue;
    const finLue = prop('DTEND') && lireInstant(prop('DTEND')!, fuseau);
    const duree = prop('DURATION') ? lireDuree(prop('DURATION')!.valeur) : null;
    // Fin incluse : un DTEND de type date est exclusif (l'événement finit la veille).
    let fin: string;
    if (debut.journee) {
      const jourFin = finLue ? jourDepuis(finLue.texte) - 1 : duree !== null ? jourDepuis(debut.texte) + Math.max(1, Math.round(duree / 86_400)) - 1 : jourDepuis(debut.texte);
      fin = texteJour(Math.max(jourDepuis(debut.texte), jourFin));
    } else {
      fin = finLue ? finLue.texte : duree !== null ? texteSecondes(secondes(debut.texte) + duree) : debut.texte;
      if (fin.length === 10) fin = `${fin}T00:00:00`;
      if (fin < debut.texte) fin = debut.texte;
    }
    const lieu = prop('LOCATION') ? texteIcs(prop('LOCATION')!.valeur, ' ') : '';
    const description = prop('DESCRIPTION') ? texteIcs(prop('DESCRIPTION')!.valeur) : '';
    const base: EvenementCalendrier = {
      titre,
      ...(lieu ? { lieu } : {}),
      ...(description ? { description } : {}),
      debut: debut.texte,
      fin,
      journee: debut.journee,
      recurrent: false,
    };
    const regle = prop('RRULE');
    if (!regle) {
      if (chevauche(base, o.du, o.au)) resultat.push(base);
      continue;
    }
    // Récurrences : ignorées par défaut, comme dans les scripts (peu fiables, et les événements ponctuels sont les plus utiles).
    if (!o.inclureRecurrents) continue;
    const r = lireRegle(regle.valeur, fuseau);
    if (!r) continue;
    const exclus = new Set<string>(modifiees.get(prop('UID')?.valeur.trim() ?? '') ?? []);
    for (const p of b.filter((x) => x.nom === 'EXDATE')) {
      for (const v of p.valeur.split(',')) {
        const i = lireInstant({ ...p, valeur: v }, fuseau);
        if (i) exclus.add(i.texte.slice(0, 10));
      }
    }
    const ecartFin = debut.journee ? jourDepuis(fin) - jourDepuis(debut.texte) : secondes(fin) - secondes(debut.texte);
    for (const j of occurrences(r, debut.texte, o.au)) {
      const jour = texteJour(j);
      if (exclus.has(jour)) continue;
      const e: EvenementCalendrier = debut.journee
        ? { ...base, debut: jour, fin: texteJour(j + ecartFin), recurrent: true }
        : (() => {
            const d = `${jour}${debut.texte.slice(10)}`;
            return { ...base, debut: d, fin: texteSecondes(secondes(d) + ecartFin), recurrent: true };
          })();
      if (chevauche(e, o.du, o.au)) resultat.push(e);
    }
  }
  return resultat.sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin) || a.titre.localeCompare(b.titre));
}

/** Nombre d'événements et période couverte (page Configuration). */
export function resumeCalendrier(evts: EvenementCalendrier[]): { nombre: number; du?: string; au?: string } {
  if (!evts.length) return { nombre: 0 };
  const j = evts.map(jours);
  return { nombre: evts.length, du: j.map((x) => x[0]).sort()[0], au: j.map((x) => x[1]).sort().at(-1) };
}

/** Durée d'un événement, en secondes (une journée entière compte 24 h). */
export function dureeEvenement(e: EvenementCalendrier): number {
  const [d1, d2] = jours(e);
  return e.journee ? (jourDepuis(d2) - jourDepuis(d1) + 1) * 86_400 : secondes(e.fin) - secondes(e.debut);
}

/**
 * Part des photos prises pendant l'événement : `dates` sont leurs dates
 * (« AAAA-MM-JJTHH:MM:SS » ou « AAAA-MM-JJ ») ; une heure de marge autour d'un
 * événement à l'heure (on photographie un peu avant et après).
 */
export function partPendant(e: EvenementCalendrier, dates: string[]): number {
  if (!dates.length) return 0;
  const [d1, d2] = jours(e);
  const debut = secondes(e.debut) - 3600;
  const fin = secondes(e.fin) + 3600;
  const pendant = (d: string) => (e.journee || d.length <= 10 ? d.slice(0, 10) >= d1 && d.slice(0, 10) <= d2 : secondes(d) >= debut && secondes(d) <= fin);
  return dates.filter(pendant).length / dates.length;
}

/**
 * L'événement du calendrier qui décrit le mieux des photos (D83) : celui
 * pendant lequel la plus grande part a été prise (la moitié au moins) ; à
 * égalité, le plus court, plus parlant (« 18 ans de Lea » plutôt que
 * « Vacances d'hiver »). Son titre fait souvent un bon nom de dossier.
 */
export function evenementDesPhotos(evts: EvenementCalendrier[], dates: string[]): { evenement: EvenementCalendrier; part: number } | null {
  let meilleur: { evenement: EvenementCalendrier; part: number } | null = null;
  for (const e of evts) {
    const part = partPendant(e, dates);
    if (part < 0.5) continue;
    const egal = meilleur && Math.abs(part - meilleur.part) < 1e-9;
    if (!meilleur || (!egal && part > meilleur.part) || (egal && dureeEvenement(e) < dureeEvenement(meilleur.evenement))) meilleur = { evenement: e, part };
  }
  return meilleur;
}

/** Événements chevauchant [du − marge, au + marge] (`evenements_autour` des scripts 03 et 04). */
export function evenementsAutour(evts: EvenementCalendrier[], du: string, au: string, margeJours = 1): EvenementCalendrier[] {
  const a = texteJour(jourDepuis(du) - margeJours);
  const b = texteJour(jourDepuis(au) + margeJours);
  return evts.filter((e) => chevauche(e, a, b));
}

/**
 * Texte ajouté aux consignes (`bloc_calendrier` des scripts 03 et 04) : les
 * événements courts d'abord, plus discriminants que les longues périodes,
 * 12 au plus ; vide sans événement.
 */
export function blocCalendrier(evts: EvenementCalendrier[]): string {
  if (!evts.length) return '';
  const duree = (e: EvenementCalendrier) => {
    const [d1, d2] = jours(e);
    return jourDepuis(d2) - jourDepuis(d1);
  };
  const lignes = [...evts]
    .sort((x, y) => duree(x) - duree(y))
    .slice(0, LIMITE_CALENDRIER)
    .map((e) => {
      const [d1, d2] = jours(e);
      const court = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
      const quand = d1 === d2 ? court(d1) : `${court(d1)}-${court(d2)}`;
      return `- ${quand} : ${e.titre}${e.lieu ? ` @ ${e.lieu}` : ''}`;
    });
  return `\n\nÉvénements du calendrier familial autour de ces dates (source fiable, à privilégier si cohérente avec les photos) :\n${lignes.join('\n')}`;
}
