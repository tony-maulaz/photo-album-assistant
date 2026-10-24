// Page de test de la phase 0 : un bloc par point du § 16 de la spécification.

import './style.css';
import { monterApi } from './api';
import { monterConfig } from './config';
import { monterCopie } from './copie';
import { monterDossier } from './dossier';
import { monterEnvironnement } from './environnement';
import { monterGrille } from './grille';
import { monterNominatim } from './nominatim';
import { monterPhotos } from './photos';
import { effacer, exporter, surChangement, tousLesPoints } from './resultats';
import { el } from './ui';

function monterResultats() {
  const zone = document.getElementById('resultats')!;
  const liste = el('div', { classe: 'liste' });
  const message = el('span', { classe: 'etat' });
  const copier = el('button', { type: 'button', classe: 'principal' }, 'Copier les résultats');
  copier.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exporter());
      message.textContent = 'Copié : collez-le dans la conversation.';
    } catch {
      message.textContent = 'Copie impossible : utilisez « Télécharger ».';
    }
  });
  const telecharger = el('button', { type: 'button' }, 'Télécharger');
  telecharger.addEventListener('click', () => {
    const lien = el('a', {
      href: URL.createObjectURL(new Blob([exporter()], { type: 'application/json' })),
      download: `resultats_phase0_${location.protocol.replace(':', '')}.json`,
    });
    lien.click();
    URL.revokeObjectURL(lien.href);
  });
  const vider = el('button', { type: 'button' }, 'Effacer');
  vider.addEventListener('click', () => {
    if (confirm('Effacer tous les résultats enregistrés dans ce navigateur ?')) effacer();
  });

  const afficher = () => {
    const points = tousLesPoints();
    liste.replaceChildren(
      ...Object.keys(points)
        .sort()
        .flatMap((p) => [
          el('h3', {}, `Point ${p}`),
          ...Object.entries(points[p]).map(([cle, m]) => el('div', { classe: `ligne ${m.statut}`, title: cle }, el('span', { classe: 'icone' }, { ok: '✓', echec: '✗', avert: '!', info: '·' }[m.statut]), el('span', {}, m.texte))),
        ]),
    );
  };
  surChangement(afficher);
  afficher();
  zone.append(el('h2', {}, `Résultats (${location.protocol === 'file:' ? 'file://' : location.host})`), el('div', { classe: 'actions' }, copier, telecharger, vider), message, liste);
}

async function demarrer() {
  monterResultats();
  await monterEnvironnement();
  await monterDossier();
  await monterConfig();
  monterPhotos();
  await monterCopie();
  monterApi();
  monterNominatim();
  monterGrille();
}

demarrer().catch((err) => {
  document.body.prepend(el('p', { classe: 'echec' }, `Erreur au démarrage : ${String(err)}`));
});
