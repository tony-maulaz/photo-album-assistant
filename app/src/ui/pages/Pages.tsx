// Pages Réglages, Journal, Aide et Fonctions IA (SPEC § 5.1, § 7.1, § 9).

import { nomsSortie } from '../../lib/sortie';
import { useEffect, useState } from 'preact/hooks';
import { MODELES, modele as infoModele } from '../../lib/tarifs';
import { client, expliquerErreur } from '../../navigateur/claude';
import { cleApi, cleMasquee, cleMemorisee, enregistrerCleApi, oublierCleApi } from '../../navigateur/cle';
import type { Reglages } from '../../navigateur/reglages';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { RaisonDesactivee, TeteEtape } from '../composants/Cadre';
import { CurseurTaille } from '../composants/CadreCommun';
import { Icone } from '../composants/Icones';
import { aTraduire, langue, t } from '../../lib/langue';
import { ChoixLangue } from '../composants/ChoixLangue';
import { ReglageDossierDepart } from '../composants/DossierDepart';
import { changerReglages, notifier, page, reglages, session, versionIA } from '../etat';
import { revenir } from '../navigation';
import { aides, modeleDe, retirerAvisCle, texteCout, type Aide } from './AidesIA';
import { montantChf, nombre, pluriel } from '../format';

/** « ← Retour » en haut des pages du menu : on revient là d'où l'on venait (le logo mène à l'accueil). */
function BoutonRetour() {
  return (
    <button type="button" class="lien bouton-retour" onClick={revenir}>
      {t`← Retour`}
    </button>
  );
}

/** Nom lisible d'un modèle (« Claude Opus 5.5 (avancé) »), ou son identifiant s'il n'est pas dans la table. */
function nomModele(id: string): string {
  const m = infoModele(id);
  return m ? t(m.nom) : id;
}

function SelectModele({ valeur, changer }: { valeur: string; changer: (v: string) => void }) {
  return (
    <select value={valeur} onChange={(e) => changer(e.currentTarget.value)}>
      {MODELES.map((m) => (
        <option key={m.id} value={m.id}>
          {t`${m.nom} — ${nombre(m.entree, m.entree < 1 ? 2 : 0)} / ${nombre(m.sortie, m.sortie < 1 ? 2 : 0)} USD par million de jetons`}
        </option>
      ))}
    </select>
  );
}

export function PageReglages() {
  const r = reglages.value;
  const [cle, setCle] = useState('');
  const [souvenir, setSouvenir] = useState(cleMemorisee());
  const [, rafraichir] = useState(0);
  const [test, setTest] = useState<string | null>(null);
  const actuelle = cleApi();
  const changer = (modif: Partial<Reglages>) => changerReglages({ ...r, ...modif });

  return (
    <div class="page etroite">
      <BoutonRetour />
      <TeteEtape titre={t`Réglages`}>{t`Ces réglages sont propres à cet ordinateur et à ce navigateur.`}</TeteEtape>

      <h2>{t`Clé API Claude`}</h2>
      <p class="explication">{t`Nécessaire seulement pour les aides IA. La clé reste dans ce navigateur et ne part que vers api.anthropic.com.`}</p>
      <p>{actuelle ? t`Clé actuelle : ${cleMasquee(actuelle)} (${cleMemorisee() ? t`mémorisée sur cet ordinateur` : t`gardée jusqu’à la fermeture de l’onglet`}).` : t`Aucune clé.`}</p>
      <div class="formulaire">
        <label for="cle">{t`Nouvelle clé`}</label>
        <input id="cle" type="password" class="large" autocomplete="off" placeholder="sk-ant-…" value={cle} onInput={(e) => setCle(e.currentTarget.value)} />
        <label />
        <label class="case">
          <input type="checkbox" checked={souvenir} onChange={(e) => setSouvenir(e.currentTarget.checked)} /> {t`Se souvenir de la clé sur cet ordinateur`}
        </label>
      </div>
      {souvenir && (
        <p class="attention">
          {t`Attention : ouverte par double-clic, l’application partage son stockage avec toutes les pages HTML ouvertes depuis cet ordinateur. Une clé mémorisée pourrait être lue par un autre fichier HTML. Ne cochez pas sur un ordinateur partagé.`}
        </p>
      )}
      <div class="actions">
        <button
          type="button"
          class="principal"
          disabled={!cle.trim()}
          aria-describedby={cle.trim() ? undefined : 'raison-cle'}
          onClick={() => {
            enregistrerCleApi(cle.trim(), souvenir);
            setCle('');
            rafraichir((n) => n + 1);
            retirerAvisCle();
            notifier('ok', t`Clé enregistrée.`);
          }}
        >
          {t`Enregistrer la clé`}
        </button>
        <button
          type="button"
          disabled={!actuelle}
          aria-describedby={actuelle ? undefined : 'raison-cle'}
          onClick={async () => {
            setTest(t`Test en cours…`);
            try {
              let n = 0;
              for await (const _ of client().models.list()) n++;
              setTest(t`La clé fonctionne (${n} modèles accessibles).`);
            } catch (err) {
              setTest(t`Échec : ${expliquerErreur(err)}`);
            }
          }}
        >
          {t`Tester`}
        </button>
        <button
          type="button"
          disabled={!actuelle}
          aria-describedby={actuelle ? undefined : 'raison-cle'}
          onClick={() => {
            oublierCleApi();
            setTest(null);
            rafraichir((n) => n + 1);
          }}
        >
          {t`Oublier la clé`}
        </button>
        <RaisonDesactivee
          id="raison-cle"
          raison={!actuelle ? (cle.trim() ? t`Aucune clé enregistrée : enregistrez-la pour la tester.` : t`Saisissez d’abord votre clé.`) : !cle.trim() && t`Saisissez une nouvelle clé pour l’enregistrer.`}
        />
      </div>
      {test && <p>{test}</p>}

      <h2>{t`Fenêtres de choix de dossier et de fichier`}</h2>
      <ReglageDossierDepart />

      <h2>{t`Affichage`}</h2>
      <div class="formulaire">
        <label for="langue">{t`Langue (language)`}</label>
        <ChoixLangue />
        <label for="miniatures">{t`Taille des miniatures`}</label>
        <CurseurTaille id="miniatures" />
        <label for="theme">{t`Thème`}</label>
        <select id="theme" value={r.theme} onChange={(e) => changer({ theme: e.currentTarget.value as Reglages['theme'] })}>
          <option value="auto">{t`Comme l’ordinateur`}</option>
          <option value="clair">{t`Clair`}</option>
          <option value="sombre">{t`Sombre`}</option>
        </select>
      </div>

      {/* Ce qui ne sert qu'aux habitués : replié par défaut. */}
      <details class="avances reglages-avances">
        <summary>{t`Réglages avancés : modèles IA, coûts, OpenStreetMap`}</summary>
      <h2>{t`Modèles par usage`}</h2>
      <div class="formulaire">
        <label>{t`Rapide (gros volumes : étiquettes)`}</label>
        <SelectModele valeur={r.modeles.rapide} changer={(v) => changer({ modeles: { ...r.modeles, rapide: v } })} />
        <label>{t`Standard (par défaut)`}</label>
        <SelectModele valeur={r.modeles.standard} changer={(v) => changer({ modeles: { ...r.modeles, standard: v } })} />
        <label>{t`Avancé (doublons, nommage difficile, textes)`}</label>
        <SelectModele valeur={r.modeles.avance} changer={(v) => changer({ modeles: { ...r.modeles, avance: v } })} />
      </div>

      <h2>{t`Coûts`}</h2>
      <div class="formulaire">
        <label for="taux">{t`1 USD vaut (CHF)`}</label>
        <input id="taux" type="number" step="0.01" min="0" class="court" value={r.tauxUsdChf} onChange={(e) => changer({ tauxUsdChf: Number(e.currentTarget.value) || r.tauxUsdChf })} />
        <label for="seuil">{t`Demander confirmation au-delà de (CHF)`}</label>
        <input id="seuil" type="number" step="0.5" min="0" class="court" value={r.seuilConfirmationChf} onChange={(e) => changer({ seuilConfirmationChf: Number(e.currentTarget.value) || 0 })} />
        <label for="budget">{t`Budget par défaut d’un projet (CHF)`}</label>
        <input id="budget" type="number" step="5" min="0" class="court" value={r.budgetDefautChf} onChange={(e) => changer({ budgetDefautChf: Number(e.currentTarget.value) || 0 })} />
      </div>

      <h2>{t`Noms de lieux (Nominatim)`}</h2>
      <div class="formulaire">
        <label for="email">{t`Adresse e-mail (facultative)`}</label>
        <input id="email" type="email" class="large" value={r.emailNominatim} onChange={(e) => changer({ emailNominatim: e.currentTarget.value.trim() })} />
      </div>
      <p class="aide-champ">{t`Transmise à OpenStreetMap avec les demandes de noms de lieux, comme le demandent ses règles d’usage. Elle n’est envoyée nulle part ailleurs.`}</p>
      </details>
    </div>
  );
}

/** Libellés des types d'activité du journal (enregistrés en codes : « ia », « sortie »…). */
const TYPES_JOURNAL: Record<string, string> = {
  projet: aTraduire('Projet'),
  inventaire: aTraduire('Inventaire'),
  analyse: aTraduire('Analyse des photos'),
  doublons: aTraduire('Doublons'),
  tri: aTraduire('Tri automatique'),
  ia: aTraduire('IA'),
  sortie: aTraduire('Écriture de la sortie'),
  alerte: aTraduire('Alerte'),
};

interface EntreeJournal {
  quand: string;
  type: string;
  message: string;
  donnees?: unknown;
}

/** Texte d'une ligne du journal : le coût d'un appel IA est montré en CHF (il est noté en USD, la monnaie de l'API). */
function texteJournal(e: EntreeJournal, taux: number): string {
  const d = e.donnees as { fonction?: unknown; modele?: unknown; usd?: unknown } | undefined;
  if (e.type === 'ia' && d && typeof d.fonction === 'string' && typeof d.modele === 'string' && typeof d.usd === 'number') {
    return t`${d.fonction} ${nomFonction(d.fonction)} : ${nombre(d.usd * taux, 3)} CHF (${nomModele(d.modele)})`;
  }
  return e.message;
}

export function PageJournal() {
  const s = session.value;
  const [entrees, setEntrees] = useState<EntreeJournal[]>([]);
  useEffect(() => void s?.etat.lireJournal().then((l) => setEntrees(l.reverse())), [s]);
  const taux = reglages.value.tauxUsdChf;
  return (
    <div class="page etroite">
      <BoutonRetour />
      <TeteEtape titre={t`Journal`}>{t`L’activité du projet : création, inventaire, aides IA et leur coût, écritures dans la sortie, alertes.`}</TeteEtape>
      {!s && <p class="discret">{t`Ouvrez un projet pour voir son journal.`}</p>}
      {s && Object.keys(s.projet.couts_usd ?? {}).length > 0 && (
        <>
          <h2>{t`Coûts des aides IA`}</h2>
          <table class="tableau">
            <thead>
              <tr>
                <th>{t`Aide IA`}</th>
                <th class="n">{t`Dépensé`}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(s.projet.couts_usd ?? {})
                .sort((a, b) => b[1] - a[1])
                .map(([f, usd]) => (
                  <tr key={f}>
                    <td>
                      {f} {nomFonction(f)}
                    </td>
                    <td class="n">{nombre(usd * taux, 2)} CHF</td>
                  </tr>
                ))}
              <tr class="total">
                <td>{t`Total (budget du projet : ${montantChf(s.projet.budget_chf)} CHF)`}</td>
                <td class="n">{nombre(s.ia.depenseCHF(), 2)} CHF</td>
              </tr>
            </tbody>
          </table>
          <h2>{t`Activité`}</h2>
        </>
      )}
      {s && entrees.length === 0 && <p class="discret">{t`Rien pour l’instant.`}</p>}
      <ul class="journal-projet">
        {entrees.map((e, i) => (
          <li key={i}>
            <span class="discret">{new Date(e.quand).toLocaleString(langue() === 'en' ? 'en-GB' : 'fr-CH')}</span>{' '}
            <span class="badge">{TYPES_JOURNAL[e.type] ? t(TYPES_JOURNAL[e.type]) : e.type}</span> {texteJournal(e, taux)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Libellés traduits à l'affichage (`t`) ; « — » reste tel quel.
const FONCTIONS_IA: [string, string, number, string, string][] = [
  ['IA1', aTraduire('Cas limites de netteté'), ETAPE.floues, aTraduire('Miniatures des photos à la limite'), '—'],
  ['IA7', aTraduire('Doublons'), ETAPE.doublons, aTraduire('Planches vue d’ensemble + vérifications'), '—'],
  ['IA16', aTraduire('Choisir dans les rafales'), ETAPE.doublons, aTraduire('Photos de chaque rafale en 1568 px'), '—'],
  ['IA2', aTraduire('Situer les photos sans GPS'), ETAPE.tri, aTraduire('Miniatures + photos voisines dans le temps'), aTraduire('Oui')],
  ['IA3', aTraduire('Petits dossiers'), ETAPE.petits, aTraduire('Planches du fragment et de ses voisins'), '—'],
  ['IA4', aTraduire('Nommage des sorties (avec les monuments reconnus)'), ETAPE.nommage, aTraduire('5 photos par dossier, GPS, calendrier, contexte'), aTraduire('Oui')],
  ['IA6', aTraduire('Consolidation'), ETAPE.consolidation, aTraduire('Liste des dossiers + planches des petits'), '—'],
  ['IA8', aTraduire('Étiquettes et description'), ETAPE.selection, aTraduire('Planches de miniatures'), '—'],
  ['IA9', aTraduire('Appréciation'), ETAPE.selection, aTraduire('Miniatures moyennes'), '—'],
  ['IA10', aTraduire('Meilleure de la pile'), ETAPE.selection, aTraduire('Photos de la pile en grand'), '—'],
  ['IA11', aTraduire('Contrôle de la sélection'), ETAPE.selection, aTraduire('Photos retenues par sortie'), '—'],
  ['IA12', aTraduire('Titres et introductions de section'), ETAPE.album, aTraduire('Photos retenues, noms, contexte'), aTraduire('Oui')],
  ['IA13', aTraduire('Légendes'), ETAPE.album, aTraduire('Photos concernées, contexte'), aTraduire('Option')],
  ['IA14', aTraduire('Suggestions de couverture'), ETAPE.album, aTraduire('Les ★★'), '—'],
  ['IA15', aTraduire('Contrôle de l’album'), ETAPE.album, aTraduire('Pages simulées'), '—'],
];

/** Nom d'une fonction IA de la table, dans la langue de l'interface. */
function nomFonction(code: string): string {
  const nom = FONCTIONS_IA.find(([c]) => c === code)?.[1];
  return nom ? t(nom) : '';
}

export function PageFonctionsIA() {
  const s = session.value;
  versionIA.value;
  const enregistrees = new Map(aides().map((a) => [a.id, a]));
  const couts = s?.projet.couts_usd ?? {};
  const taux = reglages.value.tauxUsdChf;
  // Recherche web : toujours, jamais, ou selon une case de la page de l'aide.
  const texteWeb = (a: Aide) => (typeof a.web === 'function' ? (a.web() ? t`oui (option cochée)` : t`en option`) : a.web ? t`oui` : '—');
  return (
    <div class="page">
      <BoutonRetour />
      <TeteEtape titre={t`Fonctions IA`}>
        {t`Toutes les aides IA, facultatives. Chacune affiche son coût estimé avant d’être lancée, et rien n’est envoyé sans votre action. Les réponses sont gardées : relancer une aide déjà faite ne coûte rien.`}
      </TeteEtape>
      {s ? (
        <p>
          {t`Budget du projet :`} <strong>{nombre(s.ia.depenseCHF(), 2)}</strong> {t`CHF dépensés sur ${montantChf(s.projet.budget_chf)} CHF (détail dans le Journal).`}{' '}
          <button
            type="button"
            class="lien"
            title={t`Une réponse illisible ou refusée est gardée pour ne pas repayer ; l’oublier permet de la redemander.`}
            onClick={() =>
              void s.ia.oublierInexploitables().then((n) => {
                versionIA.value++;
                notifier('info', n ? t`${pluriel(n, 'réponse illisible oubliée', 'réponses illisibles oubliées')} : relancez les aides concernées.` : t`Aucune réponse illisible.`);
              })
            }
          >
            {t`Redemander les réponses illisibles`}
          </button>
        </p>
      ) : (
        <p class="discret">{t`Ouvrez un projet pour voir le coût estimé de chaque aide.`}</p>
      )}
      <table class="tableau fonctions-ia">
        <thead>
          <tr>
            <th />
            <th>{t`Aide IA`}</th>
            <th>{t`Étape`}</th>
            <th>{t`Ce qui est envoyé`}</th>
            <th>{t`Web`}</th>
            <th>{t`Modèle`}</th>
            <th>{t`Coût estimé`}</th>
            <th class="n">{t`Dépensé`}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {FONCTIONS_IA.map(([code, nom, etape, envoi, web]) => {
            const a = enregistrees.get(code);
            const e = s && a ? a.estimer(s) : null;
            const illisibles = s ? s.ia.inexploitables(code) : 0;
            return (
              <tr key={code}>
                <td>{code}</td>
                <td>{t(a?.nom ?? nom)}</td>
                <td>{etape}</td>
                <td>{t(a?.envoi ?? envoi)}</td>
                <td>{a ? texteWeb(a) : web === '—' ? web : t(web)}</td>
                {/* Le modèle réellement appelé (celui de l'usage de l'aide, choisi dans Réglages). */}
                <td class="discret" title={a ? modeleDe(a.usage) : undefined}>
                  {a ? nomModele(modeleDe(a.usage)) : ''}
                </td>
                <td>
                  {!s || !a ? '' : e === null ? t`rien à faire` : texteCout(e)}
                  {illisibles > 0 && <div class="attention">{pluriel(illisibles, 'réponse illisible', 'réponses illisibles')}</div>}
                </td>
                <td class="n">{couts[code] ? `${nombre(couts[code] * taux, 2)} CHF` : ''}</td>
                <td>
                  {s && (
                    <button type="button" class="lien" onClick={() => (page.value = { nom: 'etape', numero: etape })}>
                      {t`Étape ${etape}`}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PageAide() {
  return (
    <div class="page etroite aide">
      <BoutonRetour />
      <TeteEtape titre={t`Aide`}>{t`Comment utiliser l’application, étape par étape.`}</TeteEtape>

      {/* L'essentiel pour un débutant, avant le détail. */}
      <section class="pour-commencer">
        <h2>{t`Pour commencer`}</h2>
        <ol>
          <li>{t`À l’accueil, choisissez « Trier un nouveau dossier » (ou « Ouvrir un dossier déjà trié ») : indiquez le dossier de photos, puis un dossier vide où le résultat sera écrit.`}</li>
          <li>{t`Suivez les étapes dans l’ordre. En haut de chaque page, une explication dit quoi faire ; quand tout vous convient, cliquez sur « Valider et continuer », en bas à droite.`}</li>
          <li>{t`Rien ne presse : vos photos d’origine ne sont jamais modifiées, Ctrl+Z annule la dernière modification, et vous pouvez fermer l’onglet à tout moment.`}</li>
          <li>
            {t`Les aides IA (boutons marqués`} <Icone nom="etincelle" taille={16} titre={t`étincelle`} />
            {t`) sont facultatives : elles affichent leur prix avant de partir et demandent une clé API (« Menu », puis « Réglages »).`}
          </li>
        </ol>
        <p class="discret">{t`Touche « ? » (hors d’un champ de saisie) : la liste des raccourcis clavier.`}</p>
      </section>

      <h2>{t`Le principe`}</h2>
      <p>
        {t`Le dossier de photos d’origine n’est jamais modifié. Toutes vos décisions (dossiers, déplacements, éléments mis de côté) sont gardées dans le projet, puis l’étape ${ETAPE.sortie} écrit le résultat dans le dossier de sortie et vérifie que chaque fichier d’origine s’y retrouve. Vous pouvez fermer l’onglet à tout moment : tout est enregistré au fur et à mesure.`}
      </p>

      <h2>{t`Au lancement`}</h2>
      <p>
        {t`Le navigateur redemande l’accès à vos dossiers à chaque session : c’est une mesure de sécurité. L’écran « Reprendre » regroupe ces demandes ; cliquez sur « Autoriser » pour chaque dossier.`}
      </p>

      <h2>{t`Deux façons de commencer`}</h2>
      <ul>
        <li>
          <strong>{t`Trier un nouveau dossier`}</strong>
          {t` (en vrac) : les treize étapes. Les photos à la racine sont rangées par lieux et par sorties ; les sous-dossiers déjà nommés gardent leur place, sauf si vous choisissez de les trier aussi (étape ${ETAPE.dossiers}).`}
        </li>
        <li>
          <strong>{t`Ouvrir un dossier déjà trié`}</strong>
          {t` : ses sous-dossiers deviennent les dossiers de la sortie. Les dossiers « _a_supprimer », « _doublons » et les photos marquées « _doublon » des anciens scripts sont reconnus et mis de côté. Après l’inventaire, on passe aux doublons, puis aux lieux et sorties (le tri automatique et ses suites sont sautés).`}
        </li>
      </ul>

      <h2>{t`Les étapes`}</h2>
      <ol>
        <li>
          <strong>{nomEtape(ETAPE.projet)}</strong>
          {t` : dossiers, préréglage, contexte (transmis à l’IA), budget IA.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.inventaire)}</strong>
          {t` : chiffres, dates, appareils et décalage d’horloge ; l’analyse des photos (netteté, ressemblance, copies, rafales) se fait pendant ce temps.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.dossiers)}</strong>
          {t` : pour chaque sous-dossier, « Trier » (ses photos rejoignent le tri), « Garder, nettoyer » (il garde sa place, ses floues et ses doublons sont proposés) ou « Ne pas toucher ».`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.floues)}</strong>
          {t` : réglez la tolérance ; S sauve une photo, X écarte une photo ratée. Rien n’est écarté avant « Valider et continuer ».`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.doublons)}</strong>
          {t` : un onglet par sorte, copies exactes (même photo en plusieurs exemplaires, ou copie WhatsApp réduite), rafales repérées gratuitement, puis la même scène photographiée plusieurs fois (IA). On relit journée par journée : un clic choisit la photo à garder, « Accepter » écarte les autres.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.tri)}</strong>
          {t` : rangez à part les captures d’écran, enregistrez les lieux qui reviennent souvent, choisissez comment ranger (le résultat se voit tout de suite), puis « Ranger les photos » ; l’IA peut situer les photos sans GPS.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.lieux)}</strong>
          {t` : vérifiez et corrigez l’arborescence (ci-dessous).`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.petits)}</strong>
          {t` : rattachez-les à une sortie voisine, ou gardez-les à part.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.nommage)}</strong>
          {t` : un nom parlant par dossier (Theme_Lieu_JJ.MM.AA), proposé par l’IA si vous voulez.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.consolidation)}</strong>
          {t` : fusionnez les dossiers qui couvrent la même activité.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.selection)}</strong>
          {t` : Espace = ★ dans l’album, 2 = ★★ grande photo, X = pas pour l’album (elle reste dans l’archive), T = tri rapide, C = comparer, R = tourner.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.album)}</strong>
          {t` : ordre, sections, titres, légendes, couverture, aperçu des pages.`}
        </li>
        <li>
          <strong>{nomEtape(ETAPE.sortie)}</strong>
          {t` : l’archive triée, l’album numéroté pour ifolor, ce qui est mis de côté, le rapport et le bilan.`}
        </li>
      </ol>

      <h2>{t`Les aides IA`}</h2>
      <p>
        {t`Toutes sont facultatives. Chaque bouton affiche son coût estimé avant de partir ; au-delà du seuil (Réglages), une confirmation est demandée, et le budget du projet n’est jamais dépassé. Les réponses sont gardées : relancer ne coûte rien. La page « Fonctions IA » dit ce que chaque aide envoie.`}
      </p>

      <h2>{t`Corriger l’arborescence (étape ${ETAPE.lieux})`}</h2>
      <ul>
        <li>{t`Cliquez sur un dossier du panneau pour voir ses photos.`}</li>
        <li>{t`Sélectionnez : clic, Ctrl+clic (ajouter), Maj+clic (une plage), ou un rectangle tracé dans un espace vide. « Toute la journée » et « Toute l’heure » complètent la sélection.`}</li>
        <li>{t`Déplacez : glissez la sélection sur un dossier du panneau, ou touche M (puis tapez une partie du nom), ou touches 1 à 9 (derniers dossiers utilisés).`}</li>
        <li>
          {t`Le bouton « + » à côté de la recherche crée un dossier dans le dossier affiché ; des photos déposées dessus (ou « Nouveau dossier » dans la barre de la sélection) partent dans un nouveau dossier voisin.`}
        </li>
        <li>{t`Réunissez deux dossiers avec « Réunir avec… » à côté du titre, ou en glissant l’un sur l’autre ; double-cliquez sur un nom, ou F2, pour le renommer. Dans un dossier de plusieurs jours, chaque journée a son titre, avec les événements du calendrier ; « Nouveau dossier avec cette journée » la sort du dossier.`}</li>
        <li>{t`Les badges signalent ce qui mérite un coup d’œil : petit dossier, très grand, lieu inconnu, sans date, nom en double, même sortie qu’un dossier voisin (photos prises à la suite, au même endroit).`}</li>
        <li>{t`Suppr met de côté : rien n’est supprimé, les éléments vont dans « Mis de côté » ; dans « Mis de côté », Suppr les remet.`}</li>
        <li>{t`Double-clic ou Entrée : la photo en grand ; ← → pour passer à la suivante.`}</li>
        <li>{t`Ctrl+Z annule, Ctrl+Y (ou Ctrl+Maj+Z) rétablit, à toutes les étapes ; « ? » affiche tous les raccourcis.`}</li>
      </ul>

      <h2>{t`Créer la sortie (étape ${ETAPE.sortie})`}</h2>
      <p>
        {t`Le bouton écrit ce qui manque et déplace ce qui a changé de dossier ; relancé, il ne recopie jamais un fichier déjà en place. Le bilan dit si chaque fichier d’origine est dans la sortie. Seulement dans ce cas, vous pouvez copier la sortie sur le NAS, la vérifier, puis supprimer vous-même le dossier d’origine.`}
      </p>
      <p>
        {t`La copie porte la date du jour : le navigateur ne peut pas conserver la date de modification. Les photos ont presque toutes leur date dans l’appareil (EXIF) ; « ${nomsSortie().rapport} » donne la date d’origine des autres, et celle de chaque fichier reste notée dans « .album/plan.json », dans le dossier de sortie.`}
      </p>

      <h2>{t`Configuration et clé API`}</h2>
      <p>
        {t`Le dossier « config » contient les lieux connus (dont le domicile), les appareils et les calendriers : ne le publiez jamais. La clé API n’y est jamais écrite ; elle reste dans le navigateur, le temps de la session sauf si vous cochez « se souvenir ».`}
      </p>
    </div>
  );
}
