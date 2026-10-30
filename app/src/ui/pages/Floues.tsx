// Étape 3 — Photos floues (SPEC § 6.3) : curseur de tolérance avec compteur
// en direct, grille de la moins nette à la plus nette, « Sauver » et « Écarter ».
// Rien n'est écarté avant « Valider » : le seuil s'applique alors au plan.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { appliquerFloues, compterFloues, deciderFlou, estFloue, photosConcernees, SEUIL_FLOU } from '../../lib/floues';
import { t } from '../../lib/langue';
import type { FichierPlan } from '../../lib/plan';
import { lancerAnalyseDossier } from '../analyseDossier';
import { EncartAnalyse } from '../composants/Analyse';
import { BarreValidation } from '../composants/Cadre';
import { AideEtape, LigneEtape } from '../composants/CadreCommun';
import { GrillePhotos } from '../composants/GrillePhotos';
import { Icone } from '../composants/Icones';
import { Visionneuse } from '../composants/Visionneuse';
import { annuler, appliquer, notifier, planifierEnregistrement, retablir, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { nombre, pluriel } from '../format';
import { selection, visionneuse } from '../organiser';
import { verdictsIA1 } from '../composants/AidesTri';
import { combiner } from '../../lib/plan';
import { AideIA } from './AidesIA';

/** Curseur logarithmique : la netteté va de quelques unités à plusieurs milliers. */
const versCurseur = (seuil: number) => Math.round(Math.log(seuil) * 100);
const depuisCurseur = (v: number) => Math.round(Math.exp(v / 100));

function estChampDeSaisie(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
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
  const [voir, setVoir] = useState<'toutes' | 'ecartees'>('toutes');
  const nettete = (f: FichierPlan) => s.analyses.get(f)?.nettete;
  const concernees = useMemo(() => photosConcernees(s.plan), [versionPlan.value]);
  const triees = useMemo(
    () => [...concernees].sort((a, b) => (nettete(a) ?? Infinity) - (nettete(b) ?? Infinity) || a.id.localeCompare(b.id)),
    [concernees, versionIA.value],
  );
  const ecartees = compterFloues(concernees, nettete, seuil);
  const elements = voir === 'ecartees' ? triees.filter((f) => estFloue(f, nettete(f), seuil)) : triees;
  const choisis = [...selection.value];
  const sansMesure = concernees.filter((f) => nettete(f) === undefined).length;
  const verdicts = verdictsIA1(s);
  const aSuivre = concernees.filter((f) => verdicts[f.id] && !f.flou);

  useEffect(() => {
    selection.value = new Set();
    const touche = (e: KeyboardEvent) => {
      // Déjà traitée ailleurs (raccourci commun à toutes les pages) : ne pas annuler deux fois.
      if (e.defaultPrevented || estChampDeSaisie(e) || visionneuse.value !== null) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const ids = [...selection.value];
      const k = e.key.toLowerCase();
      // Ctrl+Y ou Ctrl+Maj+Z rétablit, Ctrl+Z annule.
      if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) retablir();
      else if (ctrl && k === 'z') annuler();
      else if (!ctrl && k === 's' && ids.length) appliquer(deciderFlou(session.value!.plan, ids, 'sauvee'));
      else if (!ctrl && (e.key === 'Delete' || k === 'x') && ids.length) appliquer(deciderFlou(session.value!.plan, ids, 'ecartee'));
      else if (e.key === 'Escape') selection.value = new Set();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);

  const valider = () => {
    appliquer(appliquerFloues(s.plan, nettete, seuil));
    s.projet.seuil_flou = seuil;
    planifierEnregistrement();
    if (ecartees) notifier('ok', t`${pluriel(ecartees, 'photo écartée', 'photos écartées')} : dans « Mis de côté », rien n’est supprimé.`, { libelle: t`Annuler`, faire: annuler });
    validerEtape('floues');
    // Les photos écartées quittent leurs journées : les rafales y sont cherchées de nouveau, en arrière-plan.
    void lancerAnalyseDossier();
  };

  return (
    <div class="page large avec-barre page-floues">
      {/* Forme E (D112) : la ligne de l'étape reste en haut (↶ ↷, Aide, Menu) ; la grille suit la page. */}
      <LigneEtape titre={t`Photos floues`} aide={{ cle: 'floues' }} />
      <AideEtape cle="floues">
        {t`Les photos sont classées de la moins nette à la plus nette. Réglez la tolérance : les photos sous le seuil seront écartées dans « Mis de côté ». Sauvez celles qui vous plaisent quand même (flou voulu, mouvement), écartez une photo nette mais ratée.`}
      </AideEtape>
      <EncartAnalyse photos={concernees} pourquoi={t`il faut mesurer la netteté de chaque photo.`} />
      <div class="reglages-etape ligne">
        {/* Le seuil de netteté (un nombre sans signification pour l'utilisateur) devient « plus tolérant ↔ plus strict » ;
            curseur gris, comme tous les curseurs (C-3.2). */}
        <label class="curseur-flou" title={t`Seuil de netteté : ${nombre(seuil)} (conseillé : ${SEUIL_FLOU})`}>
          <span class="bornes-curseur">
            <span>{t`Plus tolérant`}</span>
            <span>{t`Plus strict`}</span>
          </span>
          <input
            type="range"
            min={versCurseur(5)}
            max={versCurseur(1000)}
            value={versCurseur(seuil)}
            style={{ '--parcouru': `${((versCurseur(seuil) - versCurseur(5)) / (versCurseur(1000) - versCurseur(5))) * 100}%` }}
            data-action="tolerance"
            aria-label={t`Tolérance au flou`}
            onInput={(e) => changerSeuil(depuisCurseur(Number(e.currentTarget.value)))}
          />
        </label>
        {/* Au réglage conseillé, un état écrit, pas un bouton désactivé qui changerait de sens (C-4.7). */}
        {seuil === SEUIL_FLOU ? (
          <span class="discret" title={t`Réglage calibré sur de vraies photos`}>
            {t`Réglage conseillé`}
          </span>
        ) : (
          <button type="button" class="lien" onClick={() => changerSeuil(SEUIL_FLOU)} title={t`Réglage calibré sur de vraies photos`}>
            {t`Revenir au réglage conseillé`}
          </button>
        )}
        <strong class="compteur-floues">{pluriel(ecartees, 'photo écartée', 'photos écartées')}</strong>
        <span class="discret">{t`sur ${nombre(concernees.length)}`}</span>
        <select value={voir} onChange={(e) => setVoir(e.currentTarget.value as 'toutes' | 'ecartees')} aria-label={t`Photos affichées`}>
          <option value="toutes">{t`Toutes, de la moins nette à la plus nette`}</option>
          <option value="ecartees">{t`Seulement celles qui seront écartées`}</option>
        </select>
      </div>
      <AideIA fonction="IA1">
        {aSuivre.length > 0 && (
          <button
            type="button"
            onClick={() =>
              appliquer(
                combiner(
                  t`Suivre l’avis de l’IA`,
                  deciderFlou(s.plan, aSuivre.filter((f) => verdicts[f.id].verdict === 'ratee').map((f) => f.id), 'ecartee'),
                  deciderFlou(s.plan, aSuivre.filter((f) => verdicts[f.id].verdict !== 'ratee').map((f) => f.id), 'sauvee'),
                ),
              )
            }
          >
            {t`Suivre l’avis de l’IA pour ${pluriel(aSuivre.length, 'photo')}`}
          </button>
        )}
      </AideIA>
      <div class="grille-floues">
        {choisis.length > 0 && (
          <div class="barre-action" role="toolbar" aria-label={t`Photos sélectionnées`}>
            <span class="compte-selection">{pluriel(choisis.length, 'sélectionnée', 'sélectionnées')}</span>
            <button type="button" onClick={() => appliquer(deciderFlou(s.plan, choisis, 'sauvee'))} title={t`Touche S : elle reste dans le tri`}>
              {t`Sauver`}
            </button>
            <button type="button" onClick={() => appliquer(deciderFlou(s.plan, choisis, 'ecartee'))} title={t`Touche X : nette mais ratée`}>
              {t`Écarter`}
            </button>
            <button type="button" onClick={() => appliquer(deciderFlou(s.plan, choisis, undefined))} title={t`Écartée ou gardée selon le curseur, comme les autres`}>
              {t`Selon le curseur`}
            </button>
            <button type="button" class="fermer-action" onClick={() => (selection.value = new Set())} title={t`Échap`}>
              <Icone nom="croix" taille={16} />
              {t`Tout désélectionner`}
            </button>
          </div>
        )}
        <GrillePhotos
          elements={elements}
          options={{
            cleVue: voir,
            glisser: false,
            // L'état écrit sous la photo (C-9.1) ; l'avis de l'IA dans la remarque, son texte entier dans l'infobulle.
            etat: (f) =>
              f.flou === 'sauvee'
                ? { classe: 'garder', libelle: <><Icone nom="coche" taille={16} />{t`Sauvée`}</> }
                : f.flou === 'ecartee'
                  ? { classe: 'ecarter', libelle: <><Icone nom="croix" taille={16} />{t`Écartée`}</> }
                  : estFloue(f, nettete(f), seuil)
                    ? { classe: 'ecarter', libelle: <><Icone nom="croix" taille={16} />{t`Floue : à écarter`}</> }
                    : // Une photo nette reste, sans décision : un fait écrit en gris, le vert est pour ce que l'on sauve (C-3.2).
                      { classe: 'decider', libelle: t`Nette : gardée` },
            largeurMin: 156,
            telleQuAlbum: true,
            legende: (f) => (
              <>
                {nettete(f) !== undefined ? t`netteté ${nombre(nettete(f)!)}` : t`netteté inconnue`}
                {verdicts[f.id] && (
                  <span class="choix-ia">
                    {' · '}
                    <Icone nom="etincelle" taille={14} titre={t`Selon l’IA`} />
                    {verdicts[f.id].verdict === 'ratee' ? t`ratée` : verdicts[f.id].verdict === 'flou_voulu' ? t`flou voulu` : t`nette`}
                  </span>
                )}
              </>
            ),
            infobulle: (f) => (verdicts[f.id] ? [t`IA : ${verdicts[f.id].raison}`] : []),
            classe: (f) => (estFloue(f, nettete(f), seuil) ? 'refusee' : ''),
          }}
        />
      </div>
      <BarreValidation
        resume={t`${pluriel(ecartees, 'photo écartée', 'photos écartées')} · ${pluriel(concernees.length - ecartees, 'autre est gardée', 'autres sont gardées')}`}
        ecarte
        alertes={sansMesure ? [t`${pluriel(sansMesure, 'photo sans mesure de netteté', 'photos sans mesure de netteté')} (gardées)`] : []}
        revenir={() => revenirDe('floues')}
        valider={valider}
      />
      {visionneuse.value !== null && <Visionneuse elements={elements} />}
    </div>
  );
}
