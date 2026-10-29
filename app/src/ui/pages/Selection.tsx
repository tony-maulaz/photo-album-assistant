// Étape « Sélection » (SPEC § 6.9) : l'utilisateur choisit les photos de
// l'album (★, ★★ grande photo) avec une boîte à outils locale et gratuite :
// tri rapide, piles, comparateur, indicateurs, redondances, équilibre, cible.

import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LIBELLES_DEFAUTS, LIBELLES_PERSONNES, LIBELLES_TYPES } from '../../lib/aidesSelection';
import { LIBELLES_SIGNAUX, type Signal } from '../../lib/indicateurs';
import { cheminDossier, RACINE, type FichierPlan } from '../../lib/plan';
import { arrivees, avancement, copiesRetenues, equilibre, groupesParJour, periodesEquilibre, redondances, type GroupeJour, type Periode } from '../../lib/selection';
import { BarreValidation, garderFocus, RaisonDesactivee } from '../composants/Cadre';
import { annulerIci, EnteteCadre, OutilsCadre, PanneauAide, retablirIci, useCadre, useMenuListe } from '../composants/CadreCommun';
import { Comparateur } from '../composants/Comparateur';
import { EncartAnalyse } from '../composants/Analyse';
import { GrillePhotos, photoAMontrer } from '../composants/GrillePhotos';
import { Icone } from '../composants/Icones';
import { PanneauDossiers, styleLargeurPanneau, TitreVue } from '../composants/PanneauDossiers';
import { TriRapide } from '../composants/TriRapide';
import { DialogueDeplacer } from '../composants/Visionneuse';
import { changerAlbum, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { aTraduire, langue, t } from '../../lib/langue';
import { dateHeure, jourCourt, nombre, pluriel } from '../format';
import { ancre, choisirVue, deplacerOuvert, selection, vue, VUE_AUTRES, VUE_MIS_DE_COTE } from '../organiser';
import {
  avecPiles,
  choisir,
  comparaison,
  empiler,
  filtrer,
  filtres,
  FILTRES_DEFAUT,
  infosPhotos,
  pilesOuvertes,
  pilesParPhoto,
  photosVue,
  recadrageOuvert,
  tournerPhotos,
  triRapide,
  type Filtres,
  type InfoPhoto,
  type ResultatsIA,
} from '../selection';
import { Recadreur } from '../composants/Recadreur';
import { AidesSelection, lignesIA, resultatsSelection } from './AidesPhotos';

function estChampDeSaisie(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/** L'état d'une photo, écrit dans la bande sous elle (C-9.2) : ambre pour l'album, blanc pour le reste. */
function etatAlbum(album: FichierPlan['album']): { classe: string; libelle: ComponentChildren } {
  if (album === 1)
    return {
      classe: 'album',
      libelle: (
        <>
          <span class="etoiles a1">★</span>
          {t`Dans l’album`}
        </>
      ),
    };
  if (album === 2)
    return {
      classe: 'grande',
      libelle: (
        <>
          <span class="etoiles a2">★★</span>
          {t`Grande`}
        </>
      ),
    };
  if (album === 0)
    return {
      classe: 'pas',
      libelle: (
        <>
          <Icone nom="croix" taille={16} />
          {t`Pas pour l’album`}
        </>
      ),
    };
  return { classe: 'decider', libelle: t`À décider` };
}
/** Les quatre choix d'une photo, en toutes lettres (Comparer en grand). */
const CHOIX_PHOTO = [
  [1, aTraduire('★ Dans l’album')],
  [2, aTraduire('★★ Grande')],
  [0, aTraduire('Pas pour l’album')],
  [undefined, aTraduire('À décider')],
] as const;
const CLASSE_CHOIX = { 0: 'pas', 1: 'album', 2: 'grande' } as const;

/** Avancement vers la cible de l'album (outil « Cible » et « Valider et continuer »). */
function avancementCible(photos: FichierPlan[]) {
  const s = session.value!;
  return avancement(photos, { ...s.album, mode: s.album.cible.mode, nombre: s.album.cible.nombre, photosParPage: s.album.photosParPage });
}

const locale = () => (langue() === 'en' ? 'en-GB' : 'fr-CH');

/** « Samedi 27 juin 2025 » depuis « 2025-06-27 ». */
function jourLong(jour: string): string {
  const [a, m, j] = jour.split('-').map(Number);
  const texte = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a, m - 1, j));
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** « juin 2025 » (ou « juin 25 » en court) depuis « 2025-06 ». */
function mois(cle: string, court = false): string {
  const [a, m] = cle.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { month: court ? 'short' : 'long', year: court ? '2-digit' : 'numeric' }).format(new Date(a, m - 1, 1));
}

/** Nom de dossier qui peut passer à la ligne après « _ », « - » ou « . », jamais au milieu d'un mot. */
function coupable(nom: string): ComponentChildren {
  return nom.split(/(?<=[_.-])/).flatMap((morceau, i) => (i ? [<wbr key={i} />, morceau] : [morceau]));
}

/**
 * Marques au bout de la bande (C-9.6) : tournée, recadrée, pile de photos semblables. La pile se
 * déplie d'un clic sur sa marque ; le reste est dans l'infobulle.
 */
function MarquesBande({ f, pile, ouverte }: { f: FichierPlan; pile?: string[]; ouverte: boolean }) {
  return (
    <>
      {f.rotation ? (
        <span class="badge rotation" title={t`Tournée de ${f.rotation}° pour l’album (touche R)`}>
          <Icone nom="tourner" taille={16} titre={t`Tournée`} />
        </span>
      ) : null}
      {f.recadrage ? (
        <span class="marque-recadree" title={t`Recadrée pour l’album (touche K pour changer)`}>
          <Icone nom="recadrer" taille={16} titre={t`Recadrée`} />
        </span>
      ) : null}
      {pile && pile[0] === f.id && (
        <button
          type="button"
          class="badge-pile"
          title={ouverte ? t`Replier la pile` : t`Pile de ${pile.length} photos semblables : cliquer pour la déplier`}
          aria-expanded={ouverte}
          onClick={(e) => {
            e.stopPropagation();
            const n = new Set(pilesOuvertes.value);
            if (n.has(pile[0])) n.delete(pile[0]);
            else n.add(pile[0]);
            pilesOuvertes.value = n;
          }}
        >
          <Icone nom="pile" taille={16} titre={ouverte ? t`Replier` : t`Déplier`} />
          {pile.length}
        </button>
      )}
      {pile && pile[0] !== f.id && (
        <span class="badge-pile dans-pile" title={t`Dans une pile de photos semblables`}>
          <Icone nom="pile" taille={16} titre={t`Dans une pile`} />
        </span>
      )}
    </>
  );
}

/** La remarque sous la bande (C-9.6) : l'heure, les signaux, la note de l'IA ; la description de l'IA en seconde ligne. */
function RemarqueSelection({ quand, signaux, note, choixIA, description }: { quand: string; signaux: Signal[]; note?: number; choixIA?: string; description?: string }) {
  return (
    <>
      <span class="ligne-remarque">
        <span class="num">{quand}</span>
        {signaux.map((x) => (
          <span key={x}>
            {' · '}
            <span class={`signal ${x}`}>{t(LIBELLES_SIGNAUX[x])}</span>
          </span>
        ))}
        {note !== undefined && (
          <>
            {' · '}
            <span class="badge note-ia" title={t`Appréciation indicative de l’IA : ${note}/10`}>
              <Icone nom="etincelle" taille={14} titre={t`Selon l’IA`} />
              {note}/10
            </span>
          </>
        )}
        {choixIA && (
          <>
            {' · '}
            <span class="badge choix-ia" title={t`Meilleure de sa pile selon l’IA : ${choixIA}`}>
              <Icone nom="etincelle" taille={14} titre={t`Selon l’IA`} />
              {t`choix IA`}
            </span>
          </>
        )}
      </span>
      {description !== undefined && <span class="ligne-remarque description-ia">{description}</span>}
    </>
  );
}

function Cible({ photos }: { photos: FichierPlan[] }) {
  const s = session.value!;
  const c = s.album.cible;
  const a = avancementCible(photos);
  const unite = c.mode === 'pages' ? t`pages` : t`photos`;
  return (
    <section class="outil">
      <h3>{t`Cible`}</h3>
      <div class="ligne-cible">
        <input
          type="number"
          class="court"
          min="1"
          value={c.nombre}
          onChange={(e) => changerAlbum({ cible: { ...c, nombre: Math.max(1, Number(e.currentTarget.value) || 1) } })}
          aria-label={t`Nombre visé`}
        />
        <select value={c.mode} onChange={(e) => changerAlbum({ cible: { ...c, mode: e.currentTarget.value as 'pages' | 'photos' } })} aria-label={t`Unité`}>
          <option value="pages">{t`pages`}</option>
          <option value="photos">{t`photos`}</option>
        </select>
        <label title={t`Photos par page dans l’album ifolor (une ★★ occupe une page)`}>
          <input
            type="number"
            class="tres-court"
            min="1"
            max="12"
            value={s.album.photosParPage}
            onChange={(e) => changerAlbum({ photosParPage: Math.max(1, Math.min(12, Number(e.currentTarget.value) || 1)) })}
          />{' '}
          {t`par page`}
        </label>
      </div>
      <div class="jauge-cible" role="progressbar" aria-valuenow={Math.round(a.pourcent)}>
        <div class={`rempli${a.pourcent > 105 ? ' trop' : ''}`} style={{ width: `${Math.min(100, a.pourcent)}%` }} />
      </div>
      <p class="discret">
        {t`${nombre(a.valeur)} sur ${nombre(c.nombre)} ${unite}, soit ${nombre(a.pourcent)} %`} · {pluriel(a.retenues, 'photo dans l’album', 'photos dans l’album')}
        {a.grandes ? t`, dont ${pluriel(a.grandes, 'grande ★★', 'grandes ★★')}` : ''} · {t`${nombre(a.aDecider)} à décider`}
      </p>
    </section>
  );
}

function Equilibre({ photos }: { photos: FichierPlan[] }) {
  const s = session.value!;
  const e = equilibre(photos);
  // Une barre par jour, ou par mois quand les jours seraient trop nombreux pour être lisibles.
  const { unite, periodes } = periodesEquilibre(e.jours);
  const [pointee, setPointee] = useState<Periode | null>(null);
  const max = Math.max(1, ...periodes.map((p) => p.disponibles));
  const sansRien = e.sorties.filter((x) => x.retenues === 0 && x.disponibles > 0);
  const nom = (p: Periode, court = false) => (unite === 'jour' ? jourCourt(p.cle) : mois(p.cle, court));
  const detail = (p: Periode) => t`${nom(p)} : ${nombre(p.retenues)} sur ${pluriel(p.disponibles, 'photo')} dans l’album`;
  const active = periodes.find((p) => p.cle === filtres.value.jour);
  const lue = pointee ?? active;
  return (
    <section class="outil">
      <h3>{unite === 'jour' ? t`Équilibre par jour` : t`Équilibre par mois`}</h3>
      {periodes.length > 0 && (
        <>
          <div class="barres-jours" role="group" aria-label={unite === 'jour' ? t`Photos dans l’album, par jour` : t`Photos dans l’album, par mois`}>
            {periodes.map((p) => (
              <button
                type="button"
                key={p.cle}
                class={`barre-jour${filtres.value.jour === p.cle ? ' actif' : ''}`}
                title={`${detail(p)} — ${unite === 'jour' ? t`cliquer pour n’afficher que ce jour` : t`cliquer pour n’afficher que ce mois`}`}
                aria-label={detail(p)}
                aria-pressed={filtres.value.jour === p.cle}
                onMouseEnter={() => setPointee(p)}
                onMouseLeave={() => setPointee(null)}
                onFocus={() => setPointee(p)}
                onBlur={() => setPointee(null)}
                onClick={() => (filtres.value = { ...filtres.value, jour: filtres.value.jour === p.cle ? '' : p.cle })}
              >
                <span class="dispo" style={{ height: `${(p.disponibles / max) * 100}%` }} />
                <span class="retenues" style={{ height: `${(p.retenues / max) * 100}%` }} />
              </button>
            ))}
          </div>
          <div class="axe-barres discret" aria-hidden="true">
            <span>{nom(periodes[0], true)}</span>
            {periodes.length > 1 && <span>{nom(periodes.at(-1)!, true)}</span>}
          </div>
          <p class={`lecture-barre${lue ? '' : ' discret'}`}>{lue ? detail(lue) : t`Pointez une barre pour voir sa date ; un clic n’affiche que ses photos.`}</p>
        </>
      )}
      <p class="discret legende-barres">
        <span class="pastille dispo" /> {t`disponibles`} <span class="pastille retenues" /> {t`dans l’album`}
      </p>
      {sansRien.length > 0 && (
        <div class="alertes-outil">
          <strong>{t`${pluriel(sansRien.length, 'sortie sans photo retenue', 'sorties sans photo retenue')} :`}</strong>
          <ul class="sorties-sans-photo">
            {sansRien.slice(0, 8).map((x) => (
              <li key={x.dossier}>
                <button type="button" class="lien" onClick={() => choisirVue(x.dossier)} title={cheminDossier(s.plan, x.dossier) || 'Photos'}>
                  {coupable(s.plan.dossiers.get(x.dossier)?.nom ?? 'Photos')}
                </button>{' '}
                <span class="discret">({nombre(x.disponibles)})</span>
              </li>
            ))}
          </ul>
          {sansRien.length > 8 && <p class="discret">{t`… et ${pluriel(sansRien.length - 8, 'autre')}.`}</p>}
        </div>
      )}
    </section>
  );
}

function Redondances({ photos, infos }: { photos: FichierPlan[]; infos: Map<string, InfoPhoto> }) {
  const s = session.value!;
  const choix = photos.map((p) => ({ id: p.id, dossier: p.dossier, date: p.date, phash: infos.get(p.id)?.indicateurs?.phash, album: p.album, empreinte: p.empreinte }));
  const groupes = redondances(choix);
  // Copies exactes retenues dans des dossiers différents : la même photo serait deux fois dans l'album.
  const copies = copiesRetenues(choix);
  if (!groupes.length && !copies.length) return null;
  const nomDossier = (id: string) => s.plan.dossiers.get(s.plan.fichiers.get(id)?.dossier ?? '')?.nom ?? '';
  return (
    <section class="outil">
      <h3>{t`Redondances`}</h3>
      <ul class="liste-courte">
        {copies.map((g) => {
          const dossiers = [...new Set(g.map(nomDossier))];
          return (
            <li key={`copie:${g[0]}`}>
              {t`Même photo retenue dans ${pluriel(dossiers.length, 'dossier')} (${dossiers.join(', ')})`}{' '}
              <button type="button" class="lien" onClick={() => (comparaison.value = g.slice(0, 4))}>
                {t`comparer`}
              </button>
            </li>
          );
        })}
        {groupes.slice(0, 12).map((g) => {
          const f = s.plan.fichiers.get(g[0])!;
          return (
            <li key={g[0]}>
              {t`${nombre(g.length)} photos très semblables dans l’album : ${s.plan.dossiers.get(f.dossier)?.nom ?? ''}, ${f.date?.slice(11, 16) ?? ''}`}{' '}
              <button type="button" class="lien" onClick={() => (comparaison.value = g.slice(0, 4))}>
                {t`comparer`}
              </button>
            </li>
          );
        })}
      </ul>
      {groupes.length > 12 && <p class="discret">{t`… et ${pluriel(groupes.length - 12, 'autre')}.`}</p>}
    </section>
  );
}

/** Filtres du choix, en pastilles dans la barre d'outils (C-4.8) : valeur, libellé (traduit à l'affichage), photos comptées. */
const CHOIX: [Filtres['etoiles'], string, ((f: FichierPlan) => boolean) | null][] = [
  ['toutes', aTraduire('Toutes'), null],
  ['a_decider', aTraduire('À décider'), (f) => f.album === undefined],
  ['retenues', aTraduire('Dans l’album'), (f) => (f.album ?? 0) >= 1],
  ['non', aTraduire('Pas pour l’album'), (f) => f.album === 0],
];

/** « Afficher : Toutes · À décider · Dans l'album · Pas pour l'album », chaque pastille avec son compte. */
function BarreChoix({ photos, infos, ia }: { photos: FichierPlan[]; infos: Map<string, InfoPhoto>; ia: ResultatsIA }) {
  const f = filtres.value;
  // Chaque compte dit combien de photos donnerait la pastille, avec les autres filtres en place.
  const avecChoix = filtrer(photos, infos, { ...f, etoiles: 'toutes' }, ia);
  return (
    <>
      <span class="mot-afficher">{t`Afficher :`}</span>
      <div class="pastilles-filtre" role="group" aria-label={t`Choix`}>
        {CHOIX.map(([valeur, libelle, compter]) => (
          <button key={valeur} type="button" class={`pastille-filtre${f.etoiles === valeur ? ' actif' : ''}`} aria-pressed={f.etoiles === valeur} onClick={() => (filtres.value = { ...f, etoiles: valeur })}>
            {valeur === 'retenues' && <span class="etoiles a1">★</span>}
            {t(libelle)}
            <span class="compte">{nombre(compter ? avecChoix.filter(compter).length : avecChoix.length)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** Nombre de filtres de « Filtres ▾ » en place (Grandes, Nouvelles, piles, jour, appareil…). */
function filtresActifs(f: Filtres, piles: boolean): number {
  return (
    (['jour', 'appareil', 'signal', 'tri', 'personnes', 'typePhoto', 'defaut', 'arrivee'] as const).filter((k) => f[k] !== FILTRES_DEFAUT[k]).length +
    (f.etoiles === 'grandes' ? 1 : 0) +
    (piles ? 1 : 0)
  );
}

/** « Filtres ▾ » déplié sous la tête de la table : Grandes, Nouvelles, piles, jour, appareil, indicateurs, ordre, IA. */
function FiltresTable({ photos, infos, ia }: { photos: FichierPlan[]; infos: Map<string, InfoPhoto>; ia: ResultatsIA }) {
  const etiquetees = Object.keys(ia.etiquettes).length > 0;
  const appreciees = Object.keys(ia.appreciations).length > 0;
  const f = filtres.value;
  const changer = (m: Partial<Filtres>) => (filtres.value = { ...f, ...m });
  const jours = [...new Set(photos.map((p) => p.date?.slice(0, 10)).filter((j): j is string => !!j))].sort();
  const appareils = [...new Set(photos.map((p) => p.appareil ?? ''))].sort();
  const signaux = new Set([...infos.values()].flatMap((i) => i.signaux));
  // Photos arrivées après le premier tri (mise à jour de l'inventaire, D63), par jour d'arrivée.
  const jourArrivees = arrivees(photos);
  const grandes = filtrer(photos, infos, { ...f, etoiles: 'grandes' }, ia).length;
  const nouvelles = filtrer(photos, infos, { ...f, arrivee: 'nouvelles' }, ia).length;
  const actif = JSON.stringify(f) !== JSON.stringify(FILTRES_DEFAUT) || empiler.value;
  return (
    <div class="filtres-table barre-filtres" role="group" aria-label={t`Filtres`}>
      <button
        type="button"
        class={`pastille-filtre${f.etoiles === 'grandes' ? ' actif' : ''}`}
        aria-pressed={f.etoiles === 'grandes'}
        title={t`Seulement les grandes photos ★★ (pleine page)`}
        onClick={() => changer({ etoiles: f.etoiles === 'grandes' ? 'toutes' : 'grandes' })}
      >
        <span class="etoiles a2">★★</span>
        {t`Grandes`}
        <span class="compte">{nombre(grandes)}</span>
      </button>
      {jourArrivees.length > 0 && (
        <button
          type="button"
          class={`pastille-filtre filtre-nouvelles${f.arrivee ? ' actif' : ''}`}
          aria-pressed={!!f.arrivee}
          title={
            jourArrivees.length === 1
              ? t`Photos arrivées le ${jourCourt(jourArrivees[0].jour)}, par une mise à jour de l’inventaire`
              : t`Photos arrivées après le premier tri, par une mise à jour de l’inventaire`
          }
          onClick={() => changer({ arrivee: f.arrivee ? '' : 'nouvelles' })}
        >
          {t`Nouvelles`}
          <span class="compte">{nombre(nouvelles)}</span>
        </button>
      )}
      <label class="case case-piles" title={t`Empiler les photos semblables : une seule visible par groupe`}>
        <input type="checkbox" checked={empiler.value} onChange={(e) => (empiler.value = e.currentTarget.checked)} /> {t`Ranger les presque pareilles en pile`}
      </label>
      <div class="filtres-secondaires">
        <select value={f.jour} onChange={(e) => changer({ jour: e.currentTarget.value })} aria-label={t`Jour`}>
          <option value="">{t`Tous les jours`}</option>
          {/* Un mois choisi dans l'équilibre (barres par mois). */}
          {f.jour.length === 7 && <option value={f.jour}>{mois(f.jour)}</option>}
          {jours.map((j) => (
            <option key={j} value={j}>
              {jourCourt(j)}
            </option>
          ))}
        </select>
        {jourArrivees.length > 1 && (
          <select value={f.arrivee} onChange={(e) => changer({ arrivee: e.currentTarget.value })} aria-label={t`Arrivée`}>
            <option value="">{t`Toutes les arrivées`}</option>
            <option value="nouvelles">{t`Nouvelles seulement`}</option>
            {jourArrivees.map((a) => (
              <option key={a.jour} value={a.jour}>
                {t`Arrivées le ${jourCourt(a.jour)} (${nombre(a.n)})`}
              </option>
            ))}
          </select>
        )}
        {appareils.length > 1 && (
          <select value={f.appareil} onChange={(e) => changer({ appareil: e.currentTarget.value })} aria-label={t`Appareil`}>
            <option value="">{t`Tous les appareils`}</option>
            {appareils.map((a) => (
              <option key={a} value={a}>
                {a || t`appareil inconnu`}
              </option>
            ))}
          </select>
        )}
        <select value={f.signal} onChange={(e) => changer({ signal: e.currentTarget.value as Filtres['signal'] })} aria-label={t`Indicateurs`}>
          <option value="tous">{t`Tous les indicateurs`}</option>
          <option value="aucun">{t`Sans défaut signalé`}</option>
          {(Object.keys(LIBELLES_SIGNAUX) as Signal[])
            .filter((s) => signaux.has(s))
            .map((s) => (
              <option key={s} value={s}>
                {t(LIBELLES_SIGNAUX[s])}
              </option>
            ))}
        </select>
        <select value={f.tri} onChange={(e) => changer({ tri: e.currentTarget.value as Filtres['tri'] })} aria-label={t`Tri`}>
          <option value="date">{t`Par date`}</option>
          <option value="nettete">{t`Les plus nettes d’abord`}</option>
          {appreciees && <option value="appreciation">{t`Par appréciation (IA)`}</option>}
        </select>
        {etiquetees && (
          <>
            <select value={f.personnes} onChange={(e) => changer({ personnes: e.currentTarget.value })} aria-label={t`Personnes`}>
              <option value="">{t`Personnes : toutes`}</option>
              {Object.entries(LIBELLES_PERSONNES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select value={f.typePhoto} onChange={(e) => changer({ typePhoto: e.currentTarget.value })} aria-label={t`Type de photo`}>
              <option value="">{t`Tous les types`}</option>
              {Object.entries(LIBELLES_TYPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select value={f.defaut} onChange={(e) => changer({ defaut: e.currentTarget.value })} aria-label={t`Défauts`}>
              <option value="">{t`Défauts : tous`}</option>
              <option value="aucun">{t`Sans défaut (IA)`}</option>
              {Object.entries(LIBELLES_DEFAUTS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {actif && (
        <button
          type="button"
          class="lien"
          onClick={() => {
            filtres.value = FILTRES_DEFAUT;
            empiler.value = false;
          }}
        >
          {t`Effacer les filtres`}
        </button>
      )}
    </div>
  );
}

/** Une décision du bloc fixe : allumée quand toutes les photos choisies l'ont déjà (C-4.9). */
function BoutonDecision({ valeur, photos, plein, classe, titre, children }: { valeur: 0 | 1 | 2 | undefined; photos: FichierPlan[]; plein?: boolean; classe: string; titre: string; children: ComponentChildren }) {
  const on = photos.length > 0 && photos.every((f) => f.album === valeur);
  return (
    <button
      type="button"
      class={`decision ${classe}${plein ? ' principal' : ''}${on ? ' on' : ''}`}
      aria-pressed={on}
      title={titre}
      onMouseDown={garderFocus}
      onClick={() => choisir(
        photos.map((f) => f.id),
        valeur,
      )}
    >
      {children}
    </button>
  );
}

/** Un outil de la photo choisie, avec sa touche ; désactivé, sa raison est écrite dessous (C-4.7). */
function OutilPhoto({ icone, libelle, touche, raison, id, titre, onClick }: { icone: 'croix' | 'tourner' | 'recadrer' | 'comparer' | 'dossierPlus'; libelle: string; touche: string; raison?: string | false; id: string; titre?: string; onClick: () => void }) {
  return (
    <button type="button" class="outil-photo" disabled={!!raison} aria-describedby={raison ? id : undefined} onMouseDown={garderFocus} onClick={onClick} title={titre ?? t`Touche ${touche}`}>
      <Icone nom={icone} taille={16} />
      <span class="texte-outil">
        {libelle}
        <RaisonDesactivee id={id} raison={raison} />
      </span>
      <kbd>{touche}</kbd>
    </button>
  );
}

/**
 * Colonne de droite (C-8.7 proposée) : « N photos choisies », avec le bloc fixe des décisions (« Dans
 * l'album » plein tant que des photos choisies n'y sont pas), puis les outils de la photo ; sans photo
 * choisie, « L'album » : la cible, l'équilibre, les redondances et les aides de l'IA.
 */
function PanneauChoix({ choisies, plein, album, compact = false }: { choisies: FichierPlan[]; plein: boolean; album: ComponentChildren; compact?: boolean }) {
  const n = choisies.length;
  const ids = choisies.map((f) => f.id);
  return (
    <aside class={`panneau-cadre panneau-choix${compact ? ' compact' : ''}`} aria-label={n ? t`Photos choisies` : t`L’album`}>
      <div class="haut-panneau">
        <div class="tete-col">
          <h2>{n ? pluriel(n, 'photo choisie', 'photos choisies') : t`L’album`}</h2>
        </div>
        {n > 0 && (
          <div class="bloc-fixe">
            <BoutonDecision valeur={1} photos={choisies} plein={plein} classe="album" titre={t`Touche Espace ou 1`}>
              <span class="etoiles a1">★</span>
              {t`Dans l’album`}
            </BoutonDecision>
            <div class="deux-decisions">
              <BoutonDecision valeur={2} photos={choisies} classe="grande" titre={t`Touche 2 : pleine page`}>
                <span class="etoiles a2">★★</span>
                {t`Grande`}
              </BoutonDecision>
              <BoutonDecision valeur={undefined} photos={choisies} classe="decider" titre={t`Retour arrière ou Suppr`}>
                {t`À décider`}
              </BoutonDecision>
            </div>
            <BoutonDecision valeur={0} photos={choisies} classe="pas" titre={t`Touche X`}>
              <Icone nom="croix" taille={16} />
              {t`Pas pour l’album`}
            </BoutonDecision>
          </div>
        )}
      </div>
      {!compact && (
        <div class="defile-col">
          {n > 0 && (
            <div class="outils-choix" role="group" aria-label={t`Outils des photos choisies`}>
              <OutilPhoto icone="croix" libelle={t`Ne plus choisir`} touche={t`Échap`} id="raison-ne-plus" onClick={() => (selection.value = new Set())} />
              <OutilPhoto icone="tourner" libelle={t`Tourner`} touche="R" id="raison-tourner" titre={t`Tourner d’un quart de tour (touche R ; Maj+R : dans l’autre sens)`} onClick={() => tournerPhotos(ids, 90)} />
              <OutilPhoto icone="recadrer" libelle={t`Recadrer et tourner…`} touche="K" id="raison-recadrer" raison={n !== 1 && t`une photo à la fois`} onClick={() => (recadrageOuvert.value = ids[0])} />
              <OutilPhoto icone="comparer" libelle={t`Comparer en grand`} touche="C" id="raison-comparer" raison={(n < 2 || n > 4) && t`de 2 à 4 photos`} onClick={() => (comparaison.value = ids.slice(0, 4))} />
              <OutilPhoto icone="dossierPlus" libelle={t`Déplacer vers une sortie…`} touche="M" id="raison-deplacer" onClick={() => (deplacerOuvert.value = true)} />
              <p class="discret rappel-choix">{t`Ctrl+clic ajoute une photo ; Maj+clic choisit une suite.`}</p>
            </div>
          )}
          {n > 0 && <h3 class="titre-section-panneau">{t`L’album`}</h3>}
          {album}
        </div>
      )}
    </aside>
  );
}

/**
 * Ligne 1 de la barre du bas (C-8.5) : ce que devient ce qui reste, en deux phrases courtes, pour tenir
 * sur deux lignes au palier avec des nombres à 4 chiffres.
 */
function ResumeSelection({ retenues, aDecider, cible }: { retenues: number; aDecider: number; cible: ReturnType<typeof avancementCible> }) {
  const c = session.value!.album.cible;
  const reste = aDecider === 0 ? t`Plus aucune photo à décider.` : aDecider === 1 ? t`La photo à décider reste rangée, hors de l’album.` : t`Les ${nombre(aDecider)} à décider restent rangées, hors de l’album.`;
  const dans =
    retenues === 0
      ? t`Aucune photo dans l’album pour l’instant.`
      : c.mode === 'pages'
        ? t`${pluriel(retenues, 'photo dans l’album', 'photos dans l’album')} : ${nombre(cible.valeur)} pages sur ${nombre(c.nombre)} visées.`
        : t`${pluriel(retenues, 'photo dans l’album', 'photos dans l’album')} sur ${nombre(c.nombre)} visées.`;
  return (
    <>
      <strong>{dans}</strong> {reste}
    </>
  );
}

/** Titre d'une journée dans la grille : la date, les sorties (si la vue en a plusieurs) et le nombre de photos. */
function TitreJour({ g, vueActuelle }: { g: GroupeJour; vueActuelle: string }) {
  const s = session.value!;
  const autres = g.dossiers.filter((d) => d !== vueActuelle);
  const noms = autres.slice(0, 2).map((d) => s.plan.dossiers.get(d)?.nom ?? '');
  return (
    <>
      <strong>{g.jour ? jourLong(g.jour) : t`Sans date`}</strong>
      <span class="discret">
        {noms.length ? `${noms.join(', ')}${autres.length > 2 ? ` +${autres.length - 2}` : ''} · ` : ''}
        {pluriel(g.n, 'photo')}
      </span>
    </>
  );
}

export function PageSelection() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const plan = s.plan;
  if (vue.value === VUE_MIS_DE_COTE || vue.value === VUE_AUTRES || !plan.dossiers.has(vue.value)) choisirVue(RACINE);
  const v = vue.value;
  const toutes = useMemo(() => photosVue(plan, RACINE), [versionPlan.value]);
  const infos = useMemo(() => infosPhotos(plan, s.analyses), [versionPlan.value, versionIA.value]);
  const dansVue = v === RACINE ? toutes : photosVue(plan, v);
  const ia = resultatsSelection(s);
  const filtrees = filtrer(dansVue, infos, filtres.value, ia);
  const scenes = useMemo(() => Object.values(s.doublons?.dossiers ?? {}).flatMap((d) => d.scenes), [s.doublons]);
  const pilesDe = useMemo(() => (empiler.value ? pilesParPhoto(filtrees, infos, scenes) : new Map<string, string[]>()), [empiler.value, versionPlan.value, versionIA.value, v, JSON.stringify(filtres.value)]);
  const elements = empiler.value ? avecPiles(filtrees, pilesDe, pilesOuvertes.value) : filtrees;
  const choisis = selection.value;

  // On arrive sur toutes les photos du projet (le panneau sert ensuite de filtre par sortie).
  useEffect(() => choisirVue(RACINE), []);

  // Photo à montrer (résultat d'une aide IA) cachée par les filtres, une pile fermée ou la sortie affichée : on la rend visible.
  const aMontrer = photoAMontrer.value;
  const essais = useRef(0);
  useEffect(() => {
    if (!aMontrer || elements.some((f) => f.id === aMontrer)) {
      essais.current = 0;
      return;
    }
    if (essais.current++ > 3) photoAMontrer.value = null;
    else if (!dansVue.some((f) => f.id === aMontrer)) {
      if (!toutes.some((f) => f.id === aMontrer)) photoAMontrer.value = null;
      else {
        choisirVue(RACINE);
        selection.value = new Set([aMontrer]);
        ancre.value = aMontrer;
      }
    } else if (!filtrees.some((f) => f.id === aMontrer)) filtres.value = FILTRES_DEFAUT;
    else if (pilesDe.has(aMontrer)) pilesOuvertes.value = new Set([...pilesOuvertes.value, pilesDe.get(aMontrer)![0]]);
  }, [aMontrer, elements]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (estChampDeSaisie(e) || deplacerOuvert.value || triRapide.value || comparaison.value || recadrageOuvert.value) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const ids = [...selection.value];
      const k = e.key;
      // Espace et Entrée sur un bouton, un lien ou un menu : c'est ce bouton qui agit, pas le raccourci de la page
      // (sinon Espace sur « Pas pour l'album » mettait les photos dans l'album ; tour 1 du lot 4).
      if ((k === ' ' || k === 'Enter') && (e.target as HTMLElement | null)?.closest?.('button, a, summary, [role=button], [role=radio], [role=menuitem], [role=checkbox]')) return;
      if (ctrl && k.toLowerCase() === 'z' && !e.shiftKey) annulerIci();
      else if (ctrl && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) retablirIci();
      else if (ctrl && k.toLowerCase() === 'a') selection.value = new Set(courantRef.elements.map((f) => f.id));
      else if (ctrl) return;
      else if ((k === ' ' || k === '1') && ids.length) choisir(ids, 1);
      else if (k === '2' && ids.length) choisir(ids, 2);
      else if (k.toLowerCase() === 'x' && ids.length) choisir(ids, 0);
      else if ((k === 'Backspace' || k === 'Delete') && ids.length) choisir(ids, undefined);
      else if (k.toLowerCase() === 'r' && ids.length) tournerPhotos(ids, e.shiftKey ? -90 : 90);
      else if (k.toLowerCase() === 'k' && ids.length === 1) recadrageOuvert.value = ids[0];
      else if (k.toLowerCase() === 'm' && ids.length) deplacerOuvert.value = true;
      else if (k.toLowerCase() === 'c' && ids.length >= 2) comparaison.value = ids.slice(0, 4);
      else if (k === 'Enter' || k.toLowerCase() === 't') ouvrirTri();
      else if (k === 'Escape') selection.value = new Set();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);

  // Le gestionnaire de touches est créé une fois : il relit la liste affichée ici.
  courantRef.elements = elements;

  function ouvrirTri(depuis?: number) {
    const liste = courantRef.elements;
    if (!liste.length) return;
    const premier = depuis ?? Math.max(0, liste.findIndex((f) => f.id === (ancre.value ?? '')));
    triRapide.value = { ids: liste.map((f) => f.id), index: premier };
  }

  const nonDecidees = filtrees.filter((f) => f.album === undefined).length;
  const total = avancement(toutes, { mode: 'photos', nombre: 1, photosParPage: 1 });
  const cible = avancementCible(toutes);
  const fini = total.retenues > 0 && (total.aDecider === 0 || cible.pourcent >= 100);
  const titreVue = v === RACINE ? t`Toutes les photos` : (plan.dossiers.get(v)?.nom ?? '');
  const comparees = comparaison.value?.map((id) => plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f) ?? [];
  const choisies = [...choisis].map((id) => plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f);
  // Un seul bouton plein (C-4.1, C-7.1 bis) : « Valider et continuer » une fois l'étape finie ; sinon « Dans
  // l'album » tant que des photos choisies n'y sont pas ; sinon « Tri rapide », dans la tête de la table.
  const plein = fini ? 'valider' : choisies.some((f) => (f.album ?? 0) < 1) ? 'album' : 'tri';
  const { aide, etroit, palier } = useCadre('selection');
  const [listeOuverte, setListeOuverte] = useState(false);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  // Au palier, la liste des sorties est un menu : choisir une sortie le referme.
  useEffect(() => setListeOuverte(false), [v, palier]);
  useMenuListe(listeOuverte, () => setListeOuverte(false));
  const nFiltres = filtresActifs(filtres.value, empiler.value);
  const resumeTable = `${filtrees.length !== dansVue.length ? t`${pluriel(filtrees.length, 'photo')} sur ${nombre(dansVue.length)}` : pluriel(filtrees.length, 'photo')} · ${t`${nombre(nonDecidees)} à décider`}`;
  const etiquetees = Object.keys(ia.etiquettes).length > 0;

  // Liste sur plusieurs jours : la date sous chaque photo et, triée par date, un titre par journée.
  const joursAffiches = new Set(elements.map((f) => f.date?.slice(0, 10) ?? ''));
  const plusieursJours = joursAffiches.size > 1;
  const memeAnnee = new Set([...joursAffiches].map((j) => j.slice(0, 4))).size === 1;
  const parDate = filtres.value.tri === 'date' && !filtres.value.recherche.trim();
  const groupes = parDate && plusieursJours ? groupesParJour(elements).map((g) => ({ debut: g.debut, titre: <TitreJour g={g} vueActuelle={v} /> })) : undefined;
  const quand = (f: FichierPlan): string => {
    const heure = f.date && f.date.length > 10 ? f.date.slice(11, 16) : '';
    if (!f.date || !plusieursJours) return heure || f.nom;
    const jour = memeAnnee ? `${f.date.slice(8, 10)}.${f.date.slice(5, 7)}` : jourCourt(f.date);
    return heure ? `${jour} ${heure}` : jour;
  };
  // Après l'étiquetage (IA8), la description s'ajoute sur une seconde ligne : la date reste visible.
  const decrites = etiquetees;

  const outilsAlbum = (
    <div class="outils-selection">
      <Cible photos={toutes} />
      <Equilibre photos={toutes} />
      <Redondances photos={toutes} infos={infos} />
      <AidesSelection />
    </div>
  );
  const panneauChoix = <PanneauChoix choisies={choisies} plein={plein === 'album'} album={outilsAlbum} compact={etroit && aide} />;
  const explication = (
    <p>
      {t`Choisissez les photos de l’album :`} <kbd>{t`Espace`}</kbd> {t`= ★ dans l’album,`} <kbd>2</kbd> {t`= ★★ grande photo (pleine page),`} <kbd>X</kbd>{' '}
      {t`= pas pour l’album. Le tri rapide (`}
      <kbd>T</kbd>
      {t`) montre les photos une à une ; les outils à droite vous aident, sans jamais choisir à votre place.`}
    </p>
  );

  return (
    <div
      class="page-cadre page-selection"
      data-gabarit="photos"
      data-palier={palier ? '' : undefined}
      data-etroit={etroit ? '' : undefined}
      data-aide={aide ? '' : undefined}
      data-liste={listeOuverte ? 'ouverte' : undefined}
      style={styleLargeurPanneau()}
    >
      <EnteteCadre titre={nomEtape(ETAPE.selection)} consigne={choisies.length ? t`Cliquez une photo, puis « Dans l’album ».` : t`Cliquez une photo, ou faites un tri rapide.`} />
      <OutilsCadre>
        <BarreChoix photos={dansVue} infos={infos} ia={ia} />
      </OutilsCadre>
      <div class="corps-cadre">
        <div class="colonne-liste">
          <PanneauDossiers simple />
        </div>
        <section class="table-cadre" aria-label={t`Photos : ${titreVue}`}>
          <div class="tete-col tete-table">
            {palier ? (
              <>
                <button type="button" class="menu-liste" data-action="menu-liste" aria-expanded={listeOuverte} aria-haspopup="true" onClick={() => setListeOuverte(!listeOuverte)} title={t`Choisir la sortie affichée`}>
                  <span class="nom-menu-liste">{titreVue}</span>
                  <Icone nom={listeOuverte ? 'chevronHaut' : 'chevronBas'} taille={16} />
                </button>
                <span class="discret resume-table">{resumeTable}</span>
              </>
            ) : (
              <TitreVue titre={titreVue} id={v === RACINE ? undefined : v} sousTitre={resumeTable} />
            )}
            <span class="espace" />
            {/* La consigne (la loupe, le nom lu) et l'exemple (« Par exemple : … ») séparés (C-10.7). */}
            {etiquetees && (
              <label class="champ-recherche" title={t`Recherche dans les descriptions de l’IA (sur cet ordinateur, sans nouvel appel)`}>
                <Icone nom="loupe" taille={16} />
                <input
                  type="search"
                  class="recherche-photos"
                  aria-label={t`Rechercher dans les photos`}
                  placeholder={t`Par exemple : enfants sur un éléphant`}
                  value={filtres.value.recherche}
                  onInput={(e) => (filtres.value = { ...filtres.value, recherche: e.currentTarget.value })}
                />
              </label>
            )}
            <button
              type="button"
              class={plein === 'tri' ? 'principal' : ''}
              disabled={!elements.length}
              data-raison={elements.length ? undefined : 'libelle'}
              onClick={() => ouvrirTri()}
              title={t`Les photos en grand, une à la fois (touche T)`}
            >
              <Icone nom="lecture" taille={16} />
              {elements.length ? t`Tri rapide` : t`Tri rapide : aucune photo ici`}
            </button>
            <button type="button" class="bouton-filtres" aria-expanded={filtresOuverts} onClick={() => setFiltresOuverts(!filtresOuverts)} title={t`Grandes, Nouvelles, piles, jour, appareil, indicateurs, ordre`}>
              {nFiltres > 0 ? t`Filtres : ${pluriel(nFiltres, 'actif')}` : t`Filtres`}
              <Icone nom={filtresOuverts ? 'chevronHaut' : 'chevronBas'} taille={16} />
            </button>
          </div>
          {filtresOuverts && <FiltresTable photos={dansVue} infos={infos} ia={ia} />}
          <EncartAnalyse photos={toutes} pourquoi={t`les indicateurs (netteté, exposition), les piles et les alertes de redondance en ont besoin.`} />
          <GrillePhotos
            elements={elements}
            options={{
              cleVue: `${v}|${JSON.stringify(filtres.value)}|${empiler.value}`,
              ouvrir: (i) => ouvrirTri(i),
              classe: (f) => (f.album === undefined ? 'a-decider' : f.album === 0 ? 'refusee' : 'retenue'),
              groupes,
              // L'état écrit sous chaque photo, ses marques au bout de la bande, une remarque dessous (C-9).
              etat: (f) => etatAlbum(f.album),
              finBande: (f) => <MarquesBande f={f} pile={pilesDe.get(f.id)} ouverte={pilesOuvertes.value.has(pilesDe.get(f.id)?.[0] ?? '')} />,
              telleQuAlbum: true,
              // « Pas pour l'album » tient dans la bande, même à la plus petite taille (C-10.4).
              largeurMin: 156,
              lignesLegende: decrites ? 2 : 1,
              pied: 24,
              legende: (f) => (
                <RemarqueSelection
                  quand={quand(f)}
                  signaux={infos.get(f.id)?.signaux ?? []}
                  note={ia.appreciations[f.id]?.note}
                  choixIA={ia.meilleures[f.id]?.justification}
                  description={decrites ? (ia.etiquettes[f.id]?.description ?? '') : undefined}
                />
              ),
              infobulle: (f) => {
                const info = infos.get(f.id);
                return [
                  ...lignesIA(s, f.id),
                  ...(info?.indicateurs ? [t`Netteté ${nombre(info.indicateurs.nettete)}`] : []),
                  ...(info?.signaux.length ? [t`À vérifier : ${info.signaux.map((x) => t(LIBELLES_SIGNAUX[x])).join(', ')}`] : []),
                ];
              },
            }}
          />
        </section>
        {etroit && aide ? (
          <div class="pile-droite">
            {choisies.length > 0 && panneauChoix}
            <PanneauAide cle="selection" titre={nomEtape(ETAPE.selection)}>
              {explication}
            </PanneauAide>
          </div>
        ) : (
          <>
            {panneauChoix}
            {aide && (
              <PanneauAide cle="selection" titre={nomEtape(ETAPE.selection)}>
                {explication}
              </PanneauAide>
            )}
          </>
        )}
      </div>
      <BarreValidation
        resume={<ResumeSelection retenues={total.retenues} aDecider={total.aDecider} cible={cible} />}
        fini={fini}
        revenir={() => revenirDe('selection')}
        valider={() => validerEtape('selection')}
      />
      {deplacerOuvert.value && <DialogueDeplacer />}
      {recadrageOuvert.value && plan.fichiers.get(recadrageOuvert.value) && <Recadreur f={plan.fichiers.get(recadrageOuvert.value)!} fermer={() => (recadrageOuvert.value = null)} />}
      {triRapide.value && <TriRapide infos={infos} />}
      {comparees.length >= 2 && (
        <Comparateur
          photos={comparees}
          fermer={() => (comparaison.value = null)}
          etat={(f) => ({
            classe: f.album === undefined ? 'decider' : CLASSE_CHOIX[f.album],
            libelle: t(CHOIX_PHOTO.find(([v]) => v === f.album)![1]),
            icone: f.album === 0 ? 'croix' : undefined,
          })}
          // Le choix allumé est l'état (C-4.9) : quatre choix, en grille sous la photo ou en liste à droite.
          choix={(f) =>
            CHOIX_PHOTO.map(([valeur, libelle]) => (
              <button key={String(valeur)} type="button" class={`${valeur === undefined ? 'decider' : CLASSE_CHOIX[valeur]}${f.album === valeur ? ' on' : ''}`} aria-pressed={f.album === valeur} onClick={() => choisir([f.id], valeur)}>
                {t(libelle)}
              </button>
            ))
          }
          // Côte à côte, sous la photo : ses quatre choix seulement ; la ligne d'information dit la photo courante
          // (date, dossier, avis de l'IA en bref) ; le texte entier est dans « Une à la fois » et l'infobulle.
          ligne={(f) => {
            const note = ia.appreciations[f.id]?.note;
            return (
              <>
                <span>
                  <strong>{t`Photo ${comparees.indexOf(f) + 1}`}</strong>
                  {' · '}
                  <span class="num">{dateHeure(f.date)}</span>
                  {` · ${cheminDossier(plan, f.dossier) || t`Photos`}`}
                </span>
                {(note !== undefined || ia.meilleures[f.id]) && (
                  <span class="avis-ia-ligne">
                    <Icone nom="etincelle" taille={16} titre={t`Selon l’IA`} />
                    {[note !== undefined ? t`note ${note}/10` : '', ia.meilleures[f.id] ? t`meilleure de sa pile` : ''].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span class="discret">{t`Un clic sur un choix le change ; Ctrl+Z l’annule.`}</span>
              </>
            );
          }}
          infobulle={(f) => [f.nom, dateHeure(f.date), cheminDossier(plan, f.dossier) || t`Photos`, ...lignesIA(s, f.id)].join('\n')}
          details={(f) => [f.nom, dateHeure(f.date), cheminDossier(plan, f.dossier) || t`Photos`, ...(infos.get(f.id)?.signaux ?? []).map((x) => t(LIBELLES_SIGNAUX[x])), ...lignesIA(s, f.id)].map((l) => <span key={l}>{l}</span>)}
          // Recadrer et tourner la copie de l'album, comme dans la grille (D108).
          outils={(f) => (
            <>
              <button type="button" onClick={() => tournerPhotos([f.id], 90)} title={t`Tourner d’un quart de tour`}>
                <Icone nom="tourner" taille={16} />
                {t`Tourner`}
              </button>
              <button type="button" onClick={() => (recadrageOuvert.value = f.id)} title={t`Recadrer ou redresser la copie de l’album`}>
                <Icone nom="recadrer" taille={16} />
                {t`Recadrer et tourner…`}
              </button>
            </>
          )}
          // Quatre choix sous la photo (deux rangées, sans ligne de texte), et « Pas pour l'album » entier sous
          // chaque vignette, en anglais aussi (C-10.4).
          mesures={{ legendeCote: 88, carteMin: 340, largeurVignetteMin: 180 }}
        />
      )}
    </div>
  );
}

/** Liste affichée par la page, pour les raccourcis clavier. */
const courantRef: { elements: FichierPlan[] } = { elements: [] };
