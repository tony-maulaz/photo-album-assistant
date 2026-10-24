// Étape « Nommage » (SPEC § 6.6, IA4, script 04) : un tableau des dossiers,
// le nom proposé modifiable, la confiance et la justification ; l'IA combine
// photos, GPS, calendrier, contexte et recherche web, et repère les monuments
// dans le même appel (D51). Sans IA, le titre de l'événement du calendrier
// pendant lequel les photos ont été prises est proposé (D83).

import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { blocCalendrier, evenementDesPhotos, evenementsAutour } from '../../lib/ics';
import { aTraduire, t, tc } from '../../lib/langue';
import { dossiersANommer, estimationNommage, lieuDuDossier, lireNommage, nomDepuisEvenement, normaliserNom, requeteNommage, respecteConvention, type CibleNommage, type NomPropose } from '../../lib/nommage';
import { combiner, dateSure, renommerDossier, type FichierPlan, type Modification, type Plan } from '../../lib/plan';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { enParallele } from '../../navigateur/workers';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { Miniature } from '../composants/GrillePhotos';
import { Icone } from '../composants/Icones';
import { annuler, appliquer, contexteExecution, evenements, notifier, revenirDe, session, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { ETAPE } from '../../navigateur/projet';
import { jourCourt, nombre, pluriel } from '../format';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs } from './AidesIA';

/** Réglages de l'aide, partagés entre la page et le catalogue. */
const reglagesNommage = { tous: false, recherche: true };

interface PropositionNom extends NomPropose {
  cle: string;
}

/** Nom tiré du calendrier (D83) : `complet` quand toutes les photos datées ont été prises pendant l'événement. */
interface NomCalendrier {
  nom: string;
  titre: string;
  complet: boolean;
}

/** Proposition retenue pour le champ : le calendrier s'il couvre tout le dossier, sinon l'IA, sinon le calendrier. */
interface Proposition {
  nom: string;
  confiance?: number;
  source: 'calendrier' | 'ia';
}

/**
 * Noms tirés du calendrier pour chaque dossier (D83). Un événement qui ne
 * couvre qu'un dossier donne son titre seul (« 18 ans de Lea 26.01.26 ») ;
 * partagé par plusieurs dossiers (un voyage), il est suivi du lieu, selon la
 * convention Theme_Lieu_JJ.MM.AA, pour que les noms ne se répètent pas. Un
 * sous-dossier dont le parent porte déjà le titre ne le répète pas.
 */
function nomsCalendrier(plan: Plan, cibles: CibleNommage[]): Map<string, NomCalendrier | null> {
  const trouves = cibles.map((c) => {
    const dates = c.photos.map((f) => dateSure(f)).filter((d): d is string => !!d).sort();
    const r = dates.length ? evenementDesPhotos(evenementsAutour(evenements.value, dates[0].slice(0, 10), dates.at(-1)!.slice(0, 10), 0), dates) : null;
    return { c, dates, r: r && c.parent && normaliserNom(c.parent).startsWith(normaliserNom(r.evenement.titre)) ? null : r };
  });
  const parEvenement = new Map<string, number>();
  for (const { r } of trouves) if (r) parEvenement.set(`${r.evenement.titre}|${r.evenement.debut}`, (parEvenement.get(`${r.evenement.titre}|${r.evenement.debut}`) ?? 0) + 1);
  // Deux dossiers du même lieu le même jour : « … Kanchanaburi 2 15.07.26 » plutôt qu'un nom refusé comme déjà pris.
  const pris = new Map<string, number>();
  return new Map(
    trouves.map(({ c, dates, r }) => {
      if (!r) return [c.dossier, null];
      const partage = (parEvenement.get(`${r.evenement.titre}|${r.evenement.debut}`) ?? 0) > 1;
      const lieu = partage ? (plan.dossiers.get(c.dossier)?.tri?.lieu ?? lieuDuDossier(c.nom, c.parent)).replace(/_/g, ' ') : '';
      const base = [r.evenement.titre, lieu].filter(Boolean).join(' ');
      const cle = normaliserNom(nomDepuisEvenement(base, dates[0], dates.at(-1)!)).toLowerCase();
      const n = (pris.get(cle) ?? 0) + 1;
      pris.set(cle, n);
      return [c.dossier, { nom: nomDepuisEvenement(n > 1 ? `${base} ${n}` : base, dates[0], dates.at(-1)!), titre: r.evenement.titre, complet: r.part === 1 }];
    }),
  );
}

function propositionDe(p: PropositionNom | undefined, k: NomCalendrier | null): Proposition | null {
  // Un titre de calendrier est souvent le nom le plus parlant (« 18 ans de Lea ») : il passe devant l'IA s'il couvre tout le dossier.
  if (k?.complet) return { nom: k.nom, confiance: 9, source: 'calendrier' };
  if (p) return { nom: p.nom, confiance: p.confiance ?? undefined, source: 'ia' };
  if (k) return { nom: k.nom, confiance: 7, source: 'calendrier' };
  return null;
}

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

/** Renomme plusieurs dossiers ; un nom déjà pris à côté reçoit un suffixe libre. */
function renommerTous(plan: Plan, noms: [string, string, string?][]): { m: Modification | null; refus: string[] } {
  const mods: (Modification | null)[] = [];
  const refus: string[] = [];
  for (const [id, nom, saisi] of noms) {
    try {
      // Le texte tapé (accents, espaces) reste le titre de la section dans l'album.
      mods.push(renommerDossier(plan, id, nom, saisi));
    } catch {
      refus.push(nom);
    }
  }
  return { m: combiner(t`Renommer ${pluriel(noms.length - refus.length, 'dossier')}`, ...mods), refus };
}

/**
 * Une ligne du tableau. `ancien` : le dossier vient d'être renommé ici (son
 * nom d'avant) ; la ligne reste affichée, cochée, avec son nouveau nom.
 * Entrée dans le champ applique le nom, comme le bouton « Renommer ».
 */
function Ligne({
  c,
  p,
  k,
  choisie,
  saisi,
  saisir,
  ancien,
  renommer,
}: {
  c: CibleNommage;
  p?: PropositionNom;
  k: NomCalendrier | null;
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
  return (
    <tr class={renomme ? 'renomme' : choisie && (choisie.confiance ?? 0) < 6 ? 'a-verifier' : ''}>
      <td class="miniatures-nommage">
        {c.photos.slice(0, 1).concat(c.photos.length > 2 ? [c.photos[Math.floor(c.photos.length / 2)]] : [], c.photos.length > 1 ? [c.photos.at(-1)!] : []).map((f) => (
          <Miniature key={f.id} f={f} taille={64} />
        ))}
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
      </td>
      <td class="n" title={choisie?.source === 'calendrier' ? t`D’après le calendrier` : t`Confiance de l’IA, de 1 à 10`}>
        {choisie?.confiance ?? ''}
      </td>
      <td class="justification">
        {choisie?.source === 'calendrier' ? (
          <div class="evenements">
            {k?.complet ? t`Calendrier : « ${k.titre} », pendant toutes les photos` : t`Calendrier : « ${k?.titre ?? ''} », pendant une partie des photos`}
          </div>
        ) : (
          <>
            {p?.activite && <strong>{p.activite}. </strong>}
            {p?.justification}
          </>
        )}
        {p && p.monuments.length > 0 && <div class="monuments">{t`Reconnu : ${p.monuments.join(', ')}`}</div>}
        {/* L'autre proposition, à prendre d'un clic. */}
        {choisie?.source === 'calendrier' && p && normaliserNom(p.nom) !== normaliserNom(saisi) && (
          <div class="autre-nom">
            {t`Proposition de l’IA :`}{' '}
            <button type="button" class="lien" onClick={() => saisir(p.nom)}>
              {p.nom}
            </button>
          </div>
        )}
        {choisie?.source !== 'calendrier' && k && normaliserNom(k.nom) !== normaliserNom(saisi) && (
          <div class="autre-nom">
            {t`D’après le calendrier (« ${k.titre} ») :`}{' '}
            <button type="button" class="lien" onClick={() => saisir(k.nom)}>
              {k.nom}
            </button>
          </div>
        )}
        {!k && evts.length > 0 && <div class="evenements">{t`Calendrier : ${evts.slice(0, 3).map((e) => e.titre).join(' · ')}`}</div>}
      </td>
      <td>
        <button type="button" disabled={!propre || propre === c.nom} onClick={renommer}>
          {t`Renommer`}
        </button>
      </td>
    </tr>
  );
}

/** Noms saisis sans « Renommer » au moment de quitter l'étape : les appliquer, les laisser, ou rester. */
function DialogueNomsEnAttente({ noms, appliquerNoms, ignorer, rester }: { noms: [string, string][]; appliquerNoms: () => void; ignorer: () => void; rester: () => void }) {
  const bouton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => bouton.current?.focus(), []);
  return (
    <div class="voile" onMouseDown={(e) => e.target === e.currentTarget && rester()}>
      <div
        class="dialogue"
        role="dialog"
        aria-modal="true"
        aria-label={t`Des noms saisis ne sont pas appliqués`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') rester();
          e.stopPropagation();
        }}
      >
        <h2>{t`Des noms saisis ne sont pas appliqués`}</h2>
        <p>{t`${pluriel(noms.length, 'nom saisi', 'noms saisis')} sans cliquer sur « Renommer » :`}</p>
        <ul class="liste-courte">
          {noms.slice(0, 8).map(([avant, apres]) => (
            <li key={avant}>
              {avant} → <strong>{apres}</strong>
            </li>
          ))}
          {noms.length > 8 && <li>…</li>}
        </ul>
        <div class="actions droite">
          <button type="button" onClick={rester}>
            {tc('dialogue', 'Annuler')}
          </button>
          <button type="button" onClick={ignorer}>
            {t`Ne pas les appliquer`}
          </button>
          <button ref={bouton} type="button" class="principal" onClick={appliquerNoms}>
            {t`Appliquer et continuer`}
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
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  // Dossiers renommés sur cette page, avec leur nom d'avant : ils restent dans le tableau, cochés.
  const [renommes, setRenommes] = useState<Record<string, string>>({});
  const [sortie, setSortie] = useState<(() => void) | null>(null);
  const cibles = useMemo(() => {
    const base = dossiersANommer(s.plan, tous);
    const presents = new Set(base.map((c) => c.dossier));
    const faits = new Set(Object.keys(renommes).filter((id) => !presents.has(id)));
    return faits.size ? [...base, ...dossiersANommer(s.plan, true).filter((c) => faits.has(c.dossier))] : base;
  }, [versionPlan.value, tous, renommes]);
  const propositions = s.aides.get<Record<string, PropositionNom>>('IA4') ?? {};
  const calendrier = useMemo(() => nomsCalendrier(s.plan, cibles), [cibles, evenements.value]);
  const proposition = (c: CibleNommage) => propositionDe(propositions[c.dossier], calendrier.get(c.dossier) ?? null);
  const renomme = (c: CibleNommage) => renommes[c.dossier] !== undefined && renommes[c.dossier] !== c.nom;
  // Le champ : ce qui est tapé, sinon le nom donné ici, sinon la proposition (calendrier ou IA).
  const saisi = (c: CibleNommage) => saisies[c.dossier] ?? (renomme(c) ? c.nom : (proposition(c)?.nom ?? ''));
  const nouveauNom = (c: CibleNommage) => {
    const n = normaliserNom(saisi(c));
    return n && n !== c.nom ? n : '';
  };
  const triees = [...cibles].sort((a, b) => (proposition(a)?.confiance ?? 11) - (proposition(b)?.confiance ?? 11) || a.nom.localeCompare(b.nom));
  const surs = cibles.filter((c) => (proposition(c)?.confiance ?? 0) >= 8 && nouveauNom(c));
  // Tous les noms à appliquer : ceux de l'IA (même de confiance basse) et ceux tapés.
  const tousNoms = cibles.filter((c) => nouveauNom(c));
  const peuSurs = tousNoms.filter((c) => saisies[c.dossier] === undefined && (proposition(c)?.confiance ?? 0) < 8);
  // Noms tapés à la main et pas encore appliqués : on ne les perd pas en quittant l'étape.
  const enAttente = cibles.filter((c) => saisies[c.dossier] !== undefined && nouveauNom(c));

  /** Renomme ; un nom déjà pris est signalé. Rend le nombre de dossiers renommés. Le texte tapé (accents, espaces) est gardé pour les titres de l'album. */
  const renommer = (liste: CibleNommage[]): number => {
    const noms = liste.map((c): [string, string, string] => [c.dossier, nouveauNom(c), saisi(c)]);
    const r = renommerTous(s.plan, noms);
    appliquer(r.m);
    const faits = noms.filter(([, nom]) => !r.refus.includes(nom));
    const ids = new Set(faits.map(([id]) => id));
    setRenommes({ ...renommes, ...Object.fromEntries(liste.filter((c) => ids.has(c.dossier)).map((c) => [c.dossier, renomme(c) ? renommes[c.dossier] : c.nom])) });
    // Le nom appliqué n'est plus « en attente » ; après Ctrl+Z, le champ retrouve la proposition de l'IA.
    setSaisies(Object.fromEntries(Object.entries(saisies).filter(([id]) => !ids.has(id))));
    if (liste.length === 1) {
      if (r.refus.length) notifier('erreur', t`« ${noms[0][1]} » existe déjà à cet endroit.`);
    } else {
      const texte = pluriel(faits.length, 'dossier renommé', 'dossiers renommés');
      notifier(r.refus.length ? 'erreur' : 'ok', r.refus.length ? t`${texte} ; ${r.refus.length} nom(s) déjà pris : ${r.refus.join(', ')}.` : `${texte}.`, { libelle: t`Annuler`, faire: annuler });
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

  /** Quitter l'étape (valider ou revenir) : s'il reste des noms tapés, demander quoi en faire. */
  const quitter = (suite: () => void) => {
    if (enAttente.length) setSortie(() => suite);
    else suite();
  };

  return (
    <div class="page large avec-barre page-nommage">
      <TeteEtape numero={ETAPE.nommage} titre={t`Nommage`} cle="nommage">
        {t`Donnez à chaque dossier un nom parlant, sur le modèle « Theme_Lieu_JJ.MM.AA » (Anniversaire_Lea_26.01.25). Un événement du calendrier pendant lequel les photos ont été prises donne son titre (« 18 ans de Lea »). L’IA peut aussi proposer des noms en regardant quelques photos, le lieu, le calendrier et le contexte du projet ; vous gardez le dernier mot.`}
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
      {(surs.length > 0 || peuSurs.length > 0) && (
        <p class="actions-nommage">
          {surs.length > 0 && (
            <button type="button" class="principal" onClick={() => renommer(surs)}>
              {surs.length > 1 ? t`Accepter les ${nombre(surs.length)} noms de confiance 8 ou plus` : t`Accepter le nom de confiance 8 ou plus`}
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
                k={calendrier.get(c.dossier) ?? null}
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
        resume={t`${pluriel(cibles.filter((c) => !renomme(c)).length, 'dossier')} à nommer · ${pluriel(cibles.filter((c) => proposition(c)).length, 'proposition')}`}
        revenir={() => quitter(() => revenirDe('nommage'))}
        valider={() => quitter(() => validerEtape('nommage'))}
      />
      {sortie && (
        <DialogueNomsEnAttente
          noms={enAttente.map((c) => [c.nom, nouveauNom(c)])}
          rester={() => setSortie(null)}
          ignorer={() => {
            setSortie(null);
            sortie();
          }}
          appliquerNoms={() => {
            setSortie(null);
            // Un nom refusé (déjà pris) garde l'utilisateur sur la page, avec le message.
            if (renommer(enAttente) === enAttente.length) sortie();
          }}
        />
      )}
    </div>
  );
}

