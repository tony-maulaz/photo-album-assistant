// Résultat du tri automatique (D103) : après « Ranger », les dossiers faits,
// en cartes dans l'ordre du temps, avec des onglets comme aux Doublons (Tout,
// Voyages, Sorties, À la maison, À vérifier, Mis à part). Une carte montre ses
// dates, des photos réparties sur la période, les étapes d'un voyage et
// l'événement du calendrier pendant lequel la moitié de ses photos ont été
// prises (son nom se choisit au Nommage). « Réunir avec le précédent » et
// « Couper… » corrigent d'un geste ; le détail se fait à l'étape suivante.

import { signal } from '@preact/signals';
import { useMemo, useState } from 'preact/hooks';
import { evenementDesPhotos, evenementsUtiles, type EvenementCalendrier } from '../../lib/ics';
import { t } from '../../lib/langue';
import { deplacerDossier, enchainer, fusionnerDossiers, type FichierPlan, type Modification } from '../../lib/plan';
import { moisDeLaSortie, petitesSorties, repartis, resultatTri, type CarteTri, type ResultatTri as Resultat } from '../../lib/resultatTri';
import { allerEtape, annuler, appliquer, configuration, evenements, notifier, reglages, session, texteErreur, versionIA, versionPlan } from '../etat';
import { nombre, nomJour, nomMois, pluriel } from '../format';
import { vue } from '../organiser';
import { SansGps } from './AidesTri';
import { Miniature } from './GrillePhotos';
import { Icone, type NomIcone } from './Icones';

export type OngletTri = 'tout' | 'voyage' | 'sortie' | 'maison' | 'verifier' | 'apart';

/** Onglet choisi, gardé d'une visite à l'autre de la page. */
const ongletChoisi = signal<OngletTri>('tout');

/** Ouvre un onglet du résultat et l'amène sous les yeux (depuis la liste « À faire »). */
export function montrerOnglet(o: OngletTri) {
  ongletChoisi.value = o;
  requestAnimationFrame(() => document.getElementById('resultat-tri')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

/** Petites sorties que l'utilisateur garde seules (« Les garder seules ») : plus proposées. */
const CLE_GARDEES = 'tri_petites_gardees';

const JOUR_MS = 86_400_000;

/** « Sam. 9 août », ou « Jeu. 24 juillet → Jeu. 7 août · 15 jours ». */
function dates(c: { du?: string; au?: string }): string {
  if (!c.du || !c.au) return t`sans date`;
  if (c.du === c.au) return nomJour(c.du);
  const jours = Math.round((Date.parse(c.au) - Date.parse(c.du)) / JOUR_MS) + 1;
  return t`${nomJour(c.du)} → ${nomJour(c.au)} · ${nombre(jours)} jours`;
}

const ICONES: Record<CarteTri['sorte'], NomIcone> = { voyage: 'voyage', sortie: 'sortie', maison: 'maison' };
const SORTES: Record<CarteTri['sorte'], () => string> = { voyage: () => t`Voyage`, sortie: () => t`Sortie`, maison: () => t`À la maison` };

/** Réunit une carte avec la précédente : une sortie devient une étape d'un voyage, une sortie rejoint la maison, sinon la carte rejoint la précédente. */
function reunir(c: CarteTri, p: CarteTri) {
  const s = session.value!;
  try {
    let m: Modification | null;
    if (p.sorte === 'voyage' && c.sorte !== 'voyage' && p.etapes.length) m = deplacerDossier(s.plan, c.id, p.id);
    else if (c.sorte === 'voyage' && p.sorte !== 'voyage' && c.etapes.length) m = deplacerDossier(s.plan, p.id, c.id);
    else if (c.sorte === 'maison' && p.sorte === 'sortie') m = fusionnerDossiers(s.plan, p.id, c.id);
    else m = fusionnerDossiers(s.plan, c.id, p.id);
    appliquer(m);
    notifier('ok', t`« ${c.nom} » et « ${p.nom} » sont réunis.`, { libelle: t`Annuler`, faire: annuler });
  } catch (err) {
    notifier('erreur', texteErreur(err));
  }
}

/** Ouvre le dossier à l'étape suivante, où l'on coupe une journée ou déplace des photos. */
function couper(c: CarteTri) {
  vue.value = c.id;
  allerEtape('lieux');
  notifier('info', t`Pour couper « ${c.nom} » : sélectionnez les photos à sortir, ou cliquez sur « Nouveau dossier avec cette journée » au-dessus d’une journée.`);
}

function Vignettes({ fichiers, n, taille }: { fichiers: FichierPlan[]; n: number; taille: number }) {
  return (
    <div class="vignettes-carte">
      {repartis(fichiers, n).map((f) => (
        <span key={f.id} title={f.nom}>
          <Miniature f={f} taille={taille} />
        </span>
      ))}
    </div>
  );
}

function Carte({ c, precedente, evts }: { c: CarteTri; precedente?: CarteTri; evts: EvenementCalendrier[] }) {
  const [ouvert, setOuvert] = useState(false);
  const taille = Math.round(reglages.value.tailleMiniatures * 0.6);
  const evt = useMemo(() => evenementDesPhotos(evts, c.fichiers.map((f) => f.date).filter((d): d is string => !!d)), [c, evts]);
  const photos = c.fichiers.filter((f) => f.categorie === 'photo').length;
  const videos = c.fichiers.length - photos;
  return (
    <article class={`carte-tri ${c.sorte}`}>
      <div class="tete-carte">
        <span class="icone-carte" aria-hidden="true">
          <Icone nom={ICONES[c.sorte]} taille={20} />
        </span>
        <div class="titre-carte">
          <div class="ligne-titre">
            <h3 title={c.nom}>{c.nom}</h3>
            <span class="sorte-carte">{SORTES[c.sorte]()}</span>
          </div>
          <span>
            {dates(c)} · <strong>{pluriel(photos, 'photo')}</strong>
            {videos > 0 && ` · ${pluriel(videos, 'vidéo')}`}
          </span>
          {evt && <span class="discret">{t`Calendrier : « ${evt.evenement.titre} » — vous choisirez le nom au Nommage.`}</span>}
        </div>
        <div class="actions-carte">
          {precedente && (
            <button type="button" onClick={() => reunir(c, precedente)} title={t`Réunir avec « ${precedente.nom} »`}>
              {t`Réunir avec le précédent`}
            </button>
          )}
          <button type="button" onClick={() => couper(c)} title={t`Ouvrir ce dossier à l’étape suivante pour le couper`}>
            {t`Couper…`}
          </button>
        </div>
      </div>
      <Vignettes fichiers={c.fichiers} n={6} taille={taille} />
      {c.etapes.length > 1 && (
        <div class="etapes-carte">
          <strong>{pluriel(c.etapes.length, 'étape')} :</strong>
          {c.etapes.map((e) => (
            <span key={e.id} class="pastille-etape">
              {e.nom} · {nombre(e.fichiers.length)}
            </span>
          ))}
          <button type="button" class="lien" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
            {ouvert ? t`Masquer les étapes` : t`Voir les étapes`}
          </button>
        </div>
      )}
      {ouvert && (
        <ul class="liste-etapes">
          {c.etapes.map((e) => (
            <li key={e.id}>
              <div>
                <strong>{e.nom}</strong>
                <span class="discret">
                  {dates(e)} · {pluriel(e.fichiers.length, 'photo')}
                </span>
              </div>
              <Vignettes fichiers={e.fichiers} n={4} taille={Math.round(taille * 0.7)} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Les sorties d'une ou deux photos (souvent prises en passant), puis l'aide facultative pour les photos sans GPS. */
function AVerifier({ r }: { r: Resultat }) {
  const s = session.value!;
  versionIA.value;
  const gardees = new Set(s.aides.get<string[]>(CLE_GARDEES) ?? []);
  const petites = petitesSorties(r)
    .filter((c) => !gardees.has(c.id))
    .map((c) => ({ c, mois: moisDeLaSortie(r, c) }));
  const rangeables = petites.filter((x) => x.mois);
  const garder = (ids: string[]) => void s.aides.set(CLE_GARDEES, [...gardees, ...ids]).then(() => versionIA.value++);
  const mettre = (liste: typeof petites) => {
    try {
      appliquer(enchainer(s.plan, t`Mettre ${pluriel(liste.length, 'petite sortie', 'petites sorties')} avec leur mois`, liste.map((x) => () => fusionnerDossiers(s.plan, x.c.id, x.mois!))));
      notifier('ok', t`${pluriel(liste.length, 'petite sortie mise', 'petites sorties mises')} avec la maison du même mois.`, { libelle: t`Annuler`, faire: annuler });
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };
  const taille = Math.round(reglages.value.tailleMiniatures * 0.5);
  return (
    <div class="a-verifier">
      {petites.length > 0 ? (
        <section class="encart">
          <h3>{pluriel(petites.length, 'sortie d’une ou deux photos', 'sorties d’une ou deux photos')}</h3>
          <p class="discret">{t`Souvent une photo prise en passant. Mettez-les avec la maison du même mois, ou gardez-les seules : l’étape « Petits dossiers » vous les montrera alors une à une, entre leurs voisins.`}</p>
          <p class="actions">
            {rangeables.length > 0 && (
              <button type="button" class="principal" onClick={() => mettre(rangeables)}>
                {t`Mettre ${pluriel(rangeables.length, 'petite sortie', 'petites sorties')} avec leur mois`}
              </button>
            )}
            <button type="button" onClick={() => garder(petites.map((x) => x.c.id))}>
              {t`Les garder seules`}
            </button>
          </p>
          <ul class="petites-sorties">
            {petites.map(({ c, mois }) => (
              <li key={c.id}>
                <Vignettes fichiers={c.fichiers} n={2} taille={taille} />
                <div>
                  <strong>{c.nom}</strong>
                  <span class="discret">{dates(c)}</span>
                </div>
                {mois && (
                  <button type="button" onClick={() => mettre([{ c, mois }])} title={t`Dans « ${s.plan.dossiers.get(mois)?.nom ?? ''} »`}>
                    {t`Avec le mois`}
                  </button>
                )}
                <button type="button" class="lien" onClick={() => garder([c.id])}>
                  {t`Garder seule`}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p class="encart discret">{t`✓ Rien de particulier à vérifier.`}</p>
      )}
      <SansGps />
    </div>
  );
}

function MisAPart({ r }: { r: Resultat }) {
  const taille = Math.round(reglages.value.tailleMiniatures * 0.5);
  const sections: [string, string, FichierPlan[]][] = [
    [t`Captures d’écran`, t`Hors de l’album, dans leur propre dossier. Une vraie photo parmi elles ? Déplacez-la à l’étape suivante.`, r.captures],
    [t`Sans date`, t`Ni l’appareil ni le nom du fichier ne donnent leur date : l’application ne sait pas à quelle sortie elles appartiennent.`, r.sansDate],
    [t`Vidéos seules`, t`Aucune photo prise à quelques heures près : elles sont rangées par mois.`, r.videosSeules],
  ];
  const presentes = sections.filter(([, , l]) => l.length);
  if (!presentes.length) return <p class="encart discret">{t`Rien n’est mis à part.`}</p>;
  return (
    <div class="mis-a-part">
      {presentes.map(([titre, texte, liste]) => (
        <section key={titre} class="encart">
          <h3>
            {titre} <span class="discret">({nombre(liste.length)})</span>
          </h3>
          <p class="discret">{texte}</p>
          <Vignettes fichiers={liste} n={16} taille={taille} />
        </section>
      ))}
    </div>
  );
}

/** `range` : les photos ont été rangées ; sinon les onglets restent grisés. */
export function ResultatTri({ range }: { range: boolean }) {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const domicile = configuration.value?.lecture?.config?.lieux_connus.find((l) => l.domicile)?.nom;
  const r = useMemo(() => resultatTri(s.plan, domicile), [versionPlan.value, domicile]);
  const evts = useMemo(() => evenementsUtiles(evenements.value), [evenements.value]);
  const gardees = new Set(s.aides.get<string[]>(CLE_GARDEES) ?? []);
  const aVerifier = petitesSorties(r).filter((c) => !gardees.has(c.id)).length;
  const compte = (o: OngletTri) => (o === 'tout' ? r.cartes.length : o === 'verifier' ? aVerifier : o === 'apart' ? r.captures.length + r.sansDate.length + r.videosSeules.length : r.cartes.filter((c) => c.sorte === o).length);
  const ONGLETS: [OngletTri, string][] = [
    ['tout', t`Tout`],
    ['voyage', t`Voyages`],
    ['sortie', t`Sorties`],
    ['maison', t`À la maison`],
    ['verifier', t`À vérifier`],
    ['apart', t`Mis à part`],
  ];
  const onglet = ongletChoisi.value;
  const cartes = onglet === 'tout' ? r.cartes : r.cartes.filter((c) => c.sorte === onglet);
  const nVoyages = compte('voyage');
  const nSorties = compte('sortie');
  const nMaison = compte('maison');

  return (
    <section class="resultat-tri" id="resultat-tri">
      <div class="tete-resultat">
        <h2>
          {range && r.cartes.length
            ? [...(nVoyages ? [pluriel(nVoyages, 'voyage')] : []), ...(nSorties ? [pluriel(nSorties, 'sortie')] : []), ...(nMaison ? [t`la maison en ${pluriel(nMaison, 'dossier')}`] : [])].join(' · ')
            : t`Vos dossiers`}
        </h2>
      </div>
      <nav class="onglets-doublons" aria-label={t`Sortes de dossiers`}>
        {ONGLETS.map(([o, nom]) => (
          <button
            key={o}
            type="button"
            class={`onglet-doublons${range && o === onglet ? ' actif' : ''}`}
            aria-current={range && o === onglet ? 'page' : undefined}
            disabled={!range}
            onClick={() => (ongletChoisi.value = o)}
          >
            {nom}{' '}
            {range &&
              (o === 'verifier' ? (
                compte(o) ? <span class="compte">{t`${nombre(compte(o))} à voir`}</span> : <span class="compte fini">✓</span>
              ) : (
                <span class="compte gris">{nombre(compte(o))}</span>
              ))}
          </button>
        ))}
      </nav>
      {!range ? (
        <p class="encart discret vide-resultat">{t`Rangez les photos : les dossiers s’afficheront ici, voyage par voyage et mois par mois.`}</p>
      ) : onglet === 'verifier' ? (
        <AVerifier r={r} />
      ) : onglet === 'apart' ? (
        <MisAPart r={r} />
      ) : (
        <div class="cartes-tri">
          {cartes.map((c, i) => {
            const mois = c.du?.slice(0, 7);
            const nouveauMois = mois !== cartes[i - 1]?.du?.slice(0, 7);
            return (
              <div key={c.id} class="place-carte">
                {nouveauMois && <h3 class="mois-cartes">{mois ? nomMois(mois) : t`Sans date`}</h3>}
                <Carte c={c} precedente={onglet === 'tout' ? cartes[i - 1] : undefined} evts={evts} />
              </div>
            );
          })}
          {!cartes.length && <p class="encart discret">{t`Aucun dossier de cette sorte.`}</p>}
        </div>
      )}
    </section>
  );
}
