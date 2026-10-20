# PORTAL RUSH — BASTION, LE LOURD (Blender). Voir commun.py pour la chaîne et le format, vaisseaux.py pour Aube.
#
# Un char de course anti-gravité : une caisse large et basse à pans coupés entre deux flotteurs épais qui se
# relèvent en « hanches » à l'arrière, une étrave blindée en trois couches à l'avant, une verrière blindée à fente,
# et à l'arrière un bloc de quatre moteurs en carré (2 × 2) : deux gros moteurs à ailettes posés sur le pont, deux
# sous eux, dans la caisse, le tout tenu dans un cadre. Un aileron-pont posé sur les hanches, des radiateurs, des
# jupes blindées boulonnées, des chevrons de danger, des phares en fente et des feux.
# Lecture voulue : de loin, une dalle sombre et large aux plaques peintes, tendue vers l'avant ; de derrière, un
# portique (l'aileron sur ses deux flasques), quatre tuyères en carré, des radiateurs rougeoyants.

import math

import bpy  # (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh
from mathutils import Matrix, Vector

from commun import appliquer, figer, matiere, modif, objet_depuis_bmesh
from formes import boite, couronne, fuseau, miroir_x, piece, plaques, revolution, tube


# ---------------------------------------------------------------------------
# Les petits outils propres à Bastion
# ---------------------------------------------------------------------------
def anneau(demi):
    """Une section complète depuis sa moitié droite (du dessus, x = 0, au dessous, x = 0) : symétrie en X."""
    return list(demi) + [(-x, z) for x, z in reversed(demi[1:-1])]


def biseauter(ob, largeur=0.01, segments=2, angle=30):
    modif(ob, 'BEVEL', width=largeur, segments=segments, limit_method='ANGLE', angle_limit=math.radians(angle), harden_normals=True)
    appliquer(ob)
    return ob


def bloc8(bm, coins):
    """Un hexaèdre quelconque : 4 coins du bas puis 4 coins du haut (dans le même ordre)."""
    v = [bm.verts.new(c) for c in coins]
    for f in ([v[0], v[1], v[2], v[3]], [v[4], v[5], v[6], v[7]], [v[0], v[1], v[5], v[4]], [v[1], v[2], v[6], v[5]], [v[2], v[3], v[7], v[6]], [v[3], v[0], v[4], v[7]]):
        bm.faces.new(f)
    return v


def dalle_v(bm, bas, zb, haut, zh):
    """
    Une dalle en V d'un seul tenant (sans joint au milieu) depuis ses demi-polygones droits (x, y) : pointe avant
    (x = 0), deux points du bord avant, le coin arrière, le milieu arrière (x = 0). Dessus et dessous en deux moitiés
    convexes qui partagent l'arête du milieu (plane : le biseau ne la marque pas).
    """
    def anneau_v(demi, z):
        d = [bm.verts.new((x, y, z)) for x, y in demi]
        g = [bm.verts.new((-x, y, z)) for x, y in demi[1:4]]
        return d, g, [d[0], d[1], d[2], d[3], d[4], g[2], g[1], g[0]]
    db, gb, rb = anneau_v(bas, zb)
    dh, gh, rh = anneau_v(haut, zh)
    for d, g in ((db, gb), (dh, gh)):
        bm.faces.new([d[0], d[1], d[2], d[3], d[4]])
        bm.faces.new([d[0], d[4], g[2], g[1], g[0]])
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new([rb[i], rb[j], rh[j], rh[i]])


def prisme(bm, pts, axe, a0, a1):
    """Un polygone extrudé le long d'un axe : 'X' → pts en (y, z) ; 'Y' → (x, z) ; 'Z' → (x, y)."""
    def p3(p, a):
        u, v = p
        return (a, u, v) if axe == 'X' else ((u, a, v) if axe == 'Y' else (u, v, a))
    vb = [bm.verts.new(p3(p, a0)) for p in pts]
    vh = [bm.verts.new(p3(p, a1)) for p in pts]
    n = len(pts)
    bm.faces.new(vb[::-1])
    bm.faces.new(vh)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([vb[i], vb[j], vh[j], vh[i]])


def polygone_epais(bm, pts, normale, ep):
    """Un polygone plan (points 3D) épaissi le long de « normale »."""
    n = Vector(normale).normalized() * ep
    vb = [bm.verts.new(Vector(p)) for p in pts]
    vh = [bm.verts.new(Vector(p) + n) for p in pts]
    k = len(pts)
    bm.faces.new(vb[::-1])
    bm.faces.new(vh)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new([vb[i], vb[j], vh[j], vh[i]])


def _decoupe(poly, garder):
    """Sutherland–Hodgman sur un demi-plan (garder : f(u, v) → distance signée, ≥ 0 gardé), en 2D."""
    sortie = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        da, db = garder(*a), garder(*b)
        if da >= 0:
            sortie.append(a)
        if (da >= 0) != (db >= 0):
            t = da / (da - db)
            sortie.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return sortie


def sur_quad(p00, p10, p01, p11, decalage=0.0):
    """Le paramétrage (u, v) d'un quadrilatère plan, décalé le long de sa normale ; renvoie (point(u, v), normale)."""
    p00, p10, p01, p11 = (Vector(p) for p in (p00, p10, p01, p11))
    nrm = (p10 - p00).cross(p01 - p00).normalized()

    def pt(u, v):
        return (p00 + (p10 - p00) * u) * (1 - v) + (p01 + (p11 - p01) * u) * v + nrm * decalage
    return pt, nrm


def chevrons(bm, quad, n=6, pente=0.6, ep=0.004, decalage=0.003):
    """
    Des bandes obliques (chevrons de danger) sur un quadrilatère plan (p00 bas-gauche, p10 bas-droite, p01 haut-gauche,
    p11 haut-droite ; la normale (p10 − p00) × (p01 − p00) doit sortir de la face) : n périodes, une bande sur deux ;
    « pente » : décalage du haut des bandes (en largeur de quad). Bandes posées un peu au-dessus de la face.
    """
    pt, nrm = sur_quad(*quad, decalage=decalage)
    largeur = 1.0 / n
    k0 = -int(math.ceil(abs(pente) / largeur)) - 1
    for k in range(k0, n + 1):
        u0 = k * largeur
        poly = [(u0, 0.0), (u0 + largeur * 0.5, 0.0), (u0 + largeur * 0.5 + pente, 1.0), (u0 + pente, 1.0)]
        poly = _decoupe(poly, lambda u, v: u)
        poly = _decoupe(poly, lambda u, v: 1.0 - u) if poly else poly
        if len(poly) < 3:
            continue
        aire = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
        if abs(aire) < 1e-4:
            continue
        polygone_epais(bm, [pt(u, v) for u, v in poly], nrm, ep)


def bande(bm, quad, u0, u1, v0, v1, ep=0.004, decalage=0.002):
    """Un rectangle (u0..u1, v0..v1) posé sur un quadrilatère plan (phare en fente, liseré, plaque)."""
    pt, nrm = sur_quad(*quad, decalage=decalage)
    polygone_epais(bm, [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)], nrm, ep)


def aileron(nom, sections, mat):
    """
    Un aileron à profil (portance inversée) : sections le long de X : (x, y_bord_attaque, corde, epaisseur,
    z_bord_attaque, incidence en radians ; le bord de fuite monte). Volume fermé, sans subdivision.
    """
    prof = [(0.0, 0.0), (0.05, 0.42), (0.25, 0.55), (0.6, 0.42), (1.0, 0.1), (1.0, -0.06), (0.6, -0.4), (0.25, -0.5), (0.05, -0.4)]
    bm = bmesh.new()
    anneaux = []
    for x, ya, c, ep, za, inc in sections:
        ca, sa = math.cos(inc), math.sin(inc)
        anneaux.append([bm.verts.new((x, ya - u * c * ca - v * ep * sa, za + u * c * sa + v * ep * ca)) for u, v in prof])
    n = len(prof)
    for a, b in zip(anneaux, anneaux[1:]):
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new([a[j], a[k], b[k], b[j]])
    bm.faces.new(anneaux[0][::-1])
    bm.faces.new(anneaux[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return objet_depuis_bmesh(nom, bm, mat)


def le_long(chemin, pas, debut=0.0):
    """Des points régulièrement espacés le long d'une polyligne (3D) ; renvoie (point, tangente)."""
    pts = [Vector(p) for p in chemin]
    longueurs = [0.0]
    for a, b in zip(pts, pts[1:]):
        longueurs.append(longueurs[-1] + (b - a).length)
    s, res = debut, []
    while s <= longueurs[-1] + 1e-6:
        for i in range(len(pts) - 1):
            if longueurs[i] <= s <= longueurs[i + 1] + 1e-9:
                t = (s - longueurs[i]) / max(longueurs[i + 1] - longueurs[i], 1e-9)
                res.append((pts[i].lerp(pts[i + 1], t), (pts[i + 1] - pts[i]).normalized()))
                break
        s += pas
    return res


def conduite(bm, chemin, r, segments=8):
    """Un tuyau le long d'une polyligne : des tronçons de tube (les coudes se recouvrent)."""
    for a, b in zip(chemin, chemin[1:]):
        tube(bm, a, b, r, segments)


def verin(bm_corps, bm_tige, a, b, r=0.026, part=0.55):
    """Un vérin hydraulique de a à b : un corps épais (de a sur « part » de la longueur), une tige fine jusqu'à b."""
    a, b = Vector(a), Vector(b)
    m = a.lerp(b, part)
    tube(bm_corps, a, m, r, 10)
    tube(bm_corps, m - (b - a).normalized() * 0.01, m + (b - a).normalized() * 0.012, r * 1.18, 10)
    tube(bm_tige, m, b, r * 0.5, 8)


def anneau_levage(bm, centre, axe='Y', l=0.07, h=0.05, e=0.016):
    """Un anneau de levage en U (deux montants et une barre), posé sur une surface horizontale."""
    x, y, z = centre
    if axe == 'Y':
        boite(bm, (x, y - l / 2 + e / 2, z + h / 2), (e, e, h))
        boite(bm, (x, y + l / 2 - e / 2, z + h / 2), (e, e, h))
        boite(bm, (x, y, z + h - e / 2), (e, l, e))
    else:
        boite(bm, (x - l / 2 + e / 2, y, z + h / 2), (e, e, h))
        boite(bm, (x + l / 2 - e / 2, y, z + h / 2), (e, e, h))
        boite(bm, (x, y, z + h - e / 2), (l, e, e))
    boite(bm, (x, y, z + 0.004), ((l if axe != 'Y' else e) + 0.02, (l if axe == 'Y' else e) + 0.02, 0.008))


def rivet(bm, p, n, s=0.018, h=0.008):
    """Un rivet (pyramide basse, 4 triangles) posé en p sur une face de normale n."""
    n, p = Vector(n).normalized(), Vector(p)
    t = n.orthogonal().normalized()
    b = n.cross(t)
    v = [bm.verts.new(p + (t * i + b * j) * s / 2) for i, j in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    sommet = bm.verts.new(p + n * h)
    for k in range(4):
        bm.faces.new([v[k], v[(k + 1) % 4], sommet])


def rivets(nom, points, mat, s=0.018, h=0.008):
    """Un objet de rivets : points = [(position, normale), ...] (pas de recalcul des normales : surfaces ouvertes)."""
    bm = bmesh.new()
    for p, n in points:
        rivet(bm, p, n, s, h)
    return objet_depuis_bmesh(nom, bm, mat)


def tuyere_lourde(nom, P, x, z, y, r, longueur=0.18):
    """
    Une tuyère trapue (vers −Y) : grosse bague à collerette, couronne de volets convergents, intérieur chaud, cœur
    lumineux. (Comme tuyere() de vaisseaux.py, mais la couronne de volets garde sa position en Y.)
    Renvoie les objets et le point de sortie dans le repère du jeu.
    """
    bague = revolution(nom + '-bague', [(r * 1.0, y + 0.08), (r * 1.13, y + 0.06), (r * 1.15, y + 0.0), (r * 1.1, y - 0.035), (r * 0.97, y - 0.045)], P['acier'], segments=24,
                       mats_par_bande=[P['blindageClair'], P['acier'], P['alliage'], P['blindage']])

    def volet(bm):
        boite(bm, (r * 0.92, -longueur * 0.5, 0), (0.02, longueur, r * 0.44), Matrix.Rotation(-0.07, 3, 'Z'))
    volets = couronne(nom + '-volets', 12, volet, 0.0, centre=(0, y - 0.035, 0))
    volets.data.materials.append(P['tuyere'])
    chaud = revolution(nom + '-chaud', [(r * 0.9, y - 0.06), (r * 0.74, y - 0.02), (r * 0.52, y + 0.02)], P['chaud'], segments=24)
    coeur = revolution(nom + '-coeur', [(r * 0.52, y + 0.02), (r * 0.24, y + 0.03), (0.001, y + 0.03)], P['accent'], segments=16)
    objets = [bague, volets, chaud, coeur]
    for o in objets:
        o.location = (x, o.location.y, z)
    return objets, (x, z, -(y - 0.035 - longueur))


def moteur_ailette(nom, P, x, z, y_avant, y_arriere, r, nervures=4):
    """
    Un gros moteur à ailettes (le long de Y) : lèvre d'entrée d'air, carter nervuré (ailettes de refroidissement
    en anneaux), bague arrière ; dans l'entrée, un conduit sombre, des aubes et une grille de protection.
    """
    L = y_avant - y_arriere
    profil = [(r * 0.76, y_avant + 0.005), (r * 0.92, y_avant + 0.012), (r * 1.02, y_avant - 0.03), (r * 1.0, y_avant - 0.1)]
    mats = [P['alliage'], P['alliage'], P['acier']]
    y = y_avant - 0.1
    pas = (L - 0.22) / nervures
    for k in range(nervures):
        y0 = y - pas * 0.4
        profil += [(r * 1.0, y0), (r * 1.15, y0 - 0.012), (r * 1.15, y0 - pas * 0.36), (r * 1.0, y0 - pas * 0.4)]
        mats += [P['blindage'], P['acier'], P['alliage'], P['acier']]
        y -= pas
    profil += [(r * 1.03, y - 0.01), (r * 1.03, y_arriere + 0.04), (r * 0.94, y_arriere)]
    mats += [P['blindage'], P['blindageClair'], P['acier']]
    mats = mats[:len(profil) - 1]
    corps = revolution(nom + '-carter', profil, P['acier'], segments=24, mats_par_bande=mats)
    conduit = revolution(nom + '-conduit', [(r * 0.76, y_avant + 0.005), (r * 0.74, y_avant - 0.1), (r * 0.3, y_avant - 0.16)], P['joint'], segments=20)

    def aube(bm):
        boite(bm, (r * 0.4, 0, 0), (r * 0.62, 0.008, r * 0.18), Matrix.Rotation(0.55, 3, 'X'))
    aubes = couronne(nom + '-aubes', 10, aube, 0.0, centre=(0, y_avant - 0.1, 0))
    aubes.data.materials.append(P['alliage'])

    def grille(bm):
        for dz in (-0.42, 0.0, 0.42):
            boite(bm, (0, y_avant + 0.014, dz * r), (r * 1.62 * math.sqrt(max(0.0, 1 - dz * dz)), 0.014, 0.014))
        boite(bm, (0, y_avant + 0.014, 0), (0.014, 0.014, r * 1.62))
    gr = piece(nom + '-grille', grille, P['acier'])
    objets = [corps, conduit, aubes, gr]
    for o in objets:
        o.location = (x, o.location.y, z)
    return objets


# ---------------------------------------------------------------------------
# BASTION
# ---------------------------------------------------------------------------
def bastion_vaisseau(P):
    """
    BASTION : le lourd. Une caisse basse à pans coupés entre deux flotteurs épais, une étrave à trois couches, quatre
    moteurs en carré à l'arrière, un aileron-pont. Lecture : large, posé au sol, brutal, mais tendu vers l'avant (le
    profil monte de l'étrave vers les hanches et l'aileron).
    """
    P = dict(P)
    P['phare'] = matiere('phare', '#fff3dc', 0, 0.4, 1.3)            # phares fixes (pas de clignotement)
    P['stop'] = matiere('stop', '#ff2a1c', 0, 0.5, 1.1)              # feux arrière fixes
    ob = []
    seuls = set()   # les pièces centrées (pas de miroir)

    def centre(o):
        seuls.add(o.name)
        ob.append(o)
        return o

    # ======================================================================
    # La caisse : sections chanfreinées (facettes nettes, sans subdivision) ; flancs un peu rentrants en haut.
    # ======================================================================
    def section_caisse(w, zt, zb, ch=0.09, cb=0.05, crete=0.014):
        return anneau([(0, zt + crete), (w - ch, zt), (w - 0.02, zt - ch * 0.75), (w, zb + cb), (w - cb, zb), (0, zb)])
    S = [(1.62, 0.34, 0.03, -0.05, 0.05, 0.03), (1.48, 0.44, 0.10, -0.10, 0.07, 0.04), (1.10, 0.52, 0.205, -0.13, 0.085, 0.05),
         (0.78, 0.54, 0.275, -0.13, 0.09, 0.05), (-0.20, 0.54, 0.29, -0.13, 0.09, 0.05), (-1.00, 0.54, 0.285, -0.13, 0.09, 0.05),
         (-1.27, 0.52, 0.265, -0.12, 0.08, 0.05)]

    def z_pont(y):
        for (ya, _, za, *_r), (yb, _, zb_, *_s) in zip(S, S[1:]):
            if yb <= y <= ya:
                return za + (zb_ - za) * (ya - y) / (ya - yb) + 0.014
        return S[-1][2] + 0.014
    caisse_brute = fuseau('caisse', [(y, section_caisse(w, zt, zb, ch, cb)) for y, w, zt, zb, ch, cb in S], P['blindage'], subdivision=0)

    # Les plaques peintes de la caisse : glacis (de part et d'autre de la grille) et épaules.
    # (Les joints des épaules sont en chevron : y = yk − (|x| − 0.43), la pointe vers l'avant.)
    coupes = [1.42, 1.05, 0.45, -0.25, -0.85, -1.22]
    biais = (0.45, -0.25, -0.85)

    def yk(y, x):
        return y - max(0.0, abs(x) - 0.43) if y in biais else y
    plans = [((0, y, 0), (0, 1, 0)) for y in coupes if y not in biais]
    plans += [((s * 0.43, y, 0), (s * 0.7071, 0.7071, 0)) for y in biais for s in (1, -1)]
    plans += [((0.24, 0, 0), (1, 0, 0)), ((-0.24, 0, 0), (1, 0, 0)), ((0, 0, 0.19), (0, 0, 1))]

    def region_caisse(c):
        if c.y > 1.42 or c.y < -1.22 or c.z < 0.19 or abs(c.x) < 0.24:
            return None
        if c.y < 1.05 and abs(c.x) < 0.43 and c.z > 0.255:
            return None  # le dessus du pont (verrière, moteurs) reste sombre
        return (sum(1 for y in coupes if c.y < yk(y, c.x)), c.x > 0)
    centre(plaques('caisse-plaques', caisse_brute, (plans, region_caisse), P['coque'], epaisseur=0.014, jour=0.016, mat_tranche=P['joint']))
    centre(biseauter(caisse_brute, 0.012))

    # ======================================================================
    # Les flotteurs (côté droit, mis en miroir) : l'aile avant, basse, puis la hanche, plus haute et plus large.
    # ======================================================================
    xi = 0.46

    def sec_flotteur(xo, zt, zb, c1=0.075, c2=0.05):
        return [(xi, zt), (xo - c1, zt), (xo, zt - c1 * 0.8), (xo + 0.012, zb + c2), (xo + 0.012 - c2, zb), (xi, zb)]
    SF = [(1.46, 0.70, 0.03, -0.08), (1.34, 0.78, 0.065, -0.12), (1.10, 0.83, 0.085, -0.14), (0.40, 0.87, 0.10, -0.14),
          (0.16, 0.945, 0.19, -0.14), (-1.16, 0.955, 0.19, -0.14), (-1.32, 0.925, 0.18, -0.13), (-1.44, 0.83, 0.15, -0.11)]

    def zf(y):
        """Le dessus du flotteur à l'abscisse y."""
        for (ya, _, za, _a), (yb, _, zb_, _b) in zip(SF, SF[1:]):
            if yb <= y <= ya:
                return za + (zb_ - za) * (ya - y) / (ya - yb)
        return SF[-1][2]

    def xof(y):
        """Le bord extérieur du flotteur à l'abscisse y."""
        for (ya, xa, _, _a), (yb, xb, _, _b) in zip(SF, SF[1:]):
            if yb <= y <= ya:
                return xa + (xb - xa) * (ya - y) / (ya - yb)
        return SF[-1][1]
    flot_brut = fuseau('flotteur', [(y, sec_flotteur(xo, zt, zb)) for y, xo, zt, zb in SF], P['blindage'], subdivision=0)
    # (y du joint au bord intérieur, pente du joint : y = y0 − pente·(x − 0.57)) ; la marche (0.40 → 0.16) reste sombre.
    coupes_f = [(1.18, 0.0), (0.92, 0.6), (0.62, 0.6), (0.40, 0.0), (0.16, 0.0), (-0.29, 0.0)]
    plans_f = [((0.57, y, 0), Vector((pente, 1, 0)).normalized()) for y, pente in coupes_f] + [((0.57, 0, 0), (1, 0, 0))]

    def region_flotteur(type_):
        def f(c):
            if c.y > 1.18 or c.y < -0.29 or 0.16 < c.y < 0.40:
                return None
            b = sum(1 for y, pente in coupes_f if c.y < y - pente * (c.x - 0.57))
            dessus = c.z > zf(c.y) - 0.012 and 0.57 < c.x < xof(c.y) - 0.07
            chanfrein = c.x > xof(c.y) - 0.07 and c.z > zf(c.y) - 0.07
            if type_ == 'dessus' and dessus:
                return ('dessus', b)
            if type_ == 'chanfrein' and chanfrein and not dessus:
                return ('chanfrein', b)
            return None
        return f
    ob.append(plaques('flotteur-dessus', flot_brut, (plans_f, region_flotteur('dessus')), P['coque'], epaisseur=0.014, jour=0.016, mat_tranche=P['joint']))
    ob.append(plaques('flotteur-chanfrein', flot_brut, (plans_f, region_flotteur('chanfrein')), P['peinture2'], epaisseur=0.012, jour=0.016, mat_tranche=P['joint']))
    ob.append(biseauter(flot_brut, 0.012))

    # Les jupes blindées : des panneaux inclinés (le bas vers l'extérieur) accrochés au flanc, boulonnés en haut.
    # Chaque jupe : (y avant haut, y avant bas, y arrière haut, y arrière bas, z bas, z haut) ; x suit le flanc (un peu
    # enfoncé), le bas sort de 13 mm. Les arêtes avant/arrière sont fuyantes (35°), parallèles à la marche de la hanche.
    R = 0.7   # (dy par dz des arêtes fuyantes)
    zj = zf(1.2) - 0.022
    JUPES = [(1.20, 1.20 - (zj + 0.115) * 0.4, 0.32, 0.32 + (zj + 0.115) * R, -0.115, zj),
             (0.14, 0.14 + 0.285 * R, -0.50, -0.50, -0.12, 0.165),
             (-0.54, -0.54, -1.24, -1.20, -0.12, 0.165)]
    EJ = 0.024

    def xj(y):
        return xof(y) - 0.01

    def jupes(bm):
        for y0, y0b, y1, y1b, zb, zh in JUPES:
            bloc8(bm, [(xj(y0b) + 0.013, y0b, zb), (xj(y1b) + 0.013, y1b, zb), (xj(y1), y1, zh), (xj(y0), y0, zh),
                       (xj(y0b) + 0.013 + EJ, y0b, zb), (xj(y1b) + 0.013 + EJ, y1b, zb), (xj(y1) + EJ, y1, zh), (xj(y0) + EJ, y0, zh)])
    ob.append(biseauter(piece('jupes', jupes, P['coque']), 0.006, 2))

    def jupes_bords(bm):
        # (Le bas des jupes : une bande sombre d'usure, un peu en saillie.)
        for y0, y0b, y1, y1b, zb, zh in JUPES:
            x0, x1 = xj(y0b) + 0.013 + EJ * 0.5, xj(y1b) + 0.013 + EJ * 0.5
            a, b = y0b - 0.004, y1b + 0.004
            bloc8(bm, [(x0 - 0.02, a, zb - 0.004), (x1 - 0.02, b, zb - 0.004), (x1 + 0.02, b, zb - 0.004), (x0 + 0.02, a, zb - 0.004),
                       (x0 - 0.02, a - 0.02 * R, zb + 0.03), (x1 - 0.02, b + 0.02 * R * (y1b != y1), zb + 0.03), (x1 + 0.02, b + 0.02 * R * (y1b != y1), zb + 0.03), (x0 + 0.02, a - 0.02 * R, zb + 0.03)])
    ob.append(biseauter(piece('jupes-bords', jupes_bords, P['blindage']), 0.005, 1))

    pts_j = []
    for y0, y0b, y1, y1b, zb, zh in JUPES:
        n = max(3, int(round((y0 - y1) / 0.15)))
        for k in range(n + 1):
            y = y0 - 0.05 - (y0 - y1 - 0.1) * k / n
            pts_j.append(((xj(y) + EJ + 0.0025, y, zh - 0.024), (1, 0, -0.1)))
    ob.append(rivets('jupes-rivets', pts_j, P['alliage']))

    def jupes_pattes(bm):
        for y0, y0b, y1, y1b, zb, zh in JUPES:
            for t in (0.25, 0.75):
                y = y0 + (y1 - y0) * t
                boite(bm, (xj(y) + 0.004, y, zh - 0.004), (0.035, 0.05, 0.03))
    ob.append(piece('jupes-pattes', jupes_pattes, P['blindage']))

    # La fente d'aération entre l'aile avant et la hanche : des lames fuyantes sur le flanc.
    def lames_flanc(bm):
        for k in range(3):
            yc = 0.33 + k * 0.045
            boite(bm, (xof(yc) + 0.012, yc, 0.0), (0.02, 0.016, 0.22), Matrix.Rotation(math.atan(R), 3, 'X'))
    ob.append(piece('lames-flanc', lames_flanc, P['acier']))

    # Les patins anti-gravité sous les flotteurs : logements sombres, plaques lumineuses.
    def logements(bm):
        for y0, y1 in [(1.05, 0.45), (-0.4, -1.05)]:
            boite(bm, (0.72, (y0 + y1) / 2, -0.152), (0.3, y0 - y1, 0.04))
    ob.append(biseauter(piece('patins-logements', logements, P['carbone']), 0.01, 1))

    def patins(bm):
        for y0, y1 in [(1.05, 0.45), (-0.4, -1.05)]:
            boite(bm, (0.72, (y0 + y1) / 2, -0.173), (0.22, y0 - y1 - 0.08, 0.006))
    ob.append(piece('patins', patins, P['accent']))

    # Les radiateurs sur les hanches : un cadre, des ailettes inclinées, une lueur (couleur du cœur) entre elles.
    zh_ = 0.19

    def cadre_rad(bm):
        boite(bm, (0.715, -0.73, zh_ + 0.012), (0.3, 0.86, 0.024))
        boite(bm, (0.57, -0.73, zh_ + 0.045), (0.022, 0.86, 0.09))
        boite(bm, (0.86, -0.73, zh_ + 0.045), (0.022, 0.86, 0.09))
        for y in (-0.30, -1.16):
            boite(bm, (0.715, y, zh_ + 0.045), (0.31, 0.022, 0.09))
    ob.append(piece('radiateur-cadre', cadre_rad, P['carbone']))

    def ailettes(bm):
        for k in range(14):
            boite(bm, (0.715, -0.35 - k * 0.0585, zh_ + 0.05), (0.268, 0.012, 0.075), Matrix.Rotation(0.35, 3, 'X'))
    ob.append(piece('radiateur-ailettes', ailettes, P['alliage']))
    ob.append(piece('radiateur-lueur', lambda bm: boite(bm, (0.715, -0.73, zh_ + 0.026), (0.268, 0.84, 0.006)), P['coeur']))

    # Les ouïes de la marche entre l'aile avant et la hanche (l'entrée d'air des radiateurs).
    def ouies_marche(bm):
        for k in range(4):
            t = 0.17 + k * 0.22
            boite(bm, (0.70, 0.40 - 0.24 * t, 0.10 + 0.09 * t + 0.012), (0.24, 0.014, 0.045), Matrix.Rotation(0.5, 3, 'X'))
    ob.append(piece('ouies-marche', ouies_marche, P['acier']))

    # Les coffres blindés sur les ailes avant (le « porteur lourd ») : caisson à pans coupés, charnière, loquets jaunes.
    def coffre(bm):
        y0, y1, x0, x1 = 0.96, 0.56, 0.645, 0.775
        z0, z1 = zf(y0) + 0.01, zf(y1) + 0.01
        h = 0.055
        bloc8(bm, [(x0, y0, z0), (x1, y0, z0), (x1, y1, z1), (x0, y1, z1),
                   (x0 + 0.012, y0 - 0.02, z0 + h), (x1 - 0.012, y0 - 0.02, z0 + h), (x1 - 0.012, y1 + 0.02, z1 + h), (x0 + 0.012, y1 + 0.02, z1 + h)])
    ob.append(biseauter(piece('coffre', coffre, P['blindageClair']), 0.008, 1))

    def coffre_details(bm):
        for y in (0.86, 0.66):
            boite(bm, (0.769, y, zf(y) + 0.045), (0.012, 0.045, 0.03))        # les loquets
        boite(bm, (0.648, 0.76, zf(0.76) + 0.058), (0.014, 0.34, 0.012))        # la charnière
    ob.append(piece('coffre-loquets', coffre_details, P['jaune']))

    # Les conduites dans la gouttière (refroidissement vers les radiateurs) et leurs colliers.
    def conduites(bm):
        conduite(bm, [(0.58, 1.12, 0.06), (0.58, 1.02, 0.118), (0.58, 0.42, 0.118), (0.58, 0.16, 0.19), (0.58, -0.3, 0.19)], 0.019, 7)
        conduite(bm, [(0.618, 0.96, 0.08), (0.618, 0.9, 0.114), (0.618, 0.42, 0.114), (0.618, 0.16, 0.184), (0.618, -0.3, 0.184)], 0.012, 6)
    ob.append(piece('conduites', conduites, P['acier']))

    def colliers(bm):
        for y in (0.85, 0.6):
            boite(bm, (0.598, y, 0.118), (0.085, 0.024, 0.05))
        for y in (0.0, -0.18):
            boite(bm, (0.598, y, 0.19), (0.085, 0.024, 0.05))
    ob.append(piece('colliers', colliers, P['blindageClair']))

    # Les vérins de l'aileron (aérodynamique active) : de l'épaule de la caisse au dessous du plan.
    bm_c, bm_t = bmesh.new(), bmesh.new()
    verin(bm_c, bm_t, (0.53, -0.86, 0.24), (0.53, -1.20, 0.50), r=0.022, part=0.5)
    ob.append(objet_depuis_bmesh('verins-aileron-corps', bm_c, P['blindageClair']))
    ob.append(objet_depuis_bmesh('verins-aileron-tiges', bm_t, P['alliage']))
    ob.append(piece('verins-aileron-pieds', lambda bm: (boite(bm, (0.53, -0.86, 0.24), (0.06, 0.07, 0.04)), boite(bm, (0.53, -1.20, 0.505), (0.05, 0.06, 0.03))), P['blindage']))

    # Les anneaux de levage (jaunes) : à l'avant des ailes, à l'arrière des hanches.
    def levage(bm):
        anneau_levage(bm, (0.70, 1.18, zf(1.18) - 0.004), 'X', 0.08, 0.05)
        anneau_levage(bm, (0.70, -1.27, zf(-1.27) - 0.002), 'X', 0.08, 0.05)
    ob.append(piece('levage', levage, P['jaune']))

    # Les feux arrière des hanches : barre de stop, feu à éclats, panneau à chevrons.
    yr = -1.44
    ob.append(piece('feu-stop', lambda bm: boite(bm, (0.735, yr - 0.004, 0.035), (0.13, 0.012, 0.035)), P['stop']))
    ob.append(piece('arriere-panneau', lambda bm: boite(bm, (0.575, yr - 0.006, -0.02), (0.17, 0.012, 0.13)), P['jaune']))
    ob.append(piece('arriere-chevrons', lambda bm: chevrons(bm, ((0.49, yr - 0.012, -0.085), (0.66, yr - 0.012, -0.085), (0.49, yr - 0.012, 0.045), (0.66, yr - 0.012, 0.045)), n=4, pente=0.35, ep=0.003, decalage=0.0), P['blindage']))
    # (Le coin coupé : un feu enveloppant, à éclats.)
    coin = ((0.83, -1.44, 0.0), (0.925, -1.32, 0.0), (0.83, -1.44, 0.11), (0.925, -1.32, 0.11))
    ob.append(piece('feu-coin', lambda bm: bande(bm, coin, 0.15, 0.85, 0.35, 0.75, ep=0.006, decalage=0.0), P['feuRouge']))

    # ======================================================================
    # L'étrave : trois couches de blindage en V (facettes), la couche du haut aux chevrons, des phares en fente.
    # ======================================================================
    def couche(ya, xe, ye, recul_c, recul_e, zb, zh, retrait):
        bas = [(0, ya), (0.40, ya - 0.17), (xe, ye), (xe, ye - recul_e), (0, ya - recul_c)]
        haut = [(0, ya - retrait), (0.40 - retrait * 0.3, ya - 0.17 - retrait), (xe - 0.01, ye - retrait), (xe - 0.01, ye - recul_e), (0, ya - recul_c)]
        return bas, zb, haut, zh
    C1 = couche(1.96, 0.81, 1.42, 0.47, 0.22, -0.155, -0.06, 0.08)
    C2 = couche(1.86, 0.79, 1.38, 0.40, 0.20, -0.06, 0.03, 0.04)
    C3 = couche(1.76, 0.71, 1.34, 0.34, 0.17, 0.03, 0.115, 0.04)
    centre(biseauter(piece('etrave1', lambda bm: dalle_v(bm, *C1), P['blindage']), 0.014))
    centre(biseauter(piece('etrave2', lambda bm: dalle_v(bm, *C2), P['coque']), 0.01))
    centre(biseauter(piece('etrave3', lambda bm: dalle_v(bm, *C3), P['jaune']), 0.01))

    def face_avant(C, i, marge=0.008):
        """Le quadrilatère de la face avant du pan i d'une couche (orienté vers l'extérieur)."""
        bas, zb, haut, zh = C
        a, b, ah, bh = bas[i], bas[i + 1], haut[i], haut[i + 1]
        return ((b[0], b[1], zb + marge), (a[0], a[1], zb + marge), (bh[0], bh[1], zh - marge), (ah[0], ah[1], zh - marge))

    def chevrons_etrave(bm):
        chevrons(bm, face_avant(C3, 0), n=5, pente=0.22, ep=0.003, decalage=0.002)
        chevrons(bm, face_avant(C3, 1), n=4, pente=0.22, ep=0.003, decalage=0.002)
    ob.append(piece('etrave-chevrons', chevrons_etrave, P['blindage']))

    # Les phares : deux fentes lumineuses sur la face avant de la couche peinte, dans un liseré sombre.
    def phares_cadre(bm):
        bande(bm, face_avant(C2, 0, 0.0), 0.08, 0.62, 0.2, 0.8, ep=0.004, decalage=0.001)
        bande(bm, face_avant(C2, 1, 0.0), 0.5, 0.92, 0.2, 0.8, ep=0.004, decalage=0.001)
    ob.append(piece('phares-cadre', phares_cadre, P['carbone']))

    def phares(bm):
        bande(bm, face_avant(C2, 0, 0.0), 0.11, 0.59, 0.36, 0.64, ep=0.004, decalage=0.004)
        bande(bm, face_avant(C2, 1, 0.0), 0.53, 0.89, 0.36, 0.64, ep=0.004, decalage=0.004)
    ob.append(piece('phares', phares, P['phare']))

    # Le tranchant : une bande d'acier poli au bas de la face avant de la couche basse.
    def tranchant(bm):
        for i in range(2):
            bande(bm, face_avant(C1, i, 0.004), 0.0, 1.0, 0.0, 0.32, ep=0.004, decalage=0.001)
    ob.append(piece('etrave-tranchant', tranchant, P['alliage']))

    # Les rivets des couches 1 et 2 : une rangée le long du bord avant.
    pts_e = []
    for (bas, zb, haut, zh), recul in ((C1, 0.05), (C2, 0.045)):
        chemin = [(x, y - recul, zh) for x, y in haut[:3]]
        pts_e += [(p, (0, 0, 1)) for p, t in le_long(chemin, 0.12, 0.05)]
    ob.append(rivets('etrave-rivets', pts_e, P['alliage'], s=0.02, h=0.009))

    # Les crochets de remorquage sous la couche peinte.
    def crochets(bm):
        boite(bm, (0.30, 1.66, -0.075), (0.05, 0.10, 0.04))
        boite(bm, (0.30, 1.71, -0.045), (0.05, 0.03, 0.05))
    ob.append(biseauter(piece('crochets', crochets, P['jaune']), 0.006, 1))

    # Les amortisseurs de l'étrave : courts et raides, d'une tour sur le glacis à une chape sur la couche du haut.
    bm_c, bm_t = bmesh.new(), bmesh.new()
    verin(bm_c, bm_t, (0.36, 1.215, 0.225), (0.37, 1.36, 0.125), r=0.03, part=0.5)
    ob.append(objet_depuis_bmesh('verins-etrave-corps', bm_c, P['acier']))
    ob.append(objet_depuis_bmesh('verins-etrave-tiges', bm_t, P['alliage']))

    def chapes(bm):
        boite(bm, (0.36, 1.205, 0.20), (0.075, 0.07, 0.065))                     # la tour sur le glacis
        for dx in (-0.03, 0.03):
            boite(bm, (0.37 + dx, 1.36, 0.135), (0.014, 0.06, 0.05))            # la chape en U sur la lame
    ob.append(piece('verins-etrave-chapes', chapes, P['blindage']))

    # La grille du glacis : un logement sombre en saillie, des lames.
    za, zb_ = z_pont(1.40), z_pont(1.06)

    def logement_grille(bm):
        bloc8(bm, [(-0.2, 1.40, za - 0.01), (0.2, 1.40, za - 0.01), (0.2, 1.06, zb_ - 0.01), (-0.2, 1.06, zb_ - 0.01),
                   (-0.2, 1.40, za + 0.022), (0.2, 1.40, za + 0.022), (0.2, 1.06, zb_ + 0.022), (-0.2, 1.06, zb_ + 0.022)])
    centre(biseauter(piece('grille-logement', logement_grille, P['carbone']), 0.008, 1))

    def lames(bm):
        for k in range(7):
            t = (k + 0.5) / 7
            y = 1.38 - t * 0.30
            boite(bm, (0, y, z_pont(y) + 0.03), (0.36, 0.012, 0.03), Matrix.Rotation(-0.6, 3, 'X'))
    centre(piece('grille-lames', lames, P['acier']))

    # ======================================================================
    # La verrière blindée : une coque de verre, un casque de blindage (toit peint, bas clair), une fente entre les deux.
    # ======================================================================
    def sec_verriere(wb, wt, zt, zbase=0.22, d=0.0):
        return anneau([(0, zt + 0.014 - d), (wt - d, zt - d), (wb - d, zt - 0.1), (wb - d, zbase), (0, zbase)])
    SV = [(0.94, 0.25, 0.18, 0.30), (0.76, 0.29, 0.20, 0.43), (0.36, 0.30, 0.21, 0.465), (0.02, 0.29, 0.20, 0.45), (-0.12, 0.26, 0.17, 0.37)]
    centre(fuseau('verriere', [(y, sec_verriere(wb, wt, zt, d=0.008)) for y, wb, wt, zt in SV], P['verre'], subdivision=0))
    casque = fuseau('casque-brut', [(y, sec_verriere(wb, wt, zt)) for y, wb, wt, zt in SV], P['blindage'], subdivision=0)
    plans_v = [((0, 0, 0.352), (0, 0, 1)), ((0, 0, 0.402), (0, 0, 1)), ((0, 0.5, 0), (0, 1, 0)), ((0.07, 0, 0), (1, 0, 0)), ((-0.07, 0, 0), (1, 0, 0))]

    def toit(type_):
        def f(c):
            if c.z <= 0.402:
                return None
            milieu = abs(c.x) < 0.07 and c.z > 0.44
            if (type_ == 'bande') != milieu:
                return None
            return (type_, c.y > 0.5, round(c.x / 0.2) if not milieu else 0)
        return f
    centre(plaques('casque-toit', casque, (plans_v, toit('toit')), P['coque'], epaisseur=0.02, jour=0.014, mat_tranche=P['joint']))
    centre(plaques('casque-bande', casque, (plans_v, toit('bande')), P['peinture2'], epaisseur=0.026, jour=0.014, mat_tranche=P['joint']))
    centre(plaques('casque-bas', casque, (plans_v, lambda c: 'bas' if c.z < 0.352 else None), P['blindageClair'], epaisseur=0.02, jour=0.006, mat_tranche=P['blindage']))
    bpy.data.objects.remove(casque)

    # Les montants de la fente (la vue découpée en meurtrières).
    def montants(bm):
        for x in (0.0, 0.12, -0.12):
            boite(bm, (x, 0.835, 0.377), (0.03, 0.1, 0.025), Matrix.Rotation(-0.62, 3, 'X'))
        for y in (0.55, 0.2):
            for s in (1, -1):
                boite(bm, (s * 0.287, y, 0.378), (0.03, 0.03, 0.06))
    centre(piece('montants', montants, P['blindage']))

    # ======================================================================
    # Le bloc moteur : deux gros moteurs à ailettes sur le pont, deux autres dessous, dans la caisse ; un cadre.
    # ======================================================================
    XM = 0.25
    ZH, ZL = 0.325, 0.02
    ob += moteur_ailette('moteur-haut', P, XM, ZH, -0.26, -1.40, 0.155, nervures=4)
    tu_h, pt_h = tuyere_lourde('tuyere-haut', P, XM, ZH, -1.42, 0.125, longueur=0.13)
    ob += tu_h
    bas = revolution('moteur-bas', [(0.14, -1.18), (0.14, -1.27), (0.152, -1.28), (0.152, -1.33), (0.14, -1.335), (0.135, -1.40)], P['acier'], segments=24,
                     mats_par_bande=[P['blindageClair'], P['alliage'], P['acier'], P['blindage'], P['acier']])
    bas.location = (XM, 0, ZL)
    ob.append(bas)
    tu_b, pt_b = tuyere_lourde('tuyere-bas', P, XM, ZL, -1.42, 0.115, longueur=0.13)
    ob += tu_b

    # L'épine centrale entre les moteurs du haut : poutre à ouïes ; un pylône porte le milieu de l'aileron.
    def epine(bm):
        bloc8(bm, [(-0.075, -0.12, 0.27), (0.075, -0.12, 0.27), (0.075, -1.32, 0.27), (-0.075, -1.32, 0.27),
                   (-0.055, -0.2, 0.36), (0.055, -0.2, 0.36), (0.055, -1.32, 0.43), (-0.055, -1.32, 0.43)])
    centre(biseauter(piece('epine', epine, P['blindage']), 0.008, 2))

    def ouies(bm):
        for k in range(5):
            y = -0.42 - k * 0.12
            z = 0.36 + (0.43 - 0.36) * ((-0.2 - y) / 1.12) + 0.006
            boite(bm, (0, y, z), (0.08, 0.035, 0.012))
    centre(piece('epine-ouies', ouies, P['carbone']))

    def pylone(bm):
        bloc8(bm, [(-0.022, -0.98, 0.39), (0.022, -0.98, 0.39), (0.022, -1.28, 0.40), (-0.022, -1.28, 0.40),
                   (-0.022, -1.13, 0.53), (0.022, -1.13, 0.53), (0.022, -1.30, 0.53), (-0.022, -1.30, 0.53)])
    centre(biseauter(piece('pylone', pylone, P['blindageClair']), 0.005, 1))

    # La face arrière : un fond sombre, et le cadre en croix qui tient les quatre tuyères en bloc.
    centre(biseauter(piece('cadre-fond', lambda bm: boite(bm, (0, -1.265, 0.07), (1.0, 0.04, 0.36)), P['carbone']), 0.01, 1))

    def cadre(bm):
        y0, ep = -1.355, 0.045
        boite(bm, (0, y0, 0.172), (0.94, ep, 0.034))                 # la traverse entre les étages
        boite(bm, (0, y0, -0.105), (0.94, ep, 0.04))                 # la traverse basse
        boite(bm, (0, y0, 0.20), (0.07, ep, 0.62))                   # le montant central
        for s in (1, -1):
            boite(bm, (s * 0.445, y0, 0.18), (0.05, ep, 0.6))         # les montants latéraux
    centre(biseauter(piece('cadre', cadre, P['blindageClair']), 0.008, 1))

    pts_c = [((s * 0.445, -1.3775, z), (0, -1, 0)) for s in (1, -1) for z in (-0.06, 0.1, 0.25, 0.42)] + [((x, -1.3775, 0.172), (0, -1, 0)) for x in (-0.15, 0.15)]
    centre(rivets('cadre-rivets', pts_c, P['alliage']))
    centre(piece('stop-central', lambda bm: boite(bm, (0, -1.38, 0.30), (0.03, 0.008, 0.2)), P['stop']))
    centre(piece('stop-central-bas', lambda bm: boite(bm, (0, -1.38, 0.03), (0.03, 0.008, 0.12)), P['stop']))

    # ======================================================================
    # L'aileron-pont : un plan peint et un volet sombre entre deux flasques posées sur les hanches.
    # ======================================================================
    XA = 0.865
    xs = [-XA, -0.45, 0.0, 0.45, XA]
    ob.append(biseauter(aileron('aileron', [(x, -1.12, 0.26, 0.046, 0.515, 0.12) for x in (0.19, 0.5, XA)], P['peinture2']), 0.004, 1))
    ob.append(piece('aileron-joint', lambda bm: boite(bm, (0.5, -1.25, 0.531), (0.014, 0.275, 0.058), Matrix.Rotation(0.12, 3, 'X')), P['carbone']))
    centre(biseauter(aileron('aileron-caisson', [(x, -1.10, 0.30, 0.075, 0.503, 0.12) for x in (-0.2, 0.2)], P['blindage']), 0.006, 1))
    centre(biseauter(aileron('aileron-volet', [(x, -1.385, 0.125, 0.03, 0.542, 0.30) for x in xs], P['carbone']), 0.003, 1))

    # Les flasques « en botte » : un plan haut peint qui tient la corde de l'aileron, un mât sombre incliné qui
    # descend sur la hanche.
    def flasque(bm):
        prisme(bm, [(-1.05, 0.45), (-1.08, 0.59), (-1.55, 0.59), (-1.53, 0.43), (-1.32, 0.40)], 'X', XA - 0.005, XA + 0.025)
    ob.append(biseauter(piece('flasque', flasque, P['coque']), 0.006, 2))

    def flasque_mat(bm):
        prisme(bm, [(-0.96, zh_ - 0.02), (-1.09, 0.47), (-1.33, 0.44), (-1.24, zh_ - 0.02)], 'X', XA - 0.0, XA + 0.02)
    ob.append(biseauter(piece('flasque-mat', flasque_mat, P['blindageClair']), 0.006, 2))

    def flasque_bord(bm):
        # (Le bord de fuite de la flasque : un liseré lumineux, la seule ligne de lueur à l'arrière.)
        tube(bm, (XA + 0.01, -1.546, 0.582), (XA + 0.01, -1.527, 0.44), 0.009, 6)
    ob.append(piece('flasque-liseré', flasque_bord, P['accentDoux']))

    def flasque_pied(bm):
        boite(bm, (XA + 0.01, -1.10, zh_ + 0.02), (0.07, 0.34, 0.04))
    ob.append(biseauter(piece('flasque-pied', flasque_pied, P['blindage']), 0.008, 1))
    ob.append(rivets('flasque-rivets', [((XA + 0.01 + s * 0.026, y, zh_ + 0.04), (0, 0, 1)) for y in (-0.97, -1.07, -1.17) for s in (1, -1)] + [((XA + 0.03, y, 0.52), (1, 0, 0)) for y in (-1.15, -1.3, -1.45)], P['alliage']))

    # L'antenne (un fouet, à droite derrière la verrière).
    centre(piece('antenne', lambda bm: (tube(bm, (0.2, -0.08, 0.37), (0.21, -0.12, 0.6), 0.006, 6), boite(bm, (0.2, -0.08, 0.37), (0.04, 0.04, 0.025))), P['acier']))

    # ======================================================================
    # Le miroir : tout ce qui est d'un côté est dupliqué (transformations inscrites avant).
    # ======================================================================
    for o in list(ob):
        appliquer(o)
        figer(o)
        if o.name in seuls:
            continue
        ob.append(miroir_x(o))

    points = {
        'tuyeres': [(pt_h[0], pt_h[1], pt_h[2], 0.125), (-pt_h[0], pt_h[1], pt_h[2], 0.125), (pt_b[0], pt_b[1], pt_b[2], 0.115), (-pt_b[0], pt_b[1], pt_b[2], 0.115)],
        # (Repère du jeu : x, z Blender, −y Blender.) Sur le dessus des flotteurs : l'aile avant et le devant de la hanche.
        'emetteurs': [(0.72, zf(1.06) + 0.014 + 0.0125, -1.06), (-0.72, zf(1.06) + 0.014 + 0.0125, -1.06), (0.72, zf(0.0) + 0.014 + 0.0125, 0.0), (-0.72, zf(0.0) + 0.014 + 0.0125, 0.0)],
    }
    return ob, points
