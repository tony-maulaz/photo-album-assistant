// Page Configuration (SPEC § 8) : dossier config/ commun, lieux connus (saisie,
// depuis une photo, recherche d'adresse, coordonnées collées, CSV des anciens
// scripts), appareils, calendriers .ics et préréglages.

import { useEffect, useState } from 'preact/hooks';
import { validerConfig, VERSION_CONFIG, type Config, type LieuConnu } from '../../lib/config';
import { lienCourt, lireCoordonnees } from '../../lib/coordonnees';
import { lireIcs, resumeCalendrier, type EvenementCalendrier } from '../../lib/ics';
import { nomAscii, nouvelIdLieu } from '../../lib/noms';
import { DossierConfig, ModifieAilleurs } from '../../navigateur/configuration';
import { choisirDossier, choisirFichier, memoriserDossier } from '../../navigateur/dossiers';
import { lireExif } from '../../navigateur/exif';
import { rechercher } from '../../navigateur/nominatim';
import exemple from '../../../../config.exemple/config.json';
import { TeteEtape } from '../composants/Cadre';
import { confirmer } from '../composants/Dialogues';
import { chargerEvenements, configuration, notifier, reglages, session, texteErreur } from '../etat';
import { chargerConfiguration } from '../projets';
import { t } from '../../lib/langue';

type Onglet = 'lieux' | 'appareils' | 'calendriers' | 'prereglages';

function configVide(): Config {
  return { version: VERSION_CONFIG, modifie_le: '', lieux_connus: [], appareils: [], calendriers: [], prereglages: structuredClone(exemple.prereglages) };
}

/** `lieux_connus.csv` des anciens scripts : `nom;latitude;longitude;rayon_m`. */
export function lireCsvLieux(texte: string): { nom: string; lat: number; lon: number; rayon_m: number }[] {
  const lignes = texte.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const entete = lignes.shift()?.toLowerCase().split(';').map((x) => x.trim()) ?? [];
  const col = (nom: string) => entete.indexOf(nom);
  return lignes.flatMap((l) => {
    const c = l.split(';');
    const lat = Number((c[col('latitude')] ?? '').replace(',', '.'));
    const lon = Number((c[col('longitude')] ?? '').replace(',', '.'));
    const rayon = Number((c[col('rayon_m')] ?? '80').replace(',', '.')) || 80;
    const nom = (c[col('nom')] ?? '').trim();
    return nom && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [{ nom, lat, lon, rayon_m: rayon }] : [];
  });
}

export function ecrireCsvLieux(lieux: LieuConnu[]): string {
  return `nom;latitude;longitude;rayon_m\n${lieux.map((l) => `${l.nom};${l.lat};${l.lon};${l.rayon_m}`).join('\n')}\n`;
}

/** Fait télécharger un texte (export CSV). */
function telecharger(nom: string, texte: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([texte], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function PageConfiguration() {
  const c = configuration.value;
  const [brouillon, setBrouillon] = useState<Config | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('lieux');
  const [colle, setColle] = useState('');
  const [adresse, setAdresse] = useState('');
  const [resultats, setResultats] = useState<{ display_name: string; lat: string; lon: string }[] | null>(null);

  useEffect(() => setBrouillon(c?.lecture?.config ? structuredClone(c.lecture.config) : null), [c]);

  const choisir = async () => {
    try {
      const d = await choisirDossier('config', 'readwrite');
      await chargerConfiguration(d);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const creer = async () => {
    try {
      const parent = await choisirDossier('config-parent', 'readwrite');
      const d = await parent.getDirectoryHandle('config', { create: true });
      await memoriserDossier('config', d);
      const dc = new DossierConfig(d);
      if (!(await dc.lire())) await dc.ecrire(configVide(), null);
      await chargerConfiguration(d);
      notifier('ok', t`Dossier « config » prêt dans « ${parent.name} ».`);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const enregistrer = async () => {
    if (!c || !brouillon) return;
    const erreurs = validerConfig(brouillon);
    if (erreurs.length) {
      notifier('erreur', erreurs.join(' '));
      return;
    }
    try {
      const lecture = await c.dossier.ecrire(brouillon, c.lecture);
      configuration.value = { dossier: c.dossier, lecture };
      void chargerEvenements();
      notifier('ok', t`Configuration enregistrée (la version précédente est sauvegardée).`);
    } catch (err) {
      if (err instanceof ModifieAilleurs && (await confirmer(t`Modifiée ailleurs`, t`${err.message} Vos changements seront perdus.`, t`Recharger`))) await chargerConfiguration(c.dossier.dossier);
      else notifier('erreur', texteErreur(err));
    }
  };

  const restaurer = async () => {
    if (!c) return;
    try {
      const sauvegardes = await c.dossier.dossier.getDirectoryHandle('sauvegardes');
      const noms: string[] = [];
      for await (const nom of sauvegardes.keys()) noms.push(nom);
      for (const nom of noms.sort().reverse()) {
        const texte = await (await (await sauvegardes.getFileHandle(nom)).getFile()).text();
        try {
          const v = JSON.parse(texte);
          if (validerConfig(v).length) continue;
          if (!(await confirmer(t`Restaurer une sauvegarde ?`, t`La sauvegarde « ${nom} » est valide. Elle remplacera le config.json illisible (qui sera lui-même sauvegardé).`, t`Restaurer`))) return;
          configuration.value = { dossier: c.dossier, lecture: await c.dossier.ecrire(v as Config, await c.dossier.lire()) };
          notifier('ok', t`Sauvegarde « ${nom} » restaurée.`);
          return;
        } catch {
          // Sauvegarde illisible : on essaie la précédente.
        }
      }
      notifier('erreur', t`Aucune sauvegarde valide trouvée.`);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const modifier = (f: (b: Config) => void) => {
    if (!brouillon) return;
    const b = structuredClone(brouillon);
    f(b);
    setBrouillon(b);
  };
  const changeLieu = (i: number, modif: Partial<LieuConnu>) =>
    modifier((b) => {
      if (modif.domicile) b.lieux_connus.forEach((l) => (l.domicile = false));
      Object.assign(b.lieux_connus[i], modif);
    });
  const ajouterLieu = (nom: string, lat: number, lon: number, rayon = 80) =>
    modifier((b) => {
      b.lieux_connus.push({ id: nouvelIdLieu(nom, b.lieux_connus.map((x) => x.id)), nom: nomAscii(nom) || `Lieu_${b.lieux_connus.length + 1}`, lat, lon, rayon_m: rayon, domicile: false, un_seul_dossier: false, notes: '' });
    });

  const depuisPhoto = async () => {
    const f = await choisirFichier({ 'image/*': ['.jpg', '.jpeg', '.heic', '.png'] }, t`Photos`);
    if (!f) return;
    const e = await lireExif(f).catch(() => null);
    if (e?.lat === undefined || e.lon === undefined) {
      notifier('erreur', t`« ${f.name} » ne contient pas de position GPS.`);
      return;
    }
    ajouterLieu(f.name.replace(/\.[^.]+$/, ''), Number(e.lat.toFixed(6)), Number(e.lon.toFixed(6)));
    notifier('ok', t`Lieu ajouté depuis la photo : donnez-lui un nom, réglez le rayon, puis enregistrez.`);
  };

  const chercherAdresse = async () => {
    if (!adresse.trim()) return;
    try {
      setResultats((await rechercher(adresse.trim(), 'fr', reglages.value.emailNominatim || undefined)).donnees);
    } catch (err) {
      notifier('erreur', t`Recherche impossible : ${texteErreur(err)}`);
    }
  };

  const importerCsv = async () => {
    const f = await choisirFichier({ 'text/csv': ['.csv'] }, t`Lieux connus (CSV)`);
    if (!f) return;
    const lieux = lireCsvLieux(await f.text());
    if (!lieux.length) {
      notifier('erreur', t`Aucun lieu lisible : il faut les colonnes nom;latitude;longitude;rayon_m.`);
      return;
    }
    modifier((b) => {
      for (const l of lieux) {
        if (b.lieux_connus.some((x) => x.nom === l.nom)) continue;
        b.lieux_connus.push({ id: nouvelIdLieu(l.nom, b.lieux_connus.map((x) => x.id)), ...l, domicile: false, un_seul_dossier: false, notes: '' });
      }
    });
    notifier('ok', t`${lieux.length} lieu(x) lus dans « ${f.name} » : vérifiez le domicile, puis enregistrez.`);
  };

  const ajouterCalendrier = async () => {
    if (!c) return;
    const f = await choisirFichier({ 'text/calendar': ['.ics'] }, t`Calendrier (.ics)`);
    if (!f) return;
    try {
      const dossier = await c.dossier.dossier.getDirectoryHandle('calendriers', { create: true });
      const nom = nomAscii(f.name.replace(/\.ics$/i, '')) || 'calendrier';
      const w = await (await dossier.getFileHandle(`${nom}.ics`, { create: true })).createWritable();
      await w.write(await f.text());
      await w.close();
      modifier((b) => {
        if (!b.calendriers.some((k) => k.fichier === `calendriers/${nom}.ics`)) b.calendriers.push({ fichier: `calendriers/${nom}.ics`, nom, actif: true, inclure_recurrents: false });
      });
      notifier('ok', t`Calendrier copié dans « config/calendriers/${nom}.ics » : enregistrez la configuration.`);
    } catch (err) {
      notifier('erreur', texteErreur(err));
    }
  };

  const modifie = !!brouillon && !!c?.lecture?.config && JSON.stringify(brouillon) !== JSON.stringify(c.lecture.config);
  const coordonnees = lireCoordonnees(colle);

  return (
    <div class="page">
      <TeteEtape titre={t`Configuration`}>
        {t`Les lieux connus, appareils et calendriers, communs à tous les projets de la famille. Ils sont gardés dans un dossier « config » à côté de l’application : copiez ce dossier pour utiliser l’application sur un autre ordinateur. Il contient l’adresse du domicile : ne le publiez jamais.`}
      </TeteEtape>

      <div class="actions">
        {c ? <span>{t`Dossier : « ${c.dossier.dossier.name} »`}</span> : <span class="discret">{t`Aucun dossier de configuration choisi.`}</span>}
        <button type="button" onClick={() => void choisir()}>
          {t`Choisir le dossier config…`}
        </button>
        <button type="button" onClick={() => void creer()}>
          {t`Créer « config » dans un dossier…`}
        </button>
        {c && (
          <button type="button" onClick={() => void chargerConfiguration(c.dossier.dossier)}>
            {t`Recharger`}
          </button>
        )}
      </div>

      {c && !c.lecture && (
        <div class="encart">
          <p>{t`Ce dossier ne contient pas encore de config.json.`}</p>
          <button
            type="button"
            class="principal"
            onClick={async () => {
              try {
                await c.dossier.ecrire(configVide(), null);
                await chargerConfiguration(c.dossier.dossier);
              } catch (err) {
                notifier('erreur', texteErreur(err));
              }
            }}
          >
            {t`Créer config.json`}
          </button>
        </div>
      )}

      {c?.lecture && !c.lecture.config && (
        <div class="encart attention">
          <p>{t`config.json est illisible : ${c.lecture.erreurs.join(' ')}`}</p>
          <button type="button" onClick={() => void restaurer()}>
            {t`Restaurer la dernière sauvegarde valide`}
          </button>
        </div>
      )}

      {brouillon && (
        <>
          <div class="onglets" role="tablist">
            {(
              [
                ['lieux', t`Lieux connus (${brouillon.lieux_connus.length})`],
                ['appareils', t`Appareils (${brouillon.appareils.length})`],
                ['calendriers', t`Calendriers (${brouillon.calendriers.length})`],
                ['prereglages', t`Préréglages`],
              ] as [Onglet, string][]
            ).map(([o, libelle]) => (
              <button key={o} type="button" role="tab" aria-selected={onglet === o} class={onglet === o ? 'actif' : ''} onClick={() => setOnglet(o)}>
                {libelle}
              </button>
            ))}
          </div>

          {onglet === 'lieux' && (
            <>
              <table class="tableau edition">
                <thead>
                  <tr>
                    <th>{t`Nom`}</th>
                    <th>{t`Latitude`}</th>
                    <th>{t`Longitude`}</th>
                    <th>{t`Rayon (m)`}</th>
                    <th title={t`Le lieu du domicile (un seul)`}>{t`Domicile`}</th>
                    <th title={t`Toutes les photos de ce lieu dans un seul dossier`}>{t`Un seul dossier`}</th>
                    <th>{t`Notes`}</th>
                    {session.value && <th title={t`Photos du projet ouvert dans le rayon`}>{t`Photos`}</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {brouillon.lieux_connus.map((l, i) => (
                    <tr key={l.id}>
                      <td>
                        <input value={l.nom} onChange={(e) => changeLieu(i, { nom: e.currentTarget.value })} />
                      </td>
                      <td>
                        <input type="number" step="0.000001" class="court" value={l.lat} onChange={(e) => changeLieu(i, { lat: Number(e.currentTarget.value) })} />
                      </td>
                      <td>
                        <input type="number" step="0.000001" class="court" value={l.lon} onChange={(e) => changeLieu(i, { lon: Number(e.currentTarget.value) })} />
                      </td>
                      <td>
                        <input type="number" min="10" step="10" class="court" value={l.rayon_m} onChange={(e) => changeLieu(i, { rayon_m: Number(e.currentTarget.value) })} />
                      </td>
                      <td>
                        <input type="radio" name="domicile" checked={l.domicile} onChange={() => changeLieu(i, { domicile: true })} />
                      </td>
                      <td>
                        <input type="checkbox" checked={l.un_seul_dossier} onChange={(e) => changeLieu(i, { un_seul_dossier: e.currentTarget.checked })} />
                      </td>
                      <td>
                        <input value={l.notes} onChange={(e) => changeLieu(i, { notes: e.currentTarget.value })} />
                      </td>
                      {session.value && <td class="n">{photosDansRayon(l)}</td>}
                      <td>
                        <button type="button" onClick={() => modifier((b) => b.lieux_connus.splice(i, 1))}>
                          {t`Retirer`}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div class="actions">
                <input class="large" placeholder={t`Collez des coordonnées (48.86, 2.29) ou un lien Google Maps complet`} value={colle} onInput={(e) => setColle(e.currentTarget.value)} />
                <button
                  type="button"
                  disabled={!coordonnees}
                  onClick={() =>
                    modifier((b) => {
                      const nom = `Lieu ${b.lieux_connus.length + 1}`;
                      b.lieux_connus.push({ id: nouvelIdLieu(nom, b.lieux_connus.map((x) => x.id)), nom, lat: coordonnees!.lat, lon: coordonnees!.lon, rayon_m: 80, domicile: false, un_seul_dossier: false, notes: '' });
                      setColle('');
                    })
                  }
                >
                  {t`Ajouter ce lieu`}
                </button>
              </div>
              {colle.trim() && !coordonnees && (
                <p class="attention">
                  {lienCourt(colle) ? (
                    t`Ce lien court ne contient pas la position (l’application n’a pas le droit de l’ouvrir sur internet). Ouvrez-le dans le navigateur, puis copiez l’adresse complète de la barre d’adresse (elle contient « @46.8,6.6 ») ; ou, dans Google Maps, faites un clic droit sur le lieu et cliquez sur les coordonnées pour les copier.`
                  ) : (
                    t`Pas de coordonnées reconnues : collez par exemple « 48.8584, 2.2945 », ou l’adresse complète d’une page Google Maps.`
                  )}
                </p>
              )}
              <div class="actions">
                <button type="button" onClick={() => void depuisPhoto()} title={t`Une photo prise à cet endroit, avec sa position GPS`}>
                  {t`Ajouter depuis une photo…`}
                </button>
                <input placeholder={t`Rechercher une adresse (rue, ville)`} value={adresse} onInput={(e) => setAdresse(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && void chercherAdresse()} />
                <button type="button" disabled={!adresse.trim()} onClick={() => void chercherAdresse()} title={t`Recherche sur OpenStreetMap (Nominatim)`}>
                  {t`Rechercher`}
                </button>
                <button type="button" onClick={() => void importerCsv()}>
                  {t`Importer lieux_connus.csv…`}
                </button>
                <button type="button" disabled={!brouillon.lieux_connus.length} onClick={() => telecharger('lieux_connus.csv', ecrireCsvLieux(brouillon.lieux_connus))}>
                  {t`Exporter en CSV`}
                </button>
              </div>
              {resultats && (
                <ul class="liste-courte resultats-adresse">
                  {resultats.length === 0 && <li class="discret">{t`Aucun résultat.`}</li>}
                  {resultats.map((r) => (
                    <li key={r.display_name}>
                      {r.display_name}{' '}
                      <button
                        type="button"
                        class="lien"
                        onClick={() => {
                          ajouterLieu(r.display_name.split(',')[0], Number(Number(r.lat).toFixed(6)), Number(Number(r.lon).toFixed(6)));
                          setResultats(null);
                        }}
                      >
                        {t`ajouter`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <ChevauchementsLieux lieux={brouillon.lieux_connus} />
            </>
          )}

          {onglet === 'appareils' && (
            <>
              <table class="tableau edition">
                <thead>
                  <tr>
                    <th>{t`Modèle (EXIF)`}</th>
                    <th title={t`Décalage d’horloge à corriger, au format +HH:MM`}>{t`Décalage`}</th>
                    <th>{t`Surnom`}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {brouillon.appareils.map((a, i) => (
                    <tr key={i}>
                      <td>
                        <input value={a.modele} onChange={(e) => modifier((b) => (b.appareils[i].modele = e.currentTarget.value))} />
                      </td>
                      <td>
                        <input class="court" value={a.decalage} onChange={(e) => modifier((b) => (b.appareils[i].decalage = e.currentTarget.value))} />
                      </td>
                      <td>
                        <input value={a.surnom} placeholder={t`téléphone d’Edith`} onChange={(e) => modifier((b) => (b.appareils[i].surnom = e.currentTarget.value))} />
                      </td>
                      <td>
                        <button type="button" onClick={() => modifier((b) => b.appareils.splice(i, 1))}>
                          {t`Retirer`}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => modifier((b) => b.appareils.push({ modele: '', decalage: '+00:00', surnom: '' }))}>
                {t`Ajouter un appareil`}
              </button>
            </>
          )}

          {onglet === 'calendriers' && <OngletCalendriers config={brouillon} modifier={modifier} ajouter={() => void ajouterCalendrier()} />}

          {onglet === 'prereglages' && (
            <>
              <EditionPrereglages config={brouillon} modifier={modifier} />
            </>
          )}

          <div class="actions">
            <button type="button" class="principal" disabled={!modifie} onClick={() => void enregistrer()}>
              {t`Enregistrer`}
            </button>
            {modifie && (
              <button type="button" onClick={() => setBrouillon(structuredClone(c!.lecture!.config!))}>
                {t`Annuler les changements`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Distance en mètres entre deux points (haversine). */
function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Photos du projet ouvert dans le rayon d'un lieu (aperçu immédiat de l'effet du rayon, § 8.3). */
function photosDansRayon(l: LieuConnu): string {
  const s = session.value;
  if (!s) return '';
  let n = 0;
  for (const f of s.plan.fichiers.values()) if (f.gps && distance(f.gps, l) <= l.rayon_m) n++;
  return String(n);
}

/** Lieux dont les cercles se chevauchent : une photo n'ira qu'au plus proche. */
function ChevauchementsLieux({ lieux }: { lieux: LieuConnu[] }) {
  const paires: string[] = [];
  lieux.forEach((a, i) =>
    lieux.slice(i + 1).forEach((b) => {
      if (distance(a, b) < a.rayon_m + b.rayon_m) paires.push(t`« ${a.nom} » et « ${b.nom} »`);
    }),
  );
  const domicile = lieux.some((l) => l.domicile);
  return (
    <>
      {paires.length > 0 && <p class="attention">{t`Les cercles de ${paires.join(', ')} se chevauchent : une photo va au lieu le plus proche.`}</p>}
      {lieux.length > 0 && !domicile && <p class="attention">{t`Aucun lieu n’est le domicile : la détection des voyages (tri automatique) en a besoin.`}</p>}
    </>
  );
}

/** Événements de chaque calendrier de la configuration (lus dans config/calendriers), ou l'erreur de lecture. */
function useCalendriers(config: Config): Record<string, { evenements?: EvenementCalendrier[]; erreur?: string }> {
  const c = configuration.value;
  const [infos, setInfos] = useState<Record<string, { evenements?: EvenementCalendrier[]; erreur?: string }>>({});
  useEffect(() => {
    if (!c) return;
    let actif = true;
    void (async () => {
      const r: Record<string, { evenements?: EvenementCalendrier[]; erreur?: string }> = {};
      for (const k of config.calendriers) {
        try {
          const parties = k.fichier.split('/').filter(Boolean);
          let d = c.dossier.dossier;
          for (const p of parties.slice(0, -1)) d = await d.getDirectoryHandle(p);
          const texte = await (await (await d.getFileHandle(parties.at(-1)!)).getFile()).text();
          r[k.fichier] = { evenements: lireIcs(texte, { inclureRecurrents: k.inclure_recurrents }) };
        } catch (err) {
          r[k.fichier] = {
            erreur: err instanceof DOMException && err.name === 'NotFoundError' ? t`fichier introuvable : config/${k.fichier}` : t`lecture impossible (${err instanceof Error ? err.message : String(err)})`,
          };
        }
      }
      if (actif) setInfos(r);
    })();
    return () => {
      actif = false;
    };
  }, [c, config.calendriers.map((k) => `${k.fichier}${k.inclure_recurrents}`).join('|')]);
  return infos;
}

const jourCalendrier = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '?');

/** Onglet Calendriers (§ 8.4) : fichiers, nombre d'événements et période, liste des événements. */
function OngletCalendriers({ config, modifier, ajouter }: { config: Config; modifier: (f: (b: Config) => void) => void; ajouter: () => void }) {
  const infos = useCalendriers(config);
  const [vu, setVu] = useState<string | null>(null);
  const [annee, setAnnee] = useState('');
  const [texte, setTexte] = useState('');
  const evenements = vu ? (infos[vu]?.evenements ?? []) : [];
  const annees = [...new Set(evenements.map((e) => e.debut.slice(0, 4)))].sort().reverse();
  const q = texte.trim().toLowerCase();
  const filtres = evenements.filter((e) => (!annee || e.debut.startsWith(annee)) && (!q || `${e.titre} ${e.lieu ?? ''}`.toLowerCase().includes(q)));
  return (
    <>
      <table class="tableau edition">
        <thead>
          <tr>
            <th>{t`Nom`}</th>
            <th>{t`Fichier`}</th>
            <th>{t`Actif`}</th>
            <th title={t`Anniversaires, cours… (une occurrence par date)`}>{t`Événements récurrents`}</th>
            <th>{t`Événements`}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {config.calendriers.map((k, i) => {
            const info = infos[k.fichier];
            const r = info?.evenements ? resumeCalendrier(info.evenements) : null;
            return (
              <tr key={k.fichier}>
                <td>
                  <input value={k.nom} onChange={(e) => modifier((b) => (b.calendriers[i].nom = e.currentTarget.value))} />
                </td>
                <td class="discret">{k.fichier}</td>
                <td>
                  <input type="checkbox" checked={k.actif} onChange={(e) => modifier((b) => (b.calendriers[i].actif = e.currentTarget.checked))} />
                </td>
                <td>
                  <input type="checkbox" checked={k.inclure_recurrents} onChange={(e) => modifier((b) => (b.calendriers[i].inclure_recurrents = e.currentTarget.checked))} />
                </td>
                <td>
                  {!info
                    ? '…'
                    : info.erreur
                      ? <span class="attention">{info.erreur}</span>
                      : !r?.nombre
                        ? t`aucun événement`
                        : r.nombre > 1
                          ? t`${r.nombre} événements, du ${jourCalendrier(r.du)} au ${jourCalendrier(r.au)}`
                          : t`${r.nombre} événement, du ${jourCalendrier(r.du)} au ${jourCalendrier(r.au)}`}
                </td>
                <td>
                  {r && r.nombre > 0 && (
                    <button type="button" class="lien" onClick={() => setVu(vu === k.fichier ? null : k.fichier)}>
                      {vu === k.fichier ? t`Masquer` : t`Voir les événements`}
                    </button>
                  )}{' '}
                  <button type="button" class="lien" onClick={() => modifier((b) => b.calendriers.splice(i, 1))} title={t`Le fichier reste dans config/calendriers`}>
                    {t`Retirer`}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {config.calendriers.length === 0 && <p class="discret">{t`Aucun calendrier. Exportez le calendrier familial au format .ics (Google Agenda : Paramètres → Importer et exporter → Exporter, puis décompressez), puis ajoutez-le ici.`}</p>}
      <button type="button" onClick={ajouter}>
        {t`Ajouter un calendrier .ics…`}
      </button>
      {vu && (
        <div class="liste-evenements">
          <div class="actions">
            <select value={annee} onChange={(e) => setAnnee(e.currentTarget.value)} aria-label={t`Année`}>
              <option value="">{t`Toutes les années`}</option>
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input type="search" placeholder={t`Chercher un événement`} value={texte} onInput={(e) => setTexte(e.currentTarget.value)} />
            <span class="discret">{t`${filtres.length} événement(s)`}</span>
          </div>
          <table class="tableau">
            <tbody>
              {filtres.slice(0, 500).map((e, n) => (
                <tr key={n}>
                  <td class="date-evenement">
                    {jourCalendrier(e.debut)}
                    {!e.journee && ` ${e.debut.slice(11, 16)}`}
                    {e.fin.slice(0, 10) !== e.debut.slice(0, 10) && ` – ${jourCalendrier(e.fin)}`}
                  </td>
                  <td>
                    {e.titre}
                    {e.recurrent && <span class="discret">{t` (récurrent)`}</span>}
                  </td>
                  <td class="discret">{e.lieu}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtres.length > 500 && <p class="discret">{t`… et ${filtres.length - 500} autres : filtrez par année ou par texte.`}</p>}
        </div>
      )}
    </>
  );
}

interface Prereglage {
  rayon_km: number;
  par_jour: boolean;
  voyages: boolean;
  lieux_connus: boolean;
}

/** Préréglages du tri par lieux (§ 8.6) : « Année », « Voyage » et ceux qu'on ajoute. */
function EditionPrereglages({ config, modifier }: { config: Config; modifier: (f: (b: Config) => void) => void }) {
  const liste = Object.entries(config.prereglages) as [string, Partial<Prereglage>][];
  const changer = (nom: string, m: Partial<Prereglage>) => modifier((b) => (b.prereglages[nom] = { ...(b.prereglages[nom] as object), ...m }));
  return (
    <>
      <table class="tableau edition">
        <thead>
          <tr>
            <th>{t`Préréglage`}</th>
            <th>{t`Rayon des lieux (km)`}</th>
            <th>{t`Un dossier par jour`}</th>
            <th>{t`Détecter les voyages`}</th>
            <th>{t`Utiliser les lieux connus`}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {liste.map(([nom, p]) => (
            <tr key={nom}>
              <td>{nom === 'annee' ? t`Année` : nom === 'voyage' ? t`Voyage` : nom}</td>
              <td>
                <input type="number" min="0.1" step="0.5" class="court" value={p.rayon_km ?? 2} onChange={(e) => changer(nom, { rayon_km: Math.max(0.1, Number(e.currentTarget.value) || 2) })} />
              </td>
              <td>
                <input type="checkbox" checked={!!p.par_jour} onChange={(e) => changer(nom, { par_jour: e.currentTarget.checked })} />
              </td>
              <td>
                <input type="checkbox" checked={p.voyages ?? true} onChange={(e) => changer(nom, { voyages: e.currentTarget.checked })} />
              </td>
              <td>
                <input type="checkbox" checked={p.lieux_connus ?? true} onChange={(e) => changer(nom, { lieux_connus: e.currentTarget.checked })} />
              </td>
              <td>
                {nom !== 'annee' && nom !== 'voyage' && (
                  <button type="button" onClick={() => modifier((b) => delete b.prereglages[nom])}>
                    {t`Retirer`}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => {
          const nom = window.prompt(t`Nom du nouveau préréglage (ex. « Week-end », « Camp de ski ») :`)?.trim();
          if (nom && !(nom in config.prereglages)) modifier((b) => (b.prereglages[nom] = { rayon_km: 2, par_jour: true, voyages: false, lieux_connus: true }));
        }}
      >
        {t`Ajouter un préréglage`}
      </button>
      <p class="discret">{t`« Année » : un dossier par sortie, voyages regroupés. « Voyage » (dossier de vacances déjà isolé) : un dossier par jour et par lieu.`}</p>
    </>
  );
}
