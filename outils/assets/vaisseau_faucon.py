# PORTAL RUSH — FAUCON, l'agile (Blender). Voir commun.py pour la chaîne et le format, vaisseaux.py pour Aube.
#
# Une aiguille : un fuseau long et effilé, à facettes (pont, épaules et bouchain vifs), le nez très pointu, le
# poste de pilotage avancé sous une verrière étroite ; deux plans canard en flèche près du nez ; une aile
# « brisée » : apex très en flèche le long du fuseau, puis aile en flèche inversée, terminée par un fuseau de
# bout d'aile et une « serre » (dérive tournée vers le bas) ; une grosse tuyère centrale dans un carter à
# ailettes, deux petits moteurs courts posés sur les emplantures (entrées d'air visibles) ; une double dérive
# dorsale haute, très en flèche, à bord d'attaque lumineux.
# Peinture : un pont sombre (carbone, métal) ; la couleur du joueur (canal coque) en longues bandes sur les flancs,
# la pointe du nez, les canards, les dérives, le bord d'attaque des ailes et les serres ; une bande de couleur 2
# sur l'échine ; un liseré lumineux sur le bouchain.

import math

import bpy  # (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh
from mathutils import Matrix, Vector

from commun import ajouter_matiere, appliquer, figer, modif, objet_depuis_bmesh
from formes import aile, boite, couronne, fuseau, miroir_x, piece, revolution, ruban, super_ellipse, tube
from vaisseaux import tuyere


# ---------------------------------------------------------------------------
# Petits outils propres au Faucon
# ---------------------------------------------------------------------------
def section_facettes(l, haut, bas, chz):
    """
    La section complète (boucle fermée) du fuseau : un pont presque plat, une épaule vive, un flanc incliné
    qui descend jusqu'au bouchain (arête vive, à la hauteur « chz »), un ventre presque plat.
    14 points ; épaules aux indices 2 et 12, bouchain aux indices 4 et 10.
    """
    e = haut - chz
    d = [(0, haut), (l * 0.32, haut - e * 0.03), (l * 0.62, chz + e * 0.84), (l * 0.9, chz + e * 0.4), (l, chz),
         (l * 0.8, chz + (bas - chz) * 0.55), (l * 0.4, bas - (bas - chz) * 0.02), (0, bas)]
    g = [(-x, z) for x, z in d[1:-1]][::-1]
    return d + g


def interp(table, y):
    """Interpolation linéaire dans une table [(clé, valeur), ...] triée par clé décroissante."""
    if y >= table[0][0]:
        return table[0][1]
    for (y0, v0), (y1, v1) in zip(table, table[1:]):
        if y1 <= y <= y0:
            t = (y0 - y) / ((y0 - y1) or 1e-9)
            return v0 + (v1 - v0) * t
    return table[-1][1]


def lame(nom, sections, mat, biseau=0.005, tourner=None, origine=(0, 0, 0)):
    """Une lame (aile, dérive) sans subdivision, biseautée : ses arêtes restent où on les pose."""
    ob = aile(nom, sections, mat, subdivision=0)
    modif(ob, 'BEVEL', width=biseau, segments=2, limit_method='ANGLE', angle_limit=math.radians(25))
    appliquer(ob)
    if tourner is not None:
        ob.rotation_euler = (0, tourner, 0)
    ob.location = origine
    figer(ob)
    return ob


def plaques_n(nom, source, plans, classer, mat, epaisseur=0.012, jour=0.012, mat_tranche=None, biseau=0.004, egal=True):
    """
    Comme formes.plaques, mais « classer(centre, normale) » reçoit aussi la normale de la face : on peut ainsi
    ne garder que le pont (normale vers le haut) d'un fuseau à facettes, ou le dessus d'une aile.
    « egal » : retrait régulier (False pour une bande étroite, où il peut s'emballer sur une face très fine).
    """
    bm = bmesh.new()
    bm.from_mesh(source.data)
    bmesh.ops.transform(bm, matrix=source.matrix_world, verts=bm.verts[:])
    for co, no in plans:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
    bm.normal_update()
    groupes = {}
    for f in bm.faces:
        k = classer(f.calc_center_median(), f.normal)
        if k is not None:
            groupes.setdefault(k, []).append(f)
    garder = set()
    for k, fs in groupes.items():
        r = bmesh.ops.inset_region(bm, faces=fs, thickness=jour / 2, depth=0.0, use_even_offset=egal, use_boundary=True)
        bmesh.ops.delete(bm, geom=r['faces'], context='FACES')
        for f in fs:
            if f.is_valid:
                garder.add(f)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in garder], context='FACES')
    ob = objet_depuis_bmesh(nom, bm, mat)
    m = modif(ob, 'SOLIDIFY', thickness=epaisseur, offset=1.0, use_rim=True)
    if mat_tranche is not None:
        m.material_offset_rim = ajouter_matiere(ob, mat_tranche)
    if biseau > 0:
        modif(ob, 'BEVEL', width=biseau, segments=1, limit_method='ANGLE', angle_limit=math.radians(40))
    appliquer(ob)
    return ob


def conduit(bm, pts, r, segments=8):
    """Un tuyau (câble, durite) le long d'une ligne brisée, sections rondes, bouts fermés."""
    pts = [Vector(p) for p in pts]
    anneaux = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        u = t.cross(ref).normalized()
        v = t.cross(u).normalized()
        anneaux.append([bm.verts.new(p + (u * math.cos(a) + v * math.sin(a)) * r) for a in [2 * math.pi * k / segments for k in range(segments)]])
    for a, b in zip(anneaux, anneaux[1:]):
        for k in range(segments):
            j = (k + 1) % segments
            bm.faces.new([a[k], a[j], b[j], b[k]])
    bm.faces.new(anneaux[0][::-1])
    bm.faces.new(anneaux[-1])


def verin(bm, a, b, r=0.012, part=0.55):
    """Un vérin : un corps (côté a, plus gros), une tige (jusqu'à b), deux chapes."""
    a, b = Vector(a), Vector(b)
    m = a.lerp(b, part)
    tube(bm, a, m, r, 8)
    tube(bm, m - (b - a).normalized() * 0.01, b, r * 0.55, 6)
    boite(bm, a, (r * 2.2, r * 2.2, r * 2.2))
    boite(bm, b, (r * 1.8, r * 1.8, r * 1.8))


def ailettes(bm, cx, cz, angles, r0, r1, y0, y1, ep=0.008):
    """Des ailettes radiales (radiateur) autour de l'axe Y passant par (cx, cz), aux angles donnés (de +X vers +Z)."""
    for a in angles:
        rm = (r0 + r1) / 2
        boite(bm, (cx + rm * math.cos(a), (y0 + y1) / 2, cz + rm * math.sin(a)), (r1 - r0, y0 - y1, ep), Matrix.Rotation(-a, 3, 'Y'))


def tuyere_f(nom, P, x, z, y, r, longueur=0.2):
    """
    vaisseaux.tuyere, volets remis en place : tuyere() pose tous ses objets en (x, 0, z), ce qui efface le
    décalage en Y de la couronne de volets (ils se retrouvaient vers y = 0, loin de la sortie).
    """
    objets, point = tuyere(nom, P, x, z, y, r, longueur)
    for o in objets:
        if o.name.startswith(nom + '-volets'):
            o.location.y = y - 0.02
    return objets, point


def lame_peinte(nom, sections, mat, peintures, biseau=0.005, tourner=None, origine=(0, 0, 0)):
    """
    Une lame et ses plaques peintes. « peintures » : [(plans, classer(c, n), matière, épaisseur)], classés dans le
    repère de la lame avant rotation (x = envergure, y = corde, z = épaisseur).
    """
    ob = aile(nom, sections, mat, subdivision=0)
    obs = [plaques_n(f'{nom}-p{i}', ob, plans, classer, m, epaisseur=ep, jour=0.012, mat_tranche=tr, biseau=0.002)
           for i, (plans, classer, m, ep, tr) in enumerate(peintures)]
    modif(ob, 'BEVEL', width=biseau, segments=2, limit_method='ANGLE', angle_limit=math.radians(25))
    appliquer(ob)
    for o in [ob] + obs:
        if tourner is not None:
            o.rotation_euler = (0, tourner, 0)
        o.location = origine
        figer(o)
    return [ob] + obs


def rayon(ob, origine, direction):
    """Le premier point de « ob » touché par un rayon, et sa normale (ou None, None)."""
    ok, loc, nor, _ = ob.ray_cast(Vector(origine), Vector(direction).normalized())
    return (loc, nor) if ok else (None, None)


def posee(bm, ob, x, y, taille, ecart=0.004):
    """Une petite boîte posée sur le dessus de « ob » en (x, y), orientée selon la surface."""
    p, n = rayon(ob, (x, y, 1.5), (0, 0, -1))
    if p is not None:
        boite(bm, p + n * (ecart + taille[2] / 2), taille, n.to_track_quat('Z', 'Y').to_matrix())


# ---------------------------------------------------------------------------
# Le Faucon
# ---------------------------------------------------------------------------
def faucon_vaisseau(P):
    """
    FAUCON : l'agile. Lecture immédiate : une aiguille sombre, une grosse tuyère au bout et deux petites à ses
    côtés, une double dérive haute et lumineuse, une aile brisée qui retombe vers des serres.
    """
    centre, cote = [], []   # pièces centrées (pas de miroir) ; pièces du côté droit (x > 0), mises en miroir

    # ---- Le fuseau : long, effilé, à facettes ----
    # (y, demi-largeur au bouchain, pont, ventre, hauteur du bouchain)
    T = [(1.95, 0.03, -0.005, -0.055, -0.04), (1.75, 0.068, 0.03, -0.09, -0.045), (1.45, 0.11, 0.065, -0.12, -0.045),
         (1.1, 0.148, 0.092, -0.138, -0.04), (0.65, 0.18, 0.115, -0.147, -0.035), (0.15, 0.21, 0.14, -0.15, -0.03),
         (-0.3, 0.225, 0.165, -0.15, -0.025), (-0.65, 0.205, 0.2, -0.145, -0.015), (-0.92, 0.13, 0.17, -0.1, 0.0)]
    corps = fuseau('corps', [(2.06, [(0, -0.035)])] + [(y, section_facettes(l, h, b, c)) for y, l, h, b, c in T],
                   P['blindage'], subdivision=1, plis=(2, 4, 10, 12))
    centre.append(corps)
    chz = [(y, c) for y, l, h, b, c in T]

    # Le pont (normale vers le haut) reste sombre : une pointe de lance peinte sur le nez (coupée par la bande
    # de couleur 2), puis des plaques claires en chevrons derrière la verrière, de part et d'autre de l'échine.
    k = 0.6  # la flèche des chevrons
    plans = [((0, y, 0), (0, 1, 0)) for y in (1.86, 1.42, 0.42, -0.62)]
    plans += [((x, 0, 0), (1, 0, 0)) for x in (-0.024, 0.024)]
    plans += [((0, yc, 0), (s * k, 1, 0)) for yc in (0.3, 0.22, -0.18, -0.26) for s in (1, -1)]

    def nez(c, n):
        return ('nez', c.x > 0) if n.z > 0.8 and abs(c.x) > 0.024 and 1.42 < c.y < 1.86 else None
    centre.append(plaques_n('pont-nez', corps, plans, nez, P['coque'], epaisseur=0.012, jour=0.014, mat_tranche=P['joint']))

    def chevrons(c, n):
        if n.z < 0.8 or abs(c.x) < 0.024 or not -0.62 < c.y < 0.42:
            return None
        v = c.y + k * abs(c.x)
        return ('c1', c.x > 0) if v > 0.3 else (('c2', c.x > 0) if -0.18 < v < 0.22 else None)
    centre.append(plaques_n('pont', corps, plans, chevrons, P['blindageClair'], epaisseur=0.01, jour=0.014, mat_tranche=P['joint'], biseau=0))

    def bande(c, n):
        return 'bande' if abs(c.x) < 0.024 and n.z > 0.8 and 1.42 < c.y < 1.86 else None
    centre.append(plaques_n('bande', corps, plans, bande, P['peinture2'], epaisseur=0.016, jour=0.01, mat_tranche=P['joint'], egal=False))

    # Les flancs (la facette inclinée entre l'épaule et le bouchain) : la couleur du joueur, en longues bandes
    # du nez au carter, coupées par des jours obliques (fuyants vers l'arrière).
    coupes_f, af = (1.45, 0.62, -0.12), 1.2
    plans_f = [((0, y, 0), (0, 1, af)) for y in coupes_f] + [((0, -0.6, 0), (0, 1, 0))]

    def flanc(c, n):
        if not (0.2 < n.z < 0.85) or n.x < 0 or c.z < interp(chz, c.y) + 0.006 or c.y < -0.6:
            return None
        return ('flanc', sum(1 for y in coupes_f if (c.y - y) + af * c.z < 0))
    cote.append(plaques_n('flanc', corps, plans_f, flanc, P['coque'], epaisseur=0.01, jour=0.016, mat_tranche=P['joint'], biseau=0))

    # Le liseré lumineux le long du bouchain (posé sur l'arête réelle, trouvée par un rayon horizontal).
    pts = []
    for i in range(14):
        y = 1.78 - i * 0.11
        p, _ = rayon(corps, (1, y, interp(chz, y)), (-1, 0, 0))
        if p is not None:
            pts.append((p.x + 0.002, y, p.z))
    cote.append(ruban('bouchain', pts, 0.008, 0.012, P['accentDoux'], normale=(1, 0, 0)))

    # ---- La verrière : étroite, avancée, posée sur le pont ; son arête et ses arceaux ----
    def bul(y, rx, rz):
        return (y, super_ellipse(0, 0.07, rx, rz, n=2.2, points=20, aplatir_bas=0.9))
    centre.append(fuseau('verriere', [(1.52, [(0, 0.062)]), bul(1.4, 0.04, 0.03), bul(1.16, 0.08, 0.08), bul(0.86, 0.096, 0.108),
                                      bul(0.6, 0.082, 0.088), (0.43, [(0, 0.13)])], P['verre'], subdivision=1))
    centre.append(ruban('arete-verriere', [(0, 1.4, 0.102), (0, 1.16, 0.153), (0, 0.86, 0.181), (0, 0.6, 0.161), (0, 0.45, 0.137)], 0.012, 0.012, P['alliage'], normale=(1, 0, 0)))
    for y, rx, rz in [(1.16, 0.082, 0.082), (0.74, 0.093, 0.1)]:
        pts = [(-rx * math.cos(a), y, 0.07 + rz * math.sin(a)) for a in [i * math.pi / 8 for i in range(9)]]
        centre.append(ruban('arceau', pts, 0.016, 0.012, P['carbone'], normale=(0, 1, 0)))

    # ---- L'échine : une arête étroite qui part de la verrière et monte jusqu'au carter, entre les dérives ;
    # elle porte la bande de couleur 2 ----
    def ech(y, rx, top):
        return (y, super_ellipse(0, top - 0.06, rx, 0.06, n=3.0, points=12))
    echine = fuseau('echine', [(0.5, [(0, 0.115)]), ech(0.4, 0.026, 0.15), ech(0.1, 0.034, 0.175), ech(-0.25, 0.04, 0.21),
                               ech(-0.5, 0.042, 0.245), ech(-0.7, 0.04, 0.268), (-0.78, [(0, 0.24)])], P['blindage'], subdivision=1)
    centre.append(echine)
    centre.append(plaques_n('echine-bande', echine, [((0, y, 0), (0, 1, 0)) for y in (0.36, -0.6)],
                            lambda c, n: 'b' if n.z > 0.8 and -0.6 < c.y < 0.36 else None, P['peinture2'], epaisseur=0.008, jour=0.01, mat_tranche=P['joint'], egal=False))

    # ---- Le pitot : l'aiguille au bout du nez ----
    def pitot(bm):
        tube(bm, (0, 2.0, -0.035), (0, 2.18, -0.035), 0.005, 6)
        tube(bm, (0, 2.02, -0.035), (0, 2.07, -0.035), 0.01, 8)
    centre.append(piece('pitot', pitot, P['alliage']))

    # ---- Les canards : petits, en flèche, en dièdre négatif ; pivot et vérin visibles ----
    can = [(0.08, 1.42, 1.04, 0.028, -0.035), (0.14, 1.38, 1.05, 0.025, -0.04), (0.4, 1.14, 1.04, 0.012, -0.088)]
    # (Pied sombre, partie extérieure peinte au-delà d'une découpe parallèle au bord d'attaque, dessus et dessous.)
    plans_c = [((0.2, 1.3, 0), (1, 1.08, 0))]
    cote += lame_peinte('canard', can, P['blindage'], [(plans_c, lambda c, n: 'c' if abs(n.z) > 0.7 and (c.x - 0.2) + 1.08 * (c.y - 1.3) > 0 else None, P['coque'], 0.004, P['joint'])], biseau=0.004)
    cote.append(ruban('bord-canard', [(0.14, 1.378, -0.04), (0.4, 1.138, -0.088)], 0.01, 0.016, P['accentDoux'], normale=(0.18, 0, 0.98)))
    cote.append(piece('pivot-canard', lambda bm: tube(bm, (0.11, 1.19, -0.04), (0.168, 1.19, -0.042), 0.024, 12), P['acier'], biseau=0.004))
    cote.append(piece('verin-canard', lambda bm: verin(bm, (0.09, 0.98, 0.03), (0.19, 1.12, -0.026), 0.008), P['alliage']))

    # ---- L'aile brisée : apex très en flèche le long du fuseau, puis flèche inversée, dièdre négatif ----
    ail = [(0.1, 0.55, -1.0, 0.05, -0.03), (0.22, 0.2, -1.05, 0.05, -0.028), (0.47, -0.42, -1.14, 0.05, -0.022),
           (0.72, -0.28, -0.84, 0.034, -0.045), (0.92, -0.17, -0.56, 0.026, -0.065)]
    aile_ob = aile('aile', ail, P['blindage'], subdivision=0)

    def dessus(lo, hi):
        """Le dessus de l'aile entre deux découpes obliques (u = x − 0,35 y)."""
        def f(c, n):
            u = c.x - 0.35 * c.y
            return 'p' if n.z > 0.85 and lo < u < hi and c.x > 0.48 else None
        return f
    # (La couleur forme une lame le long du bord d'attaque : en avant d'une ligne oblique ; la bande couleur 2
    # traverse toute la corde.)
    plans_a = [((x, 0, 0), (1, -0.35, 0)) for x in (0.62, 0.67, 0.7, 0.99)] + [((0.5, -0.75, 0), (-0.786, 1, 0))]

    def avant(f):
        return lambda c, n: f(c, n) if -0.786 * (c.x - 0.5) + (c.y + 0.75) > 0 else None
    cote.append(plaques_n('aile-peinte', aile_ob, plans_a, avant(dessus(0.7, 0.99)), P['coque'], epaisseur=0.006, jour=0.012, mat_tranche=P['joint']))
    cote.append(plaques_n('aile-arriere', aile_ob, plans_a, (lambda f: lambda c, n: None if avant(f)(c, n) else f(c, n))(dessus(0.7, 0.99)), P['carbone'], epaisseur=0.004, jour=0.012, mat_tranche=P['joint']))
    cote.append(plaques_n('aile-trait', aile_ob, plans_a, dessus(0.62, 0.67), P['peinture2'], epaisseur=0.007, jour=0.008, mat_tranche=P['joint']))
    # L'apex (le long du fuseau) : une plaque claire en flèche, à liseré lumineux.
    # (Une plaque parallèle au bord d'attaque de l'apex, en retrait de 5 cm, jusqu'au moteur.)
    plans_x = [((0.22, 0.15, 0), (2.48, 1, 0)), ((0, -0.75, 0), (0, 1, 0)), ((0.265, 0, 0), (1, 0, 0))]

    def apex(c, n):
        return 'apex' if n.z > 0.85 and 2.48 * (c.x - 0.22) + (c.y - 0.15) < 0 and c.y > -0.75 and c.x < 0.265 else None
    cote.append(plaques_n('apex', aile_ob, plans_x, apex, P['blindageClair'], epaisseur=0.006, jour=0.012, mat_tranche=P['joint']))
    modif(aile_ob, 'BEVEL', width=0.005, segments=2, limit_method='ANGLE', angle_limit=math.radians(25))
    appliquer(aile_ob)
    cote.append(aile_ob)
    cote.append(ruban('bord-aile', [(0.5, -0.403, -0.025), (0.72, -0.278, -0.045), (0.92, -0.168, -0.065)], 0.01, 0.018, P['accentDoux'], normale=(0.1, 0, 1)))
    # Les élevons : derrière le bord de fuite, séparés par un jour sombre ; leurs charnières dessous.
    def bf(x):
        return interp([(-s[0], s[2]) for s in ail], -x)

    def bz(x):
        return interp([(-s[0], s[4]) for s in ail], -x)
    elev = [(x, bf(x) - 0.014, bf(x) - 0.12, 0.022, bz(x)) for x in (0.5, 0.86)]
    cote.append(lame('elevon', elev, P['blindageClair'], biseau=0.003))

    def charnieres(bm):
        for x in (0.56, 0.78):
            boite(bm, (x, bf(x) - 0.03, bz(x) - 0.016), (0.02, 0.12, 0.024))
    cote.append(piece('charnieres', charnieres, P['carbone'], biseau=0.004))

    # ---- Le fuseau de bout d'aile, ses feux, sa serre ----
    XB, ZB = 0.935, -0.065

    def pod(y, rx, rz):
        return (y, super_ellipse(XB, ZB, rx, rz, n=2.6, points=10))
    bout = fuseau('bout', [(0.08, [(XB, ZB)]), pod(0.0, 0.016, 0.02), pod(-0.15, 0.03, 0.042), pod(-0.45, 0.034, 0.046), pod(-0.68, 0.028, 0.036), (-0.78, [(XB, ZB)])], P['carbone'], subdivision=1)
    cote.append(bout)
    # Son capot peint : un chevron sur le dessus.
    plans_b = [((0, -0.62, 0), (0, 1, 0)), ((XB, -0.06, 0), (0.8, 1, 0)), ((XB, -0.06, 0), (-0.8, 1, 0))]
    cote.append(plaques_n('bout-capot', bout, plans_b, lambda c, n: 'b' if n.z > 0.15 and c.y > -0.62 and c.y + 0.8 * abs(c.x - XB) < -0.06 else None,
                          P['coque'], epaisseur=0.005, jour=0.01, mat_tranche=P['joint'], biseau=0))
    serre = [(0.0, -0.36, -0.74, 0.028, 0.0), (0.15, -0.63, -0.82, 0.014, 0.0)]
    cote.append(lame('serre', serre, P['coque'], biseau=0.004, tourner=(math.pi / 2 - math.radians(18)), origine=(XB, 0, ZB)))
    cote.append(piece('feu-nav', lambda bm: boite(bm, (XB, 0.04, ZB), (0.014, 0.03, 0.014)), P['navVert']))
    cote.append(piece('feu-bout', lambda bm: boite(bm, (XB, -0.765, ZB), (0.016, 0.02, 0.016)), P['feuBlanc']))

    # ---- Le carter du moteur principal : collier, nervures, ailettes de radiateur ----
    ZM, RM = 0.06, 0.21
    prof = [(0.12, -0.46), (0.18, -0.54), (0.198, -0.6), (0.214, -0.62), (0.214, -0.66), (0.204, -0.68)]
    mats = [P['blindage'], P['blindage'], P['alliage'], P['alliage'], P['alliage']]
    y = -0.7
    for i in range(4):  # les nervures
        prof += [(0.206, y), (0.216, y - 0.008), (0.216, y - 0.026), (0.206, y - 0.034)]
        mats += [P['blindageClair'], P['acier'], P['acier'], P['acier']]
        y -= 0.06
    prof += [(0.21, -0.98), (0.21, -1.3), (0.204, -1.33)]
    mats += [P['blindageClair'], P['carbone'], P['carbone']]
    carter = revolution('carter', prof, P['blindage'], segments=40, mats_par_bande=mats)
    carter.location = (0, 0, ZM)
    centre.append(carter)
    ang = [math.radians(a) for a in (8, 20, 32, 44, 56, 124, 136, 148, 160, 172)]  # (rien sous les dérives)
    # L'évent dorsal, entre les pieds des dérives : le cœur du moteur luit sous des lamelles.
    def event(bm):
        boite(bm, (0, -1.06, ZM + RM - 0.004), (0.07, 0.4, 0.024))
        for i in range(7):
            boite(bm, (0, -0.9 - i * 0.052, ZM + RM + 0.012), (0.056, 0.012, 0.01), Matrix.Rotation(0.5, 3, 'X'))
    centre.append(piece('event', event, P['carbone'], biseau=0.002))
    centre.append(piece('event-coeur', lambda bm: boite(bm, (0, -1.06, ZM + RM + 0.009), (0.04, 0.37, 0.004)), P['coeur']))
    centre.append(piece('ailettes', lambda bm: ailettes(bm, 0, ZM, ang, RM - 0.005, RM + 0.04, -1.0, -1.28, 0.008), P['alliage']))

    # ---- La grosse tuyère et ses vérins ----
    tu, pt_c = tuyere_f('tuyere-c', P, 0, ZM, -1.38, 0.2, longueur=0.16)
    centre += tu

    def verins_tuyere(bm):
        for a in (40, 140, 220, 320):
            a = math.radians(a)
            c, s = math.cos(a), math.sin(a)
            verin(bm, (c * 0.225, -1.12, ZM + s * 0.225), (c * 0.232, -1.37, ZM + s * 0.232), 0.012)
    centre.append(piece('verins-tuyere', verins_tuyere, P['alliage']))

    # ---- La double dérive dorsale : deux lames hautes, très en flèche, ouvertes vers l'extérieur ----
    der = [(0.0, -0.5, -1.24, 0.04, 0.0), (0.2, -0.93, -1.33, 0.03, 0.0), (0.4, -1.2, -1.46, 0.018, 0.0)]
    ouv, XD, ZD = math.radians(14), 0.05, 0.13
    # (Le pied est sombre ; la lame est peinte au-dessus d'une découpe oblique, la pointe en couleur 2.)
    plans_d = [((0.06, -0.7, 0), (1, 0.3, 0)), ((0.335, 0, 0), (1, 0, 0)), ((0.35, 0, 0), (1, 0, 0))]

    def flanc_derive(lo, hi):
        return lambda c, n: 'd' if abs(n.z) > 0.7 and lo < (c.x - 0.06) + 0.3 * (c.y + 0.7) and c.x < hi else None

    def pointe(c, n):
        return 'p' if abs(n.z) > 0.7 and c.x > 0.35 else None
    cote += lame_peinte('derive', der, P['carbone'], [(plans_d, flanc_derive(0.0, 0.335), P['coque'], 0.005, P['joint']),
                                                      (plans_d, pointe, P['peinture2'], 0.005, P['joint'])],
                        biseau=0.005, tourner=-(math.pi / 2 - ouv), origine=(XD, 0, ZD))

    def sur_derive(s, y):
        return (XD + s * math.sin(ouv), y, ZD + s * math.cos(ouv))
    cote.append(ruban('bord-derive', [sur_derive(s, y + 0.002) for s, y, *_ in der], 0.014, 0.024, P['accent'], normale=(math.cos(ouv), 0, -math.sin(ouv))))
    cote.append(piece('feu-derive', lambda bm: boite(bm, sur_derive(0.405, -1.42), (0.02, 0.05, 0.014)), P['feuBlanc']))

    # ---- Les petits moteurs d'emplanture : courts, posés sur l'aile ; entrée d'air, nervure, tuyère ----
    XN, ZN = 0.36, 0.05
    profn = [(0.056, -0.375), (0.072, -0.362), (0.084, -0.39), (0.086, -0.45), (0.088, -0.75), (0.094, -0.77), (0.094, -0.81),
             (0.088, -0.83), (0.086, -1.08), (0.08, -1.13), (0.076, -1.15)]
    matn = [P['alliage'], P['alliage'], P['blindageClair'], P['blindage'], P['carbone'], P['carbone'], P['carbone'], P['blindage'], P['blindage'], P['acier']]
    nac = revolution('nacelle', profn, P['blindage'], segments=24, mats_par_bande=matn)
    nac.location = (XN, 0, ZN)
    figer(nac)
    cote.append(nac)
    cn = revolution('nacelle-conduit', [(0.058, -0.375), (0.056, -0.44), (0.02, -0.48)], P['joint'], segments=20)
    cn.location = (XN, 0, ZN)
    cote.append(cn)

    def aube(bm):
        boite(bm, (0.03, 0, 0), (0.046, 0.006, 0.013), Matrix.Rotation(0.5, 3, 'X'))
    aubes = couronne('nacelle-aubes', 12, aube, 0.0, centre=(XN, -0.43, ZN))
    aubes.data.materials.append(P['alliage'])
    cote.append(aubes)
    # Le capot peint : une flèche qui pointe vers l'avant, arrêtée devant l'aérofrein.
    kn = 0.9
    plans_n = [((0, -0.84, 0), (0, 1, 0)), ((XN, -0.5, 0), (kn, 1, 0)), ((XN, -0.5, 0), (-kn, 1, 0))]

    def capot(c, n):
        if n.z < 0.45 or c.y < -0.84 or c.y + kn * abs(c.x - XN) > -0.5:
            return None
        return 'capot'
    cote.append(plaques_n('capot', nac, plans_n, capot, P['coque'], epaisseur=0.008, jour=0.014, mat_tranche=P['joint']))
    tn, pt_n = tuyere_f('tuyere-n', P, XN, ZN, -1.18, 0.074, longueur=0.13)
    cote += tn
    # L'aérofrein sur le moteur (fermé, un peu soulevé), son vérin.
    cote.append(piece('aerofrein', lambda bm: boite(bm, (XN, -0.96, ZN + 0.1), (0.07, 0.2, 0.008), Matrix.Rotation(0.1, 3, 'X')), P['carbone'], biseau=0.003))
    cote.append(piece('verin-frein', lambda bm: verin(bm, (XN, -0.84, ZN + 0.088), (XN, -1.02, ZN + 0.104), 0.006), P['alliage']))

    # ---- Le ventre : patins anti-gravité lumineux dans leurs logements ----
    for x, y, lx, ly in [(0.075, 0.85, 0.07, 0.5), (0.12, -0.62, 0.08, 0.5)]:
        cote.append(piece('logement', lambda bm, x=x, y=y, lx=lx, ly=ly: boite(bm, (x, y, -0.152), (lx + 0.04, ly + 0.06, 0.03)), P['carbone'], biseau=0.008, segments=1))
        cote.append(piece('patin', lambda bm, x=x, y=y, lx=lx, ly=ly: boite(bm, (x, y, -0.169), (lx, ly, 0.006)), P['accent']))

    # ---- Les détails du dos : ouïes, durites, câbles ----
    def ouies(bm):
        for i in range(5):
            y = 0.33 - i * 0.055
            p, n = rayon(corps, (0.605, y, 0.3), (-0.88, 0, -0.47))
            if p is not None:
                boite(bm, p + n * 0.004, (0.05, 0.026, 0.01), n.to_track_quat('Z', 'Y').to_matrix())
    cote.append(piece('ouies', ouies, P['carbone']))
    cote.append(piece('durite', lambda bm: conduit(bm, [(XN - 0.05, -0.62, ZN + 0.07), (0.27, -0.72, 0.15), (0.21, -0.86, 0.2), (0.17, -0.98, 0.22)], 0.013, 8), P['caoutchouc']))
    cote.append(piece('durite2', lambda bm: conduit(bm, [(XN - 0.07, -0.66, ZN + 0.05), (0.27, -0.8, 0.12), (0.235, -0.96, 0.14)], 0.009, 6), P['alliage']))

    # Tout ce qui est d'un côté est mis en miroir (transformations inscrites d'abord).
    objets = list(centre)
    for o in cote:
        if o is None:
            continue
        appliquer(o)
        figer(o)
        c = miroir_x(o)
        if o.name.startswith('feu-nav'):
            c.data.materials[0] = P['feuRouge']
        objets += [o, c]
    objets = [o for o in objets if o is not None and len(o.data.polygons)]
    # Les émetteurs de bouclier (boîtes de 9 × 2,5 × 9 cm ajoutées par le jeu) : posés sur le pont derrière la
    # verrière, et sur la lame peinte des ailes ; hauteur prise sur la surface réelle (le plus haut des objets).
    def sommet(x, y):
        hauts = []
        for o in objets:
            if o.modifiers:
                appliquer(o)
            mi = o.matrix_world.inverted()
            ok, loc, _, _ = o.ray_cast(mi @ Vector((x, y, 2.0)), (mi.to_3x3() @ Vector((0, 0, -1))).normalized())
            if ok:
                hauts.append((o.matrix_world @ loc).z)
        return max(hauts)
    emet = []
    for x, y in [(0.09, -0.1), (0.72, -0.48)]:
        z = round(sommet(x, y) + 0.0135, 4)
        emet += [(x, z, -y), (-x, z, -y)]
    points = {
        'tuyeres': [(pt_c[0], pt_c[1], pt_c[2], 0.2), (pt_n[0], pt_n[1], pt_n[2], 0.074), (-pt_n[0], pt_n[1], pt_n[2], 0.074)],
        'emetteurs': emet,
    }
    return objets, points
