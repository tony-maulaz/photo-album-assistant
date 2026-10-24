// Ligne de temps de l'étape « Lieux et sorties » (SPEC § 5.4, § 6.4) : les journées en colonnes,
// chaque dossier en barre du premier au dernier jour, les événements du
// calendrier en bandeau. Un clic sur une barre ouvre le dossier ; le dossier
// choisi dans le panneau (et ses sous-dossiers) est mis en évidence.

import { useEffect, useMemo, useRef } from 'preact/hooks';
import { t } from '../../lib/langue';
import { cheminDossier, estDescendant, RACINE, resumes, type Plan } from '../../lib/plan';
import { etiquettesJours, lendemain, rangsEvenements } from '../../lib/rangement';
import { evenements, session, versionPlan } from '../etat';
import { jourCourt, pluriel } from '../format';
import { choisirVue, vue } from '../organiser';

const LARGEUR_JOUR = 22;
const MAX_JOURS = 400;
/** Hauteur d'une rangée d'événements du calendrier. */
const HAUTEUR_EVENEMENT = 20;
/** Largeur estimée d'un caractère du nom d'un événement (11 px), pour que les noms ne se chevauchent pas. */
const LARGEUR_CARACTERE = 6.5;

/** Première colonne dont le jour est ≥ `j` (les colonnes sont triées). */
function colonneDepuis(colonnes: string[], j: string): number {
  const i = colonnes.findIndex((c) => c >= j);
  return i < 0 ? colonnes.length - 1 : i;
}

/** Dernière colonne dont le jour est ≤ `j`. */
function colonneJusqua(colonnes: string[], j: string): number {
  for (let i = colonnes.length - 1; i >= 0; i--) if (colonnes[i] <= j) return i;
  return 0;
}

function lignes(plan: Plan) {
  const r = resumes(plan);
  return [...plan.dossiers.values()]
    .filter((d) => d.parent !== null && (r.get(d.id)!.photos + r.get(d.id)!.videos > 0) && r.get(d.id)!.du && r.get(d.id)!.au)
    .map((d) => ({ id: d.id, chemin: cheminDossier(plan, d.id), du: r.get(d.id)!.du!.slice(0, 10), au: r.get(d.id)!.au!.slice(0, 10), n: r.get(d.id)!.photos + r.get(d.id)!.videos }))
    .sort((a, b) => a.du.localeCompare(b.du) || a.chemin.localeCompare(b.chemin));
}

export function LigneDeTemps({ ouvrir }: { ouvrir: () => void }) {
  const s = session.value!;
  versionPlan.value;
  const liste = useMemo(() => lignes(s.plan), [versionPlan.value]);
  const choisi = vue.value;
  const conteneur = useRef<HTMLDivElement>(null);
  // Le dossier choisi dans le panneau vient à l'écran, en hauteur comme en largeur.
  useEffect(() => {
    conteneur.current?.querySelector('.ldt-barre.actif')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [choisi, liste]);
  if (!liste.length) return <p class="vide-grille">{t`Aucun dossier daté.`}</p>;
  // Une colonne par jour où il y a des photos : un voyage comme une année tiennent à l'écran ;
  // une double ligne marque les jours sans photo.
  const parJour = new Map<string, number>();
  for (const f of s.plan.fichiers.values()) if (f.statut === 'archive' && f.categorie !== 'autre' && f.date) parJour.set(f.date.slice(0, 10), (parJour.get(f.date.slice(0, 10)) ?? 0) + 1);
  const colonnes = [...parJour.keys()].sort().slice(0, MAX_JOURS);
  if (!colonnes.length) return <p class="vide-grille">{t`Aucun dossier daté.`}</p>;
  const du = colonnes[0];
  const au = colonnes.at(-1)!;
  const max = Math.max(1, ...parJour.values());
  const evts = evenements.value.filter((e) => e.fin.slice(0, 10) >= du && e.debut.slice(0, 10) <= au);
  const largeur = colonnes.length * LARGEUR_JOUR;
  const dates = etiquettesJours(colonnes);
  // Chaque événement : sa barre sur ses jours, son nom en entier à la suite (il dépasse la barre),
  // sur une rangée où il ne touche aucun autre nom (« We… », « Ca… » étaient illisibles).
  const places = evts.map((e) => {
    const a = colonneDepuis(colonnes, e.debut.slice(0, 10));
    const b = Math.max(a, colonneJusqua(colonnes, e.fin.slice(0, 10)));
    const gauche = a * LARGEUR_JOUR;
    const barre = (b - a + 1) * LARGEUR_JOUR - 2;
    return { gauche, barre, debut: gauche, fin: gauche + Math.max(barre, e.titre.length * LARGEUR_CARACTERE + 12) };
  });
  const rangs = rangsEvenements(places);
  const rangees = Math.max(1, ...rangs.map((r) => r + 1));

  return (
    <div class="ligne-de-temps" ref={conteneur}>
      {colonnes.length >= MAX_JOURS && <p class="discret">{t`Période très longue : seuls les ${MAX_JOURS} premiers jours avec photos sont montrés.`}</p>}
      <div class="ldt-grille" style={{ width: `${largeur + 260}px` }}>
        <div class="ldt-ligne ldt-entete">
          <div class="ldt-nom" />
          <div class="ldt-piste" style={{ width: `${largeur}px` }}>
            {colonnes.map((j, i) => {
              const saut = i > 0 && lendemain(colonnes[i - 1]) !== j;
              return (
                <div key={j} class={`ldt-jour${saut ? ' saut' : ''}`} style={{ left: `${i * LARGEUR_JOUR}px` }} title={t`${jourCourt(j)} : ${pluriel(parJour.get(j) ?? 0, 'photo')}`}>
                  <span class="ldt-histo" style={{ height: `${((parJour.get(j) ?? 0) / max) * 100}%` }} />
                  {dates.has(i) && <span class="ldt-date">{dates.get(i)}</span>}
                </div>
              );
            })}
          </div>
        </div>
        {evts.length > 0 && (
          <div class="ldt-ligne ldt-evenements" style={{ height: `${rangees * HAUTEUR_EVENEMENT + 6}px` }}>
            <div class="ldt-nom discret">{t`Calendrier`}</div>
            <div class="ldt-piste" style={{ width: `${largeur}px` }}>
              {evts.map((e, k) => (
                <span
                  key={k}
                  class="ldt-evenement"
                  style={{ left: `${places[k].gauche}px`, width: `${places[k].barre}px`, top: `${3 + rangs[k] * HAUTEUR_EVENEMENT}px` }}
                  title={`${e.titre}${e.lieu ? ` — ${e.lieu}` : ''} : ${jourCourt(e.debut)}${e.fin.slice(0, 10) > e.debut.slice(0, 10) ? ` – ${jourCourt(e.fin)}` : ''}`}
                >
                  {e.titre}
                </span>
              ))}
            </div>
          </div>
        )}
        {liste.map((l) => {
          const a = colonneDepuis(colonnes, l.du);
          const b = Math.max(a, colonneJusqua(colonnes, l.au));
          const actif = choisi !== RACINE && (l.id === choisi || estDescendant(s.plan, l.id, choisi));
          return (
            <div key={l.id} class={`ldt-ligne${actif ? ' actif' : ''}`}>
              <div class="ldt-nom" title={l.chemin}>
                {l.chemin}
              </div>
              <div class="ldt-piste" style={{ width: `${largeur}px` }}>
                <button
                  type="button"
                  class={`ldt-barre${actif ? ' actif' : ''}`}
                  style={{ left: `${a * LARGEUR_JOUR}px`, width: `${(b - a + 1) * LARGEUR_JOUR - 2}px` }}
                  title={t`${l.chemin} : ${jourCourt(l.du)} – ${jourCourt(l.au)}, ${pluriel(l.n, 'élément')}`}
                  onClick={() => {
                    choisirVue(l.id);
                    ouvrir();
                  }}
                >
                  {l.n}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
