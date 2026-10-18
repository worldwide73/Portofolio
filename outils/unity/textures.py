"""PORTAL RUSH → UNITY : TEXTURES PBR PROCÉDURALES (revêtement de la route, métal de structure)

Écrit dans unity/PortalRush/Assets/PortalRush/Textures/ des textures raccordables (bord à bord) pour le shader
URP « Lit » :  <nom>_Couleur.png (sRGB),  <nom>_Normal.png (normal map, convention OpenGL : vert = haut),
<nom>_Masque.png (R = métal, A = lissé ; le canal « Metallic Alpha » d'URP). Aucune ressource extérieure : tout est
calculé ici (bruits périodiques par FFT), donc libre de droits.

Correspondance avec la géométrie (Jeu/Route.cs) :
  • Revêtement : u = largeur entière de la chaussée (11,2 m : trois voies de 3,2 m + accotements), v = 8 m le long
    de la route. Les voies sont centrées en u = 0,214 / 0,5 / 0,786, leurs limites en u = 0,357 / 0,643.
  • Structure : u = 2 m le long du profil, v = 8 m le long de la route.

Utilisation : python3 outils/unity/textures.py [--apercu dossier]
"""
import argparse
import os

import numpy as np
from PIL import Image

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SORTIE = os.path.join(RACINE, 'unity', 'PortalRush', 'Assets', 'PortalRush', 'Textures')
T = 1024


def bruit(n, beta, graine, anisotropie=(1.0, 1.0)):
    """Bruit périodique (raccordable) de spectre 1/f^beta, normalisé dans [0, 1]. anisotropie étire (u, v)."""
    rng = np.random.default_rng(graine)
    blanc = rng.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * anisotropie[1]
    fx = np.fft.fftfreq(n)[None, :] * anisotropie[0]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    spectre = np.fft.fft2(blanc) / (f ** beta)
    spectre[0, 0] = 0
    b = np.real(np.fft.ifft2(spectre))
    b -= b.min()
    return b / max(1e-9, b.max())


def lisse(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def rainure(coord, positions, largeur):
    """1 au fond d'une rainure (profil arrondi), 0 ailleurs ; coord et positions dans [0, 1), périodiques."""
    r = np.zeros_like(coord)
    for p in positions:
        d = np.abs(((coord - p + 0.5) % 1.0) - 0.5)
        r = np.maximum(r, 1 - lisse(d, largeur * 0.35, largeur))
    return r


def normales(hauteur, force, taille_u, taille_v):
    """Normal map depuis une hauteur (m), ligne 0 = v = 1 (haut de l'image). Retourne RGB uint8."""
    h = hauteur[::-1]  # ligne 0 = v = 0 pour calculer dans le repère (u, v)
    n = h.shape[0]
    du = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) / (2 * taille_u / n)
    dv = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) / (2 * taille_v / n)
    nx, ny, nz = -du * force, -dv * force, np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / l, ny / l, nz / l], axis=-1)[::-1]
    return np.clip((rgb * 0.5 + 0.5) * 255 + 0.5, 0, 255).astype(np.uint8)


def ecrire(nom, couleur, normal, metal, lisse_):
    os.makedirs(SORTIE, exist_ok=True)
    srgb = np.clip(np.power(np.clip(couleur, 0, 1), 1 / 2.2) * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(srgb, 'RGB').save(os.path.join(SORTIE, f'{nom}_Couleur.png'), optimize=True)
    Image.fromarray(normal, 'RGB').save(os.path.join(SORTIE, f'{nom}_Normal.png'), optimize=True)
    masque = np.zeros((T, T, 4), np.uint8)
    masque[..., 0] = np.clip(metal * 255 + 0.5, 0, 255).astype(np.uint8)
    masque[..., 1] = masque[..., 0]
    masque[..., 2] = masque[..., 0]
    masque[..., 3] = np.clip(lisse_ * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(masque, 'RGBA').save(os.path.join(SORTIE, f'{nom}_Masque.png'), optimize=True)
    return srgb


def revetement():
    """Chaussée continue et lisse : composite sombre brillant, poli d'usure au centre des voies, reflets irréguliers
    (comme une surface légèrement mouillée), un seul joint discret tous les 8 m, et près de chaque bordure un caniveau
    technique (rainure avec grilles). Pas de quadrillage de plaques."""
    v, u = np.meshgrid(np.linspace(0, 1, T, endpoint=False), np.linspace(0, 1, T, endpoint=False), indexing='ij')
    v = 1 - v  # ligne 0 = haut = v proche de 1
    largeur, longueur = 11.2, 8.0
    grand = bruit(T, 1.8, 11)
    grain = bruit(T, 0.6, 12)
    trainees = bruit(T, 1.3, 13, anisotropie=(5.0, 0.3))  # étirées le long de la route
    taches = bruit(T, 1.4, 15)

    x = (u - 0.5) * largeur  # position latérale (m), 0 au centre
    joint = rainure(v, [0.0], 0.012 / longueur * 2.0) * (np.abs(x) < 5.0)

    # Caniveaux techniques : rainure de 24 cm à 40 cm du bord, avec des fentes de grille tous les 12 cm.
    caniveau = np.zeros_like(u)
    grille = np.zeros_like(u)
    for c in (-5.15, 5.15):
        d = np.abs(x - c)
        k = 1 - lisse(d, 0.09, 0.12)
        caniveau = np.maximum(caniveau, k)
        fente = (np.abs(((v * longueur) % 0.12) - 0.06) < 0.022)
        grille = np.maximum(grille, k * fente * (d < 0.085))

    # Usure polie au centre de chaque voie, bords irréguliers.
    usure = np.zeros_like(u)
    for c in (-3.2, 0.0, 3.2):
        d = np.abs(x - c)
        usure = np.maximum(usure, 1 - lisse(d + (trainees - 0.5) * 0.6, 0.3, 1.25))

    base = 0.1 + (grand - 0.5) * 0.03 + (grain - 0.5) * 0.01 + usure * 0.012
    base = base * (1 - joint * 0.4) * (1 - caniveau * 0.45) + grille * 0.05
    couleur = np.stack([base * 0.95, base * 0.99, base * 1.06], axis=-1)

    hauteur = (grain - 0.5) * 0.0003 + (trainees - 0.5) * 0.00025 - joint * 0.0025 - caniveau * 0.012 + grille * 0.008
    normal = normales(hauteur, 1.0, largeur, longueur)
    metal = np.clip(0.3 + grille * 0.6 + caniveau * 0.2, 0, 1)
    # La brillance varie lentement (zones plus « mouillées ») : c'est ce qui donne des reflets vivants sur la route.
    lisse_ = np.clip(0.6 + usure * 0.15 + (taches - 0.5) * 0.22 + (trainees - 0.5) * 0.08 - joint * 0.3 - caniveau * 0.25, 0.08, 0.95)
    return ecrire('Revetement', couleur, normal, metal, lisse_)


def structure():
    """Métal de structure : plaques de longueurs variées (1 m de large), joints, boulons, panneaux nervurés et
    grilles d'aération par endroits, brossage le long de la route, éclats clairs près des arêtes."""
    v, u = np.meshgrid(np.linspace(0, 1, T, endpoint=False), np.linspace(0, 1, T, endpoint=False), indexing='ij')
    v = 1 - v
    largeur, longueur = 2.0, 8.0
    brosse = bruit(T, 0.9, 21, anisotropie=(6.0, 0.15))
    grand = bruit(T, 1.7, 22)
    rayures = bruit(T, 0.4, 23, anisotropie=(1.0, 0.05))
    colonne = (u >= 0.5).astype(int)
    # Chaque colonne de 1 m a ses propres coupes (longueurs de plaques variées), raccordées sur 8 m.
    coupes = [[0.0, 0.19, 0.44, 0.62, 0.81], [0.0, 0.31, 0.5, 0.75]]
    joints_v = np.zeros_like(u)
    debut = np.zeros_like(u)
    fin = np.ones_like(u)
    for ci, liste in enumerate(coupes):
        masque = colonne == ci
        joints_v = np.where(masque, rainure(v, liste, 0.015 / longueur * 2.0), joints_v)
        bornes = liste + [1.0]
        for k in range(len(liste)):
            dans = masque & (v >= bornes[k]) & (v < bornes[k + 1])
            debut = np.where(dans, bornes[k], debut)
            fin = np.where(dans, bornes[k + 1], fin)
    joints = np.maximum(rainure(u, [0.0, 0.5], 0.015 / largeur * 2.0), joints_v)
    # Une plaque sur trois est nervurée, une sur cinq porte une grille d'aération.
    index = np.floor(debut * 101 + colonne * 13 + 7).astype(int)
    nervuree = (index % 3) == 0
    aeree = (index % 5) == 1
    vl = (v - debut) * longueur
    ul = ((u % 0.5) * largeur)
    nervures = nervuree * (np.abs(((vl % 0.08) - 0.04)) < 0.012) * (ul > 0.08) * (ul < 0.92) * (vl > 0.08) * ((fin - v) * longueur > 0.08)
    fentes = aeree * (np.abs(((ul % 0.1) - 0.05)) < 0.018) * (vl > 0.15) * ((fin - v) * longueur > 0.15) * (ul > 0.15) * (ul < 0.85)
    # Boulons aux coins des plaques.
    boulons = np.zeros_like(u)
    for dv_ in (0.06, -0.06):
        for du_ in (0.06, 0.94):
            r1 = np.sqrt((ul - du_) ** 2 + (vl - 0.06) ** 2)
            r2 = np.sqrt((ul - du_) ** 2 + ((fin - v) * longueur - 0.06) ** 2)
            boulons = np.maximum(boulons, np.maximum(1 - lisse(r1, 0.012, 0.02), 1 - lisse(r2, 0.012, 0.02)))
    pres = np.clip(1 - np.minimum(np.minimum(ul, 1 - ul), np.minimum(vl, (fin - v) * longueur)) / 0.05, 0, 1)
    eclats = (rayures > 0.8) * (0.4 + 0.6 * pres)
    base = 0.36 + (grand - 0.5) * 0.08 + (brosse - 0.5) * 0.04 + (index % 4 - 1.5) * 0.012
    base = base * (1 - joints * 0.6) * (1 - fentes * 0.75) + eclats * 0.12 + boulons * 0.08 + nervures * 0.03
    couleur = np.stack([base * 0.97, base, base * 1.04], axis=-1)
    hauteur = (brosse - 0.5) * 0.0003 - joints * 0.003 + boulons * 0.003 + nervures * 0.0025 - fentes * 0.006
    normal = normales(hauteur, 1.0, largeur, longueur)
    metal = np.clip(0.82 - joints * 0.4 - fentes * 0.5 + eclats * 0.1, 0, 1)
    lisse_ = np.clip(0.5 + (brosse - 0.5) * 0.2 - joints * 0.35 - fentes * 0.3 + eclats * 0.2, 0.05, 0.95)
    return ecrire('Structure', couleur, normal, metal, lisse_)


def main():
    a = argparse.ArgumentParser()
    a.add_argument('--apercu', help='dossier où écrire un aperçu éclairé (vérification visuelle)')
    args = a.parse_args()
    for f in (revetement, structure):
        f()
        print('→', f.__name__)
    if args.apercu:
        os.makedirs(args.apercu, exist_ok=True)
        for nom in ('Revetement', 'Structure'):
            c = np.asarray(Image.open(os.path.join(SORTIE, f'{nom}_Couleur.png'))).astype(float) / 255
            n = np.asarray(Image.open(os.path.join(SORTIE, f'{nom}_Normal.png'))).astype(float) / 255 * 2 - 1
            m = np.asarray(Image.open(os.path.join(SORTIE, f'{nom}_Masque.png'))).astype(float) / 255
            lum = np.array([-0.5, 0.6, 0.62])
            lum /= np.linalg.norm(lum)
            diffus = np.clip((n * lum).sum(-1), 0, 1)[..., None]
            demi = lum + np.array([0, 0, 1.0])
            demi /= np.linalg.norm(demi)
            brillance = np.power(np.clip((n * demi).sum(-1), 0, 1), 8 + 120 * m[..., 3])[..., None] * (0.2 + 0.8 * m[..., 3:4])
            img = np.clip(np.power(c, 2.2) * (0.25 + 0.9 * diffus) + brillance * 0.6, 0, 1)
            # Deux tuiles côte à côte pour voir le raccord.
            img = np.concatenate([img, img], axis=0)
            Image.fromarray((np.power(img, 1 / 2.2) * 255).astype(np.uint8)).resize((512, 1024)).save(os.path.join(args.apercu, f'{nom}.png'))
        print('aperçus →', args.apercu)


if __name__ == '__main__':
    main()
