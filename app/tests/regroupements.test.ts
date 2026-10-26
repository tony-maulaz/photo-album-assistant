import { describe, expect, it } from 'vitest';
import type { EvenementCalendrier } from '../src/lib/ics';
import { cheminDossier, contenu, Historique, planVide, RACINE, type FichierPlan, type Plan } from '../src/lib/plan';
import { regrouperDossiers, regroupementsProposes } from '../src/lib/regroupements';

function plan(): Plan {
  const p = planVide();
  const dossier = (id: string, nom: string, extra = {}) => p.dossiers.set(id, { id, nom, parent: RACINE, origine: 'tri', ...extra });
  dossier('loc', 'Locarno_06.07.25');
  dossier('lug', 'Lugano_07.07.25');
  dossier('ves', 'Vevey_26.01.26');
  dossier('mon', 'Montreux_26.01.26');
  dossier('best', 'Best_of', { origine: 'source', traitement: 'nettoyer' });
  const photo = (id: string, dossier: string, date: string): FichierPlan => ({ id, nom: `${id}.jpg`, taille: 1, modifie: 0, categorie: 'photo', date, origineDate: 'exif', dossier, statut: 'archive' });
  for (const f of [
    photo('a', 'loc', '2025-07-06T10:00:00'),
    photo('b', 'loc', '2025-07-06T11:00:00'),
    photo('c', 'lug', '2025-07-07T10:00:00'),
    photo('d', 'ves', '2026-01-26T15:00:00'),
    photo('e', 'mon', '2026-01-26T19:00:00'),
    photo('f', 'best', '2025-07-06T12:00:00'),
  ])
    p.fichiers.set(f.id, f);
  return p;
}

const ev = (titre: string, debut: string, fin: string): EvenementCalendrier => ({ titre, debut, fin, journee: true, recurrent: false });
const vacances = ev('Vacances Tessin', '2025-07-05', '2025-07-12');
const anniversaire = ev('18 ans de Lea', '2026-01-26', '2026-01-26');

describe('dossiers d’un même événement du calendrier (D83)', () => {
  it('propose de réunir les dossiers pris pendant un événement, jamais un dossier qui garde sa place', () => {
    const r = regroupementsProposes(plan(), [vacances, anniversaire]);
    expect(r.map((x) => [x.titre, x.dossiers, x.nom, x.sousDossiers])).toEqual([
      ['18 ans de Lea', ['ves', 'mon'], '18 ans de Lea 26.01.26', false],
      ['Vacances Tessin', ['loc', 'lug'], 'Vacances Tessin 06-07.07.25', true],
    ]);
    expect(regroupementsProposes(plan(), [vacances, anniversaire], new Set(['18 ans de Lea|2026-01-26|2026-01-26']))).toHaveLength(1);
  });

  it('plusieurs jours : les dossiers deviennent des sous-dossiers ; un jour : ils sont fusionnés ; Ctrl+Z annule', () => {
    const p = plan();
    const h = new Historique();
    const [anniversaireLea, tessin] = regroupementsProposes(p, [vacances, anniversaire]);
    h.enregistrer(regrouperDossiers(p, tessin));
    expect(cheminDossier(p, 'loc')).toBe('Vacances_Tessin_06-07.07.25/Locarno_06.07.25');
    expect([...p.dossiers.values()].find((d) => d.nom === 'Vacances_Tessin_06-07.07.25')?.nomSaisi).toBe('Vacances Tessin 06-07.07.25');
    h.enregistrer(regrouperDossiers(p, anniversaireLea));
    const fusion = [...p.dossiers.values()].find((d) => d.nom === '18_ans_de_Lea_26.01.26')!;
    expect(contenu(p, fusion.id).map((f) => f.id).sort()).toEqual(['d', 'e']);
    expect(p.dossiers.has('ves')).toBe(false);
    // Une fois réunis, plus rien n'est proposé.
    expect(regroupementsProposes(p, [vacances, anniversaire])).toEqual([]);
    h.annuler(p);
    h.annuler(p);
    expect(cheminDossier(p, 'loc')).toBe('Locarno_06.07.25');
    expect(p.dossiers.has('ves')).toBe(true);
  });

  it('ni période de plus de 21 jours, ni événement récurrent (D88)', () => {
    const ete = ev('Vacances d’ete', '2025-06-30', '2025-08-19');
    const cours = { ...ev('Cours de piano', '2026-01-26', '2026-01-26'), recurrent: true };
    expect(regroupementsProposes(plan(), [ete, cours])).toEqual([]);
  });
});
