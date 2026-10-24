// Dossier config/ commun (SPEC § 8) : lecture validée, écriture sûre avec
// sauvegarde horodatée, et refus d'écraser une modification faite ailleurs.

import { nomSauvegarde, sauvegardesEnTrop, validerConfig, type Config } from '../lib/config';
import { t } from '../lib/langue';

export const NOM_CONFIG = 'config.json';

export interface LectureConfig {
  config: Config | null;
  erreurs: string[];
  texte: string;
  modifie: number;
  taille: number;
}

export class ModifieAilleurs extends Error {
  constructor() {
    super(t`config.json a été modifié ailleurs depuis sa lecture : rechargez-le avant d’enregistrer.`);
  }
}

export class DossierConfig {
  constructor(readonly dossier: FileSystemDirectoryHandle) {}

  /** `null` si le dossier ne contient pas encore de config.json. */
  async lire(): Promise<LectureConfig | null> {
    let f: File;
    try {
      f = await (await this.dossier.getFileHandle(NOM_CONFIG)).getFile();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') return null;
      throw err;
    }
    const texte = await f.text();
    let erreurs: string[];
    let config: Config | null = null;
    try {
      const v = JSON.parse(texte);
      erreurs = validerConfig(v);
      if (!erreurs.length) config = v as Config;
    } catch (err) {
      erreurs = [t`JSON illisible : ${(err as Error).message}`];
    }
    return { config, erreurs, texte, modifie: f.lastModified, taille: f.size };
  }

  /**
   * Enregistre `config` : sauvegarde de la version actuelle dans
   * `sauvegardes/` (10 dernières), puis remplacement d'un coup. `lu` est la
   * lecture de départ : si le fichier a changé depuis, rien n'est écrit.
   */
  async ecrire(config: Config, lu: LectureConfig | null): Promise<LectureConfig> {
    const poignee = await this.dossier.getFileHandle(NOM_CONFIG, { create: true });
    const actuel = await poignee.getFile();
    const texteActuel = await actuel.text();
    if (lu && (actuel.lastModified !== lu.modifie || actuel.size !== lu.taille || texteActuel !== lu.texte)) throw new ModifieAilleurs();
    if (!lu && actuel.size > 0) throw new ModifieAilleurs();

    if (actuel.size > 0) {
      const sauvegardes = await this.dossier.getDirectoryHandle('sauvegardes', { create: true });
      const w = await (await sauvegardes.getFileHandle(nomSauvegarde(new Date()), { create: true })).createWritable();
      await w.write(texteActuel);
      await w.close();
      const noms: string[] = [];
      for await (const nom of sauvegardes.keys()) noms.push(nom);
      for (const nom of sauvegardesEnTrop(noms, 10)) await sauvegardes.removeEntry(nom);
    }

    const nouvelle = { ...config, modifie_le: new Date().toISOString().slice(0, 19) };
    const texte = `${JSON.stringify(nouvelle, null, 2)}\n`;
    const w = await poignee.createWritable();
    await w.write(texte);
    await w.close();
    const f = await poignee.getFile();
    return { config: nouvelle, erreurs: [], texte, modifie: f.lastModified, taille: f.size };
  }
}
