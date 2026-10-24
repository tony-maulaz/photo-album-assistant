// Démarrage de l'application : navigateur compatible, écran « Reprendre »
// si des dossiers attendent une autorisation, sinon dernier projet ou accueil.

import './style.css';
import { effect } from '@preact/signals';
import { render } from 'preact';
import { accesDossiersDisponible, dossierMemorise, etatAutorisation } from '../navigateur/dossiers';
import { projetsRecents } from '../navigateur/projet';
import { App } from './App';
import { enregistrerMaintenant, notifier, page, reglages, texteErreur } from './etat';
import { autorisations } from './pages/Accueil';
import { autorisationsEnAttente, chargerConfiguration, ouvrirProjet } from './projets';

effect(() => {
  const t = reglages.value.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t === 'clair' ? 'light' : 'dark';
});

window.addEventListener('pagehide', () => void enregistrerMaintenant());

async function demarrer() {
  const racine = document.getElementById('app')!;
  if (!accesDossiersDisponible()) {
    racine.innerHTML =
      '<div class="page etroite"><h1>Navigateur non pris en charge</h1><p>Cette application a besoin d’accéder à vos dossiers de photos : ouvrez-la avec Google Chrome ou Microsoft Edge, sur un ordinateur.</p></div>';
    return;
  }
  render(<App />, racine);
  try {
    const attente = await autorisationsEnAttente();
    if (attente.length) {
      autorisations.value = attente;
      page.value = { nom: 'reprendre' };
      return;
    }
    // Accès déjà accordés (rechargement de la page) : on reprend où on en était.
    const config = await dossierMemorise('config');
    if (config) await chargerConfiguration(config).catch((err) => notifier('erreur', `Configuration illisible : ${texteErreur(err)}`));
    const [dernier] = await projetsRecents();
    if (dernier && (await etatAutorisation(dernier.source, 'read')) === 'granted' && (await etatAutorisation(dernier.sortie, 'readwrite')) === 'granted') {
      await ouvrirProjet(dernier.source, dernier.sortie);
    }
  } catch (err) {
    notifier('erreur', texteErreur(err));
  }
}

void demarrer();
