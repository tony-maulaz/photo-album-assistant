// Inventaire (SPEC § 6.2) : appareils et leur décalage d'horloge. Les copies
// exactes sont passées à l'étape « Doublons », les captures d'écran au « Tri
// automatique » (D61). Enregistrer un appareil ou son décalage demande le
// dossier de configuration : sans lui, les boutons laissent place à une
// explication et au moyen de le choisir ou de le créer sur place.

import { useState } from 'preact/hooks';
import { appareilsDetectes, mesurerDecalage, type MesureDecalage } from '../../lib/appareils';
import { t } from '../../lib/langue';
import { appliquerDecalages } from '../../lib/inventaire';
import { appliquer, configuration, notifier, session, texteErreur, versionPlan } from '../etat';
import { jourCourt, nombre } from '../format';
import { ChoixConfiguration } from './ChoixConfiguration';

function Appareils() {
  const s = session.value!;
  versionPlan.value;
  const config = configuration.value;
  const appareilsConfig = config?.lecture?.config?.appareils ?? [];
  const [mesure, setMesure] = useState<{ a: string; b: string; r: MesureDecalage | null } | null>(null);
  const [choixConfig, setChoixConfig] = useState(false);
  const avecConfig = !!config?.lecture?.config;
  const photos = [...s.plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.statut !== 'mis_de_cote');
  const liste = appareilsDetectes(photos);
  if (liste.length === 0) return null;
  const configure = (m: string) => appareilsConfig.find((a) => a.modele.trim().toLowerCase() === m.trim().toLowerCase());
  const aCorriger = appareilsConfig.some((a) => a.decalage !== '+00:00' && liste.some((l) => l.modele === a.modele)) || photos.some((f) => f.decalage);

  const enregistrer = async (modele: string, decalage = '+00:00') => {
    const c = configuration.value;
    if (!c?.lecture?.config) {
      setChoixConfig(true);
      return;
    }
    try {
      const cfg = structuredClone(c.lecture.config);
      const existant = cfg.appareils.find((a) => a.modele === modele);
      if (existant) existant.decalage = decalage;
      else cfg.appareils.push({ modele, decalage, surnom: '' });
      configuration.value = { dossier: c.dossier, lecture: await c.dossier.ecrire(cfg, c.lecture) };
      notifier('ok', decalage !== '+00:00' ? t`Appareil « ${modele} » enregistré dans la configuration avec le décalage ${decalage}.` : t`Appareil « ${modele} » enregistré dans la configuration.`);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const mesurer = (a: string, b: string) => {
    const horloge = (m: string) => photos.filter((f) => f.appareil === m).map((f) => ({ id: f.id, date: f.date, phash: s.analyses.get(f)?.phash }));
    setMesure({ a, b, r: mesurerDecalage(horloge(a), horloge(b), { fenetreHeures: 24 }) });
  };

  return (
    <section>
      <h2>{t`Appareils`}</h2>
      <table class="tableau">
        <thead>
          <tr>
            <th>{t`Modèle`}</th>
            <th class="n">{t`Photos`}</th>
            <th>{t`Période`}</th>
            <th>{t`Décalage d’horloge`}</th>
            {avecConfig && <th />}
          </tr>
        </thead>
        <tbody>
          {liste.map((a) => {
            const c = configure(a.modele);
            return (
              <tr key={a.modele}>
                <td>
                  {a.modele}
                  {c?.surnom ? ` (${c.surnom})` : ''}
                </td>
                <td class="n">{nombre(a.n)}</td>
                <td>
                  {jourCourt(a.du)} – {jourCourt(a.au)}
                </td>
                <td>{c ? c.decalage : <span class="discret">{t`non enregistré`}</span>}</td>
                {avecConfig && (
                  <td>
                    {!c && (
                      <button type="button" class="lien" onClick={() => void enregistrer(a.modele)}>
                        {t`Enregistrer`}
                      </button>
                    )}
                    {liste.length > 1 && (
                      <button type="button" class="lien" onClick={() => mesurer(liste.find((x) => x.modele !== a.modele)!.modele, a.modele)} title={t`Compare les photos d’une même scène prises par deux appareils`}>
                        {t`Mesurer le décalage`}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!avecConfig &&
        (choixConfig ? (
          <ChoixConfiguration
            pourquoi={t`Les appareils et le décalage de leur horloge sont gardés dans un dossier de configuration.`}
            apres={() => setChoixConfig(false)}
            annuler={() => setChoixConfig(false)}
          />
        ) : (
          <p class="discret">
            {t`Facultatif : pour enregistrer un appareil ou mesurer le décalage de son horloge (deux appareils qui n’étaient pas à la même heure), il faut un dossier de configuration.`}{' '}
            <button type="button" class="lien" onClick={() => setChoixConfig(true)}>
              {t`Choisir ou créer le dossier de configuration`}
            </button>
          </p>
        ))}
      {mesure && (
        <p class="encart">
          {mesure.r ? (
            <>
              {t`« ${mesure.b} » a ${mesure.r.paires} photo(s) de la même scène que « ${mesure.a} » : son horloge est décalée de`} <strong>{mesure.r.decalage}</strong>.{' '}
              {mesure.r.minutes !== 0 && (
                <button type="button" onClick={() => void enregistrer(mesure.b, mesure.r!.decalage)}>
                  {t`Enregistrer ce décalage`}
                </button>
              )}
            </>
          ) : (
            <>{t`Pas assez de photos de la même scène prises par les deux appareils pour mesurer un décalage.`}</>
          )}
        </p>
      )}
      {aCorriger && (
        <p>
          <button type="button" onClick={() => appliquer(appliquerDecalages(s.plan, appareilsConfig))}>
            {t`Corriger l’heure des photos selon les décalages enregistrés`}
          </button>
        </p>
      )}
    </section>
  );
}

export function ExtrasInventaire() {
  return <Appareils />;
}
