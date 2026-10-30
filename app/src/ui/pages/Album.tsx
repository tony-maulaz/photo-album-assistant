// Étape « Album » (SPEC § 6.10, sans IA en phase 2) : ordre (jour puis
// segments d'activité, I2), sections modifiables, légendes manuelles et
// aperçu paginé, tels qu'ils seront écrits dans `Album/` à l'étape « Création de la sortie ».

import { nomsSortie } from '../../lib/sortie';
import { useState } from 'preact/hooks';
import { cibleEnPages, conseilCible, doublesAlbum, ordreAlbum, paginer, photosAlbum, sections, type ConseilCible, type Page, type Section } from '../../lib/album';
import { changerLegende, combiner, noterAlbum, periodeDe, tourner, type FichierPlan } from '../../lib/plan';
import { titreAlbum, titreDossier } from '../../navigateur/album';
import { BarreValidation } from '../composants/Cadre';
import { AideEtape, LigneEtape } from '../composants/CadreCommun';
import { Icone } from '../composants/Icones';
import { demander } from '../composants/Dialogues';
import { Miniature } from '../composants/GrillePhotos';
import { allerEtape, annuler, appliquer, changerAlbum, notifier, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { t } from '../../lib/langue';
import { AidesAlbum, couverturesProposees, textesProposes } from './AidesPhotos';
import { jourCourt, nombre, periode, pluriel } from '../format';

function retirerCle<T>(o: Record<string, T>, cle: string): Record<string, T> {
  const { [cle]: _retire, ...reste } = o;
  return reste;
}

/**
 * Regroupe les pages en doubles pages, comme dans le livre ouvert : la page 1
 * est seule à droite, puis 2-3, 4-5… Une double page partagée entre deux
 * sections n'y montre que les pages de la section.
 */
function planches(pages: Page[], numero: Map<Page, number>): Page[][] {
  const resultat: Page[][] = [];
  for (const p of pages) {
    const derniere = resultat.at(-1);
    if (derniere && Math.floor(numero.get(derniere[0])! / 2) === Math.floor(numero.get(p)! / 2)) derniere.push(p);
    else resultat.push([p]);
  }
  return resultat;
}

function MiniaturePage({ f, grande, seule, choisie, choisir }: { f: FichierPlan; grande: boolean; seule: boolean; choisie: boolean; choisir: () => void }) {
  return (
    <button type="button" class={`photo-page${grande ? ' grande' : ''}${choisie ? ' choisie' : ''}`} onClick={choisir} title={f.legende ? t`Légende : ${f.legende}` : f.nom}>
      <Miniature f={f} taille={grande || seule ? 208 : 100} rotation={f.rotation} recadrage={f.recadrage} />
      {f.legende && (
        <span class="a-legende" title={f.legende}>
          <Icone nom="crayon" taille={14} titre={t`Légende`} />
        </span>
      )}
    </button>
  );
}

/**
 * Couverture, en tête de l'aperçu : la photo choisie (n'importe quelle photo
 * de l'album, depuis son panneau, ou une proposition de l'IA), et le titre de
 * l'album. Sa copie est écrite en tête de `Album/`, avec sa rotation et son recadrage.
 */
function Couverture({ ouvrir }: { ouvrir: (id: string) => void }) {
  const s = session.value!;
  const config = s.album;
  const choisie = config.couverture ? s.plan.fichiers.get(config.couverture) : undefined;
  const f = choisie?.statut === 'archive' ? choisie : undefined;
  const propositions = couverturesProposees(s).filter((c) => s.plan.fichiers.get(c.id)?.statut === 'archive');
  return (
    <section class="section-album couverture-album">
      <header class="entete-section">
        <div class="ligne-titre">
          <span class="numero-section">
            <Icone nom="couverture" taille={16} titre={t`Couverture`} />
          </span>
          <input
            class="titre-section"
            value={titreAlbum(config, s.projet.nom)}
            aria-label={t`Titre de l’album`}
            onChange={(e) => {
              const v = e.currentTarget.value.trim();
              changerAlbum({ titre: v && v !== s.projet.nom ? v : undefined });
            }}
          />
          <span class="discret">{t`Couverture et titre de l’album`}</span>
        </div>
      </header>
      <div class="pages">
        <div class="planche">
          <div class="page-album-apercu droite pleine page-couverture">
            <span class="numero-page">{t`Couverture`}</span>
            {f ? (
              <div class="photos-page n1">
                <MiniaturePage f={f} grande seule choisie={false} choisir={() => ouvrir(f.id)} />
              </div>
            ) : (
              <p class="discret sans-couverture">{t`Pas encore de couverture : cliquez une photo de l’album, puis « Choisir comme couverture ».`}</p>
            )}
          </div>
        </div>
        {propositions.length > 0 && (
          <div class="couvertures-proposees">
            <p>
              <span class="source ia">{t`IA`}</span> {t`Couvertures proposées :`}
            </p>
            <div class="liste-couvertures">
              {propositions.map((c) => {
                const p = s.plan.fichiers.get(c.id)!;
                return (
                  <figure key={c.id} class={config.couverture === c.id ? 'choisie' : ''}>
                    <Miniature f={p} taille={120} rotation={p.rotation} recadrage={p.recadrage} />
                    <figcaption>{c.raison}</figcaption>
                    <button type="button" class="lien" disabled={config.couverture === c.id} data-raison={config.couverture === c.id ? 'libelle' : undefined} onClick={() => changerAlbum({ couverture: c.id })}>
                      {config.couverture === c.id ? (
                        <>
                          <Icone nom="coche" taille={16} />
                          {t`Couverture choisie`}
                        </>
                      ) : (
                        t`Choisir comme couverture`
                      )}
                    </button>
                  </figure>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {f && (
        <p class="discret">
          {t`Copiée en tête du dossier « Album » sous le nom « ${nomsSortie().couverture} ».`}{' '}
          <button type="button" class="lien" onClick={() => changerAlbum({ couverture: undefined })}>
            {t`retirer`}
          </button>
        </p>
      )}
    </section>
  );
}

/** Écart à la cible, et comment le combler (« Il manque 16 pages : retenez environ 64 photos de plus… »). */
function texteEcart(c: ConseilCible): string {
  return c.ecart < 0 ? t`Il manque ${pluriel(-c.ecart, 'page')}` : t`${pluriel(c.ecart, 'page')} de trop`;
}

function ConseilPages({ conseil }: { conseil: ConseilCible }) {
  const photos = conseil.ecart < 0 ? t`retenez environ ${pluriel(conseil.photos, 'photo')} de plus` : t`retirez environ ${pluriel(conseil.photos, 'photo')}`;
  return (
    <p class="encart attention conseil-cible">
      {t`${texteEcart(conseil)} pour atteindre la cible : ${photos}`}
      {conseil.photosParPage ? (
        <>
          {t`, ou`}{' '}
          <button type="button" class="lien" onClick={() => changerAlbum({ photosParPage: conseil.photosParPage })}>
            {t`passez à ${pluriel(conseil.photosParPage, 'photo')} par page`}
          </button>
        </>
      ) : null}
      .{' '}
      {conseil.ecart < 0 && (
        <button type="button" class="lien" onClick={() => allerEtape('selection')}>
          {t`Aller à la sélection`}
        </button>
      )}
    </p>
  );
}

function EnteteSection({ sec, index }: { sec: Section; index: number }) {
  const s = session.value!;
  const config = s.album;
  const premiere = ordreCourant[sec.debut];
  const coupure = config.coupures[premiere.id] !== undefined;
  const rattachable = index > 0;
  const titre = sec.titre;
  // Dates sûres seulement : une photo sans date (placée en fin de section) n'étire pas la période.
  const { du, au } = periodeDe(ordreCourant.slice(sec.debut, sec.fin + 1));
  const changerTitre = (v: string) => {
    const t = v.trim();
    if (coupure) changerAlbum({ coupures: { ...config.coupures, [premiere.id]: t || 'Section' } });
    else changerAlbum({ titres: t && t !== titreDossier(s.plan, sec.dossier) ? { ...config.titres, [sec.dossier]: t } : retirerCle(config.titres, sec.dossier) });
  };
  // Blocs rattachés à cette section (pour pouvoir les détacher).
  const rattaches = config.rattachements.filter((id) => {
    const i = ordreCourant.findIndex((f) => f.id === id);
    return i > sec.debut && i <= sec.fin;
  });
  return (
    <header class="entete-section">
      <div class="ligne-titre">
        <span class="numero-section">{index + 1}</span>
        <input class="titre-section" value={titre} onChange={(e) => changerTitre(e.currentTarget.value)} aria-label={t`Titre de la section`} disabled={sec.suite && !coupure} />
        {sec.suite && <span class="discret">{t`(suite)`}</span>}
        <span class="discret">
          {periode(du, au)} · {pluriel(sec.fin - sec.debut + 1, 'photo')}
        </span>
        <span class="espace" />
        {coupure ? (
          <button type="button" onClick={() => changerAlbum({ coupures: retirerCle(config.coupures, premiere.id) })} title={t`Remettre ces photos dans la section précédente`}>
            {t`Supprimer ce découpage`}
          </button>
        ) : (
          rattachable && (
            <button type="button" onClick={() => changerAlbum({ rattachements: [...config.rattachements, premiere.id] })} title={t`Une seule section avec la précédente`}>
              {t`Regrouper avec la précédente`}
            </button>
          )
        )}
      </div>
      {!sec.suite && !coupure && (
        <textarea
          class="intro-section"
          rows={1}
          placeholder={t`Introduction de la section (facultative)`}
          value={config.intros[sec.dossier] ?? ''}
          onChange={(e) => {
            const t = e.currentTarget.value.trim();
            changerAlbum({ intros: t ? { ...config.intros, [sec.dossier]: t } : retirerCle(config.intros, sec.dossier) });
          }}
        />
      )}
      <PropositionsSection sec={sec} premiere={premiere.id} coupure={coupure} />
      {rattaches.length > 0 && (
        <p class="discret">
          {t`Comprend ${pluriel(rattaches.length, 'bloc regroupé', 'blocs regroupés')} :`}{' '}
          {rattaches.map((id) => (
            <button key={id} type="button" class="lien" onClick={() => changerAlbum({ rattachements: config.rattachements.filter((x) => x !== id) })}>
              {t`séparer « ${s.plan.dossiers.get(ordreCourant.find((f) => f.id === id)!.dossier)?.nom ?? ''} » (${jourCourt(ordreCourant.find((f) => f.id === id)!.date)})`}
            </button>
          ))}
        </p>
      )}
    </header>
  );
}

/** Titre et introduction proposés par l'IA (IA12), à reprendre d'un clic. */
function PropositionsSection({ sec, premiere, coupure }: { sec: Section; premiere: string; coupure: boolean }) {
  const s = session.value!;
  const config = s.album;
  const { titres } = textesProposes(s, sec, premiere);
  if (!titres || sec.suite) return null;
  const titreActuel = sec.titre;
  const introActuelle = config.intros[sec.dossier] ?? '';
  return (
    <div class="proposition-texte">
      {titres.titre && titres.titre !== titreActuel && (
        <div>
          <span class="source ia">{t`IA`}</span> {t`Titre : « ${titres.titre} »`}{' '}
          <button
            type="button"
            class="lien"
            onClick={() =>
              coupure ? changerAlbum({ coupures: { ...config.coupures, [premiere]: titres.titre } }) : changerAlbum({ titres: { ...config.titres, [sec.dossier]: titres.titre } })
            }
          >
            {t`utiliser`}
          </button>
        </div>
      )}
      {titres.introduction && titres.introduction !== introActuelle && !coupure && (
        <div>
          <span class="source ia">{t`IA`}</span> {t`Introduction : « ${titres.introduction} »`}{' '}
          <button type="button" class="lien" onClick={() => changerAlbum({ intros: { ...config.intros, [sec.dossier]: titres.introduction } })}>
            {t`utiliser`}
          </button>
        </div>
      )}
      {titres.references.length > 0 && (
        <div class="discret">
          {t`Sources : ${titres.references.map((r) => r.source).filter(Boolean).slice(0, 3).join(' · ')}`}
        </div>
      )}
    </div>
  );
}

/** Légendes proposées par l'IA (IA13) pour toutes les sections. */
function legendesProposees(): Map<string, string> {
  const s = session.value!;
  const m = new Map<string, string>();
  for (const t of Object.values(s.aides.get<Record<string, { legendes: Record<string, string> }>>('IA13') ?? {})) for (const [id, l] of Object.entries(t.legendes ?? {})) m.set(id, l);
  return m;
}

/** Ordre affiché, partagé avec les sous-composants pendant le rendu. */
let ordreCourant: FichierPlan[] = [];

function PanneauPhoto({ f, fermer }: { f: FichierPlan; fermer: () => void }) {
  const s = session.value!;
  const config = s.album;
  const [legende, setLegende] = useState(f.legende ?? '');
  const coupure = config.coupures[f.id];
  return (
    <div class="panneau-photo">
      <div class="apercu">
        <Miniature f={f} taille={240} rotation={f.rotation} recadrage={f.recadrage} />
      </div>
      <div class="details">
        <strong>{f.nom}</strong>
        <span class="discret">
          {jourCourt(f.date)} {f.date?.slice(11, 16)} · {s.plan.dossiers.get(f.dossier)?.nom}
        </span>
        {legendesProposees().get(f.id) && legendesProposees().get(f.id) !== legende && (
          <div class="proposition-texte">
            <span class="source ia">{t`IA`}</span> {t`« ${legendesProposees().get(f.id)} »`}{' '}
            <button type="button" class="lien" onClick={() => (setLegende(legendesProposees().get(f.id)!), appliquer(changerLegende(s.plan, f.id, legendesProposees().get(f.id)!)))}>
              {t`utiliser`}
            </button>
          </div>
        )}
        <label>
          {t`Légende`}
          <textarea
            rows={2}
            value={legende}
            onInput={(e) => setLegende(e.currentTarget.value)}
            onBlur={() => appliquer(changerLegende(s.plan, f.id, legende))}
            placeholder={t`Texte à recopier dans ifolor sous la photo`}
          />
        </label>
        <div class="actions">
          <button type="button" onClick={() => appliquer(changerLegende(s.plan, f.id, legende))}>
            {t`Enregistrer la légende`}
          </button>
          {f.album === 2 ? (
            <button type="button" onClick={() => appliquer(noterAlbum(s.plan, [f.id], 1))}>
              {t`Petite photo ★`}
            </button>
          ) : (
            <button type="button" onClick={() => appliquer(noterAlbum(s.plan, [f.id], 2))}>
              {t`Grande photo ★★`}
            </button>
          )}
          <button type="button" onClick={() => appliquer(tourner(s.plan, [f.id], 90))}>
            <Icone nom="tourner" taille={16} />
            {t`Tourner`}
          </button>
          <button type="button" onClick={() => changerAlbum({ couverture: config.couverture === f.id ? undefined : f.id })}>
            {config.couverture === f.id ? t`Ne plus en faire la couverture` : t`Choisir comme couverture`}
          </button>
          {coupure === undefined ? (
            <button
              type="button"
              onClick={async () => {
                const titre = await demander(t`Nouvelle section`, t`La section commencera à cette photo. Son titre :`, titreDossier(s.plan, f.dossier), (v) => (v.trim() ? null : t`Donnez un titre.`), t`Créer`);
                if (titre) changerAlbum({ coupures: { ...config.coupures, [f.id]: titre.trim() } });
              }}
            >
              {t`Nouvelle section à partir d’ici`}
            </button>
          ) : (
            <button type="button" onClick={() => changerAlbum({ coupures: retirerCle(config.coupures, f.id) })}>
              {t`Supprimer la section qui commence ici`}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              appliquer(noterAlbum(s.plan, [f.id], 0));
              fermer();
            }}
          >
            {t`Retirer de l’album`}
          </button>
          <button type="button" onClick={fermer}>
            {t`Fermer`}
          </button>
        </div>
      </div>
    </div>
  );
}

function TableauTextes({ secs, ordre }: { secs: Section[]; ordre: FichierPlan[] }) {
  const s = session.value!;
  const proposees = legendesProposees();
  const aReprendre = ordre.filter((f) => proposees.get(f.id) && !f.legende);
  return (
    <>
    {aReprendre.length > 0 && (
      <p>
        <button
          type="button"
          onClick={() => {
            appliquer(combiner(t`Reprendre ${pluriel(aReprendre.length, 'légende proposée', 'légendes proposées')}`, ...aReprendre.map((f) => changerLegende(s.plan, f.id, proposees.get(f.id)!))));
            notifier('ok', t`${aReprendre.length} légende(s) reprise(s) : modifiez-les à volonté.`, { libelle: t`Annuler`, faire: annuler });
          }}
        >
          {t`Reprendre les ${aReprendre.length} légendes proposées par l’IA (sans toucher aux légendes déjà écrites)`}
        </button>
      </p>
    )}
    <table class="tableau textes-album">
      <thead>
        <tr>
          <th>{t`Photo`}</th>
          <th>{t`Section`}</th>
          <th>{t`Légende`}</th>
        </tr>
      </thead>
      <tbody>
        {secs.flatMap((sec, k) =>
          ordre.slice(sec.debut, sec.fin + 1).map((f, i) => (
            <tr key={f.id}>
              <td class="mini">
                <Miniature f={f} taille={64} rotation={f.rotation} recadrage={f.recadrage} />
              </td>
              <td>{i === 0 ? <strong>{`${k + 1}. ${sec.titre}`}</strong> : <span class="discret">{f.date?.slice(11, 16)}</span>}</td>
              <td>
                <input class="large" value={f.legende ?? ''} placeholder={proposees.get(f.id) ? t`IA : ${proposees.get(f.id)}` : t`(sans légende)`} onChange={(e) => appliquer(changerLegende(s.plan, f.id, e.currentTarget.value))} />
              </td>
            </tr>
          )),
        )}
      </tbody>
    </table>
    </>
  );
}

export function PageAlbum() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const config = s.album;
  const [onglet, setOnglet] = useState<'pages' | 'textes'>('pages');
  const [choisie, setChoisie] = useState<string | null>(null);
  const ordre = ordreAlbum(photosAlbum(s.plan), config.ordre);
  ordreCourant = ordre;
  const secs = sections(ordre, (d) => titreDossier(s.plan, d), config);
  const pages = paginer(ordre, secs, config);
  const parId = new Map(ordre.map((f) => [f.id, f]));
  const indexDe = new Map(ordre.map((f, i) => [f.id, i]));
  const sectionDe = (i: number) => secs.findIndex((x) => i >= x.debut && i <= x.fin);
  const pagesParSection = new Map<number, Page[]>();
  for (const p of pages) {
    const k = sectionDe(indexDe.get(p.photos[0])!);
    pagesParSection.set(k, [...(pagesParSection.get(k) ?? []), p]);
  }
  const numeroPage = new Map(pages.map((p, i) => [p, i + 1]));
  const f = choisie ? parId.get(choisie) : undefined;
  const cible = cibleEnPages(config);
  const conseil = ordre.length ? conseilCible(ordre, config) : null;
  const doubles = doublesAlbum(s.plan);
  const legendes = ordre.filter((x) => x.legende).length;
  const nomDossier = (id: string) => s.plan.dossiers.get(s.plan.fichiers.get(id)?.dossier ?? '')?.nom ?? '';

  return (
    <div class="page large avec-barre page-album">
      <LigneEtape titre={nomEtape(ETAPE.album)} aide={{ cle: 'album' }} />
      <AideEtape cle="album">
        {t`Voici l’album tel qu’il sera préparé pour ifolor : les photos retenues dans l’ordre des journées, regroupées en sections. Modifiez les titres, ajoutez des légendes, découpez ou regroupez les sections ; cliquez une photo pour la modifier.`}
      </AideEtape>

      <div class="reglages-etape ligne">
        <label>
          {t`Ordre`}{' '}
          <select value={config.ordre} onChange={(e) => changerAlbum({ ordre: e.currentTarget.value as 'segments' | 'chrono' })}>
            <option value="segments">{t`Par journée, puis par sortie (conseillé)`}</option>
            <option value="chrono">{t`Strictement chronologique`}</option>
          </select>
        </label>
        <label>
          {t`Photos par page`}{' '}
          <input
            type="number"
            class="tres-court"
            min="1"
            max="12"
            value={config.photosParPage}
            onChange={(e) => changerAlbum({ photosParPage: Math.max(1, Math.min(12, Number(e.currentTarget.value) || 1)) })}
          />
        </label>
        <label class="case">
          <input type="checkbox" checked={config.nouvellePageParSection} onChange={(e) => changerAlbum({ nouvellePageParSection: e.currentTarget.checked })} />{' '}
          {t`Chaque section commence sur une nouvelle page`}
        </label>
        <label>
          {t`Cible`}{' '}
          <input
            type="number"
            class="tres-court cible-pages"
            min="1"
            value={config.cible.nombre}
            onChange={(e) => changerAlbum({ cible: { ...config.cible, nombre: Math.max(1, Number(e.currentTarget.value) || 1) } })}
          />{' '}
          {config.cible.mode === 'pages' ? t`pages` : t`photos`}
        </label>
        <details class="avances">
          <summary>{t`Réglages avancés`}</summary>
          <label class="case">
            <input type="checkbox" checked={config.sousDossiers} onChange={(e) => changerAlbum({ sousDossiers: e.currentTarget.checked })} />{' '}
            {t`Un sous-dossier par section dans « Album » (sinon tout dans un seul dossier, numéroté)`}
          </label>
        </details>
      </div>

      {ordre.length > 0 && <AidesAlbum />}
      {ordre.length > 0 && conseil && <ConseilPages conseil={conseil} />}
      {doubles.length > 0 && (
        <details class="doubles-album">
          <summary>{t`${pluriel(doubles.length, 'photo en double retirée', 'photos en double retirées')} de l’album : la même photo était retenue dans deux dossiers.`}</summary>
          <ul class="liste-courte">
            {doubles.map((d) => (
              <li key={d.id}>{t`${s.plan.fichiers.get(d.id)?.nom ?? d.id} (« ${nomDossier(d.id)} ») : déjà dans « ${nomDossier(d.garde)} »`}</li>
            ))}
          </ul>
        </details>
      )}
      {ordre.length === 0 ? (
        <div class="encart">
          <p>{t`Aucune photo retenue pour l’album : choisissez-les à l’étape ${ETAPE.selection}.`}</p>
          <button type="button" class="principal" onClick={() => allerEtape('selection')}>
            {t`Aller à la sélection`}
          </button>
        </div>
      ) : (
        <>
          <div class="onglets">
            <button type="button" class={onglet === 'pages' ? 'actif' : ''} onClick={() => setOnglet('pages')}>
              {t`Aperçu des pages`}
            </button>
            <button type="button" class={onglet === 'textes' ? 'actif' : ''} onClick={() => setOnglet('textes')}>
              {t`Tous les textes`}
            </button>
            <span class="discret">
              {pluriel(ordre.length, 'photo')} · {pluriel(secs.length, 'section')} · {pluriel(pages.length, 'page simulée', 'pages simulées')} {t`(cible : ${nombre(cible)})`} ·{' '}
              {pluriel(legendes, 'légende')}
            </span>
          </div>
          {f && <PanneauPhoto key={f.id} f={f} fermer={() => setChoisie(null)} />}
          {onglet === 'pages' ? (
            <div class="sections-album">
              <Couverture ouvrir={(id) => parId.has(id) && setChoisie(id)} />
              {secs.map((sec, k) => (
                <section key={`${k}-${ordre[sec.debut].id}`} class="section-album">
                  <EnteteSection sec={sec} index={k} />
                  <div class="pages">
                    {planches(pagesParSection.get(k) ?? [], numeroPage).map((planche) => (
                      <div key={numeroPage.get(planche[0])} class="planche">
                        {planche.map((p) => (
                          <div key={numeroPage.get(p)} class={`page-album-apercu ${numeroPage.get(p)! % 2 ? 'droite' : 'gauche'}${p.grande ? ' pleine' : ''}`}>
                            <span class="numero-page">{numeroPage.get(p)}</span>
                            <div class={`photos-page n${Math.min(p.photos.length, 6)}`}>
                              {p.photos.map((id) => (
                                <MiniaturePage
                                  key={id}
                                  f={parId.get(id)!}
                                  grande={p.grande}
                                  seule={p.photos.length === 1}
                                  choisie={choisie === id}
                                  choisir={() => setChoisie(choisie === id ? null : id)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <TableauTextes secs={secs} ordre={ordre} />
          )}
        </>
      )}

      <BarreValidation
        resume={`${pluriel(ordre.length, 'photo')} · ${pluriel(secs.length, 'section')} · ${pluriel(pages.length, 'page')}`}
        alertes={conseil ? [texteEcart(conseil)] : []}
        revenir={() => revenirDe('album')}
        valider={() => validerEtape('album')}
        validerActif={ordre.length > 0}
        raisonInactif={t`Aucune photo dans l’album.`}
      />
    </div>
  );
}
