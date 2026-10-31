// Étape « Lieux et sorties » (SPEC § 6.4) : vérifier et corriger
// l'arborescence (celle du tri automatique, ou celle d'un dossier déjà trié)
// avant de créer la sortie.

import { nomsSortie } from '../../lib/sortie';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cheminDossier, contenu, resumes, RACINE, type DossierPlan, type FichierPlan } from '../../lib/plan';
import { premierDossierAvecPhotos } from '../../lib/rangement';
import { nomPourJournee } from '../../lib/nommage';
import { groupesParJour } from '../../lib/selection';
import { BarreValidation, RaisonDesactivee } from '../composants/Cadre';
import { AideEtape, LigneEtape } from '../composants/CadreCommun';
import { Icone } from '../composants/Icones';
import { GrillePhotos } from '../composants/GrillePhotos';
import { ActionsDossier, choisirDossierPour, commencerRenommage, ouvrirMenuDossierAffiche, PanneauDossiers, petitDossier, SEUIL_PETIT, styleLargeurPanneau, TitreVue } from '../composants/PanneauDossiers';
import { nombreSansGps } from '../composants/AidesTri';
import { LigneDeTemps } from '../composants/LigneDeTemps';
import { DialogueDeplacer, Visionneuse } from '../composants/Visionneuse';
import { evenementsDesPhotos, prisePendant, type EvenementCalendrier } from '../../lib/ics';
import { t } from '../../lib/langue';
import { allerEtape, annuler, evenements, retablir, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { ETAPE } from '../../navigateur/projet';
import { jourCourt, nombre, nomJour, periode, pluriel } from '../format';
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

/** Un événement et ses heures, pour une infobulle : « Souper chez Mamie, 22.03.25 19:00 – 22:00 ». */
function quand(e: EvenementCalendrier): string {
  const fin = e.fin.slice(0, 10) > e.debut.slice(0, 10) ? ` – ${jourCourt(e.fin)}` : '';
  const heures = e.journee ? '' : ` ${e.debut.slice(11, 16)} – ${e.fin.slice(11, 16)}`;
  return `${e.titre}${e.lieu ? ` (${e.lieu})` : ''}, ${jourCourt(e.debut)}${fin}${heures}`;
}

/**
 * Titre d'une journée dans la grille (D94) : la date, le nombre de photos et
 * les événements du calendrier pendant lesquels elles ont été prises, en texte
 * gris avec l'icône (D112 point 10 : plus de pastille verte) ; un clic
 * sélectionne toujours ces photos. Dans un dossier de plusieurs jours,
 * « Nouveau dossier avec cette journée » la sort, avec un nom proposé (titre de
 * l'événement, sinon lieu et date) : remplace « Scinder par jour ».
 */
function TitreJournee({ photos, jour, dossier }: { photos: FichierPlan[]; jour: string; dossier?: DossierPlan }) {
  const s = session.value!;
  const dates = photos.flatMap((f) => (f.date ? [f.date] : []));
  const evts = evenementsDesPhotos(evenements.value, dates);
  const autres = evts.slice(2);
  const sortir = () => {
    const parent = dossier!.parent === null ? null : s.plan.dossiers.get(dossier!.parent);
    const nom = nomPourJournee(dossier!.nom, parent && parent.parent !== null ? parent.nom : null, jour, dates, evenements.value);
    void nouveauDossierAvec(
      photos.map((f) => f.id),
      parentPourNouveau(),
      nom,
    );
  };
  return (
    <>
      <strong>{jour ? nomJour(jour, true) : t`Sans date`}</strong>
      <span class="discret">{pluriel(photos.length, 'photo')}</span>
      {evts.slice(0, 2).map(({ evenement, n }) => (
        <button
          key={evenement.titre}
          type="button"
          class="evenement-jour"
          title={t`${quand(evenement)} : ${pluriel(n, 'photo prise', 'photos prises')} pendant. Cliquer pour les sélectionner.`}
          onClick={() => {
            const ids = photos.filter((f) => f.date && prisePendant(evenement, f.date)).map((f) => f.id);
            selection.value = new Set(ids);
            ancre.value = ids[0] ?? null;
          }}
        >
          <Icone nom="calendrier" taille={14} />
          {evenement.titre}
        </button>
      ))}
      {autres.length > 0 && (
        <span class="discret" title={autres.map((x) => quand(x.evenement)).join('\n')}>
          +{autres.length}
        </span>
      )}
      <span class="espace" />
      {dossier && jour && (
        <button type="button" class="doux nouveau-jour" onClick={sortir} title={t`Ces ${pluriel(photos.length, 'photo')} dans un nouveau dossier, à côté de « ${dossier.nom} »`}>
          {t`Nouveau dossier avec cette journée`}
        </button>
      )}
    </>
  );
}

export function PageOrganiser() {
  const s = session.value!;
  const vp = versionPlan.value;
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
      } else if (e.key === 'F2' && session.value!.plan.dossiers.get(vue.value)?.parent) commencerRenommage(vue.value);
      // Maj+F10 ou la touche Menu : le menu « … » du dossier affiché (C-4.14).
      else if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') ouvrirMenuDossierAffiche();
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
  // Une journée par titre dans la grille (D94), avec les événements du calendrier ; une seule journée sans
  // événement n'en a pas besoin. Dans un dossier de plusieurs jours, chaque journée peut en sortir.
  const jours = enMisDeCote || enAutres ? [] : groupesParJour(elements);
  // Les événements des photos du dossier affiché et son état de petit dossier : calculés une fois par version du
  // plan, de la vue et du calendrier, pas à chaque clic de sélection (10 000 dates à la racine ; `petitsDe` parcourt
  // tout le plan).
  const evtsElements = useMemo(
    () => (enMisDeCote || enAutres ? [] : evenementsDesPhotos(evenements.value, elements.flatMap((f) => (f.date ? [f.date] : [])))),
    [vp, v, evenements.value],
  );
  const petitVue = useMemo(() => (dossier && !enMisDeCote && !enAutres ? petitDossier(dossier.id) : undefined), [vp, v, s.projet.mode, versionIA.value]);
  const avecTitres = jours.length > 1 || (jours.length === 1 && evtsElements.length > 0);
  const sortirJours = !sousDossiers && dossier?.parent != null && jours.filter((g) => g.jour).length > 1 ? dossier : undefined;
  const groupes = avecTitres
    ? jours.map((g) => ({ debut: g.debut, titre: <TitreJournee photos={elements.slice(g.debut, g.debut + g.n)} jour={g.jour} dossier={sortirJours} /> }))
    : undefined;

  // Événements des photos du dossier ouvert, écrits en entier dans sa tête ; petit dossier : une phrase dessous.
  const evtsVue = dossier ? evtsElements : [];

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
    // En vrac, l'étape suivante traite les petits dossiers : rien à signaler ici (D94).
    ...(petits.length && s.projet.mode !== 'vrac' ? [t`${pluriel(petits.length, 'petit dossier', 'petits dossiers')} (moins de ${SEUIL_PETIT} photos)`] : []),
    ...(vides.length ? [t`${pluriel(vides.length, 'dossier vide', 'dossiers vides')} (ne sera pas créé)`] : []),
    ...(sansGps && s.projet.mode === 'vrac' ? [t`${pluriel(sansGps, 'photo sans GPS', 'photos sans GPS')} (l’IA peut les situer : étape ${ETAPE.tri})`] : []),
  ];

  return (
    <div class="page-organiser" style={styleLargeurPanneau()}>
      {/* Forme E (D112) : la ligne de l'étape reste en haut (Taille, ↶ ↷, Aide, Menu) ; le panneau des dossiers se
          colle dessous, les photos suivent la page. */}
      <LigneEtape titre={t`Lieux et sorties`} aide={{ cle: 'lieux', ouverte: !arborescencePrete }} taille={!temps && !enAutres} />
      <AideEtape cle="lieux" ouverte={!arborescencePrete}>
        {t`Voici les dossiers prévus. Corrigez ce qui est mal rangé : cliquez sur des photos, puis glissez-les sur le bon dossier à gauche (ou « Déplacer… »). Rien n’est copié avant l’étape ${ETAPE.sortie}, et « Annuler » défait la dernière action.`}
        {s.projet.mode === 'vrac' && <> {t`Les petits dossiers, les noms et les regroupements viennent aux étapes suivantes : inutile de tout régler ici.`}</>}
      </AideEtape>
      {!arborescencePrete && (
        <p class="encart attention tete-lieux">
          {t`L’arborescence n’est pas encore calculée : les photos sont encore en vrac.`}{' '}
          <button type="button" class="principal" onClick={() => allerEtape('tri')}>
            {t`Aller au tri automatique`}
          </button>
        </p>
      )}
      <PanneauDossiers />
      <section class="contenu-organiser">
        <div class="tete-vue">
          <TitreVue
            titre={titreVue}
            id={dossier && dossier.parent !== null ? dossier.id : undefined}
            actions={!enMisDeCote && !enAutres && dossier && dossier.parent !== null ? <ActionsDossier /> : undefined}
            sousTitre={
              resumeVue && (
                <>
                  {sousDossiers ? (
                    <>
                      {periode(resumeVue.duTotal, resumeVue.auTotal)} · {pluriel(resumeVue.photosTotal, 'photo')}
                      {resumeVue.videosTotal ? ` · ${pluriel(resumeVue.videosTotal, 'vidéo')}` : ''} {t`dans ses sous-dossiers`}
                    </>
                  ) : (
                    <>
                      {periode(resumeVue.du, resumeVue.au)} · {pluriel(resumeVue.photos, 'photo')}
                      {resumeVue.videos ? ` · ${pluriel(resumeVue.videos, 'vidéo')}` : ''}
                    </>
                  )}
                  {/* L'événement du calendrier, en entier dans la tête du dossier ouvert (D112 point 10). */}
                  {evtsVue.length > 0 && (
                    <span class="evenements-vue" title={evtsVue.map((x) => x.evenement.titre).join('\n')}>
                      {' · '}
                      <Icone nom="calendrier" taille={14} />
                      {evtsVue.map((x) => x.evenement.titre).join(' · ')}
                    </span>
                  )}
                </>
              )
            }
          />
          {/* « Photos · Chronologie » au bout de la tête (D112 point 10, C-4.9) : un choix segmenté. */}
          <div class="choix-segmente bascule-vue" role="radiogroup" aria-label={t`Vue`}>
            <button type="button" role="radio" aria-checked={!temps} onClick={() => setTemps(false)}>
              {t`Photos`}
            </button>
            <button type="button" role="radio" aria-checked={temps} onClick={() => setTemps(true)} title={t`Les dossiers sur une ligne de temps, avec le calendrier`}>
              {t`Chronologie`}
            </button>
          </div>
        </div>
        {petitVue !== undefined && !temps && (
          <p class="note-petit">
            <Icone nom="dossier" taille={16} />
            <span>
              <strong>{t`Petit dossier.`}</strong>{' '}
              {s.projet.mode === 'vrac'
                ? t`Il sera traité à l’étape suivante, « Petits dossiers » : rien à faire ici.`
                : t`Moins de ${SEUIL_PETIT} photos : vous pouvez le réunir avec un autre dossier.`}
            </span>
            <button type="button" class="lien" onClick={() => choisirDossierPour(dossier!.id, 'reunir')}>
              {t`Le réunir maintenant…`}
            </button>
          </p>
        )}
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
                {t`Écarter`}
              </button>
            )}
            <button type="button" disabled={!ancre.value} aria-describedby={ancre.value ? undefined : 'raison-periode'} onClick={() => memePeriode(10)} title={t`Sélectionner toute la journée de la dernière photo cliquée`}>
              {t`Toute la journée`}
            </button>
            <button type="button" disabled={!ancre.value} aria-describedby={ancre.value ? undefined : 'raison-periode'} onClick={() => memePeriode(13)} title={t`Sélectionner toute l’heure de la dernière photo cliquée`}>
              {t`Toute l’heure`}
            </button>
            <RaisonDesactivee id="raison-periode" raison={!ancre.value && t`Cliquez d’abord une photo.`} />
            {recentsValides()
              .slice(0, 2)
              .map((id, i) => (
                <button key={id} type="button" class="puce" onClick={() => deplacerVers(id)} title={t`Vers « ${plan.dossiers.get(id)!.nom} » (touche ${i + 1})`}>
                  <span class="touche">{i + 1}</span> {plan.dossiers.get(id)!.parent === null ? 'Photos' : plan.dossiers.get(id)!.nom}
                </button>
              ))}
            <button type="button" class="fermer-action" onClick={() => (selection.value = new Set())} title={t`Échap`}>
              <Icone nom="croix" taille={16} />
              {t`Tout désélectionner`}
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
                groupes,
              }}
            />
          </>
        ) : (
          <GrillePhotos elements={elements} options={{ groupes }} />
        )}
      </section>
      <BarreValidation
        resume={
          <>
            {pluriel(dossiers.length, 'dossier')} · {pluriel(racine.photosTotal, 'photo')} · {pluriel(racine.videosTotal, 'vidéo')}
            {misDeCote ? t` · ${nombre(misDeCote)} écartés` : ''}
          </>
        }
        ecarte
        fini={arborescencePrete}
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
