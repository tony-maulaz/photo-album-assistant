// Étape « Sélection » (SPEC § 6.9) : l'utilisateur choisit les photos de
// l'album (★, ★★ grande photo) avec une boîte à outils locale et gratuite :
// tri rapide, piles, comparateur, indicateurs, redondances, équilibre, cible.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { LIBELLES_DEFAUTS, LIBELLES_PERSONNES, LIBELLES_TYPES } from '../../lib/aidesSelection';
import { LIBELLES_SIGNAUX, type Signal } from '../../lib/indicateurs';
import { cheminDossier, RACINE, type FichierPlan } from '../../lib/plan';
import { avancement, equilibre, redondances } from '../../lib/selection';
import { BarreValidation } from '../composants/Cadre';
import { BoutonAide, EnteteEtape } from '../composants/EnteteEtape';
import { Comparateur } from '../composants/Comparateur';
import { EncartAnalyse } from '../composants/Analyse';
import { GrillePhotos } from '../composants/GrillePhotos';
import { Icone } from '../composants/Icones';
import { PanneauDossiers, styleLargeurPanneau, TitreVue } from '../composants/PanneauDossiers';
import { TriRapide } from '../composants/TriRapide';
import { DialogueDeplacer } from '../composants/Visionneuse';
import { annuler, changerAlbum, changerReglages, reglages, retablir, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { ETAPE } from '../../navigateur/projet';
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
  tournerPhotos,
  triRapide,
  type Filtres,
  type InfoPhoto,
  type ResultatsIA,
} from '../selection';
import { AidesSelection, lignesIA, resultatsSelection } from './AidesPhotos';

function estChampDeSaisie(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

const ETOILES = { 1: '★', 2: '★★', 0: '✕' } as const;

function Badges({ f, info, pile, ouverte, note, choixIA }: { f: FichierPlan; info?: InfoPhoto; pile?: string[]; ouverte: boolean; note?: number; choixIA?: string }) {
  return (
    <>
      {note !== undefined && (
        <span class="badge note-ia" title={`Appréciation indicative de l’IA : ${note}/10`}>
          {note}/10
        </span>
      )}
      {choixIA && (
        <span class="badge choix-ia" title={`Meilleure de sa pile selon l’IA : ${choixIA}`}>
          choix IA
        </span>
      )}
      {f.album !== undefined && <span class={`etoiles a${f.album}`}>{ETOILES[f.album]}</span>}
      {pile && pile[0] === f.id && (
        <button
          type="button"
          class="badge-pile"
          title={ouverte ? 'Replier la pile' : `Pile de ${pile.length} photos semblables : cliquer pour la déplier`}
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
      {pile && pile[0] !== f.id && <span class="badge-pile dans-pile" title="Dans une pile de photos semblables" />}
      {info && info.signaux.length > 0 && (
        <span class="signaux">
          {info.signaux.map((s) => (
            <span key={s} class={`signal ${s}`} title={LIBELLES_SIGNAUX[s]}>
              {LIBELLES_SIGNAUX[s]}
            </span>
          ))}
        </span>
      )}
      {f.rotation ? <span class="badge rotation">↻ {f.rotation}°</span> : null}
    </>
  );
}

function Cible({ photos }: { photos: FichierPlan[] }) {
  const s = session.value!;
  const c = s.album.cible;
  const a = avancement(photos, { mode: c.mode, nombre: c.nombre, photosParPage: s.album.photosParPage });
  const unite = c.mode === 'pages' ? 'pages' : 'photos';
  return (
    <section class="outil">
      <h3>Cible</h3>
      <div class="ligne-cible">
        <input
          type="number"
          class="court"
          min="1"
          value={c.nombre}
          onChange={(e) => changerAlbum({ cible: { ...c, nombre: Math.max(1, Number(e.currentTarget.value) || 1) } })}
          aria-label="Nombre visé"
        />
        <select value={c.mode} onChange={(e) => changerAlbum({ cible: { ...c, mode: e.currentTarget.value as 'pages' | 'photos' } })} aria-label="Unité">
          <option value="pages">pages</option>
          <option value="photos">photos</option>
        </select>
        <label title="Photos par page dans l’album ifolor (une ★★ occupe une page)">
          <input
            type="number"
            class="tres-court"
            min="1"
            max="12"
            value={s.album.photosParPage}
            onChange={(e) => changerAlbum({ photosParPage: Math.max(1, Math.min(12, Number(e.currentTarget.value) || 1)) })}
          />{' '}
          par page
        </label>
      </div>
      <div class="jauge-cible" role="progressbar" aria-valuenow={Math.round(a.pourcent)}>
        <div class={`rempli${a.pourcent > 105 ? ' trop' : ''}`} style={{ width: `${Math.min(100, a.pourcent)}%` }} />
      </div>
      <p class="discret">
        {nombre(a.valeur)} / {nombre(c.nombre)} {unite} ({nombre(a.pourcent)} %) · {pluriel(a.retenues, 'photo retenue', 'photos retenues')}
        {a.grandes ? `, dont ${nombre(a.grandes)} ★★` : ''} · {nombre(a.aDecider)} à décider
      </p>
    </section>
  );
}

function Equilibre({ photos }: { photos: FichierPlan[] }) {
  const s = session.value!;
  const e = equilibre(photos);
  const max = Math.max(1, ...e.jours.map((j) => j.disponibles));
  const sansRien = e.sorties.filter((x) => x.retenues === 0 && x.disponibles > 0);
  return (
    <section class="outil">
      <h3>Équilibre par jour</h3>
      <div class="barres-jours" role="img" aria-label="Photos retenues par jour">
        {e.jours.map((j) => (
          <button
            type="button"
            key={j.jour}
            class={`barre-jour${filtres.value.jour === j.jour ? ' actif' : ''}`}
            title={`${jourCourt(j.jour)} : ${j.retenues} retenue(s) sur ${j.disponibles} — cliquer pour filtrer ce jour`}
            onClick={() => (filtres.value = { ...filtres.value, jour: filtres.value.jour === j.jour ? '' : j.jour })}
          >
            <span class="dispo" style={{ height: `${(j.disponibles / max) * 100}%` }} />
            <span class="retenues" style={{ height: `${(j.retenues / max) * 100}%` }} />
          </button>
        ))}
      </div>
      <p class="discret legende-barres">
        <span class="pastille dispo" /> disponibles <span class="pastille retenues" /> retenues
      </p>
      {sansRien.length > 0 && (
        <div class="alertes-outil">
          <strong>{pluriel(sansRien.length, 'sortie sans photo retenue', 'sorties sans photo retenue')} :</strong>
          <ul class="liste-courte">
            {sansRien.slice(0, 8).map((x) => (
              <li key={x.dossier}>
                <button type="button" class="lien" onClick={() => choisirVue(x.dossier)}>
                  {cheminDossier(s.plan, x.dossier) || 'Photos'}
                </button>{' '}
                ({x.disponibles})
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Redondances({ photos, infos }: { photos: FichierPlan[]; infos: Map<string, InfoPhoto> }) {
  const s = session.value!;
  const groupes = redondances(photos.map((p) => ({ id: p.id, dossier: p.dossier, date: p.date, phash: infos.get(p.id)?.indicateurs?.phash, album: p.album })));
  if (!groupes.length) return null;
  return (
    <section class="outil">
      <h3>Redondances</h3>
      <ul class="liste-courte">
        {groupes.slice(0, 12).map((g) => {
          const f = s.plan.fichiers.get(g[0])!;
          return (
            <li key={g[0]}>
              {nombre(g.length)} photos retenues très semblables ({s.plan.dossiers.get(f.dossier)?.nom}, {f.date?.slice(11, 16)}){' '}
              <button type="button" class="lien" onClick={() => (comparaison.value = g.slice(0, 4))}>
                comparer
              </button>
            </li>
          );
        })}
      </ul>
      {groupes.length > 12 && <p class="discret">… et {groupes.length - 12} autres.</p>}
    </section>
  );
}

/** Filtres du choix, en pastilles : valeur, libellé, photos comptées. */
const CHOIX: [Filtres['etoiles'], string, ((f: FichierPlan) => boolean) | null][] = [
  ['toutes', 'Toutes', null],
  ['a_decider', 'À décider', (f) => f.album === undefined],
  ['retenues', 'Retenues', (f) => (f.album ?? 0) >= 1],
  ['grandes', '★★ Grandes', (f) => f.album === 2],
  ['non', 'Non', (f) => f.album === 0],
];

function BarreFiltres({ photos, infos, ia }: { photos: FichierPlan[]; infos: Map<string, InfoPhoto>; ia: ResultatsIA }) {
  const etiquetees = Object.keys(ia.etiquettes).length > 0;
  const appreciees = Object.keys(ia.appreciations).length > 0;
  const f = filtres.value;
  const changer = (m: Partial<Filtres>) => (filtres.value = { ...f, ...m });
  const jours = [...new Set(photos.map((p) => p.date?.slice(0, 10)).filter((j): j is string => !!j))].sort();
  const appareils = [...new Set(photos.map((p) => p.appareil ?? ''))].sort();
  const signaux = new Set([...infos.values()].flatMap((i) => i.signaux));
  const actif = JSON.stringify(f) !== JSON.stringify(FILTRES_DEFAUT);
  // Filtres moins courants : repliés tant qu'aucun n'est utilisé.
  const secondaires = (['jour', 'appareil', 'signal', 'tri', 'personnes', 'typePhoto', 'defaut'] as const).filter((k) => f[k] !== FILTRES_DEFAUT[k]).length;
  const [deplie, setDeplie] = useState(false);
  const voirPlus = deplie || secondaires > 0;
  return (
    <div class="barre-filtres">
      <div class="pastilles-filtre" role="group" aria-label="Choix">
        {CHOIX.map(([valeur, libelle, compter]) => (
          <button key={valeur} type="button" class={`pastille-filtre${f.etoiles === valeur ? ' actif' : ''}`} aria-pressed={f.etoiles === valeur} onClick={() => changer({ etoiles: valeur })}>
            {libelle}
            {compter && <span class="compte">{nombre(photos.filter(compter).length)}</span>}
          </button>
        ))}
      </div>
      <button
        type="button"
        class={`pastille-filtre${empiler.value ? ' actif' : ''}`}
        aria-pressed={empiler.value}
        title="Empiler les photos semblables : une seule visible par groupe"
        onClick={() => (empiler.value = !empiler.value)}
      >
        Empiler
      </button>
      {etiquetees && (
        <input
          type="search"
          class="recherche-photos"
          placeholder="Rechercher : « enfants sur un éléphant »"
          value={f.recherche}
          onInput={(e) => changer({ recherche: e.currentTarget.value })}
          title="Recherche dans les descriptions de l’IA (sur cet ordinateur, sans nouvel appel)"
        />
      )}
      <button type="button" class="lien" aria-expanded={voirPlus} disabled={secondaires > 0} onClick={() => setDeplie(!deplie)}>
        Filtres{secondaires > 0 ? ` (${secondaires})` : ''} {voirPlus ? '▴' : '▾'}
      </button>
      {actif && (
        <button type="button" class="lien" onClick={() => (filtres.value = FILTRES_DEFAUT)}>
          Effacer les filtres
        </button>
      )}
      {voirPlus && (
        <div class="filtres-secondaires">
          <select value={f.jour} onChange={(e) => changer({ jour: e.currentTarget.value })} aria-label="Jour">
            <option value="">Tous les jours</option>
            {jours.map((j) => (
              <option key={j} value={j}>
                {jourCourt(j)}
              </option>
            ))}
          </select>
          {appareils.length > 1 && (
            <select value={f.appareil} onChange={(e) => changer({ appareil: e.currentTarget.value })} aria-label="Appareil">
              <option value="">Tous les appareils</option>
              {appareils.map((a) => (
                <option key={a} value={a}>
                  {a || 'appareil inconnu'}
                </option>
              ))}
            </select>
          )}
          <select value={f.signal} onChange={(e) => changer({ signal: e.currentTarget.value as Filtres['signal'] })} aria-label="Indicateurs">
            <option value="tous">Tous les indicateurs</option>
            <option value="aucun">Sans défaut signalé</option>
            {(Object.keys(LIBELLES_SIGNAUX) as Signal[])
              .filter((s) => signaux.has(s))
              .map((s) => (
                <option key={s} value={s}>
                  {LIBELLES_SIGNAUX[s]}
                </option>
              ))}
          </select>
          <select value={f.tri} onChange={(e) => changer({ tri: e.currentTarget.value as Filtres['tri'] })} aria-label="Tri">
            <option value="date">Par date</option>
            <option value="nettete">Les plus nettes d’abord</option>
            {appreciees && <option value="appreciation">Par appréciation (IA)</option>}
          </select>
          {etiquetees && (
            <>
              <select value={f.personnes} onChange={(e) => changer({ personnes: e.currentTarget.value })} aria-label="Personnes">
                <option value="">Personnes : toutes</option>
                {Object.entries(LIBELLES_PERSONNES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select value={f.typePhoto} onChange={(e) => changer({ typePhoto: e.currentTarget.value })} aria-label="Type de photo">
                <option value="">Tous les types</option>
                {Object.entries(LIBELLES_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select value={f.defaut} onChange={(e) => changer({ defaut: e.currentTarget.value })} aria-label="Défauts">
                <option value="">Défauts : tous</option>
                <option value="aucun">Sans défaut (IA)</option>
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

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (estChampDeSaisie(e) || deplacerOuvert.value || triRapide.value || comparaison.value) return;
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
  const titreVue = v === RACINE ? 'Toutes les photos' : (plan.dossiers.get(v)?.nom ?? '');
  const comparees = comparaison.value?.map((id) => plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f) ?? [];

  return (
    <div class="page-organiser page-selection" style={styleLargeurPanneau()}>
      <EnteteEtape
        cle="selection"
        numero={ETAPE.selection}
        titre="Sélection"
        explication={
          <>
            Choisissez les photos de l’album : <kbd>Espace</kbd> = ★ dans l’album, <kbd>2</kbd> = ★★ grande photo (pleine page), <kbd>X</kbd> = non. Le tri
            rapide (<kbd>T</kbd>) montre les photos une à une ; les outils à droite vous aident, sans jamais choisir à votre place.
          </>
        }
      />
      <PanneauDossiers simple />
      <section class="contenu-organiser">
        <div class="tete-vue">
          <TitreVue titre={titreVue} id={v === RACINE ? undefined : v} />
          <span class="discret resume-vue">
            {pluriel(filtrees.length, 'photo')}
            {filtrees.length !== dansVue.length ? ` sur ${nombre(dansVue.length)}` : ''} · {nombre(nonDecidees)} à décider
          </span>
          <span class="espace" />
          <div class="barre-outils">
            <button type="button" class="principal" disabled={!elements.length} onClick={() => ouvrirTri()} title="Touche T">
              Tri rapide
            </button>
            <button type="button" disabled={!s.historique.peutAnnuler} onClick={annuler} title="Ctrl+Z">
              Annuler
            </button>
            <label class="curseur" title="Taille des photos (jusqu’à 600 px)">
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
          <BoutonAide cle="selection" libelle="Aide" />
        </div>
        <EncartAnalyse photos={toutes} pourquoi="les indicateurs (netteté, exposition), les piles et les alertes de redondance en ont besoin." />
        <BarreFiltres photos={dansVue} infos={infos} ia={ia} />
        {choisis.size > 0 && (
          <div class="barre-action" role="toolbar" aria-label="Photos sélectionnées">
            <span class="compte-selection">{pluriel(choisis.size, 'sélectionnée', 'sélectionnées')}</span>
            <button type="button" class="etoile" onClick={() => choisir([...choisis], 1)} title="Touche Espace">
              ★ Dans l’album
            </button>
            <button type="button" onClick={() => choisir([...choisis], 2)} title="Touche 2">
              ★★ Grande
            </button>
            <button type="button" onClick={() => choisir([...choisis], 0)} title="Touche X">
              Non
            </button>
            <button type="button" onClick={() => choisir([...choisis], undefined)} title="Retour arrière">
              À décider
            </button>
            <button type="button" onClick={() => tournerPhotos([...choisis], 90)} title="Tourner d’un quart de tour (touche R ; Maj+R : dans l’autre sens)" aria-label="Tourner">
              ↻
            </button>
            {choisis.size >= 2 && choisis.size <= 4 && (
              <button type="button" onClick={() => (comparaison.value = [...choisis].slice(0, 4))} title="Touche C : 2 à 4 photos">
                Comparer
              </button>
            )}
            <button type="button" onClick={() => (deplacerOuvert.value = true)} title="Touche M">
              Déplacer…
            </button>
            <button type="button" class="fermer-action" onClick={() => (selection.value = new Set())} title="Tout désélectionner (Échap)" aria-label="Tout désélectionner">
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
            badges: (f) => (
              <Badges
                f={f}
                info={infos.get(f.id)}
                pile={pilesDe.get(f.id)}
                ouverte={pilesOuvertes.value.has(pilesDe.get(f.id)?.[0] ?? '')}
                note={ia.appreciations[f.id]?.note}
                choixIA={ia.meilleures[f.id]?.justification}
              />
            ),
            legende: (f) => (ia.etiquettes[f.id]?.description ? ia.etiquettes[f.id].description : f.date && f.date.length > 10 ? f.date.slice(11, 16) : f.nom),
            infobulle: (f) => {
              const info = infos.get(f.id);
              return [
                ...lignesIA(s, f.id),
                ...(info?.indicateurs ? [`Netteté ${nombre(info.indicateurs.nettete)}`] : []),
                ...(info?.signaux.length ? [`À vérifier : ${info.signaux.map((x) => LIBELLES_SIGNAUX[x]).join(', ')}`] : []),
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
            {pluriel(total.retenues, 'photo retenue', 'photos retenues')} ({nombre(total.grandes)} ★★) · {nombre(total.aDecider)} à décider
          </>
        }
        alertes={total.retenues === 0 ? ['Aucune photo retenue pour l’album'] : []}
        revenir={() => revenirDe('selection')}
        valider={() => validerEtape('selection')}
      />
      {deplacerOuvert.value && <DialogueDeplacer />}
      {triRapide.value && <TriRapide infos={infos} />}
      {comparees.length >= 2 && (
        <Comparateur
          photos={comparees}
          fermer={() => (comparaison.value = null)}
          entete={(f) => (
            <>
              {f.album !== undefined ? <span class={`etoiles a${f.album}`}>{ETOILES[f.album]}</span> : <span class="discret">à décider</span>}
              {lignesIA(s, f.id).length > 0 && <span class="texte-ia">{lignesIA(s, f.id).join(' · ')}</span>}
            </>
          )}
          actions={(f) => (
            <>
              <button type="button" onClick={() => choisir([f.id], 1)}>
                ★
              </button>
              <button type="button" onClick={() => choisir([f.id], 2)}>
                ★★
              </button>
              <button type="button" onClick={() => choisir([f.id], 0)}>
                ✕ Non
              </button>
            </>
          )}
        />
      )}
    </div>
  );
}

/** Liste affichée par la page, pour les raccourcis clavier. */
const courantRef: { elements: FichierPlan[] } = { elements: [] };
