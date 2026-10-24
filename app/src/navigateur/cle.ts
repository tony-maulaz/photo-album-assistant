// Clé API de l'utilisateur (D28) : gardée le temps de l'onglet (sessionStorage)
// par défaut ; mémorisée sur l'ordinateur (localStorage) seulement sur demande,
// car en file:// toute page HTML locale peut lire ce stockage.

const CLE = 'album:cle_api';

function lire(stockage: Storage): string | null {
  try {
    return stockage.getItem(CLE);
  } catch {
    return null;
  }
}

function ecrire(stockage: Storage, valeur: string | null) {
  try {
    if (valeur === null) stockage.removeItem(CLE);
    else stockage.setItem(CLE, valeur);
  } catch {
    // Stockage indisponible : la clé ne sera simplement pas retenue.
  }
}

export function cleApi(): string | null {
  return lire(sessionStorage) ?? lire(localStorage);
}

/** La clé est-elle mémorisée sur l'ordinateur (et pas seulement pour cet onglet) ? */
export function cleMemorisee(): boolean {
  return lire(localStorage) !== null;
}

export function enregistrerCleApi(cle: string, seSouvenir: boolean) {
  ecrire(sessionStorage, cle);
  ecrire(localStorage, seSouvenir ? cle : null);
}

export function oublierCleApi() {
  ecrire(sessionStorage, null);
  ecrire(localStorage, null);
}

/** Masque une clé pour l'affichage : « sk-ant-…a1b2 ». */
export function cleMasquee(cle: string): string {
  return cle.length > 12 ? `${cle.slice(0, 7)}…${cle.slice(-4)}` : '…';
}
