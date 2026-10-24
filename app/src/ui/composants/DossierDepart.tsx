// Dossier de départ des fenêtres de choix : choisi une fois, toutes les
// fenêtres (dossiers et fichiers) s'y ouvrent ensuite.

import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { choisirDossierDepart, dossierDepart, oublierDossierDepart } from '../../navigateur/dossiers';
import { notifier, texteErreur } from '../etat';

/** Nom du dossier de départ (`null` : aucun ; `undefined` : pas encore lu). */
const nomDepart = signal<string | null | undefined>(undefined);

async function relire() {
  nomDepart.value = (await dossierDepart())?.name ?? null;
}

async function choisir() {
  try {
    const d = await choisirDossierDepart();
    nomDepart.value = d.name;
    notifier('ok', `Les fenêtres de choix s’ouvriront désormais dans « ${d.name} ».`);
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) notifier('erreur', texteErreur(err));
  }
}

async function oublier() {
  await oublierDossierDepart();
  nomDepart.value = null;
  notifier('ok', 'Plus de dossier de départ : les fenêtres de choix s’ouvrent dans le dernier dossier choisi.');
}

/** Réglage complet (page Réglages). */
export function ReglageDossierDepart() {
  useEffect(() => void relire(), []);
  const nom = nomDepart.value;
  return (
    <div class="formulaire">
      <label>Dossier de départ</label>
      <div class="ligne-champ">
        <button type="button" onClick={() => void choisir()}>
          {nom ? 'Changer…' : 'Choisir…'}
        </button>
        <span class={nom ? '' : 'discret'}>{nom ? `« ${nom} »` : 'aucun : les fenêtres s’ouvrent dans le dernier dossier choisi'}</span>
        {nom && (
          <button type="button" class="lien" onClick={() => void oublier()}>
            Ne plus utiliser
          </button>
        )}
      </div>
      <p class="aide-champ">
        Choisissez le dossier où se trouvent vos photos (par exemple « Photos ») : toutes les fenêtres de choix de dossier et de fichier s’y ouvriront, sans
        avoir à le chercher à chaque fois.
      </p>
    </div>
  );
}

/** Rappel discret à côté des boutons « Choisir… » (formulaire du projet). */
export function RappelDossierDepart() {
  useEffect(() => void relire(), []);
  const nom = nomDepart.value;
  if (nom === undefined) return null;
  return (
    <p class="aide-champ">
      {nom ? (
        <>
          Les fenêtres de choix s’ouvrent dans « {nom} ».{' '}
          <button type="button" class="lien" onClick={() => void choisir()}>
            Changer
          </button>
        </>
      ) : (
        <>
          Pour que les fenêtres de choix s’ouvrent toujours au même endroit :{' '}
          <button type="button" class="lien" onClick={() => void choisir()}>
            choisir un dossier de départ
          </button>
        </>
      )}
    </p>
  );
}
