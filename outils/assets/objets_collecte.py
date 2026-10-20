# PORTAL RUSH — LES OBJETS À COLLECTER (Blender) → public/rush/modeles/objets-collecte.prm. Voir objets.py.
#
# Ils remplacent les modèles procéduraux « cristal-fragment », « cristal-dore » et « cristal-noyau » (même
# taille, même centre : le jeu les fait tourner et flotter) :
#   fragment — un éclat de données : bipyramide à facettes taillées, tenue par deux bagues et quatre griffes ;
#   dore     — le fragment rare : cristal d'or plus grand dans une cage gyroscopique à deux anneaux ;
#   noyau    — le noyau d'énergie : sphère lumineuse (couleur du cœur) dans trois anneaux croisés à émetteurs.
# Repère du jeu : y vers le haut (Blender : jeu (x, y, z) = Blender (x, z, −y)).

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402,F401  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import matiere  # noqa: E402
from formes import piece, tube  # noqa: E402
from objets import executer  # noqa: E402


def bipyramide(bm, rayon, haut, cotes=6, taille=0.18):
    """Une bipyramide à « cotes » pans, dont les pointes sont tronquées en petites facettes (taille)."""
    anneau = [bm.verts.new((rayon * math.cos(2 * math.pi * i / cotes), rayon * math.sin(2 * math.pi * i / cotes), 0)) for i in range(cotes)]
    # Les pointes tronquées : un petit anneau près de chaque sommet.
    def pointe(z):
        return [bm.verts.new((rayon * taille * math.cos(2 * math.pi * (i + 0.5) / cotes), rayon * taille * math.sin(2 * math.pi * (i + 0.5) / cotes), z * (1 - taille * 0.4))) for i in range(cotes)]
    h, b = pointe(haut), pointe(-haut)
    for i in range(cotes):
        j = (i + 1) % cotes
        bm.faces.new([anneau[i], anneau[j], h[i]])
        bm.faces.new([anneau[j], b[i], anneau[i]])
        bm.faces.new([h[i], anneau[j], h[j]])
        bm.faces.new([b[j], anneau[j], b[i]])
    bm.faces.new(h)
    bm.faces.new(b[::-1])


def bague(bm, rayon, epaisseur, z, segments=24, axe='Z', angle=0.0):
    """Un anneau (tore aplati) autour de l'axe Z (ou incliné de « angle » autour de X)."""
    r = bmesh.ops.create_cone(bm, cap_ends=False, segments=segments, radius1=rayon, radius2=rayon, depth=epaisseur, matrix=Matrix.Rotation(angle, 4, 'X') @ Matrix.Translation((0, 0, z)))
    r2 = bmesh.ops.create_cone(bm, cap_ends=False, segments=segments, radius1=rayon * 0.9, radius2=rayon * 0.9, depth=epaisseur, matrix=Matrix.Rotation(angle, 4, 'X') @ Matrix.Translation((0, 0, z)))
    bmesh.ops.reverse_faces(bm, faces=list({f for v in r2['verts'] for f in v.link_faces}))


def fragment(P):
    cristal = matiere('cristalFragment', '#9fe6ff', 0.3, 0.08, 0.95)
    ob = [piece('eclat', lambda bm: bipyramide(bm, 0.19, 0.4), cristal)]
    def monture(bm):
        bague(bm, 0.215, 0.035, 0.07)
        bague(bm, 0.215, 0.035, -0.07)
    ob.append(piece('monture', monture, P['alliage']))
    def griffes(bm):
        for k in range(4):
            a = k * math.pi / 2 + math.pi / 4
            tube(bm, (0.2 * math.cos(a), 0.2 * math.sin(a), -0.09), (0.12 * math.cos(a), 0.12 * math.sin(a), 0.2), 0.012, 4)
    ob.append(piece('griffes', griffes, P['acier']))
    return ob, {'halos': [[0, 0, 0.05, 0.8, 0.6, 0.9, 1, 0.7]]}


def dore(P):
    orm = matiere('orCollecte', '#ffcb5c', 1, 0.2, 0.45)
    ob = [piece('eclat', lambda bm: bipyramide(bm, 0.26, 0.5, cotes=8, taille=0.22), orm)]
    def cage(bm):
        bague(bm, 0.48, 0.05, 0, segments=32, angle=math.pi / 2)
        bague(bm, 0.42, 0.045, 0, segments=32, angle=math.pi / 2 + 0.9)
    ob.append(piece('cage', cage, matiere('orBague', '#ffcb5c', 1, 0.25, 0.2)))
    ob.append(piece('axe', lambda bm: tube(bm, (0, 0, -0.62), (0, 0, 0.62), 0.015, 6), P['alliage']))
    return ob, {'halos': [[0, 0, 0.05, 1.1, 1, 0.8, 0.4, 0.7]]}


def noyau(P):
    ob = []
    def sphere(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.3)
    ob.append(piece('coeur', sphere, P['coeur']))
    def anneaux(bm):
        for k, a in enumerate((math.pi / 2, math.pi / 2 + 1.05, math.pi / 2 - 1.05)):
            bague(bm, 0.56 - k * 0.05, 0.04, 0, segments=32, angle=a)
    ob.append(piece('anneaux', anneaux, P['alliage']))
    def emetteurs(bm):
        for k in range(6):
            a = k * math.pi / 3
            r = bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.transform(bm, matrix=Matrix.Translation((0.53 * math.cos(a), 0, 0.53 * math.sin(a))) @ Matrix.Diagonal((0.06, 0.06, 0.06, 1)), verts=r['verts'])
    ob.append(piece('emetteurs', emetteurs, P['accent']))
    return ob, {'halos': [[0, 0, 0.05, 1.2, 1, 0.6, 0.35, 0.9]]}


OBJETS = {'cristal-fragment': fragment, 'cristal-dore': dore, 'cristal-noyau': noyau}

if __name__ == '__main__':
    executer(OBJETS, 'objets-collecte.prm', {k: ((0, 0, 0), 2.2) for k in OBJETS})
