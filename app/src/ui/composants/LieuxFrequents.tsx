// « Vos lieux » (étape « Tri automatique », § 6.4, D112 point 9) : une fenêtre à deux onglets.
// « À nommer » : un endroit photographié sur de nombreux jours (maison, grands-parents, école, club) peut être
// enregistré comme lieu connu sans quitter la page, même s'il faut d'abord choisir ou créer le dossier de
// configuration ; « Plus tard » le remet à plus tard pour la séance (« Le remontrer » le rend). « Nommés » : les
// lieux connus où des photos du projet ont été prises, pour revoir et corriger leur nom ; corriger un nom renomme
// aussi les dossiers du projet qui portent encore le nom automatique. Une carte par lieu : trois photos, son
// adresse, le champ « Nom ». La fenêtre ne se ferme plus d'elle-même.

import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { LieuConnu } from '../../lib/config';
import { t } from '../../lib/langue';
import { dossiersDuLieu, lieuxNommesDuProjet, renommerLieu } from '../../lib/lieuxNommes';
import { avecDetail, combiner, modificationHorsPlan, type FichierPlan, type Plan } from '../../lib/plan';
import { cleNom, nomAscii, nouvelIdLieu } from '../../lib/noms';
import { nomsSortie } from '../../lib/sortie';
import { distanceM, lieuxFrequents, type LieuFrequent, type PhotoTri } from '../../lib/tri';
import { annuler, appliquer, configuration, notifier, page, reglages, session, texteErreur, versionPlan } from '../etat';
import { dateHeure, nombre, pluriel } from '../format';
import { ChoixConfiguration } from './ChoixConfiguration';
import { RaisonDesactivee } from './Cadre';
import { Fenetre } from './Dialogues';
import { Miniature } from './GrillePhotos';
import { Icone } from './Icones';

export type OngletLieux = 'a_nommer' | 'nommes';

/** Lieux remis à plus tard d'un clic (« Plus tard ») pendant la session. */
const ignores = signal<ReadonlySet<string>>(new Set());

const cleLieu = (l: { lat: number; lon: number }) => `${l.lat},${l.lon}`;

/** Sans configuration : toujours la même liste vide, pour que les calculs gardés en mémoire ne se refassent pas. */
const AUCUN_LIEU: LieuConnu[] = [];

/** Photos du projet avec leur position, comme le tri les voit. */
const photosSituees = (plan: Plan): PhotoTri[] => [...plan.fichiers.values()].filter((f) => f.categorie === 'photo' && f.gps).map((f) => ({ id: f.id, nom: f.nom, date: f.date, gps: f.gps }));

/** Lieux qui reviennent souvent (six au plus), pas encore enregistrés. */
function suggestions(plan: Plan, lieux: LieuConnu[]): LieuFrequent[] {
  return lieuxFrequents(photosSituees(plan), lieux).slice(0, 6);
}

/** Nombre de lieux fréquents proposés au tri (ni enregistrés, ni remis à plus tard pour la séance). */
export function useLieuxProposes(): number {
  const s = session.value!;
  const lieux = configuration.value?.lecture?.config?.lieux_connus ?? AUCUN_LIEU;
  const caches = ignores.value;
  return useMemo(() => suggestions(s.plan, lieux).filter((l) => !caches.has(cleLieu(l))).length, [versionPlan.value, lieux, caches]);
}

/** Nombre de lieux nommés de ce projet (onglet « Nommés » : la maison et les lieux où des photos ont été prises). */
export function useLieuxNommes(): number {
  const s = session.value!;
  const lieux = configuration.value?.lecture?.config?.lieux_connus ?? AUCUN_LIEU;
  return useMemo(() => lieuxNommesDuProjet(photosSituees(s.plan), lieux).length, [versionPlan.value, lieux]);
}

/** Un nom tapé, tel qu'il est enregistré (lettres sans accents, « _ » pour les espaces). */
const nomPropre = (saisi: string) => nomAscii(saisi).replace(/^_+|_+$/g, '');
/** Un nom enregistré, tel qu'on le lit dans le champ. */
const nomLisible = (nom: string) => nom.replace(/_/g, ' ');

/**
 * Change le nom du lieu `id` dans la configuration (lue au moment d'écrire). Rejette si elle n'est pas
 * choisie, si le lieu n'y est plus, ou si l'écriture échoue (fichier changé ailleurs, disque).
 */
async function ecrireNomLieu(id: string, nom: string): Promise<void> {
  const c = configuration.value;
  if (!c?.lecture?.config) throw new Error(t`aucune configuration n’est choisie.`);
  const cfg = structuredClone(c.lecture.config);
  const l = cfg.lieux_connus.find((x) => x.id === id);
  if (!l) throw new Error(t`ce lieu n’est plus dans la configuration.`);
  if (l.nom === nom) return;
  l.nom = nom;
  configuration.value = { dossier: c.dossier, lecture: await c.dossier.ecrire(cfg, c.lecture) };
}

/** La fenêtre « Vos lieux », ouverte sur `onglet` ; elle ne se ferme que par `fermer` (Fermer, Échap). */
export function LieuxFrequents({ onglet: depart, fermer }: { onglet: OngletLieux; fermer: () => void }) {
  const s = session.value!;
  versionPlan.value;
  const lieux = configuration.value?.lecture?.config?.lieux_connus ?? AUCUN_LIEU;
  const [noms, setNoms] = useState<Record<string, string>>({});
  const proposes = useMemo(() => suggestions(s.plan, lieux), [versionPlan.value, lieux]);
  const visibles = proposes.filter((l) => !ignores.value.has(cleLieu(l)));
  const remis = proposes.length - visibles.length;
  const nommes = useMemo(() => lieuxNommesDuProjet(photosSituees(s.plan), lieux), [versionPlan.value, lieux]);
  // Rien à nommer à l'ouverture : on arrive sur les lieux nommés.
  const [onglet, setOnglet] = useState<OngletLieux>(() => (depart === 'a_nommer' && !visibles.length && nommes.length ? 'nommes' : depart));
  const [deplies, setDeplies] = useState<Set<string>>(new Set());
  // Adresse précise (OpenStreetMap, mise en cache) : aide à reconnaître le lieu (D59).
  const [adresses, setAdresses] = useState<Record<string, string>>({});
  // Sans connexion, l'adresse ne viendra pas : on le dit au lieu de la chercher indéfiniment.
  const [sansAdresse, setSansAdresse] = useState(false);
  const points = useMemo(() => [...proposes, ...nommes.map((n) => n.lieu)], [proposes, nommes]);
  useEffect(() => {
    if (!points.length) return;
    let actif = true;
    void s.geocodage
      .adresser(points, reglages.value.emailNominatim, () => !actif)
      .then((r) => actif && setAdresses(Object.fromEntries(points.flatMap((l, i) => (r[i] ? [[cleLieu(l), r[i]!]] : [])))))
      .catch(() => actif && setSansAdresse(true));
    return () => {
      actif = false;
    };
  }, [points]);
  // Le domicile sert à repérer les voyages : proposé tant qu'aucun lieu ne l'est.
  const [domicile, setDomicile] = useState<string | null>(null);
  const sansDomicile = !lieux.some((l) => l.domicile);
  // Lieu à enregistrer qui attend le dossier de configuration (choisi ou créé sans quitter l'étape).
  const [attente, setAttente] = useState<string | null>(null);
  const valeur = (cle: string, defaut = '') => noms[cle] ?? defaut;
  const ecrire = (cle: string, v: string) => setNoms({ ...noms, [cle]: v });

  // « C'est notre maison » écrit le nom proposé dans le champ, comme un vrai texte que l'on peut changer :
  // un exemple affiché ne doit jamais être enregistré à la place d'un champ vide (retour du 29.10).
  const choisirDomicile = (cle: string) => {
    setDomicile(cle);
    if (!noms[cle]?.trim()) ecrire(cle, nomsSortie().maison);
  };

  const enregistrer = async (lat: number, lon: number, cle: string) => {
    const estDomicile = sansDomicile && domicile === cle;
    const nom = nomPropre(valeur(cle));
    if (!nom) {
      notifier('erreur', t`Donnez d’abord un nom au lieu (ex. Chez_Grands_Parents).`);
      return;
    }
    // Lue au moment d'enregistrer : elle vient peut-être d'être choisie.
    const c = configuration.value;
    if (!c?.lecture?.config) {
      setAttente(cle);
      return;
    }
    setAttente(null);
    const deja = c.lecture.config.lieux_connus.find((l) => distanceM(lat, lon, l.lat, l.lon) <= l.rayon_m);
    if (deja) {
      notifier('info', t`Ce lieu est déjà enregistré dans la configuration : « ${deja.nom} ».`);
      return;
    }
    try {
      const cfg = structuredClone(c.lecture.config);
      // La configuration choisie a peut-être déjà un domicile : un seul.
      const commeDomicile = estDomicile && !cfg.lieux_connus.some((l) => l.domicile);
      cfg.lieux_connus.push({
        id: nouvelIdLieu(nom, cfg.lieux_connus.map((l) => l.id)),
        nom,
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        rayon_m: 150,
        domicile: commeDomicile,
        un_seul_dossier: false,
        notes: 'suggéré au tri automatique',
      });
      configuration.value = { dossier: c.dossier, lecture: await c.dossier.ecrire(cfg, c.lecture) };
      // La fenêtre reste ouverte : le lieu passe dans « Nommés », où l'on peut encore corriger son nom.
      notifier(
        'ok',
        commeDomicile
          ? t`« ${nom} » enregistré comme votre maison : les voyages sont maintenant reconnus.`
          : t`« ${nom} » enregistré : il servira pour les noms de vos dossiers (rangez à nouveau si c’est déjà fait).`,
      );
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  /**
   * Corriger le nom d'un lieu nommé : la configuration d'abord ; si elle ne s'écrit pas, rien ne change dans le
   * plan, les deux restent d'accord. Puis les dossiers du projet qui portent le nom automatique, en un geste
   * annulable (Ctrl+Z, ↶) qui remet aussi l'ancien nom dans la configuration.
   */
  const corriger = async (l: LieuConnu) => {
    const nom = nomPropre(valeur(l.id, nomLisible(l.nom)));
    if (!nom || nom === l.nom) return;
    if (lieux.some((x) => x.id !== l.id && cleNom(x.nom) === cleNom(nom))) {
      notifier('erreur', t`Un autre lieu s’appelle déjà « ${nom} » : choisissez un autre nom.`);
      return;
    }
    const n = dossiersDuLieu(s.plan, l).automatiques.length;
    try {
      await ecrireNomLieu(l.id, nom);
    } catch (err) {
      notifier('erreur', t`Le nom n’a pas pu être enregistré dans la configuration (${texteErreur(err)}). Rien n’a changé.`);
      return;
    }
    const plan = renommerLieu(s.plan, l, nom);
    const suivre = (sens: 'annuler' | 'retablir') => {
      const voulu = sens === 'annuler' ? l.nom : nom;
      ecrireNomLieu(l.id, voulu).catch((err) =>
        notifier('erreur', t`La configuration n’a pas suivi (${texteErreur(err)}) : le lieu y garde son autre nom. Mettez « ${voulu} » dans la Configuration.`),
      );
    };
    const detail = t`Renommer le lieu « ${l.nom} » en « ${nom} »`;
    appliquer(avecDetail(combiner(t`Corriger le nom d’un lieu`, plan, modificationHorsPlan(s.plan, t`Corriger le nom d’un lieu`, suivre, detail)), detail));
    setNoms({ ...noms, [l.id]: nomLisible(nom) });
    // « Enregistrer » se désactive (nom inchangé) : le focus reste dans le champ, pas perdu sur la page.
    document.getElementById(`nom-lieu-${l.id}`)?.focus();
    notifier('ok', n ? t`« ${nom} » enregistré : ${pluriel(n, 'dossier renommé', 'dossiers renommés')}.` : t`« ${nom} » enregistré.`, { libelle: t`Annuler`, faire: annuler });
  };

  /** Une carte (lot B) : trois photos, l'adresse, « 39 photos sur 8 jours · Voir les 39 photos », le champ « Nom ». */
  const carte = (o: {
    cle: string;
    point: { lat: number; lon: number };
    photos: FichierPlan[];
    jours: number;
    maison?: boolean;
    enTete?: ComponentChildren;
    champ: ComponentChildren;
    dessous?: ComponentChildren;
    modifiee?: boolean;
  }) => {
    const toutes = deplies.has(o.cle);
    const adresse = adresses[cleLieu(o.point)];
    return (
      <li key={o.cle} class={`carte-lieu${o.modifiee ? ' modifiee' : ''}`} data-lieu={o.cle}>
        <div class="vignettes-lieu">
          {unParJour(o.photos, 3).map((f) => (
            <span key={f.id} title={`${f.nom} — ${dateHeure(f.date)}`}>
              <Miniature f={f} taille={72} />
            </span>
          ))}
        </div>
        <div class="infos-lieu">
          <div class="titre-carte-lieu">
            <strong class={`adresse-lieu${adresse ? '' : ' discret'}`} title={t`Coordonnées : ${o.point.lat.toFixed(4)}, ${o.point.lon.toFixed(4)}`}>
              {adresse ?? (sansAdresse ? t`Adresse indisponible (pas de connexion)` : t`Recherche de l’adresse…`)}
            </strong>
            {o.maison && (
              <span class="badge-maison">
                <Icone nom="maison" taille={14} />
                {t`Notre maison`}
              </span>
            )}
            {o.enTete && <span class="actions-carte-lieu">{o.enTete}</span>}
          </div>
          <span class="discret">
            {o.photos.length ? t`${pluriel(o.photos.length, 'photo')} sur ${pluriel(o.jours, 'jour')}` : t`Aucune photo de ce projet`}
            {o.photos.length > 0 && (
              <>
                {' · '}
                <button type="button" class="lien" aria-expanded={toutes} onClick={() => setDeplies(new Set(toutes ? [...deplies].filter((x) => x !== o.cle) : [...deplies, o.cle]))}>
                  {toutes ? t`Moins de photos` : o.photos.length === 1 ? t`Voir la photo` : t`Voir les ${nombre(o.photos.length)} photos`}
                </button>
              </>
            )}
          </span>
          {toutes && (
            <div class="bande-miniatures">
              {o.photos.slice(0, 120).map((f) => (
                <span key={f.id} title={`${f.nom} — ${dateHeure(f.date)}`}>
                  <Miniature f={f} taille={Math.round(reglages.value.tailleMiniatures * 0.5)} />
                </span>
              ))}
            </div>
          )}
          {o.champ}
          {o.dessous}
        </div>
      </li>
    );
  };

  const fichiers = (ids: string[]) => ids.map((id) => s.plan.fichiers.get(id)).filter((f): f is FichierPlan => !!f);

  const aNommer = visibles.map((l) => {
    const cle = cleLieu(l);
    const nom = valeur(cle);
    const estDomicile = sansDomicile && domicile === cle;
    const raison = !nom.trim() && t`attend un nom`;
    return carte({
      cle,
      point: l,
      photos: fichiers(l.photos),
      jours: l.jours,
      enTete: (
        <>
          {sansDomicile && (
            <label class="case" title={t`La maison sert à reconnaître les voyages et les sorties.`}>
              <input type="radio" name="domicile-propose" checked={estDomicile} onChange={() => choisirDomicile(cle)} /> {t`C’est notre maison`}
            </label>
          )}
          <button type="button" class="plus-tard" title={t`Ne plus le proposer pendant cette séance`} onClick={() => (ignores.value = new Set([...ignores.value, cle]))}>
            {t`Plus tard`}
          </button>
        </>
      ),
      champ: (
        <div class="champ-lieu">
          <label for={`nom-lieu-${cle}`}>{t`Nom`}</label>
          <input
            id={`nom-lieu-${cle}`}
            type="text"
            placeholder={t`Par exemple : Chez Mamie`}
            value={nom}
            onInput={(e) => ecrire(cle, e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && nom.trim() && void enregistrer(l.lat, l.lon, cle)}
          />
          {/* Contour : une carte par lieu, aucune ne prend le seul bouton plein (C-4.1) ; désactivé, il garde son nom et sa raison est écrite à côté (C-4.7). */}
          <button type="button" disabled={!nom.trim()} aria-describedby={raison ? `raison-lieu-${cle}` : undefined} onClick={() => void enregistrer(l.lat, l.lon, cle)}>
            <Icone nom="coche" taille={16} />
            {t`Enregistrer`}
          </button>
          <RaisonDesactivee id={`raison-lieu-${cle}`} raison={raison} />
        </div>
      ),
      dessous: attente === cle && (
        <ChoixConfiguration
          pourquoi={t`Les lieux connus sont gardés dans un dossier de configuration : choisissez-le ou créez-le, le lieu sera enregistré aussitôt.`}
          apres={() => enregistrer(l.lat, l.lon, cle)}
          annuler={() => setAttente(null)}
        />
      ),
    });
  });

  const dejaNommes = nommes.map(({ lieu: l, photos, jours }) => {
    const nom = valeur(l.id, nomLisible(l.nom));
    const propre = nomPropre(nom);
    const modifie = !!propre && propre !== l.nom;
    const touches = modifie ? dossiersDuLieu(s.plan, l) : null;
    const raison = !nom.trim() ? t`attend un nom` : !modifie && t`nom inchangé`;
    return carte({
      cle: l.id,
      point: l,
      photos: fichiers(photos),
      jours,
      maison: l.domicile,
      modifiee: modifie,
      champ: (
        <div class="champ-lieu">
          <label for={`nom-lieu-${l.id}`}>{t`Nom`}</label>
          <input id={`nom-lieu-${l.id}`} type="text" placeholder={t`Par exemple : Chez Mamie`} value={nom} onInput={(e) => ecrire(l.id, e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && modifie && void corriger(l)} />
          <button type="button" disabled={!modifie} aria-describedby={raison ? `raison-lieu-${l.id}` : undefined} onClick={() => void corriger(l)}>
            <Icone nom="coche" taille={16} />
            {t`Enregistrer`}
          </button>
          {modifie ? (
            <button type="button" class="lien" onClick={() => ecrire(l.id, nomLisible(l.nom))}>
              {t`Annuler`}
            </button>
          ) : (
            <RaisonDesactivee id={`raison-lieu-${l.id}`} raison={raison} />
          )}
        </div>
      ),
      dessous: touches && (
        <p class="effet-renommage" role="status">
          <strong>
            {touches.automatiques.length
              ? t`${pluriel(touches.automatiques.length, 'dossier de ce projet prendra', 'dossiers de ce projet prendront')} ce nom.`
              : t`Aucun dossier de ce projet ne porte ce nom : seule la configuration change.`}
          </strong>
          {touches.renommes.length > 0 && <> {t`Ceux que vous avez renommés gardent le leur.`}</>}
        </p>
      ),
    });
  });

  const autres = lieux.length - nommes.length;
  const onglets = (
    <div class="onglets-lieux">
      <div role="tablist" aria-label={t`Vos lieux`}>
        {(
          [
            ['a_nommer', t`À nommer`, visibles.length ? pluriel(visibles.length, 'lieu', 'lieux') : t`tout est nommé`],
            ['nommes', t`Nommés`, pluriel(nommes.length, 'lieu', 'lieux')],
          ] as [OngletLieux, string, string][]
        ).map(([o, nom, compte]) => (
          <button key={o} type="button" role="tab" class={`onglet-lieux${onglet === o ? ' actif' : ''}`} data-onglet={o} aria-selected={onglet === o} onClick={() => setOnglet(o)}>
            <span class="nom-onglet">{nom}</span>
            <span class="compte-onglet">{compte}</span>
          </button>
        ))}
      </div>
      {remis > 0 && onglet === 'a_nommer' && (
        <span class="remis-plus-tard">
          {t`Remis à plus tard : ${pluriel(remis, 'lieu', 'lieux')}`}{' '}
          <button type="button" class="lien" onClick={() => (ignores.value = new Set())}>
            {remis === 1 ? t`Le remontrer` : t`Les remontrer`}
          </button>
        </span>
      )}
    </div>
  );

  return (
    <Fenetre
      titre={t`Vos lieux`}
      intro={
        sansDomicile
          ? t`Donnez-leur un nom : vos dossiers s’appelleront « Chez Mamie » plutôt que le nom de la commune. Un nom sert à tous vos albums. Indiquez aussi lequel est votre maison.`
          : t`Donnez-leur un nom : vos dossiers s’appelleront « Chez Mamie » plutôt que le nom de la commune. Un nom sert à tous vos albums.`
      }
      onglets={onglets}
      pied={
        <div class="pied-lieux">
          <span>{t`L’adresse vient d’OpenStreetMap : seule la position est envoyée.`}</span>
          <span>
            {autres > 0 ? t`${pluriel(autres, 'autre lieu', 'autres lieux')}, retirer un lieu, changer son rayon :` : t`Retirer un lieu, changer son rayon :`}{' '}
            <button
              type="button"
              class="lien"
              onClick={() => {
                fermer();
                page.value = { nom: 'configuration' };
              }}
            >
              {t`Configuration`}
              <Icone nom="chevronDroite" taille={16} />
            </button>
          </span>
        </div>
      }
      fermer={fermer}
    >
      {onglet === 'a_nommer' ? (
        aNommer.length ? (
          <ul class="cartes-lieux">{aNommer}</ul>
        ) : (
          <p class="vide-lieux discret">{remis ? t`Plus rien à nommer pour l’instant : les lieux remis à plus tard reviennent avec « Le remontrer ».` : t`Tout est nommé. Vos lieux nommés sont dans l’onglet « Nommés ».`}</p>
        )
      ) : dejaNommes.length ? (
        <ul class="cartes-lieux">{dejaNommes}</ul>
      ) : (
        <p class="vide-lieux discret">{t`Aucun lieu nommé où ce projet a des photos.`}</p>
      )}
    </Fenetre>
  );
}

/** Jusqu'à `n` photos prises des jours différents (la première de chaque jour), réparties sur la période. */
function unParJour(photos: FichierPlan[], n: number): FichierPlan[] {
  const parJour = new Map<string, FichierPlan>();
  for (const f of [...photos].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
    const j = f.date?.slice(0, 10) ?? '';
    if (!parJour.has(j)) parJour.set(j, f);
  }
  const jours = [...parJour.values()];
  if (jours.length <= n) return jours;
  return Array.from({ length: n }, (_, i) => jours[Math.round((i * (jours.length - 1)) / (n - 1))]);
}
