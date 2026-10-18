# PORTAL RUSH — LES MÉCANISMES ET LES PORTES (Blender). Voir commun.py pour la chaîne et le format, objets.py
# pour le contrat des obstacles (fonction(P) → (objets, points)).
#
# Chaque maillage remplace le modèle procédural du même nom (modeles.ts) ; il en garde l'encombrement, l'origine
# et les pivots de ses pièces mobiles (scene.ts : creerVisuel, poserMecanismes, animerMecanismes, BASE_MECA).
#   Les obstacles de voie (une voie de 2,6 m ; les collisions sont celles du moteur) :
#     pylones        — la porte laser (le faisceau reste procédural, en y = 0,78, de x = −1,15 à 1,15) ;
#     porte-cadre    — le cadre d'une porte ; porte-battant : un battant (x de −0,56 à 0,56), qui glisse ; le second
#                      est le même maillage tourné d'un demi-tour (il montre son dos) : le battant est symétrique ;
#     rotor-moyeu    — le moyeu ; rotor-pale : une pale le long de +x, autour de la tête (y = 1,0 du moyeu), qui
#                      tourne autour de y ; trois pales tournées de 120° forment la couronne.
#   Les mécanismes du bord de piste, posés sur plateforme-meca (dessus en y = −0,5) :
#     turbine-cadre / turbine-rotor (rotor en (0 ; 2,6 ; 0,1), il tourne autour de z),
#     radar-tour / radar-antenne (pivot en y = 3,9, autour de y),
#     presse-cadre / presse-tete (le centre de la tête va de y = 0,15 à 3,55),
#     balise-mat / balise-tete (pivot en y = 2,5, autour de y).
# Repère du jeu : x latéral, y vers le haut, z vers l'arrière ; la face tournée vers le pilote qui arrive est +z
# (Blender −Y). Dans Blender (Z vers le haut) : jeu (x, y, z) = Blender (x, z, −y). Les halos (points « halos »,
# repère du jeu) sont des quads dans le plan xy local du mécanisme, pas des panneaux tournés vers la caméra.

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402,F401  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import appliquer, matiere  # noqa: E402
from formes import boite, miroir_x, piece, tube  # noqa: E402
from objets import executer, prisme  # noqa: E402

PI = math.pi


# ---------------------------------------------------------------------------
# Les matières propres aux mécanismes (en plus de la palette et de matieres_objets)
# ---------------------------------------------------------------------------
def matieres_meca(P):
    P = dict(P)
    for nom, (c, m, r, e, k) in {
        'accent2': ('#ffffff', 0, 0.5, 1.0, 'accent2'),
        'dangerDoux': ('#ff3a2e', 0, 0.5, 0.35, 'danger'),
        'hachureJaune': ('#f0b52a', 0.3, 0.5, 0.22, 'fixe'),   # (la hachure jaune des procédurales)
        'battant': ('#3c4553', 0.8, 0.38, 0.0, 'fixe'),
        'metalMoyen': ('#485366', 0.86, 0.4, 0.0, 'fixe'),
        'graphite': ('#1b212c', 0.85, 0.36, 0.0, 'fixe'),
        'plaque': ('#5a6576', 0.78, 0.36, 0.0, 'fixe'),
        'gris': ('#b9c2ce', 0.45, 0.42, 0.0, 'fixe'),
        'bronze': ('#8a6a3a', 0.9, 0.35, 0.0, 'fixe'),
        'fenetre': ('#cfe3ff', 0, 0.5, 0.45, 'fixe'),
        'ecran': ('#0a1220', 0.5, 0.08, 0.05, 'fixe'),
        'ambre': ('#ffae3a', 0, 0.5, 1.2, 'fixe'),
        'feuAmbre': ('#ffae3a', 0, 0.5, 1.4, 'clignote'),
    }.items():
        P[nom] = matiere(nom, c, m, r, e, k)
    return P


# ---------------------------------------------------------------------------
# Les outils de forme (bmesh)
# ---------------------------------------------------------------------------
AXES = {'Z': Matrix.Identity(4), 'Y': Matrix.Rotation(-PI / 2, 4, 'X'), 'X': Matrix.Rotation(PI / 2, 4, 'Y')}


def revol(bm, profil, seg=24, centre=(0, 0, 0), axe='Z', a0=0.0, a1=None, ferme=False, couvercles=True, rot=None):
    """
    Une pièce de révolution : le profil [(rayon, hauteur)] tourne autour de l'axe (Z, Y ou X ; la hauteur court le
    long de l'axe), de a0 à a1 (tour complet par défaut). Profil ouvert : couvercles aux bouts (tour complet) ;
    « ferme » : le profil est une section fermée (anneau, tore), avec des faces aux bouts d'un secteur.
    Angle a : axe Z → (cos a, sin a) ; axe Y → (x = cos a, z = −sin a) ; axe X → (y = sin a, z = −cos a).
    """
    if a1 is None:
        a1 = a0 + 2 * PI
    complet = abs(a1 - a0 - 2 * PI) < 1e-6
    n = seg if complet else seg + 1
    angles = [a0 + (a1 - a0) * k / seg for k in range(n)]
    m = Matrix.Translation(centre) @ (rot.to_4x4() if rot is not None else Matrix.Identity(4)) @ AXES[axe]
    anneaux = []
    for r, h in profil:
        if r <= 1e-6:
            v = bm.verts.new(m @ Vector((0, 0, h)))
            anneaux.append([v] * n)
        else:
            anneaux.append([bm.verts.new(m @ Vector((r * math.cos(a), r * math.sin(a), h))) for a in angles])
    paires = list(zip(anneaux, anneaux[1:]))
    if ferme:
        paires.append((anneaux[-1], anneaux[0]))
    for A, B in paires:
        for k in range(seg):
            j = (k + 1) % n
            u = []
            for v in (A[k], A[j], B[j], B[k]):
                if v not in u:
                    u.append(v)
            if len(u) >= 3:
                bm.faces.new(u)
    if complet and not ferme and couvercles:
        for anneau in (anneaux[0], anneaux[-1]):
            if len(set(anneau)) > 2:
                bm.faces.new(anneau)
    if not complet and ferme:
        bm.faces.new([a[0] for a in anneaux])
        bm.faces.new([a[-1] for a in anneaux])


def loft(bm, sections, fermer=True):
    """Relie des sections (listes de points 3D, même nombre) ; ferme les deux bouts. Renvoie les sommets."""
    anneaux = [[bm.verts.new(p) for p in s] for s in sections]
    n = len(anneaux[0])
    for a, b in zip(anneaux, anneaux[1:]):
        for k in range(n):
            j = (k + 1) % n
            bm.faces.new([a[k], a[j], b[j], b[k]])
    if fermer:
        bm.faces.new(anneaux[0][::-1])
        bm.faces.new(anneaux[-1])
    return [v for a in anneaux for v in a]


def extrude(bm, pts, d0, d1, axe='Z'):
    """Un profil 2D extrudé le long d'un axe : Z → points (x, y) ; Y → (x, z) ; X → (y, z). Renvoie les sommets."""
    def p(u, v, d):
        return (u, v, d) if axe == 'Z' else (u, d, v) if axe == 'Y' else (d, u, v)
    return loft(bm, [[p(u, v, d0) for u, v in pts], [p(u, v, d1) for u, v in pts]])


def rect_ch(lx, ly, c=0.0, cx=0.0, cy=0.0):
    """Un rectangle (2D) aux coins chanfreinés."""
    X, Y = lx / 2, ly / 2
    if c <= 0:
        return [(cx - X, cy - Y), (cx + X, cy - Y), (cx + X, cy + Y), (cx - X, cy + Y)]
    return [(cx - X + c, cy - Y), (cx + X - c, cy - Y), (cx + X, cy - Y + c), (cx + X, cy + Y - c),
            (cx + X - c, cy + Y), (cx - X + c, cy + Y), (cx - X, cy + Y - c), (cx - X, cy - Y + c)]


def barre(bm, a, b, e):
    """Une barre de section carrée (côté e) de a à b (le langage du portique en treillis, decor.py)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    q = d.to_track_quat('Z', 'Y')
    m = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((e, e, d.length, 1))
    r = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=m, verts=r['verts'])
    return r['verts']


def treillis(bm, coins_bas, coins_haut, etages, e_membrure, e_diag):
    """Une tour en treillis à n membrures : ceintures à chaque étage, diagonales en zigzag sur chaque face."""
    n = len(coins_bas)
    for cb, ch in zip(coins_bas, coins_haut):
        barre(bm, cb, ch, e_membrure)

    def point(i, t):
        cb, ch = Vector(coins_bas[i]), Vector(coins_haut[i])
        return cb + (ch - cb) * t

    for k in range(etages + 1):
        for i in range(n):
            barre(bm, point(i, k / etages), point((i + 1) % n, k / etages), e_diag * 1.2)
    for k in range(etages):
        t0, t1 = k / etages, (k + 1) / etages
        for i in range(n):
            j = (i + 1) % n
            if k % 2:
                barre(bm, point(i, t0), point(j, t1), e_diag)
            else:
                barre(bm, point(j, t0), point(i, t1), e_diag)


def catmull(pts, sub):
    P = [Vector(p) for p in pts]
    P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    res = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(sub):
            t = k / sub
            res.append(0.5 * ((2 * p1) + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t))
    res.append(P[-2])
    return res


def tuyau(bm, pts, r, seg=8, sub=4):
    """Un tuyau souple (flexible, câble) passant par les points (courbe de Catmull-Rom), à repère transporté."""
    C = catmull(pts, sub) if sub > 1 else [Vector(p) for p in pts]
    t0 = (C[1] - C[0]).normalized()
    ref = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
    n = t0.cross(ref).normalized()
    tp = t0
    anneaux = []
    for i, c in enumerate(C):
        t = (C[min(i + 1, len(C) - 1)] - C[max(i - 1, 0)]).normalized()
        n = tp.rotation_difference(t) @ n
        n = (n - t * n.dot(t)).normalized()
        b = t.cross(n)
        anneaux.append([bm.verts.new(c + (n * math.cos(2 * PI * k / seg) + b * math.sin(2 * PI * k / seg)) * r) for k in range(seg)])
        tp = t
    for a, bb in zip(anneaux, anneaux[1:]):
        for k in range(seg):
            j = (k + 1) % seg
            bm.faces.new([a[k], a[j], bb[j], bb[k]])
    bm.faces.new(anneaux[0][::-1])
    bm.faces.new(anneaux[-1])


def boulons(bm, pts, n, r=0.022, h=0.016, seg=6):
    """Des têtes de boulon (petits cylindres) posées en ces points, sortant selon la normale n."""
    n = Vector(n)
    for p in pts:
        p = Vector(p)
        tube(bm, p - n * 0.004, p + n * h, r, seg)


def rot_z(bm, vs, a):
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(a, 4, 'Z'), verts=vs)


# ---- Les hachures de danger : des bandes diagonales découpées dans un rectangle, posées sur une face ----
def decouper(poly, u0, u1, v0, v1):
    """Découpe un polygone convexe (2D) par un rectangle (Sutherland-Hodgman)."""
    def couper(pts, dedans, inter):
        res = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            if dedans(b):
                if not dedans(a):
                    res.append(inter(a, b))
                res.append(b)
            elif dedans(a):
                res.append(inter(a, b))
        return res

    def iu(c):
        return lambda a, b: (c, a[1] + (b[1] - a[1]) * (c - a[0]) / (b[0] - a[0]))

    def iv(c):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (c - a[1]) / (b[1] - a[1]), c)

    for dedans, inter in ((lambda p: p[0] >= u0, iu(u0)), (lambda p: p[0] <= u1, iu(u1)), (lambda p: p[1] >= v0, iv(v0)), (lambda p: p[1] <= v1, iv(v1))):
        if len(poly) < 3:
            return []
        poly = couper(poly, dedans, inter)
    res = []
    for p in poly:
        if not res or abs(p[0] - res[-1][0]) + abs(p[1] - res[-1][1]) > 1e-6:
            res.append(p)
    if len(res) > 1 and abs(res[0][0] - res[-1][0]) + abs(res[0][1] - res[-1][1]) < 1e-6:
        res.pop()
    return res if len(res) >= 3 else []


def aire(poly):
    return abs(sum(poly[i - 1][0] * poly[i][1] - poly[i][0] * poly[i - 1][1] for i in range(len(poly)))) / 2


def bandes(u0, u1, v0, v1, pas, pente=1.0):
    """Les bandes diagonales (largeur « pas », alternées) qui couvrent le rectangle : (paires, impaires)."""
    dec = pente * (v1 - v0)
    groupes = ([], [])
    for k in range(math.floor(min(0, dec) / pas) - 1, math.ceil((u1 - u0 + max(0, dec)) / pas) + 2):
        sa, sb = u0 + k * pas, u0 + (k + 1) * pas
        poly = decouper([(sa, v0), (sb, v0), (sb - dec, v1), (sa - dec, v1)], u0, u1, v0, v1)
        if poly and aire(poly) > 1e-5:
            groupes[k % 2].append(poly)
    return groupes


def plaquer(bm, polys, o, eu, ev, en, ep):
    """Pose des polygones 2D sur le plan (origine o, axes eu, ev), épaissis de « ep » selon la normale en."""
    o, eu, ev, en = Vector(o), Vector(eu), Vector(ev), Vector(en)
    for poly in polys:
        a = [bm.verts.new(o + eu * u + ev * v) for u, v in poly]
        b = [bm.verts.new(o + eu * u + ev * v + en * ep) for u, v in poly]
        n = len(poly)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([a[i], a[j], b[j], b[i]])
        bm.faces.new(a[::-1])
        bm.faces.new(b)


def hachures(P, faces, pas=0.15, pente=1.0, ep=0.006, couleurs=('hachureJaune', 'hachureNoire'), nom='hachures'):
    """
    Des hachures de danger sur une ou plusieurs faces planes : faces = [(o, eu, ev, en, u0, u1, v0, v1)], le
    rectangle [u0, u1] × [v0, v1] du plan (o, eu, ev), épaissi vers en. Une couleur à None : bandes absentes
    (le fond sombre de la pièce fait la seconde couleur). Renvoie les pièces (une par couleur).
    """
    lots = ([], [])
    for o, eu, ev, en, u0, u1, v0, v1 in faces:
        g = bandes(u0, u1, v0, v1, pas, pente)
        for i in (0, 1):
            lots[i].append((o, eu, ev, en, g[i]))
    res = []
    for i, c in enumerate(couleurs):
        if not c:
            continue

        def f(bm, lot=lots[i]):
            for o, eu, ev, en, polys in lot:
                plaquer(bm, polys, o, eu, ev, en, ep)
        res.append(piece(nom, f, P[c]))
    return res


def dome(rayon, haut):
    """Le profil d'un feu en dôme (rayon, hauteur), posé sur son centre."""
    return [(rayon, 0.0), (rayon, haut * 0.5), (rayon * 0.72, haut * 0.88), (0.0, haut)]


# ===========================================================================
# LA PORTE LASER : deux pylônes (x = ±1,18). L'émetteur, sur la face intérieure, vise l'autre pylône à la
# hauteur du faisceau (y = 0,78) ; la lentille est une fente verticale (le faisceau : un ruban de 0,24 m).
# ===========================================================================
def pylones(P):
    P = matieres_meca(P)
    ob = []
    X = 1.18
    # (Le pylône droit ; le gauche est son miroir.) La semelle : un traîneau bas, chanfreiné, qui reste dans la voie.
    ob.append(piece('semelle', lambda bm: prisme(bm, [(0.9, 0.0), (1.34, 0.0), (1.36, 0.06), (1.3, 0.15), (0.97, 0.15), (0.9, 0.06)], -0.34, 0.34), P['blindage'], biseau=0.012))
    ob += hachures(P, [((0, -0.341, 0), (1, 0, 0), (0, 0, 1), (0, -1, 0), 0.96, 1.3, 0.025, 0.125)], pas=0.06)

    # Le fût : un caisson qui s'affine en montant, aux arêtes chanfreinées.
    def fut(bm):
        etages = [(0.15, 0.32, 0.44, 0.07), (0.32, 0.28, 0.38, 0.06), (1.5, 0.24, 0.32, 0.05), (1.62, 0.24, 0.32, 0.05)]
        loft(bm, [[(X + x, y, z) for x, y in rect_ch(lx, ly, c)] for z, lx, ly, c in etages])
    ob.append(piece('fut', fut, P['blindage']))
    # L'émetteur : un boîtier sur la face intérieure, sa lentille (fente rouge) dans un cadre, des ailettes au-dessus
    # et au-dessous (le refroidissement).
    ob.append(piece('emetteur', lambda bm: boite(bm, (0.99, 0, 0.78), (0.14, 0.3, 0.46)), P['blindageClair'], biseau=0.02))

    # Le canon de l'émetteur, pointé vers l'autre pylône : un fût à collerette, une bobine cuivrée, la lentille
    # rouge (le faisceau, un ruban de 0,24 m, en sort et s'y enfonce).
    ob.append(piece('canon', lambda bm: revol(bm, [(0.12, 0.0), (0.12, -0.06), (0.15, -0.065), (0.15, -0.09), (0.12, -0.1), (0, -0.1)], 16, centre=(0.92, 0, 0.78), axe='X'), P['acier']))
    ob.append(piece('bobine', lambda bm: revol(bm, [(0.12, -0.012), (0.135, -0.012), (0.135, -0.05), (0.12, -0.05)], 16, centre=(0.92, 0, 0.78), axe='X', ferme=True), P['bronze']))
    ob.append(piece('lentille', lambda bm: revol(bm, [(0, -0.102), (0.1, -0.102)], 16, centre=(0.92, 0, 0.78), axe='X', couvercles=False), P['dangerFort']))

    def ailettes(bm):
        for z in (1.06, 1.1, 1.14, 1.18, 1.22):
            boite(bm, (1.0, 0, z), (0.12, 0.26, 0.014))
        for z in (0.36, 0.4, 0.44, 0.48):
            boite(bm, (1.0, 0, z), (0.12, 0.28, 0.014))
    ob.append(piece('ailettes', ailettes, P['acier']))
    # La face avant : deux plaques boulonnées, une veilleuse rouge (fente verticale).
    ob.append(piece('plaques', lambda bm: [boite(bm, (X, -0.18, 1.2), (0.19, 0.025, 0.5)), boite(bm, (X, -0.2, 0.43), (0.23, 0.025, 0.32))], P['blindageClair'], biseau=0.006))
    ob.append(piece('veilleuse', lambda bm: boite(bm, (X, -0.194, 1.2), (0.035, 0.008, 0.36)), P['dangerDoux']))
    ob.append(piece('boulons', lambda bm: boulons(bm, [(X + dx, -0.1925, z) for dx in (-0.07, 0.07) for z in (0.99, 1.41)] + [(X + dx, -0.2125, z) for dx in (-0.09, 0.09) for z in (0.31, 0.55)], (0, -1, 0), 0.014, 0.012), P['acier']))
    # L'arrière : un condensateur (cylindre cerclé) et son flexible qui rejoint l'émetteur.
    ob.append(piece('condensateur', lambda bm: [tube(bm, (1.22, 0.22, 0.15), (1.22, 0.22, 1.02), 0.07, 12), tube(bm, (1.22, 0.22, 1.02), (1.22, 0.22, 1.05), 0.05, 12)], P['acier']))
    ob.append(piece('colliers', lambda bm: [tube(bm, (1.22, 0.22, z), (1.22, 0.22, z + 0.035), 0.076, 12) for z in (0.35, 0.8)], P['joint']))
    ob.append(piece('flexible', lambda bm: tuyau(bm, [(1.22, 0.22, 1.04), (1.21, 0.22, 1.13), (1.08, 0.17, 1.08), (1.0, 0.12, 0.97)], 0.022, 6, 3), P['caoutchouc']))
    # Le flanc extérieur : une grille de ventilation à lames.
    ob.append(piece('grille', lambda bm: boite(bm, (1.305, 0, 1.1), (0.01, 0.24, 0.46)), P['joint']))
    ob.append(piece('lames', lambda bm: [boite(bm, (1.313, 0, z), (0.014, 0.22, 0.03)) for z in (0.92, 0.99, 1.06, 1.13, 1.2, 1.27)], P['acier']))
    # Le chapeau, un feu rouge, une antenne.
    ob.append(piece('chapeau', lambda bm: boite(bm, (X, 0, 1.665), (0.3, 0.4, 0.09)), P['acier'], biseau=0.015))
    ob.append(piece('socle-feu', lambda bm: tube(bm, (X, 0, 1.705), (X, 0, 1.735), 0.085, 12), P['blindage']))
    ob.append(piece('feu', lambda bm: revol(bm, dome(0.065, 0.09), 12, centre=(X, 0, 1.735)), P['dangerFort']))
    ob.append(piece('antenne', lambda bm: tube(bm, (1.26, 0.14, 1.71), (1.26, 0.14, 2.0), 0.009, 6), P['alliage']))
    for o in list(ob):
        appliquer(o)
        ob.append(miroir_x(o))
    halos = []
    for s in (1, -1):
        halos += [[s * 0.83, 0.78, 0.14, 0.3, 1, 0.25, 0.2, 0.85], [s * X, 1.78, 0.04, 0.2, 1, 0.25, 0.2, 0.5]]
    return ob, {'halos': halos}


# ===========================================================================
# LA PORTE MÉCANIQUE : un cadre (montants à x = ±1,22, linteau), deux battants qui glissent dans la fente des
# montants (le battant fait 0,18 m d'épaisseur : la fente, 0,21 m, entre deux jambages).
# ===========================================================================
def porte_cadre(P):
    P = matieres_meca(P)
    ob = []

    def jambages(bm):
        for s in (1, -1):
            for sy in (1, -1):
                pts = [(1.12, 0.105), (1.32, 0.105), (1.32, 0.215), (1.285, 0.255), (1.155, 0.255), (1.12, 0.22)]
                extrude(bm, [(s * x, sy * y) for x, y in pts], 0.1, 1.98, 'Z')
    ob.append(piece('jambages', jambages, P['metalMoyen'], biseau=0.01))
    ob.append(piece('socles', lambda bm: [boite(bm, (s * 1.21, 0, 0.055), (0.27, 0.62, 0.11)) for s in (1, -1)], P['blindage'], biseau=0.015))
    ob += hachures(P, [((0, -0.311, 0), (1, 0, 0), (0, 0, 1), (0, -1, 0), u0, u1, 0.02, 0.09) for u0, u1 in ((1.1, 1.32), (-1.32, -1.1))], pas=0.05)
    # Les joints-brosses le long de la fente, les feux rouges des jambages (face avant), les boulons.
    ob.append(piece('joints', lambda bm: [boite(bm, (s * 1.13, sy * 0.1, 1.04), (0.02, 0.012, 1.86)) for s in (1, -1) for sy in (1, -1)], P['caoutchouc']))
    ob.append(piece('feux-jambages', lambda bm: [boite(bm, (s * 1.22, -0.258, 1.02), (0.04, 0.008, 1.5)) for s in (1, -1)], P['dangerDoux']))
    ob.append(piece('boulons', lambda bm: boulons(bm, [(s * x, -0.255, z) for s in (1, -1) for x in (1.18, 1.26) for z in (0.17, 1.87)], (0, -1, 0), 0.016, 0.012), P['acier']))
    # Le seuil : une gorge sombre et deux rails où courent les battants.
    ob.append(piece('seuil', lambda bm: boite(bm, (0, 0, 0.008), (2.26, 0.3, 0.016)), P['joint']))
    ob.append(piece('rails', lambda bm: [boite(bm, (0, sy * 0.1, 0.02), (2.24, 0.02, 0.012)) for sy in (1, -1)], P['alliage']))
    # Le linteau : un caisson chanfreiné, hachuré (jaune et noir) côté pilote, des cache-bouts boulonnés.
    ob.append(piece('linteau', lambda bm: extrude(bm, [(-0.26, 1.98), (0.26, 1.98), (0.26, 2.26), (0.22, 2.3), (-0.22, 2.3), (-0.26, 2.26)], -1.32, 1.32, 'X'), P['blindage'], biseau=0.015))
    ob.append(piece('glissiere', lambda bm: boite(bm, (0, 0, 1.976), (2.24, 0.2, 0.008)), P['joint']))
    ob += hachures(P, [((0, -0.261, 0), (1, 0, 0), (0, 0, 1), (0, -1, 0), -1.1, 1.1, 2.03, 2.225)], pas=0.13)
    ob.append(piece('liteaux', lambda bm: [boite(bm, (0, -0.265, z), (2.3, 0.012, 0.03)) for z in (2.008, 2.245)], P['acier']))
    ob.append(piece('cache-bouts', lambda bm: [boite(bm, (s * 1.2, -0.267, 2.127), (0.22, 0.016, 0.27)) for s in (1, -1)], P['acier'], biseau=0.005))
    ob.append(piece('boulons', lambda bm: boulons(bm, [(s * (1.2 + dx), -0.275, z) for s in (1, -1) for dx in (-0.07, 0.07) for z in (2.04, 2.215)], (0, -1, 0), 0.014, 0.01), P['blindage']))
    # Au dos du linteau : deux grilles à lames.
    ob.append(piece('grilles', lambda bm: [boite(bm, (s * 0.6, 0.263, 2.14), (0.72, 0.01, 0.2)) for s in (1, -1)], P['joint']))
    ob.append(piece('lames', lambda bm: [boite(bm, (s * (0.6 + 0.1 * k), 0.27, 2.14), (0.03, 0.012, 0.18)) for s in (1, -1) for k in range(-3, 4)], P['acier']))
    # Sur le linteau : les deux moteurs d'entraînement (un par battant), leurs berceaux, la boîte de dérivation, les câbles.
    ob.append(piece('moteurs', lambda bm: [tube(bm, (s * 0.36, 0.06, 2.4), (s * 0.86, 0.06, 2.4), 0.085, 12) for s in (1, -1)], P['acier']))
    ob.append(piece('flasques', lambda bm: [tube(bm, (s * x, 0.06, 2.4), (s * (x + 0.04), 0.06, 2.4), 0.1, 12) for s in (1, -1) for x in (0.33, 0.84)], P['blindage']))
    ob.append(piece('berceaux', lambda bm: [boite(bm, (s * 0.61, 0.06, 2.33), (0.42, 0.16, 0.06)) for s in (1, -1)], P['blindage']))
    ob.append(piece('derivation', lambda bm: boite(bm, (0, 0.1, 2.36), (0.26, 0.18, 0.12)), P['blindageClair'], biseau=0.01))
    ob.append(piece('cables', lambda bm: [tuyau(bm, [(s * 0.34, 0.1, 2.44), (s * 0.22, 0.13, 2.47), (s * 0.12, 0.12, 2.4)], 0.02, 6, 3) for s in (1, -1)], P['caoutchouc']))
    # Les gyrophares ambrés aux deux bouts du linteau.
    ob.append(piece('socles-feux', lambda bm: [tube(bm, (s * 1.17, 0, 2.3), (s * 1.17, 0, 2.33), 0.075, 12) for s in (1, -1)], P['blindage']))
    ob.append(piece('gyrophares', lambda bm: [revol(bm, dome(0.06, 0.105), 12, centre=(s * 1.17, 0, 2.33)) for s in (1, -1)], P['feuAmbre']))
    halos = [[s * 1.17, 2.4, 0.06, 0.32, 1, 0.6, 0.2, 0.6] for s in (1, -1)] + [[s * 1.22, 1.02, 0.3, 0.45, 1, 0.25, 0.2, 0.2] for s in (1, -1)]
    return ob, {'halos': halos}


def porte_battant(P):
    """Un battant (x de −0,56 à 0,56 ; son bord intérieur, qui rejoint l'autre, est en +x). Symétrique avant/arrière."""
    P = matieres_meca(P)
    ob = []
    # L'âme (0,12 m) et le cadre (0,18 m) : montants, traverses ; le montant intérieur porte le joint.
    ob.append(piece('ame', lambda bm: boite(bm, (0, 0, 1.0), (1.08, 0.12, 1.86)), P['battant']))

    def cadre(bm):
        boite(bm, (-0.505, 0, 1.0), (0.1, 0.18, 1.9))
        boite(bm, (0.495, 0, 1.0), (0.07, 0.18, 1.9))
        for z, h in ((0.1, 0.1), (0.38, 0.08), (1.02, 0.08), (1.905, 0.09)):
            boite(bm, (-0.005, 0, z), (0.93, 0.17, h))
    ob.append(piece('cadre', cadre, P['blindage'], biseau=0.008))
    # Les plaques de blindage des deux panneaux (des deux côtés), une écharpe en diagonale sur le panneau haut.
    ob.append(piece('blindages', lambda bm: [boite(bm, (-0.005, sy * 0.07, z), (0.86, 0.02, h)) for sy in (1, -1) for z, h in ((0.7, 0.5), (1.46, 0.74))], P['battant'], biseau=0.008))
    ob.append(piece('echarpes', lambda bm: [barre(bm, (-0.4, sy * 0.085, 1.12), (0.38, sy * 0.085, 1.8), 0.045) for sy in (1, -1)], P['blindage']))
    # Le bord intérieur : un boudin de caoutchouc, une bande rouge lumineuse de chaque côté.
    ob.append(piece('boudin', lambda bm: boite(bm, (0.545, 0, 1.0), (0.03, 0.15, 1.86)), P['caoutchouc']))
    ob.append(piece('feux', lambda bm: [boite(bm, (0.495, sy * 0.092, 1.0), (0.03, 0.006, 1.5)) for sy in (1, -1)], P['dangerFort']))

    # Trois chevrons jaunes « > » qui montrent le sens de fermeture (vers le bord intérieur).
    def chevrons(bm):
        for sy in (1, -1):
            for k in range(3):
                x = -0.26 + k * 0.2
                for s in (1, -1):
                    boite(bm, (x, sy * 0.082, 0.7 + s * 0.065), (0.04, 0.006, 0.17), Matrix.Rotation(-s * 0.72, 3, 'Y'))
    ob.append(piece('chevrons', chevrons, P['hachureJaune']))
    # Le bas de caisse hachuré, les patins de suspension (ils courent dans la glissière du linteau), des boulons.
    ob += hachures(P, [((0, sy * 0.06, 0), (1, 0, 0), (0, 0, 1), (0, sy, 0), -0.455, 0.46, 0.15, 0.34) for sy in (1, -1)], pas=0.09)
    ob.append(piece('patins', lambda bm: [boite(bm, (x, 0, 1.97), (0.12, 0.08, 0.05)) for x in (-0.36, 0.36)], P['acier']))
    ob.append(piece('boulons', lambda bm: [boulons(bm, [(x, sy * 0.085, z) for x in (-0.3, 0.0, 0.3) for z in (0.1, 1.905)], (0, sy, 0), 0.014, 0.01) for sy in (1, -1)], P['acier']))
    return ob, {}


# ===========================================================================
# LE ROTOR : un moyeu (socle octogonal, carter à ailettes, arbre, palier, gyrophare) ; la tête, en y = 1,0, porte
# trois pales. Chaque pale apporte un tiers de la bague tournante.
# ===========================================================================
def rotor_moyeu(P):
    P = matieres_meca(P)
    ob = []
    o8 = PI / 8
    ob.append(piece('socle', lambda bm: revol(bm, [(0, 0.0), (0.5, 0.0), (0.53, 0.05), (0.53, 0.2), (0.45, 0.28), (0, 0.28)], 8, a0=o8), P['blindage']))
    # Les hachures jaunes sur les huit pans du socle (le fond sombre fait le noir).
    faces = []
    for k in range(8):
        a, b = o8 + k * PI / 4, o8 + (k + 1) * PI / 4
        va, vb = Vector((0.53 * math.cos(a), 0.53 * math.sin(a), 0)), Vector((0.53 * math.cos(b), 0.53 * math.sin(b), 0))
        m = (a + b) / 2
        nn = Vector((math.cos(m), math.sin(m), 0))
        L = (vb - va).length
        faces.append((va + nn * 0.001, (vb - va) / L, (0, 0, 1), nn, 0.02, L - 0.02, 0.07, 0.18))
    ob += hachures(P, faces, pas=0.065, couleurs=('hachureJaune', None))
    # Le carter du moteur, ses ailettes et ses goussets.
    ob.append(piece('carter', lambda bm: revol(bm, [(0, 0.28), (0.39, 0.28), (0.39, 0.35), (0.31, 0.37), (0.31, 0.79), (0.35, 0.81), (0.35, 0.87), (0, 0.87)], 16), P['blindageClair']))
    ob.append(piece('ailettes', lambda bm: [boite(bm, (0.36 * math.cos(o8 + k * PI / 4), 0.36 * math.sin(o8 + k * PI / 4), 0.58), (0.1, 0.022, 0.4), Matrix.Rotation(o8 + k * PI / 4, 3, 'Z')) for k in range(8)], P['acier']))

    def goussets(bm):
        for k in range(4):
            rot_z(bm, extrude(bm, [(0.3, 0.28), (0.47, 0.28), (0.3, 0.62)], -0.015, 0.015, 'Y'), k * PI / 2)
    ob.append(piece('goussets', goussets, P['blindage']))
    ob.append(piece('boulons', lambda bm: boulons(bm, [(0.43 * math.cos(o8 + k * PI / 4), 0.43 * math.sin(o8 + k * PI / 4), 0.28) for k in range(8)], (0, 0, 1), 0.02, 0.02), P['acier']))
    ob.append(piece('plaque', lambda bm: boite(bm, (0, -0.312, 0.7), (0.14, 0.012, 0.09)), P['hachureJaune']))
    c45 = (math.cos(PI / 4), math.sin(PI / 4))
    ob.append(piece('cable', lambda bm: tuyau(bm, [(r * c45[0], r * c45[1], z) for r, z in ((0.47, 0.23), (0.52, 0.34), (0.44, 0.5), (0.33, 0.6))], 0.025, 8, 3), P['caoutchouc']))
    # L'arbre (fixe ; la bague des pales tourne autour, de y = 0,88 à 1,12), le palier haut, le gyrophare dans sa cage.
    ob.append(piece('arbre', lambda bm: tube(bm, (0, 0, 0.86), (0, 0, 1.16), 0.26, 16), P['alliage']))
    ob.append(piece('palier', lambda bm: revol(bm, [(0, 1.13), (0.345, 1.13), (0.345, 1.2), (0.3, 1.3), (0.25, 1.44), (0, 1.44)], 16), P['acier']))
    ob.append(piece('socle-feu', lambda bm: tube(bm, (0, 0, 1.43), (0, 0, 1.47), 0.29, 16), P['blindage']))
    ob.append(piece('gyrophare', lambda bm: revol(bm, [(0.26, 0), (0.26, 0.09), (0.2, 0.15), (0.1, 0.18), (0, 0.185)], 16, centre=(0, 0, 1.47)), P['dangerFort']))

    def cage(bm):
        for k in range(4):
            c, s = math.cos(PI / 4 + k * PI / 2), math.sin(PI / 4 + k * PI / 2)
            tuyau(bm, [(0.285 * c, 0.285 * s, 1.46), (0.285 * c, 0.285 * s, 1.58), (0.15 * c, 0.15 * s, 1.68), (0.0, 0.0, 1.7)], 0.012, 6, 1)
    ob.append(piece('cage', cage, P['acier']))
    return ob, {'halos': [[0, 1.56, 0.26, 0.6, 1, 0.25, 0.2, 0.8]]}


def rotor_pale(P):
    """Une pale le long de +x, autour de la tête (origine) ; elle tourne vers −z du jeu : bord d'attaque en +Y Blender."""
    P = matieres_meca(P)
    ob = []
    A = math.radians(58)
    # Un tiers de la bague tournante (de −58° à 58° : trois pales, trois segments), son jonc, la pince.
    ob.append(piece('bague', lambda bm: revol(bm, [(0.3, -0.12), (0.47, -0.12), (0.47, 0.12), (0.3, 0.12)], 8, a0=-A, a1=A, ferme=True), P['acier']))
    ob.append(piece('jonc', lambda bm: revol(bm, [(0.47, -0.035), (0.495, -0.035), (0.495, 0.035), (0.47, 0.035)], 8, a0=-A, a1=A, ferme=True), P['blindage']))
    ob.append(piece('pince', lambda bm: boite(bm, (0.53, 0, 0), (0.14, 0.38, 0.22)), P['blindageClair'], biseau=0.012))
    ob.append(piece('boulons', lambda bm: boulons(bm, [(0.53, y, 0.11) for y in (-0.1, 0.1)], (0, 0, 1), 0.02, 0.015), P['acier']))

    # La pale : un caisson profilé qui s'affine vers le bout (pointe vers l'avant, dos plat qui porte un feu).
    def section(x, c, t):
        return [(x, c / 2, 0.0), (x, c / 2 - 0.07, t / 2), (x, -c / 2, t * 0.45), (x, -c / 2, -t * 0.45), (x, c / 2 - 0.07, -t / 2)]
    ob.append(piece('pale', lambda bm: loft(bm, [section(0.58, 0.36, 0.18), section(1.3, 0.32, 0.15), section(2.48, 0.27, 0.12)]), P['acier']))

    def bande(bm):
        secs = []
        for x, c in ((0.64, 0.3572), (1.3, 0.32), (2.4, 0.2734)):
            y = -c / 2
            secs.append([(x, y + 0.002, -0.03), (x, y - 0.005, -0.03), (x, y - 0.005, 0.03), (x, y + 0.002, 0.03)])
        loft(bm, secs)
    ob.append(piece('feu-pale', bande, P['dangerFort']))

    def epine(bm):
        secs = []
        for x, t in ((0.62, 0.178), (1.3, 0.15), (2.42, 0.1215)):
            z = 0.475 * t - 0.004
            secs.append([(x, -0.07, z), (x, -0.01, z), (x, -0.01, z + 0.018), (x, -0.07, z + 0.018)])
        loft(bm, secs)
    ob.append(piece('epine', epine, P['blindage']))
    # La masse de bout : un bloc sombre, des feux rouges (bout et flancs), des hachures sur le dessus.
    ob.append(piece('masse', lambda bm: boite(bm, (2.6, 0, 0), (0.28, 0.32, 0.2)), P['blindage'], biseau=0.015))
    ob.append(piece('feux-bout', lambda bm: [boite(bm, (2.742, 0, 0), (0.008, 0.22, 0.07))] + [boite(bm, (2.6, sy * 0.162, 0), (0.2, 0.006, 0.05)) for sy in (1, -1)], P['dangerFort']))
    ob += hachures(P, [((0, 0, 0.1005), (1, 0, 0), (0, 1, 0), (0, 0, 1), 2.49, 2.71, -0.135, 0.135)], pas=0.055)
    return ob, {}


# ===========================================================================
# LA TURBINE DE SOUFFLERIE : un carénage (une tuyère à lèvre d'entrée, anneau lumineux), un berceau sur une tour
# en treillis, une nacelle-moteur et son stator, une grille arrière. Centre du carénage en y = 2,6 ; axe z.
# ===========================================================================
def turbine_cadre(P):
    P = matieres_meca(P)
    ob = []
    C = (0, 0, 2.6)
    # Le carénage : la section de la paroi (rayon, position sur l'axe ; l'entrée, vers le pilote, en −Y Blender).
    coque = [(2.06, -0.52), (2.06, 0.5), (2.1, 0.56), (2.5, 0.56), (2.56, 0.5), (2.56, -0.1), (2.66, -0.16), (2.68, -0.5),
             (2.62, -0.68), (2.5, -0.765), (2.26, -0.78), (2.16, -0.745), (2.09, -0.66)]
    ob.append(piece('carenage', lambda bm: revol(bm, coque, 48, centre=C, axe='Y', ferme=True), P['metalMoyen']))
    # L'anneau lumineux de la lèvre (couleur du monde) et un liseré dans la gorge d'entrée.
    ob.append(piece('anneau', lambda bm: [revol(bm, [(2.29, -0.787), (2.46, -0.787)], 48, centre=C, axe='Y', couvercles=False), revol(bm, [(2.055, -0.42), (2.055, -0.36)], 48, centre=C, axe='Y', couvercles=False)], P['accentDoux']))

    # Les nervures de la ceinture (sauf en bas, sur le berceau).
    def nervures(bm):
        for k in range(12):
            a = k * PI / 6
            if 50 < math.degrees(a) < 130:
                continue
            boite(bm, (2.64 * math.cos(a), 0.2, 2.6 - 2.64 * math.sin(a)), (0.2, 0.64, 0.09), Matrix.Rotation(a, 3, 'Y'))
    ob.append(piece('nervures', nervures, P['blindage']))
    # Le berceau : un secteur d'anneau sous le carénage, deux paires de jambes de force vers la tour.
    ob.append(piece('berceau', lambda bm: revol(bm, [(2.56, -0.26), (2.86, -0.26), (2.86, 0.46), (2.56, 0.46)], 10, centre=C, axe='Y', a0=math.radians(48), a1=math.radians(132), ferme=True), P['blindage'], biseau=0.02))
    ob.append(piece('jambes', lambda bm: [barre(bm, (s * 0.59, y, -1.5), (s * 1.8, y, 0.5), 0.12) for s in (1, -1) for y in (-0.16, 0.36)], P['blindage']))
    ob.append(piece('plateau', lambda bm: boite(bm, (0, 0.1, -0.3), (1.3, 1.1, 0.12)), P['blindage'], biseau=0.02))
    # La tour en treillis (le langage du portique), le socle hachuré, les platines boulonnées, les câbles.
    ob.append(piece('tour', lambda bm: treillis(bm, [(-0.75, -0.75, -3.2), (0.75, -0.75, -3.2), (0.75, 0.75, -3.2), (-0.75, 0.75, -3.2)], [(-0.48, -0.48, -0.36), (0.48, -0.48, -0.36), (0.48, 0.48, -0.36), (-0.48, 0.48, -0.36)], 5, 0.13, 0.055), P['blindageClair']))
    ob.append(piece('socle', lambda bm: boite(bm, (0, 0, -3.4), (2.4, 2.4, 0.4)), P['blindage'], biseau=0.05))
    ob += hachures(P, [((0, sy * 1.201, 0), (1, 0, 0), (0, 0, 1), (0, sy, 0), -1.1, 1.1, -3.55, -3.25) for sy in (1, -1)], pas=0.15, couleurs=('hachureJaune', None))
    ob.append(piece('platines', lambda bm: [boite(bm, (sx * 0.75, sy * 0.75, -3.17), (0.34, 0.34, 0.06)) for sx in (1, -1) for sy in (1, -1)], P['acier']))
    ob.append(piece('boulons', lambda bm: boulons(bm, [(sx * (0.75 + d), sy * (0.75 + d), -3.14) for sx in (1, -1) for sy in (1, -1) for d in (-0.12, 0.12)], (0, 0, 1), 0.03, 0.03), P['acier']))
    ob.append(piece('cables', lambda bm: [tube(bm, (dx, dy, -3.2), (dx, dy, -0.36), 0.04, 8) for dx, dy in ((0.08, 0.0), (-0.06, 0.07), (-0.05, -0.08))], P['caoutchouc']))
    # La nacelle-moteur derrière le rotor, sa bague de refroidissement, le stator (quatre bras), la grille arrière.
    ob.append(piece('nacelle', lambda bm: revol(bm, [(0, 0.2), (0.4, 0.2), (0.5, 0.3), (0.52, 0.85), (0.45, 1.1), (0.28, 1.3), (0.1, 1.38), (0, 1.39)], 20, centre=C, axe='Y'), P['blindageClair']))
    ob.append(piece('bague', lambda bm: revol(bm, [(0.52, 0.55), (0.565, 0.55), (0.565, 0.66), (0.52, 0.66)], 20, centre=C, axe='Y', ferme=True), P['acier']))
    ob.append(piece('stator', lambda bm: [boite(bm, (1.28 * math.cos(a), 0.42, 2.6 - 1.28 * math.sin(a)), (1.6, 0.24, 0.07), Matrix.Rotation(a, 3, 'Y')) for a in (PI / 4 + k * PI / 2 for k in range(4))], P['blindage']))

    def grille(bm):
        for R in (1.05, 1.6):
            revol(bm, [(R + 0.022 * math.cos(b), 0.6 + 0.022 * math.sin(b)) for b in (0, PI / 2, PI, 3 * PI / 2)], 40, centre=C, axe='Y', ferme=True)
        for k in range(12):
            a = k * PI / 6 + PI / 12
            barre(bm, (0.5 * math.cos(a), 0.6, 2.6 - 0.5 * math.sin(a)), (2.2 * math.cos(a), 0.58, 2.6 - 2.2 * math.sin(a)), 0.03)
    ob.append(piece('grille', grille, P['acier']))
    # Les feux : un feu à éclats au sommet, deux feux rouges fixes sur les flancs (avec leurs halos).
    ob.append(piece('socle-feu', lambda bm: boite(bm, (0, 0.1, 5.17), (0.24, 0.3, 0.05)), P['acier']))
    ob.append(piece('feu-haut', lambda bm: revol(bm, dome(0.08, 0.115), 12, centre=(0, 0.1, 5.195)), P['feuRouge']))
    ob.append(piece('boitiers', lambda bm: [boite(bm, (s * 2.7, -0.3, 2.6), (0.07, 0.2, 0.2)) for s in (1, -1)], P['acier']))
    ob.append(piece('feux', lambda bm: [boite(bm, (s * 2.737, -0.3, 2.6), (0.012, 0.14, 0.14)) for s in (1, -1)], P['dangerFort']))
    return ob, {'halos': [[s * 2.75, 2.6, 0.32, 0.4, 1, 0.3, 0.22, 0.55] for s in (1, -1)]}


def turbine_rotor(P):
    """Le rotor (autour de son centre ; axe : Y Blender = z du jeu) : six pales vrillées, bouts jaunes, cône."""
    P = matieres_meca(P)
    ob = []

    # Une section de pale au rayon r : corde c, épaisseur t, calage b (bord d'attaque vers +Z et vers l'entrée).
    def section(r, c, t, b):
        pts = [(c / 2, 0), (c * 0.25, t / 2), (-c * 0.3, t * 0.3), (-c / 2, 0), (-c * 0.3, -t * 0.25), (c * 0.25, -t / 2)]
        return [(r, -u * math.sin(b) + v * math.cos(b), u * math.cos(b) + v * math.sin(b)) for u, v in pts]

    def pales(bm, sections):
        for k in range(6):
            bmesh.ops.transform(bm, matrix=Matrix.Rotation(k * PI / 3, 4, 'Y'), verts=loft(bm, [section(*s) for s in sections]))
    ob.append(piece('pales', lambda bm: pales(bm, [(0.4, 0.5, 0.07, 0.78), (0.9, 0.46, 0.05, 0.54), (1.45, 0.39, 0.036, 0.38), (1.8, 0.33, 0.03, 0.31)]), P['alliage']))
    ob.append(piece('bouts', lambda bm: pales(bm, [(1.8, 0.33, 0.03, 0.31), (1.98, 0.29, 0.026, 0.27)]), P['jaune']))

    def manchons(bm):
        for k in range(6):
            r = tube(bm, (0.34, 0, 0), (0.5, 0, 0), 0.075, 10)
            bmesh.ops.transform(bm, matrix=Matrix.Rotation(k * PI / 3, 4, 'Y'), verts=r['verts'])
    ob.append(piece('manchons', manchons, P['acier']))
    # Le cône : une pointe polie, un corps sombre, une bague lumineuse (seconde couleur du monde).
    ob.append(piece('pointe', lambda bm: revol(bm, [(0, -0.8), (0.05, -0.75), (0.11, -0.66), (0.17, -0.555), (0, -0.555)], 24, axe='Y'), P['alliage']))
    ob.append(piece('cone', lambda bm: revol(bm, [(0.17, -0.555), (0.22, -0.5), (0.33, -0.33), (0.4, -0.12), (0.41, 0.02), (0.41, 0.16), (0.32, 0.2), (0, 0.2)], 24, axe='Y'), P['graphite']))
    ob.append(piece('bague', lambda bm: revol(bm, [(0.416, -0.03), (0.416, 0.05)], 24, axe='Y', couvercles=False), P['accent2']))
    return ob, {}


# ===========================================================================
# LE RADAR : une tour tubulaire (socle à goussets, échelle à crinoline, cabine, passerelle à garde-corps), une
# couronne d'orientation dentée ; l'antenne (pivot en y = 3,9) : plateau tournant, fourche, parabole pleine.
# ===========================================================================
def radar_tour(P):
    P = matieres_meca(P)
    ob = []

    def r(z):  # le rayon du mât à la hauteur z (il s'affine en montant)
        return 0.62 + (0.47 - 0.62) * (z + 3.1) / 6.12
    ob.append(piece('socle', lambda bm: boite(bm, (0, 0, -3.36), (1.9, 1.9, 0.28)), P['blindage'], biseau=0.04))
    ob.append(piece('embase', lambda bm: boite(bm, (0, 0, -3.16), (1.3, 1.3, 0.12)), P['acier'], biseau=0.02))
    ob.append(piece('goussets', lambda bm: [rot_z(bm, extrude(bm, [(0.56, -3.1), (1.0, -3.1), (0.56, -2.45)], -0.02, 0.02, 'Y'), k * PI / 4) for k in range(8)], P['blindage']))
    ob.append(piece('tiges', lambda bm: boulons(bm, [(sx * 0.8, sy * 0.8, -3.22) for sx in (1, -1) for sy in (1, -1)], (0, 0, 1), 0.045, 0.07), P['acier']))
    ob.append(piece('mat', lambda bm: revol(bm, [(0, -3.1), (0.62, -3.1), (0.47, 3.02), (0, 3.02)], 16), P['metalMoyen']))
    # Le pied du mât cerclé de jaune et de noir, deux brides boulonnées.
    for i, c in enumerate(('jaune', 'hachureNoire')):
        ob.append(piece('cerclage', lambda bm, i=i: [revol(bm, [(r(z) + 0.006, z), (r(z + 0.15) + 0.006, z + 0.15)], 16, couvercles=False) for z in (-3.05 + 0.15 * k for k in range(i, 6, 2))], P[c]))
    ob.append(piece('brides', lambda bm: [revol(bm, [(r(z), z - 0.05), (r(z) + 0.07, z - 0.05), (r(z) + 0.07, z + 0.05), (r(z), z + 0.05)], 16, ferme=True) for z in (-1.2, 0.9)], P['acier']))
    # La cabine technique (côté piste, −x) : fenêtre éclairée, porte, climatiseur, consoles de fixation.
    ob.append(piece('cabine', lambda bm: boite(bm, (-0.95, 0, 0.85), (0.8, 1.2, 1.3)), P['blindageClair'], biseau=0.03))
    ob.append(piece('toit', lambda bm: boite(bm, (-0.95, 0, 1.53), (0.92, 1.32, 0.06)), P['blindage'], biseau=0.01))
    ob.append(piece('fenetre', lambda bm: boite(bm, (-1.353, 0, 1.02), (0.012, 0.7, 0.32)), P['fenetre']))
    ob.append(piece('chambranle', lambda bm: [boite(bm, (-1.356, 0, 1.02 + dz), (0.014, 0.76, 0.03)) for dz in (-0.175, 0.175)] + [boite(bm, (-1.356, dy, 1.02), (0.014, 0.03, 0.35)) for dy in (-0.365, 0, 0.365)], P['acier']))
    ob.append(piece('porte', lambda bm: boite(bm, (-0.95, -0.603, 0.68), (0.4, 0.012, 0.9)), P['blindage']))
    ob.append(piece('clim', lambda bm: boite(bm, (-0.95, 0.66, 0.6), (0.5, 0.12, 0.42)), P['acier'], biseau=0.01))
    ob.append(piece('ventilateur', lambda bm: revol(bm, [(0, 0.0), (0.15, 0.0)], 12, centre=(-0.95, 0.721, 0.6), axe='Y', couvercles=False), P['joint']))
    ob.append(piece('consoles', lambda bm: [barre(bm, (-0.5, sy * 0.4, -0.3), (-1.25, sy * 0.4, 0.22), 0.08) for sy in (1, -1)], P['blindage']))

    # L'échelle (côté +x), sa crinoline.
    def echelle(bm):
        x = 0.8
        for sy in (1, -1):
            barre(bm, (x, sy * 0.19, -3.0), (x, sy * 0.19, 2.92), 0.04)
            for z in (-2.2, -0.2, 1.8):
                barre(bm, (r(z) - 0.03, sy * 0.19, z), (x, sy * 0.19, z), 0.03)
        z = -2.8
        while z < 2.9:
            barre(bm, (x, -0.19, z), (x, 0.19, z), 0.025)
            z += 0.35
    ob.append(piece('echelle', echelle, P['acier']))

    def crinoline(bm):
        a = math.radians(146)
        for z in (-0.6, 0.5, 1.6, 2.7):
            revol(bm, [(0.34 + 0.016 * math.cos(b), z + 0.016 * math.sin(b)) for b in (0, PI / 2, PI, 3 * PI / 2)], 10, centre=(1.08, 0, 0), a0=-a, a1=a, ferme=True)
        for d in (-100, -50, 0, 50, 100):
            d = math.radians(d)
            barre(bm, (1.08 + 0.34 * math.cos(d), 0.34 * math.sin(d), -0.6), (1.08 + 0.34 * math.cos(d), 0.34 * math.sin(d), 2.7), 0.022)
    ob.append(piece('crinoline', crinoline, P['acier']))
    ob.append(piece('gaine', lambda bm: tube(bm, (0.12, -0.67, -3.0), (0.12, -0.52, 2.88), 0.045, 8), P['caoutchouc']))
    # La passerelle annulaire, son garde-corps jaune, ses consoles.
    ob.append(piece('passerelle', lambda bm: revol(bm, [(0.46, 2.9), (1.32, 2.9), (1.32, 2.97), (0.46, 2.97)], 20, ferme=True), P['blindage']))

    def garde(bm):
        for z in (3.45, 3.95):
            revol(bm, [(1.28 + 0.022 * math.cos(b), z + 0.022 * math.sin(b)) for b in (0, PI / 2, PI, 3 * PI / 2)], 24, ferme=True)
        for k in range(8):
            a = k * PI / 4 + PI / 8
            barre(bm, (1.28 * math.cos(a), 1.28 * math.sin(a), 2.97), (1.28 * math.cos(a), 1.28 * math.sin(a), 3.95), 0.035)
    ob.append(piece('garde-corps', garde, P['jaune']))
    ob.append(piece('plinthe', lambda bm: revol(bm, [(1.31, 2.97), (1.31, 3.08)], 20, couvercles=False), P['blindage']))
    ob.append(piece('consoles', lambda bm: [barre(bm, (0.5 * math.cos(k * PI / 4), 0.5 * math.sin(k * PI / 4), 2.35), (1.2 * math.cos(k * PI / 4), 1.2 * math.sin(k * PI / 4), 2.9), 0.06) for k in range(8)], P['blindageClair']))
    # Le tambour du sommet, la couronne d'orientation dentée, son moteur à pignon, la platine de l'antenne.
    ob.append(piece('tambour', lambda bm: revol(bm, [(0.47, 3.0), (0.6, 3.16), (0.72, 3.24), (0.72, 3.66), (0.64, 3.72), (0, 3.72)], 20), P['metalMoyen']))
    ob.append(piece('couronne', lambda bm: revol(bm, [(0.58, 3.72), (0.8, 3.72), (0.8, 3.84), (0.58, 3.84)], 24, ferme=True), P['acier']))
    ob.append(piece('dents', lambda bm: [boite(bm, (0.82 * math.cos(a), 0.82 * math.sin(a), 3.78), (0.05, 0.045, 0.1), Matrix.Rotation(a, 3, 'Z')) for a in (k * 2 * PI / 30 for k in range(30))], P['acier']))
    ob.append(piece('moteur', lambda bm: [tube(bm, (0.98, 0, 3.4), (0.98, 0, 3.72), 0.1, 12), boite(bm, (0.86, 0, 3.45), (0.3, 0.2, 0.1))], P['blindageClair']))
    ob.append(piece('pignon', lambda bm: tube(bm, (0.98, 0, 3.73), (0.98, 0, 3.83), 0.13, 12), P['alliage']))
    ob.append(piece('platine', lambda bm: tube(bm, (0, 0, 3.84), (0, 0, 3.9), 0.56, 20), P['blindage']))
    # Quatre feux rouges fixes sur la lisse haute (avec leurs halos).
    coins = [(1.28 * math.cos(a), 1.28 * math.sin(a)) for a in (PI / 4 + k * PI / 2 for k in range(4))]
    ob.append(piece('socles-feux', lambda bm: [tube(bm, (x, y, 3.96), (x, y, 3.99), 0.05, 10) for x, y in coins], P['blindage']))
    ob.append(piece('feux', lambda bm: [revol(bm, dome(0.045, 0.07), 10, centre=(x, y, 3.99)) for x, y in coins], P['dangerFort']))
    return ob, {'halos': [[x, 4.03, -y, 0.3, 1, 0.25, 0.2, 0.55] for x, y in coins]}


def radar_antenne(P):
    """L'antenne, autour de son pivot (origine ; elle tourne autour de Z Blender = y du jeu)."""
    P = matieres_meca(P)
    ob = []
    T = 0.35                                   # la parabole regarde vers le haut
    E = Vector((0, 0, 2.15))                   # le fond de la parabole
    R = Matrix.Rotation(PI / 2 - T, 3, 'X')    # son axe local Z → (0, −cos T, sin T)
    M = Matrix.Translation(E) @ R.to_4x4()
    d = R @ Vector((0, 0, 1))
    u = R @ Vector((0, 1, 0))
    k, RA = 0.105, 1.95
    rayons = (0, 0.35, 0.7, 1.05, 1.4, 1.7, RA)
    # Le plateau tournant, le piédestal, la fourche et ses tourillons.
    ob.append(piece('plateau', lambda bm: revol(bm, [(0, 0), (0.74, 0), (0.74, 0.16), (0.66, 0.24), (0, 0.24)], 24), P['metalMoyen']))
    ob.append(piece('piedestal', lambda bm: boite(bm, (0, 0, 0.42), (1.4, 0.62, 0.36)), P['blindage'], biseau=0.03))
    H = E - 0.3 * d                            # l'axe de site (horizontal, le long de x)
    ob.append(piece('fourche', lambda bm: [loft(bm, [[(x, y, 0.4) for x, y in rect_ch(0.14, 0.42, 0.03, cx=s * 0.6)], [(x, y, H.z + 0.15) for x, y in rect_ch(0.14, 0.32, 0.03, cx=s * 0.6, cy=H.y)]]) for s in (1, -1)], P['blindageClair']))
    ob.append(piece('axe', lambda bm: tube(bm, H + Vector((-0.66, 0, 0)), H + Vector((0.66, 0, 0)), 0.09, 12), P['alliage']))
    ob.append(piece('tourillons', lambda bm: [tube(bm, H + Vector((s * 0.67, 0, 0)), H + Vector((s * 0.73, 0, 0)), 0.15, 14) for s in (1, -1)], P['acier']))
    # Le vérin de site : du piédestal à un levier sous le moyeu.
    L = H - 0.36 * u
    ob.append(piece('levier', lambda bm: barre(bm, H, L, 0.09), P['blindage']))
    A0 = Vector((0, 0.26, 0.6))
    ob.append(piece('verin', lambda bm: tube(bm, A0, A0 + (L - A0) * 0.58, 0.065, 10), P['acier']))
    ob.append(piece('tige', lambda bm: tube(bm, A0 + (L - A0) * 0.55, L, 0.032, 8), P['alliage']))
    # La parabole : face claire, dos sombre, lèvre, deux joints de panneaux, huit nervures au dos.
    ob.append(piece('parabole', lambda bm: revol(bm, [(r, k * r * r) for r in rayons], 28, centre=E, rot=R, couvercles=False), P['gris']))
    ob.append(piece('dos', lambda bm: revol(bm, [(r, k * r * r - 0.06) for r in rayons], 28, centre=E, rot=R, couvercles=False), P['blindage']))
    b = k * RA * RA
    ob.append(piece('levre', lambda bm: revol(bm, [(RA, b), (RA + 0.05, b + 0.005), (RA + 0.05, b - 0.07), (RA, b - 0.06)], 28, centre=E, rot=R, couvercles=False), P['acier']))
    # Les joints des panneaux du réflecteur : huit rayons (le long de la parabole) et deux cercles.
    def rayons_joints(bm):
        for i in range(8):
            a = i * PI / 4 + PI / 8
            c, s, tc, ts = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)
            secs = []
            for rr in (0.42, 0.9, 1.4, 1.93):
                z = k * rr * rr
                secs.append([M @ Vector((rr * c + w * tc, rr * s + w * ts, z + dz)) for w, dz in ((-0.014, 0.001), (0.014, 0.001), (0.014, 0.007), (-0.014, 0.007))])
            loft(bm, secs)
    ob.append(piece('joints', rayons_joints, P['joint']))
    ob.append(piece('joints', lambda bm: [revol(bm, [(rr - 0.018, k * (rr - 0.018) ** 2 + 0.004), (rr + 0.018, k * (rr + 0.018) ** 2 + 0.004)], 28, centre=E, rot=R, couvercles=False) for rr in (0.8, 1.45)], P['joint']))

    def nervures(bm):
        for i in range(8):
            a = i * PI / 4
            pts = [M @ Vector((rr * math.cos(a), rr * math.sin(a), k * rr * rr - 0.1)) for rr in (0.32, 1.1, 1.9)]
            barre(bm, pts[0], pts[1], 0.06)
            barre(bm, pts[1], pts[2], 0.06)
    ob.append(piece('nervures', nervures, P['blindageClair']))
    # Le moyeu (il traverse l'axe de site), le contrepoids derrière.
    ob.append(piece('moyeu', lambda bm: revol(bm, [(0, -0.62), (0.3, -0.62), (0.3, -0.1), (0.4, -0.1), (0.4, -0.03), (0, -0.03)], 16, centre=E, rot=R), P['blindageClair']))
    ob.append(piece('contrepoids', lambda bm: boite(bm, E - 0.74 * d, (0.9, 0.5, 0.3), R), P['blindage'], biseau=0.02))
    # La source : une perche, un trépied, la tête (contre-réflecteur) et son anneau lumineux (couleur du monde).
    ob.append(piece('perche', lambda bm: revol(bm, [(0, 0.0), (0.065, 0.0), (0.05, 0.86), (0, 0.86)], 10, centre=E, rot=R), P['acier']))
    ob.append(piece('trepied', lambda bm: [barre(bm, M @ Vector((1.85 * math.cos(a), 1.85 * math.sin(a), k * 1.85 ** 2 + 0.01)), M @ Vector((0.12 * math.cos(a), 0.12 * math.sin(a), 0.97)), 0.028) for a in (PI / 2, PI / 2 + 2 * PI / 3, PI / 2 + 4 * PI / 3)], P['acier']))
    ob.append(piece('source', lambda bm: revol(bm, [(0, 0.84), (0.11, 0.84), (0.13, 0.9), (0.13, 1.0), (0.22, 1.03), (0.22, 1.06), (0, 1.06)], 14, centre=E, rot=R), P['acier']))
    ob.append(piece('oeil', lambda bm: revol(bm, [(0.134, 0.915), (0.134, 0.985)], 14, centre=E, rot=R, couvercles=False), P['accent']))
    return ob, {}


# ===========================================================================
# LA PRESSE : un banc, deux colonnes à glissières (rideaux de sécurité rouges), une enclume hachurée, une
# traverse et son vérin hydraulique (tirants, flexibles, groupe de pompage, accumulateur). La tête monte et
# descend : son centre va de y = 0,15 (en bas, 0,12 m au-dessus de l'enclume) à 3,55.
# ===========================================================================
def presse_cadre(P):
    P = matieres_meca(P)
    ob = []
    ob.append(piece('banc', lambda bm: boite(bm, (0, 0, -1.53), (4.1, 1.6, 0.24)), P['blindage'], biseau=0.04))
    ob.append(piece('tiges', lambda bm: boulons(bm, [(sx * x, sy * 0.66, -1.41) for sx in (1, -1) for sy in (1, -1) for x in (1.2, 1.88)], (0, 0, 1), 0.04, 0.05), P['acier']))
    # Les colonnes : peintes en jaune devant et derrière, hachurées en bas ; nervures, glissières, rideaux lumineux.
    ob.append(piece('colonnes', lambda bm: [extrude(bm, rect_ch(0.5, 0.7, 0.06, cx=s * 1.5), -1.41, 4.6, 'Z') for s in (1, -1)], P['blindage']))
    ob.append(piece('peinture', lambda bm: [boite(bm, (s * 1.5, sy * 0.353, 1.99), (0.3, 0.008, 4.88)) for s in (1, -1) for sy in (1, -1)], P['jaune']))
    ob += hachures(P, [((0, sy * 0.351, 0), (1, 0, 0), (0, 0, 1), (0, sy, 0), s * 1.5 - 0.19, s * 1.5 + 0.19, -1.38, -0.52) for s in (1, -1) for sy in (1, -1)], pas=0.1, couleurs=('hachureJaune', None))
    ob.append(piece('nervures', lambda bm: [boite(bm, (s * 1.775, 0, z), (0.05, 0.6, 0.06)) for s in (1, -1) for z in (-0.3, 0.9, 2.1, 3.3)], P['acier']))
    ob.append(piece('glissieres', lambda bm: [boite(bm, (s * 1.237, 0, 1.6), (0.026, 0.24, 5.9)) for s in (1, -1)], P['alliage']))
    ob.append(piece('rideaux', lambda bm: [boite(bm, (s * 1.236, sy * 0.26, 1.6), (0.028, 0.04, 4.2)) for s in (1, -1) for sy in (1, -1)], P['dangerDoux']))
    ob.append(piece('goussets', lambda bm: [prisme(bm, [(s * 1.75, -1.41), (s * 2.02, -1.41), (s * 1.75, -0.9)], sy * 0.2 - 0.02, sy * 0.2 + 0.02) for s in (1, -1) for sy in (1, -1)], P['blindageClair']))
    ob.append(piece('gaines', lambda bm: [tube(bm, (-1.8, y, -1.41), (-1.8, y, 4.55), 0.045, 8) for y in (0.14, 0.24)], P['caoutchouc']))
    # L'enclume : un bloc d'acier hachuré, sa table d'usure à rainures en T.
    ob.append(piece('enclume', lambda bm: boite(bm, (0, 0, -1.02), (2.2, 1.2, 0.76)), P['acier'], biseau=0.04))
    ob.append(piece('table', lambda bm: boite(bm, (0, 0, -0.62), (2.0, 1.0, 0.04)), P['alliage']))
    ob.append(piece('rainures', lambda bm: [boite(bm, (0, y, -0.599), (1.9, 0.05, 0.004)) for y in (-0.28, 0, 0.28)], P['joint']))
    ob += hachures(P, [((0, sy * 0.601, 0), (1, 0, 0), (0, 0, 1), (0, sy, 0), -1.02, 1.02, -1.33, -0.72) for sy in (1, -1)], pas=0.14)
    # La traverse : peinte, nervurée, hachurée en bas ; des projecteurs dessous (ils éclairent l'enclume).
    ob.append(piece('traverse', lambda bm: boite(bm, (0, 0, 4.9), (3.9, 0.95, 0.7)), P['blindage'], biseau=0.05))
    ob.append(piece('peinture', lambda bm: [boite(bm, (0, sy * 0.478, 4.95), (3.0, 0.008, 0.38)) for sy in (1, -1)], P['jaune']))
    ob += hachures(P, [((0, sy * 0.476, 0), (1, 0, 0), (0, 0, 1), (0, sy, 0), -1.5, 1.5, 4.6, 4.73) for sy in (1, -1)], pas=0.12, couleurs=('hachureJaune', None))
    ob.append(piece('raidisseurs', lambda bm: [boite(bm, (x, sy * 0.49, 4.9), (0.08, 0.03, 0.66)) for x in (-1.55, -0.5, 0.5, 1.55) for sy in (1, -1)], P['acier']))
    ob.append(piece('projecteurs', lambda bm: [boite(bm, (0, sy * 0.28, 4.543), (1.5, 0.12, 0.016)) for sy in (1, -1)], P['neonBlanc']))
    # Le vérin : bride, fût cerclé de jaune, tirants, tête bombée.
    ob.append(piece('verin', lambda bm: revol(bm, [(0, 5.25), (0.64, 5.25), (0.64, 5.42), (0.46, 5.42), (0.46, 8.45), (0.58, 8.45), (0.58, 8.62), (0.42, 8.68), (0.26, 8.78), (0, 8.8)], 20), P['blindageClair']))
    ob.append(piece('cercles', lambda bm: [revol(bm, [(0.46, z), (0.5, z), (0.5, z + 0.1), (0.46, z + 0.1)], 20, ferme=True) for z in (6.4, 7.5)], P['jaune']))
    tirants = [(0.55 * math.cos(a), 0.55 * math.sin(a)) for a in (PI / 4 + k * PI / 2 for k in range(4))]
    ob.append(piece('tirants', lambda bm: [tube(bm, (x, y, 5.42), (x, y, 8.45), 0.035, 8) for x, y in tirants], P['alliage']))
    ob.append(piece('ecrous', lambda bm: [tube(bm, (x, y, z), (x, y, z + 0.06), 0.06, 6) for x, y in tirants for z in (5.42, 8.62)], P['acier']))
    # Le groupe de pompage (+x) : caisson à ouïes, moteur ; l'accumulateur (−x) ; les flexibles.
    ob.append(piece('pompe', lambda bm: boite(bm, (1.35, 0, 5.53), (0.76, 0.76, 0.56)), P['blindageClair'], biseau=0.02))
    ob.append(piece('ouies', lambda bm: [boite(bm, (1.35 + 0.08 * i, sy * 0.385, 5.53), (0.035, 0.012, 0.36)) for i in range(-3, 4) for sy in (1, -1)], P['joint']))
    ob.append(piece('moteur', lambda bm: [tube(bm, (1.12, 0, 5.98), (1.66, 0, 5.98), 0.17, 14), boite(bm, (1.38, 0, 5.84), (0.4, 0.3, 0.06))], P['acier']))
    ob.append(piece('capot', lambda bm: revol(bm, [(0, 0), (0.15, 0)], 14, centre=(1.665, 0, 5.98), axe='X', couvercles=False), P['joint']))
    ob.append(piece('accumulateur', lambda bm: revol(bm, [(0, 5.25), (0.32, 5.25), (0.32, 5.32), (0.27, 5.36), (0.27, 6.2), (0.22, 6.32), (0.12, 6.39), (0, 6.41)], 16, centre=(-1.35, 0, 0)), P['rouille']))
    ob.append(piece('flexibles', lambda bm: [tuyau(bm, pts, 0.045, 8, 4) for pts in (
        [(1.05, 0.3, 5.75), (0.85, 0.42, 5.85), (0.6, 0.4, 5.7), (0.45, 0.3, 5.62)],
        [(1.1, -0.3, 5.82), (1.0, -0.45, 6.6), (0.75, -0.45, 7.9), (0.42, -0.28, 8.2)],
        [(-1.1, 0.15, 5.6), (-0.8, 0.3, 5.75), (-0.55, 0.28, 5.7), (-0.42, 0.2, 5.65)])], P['caoutchouc']))
    ob.append(piece('raccords', lambda bm: [boite(bm, p, (0.1, 0.1, 0.1)) for p in ((0.44, 0.3, 5.62), (0.41, -0.28, 8.2), (-0.42, 0.2, 5.65))], P['acier']))
    # Les feux ambrés fixes aux bouts de la traverse.
    ob.append(piece('socles-feux', lambda bm: [tube(bm, (s * 1.85, 0, 5.25), (s * 1.85, 0, 5.29), 0.09, 12) for s in (1, -1)], P['blindage']))
    ob.append(piece('feux', lambda bm: [revol(bm, dome(0.075, 0.115), 12, centre=(s * 1.85, 0, 5.29)) for s in (1, -1)], P['ambre']))
    halos = [[s * 1.85, 5.37, 0.0, 0.32, 1, 0.62, 0.22, 0.6] for s in (1, -1)] + [[0, 4.47, sz * 0.32, 0.75, 1, 0.92, 0.8, 0.3] for sz in (1, -1)]
    return ob, {'halos': halos}


def presse_tete(P):
    """La tête de la presse (autour de son centre) : bloc nervuré, semelle hachurée, patins de guidage, tige."""
    P = matieres_meca(P)
    ob = []
    ob.append(piece('bloc', lambda bm: boite(bm, (0, 0, 0.02), (2.0, 1.0, 0.96)), P['blindage'], biseau=0.05))
    ob.append(piece('semelle', lambda bm: boite(bm, (0, 0, -0.53), (2.1, 1.1, 0.14)), P['acier'], biseau=0.02))
    ob.append(piece('outil', lambda bm: boite(bm, (0, 0, -0.612), (1.8, 0.8, 0.024)), P['alliage']))
    ob += hachures(P, [((0, sy * 0.551, 0), (1, 0, 0), (0, 0, 1), (0, sy, 0), -1.0, 1.0, -0.585, -0.475) for sy in (1, -1)], pas=0.12)
    ob.append(piece('raidisseurs', lambda bm: [boite(bm, (x, sy * 0.51, -0.06), (0.08, 0.04, 0.74)) for x in (-0.6, 0, 0.6) for sy in (1, -1)], P['acier']))
    ob.append(piece('lumieres', lambda bm: [boite(bm, (0, sy * 0.503, 0.4), (1.6, 0.012, 0.05)) for sy in (1, -1)], P['accent2']))
    # Les patins qui courent sur les glissières des colonnes (garnitures de bronze).
    ob.append(piece('patins', lambda bm: [boite(bm, (s * 1.1, 0, 0), (0.2, 0.36, 0.7)) for s in (1, -1)], P['blindageClair'], biseau=0.015))
    ob.append(piece('garnitures', lambda bm: [boite(bm, (s * 1.206, 0, 0), (0.012, 0.26, 0.6)) for s in (1, -1)], P['bronze']))
    # La tige du vérin (elle monte jusque dans le fût : assez longue pour la course entière), sa bride boulonnée.
    ob.append(piece('tige', lambda bm: tube(bm, (0, 0, 0.5), (0, 0, 5.0), 0.2, 16), P['alliage']))
    ob.append(piece('bride', lambda bm: tube(bm, (0, 0, 0.49), (0, 0, 0.62), 0.3, 16), P['acier']))
    ob.append(piece('boulons', lambda bm: boulons(bm, [(0.25 * math.cos(a), 0.25 * math.sin(a), 0.62) for a in (k * PI / 3 for k in range(6))], (0, 0, 1), 0.025, 0.02), P['blindage']))
    return ob, {}


# ===========================================================================
# LA BALISE : un mât en treillis triangulaire, son armoire, deux projecteurs tournés vers la piste ; la tête
# (pivot en y = 2,5) : un globe sombre, deux lampes opposées (une forte, une douce), une coiffe.
# ===========================================================================
def balise_mat(P):
    P = matieres_meca(P)
    ob = []
    ob.append(piece('socle', lambda bm: boite(bm, (0, 0, -0.8), (0.72, 0.72, 0.2)), P['blindage'], biseau=0.02))
    ob += hachures(P, [((0, sy * 0.361, 0), (1, 0, 0), (0, 0, 1), (0, sy, 0), -0.32, 0.32, -0.88, -0.72) for sy in (1, -1)], pas=0.06, couleurs=('hachureJaune', None))

    def coins(R, z):
        return [(R * math.cos(a), R * math.sin(a), z) for a in (0.0, 2 * PI / 3, 4 * PI / 3)]
    ob.append(piece('treillis', lambda bm: treillis(bm, coins(0.22, -0.7), coins(0.16, 2.27), 6, 0.05, 0.024), P['acier']))
    ob.append(piece('collier', lambda bm: revol(bm, [(0, 2.25), (0.3, 2.25), (0.3, 2.32), (0.25, 2.38), (0.25, 2.5), (0, 2.5)], 16), P['blindageClair']))
    # L'armoire électrique (côté piste), sa porte, son voyant, ses ouïes ; le câble qui monte au cœur du treillis.
    ob.append(piece('armoire', lambda bm: boite(bm, (-0.5, 0, -0.5), (0.26, 0.5, 0.8)), P['blindageClair'], biseau=0.015))
    ob.append(piece('porte', lambda bm: boite(bm, (-0.633, 0, -0.48), (0.008, 0.4, 0.66)), P['blindage']))
    ob.append(piece('voyant', lambda bm: boite(bm, (-0.638, 0.12, -0.22), (0.008, 0.04, 0.04)), P['navVert']))
    ob.append(piece('ouies', lambda bm: [boite(bm, (-0.5, sy * 0.252, z), (0.18, 0.008, 0.025)) for sy in (1, -1) for z in (-0.3, -0.26, -0.22, -0.18)], P['joint']))
    ob.append(piece('cable', lambda bm: tuyau(bm, [(-0.45, 0, -0.1), (-0.3, 0, 0.05), (-0.04, 0, 0.3), (0, 0, 0.8), (0, 0, 2.26)], 0.03, 8, 3), P['caoutchouc']))
    # La traverse et ses deux projecteurs, inclinés vers la piste.
    ob.append(piece('traverse', lambda bm: barre(bm, (-0.12, -0.42, 1.9), (-0.12, 0.42, 1.9), 0.05), P['blindage']))
    Rp = Matrix.Rotation(-0.35, 3, 'Y')
    ob.append(piece('projecteurs', lambda bm: [boite(bm, (-0.2, sy * 0.3, 1.86), (0.14, 0.2, 0.15), Rp) for sy in (1, -1)], P['blindage'], biseau=0.01))
    ob.append(piece('verres', lambda bm: [boite(bm, Vector((-0.2, sy * 0.3, 1.86)) + Rp @ Vector((-0.072, 0, 0)), (0.01, 0.16, 0.11), Rp) for sy in (1, -1)], P['neonBlanc']))
    return ob, {}


def balise_tete(P):
    """La tête de la balise, posée sur son pivot (origine) ; la lampe forte regarde vers +z du jeu (−Y Blender)."""
    P = matieres_meca(P)
    ob = []
    ob.append(piece('platine', lambda bm: revol(bm, [(0, 0), (0.27, 0), (0.27, 0.05), (0.23, 0.07), (0, 0.07)], 16), P['acier']))
    ob.append(piece('globe', lambda bm: revol(bm, [(0, 0.07), (0.215, 0.07), (0.215, 0.44), (0, 0.44)], 16), P['verre']))
    ob.append(piece('lampe', lambda bm: revol(bm, [(0.222, 0.12), (0.222, 0.39)], 4, a0=math.radians(242), a1=math.radians(298), couvercles=False), P['dangerFort']))
    ob.append(piece('lampe-douce', lambda bm: revol(bm, [(0.222, 0.12), (0.222, 0.39)], 4, a0=math.radians(62), a1=math.radians(118), couvercles=False), P['dangerDoux']))
    ob.append(piece('cercles', lambda bm: [revol(bm, [(0.215, z), (0.234, z), (0.234, z + 0.016), (0.215, z + 0.016)], 16, ferme=True) for z in (0.1, 0.394)], P['acier']))
    ob.append(piece('coiffe', lambda bm: revol(bm, [(0, 0.44), (0.25, 0.44), (0.25, 0.49), (0.17, 0.54), (0.05, 0.565), (0, 0.567)], 16), P['blindage']))
    ob.append(piece('paratonnerre', lambda bm: tube(bm, (0, 0, 0.56), (0, 0, 0.82), 0.009, 6), P['alliage']))
    return ob, {}


# ===========================================================================
# LA PLATEFORME (dessus en y = −0,5) et la passerelle qui la relie au bord de la piste (vers −x).
# ===========================================================================
def plateforme_meca(P):
    P = matieres_meca(P)
    ob = []
    # La dalle chanfreinée, ses tôles de pont, ses flancs hachurés, un liseré lumineux (couleur du monde).
    ob.append(piece('dalle', lambda bm: extrude(bm, rect_ch(4.4, 4.4, 0.3), -1.0, -0.5, 'Z'), P['metalMoyen'], biseau=0.03))
    ob.append(piece('toles', lambda bm: [boite(bm, (-1.5 + i, -1.5 + j, -0.496), (0.96, 0.96, 0.012)) for i in range(4) for j in range(4)], P['plaque']))
    ob += hachures(P, [((-2.201, 0, 0), (0, 1, 0), (0, 0, 1), (-1, 0, 0), -1.85, 1.85, -0.9, -0.62)] + [((0, sy * 2.201, 0), (1, 0, 0), (0, 0, 1), (0, sy, 0), -1.85, 1.85, -0.9, -0.62) for sy in (1, -1)], pas=0.18, couleurs=('hachureJaune', None))
    ob.append(piece('liseres', lambda bm: [boite(bm, (-2.205, 0, -0.96), (0.012, 3.8, 0.025))] + [boite(bm, (0, sy * 2.205, -0.96), (3.8, 0.012, 0.025)) for sy in (1, -1)], P['accentDoux']))
    # La coque sous la dalle (la plateforme flotte), les bornes lumineuses des coins.
    ob.append(piece('coque', lambda bm: loft(bm, [[(x, y, -1.0) for x, y in rect_ch(4.1, 4.1, 0.28)], [(x, y, -1.55) for x, y in rect_ch(2.8, 2.8, 0.2)]]), P['blindage']))
    ob.append(piece('bornes', lambda bm: [boite(bm, (sx * 1.95, sy * 1.95, -0.42), (0.14, 0.14, 0.16)) for sx in (1, -1) for sy in (1, -1)], P['acier'], biseau=0.01))
    ob.append(piece('feux', lambda bm: [boite(bm, (sx * 1.95, sy * 1.95, -0.32), (0.1, 0.1, 0.04)) for sx in (1, -1) for sy in (1, -1)], P['feuBlanc']))
    # Un pupitre de commande tourné vers la piste (écran incliné).
    ob.append(piece('pupitre', lambda bm: boite(bm, (-1.7, 1.25, -0.12), (0.32, 0.55, 0.76)), P['blindageClair'], biseau=0.015))
    Re = Matrix.Rotation(0.55, 3, 'Y')
    ob.append(piece('ecran', lambda bm: boite(bm, (-1.79, 1.25, 0.2), (0.02, 0.44, 0.24), Re), P['ecran']))
    ob.append(piece('lueur', lambda bm: boite(bm, Vector((-1.79, 1.25, 0.2)) + Re @ Vector((-0.012, 0, 0)), (0.004, 0.38, 0.18), Re), P['fenetre']))
    # La passerelle : tablier à lattes, poutres latérales en treillis, main courante jaune, liserés, câbles, jambes.
    ob.append(piece('tablier', lambda bm: boite(bm, (-4.4, 0, -0.62), (4.4, 1.0, 0.06)), P['blindage'], biseau=0.01))
    ob.append(piece('lattes', lambda bm: [boite(bm, (-6.35 + 0.5 * i, 0, -0.588), (0.035, 0.9, 0.006)) for i in range(9)], P['joint']))

    def poutres(bm):
        pas = 4.4 / 4
        for sy in (1, -1):
            y = sy * 0.5
            barre(bm, (-6.6, y, -0.66), (-2.2, y, -0.66), 0.08)
            barre(bm, (-6.6, y, -0.37), (-2.2, y, -0.37), 0.025)
            for i in range(5):
                barre(bm, (-6.6 + i * pas, y, -0.66), (-6.6 + i * pas, y, -0.08), 0.04)
            for i in range(4):
                x0 = -6.6 + i * pas
                if i % 2 == 0:
                    barre(bm, (x0, y, -0.66), (x0 + pas, y, -0.08), 0.03)
                else:
                    barre(bm, (x0, y, -0.08), (x0 + pas, y, -0.66), 0.03)
    ob.append(piece('poutres', poutres, P['blindageClair']))
    ob.append(piece('main-courante', lambda bm: [barre(bm, (-6.6, sy * 0.5, -0.07), (-2.15, sy * 0.5, -0.07), 0.045) for sy in (1, -1)], P['jaune']))
    ob.append(piece('liseres', lambda bm: [boite(bm, (-4.4, sy * 0.47, -0.586), (4.4, 0.02, 0.01)) for sy in (1, -1)], P['accentDoux']))
    ob.append(piece('cables', lambda bm: [tube(bm, (-6.6, sy * 0.25, -0.69), (-2.2, sy * 0.25, -0.69), 0.035, 8) for sy in (1, -1)], P['caoutchouc']))
    ob.append(piece('jambes', lambda bm: [barre(bm, (-4.6, sy * 0.35, -0.66), (-1.85, sy * 0.6, -1.2), 0.09) for sy in (1, -1)], P['blindage']))
    ob.append(piece('bride', lambda bm: boite(bm, (-6.63, 0, -0.64), (0.06, 1.12, 0.16)), P['acier']))
    return ob, {'halos': [[sx * 1.95, -0.3, sz * 1.95, 0.35, 1, 0.82, 0.55, 0.4] for sx in (1, -1) for sz in (1, -1)]}


OBJETS = {
    'pylones': pylones,
    'porte-cadre': porte_cadre,
    'porte-battant': porte_battant,
    'rotor-moyeu': rotor_moyeu,
    'rotor-pale': rotor_pale,
    'turbine-cadre': turbine_cadre,
    'turbine-rotor': turbine_rotor,
    'radar-tour': radar_tour,
    'radar-antenne': radar_antenne,
    'presse-cadre': presse_cadre,
    'presse-tete': presse_tete,
    'balise-mat': balise_mat,
    'balise-tete': balise_tete,
    'plateforme-meca': plateforme_meca,
}

# Le cadrage des aperçus (cible Blender, distance).
CADRAGES = {
    'pylones': ((0, 0, 0.9), 7.0),
    'porte-cadre': ((0, 0, 1.2), 7.5),
    'porte-battant': ((0, 0, 1.0), 5.5),
    'rotor-moyeu': ((0, 0, 0.85), 4.6),
    'rotor-pale': ((1.45, 0, 0), 5.2),
    'turbine-cadre': ((0, 0, 0.9), 24.0),
    'turbine-rotor': ((0, 0, 0), 8.0),
    'radar-tour': ((0, 0, 0.3), 20.0),
    'radar-antenne': ((0, 0, 2.0), 12.0),
    'presse-cadre': ((0, 0, 3.6), 26.0),
    'presse-tete': ((0, 0, 2.2), 13.5),
    'balise-mat': ((0, 0, 0.8), 8.5),
    'balise-tete': ((0, 0, 0.4), 2.2),
    'plateforme-meca': ((-2.2, 0, -0.8), 16.0),
}

if __name__ == '__main__':
    executer(OBJETS, 'objets-mecanismes.prm', CADRAGES)
