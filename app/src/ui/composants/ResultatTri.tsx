// Résultat du tri automatique (D103, D104) : une ligne par voyage, sortie ou
// période à la maison, dans l'ordre du temps, avec des onglets comme aux
// Doublons (Tout, Voyages, Sorties, À la maison, Mis à part). Sans miniatures :
// les dates, le nombre de photos, la distance de la maison, l'événement du
// calendrier et, pour un voyage, ses étapes. Avant de ranger, c'est un aperçu
// recalculé à chaque réglage : ce qui vient d'apparaître est marqué
// « nouveau », et un lieu pas encore nommé par OpenStreetMap ne montre pas de
// nom provisoire. Les corrections se font à l'étape suivante.

import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { evenementDesPhotos, evenementsUtiles, joursEvenement, type EvenementCalendrier } from '../../lib/ics';
import { t } from '../../lib/langue';
import { compteSortes, repereLigne, type EtapeLigne, type LigneTri, type ResultatTri as Resultat, type SorteLigne } from '../../lib/resultatTri';
import { evenements } from '../etat';
import { nombre, nomJour, nomMois, pluriel } from '../format';
import { Icone, type NomIcone } from './Icones';

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

/** Titre d'une ligne : son nom, ou, tant que son lieu n'a pas de nom, l'événement du calendrier ou la date. */
function titre(l: LigneTri, evt: string | undefined): string {
  if (!l.provisoire) return l.nom;
  if (evt) return `« ${evt} »`;
  if (!l.du || !l.au) return SORTES[l.sorte]();
  if (l.du === l.au) return l.sorte === 'voyage' ? t`Voyage du ${nomJour(l.du)}` : t`Sortie du ${nomJour(l.du)}`;
  return l.sorte === 'voyage' ? t`Voyage du ${nomJour(l.du)} au ${nomJour(l.au)}` : t`Sortie du ${nomJour(l.du)} au ${nomJour(l.au)}`;
}

const nomEtape = (e: EtapeLigne, i: number) => (e.provisoire ? t`${i + 1}ᵉ étape` : e.nom);

function Ligne({ l, evts, nouveau }: { l: LigneTri; evts: EvenementCalendrier[]; nouveau: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  // L'événement de l'aperçu est déjà trouvé ; pour un dossier rangé, il se calcule sur ses dates.
  const evt = useMemo(() => {
    if (l.evenement) return l.evenement;
    if (!l.du || !l.au || !l.dates.length) return undefined;
    const pendant = evts.filter((e) => {
      const [d1, d2] = joursEvenement(e);
      return d1 <= l.au! && d2 >= l.du!;
    });
    return pendant.length ? evenementDesPhotos(pendant, l.dates)?.evenement.titre : undefined;
  }, [l, evts]);
  return (
    <article class={`ligne-tri ${l.sorte}${nouveau ? ' nouvelle' : ''}`}>
      <span class="icone-ligne" aria-hidden="true">
        <Icone nom={ICONES[l.sorte]} taille={18} />
      </span>
      <div class="corps-ligne">
        <div class="titre-ligne">
          <h3 title={l.nom}>{titre(l, evt)}</h3>
          <span class="sorte-ligne">{SORTES[l.sorte]()}</span>
          {nouveau && <span class="badge-nouveau">{t`nouveau`}</span>}
        </div>
        <span class="details-ligne">
          {dates(l)} · <strong>{pluriel(l.photos, 'photo')}</strong>
          {l.videos > 0 && ` · ${pluriel(l.videos, 'vidéo')}`}
          {l.km !== undefined && l.sorte !== 'maison' && ` · ${t`à ${nombre(l.km)} km de la maison`}`}
        </span>
        {l.provisoire ? (
          <span class="discret">{t`Le nom du lieu viendra au rangement (OpenStreetMap).`}</span>
        ) : (
          evt && <span class="discret">{t`Calendrier : « ${evt} » — vous choisirez le nom au Nommage.`}</span>
        )}
        {l.etapes.length > 1 && (
          <div class="etapes-ligne">
            <strong>{pluriel(l.etapes.length, 'étape')} :</strong>
            {l.etapes.map((e, i) => (
              <span key={e.cle} class="pastille-etape">
                {nomEtape(e, i)} · {nombre(e.photos)}
              </span>
            ))}
            <button type="button" class="lien" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
              {ouvert ? t`Masquer les étapes` : t`Voir les étapes`}
            </button>
          </div>
        )}
        {ouvert && (
          <ul class="liste-etapes">
            {l.etapes.map((e, i) => (
              <li key={e.cle}>
                <strong>{nomEtape(e, i)}</strong>
                <span class="discret">
                  {dates(e)} · {pluriel(e.photos, 'photo')}
                  {e.km !== undefined && ` · ${t`à ${nombre(e.km)} km de la maison`}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
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
  if (!presentes.length) return <p class="encart discret">{t`Rien n’est mis à part.`}</p>;
  return (
    <ul class="mis-a-part">
      {presentes.map(([titreAPart, texte, n]) => (
        <li key={titreAPart}>
          <strong>
            {titreAPart} <span class="discret">({nombre(n)})</span>
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
    ['apart', t`Mis à part`],
  ];
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
        <p class="discret">
          {apercu
            ? t`Aperçu : rien n’est encore rangé. Il suit vos réglages ; les noms des lieux sont demandés à OpenStreetMap au rangement.`
            : t`Pour couper un dossier ou déplacer des photos : étape suivante, « Lieux et sorties ».`}
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
                <Ligne l={l} evts={evts} nouveau={nouveaux.has(repereLigne(l))} />
              </div>
            );
          })}
          {!lignes.length && <p class="encart discret">{t`Aucun dossier de cette sorte.`}</p>}
        </div>
      )}
    </section>
  );
}
