// Appels IA du projet (SPEC § 7.2, § 7.3) : cache des réponses dans
// `.album/cache_ia.json` (relancer ne repaie jamais), budget du projet avec
// pause avant dépassement, coût de chaque appel dans le journal, 3 appels
// simultanés au plus. Les réponses sont réparées puis rendues telles quelles :
// la validation de structure revient à l'appelant (règle d'or 6).

import Anthropic from '@anthropic-ai/sdk';
import { extraireJson } from '../lib/doublons';
import { outilRechercheWeb } from '../lib/nommage';
import { coutUSD, MODELES, modele as infoModele, type Consommation } from '../lib/tarifs';
import { client } from './claude';
import type { EtatProjet, Projet } from './projet';

const FICHIER_CACHE = 'cache_ia.json';
const SIMULTANES = 3;

/** Le budget du projet serait dépassé : l'appel n'est pas fait (pause). */
export class BudgetAtteint extends Error {
  constructor() {
    super('Budget IA du projet atteint : augmentez-le (étape 1) pour continuer.');
  }
}

export interface Appel {
  /** Fonction du catalogue (« IA7 »), pour le journal et le détail des coûts. */
  fonction: string;
  modele: string;
  systeme: string;
  /** Images JPEG en base64, présentées « Planche 1 : », « Planche 2 : »… comme dans le script 06. */
  planches?: string[];
  /** Photos envoyées une par une, chacune précédée de son étiquette (« Photo 3 : »). */
  photos?: { etiquette: string; donnees: string }[];
  /** Contenu libre, dans l'ordre (textes et images JPEG en base64), avant la consigne. */
  blocs?: ({ type: 'texte'; texte: string } | { type: 'image'; donnees: string })[];
  /** Outils côté API fournis tels quels (recherche web d'une version donnée). */
  outils?: unknown[];
  consigne: string;
  /** Recherche web côté API (outil `web_search`), au plus ce nombre de recherches. */
  rechercheWeb?: number;
  /** Clé du cache, construite avec l'identité des photos (jamais leur chemin). */
  cle: string;
  /** Coût estimé de l'appel, pour la pause avant dépassement du budget. */
  estimationUSD: number;
  /** Format de réponse demandé (sorties structurées) ; la réparation reste faite. */
  schema?: Record<string, unknown>;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}

type EntreeCache = { r: unknown; quand: string; modele: string };

export class ServiceIA {
  private cache: Record<string, EntreeCache> = {};
  private ecriture: Promise<void> = Promise.resolve();
  private enCours = 0;
  private attente: (() => void)[] = [];
  /** Le modèle a refusé le format structuré : on s'en passe pour le reste de la session. */
  private sansFormat = new Set<string>();
  /** Appels en vol, par clé : deux demandes identiques simultanées ne paient qu'une fois. */
  private enVol = new Map<string, Promise<unknown | null>>();
  /** Coût estimé des appels en cours, réservé sur le budget. */
  private reserveUSD = 0;

  constructor(
    private etat: EtatProjet,
    private projet: Projet,
    private tauxUsdChf: () => number,
    private apresDepense: (alerte: string | null) => void,
    private journal: (type: string, message: string, donnees?: unknown) => void,
  ) {}

  async charger(): Promise<void> {
    const brut = await this.etat.lireBrut(FICHIER_CACHE).catch(() => undefined);
    if (brut === undefined) {
      this.cache = {};
      return;
    }
    try {
      const v = JSON.parse(brut);
      this.cache = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch {
      // Cache abîmé : il est mis de côté (jamais écrasé), on repart d'un cache vide.
      const nom = `cache_ia_illisible_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await this.etat.ecrire(nom, brut).catch(() => undefined);
      this.journal('alerte', `Cache des réponses IA illisible : gardé dans .album/${nom}, les aides devront être relancées.`);
      this.cache = {};
    }
  }

  enCache(cle: string): boolean {
    return cle in this.cache;
  }

  depenseUSD(): number {
    return Object.values(this.projet.couts_usd ?? {}).reduce((a, b) => a + b, 0);
  }

  depenseCHF(): number {
    return this.depenseUSD() * this.tauxUsdChf();
  }

  /** Reste du budget en USD. */
  resteUSD(): number {
    return this.projet.budget_chf / this.tauxUsdChf() - this.depenseUSD();
  }

  private async place(): Promise<void> {
    if (this.enCours < SIMULTANES) {
      this.enCours++;
      return;
    }
    await new Promise<void>((r) => this.attente.push(r));
    this.enCours++;
  }

  private liberer() {
    this.enCours--;
    this.attente.shift()?.();
  }

  private enregistrerCache() {
    this.ecriture = this.ecriture.then(() => this.etat.ecrire(FICHIER_CACHE, this.cache)).catch(() => undefined);
    return this.ecriture;
  }

  private noterCout(a: Appel, usage: Consommation) {
    // Modèle absent de la table des tarifs : compté au prix du plus cher, pour ne jamais sous-estimer le budget.
    const usd = coutUSD(a.modele, usage) ?? Math.max(...MODELES.map((m) => coutUSD(m.id, usage) ?? 0));
    const avant = this.depenseCHF();
    this.projet.couts_usd = { ...this.projet.couts_usd, [a.fonction]: (this.projet.couts_usd?.[a.fonction] ?? 0) + usd };
    const apres = this.depenseCHF();
    let alerte: string | null = null;
    for (const seuil of [0.8, 0.5]) {
      if (avant < seuil * this.projet.budget_chf && apres >= seuil * this.projet.budget_chf) {
        alerte = `${Math.round(seuil * 100)} % du budget IA du projet dépensé (${apres.toFixed(2).replace('.', ',')} / ${this.projet.budget_chf} CHF).`;
        break;
      }
    }
    this.journal('ia', `${a.fonction} : ${usd.toFixed(4)} USD (${a.modele})`, {
      fonction: a.fonction,
      modele: a.modele,
      usd,
      entree: usage.input_tokens,
      sortie: usage.output_tokens,
    });
    this.apresDepense(alerte);
  }

  /**
   * Appel avec cache : la réponse réparée (JSON), ou `null` si elle est
   * inexploitable (illisible, refus du modèle). Une erreur réseau ou de l'API
   * est levée, et rien n'est mis en cache : relancer réessaiera.
   */
  async appeler(a: Appel): Promise<unknown | null> {
    if (a.cle in this.cache) return this.cache[a.cle].r;
    const deja = this.enVol.get(a.cle);
    if (deja) return deja;
    const p = this.appelerUneFois(a);
    this.enVol.set(a.cle, p);
    try {
      return await p;
    } finally {
      this.enVol.delete(a.cle);
    }
  }

  private async appelerUneFois(a: Appel): Promise<unknown | null> {
    await this.place();
    // Budget vérifié une fois la place obtenue, en comptant les appels déjà en cours.
    if (a.estimationUSD > this.resteUSD() - this.reserveUSD) {
      this.liberer();
      throw new BudgetAtteint();
    }
    this.reserveUSD += a.estimationUSD;
    try {
      if (a.cle in this.cache) return this.cache[a.cle].r;
      const contenu: Anthropic.ContentBlockParam[] = [];
      const image = (b64: string): Anthropic.ContentBlockParam => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
      (a.planches ?? []).forEach((b64, i) => contenu.push({ type: 'text', text: `Planche ${i + 1} :` }, image(b64)));
      for (const p of a.photos ?? []) contenu.push({ type: 'text', text: p.etiquette }, image(p.donnees));
      for (const b of a.blocs ?? []) contenu.push(b.type === 'texte' ? { type: 'text', text: b.texte } : image(b.donnees));
      if (a.consigne) contenu.push({ type: 'text', text: a.consigne });
      const avecFormat = !!a.schema && !this.sansFormat.has(a.modele);
      const outils: Anthropic.ToolUnion[] = a.outils?.length
        ? (a.outils as Anthropic.ToolUnion[])
        : a.rechercheWeb
          ? [outilRechercheWeb(a.modele, a.rechercheWeb) as Anthropic.ToolUnion]
          : [];
      const requete = (format: boolean, messages: Anthropic.MessageParam[]) =>
        client().messages.create(
          {
            model: a.modele,
            max_tokens: a.maxTokens ?? 16000,
            system: a.systeme,
            messages,
            ...(outils.length ? { tools: outils } : {}),
            ...(format || (a.effort && infoModele(a.modele)?.effort)
              ? {
                  output_config: {
                    ...(a.effort && infoModele(a.modele)?.effort ? { effort: a.effort } : {}),
                    ...(format ? { format: { type: 'json_schema' as const, schema: a.schema! } } : {}),
                  },
                }
              : {}),
          },
          { maxRetries: 4 },
        );
      const messages: Anthropic.MessageParam[] = [{ role: 'user', content: contenu }];
      let format = avecFormat;
      let reponse: Anthropic.Message;
      try {
        reponse = await requete(format, messages);
      } catch (err) {
        // Schéma refusé par ce modèle : même appel sans format, la réparation suffit.
        // (Seulement si l'erreur porte sur le format : une autre erreur 400 est rendue telle quelle.)
        if (!(avecFormat && err instanceof Anthropic.BadRequestError && /output_config|format|schema/i.test(err.message))) throw err;
        this.sansFormat.add(a.modele);
        format = false;
        reponse = await requete(false, messages);
      }
      this.noterCout(a, reponse.usage);
      // Une longue recherche web peut s'interrompre (pause_turn) : on la laisse reprendre.
      for (let reprise = 0; reponse.stop_reason === 'pause_turn' && reprise < 3; reprise++) {
        messages.push({ role: 'assistant', content: reponse.content as Anthropic.ContentBlockParam[] });
        reponse = await requete(format, messages);
        this.noterCout(a, reponse.usage);
      }
      let r: unknown = null;
      if (reponse.stop_reason !== 'refusal') {
        // Le texte qui suit le dernier résultat d'outil : la réponse, sans le préambule des recherches.
        const dernierOutil = reponse.content.map((b) => b.type).lastIndexOf('web_search_tool_result');
        const texte = reponse.content
          .slice(dernierOutil + 1)
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join('');
        try {
          r = extraireJson(texte);
        } catch {
          r = null;
        }
      }
      if (r === null) this.journal('alerte', `${a.fonction} : réponse inexploitable (${reponse.stop_reason ?? 'illisible'}), ignorée`);
      this.cache[a.cle] = { r, quand: new Date().toISOString(), modele: a.modele };
      await this.enregistrerCache();
      return r;
    } finally {
      this.reserveUSD -= a.estimationUSD;
      this.liberer();
    }
  }

  /** Oublie les réponses inexploitables, pour les redemander. */
  async oublierInexploitables(): Promise<number> {
    const cles = Object.keys(this.cache).filter((c) => this.cache[c].r === null);
    for (const c of cles) delete this.cache[c];
    if (cles.length) await this.enregistrerCache();
    return cles.length;
  }
}
