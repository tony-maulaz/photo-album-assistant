// « Annuler » d'un message ne vaut que tant que son geste est le dernier (défaut 2 de l'étape 5) :
// `Historique.dernier` et `gesteActuel` (ui/etat.ts), dont dépendent le lien « Annuler » des messages (Cadre.tsx)
// et le rappel « ↶ ou Ctrl+Z » de la ligne de l'étape.

import { describe, expect, it, vi } from 'vitest';
import { Historique, mettreDeCote, planVide, RACINE, type FichierPlan } from '../src/lib/plan';

vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {}, querySelector: () => null, visibilityState: 'visible' });
vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });

const { annuler, gesteActuel, messages, notifier, session } = await import('../src/ui/etat');

function plan() {
  const p = planVide();
  for (const id of ['a.jpg', 'b.jpg', 'c.jpg'])
    p.fichiers.set(id, { id, nom: id, taille: 1, modifie: 0, categorie: 'photo', date: '2025-07-01T10:00:00', origineDate: 'exif', dossier: RACINE, statut: 'archive' } as FichierPlan);
  return p;
}

describe('Historique.dernier', () => {
  it('suit le dernier geste enregistré, annulé et rétabli ; rien sans geste', () => {
    const p = plan();
    const h = new Historique();
    expect(h.dernier).toBeUndefined();
    const m1 = mettreDeCote(p, ['a.jpg'])!;
    h.enregistrer(m1);
    expect(h.dernier).toBe(m1);
    const m2 = mettreDeCote(p, ['b.jpg'])!;
    h.enregistrer(m2);
    expect(h.dernier).toBe(m2);
    h.annuler(p);
    expect(h.dernier).toBe(m1);
    h.retablir(p);
    expect(h.dernier).toBe(m2);
    h.annuler(p);
    h.annuler(p);
    expect(h.dernier).toBeUndefined();
    // Un geste nul (rien à faire) n'entre pas.
    h.enregistrer(null);
    expect(h.dernier).toBeUndefined();
  });
});

describe('gesteActuel : le lien « Annuler » d’un message', () => {
  it('vaut pour le geste du message, plus après un autre geste, de nouveau quand celui-ci est annulé', async () => {
    const p = plan();
    const h = new Historique();
    session.value = { plan: p, historique: h } as never;
    h.enregistrer(mettreDeCote(p, ['a.jpg']));
    notifier('ok', '1 photo écartée.', { libelle: 'Annuler', faire: annuler });
    await Promise.resolve();
    const m = messages.value.at(-1)!;
    expect(gesteActuel(m)).toBe(true);
    h.enregistrer(mettreDeCote(p, ['b.jpg']));
    expect(gesteActuel(m)).toBe(false);
    h.annuler(p);
    expect(gesteActuel(m)).toBe(true);
    // Son geste annulé : plus rien à annuler pour lui.
    h.annuler(p);
    expect(gesteActuel(m)).toBe(false);
  });

  it('un message sans « Annuler », ou dont l’action est autre, ne propose jamais d’annuler', async () => {
    const p = plan();
    const h = new Historique();
    session.value = { plan: p, historique: h } as never;
    h.enregistrer(mettreDeCote(p, ['c.jpg']));
    notifier('info', 'Rien à annuler ici.', { libelle: 'Y aller', faire: () => {} });
    await Promise.resolve();
    expect(gesteActuel(messages.value.at(-1)!)).toBe(false);
    notifier('ok', 'Fait.');
    await Promise.resolve();
    expect(gesteActuel(messages.value.at(-1)!)).toBe(false);
  });
});
