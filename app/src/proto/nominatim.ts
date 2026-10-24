// Point f : Nominatim depuis le navigateur (CORS, identification, 1 requête/s).

import { INTERVALLE_MS, nomDeLieu, rechercher } from '../navigateur/nominatim';
import { ecrireLocal, lireLocal } from '../navigateur/stockage';
import { contexte } from './contexte';
import { noter } from './resultats';
import { bouton, duree, el, nombre, section, type Journal } from './ui';

const CLE_EMAIL = 'album:email_nominatim';

export function monterNominatim() {
  const { corps, journal } = section(
    'f',
    'f. Noms de lieux avec Nominatim (OpenStreetMap)',
    'Par défaut, les coordonnées de la plage de Chaweng Noi (incident I3) : le nom doit être « Baan Chaweng Noi » ou proche, pas vide. L’adresse e-mail est facultative ; elle identifie l’application auprès de Nominatim.',
  );
  const champLat = el('input', { type: 'text', value: '9.5057', classe: 'court' });
  const champLon = el('input', { type: 'text', value: '100.0562', classe: 'court' });
  const champEmail = el('input', { type: 'email', value: lireLocal(CLE_EMAIL) ?? '', placeholder: 'facultatif', classe: 'moyen' });
  champEmail.addEventListener('change', () => ecrireLocal(CLE_EMAIL, champEmail.value.trim() || null));

  corps.append(
    el(
      'div',
      { classe: 'actions' },
      el('label', {}, 'Latitude ', champLat),
      el('label', {}, 'Longitude ', champLon),
      el('label', {}, 'E-mail ', champEmail),
      bouton('Nommer ce lieu', journal, () => nommer(journal, [[Number(champLat.value), Number(champLon.value)]], champEmail.value.trim())),
      bouton('Nommer les lieux des photos (c)', journal, () => {
        const points = new Map<string, [number, number]>();
        for (const p of contexte.photosTest) {
          if (p.exif?.lat === undefined || p.exif.lon === undefined) continue;
          points.set(`${p.exif.lat.toFixed(3)},${p.exif.lon.toFixed(3)}`, [p.exif.lat, p.exif.lon]);
        }
        if (!points.size) throw new Error('Aucune photo avec GPS chargée au point c.');
        return nommer(journal, [...points.values()], champEmail.value.trim());
      }),
      bouton('Rechercher une adresse', journal, async () => {
        const r = await rechercher('Chaweng Noi, Koh Samui', 'fr', champEmail.value.trim() || undefined);
        journal.ok(`Recherche « Chaweng Noi, Koh Samui » : ${r.donnees.length} résultat(s) en ${duree(r.dureeMs)}${r.donnees[0] ? ` — ${r.donnees[0].display_name}` : ''}.`);
        noter('f', 'recherche_adresse', r.donnees.length ? 'ok' : 'avert', `Recherche d’adresse : ${r.donnees.length} résultat(s)`);
      }),
    ),
  );
}

async function nommer(journal: Journal, points: [number, number][], email: string) {
  const envois: number[] = [];
  let erreurs = 0;
  for (const [lat, lon] of points) {
    try {
      const r = await nomDeLieu(lat, lon, email || undefined);
      envois.push(...r.requetes.map((q) => q.envoi));
      const detail = r.requetes.map((q) => `${duree(q.dureeMs)}`).join(' + ');
      journal.ecrire(
        r.nom ? 'ok' : 'avert',
        `${lat.toFixed(4)}, ${lon.toFixed(4)} → ${r.nom ?? 'aucun nom'}${r.nom ? ` (${r.precis ? 'précis' : 'large'}, ${r.langue})` : ''} — ${r.requetes.length} requête(s) : ${detail}`,
      );
      noter('f', `lieu_${lat.toFixed(3)}_${lon.toFixed(3)}`, r.nom ? 'ok' : 'avert', `${r.nom ?? 'aucun nom'} (${r.langue ?? '—'})`, {
        adresseFr: r.requetes[0]?.donnees.address,
      });
    } catch (err) {
      erreurs++;
      const texte = err instanceof TypeError ? `Échec réseau ou CORS : ${err.message}` : String(err);
      journal.echec(texte);
      noter('f', 'erreur', 'echec', texte);
    }
  }
  const ecarts = envois.slice(1).map((t, i) => t - envois[i]);
  if (ecarts.length) {
    const min = Math.min(...ecarts);
    journal.ecrire(min >= INTERVALLE_MS - 5 ? 'ok' : 'echec', `Espacement des requêtes : minimum ${nombre(min)} ms (règle : 1 par seconde).`);
    noter('f', 'cadence', min >= INTERVALLE_MS - 5 ? 'ok' : 'echec', `${envois.length} requêtes, écart minimal ${nombre(min)} ms`);
  }
  noter('f', 'cors', erreurs ? 'echec' : 'ok', `${location.protocol} : ${erreurs ? `${erreurs} échec(s)` : 'requêtes acceptées'}${email ? ' (avec e-mail)' : ' (sans e-mail)'}`);
}
