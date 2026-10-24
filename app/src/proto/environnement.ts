// Point g : que permet ce navigateur dans ce mode d'ouverture (file:// ou serveur) ?

import { accesDossiersDisponible } from '../navigateur/dossiers';
import { effacerCle, ecrireCle, lireCle } from '../navigateur/stockage';
import { noter } from './resultats';
import { contexte } from './contexte';
import { el, section, tableau, taille, texteMemoire } from './ui';

export async function monterEnvironnement() {
  const { corps, journal } = section(
    'g',
    'g. Mode d’ouverture et capacités du navigateur',
    'Ouvrez cette page de deux façons : en double-cliquant sur album-photos.html (file://), puis via le serveur de développement (http://localhost:5173/album-photos.html). Lancez les essais dans les deux cas et copiez les deux résultats.',
  );

  const lignes: [string, string, boolean | null][] = [];
  const verifier = (nom: string, valeur: string, ok: boolean | null) => lignes.push([nom, valeur, ok]);

  verifier('Adresse de la page', `${location.protocol}//${location.host}${location.pathname}`, null);
  verifier('Contexte sécurisé', String(window.isSecureContext), window.isSecureContext);
  verifier('Choix de dossier (showDirectoryPicker)', String(accesDossiersDisponible()), accesDossiersDisponible());
  verifier('IndexedDB', String('indexedDB' in window), 'indexedDB' in window);
  verifier('Stockage privé (OPFS)', String(!!navigator.storage?.getDirectory), !!navigator.storage?.getDirectory);
  verifier('createImageBitmap', String('createImageBitmap' in window), 'createImageBitmap' in window);
  verifier('OffscreenCanvas', String('OffscreenCanvas' in window), 'OffscreenCanvas' in window);
  verifier('crypto.subtle (empreintes)', String(!!crypto.subtle), !!crypto.subtle);
  verifier('Processeurs logiques', String(navigator.hardwareConcurrency), null);
  verifier('Mémoire JavaScript utilisée', texteMemoire(), null);

  // Les stockages et le worker sont vérifiés pour de vrai.
  try {
    await ecrireCle('essai', { quand: Date.now() });
    const lu = await lireCle<{ quand: number }>('essai');
    await effacerCle('essai');
    verifier('Écriture et lecture dans IndexedDB', lu ? 'fonctionne' : 'valeur perdue', !!lu);
  } catch (err) {
    verifier('Écriture et lecture dans IndexedDB', String(err), false);
  }
  try {
    localStorage.setItem('proto0:essai', 'x');
    const ok = localStorage.getItem('proto0:essai') === 'x';
    localStorage.removeItem('proto0:essai');
    verifier('localStorage', ok ? 'fonctionne' : 'valeur perdue', ok);
  } catch (err) {
    verifier('localStorage', String(err), false);
  }
  try {
    const racine = await navigator.storage.getDirectory();
    const f = await racine.getFileHandle('essai.txt', { create: true });
    const w = await f.createWritable();
    await w.write('essai');
    await w.close();
    const lu = await (await f.getFile()).text();
    await racine.removeEntry('essai.txt');
    verifier('Écriture dans le stockage privé', lu === 'essai' ? 'fonctionne' : `lu « ${lu} »`, lu === 'essai');
  } catch (err) {
    verifier('Écriture dans le stockage privé', String(err), false);
  }
  try {
    const persistant = (await navigator.storage.persisted?.()) ?? false;
    const estimation = await navigator.storage.estimate();
    verifier('Stockage persistant', String(persistant), null);
    verifier('Quota disponible', `${taille(estimation.quota ?? 0)} (utilisé : ${taille(estimation.usage ?? 0)})`, null);
  } catch (err) {
    verifier('Quota disponible', String(err), null);
  }
  try {
    const canevas = new OffscreenCanvas(64, 48);
    const ctx = canevas.getContext('2d')!;
    ctx.fillStyle = '#4080c0';
    ctx.fillRect(0, 0, 64, 48);
    ctx.fillStyle = '#f0e020';
    ctx.fillRect(10, 10, 20, 20);
    const debut = performance.now();
    const r = await contexte.groupe().analyser(await canevas.convertToBlob({ type: 'image/png' }), { fidele: true, empreinte: true });
    verifier(
      `Web Workers intégrés (${contexte.groupe().taille} en parallèle)`,
      `phash ${r.phash}, réponse en ${Math.round(performance.now() - debut)} ms`,
      !!r.phash && !!r.sha256,
    );
  } catch (err) {
    verifier('Web Workers intégrés', String(err), false);
  }

  corps.appendChild(
    tableau(
      ['Vérification', 'Résultat', ''],
      lignes.map(([nom, valeur, ok]) => [nom, valeur, ok === null ? '' : el('span', { classe: ok ? 'ok' : 'echec' }, ok ? '✓' : '✗')]),
    ),
  );
  const echecs = lignes.filter(([, , ok]) => ok === false);
  noter(
    'g',
    'capacites',
    echecs.length ? 'echec' : 'ok',
    echecs.length ? `Manque : ${echecs.map(([n]) => n).join(', ')}` : 'Toutes les capacités nécessaires sont présentes',
    Object.fromEntries(lignes.map(([n, v]) => [n, v])),
  );
  journal.info(`Page ouverte en ${location.protocol === 'file:' ? 'fichier local (file://)' : `serveur (${location.origin})`}.`);
}
