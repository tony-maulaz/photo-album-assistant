// Point e : l'API Claude depuis le navigateur — image, recherche web, lots.

import type Anthropic from '@anthropic-ai/sdk';
import { coutUSD, jetonsImage, MODELES, modele } from '../lib/tarifs';
import { client, expliquerErreur, imageBase64 } from '../navigateur/claude';
import { cleApi, enregistrerCleApi, oublierCleApi } from '../navigateur/cle';
import { ecrireLocal, lireLocal } from '../navigateur/stockage';
import { noter } from './resultats';
import { bouton, duree, el, nombre, section, type Journal } from './ui';

const CLE_LOT = 'proto0:lot';
const CLE_TAUX = 'album:taux_usd_chf';

type OutilRecherche = 'web_search_20260209' | 'web_search_20260318' | 'web_search_20250305';

export function monterApi() {
  const { corps, journal } = section(
    'e',
    'e. API Claude depuis le navigateur (image, recherche web, lots)',
    'La clé est gardée dans ce navigateur (localStorage), jamais dans le code. Pour le test d’image, choisissez 20260721_113205.jpg (voilier, incident I5). Coût total des essais : quelques centimes.',
  );

  const champCle = el('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', classe: 'large' });
  const etatCle = el('span', { classe: 'etat' }, cleApi() ? 'Clé enregistrée dans ce navigateur.' : 'Aucune clé.');
  const choixModele = el('select', {}, ...MODELES.map((m) => el('option', { value: m.id }, `${m.nom} — ${m.entree} / ${m.sortie} USD par Mjetons`)));
  choixModele.value = 'claude-opus-5-5';
  const choixEffort = el('select', {}, ...['low', 'medium', 'high'].map((e) => el('option', { value: e }, `effort ${e}`)));
  const choixOutil = el(
    'select',
    {},
    ...(['web_search_20260209', 'web_search_20260318', 'web_search_20250305'] as OutilRecherche[]).map((t) => el('option', { value: t }, t)),
  );
  const champTaux = el('input', { type: 'number', step: '0.01', value: lireLocal(CLE_TAUX) ?? '0.80', classe: 'court' });
  champTaux.addEventListener('change', () => ecrireLocal(CLE_TAUX, champTaux.value));
  const choixImage = el('input', { type: 'file', accept: 'image/*' });
  const sortie = el('pre', { classe: 'apercu' });

  const parametres = (): Parametres => ({
    model: choixModele.value,
    effort: choixEffort.value as Parametres['effort'],
    outil: choixOutil.value as OutilRecherche,
    taux: Number(champTaux.value) || 0.8,
  });

  corps.append(
    el(
      'div',
      { classe: 'actions' },
      champCle,
      bouton('Enregistrer la clé', journal, () => {
        if (!champCle.value.trim()) throw new Error('Clé vide.');
        enregistrerCleApi(champCle.value.trim(), true);
        champCle.value = '';
        etatCle.textContent = 'Clé enregistrée dans ce navigateur.';
      }),
      bouton('Oublier la clé', journal, () => {
        oublierCleApi();
        etatCle.textContent = 'Aucune clé.';
      }),
      etatCle,
    ),
    el('div', { classe: 'actions' }, choixModele, choixEffort, el('label', {}, 'Recherche web : ', choixOutil), el('label', {}, '1 USD = ', champTaux, ' CHF')),
    el(
      'div',
      { classe: 'actions' },
      bouton('Lister les modèles', journal, () => listerModeles(journal, sortie)),
      bouton('1. Texte', journal, () => essaiTexte(journal, sortie, parametres())),
      el('label', {}, 'Image : ', choixImage),
      bouton('2. Image', journal, () => essaiImage(journal, sortie, parametres(), choixImage.files?.[0])),
      bouton('3. Recherche web', journal, () => essaiRecherche(journal, sortie, parametres())),
      bouton('4. Envoyer un lot', journal, () => envoyerLot(journal, sortie, parametres(), choixImage.files?.[0])),
      bouton('5. Vérifier le lot', journal, () => verifierLot(journal, sortie, parametres())),
    ),
    sortie,
  );
  const lot = lireLocal(CLE_LOT);
  if (lot) journal.info(`Lot en attente : ${JSON.parse(lot).id} — cliquez « Vérifier le lot ».`);
}

interface Parametres {
  model: string;
  effort: 'low' | 'medium' | 'high';
  outil: OutilRecherche;
  taux: number;
}

function texteReponse(m: Anthropic.Message): string {
  return m.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function bilan(m: Anthropic.Message, p: Parametres, ms: number, enLot = false): string {
  const usd = coutUSD(m.model.replace(/-\d{8}$/, ''), m.usage, enLot);
  const recherches = m.usage.server_tool_use?.web_search_requests ?? 0;
  return `${m.model}, ${nombre(m.usage.input_tokens)} jetons en entrée, ${nombre(m.usage.output_tokens)} en sortie${recherches ? `, ${recherches} recherche(s) web` : ''}, arrêt : ${m.stop_reason}, ${duree(ms)}${usd !== null ? `, coût ${nombre(usd * p.taux, 4)} CHF` : ''}`;
}

function options(p: Parametres): Pick<Anthropic.MessageCreateParamsNonStreaming, 'output_config'> {
  return modele(p.model)?.effort ? { output_config: { effort: p.effort } } : {};
}

async function listerModeles(journal: Journal, sortie: HTMLElement) {
  try {
    const ids: string[] = [];
    for await (const m of client().models.list()) ids.push(m.id);
    sortie.textContent = ids.join('\n');
    const connus = MODELES.filter((m) => ids.includes(m.id)).map((m) => m.id);
    journal.ok(`${ids.length} modèles accessibles avec cette clé ; dans notre table : ${connus.join(', ')}.`);
    noter('e', 'modeles', 'ok', `Modèles accessibles : ${ids.join(', ')}`, ids);
  } catch (err) {
    journal.echec(expliquerErreur(err));
    noter('e', 'modeles', 'echec', expliquerErreur(err));
  }
}

async function essaiTexte(journal: Journal, sortie: HTMLElement, p: Parametres) {
  const t0 = performance.now();
  try {
    const m = await client().messages.create({
      model: p.model,
      max_tokens: 2000,
      ...options(p),
      messages: [{ role: 'user', content: 'Réponds seulement « Bonjour depuis le navigateur ».' }],
    });
    const ms = performance.now() - t0;
    sortie.textContent = texteReponse(m);
    journal.ok(`Appel direct depuis la page réussi (${location.protocol}) : ${bilan(m, p, ms)}.`);
    noter('e', `texte_${p.model}`, 'ok', `Texte : ${bilan(m, p, ms)}`, { latenceMs: ms, usage: m.usage });
  } catch (err) {
    journal.echec(expliquerErreur(err));
    noter('e', `texte_${p.model}`, 'echec', expliquerErreur(err));
  }
}

async function essaiImage(journal: Journal, sortie: HTMLElement, p: Parametres, fichier?: File) {
  if (!fichier) throw new Error('Choisissez une image.');
  const cote = modele(p.model)?.coteImageMax ?? 1568;
  const img = await imageBase64(fichier, Math.min(cote, 1568));
  const t0 = performance.now();
  try {
    const m = await client().messages.create({
      model: p.model,
      max_tokens: 2000,
      ...options(p),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.donnees } },
            { type: 'text', text: 'Décris cette photo de vacances en une phrase, en français. Que voit-on sur la mer ?' },
          ],
        },
      ],
    });
    const ms = performance.now() - t0;
    const texte = texteReponse(m);
    sortie.textContent = texte;
    const voilier = /voilier|voile|bateau/i.test(texte);
    journal.ok(`Image ${img.largeur}×${img.hauteur} (${nombre(img.octets / 1024)} Ko, ≈ ${nombre(jetonsImage(img.largeur, img.hauteur, cote))} jetons) : ${bilan(m, p, ms)}.`);
    if (fichier.name.startsWith('20260721_113205')) journal.ecrire(voilier ? 'ok' : 'avert', voilier ? 'La description parle bien du voilier (I5).' : 'La description ne parle pas de voilier (I5) : à examiner.');
    noter('e', `image_${p.model}`, 'ok', `Image : ${bilan(m, p, ms)}`, { latenceMs: ms, usage: m.usage, description: texte, image: { largeur: img.largeur, hauteur: img.hauteur, octets: img.octets } });
  } catch (err) {
    journal.echec(expliquerErreur(err));
    noter('e', `image_${p.model}`, 'echec', expliquerErreur(err));
  }
}

function outilRecherche(p: Parametres): Anthropic.ToolUnion {
  return { type: p.outil, name: 'web_search', max_uses: 3 } as Anthropic.ToolUnion;
}

const QUESTION_WEB =
  'Des photos de vacances ont été prises aux coordonnées GPS 9.5057 N, 100.0562 E (Koh Samui, Thaïlande). Cherche sur le web le nom usuel de la plage ou du village à cet endroit, puis réponds en une phrase avec ta source.';

async function essaiRecherche(journal: Journal, sortie: HTMLElement, p: Parametres) {
  const t0 = performance.now();
  try {
    const m = await client().messages.create({
      model: p.model,
      max_tokens: 4000,
      ...options(p),
      tools: [outilRecherche(p)],
      messages: [{ role: 'user', content: QUESTION_WEB }],
    });
    const ms = performance.now() - t0;
    const texte = texteReponse(m);
    sortie.textContent = texte;
    const recherches = m.usage.server_tool_use?.web_search_requests ?? 0;
    journal.ecrire(recherches ? 'ok' : 'avert', `Recherche web (${p.outil}) : ${bilan(m, p, ms)}.`);
    noter('e', `recherche_${p.model}_${p.outil}`, recherches ? 'ok' : 'avert', `Recherche web : ${bilan(m, p, ms)}`, { latenceMs: ms, usage: m.usage, reponse: texte });
  } catch (err) {
    journal.echec(expliquerErreur(err));
    noter('e', `recherche_${p.model}_${p.outil}`, 'echec', expliquerErreur(err));
  }
}

async function envoyerLot(journal: Journal, sortie: HTMLElement, p: Parametres, fichier?: File) {
  const requetes: Anthropic.Messages.BatchCreateParams.Request[] = [
    {
      custom_id: 'texte',
      params: { model: p.model, max_tokens: 1000, ...options(p), messages: [{ role: 'user', content: 'Réponds seulement « Bonjour depuis un lot ».' }] },
    },
    {
      custom_id: 'recherche',
      params: { model: p.model, max_tokens: 4000, ...options(p), tools: [outilRecherche(p)], messages: [{ role: 'user', content: QUESTION_WEB }] },
    },
  ];
  if (fichier) {
    const img = await imageBase64(fichier, 1024);
    requetes.push({
      custom_id: 'image',
      params: {
        model: p.model,
        max_tokens: 1000,
        ...options(p),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.donnees } },
              { type: 'text', text: 'Décris cette photo en une phrase, en français.' },
            ],
          },
        ],
      },
    });
  }
  try {
    const lot = await client().messages.batches.create({ requests: requetes });
    ecrireLocal(CLE_LOT, JSON.stringify({ id: lot.id, envoye: Date.now() }));
    sortie.textContent = JSON.stringify(lot, null, 1);
    journal.ok(`Lot ${lot.id} envoyé (${requetes.length} requêtes). Vous pouvez fermer la page : « Vérifier le lot » le retrouvera.`);
    noter('e', 'lot_envoi', 'ok', `Lot de ${requetes.length} requêtes envoyé`, { id: lot.id });
  } catch (err) {
    journal.echec(expliquerErreur(err));
    noter('e', 'lot_envoi', 'echec', expliquerErreur(err));
  }
}

async function verifierLot(journal: Journal, sortie: HTMLElement, p: Parametres) {
  const memo = lireLocal(CLE_LOT);
  if (!memo) throw new Error('Aucun lot envoyé depuis ce navigateur.');
  const { id, envoye } = JSON.parse(memo) as { id: string; envoye: number };
  try {
    const c = client();
    const lot = await c.messages.batches.retrieve(id);
    if (lot.processing_status !== 'ended') {
      journal.info(`Lot ${id} : ${lot.processing_status}, ${lot.request_counts.processing} requête(s) en cours (envoyé il y a ${duree(Date.now() - envoye)}).`);
      return;
    }
    const lignes: string[] = [];
    let total = 0;
    for await (const r of await c.messages.batches.results(id)) {
      if (r.result.type === 'succeeded') {
        const m = r.result.message;
        total += coutUSD(m.model.replace(/-\d{8}$/, ''), m.usage, true) ?? 0;
        lignes.push(`[${r.custom_id}] ${texteReponse(m)}\n    → ${bilan(m, p, 0, true)}`);
      } else {
        lignes.push(`[${r.custom_id}] ${r.result.type}${r.result.type === 'errored' ? ` : ${JSON.stringify(r.result.error)}` : ''}`);
      }
    }
    sortie.textContent = lignes.join('\n');
    const attente = lot.ended_at ? new Date(lot.ended_at).getTime() - new Date(lot.created_at).getTime() : 0;
    const texte = `Lot terminé en ${duree(attente)} : ${lot.request_counts.succeeded} réussies, ${lot.request_counts.errored} en erreur ; coût ${nombre(total * p.taux, 4)} CHF (−50 %).`;
    journal.ecrire(lot.request_counts.errored ? 'avert' : 'ok', texte);
    noter('e', 'lot_resultats', lot.request_counts.errored ? 'avert' : 'ok', texte, { attenteMs: attente, compte: lot.request_counts, resultats: lignes });
    ecrireLocal(CLE_LOT, null);
  } catch (err) {
    journal.echec(expliquerErreur(err));
    noter('e', 'lot_resultats', 'echec', expliquerErreur(err));
  }
}
