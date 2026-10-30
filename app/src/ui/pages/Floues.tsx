// Étape 3 — Photos floues (SPEC § 6.3), dans le cadre commun (D112) : la ligne de l'étape porte le titre et les
// filtres (Toutes, À écarter, « ? », Par vous) ; la grille, de la moins nette à la plus nette, en parties titrées
// (« Trop floues », « Assez nettes », « Netteté pas mesurée ») ; sous chaque photo, son badge d'origine (le mot dit
// ce qui lui arrive, l'icône d'où vient l'idée ; plein : décidé, bordure : proposé) ; à droite, « Ce que l'on
// écarte » : le réglage du flou, le compte en direct, l'avis de l'IA, les outils de la photo choisie et la légende.
// Rien n'est écarté avant « Valider » : le seuil s'applique alors au plan.

import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  aJugerParIA,
  appliquerFloues,
  avisValide,
  basculerFlou,
  decisionFlou,
  deciderFlou,
  etatFlou,
  photosConcernees,
  raisonAvis,
  resumeFloues,
  SEUIL_FLOU,
  suivreAvisFlou,
  type AvisFlou,
  type EtatFlou,
} from '../../lib/floues';
import { t } from '../../lib/langue';
import type { FichierPlan } from '../../lib/plan';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { lancerAnalyseDossier } from '../analyseDossier';
import { EncartAnalyse } from '../composants/Analyse';
import type { DescriptionBadge } from '../composants/Badge';
import { BarreValidation, garderFocus, RaisonDesactivee } from '../composants/Cadre';
import { LigneEtape, OutilsCadre, PanneauAide, useCadre } from '../composants/CadreCommun';
import { GrillePhotos } from '../composants/GrillePhotos';
import { Icone, type NomIcone } from '../composants/Icones';
import { Visionneuse } from '../composants/Visionneuse';
import { verdictsIA1 } from '../composants/AidesTri';
import { annuler, appliquer, notifier, planifierEnregistrement, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { nombre, pluriel } from '../format';
import { selection, visionneuse } from '../organiser';
import { AideIA } from './AidesIA';

/** Curseur logarithmique : la netteté va de quelques unités à plusieurs milliers. */
const versCurseur = (seuil: number) => Math.round(Math.log(seuil) * 100);
const depuisCurseur = (v: number) => Math.round(Math.exp(v / 100));

/** Les filtres de la ligne : toutes, ce qui sera écarté, à vérifier, décidé par vous. */
type Filtre = 'toutes' | 'ecarter' | 'verifier' | 'vous';

function estChampDeSaisie(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/** Ce que dit l'IA d'une photo, en un mot (remarque sous la photo, bulle). */
function motAvis(a: AvisFlou): string {
  return a.verdict === 'ratee' ? t`ratée` : a.verdict === 'flou_voulu' ? t`flou voulu` : t`nette`;
}

/** La raison de l'IA, en ligne d'infobulle, si elle en a donné une (relue sans lui faire confiance, règle d'or 6). */
function lignesRaison(a: AvisFlou | undefined): string[] {
  const r = a && raisonAvis(a);
  return r ? [t`IA : ${r}`] : [];
}

/** Le mot d'un sort proposé, en minuscules (« revenir à la proposition : à écarter »). */
function motPropose(sort: 'garder' | 'ecarter'): string {
  return sort === 'garder' ? t`à garder` : t`à écarter`;
}

/**
 * Le badge d'une photo (D112) : son mot, son icône, sa bulle (l'état, la netteté et son repère, ce que fait le clic)
 * et le geste du clic.
 */
function badgeFlou(e: EtatFlou, n: number | undefined, seuil: number, avis: AvisFlou | undefined, basculer: () => void): DescriptionBadge {
  const garde = e.sort === 'garder';
  const decide = e.qui === 'vous' || e.qui === 'ia-suivi';
  const etat =
    e.qui === 'vous'
      ? garde
        ? t`Gardée par vous : elle reste gardée même si vous changez le réglage.`
        : t`Écartée par vous : elle reste écartée même si vous changez le réglage.`
      : e.qui === 'ia-suivi'
        ? garde
          ? t`Gardée : vous avez suivi l’avis de l’IA.`
          : t`Écartée : vous avez suivi l’avis de l’IA.`
        : e.qui === 'avant'
          ? t`Écartée avant : déjà écartée comme floue avant l’application ; elle reste écartée.`
          : e.qui === 'verifier'
            ? avis
              ? garde
                ? t`À garder, proposé par le réglage. À vérifier : l’IA la trouve ${motAvis(avis)}.`
                : t`À écarter, proposé par le réglage. À vérifier : l’IA la trouve ${motAvis(avis)}.`
              : garde
                ? t`À garder, proposé par le réglage. À vérifier : elle est proche du réglage.`
                : t`À écarter, proposé par le réglage. À vérifier : elle est proche du réglage.`
            : e.qui === 'ia'
              ? garde
                ? t`À garder, proposé par le réglage ; l’IA est d’accord.`
                : t`À écarter, proposé par le réglage ; l’IA est d’accord.`
              : garde
                ? t`À garder, proposé par le réglage.`
                : t`À écarter, proposé par le réglage.`;
  const mesure = n !== undefined ? t`Netteté mesurée : ${nombre(n)} · le réglage écarte sous ${nombre(seuil)}` : t`Netteté pas mesurée : elle est gardée.`;
  const effet = decide ? t`Clic ou Suppr : revenir à la proposition (${motPropose(e.proposition)}).` : garde ? t`Clic ou X : l’écarter.` : t`Clic ou G : la garder.`;
  const lu = decide ? t`Activer pour revenir à la proposition : ${motPropose(e.proposition)}.` : garde ? t`Activer pour l’écarter.` : t`Activer pour la garder.`;
  const mots: Pick<DescriptionBadge, 'mot' | 'motCourt'> =
    e.qui === 'vous'
      ? garde
        ? { mot: t`Gardée par vous`, motCourt: t`Gardée` }
        : { mot: t`Écartée par vous`, motCourt: t`Écartée` }
      : e.qui === 'ia-suivi'
        ? { mot: garde ? t`Gardée` : t`Écartée` }
        : e.qui === 'avant'
          ? { mot: t`Écartée avant` }
          : { mot: garde ? t`À garder` : t`À écarter` };
  return {
    sort: e.sort,
    origine: e.qui === 'vous' ? 'vous' : e.qui === 'ia-suivi' || e.qui === 'ia' ? 'ia' : e.qui === 'avant' ? 'avant' : e.qui === 'verifier' ? 'verifier' : 'application',
    decide: decide || e.qui === 'avant',
    ...mots,
    effet: decide ? { icone: 'revenir', mot: t`Revenir à la proposition`, motCourt: t`Revenir` } : { icone: 'echanger', mot: garde ? t`Écarter` : t`Garder` },
    bulle: [etat, mesure, ...lignesRaison(avis), effet].join('\n'),
    nom: `${etat} ${lu}`,
    basculer,
  };
}

/** Un outil de la photo choisie, avec sa touche ; désactivé, sa raison est écrite dessous (C-4.7). */
function OutilFloue({
  icone,
  libelle,
  touche,
  raison,
  id,
  titre,
  action,
  onClick,
}: {
  icone: NomIcone;
  libelle: string;
  touche: string;
  raison?: string | false;
  id: string;
  titre: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class="outil-photo"
      data-action={action}
      disabled={!!raison}
      aria-describedby={raison ? id : undefined}
      onMouseDown={garderFocus}
      onClick={onClick}
      title={titre}
    >
      <Icone nom={icone} taille={16} />
      <span class="texte-outil">
        {libelle}
        <RaisonDesactivee id={id} raison={raison} />
      </span>
      <kbd>{touche}</kbd>
    </button>
  );
}

/** Les filtres (« Afficher ») : dans la ligne de l'étape, ou dans la barre d'outils au palier. */
function FiltresFloues({ voir, choisir, comptes }: { voir: Filtre; choisir: (f: Filtre) => void; comptes: Record<Filtre, number> }) {
  const bouton = (cle: Filtre, contenu: preact.ComponentChildren, nom: string, titre: string) => (
    <button
      key={cle}
      type="button"
      class={`filtre-floues filtre-${cle}`}
      data-filtre={cle}
      aria-pressed={voir === cle}
      aria-label={t`${nom} : ${nombre(comptes[cle])}`}
      title={titre}
      onClick={() => choisir(cle)}
    >
      {contenu}
      <span class="compte-filtre">{nombre(comptes[cle])}</span>
    </button>
  );
  return (
    <div class="filtres-floues" role="group" aria-label={t`Afficher`}>
      {bouton('toutes', t`Toutes`, t`Toutes`, t`Toutes les photos, de la moins nette à la plus nette`)}
      {bouton('ecarter', t`À écarter`, t`À écarter`, t`Celles qui seront écartées à « Valider et continuer »`)}
      {bouton('verifier', <Icone nom="question" taille={16} />, t`À vérifier`, t`À vérifier : proches du réglage, ou l’IA n’est pas d’accord`)}
      {bouton(
        'vous',
        <>
          <Icone nom="punaise" taille={16} />
          {t`Par vous`}
        </>,
        t`Par vous`,
        t`Celles que vous avez gardées ou écartées vous-même`,
      )}
    </div>
  );
}

/** La petite légende des badges, dans le panneau (elle remplace la phrase de consigne retirée de l'en-tête). */
function LegendeBadges() {
  return (
    <div class="legende-badges" role="group" aria-label={t`Légende des badges`}>
      <p class="ligne-legende">
        <span class="echantillon propose" aria-hidden="true" />
        {t`proposé`}
        <span class="echantillon decide" aria-hidden="true" />
        {t`décidé`}
      </p>
      <p class="ligne-legende">
        <Icone nom="punaise" taille={16} />
        {t`vous`}
        <Icone nom="etincelle" taille={16} />
        {t`l’IA`}
        <span class="a-verifier">
          <Icone nom="question" taille={16} />
          {t`à vérifier`}
        </span>
      </p>
      <p>{t`Clic sur la bande : l’autre sort, décidé par vous. Un second clic revient à la proposition.`}</p>
    </div>
  );
}

export function PageFloues() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const [seuil, setSeuil] = useState(s.projet.seuil_flou ?? SEUIL_FLOU);
  // La position du curseur est gardée dans le projet dès qu'elle change : un rechargement ne la perd pas
  // (le seuil ne s'applique au plan qu'à « Valider »).
  const changerSeuil = (v: number) => {
    setSeuil(v);
    s.projet.seuil_flou = v;
    planifierEnregistrement();
  };
  const [voir, setVoir] = useState<Filtre>('toutes');
  const nettete = (f: FichierPlan) => s.analyses.get(f)?.nettete;
  const concernees = useMemo(() => photosConcernees(s.plan), [versionPlan.value]);
  const triees = useMemo(() => [...concernees].sort((a, b) => (nettete(a) ?? Infinity) - (nettete(b) ?? Infinity) || a.id.localeCompare(b.id)), [concernees, versionIA.value]);
  const verdicts = verdictsIA1(s);
  const avisDe = (f: FichierPlan): AvisFlou | undefined => (avisValide(verdicts[f.id]) ? verdicts[f.id] : undefined);
  // L'état de chaque photo (badge, comptes) : recalculé quand le plan, les mesures, les avis ou le réglage changent.
  const etats = useMemo(() => {
    const limites = new Set(aJugerParIA(concernees, nettete, seuil, verdicts).map((f) => f.id));
    return new Map(concernees.map((f) => [f.id, etatFlou(f, nettete(f), seuil, avisDe(f), limites.has(f.id))]));
  }, [concernees, versionIA.value, seuil]);
  const resume = resumeFloues(concernees, etats, nettete);
  const garde = (f: FichierPlan): boolean => {
    const e = etats.get(f.id);
    if (!e) return false;
    return voir === 'ecarter' ? e.sort === 'ecarter' : voir === 'verifier' ? e.qui === 'verifier' : voir === 'vous' ? e.qui === 'vous' : true;
  };
  const elements = triees.filter(garde);
  // Les avis de l'IA pas encore tranchés : « Suivre l'avis de l'IA » et la remarque sous la photo.
  const aSuivre = concernees.filter((f) => avisDe(f) && !decisionFlou(f));
  const choisies = [...selection.value].map((id) => s.plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f && etats.has(f.id));
  const { aide, etroit, palier } = useCadre('floues');

  // Les parties titrées (C-9.8 proposée) : trop floues pour ce réglage, assez nettes, puis sans mesure ; les vides ne
  // sont pas dessinées. Une photo décidée reste à sa place de netteté.
  const groupes = useMemo(() => {
    const partie = (f: FichierPlan) => {
      const n = nettete(f);
      return n === undefined ? 2 : n < seuil ? 0 : 1;
    };
    const debuts: { debut: number; titre: preact.ComponentChildren }[] = [];
    for (let i = 0; i < elements.length; i++) {
      const p = partie(elements[i]);
      if (i > 0 && partie(elements[i - 1]) === p) continue;
      const dans = elements.filter((f) => partie(f) === p);
      const total = dans.length;
      const parVous = dans.filter((f) => etats.get(f.id)?.qui === 'vous');
      const nom = p === 0 ? t`Trop floues` : p === 1 ? t`Assez nettes` : t`Netteté pas mesurée`;
      const detail =
        voir === 'ecarter'
          ? pluriel(total, 'photo sera écartée', 'photos seront écartées')
          : p === 0 && parVous.some((f) => etats.get(f.id)!.sort === 'garder')
            ? t`${pluriel(total, 'photo')}, dont ${pluriel(parVous.filter((f) => etats.get(f.id)!.sort === 'garder').length, 'gardée')} par vous`
            : p === 1 && parVous.some((f) => etats.get(f.id)!.sort === 'ecarter')
              ? t`${pluriel(total, 'photo')}, dont ${pluriel(parVous.filter((f) => etats.get(f.id)!.sort === 'ecarter').length, 'écartée')} par vous`
              : pluriel(total, 'photo');
      debuts.push({
        debut: i,
        titre: (
          <>
            <strong>{nom}</strong>
            <span class="discret">{detail}</span>
          </>
        ),
      });
    }
    return debuts;
  }, [elements.map((f) => f.id).join('|'), etats, voir]);

  /** Le message qui suit un geste : ce qui est arrivé, en gras ; « ↶ ou Ctrl+Z pour l'annuler » suit (MessageLigne). */
  const dire = (texte: string) => notifier('ok', texte, { libelle: t`Annuler`, faire: annuler });
  const decider = (ids: string[], decision: 'sauvee' | 'ecartee' | undefined) => {
    const m = deciderFlou(session.value!.plan, ids, decision);
    if (!m) return;
    appliquer(m);
    const n = ids.length;
    dire(
      decision === 'sauvee'
        ? n > 1
          ? t`${pluriel(n, 'photo gardée', 'photos gardées')} par vous.`
          : t`Gardée par vous.`
        : decision === 'ecartee'
          ? n > 1
            ? t`${pluriel(n, 'photo écartée', 'photos écartées')} par vous.`
            : t`Écartée par vous.`
          : n > 1
            ? t`${nombre(n)} photos revenues à la proposition.`
            : t`Revenue à la proposition.`,
    );
  };
  const basculer = (f: FichierPlan) => {
    const avant = decisionFlou(f);
    const m = basculerFlou(session.value!.plan, f.id, nettete(f), seuil);
    if (!m) return;
    appliquer(m);
    const apres = decisionFlou(session.value!.plan.fichiers.get(f.id) ?? f);
    dire(apres === 'garder' ? t`Gardée par vous.` : apres === 'ecarter' ? t`Écartée par vous.` : avant ? t`Revenue à la proposition.` : '');
  };

  useEffect(() => {
    selection.value = new Set();
    const touche = (e: KeyboardEvent) => {
      // Ctrl+Z et Ctrl+Y passent par le gestionnaire commun (annulerIci) ; une fenêtre ou un menu ouvert garde ses touches.
      if (e.defaultPrevented || estChampDeSaisie(e) || visionneuse.value !== null || document.querySelector('.menu-deroulant, [role="dialog"]')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const ids = [...selection.value];
      const k = e.key.toLowerCase();
      // Espace et Entrée sur un bouton : c'est ce bouton qui agit.
      if ((e.key === ' ' || e.key === 'Enter') && (e.target as HTMLElement | null)?.closest?.('button, a, summary')) return;
      if (ctrl && k === 'a') selection.value = new Set(courantRef.elements.map((f) => f.id));
      else if (ctrl || e.altKey) return;
      else if ((k === 'g' || k === 's') && ids.length) decider(ids, 'sauvee');
      else if (k === 'x' && ids.length) decider(ids, 'ecartee');
      // Retour arrière comme Suppr, comme à la Sélection (la touche « delete » d'un clavier Mac).
      else if ((e.key === 'Delete' || e.key === 'Backspace') && ids.length) decider(ids, undefined);
      else if (e.key === 'Enter' && ids.length) ouvrirEnGrand(ids[0]);
      else if (e.key === 'Escape' && ids.length) selection.value = new Set();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);
  // Le gestionnaire de touches est créé une fois : il relit les photos affichées ici.
  courantRef.elements = elements;

  const ouvrirEnGrand = (id: string) => {
    const i = courantRef.elements.findIndex((f) => f.id === id);
    if (i >= 0) visionneuse.value = i;
  };

  const valider = () => {
    appliquer(appliquerFloues(s.plan, nettete, seuil));
    s.projet.seuil_flou = seuil;
    planifierEnregistrement();
    if (resume.seront)
      notifier('ok', t`${pluriel(resume.seront, 'photo écartée', 'photos écartées')} : dans « Mis de côté », rien n’est supprimé.`, { libelle: t`Annuler`, faire: annuler });
    validerEtape('floues');
    // Les photos écartées quittent leurs journées : les rafales y sont cherchées de nouveau, en arrière-plan.
    void lancerAnalyseDossier();
  };

  const comptes: Record<Filtre, number> = { toutes: resume.total, ecarter: resume.seront, verifier: resume.aVerifier, vous: resume.faitesParVous };
  const filtres = <FiltresFloues voir={voir} choisir={setVoir} comptes={comptes} />;
  const seront = t`${pluriel(resume.seront, 'photo sera écartée', 'photos seront écartées')} sur ${nombre(resume.total)}`;
  // D'où vient le compte, dès qu'autre chose que le réglage y entre (vos décisions, l'IA, les anciens scripts).
  // Les parties à zéro ne s'écrivent pas (« vous : 2 écartées », pas « 0 gardée, 2 écartées »).
  const sorts = (q: { gardees: number; ecartees: number }) =>
    [q.gardees ? pluriel(q.gardees, 'gardée') : '', q.ecartees ? pluriel(q.ecartees, 'écartée') : ''].filter(Boolean).join(', ');
  const details = [
    t`Réglage : ${nombre(resume.parReglage)}`,
    sorts(resume.parVous) ? t`vous : ${sorts(resume.parVous)}` : '',
    sorts(resume.parIA) ? t`IA : ${sorts(resume.parIA)}` : '',
    resume.avant ? t`avant : ${nombre(resume.avant)}` : '',
  ].filter(Boolean);
  const unSeul = choisies.length === 1 ? choisies[0] : undefined;
  const etatUnSeul = unSeul && etats.get(unSeul.id);
  const sansDecision = choisies.length > 0 && !choisies.some((f) => decisionFlou(f)) && t`aucune décision à retirer`;

  // Écran étroit avec l'Aide ouverte : seulement les outils des photos choisies, au-dessus de l'Aide (comme la Sélection).
  const compact = etroit && aide;
  const panneau = (
    <aside class={`panneau-cadre panneau-floues${compact ? ' compact' : ''}`} aria-label={compact ? t`Photos choisies` : t`Ce que l’on écarte`}>
      {!compact && (
        <div class="tete-col">
          <h2>{t`Ce que l’on écarte`}</h2>
        </div>
      )}
      <div class="defile-col">
        {!compact && <EncartAnalyse photos={concernees} pourquoi={t`il faut mesurer la netteté de chaque photo.`} />}
        {!compact && (
          <div class="reglage-flou">
            <p class="titre-reglage">
              <span>{t`Réglage du flou`}</span>
              {/* Au réglage conseillé, un état écrit, pas un bouton désactivé qui changerait de sens (C-4.7). */}
              {seuil === SEUIL_FLOU ? (
                <span class="discret" title={t`Réglage calibré sur de vraies photos`}>
                  {t`Réglage conseillé`}
                </span>
              ) : (
                <button type="button" class="lien" data-action="reglage-conseille" onClick={() => changerSeuil(SEUIL_FLOU)} title={t`Réglage calibré sur de vraies photos`}>
                  {t`Revenir au réglage conseillé`}
                </button>
              )}
            </p>
            {/* Le seuil de netteté (un nombre sans signification pour l'utilisateur) devient « écarter moins ↔ écarter
              plus » ; curseur gris, comme tous les curseurs (C-3.2) ; la valeur du seuil en infobulle. */}
            <label class="curseur-flou" title={t`Seuil de netteté : ${nombre(seuil)} (conseillé : ${SEUIL_FLOU})`}>
              <input
                type="range"
                min={versCurseur(5)}
                max={versCurseur(1000)}
                value={versCurseur(seuil)}
                style={{ '--parcouru': `${((versCurseur(seuil) - versCurseur(5)) / (versCurseur(1000) - versCurseur(5))) * 100}%` }}
                data-action="tolerance"
                aria-label={t`Réglage du flou`}
                aria-valuetext={seront}
                onInput={(e) => changerSeuil(depuisCurseur(Number(e.currentTarget.value)))}
              />
              <span class="bornes-curseur">
                <span>{t`Écarter moins`}</span>
                <span>{t`Écarter plus`}</span>
              </span>
            </label>
            <p class="compte-reglage">
              <strong class="compteur-floues">{seront}</strong>
              {details.length > 1 && <span class="detail-compte">{details.join(' · ')}</span>}
            </p>
          </div>
        )}
        {!compact && (
          <div class="aides-floues">
            <AideIA fonction="IA1" nom={t`Demander l’avis de l’IA`} />
            {aSuivre.length > 0 && (
              <button
                type="button"
                class="bouton-ia"
                data-action="suivre-ia"
                onClick={() =>
                  appliquer(
                    suivreAvisFlou(
                      s.plan,
                      aSuivre.map((f) => f.id),
                      verdicts,
                    ),
                  )
                }
                title={t`Chaque photo prend le sort que lui donne l’IA ; elle ne bougera plus avec le réglage. Ctrl+Z l’annule.`}
              >
                <Icone nom="etincelle" taille={16} />
                {t`Suivre l’avis de l’IA pour ${pluriel(aSuivre.length, 'photo')}`}
              </button>
            )}
          </div>
        )}
        <section class="photos-choisies" aria-label={t`Photos choisies`}>
          <h3 class="titre-section-panneau">{choisies.length ? pluriel(choisies.length, 'photo choisie', 'photos choisies') : t`Photo choisie`}</h3>
          {unSeul && etatUnSeul && (
            <p class="detail-choisie">
              {nettete(unSeul) !== undefined
                ? t`Netteté mesurée : ${nombre(nettete(unSeul)!)} · le réglage écarte sous ${nombre(seuil)}`
                : t`Netteté pas mesurée : elle est gardée.`}
              {etatUnSeul.qui === 'vous' && (
                <span class="explication-choisie">
                  {etatUnSeul.sort === 'garder'
                    ? t`Vous l’avez gardée vous-même : elle reste gardée même si vous changez le réglage.`
                    : t`Vous l’avez écartée vous-même : elle reste écartée même si vous changez le réglage.`}
                </span>
              )}
              {etatUnSeul.qui === 'ia-suivi' && avisDe(unSeul) && <span class="explication-choisie">{t`Vous avez suivi l’avis de l’IA : ${motAvis(avisDe(unSeul)!)}.`}</span>}
              {etatUnSeul.qui === 'avant' && (
                <span class="explication-choisie">{t`Déjà écartée comme floue avant l’application : elle reste écartée, sauf si vous la gardez.`}</span>
              )}
            </p>
          )}
          {/* Sans photo choisie, une phrase plutôt que cinq commandes grisées ; les outils viennent avec le choix. */}
          {choisies.length === 0 ? (
            <p class="discret rappel-choix">{t`Cliquez une photo pour la garder, l’écarter ou retirer votre choix (G, X, Suppr). Ctrl+clic en ajoute une.`}</p>
          ) : (
            <div class="outils-choix" role="group" aria-label={t`Outils des photos choisies`}>
              <OutilFloue
                icone="coche"
                libelle={t`Garder`}
                touche={t`G ou S`}
                id="raison-garder"
                action="garder"
                titre={t`Elle reste, même si vous changez le réglage (touche G ou S)`}
                onClick={() => decider([...selection.value], 'sauvee')}
              />
              <OutilFloue
                icone="croix"
                libelle={t`Écarter`}
                touche="X"
                id="raison-ecarter"
                action="ecarter"
                titre={t`Nette mais ratée : elle part dans « Mis de côté » (touche X)`}
                onClick={() => decider([...selection.value], 'ecartee')}
              />
              <OutilFloue
                icone="revenir"
                libelle={t`Retirer mon choix`}
                touche={t`Suppr`}
                id="raison-retirer"
                raison={sansDecision}
                action="retirer-choix"
                titre={t`La photo revient à la proposition : le réglage, l’avis de l’IA ou « Écartée avant » (touche Suppr)`}
                onClick={() => decider([...selection.value], undefined)}
              />
              <OutilFloue
                icone="entier"
                libelle={t`Voir en grand`}
                touche={t`Entrée`}
                id="raison-grand"
                action="voir-en-grand"
                titre={t`La photo en grand (double-clic ou Entrée)`}
                onClick={() => ouvrirEnGrand([...selection.value][0])}
              />
              <OutilFloue
                icone="croix"
                libelle={t`Ne plus choisir`}
                touche={t`Échap`}
                id="raison-ne-plus"
                action="ne-plus-choisir"
                titre={t`Échap`}
                onClick={() => (selection.value = new Set())}
              />
            </div>
          )}
        </section>
        {!compact && <LegendeBadges />}
        {!compact && (
          <details class="mesure-flou">
            <summary>{t`Comment on mesure le flou`}</summary>
            <p>{t`Chaque photo reçoit une note de netteté, calculée sur cet ordinateur : plus les contours sont francs, plus la note est haute. Le réglage écarte les photos dont la note est sous un seuil, calibré sur de vraies photos. Une photo sombre ou un flou voulu peuvent tromper la mesure : vérifiez les photos marquées « ? », ou demandez l’avis de l’IA.`}</p>
          </details>
        )}
      </div>
    </aside>
  );
  const explication = (
    <>
      <p>{t`Les photos sont classées de la moins nette à la plus nette. Sous chaque photo, ce qui lui arrivera : vert, elle reste ; gris, elle part dans « Mis de côté ». Rien n’est supprimé.`}</p>
      <p>{t`Tirez le réglage du flou pour écarter plus ou moins de photos. Un clic sur la bande d’une photo lui donne l’autre sort, décidé par vous (la punaise) : le réglage n’y touche plus. Un second clic la rend à la proposition.`}</p>
      <p>{t`Bordure fine : c’est proposé. Plein : c’est décidé. « ? » : à vérifier, proche du réglage ou l’IA n’est pas d’accord. Les touches G (ou S), X et Suppr (ou Retour arrière) font la même chose sur les photos choisies.`}</p>
    </>
  );

  // Ligne 1 de la barre du bas : ce que fera « Valider » (en graisse 600, celle de la ligne) ; les photos en bordure
  // suivent le réglage : à la suite à 1440 px et plus, en tête de la ligne 2 en dessous (pas au palier, où la ligne 2
  // n'a pas la place : l'infobulle le dit).
  const resumeBas = (
    <span title={t`« Valider et continuer » suit le réglage pour les photos en bordure`}>
      <span>
        {t`${pluriel(resume.seront, 'photo sera écartée', 'photos seront écartées')} · ${pluriel(resume.total - resume.seront, 'gardée')}`}
        {resume.aVerifier > 0 && ` · ${t`dont ${nombre(resume.aVerifier)} à vérifier`}`}
      </span>
      <span class="suite-resume">
        {' — '}
        {t`les photos en bordure suivront le réglage`}
      </span>
    </span>
  );

  return (
    <div class="page-cadre page-floues" data-gabarit="photos" data-palier={palier ? '' : undefined} data-aide={aide ? '' : undefined}>
      {/* Forme E (D112) : une seule ligne de titre, de toute la largeur de la fenêtre ; les filtres y tiennent, sauf
          sous 1180 px de fenêtre (barre d'outils), que l'Aide soit ouverte ou non. */}
      <LigneEtape
        titre={nomEtape(ETAPE.floues)}
        aide={{ cle: 'floues', colonne: true }}
        taille
        filtres={etroit ? undefined : filtres}
        vue={
          etroit
            ? {
                nom: t`Afficher`,
                choix: [
                  { cle: 'toutes', libelle: t`Toutes` },
                  { cle: 'ecarter', libelle: t`À écarter` },
                  { cle: 'verifier', libelle: t`À vérifier` },
                  { cle: 'vous', libelle: t`Par vous` },
                ],
                actuelle: voir,
                choisir: (v) => setVoir(v as Filtre),
              }
            : undefined
        }
      />
      {etroit && <OutilsCadre>{filtres}</OutilsCadre>}
      <div class="corps-cadre">
        <section class="table-cadre" aria-label={t`Photos, de la moins nette à la plus nette`}>
          <GrillePhotos
            elements={elements}
            options={{
              cleVue: voir,
              glisser: false,
              groupes,
              // La photo telle qu'elle sera dans l'album, tournée et recadrée (D62), comme à la Sélection ; la case ne
              // descend pas sous 156 px : « Écartée par vous » y tient (C-10.4).
              telleQuAlbum: true,
              largeurMin: 156,
              // Le badge d'origine (D112) ; l'avis de l'IA pas encore tranché, en remarque sous la bande.
              etat: (f) => {
                const e = etats.get(f.id)!;
                return { classe: '', libelle: '', badge: badgeFlou(e, nettete(f), seuil, avisDe(f), () => basculer(f)) };
              },
              lignesLegende: aSuivre.length ? 1 : 0,
              pied: 24,
              legende: (f) => {
                const a = !decisionFlou(f) ? avisDe(f) : undefined;
                return a ? (
                  <span class="choix-ia">
                    <Icone nom="etincelle" taille={14} />
                    {t`L’IA : ${motAvis(a)}`}
                  </span>
                ) : (
                  ''
                );
              },
              infobulle: (f) => {
                const n = nettete(f);
                return [n !== undefined ? t`Netteté mesurée : ${nombre(n)} · le réglage écarte sous ${nombre(seuil)}` : t`Netteté pas mesurée`, ...lignesRaison(avisDe(f))];
              },
              // Ce qui part est un peu délavé (entier au survol, au focus et une fois choisi) ; rien dans « À écarter ».
              classe: (f) => (voir !== 'ecarter' && etats.get(f.id)?.sort === 'ecarter' ? 'delavee' : ''),
              ouvrir: (i) => (visionneuse.value = i),
              // Un filtre vide (« Par vous 0 », « ? 0 » à la première visite) le dit, à la place du message du dossier.
              vide: concernees.length > 0 ? t`Aucune photo dans ce filtre.` : undefined,
            }}
          />
        </section>
        {etroit && aide ? (
          <div class="pile-droite">
            {choisies.length > 0 && panneau}
            <PanneauAide cle="floues" titre={nomEtape(ETAPE.floues)}>
              {explication}
            </PanneauAide>
          </div>
        ) : (
          <>
            {panneau}
            {aide && (
              <PanneauAide cle="floues" titre={nomEtape(ETAPE.floues)}>
                {explication}
              </PanneauAide>
            )}
          </>
        )}
      </div>
      <BarreValidation
        resume={resumeBas}
        ecarte
        court
        devantL2={<span class="bordure-l2">{t`Les photos en bordure suivront le réglage.`}</span>}
        alertes={resume.sansMesure ? [t`${pluriel(resume.sansMesure, 'photo sans mesure de netteté', 'photos sans mesure de netteté')} (gardées)`] : []}
        revenir={() => revenirDe('floues')}
        valider={valider}
      />
      {visionneuse.value !== null && (
        <Visionneuse
          elements={elements}
          rangement={false}
          nettete={(f) => {
            const n = nettete(f);
            return n !== undefined ? t`netteté ${nombre(n)} · le réglage écarte sous ${nombre(seuil)}` : t`netteté pas mesurée`;
          }}
        />
      )}
    </div>
  );
}

/** Les photos affichées, relues par le gestionnaire de touches (créé une fois). */
const courantRef: { elements: FichierPlan[] } = { elements: [] };
