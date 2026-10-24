#!/usr/bin/env python3
"""Vecteurs de référence pour les tests du phash et de la netteté.

Calcule, avec les mêmes bibliothèques que les scripts Python d'origine
(Pillow, imagehash, OpenCV), les valeurs que le portage JavaScript doit
retrouver.

Usage (depuis app/) :
    python3 -I outils/vecteurs_reference.py synthetiques > tests/vecteurs/synthetiques.json
    python3 -I outils/vecteurs_reference.py photos ../tests/photos_reelles

Le mode « photos » écrit vecteurs_reference.json dans le dossier des photos,
non versionné : les noms de fichiers contiennent des prénoms et des lieux.
"""

import json
import sys
from itertools import combinations
from pathlib import Path

import cv2
import imagehash
import numpy as np
from PIL import Image, ImageOps

# ---------------------------------------------------------------------------
# Images de synthèse (même formule que tests/aides/synthetiques.ts)
# ---------------------------------------------------------------------------

TAILLES = [(640, 480), (333, 517), (1600, 900), (2048, 1536), (4000, 1848)]
MOTIFS = ["bruit", "degrade", "damier", "anneaux"]


def image_synthetique(motif: str, largeur: int, hauteur: int) -> np.ndarray:
    """Image RVB uint8 de forme (hauteur, largeur, 3)."""
    y, x = np.mgrid[0:hauteur, 0:largeur].astype(np.int64)
    if motif == "bruit":
        # Générateur congruentiel identique en JavaScript : un tirage par octet.
        n = largeur * hauteur * 3
        valeurs = np.empty(n, dtype=np.uint8)
        etat = 12345
        for i in range(n):
            etat = (etat * 1103515245 + 12345) & 0x7FFFFFFF
            valeurs[i] = (etat >> 16) & 0xFF
        return valeurs.reshape(hauteur, largeur, 3)
    if motif == "degrade":
        r = (x * 5) & 255
        g = (y * 3) & 255
        b = ((x + y) * 2) & 255
        return np.stack([r, g, b], axis=-1).astype(np.uint8)
    if motif == "damier":
        v = np.where(((x >> 3) + (y >> 3)) & 1, 230, 25)
        return np.stack([v, v, v], axis=-1).astype(np.uint8)
    if motif == "anneaux":
        cx, cy = largeur // 3, hauteur // 2
        v = (((x - cx) ** 2 + (y - cy) ** 2) >> 4) & 255
        return np.stack([v, (v * 3) & 255, 255 - v], axis=-1).astype(np.uint8)
    raise ValueError(motif)


def nettete_gris(gris: np.ndarray, cote_max: int) -> float:
    """Copie de sharpness_score (script 01) et tech_score (script 06) sur une image grise."""
    h, w = gris.shape[:2]
    echelle = cote_max / max(h, w)
    if echelle < 1.0:
        gris = cv2.resize(gris, (int(w * echelle), int(h * echelle)))
    return float(cv2.Laplacian(gris, cv2.CV_64F).var())


def resume_reduction(gris: np.ndarray, cote_max: int) -> dict:
    h, w = gris.shape[:2]
    echelle = cote_max / max(h, w)
    if echelle < 1.0:
        gris = cv2.resize(gris, (int(w * echelle), int(h * echelle)))
    g = gris.astype(np.int64)
    return {
        "largeur": int(gris.shape[1]),
        "hauteur": int(gris.shape[0]),
        "somme": int(g.sum()),
        "somme_carres": int((g * g).sum()),
        "debut": [int(v) for v in gris.flatten()[:64]],
    }


def bits_ambigus(gris32: list) -> list:
    """Bits du phash dont le coefficient DCT égale la médiane (motifs symétriques) :
    le bruit flottant décide de leur valeur, en Python comme en JavaScript."""
    import scipy.fftpack
    g = np.array(gris32, dtype=np.uint8).reshape(32, 32)
    dct = scipy.fftpack.dct(scipy.fftpack.dct(g, axis=0), axis=1)[:8, :8]
    mediane = np.median(dct)
    return [int(i) for i in np.flatnonzero(np.abs(dct - mediane).flatten() < 1e-6)]


def gris32_pillow(img: Image.Image) -> list:
    """Image 32×32 que imagehash.phash passe à la DCT."""
    return [int(v) for v in np.asarray(img.convert("L").resize((32, 32), Image.Resampling.LANCZOS)).flatten()]


def synthetiques() -> dict:
    cas = []
    for motif in MOTIFS:
        for largeur, hauteur in TAILLES:
            rvb = image_synthetique(motif, largeur, hauteur)
            img = Image.fromarray(rvb, "RGB")
            gris_cv = cv2.cvtColor(rvb, cv2.COLOR_RGB2GRAY)
            gris_pil = np.asarray(img.convert("L")).astype(np.int64)
            g32 = gris32_pillow(img)
            cas.append({
                "motif": motif,
                "largeur": largeur,
                "hauteur": hauteur,
                "somme_gris_pillow": int(gris_pil.sum()),
                "somme_gris_opencv": int(gris_cv.astype(np.int64).sum()),
                "gris32": g32,
                "phash": str(imagehash.phash(img)),
                "bits_ambigus": bits_ambigus(g32),
                "reduction_1024": resume_reduction(gris_cv, 1024),
                "nettete_1024": nettete_gris(gris_cv, 1024),
                "nettete_800": nettete_gris(gris_cv, 800),
            })
    return {
        "genere_par": "outils/vecteurs_reference.py synthetiques",
        "versions": {"pillow": Image.__version__, "imagehash": imagehash.__version__,
                     "opencv": cv2.__version__, "numpy": np.__version__},
        "cas": cas,
    }


# ---------------------------------------------------------------------------
# Photos réelles
# ---------------------------------------------------------------------------

def photos(dossier: Path) -> dict:
    resultats = []
    for chemin in sorted(dossier.glob("*.jpg")):
        with Image.open(chemin) as brute:
            orientation = brute.getexif().get(0x0112, 1)
            phash_brut = str(imagehash.phash(brute.convert("RGB")))   # comme les scripts
            orientee = ImageOps.exif_transpose(brute).convert("RGB")
        rvb = np.asarray(orientee)
        donnees = np.fromfile(str(chemin), dtype=np.uint8)
        gris_y = cv2.imdecode(donnees, cv2.IMREAD_GRAYSCALE)          # comme les scripts 01 et 06
        gris_rvb = cv2.cvtColor(rvb, cv2.COLOR_RGB2GRAY)
        resultats.append({
            "fichier": chemin.name,
            "orientation": orientation,
            "largeur": orientee.width,
            "hauteur": orientee.height,
            "phash_brut": phash_brut,
            "phash_oriente": str(imagehash.phash(orientee)),
            "gris32_oriente": gris32_pillow(orientee),
            "nettete_1024": nettete_gris(gris_y, 1024),
            "nettete_800": nettete_gris(gris_y, 800),
            "nettete_1024_rvb": nettete_gris(gris_rvb, 1024),
        })
    distances = []
    for a, b in combinations(resultats, 2):
        ha_b, hb_b = imagehash.hex_to_hash(a["phash_brut"]), imagehash.hex_to_hash(b["phash_brut"])
        ha_o, hb_o = imagehash.hex_to_hash(a["phash_oriente"]), imagehash.hex_to_hash(b["phash_oriente"])
        distances.append({"a": a["fichier"], "b": b["fichier"],
                          "brut": int(ha_b - hb_b), "oriente": int(ha_o - hb_o)})
    return {
        "genere_par": "outils/vecteurs_reference.py photos",
        "versions": {"pillow": Image.__version__, "imagehash": imagehash.__version__,
                     "opencv": cv2.__version__, "numpy": np.__version__},
        "photos": resultats,
        "distances": distances,
    }


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "synthetiques":
        json.dump(synthetiques(), sys.stdout, indent=1)
        sys.stdout.write("\n")
    elif len(sys.argv) >= 3 and sys.argv[1] == "photos":
        dossier = Path(sys.argv[2])
        sortie = dossier / "vecteurs_reference.json"
        sortie.write_text(json.dumps(photos(dossier), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Écrit : {sortie}")
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
