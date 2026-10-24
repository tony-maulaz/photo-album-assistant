// Copies exactes (étape « Doublons », D61) : la même photo en plusieurs
// exemplaires (même contenu, ou copie réduite envoyée par WhatsApp), quel que
// soit le dossier. L'utilisateur choisit les exemplaires à garder ; la
// proposition garde le meilleur de chaque emplacement (un dossier qui garde sa
// place, ou les photos à trier), et met de côté les autres.

import { dossierMisDeCote } from '../../lib/sortie';
import { useMemo, useState } from 'preact/hooks';
import { groupesDoublonsExacts, type GroupeExact } from '../../lib/doublonsExacts';
import { t } from '../../lib/langue';
import { ecarterDoublonsExacts } from '../../lib/inventaire';
import { cheminDossier, gardeSaPlace, type FichierPlan } from '../../lib/plan';
import { analyseAFaire, analyseEnCours } from '../analyseDossier';
import { annuler, appliquer, notifier, session, versionIA, versionPlan } from '../etat';
import { pluriel } from '../format';
import { Miniature } from './GrillePhotos';

/** Emplacement des photos à trier (racine, dossiers « Trier ») : un seul, le tri les répartira. */
const A_TRIER = '§a_trier';

/**
 * Groupes de copies exactes parmi les photos encore dans l'archive, ou `null`
 * tant que l'analyse du dossier n'est pas finie (empreintes et ressemblance en viennent, D56).
 */
export function useCopiesExactes(): GroupeExact[] | null {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const pret = !analyseEnCours.value && !analyseAFaire(s);
  return useMemo<GroupeExact[] | null>(() => {
    if (!pret) return null;
    const photos = [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut === 'archive');
    return groupesDoublonsExacts(
      photos.map((f) => ({
        id: f.id,
        nom: f.nom,
        dossier: f.dossier,
        taille: f.taille,
        empreinte: f.empreinte,
        phash: s.analyses.get(f)?.phash,
        dims: f.dims,
        exif: f.origineDate === 'exif',
        // Dossier déjà trié : chaque dossier est un emplacement. En vrac : ceux qui gardent leur place, et « à trier ».
        emplacement: s.projet.mode === 'deja_trie' || gardeSaPlace(s.plan, f.dossier) ? f.dossier : A_TRIER,
      })),
    );
  }, [pret, versionPlan.value, versionIA.value]);
}

const membres = (g: GroupeExact) => [g.garde, ...g.copies.map((c) => c.id)];

/** Nombre d'exemplaires que la proposition met de côté. */
export function copiesProposees(groupes: GroupeExact[]): number {
  return groupes.reduce((n, g) => n + membres(g).length - g.aGarder.length, 0);
}

export function CopiesExactes() {
  const s = session.value!;
  const groupes = useCopiesExactes();
  // Choix de l'utilisateur, groupe par groupe (clé : le meilleur exemplaire) ; sinon la proposition.
  const [choix, setChoix] = useState<Record<string, string[]>>({});
  const gardes = (g: GroupeExact) => choix[g.garde] ?? g.aGarder;
  const chemin = (f: FichierPlan) => cheminDossier(s.plan, f.dossier) || t`racine`;

  if (!groupes) {
    return (
      <section id="copies">
        <h2>{t`Copies exactes`}</h2>
        <p class="discret">{t`Recherche en cours, pendant l’analyse des photos…`}</p>
      </section>
    );
  }
  if (!groupes.length) return null;

  const basculer = (g: GroupeExact, id: string) => {
    const k = new Set(gardes(g));
    if (k.has(id)) {
      if (k.size === 1) {
        notifier('info', t`Gardez au moins un exemplaire de chaque photo.`);
        return;
      }
      k.delete(id);
    } else k.add(id);
    setChoix({ ...choix, [g.garde]: [...k] });
  };
  const aEcarter = (g: GroupeExact) => membres(g).length - gardes(g).length;
  const aDecider = groupes.filter((g) => aEcarter(g) > 0);
  const voulues = groupes.filter((g) => aEcarter(g) === 0);
  const total = groupes.reduce((n, g) => n + aEcarter(g), 0);
  const ecarter = () => {
    appliquer(ecarterDoublonsExacts(s.plan, groupes, new Set(groupes.flatMap(gardes))));
    setChoix({});
    notifier('ok', t`${pluriel(total, 'copie écartée', 'copies écartées')}.`, { libelle: t`Annuler`, faire: annuler });
  };

  const carte = (g: GroupeExact) => {
    const k = new Set(gardes(g));
    return (
      <div key={g.garde} class="groupe-exact">
        {membres(g).map((id) => {
          const f = s.plan.fichiers.get(id);
          if (!f) return null;
          const type = g.copies.find((c) => c.id === id)?.type;
          return (
            <button key={id} type="button" class={`exemplaire ${k.has(id) ? 'garde' : 'ecarte'}`} aria-pressed={k.has(id)} onClick={() => basculer(g, id)} title={t`Cliquer pour garder ou écarter cet exemplaire`}>
              <Miniature f={f} taille={110} />
              <span class={`badge ${k.has(id) ? 'gardee' : 'ecartee'}`}>{k.has(id) ? t`gardée` : t`écartée`}</span>
              <span class="legende-exemplaire">
                {type === 'reduite' ? t`copie réduite` : null} {f.nom}
                <br />
                <span class="discret">{chemin(f)}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <section id="copies">
      <h2>{t`Copies exactes`}</h2>
      <p class="discret">
        {t`La même photo en plusieurs exemplaires (même contenu, ou copie réduite envoyée par WhatsApp), quel que soit le dossier. Cliquez sur un exemplaire pour le garder ou l’écarter ; les exemplaires écartés vont dans « ${dossierMisDeCote('doublons_exacts')} ».`}
      </p>
      {aDecider.length > 0 && (
        <>
          <p>
            <strong>{pluriel(total, 'copie à écarter', 'copies à écarter')}</strong> {t`dans ${pluriel(aDecider.length, 'groupe')}.`}{' '}
            <button type="button" class="principal" onClick={ecarter}>
              {t`Écarter ${pluriel(total, 'copie', 'copies')}`}
            </button>
          </p>
          <div class="groupes-exacts">
            {aDecider.slice(0, 40).map(carte)}
            {aDecider.length > 40 && <p class="discret">{t`… et ${aDecider.length - 40} autres groupes.`}</p>}
          </div>
        </>
      )}
      {voulues.length > 0 && (
        <details class="avances">
          <summary>
            {t`${pluriel(voulues.length, 'photo présente dans plusieurs dossiers', 'photos présentes dans plusieurs dossiers')} : toutes gardées (souvent voulu, par exemple un « Best of » fait de copies)`}
          </summary>
          <div class="groupes-exacts">{voulues.slice(0, 40).map(carte)}</div>
        </details>
      )}
    </section>
  );
}
