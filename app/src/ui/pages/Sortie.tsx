// Étape « Création de la sortie » : écriture et bilan (SPEC § 6.11).

import { useEffect, useRef, useState } from 'preact/hooks';
import { ordreAlbum, paginer, photosAlbum, sections, type ActionAlbum } from '../../lib/album';
import { resumes } from '../../lib/plan';
import { genererRapport, phraseBilan } from '../../lib/rapport';
import { type ActionSynchro, type EtatSortie, langueDeLaSortie, nomsSortie, octetsACopier, planifierSynchro } from '../../lib/sortie';
import { actionsAlbum, synchroniserAlbum, titreDossier, type ResultatAlbum } from '../../navigateur/album';
import { listerSortie, synchroniser, type ProgressionSynchro, type ResultatSynchro } from '../../navigateur/synchro';
import { BarreProgression, BarreValidation, TeteEtape } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { changerEtape, configuration, enregistrerMaintenant, journal, notifier, revenirDe, session, texteErreur, versionPlan } from '../etat';
import { ETAPE, nomEtape } from '../../navigateur/projet';
import { avecLangue, t } from '../../lib/langue';
import { duree, nombre, pluriel, taille } from '../format';

interface Apercu {
  actions: ActionSynchro[];
  aCopier: number;
  octets: number;
  aDeplacer: number;
  aJour: number;
  conflits: ActionSynchro[];
  album: { actions: ActionAlbum[]; aCopier: number; octets: number; aRenommer: number; aRetirer: number; conflits: number };
}

export function PageSortie() {
  const s = session.value!;
  versionPlan.value;
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [progres, setProgres] = useState<ProgressionSynchro | null>(null);
  const [resultat, setResultat] = useState<ResultatSynchro | null>(null);
  const [resultatAlbum, setResultatAlbum] = useState<ResultatAlbum | null>(null);
  const [rapport, setRapport] = useState<string | null>(null);
  const debut = useRef(0);
  const arreter = useRef(false);

  const analyser = async () => {
    setApercu(null);
    try {
      const listing = await listerSortie(s.sortie.racine);
      const actions = planifierSynchro(s.plan, listing, s.etatSortie);
      const album = (await actionsAlbum({ plan: s.plan, config: s.album, nomProjet: s.projet.nom, sortie: s.sortie, etat: s.etatSortie })).actions;
      const copiesAlbum = album.filter((a): a is Extract<ActionAlbum, { type: 'copier' }> => a.type === 'copier');
      setApercu({
        album: {
          actions: album,
          aCopier: copiesAlbum.length,
          octets: copiesAlbum.reduce((t, a) => t + (s.plan.fichiers.get(a.id)?.taille ?? 0), 0),
          aRenommer: album.filter((a) => a.type === 'renommer').length,
          aRetirer: album.filter((a) => a.type === 'retirer').length,
          conflits: album.filter((a) => a.type === 'conflit').length,
        },
        actions,
        aCopier: actions.filter((a) => a.type === 'copier').length,
        octets: octetsACopier(s.plan, actions),
        aDeplacer: actions.filter((a) => a.type === 'deplacer').length,
        aJour: actions.filter((a) => a.type === 'garder').length,
        conflits: actions.filter((a) => a.type === 'conflit'),
      });
    } catch (err) {
      notifier('erreur', t`Lecture du dossier de sortie impossible : ${texteErreur(err)}`);
    }
  };

  useEffect(() => void analyser(), [versionPlan.value]);

  const lancer = async () => {
    if (!apercu) return;
    const travail = apercu.aCopier + apercu.aDeplacer;
    const travailAlbum = apercu.album.aCopier + apercu.album.aRenommer + apercu.album.aRetirer;
    if (
      travail + travailAlbum &&
      !(await confirmer(
        t`Écrire dans le dossier de sortie ?`,
        t`${pluriel(apercu.aCopier + apercu.album.aCopier, 'fichier')} à copier (${taille(apercu.octets + apercu.album.octets)}) et ${pluriel(apercu.aDeplacer + apercu.album.aRenommer, 'fichier')} à déplacer ou renommer dans « ${s.sortie.racine.name} ». Le dossier à trier n’est pas modifié.`,
        t`Écrire`,
      ))
    )
      return;
    arreter.current = false;
    debut.current = performance.now();
    setResultat(null);
    setResultatAlbum(null);
    setProgres({ faits: 0, total: travail, octets: 0, octetsTotal: apercu.octets });
    try {
      await enregistrerMaintenant();
      const r = await synchroniser({
        plan: s.plan,
        source: s.source,
        sortie: s.sortie,
        etat: s.etatSortie,
        enregistrerEtat: (etat: EtatSortie) => s.etat.ecrire('etat_sortie.json', etat),
        progres: setProgres,
        arreter: () => arreter.current,
      });
      // Puis Album/ : copies numérotées de la sélection (et textes pour ifolor).
      const ra = await synchroniserAlbum({
        plan: s.plan,
        config: s.album,
        nomProjet: s.projet.nom,
        source: s.source,
        sortie: s.sortie,
        etat: s.etatSortie,
        enregistrerEtat: (etat: EtatSortie) => s.etat.ecrire('etat_sortie.json', etat),
        progres: (faits, total, enCours) => setProgres({ faits, total, octets: 0, octetsTotal: 0, enCours: enCours ? `Album/${enCours}` : undefined }),
        arreter: () => arreter.current,
      });
      setResultatAlbum(ra);
      const ordre = ordreAlbum(photosAlbum(s.plan), s.album.ordre);
      const secs = sections(ordre, (d) => titreDossier(s.plan, d), s.album);
      const album = { photos: ordre.length, sections: secs.length, pages: paginer(ordre, secs, s.album).length, manquantes: ra.conflits.length + ra.erreurs.length };
      // Le rapport est écrit dans la sortie : dans la langue du projet (D60).
      const html = avecLangue(langueDeLaSortie(), () => genererRapport({ projet: s.projet.nom, source: s.source.racine.name, sortie: s.sortie.racine.name, date: new Date(), album }, s.plan, r.bilan));
      await s.etat.ecrireTexte(s.sortie.racine, nomsSortie().rapport, html);
      const lecture = configuration.value?.lecture;
      if (lecture?.config) await s.etat.ecrire('config_utilisee.json', lecture.config);
      setRapport(html);
      setResultat(r);
      const complet = r.bilan.manquants.length === 0;
      changerEtape(ETAPE.sortie, complet ? 'validee' : 'en_cours');
      journal('sortie', t`Sortie : ${r.copies} copiés, ${r.deplaces} déplacés, ${r.gardes} à jour ; ${phraseBilan(r.bilan)} Album : ${ra.copies} copiées, ${ra.renommes} renommées, ${ra.retires} retirées.`, {
        copies: r.copies,
        deplaces: r.deplaces,
        erreurs: r.erreurs,
        manquants: r.bilan.manquants.length,
        dureeMs: performance.now() - debut.current,
      });
      await enregistrerMaintenant();
    } catch (err) {
      notifier('erreur', t`Écriture interrompue : ${texteErreur(err)}`);
    } finally {
      setProgres(null);
      void analyser();
    }
  };

  const ouvrirRapport = () => {
    if (!rapport) return;
    const url = URL.createObjectURL(new Blob([rapport], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const plan = s.plan;
  const fichiers = [...plan.fichiers.values()];
  const r = resumes(plan);
  const nbDossiers = [...plan.dossiers.values()].filter((d) => d.parent !== null && r.get(d.id)!.photos + r.get(d.id)!.videos > 0).length;
  const total = (filtre: (f: (typeof fichiers)[number]) => boolean) => {
    const l = fichiers.filter(filtre);
    return { n: l.length, octets: l.reduce((t, f) => t + f.taille, 0) };
  };
  const photos = total((f) => f.statut === 'archive' && f.categorie === 'photo');
  const videos = total((f) => f.statut === 'archive' && f.categorie === 'video');
  const deCote = total((f) => f.statut === 'mis_de_cote' && f.categorie !== 'autre');
  const autres = total((f) => f.categorie === 'autre');
  const ensemble = total(() => true);
  const retenues = photosAlbum(plan);
  const albumPhotos = retenues.length;
  const albumOctets = retenues.reduce((t, f) => t + f.taille, 0);

  const ecoule = progres ? performance.now() - debut.current : 0;
  const debit = progres && ecoule > 500 ? progres.octets / (ecoule / 1000) : 0;
  const restant = debit > 0 && progres ? ((progres.octetsTotal - progres.octets) / debit) * 1000 : 0;
  const b = resultat?.bilan;

  return (
    <div class="page etroite avec-barre">
      <TeteEtape numero={ETAPE.sortie} titre={nomEtape(ETAPE.sortie)}>
        {t`L’application écrit le résultat dans le dossier de sortie, puis vérifie que chaque fichier du dossier à trier s’y retrouve. Vous pouvez la relancer à tout moment : seul ce qui a changé est copié ou déplacé.`}
      </TeteEtape>

      <h2>{t`Ce qui sera dans « ${s.sortie.racine.name} »`}</h2>
      <table class="tableau">
        <thead>
          <tr>
            <th>{t`Dossier`}</th>
            <th>{t`Contenu`}</th>
            <th class="n">{t`Taille`}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Photos/</td>
            <td>
              {pluriel(nbDossiers, 'dossier')}, {pluriel(photos.n, 'photo')}, {pluriel(videos.n, 'vidéo')}
            </td>
            <td class="n">{taille(photos.octets + videos.octets)}</td>
          </tr>
          <tr>
            <td>Album/</td>
            <td>
              {albumPhotos
                ? t`${pluriel(albumPhotos, 'photo')} de l’album, numérotées dans l’ordre pour ifolor, et les textes (${nomsSortie().textesAlbum})`
                : t`rien : aucune photo retenue à l’étape ${ETAPE.selection}`}
            </td>
            <td class="n">{albumPhotos ? taille(albumOctets) : ''}</td>
          </tr>
          <tr>
            <td>{nomsSortie().misDeCote}/</td>
            <td>{t`${pluriel(deCote.n, 'élément')} écartés (rien n’est supprimé)`}</td>
            <td class="n">{taille(deCote.octets)}</td>
          </tr>
          <tr>
            <td>{nomsSortie().autres}/</td>
            <td>
              {autres.n > 1
                ? t`${pluriel(autres.n, 'fichier')} ni photo ni vidéo, avec leur chemin d’origine`
                : t`${pluriel(autres.n, 'fichier')} ni photo ni vidéo, avec son chemin d’origine`}
            </td>
            <td class="n">{taille(autres.octets)}</td>
          </tr>
          <tr>
            <td>{nomsSortie().rapport}</td>
            <td>{t`le bilan, lisible dans un navigateur`}</td>
            <td class="n" />
          </tr>
          <tr class="total">
            <td>{t`Total`}</td>
            <td>{pluriel(ensemble.n, 'fichier')}</td>
            <td class="n">{taille(ensemble.octets)}</td>
          </tr>
        </tbody>
      </table>

      {!apercu && !progres && <p class="discret">{t`Lecture du dossier de sortie…`}</p>}
      {apercu && !progres && (
        <div class="encart">
          {apercu.aCopier + apercu.aDeplacer === 0 ? (
            <p>
              <strong>{t`La sortie est à jour`}</strong>
              {t` : ${pluriel(apercu.aJour, 'fichier')} déjà en place.`}
            </p>
          ) : (
            <p>
              {t`À écrire :`} <strong>{pluriel(apercu.aCopier, 'fichier')}</strong>
              {t` à copier (${taille(apercu.octets)}), ${pluriel(apercu.aDeplacer, 'fichier')} à déplacer (instantané), ${pluriel(apercu.aJour, 'fichier')} déjà à jour.`}
            </p>
          )}
          {apercu.album.aCopier + apercu.album.aRenommer + apercu.album.aRetirer > 0 && (
            <p>
              {t`Album : ${pluriel(apercu.album.aCopier, 'copie')} à faire (${taille(apercu.album.octets)})`}
              {apercu.album.aRenommer ? t`, ${pluriel(apercu.album.aRenommer, 'copie')} à renuméroter` : ''}
              {apercu.album.aRetirer ? t`, ${pluriel(apercu.album.aRetirer, 'ancienne copie', 'anciennes copies')} à retirer (plus dans l’album)` : ''}.
            </p>
          )}
          {apercu.album.conflits > 0 && (
            <p class="attention">
              {t`${pluriel(apercu.album.conflits, 'fichier')} de « Album » n’a pas été écrit par l’application et occupe une place prévue : il n’est pas touché. Déplacez-le pour que l’album soit complet.`}
            </p>
          )}
          {apercu.octets > 0 && (
            <p class="discret">
              {t`Il faut environ ${taille(apercu.octets)} de place libre sur le disque de « ${s.sortie.racine.name} » : le navigateur ne peut pas vérifier la place disponible.`}
            </p>
          )}
          {apercu.conflits.length > 0 && (
            <p class="attention">
              {t`${pluriel(apercu.conflits.length, 'fichier')} ne peut pas être écrit : un autre fichier occupe déjà sa place dans la sortie (il n’est jamais écrasé). Exemple : ${apercu.conflits[0].cible}`}
            </p>
          )}
        </div>
      )}

      {progres && (
        <div class="encart">
          <BarreProgression
            faits={progres.octetsTotal ? progres.octets : progres.faits}
            total={progres.octetsTotal || progres.total}
            texte={t`${nombre(progres.faits)} / ${nombre(progres.total)} fichiers · ${taille(progres.octets)} / ${taille(progres.octetsTotal)}${debit ? t` · ${taille(debit)}/s · encore ${duree(restant)}` : ''}`}
          />
          {progres.enCours && <p class="discret">{progres.enCours}</p>}
          <button type="button" onClick={() => (arreter.current = true)}>
            {t`Arrêter (reprendra là où il s’est arrêté)`}
          </button>
        </div>
      )}

      {b && (
        <div class={`encart bilan ${b.manquants.length ? 'incomplet' : 'complet'}`}>
          <h2>{t`Bilan`}</h2>
          <p>{phraseBilan(b)}</p>
          {b.manquants.length === 0 ? (
            <p>
              <strong>{t`Tout est dans le dossier de sortie.`}</strong>{' '}
              {t`Vérifiez-le et copiez-le à son emplacement définitif (NAS) ; vous pourrez ensuite supprimer le dossier d’origine vous-même.`}
            </p>
          ) : (
            <>
              <p class="attention">
                <strong>{pluriel(b.manquants.length, 'fichier manque', 'fichiers manquent')}</strong>
                {t` dans la sortie : ne supprimez pas le dossier d’origine.`}
              </p>
              <ul class="liste-courte">
                {b.manquants.slice(0, 20).map((m) => (
                  <li key={m.id}>{m.id}</li>
                ))}
                {b.manquants.length > 20 && <li>{t`… et ${nombre(b.manquants.length - 20)} autres (voir le rapport)`}</li>}
              </ul>
              {resultat!.erreurs.length > 0 && <p class="discret">{t`Erreur rencontrée : ${resultat!.erreurs[0].message}`}</p>}
            </>
          )}
          {resultatAlbum && (resultatAlbum.copies + resultatAlbum.renommes + resultatAlbum.retires > 0 || resultatAlbum.erreurs.length > 0) && (
            <p>
              {t`Album : ${pluriel(resultatAlbum.copies, 'copie écrite', 'copies écrites')}, ${pluriel(resultatAlbum.renommes, 'renumérotée', 'renumérotées')}, ${pluriel(resultatAlbum.retires, 'ancienne copie retirée', 'anciennes copies retirées')}`}
              {resultatAlbum.erreurs.length ? t` ; ${pluriel(resultatAlbum.erreurs.length, 'erreur')} (relancez)` : ''}.
            </p>
          )}
          {resultatAlbum && resultatAlbum.sansRotation.length > 0 && (
            <p class="discret">
              {resultatAlbum.sansRotation.length > 1
                ? t`${nombre(resultatAlbum.sansRotation.length)} photos tournées n’ont pas pu être tournées sans recompression (pas de balise d’orientation) : tournez-les dans ifolor.`
                : t`${nombre(resultatAlbum.sansRotation.length)} photo tournée n’a pas pu être tournée sans recompression (pas de balise d’orientation) : tournez-la dans ifolor.`}
            </p>
          )}
          {b.enTrop.length > 0 && <p class="discret">{t`${pluriel(b.enTrop.length, 'fichier')} de la sortie hors du plan (laissés tels quels, listés dans le rapport).`}</p>}
          {b.datesFichierSeulement.length > 0 && (
            <p class="discret">{t`${pluriel(b.datesFichierSeulement.length, 'photo ou vidéo', 'photos ou vidéos')} sans autre date que celle du fichier : leur date d’origine est dans le rapport.`}</p>
          )}
          <p class="discret">{t`Les fichiers système masqués par le navigateur (comme « Thumbs.db ») ne sont ni comptés ni copiés : Windows les recrée.`}</p>
          <div class="actions">
            <button type="button" onClick={ouvrirRapport}>
              {t`Ouvrir le rapport`}
            </button>
            {b.manquants.length > 0 && (
              <button type="button" class="principal" onClick={() => void lancer()}>
                {t`Réessayer`}
              </button>
            )}
          </div>
        </div>
      )}

      <BarreValidation
        resume={t`Dossier de sortie : « ${s.sortie.racine.name} »`}
        revenir={() => revenirDe('sortie')}
        valider={() => void lancer()}
        libelleValider={
          progres
            ? t`Écriture…`
            : apercu && apercu.aCopier + apercu.aDeplacer + apercu.album.aCopier + apercu.album.aRenommer + apercu.album.aRetirer === 0
              ? t`Vérifier à nouveau`
              : t`Créer / mettre à jour la sortie`
        }
        validerActif={!progres && !!apercu}
      />
    </div>
  );
}
