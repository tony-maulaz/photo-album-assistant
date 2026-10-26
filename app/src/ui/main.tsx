// Démarrage de l'application : navigateur compatible, écran « Reprendre »
// si des dossiers attendent une autorisation, sinon dernier projet ou accueil.

import './style.css';
import './styles/sortie.css';
import './styles/album.css';
import './styles/selection.css';
import './styles/rangement.css';
import './styles/doublons.css';
import './styles/petits.css';
import './styles/accueil.css';
import './styles/general.css';
import './styles/apercuTri.css';
import './styles/nommage.css';
import './styles/consolidation.css';
import { effect } from '@preact/signals';
import { render } from 'preact';
import { definirLangue, langueDuNavigateur, t } from '../lib/langue';
import { accesDossiersDisponible, dossierMemorise, etatAutorisation } from '../navigateur/dossiers';
import { projetsRecents } from '../navigateur/projet';
import { App } from './App';
import { enregistrerMaintenant, langueInterface, notifier, page, reglages, texteErreur } from './etat';
import { autorisations } from './pages/Accueil';
import { installerRaccourcis } from './composants/Raccourcis';
import { finDemarrage, installerNavigation } from './navigation';
import { autorisationsEnAttente, chargerConfiguration, ouvrirProjet } from './projets';

effect(() => {
  const t = reglages.value.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t === 'clair' ? 'light' : 'dark';
});

// Langue : choisie dans les réglages, sinon celle du navigateur. Toute l'interface est redessinée quand elle change.
effect(() => {
  const choisie = reglages.value.langue;
  const l = choisie === 'auto' ? langueDuNavigateur(navigator.languages) : choisie;
  definirLangue(l);
  document.documentElement.lang = l;
  document.title = t`Album photos`;
  langueInterface.value = l;
});

function Racine() {
  return <App key={langueInterface.value} />;
}

window.addEventListener('pagehide', () => void enregistrerMaintenant());
installerNavigation();
installerRaccourcis();

async function demarrer() {
  const racine = document.getElementById('app')!;
  if (!accesDossiersDisponible()) {
    racine.innerHTML = `<div class="page etroite"><h1>${t`Navigateur non pris en charge`}</h1><p>${t`Cette application a besoin d’accéder à vos dossiers de photos : ouvrez-la avec Google Chrome ou Microsoft Edge, sur un ordinateur.`}</p></div>`;
    return;
  }
  render(<Racine />, racine);
  try {
    const attente = await autorisationsEnAttente();
    if (attente.length) {
      autorisations.value = attente;
      page.value = { nom: 'reprendre' };
      return;
    }
    // Accès déjà accordés (rechargement de la page) : on reprend où on en était.
    const config = await dossierMemorise('config');
    if (config) await chargerConfiguration(config).catch((err) => notifier('erreur', t`Configuration illisible : ${texteErreur(err)}`));
    const [dernier] = await projetsRecents();
    if (dernier && (await etatAutorisation(dernier.source, 'read')) === 'granted' && (await etatAutorisation(dernier.sortie, 'readwrite')) === 'granted') {
      await ouvrirProjet(dernier.source, dernier.sortie);
    }
  } catch (err) {
    notifier('erreur', texteErreur(err));
  } finally {
    finDemarrage();
  }
}

void demarrer();
