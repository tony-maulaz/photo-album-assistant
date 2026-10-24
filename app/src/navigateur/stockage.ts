// Petit magasin clé → valeur dans IndexedDB : mémorise les poignées de
// dossiers (FileSystemDirectoryHandle) d'une session à l'autre.

const BASE = 'album-photos';
const MAGASIN = 'cles';

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BASE, 1);
    requete.onupgradeneeded = () => requete.result.createObjectStore(MAGASIN);
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (m: IDBObjectStore) => IDBRequest): Promise<T> {
  const base = await ouvrir();
  try {
    return await new Promise<T>((resoudre, rejeter) => {
      const t = base.transaction(MAGASIN, mode);
      const requete = action(t.objectStore(MAGASIN));
      t.oncomplete = () => resoudre(requete.result as T);
      t.onerror = () => rejeter(t.error);
    });
  } finally {
    base.close();
  }
}

export function lireCle<T>(cle: string): Promise<T | undefined> {
  return transaction<T | undefined>('readonly', (m) => m.get(cle));
}

export function ecrireCle(cle: string, valeur: unknown): Promise<void> {
  return transaction<void>('readwrite', (m) => m.put(valeur, cle));
}

export function effacerCle(cle: string): Promise<void> {
  return transaction<void>('readwrite', (m) => m.delete(cle));
}

/** Lecture tolérante du localStorage (peut lever une exception selon le navigateur). */
export function lireLocal(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

export function ecrireLocal(cle: string, valeur: string | null): void {
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, valeur);
  } catch {
    // Stockage indisponible : la valeur ne sera simplement pas retenue.
  }
}
