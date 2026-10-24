// Service IA : réponses illisibles comptées par aide, redemandées sur demande ;
// erreurs de l'API expliquées sans leur JSON brut.

import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { expliquerErreur } from '../src/navigateur/claude';
import { fonctionDeCle, ServiceIA } from '../src/navigateur/ia';
import type { EtatProjet, Projet } from '../src/navigateur/projet';

/** Service IA sur un cache donné ; `ecrits` reçoit chaque écriture du cache. */
async function service(cache: Record<string, { r: unknown }>) {
  const ecrits: unknown[] = [];
  const etat = {
    lireBrut: async () => JSON.stringify(Object.fromEntries(Object.entries(cache).map(([c, e]) => [c, { ...e, quand: '2026-10-24', modele: 'claude-sonnet-5-5' }]))),
    ecrire: async (_nom: string, v: unknown) => void ecrits.push(JSON.parse(JSON.stringify(v))),
  } as unknown as EtatProjet;
  const ia = new ServiceIA(etat, { budget_chf: 10, couts_usd: {} } as unknown as Projet, () => 0.8, () => undefined, () => undefined);
  await ia.charger();
  return { ia, ecrits };
}

const CACHE = {
  'IA12|claude-opus-5-5|a': { r: null },
  'IA12|claude-opus-5-5|b': { r: { titre: 'Plage' } },
  'IA12|claude-opus-5-5|c': { r: null },
  'IA1|claude-sonnet-5-5|x|y': { r: null },
};

describe('réponses illisibles', () => {
  it('lit l’aide d’une clé du cache', () => {
    expect(fonctionDeCle('IA12|claude-opus-5-5|abc')).toBe('IA12');
    expect(fonctionDeCle('sans-barre')).toBe('sans-barre');
  });

  it('les compte par aide', async () => {
    const { ia } = await service(CACHE);
    expect(ia.inexploitables('IA12')).toBe(2);
    // « IA1 » ne compte pas celles de « IA12 » (même début de nom).
    expect(ia.inexploitables('IA1')).toBe(1);
    expect(ia.inexploitables('IA13')).toBe(0);
  });

  it('estime le coût de les redemander sans rien oublier', async () => {
    const { ia } = await service(CACHE);
    expect(ia.enCache('IA12|claude-opus-5-5|a')).toBe(true);
    expect(ia.sansInexploitables(() => [ia.enCache('IA12|claude-opus-5-5|a'), ia.enCache('IA12|claude-opus-5-5|b')])).toEqual([false, true]);
    expect(ia.enCache('IA12|claude-opus-5-5|a')).toBe(true);
  });

  it('oublie seulement celles de l’aide demandée', async () => {
    const { ia, ecrits } = await service(CACHE);
    expect(await ia.oublierInexploitables('IA12')).toBe(2);
    expect(ia.inexploitables('IA12')).toBe(0);
    expect(ia.inexploitables('IA1')).toBe(1);
    expect(ia.enCache('IA12|claude-opus-5-5|b')).toBe(true);
    expect(Object.keys(ecrits.at(-1) as object)).toEqual(['IA12|claude-opus-5-5|b', 'IA1|claude-sonnet-5-5|x|y']);
  });

  it('garde comme illisible une réponse lue mais inutilisable', async () => {
    const { ia } = await service(CACHE);
    await ia.marquerInexploitable('IA12|claude-opus-5-5|b');
    expect(ia.inexploitables('IA12')).toBe(3);
    // Toujours en cache : rien n'est repayé sans « Redemander ».
    expect(ia.enCache('IA12|claude-opus-5-5|b')).toBe(true);
  });
});

describe('erreurs de l’API', () => {
  const erreur = (statut: number, type: string, message: string) => Anthropic.APIError.generate(statut, { type: 'error', error: { type, message } }, undefined, new Headers());

  it('explique une surcharge (529) sans JSON', () => {
    const texte = expliquerErreur(erreur(529, 'overloaded_error', 'Overloaded'));
    expect(texte).toContain('surchargé');
    expect(texte).not.toContain('{');
  });

  it('donne le message de l’API d’une requête refusée, sans son enveloppe', () => {
    expect(expliquerErreur(erreur(400, 'invalid_request_error', 'max_tokens: too large'))).toBe('Requête refusée (400) : max_tokens: too large');
  });

  it('reconnaît un crédit épuisé et une clé refusée', () => {
    expect(expliquerErreur(erreur(400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API.'))).toContain('Crédit API épuisé');
    expect(expliquerErreur(erreur(401, 'authentication_error', 'invalid x-api-key'))).toContain('Réglages');
  });

  it('dit d’attendre pour une erreur passagère du service', () => {
    expect(expliquerErreur(erreur(500, 'api_error', 'Internal server error'))).toContain('passager (500)');
  });
});
