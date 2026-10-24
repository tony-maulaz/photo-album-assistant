// Étape « Doublons » (SPEC § 6.8) : rafales repérées localement (gratuit),
// puis, sur demande, analyse IA de chaque dossier, ou de chaque journée pour
// un dossier en vrac (script 06, D54). Chaque groupe se relit : la photo
// gardée, ses doublons, pourquoi ; rien n'est écarté sans action de
// l'utilisateur (règle d'or 3).

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { accepterProposition, ecarterDuGroupe, etatDoublon, gardeeActuelle, garderALaPlace, type Proposition } from '../../lib/doublons';
import { cheminDossier, combiner, garderAussi, type FichierPlan } from '../../lib/plan';
import { MODELES } from '../../lib/tarifs';
import { cleApi } from '../../navigateur/cle';
import { analyserDoublons, estimerDoublons, lotsDoublons, photosLot } from '../../navigateur/doublons';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { BudgetAtteint } from '../../navigateur/ia';
import { cleMiniature } from '../../navigateur/miniatures';
import { EncartAnalyse } from '../composants/Analyse';
import { analyseEnCours } from '../analyseDossier';
import { enregistrerAide } from './AidesIA';
import { BarreProgression, BarreValidation, TeteEtape } from '../composants/Cadre';
import { Comparateur } from '../composants/Comparateur';
import { confirmer } from '../composants/Dialogues';
import { Miniature } from '../composants/GrillePhotos';
import { allerEtape, annuler, appliquer, changerEtape, journal, notifier, page, reglages, revenirDe, serviceMiniatures, session, texteErreur, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { aTraduire, t } from '../../lib/langue';
import { nombre, pluriel } from '../format';

type Filtre = 'a_relire' | 'priorite' | 'tous' | 'acceptes';

/** Lots comparés : les dossiers, ou les journées tant que le dossier à trier est en vrac (D54). */
function lots(s: Session) {
  return lotsDoublons(s.plan, s.projet.mode === 'vrac');
}

/** « dossier » ou « journée », selon les lots. */
function unite(s: Session): [string, string] {
  return s.projet.mode === 'vrac' ? [aTraduire('journée'), aTraduire('journées')] : [aTraduire('dossier'), aTraduire('dossiers')];
}

// IA7 au catalogue : l'estimation pour le projet ; le lancement se fait depuis l'étape « Doublons » (réglages Prudent / Strict).
enregistrerAide({
  id: 'IA7',
  nom: aTraduire('Doublons (IA)'),
  etape: ETAPE.doublons,
  description: aTraduire('Vue d’ensemble de chaque dossier (ou de chaque journée pour un dossier en vrac), puis vérification en grand des scènes répétées, avec garde-fous (script 06).'),
  envoi: aTraduire('planches de miniatures de chaque dossier ou journée, puis 6 photos au plus en grand par vérification'),
  web: false,
  usage: 'standard',
  estimer: (s) => {
    const ids = lots(s).map((l) => l.id);
    if (!ids.length) return null;
    const e = estimerDoublons(s.plan, s.analyses, ids, reglages.value.modeles.standard, s.ia);
    return { usd: e.usd, appels: e.appels, detail: t`${pluriel(e.dossiers, ...unite(s))} (analyse locale des photos nécessaire)` };
  },
  lancer: async () => {
    allerEtape('doublons');
    return t`Lancez l’analyse depuis l’étape ${ETAPE.doublons}.`;
  },
});

interface Groupe {
  dossier: string;
  p: Proposition;
  /** Clé stable d'affichage. */
  cle: string;
}

/** À vérifier en priorité : le garde-fou a refusé une photo, ou un doublon est plus net que la gardée. */
function prioritaire(g: Groupe, nettete: (id: string) => number | undefined): boolean {
  if (g.p.refus?.length) return true;
  const n = nettete(g.p.garde);
  return n !== undefined && g.p.doublons.some((d) => (nettete(d.id) ?? 0) > n * 1.2);
}

function etatGroupe(g: Groupe, fichier: (id: string) => FichierPlan | undefined): 'propose' | 'accepte' | 'garde' | 'mixte' {
  const etats = new Set(g.p.doublons.map((d) => etatDoublon(fichier(d.id))));
  return etats.size === 1 ? [...etats][0] : 'mixte';
}

function Vignette({ f, taille, legende, gardee, etat }: { f: FichierPlan; taille: number; legende?: string; gardee?: boolean; etat?: string }) {
  return (
    <figure class={`vignette-doublon${gardee ? ' gardee' : ''}${etat ? ` ${etat}` : ''}`}>
      <div class="cadre-miniature" style={{ width: `${taille}px`, height: `${taille}px` }}>
        <Miniature f={f} taille={taille} />
        {gardee && <span class="badge gardee">{t`gardée`}</span>}
        {etat === 'accepte' && <span class="badge ecartee">{t`écartée`}</span>}
        {etat === 'garde' && !gardee && <span class="badge gardee">{t`gardée aussi`}</span>}
      </div>
      <figcaption>
        <strong>{f.date?.slice(11, 16) ?? ''}</strong> {legende && <span>{legende}</span>}
      </figcaption>
    </figure>
  );
}

function CarteGroupe({ g, comparer }: { g: Groupe; comparer: (g: Groupe) => void }) {
  const s = session.value!;
  const fichier = (id: string) => s.plan.fichiers.get(id);
  // La photo gardée en ce moment : la proposée, ou celle choisie à sa place.
  const gardeId = gardeeActuelle(g.p, fichier);
  const garde = fichier(gardeId);
  if (!garde) return null;
  const etat = etatGroupe(g, fichier);
  const autres = [g.p.garde, ...g.p.doublons.map((d) => d.id)].filter((id) => id !== gardeId);
  const proposes = autres.filter((id) => etatDoublon(fichier(id)) === 'propose');
  const infos = new Map(g.p.doublons.map((d) => [d.id, d]));
  const description = (id: string) => (id === g.p.garde ? g.p.descriptionGardee : infos.get(id)?.description);
  return (
    <article class={`carte-groupe ${etat}`}>
      <header>
        <span class={`source ${g.p.source}`}>{g.p.source === 'rafale' ? t`Rafale` : t`IA`}</span>
        <span>{g.p.scene || (g.p.source === 'rafale' ? t`photos quasi identiques prises à quelques secondes` : '')}</span>
        <span class="discret">{cheminDossier(s.plan, garde.dossier) || t`Photos (racine)`}</span>
      </header>
      <div class="photos-groupe">
        <div onDblClick={() => comparer(g)} title={t`Double-clic : comparer le groupe`}>
          <Vignette f={garde} taille={220} gardee legende={description(gardeId)} />
          {gardeId !== g.p.garde && <p class="raison">{t`choisie à la place de la photo proposée`}</p>}
        </div>
        {autres.map((id) => {
          const f = fichier(id);
          if (!f) return null;
          const e = etatDoublon(f);
          return (
            <div key={id} class="doublon" onDblClick={() => comparer(g)} title={t`Double-clic : comparer le groupe`}>
              <Vignette f={f} taille={160} legende={description(id)} etat={e} />
              <p class="raison">{id === g.p.garde ? t`la photo que l’analyse proposait de garder` : infos.get(id)?.raison}</p>
              {/* Chaque photo garde de quoi changer d'avis, quel que soit son état. */}
              <div class="actions-doublon">
                {e === 'garde' ? (
                  <button type="button" onClick={() => appliquer(ecarterDuGroupe(s.plan, g.p, id))} title={t`Finalement, l’écarter avec les autres doublons (rien n’est supprimé)`}>
                    {t`Écarter`}
                  </button>
                ) : (
                  <button type="button" onClick={() => appliquer(garderAussi(s.plan, [id]))} title={t`Cette photo reste dans l’archive et ne sera plus proposée`}>
                    {t`Garder aussi`}
                  </button>
                )}
                <button type="button" onClick={() => appliquer(garderALaPlace(s.plan, g.p, id))} title={t`Garder celle-ci et écarter la photo gardée jusqu’ici`}>
                  {t`Garder celle-ci à la place`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {g.p.refus && g.p.refus.length > 0 && (
        <p class="garde-fou">
          {t`Le garde-fou a gardé ${pluriel(g.p.refus.length, 'photo')} que l’IA proposait d’écarter : les descriptions ne parlaient pas de la même scène.`}
        </p>
      )}
      <footer>
        <button type="button" onClick={() => comparer(g)}>
          {t`Comparer`}
        </button>
        <span class="espace" />
        {proposes.length > 0 && (
          <>
            <button type="button" onClick={() => appliquer(garderAussi(s.plan, proposes))}>
              {t`Tout garder`}
            </button>
            <button type="button" class="principal" onClick={() => appliquer(accepterProposition(s.plan, g.p, gardeId))}>
              {proposes.length > 1 ? t`Écarter les ${proposes.length} doublons` : t`Écarter le doublon`}
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

export function PageDoublons() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const plan = s.plan;
  const [strict, setStrict] = useState(s.doublons?.strict ?? false);
  const [modele, setModele] = useState(s.doublons?.modele ?? reglages.value.modeles.standard);
  const [filtre, setFiltre] = useState<Filtre>('a_relire');
  const [dossierVu, setDossierVu] = useState<string>('');
  const [progres, setProgres] = useState<{ faits: number; total: number; texte: string } | null>(null);
  const [comparees, setComparees] = useState<Groupe | null>(null);
  const [limite, setLimite] = useState(30);
  const arreter = useRef(false);

  const listeLots = useMemo(() => lots(s), [versionPlan.value]);
  const dossiers = listeLots.map((l) => l.id);
  const [un, plusieurs] = unite(s);
  const toutes = useMemo(() => [...plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive'), [versionPlan.value]);
  const estimation = useMemo(() => estimerDoublons(plan, s.analyses, dossiers, modele, s.ia), [versionPlan.value, versionIA.value, modele]);
  const chf = estimation.usd * reglages.value.tauxUsdChf;
  const analysesManquantes = s.analyses.manquantes(toutes).length;

  const groupes: Groupe[] = Object.entries(s.doublons?.dossiers ?? {}).flatMap(([dossier, d]) => d.propositions.map((p, i) => ({ dossier, p, cle: `${dossier}#${i}` })));
  const fichier = (id: string) => plan.fichiers.get(id);
  const nettete = (id: string) => {
    const f = fichier(id);
    return f ? s.analyses.get(f)?.nettete : undefined;
  };
  const visibles = groupes.filter((g) => {
    if (!fichier(g.p.garde)) return false;
    if (dossierVu && g.dossier !== dossierVu) return false;
    const e = etatGroupe(g, fichier);
    if (filtre === 'a_relire') return e === 'propose' || e === 'mixte';
    if (filtre === 'priorite') return (e === 'propose' || e === 'mixte') && prioritaire(g, nettete);
    if (filtre === 'acceptes') return e === 'accepte' || e === 'mixte';
    return true;
  });

  // Aperçu par dossier : photos avant, doublons proposés et écartés, photos après.
  const parDossier = new Map<string, { proposes: number; ecartes: number }>();
  for (const g of groupes) {
    const x = parDossier.get(g.dossier) ?? { proposes: 0, ecartes: 0 };
    for (const d of g.p.doublons) {
      const e = etatDoublon(fichier(d.id));
      if (e === 'propose') x.proposes++;
      if (e === 'accepte') x.ecartes++;
    }
    parDossier.set(g.dossier, x);
  }
  const totalProposes = [...parDossier.values()].reduce((a, x) => a + x.proposes, 0);
  const totalEcartes = [...plan.fichiers.values()].filter((f) => f.statut === 'mis_de_cote' && f.raison === 'doublons').length;

  const lancer = async (avecIA: boolean) => {
    if (avecIA && !cleApi()) {
      notifier('erreur', t`Saisissez d’abord votre clé API dans Réglages.`, { libelle: t`Réglages`, faire: () => (page.value = { nom: 'reglages' }) });
      return;
    }
    if (avecIA && chf > s.ia.resteUSD() * reglages.value.tauxUsdChf) {
      notifier('erreur', t`Le budget restant du projet ne suffit pas (environ ${nombre(chf, 2)} CHF nécessaires) : augmentez-le à l’étape 1.`);
      return;
    }
    if (
      avecIA &&
      chf >= reglages.value.seuilConfirmationChf &&
      !(await confirmer(
        t`Lancer l’analyse IA des doublons ?`,
        estimation.enCache
          ? t`Environ ${nombre(chf, 2)} CHF (au plus) pour ${pluriel(estimation.dossiers, un, plusieurs)} ; ${un === 'journée' ? pluriel(estimation.enCache, 'journée déjà analysée, gratuite', 'journées déjà analysées, gratuites') : pluriel(estimation.enCache, 'dossier déjà analysé, gratuit', 'dossiers déjà analysés, gratuits')}. Des planches de miniatures sont envoyées à l’IA (api.anthropic.com).`
          : t`Environ ${nombre(chf, 2)} CHF (au plus) pour ${pluriel(estimation.dossiers, un, plusieurs)}. Des planches de miniatures sont envoyées à l’IA (api.anthropic.com).`,
        t`Lancer`,
      ))
    )
      return;
    arreter.current = false;
    const debut = performance.now();
    try {
      const res = await analyserDoublons(
        {
          plan,
          etat: s.etat,
          analyses: s.analyses,
          dossiers,
          strict,
          ia: avecIA ? { service: s.ia, modele } : null,
          miniature: async (f) => {
            const url = await serviceMiniatures().url(cleMiniature(f.id, f.taille, f.modifie), () => s.source.fichier(f.id));
            return url ? await (await fetch(url)).blob() : await s.source.fichier(f.id);
          },
          original: (f) => s.source.fichier(f.id),
          progres: (faits, total, texte) => setProgres({ faits, total, texte }),
          arreter: () => arreter.current,
        },
        s.doublons,
      );
      s.doublons = res.etat;
      const n = Object.values(res.etat.dossiers).reduce((a, d) => a + d.propositions.reduce((b, p) => b + p.doublons.length, 0), 0);
      journal('doublons', t`Doublons (${avecIA ? t`IA, ${modele}` : t`rafales`}, ${strict ? t`strict` : t`prudent`}) : ${n} proposés en ${Math.round((performance.now() - debut) / 1000)} s`);
      if (res.budgetAtteint) notifier('erreur', new BudgetAtteint().message);
      else if (res.erreurs.length)
        notifier('erreur', t`${un === 'journée' ? pluriel(res.erreurs.length, 'journée non analysée', 'journées non analysées') : pluriel(res.erreurs.length, 'dossier non analysé', 'dossiers non analysés')} : ${res.erreurs[0]}`);
      else notifier('ok', t`${pluriel(n, 'doublon proposé', 'doublons proposés')} : relisez-les ci-dessous.`);
      changerEtape(ETAPE.doublons, 'en_cours');
    } catch (err) {
      notifier('erreur', t`Analyse interrompue : ${texteErreur(err)}`);
    } finally {
      setProgres(null);
      versionIA.value++;
    }
  };

  // Les rafales se repèrent toutes seules (gratuit, local) dès que l'analyse des photos est prête (D56).
  useEffect(() => {
    if (!s.doublons && !progres && !analyseEnCours.value && analysesManquantes === 0) void lancer(false);
  }, [analysesManquantes === 0, !!analyseEnCours.value]);

  const toutAccepter = async () => {
    const aAccepter = visibles.filter((g) => g.p.doublons.some((d) => etatDoublon(fichier(d.id)) === 'propose'));
    const n = aAccepter.reduce((a, g) => a + g.p.doublons.filter((d) => etatDoublon(fichier(d.id)) === 'propose').length, 0);
    if (!n || !(await confirmer(t`Écarter tous les doublons affichés ?`, t`${pluriel(n, 'photo')} iront dans « _mis_de_cote/doublons » (rien n’est supprimé, Ctrl+Z annule).`, t`Écarter`))) return;
    appliquer(combiner(t`Écarter ${n} doublons`, ...aAccepter.map((g) => accepterProposition(plan, g.p, gardeeActuelle(g.p, fichier)))));
    notifier('ok', `${pluriel(n, 'doublon écarté', 'doublons écartés')}.`, { libelle: t`Annuler`, faire: annuler });
  };

  const modeleInfo = MODELES.find((m) => m.id === modele);
  const cout = estimation.dossiers ? t`environ ${chf < 0.01 ? `< ${nombre(0.01, 2)}` : nombre(chf, 2)} CHF` : t`gratuit (déjà fait)`;

  return (
    <div class="page large avec-barre page-doublons">
      <TeteEtape numero={ETAPE.doublons} titre={nomEtape(ETAPE.doublons)} cle="doublons">
        {t`L’application repère les photos en double : rafales quasi identiques (gratuit), puis, si vous le souhaitez, la même scène photographiée plusieurs fois (IA). Vous relisez chaque groupe : les photos écartées vont dans « _mis_de_cote/doublons », rien n’est supprimé.`}
        {s.projet.mode === 'vrac' && t` Le dossier n’étant pas encore trié, les photos sont comparées journée par journée.`}
      </TeteEtape>

      <EncartAnalyse photos={toutes} pourquoi={t`la ressemblance et la netteté de chaque photo servent à repérer les doublons et à garder la plus nette.`} />

      {/* L'analyse IA est facultative : elle vient en complément des rafales, repérées toutes seules. */}
      <details class="avances encart-ia">
        <summary>
          {t`Aller plus loin avec l’IA (facultatif) : la même scène photographiée plusieurs fois —`} {cout}
        </summary>
        <fieldset class="choix-mode">
          <legend>{t`Que considérer comme doublon ?`}</legend>
          <label>
            <input type="radio" name="mode" checked={!strict} onChange={() => setStrict(false)} /> <strong>{t`Prudent`}</strong>
            {t` (conseillé) : des expressions ou des poses différentes sont gardées`}
          </label>
          <label>
            <input type="radio" name="mode" checked={strict} onChange={() => setStrict(true)} /> <strong>{t`Strict`}</strong>
            {t` : une seule photo par scène, même si les expressions changent`}
          </label>
        </fieldset>
        <div class="actions-etape">
          <button type="button" class="principal" disabled={!!progres || analysesManquantes > 0 || !modeleInfo} onClick={() => void lancer(true)}>
            {t`Analyser avec l’IA — ${cout}`}
          </button>
          <span class="discret">{t`${pluriel(dossiers.length, un, plusieurs)} · dépensé : ${nombre(s.ia.depenseCHF(), 2)} / ${s.projet.budget_chf} CHF`}</span>
        </div>
        <details class="avances">
          <summary>{t`Réglages avancés`}</summary>
          <label>
            {t`Modèle IA`}{' '}
            <select value={modele} onChange={(e) => setModele(e.currentTarget.value)}>
              {MODELES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </label>
          <p class="discret">
            {t`Les consignes viennent du script 06, réglé avec Claude Sonnet 4.6 ; les réponses sont mises en cache par modèle. Réglages du script : rafales à moins de 10 min et distance ≤ 12 ; scènes locales à distance ≤ 20 ; vérification par 6 photos au plus.`}
          </p>
          <button
            type="button"
            onClick={() =>
              void s.ia.oublierInexploitables().then((n) => notifier('info', n ? t`${pluriel(n, 'réponse illisible oubliée', 'réponses illisibles oubliées')} : relancez l’analyse.` : t`Aucune réponse illisible.`))
            }
          >
            {t`Redemander les réponses illisibles`}
          </button>
        </details>
      </details>

      {progres && (
        <div class="encart">
          <BarreProgression faits={progres.faits} total={progres.total} texte={`${progres.faits} / ${progres.total} ${t(plusieurs)}${progres.texte ? ` · ${progres.texte}` : ''}`} />
          <button type="button" onClick={() => (arreter.current = true)}>
            {t`Arrêter (les réponses déjà reçues sont gardées)`}
          </button>
        </div>
      )}

      {s.doublons && (
        <>
          <details class="avances apercu-lots">
            <summary>
              {un === 'journée'
                ? t`Aperçu par journée : ${pluriel(totalProposes, 'doublon à relire', 'doublons à relire')}, ${pluriel(totalEcartes, 'écarté', 'écartés')}`
                : t`Aperçu par dossier : ${pluriel(totalProposes, 'doublon à relire', 'doublons à relire')}, ${pluriel(totalEcartes, 'écarté', 'écartés')}`}
            </summary>
          <table class="tableau apercu-doublons">
            <thead>
              <tr>
                <th>{un === 'journée' ? t`Journée` : t`Dossier`}</th>
                <th class="n">{t`Photos avant`}</th>
                <th class="n">{t`Doublons à relire`}</th>
                <th class="n">{t`Écartés`}</th>
                <th class="n">{t`Photos après`}</th>
              </tr>
            </thead>
            <tbody>
              {[...parDossier]
                .filter(([d]) => dossiers.includes(d))
                .map(([d, x]) => {
                  const apres = photosLot(plan, d, s.analyses).length;
                  return (
                    <tr key={d} class={dossierVu === d ? 'actif' : ''} onClick={() => setDossierVu(dossierVu === d ? '' : d)} title={un === 'journée' ? t`Cliquer pour ne voir que cette journée` : t`Cliquer pour ne voir que cette sortie`}>
                      <td>{listeLots.find((l) => l.id === d)?.nom ?? d}</td>
                      <td class="n">{nombre(apres + x.ecartes)}</td>
                      <td class="n">{x.proposes ? nombre(x.proposes) : ''}</td>
                      <td class="n">{x.ecartes ? nombre(x.ecartes) : ''}</td>
                      <td class="n">{nombre(apres - x.proposes)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </details>
          {parDossier.size === 0 && <p>{t`Aucun doublon trouvé.`}</p>}

          <div class="barre-outils filtres-doublons">
            <select value={filtre} onChange={(e) => setFiltre(e.currentTarget.value as Filtre)} aria-label={t`Groupes affichés`}>
              <option value="a_relire">{t`À relire`}</option>
              <option value="priorite">{t`À vérifier en priorité`}</option>
              <option value="acceptes">{t`Doublons écartés`}</option>
              <option value="tous">{t`Tous les groupes`}</option>
            </select>
            {dossierVu && (
              <button type="button" class="lien" onClick={() => setDossierVu('')}>
                {un === 'journée' ? t`Toutes les journées` : t`Tous les dossiers`}
              </button>
            )}
            <span class="discret">{pluriel(visibles.length, 'groupe')}</span>
            <span class="espace" />
            <button type="button" class="principal" disabled={!visibles.length || filtre === 'acceptes'} onClick={() => void toutAccepter()}>
              {t`Écarter tous les doublons affichés`}
            </button>
          </div>
          <div class="groupes">
            {visibles.slice(0, limite).map((g) => (
              <CarteGroupe key={g.cle} g={g} comparer={setComparees} />
            ))}
            {visibles.length > limite && (
              <button type="button" onClick={() => setLimite(limite + 30)}>
                {t`Afficher 30 groupes de plus (${nombre(visibles.length - limite)} restants)`}
              </button>
            )}
          </div>
        </>
      )}

      <BarreValidation
        resume={
          <>
            {pluriel(totalEcartes, 'doublon écarté', 'doublons écartés')}
            {totalProposes ? t` · ${nombre(totalProposes)} à relire` : ''}
          </>
        }
        alertes={totalProposes ? [t`${pluriel(totalProposes, 'doublon proposé', 'doublons proposés')} pas encore relus (ils restent dans l’archive)`] : []}
        revenir={() => revenirDe('doublons')}
        valider={() => validerEtape('doublons')}
      />
      {comparees && (
        <Comparateur
          titre={t`Comparer le groupe`}
          photos={[comparees.p.garde, ...comparees.p.doublons.map((d) => d.id)].map(fichier).filter((f): f is FichierPlan => !!f)}
          fermer={() => setComparees(null)}
          entete={(f) =>
            f.id === gardeeActuelle(comparees.p, fichier) ? (
              <span class="badge gardee">{t`gardée`}</span>
            ) : etatDoublon(f) === 'accepte' ? (
              <span class="badge ecartee">{t`écartée`}</span>
            ) : etatDoublon(f) === 'garde' ? (
              <span class="badge gardee">{t`gardée aussi`}</span>
            ) : null
          }
          actions={(f) =>
            f.id !== gardeeActuelle(comparees.p, fichier) ? (
              <>
                {etatDoublon(f) === 'garde' ? (
                  <button type="button" onClick={() => appliquer(ecarterDuGroupe(plan, comparees.p, f.id))}>
                    {t`Écarter`}
                  </button>
                ) : (
                  <button type="button" onClick={() => appliquer(garderAussi(plan, [f.id]))}>
                    {t`Garder aussi`}
                  </button>
                )}
                <button type="button" onClick={() => appliquer(garderALaPlace(plan, comparees.p, f.id))}>
                  {t`Garder celle-ci à la place`}
                </button>
              </>
            ) : null
          }
        />
      )}
    </div>
  );
}
