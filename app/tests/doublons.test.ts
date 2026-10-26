import { describe, expect, it } from 'vitest';
import { modele } from '../src/lib/tarifs';
import {
  analyserDossier,
  estimationDoublons,
  consigneVerif,
  consigneVue,
  decisionsVerification,
  extraireJson,
  JsonIrreparable,
  lireScenes,
  memesMots,
  rafales,
  SCENE_LOCALE,
  scenesLocales,
  type OutilsIA,
  type PhotoDoublon,
} from '../src/lib/doublons';

const h = (n: number) => n.toString(16).padStart(16, '0');

describe('rafales (étage local du script 06)', () => {
  it('garde la plus nette d’une rafale (10 min, distance ≤ 12)', () => {
    const photos: PhotoDoublon[] = [
      { id: 'a', date: '2026-07-21T11:00:00', phash: h(0), nettete: 300 },
      { id: 'b', date: '2026-07-21T11:00:05', phash: h(7), nettete: 900 },
      { id: 'c', date: '2026-07-21T11:20:00', phash: h(0), nettete: 500 },
      { id: 'd', date: '2026-07-21T11:01:00', phash: 'ffffffffffffffff', nettete: 100 },
    ];
    expect(rafales(photos)).toEqual([{ garde: 'b', doublons: [{ id: 'a', raison: 'quasi identique, prise à la suite' }], source: 'rafale' }]);
  });

  it('un groupe ne dépend que des photos : une décision ne le change pas (D71, l’état est dans le plan)', () => {
    const photos: PhotoDoublon[] = [
      { id: 'a', date: '2026-07-21T11:00:00', phash: h(0), nettete: 300 },
      { id: 'b', date: '2026-07-21T11:00:05', phash: h(1), nettete: 900 },
    ];
    expect(rafales(photos)).toEqual([{ garde: 'b', doublons: [{ id: 'a', raison: 'quasi identique, prise à la suite' }], source: 'rafale' }]);
  });

  it('repère les scènes locales (distance ≤ 20) parmi les photos non groupées', () => {
    const photos: PhotoDoublon[] = [
      { id: 'a', phash: h(0) },
      { id: 'b', phash: h(0xfffff) },
      { id: 'c', phash: 'ffffffffffffffff' },
      { id: 'd', phash: h(1) },
    ];
    expect(scenesLocales(photos, new Set())).toEqual([['a', 'b', 'd']]);
    expect(scenesLocales(photos, new Set(['a']))).toEqual([['b', 'd']]);
  });
});

describe('réparation du JSON (incident I12)', () => {
  it('extrait le JSON entouré de texte ou de balises', () => {
    expect(extraireJson('Voici :\n```json\n{"scenes": []}\n```')).toEqual({ scenes: [] });
  });

  it('répare guillemets typographiques, virgules en trop et guillemets internes', () => {
    expect(extraireJson('{“scenes”: [{"numeros": [1, 2],}],}')).toEqual({ scenes: [{ numeros: [1, 2] }] });
    expect(extraireJson('{"groupes": [{"garder": 1, "raison": "la photo "nette" est gardée"}]}')).toEqual({ groupes: [{ garder: 1, raison: "la photo 'nette' est gardée" }] });
  });

  it('ferme une réponse tronquée', () => {
    expect(extraireJson('{"scenes": [{"numeros": [1, 2], "scene": "plage"}')).toEqual({ scenes: [{ numeros: [1, 2], scene: 'plage' }] });
  });

  it('récupère les numéros en dernier recours', () => {
    expect(extraireJson('{"scenes": [{"numeros": [3, 4], "scene": "pont "dans" l’eau sans fin')).toEqual({ scenes: [{ numeros: [3, 4], scene: '' }] });
    expect(() => extraireJson('rien d’utile')).toThrow(JsonIrreparable);
  });

  it('valide la structure : liste au lieu d’objet, null, numéros hors plage', () => {
    expect(lireScenes([{ numeros: [1, 2] }], 5)).toEqual([]);
    expect(lireScenes({ scenes: [{ numeros: [1, 1, 9] }, null, { numeros: ['2', 3.7], scene: 'quai' }] }, 5)).toEqual([{ numeros: [2, 3], scene: 'quai' }]);
  });
});

describe('garde-fous de la vérification (I7, I9)', () => {
  it('compare les descriptions (cas de référence I7)', () => {
    expect(memesMots('pose du pont dans l’eau', 'assise sur le rocher')).toBe(false);
    expect(memesMots('même archipel avec branches', 'vue dégagée de l’archipel')).toBe(true);
    expect(memesMots('', 'assise sur le rocher')).toBe(true);
  });

  it('refuse un doublon d’une autre scène et ne traite un numéro qu’une fois', () => {
    const reponse = {
      groupes: [
        { garder: 4, garder_description: 'pose du pont dans l\u2019eau', doublons: [{ numero: 1, description: 'pose du pont, un peu floue' }, { numero: 5, description: 'assise sur le rocher' }], raison: 'même scène' },
        { garder: 6, garder_description: 'assise sur le rocher', doublons: [{ numero: 1, description: 'rocher' }, { numero: 4, description: 'rocher' }, { numero: 9 }], raison: 'x' },
      ],
    };
    const d = decisionsVerification(reponse, 6);
    expect(d[0].doublons).toEqual([{ numero: 1, description: 'pose du pont, un peu floue' }]);
    expect(d[0].refus.map((r) => r.numero)).toEqual([5]);
    expect(d[1].doublons).toEqual([]);
    expect(decisionsVerification([{ garder: 1 }], 6)).toEqual([]);
  });
});

describe('consignes reprises mot pour mot du script 06', () => {
  it('remplit la consigne de vérification', () => {
    const c = consigneVerif(4, 'plage au coucher', false);
    expect(c).toContain('Voici 4 photos d’un même dossier'.replace('’', "'"));
    expect(c).toContain('numérotées de 1 à 4');
    expect(c).toContain('« plage au coucher »');
    expect(c).toContain('chaque expression compte');
    expect(consigneVerif(2, '', true)).toContain('(mode agressif)');
    expect(consigneVue).toContain('REPÉRER LES SCÈNES QUI SE RÉPÈTENT');
    expect(consigneVue).toContain('{"scenes": [{"numeros"');
  });
});

describe('analyse d’un dossier (orchestration, IA simulée)', () => {
  // Le cas pont / rocher (I7) : 4 photos du pont, 2 du rocher, plus une rafale.
  const photos: PhotoDoublon[] = [
    { id: 'pont1', date: '2026-07-24T12:10:56', phash: h(0x1), nettete: 400 },
    { id: 'pont1bis', date: '2026-07-24T12:10:57', phash: h(0x3), nettete: 200 },
    { id: 'pont2', date: '2026-07-24T12:11:01', phash: 'f0f0f0f0f0f0f0f0', nettete: 500 },
    { id: 'pont3', date: '2026-07-24T12:15:11', phash: '0f0f0f0f0f0f0f0f', nettete: 600 },
    { id: 'pont4', date: '2026-07-24T12:15:12', phash: 'ff00ff00ff00ff00', nettete: 900 },
    { id: 'rocher1', date: '2026-07-24T12:18:40', phash: '00ff00ff00ff00ff', nettete: 700 },
    { id: 'rocher2', date: '2026-07-24T12:18:53', phash: 'aaaaaaaaaaaaaaaa', nettete: 800 },
  ];
  const appels: { consigne: string; cle: string; planches: number }[] = [];
  const ia: OutilsIA = {
    planche: async (ids) => `planche:${ids.join(',')}`,
    identite: (id) => `#${id}`,
    appeler: async (_type, planches, consigne, cle) => {
      appels.push({ consigne, cle, planches: planches.length });
      if (cle.startsWith('vue:')) return { scenes: [{ numeros: [1, 2, 3, 4, 5, 6], scene: 'fille sur la plage' }] };
      // Le modèle mélange les deux scènes : le garde-fou doit sauver le rocher.
      return {
        groupes: [
          {
            garder: 4,
            garder_description: 'pose du pont dans l\u2019eau, nette',
            doublons: [
              { numero: 1, description: 'pose du pont, bras levés' },
              { numero: 2, description: 'pont dans l\'eau vu de loin' },
              { numero: 3, description: 'pose du pont, floue' },
              { numero: 5, description: 'assise sur le rocher' },
            ],
            raison: 'même scène',
          },
        ],
      };
    },
  };

  it('rafale locale, vue d’ensemble, vérification et garde-fou', async () => {
    const r = await analyserDossier(photos, ia, false);
    const rafale = r.propositions.find((p) => p.source === 'rafale')!;
    expect(rafale).toMatchObject({ garde: 'pont1', doublons: [{ id: 'pont1bis' }] });
    const verif = r.propositions.find((p) => p.source === 'ia')!;
    expect(verif.garde).toBe('pont4');
    expect(verif.doublons.map((d) => d.id)).toEqual(['pont1', 'pont2', 'pont3']);
    expect(verif.refus!.map((x) => x.id)).toEqual(['rocher1']);
    // Une seule vue d'ensemble, puis une vérification de 6 photos (le maximum).
    expect(appels.map((a) => a.cle.split(':')[0])).toEqual(['vue', 'verif']);
    expect(appels[1].cle).toBe('verif:#pont1|#pont2|#pont3|#pont4|#rocher1|#rocher2');
    expect(appels[1].consigne).toContain('numérotées de 1 à 6');
    expect(r.scenes).toContainEqual(['pont1', 'pont2', 'pont3', 'pont4', 'rocher1', 'rocher2']);
  });

  it('sans IA : rafales et scènes locales seulement', async () => {
    const r = await analyserDossier(photos, null, false);
    expect(r.propositions.map((p) => p.source)).toEqual(['rafale']);
  });

  it('scène repérée localement : nommée pour la consigne, la proposition garde ce nom (la page en affiche une légende traduite)', async () => {
    const consignes: string[] = [];
    const r = await analyserDossier(
      [
        { id: 'a', date: '2026-07-24T10:00:00', phash: h(0), nettete: 500 },
        { id: 'b', date: '2026-07-24T11:00:00', phash: h(0xffff), nettete: 400 },
      ],
      {
        ...ia,
        appeler: async (_t, _p, consigne, cle) => {
          if (cle.startsWith('vue:')) return { scenes: [] };
          consignes.push(consigne);
          return { groupes: [{ garder: 1, garder_description: 'lac au soleil', doublons: [{ numero: 2, description: 'lac au soleil, flou' }], raison: 'même vue' }] };
        },
      },
      false,
    );
    expect(consignes[0]).toContain(SCENE_LOCALE);
    expect(r.propositions).toMatchObject([{ source: 'ia', scene: SCENE_LOCALE, garde: 'a', doublons: [{ id: 'b' }] }]);
  });

  it('vue d’ensemble illisible : on continue avec les scènes locales', async () => {
    const r = await analyserDossier(photos, { ...ia, appeler: async (_t, _p, _c, cle) => (cle.startsWith('vue:') ? null : { groupes: [] }) }, false);
    expect(r.vueIndisponible).toBe(true);
  });
});

describe('coût estimé', () => {
  it('estime un coût raisonnable (Thaïlande : 1600 photos en 40 dossiers)', () => {
    const e = estimationDoublons(Array(40).fill(40), modele('claude-sonnet-5-5')!);
    expect(e.appels).toBe(40 + 40 * 4);
    expect(e.usd).toBeGreaterThan(1);
    expect(e.usd).toBeLessThan(8);
    expect(estimationDoublons([1, 0], modele('claude-sonnet-5-5')!).appels).toBe(0);
  });
});
