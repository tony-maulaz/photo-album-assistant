// Étape 3 — Photos floues (SPEC § 6.3) : curseur de tolérance avec compteur
// en direct, grille de la moins nette à la plus nette, « Sauver » et « Écarter ».
// Rien n'est écarté avant « Valider » : le seuil s'applique alors au plan.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { appliquerFloues, compterFloues, deciderFlou, estFloue, photosConcernees, SEUIL_FLOU } from '../../lib/floues';
import type { FichierPlan } from '../../lib/plan';
import { EncartAnalyse } from '../composants/Analyse';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { GrillePhotos } from '../composants/GrillePhotos';
import { Icone } from '../composants/Icones';
import { Visionneuse } from '../composants/Visionneuse';
import { annuler, appliquer, notifier, planifierEnregistrement, retablir, revenirDe, session, validerEtape, versionIA, versionPlan } from '../etat';
import { ETAPE } from '../../navigateur/projet';
import { nombre, pluriel } from '../format';
import { selection, visionneuse } from '../organiser';
import { etatFloues, verdictsIA1 } from '../composants/AidesTri';
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
  etatFloues.seuil = seuil;
  const verdicts = verdictsIA1(s);
  const aSuivre = concernees.filter((f) => verdicts[f.id] && !f.flou);

  useEffect(() => {
    selection.value = new Set();
    const touche = (e: KeyboardEvent) => {
      if (estChampDeSaisie(e) || visionneuse.value !== null) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const ids = [...selection.value];
      if (ctrl && e.key.toLowerCase() === 'z') annuler();
      else if (ctrl && e.key.toLowerCase() === 'y') retablir();
      else if (!ctrl && e.key.toLowerCase() === 's' && ids.length) appliquer(deciderFlou(session.value!.plan, ids, 'sauvee'));
      else if (!ctrl && (e.key === 'Delete' || e.key.toLowerCase() === 'x') && ids.length) appliquer(deciderFlou(session.value!.plan, ids, 'ecartee'));
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
    notifier('ok', `${pluriel(ecartees, 'photo écartée', 'photos écartées')} : elles iront dans « _mis_de_cote/floues » (rien n’est supprimé).`, { libelle: 'Annuler', faire: annuler });
    validerEtape('floues');
  };

  return (
    <div class="page large avec-barre page-floues">
      <TeteEtape numero={ETAPE.floues} titre="Photos floues" cle="floues">
        Les photos sont classées de la moins nette à la plus nette. Réglez la tolérance : les photos sous le seuil seront écartées dans « _mis_de_cote/floues ».
        Sauvez celles qui vous plaisent quand même (flou voulu, mouvement), écartez une photo nette mais ratée.
      </TeteEtape>
      <EncartAnalyse photos={concernees} pourquoi="il faut mesurer la netteté de chaque photo." />
      <div class="reglages-etape ligne">
        {/* Le seuil de netteté (un nombre sans signification pour l'utilisateur) devient « plus tolérant ↔ plus strict ». */}
        <label class="curseur-flou" title={`Seuil de netteté : ${nombre(seuil)} (conseillé : ${SEUIL_FLOU})`}>
          <span class="bornes-curseur">
            <span>Plus tolérant</span>
            <span>Plus strict</span>
          </span>
          <input
            type="range"
            min={versCurseur(5)}
            max={versCurseur(1000)}
            value={versCurseur(seuil)}
            aria-label="Tolérance au flou"
            onInput={(e) => setSeuil(depuisCurseur(Number(e.currentTarget.value)))}
          />
        </label>
        <button type="button" class="lien" disabled={seuil === SEUIL_FLOU} onClick={() => setSeuil(SEUIL_FLOU)} title="Réglage calibré sur de vraies photos">
          Revenir au réglage conseillé
        </button>
        <strong class="compteur-floues">{pluriel(ecartees, 'photo écartée', 'photos écartées')}</strong>
        <span class="discret">sur {nombre(concernees.length)}</span>
        <select value={voir} onChange={(e) => setVoir(e.currentTarget.value as 'toutes' | 'ecartees')} aria-label="Photos affichées">
          <option value="toutes">Toutes, de la moins nette à la plus nette</option>
          <option value="ecartees">Seulement celles qui seront écartées</option>
        </select>
        <span class="espace" />
        <button type="button" disabled={!s.historique.peutAnnuler} onClick={annuler} title="Ctrl+Z">
          Annuler
        </button>
      </div>
      <AideIA fonction="IA1">
        {aSuivre.length > 0 && (
          <button
            type="button"
            onClick={() =>
              appliquer(
                combiner(
                  'Suivre l’avis de l’IA',
                  deciderFlou(s.plan, aSuivre.filter((f) => verdicts[f.id].verdict === 'ratee').map((f) => f.id), 'ecartee'),
                  deciderFlou(s.plan, aSuivre.filter((f) => verdicts[f.id].verdict !== 'ratee').map((f) => f.id), 'sauvee'),
                ),
              )
            }
          >
            Suivre l’avis de l’IA pour {pluriel(aSuivre.length, 'photo')}
          </button>
        )}
      </AideIA>
      <div class="grille-floues">
        {choisis.length > 0 && (
          <div class="barre-action" role="toolbar" aria-label="Photos sélectionnées">
            <span class="compte-selection">{pluriel(choisis.length, 'sélectionnée', 'sélectionnées')}</span>
            <button type="button" onClick={() => appliquer(deciderFlou(s.plan, choisis, 'sauvee'))} title="Touche S : elle reste dans le tri">
              Sauver
            </button>
            <button type="button" onClick={() => appliquer(deciderFlou(s.plan, choisis, 'ecartee'))} title="Touche X : nette mais ratée">
              Écarter
            </button>
            <button type="button" onClick={() => appliquer(deciderFlou(s.plan, choisis, undefined))} title="Écartée ou gardée selon le curseur, comme les autres">
              Selon le curseur
            </button>
            <button type="button" class="fermer-action" onClick={() => (selection.value = new Set())} title="Tout désélectionner (Échap)" aria-label="Tout désélectionner">
              <Icone nom="croix" taille={16} />
            </button>
          </div>
        )}
        <GrillePhotos
          elements={elements}
          options={{
            cleVue: voir,
            glisser: false,
            legende: (f) => (nettete(f) !== undefined ? `netteté ${nombre(nettete(f)!)}` : 'netteté inconnue'),
            classe: (f) => (estFloue(f, nettete(f), seuil) ? 'refusee' : ''),
            badges: (f) => (
              <>
                {f.flou === 'sauvee' && <span class="badge gardee">sauvée</span>}
                {f.flou === 'ecartee' && <span class="badge ecartee">écartée</span>}
                {f.flou !== 'sauvee' && f.flou !== 'ecartee' && estFloue(f, nettete(f), seuil) && <span class="badge ecartee">floue</span>}
                {verdicts[f.id] && (
                  <span class="badge choix-ia" title={verdicts[f.id].raison}>
                    IA : {verdicts[f.id].verdict === 'ratee' ? 'ratée' : verdicts[f.id].verdict === 'flou_voulu' ? 'flou voulu' : 'nette'}
                  </span>
                )}
              </>
            ),
          }}
        />
      </div>
      <BarreValidation
        resume={pluriel(ecartees, 'photo écartée', 'photos écartées')}
        alertes={sansMesure ? [`${pluriel(sansMesure, 'photo sans mesure', 'photos sans mesure')} de netteté (gardées)`] : []}
        revenir={() => revenirDe('floues')}
        valider={valider}
      />
      {visionneuse.value !== null && <Visionneuse elements={elements} />}
    </div>
  );
}
