// Rapport.html : bilan lisible dans un navigateur, écrit à la racine de la sortie (SPEC § 12).

import { nombre, pluriel } from '../ui/format';
import { aTraduire, langue, t } from './langue';
import { cheminDossier, resumes, type Plan } from './plan';
import { dossierMisDeCote, nomsSortie, type Bilan } from './sortie';

/** Raison de mise de côté : [singulier, pluriel]. */
const RAISONS: Record<string, [string, string]> = {
  floues: [aTraduire('photo floue'), aTraduire('photos floues')],
  doublons: [aTraduire('doublon'), aTraduire('doublons')],
  doublons_exacts: [aTraduire('doublon exact'), aTraduire('doublons exacts')],
  autres: [aTraduire('écartée à la main'), aTraduire('écartées à la main')],
};

function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const code = (texte: string) => `<code>${texte}</code>`;

/** « 1 photo floue », « 3 doublons » ; une raison inconnue est montrée telle quelle. */
function raison(r: string, n: number): string {
  const libelles = RAISONS[r];
  return libelles ? pluriel(n, libelles[0], libelles[1]) : `${nombre(n)} ${r}`;
}

function jour(d?: string): string {
  if (!d) return '—';
  const [a, m, j] = d.slice(0, 10).split('-');
  return `${j}.${m}.${a}`;
}

/** Phrase de bilan du § 6.11 : « 5123 fichiers dans la source → 5123 dans la sortie : … ». */
export function phraseBilan(b: Bilan): string {
  const parties = [pluriel(b.categories.photos, 'photo triée', 'photos triées'), pluriel(b.categories.videos, 'vidéo')];
  for (const [r, n] of Object.entries(b.categories.misDeCote)) parties.push(raison(r, n));
  parties.push(pluriel(b.categories.autres, 'autre fichier', 'autres fichiers'));
  return t`${pluriel(b.total, 'fichier')} dans la source → ${nombre(b.presents)} dans la sortie : ${parties.join(', ')}.`;
}

export interface InfosRapport {
  projet: string;
  source: string;
  sortie: string;
  date: Date;
  /** Album préparé dans `Album/` (étape « Album »), s'il y en a un. */
  album?: { photos: number; sections: number; pages: number; manquantes: number };
  /** Fichiers de la source qui ne sont pas (ou plus tels quels) dans le projet : arrivés ou modifiés depuis l'inventaire (D63). */
  horsProjet?: string[];
}

export function genererRapport(infos: InfosRapport, plan: Plan, b: Bilan): string {
  const r = resumes(plan);
  const dossiers = [...plan.dossiers.values()]
    .filter((d) => d.parent !== null)
    .map((d) => ({ chemin: cheminDossier(plan, d.id), s: r.get(d.id)! }))
    .filter((x) => x.s.photos + x.s.videos > 0)
    .sort((a, b2) => a.chemin.localeCompare(b2.chemin, 'fr', { numeric: true }));
  const racine = r.get('racine');
  const horsProjet = infos.horsProjet ?? [];
  const complet = b.manquants.length === 0 && horsProjet.length === 0;
  const autres = [...plan.fichiers.values()].filter((f) => f.categorie === 'autre').map((f) => f.id).sort();
  const locale = langue() === 'en' ? 'en-GB' : 'fr-CH';
  const quand = infos.date.toLocaleString(locale, { dateStyle: 'long', timeStyle: 'short' });
  const album = infos.album;

  const lignesDossiers = dossiers
    .map((x) => `<tr><td>${echapper(x.chemin)}</td><td>${jour(x.s.du)} – ${jour(x.s.au)}</td><td class="n">${nombre(x.s.photos)}</td><td class="n">${nombre(x.s.videos)}</td></tr>`)
    .join('\n');
  const liste = (titre: string, elements: string[], max = 300) =>
    elements.length
      ? `<details><summary>${titre} (${nombre(elements.length)})</summary><ul>${elements
          .slice(0, max)
          .map((e) => `<li>${echapper(e)}</li>`)
          .join('')}${elements.length > max ? `<li>${t`… et ${nombre(elements.length - max)} autres`}</li>` : ''}</ul></details>`
      : '';

  return `<!doctype html>
<html lang="${langue()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t`Rapport — ${echapper(infos.projet)}`}</title>
<style>
:root { color-scheme: light dark; --fond: #fbfaf7; --texte: #1f2328; --discret: #5f6670; --bord: #d9d6cf; --ok: #1d7a3a; --echec: #b42318; }
@media (prefers-color-scheme: dark) { :root { --fond: #17191c; --texte: #e6e6e3; --discret: #a0a6ad; --bord: #383c42; --ok: #5cc27a; --echec: #f07a6e; } }
body { margin: 0 auto; max-width: 960px; padding: 24px 16px 48px; background: var(--fond); color: var(--texte); font: 15px/1.5 system-ui, 'Segoe UI', sans-serif; }
h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 28px 0 8px; }
.discret { color: var(--discret); } .ok { color: var(--ok); } .echec { color: var(--echec); }
.bilan { font-size: 17px; padding: 12px 14px; border: 1px solid var(--bord); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; font-size: 14px; } th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--bord); } td.n { text-align: right; }
summary { cursor: pointer; } ul { margin: 6px 0; padding-left: 20px; } li { overflow-wrap: anywhere; }
</style>
</head>
<body>
<h1>${echapper(infos.projet)}</h1>
<p class="discret">${t`Rapport du ${echapper(quand)} — source « ${echapper(infos.source)} », sortie « ${echapper(infos.sortie)} ».`}</p>
<p class="bilan">${echapper(phraseBilan(b))}<br>
${
  complet
    ? `<strong class="ok">${t`Tout est dans le dossier de sortie.`}</strong> ${t`Vérifiez-le et copiez-le à son emplacement définitif (NAS) ; vous pourrez ensuite supprimer le dossier d’origine vous-même.`}`
    : b.manquants.length
      ? `<strong class="echec">${t`${nombre(b.manquants.length)} fichier(s) manquent dans la sortie : ne supprimez pas la source.`}</strong>`
      : `<strong class="echec">${t`${pluriel(horsProjet.length, 'fichier de la source n’est', 'fichiers de la source ne sont')} pas dans le projet (arrivés ou modifiés depuis l’inventaire) : mettez à jour l’inventaire, ne supprimez pas la source.`}</strong>`
}</p>
${liste(t`Fichiers manquants`, b.manquants.map((m) => `${m.id} → ${m.cible}`))}
${liste(t`Fichiers de la source pas encore dans le projet`, horsProjet)}
<p class="discret">${t`Les fichiers système masqués par le navigateur (comme ${code('Thumbs.db')}, le cache de miniatures de Windows) ne sont ni comptés ni copiés : Windows les recrée.`}</p>

<h2>${t`Dossiers (${nombre(dossiers.length + (racine && racine.photos + racine.videos ? 1 : 0))})`}</h2>
<table>
<thead><tr><th>${t`Dossier dans Photos/`}</th><th>${t`Dates`}</th><th>${t`Photos`}</th><th>${t`Vidéos`}</th></tr></thead>
<tbody>
${racine && racine.photos + racine.videos ? `<tr><td>${t`(à la racine de Photos/)`}</td><td>${jour(racine.du)} – ${jour(racine.au)}</td><td class="n">${nombre(racine.photos)}</td><td class="n">${nombre(racine.videos)}</td></tr>` : ''}
${lignesDossiers}
</tbody>
</table>

${
  album && album.photos
    ? `<h2>${t`Album`}</h2>
<p>${t`${pluriel(album.photos, 'photo')} dans ${code('Album/')}, numérotées dans l’ordre de l’album (${pluriel(album.sections, 'section')}, environ ${pluriel(album.pages, 'page')}) : importez-les dans ifolor dans cet ordre.`} ${t`Titres, introductions et légendes : ${code(`Album/${nomsSortie().textesAlbum}`)}.`}${
        album.manquantes
          ? ` <strong class="echec">${
              album.manquantes > 1
                ? t`${nombre(album.manquantes)} copies n’ont pas pu être écrite(s) : relancez la création de la sortie.`
                : t`${nombre(album.manquantes)} copie n’a pas pu être écrite(s) : relancez la création de la sortie.`
            }</strong>`
          : ''
      }</p>`
    : ''
}

<h2>${t`Mis de côté et autres fichiers`}</h2>
<ul>
${Object.entries(b.categories.misDeCote)
  .map(([r, n]) => `<li>${t`${raison(r, n)}, dans ${code(`${echapper(dossierMisDeCote(r))}/`)}`}</li>`)
  .join('\n')}
<li>${t`${pluriel(b.categories.autres, 'autre fichier', 'autres fichiers')} (ni photo ni vidéo), dans ${code(`${nomsSortie().autres}/`)} avec leur chemin d’origine`}</li>
</ul>
${liste(t`Autres fichiers`, autres)}

<h2>${t`Dates des fichiers`}</h2>
<p>${t`La copie porte la date du jour : le navigateur ne peut pas conserver la date de modification d’origine.`} ${t`Celle de chaque fichier est enregistrée dans ${code('.album/plan.json')}.`}
${
  b.datesFichierSeulement.length
    ? t`Les photos et vidéos ci-dessous n’ont ${`<strong>${t`aucune autre date`}</strong>`} (ni EXIF, ni nom daté) : voici leur date d’origine.`
    : t`Toutes les photos et vidéos ont une date de prise de vue (EXIF, nom ou date interne).`
}</p>
${liste(
  t`Photos et vidéos sans autre date que celle du fichier`,
  b.datesFichierSeulement.map((f) => t`${f.id} — modifié le ${new Date(f.modifie).toLocaleString(locale)}`),
)}
${b.enTrop.length ? `<h2>${t`Fichiers de la sortie hors du plan`}</h2><p>${t`Présents dans la sortie mais absents du plan (déposés à la main, ou anciennes copies) : ils n’ont pas été touchés.`}</p>${liste(t`Fichiers`, b.enTrop)}` : ''}
</body>
</html>
`;
}
