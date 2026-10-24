// Étape « Sélection » (SPEC § 6.9) : l'utilisateur choisit les photos de
// l'album (★, ★★ grande photo) avec une boîte à outils locale et gratuite :
// tri rapide, piles, comparateur, indicateurs, redondances, équilibre, cible.

import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LIBELLES_DEFAUTS, LIBELLES_PERSONNES, LIBELLES_TYPES } from '../../lib/aidesSelection';
import { LIBELLES_SIGNAUX, type Signal } from '../../lib/indicateurs';
import { cheminDossier, RACINE, type FichierPlan } from '../../lib/plan';
import { arrivees, avancement, copiesRetenues, equilibre, groupesParJour, periodesEquilibre, redondances, type GroupeJour, type Periode } from '../../lib/selection';
import { BarreValidation } from '../composants/Cadre';
import { BoutonAide, EnteteEtape } from '../composants/EnteteEtape';
import { Comparateur } from '../composants/Comparateur';
import { EncartAnalyse } from '../composants/Analyse';
import { GrillePhotos, photoAMontrer } from '../composants/GrillePhotos';
import { Icone } from '../composants/Icones';
import { PanneauDossiers, styleLargeurPanneau, TitreVue } from '../composants/PanneauDossiers';
import { TriRapide } from '../composants/TriRapide';
import { DialogueDeplacer } from '../composants/Visionneuse';
import { annuler, changerAlbum, changerReglages, reglages, retablir, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { aTraduire, langue, t } from '../../lib/langue';
import { jourCourt, nombre, pluriel } from '../format';
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

const ETOILES = { 1: '★', 2: '★★', 0: '✕' } as const;
/** Choix d'une photo en toutes lettres (comparateur), comme dans le tri rapide. */
const CHOIX_PHOTO = { 0: aTraduire('Pas dans l’album'), 1: aTraduire('★ Dans l’album'), 2: aTraduire('★★ Grande photo') } as const;

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

function Badges({ f, pile, ouverte, note, choixIA }: { f: FichierPlan; pile?: string[]; ouverte: boolean; note?: number; choixIA?: string }) {
  return (
    <>
      {note !== undefined && (
        <span class="badge note-ia" title={t`Appréciation indicative de l’IA : ${note}/10`}>
          {note}/10
        </span>
      )}
      {f.album !== undefined && <span class={`etoiles a${f.album}`}>{ETOILES[f.album]}</span>}
      {/* En bas, une rangée : pile à gauche, rotation et recadrage au milieu, choix de l'IA à droite ; elle passe sur deux lignes plutôt que de se chevaucher. */}
      <span class="rangee-bas">
        <span>
          {pile && pile[0] === f.id && (
            <button
              type="button"
              class="badge-pile"
              title={ouverte ? t`Replier la pile` : t`Pile de ${pile.length} photos semblables : cliquer pour la déplier`}
              onClick={(e) => {
                e.stopPropagation();
                const n = new Set(pilesOuvertes.value);
                if (n.has(pile[0])) n.delete(pile[0]);
                else n.add(pile[0]);
                pilesOuvertes.value = n;
              }}
            >
              {ouverte ? '▾' : '▸'} {pile.length}
            </button>
          )}
          {pile && pile[0] !== f.id && <span class="badge-pile dans-pile" title={t`Dans une pile de photos semblables`} />}
        </span>
        <span>
          {f.rotation || f.recadrage ? (
            <span class="badge rotation">
              {f.rotation ? <span title={t`Tournée pour l’album (touche R)`}>↻ {f.rotation}°</span> : null}
              {f.recadrage ? <span title={t`Recadrée pour l’album (touche K pour changer)`}>✂</span> : null}
            </span>
          ) : null}
        </span>
        <span>
          {choixIA && (
            <span class="badge choix-ia" title={t`Meilleure de sa pile selon l’IA : ${choixIA}`}>
              {t`choix IA`}
            </span>
          )}
        </span>
      </span>
    </>
  );
}

function Cible({ photos }: { photos: FichierPlan[] }) {
  const s = session.value!;
  const c = s.album.cible;
  const a = avancement(photos, { mode: c.mode, nombre: c.nombre, photosParPage: s.album.photosParPage });
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
        {t`${nombre(a.valeur)} / ${nombre(c.nombre)} ${unite} (${nombre(a.pourcent)} %)`} · {pluriel(a.retenues, 'photo retenue', 'photos retenues')}
        {a.grandes ? t`, dont ${nombre(a.grandes)} ★★` : ''} · {t`${nombre(a.aDecider)} à décider`}
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
          <div class="barres-jours" role="group" aria-label={unite === 'jour' ? t`Photos retenues par jour` : t`Photos retenues par mois`}>
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
        <span class="pastille dispo" /> {t`disponibles`} <span class="pastille retenues" /> {t`retenues`}
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
              {t`${nombre(g.length)} photos retenues très semblables (${s.plan.dossiers.get(f.dossier)?.nom ?? ''}, ${f.date?.slice(11, 16) ?? ''})`}{' '}
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

/** Filtres du choix, en pastilles : valeur, libellé (traduit à l'affichage), photos comptées. */
const CHOIX: [Filtres['etoiles'], string, ((f: FichierPlan) => boolean) | null][] = [
  ['toutes', aTraduire('Toutes'), null],
  ['a_decider', aTraduire('À décider'), (f) => f.album === undefined],
  ['retenues', aTraduire('Retenues'), (f) => (f.album ?? 0) >= 1],
  ['grandes', aTraduire('★★ Grandes'), (f) => f.album === 2],
  ['non', aTraduire('Pas pour l’album'), (f) => f.album === 0],
];

function BarreFiltres({ photos, infos, ia }: { photos: FichierPlan[]; infos: Map<string, InfoPhoto>; ia: ResultatsIA }) {
  const etiquetees = Object.keys(ia.etiquettes).length > 0;
  const appreciees = Object.keys(ia.appreciations).length > 0;
  const f = filtres.value;
  const changer = (m: Partial<Filtres>) => (filtres.value = { ...f, ...m });
  const jours = [...new Set(photos.map((p) => p.date?.slice(0, 10)).filter((j): j is string => !!j))].sort();
  const appareils = [...new Set(photos.map((p) => p.appareil ?? ''))].sort();
  const signaux = new Set([...infos.values()].flatMap((i) => i.signaux));
  // Photos arrivées après le premier tri (mise à jour de l'inventaire, D63), par jour d'arrivée.
  const jourArrivees = arrivees(photos);
  // Chaque compte dit combien de photos donnerait la pastille, avec les autres filtres en place.
  const avecChoix = filtrer(photos, infos, { ...f, etoiles: 'toutes' }, ia);
  const nouvelles = filtrer(photos, infos, { ...f, arrivee: 'nouvelles' }, ia).length;
  const actif = JSON.stringify(f) !== JSON.stringify(FILTRES_DEFAUT);
  // Filtres moins courants : repliés tant qu'aucun n'est utilisé.
  const secondaires =
    (['jour', 'appareil', 'signal', 'tri', 'personnes', 'typePhoto', 'defaut'] as const).filter((k) => f[k] !== FILTRES_DEFAUT[k]).length + (f.arrivee && f.arrivee !== 'nouvelles' ? 1 : 0);
  const [deplie, setDeplie] = useState(false);
  const voirPlus = deplie || secondaires > 0;
  return (
    <div class="barre-filtres">
      <div class="pastilles-filtre" role="group" aria-label={t`Choix`}>
        {CHOIX.map(([valeur, libelle, compter]) => (
          <button key={valeur} type="button" class={`pastille-filtre${f.etoiles === valeur ? ' actif' : ''}`} aria-pressed={f.etoiles === valeur} onClick={() => changer({ etoiles: valeur })}>
            {t(libelle)}
            {compter && <span class="compte">{nombre(avecChoix.filter(compter).length)}</span>}
          </button>
        ))}
      </div>
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
      <button
        type="button"
        class={`pastille-filtre${empiler.value ? ' actif' : ''}`}
        aria-pressed={empiler.value}
        title={t`Empiler les photos semblables : une seule visible par groupe`}
        onClick={() => (empiler.value = !empiler.value)}
      >
        {t`Empiler`}
      </button>
      {etiquetees && (
        <input
          type="search"
          class="recherche-photos"
          placeholder={t`Rechercher : « enfants sur un éléphant »`}
          value={f.recherche}
          onInput={(e) => changer({ recherche: e.currentTarget.value })}
          title={t`Recherche dans les descriptions de l’IA (sur cet ordinateur, sans nouvel appel)`}
        />
      )}
      <button type="button" class="lien" aria-expanded={voirPlus} disabled={secondaires > 0} onClick={() => setDeplie(!deplie)}>
        {t`Filtres`}
        {secondaires > 0 ? ` (${secondaires})` : ''} {voirPlus ? '▴' : '▾'}
      </button>
      {actif && (
        <button type="button" class="lien" onClick={() => (filtres.value = FILTRES_DEFAUT)}>
          {t`Effacer les filtres`}
        </button>
      )}
      {voirPlus && (
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
      )}
    </div>
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
      if (ctrl && k.toLowerCase() === 'z' && !e.shiftKey) annuler();
      else if (ctrl && (k.toLowerCase() === 'y' || (k.toLowerCase() === 'z' && e.shiftKey))) retablir();
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
  const titreVue = v === RACINE ? t`Toutes les photos` : (plan.dossiers.get(v)?.nom ?? '');
  const comparees = comparaison.value?.map((id) => plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f) ?? [];

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
  const decrites = Object.keys(ia.etiquettes).length > 0;

  return (
    <div class="page-organiser page-selection" style={styleLargeurPanneau()}>
      <EnteteEtape
        cle="selection"
        numero={ETAPE.selection}
        titre={nomEtape(ETAPE.selection)}
        explication={
          <>
            {t`Choisissez les photos de l’album :`} <kbd>{t`Espace`}</kbd> {t`= ★ dans l’album,`} <kbd>2</kbd> {t`= ★★ grande photo (pleine page),`} <kbd>X</kbd>{' '}
            {t`= pas pour l’album. Le tri rapide (`}
            <kbd>T</kbd>
            {t`) montre les photos une à une ; les outils à droite vous aident, sans jamais choisir à votre place.`}
          </>
        }
      />
      <PanneauDossiers simple />
      <section class="contenu-organiser">
        <div class="tete-vue">
          {/* Le résumé sous le titre : le nom de la vue garde la place d'être lu en entier. */}
          <div class="titre-selection">
            <TitreVue titre={titreVue} id={v === RACINE ? undefined : v} />
            <span class="discret resume-vue">
              {filtrees.length !== dansVue.length ? t`${pluriel(filtrees.length, 'photo')} sur ${nombre(dansVue.length)}` : pluriel(filtrees.length, 'photo')} ·{' '}
              {t`${nombre(nonDecidees)} à décider`}
            </span>
          </div>
          <span class="espace" />
          <div class="barre-outils">
            <button type="button" class="principal" disabled={!elements.length} onClick={() => ouvrirTri()} title={t`Touche T`}>
              {t`Tri rapide`}
            </button>
            <button type="button" disabled={!s.historique.peutAnnuler} onClick={annuler} title="Ctrl+Z">
              {t`Annuler`}
            </button>
            <label class="curseur" title={t`Taille des photos (jusqu’à 600 px)`}>
              <Icone nom="loupe" taille={16} />
              <input
                type="range"
                min="100"
                max="600"
                step="20"
                value={reglages.value.tailleMiniatures}
                onInput={(e) => changerReglages({ ...reglages.value, tailleMiniatures: Number(e.currentTarget.value) })}
              />
            </label>
          </div>
          <BoutonAide cle="selection" libelle={t`Aide`} />
        </div>
        <EncartAnalyse photos={toutes} pourquoi={t`les indicateurs (netteté, exposition), les piles et les alertes de redondance en ont besoin.`} />
        <BarreFiltres photos={dansVue} infos={infos} ia={ia} />
        {choisis.size > 0 && (
          <div class="barre-action" role="toolbar" aria-label={t`Photos sélectionnées`}>
            <span class="compte-selection">{pluriel(choisis.size, 'sélectionnée', 'sélectionnées')}</span>
            <button type="button" class="etoile" onClick={() => choisir([...choisis], 1)} title={t`Touche Espace`}>
              ★ {t`Dans l’album`}
            </button>
            <button type="button" onClick={() => choisir([...choisis], 2)} title={t`Touche 2`}>
              ★★ {t`Grande`}
            </button>
            <button type="button" onClick={() => choisir([...choisis], 0)} title={t`Touche X`}>
              {t`Pas pour l’album`}
            </button>
            <button type="button" onClick={() => choisir([...choisis], undefined)} title={t`Retour arrière`}>
              {t`À décider`}
            </button>
            <button type="button" onClick={() => tournerPhotos([...choisis], 90)} title={t`Tourner d’un quart de tour (touche R ; Maj+R : dans l’autre sens)`} aria-label={t`Tourner`}>
              ↻
            </button>
            {choisis.size === 1 && (
              <button type="button" onClick={() => (recadrageOuvert.value = [...choisis][0])} title={t`Recadrer ou redresser la copie de l’album (touche K)`}>
                {t`Recadrer…`}
              </button>
            )}
            {choisis.size >= 2 && choisis.size <= 4 && (
              <button type="button" onClick={() => (comparaison.value = [...choisis].slice(0, 4))} title={t`Touche C : 2 à 4 photos`}>
                {t`Comparer`}
              </button>
            )}
            <button type="button" onClick={() => (deplacerOuvert.value = true)} title={t`Touche M`}>
              {t`Déplacer…`}
            </button>
            <button type="button" class="fermer-action" onClick={() => (selection.value = new Set())} title={t`Tout désélectionner (Échap)`} aria-label={t`Tout désélectionner`}>
              <Icone nom="croix" taille={16} />
            </button>
          </div>
        )}
        <GrillePhotos
          elements={elements}
          options={{
            cleVue: `${v}|${JSON.stringify(filtres.value)}|${empiler.value}`,
            ouvrir: (i) => ouvrirTri(i),
            classe: (f) => (f.album === undefined ? 'a-decider' : f.album === 0 ? 'refusee' : 'retenue'),
            groupes,
            badges: (f) => (
              <Badges
                f={f}
                pile={pilesDe.get(f.id)}
                ouverte={pilesOuvertes.value.has(pilesDe.get(f.id)?.[0] ?? '')}
                note={ia.appreciations[f.id]?.note}
                choixIA={ia.meilleures[f.id]?.justification}
              />
            ),
            pastilles: (f) => {
              const signaux = infos.get(f.id)?.signaux ?? [];
              return signaux.length
                ? signaux.map((x) => (
                    <span key={x} class={`signal ${x}`} title={t(LIBELLES_SIGNAUX[x])}>
                      {t(LIBELLES_SIGNAUX[x])}
                    </span>
                  ))
                : null;
            },
            lignesLegende: decrites ? 2 : 1,
            legende: (f) =>
              decrites ? (
                <>
                  <span>{quand(f)}</span>
                  <span class="description-ia">{ia.etiquettes[f.id]?.description ?? ''}</span>
                </>
              ) : (
                quand(f)
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
      <aside class="outils-selection">
        <Cible photos={toutes} />
        <Equilibre photos={toutes} />
        <Redondances photos={toutes} infos={infos} />
        <AidesSelection />
      </aside>
      <BarreValidation
        resume={
          <>
            {pluriel(total.retenues, 'photo retenue', 'photos retenues')} ({nombre(total.grandes)} ★★) · {t`${nombre(total.aDecider)} à décider`}
          </>
        }
        alertes={total.retenues === 0 ? [t`Aucune photo retenue pour l’album`] : []}
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
          entete={(f) => (
            <>
              {/* Le choix actuel en toutes lettres, sur chaque photo. */}
              <span class={`choix-actuel a${f.album ?? 'x'}`}>{f.album === undefined ? t`À décider` : t(CHOIX_PHOTO[f.album])}</span>
              {lignesIA(s, f.id).length > 0 && <span class="texte-ia">{lignesIA(s, f.id).join(' · ')}</span>}
            </>
          )}
          actions={(f) => (
            <>
              {(
                [
                  [1, '★', t`Dans l’album`],
                  [2, '★★', t`Grande photo (pleine page)`],
                  [0, `✕ ${t`Pas pour l’album`}`, t`Pas pour l’album`],
                  [undefined, t`À décider`, t`À décider`],
                ] as const
              ).map(([valeur, libelle, titre]) => (
                <button
                  key={String(valeur)}
                  type="button"
                  class={f.album === valeur ? `actif a${valeur ?? 'x'}` : ''}
                  aria-pressed={f.album === valeur}
                  title={titre}
                  onClick={() => choisir([f.id], valeur)}
                >
                  {libelle}
                </button>
              ))}
            </>
          )}
        />
      )}
    </div>
  );
}

/** Liste affichée par la page, pour les raccourcis clavier. */
const courantRef: { elements: FichierPlan[] } = { elements: [] };
