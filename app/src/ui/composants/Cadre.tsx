// Cadre de l'application : en-tête (avec l'avancement des étapes), messages, barres.

import type { ComponentChildren, RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { arborescenceValidee, CODES_ETAPES, ETAPE, ETAPES, ETAPES_COURTES, etapeInutile } from '../../navigateur/projet';
import { messages, page, reglages, session, versionIA, versionProjet, type Page } from '../etat';
import { nombre } from '../format';
import { fermerProjet } from '../projets';
import { Icone } from './Icones';

/** Ouvert / fermé, refermé par un clic ailleurs ou Échap. */
function useDeroulant(): [boolean, (v?: boolean) => void, RefObject<HTMLDivElement | null>] {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (!zone.current?.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', clic);
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('mousedown', clic);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);
  return [ouvert, (v) => setOuvert(v ?? !ouvert), zone];
}

const SYMBOLES = { validee: '✓', en_cours: '', a_faire: '', a_revoir: '!' } as const;
const LIBELLES = { validee: 'validée', en_cours: 'en cours', a_faire: 'à faire', a_revoir: 'à revoir' } as const;

/**
 * Avancement du projet, sur la ligne de l'en-tête : un rectangle par étape
 * (couleur = état, nom en infobulle, clic = y aller), puis le nom de l'étape
 * en cours ; un clic sur ce nom déroule la liste des étapes.
 */
function Avancement() {
  const s = session.value!;
  const p = page.value;
  const [ouvert, basculer, zone] = useDeroulant();
  const courante = p.nom === 'etape' ? p.numero : 0;
  const etats = s.projet.etapes;
  const etapes = ETAPES.map((nom, i) => {
    const n = i + 1;
    const code = CODES_ETAPES[i];
    // La création de la sortie suppose l'arborescence validée (§ 4.2).
    const verrouillee = code === 'sortie' && !arborescenceValidee(s.projet);
    const inutile = etapeInutile(s.projet.mode, code);
    const etat = etats[i];
    const detail = inutile ? 'inutile pour un dossier déjà trié' : verrouillee ? `validez d’abord l’étape ${ETAPE.lieux} (Lieux et sorties)` : LIBELLES[etat];
    const symbole = inutile ? '–' : verrouillee ? '' : SYMBOLES[etat];
    const classe = `etape ${etat}${n === courante ? ' courante' : ''}${inutile ? ' inutile' : ''}${verrouillee ? ' verrouillee' : ''}`;
    return { n, nom, court: ETAPES_COURTES[i], etat, detail, symbole, classe };
  });
  const aller = (n: number) => {
    page.value = { nom: 'etape', numero: n };
    basculer(false);
  };
  return (
    <div class="avancement-etapes" ref={zone}>
      <ol class="bandeau" aria-label="Étapes">
        {etapes.map((e) => (
          <li key={e.n}>
            <button type="button" class={e.classe} title={`${e.n}. ${e.nom} : ${e.detail}`} aria-current={e.n === courante ? 'step' : undefined} onClick={() => aller(e.n)}>
              {/* Le texte reste lisible par les lecteurs d'écran ; à l'écran, la couleur suffit. */}
              <span class="texte-masque">
                {e.symbole && <span class="symbole">{e.symbole}</span>}
                <span class="numero">{e.n}</span>
                <span class="nom">{e.court}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" class="etape-courante" aria-expanded={ouvert} aria-haspopup="menu" onClick={() => basculer()} title="Toutes les étapes">
        {courante ? (
          <>
            Étape {courante} sur {ETAPES.length} · <strong>{ETAPES_COURTES[courante - 1]}</strong>
          </>
        ) : (
          'Étapes'
        )}{' '}
        ▾
      </button>
      {ouvert && (
        <ul class="liste-etapes" role="menu" aria-label="Étapes">
          {etapes.map((e) => (
            <li key={e.n}>
              <button type="button" role="menuitem" class={`choix-${e.classe}`} onClick={() => aller(e.n)}>
                <span class="rond">{e.symbole || e.n}</span>
                <span class="nom">{e.nom}</span>
                <span class="etat-etape">{e.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Menu ☰ : les pages consultées de temps en temps, et fermer le projet. */
function MenuPrincipal() {
  const s = session.value;
  const p = page.value;
  const [ouvert, basculer, zone] = useDeroulant();
  const aller = (v: Page) => {
    page.value = v;
    basculer(false);
  };
  const entrees: [Page, string][] = [
    [{ nom: 'ia' }, 'Fonctions IA'],
    [{ nom: 'configuration' }, 'Configuration'],
    [{ nom: 'reglages' }, 'Réglages'],
    ...(s ? ([[{ nom: 'journal' }, 'Journal']] as [Page, string][]) : []),
    [{ nom: 'aide' }, 'Aide'],
  ];
  return (
    <div class="menu-principal" ref={zone}>
      <button type="button" class="bouton-icone bouton-menu" aria-label="Menu" aria-haspopup="menu" aria-expanded={ouvert} onClick={() => basculer()} title="Menu">
        <Icone nom="menu" taille={20} />
      </button>
      {ouvert && (
        <div class="menu-deroulant" role="menu" aria-label="Menu">
          {entrees.map(([vers, libelle]) => (
            <button key={libelle} type="button" role="menuitem" class={p.nom === vers.nom ? 'actif' : ''} onClick={() => aller(vers)}>
              {libelle}
            </button>
          ))}
          {s && (
            <>
              <hr />
              <button
                type="button"
                role="menuitem"
                title="Tout est déjà enregistré"
                onClick={() => {
                  basculer(false);
                  fermerProjet();
                }}
              >
                Fermer le projet
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** En-tête sur une seule ligne : logo (accueil), projet, avancement des étapes, budget IA, menu. */
export function Entete() {
  const s = session.value;
  versionProjet.value;
  versionIA.value;
  const depense = s ? s.ia.depenseCHF() : 0;
  const part = s && s.projet.budget_chf > 0 ? depense / s.projet.budget_chf : 0;
  return (
    <header class="entete">
      <button type="button" class="marque" onClick={() => (page.value = { nom: 'accueil' })} title="Accueil">
        <span class="logo">
          <Icone nom="photo" taille={20} />
        </span>
        {!s && 'Album photos'}
      </button>
      {s && (
        <span class="projet" title={`Projet « ${s.projet.nom} » — source : ${s.source.racine.name}, sortie : ${s.sortie.racine.name}`}>
          {s.projet.nom}
        </span>
      )}
      {s ? <Avancement /> : <span class="espace" />}
      {s && (
        <span
          class={`budget${part >= 0.8 ? ' alerte' : part >= 0.5 ? ' moitie' : ''}`}
          title={`Dépenses IA du projet : ${nombre(depense, 2)} CHF sur un budget de ${s.projet.budget_chf} CHF (taux ${reglages.value.tauxUsdChf} CHF par USD). Détail dans le Journal.`}
        >
          <span class="anneau" style={{ '--part': `${Math.min(100, part * 100).toFixed(1)}%` }} aria-hidden="true" />
          IA {nombre(depense, 2)} / {s.projet.budget_chf} CHF
        </span>
      )}
      <MenuPrincipal />
    </header>
  );
}

export function Messages() {
  return (
    <div class="messages" aria-live="polite">
      {messages.value.map((m) => (
        <div key={m.id} class={`message ${m.type}`}>
          <span class="pastille-message">
            <Icone nom={m.type === 'ok' ? 'coche' : m.type === 'erreur' ? 'alerte' : 'info'} taille={14} epaisseur={2.6} />
          </span>
          <span class="texte-message">{m.texte}</span>
          {m.action && (
            <button type="button" onClick={m.action.faire}>
              {m.action.libelle}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Explication en deux phrases en tête de chaque page d'étape (§ 5.2). */
export function TeteEtape({ numero, titre, children }: { numero?: number; titre: string; children: ComponentChildren }) {
  return (
    <div class="tete-etape">
      <h1>
        {numero !== undefined && <span class="numero-etape">Étape {numero}</span>}
        {titre}
      </h1>
      <p class="explication">{children}</p>
    </div>
  );
}

/** Barre de validation fixée en bas (§ 5.2) : résumé chiffré, alertes, Revenir, Valider et continuer. */
export function BarreValidation({
  resume,
  alertes = [],
  revenir,
  valider,
  libelleValider = 'Valider et continuer',
  validerActif = true,
}: {
  resume: ComponentChildren;
  alertes?: string[];
  revenir?: () => void;
  valider?: () => void;
  libelleValider?: string;
  validerActif?: boolean;
}) {
  return (
    <footer class="barre-validation">
      <div class="resume">{resume}</div>
      <div class="alertes">
        {alertes.map((a) => (
          <span key={a} class="alerte">
            {a}
          </span>
        ))}
      </div>
      <div class="actions">
        {revenir && (
          <button type="button" onClick={revenir}>
            Revenir
          </button>
        )}
        {valider && (
          <button type="button" class="principal" disabled={!validerActif} onClick={valider}>
            {libelleValider}
          </button>
        )}
      </div>
    </footer>
  );
}

export function BarreProgression({ faits, total, texte }: { faits: number; total: number; texte?: string }) {
  const pct = total > 0 ? Math.min(100, (faits / total) * 100) : 0;
  return (
    <div class="progression">
      <div class="jauge" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div class="rempli" style={{ width: total > 0 ? `${pct}%` : '30%' }} data-indetermine={total > 0 ? undefined : ''} />
      </div>
      {texte && <span class="texte">{texte}</span>}
    </div>
  );
}
