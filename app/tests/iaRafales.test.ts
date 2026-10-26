import { describe, expect, it } from 'vitest';
import { avisValable, demandeRafale, lireRafale, rafaleDemandable, signatureRafale } from '../src/lib/iaRafales';

const photos = [
  { id: 'a.jpg', identite: 'ia-a' },
  { id: 'b.jpg', identite: 'ia-b' },
  { id: 'c.jpg', identite: 'ia-c' },
];
const ids = photos.map((p) => p.id);

describe('IA16 — choisir dans une rafale (D102)', () => {
  it('demande : photos numérotées en 1568 px, modèle rapide, consigne de la meilleure de la pile et raisons par photo', () => {
    const d = demandeRafale(photos);
    expect(d).toMatchObject({ fonction: 'IA16', niveau: 'rapide', ids });
    expect(d.images.map((i) => i.type === 'photo' && i.cote)).toEqual([1568, 1568, 1568]);
    expect(d.images[0]).toMatchObject({ libelle: 'Photo 1 :' });
    expect(d.consigne).toContain('rafale/série');
    expect(d.consigne).toContain('"yeux_fermes"');
    expect(d.consigne).toContain('"personnes"');
  });

  it('cache : la clé ne dépend que des photos et de la consigne', () => {
    expect(demandeRafale(photos).cle).toBe(demandeRafale(photos).cle);
    expect(demandeRafale(photos).cle).not.toBe(demandeRafale(photos.slice(0, 2)).cle);
    expect(demandeRafale(photos, { contexte: 'Vacances en famille' }).cle).not.toBe(demandeRafale(photos).cle);
  });

  it('2 à 6 photos seulement (I5)', () => {
    expect([1, 2, 6, 7].map(rafaleDemandable)).toEqual([false, true, true, false]);
  });

  it('lit le choix et une raison par photo', () => {
    const a = lireRafale(
      {
        meilleure: 2,
        equivalentes: false,
        personnes: 2,
        justification: 'Les deux enfants sont là et sourient.',
        photos: [
          { photo: 1, yeux_fermes: false, flou_de_bouge: false, tete_coupee: false, vers_appareil: 0, raison: 'Il manque une personne.' },
          { photo: 2, yeux_fermes: false, flou_de_bouge: false, tete_coupee: false, vers_appareil: 2, raison: 'Tout le monde regarde l’appareil.' },
          { photo: 3, yeux_fermes: true, flou_de_bouge: false, tete_coupee: false, vers_appareil: 1, raison: 'Yeux fermés.' },
        ],
      },
      ids,
    );
    expect(a).toMatchObject({ meilleure: 'b.jpg', personnes: 2, equivalentes: false, justification: 'Les deux enfants sont là et sourient.' });
    expect(a!.photos['c.jpg']).toEqual({ yeuxFermes: true, flouDeBouge: false, teteCoupee: false, raison: 'Yeux fermés.' });
  });

  it('ne fait jamais confiance au format (I9, I12) : numéro hors limites, champs absents ou faux', () => {
    expect(lireRafale({ meilleure: 4 }, ids)).toBeNull();
    expect(lireRafale({ meilleure: 0 }, ids)).toBeNull();
    expect(lireRafale('photo 2', ids)).toBeNull();
    expect(lireRafale(null, ids)).toBeNull();
    const a = lireRafale([{ meilleure: '2', photos: [{ photo: 9, raison: 'x' }, 'texte', { photo: 1, raison: 42, yeux_fermes: 'oui' }] }], ids);
    expect(a).toMatchObject({ meilleure: 'b.jpg', personnes: 0, equivalentes: false, justification: '' });
    expect(a!.photos).toEqual({ 'a.jpg': { yeuxFermes: false, flouDeBouge: false, teteCoupee: false, raison: '' } });
  });

  it('trop de monde : l’avis est gardé mais ne choisit rien', () => {
    const a = lireRafale({ meilleure: 1, personnes: 9, justification: 'Grand groupe.' }, ids);
    expect(a).not.toBeNull();
    expect(a!.meilleure).toBeUndefined();
  });

  it('l’avis ne vaut que pour les mêmes photos : une photo partie l’annule en entier', () => {
    const a = lireRafale({ meilleure: 1 }, ids)!;
    expect(signatureRafale(['c.jpg', 'a.jpg', 'b.jpg'])).toBe(signatureRafale(ids));
    expect(avisValable(a, ['b.jpg', 'c.jpg', 'a.jpg'])).toBe(true);
    expect(avisValable(a, ['a.jpg', 'b.jpg'])).toBe(false);
    expect(avisValable(undefined, ids)).toBe(false);
  });
});
