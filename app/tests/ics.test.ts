import { describe, expect, it } from 'vitest';
import { blocCalendrier, evenementsAutour, lireIcs, resumeCalendrier, type EvenementCalendrier } from '../src/lib/ics';

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
