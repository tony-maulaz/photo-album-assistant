// Choisir ou créer le dossier de configuration sans quitter l'étape en cours
// (lieu connu à enregistrer au tri automatique, appareil à l'inventaire) : même
// mécanisme que la page Configuration, puis l'action demandée se poursuit.

import { useState } from 'preact/hooks';
import { RaisonDesactivee } from './Cadre';
import { t } from '../../lib/langue';
import { configuration, notifier, texteErreur } from '../etat';
import { chargerConfiguration, choisirDossierConfig, configVide, creerDossierConfig } from '../projets';
import { confirmer } from './Dialogues';

/** La configuration est-elle prête à être modifiée ? Propose de créer config.json dans un dossier qui n'en a pas. */
async function configPrete(): Promise<boolean> {
  const c = configuration.value;
  if (!c) return false;
  if (c.lecture?.config) return true;
  const nom = c.dossier.dossier.name;
  if (c.lecture) {
    notifier('erreur', t`Le config.json de « ${nom} » est illisible : la page Configuration permet de restaurer une sauvegarde.`);
    return false;
  }
  if (!(await confirmer(t`Créer config.json ?`, t`« ${nom} » ne contient pas encore de config.json. Le créer pour y enregistrer vos lieux et vos appareils ?`, t`Créer config.json`))) return false;
  await c.dossier.ecrire(configVide(), null);
  await chargerConfiguration(c.dossier.dossier);
  return !!configuration.value?.lecture?.config;
}

/**
 * `pourquoi` : ce que la configuration va permettre ; `apres` : l'action qui
 * l'attendait, relancée dès qu'elle est prête ; `annuler` : renoncer.
 */
export function ChoixConfiguration({ pourquoi, apres, annuler }: { pourquoi: string; apres: () => void | Promise<void>; annuler?: () => void }) {
  const [encours, setEncours] = useState(false);
  const lancer = (choisir: () => Promise<unknown>) => async () => {
    setEncours(true);
    try {
      const cree = await choisir();
      // Créé : on dit où, pour qu'on le retrouve (et le copie sur un autre ordinateur).
      if (typeof cree === 'string') notifier('ok', t`Dossier « config » prêt dans « ${cree} ».`);
      if (await configPrete()) await apres();
    } catch (err) {
      // Sélecteur fermé sans choisir : rien à signaler.
      if (!(err instanceof DOMException && err.name === 'AbortError')) notifier('erreur', texteErreur(err));
    } finally {
      setEncours(false);
    }
  };
  return (
    <div class="encart choix-configuration">
      <p>
        <strong>{pourquoi}</strong>{' '}
        {t`Ce dossier « config » est commun à tous vos projets : créez-le une fois, par exemple à côté de l’application. Il contiendra l’adresse du domicile : ne le partagez pas.`}
      </p>
      <div class="actions">
        <button type="button" class="principal" disabled={encours} aria-describedby={encours ? 'raison-config' : undefined} onClick={() => void lancer(creerDossierConfig)()}>
          {t`Créer le dossier « config »…`}
        </button>
        <RaisonDesactivee id="raison-config" raison={encours && t`Ouverture du dossier en cours.`} />
        <button type="button" disabled={encours} aria-describedby={encours ? 'raison-config' : undefined} onClick={() => void lancer(choisirDossierConfig)()}>
          {t`J’en ai déjà un : le choisir…`}
        </button>
        {annuler && (
          <button type="button" class="lien" onClick={annuler}>
            {t`Ne rien faire`}
          </button>
        )}
      </div>
    </div>
  );
}
