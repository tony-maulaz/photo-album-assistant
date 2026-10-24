// Propositions de l'inventaire (étape 2, SPEC § 6.2) : captures d'écran,
// doublons exacts (même contenu, ou copie réduite de type WhatsApp) et
// appareils avec leur décalage d'horloge.

import { useMemo, useState } from 'preact/hooks';
import { appareilsDetectes, mesurerDecalage, type MesureDecalage } from '../../lib/appareils';
import { groupesDoublonsExacts, type GroupeExact } from '../../lib/doublonsExacts';
import { estCapture, extension } from '../../lib/fichiers';
import { appliquerDecalages, ecarterDoublonsExacts, rangerCaptures } from '../../lib/inventaire';
import { cheminDossier, traitementDe, type FichierPlan, type Plan } from '../../lib/plan';
import { analyseAFaire, analyseEnCours } from '../analyseDossier';
import { annuler, appliquer, configuration, notifier, session, texteErreur, versionIA, versionPlan, type Session } from '../etat';
import { jourCourt, nombre, pluriel } from '../format';
import { Miniature } from './GrillePhotos';

const garde = (plan: Plan, f: FichierPlan) => ['garder', 'ignorer'].includes(traitementDe(plan, f.dossier) ?? '');

/** Captures d'écran proposées au rangement (pas encore rangées, hors dossiers gardés tels quels). */
export function capturesProposees(s: Session): FichierPlan[] {
  return [...s.plan.fichiers.values()].filter(
    (f) => f.categorie === 'photo' && f.statut === 'archive' && !f.capture && !garde(s.plan, f) && estCapture({ nom: f.nom, marque: f.marque, appareil: f.appareil, dims: f.dims, extension: extension(f.nom) }),
  );
}

function Captures() {
  const s = session.value!;
  versionPlan.value;
  const rangees = [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive' && f.capture).length;
  const candidates = capturesProposees(s);
  if (!candidates.length && !rangees) return null;
  return (
    <section id="captures">
      <h2>Captures d’écran</h2>
      {candidates.length > 0 ? (
        <>
          <p>
            {pluriel(candidates.length, 'capture d’écran trouvée', 'captures d’écran trouvées')} (nom de fichier, dimensions d’écran, pas de marque d’appareil). Proposition :
            les ranger dans « Captures_ecran », hors de l’album.
          </p>
          <div class="bande-miniatures">
            {candidates.slice(0, 12).map((f) => (
              <Miniature key={f.id} f={f} taille={90} />
            ))}
          </div>
          <button type="button" onClick={() => appliquer(rangerCaptures(s.plan, candidates.map((f) => f.id)))}>
            Ranger les {nombre(candidates.length)} captures dans « Captures_ecran »
          </button>
        </>
      ) : (
        <p class="discret">{pluriel(rangees, 'capture rangée', 'captures rangées')} dans « Captures_ecran ».</p>
      )}
    </section>
  );
}

/**
 * Copies exactes encore à écarter, ou `null` tant que l'analyse du dossier
 * n'est pas finie (empreintes et ressemblance en viennent, D56).
 */
export function useCopiesExactes(): { groupes: GroupeExact[]; nbCopies: number } | null {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const pret = !analyseEnCours.value && !analyseAFaire(s);
  const groupes = useMemo<GroupeExact[] | null>(() => {
    if (!pret) return null;
    const actuelles = [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive');
    return groupesDoublonsExacts(
      actuelles.map((f) => ({
        id: f.id,
        nom: f.nom,
        dossier: f.dossier,
        taille: f.taille,
        empreinte: f.empreinte,
        phash: s.analyses.get(f)?.phash,
        dims: f.dims,
        exif: f.origineDate === 'exif',
        gardeTelQuel: garde(s.plan, f),
      })),
    );
  }, [pret, versionPlan.value, versionIA.value]);
  if (!groupes) return null;
  const actifs = groupes.map((g) => ({ ...g, copies: g.copies.filter((c) => s.plan.fichiers.get(c.id)?.statut === 'archive') })).filter((g) => g.copies.length && s.plan.fichiers.has(g.garde));
  return { groupes: actifs, nbCopies: actifs.reduce((a, g) => a + g.copies.length, 0) };
}

function DoublonsExacts() {
  const s = session.value!;
  const copies = useCopiesExactes();
  const actifs = copies?.groupes ?? [];
  const nbCopies = copies?.nbCopies ?? 0;
  const chemin = (f: FichierPlan) => cheminDossier(s.plan, f.dossier) || 'racine';

  return (
    <section id="copies">
      <h2>Copies en double</h2>
      <p class="discret">
        La même photo en plusieurs exemplaires (même contenu, ou copie réduite envoyée par WhatsApp), quel que soit le dossier. L’original le plus complet est gardé ; les
        copies vont dans « _mis_de_cote/doublons_exacts ». Rien n’est jamais retiré d’un dossier gardé tel quel.
      </p>
      {!copies && <p class="discret">Recherche en cours, pendant l’analyse des photos…</p>}
      {copies && !actifs.length && <p>Aucune copie à écarter.</p>}
      {actifs.length > 0 && (
        <>
          <p>
            <strong>{pluriel(nbCopies, 'copie', 'copies')}</strong> dans {pluriel(actifs.length, 'groupe')}.{' '}
            <button type="button" class="principal" onClick={() => (appliquer(ecarterDoublonsExacts(s.plan, actifs)), notifier('ok', `${pluriel(nbCopies, 'copie écartée', 'copies écartées')}.`, { libelle: 'Annuler', faire: annuler }))}>
              Écarter les {nombre(nbCopies)} copies
            </button>
          </p>
          <div class="groupes-exacts">
            {actifs.slice(0, 40).map((g) => {
              const o = s.plan.fichiers.get(g.garde)!;
              return (
                <div key={g.garde} class="groupe-exact">
                  <figure>
                    <Miniature f={o} taille={110} />
                    <figcaption>
                      <strong>gardée</strong> {o.nom}
                      <br />
                      <span class="discret">{chemin(o)}</span>
                    </figcaption>
                  </figure>
                  {g.copies.map((c) => {
                    const f = s.plan.fichiers.get(c.id)!;
                    return (
                      <figure key={c.id}>
                        <Miniature f={f} taille={110} />
                        <figcaption>
                          {c.type === 'reduite' ? 'copie réduite' : 'copie identique'} {f.nom}
                          <br />
                          <span class="discret">{chemin(f)}</span>
                        </figcaption>
                      </figure>
                    );
                  })}
                  <button type="button" onClick={() => appliquer(ecarterDoublonsExacts(s.plan, [g]))}>
                    Écarter
                  </button>
                </div>
              );
            })}
            {actifs.length > 40 && <p class="discret">… et {actifs.length - 40} autres groupes.</p>}
          </div>
        </>
      )}
    </section>
  );
}

function Appareils() {
  const s = session.value!;
  versionPlan.value;
  const config = configuration.value;
  const appareilsConfig = config?.lecture?.config?.appareils ?? [];
  const [mesure, setMesure] = useState<{ a: string; b: string; r: MesureDecalage | null } | null>(null);
  const photos = [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut !== 'mis_de_cote');
  const liste = appareilsDetectes(photos);
  if (liste.length === 0) return null;
  const configure = (m: string) => appareilsConfig.find((a) => a.modele.trim().toLowerCase() === m.trim().toLowerCase());
  const aCorriger = appareilsConfig.some((a) => a.decalage !== '+00:00' && liste.some((l) => l.modele === a.modele)) || photos.some((f) => f.decalage);

  const enregistrer = async (modele: string, decalage = '+00:00') => {
    const c = configuration.value;
    if (!c?.lecture?.config) {
      notifier('erreur', 'Choisissez d’abord le dossier de configuration (page Configuration).');
      return;
    }
    try {
      const cfg = structuredClone(c.lecture.config);
      const existant = cfg.appareils.find((a) => a.modele === modele);
      if (existant) existant.decalage = decalage;
      else cfg.appareils.push({ modele, decalage, surnom: '' });
      configuration.value = { dossier: c.dossier, lecture: await c.dossier.ecrire(cfg, c.lecture) };
      notifier('ok', `Appareil « ${modele} » enregistré dans la configuration${decalage !== '+00:00' ? ` avec le décalage ${decalage}` : ''}.`);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const mesurer = (a: string, b: string) => {
    const horloge = (m: string) => photos.filter((f) => f.appareil === m).map((f) => ({ id: f.id, date: f.date, phash: s.analyses.get(f)?.phash }));
    setMesure({ a, b, r: mesurerDecalage(horloge(a), horloge(b), { fenetreHeures: 24 }) });
  };

  return (
    <section>
      <h2>Appareils</h2>
      <table class="tableau">
        <thead>
          <tr>
            <th>Modèle</th>
            <th class="n">Photos</th>
            <th>Période</th>
            <th>Décalage d’horloge</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {liste.map((a) => {
            const c = configure(a.modele);
            return (
              <tr key={a.modele}>
                <td>
                  {a.modele}
                  {c?.surnom ? ` (${c.surnom})` : ''}
                </td>
                <td class="n">{nombre(a.n)}</td>
                <td>
                  {jourCourt(a.du)} – {jourCourt(a.au)}
                </td>
                <td>{c ? c.decalage : <span class="discret">non enregistré</span>}</td>
                <td>
                  {!c && (
                    <button type="button" class="lien" onClick={() => void enregistrer(a.modele)}>
                      Enregistrer
                    </button>
                  )}
                  {liste.length > 1 && (
                    <button type="button" class="lien" onClick={() => mesurer(liste.find((x) => x.modele !== a.modele)!.modele, a.modele)} title="Compare les photos d’une même scène prises par deux appareils">
                      Mesurer le décalage
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {mesure && (
        <p class="encart">
          {mesure.r ? (
            <>
              « {mesure.b} » a {mesure.r.paires} photo(s) de la même scène que « {mesure.a} » : son horloge est décalée de <strong>{mesure.r.decalage}</strong>.{' '}
              {mesure.r.minutes !== 0 && (
                <button type="button" onClick={() => void enregistrer(mesure.b, mesure.r!.decalage)}>
                  Enregistrer ce décalage
                </button>
              )}
            </>
          ) : (
            <>Pas assez de photos de la même scène prises par les deux appareils pour mesurer un décalage.</>
          )}
        </p>
      )}
      {aCorriger && (
        <p>
          <button type="button" onClick={() => appliquer(appliquerDecalages(s.plan, appareilsConfig))}>
            Corriger l’heure des photos selon les décalages enregistrés
          </button>
        </p>
      )}
    </section>
  );
}

export function ExtrasInventaire() {
  return (
    <>
      <Captures />
      <DoublonsExacts />
      <Appareils />
    </>
  );
}
