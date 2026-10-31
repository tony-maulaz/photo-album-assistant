// Résultat du tri automatique (D103, D104, D105) : à droite de la page, une
// ligne par voyage, sortie ou période à la maison, dans l'ordre du temps, avec des onglets comme aux
// Doublons (Tout, Voyages, Sorties, À la maison, Autres). Une ligne fermée tient sur deux lignes : le
// titre, l'icône calendrier (sa bulle donne les événements) et le bouton « N photos », puis les dates, les
// lieux visités, la distance de la maison (D112 point 9, lot C) ; le bouton déplie quelques photos sous la
// ligne, groupées par lieu pour un voyage. Avant de ranger, c'est un aperçu
// recalculé à chaque réglage : ce qui vient d'apparaître est marqué
// « nouveau », et un lieu pas encore nommé par OpenStreetMap ne montre pas de
// nom provisoire. Les corrections se font à l'étape suivante.

import { signal } from '@preact/signals';
import { createPortal } from 'preact/compat';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { evenementDesPhotos, evenementsUtiles, joursEvenement, type EvenementCalendrier } from '../../lib/ics';
import { t } from '../../lib/langue';
import type { FichierPlan } from '../../lib/plan';
import { compteSortes, repereLigne, reparties, type EtapeLigne, type LigneTri, type ResultatTri as Resultat, type SorteLigne } from '../../lib/resultatTri';
import { evenements, reglages, session } from '../etat';
import { dateHeure, nombre, nomJour, nomMois, pluriel } from '../format';
import { visionneuse } from '../organiser';
import { Miniature } from './GrillePhotos';
import { BulleCalendrier, jourMin, periodeCourte } from './Bulle';
import { Icone, type NomIcone } from './Icones';
import { Visionneuse } from './Visionneuse';

export type OngletTri = 'tout' | 'voyage' | 'sortie' | 'maison' | 'apart';

/** Onglet choisi, gardé d'une visite à l'autre de la page. */
const ongletChoisi = signal<OngletTri>('tout');

/** Ouvre un onglet du résultat et l'amène sous les yeux (depuis la liste « À faire »). */
export function montrerOnglet(o: OngletTri) {
  ongletChoisi.value = o;
  requestAnimationFrame(() => document.getElementById('resultat-tri')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

const JOUR_MS = 86_400_000;

/** « Sam. 9 août », ou « Jeu. 24 juillet → Jeu. 7 août · 15 jours ». */
function dates(c: { du?: string; au?: string }): string {
  if (!c.du || !c.au) return t`sans date`;
  if (c.du === c.au) return nomJour(c.du);
  const jours = Math.round((Date.parse(c.au) - Date.parse(c.du)) / JOUR_MS) + 1;
  return t`${nomJour(c.du)} → ${nomJour(c.au)} · ${nombre(jours)} jours`;
}

const ICONES: Record<SorteLigne, NomIcone> = { voyage: 'voyage', sortie: 'sortie', maison: 'maison' };
const SORTES: Record<SorteLigne, () => string> = { voyage: () => t`Voyage`, sortie: () => t`Sortie`, maison: () => t`À la maison` };

/**
 * Titre lisible d'une ligne (D107), le nom du dossier dans l'infobulle et
 * dans le dépliant : « La maison en juillet », « Voyage à Rome », « Florence,
 * sam. 9 août » ; tant que le lieu n'a pas de nom d'OpenStreetMap, la
 * date (« Sortie du sam. 9 août ») ; l'événement du calendrier est dans l'icône.
 */
function titre(l: LigneTri): string {
  if (l.sorte === 'maison') {
    if (l.du && l.au && l.du.slice(0, 7) === l.au.slice(0, 7) && /^\d{2}\.\d{2}$/.test(l.nom)) return t`La maison en ${nomMois(l.du.slice(0, 7)).replace(/ \d{4}$/, '').toLowerCase()}`;
    if (l.du && l.au) return l.du === l.au ? t`À la maison, ${jourMin(l.du)}` : t`À la maison, ${periodeCourte(l.du, l.au)}`;
    return l.nom;
  }
  const lieu = !l.provisoire && l.lieu ? l.lieu.replace(/_/g, ' ') : null;
  if (l.sorte === 'voyage') {
    if (lieu) return t`Voyage à ${lieu}`;
    return l.du && l.au ? t`Voyage du ${periodeCourte(l.du, l.au).replace(' → ', ' au ')}` : l.nom;
  }
  if (lieu && l.du) return `${lieu}, ${l.du === l.au ? jourMin(l.du) : periodeCourte(l.du, l.au)}`;
  if (!l.du || !l.au) return l.nom;
  return l.du === l.au ? t`Sortie du ${jourMin(l.du)}` : t`Sortie du ${periodeCourte(l.du, l.au).replace(' → ', ' au ')}`;
}

/** Une étape sans nom encore : « 1er lieu », « 2e lieu »… */
const nomEtape = (e: EtapeLigne, i: number) => (!e.provisoire ? e.nom : i === 0 ? t`1er lieu` : t`${i + 1}e lieu`);

/** « 10 h » : l'heure d'une prise de vue (« AAAA-MM-JJTHH:MM:SS »). */
const heure = (d?: string) => (d && d.length > 11 ? t`${Number(d.slice(11, 13))} h` : '');

/** Événements du calendrier pendant le dossier (déjà réduits aux utiles : ni rappels, ni plus de 21 jours, D88, D94) ; celui de la plupart des photos d'abord. */
function evenementsPendant(l: LigneTri, evts: EvenementCalendrier[]): { liste: EvenementCalendrier[]; retenu?: EvenementCalendrier } {
  if (!l.du || !l.au) return { liste: [] };
  const pendant = evts
    .filter((e) => {
      const [d1, d2] = joursEvenement(e);
      return d1 <= l.au! && d2 >= l.du!;
    })
    .sort((a, b) => a.debut.localeCompare(b.debut));
  const retenu = pendant.length ? evenementDesPhotos(pendant, l.dates)?.evenement : undefined;
  return { liste: retenu ? [retenu, ...pendant.filter((e) => e !== retenu)] : pendant, ...(retenu ? { retenu } : {}) };
}

/** L'en-tête de la bulle du calendrier d'une ligne (D112 point 9, lot C ; C-4.13). */
const enTeteCalendrier = (l: LigneTri) =>
  l.sorte === 'voyage' ? t`Votre calendrier pendant ce voyage` : l.sorte === 'sortie' ? t`Votre calendrier pendant cette sortie` : t`Votre calendrier pendant cette période`;

/** Côté des vignettes du dépliant : le curseur « Taille » de la ligne de l'étape (72 px au réglage par défaut). */
export const coteDepliant = (v: number) => Math.round(v * 0.45);
/** Vignettes d'un dossier déplié (lot C) ; deux par lieu visité pour un voyage. */
const VIGNETTES_DEPLIANT = 8;
const ESPACE_DEPLIANT = 6;

/**
 * Les photos d'un dossier, sous sa ligne (D112 point 9, lot C) : quelques-unes réparties sur la période, et
 * « Voir les 38 en grand » ; pour un voyage, groupées par lieu visité (la première et la dernière de chacun). Un
 * clic sur une vignette ouvre la visionneuse à cette photo. Le geste ne fait que montrer : rien n'est retenu ni
 * écarté.
 */
function Depliant({ l, id, apercu, voir }: { l: LigneTri; id: string; apercu: boolean; voir: (photos: FichierPlan[], i: number) => void }) {
  const s = session.value!;
  const cote = coteDepliant(reglages.value.tailleMiniatures);
  const bande = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  useLayoutEffect(() => {
    const el = bande.current;
    if (!el) return;
    const mesurer = () => setLargeur(el.clientWidth);
    mesurer();
    const o = new ResizeObserver(mesurer);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const fichiers = (ids: string[]) => ids.map((x) => s.plan.fichiers.get(x)).filter((f): f is FichierPlan => !!f);
  const toutes = fichiers(l.ids);
  const vignette = (f: FichierPlan) => (
    <button key={f.id} type="button" class="photo-depliant" title={`${f.nom} — ${dateHeure(f.date)}`} aria-label={t`Voir en grand : ${f.nom}`} onClick={() => voir(toutes, Math.max(0, toutes.indexOf(f)))}>
      <Miniature f={f} taille={cote} />
    </button>
  );
  const enGrand = (
    <button type="button" class="lien" onClick={() => voir(toutes, 0)}>
      {toutes.length === 1 ? t`Voir la photo en grand` : t`Voir les ${nombre(toutes.length)} en grand`}
    </button>
  );
  const dossier = !apercu && <span class="discret">{t`Dossier « ${l.chemin} »`}</span>;
  if (l.etapes.length > 1)
    return (
      <div class="depliant-tri voyage" id={id} ref={bande}>
        <div class="lieux-depliant" style={{ '--cote-depliant': `${cote}px` }}>
          {l.etapes.map((e, i) => (
            <section key={e.cle} class="lieu-depliant">
              <strong>{nomEtape(e, i)}</strong>
              <span class="discret">
                {periodeCourte(e.du, e.au) || t`sans date`} · {nombre(e.photos)}
              </span>
              <div class="bande-depliant">{reparties(fichiers(e.ids), 2).map(vignette)}</div>
            </section>
          ))}
        </div>
        <p class="pied-depliant">
          {t`2 photos par lieu visité, prises au début et à la fin`} · {enGrand}
          {dossier && <> · {dossier}</>}
        </p>
      </div>
    );
  // Une seule rangée : autant de vignettes qu'il en tient, 8 au plus (3 au moins).
  const n = largeur ? Math.max(3, Math.min(VIGNETTES_DEPLIANT, Math.floor((largeur + ESPACE_DEPLIANT) / (cote + ESPACE_DEPLIANT)))) : VIGNETTES_DEPLIANT;
  const montrees = reparties(toutes, n);
  const premier = montrees[0]?.date;
  const dernier = montrees.at(-1)?.date;
  const portee =
    montrees.length < toutes.length && premier && dernier
      ? premier.slice(0, 10) === dernier.slice(0, 10)
        ? t`${nombre(montrees.length)} photos sur ${nombre(toutes.length)}, réparties de ${heure(premier)} à ${heure(dernier)}`
        : t`${nombre(montrees.length)} photos sur ${nombre(toutes.length)}, réparties du ${periodeCourte(premier.slice(0, 10), dernier.slice(0, 10)).replace(' → ', ' au ')}`
      : '';
  return (
    <div class="depliant-tri" id={id} ref={bande}>
      <div class="bande-depliant">{montrees.map(vignette)}</div>
      <p class="pied-depliant">
        {portee && <>{portee} · </>}
        {enGrand}
        {dossier && <> · {dossier}</>}
      </p>
    </div>
  );
}

function Ligne({ l, evts, nouveau, apercu, ouverte, basculer, voir }: { l: LigneTri; evts: EvenementCalendrier[]; nouveau: boolean; apercu: boolean; ouverte: boolean; basculer: () => void; voir: (photos: FichierPlan[], i: number) => void }) {
  // Les événements se calculent sur les dates du dossier, avant comme après le rangement.
  const { liste, retenu } = useMemo(() => evenementsPendant(l, evts), [l, evts]);
  const id = `depliant-${useId()}`;
  const nomLigne = titre(l);
  const details = [
    dates(l),
    ...(l.etapes.length > 1 ? [pluriel(l.etapes.length, 'lieu visité', 'lieux visités')] : []),
    ...(l.km !== undefined && l.sorte !== 'maison' ? [t`à ${nombre(l.km)} km de la maison`] : []),
    ...(l.videos > 0 ? [pluriel(l.videos, 'vidéo')] : []),
  ];
  return (
    <article class={`ligne-tri ${l.sorte}${nouveau ? ' nouvelle' : ''}${ouverte ? ' ouverte' : ''}`}>
      <span class="icone-ligne" aria-hidden="true">
        <Icone nom={ICONES[l.sorte]} taille={20} />
      </span>
      <div class="corps-ligne">
        <div class="titre-ligne">
          <h3 title={l.chemin}>{nomLigne}</h3>
          <span class="sorte-ligne">{SORTES[l.sorte]()}</span>
          {nouveau && <span class="badge-nouveau">{t`nouveau`}</span>}
          {liste.length > 0 && <BulleCalendrier liste={liste} {...(retenu ? { retenu } : {})} enTete={enTeteCalendrier(l)} />}
        </div>
        <span class="details-ligne">{details.join(' · ')}</span>
      </div>
      {l.ids.length > 0 && (
        <button type="button" class={`bouton-photos${ouverte ? ' ouvert' : ''}`} aria-expanded={ouverte} aria-controls={ouverte ? id : undefined} aria-label={l.photos === 1 ? t`Voir 1 photo de « ${nomLigne} »` : t`Voir les ${nombre(l.photos)} photos de « ${nomLigne} »`} onClick={basculer}>
          <Icone nom="photo" taille={16} />
          {pluriel(l.photos, 'photo')}
          <Icone nom={ouverte ? 'chevronHaut' : 'chevronBas'} taille={16} />
        </button>
      )}
      {ouverte && <Depliant l={l} id={id} apercu={apercu} voir={voir} />}
    </article>
  );
}

function MisAPart({ r }: { r: Resultat }) {
  const lignes: [string, string, number][] = [
    [t`Captures d’écran`, t`Hors de l’album, dans leur propre dossier.`, r.captures],
    [t`Sans date`, t`Ni l’appareil ni le nom du fichier ne donnent leur date : l’application ne sait pas à quelle sortie elles appartiennent.`, r.sansDate],
    [t`Vidéos seules`, t`Aucune photo prise à quelques heures près : elles sont rangées par mois.`, r.videosSeules],
  ];
  const presentes = lignes.filter(([, , n]) => n);
  if (!presentes.length) return <p class="encart discret">{t`Aucune photo hors des voyages, sorties et dossiers de la maison.`}</p>;
  return (
    <ul class="mis-a-part">
      {presentes.map(([titreAPart, texte, n]) => (
        <li key={titreAPart}>
          <strong>
            {titreAPart} <span class="compte gris">{nombre(n)}</span>
          </strong>
          <span class="discret">{texte}</span>
        </li>
      ))}
    </ul>
  );
}

/** Écart d'un compte à l'autre : « (+2) », « (−1) », ou rien. */
const ecart = (n: number, avant?: number) => (avant === undefined || avant === n ? '' : ` (${n > avant ? '+' : '−'}${nombre(Math.abs(n - avant))})`);

/** `apercu` : rien n'est encore rangé, les lignes suivent les réglages en direct. */
export function ResultatTri({ r, apercu }: { r: Resultat; apercu: boolean }) {
  const evts = useMemo(() => evenementsUtiles(evenements.value), [evenements.value]);
  const n = compteSortes(r);
  // Ce qui change d'un réglage à l'autre : lignes apparues, et les comptes d'avant.
  const precedent = useRef<{ reperes: Set<string>; n: Record<SorteLigne, number> } | null>(null);
  const reperes = useMemo(() => new Set(r.lignes.map(repereLigne)), [r]);
  const [avant, setAvant] = useState<{ reperes: Set<string>; n: Record<SorteLigne, number> } | null>(null);
  useEffect(() => {
    // Le premier calcul n'a rien de « nouveau » ; ensuite, chaque réglage se compare au précédent.
    if (apercu && precedent.current) setAvant(precedent.current);
    precedent.current = { reperes, n };
  }, [r]);
  const nouveaux = apercu && avant ? new Set([...reperes].filter((x) => !avant.reperes.has(x))) : new Set<string>();

  const compte = (o: OngletTri) => (o === 'tout' ? r.lignes.length : o === 'apart' ? r.captures + r.sansDate + r.videosSeules : n[o]);
  const ONGLETS: [OngletTri, string][] = [
    ['tout', t`Tout`],
    ['voyage', t`Voyages`],
    ['sortie', t`Sorties`],
    ['maison', t`À la maison`],
    ['apart', t`Autres`],
  ];
  // Une seule ligne dépliée à la fois : on compare d'un dossier à l'autre sans que la liste s'allonge.
  const [ouverte, setOuverte] = useState<string | null>(null);
  // Les photos montrées en grand (visionneuse, sans rangement : on regarde, on ne déplace rien ici).
  const [enGrand, setEnGrand] = useState<FichierPlan[] | null>(null);
  const voir = (photos: FichierPlan[], i: number) => {
    setEnGrand(photos);
    visionneuse.value = i;
  };
  // La visionneuse est commune aux pages : elle se ferme quand on quitte celle-ci.
  useEffect(() => () => void (visionneuse.value = null), []);
  const onglet = ongletChoisi.value;
  const lignes = onglet === 'tout' ? r.lignes : onglet === 'apart' ? [] : r.lignes.filter((l) => l.sorte === onglet);
  const av = apercu ? avant?.n : undefined;
  const titreResultat = [
    ...(n.voyage ? [pluriel(n.voyage, 'voyage') + ecart(n.voyage, av?.voyage)] : []),
    ...(n.sortie ? [pluriel(n.sortie, 'sortie') + ecart(n.sortie, av?.sortie)] : []),
    ...(n.maison ? [t`la maison en ${pluriel(n.maison, 'dossier')}` + ecart(n.maison, av?.maison)] : []),
  ].join(' · ');

  return (
    <section class="resultat-tri" id="resultat-tri">
      <div class="tete-resultat">
        <h2>{titreResultat || t`Vos dossiers`}</h2>
        {apercu && <span class="apercu-badge">{t`Aperçu : rien n’est encore rangé`}</span>}
        {/* Ce qui vaut pour chaque ligne s'écrit une fois, en tête de la liste (C-10.10). */}
        <p class="phrase-noms">
          <Icone nom="info" taille={16} />
          {t`Les noms des dossiers se choisissent plus tard, à l’étape Nommage.`}
        </p>
      </div>
      <nav class="onglets-doublons" aria-label={t`Sortes de dossiers`}>
        {ONGLETS.map(([o, nom]) => (
          <button key={o} type="button" class={`onglet-doublons${o === onglet ? ' actif' : ''}`} aria-current={o === onglet ? 'page' : undefined} onClick={() => (ongletChoisi.value = o)}>
            {nom} <span class="compte gris">{nombre(compte(o))}</span>
          </button>
        ))}
      </nav>
      {onglet === 'apart' ? (
        <MisAPart r={r} />
      ) : (
        <div class="lignes-tri">
          {lignes.map((l, i) => {
            const mois = l.du?.slice(0, 7);
            return (
              <div key={l.cle} class="place-ligne">
                {mois !== lignes[i - 1]?.du?.slice(0, 7) && <h3 class="mois-lignes">{mois ? nomMois(mois) : t`Sans date`}</h3>}
                <Ligne
                  l={l}
                  evts={evts}
                  nouveau={nouveaux.has(repereLigne(l))}
                  apercu={apercu}
                  ouverte={ouverte === l.cle}
                  basculer={() => setOuverte(ouverte === l.cle ? null : l.cle)}
                  voir={voir}
                />
              </div>
            );
          })}
          {!lignes.length && <p class="encart discret">{t`Aucun dossier de cette sorte.`}</p>}
        </div>
      )}
      {/* Hors de la colonne collée (elle forme son propre empilement) : la vue en grand passe au-dessus de tout. */}
      {enGrand && visionneuse.value !== null && createPortal(<Visionneuse elements={enGrand} rangement={false} />, document.body)}
    </section>
  );
}
