// Contrôle de l'interface en anglais, à la fin d'un essai : la langue passe en
// anglais (Réglages), chaque étape et chaque page du menu est ouverte, puis on
// relève les traductions manquantes (signalées par `t` dans la console) et les
// lignes qui ont l'air d'être restées en français.

import { join } from 'node:path';

/** Mots courts très fréquents en français et absents de l'anglais. */
const MOTS_FRANCAIS = /\b(les|des|une|vous|pour|avec|dans|sont|aux|cette|qui|pas|sur|est|du|au|ou|et|le|la|un|de)\b/gi;

/** Une ligne « a l'air française » : au moins deux mots français distincts, ou un mot français et une lettre accentuée. */
export function ligneFrancaise(ligne) {
  const mots = new Set((ligne.match(MOTS_FRANCAIS) ?? []).map((m) => m.toLowerCase()));
  return mots.size >= 2 || (mots.size >= 1 && /[éèêàùçœ]/i.test(ligne));
}

/**
 * Passe l'interface en anglais et parcourt les pages. `captures` : dossier où
 * enregistrer une capture de chaque page (facultatif). Rend les traductions
 * manquantes et les lignes suspectes, par page.
 */
export async function controlerAnglais(page, captures) {
  const manquantes = new Set();
  page.on('console', (m) => {
    const x = m.text();
    if (x.startsWith('Traduction manquante : ')) manquantes.add(x.slice('Traduction manquante : '.length));
  });
  const menu = async (i) => {
    await page.locator('.bouton-menu').click();
    await page.locator('.menu-deroulant [role=menuitem]').nth(i).click();
  };
  // Réglages : 3e entrée du menu ☰ (Fonctions IA, Configuration, Réglages, Journal, Aide, Fermer le projet).
  await menu(2);
  await page.selectOption('#langue', 'en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');

  const suspectes = [];
  const relever = async (nom) => {
    await page.waitForTimeout(400);
    const lignes = (await page.locator('body').innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
    for (const l of lignes) if (ligneFrancaise(l)) suspectes.push(`${nom} : ${l.slice(0, 160)}`);
    if (captures) await page.screenshot({ path: join(captures, `en_${nom}.png`) });
  };
  await relever('reglages');
  const nbEtapes = await page.locator('.bandeau .etape').count();
  for (let i = 0; i < nbEtapes; i++) {
    await page.locator('.bandeau .etape').nth(i).click();
    await relever(`etape${String(i + 1).padStart(2, '0')}`);
  }
  for (const [i, nom] of [[0, 'fonctions_ia'], [1, 'configuration'], [3, 'journal'], [4, 'aide']]) {
    await menu(i);
    await relever(nom);
  }
  // Accueil, après fermeture du projet.
  await menu(5);
  await page.waitForTimeout(300);
  await relever('accueil');
  return { manquantes: [...manquantes], suspectes: [...new Set(suspectes)] };
}
