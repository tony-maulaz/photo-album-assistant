// Étape « Nommage » (SPEC § 6.6, IA4, script 04 ; D112 point 11) : deux onglets, « À nommer » (les dossiers
// au nom automatique du tri) et « Déjà nommés » ; une carte par dossier, qui se lit de haut en bas : le nom actuel,
// les noms proposés (en puces, en bordure : ce sont des propositions), puis le nouveau nom, dans un champ, et
// « Renommer ». Les noms proposés : les événements du calendrier pendant lesquels les photos ont été prises, le
// lieu du tri et la proposition de l'IA (D83), « sûre » ou « à vérifier », sa raison dans l'infobulle. L'IA
// combine photos, GPS, calendrier, contexte et recherche web, et repère les monuments dans le même appel (D51).
// L'utilisateur choisit toujours : une puce ne fait que remplir le champ, le nom n'est donné qu'à « Renommer ».

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { blocCalendrier, evenementsAutour } from '../../lib/ics';
import { aTraduire, t } from '../../lib/langue';
import { cleNom } from '../../lib/noms';
import { dossiersANommer, dossiersDejaNommes, estNomAutomatique, estimationNommage, lireNommage, nomsPossibles, normaliserNom, requeteNommage, respecteConvention, type CibleNommage, type NomPropose, type NomsPossibles } from '../../lib/nommage';
import { combiner, renommerDossier, type FichierPlan, type Modification, type Plan } from '../../lib/plan';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { enParallele } from '../../navigateur/workers';
import { BarreValidation } from '../composants/Cadre';
import { AideEtape, LigneEtape } from '../composants/CadreCommun';
import { confirmer } from '../composants/Dialogues';
import { Miniature } from '../composants/GrillePhotos';
import { Icone, type NomIcone } from '../composants/Icones';
import { annuler, appliquer, contexteExecution, evenements, notifier, revenirDe, session, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { ETAPE } from '../../navigateur/projet';
import { jourCourt, nombre, pluriel } from '../format';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs } from './AidesIA';

/** Les deux onglets de la page (D112 point 11). */
type OngletNommage = 'a_nommer' | 'deja_nommes';

/** Réglages de l'aide, partagés entre la page et le catalogue : l'onglet affiché fixe les dossiers envoyés. */
const reglagesNommage: { onglet: OngletNommage; recherche: boolean } = { onglet: 'a_nommer', recherche: true };

/** Les dossiers d'un onglet. */
function dossiersDeLOnglet(plan: Plan, o: OngletNommage): CibleNommage[] {
  return o === 'a_nommer' ? dossiersANommer(plan) : dossiersDejaNommes(plan);
}

/** Noms tapés et pas encore appliqués : gardés si l'on quitte la page par la frise ou le menu (D108). */
const brouillon: { projet?: string; saisies: Record<string, string> } = { saisies: {} };

interface PropositionNom extends NomPropose {
  cle: string;
}

/**
 * Nom pris d'office pour le champ d'un dossier « À nommer » (`nomsPossibles`) : le meilleur événement du
 * calendrier (sauf égalité), sinon la proposition de l'IA, avec sa confiance ; le calendrier n'en a pas.
 */
interface Proposition {
  nom: string;
  confiance?: number;
  source: 'calendrier' | 'ia';
  /** Le seul événement du calendrier qui convient : « Prendre le nom du calendrier » le prend. */
  seul?: boolean;
}

function propositionDe(n: NomsPossibles | undefined, p: PropositionNom | undefined): Proposition | null {
  const choisi = n?.propose;
  if (!choisi) return null;
  return choisi.source === 'ia' ? { ...choisi, confiance: typeof p?.confiance === 'number' ? p.confiance : undefined } : choisi;
}

/** Un nom de l'IA est « sûr » à partir d'une confiance de 8 sur 10 ; en dessous, « à vérifier ». */
const CONFIANCE_SURE = 8;

/** Pourcentage arrondi d'une part (0,8 → 80). */
const pourcent = (part: number) => Math.round(part * 100);

function gpsMoyen(photos: FichierPlan[]): { lat: number; lon: number } | undefined {
  const g = photos.filter((f) => f.gps);
  if (!g.length) return undefined;
  return { lat: g.reduce((a, f) => a + f.gps!.lat, 0) / g.length, lon: g.reduce((a, f) => a + f.gps!.lon, 0) / g.length };
}

function requete(s: Session, c: CibleNommage, modele: string, o: { recherche: boolean } = reglagesNommage) {
  const dates = c.photos.map((f) => f.date).filter((d): d is string => !!d).sort();
  const calendrier = dates.length ? blocCalendrier(evenementsAutour(evenements.value, dates[0].slice(0, 10), dates.at(-1)!.slice(0, 10))) : '';
  return requeteNommage(c, modele, cleAnalyse, {
    recherche: o.recherche,
    // Les monuments sont toujours demandés : presque gratuit, et ils aident à nommer (D51).
    monuments: true,
    calendrier,
    contexte: s.projet.contexte,
    gps: gpsMoyen(c.photos),
    lieu: s.plan.dossiers.get(c.dossier)?.tri?.lieu,
  });
}

enregistrerAide({
  id: 'IA4',
  nom: aTraduire('Nommer les sorties avec l’IA'),
  etape: ETAPE.nommage,
  description: aTraduire('Propose un nom parlant (Theme_Lieu_JJ.MM.AA) pour chaque dossier, avec sa confiance et sa justification.'),
  envoi: aTraduire('5 photos par dossier, position GPS, événements du calendrier, contexte du projet'),
  web: () => reglagesNommage.recherche,
  usage: 'standard',
  estimer: (s) => {
    const cibles = dossiersDeLOnglet(s.plan, reglagesNommage.onglet);
    const aFaire = cibles.filter((c) => !s.ia.enCache(requete(s, c, modeleDe('standard')).cle));
    if (!cibles.length) return null;
    const e = estimationNommage(aFaire.map((c) => c.photos.length), modeleDe('standard'), { recherche: reglagesNommage.recherche });
    const n = pluriel(aFaire.length, 'dossier');
    const detail = reglagesNommage.onglet === 'a_nommer' ? t`${n} à nommer` : t`${n} déjà nommés`;
    return { usd: e.usd, appels: e.appels, detail: reglagesNommage.recherche ? t`${detail}, avec recherche web` : detail };
  },
  lancer: async (s, l) => {
    // Options figées au lancement : cocher « chercher aussi sur internet » ou changer d'onglet pendant l'exécution
    // ne change pas le coût accepté.
    const o = { ...reglagesNommage };
    const cibles = dossiersDeLOnglet(s.plan, o.onglet);
    const ctx = contexteExecution(s);
    const bilan: BilanEchecs = { echecs: 0 };
    let faits = 0;
    let lus = 0;
    const ajouts: Record<string, PropositionNom> = {};
    try {
      await enParallele(cibles, 3, async (c) => {
        if (l.arreter()) return;
        const r = requete(s, c, l.modele, o);
        const p = lireNommage(await essai(() => executerRequete(ctx, r, l.modele), bilan));
        if (p) {
          ajouts[c.dossier] = { ...p, cle: r.cle };
          lus++;
        }
        l.progres(++faits, cibles.length, c.nom);
        if (faits % 5 === 0) await s.aides.fusionner('IA4', { ...ajouts });
      });
    } finally {
      await s.aides.fusionner('IA4', ajouts);
    }
    return t`${pluriel(lus, 'nom proposé', 'noms proposés')} sur ${pluriel(cibles.length, 'dossier')}.${texteEchecs(bilan)}`;
  },
});

/**
 * Renomme plusieurs dossiers. Un nom déjà pris à côté est refusé, comme deux
 * noms identiques dans le même dossier au sein du lot (le plan ne voit pas
 * les renommages du lot avant leur application). `refus` : [dossier, nom].
 */
function renommerTous(plan: Plan, noms: [string, string, string?][]): { m: Modification | null; refus: [string, string][] } {
  const mods: (Modification | null)[] = [];
  const refus: [string, string][] = [];
  const pris = new Set<string>();
  for (const [id, nom, saisi] of noms) {
    const cle = `${plan.dossiers.get(id)?.parent}/${cleNom(nom)}`;
    try {
      if (pris.has(cle)) throw new Error(nom);
      // Le texte tapé (accents, espaces) reste le titre de la section dans l'album.
      mods.push(renommerDossier(plan, id, nom, saisi));
      pris.add(cle);
    } catch {
      refus.push([id, nom]);
    }
  }
  return { m: combiner(t`Renommer ${pluriel(noms.length - refus.length, 'dossier')}`, ...mods), refus };
}

/** Une puce de nom proposé : son texte (celui du champ), d'où il vient, l'avis de l'IA et son infobulle. */
interface Puce {
  nom: string;
  icone: NomIcone;
  /** D'où vient le nom, lu avec l'icône. */
  mot: string;
  titre: string;
  /** L'avis de l'IA sur son nom, écrit sur la puce (« sûr », « à vérifier »). */
  avis?: 'sur' | 'verifier';
}

/** Les noms proposés d'un dossier : un par événement du calendrier, le lieu, la proposition de l'IA ; deux puces qui donneraient le même dossier n'en font qu'une. */
function pucesDe(n: NomsPossibles | undefined, p: PropositionNom | undefined): Puce[] {
  const puces: Puce[] = [];
  const k = n?.calendrier ?? [];
  for (const x of k) {
    const titre = t`Calendrier : « ${x.titre} », pendant ${pourcent(x.part)} % des photos`;
    const plusieurs = k.length > 1 ? `\n${t`Plusieurs événements du calendrier conviennent : choisissez le bon.`}` : '';
    puces.push({ nom: x.nom, icone: 'calendrier', mot: t`calendrier`, titre: (x.long ? `${titre} ${t`(titre long : jamais pris d’office)`}` : titre) + plusieurs });
  }
  if (n?.lieu) puces.push({ nom: n.lieu, icone: 'lieu', mot: t`lieu`, titre: t`Lieu des photos` });
  if (n?.ia) {
    const confiance = typeof p?.confiance === 'number' ? p.confiance : null;
    // La raison de l'IA (activité, justification, monuments reconnus) passe dans l'infobulle (D112 point 11).
    const raison = [p?.activite, p?.justification].filter(Boolean).join('. ');
    const lignes = [
      confiance === null ? t`Proposition de l’IA` : t`Proposition de l’IA, confiance ${confiance} sur 10`,
      raison,
      p && p.monuments.length ? t`Reconnu : ${p.monuments.join(', ')}` : '',
    ].filter(Boolean);
    puces.push({ nom: n.ia, icone: 'etincelle', mot: t`IA`, titre: lignes.join('\n'), avis: confiance === null ? undefined : confiance >= CONFIANCE_SURE ? 'sur' : 'verifier' });
  }
  const vus = new Set<string>();
  return puces.filter((x) => {
    const cle = normaliserNom(x.nom).toLowerCase();
    if (!cle || vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/**
 * Les noms proposés, en puces de 28 px sur une ligne (D112 point 11). Toujours en bordure : ce sont des
 * propositions (règle d'or 3). Un clic remplit le champ, qui reste modifiable ; la puce dont le texte est dans le
 * champ est cochée ; celle du nom donné par « Renommer » est pleine (décidé). Au clavier, un seul arrêt de Tab
 * (groupe de choix) : les flèches passent d'une puce à l'autre et remplissent le champ, Tab va au champ.
 */
function NomsProposes({ puces, propre, actuel, saisir, id }: { puces: Puce[]; propre: string; actuel: string | null; saisir: (v: string) => void; id: string }) {
  const groupe = useRef<HTMLDivElement>(null);
  const cochee = puces.findIndex((x) => normaliserNom(x.nom) === propre);
  const aller = (i: number) => {
    const j = (i + puces.length) % puces.length;
    saisir(puces[j].nom);
    groupe.current?.querySelectorAll<HTMLElement>('[role=radio]')[j]?.focus();
  };
  return (
    <div class="noms-possibles" role="radiogroup" aria-labelledby={id} ref={groupe}>
      {puces.map((x, i) => {
        const dansLeChamp = i === cochee;
        const decide = actuel !== null && normaliserNom(x.nom) === actuel;
        return (
          <button
            key={x.nom}
            type="button"
            role="radio"
            class="nom-possible"
            data-source={x.icone}
            data-decide={decide ? '' : undefined}
            aria-checked={dansLeChamp}
            tabIndex={dansLeChamp || (cochee < 0 && i === 0) ? 0 : -1}
            title={x.titre}
            onClick={() => saisir(x.nom)}
            onKeyDown={(e) => {
              const pas = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (pas) aller(i + pas);
              else if (e.key === 'Home') aller(0);
              else if (e.key === 'End') aller(puces.length - 1);
              else return;
              e.preventDefault();
            }}
          >
            {dansLeChamp && (
              <span class="coche-nom">
                <Icone nom="coche" taille={14} />
              </span>
            )}
            <span class="icone-nom">
              <Icone nom={x.icone} taille={14} titre={x.mot} />
            </span>
            <span class="texte-nom">{x.nom}</span>
            {x.avis && <span class={`avis-nom ${x.avis}`}> · {x.avis === 'sur' ? t`sûr` : t`à vérifier`}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * La carte d'un dossier, de haut en bas (ordre de l'utilisateur, D112 point 11) : « Nom actuel », « Noms
 * proposés », « Nouveau nom » avec « Renommer » et ce que deviendra le nom (ou pourquoi il ne change pas).
 * `ancien` : le dossier vient d'être renommé ici (son nom d'avant) ; la carte reste affichée, avec son nouveau nom.
 * Entrée dans le champ renomme, comme le bouton.
 */
function Carte({
  c,
  puces,
  saisi,
  saisir,
  ancien,
  origine,
  exemple,
  renommer,
}: {
  c: CibleNommage;
  puces: Puce[];
  saisi: string;
  saisir: (v: string) => void;
  ancien?: string;
  /** Venu tel quel du dossier d'origine. */
  origine: boolean;
  /** Texte d'exemple du champ vide. */
  exemple: string;
  renommer: () => void;
}) {
  const dates = c.photos.map((f) => f.date).filter((d): d is string => !!d).sort();
  const propre = normaliserNom(saisi);
  const renomme = ancien !== undefined && ancien !== c.nom;
  const peut = !!propre && propre !== c.nom;
  const id = `noms-${c.dossier}`;
  const raison = !saisi.trim() ? t`garde son nom tant que le champ est vide` : !propre ? t`Écrivez un nom avec des lettres ou des chiffres` : propre === c.nom ? t`C’est déjà son nom` : '';
  const vignettes = c.photos.length > 1 ? [c.photos[0], c.photos.at(-1)!] : c.photos.slice(0, 1);
  return (
    <li class={`carte-nommage${renomme ? ' renomme' : ''}`} data-dossier={c.nom}>
      <div class="miniatures-nommage">
        {vignettes.map((f) => (
          <span key={f.id} class="case-vignette">
            <Miniature f={f} taille={64} />
          </span>
        ))}
      </div>
      <div class="corps-carte-nommage">
        <span class="libelle-nommage">{t`Nom actuel`}</span>
        <div class="nom-actuel">
          <strong class="nom-dossier-nommage">{c.nom}</strong>
          <span class="discret">
            {jourCourt(dates[0])}
            {dates.length > 1 && dates[0].slice(0, 10) !== dates.at(-1)!.slice(0, 10) ? ` – ${jourCourt(dates.at(-1))}` : ''} · {pluriel(c.photos.length, 'photo')}
            {c.parent ? ` · ${t`dans ${c.parent}`}` : ''}
            {origine && !renomme ? ` · ${t`votre dossier d’origine`}` : ''}
          </span>
          {renomme && (
            <span class="nom-renomme">
              <Icone nom="coche" taille={14} /> {t`renommé par vous (avant : ${ancien!})`}
            </span>
          )}
        </div>
        {puces.length > 0 && (
          <>
            <span class="libelle-nommage" id={id}>
              {t`Noms proposés`}
            </span>
            <NomsProposes puces={puces} propre={propre} actuel={renomme ? c.nom : null} saisir={saisir} id={id} />
          </>
        )}
        <label class="libelle-nommage" for={`champ-${c.dossier}`}>
          {t`Nouveau nom`}
        </label>
        <div class="nouveau-nom">
          <div class="ligne-champ-nommage">
            <input
              id={`champ-${c.dossier}`}
              class="nom-propose"
              value={saisi}
              placeholder={exemple}
              aria-label={t`Nouveau nom de ${c.nom}`}
              onInput={(e) => saisir(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (peut) renommer();
              }}
              title={t`Entrée pour renommer`}
            />
            {/* Désactivé, le bouton garde son nom et sa raison est écrite à côté (C-4.7). */}
            <button type="button" data-action="renommer" disabled={!peut} aria-describedby={peut ? `effet-${c.dossier}` : `raison-renommer-${c.dossier}`} onClick={renommer}>
              {t`Renommer`}
            </button>
            {peut ? (
              <span class="effet-nom discret" id={`effet-${c.dossier}`}>
                {t`deviendra « ${propre} »`}
              </span>
            ) : (
              <span class="effet-nom raison-desactivee" id={`raison-renommer-${c.dossier}`}>
                {raison}
              </span>
            )}
          </div>
          {peut && !respecteConvention(propre) && <div class="attention">{t`Convention : Theme_Lieu_JJ.MM.AA`}</div>}
        </div>
      </div>
    </li>
  );
}

/** Un nom encore dans son champ au moment de quitter l'étape ; `sur` : coché d'office. */
interface NomAAppliquer {
  c: CibleNommage;
  apres: string;
  sur: boolean;
}

/**
 * Noms dans les champs et pas encore appliqués, au moment de quitter l'étape
 * (D108) : la liste « avant → après », cochés d'office les noms sûrs (tapés,
 * seul événement du calendrier, IA de confiance 8 ou plus). On renomme les
 * cochés et on poursuit (rien de coché : on poursuit sans renommer), ou on
 * reste.
 */
function DialogueNomsAAppliquer({
  noms,
  revenir,
  appliquerNoms,
  ignorer,
  rester,
}: {
  noms: NomAAppliquer[];
  /** Sortie par « Revenir » : les boutons le disent. */
  revenir: boolean;
  appliquerNoms: (choisis: CibleNommage[]) => void;
  ignorer: () => void;
  rester: () => void;
}) {
  const bouton = useRef<HTMLButtonElement>(null);
  const [coches, setCoches] = useState(() => new Set(noms.filter((x) => x.sur).map((x) => x.c.dossier)));
  const choisis = noms.filter((x) => coches.has(x.c.dossier)).map((x) => x.c);
  useLayoutEffect(() => bouton.current?.focus(), []);
  const basculer = (id: string) => {
    const n = new Set(coches);
    if (!n.delete(id)) n.add(id);
    setCoches(n);
  };
  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && rester()}>
      <div
        class="dialogue"
        role="dialog"
        aria-modal="true"
        aria-label={t`Des noms ne sont pas encore appliqués`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') rester();
          e.stopPropagation();
        }}
      >
        <h2>{t`Des noms ne sont pas encore appliqués`}</h2>
        <p>{t`Cochez les noms à donner aux dossiers. Ceux marqués « à vérifier » sont des propositions peu sûres : relisez-les.`}</p>
        <ul class="choix-dossiers">
          {noms.map((x) => (
            <li key={x.c.dossier}>
              <label class="case">
                <input type="checkbox" checked={coches.has(x.c.dossier)} onChange={() => basculer(x.c.dossier)} /> {x.c.nom} → <strong>{x.apres}</strong>
                {!x.sur && <span class="discret"> {t`(à vérifier)`}</span>}
              </label>
            </li>
          ))}
        </ul>
        <div class="actions droite">
          <button type="button" onClick={rester}>
            {t`Rester sur la page`}
          </button>
          <button ref={bouton} type="button" class="principal" onClick={() => (choisis.length ? appliquerNoms(choisis) : ignorer())}>
            {revenir ? (choisis.length ? t`Renommer et revenir` : t`Revenir sans renommer`) : choisis.length ? t`Renommer et continuer` : t`Continuer sans renommer`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageNommage() {
  const s = session.value!;
  versionPlan.value;
  versionIA.value;
  const aNommer = useMemo(() => dossiersANommer(s.plan), [versionPlan.value]);
  const deja = useMemo(() => dossiersDejaNommes(s.plan), [versionPlan.value]);
  // Si rien n'est à nommer, la page s'ouvre sur « Déjà nommés » (D112 point 11).
  const [onglet, setOnglet] = useState<OngletNommage>(() => (aNommer.length ? 'a_nommer' : 'deja_nommes'));
  const [recherche, setRecherche] = useState(reglagesNommage.recherche);
  reglagesNommage.onglet = onglet;
  reglagesNommage.recherche = recherche;
  const [saisies, setSaisies] = useState<Record<string, string>>(() => (brouillon.projet === s.projet.id ? brouillon.saisies : {}));
  brouillon.projet = s.projet.id;
  brouillon.saisies = saisies;
  // Dossiers renommés sur cette page, avec leur nom d'avant : leur carte reste dans l'onglet où on les a renommés.
  const [renommes, setRenommes] = useState<Record<string, string>>({});
  const [sortie, setSortie] = useState<{ suite: () => void; noms: NomAAppliquer[]; revenir: boolean } | null>(null);
  const renomme = (c: CibleNommage) => renommes[c.dossier] !== undefined && renommes[c.dossier] !== c.nom;
  // Renommé ici depuis « À nommer » (son nom d'avant était automatique) : sa carte y reste, avec son nouveau nom.
  const venuDAuto = (id: string) => renommes[id] !== undefined && estNomAutomatique(renommes[id], s.plan.dossiers.get(id)?.tri?.nom);
  const cartesANommer = useMemo(() => {
    const presents = new Set(aNommer.map((c) => c.dossier));
    const faits = deja.filter((c) => !presents.has(c.dossier) && venuDAuto(c.dossier));
    return faits.length ? [...aNommer, ...faits] : aNommer;
  }, [aNommer, deja, renommes]);
  const automatiques = useMemo(() => new Set(aNommer.map((c) => c.dossier)), [aNommer]);
  // Même objet tant que l'IA n'a rien ajouté : les noms possibles ne sont recalculés qu'au besoin. Un calcul par
  // onglet : les numéros des noms en double (« … 2 ») ne dépendent que des dossiers de l'onglet.
  const lues = s.aides.get<Record<string, PropositionNom>>('IA4');
  const propositions = lues ?? {};
  const possiblesA = useMemo(() => nomsPossibles(s.plan, cartesANommer, evenements.value, propositions), [cartesANommer, evenements.value, lues]);
  const possiblesD = useMemo(() => nomsPossibles(s.plan, deja, evenements.value, propositions), [deja, evenements.value, lues]);
  const cartes = onglet === 'a_nommer' ? cartesANommer : deja;
  const possibles = onglet === 'a_nommer' ? possiblesA : possiblesD;
  // Le nom pris d'office : seulement pour un dossier encore au nom automatique (« Déjà nommés » : le champ reste vide).
  const proposition = (c: CibleNommage) => (automatiques.has(c.dossier) ? propositionDe(possiblesA.get(c.dossier), propositions[c.dossier]) : null);
  // Le champ : ce qui est tapé ou choisi, sinon le nom pris d'office (calendrier ou IA), sinon rien.
  const saisi = (c: CibleNommage) => saisies[c.dossier] ?? (renomme(c) ? '' : (proposition(c)?.nom ?? ''));
  const nouveauNom = (c: CibleNommage) => {
    const n = normaliserNom(saisi(c));
    return n && n !== c.nom ? n : '';
  };
  // Les moins sûrs d'abord ; le calendrier, écrit par la famille, compte comme une confiance de 9.
  const rang = (c: CibleNommage) => {
    const pr = proposition(c);
    return pr?.source === 'calendrier' ? 9 : (pr?.confiance ?? 11);
  };
  const triees = onglet === 'a_nommer' ? [...cartes].sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom)) : cartes;
  // Tous les dossiers de la page (les deux onglets) : un nom tapé dans l'autre onglet n'est pas oublié en quittant.
  const toutes = useMemo(() => {
    const ids = new Set(cartesANommer.map((c) => c.dossier));
    return [...cartesANommer, ...deja.filter((c) => !ids.has(c.dossier))];
  }, [cartesANommer, deja]);
  const surs = aNommer.filter((c) => proposition(c)?.source === 'ia' && (proposition(c)?.confiance ?? 0) >= CONFIANCE_SURE && nouveauNom(c));
  // Le seul événement du calendrier qui convient, s'il est encore dans le champ (ni tapé ni choisi autrement).
  const duCalendrier = aNommer.filter((c) => {
    const pr = proposition(c);
    const tape = saisies[c.dossier];
    return pr?.source === 'calendrier' && pr.seul && (tape === undefined || normaliserNom(tape) === normaliserNom(pr.nom)) && nouveauNom(c);
  });
  // Tous les noms à appliquer : ceux du calendrier, de l'IA (même à vérifier) et ceux tapés.
  const tousNoms = toutes.filter((c) => nouveauNom(c));
  const nomsANommer = aNommer.filter((c) => nouveauNom(c));
  const peuSurs = nomsANommer.filter((c) => saisies[c.dossier] === undefined && proposition(c)?.source !== 'calendrier' && (proposition(c)?.confiance ?? 0) < CONFIANCE_SURE);
  // Noms tapés à la main et pas encore appliqués : on ne les perd pas en quittant l'étape.
  const enAttente = toutes.filter((c) => saisies[c.dossier] !== undefined && nouveauNom(c));
  // Coché d'office dans le récapitulatif : tapé ou choisi, seul événement du calendrier, IA sûre.
  const sur = (c: CibleNommage) => {
    const pr = proposition(c);
    return saisies[c.dossier] !== undefined || (pr?.source === 'calendrier' && !!pr.seul) || (pr?.source === 'ia' && (pr.confiance ?? 0) >= CONFIANCE_SURE);
  };
  // Onglet fermé avec des noms tapés : le navigateur demande confirmation, tant que la page est ouverte.
  const attente = enAttente.length > 0;
  useEffect(() => {
    if (!attente) return;
    const retenir = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', retenir);
    return () => removeEventListener('beforeunload', retenir);
  }, [attente]);

  /**
   * Renomme ; un nom déjà pris est signalé. Rend le nombre de dossiers renommés. Le texte tapé (accents, espaces) est gardé pour les titres de l'album.
   * `bilan` : message d'ensemble même pour un seul dossier (renommé depuis le récapitulatif, la page se ferme).
   */
  const renommer = (liste: CibleNommage[], bilan = liste.length > 1): number => {
    const noms = liste.map((c): [string, string, string] => [c.dossier, nouveauNom(c), saisi(c)]);
    const r = renommerTous(s.plan, noms);
    appliquer(r.m);
    const refuses = new Set(r.refus.map(([id]) => id));
    const faits = noms.filter(([id]) => !refuses.has(id));
    const ids = new Set(faits.map(([id]) => id));
    setRenommes({ ...renommes, ...Object.fromEntries(liste.filter((c) => ids.has(c.dossier)).map((c) => [c.dossier, renomme(c) ? renommes[c.dossier] : c.nom])) });
    // Le nom appliqué n'est plus « en attente » ; le champ se vide (le dossier garde son nom tant qu'il le reste) ;
    // après Ctrl+Z, il retrouve le nom pris d'office.
    setSaisies(Object.fromEntries(Object.entries(saisies).filter(([id]) => !ids.has(id))));
    if (!bilan) {
      if (r.refus.length) notifier('erreur', t`« ${noms[0][1]} » existe déjà à cet endroit.`);
      else notifier('ok', t`Renommé « ${noms[0][1]} ».`, { libelle: t`Annuler`, faire: annuler });
    } else {
      const texte = pluriel(faits.length, 'dossier renommé', 'dossiers renommés');
      const pris = r.refus.map(([, nom]) => nom);
      notifier(pris.length ? 'erreur' : 'ok', pris.length ? t`${texte} ; ${pris.length} nom(s) déjà pris : ${pris.join(', ')}.` : `${texte}.`, { libelle: t`Annuler`, faire: annuler });
    }
    return faits.length;
  };

  const accepterTout = async () => {
    const ok =
      !peuSurs.length ||
      (await confirmer(
        t`Accepter ${pluriel(nomsANommer.length, 'nom')} ?`,
        t`Dont ${pluriel(peuSurs.length, 'nom de l’IA à vérifier', 'noms de l’IA à vérifier')} : relisez-les si possible. Ctrl+Z annule.`,
        t`Tout accepter`,
      ));
    if (ok) renommer(nomsANommer);
  };

  /** Quitter l'étape : s'il reste des noms dans les champs (`liste`), demander lesquels appliquer. */
  const quitter = (suite: () => void, liste: CibleNommage[], revenir = false) => {
    if (liste.length) setSortie({ suite, revenir, noms: liste.map((c) => ({ c, apres: nouveauNom(c), sur: sur(c) })) });
    else suite();
  };

  // Les onglets disent leur compte : ce qui reste à nommer, ce qui l'est déjà (D112 point 11).
  const comptes: Record<OngletNommage, number> = { a_nommer: aNommer.length, deja_nommes: deja.length };
  const ONGLETS: [OngletNommage, string][] = [
    ['a_nommer', t`À nommer`],
    ['deja_nommes', t`Déjà nommés`],
  ];
  const n = dossiersDeLOnglet(s.plan, onglet).length;
  const nomIA =
    onglet === 'a_nommer'
      ? n === 1
        ? t`Nommer le dossier avec l’IA`
        : t`Nommer les ${nombre(n)} avec l’IA`
      : n === 1
        ? t`Nommer ce dossier avec l’IA`
        : t`Nommer ces ${nombre(n)} avec l’IA`;
  const exemple = (puces: Puce[]) => t`Par exemple : ${puces[0]?.nom ?? t`Anniversaire de Lea 26.01.25`}`;

  return (
    <div class="page large avec-barre page-nommage">
      {/* Forme E (D112) : les onglets partent avec la page ; la vue en cours reste écrite dans la ligne (« À nommer ▾ »). */}
      <LigneEtape
        titre={t`Nommage`}
        aide={{ cle: 'nommage' }}
        vue={{
          nom: t`Dossiers montrés`,
          choix: ONGLETS.map(([cle, libelle]) => ({ cle, libelle: `${libelle} · ${nombre(comptes[cle])}` })),
          actuelle: onglet,
          choisir: (v) => setOnglet(v as OngletNommage),
          repere: '.onglets-nommage',
        }}
      />
      <AideEtape cle="nommage">
        {t`Donnez à chaque dossier un nom parlant, sur le modèle « Theme_Lieu_JJ.MM.AA » (Anniversaire_Lea_26.01.25). « À nommer » : les dossiers qui portent encore le nom donné par le tri (lieu et date) ; « Déjà nommés » : ceux que vous avez nommés, ou venus tels quels de votre dossier d’origine. Sous « Nom actuel », les noms proposés : un clic en met un dans le champ « Nouveau nom »,`}{' '}
        <Icone nom="calendrier" taille={16} /> {t`un événement du calendrier pendant lequel les photos ont été prises (« 18 ans de Lea »),`} <Icone nom="lieu" taille={16} /> {t`le lieu, ou`}{' '}
        <Icone nom="etincelle" taille={16} />{' '}
        {t`la proposition de l’IA, « sûre » ou « à vérifier » (sa raison dans l’infobulle). L’IA regarde quelques photos, le lieu, le calendrier et le contexte du projet ; son prix s’affiche sur le bouton avant de la lancer. Vous pouvez aussi écrire votre nom : rien n’est renommé sans « Renommer » (ou Entrée dans le champ), et Ctrl+Z l’annule.`}
      </AideEtape>
      <div class="outils-nommage">
        <nav class="onglets-doublons onglets-nommage" aria-label={t`Dossiers montrés`}>
          {ONGLETS.map(([o, nom]) => (
            <button key={o} type="button" class={`onglet-doublons${o === onglet ? ' actif' : ''}`} data-onglet={o} aria-current={o === onglet ? 'page' : undefined} onClick={() => setOnglet(o)}>
              {nom} <span class="compte gris">{nombre(comptes[o])}</span>
            </button>
          ))}
        </nav>
        <div class="actions-nommage">
          {onglet === 'a_nommer' && surs.length > 0 && (
            <button type="button" class="principal" data-action="accepter-surs" onClick={() => renommer(surs)} title={t`Les noms de l’IA de confiance 8 sur 10 ou plus. Ctrl+Z annule.`}>
              {t`Accepter les noms sûrs de l’IA (${pluriel(surs.length, 'dossier')})`}
            </button>
          )}
          {onglet === 'a_nommer' && duCalendrier.length > 0 && (
            <button
              type="button"
              class={surs.length ? '' : 'principal'}
              data-action="prendre-calendrier"
              onClick={() => renommer(duCalendrier)}
              title={t`Seulement là où un seul événement du calendrier convient ; quand plusieurs conviennent, choisissez dans « Noms proposés ». Ctrl+Z annule.`}
            >
              <Icone nom="calendrier" taille={16} />
              {t`Prendre le nom du calendrier (${pluriel(duCalendrier.length, 'dossier')})`}
            </button>
          )}
          {onglet === 'a_nommer' && peuSurs.length > 0 && (
            <button type="button" data-action="tout-accepter" onClick={() => void accepterTout()} title={t`Aussi les noms de l’IA à vérifier (une confirmation est demandée)`}>
              {t`Tout accepter (${pluriel(nomsANommer.length, 'nom')})…`}
            </button>
          )}
          {/* Le bouton dit sa portée et son prix ; la recherche sur internet, collée à lui, change ce prix (règle d'or 5). */}
          <AideIA fonction="IA4" nom={nomIA} enLigne>
            <label class="case" title={t`Événements locaux, lieux touristiques, résultats de course… (environ 0,09 CHF de plus par dossier)`}>
              <input type="checkbox" checked={recherche} onChange={(e) => setRecherche(e.currentTarget.checked)} /> {t`chercher aussi sur internet`}
            </label>
          </AideIA>
        </div>
      </div>
      {cartes.length === 0 ? (
        <p class="encart">
          {onglet === 'a_nommer'
            ? t`Aucun dossier au nom automatique : tout est déjà nommé. Vous pouvez encore les renommer dans « Déjà nommés ».`
            : t`Aucun dossier déjà nommé : ils sont tous dans « À nommer ».`}
        </p>
      ) : (
        <ul class="cartes-nommage">
          {triees.map((c) => {
            const puces = pucesDe(possibles.get(c.dossier), propositions[c.dossier]);
            return (
              <Carte
                key={c.dossier}
                c={c}
                puces={puces}
                saisi={saisi(c)}
                saisir={(v) => setSaisies({ ...saisies, [c.dossier]: v })}
                ancien={renommes[c.dossier]}
                origine={s.plan.dossiers.get(c.dossier)?.origine === 'source'}
                exemple={exemple(puces)}
                renommer={() => renommer([c])}
              />
            );
          })}
        </ul>
      )}
      <BarreValidation
        resume={`${aNommer.length === 0 ? t`Aucun dossier à nommer` : aNommer.length === 1 ? t`1 dossier à nommer : il garde son nom actuel tant que vous ne le renommez pas` : t`${nombre(aNommer.length)} dossiers à nommer : ils gardent leur nom actuel tant que vous ne les renommez pas`} · ${pluriel(aNommer.filter((c) => proposition(c)).length, 'proposition')}`}
        revenir={() => quitter(() => revenirDe('nommage'), enAttente, true)}
        valider={() => quitter(() => validerEtape('nommage'), tousNoms)}
        // Plein quand aucun lot de noms n'attend d'être accepté (C-4.1).
        fini={!surs.length && !duCalendrier.length}
      />
      {sortie && (
        <DialogueNomsAAppliquer
          noms={sortie.noms}
          revenir={sortie.revenir}
          rester={() => setSortie(null)}
          ignorer={() => {
            setSortie(null);
            sortie.suite();
            // Les noms tapés écartés ne reviennent pas au retour sur la page.
            brouillon.saisies = {};
          }}
          appliquerNoms={(choisis) => {
            setSortie(null);
            // Un nom refusé (déjà pris) garde l'utilisateur sur la page, avec le message.
            if (renommer(choisis, true) !== choisis.length) return;
            sortie.suite();
            // La page est quittée sans se redessiner : les noms tapés (appliqués ou décochés) ne reviennent pas, même après Ctrl+Z.
            brouillon.saisies = {};
          }}
        />
      )}
    </div>
  );
}
