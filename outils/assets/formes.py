# PORTAL RUSH — LES OUTILS DE MODÉLISATION (Blender, bmesh). Voir commun.py.
#
# Des formes « de studio », pas des primitives : coques par sections lissées par subdivision avec arêtes vives
# (plis), plaques de blindage découpées sur la coque elle-même (avec des jours réguliers entre elles), pièces de
# révolution (nacelles, tuyères), ailes à profil, verrières, et petits détails mécaniques.

import math

import bpy  # (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh
from mathutils import Matrix, Vector

from commun import ajouter_matiere, appliquer, modif, objet_depuis_bmesh


def coque(nom, sections, mat, plis=(), subdivision=2, miroir=True):
    """
    Une coque par sections transversales (le long de Y). Chaque section : (y, [(x, z), ...]) — la moitié droite,
    du dessus (x = 0) au dessous (x = 0). « plis » : indices des points dont la ligne longitudinale reste vive
    (pli de subdivision). Miroir en X, puis subdivision.
    """
    bm = bmesh.new()
    pli = bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
    anneaux = [[bm.verts.new((x, y, z)) for (x, z) in pts] for y, pts in sections]
    for a, b in zip(anneaux, anneaux[1:]):
        for j in range(len(a) - 1):
            bm.faces.new([a[j], a[j + 1], b[j + 1], b[j]])
    for anneau in (anneaux[0], anneaux[-1]):
        if len(anneau) > 2:
            bm.faces.new(anneau)
    bm.edges.ensure_lookup_table()
    for a, b in zip(anneaux, anneaux[1:]):
        for k in plis:
            e = bm.edges.get([a[k], b[k]])
            if e:
                e[pli] = 1.0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = objet_depuis_bmesh(nom, bm, mat)
    if miroir:
        modif(ob, 'MIRROR', use_clip=True, use_mirror_merge=True, merge_threshold=0.001)
    if subdivision:
        modif(ob, 'SUBSURF', levels=subdivision, render_levels=subdivision)
    appliquer(ob)
    retourner_si_interieur(ob)
    return ob


def retourner_si_interieur(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data)
    bm.free()


def revolution(nom, profil, mat, segments=32, axe='Y', centre=(0, 0, 0), mats_par_bande=None):
    """
    Une pièce de révolution autour de l'axe Y (profil : [(rayon, y), ...]). « mats_par_bande » : une matière par
    bande du profil (sinon « mat » partout). Renvoie l'objet (sans modificateur).
    """
    bm = bmesh.new()
    anneaux = []
    for r, y in profil:
        anneau = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            anneau.append(bm.verts.new((r * math.cos(a), y, r * math.sin(a))))
        anneaux.append(anneau)
    faces_bandes = []
    for a, b in zip(anneaux, anneaux[1:]):
        fs = []
        for i in range(segments):
            j = (i + 1) % segments
            fs.append(bm.faces.new([a[i], a[j], b[j], b[i]]))
        faces_bandes.append(fs)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = objet_depuis_bmesh(nom, bm, mat)
    if mats_par_bande:
        idx = {}
        for k, m in enumerate(mats_par_bande):
            if m is None:
                continue
            idx[k] = ajouter_matiere(ob, m)
        # (Les faces sont dans l'ordre de création : bande par bande.)
        for k in range(len(profil) - 1):
            if k in idx:
                for i in range(segments):
                    ob.data.polygons[k * segments + i].material_index = idx[k]
    ob.location = centre
    if axe == 'Z':
        ob.rotation_euler = (math.pi / 2, 0, 0)
    return ob


def couronne(nom, nombre, construire, rayon, centre=(0, 0, 0), axe='Y', decalage=0.0):
    """Répète « construire(bm) » (une pièce autour de l'origine) en couronne autour de l'axe Y."""
    bm = bmesh.new()
    for i in range(nombre):
        tmp = bmesh.new()
        construire(tmp)
        a = 2 * math.pi * i / nombre + decalage
        m = Matrix.Rotation(a, 4, 'Y') @ Matrix.Translation((rayon, 0, 0))
        bmesh.ops.transform(tmp, matrix=m, verts=tmp.verts[:])
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    ob = objet_depuis_bmesh(nom, bm)
    ob.location = centre
    return ob


def boite(bm, centre, taille, rotation=None):
    """Ajoute un pavé au bmesh (centre, taille (lx, ly, lz)) ; rotation : Matrix 3×3 facultative."""
    r = bmesh.ops.create_cube(bm, size=1.0)
    m = Matrix.Diagonal((*taille, 1.0))
    if rotation is not None:
        m = rotation.to_4x4() @ m
    m = Matrix.Translation(centre) @ m
    bmesh.ops.transform(bm, matrix=m, verts=r['verts'])
    return r


def piece(nom, construire, mat, biseau=0.0, segments=1, lisser_angle=None):
    """Un objet construit par « construire(bm) », avec un biseau (modificateur) éventuel."""
    bm = bmesh.new()
    construire(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = objet_depuis_bmesh(nom, bm, mat)
    if biseau > 0:
        modif(ob, 'BEVEL', width=biseau, segments=segments, limit_method='ANGLE', angle_limit=math.radians(30), harden_normals=True)
    return ob


def plaques(nom, source, regions, mat, epaisseur=0.012, jour=0.012, mat_tranche=None, biseau=0.004):
    """
    Des plaques de blindage posées sur la coque « source » : la coque est recoupée par des plans, chaque région
    (fonction du centre d'une face → identifiant de plaque, ou None) devient une plaque, rétrécie pour laisser un
    jour régulier avec ses voisines, épaissie vers l'extérieur ; sa tranche peut recevoir une autre matière
    (« mat_tranche » : joint sombre, ou liseré lumineux).
    regions : (plans, classer) — plans : [(point, normale)], classer : f(Vector) → clé ou None.
    """
    plans, classer = regions
    bm = bmesh.new()
    bm.from_mesh(source.data)
    bmesh.ops.transform(bm, matrix=source.matrix_world, verts=bm.verts[:])
    for co, no in plans:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no)
    groupes = {}
    for f in bm.faces:
        c = f.calc_center_median()
        k = classer(c)
        if k is not None:
            groupes.setdefault(k, []).append(f)
    # On garde les faces classées, groupe par groupe, et on rétrécit chaque groupe (inset, puis on retire l'anneau).
    garder = set()
    for k, fs in groupes.items():
        r = bmesh.ops.inset_region(bm, faces=fs, thickness=jour / 2, depth=0.0, use_even_offset=True, use_boundary=True)
        bmesh.ops.delete(bm, geom=r['faces'], context='FACES')
        for f in fs:
            if f.is_valid:
                garder.add(f)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in garder], context='FACES')
    ob = objet_depuis_bmesh(nom, bm, mat)
    m = modif(ob, 'SOLIDIFY', thickness=epaisseur, offset=1.0, use_rim=True)
    if mat_tranche is not None:
        i = ajouter_matiere(ob, mat_tranche)
        m.material_offset_rim = i
    if biseau > 0:
        modif(ob, 'BEVEL', width=biseau, segments=1, limit_method='ANGLE', angle_limit=math.radians(40))
    appliquer(ob)
    return ob


def aile(nom, sections, mat, subdivision=1):
    """Une aile par sections d'envergure : [(x, y_bord_attaque, y_bord_fuite, epaisseur, z), ...] (moitié droite)."""
    bm = bmesh.new()
    anneaux = []
    for x, ya, yf, ep, z in sections:
        corde = ya - yf
        # Un profil biseauté : bord d'attaque arrondi (4 points), bord de fuite fin.
        pts = [(ya, 0.0), (ya - corde * 0.12, ep * 0.5), (ya - corde * 0.45, ep * 0.5), (yf + corde * 0.05, ep * 0.12), (yf, 0.0), (yf + corde * 0.05, -ep * 0.1), (ya - corde * 0.45, -ep * 0.35), (ya - corde * 0.12, -ep * 0.35)]
        anneaux.append([bm.verts.new((x, y, z + dz)) for (y, dz) in pts])
    n = len(anneaux[0])
    for a, b in zip(anneaux, anneaux[1:]):
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new([a[j], a[k], b[k], b[j]])
    bm.faces.new(anneaux[0][::-1])
    bm.faces.new(anneaux[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = objet_depuis_bmesh(nom, bm, mat)
    if subdivision:
        modif(ob, 'SUBSURF', levels=subdivision)
    return ob


def tube(bm, a, b, r, segments=8):
    """Un cylindre de a à b (rayon r) ajouté au bmesh."""
    a, b = Vector(a), Vector(b)
    d = b - a
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r, radius2=r, depth=d.length)
    q = d.to_track_quat('Z', 'Y')
    m = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=m, verts=res['verts'])
    return res


def miroir_x(ob):
    """Duplique l'objet en miroir (x → −x), les deux restant séparés ; renvoie la copie."""
    c = ob.copy()
    c.data = ob.data.copy()
    bpy.context.scene.collection.objects.link(c)
    bm = bmesh.new()
    bm.from_mesh(c.data)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((-1, 1, 1, 1)), verts=bm.verts[:])
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.to_mesh(c.data)
    bm.free()
    c.location.x = -ob.location.x
    return c


def super_ellipse(cx, cz, rx, rz, n=4.0, points=24, demi=False, aplatir_bas=0.0):
    """
    Les points d'une section en super-ellipse (|x/rx|^n + |z/rz|^n = 1) centrée en (cx, cz) : n = 2 ellipse,
    n = 4 « carrosserie » (flancs droits, arrondis aux coins). « demi » : seulement la moitié droite (pour un
    miroir), du dessus au dessous. « aplatir_bas » : 0 à 1, le ventre devient plat.
    """
    pts = []
    if demi:
        angles = [math.pi / 2 - math.pi * i / (points - 1) for i in range(points)]
    else:
        angles = [math.pi / 2 - 2 * math.pi * i / points for i in range(points)]
    for a in angles:
        c, s = math.cos(a), math.sin(a)
        x = cx + rx * math.copysign(abs(c) ** (2 / n), c)
        z = cz + rz * math.copysign(abs(s) ** (2 / n), s)
        if s < 0 and aplatir_bas > 0:
            z = cz - rz * (1 - aplatir_bas) * abs(s) ** (2 / n) - rz * aplatir_bas
        pts.append((x, z))
    return pts


def fuseau(nom, sections, mat, subdivision=2, plis=()):
    """
    Un volume fermé par sections complètes (pas de miroir) : sections = [(y, [(x, z), ...]), ...], même nombre de
    points par section ; les extrémités sont fermées par un point (pointe) si la section n'a qu'un point.
    """
    bm = bmesh.new()
    pli = bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
    anneaux = []
    for y, pts in sections:
        anneaux.append([bm.verts.new((x, y, z)) for (x, z) in pts])
    n = max(len(a) for a in anneaux)
    for a, b in zip(anneaux, anneaux[1:]):
        if len(a) == 1:
            for j in range(n):
                bm.faces.new([a[0], b[(j + 1) % n], b[j]])
        elif len(b) == 1:
            for j in range(n):
                bm.faces.new([a[j], a[(j + 1) % n], b[0]])
        else:
            for j in range(n):
                k = (j + 1) % n
                bm.faces.new([a[j], a[k], b[k], b[j]])
    if len(anneaux[0]) > 1:
        bm.faces.new(anneaux[0])
    if len(anneaux[-1]) > 1:
        bm.faces.new(anneaux[-1])
    bm.edges.ensure_lookup_table()
    for a, b in zip(anneaux, anneaux[1:]):
        if len(a) > 1 and len(b) > 1:
            for k in plis:
                e = bm.edges.get([a[k], b[k]])
                if e:
                    e[pli] = 1.0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = objet_depuis_bmesh(nom, bm, mat)
    if subdivision:
        modif(ob, 'SUBSURF', levels=subdivision, render_levels=subdivision)
    appliquer(ob)
    retourner_si_interieur(ob)
    return ob


def ruban(nom, chemin, largeur, epaisseur, mat, normale=(0, 0, 1)):
    """Une bande (liseré, arête, câble plat) le long d'un chemin de points, de largeur et d'épaisseur données."""
    bm = bmesh.new()
    n = Vector(normale).normalized()
    paires = []
    for i, p in enumerate(chemin):
        p = Vector(p)
        t = (Vector(chemin[min(i + 1, len(chemin) - 1)]) - Vector(chemin[max(i - 1, 0)])).normalized()
        cote = t.cross(n).normalized() * largeur / 2
        h = n * epaisseur / 2
        paires.append([bm.verts.new(p - cote - h), bm.verts.new(p + cote - h), bm.verts.new(p + cote + h), bm.verts.new(p - cote + h)])
    for a, b in zip(paires, paires[1:]):
        for j in range(4):
            k = (j + 1) % 4
            bm.faces.new([a[j], a[k], b[k], b[j]])
    bm.faces.new(paires[0][::-1])
    bm.faces.new(paires[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return objet_depuis_bmesh(nom, bm, mat)
