// Cache des miniatures, hors du dossier de sortie (SPEC § 13) : stockage privé
// du navigateur (OPFS) quand il est disponible, sinon IndexedDB (cas file://,
// où Chrome refuse OPFS). Utilisable depuis la page et depuis les workers.

export type ModeCache = 'opfs' | 'idb';

const DOSSIER = 'miniatures';
const BASE = 'album-photos-miniatures';

let modeDetecte: Promise<ModeCache> | null = null;

/** OPFS si l'écriture y fonctionne, IndexedDB sinon. */
export function modeCache(): Promise<ModeCache> {
  modeDetecte ??= (async () => {
    try {
      const racine = await navigator.storage.getDirectory();
      const f = await racine.getFileHandle('essai_cache', { create: true });
      const w = await f.createWritable();
      await w.write('x');
      await w.close();
      await racine.removeEntry('essai_cache');
      return 'opfs' as const;
    } catch {
      return 'idb' as const;
    }
  })();
  return modeDetecte;
}

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DOSSIER);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, action: (m: IDBObjectStore) => IDBRequest): Promise<T> {
  const base = await ouvrirBase();
  try {
    return await new Promise<T>((ok, ko) => {
      const t = base.transaction(DOSSIER, mode);
      const r = action(t.objectStore(DOSSIER));
      t.oncomplete = () => ok(r.result as T);
      t.onerror = () => ko(t.error);
    });
  } finally {
    base.close();
  }
}

async function dossierOpfs(): Promise<FileSystemDirectoryHandle> {
  return (await navigator.storage.getDirectory()).getDirectoryHandle(DOSSIER, { create: true });
}

export async function ecrireMiniature(mode: ModeCache, cle: string, jpeg: Blob): Promise<void> {
  if (mode === 'idb') {
    await idb('readwrite', (m) => m.put(jpeg, cle));
    return;
  }
  const w = await (await (await dossierOpfs()).getFileHandle(cle, { create: true })).createWritable();
  await w.write(jpeg);
  await w.close();
}

export async function lireMiniature(mode: ModeCache, cle: string): Promise<Blob | undefined> {
  if (mode === 'idb') return idb<Blob | undefined>('readonly', (m) => m.get(cle));
  try {
    return await (await (await dossierOpfs()).getFileHandle(cle)).getFile();
  } catch {
    return undefined;
  }
}

export async function listerMiniatures(mode: ModeCache): Promise<string[]> {
  if (mode === 'idb') return (await idb<IDBValidKey[]>('readonly', (m) => m.getAllKeys())).map(String).sort();
  const cles: string[] = [];
  for await (const nom of (await dossierOpfs()).keys()) cles.push(nom);
  return cles.sort();
}

export async function viderMiniatures(mode: ModeCache): Promise<void> {
  if (mode === 'idb') {
    await idb('readwrite', (m) => m.clear());
    return;
  }
  await (await navigator.storage.getDirectory()).removeEntry(DOSSIER, { recursive: true }).catch(() => undefined);
}
