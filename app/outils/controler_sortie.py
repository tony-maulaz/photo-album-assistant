#!/usr/bin/env python3
"""Contrôle indépendant d'une sortie de l'application (critères A1 et A2).

Vérifie, sans faire confiance au bilan de l'application :
  A2 — chaque fichier du dossier à trier se retrouve dans la sortie avec un
       contenu identique (empreinte SHA-256), où qu'il ait été rangé ;
  A1 — la source n'a pas changé entre deux contrôles (instantané).

Usage :
    python3 controler_sortie.py instantane SOURCE  > avant.json
    python3 controler_sortie.py comparer   SOURCE SORTIE [avant.json]

Les fichiers système masqués par le navigateur (Thumbs.db, desktop.ini) sont
signalés à part : l'application ne peut pas les voir.
"""

import hashlib
import json
import os
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

INVISIBLES = {"thumbs.db", "desktop.ini"}
ETAT = ".album"


def empreinte(chemin: Path) -> str:
    h = hashlib.sha256()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(4 * 1024 * 1024), b""):
            h.update(bloc)
    return h.hexdigest()


def lister(racine: Path, ignorer_etat=False):
    for dossier, sous, fichiers in os.walk(racine):
        if ignorer_etat and Path(dossier) == racine and ETAT in sous:
            sous.remove(ETAT)
        for nom in fichiers:
            yield Path(dossier) / nom


def empreintes(racine: Path, ignorer_etat=False) -> dict:
    chemins = list(lister(racine, ignorer_etat))
    with ThreadPoolExecutor(8) as ex:
        valeurs = list(ex.map(lambda p: (str(p.relative_to(racine)).replace(os.sep, "/"), p.stat().st_size, empreinte(p)), chemins))
    return {chemin: {"taille": t, "sha256": h} for chemin, t, h in valeurs}


def instantane(source: Path):
    json.dump({"source": str(source), "fichiers": empreintes(source)}, sys.stdout, indent=0)


def comparer(source: Path, sortie: Path, avant: Path | None):
    src = empreintes(source)
    out = empreintes(sortie, ignorer_etat=True)
    par_contenu = defaultdict(list)
    for chemin, e in out.items():
        par_contenu[e["sha256"]].append(chemin)

    invisibles = [c for c in src if Path(c).name.lower() in INVISIBLES]
    manquants = [c for c, e in src.items() if c not in invisibles and e["sha256"] not in par_contenu]
    print(f"Source : {len(src)} fichiers ({len(invisibles)} fichiers système invisibles pour le navigateur)")
    print(f"Sortie : {len(out)} fichiers (hors .album/)")
    if manquants:
        print(f"\n✗ A2 : {len(manquants)} fichier(s) de la source absents de la sortie (contenu introuvable) :")
        for c in manquants[:50]:
            print(f"   {c}")
    else:
        print("\n✓ A2 : chaque fichier de la source se retrouve dans la sortie, contenu identique.")

    if avant:
        ancien = json.loads(avant.read_text(encoding="utf-8"))["fichiers"]
        changes = [c for c in set(ancien) | set(src) if ancien.get(c, {}).get("sha256") != src.get(c, {}).get("sha256")]
        if changes:
            print(f"\n✗ A1 : la source a changé ({len(changes)} fichier(s)) :")
            for c in sorted(changes)[:50]:
                print(f"   {c}")
        else:
            print("✓ A1 : la source est identique à l'instantané.")

    connus = {e["sha256"] for e in src.values()}
    en_trop = [c for c, e in out.items() if e["sha256"] not in connus and c != "Rapport.html" and not c.startswith("Album/") and not c.endswith("textes_album.md")]
    if en_trop:
        print(f"\n! {len(en_trop)} fichier(s) de la sortie sans équivalent dans la source (hors rapport et album) :")
        for c in en_trop[:20]:
            print(f"   {c}")
    sys.exit(1 if manquants else 0)


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "instantane":
        instantane(Path(sys.argv[2]))
    elif len(sys.argv) >= 4 and sys.argv[1] == "comparer":
        comparer(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]) if len(sys.argv) > 4 else None)
    else:
        print(__doc__)
        sys.exit(2)


if __name__ == "__main__":
    main()
