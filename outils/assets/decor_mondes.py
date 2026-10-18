# PORTAL RUSH — LES MODULES D'ARCHITECTURE PROPRES À CHAQUE MONDE (Blender). Voir commun.py et decor.py.
#
# Un fichier par monde (public/rush/modeles/monde-<thème>.prm), chargé quand le monde est demandé ; tant
# qu'il n'est pas là, les tronçons gardent leurs pièces procédurales (src/scripts/rush/scene/mondes2.ts).
#   laser — Laser Matrix, installation technologique fermée :
#     mur-tranchee : 6 m de mur de tranchée (côté droit ; le gauche en miroir) — socle, renfoncement à panneaux
#                    vissés (grilles, voyants), nervures à liseré, auvent éclairé par dessous, conduits ;
#     scanner      : le portique scanner qui enjambe la piste — piliers blindés à vérins et émetteurs, caisson
#                    à barre de balayage, têtes laser, radiateurs, câbles.
# Repère du jeu : x latéral, y vers le haut, z vers l'arrière (Blender : jeu (x, y, z) = Blender (x, z, −y)).
# Lancer : <venv>/bin/python outils/assets/decor_mondes.py -- laser   (--sans-apercu pour aller vite)

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import SORTIE, apercu, appliquer, ecrire_prm, figer, joindre, lisser, matiere, modif, palette, vider  # noqa: E402
from decor import barre, extrusion, matieres_decor  # noqa: E402
from formes import boite, miroir_x, piece, tube  # noqa: E402


# ---------------------------------------------------------------------------
# LASER MATRIX
# ---------------------------------------------------------------------------
def mur_tranchee(P):
    ob = []
    L = 3.0
    mur = matiere('murLaser', '#26313a', 0.75, 0.45)
    renfonce = matiere('renfonceLaser', '#161d24', 0.6, 0.55)
    # Le corps du mur, par son profil : socle, marche, renfoncement, lèvre de l'auvent, dessus, dos.
    profil = [
        (5.0, -0.9), (5.0, -0.1), (5.12, 0.0), (5.12, 0.35), (5.2, 0.42), (5.2, 1.72), (5.12, 1.8), (5.12, 2.05),
        (4.92, 2.14), (4.92, 2.3), (5.75, 2.3), (5.75, -0.9),
    ]
    mats = [mur, P['acier'], mur, P['acier'], renfonce, P['acier'], mur, P['blindage'], P['acier'], P['blindage'], mur]
    ob.append(extrusion('mur', profil, -L, L, mur, segments=4, mats=mats))
    # Le liseré sous l'auvent (il éclaire le mur de la couleur du monde).
    ob.append(extrusion('auvent-feu', [(4.95, 2.13), (5.1, 2.07), (5.1, 2.09), (4.95, 2.145)], -L, L, P['accent'], segments=4))
    # Les deux panneaux vissés du renfoncement, avec un jour entre eux.
    def panneaux(bm):
        for y in (-1.45, 1.45):
            boite(bm, (5.17, y, 1.07), (0.06, 2.62, 1.18))
    ob.append(piece('panneaux', panneaux, P['blindageClair'], biseau=0.012))
    # Sur le premier, une grille de ventilation ; sur le second, une colonne de voyants.
    ob.append(piece('grille-fond', lambda bm: boite(bm, (5.135, -1.45, 1.0), (0.01, 1.4, 0.6)), P['joint']))
    def grille(bm):
        for k in range(8):
            boite(bm, (5.13, -1.45 - 0.61 + k * 0.175, 1.0), (0.025, 0.05, 0.56))
    ob.append(piece('grille', grille, P['acier']))
    ob.append(piece('voyants', lambda bm: [boite(bm, (5.135, 1.0 + k * 0.22, 1.42), (0.012, 0.12, 0.05)) for k in range(4)], P['accent2']))
    ob.append(piece('ecran', lambda bm: boite(bm, (5.136, 1.6, 0.85), (0.01, 1.3, 0.42)), matiere('ecranLaser', '#0a1220', 0.5, 0.08, 0.05)))
    ob.append(piece('ecran-lignes', lambda bm: [boite(bm, (5.132, 1.45 + k * 0.08, 0.75 + (k % 3) * 0.1), (0.006, 0.05, 0.03)) for k in range(12)], P['accent']))
    def boulons(bm):
        for y in (-1.45, 1.45):
            for dy in (-1.22, 1.22):
                for z in (0.55, 1.6):
                    boite(bm, (5.135, y + dy, z), (0.025, 0.05, 0.05))
    ob.append(piece('boulons', boulons, P['alliage']))
    # Les nervures aux extrémités du module (deux demi-nervures qui se rejoignent d'un module à l'autre).
    def nervures(bm):
        for y in (-L + 0.1, L - 0.1):
            boite(bm, (5.04, y, 1.0), (0.2, 0.2, 2.1))
    ob.append(piece('nervures', nervures, P['blindage'], biseau=0.02))
    ob.append(piece('nervures-feu', lambda bm: [boite(bm, (4.935, y, 1.15), (0.01, 0.03, 1.4)) for y in (-L + 0.06, L - 0.06)], P['accent']))
    ob.append(piece('alerte', lambda bm: [boite(bm, (4.935, y, 0.2), (0.02, 0.1, 0.12)) for y in (-L + 0.1,)], P['danger']))
    # Les conduits sous l'auvent, et leurs colliers.
    def conduits(bm):
        for k, (x, z, r) in enumerate([(5.0, 1.92, 0.045), (5.06, 1.96, 0.035), (5.08, 1.86, 0.03)]):
            for j in range(2):
                tube(bm, (x, -L + j * L, z), (x, j * L, z), r, 8)
    ob.append(piece('conduits', conduits, P['caoutchouc']))
    ob.append(piece('colliers', lambda bm: [boite(bm, (5.03, y, 1.92), (0.14, 0.05, 0.18)) for y in (-1.5, 0.0, 1.5)], P['acier']))
    for o in ob:
        appliquer(o)
    return ob, {}


def scanner(P):
    ob = []
    X = 5.9
    H = 7.3
    # Les piliers : socle, fût blindé, plaques, vérin, émetteur vertical tourné vers la piste.
    def socles(bm):
        boite(bm, (X, 0, 0.4), (1.5, 1.7, 0.8))
        boite(bm, (X, 0, 0.86), (1.25, 1.45, 0.12))
    def fut(bm):
        boite(bm, (X + 0.05, 0, 3.8), (0.9, 1.1, 6.0))
    def plaques(bm):
        for k, (z0, z1) in enumerate([(1.1, 2.8), (2.9, 4.6), (4.7, 6.4)]):
            boite(bm, (X - 0.43, 0, (z0 + z1) / 2), (0.08, 0.95, z1 - z0))
    for nom, f, m, b in [('socles', socles, P['acier'], 0.05), ('fut', fut, P['blindage'], 0.06), ('plaques', plaques, P['blindageClair'], 0.015)]:
        ob.append(piece(nom, f, m, biseau=b))
    ob.append(piece('emetteur', lambda bm: boite(bm, (X - 0.48, 0, 3.75), (0.02, 0.22, 5.2)), P['accent']))
    ob.append(piece('emetteur-cadre', lambda bm: [boite(bm, (X - 0.47, s * 0.16, 3.75), (0.04, 0.05, 5.3)) for s in (1, -1)], P['acier']))
    def verin(bm):
        tube(bm, (X + 0.62, 0.3, 1.0), (X + 0.62, 0.3, 4.2), 0.11, 10)
        tube(bm, (X + 0.62, -0.3, 1.0), (X + 0.62, -0.3, 4.2), 0.11, 10)
    ob.append(piece('verins', verin, P['blindageClair']))
    def tiges(bm):
        tube(bm, (X + 0.62, 0.3, 4.2), (X + 0.62, 0.3, 6.6), 0.055, 10)
        tube(bm, (X + 0.62, -0.3, 4.2), (X + 0.62, -0.3, 6.6), 0.055, 10)
    ob.append(piece('tiges', tiges, P['alliage']))
    ob.append(piece('projecteur', lambda bm: boite(bm, (X, -0.6, H + 0.1), (0.4, 0.2, 0.3)), P['danger']))
    # (Les pièces des piliers, en miroir.)
    for o in list(ob):
        appliquer(o)
        ob.append(miroir_x(o))
    # Le caisson : poutre chanfreinée, barre de balayage dessous, têtes laser, radiateurs, câbles.
    def caisson(bm):
        boite(bm, (0, 0, H), (2 * X + 0.8, 1.1, 0.95))
    ob.append(piece('caisson', caisson, P['blindage'], biseau=0.08, segments=2))
    ob.append(piece('caisson-bandeau', lambda bm: boite(bm, (0, -0.56, H + 0.05), (2 * X - 0.4, 0.02, 0.32)), P['blindageClair']))
    ob.append(piece('balayage', lambda bm: boite(bm, (0, 0, H - 0.5), (2 * X - 1.2, 0.3, 0.05)), P['accent']))
    ob.append(piece('balayage-rail', lambda bm: [boite(bm, (0, s * 0.2, H - 0.5), (2 * X - 1.0, 0.06, 0.1)) for s in (1, -1)], P['acier']))
    def tetes(bm):
        for i in range(-3, 4):
            tube(bm, (i * 1.4, -0.35, H - 0.48), (i * 1.4, -0.35, H - 0.7), 0.08, 8)
    ob.append(piece('tetes', tetes, P['acier']))
    ob.append(piece('tetes-feu', lambda bm: [boite(bm, (i * 1.4, -0.35, H - 0.71), (0.09, 0.09, 0.02)) for i in range(-3, 4)], P['danger']))
    def radiateurs(bm):
        for s in (1, -1):
            for k in range(7):
                boite(bm, (s * (2.2 + k * 0.28), 0.0, H + 0.62), (0.05, 0.9, 0.3))
    ob.append(piece('radiateurs', radiateurs, P['acier']))
    def cables(bm):
        # Un faisceau qui court sur le caisson et redescend le long d'un pilier.
        for k, dy in enumerate((0.38, 0.46)):
            tube(bm, (-X + 0.4, dy, H + 0.5), (X - 0.4, dy, H + 0.5), 0.04, 6)
            tube(bm, (X + 0.3, dy, H + 0.5), (X + 0.5, dy, 1.0), 0.04, 6)
    ob.append(piece('cables', cables, P['caoutchouc']))
    for o in ob:
        appliquer(o)
    halos = [[s * X, H + 0.1, 0.65, 0.9, 1, 0.25, 0.25, 0.6] for s in (1, -1)] + [[i * 1.4, H - 0.75, 0.35, 0.5, 1, 0.25, 0.25, 0.45] for i in range(-3, 4)]
    return ob, {'halos': halos}


# ---------------------------------------------------------------------------
# NEON DRIFT — les tours de la mégapole (la face « avant », tournée vers la piste, est la face −x : posées à
# droite telles quelles, à gauche en miroir). Base en z = 0 (le jeu les pose 40 m sous la piste).
# ---------------------------------------------------------------------------
def tour_neon_a(P):
    """Une tour élancée à gradins : fût chanfreiné, bandeaux de fenêtres, enseigne verticale, couronne à ailettes
    lumineuses, mât d'antenne."""
    ob = []
    beton = matiere('betonNeon', '#1d1a2a', 0.65, 0.5)
    fen = matiere('fenetreNeon', '#cfe3ff', 0, 0.5, 0.45)
    ob.append(piece('fut', lambda bm: boite(bm, (0, 0, 25), (8, 8, 50)), beton, biseau=0.7, segments=2))
    ob.append(piece('gradin', lambda bm: boite(bm, (0.4, 0, 57), (6, 6, 14)), beton, biseau=0.5, segments=2))
    ob.append(piece('couronne', lambda bm: boite(bm, (0.4, 0, 64.6), (6.6, 6.6, 1.2)), P['blindage'], biseau=0.15))
    # Les bandeaux de fenêtres sur la face avant et les deux faces latérales (pas tous allumés).
    def bandeaux(bm, allumes):
        k = 0
        for z in [3 + 2.4 * i for i in range(20)]:
            k += 1
            on = (k * 7) % 5 != 0
            if on != allumes:
                continue
            boite(bm, (-4.02, 0, z), (0.05, 6.4, 0.7))
            boite(bm, (0, 4.02, z), (6.4, 0.05, 0.7))
            boite(bm, (0, -4.02, z), (6.4, 0.05, 0.7))
        for z in [51.5 + 2.4 * i for i in range(5)]:
            if allumes:
                boite(bm, (-2.62, 0, z), (0.05, 4.8, 0.7))
    ob.append(piece('fenetres', lambda bm: bandeaux(bm, True), fen))
    ob.append(piece('fenetres-eteintes', lambda bm: bandeaux(bm, False), matiere('vitreNeon', '#0d1422', 0.8, 0.1)))
    # Les meneaux verticaux de la façade avant.
    ob.append(piece('meneaux', lambda bm: [boite(bm, (-4.06, y, 25), (0.12, 0.18, 48)) for y in (-2.4, -0.8, 0.8, 2.4)], P['blindage']))
    # L'enseigne verticale (cadre magenta, écran à barres lumineuses), portée par des consoles.
    ob.append(piece('enseigne', lambda bm: boite(bm, (-4.9, -2.6, 30), (0.4, 1.8, 14)), P['blindage'], biseau=0.08))
    ob.append(piece('enseigne-cadre', lambda bm: [boite(bm, (-5.11, -2.6, 30 + s * 6.9), (0.04, 1.8, 0.12)) for s in (1, -1)] + [boite(bm, (-5.11, -2.6 + s * 0.88, 30), (0.04, 0.1, 13.8)) for s in (1, -1)], P['accent2']))
    ob.append(piece('enseigne-barres', lambda bm: [boite(bm, (-5.12, -2.6, 24 + k * 1.1), (0.02, 1.2 - (k % 3) * 0.3, 0.45)) for k in range(11)], P['accent']))
    ob.append(piece('consoles', lambda bm: [boite(bm, (-4.4, -2.6, z), (0.9, 0.3, 0.3)) for z in (24, 36)], P['acier']))
    # La couronne : ailettes lumineuses, mât d'antenne, feu rouge.
    ob.append(piece('ailettes', lambda bm: [boite(bm, (0.4 + 3.32 * c, 3.32 * s_, 67), (0.12, 0.12, 4)) for c, s_ in ((1, 1), (1, -1), (-1, 1), (-1, -1))], P['accent']))
    ob.append(piece('mat', lambda bm: tube(bm, (0.4, 0, 65), (0.4, 0, 82), 0.25, 8), P['acier']))
    ob.append(piece('feu', lambda bm: boite(bm, (0.4, 0, 82.4), (0.6, 0.6, 0.6)), P['feuRouge']))
    # Des conduits verticaux sur une face latérale.
    ob.append(piece('conduits', lambda bm: [tube(bm, (2.5 + k * 0.6, -4.3, 0), (2.5 + k * 0.6, -4.3, 50), 0.22, 8) for k in range(2)], P['acier']))
    for o in ob:
        appliquer(o)
    return ob, {'halos': [[0.4, 82.4, 0, 2.5, 1, 0.3, 0.25, 0.7], [-5.2, 30, 2.6, 5, 1, 0.31, 0.85, 0.25]]}


def tour_neon_b(P):
    """Un bloc large à corniches : grand panneau publicitaire en tête, balcons techniques, climatiseurs, passerelle."""
    ob = []
    beton = matiere('betonNeon2', '#221d30', 0.65, 0.5)
    fen = matiere('fenetreNeon', '#cfe3ff', 0, 0.5, 0.45)
    ob.append(piece('bloc', lambda bm: boite(bm, (0, 0, 21), (10, 12, 42)), beton, biseau=0.4, segments=2))
    ob.append(piece('corniches', lambda bm: [boite(bm, (0, 0, z), (10.6, 12.6, 0.4)) for z in range(6, 42, 6)], P['blindage']))
    def fenetres(bm):
        for z in range(6, 42, 6):
            for k in range(5):
                if (z + k) % 4 == 0:
                    continue
                boite(bm, (-5.02, -4.6 + k * 2.3, z + 2.6), (0.05, 1.6, 3.2))
    ob.append(piece('fenetres', fenetres, fen))
    # Les balcons techniques (grilles), et des climatiseurs sur le toit.
    ob.append(piece('balcons', lambda bm: [boite(bm, (-5.6, 3.5, z + 0.3), (1.2, 4, 0.12)) for z in range(12, 42, 12)], P['acier']))
    ob.append(piece('garde', lambda bm: [boite(bm, (-6.15, 3.5, z + 0.85), (0.06, 4, 0.06)) for z in range(12, 42, 12)], P['jaune']))
    ob.append(piece('clims', lambda bm: [boite(bm, (-2 + (k % 3) * 2.2, -3 + (k // 3) * 3, 42.6), (1.6, 1.6, 1.2)) for k in range(6)], P['blindageClair'], biseau=0.08))
    # Le panneau publicitaire en tête, tourné vers la piste : cadre, écran, barres de couleur.
    ob.append(piece('pub-cadre', lambda bm: boite(bm, (-3.6, 0, 47.5), (0.5, 11, 5.6)), P['blindage'], biseau=0.12))
    ob.append(piece('pub-ecran', lambda bm: boite(bm, (-3.88, 0, 47.5), (0.04, 10.2, 4.8)), matiere('ecranNeon', '#120a1e', 0.4, 0.1, 0.08)))
    ob.append(piece('pub-motif', lambda bm: [boite(bm, (-3.92, -4 + k * 0.85, 46.2 + (k % 4) * 0.7), (0.02, 0.6, 0.35)) for k in range(10)] + [boite(bm, (-3.92, 0, 49.4), (0.02, 9.6, 0.18))], P['accent2']))
    ob.append(piece('pub-pieds', lambda bm: [boite(bm, (-3.4, y, 43.6), (0.3, 0.3, 2.6)) for y in (-4.5, 0, 4.5)], P['acier']))
    # Le départ d'une passerelle vers une tour voisine, avec ses néons.
    ob.append(piece('passerelle', lambda bm: boite(bm, (0, -9, 28), (3, 6, 2.2)), P['blindage'], biseau=0.15))
    ob.append(piece('passerelle-feu', lambda bm: [boite(bm, (s * 1.52, -9, 28.6), (0.04, 6, 0.12)) for s in (1, -1)], P['accent']))
    for o in ob:
        appliquer(o)
    return ob, {'halos': [[-4.1, 47.5, 0, 7, 1, 0.31, 0.85, 0.22]]}


MONDES = {
    'laser': {'mur-tranchee': mur_tranchee, 'scanner': scanner},
    'neon': {'tour-neon-a': tour_neon_a, 'tour-neon-b': tour_neon_b},
}
CADRAGES = {
    'mur-tranchee': ((5.2, 0, 0.8), 6.5, 250),
    'scanner': ((0, 0, 3.8), 22, 20),
    'tour-neon-a': ((0, 0, 40), 110, 250),
    'tour-neon-b': ((0, 0, 26), 75, 250),
}


def construire(nom, fn, P):
    objets, points = fn(P)
    comptes = {}
    for o in objets:
        appliquer(o)
        o.data.calc_loop_triangles()
        k = o.name.split('.')[0]
        comptes[k] = comptes.get(k, 0) + len(o.data.loop_triangles)
    print(f'  {nom} :', ', '.join(f'{k} {v}' for k, v in sorted(comptes.items(), key=lambda kv: -kv[1])))
    ob = joindre(objets, nom)
    lisser(ob, 40)
    return ob, points


if __name__ == '__main__':
    choix = [a for a in sys.argv[sys.argv.index('--') + 1:] if not a.startswith('--')] if '--' in sys.argv else list(MONDES)
    apercus = Path(__file__).resolve().parents[2] / 'captures' / 'v4h' / 'modeles'
    apercus.mkdir(parents=True, exist_ok=True)
    for monde in choix:
        vider()
        P = matieres_decor(palette())
        resultats = []
        for nom, fn in MONDES[monde].items():
            ob, pts = construire(nom, fn, P)
            resultats.append((nom, ob, pts))
        ecrire_prm(SORTIE / f'monde-{monde}.prm', resultats)
        if '--sans-apercu' not in sys.argv:
            for nom, ob, _ in resultats:
                for o in bpy.data.objects:
                    o.hide_render = o.type == 'MESH' and o != ob
                cible, distance, azimut = CADRAGES.get(nom, ((0, 0, 1), 8, 30))
                apercu(apercus / f'monde-{monde}-{nom}.png', cible=cible, distance=distance, azimut=azimut, elevation=14, echantillons=16)
