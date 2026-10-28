// Étape « Nommage » (SPEC § 6.6, IA4, script 04) : un tableau des dossiers,
// le nom proposé modifiable, la confiance et la justification ; l'IA combine
// photos, GPS, calendrier, contexte et recherche web, et repère les monuments
// dans le même appel (D51). Sous chaque nom, les noms possibles en un clic :
// les événements du calendrier pendant lesquels les photos ont été prises, le
// lieu du tri et la proposition de l'IA (D83) ; l'utilisateur peut aussi
// écrire le sien.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { blocCalendrier, evenementsAutour } from '../../lib/ics';
import { aTraduire, t } from '../../lib/langue';
import { cleNom } from '../../lib/noms';
import { dossiersANommer, estimationNommage, lireNommage, nomsPossibles, normaliserNom, requeteNommage, respecteConvention, type CibleNommage, type NomPropose, type NomsPossibles } from '../../lib/nommage';
import { combiner, renommerDossier, type FichierPlan, type Modification, type Plan } from '../../lib/plan';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { enParallele } from '../../navigateur/workers';
import { BarreValidation, RaisonDesactivee, TeteEtape } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { Miniature } from '../composants/GrillePhotos';
import { Icone, type NomIcone } from '../composants/Icones';
import { annuler, appliquer, contexteExecution, evenements, notifier, revenirDe, session, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { ETAPE } from '../../navigateur/projet';
import { jourCourt, nombre, pluriel } from '../format';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs } from './AidesIA';

/** Réglages de l'aide, partagés entre la page et le catalogue. */
const reglagesNommage = { tous: false, recherche: true };

/** Noms tapés et pas encore appliqués : gardés si l'on quitte la page par la frise ou le menu (D108). */
const brouillon: { projet?: string; saisies: Record<string, string> } = { saisies: {} };

interface PropositionNom extends NomPropose {
  cle: string;
}

/**
 * Nom pris d'office pour le champ (`nomsPossibles`) : le meilleur événement
 * du calendrier (sauf égalité), sinon la proposition de l'IA, avec sa
 * confiance ; le calendrier n'en a pas.
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
    const cibles = dossiersANommer(s.plan, reglagesNommage.tous);
    const aFaire = cibles.filter((c) => !s.ia.enCache(requete(s, c, modeleDe('standard')).cle));
    if (!cibles.length) return null;
    const e = estimationNommage(aFaire.map((c) => c.photos.length), modeleDe('standard'), { recherche: reglagesNommage.recherche });
    const n = pluriel(aFaire.length, 'dossier');
    return { usd: e.usd, appels: e.appels, detail: reglagesNommage.recherche ? t`${n} à nommer, avec recherche web` : t`${n} à nommer` };
  },
  lancer: async (s, l) => {
    // Options figées au lancement : cocher « Recherche web » pendant l'exécution ne change pas le coût accepté.
    const o = { ...reglagesNommage };
    const cibles = dossiersANommer(s.plan, o.tous);
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

/**
 * Les noms possibles d'un dossier, en puces sous le champ : un par événement
 * du calendrier, le lieu, la proposition de l'IA. Un clic remplit le champ,
 * qui reste modifiable ; la puce du nom qu'il contient est marquée. Deux
 * puces qui donneraient le même dossier n'en font qu'une.
 */
function NomsAuChoix({ n, p, propre, saisir }: { n?: NomsPossibles; p?: PropositionNom; propre: string; saisir: (v: string) => void }) {
  const puces: { nom: string; icone: NomIcone; mot: string; titre: string }[] = [];
  for (const k of n?.calendrier ?? []) {
    const titre = t`Calendrier : « ${k.titre} », pendant ${pourcent(k.part)} % des photos`;
    puces.push({ nom: k.nom, icone: 'calendrier', mot: t`calendrier`, titre: k.long ? `${titre} ${t`(titre long : jamais pris d’office)`}` : titre });
  }
  if (n?.lieu) puces.push({ nom: n.lieu, icone: 'lieu', mot: t`lieu`, titre: t`Lieu des photos` });
  if (n?.ia) {
    const confiance = typeof p?.confiance === 'number' ? p.confiance : null;
    puces.push({ nom: n.ia, icone: 'etincelle', mot: t`IA`, titre: confiance === null ? t`Proposition de l’IA` : t`Proposition de l’IA, confiance ${confiance} sur 10` });
  }
  const vus = new Set<string>();
  const uniques = puces.filter((x) => {
    const cle = normaliserNom(x.nom).toLowerCase();
    if (!cle || vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
  if (!uniques.length) return null;
  return (
    <div class="noms-possibles" role="group" aria-label={t`Noms possibles`}>
      {uniques.map((x) => (
        <button key={x.nom} type="button" class="nom-possible" aria-pressed={normaliserNom(x.nom) === propre} title={x.titre} onClick={() => saisir(x.nom)}>
          <span class="icone-nom">
            <Icone nom={x.icone} taille={16} titre={x.mot} />
          </span>
          <span class="texte-nom">{x.nom}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Une ligne du tableau. `ancien` : le dossier vient d'être renommé ici (son
 * nom d'avant) ; la ligne reste affichée, cochée, avec son nouveau nom.
 * Entrée dans le champ applique le nom, comme le bouton « Renommer ».
 */
function Ligne({
  c,
  p,
  n,
  choisie,
  saisi,
  saisir,
  ancien,
  renommer,
}: {
  c: CibleNommage;
  p?: PropositionNom;
  n?: NomsPossibles;
  choisie: Proposition | null;
  saisi: string;
  saisir: (v: string) => void;
  ancien?: string;
  renommer: () => void;
}) {
  const dates = c.photos.map((f) => f.date).filter((d): d is string => !!d).sort();
  const evts = dates.length ? evenementsAutour(evenements.value, dates[0].slice(0, 10), dates.at(-1)!.slice(0, 10)) : [];
  const propre = normaliserNom(saisi);
  const renomme = ancien !== undefined && ancien !== c.nom;
  const k = n?.calendrier ?? [];
  return (
    <tr class={renomme ? 'renomme' : choisie?.source === 'ia' && (choisie.confiance ?? 0) < 6 ? 'a-verifier' : ''}>
      <td>
        {/* Le flex sur un div : posé sur le td, la cellule perdait la hauteur de la ligne et décalait ses traits. */}
        <div class="miniatures-nommage">
          {c.photos.slice(0, 1).concat(c.photos.length > 2 ? [c.photos[Math.floor(c.photos.length / 2)]] : [], c.photos.length > 1 ? [c.photos.at(-1)!] : []).map((f) => (
            <Miniature key={f.id} f={f} taille={64} />
          ))}
        </div>
      </td>
      <td>
        {renomme ? (
          <>
            <strong class="nom-renomme">
              <Icone nom="coche" taille={16} /> {c.nom}
            </strong>
            <div class="discret">{t`renommé, avant : ${ancien}`}</div>
          </>
        ) : (
          <strong>{c.nom}</strong>
        )}
        {c.parent && <div class="discret">{t`dans ${c.parent}`}</div>}
        <div class="discret">
          {jourCourt(dates[0])}
          {dates.length > 1 && dates[0].slice(0, 10) !== dates.at(-1)!.slice(0, 10) ? ` – ${jourCourt(dates.at(-1))}` : ''} · {pluriel(c.photos.length, 'photo')}
        </div>
      </td>
      <td>
        <input
          class="nom-propose"
          value={saisi}
          onInput={(e) => saisir(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (propre && propre !== c.nom) renommer();
          }}
          aria-label={t`Nouveau nom de ${c.nom}`}
          title={t`Entrée pour renommer`}
        />
        {saisi && propre && propre !== saisi && <div class="discret">{t`deviendra « ${propre} »`}</div>}
        {propre && !respecteConvention(propre) && <div class="attention">{t`Convention : Theme_Lieu_JJ.MM.AA`}</div>}
        <NomsAuChoix n={n} p={p} propre={propre} saisir={saisir} />
      </td>
      <td class="n" title={choisie?.source === 'calendrier' ? t`D’après le calendrier` : t`Confiance de l’IA, de 1 à 10`}>
        {choisie?.source === 'calendrier' ? <Icone nom="calendrier" taille={16} titre={t`calendrier`} /> : (choisie?.confiance ?? '')}
      </td>
      <td class="justification">
        {p?.activite && <strong>{p.activite}. </strong>}
        {p?.justification}
        {k.length === 1 && (
          <div class="evenements">
            {k[0].long ? t`Calendrier : « ${k[0].titre} » ; titre long, à raccourcir si besoin` : t`Calendrier : « ${k[0].titre} », pendant ${pourcent(k[0].part)} % des photos`}
          </div>
        )}
        {k.length > 1 && <div class="evenements">{t`Plusieurs événements du calendrier conviennent : cliquez sur le bon nom.`}</div>}
        {p && p.monuments.length > 0 && <div class="monuments">{t`Reconnu : ${p.monuments.join(', ')}`}</div>}
        {!k.length && evts.length > 0 && <div class="evenements">{t`Calendrier : ${evts.slice(0, 3).map((e) => e.titre).join(' · ')}`}</div>}
      </td>
      <td>
        {/* Désactivé, le bouton garde son nom et sa raison est écrite dessous (C-4.7). */}
        <button type="button" disabled={!propre || propre === c.nom} aria-describedby={!propre || propre === c.nom ? `raison-renommer-${c.dossier}` : undefined} onClick={renommer}>
          {t`Renommer`}
        </button>
        <div>
          <RaisonDesactivee id={`raison-renommer-${c.dossier}`} raison={!propre ? t`Écrivez d’abord un nom` : propre === c.nom && t`C’est déjà son nom`} />
        </div>
      </td>
    </tr>
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
  const [tous, setTous] = useState(reglagesNommage.tous);
  const [recherche, setRecherche] = useState(reglagesNommage.recherche);
  reglagesNommage.tous = tous;
  reglagesNommage.recherche = recherche;
  const [saisies, setSaisies] = useState<Record<string, string>>(() => (brouillon.projet === s.projet.id ? brouillon.saisies : {}));
  brouillon.projet = s.projet.id;
  brouillon.saisies = saisies;
  // Dossiers renommés sur cette page, avec leur nom d'avant : ils restent dans le tableau, cochés.
  const [renommes, setRenommes] = useState<Record<string, string>>({});
  const [sortie, setSortie] = useState<{ suite: () => void; noms: NomAAppliquer[]; revenir: boolean } | null>(null);
  const cibles = useMemo(() => {
    const base = dossiersANommer(s.plan, tous);
    const presents = new Set(base.map((c) => c.dossier));
    const faits = new Set(Object.keys(renommes).filter((id) => !presents.has(id)));
    return faits.size ? [...base, ...dossiersANommer(s.plan, true).filter((c) => faits.has(c.dossier))] : base;
  }, [versionPlan.value, tous, renommes]);
  // Même objet tant que l'IA n'a rien ajouté : les noms possibles ne sont recalculés qu'au besoin.
  const lues = s.aides.get<Record<string, PropositionNom>>('IA4');
  const propositions = lues ?? {};
  const possibles = useMemo(() => nomsPossibles(s.plan, cibles, evenements.value, propositions), [cibles, evenements.value, lues]);
  const proposition = (c: CibleNommage) => propositionDe(possibles.get(c.dossier), propositions[c.dossier]);
  const renomme = (c: CibleNommage) => renommes[c.dossier] !== undefined && renommes[c.dossier] !== c.nom;
  // Le champ : ce qui est tapé ou choisi, sinon le nom donné ici, sinon le nom pris d'office (calendrier ou IA).
  const saisi = (c: CibleNommage) => saisies[c.dossier] ?? (renomme(c) ? c.nom : (proposition(c)?.nom ?? ''));
  const nouveauNom = (c: CibleNommage) => {
    const n = normaliserNom(saisi(c));
    return n && n !== c.nom ? n : '';
  };
  // Les moins sûrs d'abord ; le calendrier, écrit par la famille, compte comme une confiance de 9.
  const rang = (c: CibleNommage) => {
    const pr = proposition(c);
    return pr?.source === 'calendrier' ? 9 : (pr?.confiance ?? 11);
  };
  const triees = [...cibles].sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom));
  const surs = cibles.filter((c) => proposition(c)?.source === 'ia' && (proposition(c)?.confiance ?? 0) >= 8 && nouveauNom(c));
  // Le seul événement du calendrier qui convient, s'il est encore dans le champ (ni tapé ni choisi autrement).
  const duCalendrier = cibles.filter((c) => {
    const pr = proposition(c);
    const tape = saisies[c.dossier];
    return pr?.source === 'calendrier' && pr.seul && (tape === undefined || normaliserNom(tape) === normaliserNom(pr.nom)) && nouveauNom(c);
  });
  // Tous les noms à appliquer : ceux du calendrier, de l'IA (même de confiance basse) et ceux tapés.
  const tousNoms = cibles.filter((c) => nouveauNom(c));
  const peuSurs = tousNoms.filter((c) => saisies[c.dossier] === undefined && proposition(c)?.source !== 'calendrier' && (proposition(c)?.confiance ?? 0) < 8);
  // Noms tapés à la main et pas encore appliqués : on ne les perd pas en quittant l'étape.
  const enAttente = cibles.filter((c) => saisies[c.dossier] !== undefined && nouveauNom(c));
  // Coché d'office dans le récapitulatif : tapé ou choisi, seul événement du calendrier, IA de confiance 8 ou plus.
  const sur = (c: CibleNommage) => {
    const pr = proposition(c);
    return saisies[c.dossier] !== undefined || (pr?.source === 'calendrier' && !!pr.seul) || (pr?.source === 'ia' && (pr.confiance ?? 0) >= 8);
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
   * `bilan` : message même pour un seul dossier (renommé depuis le récapitulatif, la page se ferme).
   */
  const renommer = (liste: CibleNommage[], bilan = liste.length > 1): number => {
    const noms = liste.map((c): [string, string, string] => [c.dossier, nouveauNom(c), saisi(c)]);
    const r = renommerTous(s.plan, noms);
    appliquer(r.m);
    const refuses = new Set(r.refus.map(([id]) => id));
    const faits = noms.filter(([id]) => !refuses.has(id));
    const ids = new Set(faits.map(([id]) => id));
    setRenommes({ ...renommes, ...Object.fromEntries(liste.filter((c) => ids.has(c.dossier)).map((c) => [c.dossier, renomme(c) ? renommes[c.dossier] : c.nom])) });
    // Le nom appliqué n'est plus « en attente » ; après Ctrl+Z, le champ retrouve le nom pris d'office.
    setSaisies(Object.fromEntries(Object.entries(saisies).filter(([id]) => !ids.has(id))));
    if (!bilan) {
      if (r.refus.length) notifier('erreur', t`« ${noms[0][1]} » existe déjà à cet endroit.`);
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
        t`Accepter ${pluriel(tousNoms.length, 'nom')} ?`,
        t`Dont ${pluriel(peuSurs.length, 'nom proposé avec une confiance inférieure à 8', 'noms proposés avec une confiance inférieure à 8')} : relisez-les si possible. Ctrl+Z annule.`,
        t`Tout accepter`,
      ));
    if (ok) renommer(tousNoms);
  };

  /** Quitter l'étape : s'il reste des noms dans les champs (`liste`), demander lesquels appliquer. */
  const quitter = (suite: () => void, liste: CibleNommage[], revenir = false) => {
    if (liste.length) setSortie({ suite, revenir, noms: liste.map((c) => ({ c, apres: nouveauNom(c), sur: sur(c) })) });
    else suite();
  };

  return (
    <div class="page large avec-barre page-nommage">
      <TeteEtape numero={ETAPE.nommage} titre={t`Nommage`} cle="nommage">
        {t`Donnez à chaque dossier un nom parlant, sur le modèle « Theme_Lieu_JJ.MM.AA » (Anniversaire_Lea_26.01.25). Sous chaque nom, un clic choisit :`} <Icone nom="calendrier" taille={16} />{' '}
        {t`un événement du calendrier pendant lequel les photos ont été prises (« 18 ans de Lea »),`} <Icone nom="lieu" taille={16} /> {t`le lieu, ou`} <Icone nom="etincelle" taille={16} />{' '}
        {t`la proposition de l’IA, qui regarde quelques photos, le lieu, le calendrier et le contexte du projet. Vous pouvez aussi écrire le vôtre : vous gardez le dernier mot.`}
      </TeteEtape>
      <div class="reglages-etape ligne">
        <label class="case">
          <input type="checkbox" checked={tous} onChange={(e) => setTous(e.currentTarget.checked)} />{' '}
          {t`Tous les dossiers (pas seulement les noms automatiques comme « Ko_Samui_18.07.26 »)`}
        </label>
        <label class="case" title={t`Événements locaux, lieux touristiques, résultats de course… (environ 0,09 CHF de plus par dossier)`}>
          <input type="checkbox" checked={recherche} onChange={(e) => setRecherche(e.currentTarget.checked)} /> {t`Recherche web`}
        </label>
      </div>
      <AideIA fonction="IA4" />
      {(surs.length > 0 || peuSurs.length > 0 || duCalendrier.length > 0) && (
        <p class="actions-nommage">
          {surs.length > 0 && (
            <button type="button" class="principal" onClick={() => renommer(surs)}>
              {surs.length > 1 ? t`Accepter les ${nombre(surs.length)} noms de confiance 8 ou plus` : t`Accepter le nom de confiance 8 ou plus`}
            </button>
          )}
          {duCalendrier.length > 0 && (
            <button
              type="button"
              class={surs.length ? '' : 'principal'}
              onClick={() => renommer(duCalendrier)}
              title={t`Seulement là où un seul événement du calendrier convient ; quand plusieurs conviennent, choisissez sous le nom. Ctrl+Z annule.`}
            >
              {duCalendrier.length > 1
                ? t`Prendre le nom du calendrier pour les ${nombre(duCalendrier.length)} dossiers qui en ont un`
                : t`Prendre le nom du calendrier pour le dossier qui en a un`}
            </button>
          )}
          {peuSurs.length > 0 && (
            <button type="button" onClick={() => void accepterTout()} title={t`Aussi les noms de confiance inférieure à 8 (une confirmation est demandée)`}>
              {t`Tout accepter (${pluriel(tousNoms.length, 'nom')})…`}
            </button>
          )}
        </p>
      )}
      {cibles.length === 0 ? (
        <p class="encart">{t`Aucun dossier au nom automatique : tout est déjà nommé. Cochez « Tous les dossiers » pour en renommer d’autres.`}</p>
      ) : (
        <table class="tableau nommage">
          <thead>
            <tr>
              <th />
              <th>{t`Dossier`}</th>
              <th>{t`Nouveau nom`}</th>
              <th class="n" title={t`Confiance de l’IA, de 1 à 10`}>
                {t`Conf.`}
              </th>
              <th>{t`Justification`}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {triees.map((c) => (
              <Ligne
                key={c.dossier}
                c={c}
                p={propositions[c.dossier]}
                n={possibles.get(c.dossier)}
                choisie={proposition(c)}
                saisi={saisi(c)}
                saisir={(v) => setSaisies({ ...saisies, [c.dossier]: v })}
                ancien={renommes[c.dossier]}
                renommer={() => renommer([c])}
              />
            ))}
          </tbody>
        </table>
      )}
      <BarreValidation
        resume={`${(() => {
          const reste = cibles.filter((c) => !renomme(c)).length;
          return reste === 0 ? t`aucun dossier à nommer` : reste === 1 ? t`1 dossier à nommer : il garde son nom actuel` : t`${nombre(reste)} dossiers à nommer : ils gardent leur nom actuel`;
        })()} · ${pluriel(cibles.filter((c) => proposition(c)).length, 'proposition')}`}
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

