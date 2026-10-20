# PORTAL RUSH — LES OBSTACLES MOBILES ET AÉRIENS (Blender). Voir commun.py pour la chaîne, objets.py pour le contrat.
#
# Drone de patrouille, éclaireur ennemi, bloc qui tombe, drone-cargo, lance de frappe d'un boss. Chaque modèle
# remplace le modèle procédural du même nom (modeles.ts → scene.ts : geo / double) : il garde son origine, son
# encombrement (une voie de 2,6 m ; les collisions sont celles du moteur) et la face qu'il présente au pilote.
# Repère du jeu : x latéral, y vers le haut, z vers l'arrière ; la face tournée vers le pilote est +z (Blender −Y).
# Dans Blender (Z vers le haut) : jeu (x, y, z) = Blender (x, z, −y). Les halos sont donnés dans le repère du jeu.
#
# Lancer : <venv>/bin/python outils/assets/objets_mobiles.py [-- drone cargo …] [--sans-apercu]
#   → public/rush/modeles/objets-mobiles.prm, aperçus captures/v4h/modeles/objet-<nom>.png

import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402,F401  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import ajouter_matiere, appliquer, figer, matiere, modif  # noqa: E402
from formes import aile, boite, fuseau, miroir_x, piece, plaques, revolution, ruban, super_ellipse, tube  # noqa: E402
from objets import executer  # noqa: E402


# ---------------------------------------------------------------------------
# Les matières propres à cette famille (en plus de palette() et matieres_objets()).
# ---------------------------------------------------------------------------
def matieres_mobiles(P):
    P = dict(P)
    P['braise'] = matiere('braise', '#ff6a2a', 0, 0.6, 1.4)              # chaleur, cristal brûlant (fixe)
    P['jauneVif'] = matiere('jauneVif', '#f0b52a', 0.3, 0.5, 0.22)       # hachure industrielle (celle du procédural)
    P['orange'] = matiere('orangeCargo', '#b4601f', 0.45, 0.46)          # la tôle du conteneur
    P['acierPeint'] = matiere('acierPeint', '#4a4f58', 0.7, 0.5)         # le caisson du bloc
    P['cristalSombre'] = matiere('cristalSombre', '#5a1208', 0.25, 0.12, 0.35)  # facettes sombres du cristal
    P['poussee'] = matiere('poussee', '#ffffff', 0, 0.5, 1.0, 'accent2')  # les tuyères du cargo (accent2, comme le procédural)
    return P


# ---------------------------------------------------------------------------
# Petits outils (bmesh) : rotations, pièces de révolution dressées, poutres, prismes, dalles, hachures, peinture.
# ---------------------------------------------------------------------------
def Rz(a):
    return Matrix.Rotation(a, 3, 'Z')


def Rx(a):
    return Matrix.Rotation(a, 3, 'X')


def Ry(a):
    return Matrix.Rotation(a, 3, 'Y')


def placer(ob, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Pose l'objet puis inscrit la transformation dans son maillage (pour pouvoir le joindre ou le refléter)."""
    ob.location = loc
    ob.rotation_euler = rot
    figer(ob)
    return ob


def vertical(nom, profil, mat, segments=16, centre=(0, 0, 0), mats=None):
    """Une pièce de révolution autour de l'axe vertical (Z Blender) : profil [(rayon, hauteur)]."""
    ob = revolution(nom, profil, mat, segments=segments, mats_par_bande=mats)
    return placer(ob, centre, (math.pi / 2, 0, 0))


def axial(nom, profil, mat, segments=16, centre=(0, 0, 0), mats=None):
    """Une pièce de révolution autour de l'axe avant-arrière (Y Blender) : profil [(rayon, y)]."""
    ob = revolution(nom, profil, mat, segments=segments, mats_par_bande=mats)
    return placer(ob, centre)


def poutre(bm, a, b, l, h):
    """Une poutre de section l × h (h vers le haut) de a à b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    q = d.to_track_quat('Z', 'Y')
    r = bmesh.ops.create_cube(bm, size=1.0)
    m = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((l, h, d.length, 1))
    bmesh.ops.transform(bm, matrix=m, verts=r['verts'])


def prisme_m(bm, pts, y0, y1, m=None, t=(0, 0, 0)):
    """Un profil (x, z) fermé extrudé de y0 à y1, puis tourné (matrice 3×3) et déplacé."""
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([a[i], a[j], b[j], b[i]])
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    M = Matrix.Translation(t) @ (m.to_4x4() if m is not None else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=M, verts=a + b)


def lame(bm, pts, x0, x1, m=None, t=(0, 0, 0)):
    """Un profil (y, z) fermé extrudé le long de X (dérives, pare-chocs), puis tourné et déplacé."""
    a = [bm.verts.new((x0, y, z)) for y, z in pts]
    b = [bm.verts.new((x1, y, z)) for y, z in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([a[i], a[j], b[j], b[i]])
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    M = Matrix.Translation(t) @ (m.to_4x4() if m is not None else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=M, verts=a + b)


def dalle(bm, pts, n, ep):
    """Une dalle : un polygone (points 3D) épaissi de « ep » le long de la normale n."""
    n = Vector(n).normalized() * ep
    a = [bm.verts.new(Vector(p)) for p in pts]
    b = [bm.verts.new(Vector(p) + n) for p in pts]
    k = len(pts)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new([a[i], a[j], b[j], b[i]])
    bm.faces.new(a[::-1])
    bm.faces.new(b)


def decouper(poly, x0, x1, y0, y1):
    """Découpe un polygone 2D par un rectangle (Sutherland–Hodgman)."""
    def clip(pts, dedans, inter):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if dedans(b):
                if not dedans(a):
                    out.append(inter(a, b))
                out.append(b)
            elif dedans(a):
                out.append(inter(a, b))
        return out

    def ix(xc):
        return lambda a, b: (xc, a[1] + (b[1] - a[1]) * (xc - a[0]) / (b[0] - a[0]))

    def iy(yc):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (yc - a[1]) / (b[1] - a[1]), yc)

    pts = poly
    for dedans, inter in ((lambda p: p[0] >= x0, ix(x0)), (lambda p: p[0] <= x1, ix(x1)), (lambda p: p[1] >= y0, iy(y0)), (lambda p: p[1] <= y1, iy(y1))):
        if not pts:
            break
        pts = clip(pts, dedans, inter)
    propre = []
    for p in pts:
        if not propre or (abs(p[0] - propre[-1][0]) + abs(p[1] - propre[-1][1])) > 1e-5:
            propre.append(p)
    if len(propre) > 1 and (abs(propre[0][0] - propre[-1][0]) + abs(propre[0][1] - propre[-1][1])) < 1e-5:
        propre.pop()
    return propre


def hachures(bm, O, u, v, L, H, n, largeur=0.09, pas=0.2, pente=0.8, ep=0.008):
    """Des bandes en biais sur le rectangle O + [0, L]·u + [0, H]·v, épaissies vers n (pour une plaque d'alerte)."""
    O, u, v = Vector(O), Vector(u).normalized(), Vector(v).normalized()
    for k in range(int(math.floor((-H * pente - largeur) / pas)) - 1, int(math.ceil(L / pas)) + 1):
        s0 = k * pas
        pts = decouper([(s0, 0), (s0 + largeur, 0), (s0 + largeur + H * pente, H), (s0 + H * pente, H)], 0, L, 0, H)
        if len(pts) >= 3:
            aire = sum(pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1] for i in range(len(pts))) / 2
            if abs(aire) > 2e-4:
                dalle(bm, [O + u * s + v * t for s, t in pts], n, ep)


def peindre(ob, mat, cond):
    """Donne la matière « mat » aux faces de l'objet dont (centre, normale) vérifie cond (sans géométrie de plus)."""
    i = ajouter_matiere(ob, mat)
    mw = ob.matrix_world
    rot = mw.to_3x3()
    for p in ob.data.polygons:
        if cond(mw @ p.center, (rot @ p.normal).normalized()):
            p.material_index = i


def polaire(r, a, z):
    return Vector((r * math.cos(a), r * math.sin(a), z))


# ---------------------------------------------------------------------------
# LE DRONE (corps à y = 1,15 m comme le procédural ; ±0,92 m) : une coque-casque blindée à gros œil rouge, quatre
# soufflantes carénées en X sur des bras, un canon double sous le menton, antenne et balise. Le jeu le fait flotter
# (y + 0,25 ± 0,12), lacer (±0,4 rad) et s'incliner quand il change de voie.
# ---------------------------------------------------------------------------
def drone(P):
    P = matieres_mobiles(P)
    ob = []
    C = 1.15

    # Le corps : une goutte aplatie, large à l'avant (l'œil), effilée vers l'arrière.
    def se(rx, rz, dz=0.0):
        return super_ellipse(0, C + dz, rx, rz, n=2.6, points=16)

    # (Sans subdivision : 16 côtés, lissés à l'export ; la carapace se découpe sur cette même coque.)
    corps = fuseau('corps', [(-0.42, se(0.12, 0.10)), (-0.39, se(0.24, 0.19)), (-0.32, se(0.32, 0.245)), (-0.18, se(0.365, 0.27, 0.01)), (0.02, se(0.37, 0.27, 0.01)), (0.22, se(0.33, 0.24, 0.01)), (0.36, se(0.24, 0.17)), (0.44, se(0.12, 0.09))], P['blindage'], subdivision=0)
    ob.append(corps)
    # La carapace : des plaques claires sur le dessus, avec un jour sombre (épine centrale, trois rangs).
    plans = [((0, 0, 0), (1, 0, 0)), ((0, -0.2, 0), (0, 1, 0)), ((0, 0.1, 0), (0, 1, 0)), ((0, 0, C + 0.05), (0, 0, 1))]

    def classer(c):
        if c.z < C + 0.05 or c.y < -0.36 or c.y > 0.40:
            return None
        return (c.x > 0, 0 if c.y < -0.2 else (1 if c.y < 0.1 else 2))

    ob.append(plaques('carapace', corps, (plans, classer), P['blindageClair'], epaisseur=0.014, jour=0.018, mat_tranche=P['joint'], biseau=0))
    # La ceinture : un rebord d'acier tout autour du corps (ouvert devant, sur les côtés de l'œil).
    sections = [(-0.39, 0.24), (-0.32, 0.32), (-0.18, 0.365), (0.02, 0.37), (0.22, 0.33), (0.36, 0.24), (0.44, 0.12)]
    chemin = [(rx + 0.004, y, C - 0.01) for y, rx in sections] + [(-rx - 0.004, y, C - 0.01) for y, rx in sections[::-1]]
    ob.append(ruban('ceinture', chemin, 0.034, 0.03, P['acier']))
    # Le sourcil : une visière blindée en surplomb de l'œil (l'air mauvais, lisible de loin).
    ob.append(piece('sourcil', lambda bm: lame(bm, [(-0.28, C + 0.25), (-0.47, C + 0.19), (-0.465, C + 0.16), (-0.30, C + 0.195)], -0.21, 0.21), P['blindageClair'], biseau=0.008))
    # L'œil : une bague épaisse, un verre sombre, un iris rouge, une pupille noire.
    ob.append(axial('oeil-bague', [(0.19, -0.24), (0.19, -0.38), (0.178, -0.425), (0.148, -0.438), (0.126, -0.425)], P['acier'], 14, (0, 0, C), [P['blindageClair'], P['acier'], P['alliage'], P['joint']]))
    ob.append(axial('oeil', [(0.127, -0.418), (0.113, -0.428), (0.076, -0.44), (0.034, -0.446), (0.001, -0.447)], P['verre'], 14, (0, 0, C), [P['verre'], P['dangerFort'], P['dangerFort'], P['joint']]))
    # Deux capteurs secondaires de part et d'autre de l'œil.
    for s in (1, -1):
        ob.append(axial('capteur', [(0.034, -0.30), (0.034, -0.435), (0.025, -0.45), (0.001, -0.453)], P['acier'], 6, (s * 0.22, 0, C + 0.10), [P['acier'], P['acier'], P['dangerFort']]))
    # Le canon double sous le menton.
    ob.append(piece('canon', lambda bm: boite(bm, (0, -0.15, C - 0.28), (0.25, 0.36, 0.09)), P['carbone'], biseau=0.015))

    def futs(bm):
        for s in (1, -1):
            tube(bm, (s * 0.058, -0.28, C - 0.29), (s * 0.058, -0.54, C - 0.29), 0.021, 8)

    ob.append(piece('futs', futs, P['alliage']))

    def bouches(bm):
        for s in (1, -1):
            tube(bm, (s * 0.058, -0.50, C - 0.29), (s * 0.058, -0.575, C - 0.29), 0.032, 8)

    ob.append(piece('bouches', bouches, P['carbone']))
    ob.append(piece('visee', lambda bm: [boite(bm, (s * 0.058, -0.577, C - 0.29), (0.024, 0.008, 0.024)) for s in (1, -1)], P['dangerFort']))
    # Les soufflantes carénées : carénage (lèvre, liseré rouge), moyeu, stators, pales ; et leurs bras.
    profil_conduit = [(0.27, -0.07), (0.27, 0.05), (0.30, 0.085), (0.335, 0.055), (0.338, 0.012), (0.338, -0.006), (0.30, -0.078), (0.27, -0.07)]
    mats_conduit = [P['joint'], P['acier'], P['blindageClair'], P['blindage'], P['hachureRouge'], P['blindage'], P['carbone']]
    centres = [Vector((sx * 0.60, sy * 0.55, C + 0.08)) for sx in (1, -1) for sy in (1, -1)]
    for D in centres:
        ob.append(vertical('conduit', profil_conduit, P['blindage'], 12, D, mats_conduit))
        ob.append(vertical('moyeu', [(0.001, -0.07), (0.064, -0.05), (0.064, 0.03), (0.001, 0.055)], P['acier'], 6, D, [P['acier'], P['blindageClair'], P['alliage']]))

    def pales(bm):
        for i, D in enumerate(centres):
            for k in range(4):
                a = 2 * math.pi * k / 4 + i * 0.7
                boite(bm, D + Rz(a) @ Vector((0.165, 0, 0.012)), (0.19, 0.045, 0.006), Rz(a) @ Rx(0.6))

    ob.append(piece('pales', pales, P['carbone']))

    def stators(bm):
        for D in centres:
            # (Une traverse sous le moyeu, dans l'axe du bras.)
            a = math.atan2(D.y, D.x)
            boite(bm, D + Vector((0, 0, -0.042)), (0.56, 0.024, 0.03), Rz(a))

    ob.append(piece('stators', stators, P['carbone']))

    def bras(bm):
        for D in centres:
            d = Vector((D.x, D.y, 0)).normalized()
            B = Vector((math.copysign(0.14, D.x), math.copysign(0.08, D.y), C + 0.0))
            E = D - d * 0.30
            E.z = C + 0.05
            poutre(bm, B, E, 0.10, 0.075)

    ob.append(piece('bras', bras, P['acier']))

    def capots(bm):
        # Un capot de blindage sur chaque bras.
        for D in centres:
            d = Vector((D.x, D.y, 0)).normalized()
            B = Vector((math.copysign(0.14, D.x), math.copysign(0.08, D.y), C + 0.0))
            E = D - d * 0.30
            E.z = C + 0.05
            a, b = B.lerp(E, 0.45), B.lerp(E, 0.93)
            a.z += 0.048
            b.z += 0.048
            poutre(bm, a, b, 0.125, 0.026)

    ob.append(piece('capots', capots, P['blindage']))

    # L'antenne et sa balise, la grille d'échappement arrière.
    ob.append(piece('antenne', lambda bm: tube(bm, (0.09, 0.18, C + 0.2), (0.09, 0.27, C + 0.5), 0.008, 6), P['acier']))
    ob.append(piece('balise', lambda bm: boite(bm, (0.09, 0.27, C + 0.505), (0.03, 0.03, 0.03)), P['feuRouge']))

    def grille(bm):
        boite(bm, (0, 0.37, C - 0.02), (0.24, 0.1, 0.14))

    ob.append(piece('grille', grille, P['carbone']))
    halos = [[0, C, 0.47, 0.55, 1, 0.25, 0.2, 0.9]]
    halos += [[D.x, D.z, -D.y, 0.32, 1, 0.28, 0.22, 0.3] for D in centres]
    halos += [[s * 0.22, C + 0.10, 0.46, 0.14, 1, 0.3, 0.2, 0.5] for s in (1, -1)]
    return ob, {'halos': halos}


# ---------------------------------------------------------------------------
# L'ÉCLAIREUR (corps à y = 0,95 m, la pointe vers le pilote) : une fléchette sombre à arêtes vives, deux griffes en
# flèche inversée à pointes rouges, des yeux rouges au nez, une verrière, des entrées d'air vers deux réacteurs
# suspendus, deux dérives inclinées. Il fonce vers le joueur (le jeu le fait onduler et rouler).
# ---------------------------------------------------------------------------
def eclaireur(P):
    P = matieres_mobiles(P)
    ob = []
    C = 0.95

    def los(w, h, dz=0.0):
        z = C + dz
        return [(0, z + h), (0.55 * w, z + 0.6 * h), (w, z), (0.5 * w, z - 0.7 * h), (0, z - h), (-0.5 * w, z - 0.7 * h), (-w, z), (-0.55 * w, z + 0.6 * h)]

    # (Une coque à facettes, sans subdivision : la lecture « furtive », des arêtes nettes.)
    corps = fuseau('corps', [(-0.98, [(0, C - 0.02)]), (-0.82, los(0.05, 0.04, -0.015)), (-0.66, los(0.11, 0.075, -0.005)), (-0.46, los(0.19, 0.13)), (-0.15, los(0.30, 0.20, 0.01)), (0.30, los(0.44, 0.27, 0.02)), (0.80, los(0.42, 0.24, 0.02)), (1.18, los(0.30, 0.16, 0.01))], P['blindage'], subdivision=0)
    ob.append(corps)

    # Les yeux : deux fentes rouges en biais, posées sur la facette entre l'épaule et l'arête du nez.
    def fentes(bm):
        (y1, w1, h1, d1), (y2, w2, h2, d2) = (-0.66, 0.11, 0.075, -0.005), (-0.46, 0.19, 0.13, 0.0)
        for s in (1, -1):
            A, B = Vector((s * 0.55 * w1, y1, C + d1 + 0.6 * h1)), Vector((s * w1, y1, C + d1))
            Cc, D = Vector((s * w2, y2, C + d2)), Vector((s * 0.55 * w2, y2, C + d2 + 0.6 * h2))
            n = (Cc - B).cross(A - B).normalized()
            if n.x * s < 0:
                n = -n

            def P_(u, t):
                return (B.lerp(Cc, t)).lerp(A.lerp(D, t), u) + n * 0.003

            dalle(bm, [P_(0.12, 0.08), P_(0.34, 0.08), P_(0.62, 0.92), P_(0.40, 0.92)], n, 0.006)

    ob.append(piece('yeux', fentes, P['dangerFort']))
    # Le dos : des plaques rouille avec jours sombres.
    plans = [((0, 0, 0), (1, 0, 0)), ((0, -0.2, 0), (0, 1, 0)), ((0, 0.3, 0), (0, 1, 0)), ((0, 0.75, 0), (0, 1, 0)), ((0, 0, C + 0.1), (0, 0, 1))]

    def classer(c):
        if c.z < C + 0.1 or c.y < -0.5 or c.y > 1.12:
            return None
        return (c.x > 0, sum(c.y > y for y in (-0.2, 0.3, 0.75)))

    ob.append(plaques('dos', corps, (plans, classer), P['rouille'], epaisseur=0.012, jour=0.016, mat_tranche=P['joint'], biseau=0))

    # La verrière (capteurs) : une goutte de verre sombre.
    def dome(rx, rz, dz):
        return super_ellipse(0, C + dz, rx, rz, n=2.2, points=10)

    ob.append(fuseau('verriere', [(-0.50, [(0, C + 0.13)]), (-0.32, dome(0.07, 0.05, 0.16)), (-0.05, dome(0.12, 0.08, 0.21)), (0.20, dome(0.10, 0.07, 0.25)), (0.36, [(0, C + 0.27)])], P['verre'], subdivision=0))
    # Les griffes : ailes en flèche inversée, légèrement tombantes, arêtes vives.
    def sec(x):
        # Entre la section du milieu (x = 0,70) et celle du bout (x = 1,10), tout varie linéairement.
        t = (x - 0.70) / 0.40
        return (x, -0.26 - 0.38 * t, 0.32 - 0.64 * t, 0.06 - 0.025 * t, C - 0.09 - 0.05 * t)

    griffe = aile('griffe', [(0.26, 0.12, 0.80, 0.09, C - 0.04), sec(0.70), sec(0.84), sec(0.90), sec(1.10)], P['blindage'], subdivision=0)
    appliquer(griffe)
    # Une bande rouge en travers de chaque griffe, avant la pointe.
    peindre(griffe, P['hachureRouge'], lambda c, n: 0.84 < c.x < 0.90)
    ob += [griffe, miroir_x(griffe)]

    def pointes(bm):
        for s in (1, -1):
            base = [(s * 1.05, -0.60, C - 0.122), (s * 1.125, -0.60, C - 0.128), (s * 1.125, -0.60, C - 0.152), (s * 1.05, -0.60, C - 0.146)]
            v = [bm.verts.new(p) for p in base]
            a = bm.verts.new((s * 1.14, -0.92, C - 0.15))
            bm.faces.new(v)
            for i in range(4):
                bm.faces.new([v[i], v[(i + 1) % 4], a])

    ob.append(piece('pointes', pointes, P['dangerFort']))
    for s in (1, -1):
        ob.append(ruban('bord', [(s * 0.50, -0.10, C - 0.066), (s * 1.06, -0.625, C - 0.134)], 0.026, 0.024, P['dangerFort']))
    # Les entrées d'air (sous les griffes) qui mènent aux réacteurs suspendus.
    def ecopes(bm):
        for s in (1, -1):
            prisme_m(bm, [(s * 0.25, C - 0.16), (s * 0.43, C - 0.14), (s * 0.45, C - 0.03), (s * 0.27, C + 0.01)], -0.18, 0.46)

    ob.append(piece('ecopes', ecopes, P['blindageClair'], biseau=0.012))

    def bouches(bm):
        for s in (1, -1):
            pts = [(s * 0.25, C - 0.16), (s * 0.43, C - 0.14), (s * 0.45, C - 0.03), (s * 0.27, C + 0.01)]
            cx = sum(p[0] for p in pts) / 4
            cz = sum(p[1] for p in pts) / 4
            dalle(bm, [(cx + (x - cx) * 0.78, -0.186, cz + (z - cz) * 0.7) for x, z in pts], (0, 1, 0), 0.03)

    ob.append(piece('bouches', bouches, P['joint']))
    # Les réacteurs : nacelles, tuyère, intérieur chaud, cœur rouge.
    for s in (1, -1):
        c = (s * 0.31, 0, C - 0.12)
        ob.append(axial('reacteur', [(0.07, 0.40), (0.115, 0.52), (0.128, 0.72), (0.128, 1.20), (0.118, 1.36), (0.108, 1.44)], P['blindage'], 12, c, [P['blindageClair'], P['blindage'], P['blindage'], P['acier'], P['tuyere']]))
        ob.append(axial('tuyere', [(0.108, 1.44), (0.085, 1.40), (0.06, 1.38), (0.001, 1.375)], P['chaud'], 12, c, [P['chaud'], P['chaud'], P['dangerFort']]))
    # Les canons sous les griffes.
    ob.append(piece('canons', lambda bm: [tube(bm, (s * 0.58, -0.36, C - 0.125), (s * 0.58, 0.18, C - 0.125), 0.022, 8) for s in (1, -1)], P['alliage']))
    ob.append(piece('bouches-canons', lambda bm: [tube(bm, (s * 0.58, -0.34, C - 0.125), (s * 0.58, -0.40, C - 0.125), 0.032, 8) for s in (1, -1)], P['carbone']))
    ob.append(piece('visee', lambda bm: [tube(bm, (s * 0.58, -0.399, C - 0.125), (s * 0.58, -0.405, C - 0.125), 0.016, 8) for s in (1, -1)], P['dangerFort']))

    # Les dérives inclinées, un feu à éclats en haut.
    def derive(bm):
        lame(bm, [(0.50, 0.0), (1.18, 0.0), (1.28, 0.40), (1.06, 0.42)], -0.018, 0.018, Ry(0.42), (0.17, 0, C + 0.12))

    d = piece('derive', derive, P['blindage'], biseau=0.008)
    appliquer(d)

    def feu(bm):
        boite(bm, Vector((0.17, 0, C + 0.12)) + Ry(0.42) @ Vector((0, 1.16, 0.415)), (0.05, 0.08, 0.025), Ry(0.42))

    f = piece('feu', feu, P['feuRouge'])
    ob += [d, miroir_x(d), f, miroir_x(f)]
    halos = [[s * 0.31, C - 0.12, -1.45, 0.45, 1, 0.3, 0.2, 0.9] for s in (1, -1)]
    halos += [[s * 0.12, C + 0.02, 0.56, 0.25, 1, 0.25, 0.2, 0.55] for s in (1, -1)]
    halos += [[s * 1.12, C - 0.14, 0.78, 0.28, 1, 0.28, 0.2, 0.6] for s in (1, -1)]
    return ob, {'halos': halos}


# ---------------------------------------------------------------------------
# LE BLOC QUI TOMBE (1,64 × 1,44 m au sol, de 0,04 à 1,7 m) : un caisson industriel renforcé, cadre et pièces de coin,
# nervures, bande hachurée et feux rouges sur ses quatre faces (il tourne en tombant), quatre oreilles de levage,
# un bouclier thermique dessous avec quatre rétrofusées (la traînée de feu du jeu).
# ---------------------------------------------------------------------------
def bloc_chute(P):
    P = matieres_mobiles(P)
    ob = []
    HX, HY, Z0, Z1 = 0.80, 0.70, 0.14, 1.58
    ZC = (Z0 + Z1) / 2
    e = 0.13
    ob.append(piece('caisson', lambda bm: boite(bm, (0, 0, ZC), (2 * HX - 0.08, 2 * HY - 0.08, Z1 - Z0 - 0.06)), P['acierPeint'], biseau=0.02))

    def cadre(bm):
        for sx in (1, -1):
            for sy in (1, -1):
                boite(bm, (sx * (HX - e / 2), sy * (HY - e / 2), ZC), (e, e, Z1 - Z0))
        for z in (Z0 + e / 2, Z1 - e / 2):
            for sy in (1, -1):
                boite(bm, (0, sy * (HY - e / 2), z), (2 * HX - 2 * e, e, e))
            for sx in (1, -1):
                boite(bm, (sx * (HX - e / 2), 0, z), (e, 2 * HY - 2 * e, e))

    ob.append(piece('cadre', cadre, P['blindage'], biseau=0.012))
    c = 0.19

    def coins(bm):
        for sx in (1, -1):
            for sy in (1, -1):
                for z in (Z0 - 0.02 + c / 2, Z1 + 0.02 - c / 2):
                    boite(bm, (sx * (HX + 0.02 - c / 2), sy * (HY + 0.02 - c / 2), z), (c, c, c))

    ob.append(piece('coins', coins, P['acier']))

    def trous(bm):
        # Les lumières ovales des pièces de coin (faces extérieures, dessus et dessous).
        for sx in (1, -1):
            for sy in (1, -1):
                for z in (Z0 - 0.02 + c / 2, Z1 + 0.02 - c / 2):
                    cx, cy = sx * (HX + 0.02 - c / 2), sy * (HY + 0.02 - c / 2)
                    boite(bm, (sx * (HX + 0.024), cy, z), (0.012, 0.075, 0.045))
                    boite(bm, (cx, sy * (HY + 0.024), z), (0.075, 0.012, 0.045))

    ob.append(piece('trous', trous, P['joint']))
    # Les quatre faces : (angle, demi-largeur, distance au centre) ; la face locale est en −Y, tournée ensuite.
    faces = [(0, HX, HY), (math.pi / 2, HY, HX), (math.pi, HX, HY), (3 * math.pi / 2, HY, HX)]

    def sur_faces(construire):
        def f(bm):
            for a, w, d in faces:
                v0 = len(bm.verts)
                construire(bm, w, d)
                bm.verts.ensure_lookup_table()
                bmesh.ops.transform(bm, matrix=Rz(a).to_4x4(), verts=bm.verts[v0:])
        return f

    def bande(bm, w, d):
        boite(bm, (0, -(d - 0.04) - 0.015, 1.28), (2 * w - 0.28, 0.03, 0.24))

    ob.append(piece('bande', sur_faces(bande), P['hachureNoire']))

    def rayures(bm, w, d):
        hachures(bm, (-(w - 0.15), -(d - 0.04) - 0.03, 1.17), (1, 0, 0), (0, 0, 1), 2 * w - 0.30, 0.22, (0, -1, 0), largeur=0.09, pas=0.2, pente=0.8, ep=0.006)

    ob.append(piece('rayures', sur_faces(rayures), P['jauneVif']))

    def nervures(bm, w, d):
        for x in (-0.62 * w, -0.3 * w, 0.3 * w, 0.62 * w):
            boite(bm, (x, -(d - 0.04) - 0.016, 0.66), (0.075, 0.034, 0.76))

    ob.append(piece('nervures', sur_faces(nervures), P['acier']))

    def plaque(bm, w, d):
        boite(bm, (0, -(d - 0.04) - 0.006, 0.68), (0.30, 0.012, 0.22))

    ob.append(piece('plaque', sur_faces(plaque), P['blindageClair']))

    def pochoir(bm, w, d):
        # (Deux traits de pochoir.)
        boite(bm, (0, -(d - 0.04) - 0.013, 0.74), (0.22, 0.004, 0.035))
        boite(bm, (-0.03, -(d - 0.04) - 0.013, 0.64), (0.16, 0.004, 0.02))

    ob.append(piece('pochoir', sur_faces(pochoir), P['joint']))

    def feux(bm, w, d):
        boite(bm, (0, -(d - 0.04) - 0.012, 1.11), (0.34, 0.024, 0.035))

    ob.append(piece('feux', sur_faces(feux), P['dangerFort']))
    # Le dessus : un couvercle encastré, une ferrure centrale, quatre oreilles de levage.
    ob.append(piece('couvercle', lambda bm: boite(bm, (0, 0, Z1 - 0.03 + 0.012), (2 * HX - 0.36, 2 * HY - 0.36, 0.03)), P['blindage'], biseau=0.008))
    ob.append(vertical('ferrure', [(0.16, Z1 - 0.01), (0.16, Z1 + 0.03), (0.13, Z1 + 0.05), (0.07, Z1 + 0.05), (0.07, Z1 + 0.09), (0.001, Z1 + 0.09)], P['acier'], 12, (0, 0, 0), [P['acier'], P['acier'], P['blindageClair'], P['alliage'], P['dangerFort']]))
    oreilles = [(sx * (HX - 0.30), sy * (HY - 0.27)) for sx in (1, -1) for sy in (1, -1)]

    def semelles(bm):
        for x, y in oreilles:
            boite(bm, (x, y, Z1 + 0.0), (0.18, 0.13, 0.04))

    ob.append(piece('semelles', semelles, P['blindageClair']))

    def oreille(bm):
        arc = [(-0.06, 0.0), (0.06, 0.0), (0.06, 0.07), (0.035, 0.11), (0.0, 0.12), (-0.035, 0.11), (-0.06, 0.07)]
        for x, y in oreilles:
            prisme_m(bm, arc, -0.016, 0.016, None, (x, y, Z1 + 0.02))

    ob.append(piece('oreilles', oreille, P['jaune']))
    ob.append(piece('oeillets', lambda bm: [boite(bm, (x, y, Z1 + 0.095), (0.042, 0.04, 0.042)) for x, y in oreilles], P['joint']))
    # Le dessous : bouclier thermique, rétrofusées (tuyère, intérieur chaud, braise).
    ob.append(piece('bouclier', lambda bm: boite(bm, (0, 0, 0.10), (2 * HX - 0.02, 2 * HY - 0.02, 0.08)), P['tuyere'], biseau=0.02))
    ob.append(piece('brulure', lambda bm: [boite(bm, (sx * (HX - e / 2), sy * (HY - e / 2), Z0 + 0.03), (e + 0.008, e + 0.008, 0.06)) for sx in (1, -1) for sy in (1, -1)], P['chaud']))
    for sx in (1, -1):
        for sy in (1, -1):
            p = (sx * 0.46, sy * 0.38, 0)
            ob.append(vertical('retro', [(0.07, 0.14), (0.115, 0.075), (0.135, 0.035), (0.125, 0.026)], P['tuyere'], 10, p, [P['tuyere'], P['acier'], P['acier']]))
            ob.append(vertical('retro-feu', [(0.125, 0.03), (0.08, 0.075), (0.001, 0.095)], P['chaud'], 10, p, [P['chaud'], P['braise']]))
    halos = [[0, 0.15, 0.3, 1.2, 1, 0.45, 0.15, 0.7]]
    halos += [[sx * 0.46, 0.05, -sy * 0.38, 0.35, 1, 0.5, 0.2, 0.5] for sx in (1, -1) for sy in (1, -1)]
    # (Les feux des quatre faces : le bloc tourne en tombant.)
    halos += [[0, 1.11, HY, 0.3, 1, 0.25, 0.2, 0.55], [0, 1.11, -HY, 0.3, 1, 0.25, 0.2, 0.55], [HX, 1.11, 0, 0.3, 1, 0.25, 0.2, 0.55], [-HX, 1.11, 0, 0.3, 1, 0.25, 0.2, 0.55], [0, Z1 + 0.1, 0, 0.25, 1, 0.25, 0.2, 0.5]]
    return ob, {'halos': halos}


# ---------------------------------------------------------------------------
# LE DRONE-CARGO (2,0 × 1,5 m, de 0,07 à 1,6 m) : un conteneur ondulé (portes et barres de verrouillage côté pilote)
# arrimé sur un traîneau anti-gravité : plateau, pare-chocs hachuré à feux rouges, deux flotteurs de sustentation (nez
# caréné, tuyères vers le bas et vers l'arrière), rampe de gyrophares sur le toit. Il glisse d'une voie à l'autre.
# ---------------------------------------------------------------------------
def cargo(P):
    P = matieres_mobiles(P)
    ob = []
    HX, HY, Z0, Z1 = 0.90, 0.60, 0.47, 1.43
    ZC = (Z0 + Z1) / 2
    ob.append(piece('conteneur', lambda bm: boite(bm, (0, 0, ZC), (2 * HX, 2 * HY, Z1 - Z0)), P['orange'], biseau=0.012))

    # La tôle ondulée : des nervures trapézoïdales sur les flancs, le dos et le toit.
    def nervure(bm, centre, u, n, l, base=0.075, sommet=0.045, prof=0.022, long=0.8):
        u, n, l, centre = Vector(u), Vector(n), Vector(l), Vector(centre)
        pts = [(-base / 2, 0), (base / 2, 0), (sommet / 2, prof), (-sommet / 2, prof)]
        a = [bm.verts.new(centre + u * x + n * y - l * long / 2) for x, y in pts]
        b = [bm.verts.new(centre + u * x + n * y + l * long / 2) for x, y in pts]
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new([a[i], a[j], b[j], b[i]])
        bm.faces.new(a[::-1])
        bm.faces.new(b)

    def ondes(bm):
        H = Z1 - Z0 - 0.14
        for sx in (1, -1):
            for k in range(8):
                y = -HY + 0.15 + k * (2 * HY - 0.30) / 7
                nervure(bm, (sx * HX, y, ZC), (0, 1, 0), (sx, 0, 0), (0, 0, 1), long=H)
        for k in range(11):
            x = -HX + 0.15 + k * (2 * HX - 0.30) / 10
            nervure(bm, (x, HY, ZC), (1, 0, 0), (0, 1, 0), (0, 0, 1), long=H)
        for k in range(6):
            x = -HX + 0.2 + k * (2 * HX - 0.40) / 5
            nervure(bm, (x, 0, Z1), (1, 0, 0), (0, 0, 1), (0, 1, 0), base=0.1, sommet=0.07, prof=0.016, long=2 * HY - 0.16)

    ob.append(piece('ondes', ondes, P['orange']))
    # Les portes (face au pilote) : deux vantaux, un joint, quatre barres de verrouillage, ferrures, poignées.
    ob.append(piece('vantaux', lambda bm: [boite(bm, (s * (HX / 2 - 0.005), -HY - 0.008, ZC), (HX - 0.07, 0.016, Z1 - Z0 - 0.12)) for s in (1, -1)], P['orange'], biseau=0.006))
    ob.append(piece('joint-portes', lambda bm: boite(bm, (0, -HY - 0.012, ZC), (0.02, 0.012, Z1 - Z0 - 0.12)), P['joint']))
    barres = [-0.64, -0.17, 0.17, 0.64]
    ob.append(piece('barres', lambda bm: [tube(bm, (x, -HY - 0.045, Z0 + 0.03), (x, -HY - 0.045, Z1 - 0.03), 0.016, 8) for x in barres], P['alliage']))

    def ferrures(bm):
        for x in barres:
            for z in (Z0 + 0.08, ZC + 0.12, Z1 - 0.08):
                boite(bm, (x, -HY - 0.03, z), (0.07, 0.04, 0.035))
            # La poignée à came, rabattue vers le joint.
            boite(bm, (x - math.copysign(0.07, x), -HY - 0.06, ZC - 0.05), (0.14, 0.02, 0.028))

    ob.append(piece('ferrures', ferrures, P['acier']))
    # Les plaques d'alerte sur les vantaux (fond noir, bandes rouges lumineuses).
    ob.append(piece('alerte-fond', lambda bm: [boite(bm, (s * 0.40, -HY - 0.02, Z1 - 0.2), (0.22, 0.01, 0.16)) for s in (1, -1)], P['hachureNoire']))

    def alerte(bm):
        for s in (1, -1):
            hachures(bm, (s * 0.40 - 0.10, -HY - 0.025, Z1 - 0.27), (1, 0, 0), (0, 0, 1), 0.20, 0.14, (0, -1, 0), largeur=0.035, pas=0.075, pente=0.6, ep=0.004)

    ob.append(piece('alerte', alerte, P['hachureRouge']))
    # Le cadre : montants d'angle, longerons, pièces de coin.
    def cadre(bm):
        for sx in (1, -1):
            for sy in (1, -1):
                boite(bm, (sx * (HX + 0.015), sy * (HY + 0.015), ZC), (0.09, 0.09, Z1 - Z0 + 0.04))
        for z in (Z0 + 0.0, Z1 + 0.0):
            for sy in (1, -1):
                boite(bm, (0, sy * (HY + 0.015), z), (2 * HX - 0.06, 0.07, 0.07))
            for sx in (1, -1):
                boite(bm, (sx * (HX + 0.015), 0, z), (0.07, 2 * HY - 0.06, 0.07))

    ob.append(piece('cadre', cadre, P['blindage'], biseau=0.01))
    ob.append(piece('coins', lambda bm: [boite(bm, (sx * (HX + 0.02), sy * (HY + 0.02), z), (0.12, 0.12, 0.1)) for sx in (1, -1) for sy in (1, -1) for z in (Z0 + 0.0, Z1 + 0.0)], P['acier']))
    # Le traîneau : plateau chanfreiné, pare-chocs, verrous d'arrimage.
    ob.append(piece('plateau', lambda bm: prisme_m(bm, [(-0.90, 0.30), (0.90, 0.30), (0.98, 0.36), (0.98, 0.43), (-0.98, 0.43), (-0.98, 0.36)], -0.72, 0.72), P['blindage'], biseau=0.012))
    ob.append(piece('pare-chocs', lambda bm: lame(bm, [(-0.70, 0.22), (-0.80, 0.26), (-0.82, 0.40), (-0.74, 0.46), (-0.66, 0.46), (-0.66, 0.22)], -0.66, 0.66), P['blindageClair'], biseau=0.01))
    ob.append(piece('pare-chocs-fond', lambda bm: boite(bm, (0, -0.82, 0.33), (1.10, 0.02, 0.11)), P['hachureNoire']))
    ob.append(piece('pare-chocs-rayures', lambda bm: hachures(bm, (-0.55, -0.832, 0.28), (1, 0, 0), (0, 0, 1), 1.10, 0.10, (0, -1, 0), largeur=0.07, pas=0.16, pente=0.8, ep=0.006), P['hachureRouge']))
    ob.append(piece('pare-chocs-feux', lambda bm: [boite(bm, (s * 0.60, -0.826, 0.33), (0.09, 0.024, 0.07)) for s in (1, -1)], P['dangerFort']))
    ob.append(piece('verrous', lambda bm: [boite(bm, (sx * 0.95, sy * 0.40, 0.50), (0.06, 0.16, 0.12)) for sx in (1, -1) for sy in (1, -1)], P['acier'], biseau=0.008))
    # Les nacelles de sustentation : entrée d'air à l'avant, tuyère à l'arrière (cœur accent2, comme le procédural).
    # (Des flotteurs le long du plateau, bien au-dessus du sol : nez caréné à feu rouge, bague, corps, tuyère arrière ;
    # une ouïe d'aspiration sur le flanc ; deux tuyères de sustentation dessous.)
    profil_nacelle = [(0.001, -0.87), (0.03, -0.862), (0.065, -0.83), (0.11, -0.75), (0.138, -0.64), (0.145, -0.56), (0.145, 0.55), (0.135, 0.70), (0.12, 0.78), (0.095, 0.775), (0.075, 0.74), (0.001, 0.735)]
    mats_nacelle = [P['dangerFort'], P['acier'], P['blindageClair'], P['blindageClair'], P['acier'], P['blindage'], P['acier'], P['tuyere'], P['tuyere'], P['chaud'], P['poussee']]
    XN, ZN = 0.86, 0.30
    for s in (1, -1):
        ob.append(axial('nacelle', profil_nacelle, P['blindage'], 14, (s * XN, 0, ZN), mats_nacelle))
        for y in (-0.36, 0.36):
            ob.append(vertical('poussee', [(0.075, 0.19), (0.105, 0.15), (0.11, 0.115), (0.09, 0.105), (0.001, 0.105)], P['acier'], 10, (s * XN, y, 0), [P['acier'], P['acier'], P['tuyere'], P['poussee']]))
    ob.append(piece('ouies', lambda bm: [boite(bm, (s * (XN + 0.138), -0.12 + k * 0.07, ZN + 0.02), (0.02, 0.045, 0.12)) for s in (1, -1) for k in range(4)], P['joint']))
    # La rampe de gyrophares sur le toit, une antenne.
    ob.append(piece('rampe', lambda bm: boite(bm, (0, -0.40, Z1 + 0.06), (0.74, 0.14, 0.06)), P['blindage'], biseau=0.01))
    for s in (1, -1):
        ob.append(vertical('gyrophare', [(0.06, 0.0), (0.06, 0.04), (0.045, 0.075), (0.001, 0.082)], P['danger'], 12, (s * 0.30, -0.40, Z1 + 0.09), [P['acier'], P['dangerFort'], P['dangerFort']]))
    ob.append(piece('antenne', lambda bm: tube(bm, (0.62, 0.45, Z1), (0.62, 0.45, Z1 + 0.34), 0.008, 6), P['acier']))
    ob.append(piece('antenne-feu', lambda bm: boite(bm, (0.62, 0.45, Z1 + 0.345), (0.026, 0.026, 0.026)), P['feuRouge']))
    halos = [[s * 0.86, 0.08, -y, 0.38, 1, 0.6, 0.2, 0.55] for s in (1, -1) for y in (-0.36, 0.36)]
    halos += [[s * 0.86, 0.30, -0.80, 0.32, 1, 0.6, 0.2, 0.5] for s in (1, -1)] + [[s * 0.86, 0.30, 0.88, 0.16, 1, 0.25, 0.2, 0.5] for s in (1, -1)]
    halos += [[s * 0.30, Z1 + 0.14, 0.40, 0.3, 1, 0.25, 0.2, 0.65] for s in (1, -1)]
    halos += [[s * 0.60, 0.33, 0.85, 0.25, 1, 0.25, 0.2, 0.5] for s in (1, -1)] + [[0, 0.33, 0.9, 0.7, 1, 0.25, 0.2, 0.3]]
    return ob, {'halos': halos}


# ---------------------------------------------------------------------------
# LA LANCE DE FRAPPE (Ø 2 m au sol, 2,9 m de haut) : un pieu de cristal brûlant à facettes, tenu par un fourreau
# mécanique (trois aubes blindées à arête rouge, bagues, émetteur), ancré par trois vérins dans la piste défoncée
# (plaques soulevées, fissures en fusion). Le jeu le fait rougeoyer (« chaud »).
# ---------------------------------------------------------------------------
def lance(P):
    P = matieres_mobiles(P)
    ob = []

    # Le cristal : un prisme hexagonal à facettes, légèrement vrillé, pointe en haut (construit le long de Y, dressé).
    def hexa(r, rot):
        return [(r * math.cos(rot + k * math.pi / 3), r * math.sin(rot + k * math.pi / 3)) for k in range(6)]

    cr = fuseau('cristal', [(0.05, hexa(0.24, 0)), (0.9, hexa(0.29, 0.08)), (1.85, hexa(0.275, 0.16)), (2.22, [(x + 0.01, z) for x, z in hexa(0.25, 0.22)]), (2.9, [(0.05, 0.02)])], P['braise'], subdivision=0)
    placer(cr, (0, 0, 0), (math.pi / 2, 0, 0))
    # Une facette sur deux en cristal sombre : la lecture « cristal » (et non « fusée »), avec des arêtes vives.
    peindre(cr, P['cristalSombre'], lambda c, n: int(math.floor((math.atan2(n.y, n.x) + 2 * math.pi) / (math.pi / 3))) % 2 == 0 and abs(n.z) < 0.9)
    ob.append(cr)
    # Des cristaux secondaires jaillis du cratère, entre les aubes et les vérins : une gerbe, pas une fusée.
    for k, (deg, r, h, inc, rr) in enumerate([(60, 0.55, 0.58, 0.5, 0.075), (180, 0.58, 0.46, 0.6, 0.065), (300, 0.50, 0.66, 0.45, 0.08), (0, 0.66, 0.36, 0.75, 0.055), (240, 0.62, 0.40, 0.68, 0.06), (120, 0.68, 0.30, 0.8, 0.05)]):
        a = math.radians(deg)
        g = fuseau('germe', [(-0.1, hexa(rr * 0.9, k)), (h * 0.62, hexa(rr * 1.12, k + 0.15)), (h, [(0.01, 0)])], P['braise'], subdivision=0)
        g.data.transform((Matrix.Translation(polaire(r, a, 0.0)) @ Rz(a).to_4x4() @ Ry(inc).to_4x4() @ Rx(math.pi / 2).to_4x4()))
        peindre(g, P['cristalSombre'], lambda c, n: int(math.floor((math.atan2(n.y, n.x) + 2 * math.pi) / (math.pi / 3))) % 2 == 1)
        ob.append(g)
    # Le fourreau : trois aubes blindées (l'avant reste ouvert sur le cristal), arête lumineuse.
    angles_aubes = [math.radians(a) for a in (90, 210, 330)]
    profil = [(0.20, 0.10), (0.60, 0.10), (0.58, 0.20), (0.40, 0.95), (0.33, 1.45), (0.24, 1.58), (0.20, 1.58)]

    def aubes(bm):
        for a in angles_aubes:
            prisme_m(bm, profil, -0.055, 0.055, Rz(a))

    ob.append(piece('aubes', aubes, P['blindage'], biseau=0.015))

    def aretes(bm):
        for a in angles_aubes:
            for p0, p1 in ((profil[2], profil[3]), (profil[3], profil[4])):
                dr, dz = p1[0] - p0[0], p1[1] - p0[1]
                ln = math.hypot(dr, dz)
                nr, nz = dz / ln * 0.022, -dr / ln * 0.022
                pts = [(p0[0], p0[1]), (p1[0], p1[1]), (p1[0] + nr, p1[1] + nz), (p0[0] + nr, p0[1] + nz)]
                prisme_m(bm, pts, -0.022, 0.022, Rz(a))

    ob.append(piece('aretes', aretes, P['dangerFort']))

    def events(bm):
        # Des ouïes sur les deux flancs de chaque aube.
        for a in angles_aubes:
            for s in (1, -1):
                for k in range(3):
                    boite(bm, Rz(a) @ Vector((0.40 - k * 0.025, s * 0.058, 0.42 + k * 0.12)), (0.16, 0.008, 0.035), Rz(a))

    ob.append(piece('ouies', events, P['joint']))
    # Les bagues : socle, bague des vérins, émetteur au sommet du fourreau.
    ob.append(vertical('socle', [(0.24, 0.06), (0.47, 0.06), (0.50, 0.10), (0.50, 0.24), (0.46, 0.29), (0.26, 0.31)], P['acier'], 18, (0, 0, 0), [P['tuyere'], P['acier'], P['blindageClair'], P['acier'], P['alliage']]))
    ob.append(vertical('bague', [(0.27, 0.86), (0.40, 0.86), (0.42, 0.89), (0.42, 0.97), (0.40, 1.0), (0.27, 1.0)], P['acier'], 18, (0, 0, 0), [P['acier'], P['alliage'], P['acierPeint'], P['alliage'], P['acier']]))
    ob.append(vertical('emetteur', [(0.26, 1.53), (0.335, 1.55), (0.345, 1.59), (0.30, 1.625), (0.25, 1.62)], P['acier'], 18, (0, 0, 0), [P['acier'], P['danger'], P['danger'], P['acier']]))
    # Les vérins d'ancrage, entre les aubes : rotule sur la bague, corps, tige, pied planté.
    angles_verins = [math.radians(a) for a in (30, 150, 270)]

    def verins_corps(bm):
        for a in angles_verins:
            T, F = polaire(0.40, a, 0.93), polaire(0.88, a, 0.07)
            tube(bm, T, T.lerp(F, 0.58), 0.048, 10)

    ob.append(piece('verins', verins_corps, P['acier']))
    ob.append(piece('tiges', lambda bm: [tube(bm, polaire(0.40, a, 0.93).lerp(polaire(0.88, a, 0.07), 0.5), polaire(0.88, a, 0.07), 0.027, 8) for a in angles_verins], P['alliage']))

    def rotules(bm):
        for a in angles_verins:
            boite(bm, polaire(0.42, a, 0.93), (0.1, 0.11, 0.1), Rz(a))
            boite(bm, polaire(0.88, a, 0.06), (0.2, 0.15, 0.07), Rz(a))

    ob.append(piece('rotules', rotules, P['blindage'], biseau=0.012))
    ob.append(piece('verins-feux', lambda bm: [boite(bm, polaire(0.47, a, 0.93), (0.012, 0.05, 0.03), Rz(a)) for a in angles_verins], P['dangerFort']))
    # La piste défoncée : un disque brûlé (anneau en fusion), des plaques soulevées en couronne, des fissures.
    ob.append(vertical('cratere', [(0.001, 0.065), (0.30, 0.065), (0.42, 0.055), (0.52, 0.042), (0.68, 0.028), (0.80, 0.014), (1.0, 0.004)], P['chaud'], 20, (0, 0, 0), [P['chaud'], P['chaud'], P['tuyere'], P['danger'], P['chaud'], P['tuyere']]))
    alea = random.Random(7)
    eclats = []
    for k in range(8):
        a0 = 2 * math.pi * k / 8 + alea.uniform(-0.12, 0.12) + 0.2
        da = 2 * math.pi / 8 * alea.uniform(0.62, 0.78)
        r0, r1 = 0.50 + alea.uniform(0, 0.08), 0.92 + alea.uniform(-0.06, 0.05)
        h0 = 0.16 + alea.uniform(0, 0.1)
        eclats.append((a0, da, r0, r1, h0))

    def plaques_soulevees(bm):
        for a0, da, r0, r1, h0 in eclats:
            pts = [polaire(r0, a0, h0), polaire(r1, a0 + 0.05, 0.015), polaire(r1, a0 + da - 0.05, 0.015), polaire(r0 + 0.03, a0 + da, h0 - 0.05)]
            n = (pts[1] - pts[0]).cross(pts[3] - pts[0])
            if n.z < 0:
                n = -n
            dalle(bm, pts, n, 0.045)

    ob.append(piece('eclats', plaques_soulevees, P['blindageClair'], biseau=0.008))

    def fissures(bm):
        for a0, da, r0, r1, h0 in eclats:
            a = a0 - 0.12
            chemin = [polaire(0.46, a, 0.02), polaire(0.70, a + 0.06, 0.012), polaire(0.96, a - 0.03, 0.006)]
            v = []
            for i, p in enumerate(chemin):
                t = (chemin[min(i + 1, 2)] - chemin[max(i - 1, 0)]).normalized()
                cote = t.cross(Vector((0, 0, 1))) * (0.016 - i * 0.005)
                v.append([bm.verts.new(p - cote), bm.verts.new(p + cote)])
            for (a1, b1), (a2, b2) in zip(v, v[1:]):
                bm.faces.new([a1, b1, b2, a2])

    f = piece('fissures', fissures, P['danger'])
    modif(f, 'SOLIDIFY', thickness=0.008, offset=1.0)
    ob.append(f)
    halos = [[0, 1.3, 0.3, 1.4, 1, 0.45, 0.2, 0.75], [0, 2.4, 0.05, 0.7, 1, 0.5, 0.25, 0.6], [0, 0.1, 0.55, 1.0, 1, 0.3, 0.15, 0.45], [0, 1.59, 0.25, 0.4, 1, 0.25, 0.2, 0.5]]
    return ob, {'halos': halos}


OBJETS = {'drone': drone, 'eclaireur': eclaireur, 'bloc-chute': bloc_chute, 'cargo': cargo, 'lance': lance}

# Les cadrages des aperçus (cible Blender, distance) : la caméra regarde la face que voit le pilote.
cadrages = {
    'drone': ((0, 0, 1.12), 4.0),
    'eclaireur': ((0, 0, 0.9), 4.4),
    'bloc-chute': ((0, 0, 0.85), 5.0),
    'cargo': ((0, 0, 0.8), 5.6),
    'lance': ((0, 0, 1.3), 7.4),
}

if __name__ == '__main__':
    executer(OBJETS, 'objets-mobiles.prm', cadrages)
