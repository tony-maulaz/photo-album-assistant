// Étape « Nommage » (SPEC § 6.6, IA4, script 04) : un tableau des dossiers,
// le nom proposé modifiable, la confiance et la justification ; l'IA combine
// photos, GPS, calendrier, contexte et recherche web, et repère les monuments
// dans le même appel (D51).

import { useMemo, useState } from 'preact/hooks';
import { blocCalendrier, evenementsAutour } from '../../lib/ics';
import { aTraduire, t } from '../../lib/langue';
import { dossiersANommer, estimationNommage, lireNommage, normaliserNom, requeteNommage, respecteConvention, type CibleNommage, type NomPropose } from '../../lib/nommage';
import { combiner, renommerDossier, type FichierPlan, type Modification, type Plan } from '../../lib/plan';
import { cleAnalyse } from '../../navigateur/analyses';
import { executerRequete } from '../../navigateur/executeur';
import { enParallele } from '../../navigateur/workers';
import { BarreValidation, TeteEtape } from '../composants/Cadre';
import { Miniature } from '../composants/GrillePhotos';
import { annuler, appliquer, contexteExecution, evenements, notifier, revenirDe, session, validerEtape, versionIA, versionPlan, type Session } from '../etat';
import { ETAPE } from '../../navigateur/projet';
import { jourCourt, nombre, pluriel } from '../format';
import { AideIA, enregistrerAide, essai, modeleDe, texteEchecs, type BilanEchecs } from './AidesIA';

/** Réglages de l'aide, partagés entre la page et le catalogue. */
const reglagesNommage = { tous: false, recherche: true };

interface PropositionNom extends NomPropose {
  cle: string;
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
  web: true,
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
function renommerTous(plan: Plan, noms: [string, string][]): { m: Modification | null; refus: string[] } {
  const mods: (Modification | null)[] = [];
  const refus: string[] = [];
  for (const [id, nom] of noms) {
    try {
      mods.push(renommerDossier(plan, id, nom));
    } catch {
      refus.push(nom);
    }
  }
  return { m: combiner(t`Renommer ${pluriel(noms.length - refus.length, 'dossier')}`, ...mods), refus };
}

function Ligne({ c, p, saisi, saisir }: { c: CibleNommage; p?: PropositionNom; saisi: string; saisir: (v: string) => void }) {
  const s = session.value!;
  const dates = c.photos.map((f) => f.date).filter((d): d is string => !!d).sort();
  const evts = dates.length ? evenementsAutour(evenements.value, dates[0].slice(0, 10), dates.at(-1)!.slice(0, 10)) : [];
  const propre = normaliserNom(saisi);
  return (
    <tr class={p && (p.confiance ?? 0) < 6 ? 'a-verifier' : ''}>
      <td class="miniatures-nommage">
        {c.photos.slice(0, 1).concat(c.photos.length > 2 ? [c.photos[Math.floor(c.photos.length / 2)]] : [], c.photos.length > 1 ? [c.photos.at(-1)!] : []).map((f) => (
          <Miniature key={f.id} f={f} taille={64} />
        ))}
      </td>
      <td>
        <strong>{c.nom}</strong>
        {c.parent && <div class="discret">{t`dans ${c.parent}`}</div>}
        <div class="discret">
          {jourCourt(dates[0])}
          {dates.length > 1 && dates[0].slice(0, 10) !== dates.at(-1)!.slice(0, 10) ? ` – ${jourCourt(dates.at(-1))}` : ''} · {pluriel(c.photos.length, 'photo')}
        </div>
      </td>
      <td>
        <input class="nom-propose" value={saisi} onInput={(e) => saisir(e.currentTarget.value)} aria-label={t`Nouveau nom de ${c.nom}`} />
        {saisi && propre && propre !== saisi && <div class="discret">{t`deviendra « ${propre} »`}</div>}
        {propre && !respecteConvention(propre) && <div class="attention">{t`Convention : Theme_Lieu_JJ.MM.AA`}</div>}
      </td>
      <td class="n">{p?.confiance ?? ''}</td>
      <td class="justification">
        {p?.activite && <strong>{p.activite}. </strong>}
        {p?.justification}
        {p && p.monuments.length > 0 && <div class="monuments">{t`Reconnu : ${p.monuments.join(', ')}`}</div>}
        {evts.length > 0 && <div class="evenements">{t`Calendrier : ${evts.slice(0, 3).map((e) => e.titre).join(' · ')}`}</div>}
      </td>
      <td>
        <button type="button" disabled={!propre || propre === c.nom} onClick={() => {
          const r = renommerTous(s.plan, [[c.dossier, propre]]);
          if (r.refus.length) notifier('erreur', t`« ${propre} » existe déjà à cet endroit.`);
          else appliquer(r.m);
        }}>
          {t`Renommer`}
        </button>
      </td>
    </tr>
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
  const cibles = useMemo(() => dossiersANommer(s.plan, tous), [versionPlan.value, tous]);
  const propositions = s.aides.get<Record<string, PropositionNom>>('IA4') ?? {};
  const saisi = (c: CibleNommage) => saisies[c.dossier] ?? propositions[c.dossier]?.nom ?? '';
  const triees = [...cibles].sort((a, b) => (propositions[a.dossier]?.confiance ?? 11) - (propositions[b.dossier]?.confiance ?? 11) || a.nom.localeCompare(b.nom));
  const surs = cibles.filter((c) => (propositions[c.dossier]?.confiance ?? 0) >= 8 && normaliserNom(saisi(c)) && normaliserNom(saisi(c)) !== c.nom);

  const accepterSurs = () => {
    const r = renommerTous(
      s.plan,
      surs.map((c) => [c.dossier, normaliserNom(saisi(c))]),
    );
    appliquer(r.m);
    const renommes = pluriel(surs.length - r.refus.length, 'dossier renommé', 'dossiers renommés');
    notifier(r.refus.length ? 'erreur' : 'ok', r.refus.length ? t`${renommes} ; ${r.refus.length} nom(s) déjà pris : ${r.refus.join(', ')}.` : `${renommes}.`, { libelle: t`Annuler`, faire: annuler });
  };

  return (
    <div class="page large avec-barre page-nommage">
      <TeteEtape numero={ETAPE.nommage} titre={t`Nommage`} cle="nommage">
        {t`Donnez à chaque dossier un nom parlant, sur le modèle « Theme_Lieu_JJ.MM.AA » (Anniversaire_Lea_26.01.25). L’IA peut proposer des noms en regardant quelques photos, le lieu, le calendrier et le contexte du projet ; vous gardez le dernier mot.`}
      </TeteEtape>
      <div class="reglages-etape ligne">
        <label class="case">
          <input type="checkbox" checked={tous} onChange={(e) => setTous(e.currentTarget.checked)} />{' '}
          {t`Tous les dossiers (pas seulement les noms automatiques comme « Ko_Samui_2026-07-18 »)`}
        </label>
        <label class="case" title={t`Événements locaux, lieux touristiques, résultats de course… (environ 0,09 CHF de plus par dossier)`}>
          <input type="checkbox" checked={recherche} onChange={(e) => setRecherche(e.currentTarget.checked)} /> {t`Recherche web`}
        </label>
      </div>
      <AideIA fonction="IA4" />
      {surs.length > 0 && (
        <p>
          <button type="button" class="principal" onClick={accepterSurs}>
            {t`Accepter les ${nombre(surs.length)} noms de confiance 8 ou plus`}
          </button>
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
              <Ligne key={c.dossier} c={c} p={propositions[c.dossier]} saisi={saisi(c)} saisir={(v) => setSaisies({ ...saisies, [c.dossier]: v })} />
            ))}
          </tbody>
        </table>
      )}
      <BarreValidation
        resume={t`${pluriel(cibles.length, 'dossier')} à nommer · ${pluriel(Object.keys(propositions).length, 'proposition')}`}
        revenir={() => revenirDe('nommage')}
        valider={() => validerEtape('nommage')}
      />
    </div>
  );
}

