// Écran « Reprendre » (D26) et page d'accueil (SPEC § 5.1).

import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { choisirDossier, demanderAutorisation, etatAutorisation } from '../../navigateur/dossiers';
import { cleApi } from '../../navigateur/cle';
import { nomCourtEtape, oublierProjetRecent, projetsRecents, type Projet, type ProjetRecent } from '../../navigateur/projet';
import { t } from '../../lib/langue';
import { ChoixLangue } from '../composants/ChoixLangue';
import { confirmer } from '../composants/Dialogues';
import { Icone } from '../composants/Icones';
import { configuration, notifier, page, texteErreur } from '../etat';
import { dateHeure, nombre, pluriel } from '../format';
import { chargerConfiguration, lireProjet, ouvrirProjet, type Autorisation } from '../projets';

/** Autorisations à redemander au lancement, remplies par `main.tsx`. */
export const autorisations = signal<Autorisation[]>([]);

/** Dossier à trier choisi depuis une carte de l'accueil : le formulaire du nouveau projet le reprend. */
export const sourcePreChoisie = signal<FileSystemDirectoryHandle | null>(null);

async function continuerApresReprise() {
  const config = autorisations.value.find((a) => a.libelle.startsWith('Configuration'));
  if (config && (await etatAutorisation(config.poignee, 'readwrite')) === 'granted') await chargerConfiguration(config.poignee);
  const [dernier] = await projetsRecents();
  if (dernier && (await etatAutorisation(dernier.source, 'read')) === 'granted' && (await etatAutorisation(dernier.sortie, 'readwrite')) === 'granted') {
    try {
      await ouvrirProjet(dernier.source, dernier.sortie);
      return;
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  }
  page.value = { nom: 'accueil' };
}

export function PageReprendre() {
  const [accordees, setAccordees] = useState<Set<number>>(new Set());
  const liste = autorisations.value;
  const restantes = liste.map((a, i) => ({ a, i })).filter(({ i }) => !accordees.has(i));

  // Une demande d'accès par dossier ; Chrome peut exiger un nouveau clic entre deux demandes.
  const autoriser = async (indices: number[]) => {
    const ok = new Set(accordees);
    for (const i of indices) {
      try {
        if (await demanderAutorisation(liste[i].poignee, liste[i].mode)) ok.add(i);
      } catch {
        break;
      }
    }
    setAccordees(ok);
    if (ok.size === liste.length) await continuerApresReprise();
  };

  return (
    <div class="page etroite">
      <h1>{t`Bonjour !`}</h1>
      <p class="explication">
        {t`Pour des raisons de sécurité, le navigateur redemande l’accès à vos dossiers à chaque session. Rien n’est envoyé nulle part : l’application lit et écrit seulement dans ces dossiers, sur cet ordinateur.`}
      </p>
      <ul class="liste-autorisations">
        {liste.map((a, i) => (
          <li key={i} class={accordees.has(i) ? 'ok' : ''}>
            <span>{accordees.has(i) ? '✓' : '○'}</span> {a.libelle}
            {!accordees.has(i) && restantes[0]?.i !== i && (
              <button type="button" onClick={() => void autoriser([i])}>
                {t`Autoriser`}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div class="actions">
        {restantes.length > 0 && (
          <button type="button" class="principal grand" onClick={() => void autoriser(restantes.map((r) => r.i))}>
            {t`Autoriser l’accès`}
          </button>
        )}
        <button type="button" onClick={() => void continuerApresReprise()}>
          {restantes.length ? t`Continuer sans` : t`Continuer`}
        </button>
      </div>
    </div>
  );
}

/** Rouvre un projet récent, en redemandant l'accès si besoin. */
async function rouvrir(p: ProjetRecent) {
  try {
    if (!(await demanderAutorisation(p.sortie, 'readwrite')) || !(await demanderAutorisation(p.source, 'read'))) {
      notifier('erreur', t`Accès refusé : le projet ne peut pas être ouvert sans ses deux dossiers.`);
      return;
    }
    await ouvrirProjet(p.source, p.sortie);
  } catch (err) {
    notifier('erreur', t`Impossible d’ouvrir « ${p.nom} » : ${texteErreur(err)}`);
  }
}

/** « Reprendre un projet » : choisir son dossier de sortie, puis retrouver sa source. */
async function reprendreProjet() {
  const sortie = await choisirDossier('sortie', 'readwrite');
  const projet = await lireProjet(sortie);
  if (!projet) {
    notifier('erreur', t`« ${sortie.name} » ne contient pas de projet (pas de dossier .album). Choisissez le dossier de sortie d’un projet.`);
    return;
  }
  await ouvrirProjetExistant(sortie, projet);
}

/**
 * Ouvre le projet enregistré dans `sortie` : sa source est celle notée sur cet
 * ordinateur, sinon `proposee` (le dossier à trier déjà choisi) si elle porte
 * le même nom, sinon on la demande.
 */
export async function ouvrirProjetExistant(sortie: FileSystemDirectoryHandle, projet: Projet, proposee?: FileSystemDirectoryHandle | null) {
  const connu = (await projetsRecents()).find((r) => r.id === projet.id);
  let source = connu?.source ?? (proposee?.name === projet.source.nom ? proposee : undefined);
  if (source && !(await demanderAutorisation(source, 'read'))) source = undefined;
  if (!source) {
    notifier('info', t`Choisissez maintenant le dossier à trier de ce projet (« ${projet.source.nom} »).`);
    source = await choisirDossier('source', 'read');
    if (source.name !== projet.source.nom && !(await confirmer(t`Dossier différent`, t`Le projet a été créé avec « ${projet.source.nom} », vous avez choisi « ${source.name} ». Continuer avec ce dossier ?`, t`Continuer`))) return;
  }
  await ouvrirProjet(source, sortie);
}

/** « il y a 3 jours », « hier », « aujourd’hui » ; la date au-delà d'un mois. */
function depuis(iso: string): string {
  const jours = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (jours <= 0) return t`aujourd’hui`;
  if (jours === 1) return t`hier`;
  if (jours < 14) return t`il y a ${jours} jours`;
  if (jours < 31) return t`il y a ${Math.round(jours / 7)} semaines`;
  return t`le ${dateHeure(iso.slice(0, 19)).split(' ')[0]}`;
}

/** Trois teintes douces tirées de l'identifiant : chaque projet garde sa vignette. */
function teintes(id: string): string[] {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return [0, 1, 2].map((i) => `hsl(${(h + i * 47) % 360} 32% ${78 - i * 4}%)`);
}

function avancement(p: ProjetRecent): { texte: string; part: number } {
  const etapes = p.etapes;
  if (!etapes) return { texte: t`Sortie « ${p.sortie.name} »`, part: 0 };
  const validees = etapes.filter((e) => e === 'validee').length;
  if (validees === etapes.length) return { texte: t`Terminé · sortie créée`, part: 1 };
  const i = etapes.findIndex((e) => e !== 'validee');
  return { texte: t`Étape ${i + 1} sur ${etapes.length} · ${nomCourtEtape(i + 1)}`, part: validees / etapes.length };
}

function CarteProjet({ p, retirer }: { p: ProjetRecent; retirer: () => void }) {
  const { texte, part } = avancement(p);
  const [t1, t2, t3] = teintes(p.id);
  return (
    <li class="carte-projet">
      <div class="vignettes" aria-hidden="true">
        <span style={{ background: t1 }} />
        <span style={{ background: t2 }} />
        <span style={{ background: t3 }} />
      </div>
      <div class="corps">
        <strong class="nom-projet">{p.nom}</strong>
        <span class="discret">{texte}</span>
        {part === 1 && <span class="discret">{t`Des photos arrivées depuis ? Rouvrez-le : seules les nouvelles seront à trier.`}</span>}
        <div class="avancement" title={t`${Math.round(part * 100)} % des étapes validées`}>
          <div style={{ width: `${part * 100}%` }} />
        </div>
        <div class="pied-carte">
          <span class="discret">
            {p.fichiers ? t`${nombre(p.fichiers)} fichiers · ` : ''}
            {t`ouvert ${depuis(p.ouvert_le)}`}
          </span>
          <span class="espace" />
          <button type="button" class="discret-bouton" title={t`Retirer de la liste (le projet et ses fichiers ne sont pas touchés)`} onClick={retirer}>
            {t`Retirer`}
          </button>
          <button type="button" class="doux" onClick={() => void rouvrir(p)}>
            {t`Ouvrir`}
          </button>
        </div>
      </div>
    </li>
  );
}

export function PageAccueil() {
  const [recents, setRecents] = useState<ProjetRecent[]>([]);
  useEffect(() => void projetsRecents().then(setRecents), []);
  const config = configuration.value;
  const cle = cleApi();
  const lecture = config?.lecture?.config;

  const essayer = (f: () => Promise<void>) => () => void f().catch((err) => notifier('erreur', texteErreur(err)));
  // Le dossier à trier se choisit dès le clic sur la carte ; le formulaire s'ouvre ensuite, ce dossier déjà rempli.
  const commencer = (mode: Projet['mode']) => async () => {
    try {
      sourcePreChoisie.value = await choisirDossier('source', 'read');
      page.value = { nom: 'nouveau', mode };
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) notifier('erreur', texteErreur(err));
    }
  };

  return (
    <div class="page accueil">
      <p class="langue-accueil">
        <label for="langue-accueil">{t`Langue (language)`}</label> <ChoixLangue id="langue-accueil" />
      </p>
      <section class="accroche">
        <h1>
          {t`Vos photos triées,`}
          <br />
          {t`votre album prêt.`}
        </h1>
        <p>
          {t`Le dossier d’origine n’est jamais modifié : tout est écrit dans un dossier de sortie. Vous décidez de tout ; l’IA vous aide seulement si vous le voulez, avec son coût affiché avant.`}
        </p>
      </section>

      <section class="cartes-entree">
        <button type="button" class="carte-entree" onClick={() => void commencer('vrac')()}>
          <span class="icone-carte">
            <Icone nom="dossierPlus" taille={26} epaisseur={1.8} />
          </span>
          <strong>{t`Trier un nouveau dossier`}</strong>
          <span class="texte-carte">
            {t`Un dossier en vrac : l’application range les photos par lieux et par sorties, écarte les floues et les doublons, puis vous aide à choisir celles de l’album.`}
          </span>
          <span class="faux-bouton principal">{t`Choisir le dossier à trier`}</span>
        </button>
        <button type="button" class="carte-entree" onClick={() => void commencer('deja_trie')()}>
          <span class="icone-carte chaude">
            <Icone nom="dossierCoche" taille={26} epaisseur={1.8} />
          </span>
          <strong>{t`Ouvrir un dossier déjà trié`}</strong>
          <span class="texte-carte">
            {t`Ses sous-dossiers deviennent les sorties. Réorganisez-les, nommez-les, chassez les doublons et préparez l’album, sans repartir de zéro.`}
          </span>
          <span class="faux-bouton">{t`Choisir le dossier trié`}</span>
        </button>
      </section>

      <section>
        <div class="titre-section-accueil">
          <h2>{t`Reprendre`}</h2>
          <span class="espace" />
          <button type="button" class="lien" title={t`Choisissez le dossier de sortie d’un projet commencé (il contient un dossier caché « .album »).`} onClick={essayer(reprendreProjet)}>
            {t`Reprendre un projet…`}
          </button>
        </div>
        {recents.length === 0 ? (
          <p class="discret">{t`Aucun projet sur cet ordinateur pour l’instant. Vos projets apparaîtront ici.`}</p>
        ) : (
          <ul class="liste-projets">
            {recents.map((p) => (
              <CarteProjet
                key={p.id}
                p={p}
                retirer={async () => {
                  await oublierProjetRecent(p.id);
                  setRecents(await projetsRecents());
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section class="etat-config">
        <strong>{t`Cet ordinateur`}</strong>
        {lecture ? (
          <span class="puce-etat ok">
            {t`Configuration « ${config!.dossier.dossier.name} »`} · {pluriel(lecture.lieux_connus.length, 'lieu connu', 'lieux connus')} · {pluriel(lecture.appareils.length, 'appareil')}
          </span>
        ) : (
          <span class="puce-etat facultatif" title={t`Lieux connus, calendriers, appareils : facultatif, mais utile pour nommer les sorties`}>
            {t`Configuration : facultative`}
          </span>
        )}
        {cle ? (
          <span class="puce-etat ok">{t`Clé API saisie pour cette session`}</span>
        ) : (
          <span class="puce-etat facultatif" title={t`Seules les aides IA en ont besoin : tout le reste fonctionne sans`}>
            {t`Clé API : facultative (aides IA)`}
          </span>
        )}
        <span class="espace" />
        <button type="button" class="lien" onClick={() => (page.value = { nom: 'configuration' })}>
          {t`Configuration`}
        </button>
        <button type="button" class="lien" onClick={() => (page.value = { nom: 'reglages' })}>
          {t`Réglages`}
        </button>
      </section>
    </div>
  );
}
