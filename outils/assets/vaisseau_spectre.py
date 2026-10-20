# PORTAL RUSH — SPECTRE, LE FURTIF (Blender). Voir commun.py (chaîne, format) et vaisseaux.py (Aube, construire).
#
# Une aile volante en pointe de flèche, taillée en facettes planes (aucune subdivision) :
#   — l'aile : une dalle mince à bords chanfreinés, bord d'attaque coudé, bord de fuite en dents de scie (chaque
#     arête alignée sur le bord d'attaque, comme sur les avions furtifs) ; le dos du corps continue le « W » ;
#   — le corps : un bloc taillé par des plans (pont en pignon, flancs inclinés, quille en V dessous), qui monte
#     doucement vers une verrière basse en diamant ;
#   — la propulsion : deux tuyères en fente creusées dans le dos, à l'arrière (volets, cœur lumineux, rampe
#     chaude), entre deux dérives inclinées l'une vers l'autre ;
#   — la peinture : sombre (blindage, carbone), la couleur du joueur sur quelques grandes facettes et panneaux,
#     la couleur 2 sur deux chevrons, des liserés lumineux fins sur quelques arêtes (bords d'attaque et de fuite,
#     épaules du corps).
# Méthode : les facettes sont taillées par des plans (bisect + bouchage), réunies et creusées par booléens exacts,
# chanfreinées (BEVEL, chanfreins en acier clair qui accrochent la lumière), puis séparées le long de leurs arêtes
# pour un ombrage parfaitement plat. Les détails sont posés exactement sur les facettes (plans connus).

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import ajouter_matiere, appliquer, figer, modif, objet_depuis_bmesh  # noqa: E402
from formes import boite, miroir_x, piece  # noqa: E402


# ---------------------------------------------------------------------------
# Géométrie plane (le plan xy, vu de dessus)
# ---------------------------------------------------------------------------
def contour_complet(demi):
    """Le contour fermé (sens trigonométrique vu de dessus) à partir de sa moitié droite, du nez (x = 0) à la queue (x = 0)."""
    milieu = demi[1:-1]
    return [demi[0]] + [(-x, y) for x, y in milieu] + [demi[-1]] + [(x, y) for x, y in reversed(milieu)]


def normale_gauche(p, q):
    d = (Vector(q) - Vector(p)).normalized()
    return Vector((-d.y, d.x))


def decalee(p, q, d):
    """La droite de l'arête p → q décalée de d vers sa gauche (l'intérieur d'un contour trigonométrique) : (point, direction)."""
    n = normale_gauche(p, q)
    return (Vector(p) + n * d, Vector(q) - Vector(p))


def croisement(l1, l2):
    (p, u), (q, v) = l1, l2
    den = u.x * v.y - u.y * v.x
    t = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / den
    return p + u * t


def en_x(l, x):
    """Le point de la droite l d'abscisse x."""
    p, u = l
    return p + u * ((x - p.x) / u.x)


def ligne_decalee(chaine, d):
    """Une ligne brisée (le long d'un contour trigonométrique) décalée de d vers l'intérieur, angles en onglet."""
    lignes = [decalee(a, b, d) for a, b in zip(chaine, chaine[1:])]
    pts = [lignes[0][0]]
    for l1, l2 in zip(lignes, lignes[1:]):
        pts.append(croisement(l1, l2))
    pts.append(lignes[-1][0] + lignes[-1][1])
    return pts


def couper(poly, point, normale):
    """Sutherland–Hodgman : la partie du polygone du côté (x − point)·normale ≥ 0."""
    point, normale = Vector(point), Vector(normale)
    sortie = []
    n = len(poly)
    for i in range(n):
        a, b = Vector(poly[i]), Vector(poly[(i + 1) % n])
        da, db = (a - point).dot(normale), (b - point).dot(normale)
        if da >= 0:
            sortie.append(a)
        if (da >= 0) != (db >= 0):
            sortie.append(a + (b - a) * (da / (da - db)))
    return sortie


# ---------------------------------------------------------------------------
# Les plans de coupe et la taille des facettes. Un plan « de hauteur » est un triplet (a, bx, cy) : z = a + bx·x + cy·y.
# ---------------------------------------------------------------------------
def z_plan(t, x, y):
    return t[0] + t[1] * x + t[2] * y


def coupe_dessus(t):
    """Le demi-espace z ≤ plan (on retire ce qui dépasse) : (point, normale) pour bisect_plane."""
    return (Vector((0, 0, t[0])), Vector((-t[1], -t[2], 1)).normalized())


def coupe_dessous(t):
    return (Vector((0, 0, t[0])), Vector((t[1], t[2], -1)).normalized())


def pignon(a, c, g):
    """Un toit à deux pans : z ≤ a + c·y − g·|x| (le faîte sur x = 0)."""
    return [(a, -g, c), (a, g, c)]


def flancs(contour, zb, pente, haut=True):
    """
    Un plan par côté du contour (convexe, trigonométrique) : il passe par ce côté à la hauteur zb et monte vers
    l'intérieur avec la pente donnée (flanc incliné) — ou, « haut=False », descend vers l'intérieur (quille).
    """
    plans = []
    n = len(contour)
    for i in range(n):
        p, q = contour[i], contour[(i + 1) % n]
        dd = normale_gauche(p, q)
        s = pente if haut else -pente
        plans.append((zb - s * dd.dot(Vector(p)), s * dd.x, s * dd.y))
    return plans


def normale_plan(t, haut=True):
    n = Vector((-t[1], -t[2], 1)).normalized()
    return n if haut else -n


def prisme(bm, contour, z0, z1):
    bas = [bm.verts.new((x, y, z0)) for x, y in contour]
    haut = [bm.verts.new((x, y, z1)) for x, y in contour]
    fh = bm.faces.new(haut)
    fb = bm.faces.new(bas[::-1])
    n = len(contour)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([bas[i], bas[j], haut[j], haut[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return fh, fb


def tailler(nom, contour, z0, z1, dessus, dessous, mat):
    """Un prisme (contour, de z0 à z1) taillé par des plans : chaque coupe retire un côté et rebouche la tranche."""
    bm = bmesh.new()
    prisme(bm, contour, z0, z1)
    for co, no in [coupe_dessus(t) for t in dessus] + [coupe_dessous(t) for t in dessous]:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=co, plane_no=no, clear_outer=True)
        bord = [e for e in bm.edges if e.is_boundary]
        if bord:
            bmesh.ops.holes_fill(bm, edges=bord, sides=0)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return objet_depuis_bmesh(nom, bm, mat)


def dalle(nom, contour, epaisseur, retraits_haut, retraits_bas, mat, mat_plateau=None, couper_milieu=True):
    """
    Une dalle mince (contour dans le plan xy) aux bords chanfreinés : chaque retrait (largeur, hauteur) ajoute une
    bande inclinée tout autour, parallèle au bord (les dents de scie gardent leurs arêtes). Le plateau final peut
    recevoir une autre matière. Coupée sur x = 0 pour qu'un dièdre garde les faces planes.
    """
    bm = bmesh.new()
    fh, fb = prisme(bm, contour, -epaisseur / 2, epaisseur / 2)
    if fh.normal.z < 0:
        fh, fb = fb, fh
    for w, d in retraits_haut:
        bmesh.ops.inset_region(bm, faces=[fh], thickness=w, depth=d, use_even_offset=True)
    for w, d in retraits_bas:
        bmesh.ops.inset_region(bm, faces=[fb], thickness=w, depth=d, use_even_offset=True)
    if mat_plateau is not None:
        fh.material_index = fb.material_index = 1
    if couper_milieu:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-6, plane_co=(0, 0, 0), plane_no=(1, 0, 0))
    ob = objet_depuis_bmesh(nom, bm, mat)
    if mat_plateau is not None:
        ob.data.materials.append(mat_plateau)
    return ob


def operer(ob, outil, operation='DIFFERENCE'):
    """Booléen exact (les faces taillées par l'outil prennent sa matière) ; l'outil est ensuite supprimé."""
    modif(ob, 'BOOLEAN', operation=operation, object=outil, solver='EXACT', material_mode='TRANSFER')
    appliquer(ob)
    bpy.data.objects.remove(outil, do_unlink=True)


def chanfreiner(ob, largeur, angle=10, mat_chanfrein=None, segments=1):
    """Un chanfrein sur toutes les arêtes de plus de « angle » degrés ; matière propre éventuelle."""
    m = modif(ob, 'BEVEL', width=largeur, segments=segments, limit_method='ANGLE', angle_limit=math.radians(angle))
    if mat_chanfrein is not None:
        m.material = ajouter_matiere(ob, mat_chanfrein)
    appliquer(ob)


def facetter(ob, seuil=2.5):
    """Sépare le maillage le long de ses arêtes vives : chaque facette est ombrée à plat (lisser() n'y touche
    plus, une arête de bord restant vive)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    s = math.radians(seuil)
    aretes = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > s]
    bmesh.ops.split_edges(bm, edges=aretes)
    bm.to_mesh(ob.data)
    bm.free()


def nettoyer(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data)
    bm.free()


def solide(nom, pts, mat):
    """Un solide convexe (outil de coupe) : l'enveloppe convexe de ses sommets."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    bmesh.ops.convex_hull(bm, input=vs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return objet_depuis_bmesh(nom, bm, mat)


def pave(nom, mn, mx, mat):
    return solide(nom, [(x, y, z) for x in (mn[0], mx[0]) for y in (mn[1], mx[1]) for z in (mn[2], mx[2])], mat)


def plaque(nom, pts, normale, mat, epaisseur=0.008, decalage=0.0012, biseau=0.0025, mat_tranche=None, segments=2):
    """Un panneau posé sur une facette plane : polygone 3D (sur la facette), épaissi le long de la normale."""
    normale = Vector(normale).normalized()
    bm = bmesh.new()
    vs = [bm.verts.new(Vector(p) + normale * decalage) for p in pts]
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.dot(normale) < 0:
        f.normal_flip()
    ob = objet_depuis_bmesh(nom, bm, mat)
    m = modif(ob, 'SOLIDIFY', thickness=epaisseur, offset=1.0, use_rim=True)
    if mat_tranche is not None:
        m.material_offset_rim = ajouter_matiere(ob, mat_tranche)
    if biseau > 0:
        modif(ob, 'BEVEL', width=biseau, segments=segments, limit_method='ANGLE', angle_limit=math.radians(30))
    appliquer(ob)
    return ob


def filet(nom, points, normales, largeur, epaisseur, mat, enfoncer=0.35):
    """Un liseré (bande fine) le long de points 3D, chaque point avec sa normale, enfoncé en partie dans la surface."""
    bm = bmesh.new()
    n = len(points)
    paires = []
    for i, p in enumerate(points):
        p = Vector(p)
        t = (Vector(points[min(i + 1, n - 1)]) - Vector(points[max(i - 1, 0)])).normalized()
        nn = Vector(normales[i]).normalized()
        cote = t.cross(nn).normalized() * largeur / 2
        c = p + nn * epaisseur * (0.5 - enfoncer)
        h = nn * epaisseur / 2
        paires.append([bm.verts.new(c - cote - h), bm.verts.new(c + cote - h), bm.verts.new(c + cote + h), bm.verts.new(c - cote + h)])
    for a, b in zip(paires, paires[1:]):
        for j in range(4):
            k = (j + 1) % 4
            bm.faces.new([a[j], a[k], b[k], b[j]])
    bm.faces.new(paires[0][::-1])
    bm.faces.new(paires[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return objet_depuis_bmesh(nom, bm, mat)


def vitrer(ob, mat_vitre, retrait=0.011, creux=0.0025, aire_min=0.0015):
    """Les grandes facettes du dessus deviennent des vitres, retirées dans un cadre (le reste de l'objet)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    i = ajouter_matiere(ob, mat_vitre)
    faces = [f for f in bm.faces if f.normal.z > 0.15 and f.calc_area() > aire_min]
    bmesh.ops.inset_individual(bm, faces=faces, thickness=retrait, depth=-creux, use_even_offset=True)
    for f in faces:
        f.material_index = i
    bm.to_mesh(ob.data)
    bm.free()


def lame(nom, profil, x, epaisseur, mat, biseau=0.004):
    """Une lame verticale (profil (y, z) dans le plan x), épaisse de « epaisseur », chanfreinée."""
    bm = bmesh.new()
    a = [bm.verts.new((x - epaisseur / 2, y, z)) for y, z in profil]
    b = [bm.verts.new((x + epaisseur / 2, y, z)) for y, z in profil]
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    n = len(profil)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([a[i], a[j], b[j], b[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = objet_depuis_bmesh(nom, bm, mat)
    if biseau > 0:
        modif(ob, 'BEVEL', width=biseau, segments=1, limit_method='ANGLE', angle_limit=math.radians(30))
        appliquer(ob)
    return ob


# ---------------------------------------------------------------------------
# Le plan du vaisseau (moitié droite, du nez à la queue ; Blender : nez vers +Y)
# ---------------------------------------------------------------------------
# L'aile : nez en lame, bord d'attaque coudé (chine avant très en flèche, puis aile à 62°), saumon droit, bord de
# fuite en dents de scie (toutes les arêtes à la pente du bord d'attaque, ±1,87) ; la dernière dent est le coin
# arrière du corps.
AILE = [(0.0, 2.04), (0.30, 0.55), (0.98, -0.72), (0.98, -1.0), (0.86, -0.776), (0.66, -1.15), (0.54, -0.926), (0.35, -1.281), (0.25, -1.25), (0.0, -1.20)]
# Le corps : convexe (pour être taillé par des plans) ; le plus large aux deux tiers, son arrière porte les tuyères.
CORPS = [(0.0, 1.90), (0.125, 1.30), (0.25, 0.68), (0.345, 0.0), (0.375, -0.62), (0.35, -1.281), (0.0, -1.36)]
# La verrière : un diamant bas et étroit.
VERRIERE = [(0.0, 1.40), (0.07, 1.15), (0.1, 0.88), (0.088, 0.66), (0.0, 0.50)]

# L'aile : épaisseur au bord, gradins (largeur, hauteur) dessus et dessous, dièdre négatif et amincissement.
EP_AILE = 0.014
GRADINS_HAUT = [(0.05, 0.03), (0.04, 0.006)]
GRADINS_BAS = [(0.05, 0.02)]


def diedre(x, z):
    ax = abs(x)
    return z * (1 - 0.35 * ax) - 0.03 * ax


# Le corps : flancs (pente 1,3 depuis z = 0 au contour), trois pignons pour le pont, quille en V et ventre plat.
CC = contour_complet(CORPS)
FLANCS = flancs(CC, 0.0, 1.3)
PIGNONS = pignon(0.3465, -0.169, 0.32) + pignon(0.18, -0.036, 0.14) + pignon(0.2172, 0.036, 0.10)
DESSOUS = [(-0.15, 0, 0), (-0.305, 0, 0.155), (-0.2697, 0, -0.171)] + flancs(CC, 0.0, 0.55, haut=False)

# Les fentes des tuyères (moitié droite) : x de 0,07 à 0,27, z de 0,012 à 0,100, sortie à y = −1,12.
FENTE = dict(x0=0.07, x1=0.27, z0=0.012, z1=0.100, y=-1.12)


def pont(x, y):
    """La hauteur du pont du corps (les pignons)."""
    return min(z_plan(t, x, y) for t in PIGNONS)


def flanc(x, y):
    return min(z_plan(t, x, y) for t in FLANCS)


def epaule(y):
    """L'abscisse (x > 0) de l'arête entre le pont et le flanc, à l'ordonnée y."""
    a, b = 0.0, 0.5
    for _ in range(40):
        m = (a + b) / 2
        if flanc(m, y) > pont(m, y):
            a = m
        else:
            b = m
    return (a + b) / 2


def normale_dessus(x, y):
    """La normale de la facette du dessus du corps en (x, y) (le plan le plus bas l'emporte)."""
    t = min(FLANCS + PIGNONS, key=lambda t: z_plan(t, x, y))
    return normale_plan(t)


def spectre_vaisseau(P):
    """
    SPECTRE : le furtif. Une aile volante en pointe de flèche, à facettes, sombre ; deux fentes de tuyère dans le
    dos ; deux dérives qui se penchent l'une vers l'autre ; des liserés fins comme des coutures de lumière.
    """
    ob = []
    F = FENTE

    # ---- L'aile : dalle chanfreinée (deux gradins dessus, un dessous), dièdre négatif, plus mince au saumon ----
    aile = dalle('aile', contour_complet(AILE), EP_AILE, GRADINS_HAUT, GRADINS_BAS, P['carbone'])
    for v in aile.data.vertices:
        v.co.z = diedre(v.co.x, v.co.z)

    # ---- Le corps, taillé par des plans, réuni à l'aile ----
    coque = tailler('coque', CC, -0.2, 0.4, FLANCS + PIGNONS, DESSOUS, P['blindage'])
    operer(coque, aile, 'UNION')

    # ---- Creusements : la rampe (auge) et la cavité de chaque fente, les prises d'air affleurantes ----
    def prise(s):
        # Un trapèze qui s'évase vers l'arrière ; la rampe plonge de 5,5 cm jusqu'à la bouche.
        av, ar = (0.40, 0.075, 0.125), (0.10, 0.05, 0.185)
        pts = []
        for (y, xa, xb), creux in ((av, 0.003), (ar, 0.055)):
            for x in (xa, xb):
                pts += [(s * x, y, pont(x, y) - creux), (s * x, y, pont(x, y) + 0.06)]
        return solide('prise', pts, P['joint'])

    for s in (1, -1):
        def sx(a, b):
            return (min(s * a, s * b), max(s * a, s * b))
        xa = sx(F['x0'] - 0.015, F['x1'] + 0.015)
        operer(coque, pave('auge', (xa[0], -1.9, 0.0), (xa[1], F['y'], 0.6), P['tuyere']))
        xc = sx(F['x0'], F['x1'])
        operer(coque, pave('cavite', (xc[0], F['y'] - 0.02, F['z0']), (xc[1], F['y'] + 0.2, F['z1']), P['chaud']))
        operer(coque, prise(s))
    nettoyer(coque)
    chanfreiner(coque, 0.008, 8, P['acier'], segments=2)
    facetter(coque)
    # La couleur du joueur sur les grandes facettes des flancs de l'avant (entre le nez et l'aile).
    i_coque = ajouter_matiere(coque, P['coque'])
    peints = [normale_plan(t) for t in FLANCS]
    for poly in coque.data.polygons:
        c = poly.center
        if 0.7 < c.y < 1.86 and c.z > 0.03 and poly.material_index == 0:
            n = poly.normal
            if any(n.dot(Vector((s * m.x, m.y, m.z))) > 0.9995 for m in peints for s in (1, -1)):
                poly.material_index = i_coque
    ob.append(coque)

    # ---- La verrière : un diamant taillé ; vitres en retrait dans un cadre carbone, chanfreins clairs ----
    cv = contour_complet(VERRIERE)
    pv = flancs(cv, 0.10, 1.6) + pignon(0.66, -0.375, 0.55) + pignon(0.272, 0.0, 0.45) + pignon(-0.155, 0.59, 0.4)
    verriere = tailler('verriere', cv, 0.06, 0.45, pv, [], P['carbone'])
    chanfreiner(verriere, 0.004, 15, P['alliage'])
    vitrer(verriere, P['verre'])
    facetter(verriere)
    ob.append(verriere)

    # ---- La quille dorsale : une arête étroite de la verrière aux tuyères, coiffée de vertèbres claires ----
    cq = contour_complet([(0.0, 0.47), (0.034, 0.36), (0.034, -1.16), (0.0, -1.24)])
    quille_plans = flancs(cq, 0.17, 2.5) + [(0.21, 0, -0.036), (0.2472, 0, 0.036), (0.365, 0, -0.5), (0.784, 0, 0.5)]
    quille = tailler('quille', cq, 0.08, 0.4, quille_plans, [], P['carbone'])
    chanfreiner(quille, 0.004, 20, P['acier'])
    facetter(quille)
    ob.append(quille)

    def vertebres(bm):
        for k in range(9):
            y = 0.26 - k * 0.135
            z = min(0.21 - 0.036 * y, 0.2472 + 0.036 * y, 0.365 - 0.5 * y, 0.784 + 0.5 * y)
            pente = -0.036 if y > -0.517 else 0.036
            boite(bm, (0, y, z + 0.004), (0.036, 0.1, 0.009), Matrix.Rotation(-math.atan(pente), 3, 'X'))
    ob.append(piece('vertebres', vertebres, P['blindageClair'], biseau=0.002))

    # ---- Les panneaux de l'aile (couleur du joueur), le chevron de la pointe (couleur 2) ----
    # Le plateau de l'aile est plan (de chaque côté) : z = diedre(x, hauteur du plateau).
    z_plateau = EP_AILE / 2 + sum(d for _, d in GRADINS_HAUT)
    n_plateau = Vector((0.03 + 0.35 * z_plateau, 0, 1)).normalized()

    def sur_plateau(pts2):
        return [(p.x, p.y, diedre(p.x, z_plateau)) for p in pts2]

    marge = sum(w for w, _ in GRADINS_HAUT) + 0.018
    LE = decalee((0.98, -0.72), (0.30, 0.55), marge)
    TE_int = decalee((0.35, -1.281), (0.54, -0.926), marge)
    TE_dent = decalee((0.54, -0.926), (0.66, -1.15), marge)
    TE_ext = decalee((0.66, -1.15), (0.86, -0.776), marge)
    # (Le bord intérieur suit le corps, à 2 cm de son contour.)
    L_corps_av = decalee((0.25, 0.68), (0.345, 0.0), -0.02)
    L_corps_ar = decalee((0.375, -0.62), (0.35, -1.281), -0.02)
    A = croisement(LE, L_corps_av)
    B, C = en_x(LE, 0.615), en_x(TE_dent, 0.615)
    D = croisement(TE_dent, TE_int)
    E = croisement(TE_int, L_corps_ar)
    interieur = [A, B, C, D, E, Vector((0.395, -0.62)), Vector((0.365, 0.0))]
    # Deux panneaux, coupés parallèlement au bord d'attaque.
    pa, da = LE[0], LE[1].normalized()
    n_le = Vector((-da.y, da.x))  # vers l'arrière (l'intérieur)
    coupe = 0.30
    avant = couper(interieur, pa + n_le * (coupe - 0.008), -n_le)
    arriere = couper(interieur, pa + n_le * (coupe + 0.008), n_le)
    ob.append(plaque('panneau-aile', sur_plateau(avant), n_plateau, P['coque'], mat_tranche=P['joint']))
    ob.append(plaque('panneau-aile', sur_plateau(arriere), n_plateau, P['coque'], mat_tranche=P['joint']))
    # Le chevron de la pointe : le plateau de la dent extérieure, un triangle pointé vers le saumon.
    chevron = [en_x(LE, 0.705), croisement(LE, TE_ext), en_x(TE_ext, 0.705)]
    ob.append(plaque('chevron', sur_plateau(chevron), n_plateau, P['peinture2'], mat_tranche=P['joint']))

    # ---- Les liserés : bord d'attaque (vif), dents du bord de fuite et épaules du corps (doux) ----
    z_pli = EP_AILE / 2 + GRADINS_HAUT[0][1]
    w0 = GRADINS_HAUT[0][0]

    def liseré_aile(nom, chaine, x_min, x_max, mat):
        # Le pli décalé, rogné entre x_min et x_max ; un point par sommet (le pli est droit entre deux sommets,
        # le dièdre étant linéaire en x) ; normale : moyenne de la bande et du gradin.
        pts = ligne_decalee(chaine, w0)
        sortie = []
        for a, b, (p, q) in zip(pts, pts[1:], zip(chaine, chaine[1:])):
            nl = normale_gauche(p, q)
            n = Vector((-0.36 * nl.x + 0.04, -0.36 * nl.y, 1))
            t1, t2 = (x_min - a.x) / (b.x - a.x), (x_max - a.x) / (b.x - a.x)
            lo, hi = max(0.0, min(t1, t2)), min(1.0, max(t1, t2))
            if lo >= hi:
                continue
            for m in (a + (b - a) * lo, a + (b - a) * hi):
                if sortie and (sortie[-1][0] - m).length < 1e-6:
                    sortie[-1] = (m, sortie[-1][1] + n)
                else:
                    sortie.append((m, n))
        points = [Vector((m.x, m.y, diedre(m.x, z_pli) + 0.001)) for m, _ in sortie]
        return filet(nom, points, [n for _, n in sortie], 0.011, 0.008, mat)

    ob.append(liseré_aile('lisere-bord', [(0.98, -0.72), (0.30, 0.55)], 0.33, 0.93, P['accent']))
    ob.append(liseré_aile('lisere-dents', [(0.35, -1.281), (0.54, -0.926), (0.66, -1.15), (0.86, -0.776), (0.98, -1.0)], 0.375, 0.95, P['accentDoux']))

    def liseré_epaule(y0, y1):
        points, normales = [], []
        k = int(abs(y1 - y0) / 0.07)
        for i in range(k + 1):
            y = y0 + (y1 - y0) * i / k
            x = epaule(y)
            points.append(Vector((x, y, pont(x, y))))
            normales.append(normale_plan(min(PIGNONS, key=lambda t: z_plan(t, x, y))) + normale_plan(min(FLANCS, key=lambda t: z_plan(t, x, y))))
        return filet('lisere-epaule', points, normales, 0.01, 0.008, P['accentDoux'])
    ob.append(liseré_epaule(0.42, -1.02))

    # ---- Les prises d'air : grilles sur la bouche ----
    def grille(bm):
        for y in (0.135, 0.165, 0.195, 0.225, 0.255, 0.285, 0.315):
            t = (0.40 - y) / 0.30
            xa, xb = 0.075 + (0.05 - 0.075) * t, 0.125 + (0.185 - 0.125) * t
            xm = (xa + xb) / 2
            n = normale_dessus(xm, y)
            rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix()
            boite(bm, (xm, y, pont(xm, y) - 0.003), (xb - xa + 0.006, 0.007, 0.008), rot)
        boite(bm, (0.118, 0.22, pont(0.118, 0.22) - 0.02), (0.006, 0.26, 0.04))
    ob.append(piece('grille', grille, P['alliage']))

    # ---- Les tuyères : cadre, volets, cœur lumineux, plaques chaudes de la rampe ----
    def cadre(bm):
        x0, x1, z0, z1, y = F['x0'], F['x1'], F['z0'], F['z1'], F['y']
        e = 0.01
        boite(bm, ((x0 + x1) / 2, y - 0.006, z1 + e / 2), (x1 - x0 + 2 * e, 0.02, e))
        boite(bm, ((x0 + x1) / 2, y - 0.006, z0 - e / 2 + 0.003), (x1 - x0 + 2 * e, 0.02, e * 0.7))
        for xx in (x0 - e / 2, x1 + e / 2):
            boite(bm, (xx, y - 0.006, (z0 + z1) / 2), (e, 0.02, z1 - z0 + 2 * e))
    ob.append(piece('cadre-fente', cadre, P['acier'], biseau=0.0025))

    def volets(bm):
        x0, x1, z0, z1, y = F['x0'], F['x1'], F['z0'], F['z1'], F['y']
        for k in range(1, 4):
            xx = x0 + (x1 - x0) * k / 4
            boite(bm, (xx, y + 0.07, (z0 + z1) / 2), (0.007, 0.13, z1 - z0), Matrix.Rotation(0.16 * (k - 2), 3, 'Z'))
    ob.append(piece('volets-fente', volets, P['tuyere']))

    def anneau(bm):
        # Un cadre intérieur, à mi-profondeur de la fente : la profondeur se lit.
        x0, x1, z0, z1, y = F['x0'], F['x1'], F['z0'], F['z1'], F['y'] + 0.14
        e = 0.008
        boite(bm, ((x0 + x1) / 2, y, z1 - e / 2), (x1 - x0, 0.012, e))
        boite(bm, ((x0 + x1) / 2, y, z0 + e / 2), (x1 - x0, 0.012, e))
        for xx in (x0 + e / 2, x1 - e / 2):
            boite(bm, (xx, y, (z0 + z1) / 2), (e, 0.012, z1 - z0))
    ob.append(piece('anneau-fente', anneau, P['tuyere']))
    ob.append(piece('coeur-fente', lambda bm: boite(bm, ((F['x0'] + F['x1']) / 2, F['y'] + 0.185, (F['z0'] + F['z1']) / 2), (F['x1'] - F['x0'] - 0.03, 0.01, 0.052)), P['coeur']))

    # La rampe : des tuiles chaudes, la dernière dentelée (le bord de sortie en dents de scie, comme le bord de
    # fuite) ; un filet du cœur au pied de la fente (les gaz qui éclairent la rampe).
    xa, xb = F['x0'] - 0.008, F['x1'] + 0.008
    fuite = decalee((0.0, -1.36), (0.35, -1.281), 0.014)
    rampe = [Vector((xa, F['y'] - 0.022)), Vector((xb, F['y'] - 0.022)), en_x(fuite, xb)]
    for i in range(5):
        xm, xn = xb - (xb - xa) * (i + 0.5) / 5, xb - (xb - xa) * (i + 1) / 5
        rampe += [en_x(fuite, xm) + Vector((0, 0.04)), en_x(fuite, xn)]
    y_tuiles = [F['y'] - 0.022, F['y'] - 0.075, F['y'] - 0.13, -1.6]
    for y0, y1 in zip(y_tuiles, y_tuiles[1:]):
        tuile = couper(couper(rampe, (0, y0 - 0.004), (0, -1)), (0, y1 + 0.004), (0, 1))
        ob.append(plaque('rampe', [(p.x, p.y, 0.0) for p in tuile], (0, 0, 1), P['chaud'], epaisseur=0.006, mat_tranche=P['tuyere']))
    ob.append(piece('flamme-rampe', lambda bm: boite(bm, ((F['x0'] + F['x1']) / 2, F['y'] - 0.03, 0.0085), (F['x1'] - F['x0'] - 0.02, 0.008, 0.004)), P['coeur']))

    # ---- Le pont : panneaux sombres à joints, chevron (couleur 2) parallèle au pli arrière, ouïes ----
    t_ar = PIGNONS[4]   # le pan droit de l'arrière
    t_mi = PIGNONS[2]   # le pan droit du milieu
    pli = Vector((0, -0.517))
    d_pli = Vector((1, -0.556)).normalized()
    n_pli = Vector((d_pli.y, -d_pli.x))   # vers l'arrière

    def sur_pan(t, pts2):
        return [(p.x, p.y, z_plan(t, p.x, p.y)) for p in pts2]

    def bande_pont(y_av, y_ar, k=8, dents=0):
        # Le polygone du pont entre la quille et l'épaule (à 2 cm), de y_av à y_ar ; bord arrière dentelé ou droit.
        ys = [y_av + (y_ar - y_av) * i / k for i in range(k + 1)]
        poly = [Vector((0.052, y_av))] + [Vector((epaule(y) - 0.02, y)) for y in ys]
        xe = epaule(y_ar) - 0.02
        for i in range(dents):
            poly.append(Vector((xe + (0.052 - xe) * (i + 0.5) / dents, y_ar + 0.022)))
            poly.append(Vector((xe + (0.052 - xe) * (i + 1) / dents, y_ar)))
        return poly + ([] if dents else [Vector((0.052, y_ar))])

    pont_ar = bande_pont(-0.5, -1.062, dents=7)
    for a_, b_, mat in [(0.02, 0.2, P['carbone']), (0.215, 0.25, P['peinture2']), (0.265, 9, P['carbone'])]:
        poly = couper(couper(pont_ar, pli + n_pli * a_, n_pli), pli + n_pli * b_, -n_pli)
        if len(poly) >= 3:
            ob.append(plaque('pont-arriere', sur_pan(t_ar, poly), normale_plan(t_ar), mat, epaisseur=0.006, mat_tranche=P['joint']))
    pont_mi = couper(bande_pont(0.07, -0.62), pli + n_pli * (-0.02), -n_pli)
    ob.append(plaque('pont-milieu', sur_pan(t_mi, pont_mi), normale_plan(t_mi), P['carbone'], epaisseur=0.006, mat_tranche=P['joint']))

    # Les paupières : une lèvre dentelée au bord du pont, qui surplombe chaque fente.
    xa, xb = F['x0'] - 0.012, F['x1'] + 0.012
    paupiere = [Vector((xa, -1.075)), Vector((xb, -1.075))]
    for i in range(6):
        paupiere += [Vector((xb - (xb - xa) * (i + 0.5) / 6, F['y'] - 0.016)), Vector((xb - (xb - xa) * (i + 1) / 6, F['y'] + 0.004))]
    ob.append(plaque('paupiere', sur_pan(t_ar, paupiere), normale_plan(t_ar), P['blindageClair'], epaisseur=0.007, mat_tranche=P['joint']))

    # Les ouïes de refroidissement : une plaque sombre et ses lamelles, devant chaque fente.
    def ouies(bm):
        n = normale_plan(t_ar)
        rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix()
        for k in range(6):
            y = -0.93 - k * 0.022
            boite(bm, (0.17, y, z_plan(t_ar, 0.17, y) + 0.0085), (0.15, 0.008, 0.005), rot @ Matrix.Rotation(0.5, 3, 'X'))
    ob.append(plaque('fond-ouies', sur_pan(t_ar, [Vector(v) for v in [(0.09, -0.915), (0.25, -0.915), (0.25, -1.055), (0.09, -1.055)]]), normale_plan(t_ar), P['joint'], epaisseur=0.0075, decalage=0.0, biseau=0))
    ob.append(piece('ouies', ouies, P['alliage']))

    # ---- Les flancs du milieu : plaques de métal clair à joints, une grille d'ouïes sur le flanc arrière ----
    def point_flanc(p, q, t, s_):
        nl = normale_gauche(p, q)
        xy = Vector(p) + (Vector(q) - Vector(p)) * t + nl * s_
        return Vector((xy.x, xy.y, 1.3 * s_)), Vector((-1.3 * nl.x, -1.3 * nl.y, 1)).normalized()

    def s_epaule(p, q, t):
        a, b = 0.0, 0.3
        for _ in range(30):
            m = (a + b) / 2
            pt, _ = point_flanc(p, q, t, m)
            if pt.z < pont(pt.x, pt.y):
                a = m
            else:
                b = m
        return a

    for p, q, t0, t1 in [((0.35, -1.281), (0.375, -0.62), 0.1, 0.9), ((0.375, -0.62), (0.345, 0.0), 0.06, 0.94), ((0.345, 0.0), (0.25, 0.68), 0.06, 0.6)]:
        pts = [point_flanc(p, q, t, 0.036)[0] for t in (t0, t1)]
        pts += [point_flanc(p, q, t, s_epaule(p, q, t) - 0.016)[0] for t in (t1, t0)]
        ob.append(plaque('flanc', pts, point_flanc(p, q, 0.5, 0.05)[1], P['blindageClair'], epaisseur=0.006, mat_tranche=P['joint']))

    def ouies_flanc(bm):
        p, q = (0.35, -1.281), (0.375, -0.62)
        pt, n = point_flanc(p, q, 0.5, 0.06)
        rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix()
        d = (Vector(q) - Vector(p)).normalized().to_3d()
        for k in range(-3, 4):
            boite(bm, pt + d * (k * 0.03) + n * 0.008, (0.05, 0.008, 0.005), rot @ Matrix.Rotation(0.6, 3, 'X'))
    ob.append(piece('ouies-flanc', ouies_flanc, P['carbone']))

    # Les parois des auges : nervures de refroidissement.
    def nervures(bm):
        for xx in (F['x0'] - 0.012, F['x1'] + 0.012):
            for k in range(4):
                boite(bm, (xx, F['y'] - 0.045 - k * 0.045, 0.045), (0.006, 0.01, 0.07))
    ob.append(piece('nervures', nervures, P['tuyere']))

    # Les lèvres des prises d'air (bords latéraux et nez de la rampe).
    def levres(bm):
        for (x0, y0), (x1, y1) in [((0.075, 0.40), (0.05, 0.10)), ((0.125, 0.40), (0.185, 0.10)), ((0.075, 0.40), (0.125, 0.40))]:
            a, b = Vector((x0, y0, pont(x0, y0))), Vector((x1, y1, pont(x1, y1)))
            n = normale_dessus((x0 + x1) / 2, (y0 + y1) / 2)
            xd = (b - a).normalized()
            zd = (n - xd * n.dot(xd)).normalized()
            boite(bm, (a + b) / 2 + zd * 0.002, ((b - a).length + 0.008, 0.008, 0.006), Matrix((xd, zd.cross(xd), zd)).transposed())
    ob.append(piece('levres', levres, P['acier']))

    # Les lignes de panneaux gravées sur les flancs peints du nez.
    def gravures(bm):
        for p, q, t in [((0.25, 0.68), (0.125, 1.30), 0.3), ((0.25, 0.68), (0.125, 1.30), 0.68), ((0.125, 1.30), (0.0, 1.90), 0.85)]:
            s1 = s_epaule(p, q, t) - 0.004
            a, n = point_flanc(p, q, t, 0.022)
            b, _ = point_flanc(p, q, t, s1)
            xd = (b - a).normalized()
            boite(bm, (a + b) / 2, ((b - a).length, 0.004, 0.003), Matrix((xd, n.cross(xd), n)).transposed())
    ob.append(piece('gravures', gravures, P['joint']))

    # ---- Les capteurs : fenêtres sombres sur les flancs peints du nez ----
    p_, q_ = Vector((0.125, 1.30)), Vector((0.0, 1.90))
    nl_ = normale_gauche(p_, q_)
    n_flanc = Vector((-1.3 * nl_.x, -1.3 * nl_.y, 1)).normalized()

    def sur_flanc(t, s_):
        xy = p_ + (q_ - p_) * t + nl_ * s_
        return (xy.x, xy.y, 1.3 * s_)
    for t0 in (0.26, 0.5):
        ob.append(plaque('capteur', [sur_flanc(t0, 0.028), sur_flanc(t0 + 0.16, 0.028), sur_flanc(t0 + 0.14, 0.05), sur_flanc(t0 + 0.03, 0.05)], n_flanc, P['verre'], epaisseur=0.004, mat_tranche=P['acier']))

    # ---- Les dérives : penchées de 25° vers l'intérieur, plantées sur l'aile ; bord d'attaque lumineux ----
    cant = math.radians(25)
    profil = [(-0.03, -0.40), (-0.03, -0.96), (0.13, -0.885), (0.30, -1.04), (0.30, -0.86)]
    derive = dalle('derive', profil[::-1], 0.016, [(0.018, 0.004)], [(0.018, 0.004)], P['blindage'], mat_plateau=P['peinture2'], couper_milieu=False)
    # (Dalle dans xy : x = envergure, z = épaisseur ; le bord d'attaque va du dernier point au premier.)
    a, b = Vector(profil[-1]), Vector(profil[0])
    nl = normale_gauche(b, a)
    pts = [(a + (b - a) * (i / 6)).to_3d() + (nl * 0.002).to_3d() for i in range(7)]
    bord = filet('bord-derive', pts, [nl.to_3d()] * 7, 0.02, 0.008, P['accent'], enfoncer=0.5)
    capteur = piece('capteur-derive', lambda bm: boite(bm, (0.296, -0.95, 0), (0.014, 0.12, 0.02)), P['verre'], biseau=0.003)
    # (Une ligne de panneau sombre sur chaque face, parallèle au pied.)
    joints = piece('joint-derive', lambda bm: [boite(bm, (0.12, -0.67, sz * 0.0125), (0.006, 0.36, 0.003), Matrix.Rotation(-0.3, 3, 'Z')) for sz in (1, -1)], P['joint'])
    for o in (derive, bord, capteur, joints):
        o.rotation_euler = (0, -(math.pi / 2 + cant), 0)
        o.location = (0.66, 0, 0.008)
        figer(o)
        ob.append(o)

    # ---- Les lames de saumon : une griffe vers le bas, une crête vers le haut ; feu de position ----
    ob.append(lame('lame', [(-0.64, 0.0), (-0.79, 0.04), (-0.98, 0.04), (-1.03, 0.0), (-1.0, -0.03), (-0.97, -0.125), (-0.925, -0.125), (-0.8, -0.022)], 0.986, 0.012, P['blindageClair']))
    ob.append(piece('griffe', lambda bm: boite(bm, (0.986, -0.865, -0.0735), (0.016, 0.009, 0.13), Matrix.Rotation(-0.78, 3, 'X')), P['accentDoux']))
    ob.append(piece('feu-nav', lambda bm: boite(bm, (0.986, -0.69, 0.012), (0.02, 0.04, 0.016)), P['navVert']))

    # ---- Le ventre : patins anti-gravité lumineux, alignés sur la flèche ----
    rot = Matrix.Rotation(0.49, 3, 'Z')
    for x, y in [(0.5, -0.32), (0.76, -0.66)]:
        zb = diedre(x, -(EP_AILE / 2 + GRADINS_BAS[0][1]))
        ob.append(piece('logement', lambda bm, x=x, y=y, zb=zb: boite(bm, (x, y, zb - 0.008), (0.1, 0.24, 0.03), rot), P['carbone'], biseau=0.006))
        ob.append(piece('patin', lambda bm, x=x, y=y, zb=zb: [boite(bm, Vector((x, y, zb - 0.0235)) + rot @ Vector((0, k * 0.064, 0)), (0.07, 0.056, 0.004), rot) for k in (-1, 0, 1)], P['accent']))
    # Les carénages du pied des dérives (ils cachent la jonction avec l'aile).
    zp = diedre(0.665, z_plateau)
    cp = contour_complet([(0.0, -0.33), (0.024, -0.46), (0.024, -0.9), (0.0, -1.0)])
    pied = tailler('pied-derive', cp, zp - 0.02, zp + 0.1, flancs(cp, zp, 1.3), [], P['blindage'])
    pied.location.x = 0.665
    figer(pied)
    chanfreiner(pied, 0.003, 15, P['acier'])
    facetter(pied)
    ob.append(pied)

    # Sous le ventre : une grille d'évent et deux lames d'antenne.
    ob.append(plaque('event', [(x, y, -0.15) for x, y in [(-0.05, -0.9), (0.05, -0.9), (0.05, -1.06), (-0.05, -1.06)]], (0, 0, -1), P['joint'], epaisseur=0.004, decalage=0.0, biseau=0))
    ob.append(piece('lamelles', lambda bm: [boite(bm, (0, -0.915 - k * 0.026, -0.156), (0.09, 0.006, 0.006)) for k in range(6)], P['alliage']))
    ob.append(lame('antenne', [(-0.66, -0.12), (-0.74, -0.12), (-0.79, -0.175), (-0.765, -0.175)], 0.06, 0.006, P['blindageClair'], biseau=0.0015))

    # Les panneaux du dessous (blindage sur l'aile carbone).
    z_dessous = -(EP_AILE / 2 + GRADINS_BAS[0][1])
    marge_b = GRADINS_BAS[0][0] + 0.018
    LEb = decalee((0.98, -0.72), (0.30, 0.55), marge_b)
    TEb_int = decalee((0.35, -1.281), (0.54, -0.926), marge_b)
    TEb_dent = decalee((0.54, -0.926), (0.66, -1.15), marge_b)
    dessous_int = [croisement(LEb, L_corps_av), en_x(LEb, 0.64), en_x(TEb_dent, 0.64), croisement(TEb_dent, TEb_int), croisement(TEb_int, L_corps_ar), Vector((0.395, -0.62)), Vector((0.365, 0.0))]
    n_dessous = Vector((-(0.03 + 0.35 * z_dessous), 0, -1)).normalized()
    for a_, b_ in [(-1, 0.3), (0.316, 9)]:
        poly = couper(couper(dessous_int, pa + n_le * a_, n_le), pa + n_le * b_, -n_le)
        ob.append(plaque('dessous-aile', [(p.x, p.y, diedre(p.x, z_dessous)) for p in poly], n_dessous, P['blindage'], epaisseur=0.005, mat_tranche=P['joint']))

    # Les carénages des vérins de gouverne, sous les dents du bord de fuite.
    for x, y0, y1 in [(0.6, -0.5, -1.02), (0.83, -0.5, -0.82)]:
        zb = diedre(x, -(EP_AILE / 2 + GRADINS_BAS[0][1]))
        cr = contour_complet([(0.0, y0), (0.018, y0 - 0.1), (0.018, y1 + 0.06), (0.0, y1)])
        # (Dessous en toit renversé, qui remonte vers les deux bouts.)
        dessous_car = [(zb - 0.04, -1.2, 0), (zb - 0.04, 1.2, 0), (zb - 0.07 - 0.25 * y0, 0, 0.25), (zb - 0.07 + 0.25 * y1, 0, -0.25)]
        car = tailler('carenage', cr, zb - 0.045, zb + 0.004, [], dessous_car, P['blindageClair'])
        car.location.x = x
        figer(car)
        ob.append(car)
    ob.append(piece('logement-centre', lambda bm: boite(bm, (0, -0.5, -0.152), (0.12, 0.34, 0.03)), P['carbone'], biseau=0.006))
    ob.append(piece('patin-centre', lambda bm: boite(bm, (0, -0.5, -0.1675), (0.08, 0.28, 0.004)), P['accent']))

    # ---- Le feu arrière, entre les fentes ----
    ob.append(piece('feu-arriere', lambda bm: boite(bm, (0, -1.345, 0.035), (0.05, 0.02, 0.016)), P['feuBlanc']))

    # Tout ce qui est d'un côté est mis en miroir.
    seuls = ('coque', 'verriere', 'quille', 'vertebres', 'logement-centre', 'patin-centre', 'feu-arriere', 'event', 'lamelles')
    for o in list(ob):
        if o.name.split('.')[0] in seuls:
            continue
        appliquer(o)
        c = miroir_x(o)
        if o.name.startswith('feu-nav'):
            c.data.materials[0] = P['feuRouge']
        ob.append(c)

    def sur_aile(x, y):
        return (x, diedre(x, z_plateau) + 0.012, -y)
    points = {
        'tuyeres': [(s * (F['x0'] + F['x1']) / 2, (F['z0'] + F['z1']) / 2, -F['y'], (F['z1'] - F['z0']) * 0.75) for s in (1, -1)],
        'emetteurs': [sur_aile(0.5, -0.12), sur_aile(-0.5, -0.12), sur_aile(0.5, -0.62), sur_aile(-0.5, -0.62)],
    }
    return ob, points
