// Petits outils d'interface pour la page de test de la phase 0.

type Enfant = Node | string | number | null | undefined | false;

/** Crée un élément : `classe`, attributs, écouteurs (`onclick`…), enfants. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributs: Record<string, unknown> = {},
  ...enfants: Enfant[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (valeur === undefined || valeur === null || valeur === false) continue;
    if (cle === 'classe') e.className = String(valeur);
    else if (cle.startsWith('on') && typeof valeur === 'function') e.addEventListener(cle.slice(2), valeur as EventListener);
    else if (cle in e && typeof valeur !== 'string') (e as unknown as Record<string, unknown>)[cle] = valeur;
    else e.setAttribute(cle, valeur === true ? '' : String(valeur));
  }
  ajouter(e, ...enfants);
  return e;
}

export function ajouter(parent: Node, ...enfants: Enfant[]) {
  for (const enfant of enfants) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    parent.appendChild(typeof enfant === 'object' ? enfant : document.createTextNode(String(enfant)));
  }
}

export type Statut = 'ok' | 'echec' | 'avert' | 'info';

const ICONES: Record<Statut, string> = { ok: '✓', echec: '✗', avert: '!', info: '·' };

/** Zone de messages d'une section. */
export class Journal {
  readonly zone: HTMLElement;
  constructor(parent: HTMLElement) {
    this.zone = el('div', { classe: 'journal', 'aria-live': 'polite' });
    parent.appendChild(this.zone);
  }
  ecrire(statut: Statut, texte: string) {
    const ligne = el('div', { classe: `ligne ${statut}` }, el('span', { classe: 'icone' }, ICONES[statut]), el('span', {}, texte));
    this.zone.appendChild(ligne);
    ligne.scrollIntoView({ block: 'nearest' });
    return ligne;
  }
  ok(t: string) { return this.ecrire('ok', t); }
  echec(t: string) { return this.ecrire('echec', t); }
  avert(t: string) { return this.ecrire('avert', t); }
  info(t: string) { return this.ecrire('info', t); }
  vider() { this.zone.replaceChildren(); }
}

/** Bouton qui se désactive pendant son action et affiche les erreurs dans le journal. */
export function bouton(texte: string, journal: Journal, action: () => Promise<void> | void, classe = ''): HTMLButtonElement {
  const b = el('button', { type: 'button', classe }, texte);
  b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await action();
    } catch (err) {
      journal.echec(messageErreur(err));
    } finally {
      b.disabled = false;
    }
  });
  return b;
}

export function messageErreur(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') return 'Action annulée.';
  if (err instanceof Error) return `${err.name === 'Error' ? 'Erreur' : err.name} : ${err.message}`;
  return String(err);
}

/** Section repliable d'un point du § 16. */
export function section(id: string, titre: string, explication: string): { corps: HTMLElement; journal: Journal } {
  const corps = el('div', { classe: 'corps' });
  const details = el('details', { id, classe: 'section', open: true }, el('summary', {}, titre), el('p', { classe: 'explication' }, explication), corps);
  document.getElementById('sections')!.appendChild(details);
  const journal = new Journal(details);
  return { corps, journal };
}

export function tableau(entetes: string[], lignes: Enfant[][]): HTMLTableElement {
  return el(
    'table',
    {},
    el('thead', {}, el('tr', {}, ...entetes.map((t) => el('th', {}, t)))),
    el('tbody', {}, ...lignes.map((l) => el('tr', {}, ...l.map((c) => el('td', {}, c))))),
  );
}

// ---------------------------------------------------------------------------
// Mise en forme
// ---------------------------------------------------------------------------

const nf = (decimales: number) => new Intl.NumberFormat('fr-CH', { maximumFractionDigits: decimales, minimumFractionDigits: decimales });

export function nombre(n: number, decimales = 0): string {
  return nf(decimales).format(n);
}

export function duree(ms: number): string {
  if (ms < 1000) return `${nombre(ms)} ms`;
  if (ms < 60_000) return `${nombre(ms / 1000, 1)} s`;
  const min = Math.floor(ms / 60_000);
  return `${min} min ${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')} s`;
}

export function taille(octets: number): string {
  const unites = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let v = octets;
  let i = 0;
  while (v >= 1024 && i < unites.length - 1) {
    v /= 1024;
    i++;
  }
  return `${nombre(v, i === 0 ? 0 : 1)} ${unites[i]}`;
}

export function memoire(): number | null {
  return performance.memory?.usedJSHeapSize ?? null;
}

export function texteMemoire(): string {
  const m = memoire();
  return m === null ? 'non mesurable dans ce navigateur' : taille(m);
}

/** Laisse le navigateur rafraîchir l'affichage pendant une longue boucle. */
export function respirer(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}
