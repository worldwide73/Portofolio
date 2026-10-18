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


# ---------------------------------------------------------------------------
# QUANTUM RIFT — cristaux : prismes hexagonaux à pointe, corps sombre et pointe lumineuse (couleur du monde)
# ---------------------------------------------------------------------------
def prisme_cristal(bm, base, axe, rayon, hauteur, pointe, rot=0.0):
    """Un cristal : prisme à 6 pans de « base » le long de « axe », terminé par une pyramide. Renvoie les faces
    de la pointe (pour leur donner une autre matière)."""
    axe = Vector(axe).normalized()
    q = axe.to_track_quat('Z', 'Y')
    m = Matrix.Translation(base) @ q.to_matrix().to_4x4() @ Matrix.Rotation(rot, 4, 'Z')
    bas = [bm.verts.new(m @ Vector((rayon * math.cos(a), rayon * math.sin(a), 0))) for a in [k * math.pi / 3 for k in range(6)]]
    haut = [bm.verts.new(m @ Vector((rayon * 0.92 * math.cos(a), rayon * 0.92 * math.sin(a), hauteur))) for a in [k * math.pi / 3 for k in range(6)]]
    sommet = bm.verts.new(m @ Vector((0, 0, hauteur + pointe)))
    for i in range(6):
        j = (i + 1) % 6
        bm.faces.new([bas[i], bas[j], haut[j], haut[i]])
    bm.faces.new(bas[::-1])
    pointes = [bm.faces.new([haut[i], haut[(i + 1) % 6], sommet]) for i in range(6)]
    return pointes


def cristaux(nom, P, specs, graine=1):
    """Une grappe de cristaux : specs = [(base, axe, rayon, hauteur)]. Corps « cristal », pointes lumineuses."""
    import random
    rnd = random.Random(graine)
    corps = matiere('cristalRift', '#3b2c66', 0.6, 0.15)
    lueur = matiere('cristalLueur', '#ffffff', 0, 0.3, 0.7, 'accent')
    bm = bmesh.new()
    pointes = []
    for base, axe, r, h in specs:
        pointes += prisme_cristal(bm, base, axe, r, h, r * rnd.uniform(1.4, 2.2), rnd.uniform(0, 1))
    for f in pointes:
        f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(corps)
    me.materials.append(lueur)
    return ob


def grappe_cristaux(P):
    import random
    rnd = random.Random(7)
    specs = []
    for k in range(9):
        a = rnd.uniform(0, 6.3)
        d = rnd.uniform(0, 0.9) if k else 0
        base = Vector((math.cos(a) * d, math.sin(a) * d, -0.3))
        axe = (math.cos(a) * rnd.uniform(0.1, 0.7) * (d + 0.2), math.sin(a) * rnd.uniform(0.1, 0.7) * (d + 0.2), 1)
        h = rnd.uniform(1.2, 3.6) * (1.25 if k == 0 else 1)
        specs.append((base, axe, rnd.uniform(0.18, 0.42) * (1.4 if k == 0 else 1), h))
    ob = [cristaux('grappe', P, specs, 3)]
    # Un socle de roche sombre, à moitié enfoui.
    def socle(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.2)
    s_ = piece('socle', socle, matiere('rocheRift', '#2a2238', 0.1, 0.85))
    s_.scale = (1.2, 1.2, 0.45)
    s_.location = (0, 0, -0.4)
    figer(s_)
    ob.append(s_)
    return ob, {'halos': [[0, 2.5, 0, 2.2, 0.7, 0.55, 1, 0.3]]}


def arche_cristal(P):
    """Une arche de 7 m de rayon faite d'éclats de cristal le long d'un demi-cercle, enracinée dans deux grappes."""
    import random
    rnd = random.Random(11)
    R = 7.0
    specs = []
    n = 26
    for i in range(n + 1):
        t = math.pi * i / n
        # Dans Blender : x latéral, z vertical ; l'arche est dans le plan XZ (y = 0).
        p = Vector((math.cos(t) * R, rnd.uniform(-0.5, 0.5), math.sin(t) * R))
        tangente = Vector((-math.sin(t), 0, math.cos(t)))
        normale = Vector((math.cos(t), 0, math.sin(t)))
        # Des éclats couchés le long de l'arche (alternés), et d'autres qui pointent vers l'extérieur.
        if i % 2:
            axe = (tangente * (1 if i % 4 == 1 else -1) + normale * rnd.uniform(-0.3, 0.3) + Vector((0, rnd.uniform(-0.4, 0.4), 0)))
            specs.append((p - axe.normalized() * 0.6, axe, rnd.uniform(0.25, 0.4), rnd.uniform(1.0, 1.8)))
        else:
            axe = normale + tangente * rnd.uniform(-0.4, 0.4) + Vector((0, rnd.uniform(-0.5, 0.5), 0))
            specs.append((p - normale * 0.4, axe, rnd.uniform(0.2, 0.36), rnd.uniform(0.8, 2.4)))
    for s in (1, -1):
        for k in range(5):
            a = rnd.uniform(0, 6.3)
            base = Vector((s * R + math.cos(a) * 0.7, math.sin(a) * 0.7, -0.6))
            specs.append((base, (rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), 1), rnd.uniform(0.25, 0.45), rnd.uniform(1.0, 2.6)))
    ob = [cristaux('arche', P, specs, 5)]
    # L'âme de l'arche : un anneau de métal sombre qui tient les éclats, à liseré lumineux dessous.
    def ame(bm):
        for i in range(n):
            t0, t1 = math.pi * i / n, math.pi * (i + 1) / n
            barre(bm, (math.cos(t0) * R, 0, math.sin(t0) * R), (math.cos(t1) * R, 0, math.sin(t1) * R), 0.32)
    ob.append(piece('ame', ame, matiere('ameRift', '#241e38', 0.8, 0.4)))
    def lisere(bm):
        for i in range(n):
            t0, t1 = math.pi * i / n, math.pi * (i + 1) / n
            r = R - 0.18
            barre(bm, (math.cos(t0) * r, 0, math.sin(t0) * r), (math.cos(t1) * r, 0, math.sin(t1) * r), 0.06)
    ob.append(piece('lisere', lisere, P['accent2']))
    for o in ob:
        appliquer(o)
    halos = [[math.cos(t) * 6.4, math.sin(t) * 6.4, 0.2, 1.3, 0.7, 0.55, 1, 0.3] for t in [math.pi * k / 6 for k in range(1, 6)]]
    return ob, {'halos': halos}


# ---------------------------------------------------------------------------
# VOIDSTORM — la station éventrée dans la tempête : cadres en poutres en I (intacts ou brisés), paratonnerre
# ---------------------------------------------------------------------------
def poutre_i(bm, a, b, haut, larg, ep=0.06, haut_vec=(0, 0, 1)):
    """Une poutre en I de a à b : deux semelles (larg × ep) et une âme (ep × haut), « haut_vec » donne le sens de
    la hauteur du profil."""
    a, b = Vector(a), Vector(b)
    d = (b - a)
    L = d.length
    x = d.normalized()
    up = Vector(haut_vec).normalized()
    if abs(x.dot(up)) > 0.95:
        up = Vector((1, 0, 0)) if abs(x.x) < 0.9 else Vector((0, 1, 0))
    z = (up - x * up.dot(x)).normalized()
    y = z.cross(x)
    rot = Matrix((x, y, z)).transposed().to_4x4()
    c = (a + b) / 2
    for (oy, oz, sy, sz) in [(0, haut / 2 - ep / 2, larg, ep), (0, -haut / 2 + ep / 2, larg, ep), (0, 0, ep, haut - 2 * ep)]:
        r = bmesh.ops.create_cube(bm, size=1.0)
        m = Matrix.Translation(c) @ rot @ Matrix.Translation((0, oy, oz)) @ Matrix.Diagonal((L, sy, sz, 1))
        bmesh.ops.transform(bm, matrix=m, verts=r['verts'])


def cadre_station(P, brise=False):
    import random
    rnd = random.Random(31 if brise else 17)
    ob = []
    acier = matiere('acierStation', '#2c3038', 0.82, 0.5)
    X, H = 6.2, 7.2
    def poteaux(bm):
        for s in (1, -1):
            haut = 3.4 if (brise and s > 0) else H + 0.35
            poutre_i(bm, (s * X, 0, -1.0), (s * X, 0, haut), 0.6, 0.5, haut_vec=(1, 0, 0))
            # Raidisseurs et platine au pied.
            for z in [k * 1.0 for k in range(0, int(haut))]:
                boite(bm, (s * X, 0, z), (0.5, 0.06, 0.05))
            boite(bm, (s * X, 0, -0.95), (1.0, 0.9, 0.1))
    ob.append(piece('poteaux', poteaux, acier))
    if not brise:
        ob.append(piece('traverse', lambda bm: poutre_i(bm, (-X - 0.3, 0, H), (X + 0.3, 0, H), 0.7, 0.5, haut_vec=(0, 0, 1)), acier))
        # Les goussets aux angles (des triangles épais).
        def goussets(bm):
            for s in (1, -1):
                v = [bm.verts.new(p) for p in [(s * (X - 0.05), -0.03, H - 0.35), (s * (X - 0.05), -0.03, H - 1.6), (s * (X - 1.3), -0.03, H - 0.35)]]
                w = [bm.verts.new(p) for p in [(s * (X - 0.05), 0.03, H - 0.35), (s * (X - 0.05), 0.03, H - 1.6), (s * (X - 1.3), 0.03, H - 0.35)]]
                bm.faces.new(v)
                bm.faces.new(w[::-1])
                for i in range(3):
                    j = (i + 1) % 3
                    bm.faces.new([v[i], w[i], w[j], v[j]])
        ob.append(piece('goussets', goussets, P['blindageClair']))
        ob.append(piece('rampe', lambda bm: boite(bm, (0, 0, H - 0.45), (3.2, 0.3, 0.12)), P['blindage']))
        ob.append(piece('rampe-feu', lambda bm: boite(bm, (0, 0, H - 0.52), (2.8, 0.2, 0.02)), P['neonBlanc'] if 'neonBlanc' in P else P['feuBlanc']))
        cables_pendants = [(-2.4, 0, H - 0.35, 2.6), (3.1, 0.1, H - 0.35, 1.7)]
    else:
        # La traverse pliée : un tronçon tient encore, l'autre pend vers la piste, arraché.
        def traverse(bm):
            poutre_i(bm, (-X - 0.3, 0, H), (0.6, 0, H - 0.25), 0.7, 0.5, haut_vec=(0, 0, 1))
            poutre_i(bm, (0.7, 0, H - 0.35), (3.6, 0.4, H - 2.9), 0.7, 0.5, haut_vec=(0, 0, 1))
        ob.append(piece('traverse', traverse, acier))
        # Le haut du poteau droit, tombé et posé de travers contre le muret extérieur.
        haut = piece('troncon-tombe', lambda bm: poutre_i(bm, (X + 0.4, 0.6, 0.3), (X + 2.2, -1.4, 3.6), 0.6, 0.5, haut_vec=(1, 0, 0)), acier)
        ob.append(haut)
        # Des fers à nu à la cassure, et des éclats de tôle.
        def fers(bm):
            for k in range(5):
                a = Vector((X + rnd.uniform(-0.2, 0.2), rnd.uniform(-0.2, 0.2), 3.4))
                b = a + Vector((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0.3, 0.8)))
                tube(bm, a, b, 0.02, 4)
        ob.append(piece('fers', fers, P['acier']))
        cables_pendants = [(0.65, 0, H - 0.4, 3.4), (0.75, 0.15, H - 0.45, 2.6), (-3.0, 0, H - 0.35, 1.5)]
    # Des câbles qui pendent (avec un léger angle), un chemin de câbles le long de la traverse.
    def cables(bm):
        for x, y, z, l in cables_pendants:
            tube(bm, (x, y, z), (x + rnd.uniform(-0.3, 0.3), y + rnd.uniform(-0.3, 0.3), z - l), 0.03, 5)
    ob.append(piece('cables', cables, P['caoutchouc']))
    # Un feu de secours orange sur un poteau.
    ob.append(piece('secours', lambda bm: boite(bm, (-X + 0.32, 0.1, 2.4), (0.12, 0.18, 0.18)), P['accent2']))
    for o in ob:
        appliquer(o)
    halos = [[-X + 0.42, 2.4, -0.1, 0.8, 1, 0.7, 0.3, 0.7]]
    if brise:
        halos.append([X, 3.5, 0, 0.9, 1, 0.6, 0.25, 0.9])
    return ob, {'halos': halos}


def paratonnerre(P):
    """Un pylône paratonnerre : fût en treillis, empilements d'isolateurs, bobine à anneaux en tête, haubans."""
    from decor import treillis
    ob = []
    acier = matiere('acierStation', '#2c3038', 0.82, 0.5)
    ceram = matiere('ceramique', '#c9d0da', 0.1, 0.35)
    H = 26
    def fut(bm):
        treillis(bm, [(-1.4, -1.4, 0), (1.4, -1.4, 0), (1.4, 1.4, 0), (-1.4, 1.4, 0)], [(-0.5, -0.5, H), (0.5, -0.5, H), (0.5, 0.5, H), (-0.5, 0.5, H)], 10, 0.22, 0.09)
    ob.append(piece('fut', fut, acier))
    ob.append(piece('socle', lambda bm: boite(bm, (0, 0, -0.6), (4, 4, 1.2)), P['acier'], biseau=0.08))
    # Les isolateurs : des empilements de disques.
    def isolateurs(bm):
        for k in range(9):
            z = H + 0.4 + k * 0.38
            r = 0.55 if k % 2 == 0 else 0.4
            bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r * 0.9, depth=0.18, matrix=Matrix.Translation((0, 0, z)))
    ob.append(piece('isolateurs', isolateurs, ceram))
    ob.append(piece('axe', lambda bm: tube(bm, (0, 0, H), (0, 0, H + 7.5), 0.18, 10), P['acier']))
    # La bobine : trois anneaux lumineux et un tore de tête.
    def anneaux(bm):
        for k, (z, r) in enumerate([(H + 4.4, 1.3), (H + 5.1, 1.0), (H + 5.7, 0.75)]):
            bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=r, radius2=r, depth=0.12, matrix=Matrix.Translation((0, 0, z)))
    ob.append(piece('anneaux', anneaux, P['accent']))
    def tete(bm):
        r = bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=6, radius=1.0)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, H + 7.2)) @ Matrix.Diagonal((1.6, 1.6, 0.45, 1)), verts=r['verts'])
    ob.append(piece('tete', tete, P['alliage']))
    ob.append(piece('pointe', lambda bm: tube(bm, (0, 0, H + 7.5), (0, 0, H + 10.5), 0.07, 6), P['alliage']))
    ob.append(piece('feu', lambda bm: boite(bm, (0, 0, H + 10.6), (0.3, 0.3, 0.3)), P['feuRouge']))
    # Les haubans vers le sol.
    ob.append(piece('haubans', lambda bm: [tube(bm, (0, 0, H - 2), (c * 9, s_ * 9, -0.2), 0.04, 4) for c, s_ in ((1, 1), (1, -1), (-1, 1), (-1, -1))], P['acier']))
    for o in ob:
        appliquer(o)
    return ob, {'halos': [[0, H + 5, 0, 3.4, 0.6, 0.85, 1, 0.45], [0, H + 10.6, 0, 1.2, 1, 0.3, 0.25, 0.7]]}


MONDES = {
    'laser': {'mur-tranchee': mur_tranchee, 'scanner': scanner},
    'neon': {'tour-neon-a': tour_neon_a, 'tour-neon-b': tour_neon_b},
    'rift': {'grappe-cristaux': grappe_cristaux, 'arche-cristal': arche_cristal},
    'tempete': {'cadre-station': lambda P: cadre_station(P), 'cadre-brise': lambda P: cadre_station(P, True), 'paratonnerre': paratonnerre},
}
CADRAGES = {
    'mur-tranchee': ((5.2, 0, 0.8), 6.5, 250),
    'scanner': ((0, 0, 3.8), 22, 20),
    'tour-neon-a': ((0, 0, 40), 110, 250),
    'tour-neon-b': ((0, 0, 26), 75, 250),
    'grappe-cristaux': ((0, 0, 1.2), 9, 30),
    'arche-cristal': ((0, 0, 3.5), 22, 15),
    'cadre-station': ((0, 0, 3.5), 20, 20),
    'cadre-brise': ((0, 0, 3.5), 20, 20),
    'paratonnerre': ((0, 0, 18), 55, 30),
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
