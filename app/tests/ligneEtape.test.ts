// Le message passager de la ligne de l'étape (forme E, D112) : ce qui s'est passé, en gras, puis la suite.

import { describe, expect, it } from 'vitest';
import { decouperMessage } from '../src/ui/format';

describe('decouperMessage', () => {
  it('coupe au premier deux-points, le signe restant dans la suite', () => {
    expect(decouperMessage('12 photos écartées : dans « Mis de côté », rien n’est supprimé.')).toEqual(['12 photos écartées', ' : dans « Mis de côté », rien n’est supprimé.']);
    expect(decouperMessage('12 photos set aside: in “Set aside”.')).toEqual(['12 photos set aside', ': in “Set aside”.']);
    expect(decouperMessage('Annulé : écarter 3 photos')).toEqual(['Annulé', ' : écarter 3 photos']);
  });

  it('garde le point de la première phrase dans la partie en gras', () => {
    expect(decouperMessage('Rafale de 13:40 acceptée. La suivante est ouverte.')).toEqual(['Rafale de 13:40 acceptée.', ' La suivante est ouverte.']);
  });

  it('sans coupure, tout le message est en gras', () => {
    expect(decouperMessage('Renommé « Annecy ».')).toEqual(['Renommé « Annecy ».', '']);
    expect(decouperMessage('Gardé seul.')).toEqual(['Gardé seul.', '']);
  });
});
