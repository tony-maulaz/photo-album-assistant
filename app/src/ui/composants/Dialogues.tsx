// Dialogues modaux (confirmation, saisie d'un nom), à la place de confirm() et prompt().

import { signal } from '@preact/signals';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

interface Demande {
  id: number;
  titre: string;
  texte?: string;
  saisie?: { valeur: string; verifier?: (v: string) => string | null };
  bouton: string;
  danger?: boolean;
  resoudre: (v: string | boolean | null) => void;
}

const courant = signal<Demande | null>(null);
let prochain = 1;

export function confirmer(titre: string, texte: string, bouton = 'Confirmer', danger = false): Promise<boolean> {
  return new Promise((resoudre) => (courant.value = { id: prochain++, titre, texte, bouton, danger, resoudre: (v) => resoudre(v === true) }));
}

export function demander(titre: string, texte: string, valeur = '', verifier?: (v: string) => string | null, bouton = 'Valider'): Promise<string | null> {
  return new Promise(
    (resoudre) => (courant.value = { id: prochain++, titre, texte, saisie: { valeur, verifier }, bouton, resoudre: (v) => resoudre(typeof v === 'string' ? v : null) }),
  );
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
    if (d.saisie) {
      if (!erreur && valeur.trim()) fermer(valeur.trim());
    } else fermer(true);
  };

  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && fermer(null)}>
      <div
        class="dialogue"
        role="dialog"
        aria-modal="true"
        aria-label={d.titre}
        onKeyDown={(e) => {
          if (e.key === 'Escape') fermer(null);
          if (e.key === 'Enter') {
            e.preventDefault();
            valider();
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
        <div class="actions droite">
          <button type="button" onClick={() => fermer(null)}>
            Annuler
          </button>
          <button ref={bouton} type="button" class={d.danger ? 'danger' : 'principal'} disabled={!!d.saisie && (!!erreur || !valeur.trim())} onClick={valider}>
            {d.bouton}
          </button>
        </div>
      </div>
    </div>
  );
}
