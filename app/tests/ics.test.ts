import { describe, expect, it } from 'vitest';
import { blocCalendrier, evenementDesPhotos, evenementPrincipal, evenementsAutour, evenementsDesPhotos, lireIcs, partPendant, resumeCalendrier, type EvenementCalendrier } from '../src/lib/ics';
import { nomDepuisEvenement, normaliserNom } from '../src/lib/nommage';

/** Calendrier de test (aucune donnée personnelle), avec fins de ligne CRLF comme les exports. */
function ics(...evenements: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Essai//FR', ...evenements.flatMap((e) => ['BEGIN:VEVENT', ...e.trim().split('\n').map((l) => l.trim()), 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
}

describe('lecture des .ics', () => {
  it('journées entières (DTEND exclusif), lieu et description déséchappés, lignes pliées', () => {
    const texte = ics(
      `UID:1
       DTSTART;VALUE=DATE:20260714
       DTEND;VALUE=DATE:20260718
       SUMMARY:Camp d'été\\, Kanchanaburi
       LOCATION:Kanchanaburi\\, Thaïlande
       DESCRIPTION:Ligne 1\\nLigne 2`,
      `UID:2
       DTSTART;VALUE=DATE:20260720
       DTEND;VALUE=DATE:20260721
       SUMMARY:Anniversaire`,
    ).replace("Camp d'été\\, Kanchanaburi", "Camp d'été\\, Kan\r\n chanaburi");
    expect(lireIcs(texte, { inclureRecurrents: false })).toEqual([
      { titre: "Camp d'été, Kanchanaburi", lieu: 'Kanchanaburi, Thaïlande', description: 'Ligne 1\nLigne 2', debut: '2026-07-14', fin: '2026-07-17', journee: true, recurrent: false },
      { titre: 'Anniversaire', debut: '2026-07-20', fin: '2026-07-20', journee: true, recurrent: false },
    ]);
  });

  it('heures : locale, TZID gardée telle quelle, UTC convertie en heure de Zurich', () => {
    const e = lireIcs(
      ics(
        `UID:a
         DTSTART:20260715T090000
         DTEND:20260715T110000
         SUMMARY:Flottant`,
        `UID:b
         DTSTART;TZID=Asia/Bangkok:20260716T094300
         DURATION:PT1H30M
         SUMMARY:Éléphants`,
        `UID:c
         DTSTART:20260115T120000Z
         DTEND:20260715T120000Z
         SUMMARY:Hiver puis été`,
      ),
      { inclureRecurrents: false },
    );
    expect(e.map((x) => [x.titre, x.debut, x.fin, x.journee])).toEqual([
      ['Hiver puis été', '2026-01-15T13:00:00', '2026-07-15T14:00:00', false],
      ['Flottant', '2026-07-15T09:00:00', '2026-07-15T11:00:00', false],
      ['Éléphants', '2026-07-16T09:43:00', '2026-07-16T11:13:00', false],
    ]);
  });

  it('ignore les événements annulés, sans titre ou sans date, et les alarmes imbriquées', () => {
    const e = lireIcs(
      ics(
        `UID:1
         DTSTART;VALUE=DATE:20260701
         SUMMARY:Gardé
         BEGIN:VALARM
         DESCRIPTION:Rappel
         TRIGGER:-PT15M
         END:VALARM`,
        `UID:2
         DTSTART;VALUE=DATE:20260702
         STATUS:CANCELLED
         SUMMARY:Annulé`,
        `UID:3
         DTSTART;VALUE=DATE:20260703`,
        `UID:4
         SUMMARY:Sans date`,
      ),
      { inclureRecurrents: false },
    );
    expect(e.map((x) => [x.titre, x.description])).toEqual([['Gardé', undefined]]);
  });

  it('récurrences ignorées par défaut (comme les scripts), développées sur demande dans la période', () => {
    const texte = ics(
      `UID:anniv
       DTSTART;VALUE=DATE:20100305
       RRULE:FREQ=YEARLY
       SUMMARY:Anniversaire de Léa`,
      `UID:cours
       DTSTART;TZID=Europe/Zurich:20260105T180000
       DTEND;TZID=Europe/Zurich:20260105T193000
       RRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=5
       EXDATE;TZID=Europe/Zurich:20260108T180000
       SUMMARY:Cours de piano`,
      `UID:fete
       DTSTART;VALUE=DATE:20240512
       RRULE:FREQ=YEARLY;BYMONTH=5;BYDAY=2SU
       SUMMARY:Fête des mères`,
      `UID:mois
       DTSTART;VALUE=DATE:20260131
       RRULE:FREQ=MONTHLY;UNTIL=20260531
       SUMMARY:Fin de mois`,
    );
    expect(lireIcs(texte, { inclureRecurrents: false })).toEqual([]);
    const e = lireIcs(texte, { inclureRecurrents: true, du: '2026-01-01', au: '2026-06-30' });
    const de = (t: string) => e.filter((x) => x.titre === t).map((x) => x.debut);
    expect(de('Anniversaire de Léa')).toEqual(['2026-03-05']);
    // 5 occurrences comptées depuis DTSTART, celle du jeudi 8 exclue.
    expect(de('Cours de piano')).toEqual(['2026-01-05T18:00:00', '2026-01-12T18:00:00', '2026-01-15T18:00:00', '2026-01-19T18:00:00']);
    expect(e.find((x) => x.titre === 'Cours de piano')!.fin).toBe('2026-01-05T19:30:00');
    expect(de('Fête des mères')).toEqual(['2026-05-10']);
    // Le 31 n'existe pas en février ni en avril : ces mois sont sautés.
    expect(de('Fin de mois')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    expect(e.every((x) => x.recurrent)).toBe(true);
  });

  it('une occurrence modifiée (RECURRENCE-ID) remplace celle de la règle', () => {
    const e = lireIcs(
      ics(
        `UID:x
         DTSTART;VALUE=DATE:20260601
         RRULE:FREQ=DAILY;COUNT=3
         SUMMARY:Stage`,
        `UID:x
         RECURRENCE-ID;VALUE=DATE:20260602
         DTSTART;VALUE=DATE:20260605
         SUMMARY:Stage (déplacé)`,
      ),
      { inclureRecurrents: true },
    );
    expect(e.map((x) => [x.debut, x.titre])).toEqual([
      ['2026-06-01', 'Stage'],
      ['2026-06-03', 'Stage'],
      ['2026-06-05', 'Stage (déplacé)'],
    ]);
  });

  it('résume un calendrier', () => {
    const e = lireIcs(ics(`UID:1\nDTSTART;VALUE=DATE:20260714\nDTEND;VALUE=DATE:20260718\nSUMMARY:A`, `UID:2\nDTSTART:20260102T100000\nSUMMARY:B`), { inclureRecurrents: false });
    expect(resumeCalendrier(e)).toEqual({ nombre: 2, du: '2026-01-02', au: '2026-07-17' });
    expect(resumeCalendrier([])).toEqual({ nombre: 0 });
  });
});

describe('événements autour des dates et texte des consignes (scripts 03 et 04)', () => {
  const ev = (titre: string, debut: string, fin: string, lieu?: string): EvenementCalendrier => ({ titre, debut, fin, journee: debut.length === 10, recurrent: false, ...(lieu ? { lieu } : {}) });
  const evts = [
    ev('Vacances Thaïlande', '2026-07-10', '2026-07-28'),
    ev('Kanchanaburi', '2026-07-14', '2026-07-17', 'Kanchanaburi, Thaïlande'),
    ev('Pont de la rivière Kwaï', '2026-07-15T08:00:00', '2026-07-15T12:00:00'),
    ev('Trop tôt', '2026-07-01', '2026-07-12'),
    ev('Juste avant', '2026-07-13', '2026-07-13'),
    ev('Soirée', '2026-07-12T20:00:00', '2026-07-13T00:00:00'),
  ];

  it('chevauchement avec une marge d’un jour', () => {
    expect(evenementsAutour(evts, '2026-07-15', '2026-07-15').map((e) => e.titre)).toEqual(['Vacances Thaïlande', 'Kanchanaburi', 'Pont de la rivière Kwaï']);
    expect(evenementsAutour(evts, '2026-07-14', '2026-07-16').map((e) => e.titre)).toEqual(['Vacances Thaïlande', 'Kanchanaburi', 'Pont de la rivière Kwaï', 'Juste avant']);
    // La soirée finit à minuit pile : elle ne compte pas pour le 13.
    expect(evenementsAutour(evts, '2026-07-14', '2026-07-14', 1).map((e) => e.titre)).not.toContain('Soirée');
    expect(evenementsAutour(evts, '2026-07-14', '2026-07-14', 2).map((e) => e.titre)).toContain('Soirée');
  });

  it('bloc mot pour mot : les plus courts d’abord, 12 au plus', () => {
    expect(blocCalendrier([])).toBe('');
    expect(blocCalendrier(evenementsAutour(evts, '2026-07-15', '2026-07-15'))).toBe(
      '\n\nÉvénements du calendrier familial autour de ces dates (source fiable, à privilégier si cohérente avec les photos) :\n' +
        '- 15.07 : Pont de la rivière Kwaï\n' +
        '- 14.07-17.07 : Kanchanaburi @ Kanchanaburi, Thaïlande\n' +
        '- 10.07-28.07 : Vacances Thaïlande',
    );
    const beaucoup = Array.from({ length: 20 }, (_, i) => ev(`E${i}`, '2026-07-15', '2026-07-15'));
    expect(blocCalendrier(beaucoup).split('\n').filter((l) => l.startsWith('- '))).toHaveLength(12);
  });
});

describe('noms tirés du calendrier (D83)', () => {
  const ev = (titre: string, debut: string, fin: string, journee = true): EvenementCalendrier => ({ titre, debut, fin, journee, recurrent: false });
  const vacances = ev('Vacances d’hiver', '2026-01-24', '2026-02-01');
  const anniversaire = ev('18 ans de Lea', '2026-01-26', '2026-01-26');
  const match = ev('Match de foot', '2026-01-27T14:00:00', '2026-01-27T16:00:00', false);

  it('le plus court des événements qui couvrent les photos : son titre est le plus parlant', () => {
    const r = evenementDesPhotos([vacances, anniversaire, match], ['2026-01-26T15:00:00', '2026-01-26T18:30:00']);
    expect(r).toMatchObject({ evenement: { titre: '18 ans de Lea' }, part: 1 });
    expect(normaliserNom(nomDepuisEvenement(r!.evenement.titre, '2026-01-26', '2026-01-26'))).toBe('18_ans_de_Lea_26.01.26');
  });

  it('un événement à l’heure compte une heure de marge ; la moitié des photos au moins', () => {
    expect(partPendant(match, ['2026-01-27T13:20:00', '2026-01-27T16:45:00', '2026-01-27T19:00:00'])).toBeCloseTo(2 / 3);
    expect(evenementDesPhotos([match], ['2026-01-27T19:00:00', '2026-01-27T20:00:00', '2026-01-27T15:00:00'])).toBeNull();
    // Plusieurs jours : les jours du dossier, pas ceux de l'événement.
    const r = evenementDesPhotos([vacances, anniversaire], ['2026-01-25T10:00:00', '2026-01-26T10:00:00', '2026-01-28T10:00:00']);
    expect(r?.evenement.titre).toBe('Vacances d’hiver');
    expect(normaliserNom(nomDepuisEvenement(r!.evenement.titre, '2026-01-25', '2026-01-28'))).toBe('Vacances_d_hiver_25-28.01.26');
  });
});

describe('événements montrés avec les photos (D94)', () => {
  const ev = (titre: string, debut: string, fin: string, journee = true): EvenementCalendrier => ({ titre, debut, fin, journee, recurrent: false });
  const souper = ev('Souper chez Mamie', '2025-03-22T19:00:00', '2025-03-22T22:00:00', false);
  const noel = ev('Noël', '2025-12-24', '2025-12-26');
  const ete = ev('Vacances d’été', '2025-07-01', '2025-08-20');
  const dentiste = ev('Dentiste', '2025-12-24T09:00:00', '2025-12-24T09:30:00', false);

  it('jamais la veille ni le lendemain : seulement les photos prises pendant', () => {
    expect(evenementsDesPhotos([souper], ['2025-03-21T15:38:00'])).toEqual([]);
    expect(evenementsDesPhotos([souper], ['2025-03-22T10:00:00'])).toEqual([]);
    expect(evenementsDesPhotos([souper], ['2025-03-22T18:10:00', '2025-03-22T22:45:00'])).toEqual([{ evenement: souper, n: 2 }]);
  });

  it('le plus de photos d’abord ; les longues périodes et les titres en double sont laissés', () => {
    const dates = ['2025-12-24T09:10:00', '2025-12-24T18:00:00', '2025-12-25T11:00:00'];
    const r = evenementsDesPhotos([ete, dentiste, noel, { ...noel, debut: '2025-12-25', fin: '2025-12-25' }], dates);
    expect(r.map((x) => [x.evenement.titre, x.n])).toEqual([
      ['Noël', 3],
      ['Dentiste', 1],
    ]);
    expect(evenementsDesPhotos([ete], ['2025-07-14T12:00:00'])).toEqual([]);
  });

  it('l’événement d’un dossier couvre au moins la moitié de ses photos', () => {
    expect(evenementPrincipal([dentiste, noel], ['2025-12-24T09:10:00', '2025-12-25T10:00:00'])?.titre).toBe('Noël');
    expect(evenementPrincipal([dentiste], ['2025-12-24T09:10:00', '2025-12-24T18:00:00', '2025-12-24T19:00:00'])).toBeNull();
    expect(evenementPrincipal([noel], [])).toBeNull();
  });
});

describe('événements des photos sur un grand calendrier (D105)', () => {
  // L'ancienne recherche, qui parcourait tout le calendrier : la nouvelle doit donner exactement la même chose.
  const jourTexte = (j: number) => new Date(Date.UTC(2025, 0, 1) + j * 86_400_000).toISOString().slice(0, 10);
  const prise = (e: EvenementCalendrier, d: string) => partPendant(e, [d]) > 0;
  const duree = (e: EvenementCalendrier) =>
    e.journee ? (Date.parse(e.fin.slice(0, 10)) - Date.parse(e.debut.slice(0, 10))) / 1000 + 86_400 : (Date.parse(`${e.fin}Z`) - Date.parse(`${e.debut}Z`)) / 1000;
  function ancienne(evts: EvenementCalendrier[], dates: string[]) {
    const triees = [...dates].sort();
    const vus = new Set<string>();
    const jours = (e: EvenementCalendrier) => {
      const d1 = e.debut.slice(0, 10);
      let d2 = e.fin.slice(0, 10);
      if (!e.journee && e.fin.slice(11) === '00:00:00' && d2 > d1) d2 = new Date(Date.parse(`${d2}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
      return [d1, d2 < d1 ? d1 : d2];
    };
    return evts
      .filter((e) => duree(e) <= 21 * 86_400 && jours(e)[0] <= triees.at(-1)!.slice(0, 10) && jours(e)[1] >= triees[0].slice(0, 10))
      .map((evenement) => ({ evenement, n: dates.filter((d) => prise(evenement, d)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n || duree(a.evenement) - duree(b.evenement) || a.evenement.debut.localeCompare(b.evenement.debut))
      .filter((x) => {
        const cle = x.evenement.titre.trim().toLowerCase();
        if (vus.has(cle)) return false;
        vus.add(cle);
        return true;
      });
  }

  it('même résultat que la recherche dans tout le calendrier, bien plus vite', () => {
    let graine = 11;
    const hasard = (n: number) => Math.floor(((graine = (graine * 16807) % 2147483647) / 2147483647) * n);
    const evts: EvenementCalendrier[] = Array.from({ length: 2500 }, (_, i) => {
      const j = hasard(400);
      const journee = hasard(3) === 0;
      const longueur = hasard(10) === 0 ? 10 + hasard(40) : hasard(3);
      const h = 6 + hasard(14);
      return journee
        ? { titre: `Événement ${i % 300}`, debut: jourTexte(j), fin: jourTexte(j + longueur), journee: true, recurrent: false }
        : { titre: `Événement ${i % 300}`, debut: `${jourTexte(j)}T${String(h).padStart(2, '0')}:00:00`, fin: `${jourTexte(j + (longueur > 2 ? longueur : 0))}T${String(Math.min(23, h + 2)).padStart(2, '0')}:00:00`, journee: false, recurrent: false };
    });
    const dossiers = Array.from({ length: 150 }, () => {
      const j = hasard(380);
      return Array.from({ length: 1 + hasard(30) }, () => `${jourTexte(j + hasard(4))}T${String(8 + hasard(12)).padStart(2, '0')}:00:00`);
    });
    for (const dates of dossiers) expect(evenementsDesPhotos(evts, dates)).toEqual(ancienne(evts, dates));
    const debut = performance.now();
    for (let k = 0; k < 5; k++) for (const dates of dossiers) evenementsDesPhotos(evts, dates);
    expect((performance.now() - debut) / 5).toBeLessThan(60);
  });
});
