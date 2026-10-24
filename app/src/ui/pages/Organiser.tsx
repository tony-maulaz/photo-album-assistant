// Étape « Lieux et sorties » (SPEC § 6.4) : vérifier et corriger
// l'arborescence (celle du tri automatique, ou celle d'un dossier déjà trié)
// avant de créer la sortie.

import { nomsSortie } from '../../lib/sortie';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cheminDossier, contenu, resumes, RACINE } from '../../lib/plan';
import { premierDossierAvecPhotos } from '../../lib/rangement';
import { regrouperDossiers, regroupementsProposes, type RegroupementPropose } from '../../lib/regroupements';
import { normaliserNom } from '../../lib/nommage';
import { BarreValidation } from '../composants/Cadre';
import { BoutonAide, EnteteEtape } from '../composants/EnteteEtape';
import { Icone } from '../composants/Icones';
import { GrillePhotos } from '../composants/GrillePhotos';
import { ActionsDossier, PanneauDossiers, SEUIL_PETIT, styleLargeurPanneau, TitreVue } from '../composants/PanneauDossiers';
import { nombreSansGps } from '../composants/AidesTri';
import { LigneDeTemps } from '../composants/LigneDeTemps';
import { DialogueDeplacer, Visionneuse } from '../composants/Visionneuse';
import { evenementsAutour } from '../../lib/ics';
import { t } from '../../lib/langue';
import { allerEtape, annuler, appliquer, changerReglages, evenements, notifier, reglages, retablir, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { ETAPE } from '../../navigateur/projet';
import { nombre, periode, pluriel } from '../format';
import {
  ancre,
  choisirVue,
  deplacerOuvert,
  deplacerVers,
  elementsVue,
  mettreSelectionDeCote,
  nouveauDossierAvec,
  ouvrirDossier,
  parentPourNouveau,
  recentsValides,
  remettreSelection,
  renommage,
  selection,
  sousDossiersSeulement,
  visionneuse,
  vue,
  VUE_AUTRES,
  VUE_MIS_DE_COTE,
} from '../organiser';

function estChampDeSaisie(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/**
 * Dossiers photographiés pendant un même événement du calendrier (D83) : une
 * proposition par événement, à accepter (« Les ranger dans … ») ou à ignorer.
 */
function RegroupementsCalendrier() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const ignores = s.aides.get<string[]>('regroupements_ignores') ?? [];
  const propositions = useMemo(() => regroupementsProposes(s.plan, evenements.value, new Set(ignores)), [versionPlan.value, versionIA.value, evenements.value]);
  if (!propositions.length) return null;
  const nomDe = (id: string) => s.plan.dossiers.get(id)?.nom ?? '';
  const reunir = (r: RegroupementPropose) => {
    const m = regrouperDossiers(s.plan, r);
    if (!m) return;
    appliquer(m);
    notifier('ok', m.libelle, { libelle: t`Annuler`, faire: annuler });
  };
  const ignorer = (r: RegroupementPropose) => void s.aides.set('regroupements_ignores', [...ignores, r.cle]).then(() => versionIA.value++);
  return (
    <details class="regroupements-calendrier">
      <summary>{t`Calendrier : ${pluriel(propositions.length, 'regroupement proposé', 'regroupements proposés')}`}</summary>
      <ul>
        {propositions.map((r) => (
          <li key={r.cle}>
            <p>
              <strong>« {r.titre} »</strong> {t`: ${pluriel(r.dossiers.length, 'dossier pris', 'dossiers pris')} pendant cet événement.`}{' '}
              <span class="discret">{r.dossiers.map(nomDe).join(' · ')}</span>
            </p>
            <p class="actions">
              <button type="button" class="principal" onClick={() => reunir(r)}>
                {r.sousDossiers ? t`Les ranger dans « ${normaliserNom(r.nom)} »` : t`Les réunir dans « ${normaliserNom(r.nom)} »`}
              </button>
              {r.sousDossiers && (
                <button type="button" class="lien" onClick={() => reunir({ ...r, sousDossiers: false })} title={t`Toutes les photos dans un seul dossier, sans sous-dossiers`}>
                  {t`ou les fusionner en un seul dossier`}
                </button>
              )}
              <span class="espace" />
              <button type="button" class="lien" onClick={() => ignorer(r)}>
                {t`Ignorer`}
              </button>
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function PageOrganiser() {
  const s = session.value!;
  versionPlan.value;
  const [temps, setTemps] = useState(false);
  const plan = s.plan;
  // La vue courante peut avoir disparu (fusion, annulation).
  if (vue.value !== VUE_MIS_DE_COTE && vue.value !== VUE_AUTRES && !plan.dossiers.has(vue.value)) choisirVue(RACINE);
  // À l'arrivée, la racine vide après le tri laisserait une grille vide : on ouvre le premier dossier qui a des photos.
  const arrivee = useRef(true);
  if (arrivee.current) {
    arrivee.current = false;
    if (vue.value === RACINE && contenu(plan, RACINE).length === 0) {
      const premier = premierDossierAvecPhotos(plan);
      if (premier) ouvrirDossier(premier);
    }
  }
  const v = vue.value;
  const elements = elementsVue(plan, v);
  const sousDossiers = sousDossiersSeulement(plan, v);
  const debutChemin = v === RACINE ? 0 : cheminDossier(plan, v).length + 1;
  const choisis = selection.value;
  const r = resumes(plan);
  const enMisDeCote = v === VUE_MIS_DE_COTE;
  const enAutres = v === VUE_AUTRES;

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      // Déjà traitée (Ctrl+Z global de l'application, dialogue…) : ne pas annuler deux fois.
      if (e.defaultPrevented || estChampDeSaisie(e) || deplacerOuvert.value) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const ids = [...selection.value];
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) annuler();
      else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) retablir();
      else if (ctrl && e.key.toLowerCase() === 'a') selection.value = new Set(elementsVue(session.value!.plan, vue.value).map((f) => f.id));
      else if (!ctrl && e.key.toLowerCase() === 'm' && ids.length) deplacerOuvert.value = true;
      else if (!ctrl && /^[1-9]$/.test(e.key) && ids.length && recentsValides()[Number(e.key) - 1]) deplacerVers(recentsValides()[Number(e.key) - 1]);
      else if ((e.key === 'Delete' || e.key === 'Backspace') && ids.length) {
        if (vue.value === VUE_MIS_DE_COTE) remettreSelection();
        else mettreSelectionDeCote();
      } else if (e.key === 'F2' && session.value!.plan.dossiers.get(vue.value)?.parent) renommage.value = vue.value;
      else if (e.key === 'Enter' && ids.length === 1) visionneuse.value = elementsVue(session.value!.plan, vue.value).findIndex((f) => f.id === ids[0]);
      else if (e.key === 'Escape') selection.value = new Set();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);

  // « Toute la journée » et « toute l'heure » de la dernière photo cliquée.
  const memePeriode = (longueur: number) => {
    const ref = elements.find((f) => f.id === ancre.value) ?? elements.find((f) => choisis.has(f.id));
    if (!ref?.date) return;
    const cle = ref.date.slice(0, longueur);
    selection.value = new Set(elements.filter((f) => f.date?.startsWith(cle)).map((f) => f.id));
  };

  const dossier = plan.dossiers.get(v);
  const resumeVue = dossier ? r.get(dossier.id)! : undefined;
  const titreVue = enMisDeCote ? t`Mis de côté` : enAutres ? t`Autres fichiers` : dossier?.parent === null ? t`Photos (racine)` : (dossier?.nom ?? '');
  // L'en-tête se replie une fois l'arborescence en place : la place va au panneau et aux photos.
  const arborescencePrete = s.projet.mode !== 'vrac' || [...plan.dossiers.values()].some((d) => d.origine === 'tri');
  const sansGps = nombreSansGps(s);

  const dossiers = [...plan.dossiers.values()].filter((d) => d.parent !== null);
  const petits = dossiers.filter((d) => {
    const x = r.get(d.id)!;
    return x.photos + x.videos > 0 && x.photos + x.videos < SEUIL_PETIT;
  });
  const vides = dossiers.filter((d) => r.get(d.id)!.photosTotal + r.get(d.id)!.videosTotal === 0);
  const racine = r.get(RACINE)!;
  const misDeCote = elementsVue(plan, VUE_MIS_DE_COTE).length;
  const alertes = [
    ...(petits.length ? [t`${pluriel(petits.length, 'petit dossier', 'petits dossiers')} (moins de ${SEUIL_PETIT} photos)`] : []),
    ...(vides.length ? [t`${pluriel(vides.length, 'dossier vide', 'dossiers vides')} (ne sera pas créé)`] : []),
    ...(sansGps && s.projet.mode === 'vrac' ? [t`${pluriel(sansGps, 'photo sans GPS', 'photos sans GPS')} (l’IA peut les situer : étape ${ETAPE.tri})`] : []),
  ];

  return (
    <div class="page-organiser" style={styleLargeurPanneau()}>
      <EnteteEtape
        cle="lieux"
        numero={ETAPE.lieux}
        titre={t`Lieux et sorties`}
        ouverte={!arborescencePrete}
        explication={
          <>
            {t`Voici l’arborescence prévue : réorganisez-la en sélectionnant des photos et en les glissant sur un dossier du panneau (ou touche M, ou 1 à 9 pour les derniers dossiers utilisés). Rien n’est copié avant l’étape ${ETAPE.sortie}, et Ctrl+Z annule.`}
          </>
        }
      >
        {!arborescencePrete && (
          <p class="encart attention">
            {t`L’arborescence n’est pas encore calculée : les photos sont encore en vrac.`}{' '}
            <button type="button" class="principal" onClick={() => allerEtape('tri')}>
              {t`Aller au tri automatique`}
            </button>
          </p>
        )}
      </EnteteEtape>
      <PanneauDossiers />
      <section class="contenu-organiser">
        <div class="tete-vue">
          <div class="bascule-vue" role="tablist">
            <button type="button" class={temps ? '' : 'actif'} onClick={() => setTemps(false)}>
              {t`Photos`}
            </button>
            <button type="button" class={temps ? 'actif' : ''} onClick={() => setTemps(true)} title={t`Les dossiers sur une ligne de temps, avec le calendrier`}>
              {t`Ligne de temps`}
            </button>
          </div>
          <TitreVue titre={titreVue} id={dossier && dossier.parent !== null ? dossier.id : undefined} />
          {!enMisDeCote && !enAutres && <ActionsDossier />}
          {resumeVue && !sousDossiers && (
            <span class="discret resume-vue">
              {periode(resumeVue.du, resumeVue.au)} · {pluriel(resumeVue.photos, 'photo')}
              {resumeVue.videos ? ` · ${pluriel(resumeVue.videos, 'vidéo')}` : ''}
            </span>
          )}
          {resumeVue && sousDossiers && (
            <span class="discret resume-vue">
              {periode(resumeVue.duTotal, resumeVue.auTotal)} · {pluriel(resumeVue.photosTotal, 'photo')}
              {resumeVue.videosTotal ? ` · ${pluriel(resumeVue.videosTotal, 'vidéo')}` : ''} {t`dans ses sous-dossiers`}
            </span>
          )}
          {dossier && dossier.parent !== null && resumeVue?.du && resumeVue.au && (
            <span class="evenements-vue" title={t`Événements du calendrier familial à ces dates (± 1 jour)`}>
              {evenementsAutour(evenements.value, resumeVue.du.slice(0, 10), resumeVue.au.slice(0, 10))
                .slice(0, 3)
                .map((e) => `📅 ${e.titre}`)
                .join(' · ')}
            </span>
          )}
          <span class="espace" />
          <div class="barre-outils">
            <button type="button" disabled={!s.historique.peutAnnuler} onClick={annuler} title={s.historique.prochaineAnnulation ? t`Annuler : ${s.historique.prochaineAnnulation} (Ctrl+Z)` : 'Ctrl+Z'}>
              {t`Annuler`}
            </button>
            <button type="button" class="bouton-icone" disabled={!s.historique.peutRetablir} onClick={retablir} title={t`Rétablir (Ctrl+Y)`} aria-label={t`Rétablir`}>
              <Icone nom="retablir" taille={17} />
            </button>
            {!temps && !enAutres && (
              <label class="curseur" title={t`Taille des miniatures`}>
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
            )}
          </div>
          <BoutonAide cle="lieux" ouverte={!arborescencePrete} libelle={t`Aide`} />
        </div>
        {arborescencePrete && <RegroupementsCalendrier />}
        {choisis.size > 0 && !enAutres && !temps && (
          <div class="barre-action" role="toolbar" aria-label={t`Photos sélectionnées`}>
            <span class="compte-selection">{pluriel(choisis.size, 'sélectionnée', 'sélectionnées')}</span>
            <button type="button" onClick={() => (deplacerOuvert.value = true)} title={t`Touche M`}>
              {t`Déplacer…`}
            </button>
            <button type="button" onClick={() => void nouveauDossierAvec([...choisis], parentPourNouveau())} title={t`Un nouveau dossier, à côté de celui-ci, avec ces photos`}>
              {t`Nouveau dossier`}
            </button>
            {enMisDeCote ? (
              <button type="button" onClick={() => remettreSelection()} title={t`Touche Suppr`}>
                {t`Remettre`}
              </button>
            ) : (
              <button type="button" onClick={() => mettreSelectionDeCote()} title={t`Touche Suppr : rien n’est supprimé`}>
                {t`Mettre de côté`}
              </button>
            )}
            <button type="button" disabled={!ancre.value} onClick={() => memePeriode(10)} title={t`Sélectionner toute la journée de la dernière photo cliquée`}>
              {t`Journée`}
            </button>
            <button type="button" disabled={!ancre.value} onClick={() => memePeriode(13)} title={t`Sélectionner toute l’heure de la dernière photo cliquée`}>
              {t`Heure`}
            </button>
            {recentsValides()
              .slice(0, 2)
              .map((id, i) => (
                <button key={id} type="button" class="puce" onClick={() => deplacerVers(id)} title={t`Vers « ${plan.dossiers.get(id)!.nom} » (touche ${i + 1})`}>
                  <span class="touche">{i + 1}</span> {plan.dossiers.get(id)!.parent === null ? 'Photos' : plan.dossiers.get(id)!.nom}
                </button>
              ))}
            <button type="button" class="fermer-action" onClick={() => (selection.value = new Set())} title={t`Tout désélectionner (Échap)`} aria-label={t`Tout désélectionner`}>
              <Icone nom="croix" taille={16} />
            </button>
          </div>
        )}
        {temps ? (
          <LigneDeTemps ouvrir={() => setTemps(false)} />
        ) : enAutres ? (
          <div class="liste-autres">
            <p class="discret">{t`Ces fichiers ne sont ni des photos ni des vidéos. Ils seront copiés dans « ${nomsSortie().autres} », avec leur chemin d’origine.`}</p>
            <ul>
              {elements.map((f) => (
                <li key={f.id}>{f.id}</li>
              ))}
            </ul>
          </div>
        ) : sousDossiers ? (
          <>
            <p class="encart-sous-dossiers">
              {t`« ${titreVue} » ne contient que des sous-dossiers : voici leurs photos, avec le nom du sous-dossier sous chacune. Cliquez sur un sous-dossier à gauche pour ne voir que le sien.`}
            </p>
            <GrillePhotos
              elements={elements}
              options={{
                // Le chemin depuis le dossier affiché : « 05.01.25 », « Voyage/Plage ».
                legende: (f) => cheminDossier(plan, f.dossier).slice(debutChemin),
              }}
            />
          </>
        ) : (
          <GrillePhotos elements={elements} />
        )}
      </section>
      <BarreValidation
        resume={
          <>
            {pluriel(dossiers.length, 'dossier')} · {pluriel(racine.photosTotal, 'photo')} · {pluriel(racine.videosTotal, 'vidéo')}
            {misDeCote ? t` · ${nombre(misDeCote)} mis de côté` : ''}
          </>
        }
        alertes={alertes}
        revenir={() => revenirDe('lieux')}
        // Dossier en vrac : petits dossiers, nommage, consolidation ; dossier déjà trié : la sélection directement.
        valider={() => validerEtape('lieux')}
      />
      {deplacerOuvert.value && <DialogueDeplacer />}
      {visionneuse.value !== null && <Visionneuse elements={elements} />}
    </div>
  );
}
