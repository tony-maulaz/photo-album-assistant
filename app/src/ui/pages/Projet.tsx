// Étape 1 — Projet (SPEC § 6.1) : création, puis modification.

import { useState } from 'preact/hooks';
import { choisirDossier } from '../../navigateur/dossiers';
import { ETAPE, type Projet } from '../../navigateur/projet';
import { cleApi } from '../../navigateur/cle';
import { langue, LANGUES, t, type Langue } from '../../lib/langue';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { AideEtape, LigneEtape } from '../composants/CadreCommun';
import { confirmer } from '../composants/Dialogues';
import { RappelDossierDepart } from '../composants/DossierDepart';
import { allerEtape, configuration, notifier, page, planifierEnregistrement, reglages, session, texteErreur, versionProjet } from '../etat';
import { pluriel } from '../format';
import { creerProjet, lireProjet, sortieNonVide, verifierDossiers } from '../projets';
import { ouvrirProjetExistant, sourcePreChoisie } from './Accueil';

/** État de la configuration et de la clé (§ 6.1). */
function EtatConfiguration() {
  const c = configuration.value;
  const cfg = c?.lecture?.config;
  const domicile = cfg?.lieux_connus.find((l) => l.domicile);
  return (
    <div class="encart etat-configuration">
      <p>
        <strong>{t`Configuration`}</strong>
        {t` :`}{' '}
        {cfg ? (
          <>
            {t`« ${c!.dossier.dossier.name} » — ${pluriel(cfg.lieux_connus.length, 'lieu connu', 'lieux connus')}`}
            {domicile ? t`, domicile « ${domicile.nom} »` : t`, pas de domicile (la détection des voyages en a besoin)`},{' '}
            {t`${pluriel(cfg.calendriers.filter((k) => k.actif).length, 'calendrier actif', 'calendriers actifs')}, ${pluriel(cfg.appareils.length, 'appareil')}.`}
          </>
        ) : (
          t`aucun dossier « config » choisi : les lieux connus, calendriers et appareils ne seront pas utilisés.`
        )}{' '}
        <button type="button" class="lien" onClick={() => (page.value = { nom: 'configuration' })}>
          {t`Configuration`}
        </button>
      </p>
      <p>
        <strong>{t`Clé API`}</strong>
        {t` :`} {cleApi() ? t`saisie (les aides IA sont possibles).` : t`pas encore saisie : les aides IA seront proposées sans pouvoir être lancées.`}{' '}
        <button type="button" class="lien" onClick={() => (page.value = { nom: 'reglages' })}>
          {t`Réglages`}
        </button>
      </p>
    </div>
  );
}

export function PageNouveauProjet({ mode }: { mode: Projet['mode'] }) {
  // Le dossier à trier a déjà été choisi d'un clic sur la carte de l'accueil.
  const [source, setSource] = useState<FileSystemDirectoryHandle | null>(() => {
    const d = sourcePreChoisie.value;
    sourcePreChoisie.value = null;
    return d;
  });
  const [sortie, setSortie] = useState<FileSystemDirectoryHandle | null>(null);
  // Dossier de sortie qui contient déjà un projet : on propose de l'ouvrir plutôt que d'en créer un second.
  const [existant, setExistant] = useState<Projet | null>(null);
  const [nom, setNom] = useState(source?.name ?? '');
  const [contexte, setContexte] = useState('');
  // Le préréglage du tri se choisit à l'étape « Tri automatique » ; « Année » par défaut pour un dossier en vrac.
  const prereglage = mode === 'vrac' ? 'annee' : '';
  const [budget, setBudget] = useState(reglages.value.budgetDefautChf);
  // Langue de ce qui est écrit dans la sortie (D60) : celle de l'interface, sauf choix contraire.
  const [langueProjet, setLangueProjet] = useState<Langue>(langue());
  const [erreur, setErreur] = useState<string | null>(null);
  const [encours, setEncours] = useState(false);

  const verifier = async (s: FileSystemDirectoryHandle | null, d: FileSystemDirectoryHandle | null) => {
    setErreur(s && d ? await verifierDossiers(s, d) : null);
  };

  const choisirSource = async () => {
    try {
      const d = await choisirDossier('source', 'read');
      setSource(d);
      if (!nom) setNom(d.name);
      await verifier(d, sortie);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const choisirSortie = async () => {
    try {
      const d = await choisirDossier('sortie', 'readwrite');
      setSortie(d);
      setExistant((await lireProjet(d).catch(() => undefined)) ?? null);
      await verifier(source, d);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const creer = async () => {
    if (!source || !sortie) return;
    setEncours(true);
    try {
      if (
        (await sortieNonVide(sortie)) &&
        !(await confirmer(
          t`Le dossier de sortie n’est pas vide`,
          t`« ${sortie.name} » contient déjà des fichiers. Ils ne seront ni modifiés ni supprimés, mais il est plus clair de partir d’un dossier vide. Continuer quand même ?`,
          t`Continuer`,
        ))
      )
        return;
      await creerProjet({ source, sortie, nom, mode, contexte, prereglage, budget, langue: langueProjet });
    } catch (err) {
      notifier('erreur', texteErreur(err));
    } finally {
      setEncours(false);
    }
  };

  const ouvrirExistant = async () => {
    if (!sortie || !existant) return;
    try {
      await ouvrirProjetExistant(sortie, existant, source);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) notifier('erreur', texteErreur(err));
    }
  };

  return (
    <div class="page etroite avec-barre">
      <TeteEtape numero={ETAPE.projet} titre={mode === 'deja_trie' ? t`Ouvrir un dossier déjà trié` : t`Trier un nouveau dossier`}>
        {t`Choisissez le dossier de photos et un dossier de sortie, vide de préférence. Le dossier de photos est seulement lu : tout ce que l’application produit va dans le dossier de sortie.`}
      </TeteEtape>

      <div class="formulaire">
        <label>{t`Dossier à trier (lecture seule)`}</label>
        <div class="ligne-champ">
          <button type="button" onClick={() => void choisirSource()}>
            {t`Choisir…`}
          </button>
          <span class={source ? '' : 'discret'}>{source ? t`« ${source.name} »` : t`aucun`}</span>
        </div>

        <label>{t`Dossier de sortie`}</label>
        <div class="ligne-champ">
          <button type="button" onClick={() => void choisirSortie()}>
            {t`Choisir…`}
          </button>
          <span class={sortie ? '' : 'discret'}>{sortie ? t`« ${sortie.name} »` : t`aucun — créez-le dans le sélecteur si besoin`}</span>
        </div>
        <RappelDossierDepart />
        {erreur && <p class="erreur">{erreur}</p>}
        {existant && sortie && (
          <div class="encart champ-plein projet-existant">
            <p>
              {t`« ${sortie.name} » contient déjà le projet « ${existant.nom} » (créé le ${new Date(existant.cree_le).toLocaleDateString('fr-CH')}). Ouvrez-le pour le continuer ou y ajouter des photos, ou choisissez un autre dossier de sortie.`}
            </p>
            <button type="button" class="principal" onClick={() => void ouvrirExistant()}>
              {t`Ouvrir ce projet`}
            </button>
          </div>
        )}

        <label for="nom-projet">{t`Nom du projet`}</label>
        <input id="nom-projet" class="large" value={nom} placeholder={t`Par exemple : Photos 2025`} onInput={(e) => setNom(e.currentTarget.value)} />

        <label for="contexte">{t`Contexte (facultatif)`}</label>
        <textarea
          id="contexte"
          rows={3}
          value={contexte}
          placeholder={t`Par exemple : vacances au bord de la mer, juillet 2026`}
          onInput={(e) => setContexte(e.currentTarget.value)}
        />
        <p class="aide-champ">{t`Transmis aux aides IA (quand vous les lancerez) pour mieux nommer et décrire les photos.`}</p>

        <details class="avances champ-plein">
          <summary>{t`Réglages avancés`}</summary>
          <label for="budget">
            {t`Budget IA du projet (CHF)`}{' '}
            <input id="budget" type="number" min="0" step="5" class="court" value={budget} onInput={(e) => setBudget(Number(e.currentTarget.value) || 0)} />
          </label>
          <p class="discret">{t`Les aides IA s’arrêtent avant de dépasser ce montant. Il se change aussi plus tard, à l’étape Projet.`}</p>
          <label for="langue-projet">
            {t`Langue des dossiers et des textes écrits`}{' '}
            <select id="langue-projet" value={langueProjet} onChange={(e) => setLangueProjet(e.currentTarget.value as Langue)}>
              {(Object.entries(LANGUES) as [Langue, string][]).map(([code, nomLangue]) => (
                <option key={code} value={code}>
                  {nomLangue}
                </option>
              ))}
            </select>
          </label>
          <p class="discret">{t`Noms des dossiers créés (« _mis_de_cote » ou « _set_aside »…), rapport, propositions de l’IA et noms de lieux. Fixée à la création : changer la langue de l’interface ensuite ne renomme rien.`}</p>
        </details>

        <p class="discret">
          {t`Facultatif, réglable plus tard : configuration (lieux connus, appareils) ${configuration.value?.lecture?.config ? t`« ${configuration.value.dossier.dossier.name} »` : t`pas encore choisie`}, clé API pour les aides IA ${cleApi() ? t`saisie` : t`pas encore saisie`}. Tout le reste fonctionne sans.`}
        </p>
      </div>

      <BarreValidation
        resume={source && sortie ? t`« ${source.name} » → « ${sortie.name} »` : t`Choisissez les deux dossiers.`}
        revenir={() => (page.value = { nom: 'accueil' })}
        valider={() => void creer()}
        libelleValider={encours ? t`Création…` : t`Créer le projet`}
        validerActif={!!source && !!sortie && !erreur && !existant && !encours}
        raisonInactif={encours ? t`Création en cours.` : !source || !sortie ? t`Choisissez les deux dossiers.` : erreur ? t`Corrigez d’abord l’erreur ci-dessus.` : t`Ce projet existe déjà : ouvrez-le ci-dessus.`}
      />
    </div>
  );
}

export function PageEtape1() {
  const s = session.value!;
  versionProjet.value;
  const p = s.projet;
  const changer = (modif: Partial<Projet>) => {
    Object.assign(p, modif);
    versionProjet.value++;
    planifierEnregistrement();
  };
  return (
    <div class="page etroite avec-barre">
      <LigneEtape titre={t`Projet`} aide={{ cle: 'projet' }} />
      <AideEtape cle="projet">{t`Les réglages généraux du projet. Le dossier à trier et le dossier de sortie sont fixés à la création.`}</AideEtape>
      <EtatConfiguration />
      <div class="formulaire">
        <label>{t`Dossier à trier`}</label>
        <span>{t`« ${s.source.racine.name} » — ${p.source.fichiers} fichiers`}</span>
        <label>{t`Dossier de sortie`}</label>
        <span>{t`« ${s.sortie.racine.name} »`}</span>
        <label for="nom-projet">{t`Nom du projet`}</label>
        <input id="nom-projet" class="large" value={p.nom} onChange={(e) => changer({ nom: e.currentTarget.value.trim() || p.nom })} />
        <label for="contexte">{t`Contexte (facultatif)`}</label>
        <textarea id="contexte" rows={3} value={p.contexte} onChange={(e) => changer({ contexte: e.currentTarget.value })} />
        <label for="budget">{t`Budget IA du projet (CHF)`}</label>
        <input id="budget" type="number" min="0" step="5" class="court" value={p.budget_chf} onChange={(e) => changer({ budget_chf: Number(e.currentTarget.value) || 0 })} />
        <label>{t`Langue des dossiers et des textes écrits`}</label>
        <span>{t`${LANGUES[p.langue ?? 'fr']} (choisie à la création du projet)`}</span>
      </div>
      <BarreValidation resume={t`Créé le ${new Date(p.cree_le).toLocaleDateString('fr-CH')}`} valider={() => allerEtape('inventaire')} libelleValider={t`Continuer`} />
    </div>
  );
}
