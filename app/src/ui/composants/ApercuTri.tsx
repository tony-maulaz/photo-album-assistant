// Aperçu du tri automatique (étape « Tri automatique ») : avant de ranger, ce
// que donneraient les réglages avec les photos de l'utilisateur. Les chiffres,
// la répartition des dossiers par taille, puis une frise jour par jour sur
// quelques semaines d'exemple. L'écran recalcule `dossiers` à chaque réglage
// (sans les noms OpenStreetMap) ; ce composant ne fait que les montrer.

import { useMemo, useRef, useState } from 'preact/hooks';
import { auDomicile, choisirExemples, colonnesFrise, listeParDate, pastillesJour, periodeFrise, statistiquesTri, type FriseTri, type PortionFrise, type RaisonExemple } from '../../lib/apercuTri';
import { langue, t } from '../../lib/langue';
import type { DossierPropose } from '../../lib/tri';
import { nombre, nomJour, periode, pluriel } from '../format';

/** Libellés des classes de taille (statistiquesTri), dans l'ordre. */
const CLASSES = ['1-2', '3-10', '11-50', '51-200', '200+'];

function texteRaison(r: RaisonExemple): string {
  switch (r) {
    case 'chargee':
      return t`la semaine la plus chargée`;
    case 'voyage':
      return t`le plus long voyage`;
    case 'maison':
      return t`une semaine à la maison`;
    case 'petits':
      return t`là où il y a le plus de petits dossiers`;
    case 'grand':
      return t`le plus grand dossier`;
  }
}

const locale = () => (langue() === 'en' ? 'en-GB' : 'fr-CH');
const midi = (jour: string) => new Date(`${jour}T12:00:00Z`);

/** « 7–13 juillet 2025 », « 28 juin – 4 juillet 2025 » (« 7–13 July 2025 »). */
function plage(du: string, au: string): string {
  const f = new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
  return du === au ? f.format(midi(du)) : f.formatRange(midi(du), midi(au));
}

/** Nom montré sous la frise : la dernière partie du chemin ; pour un lieu connu, son nom devant la date. */
function nomCourt(d: DossierPropose): string {
  const dernier = d.chemin.at(-1) ?? '';
  return d.chemin.length > 1 && d.infoParent?.origine === 'lieu_connu' ? `${d.chemin[0]} › ${dernier}` : dernier;
}

function raccourcir(texte: string, max: number): string {
  return texte.length <= max ? texte : `${texte.slice(0, Math.max(1, max - 1))}…`;
}

export function ApercuTri({ dossiers, dates, domicile }: { dossiers: DossierPropose[]; dates: Map<string, string | undefined>; domicile?: string }) {
  const stats = useMemo(() => statistiquesTri(dossiers), [dossiers]);
  const exemples = useMemo(() => choisirExemples(dossiers, dates, domicile), [dossiers, dates, domicile]);
  // L'exemple affiché reste le même (même raison) quand les réglages changent, s'il existe encore.
  const raison = useRef<RaisonExemple | null>(null);
  const [, redessiner] = useState(0);
  const [listeOuverte, setListeOuverte] = useState(false);
  const i = Math.max(
    0,
    exemples.findIndex((e) => e.raison === raison.current),
  );
  const exemple = exemples.at(i);
  raison.current = exemple?.raison ?? null;
  const montrer = (r: RaisonExemple) => {
    raison.current = r;
    redessiner((n) => n + 1);
  };
  // Une semaine au moins : un voyage plus court se voit avec les jours qui l'entourent.
  const jours = exemple ? periodeFrise(exemple.du, exemple.au) : null;
  const frise = useMemo(() => (jours ? colonnesFrise(dossiers, dates, jours.du, jours.au) : null), [dossiers, dates, jours?.du, jours?.au]);
  const liste = useMemo(() => (listeOuverte ? listeParDate(dossiers, dates) : []), [dossiers, dates, listeOuverte]);
  const aPetits = exemples.some((e) => e.raison === 'petits');

  if (!dossiers.length)
    return (
      <div class="encart apercu-tri">
        <h3>{t`Résultat avec vos photos`}</h3>
        <p class="discret">{t`Aucun dossier prévu : il n’y a pas de photo à trier.`}</p>
      </div>
    );

  return (
    <div class="encart apercu-tri">
      <h3>{t`Résultat avec vos photos`}</h3>
      <p class="apt-chiffres">
        <strong>{pluriel(stats.dossiers, 'dossier')}</strong> · {pluriel(stats.voyages, 'voyage')} · {pluriel(stats.tresPetits, 'très petit', 'très petits')} {t`(1-2 photos)`} ·{' '}
        {pluriel(stats.tresGrands, 'très grand', 'très grands')}
      </p>

      <div class="apt-tailles">
        <div class="apt-barre-tailles">
          {stats.tailles.map((n, c) => {
            if (!n) return null;
            const titre = t`${CLASSES[c]} photos : ${pluriel(n, 'dossier')}`;
            return c === 0 && aPetits ? (
              <button key={c} type="button" class="apt-part apt-t0" style={{ flexGrow: n }} title={t`${titre} — cliquer pour en voir un exemple`} onClick={() => montrer('petits')} />
            ) : (
              <span key={c} class={`apt-part apt-t${c}`} style={{ flexGrow: n }} title={titre} />
            );
          })}
        </div>
        <ul class="apt-legende">
          <li class="discret">{t`Photos par dossier :`}</li>
          {CLASSES.map((libelle, c) => (
            <li key={c}>
              <span class={`apt-carre apt-t${c}`} />
              {c === 0 && aPetits ? (
                <button type="button" class="lien" onClick={() => montrer('petits')} title={t`Voir un exemple de très petits dossiers`}>
                  {libelle} ({nombre(stats.tailles[c])})
                </button>
              ) : (
                <>
                  {libelle} <span class="discret">({nombre(stats.tailles[c])})</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {exemple && jours && frise ? (
        <>
          <div class="apt-exemple">
            <button
              type="button"
              disabled={exemples.length < 2}
              onClick={() => montrer(exemples[(i - 1 + exemples.length) % exemples.length].raison)}
              aria-label={t`Exemple précédent`}
              title={t`Exemple précédent`}
            >
              ◀
            </button>
            <button type="button" disabled={exemples.length < 2} onClick={() => montrer(exemples[(i + 1) % exemples.length].raison)} aria-label={t`Exemple suivant`} title={t`Exemple suivant`}>
              ▶
            </button>
            <span>
              <strong>{t`Exemple ${i + 1}/${exemples.length} :`}</strong> {texteRaison(exemple.raison)} ({plage(exemple.du, exemple.au)})
            </span>
          </div>
          <Frise frise={frise} dossiers={dossiers} domicile={domicile} du={jours.du} au={jours.au} />
        </>
      ) : (
        <p class="discret">{t`Aucune photo datée : pas d’exemple à montrer.`}</p>
      )}

      <details class="apt-liste" onToggle={(e) => setListeOuverte(e.currentTarget.open)}>
        <summary>{dossiers.length === 1 ? t`Voir le dossier prévu` : t`Voir la liste des ${nombre(dossiers.length)} dossiers prévus`}</summary>
        {listeOuverte && (
          <div class="apt-defile">
            <table>
              <tbody>
                {liste.map(({ dossier, du, au }) => {
                  const d = dossiers[dossier];
                  return (
                    <tr key={d.chemin.join('/')}>
                      <td>
                        {auDomicile(d, domicile) && <span title={t`à la maison`}>⌂ </span>}
                        {d.chemin.join(' / ')}
                      </td>
                      <td class="discret">{du && au ? periode(du, au) : t`sans date`}</td>
                      <td class="apt-nombre">{pluriel(d.photos.length, 'photo')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </details>
      <p class="discret apt-note">{t`Les noms définitifs des lieux sont demandés à OpenStreetMap au moment de ranger.`}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frise (SVG intégré)
// ---------------------------------------------------------------------------

/** Largeur visée de la frise, et d'une colonne (un jour), en unités du dessin (≈ px). */
const LARGEUR_VISEE = 840;
const COLONNE_MIN = 56;
const COLONNE_MAX = 120;
/** Pastilles : diamètre, pas (pastille et écart), nombre au plus par jour. */
const PASTILLE = 14;
const PAS = 17;
const MAX_PASTILLES = 12;
const HAUT_VOYAGE = 28;
const HAUT_ENTETE = 36;
const HAUT_PLUS = 16;
const HAUT_LIGNE = 26;
const HAUT_BARRE = 18;
/** Largeur moyenne estimée d'un caractère à 12 px, pour placer les noms sans chevauchement. */
const CARACTERE = 6.6;
const MAX_LIGNES = 20;
const COULEURS = 8;

/** A, B… Z, puis AA, AB… */
function lettre(k: number): string {
  const l = (n: number) => String.fromCharCode(65 + n);
  return k < 26 ? l(k) : l(Math.floor(k / 26) - 1) + l(k % 26);
}

/** Petite maison (toit et murs) centrée en (x, y), pour une pastille de rayon r. */
function maison(x: number, y: number, r: number): string {
  const s = r * 0.62;
  return `M${x - s} ${y - s * 0.05}L${x} ${y - s}L${x + s} ${y - s * 0.05}M${x - s * 0.68} ${y - s * 0.35}V${y + s * 0.8}H${x + s * 0.68}V${y - s * 0.35}`;
}

interface Marque {
  lettre: string | null;
  classe: string;
}

function Pastille({ x, y, r, m }: { x: number; y: number; r: number; m: Marque }) {
  return (
    <g class={m.classe}>
      <circle class="apt-pastille" cx={x} cy={y} r={r} />
      {m.lettre ? (
        <text class="apt-lettre" x={x} y={y} dy="0.35em" text-anchor="middle" style={{ fontSize: `${r * (m.lettre.length > 1 ? 0.95 : 1.25)}px` }}>
          {m.lettre}
        </text>
      ) : (
        <path class="apt-toit" d={maison(x, y, r)} />
      )}
    </g>
  );
}

function Frise({ frise, dossiers, domicile, du, au }: { frise: FriseTri; dossiers: DossierPropose[]; domicile?: string; du: string; au: string }) {
  const n = frise.jours.length;
  const col = Math.max(COLONNE_MIN, Math.min(COLONNE_MAX, LARGEUR_VISEE / n));
  const largeur = n * col;
  const parRang = col >= 3 * PAS + 6 ? 3 : 2;
  const rangs = Math.ceil(MAX_PASTILLES / parRang);

  // Une couleur et une lettre par dossier, dans l'ordre des barres ; la maison a son pictogramme.
  const marques = new Map<number, Marque>();
  let k = 0;
  for (const p of frise.portions) {
    if (auDomicile(dossiers[p.dossier], domicile)) marques.set(p.dossier, { lettre: null, classe: 'apt-maison' });
    else {
      marques.set(p.dossier, { lettre: lettre(k), classe: `apt-c${k % COULEURS}` });
      k++;
    }
  }

  // Voyages : une accolade par voyage, sur une rangée où elle ne touche aucune autre.
  const finRangee: number[] = [];
  const rangeesVoyages = frise.voyages.map((v) => {
    let r = finRangee.findIndex((fin) => fin < v.premier);
    if (r < 0) r = finRangee.push(-1) - 1;
    finRangee[r] = v.dernier;
    return r;
  });
  const yEntete = finRangee.length * HAUT_VOYAGE;
  const yBase = yEntete + HAUT_ENTETE + HAUT_PLUS + rangs * PAS;
  const yBarres = yBase + 10;
  const lignes = frise.portions.slice(0, MAX_LIGNES);
  const cachees = frise.portions.length - lignes.length;
  const hauteur = yBarres + lignes.length * HAUT_LIGNE + (cachees ? 22 : 0) + 4;

  const jourSemaine = new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', weekday: 'short' });
  const jourMois = new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const total = frise.jours.reduce((s, j) => s + j.total, 0);
  const aLaMaison = [...marques.values()].some((m) => !m.lettre);

  return (
    <>
      <svg
        class="apt-frise"
        viewBox={`0 0 ${largeur} ${hauteur}`}
        style={{ maxWidth: `${largeur}px` }}
        role="img"
        aria-label={t`Frise jour par jour, ${plage(du, au)} : ${pluriel(frise.portions.length, 'dossier')}, ${pluriel(total, 'photo')}.`}
      >
        {/* Fins de semaine et séparations des jours. */}
        {frise.jours.map((j, c) => {
          const jour = midi(j.jour).getUTCDay();
          return (jour === 0 || jour === 6) && <rect key={`f${j.jour}`} class="apt-weekend" x={c * col} y={yEntete} width={col} height={hauteur - yEntete} />;
        })}
        {frise.jours.slice(1).map((j, c) => (
          <line key={`s${j.jour}`} class="apt-grille" x1={(c + 1) * col} x2={(c + 1) * col} y1={yEntete + 4} y2={hauteur} />
        ))}
        <line class="apt-base" x1={0} x2={largeur} y1={yBase + 4} y2={yBase + 4} />

        {/* Accolades « Voyage » au-dessus des étapes. */}
        {frise.voyages.map((v, r) => {
          const x1 = v.premier * col + 6;
          const x2 = (v.dernier + 1) * col - 6;
          const xm = (x1 + x2) / 2;
          const yb = rangeesVoyages[r] * HAUT_VOYAGE + HAUT_VOYAGE - 3;
          const ya = yb - 5;
          const texte = v.lieu ? `${t`Voyage`} · ${raccourcir(v.lieu, 24)}` : t`Voyage`;
          const demi = (texte.length * CARACTERE) / 2;
          const d =
            x2 - x1 < 24
              ? `M${x1} ${yb}V${ya}H${x2}V${yb}`
              : `M${x1} ${yb}Q${x1} ${ya} ${x1 + 5} ${ya}H${xm - 5}Q${xm} ${ya} ${xm} ${ya - 5}Q${xm} ${ya} ${xm + 5} ${ya}H${x2 - 5}Q${x2} ${ya} ${x2} ${yb}`;
          return (
            <g key={`v${v.parent}`}>
              <title>{v.parent}</title>
              <path class="apt-accolade" d={d} />
              <text class="apt-voyage" x={Math.min(largeur - demi, Math.max(demi, xm))} y={ya - 9} text-anchor="middle">
                {texte}
              </text>
            </g>
          );
        })}

        {/* Les jours : nom, puis les photos en pastilles empilées. */}
        {frise.jours.map((j, c) => {
          const x = c * col + col / 2;
          const { pastilles, reste } = pastillesJour(j.parDossier, MAX_PASTILLES);
          const rangsPris = Math.ceil(pastilles.length / parRang);
          const premierDuMois = c === 0 || j.jour.endsWith('-01');
          return (
            <g key={`j${j.jour}`}>
              <title>{t`${nomJour(j.jour, true)} : ${pluriel(j.total, 'photo')}`}</title>
              <rect class="apt-colonne" x={c * col} y={yEntete} width={col} height={yBase - yEntete + 4} />
              <text class="apt-jour" x={x} y={yEntete + 14} text-anchor="middle">
                {jourSemaine.format(midi(j.jour))}
              </text>
              <text class={`apt-jour${premierDuMois ? ' apt-mois' : ''}`} x={x} y={yEntete + 29} text-anchor="middle">
                {premierDuMois ? jourMois.format(midi(j.jour)) : String(Number(j.jour.slice(8, 10)))}
              </text>
              {pastilles.map((dossier, p) => {
                const rang = Math.floor(p / parRang);
                const dansRang = Math.min(parRang, pastilles.length - rang * parRang);
                const position = (p % parRang) - (dansRang - 1) / 2;
                return <Pastille key={p} x={x + position * PAS} y={yBase - PASTILLE / 2 - rang * PAS} r={PASTILLE / 2} m={marques.get(dossier)!} />;
              })}
              {reste > 0 && (
                <text class="apt-plus" x={x} y={yBase - rangsPris * PAS - 5} text-anchor="middle">
                  +{nombre(reste)}
                </text>
              )}
            </g>
          );
        })}

        {/* Une barre par dossier, du premier au dernier jour où il apparaît. */}
        {lignes.map((p, l) => (
          <Barre key={dossiers[p.dossier].chemin.join('/')} p={p} d={dossiers[p.dossier]} m={marques.get(p.dossier)!} y={yBarres + l * HAUT_LIGNE} col={col} largeur={largeur} />
        ))}
        {cachees > 0 && (
          <text class="apt-plus" x={6} y={yBarres + lignes.length * HAUT_LIGNE + 14}>
            {t`… et ${pluriel(cachees, 'autre dossier', 'autres dossiers')}`}
          </text>
        )}
      </svg>
      <p class="apt-aide discret">
        {t`Une pastille par photo (12 au plus par jour), de la couleur et de la lettre de son dossier ; la barre de chaque dossier est en dessous.`}
        {aLaMaison && ` ${t`⌂ : à la maison.`}`}
      </p>
    </>
  );
}

function Barre({ p, d, m, y, col, largeur }: { p: PortionFrise; d: DossierPropose; m: Marque; y: number; col: number; largeur: number }) {
  const x1 = p.premier * col + 3;
  const x2 = (p.dernier + 1) * col - 3;
  const cy = y + HAUT_LIGNE / 2;
  const r = PASTILLE / 2;
  // Marque au début de la barre, après un chevron si le dossier commence avant la période.
  const xMarque = x1 + (p.coupeAvant ? 18 : 10);
  const debutTexte = xMarque + r + 5;
  const suite = ` · ${pluriel(p.jours, 'jour')} · ${pluriel(p.elements, 'photo')}`;
  const nom = raccourcir(nomCourt(d), 32);
  const mesure = (s: string) => s.length * CARACTERE;
  // Le nom va dans la barre s'il y tient, sinon à droite, sinon à gauche ; à défaut, raccourci là où il y a le plus de place.
  const places = [
    { ou: 'dedans', x: debutTexte, ancre: 'start', espace: x2 - (p.coupeApres ? 14 : 6) - debutTexte },
    { ou: 'droite', x: x2 + 6, ancre: 'start', espace: largeur - x2 - 8 },
    { ou: 'gauche', x: x1 - 6, ancre: 'end', espace: x1 - 8 },
  ];
  const place = places.find((pl) => mesure(nom + suite) <= pl.espace) ?? places.reduce((a, b) => (b.espace > a.espace ? b : a));
  const texte = mesure(nom + suite) <= place.espace ? nom + suite : raccourcir(nom, Math.max(4, Math.floor(place.espace / CARACTERE) - suite.length)) + suite;
  return (
    <g class={m.classe}>
      <title>{t`${d.chemin.join(' / ')} : ${periode(p.du, p.au)}, ${pluriel(p.elements, 'photo')}`}</title>
      <rect class="apt-barre" x={x1} y={cy - HAUT_BARRE / 2} width={x2 - x1} height={HAUT_BARRE} rx={HAUT_BARRE / 2} />
      {p.coupeAvant && <path class="apt-chevron" d={`M${x1 + 10} ${cy - 4}l-4 4l4 4`} />}
      {p.coupeApres && <path class="apt-chevron" d={`M${x2 - 10} ${cy - 4}l4 4l-4 4`} />}
      <Pastille x={xMarque} y={cy} r={r} m={m} />
      <text class={`apt-nom${place.ou === 'dedans' ? ' dedans' : ''}`} x={place.x} y={cy} dy="0.35em" text-anchor={place.ancre}>
        {texte}
      </text>
    </g>
  );
}
