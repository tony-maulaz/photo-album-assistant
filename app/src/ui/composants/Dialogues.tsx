// Dialogues modaux (confirmation, saisie d'un nom), à la place de confirm() et prompt(),
// et une grande fenêtre pour un contenu riche qu'on n'imbrique pas dans une page (D107).

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../lib/langue';

interface Demande {
  id: number;
  titre: string;
  texte?: string;
  saisie?: { valeur: string; verifier?: (v: string) => string | null };
  /** Sans libellé : « Confirmer » (confirmation) ou « Valider » (saisie), traduit à l'affichage. */
  bouton?: string;
  danger?: boolean;
  /** Plusieurs choix (« Valider » de Doublons avec des copies restantes) : le dernier est le plein ; Échap n'en choisit aucun. */
  choix?: { cle: string; libelle: string }[];
  resoudre: (v: string | boolean | null) => void;
}

const courant = signal<Demande | null>(null);
let prochain = 1;

export function confirmer(titre: string, texte: string, bouton?: string, danger = false): Promise<boolean> {
  return new Promise((resoudre) => (courant.value = { id: prochain++, titre, texte, bouton, danger, resoudre: (v) => resoudre(v === true) }));
}

export function demander(titre: string, texte: string, valeur = '', verifier?: (v: string) => string | null, bouton?: string): Promise<string | null> {
  return new Promise(
    (resoudre) => (courant.value = { id: prochain++, titre, texte, saisie: { valeur, verifier }, bouton, resoudre: (v) => resoudre(typeof v === 'string' ? v : null) }),
  );
}

/**
 * Une question à plusieurs réponses (D112 : « Valider et continuer » avec des copies exactes restantes) : la clé
 * du choix, ou `null` (Échap, clic à côté : rien ne se passe). Le dernier choix est le plein et prend le focus.
 */
export function choisirParmi(titre: string, texte: string, choix: { cle: string; libelle: string }[]): Promise<string | null> {
  return new Promise((resoudre) => (courant.value = { id: prochain++, titre, texte, choix, resoudre: (v) => resoudre(typeof v === 'string' ? v : null) }));
}

export function Dialogues() {
  const d = courant.value;
  return d ? <Boite key={d.id} d={d} /> : null;
}

function Boite({ d }: { d: Demande }) {
  // Valeur et focus fixés dès l'ouverture : les lettres tapées aussitôt ne se perdent pas.
  const [valeur, setValeur] = useState(d.saisie?.valeur ?? '');
  const champ = useRef<HTMLInputElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (d.saisie) champ.current?.select();
    else bouton.current?.focus();
  }, []);

  const erreur = d.saisie?.verifier?.(valeur) ?? null;
  const fermer = (v: string | boolean | null) => {
    courant.value = null;
    d.resoudre(v);
  };
  const valider = () => {
    if (d.choix) fermer(d.choix.at(-1)!.cle);
    else if (d.saisie) {
      if (!erreur && valeur.trim()) fermer(valeur.trim());
    } else fermer(true);
  };

  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && fermer(null)}>
      <div
        // Trois choix et plus : une fenêtre plus large, pour qu'ils tiennent sur une ligne (maquette, D112 question 5).
        class={`dialogue${d.choix && d.choix.length >= 3 ? ' choix-multiples' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={d.titre}
        onKeyDown={(e) => {
          if (e.key === 'Escape') fermer(null);
          if (e.key === 'Enter') {
            e.preventDefault();
            // Plusieurs choix : Entrée prend celui qui a le focus.
            const choix = d.choix ? (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-choix]') : null;
            if (choix) choix.click();
            else valider();
          }
          e.stopPropagation();
        }}
      >
        <h2>{d.titre}</h2>
        {d.texte && <p>{d.texte}</p>}
        {d.saisie && (
          <>
            <input ref={champ} class="large" value={valeur} onInput={(e) => setValeur(e.currentTarget.value)} />
            {erreur && valeur && <p class="erreur">{erreur}</p>}
          </>
        )}
        {d.choix ? (
          <div class="actions droite">
            {d.choix.map((c, i) => {
              const dernier = i === d.choix!.length - 1;
              return (
                <button key={c.cle} ref={dernier ? bouton : undefined} type="button" class={dernier ? 'principal' : undefined} data-choix={c.cle} onClick={() => fermer(c.cle)}>
                  {c.libelle}
                </button>
              );
            })}
          </div>
        ) : (
          <div class="actions droite">
            <button type="button" onClick={() => fermer(null)}>
              {/* Fermer la boîte sans rien changer (glossaire) ; « Annuler » ne sert qu'à défaire un geste. */}
              {t`Ne rien faire`}
            </button>
            <button ref={bouton} type="button" class={d.danger ? 'danger' : 'principal'} disabled={!!d.saisie && (!!erreur || !valeur.trim())} onClick={valider}>
              {d.bouton ?? (d.saisie ? t`Accepter` : t`Confirmer`)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

let prochaineFenetre = 1;

/**
 * Grande fenêtre (D107) : un contenu riche (lieux fréquents, captures d'écran)
 * au lieu d'un panneau imbriqué dans une ligne de la page. Un titre, une
 * phrase d'explication, des onglets s'il en faut, un seul « Fermer » ; Échap ferme, le clavier reste
 * dans la fenêtre, et le focus revient à ce qui l'a ouverte.
 */
export function Fenetre({ titre, intro, onglets, pied, fermer, children }: { titre: string; intro?: ComponentChildren; onglets?: ComponentChildren; pied?: ComponentChildren; fermer: () => void; children: ComponentChildren }) {
  const boite = useRef<HTMLDivElement>(null);
  const [id] = useState(() => `fenetre-${prochaineFenetre++}`);
  const focusables = () => [...(boite.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])') ?? [])];
  useLayoutEffect(() => {
    const avant = document.activeElement as HTMLElement | null;
    // Le premier champ vide d'abord : on vient pour écrire un nom ; sinon le premier bouton.
    const champ = [...(boite.current?.querySelectorAll<HTMLInputElement>('input[type=text]') ?? [])].find((c) => !c.value);
    (champ ?? focusables()[0])?.focus();
    return () => avant?.focus?.();
  }, []);
  // Le focus perdu (un bouton désactivé ou une carte retirée après un geste) : Échap ferme encore la fenêtre.
  // En fin de parcours (bulle) : une vue ouverte par-dessus (visionneuse) arrête la touche avant.
  const fermerRef = useRef(fermer);
  fermerRef.current = fermer;
  useLayoutEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && (!document.activeElement || document.activeElement === document.body) && fermerRef.current();
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);
  return (
    <div class="voile voile-fenetre" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
      <div
        ref={boite}
        class="fenetre"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => {
          if (e.key === 'Escape') fermer();
          if (e.key === 'Tab') {
            const l = focusables();
            if (l.length) {
              const i = l.indexOf(document.activeElement as HTMLElement);
              if (e.shiftKey && i <= 0) {
                e.preventDefault();
                l.at(-1)!.focus();
              } else if (!e.shiftKey && i === l.length - 1) {
                e.preventDefault();
                l[0].focus();
              }
            }
          }
          // Les raccourcis de la page ne jouent pas pendant qu'elle est ouverte.
          e.stopPropagation();
        }}
      >
        <header class="tete-fenetre">
          <div>
            <h2 id={id}>{titre}</h2>
            {intro && <p class="discret">{intro}</p>}
          </div>
          <button type="button" onClick={fermer}>
            {t`Fermer`}
          </button>
        </header>
        {/* Les onglets restent sous le titre pendant que le corps défile (« Vos lieux », D112 point 9). */}
        {onglets && <div class="onglets-fenetre">{onglets}</div>}
        <div class="corps-fenetre">{children}</div>
        {pied && <footer class="pied-fenetre discret">{pied}</footer>}
      </div>
    </div>
  );
}
