# PORTAL RUSH — LA CHAÎNE D'ASSETS (V4-H7, 17 octobre 2026)
#
# Les modèles du jeu sont construits par des scripts Blender (bpy 5.2, gratuit, GPL : l'outil, pas les modèles),
# reproductibles : chaque script décrit la forme (sections, lissage, biseaux, booléens, modificateurs) et les
# matières, puis exporte un fichier binaire compact lu par le jeu (src/scripts/rush/scene/assets.ts).
#
# Lancer (environnement Blender isolé, voir README) :
#   <venv>/bin/python outils/assets/vaisseaux.py
#
# Le format « PRM1 » (Portal Rush Mesh) :
#   « PRM1 » | longueur du JSON (u32) | JSON (utf-8, complété à 4 octets) | blocs binaires alignés sur 4 octets
#   Par maillage : positions int16 ×3 (quantifiées dans sa boîte), normales int8 ×4, un indice de matière uint8
#   par sommet, index uint16 ou uint32. Le JSON donne pour chaque maillage : nom, nombres de sommets et d'index,
#   boîte, décalages des blocs, la palette des matières ([r, g, b sRGB, métal, rugosité, émission, canal]) et des
#   points d'ancrage nommés (tuyères [x, y, z, rayon], émetteurs…) dans le repère du jeu.
# Repères : Blender est en Z vers le haut, le nez des vaisseaux vers +Y ; le jeu est en Y vers le haut, le nez
# vers −Z. Conversion : jeu (x, y, z) = Blender (x, z, −y).

import json
import math
import struct
import sys
from pathlib import Path

import bpy  # (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh
from mathutils import Matrix, Vector

RACINE = Path(__file__).resolve().parents[2]
SORTIE = RACINE / 'public' / 'rush' / 'modeles'

# Les canaux du shader de surface (src/scripts/rush/scene/geometrie.ts, CANAL).
CANAL = {'fixe': 0, 'peinture': 1, 'accent': 2, 'accent2': 3, 'danger': 4, 'coeur': 5, 'ligne': 6, 'fissure': 7, 'clignote': 8, 'peinture2': 9}


def hexa(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# ---------------------------------------------------------------------------
# Les matières : une matière Blender par matière du jeu ; ses propriétés sont lues à l'export.
# (Les nœuds ne servent qu'à l'aperçu Cycles ; le jeu a son propre shader.)
# ---------------------------------------------------------------------------
def matiere(nom, couleur, metal, rugo, emission=0.0, canal='fixe'):
    m = bpy.data.materials.get(nom) or bpy.data.materials.new(nom)
    m['jeu_couleur'] = couleur
    m['jeu_metal'] = metal
    m['jeu_rugo'] = rugo
    m['jeu_emission'] = emission
    m['jeu_canal'] = CANAL[canal]
    m.use_nodes = True
    n = m.node_tree.nodes
    p = n.get('Principled BSDF')
    c = hexa(couleur)
    lin = tuple(v ** 2.2 for v in c)
    p.inputs['Base Color'].default_value = (*lin, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rugo
    if emission > 0:
        p.inputs['Emission Color'].default_value = (*lin, 1)
        p.inputs['Emission Strength'].default_value = emission * 6
    return m


# La palette commune (les mêmes intentions que M dans modeles.ts, enrichies).
def palette():
    return {
        'coque': matiere('coque', '#e6ebf2', 0.35, 0.32, 0, 'peinture'),
        'peinture2': matiere('peinture2', '#ffffff', 0.4, 0.3, 0, 'peinture2'),
        'blindage': matiere('blindage', '#2a313d', 0.8, 0.42),
        'blindageClair': matiere('blindageClair', '#5d6878', 0.85, 0.36),
        'alliage': matiere('alliage', '#a8b4c4', 0.95, 0.22),
        'acier': matiere('acier', '#6e7a8c', 0.9, 0.45),
        'carbone': matiere('carbone', '#16191f', 0.5, 0.4),
        'caoutchouc': matiere('caoutchouc', '#121418', 0.05, 0.85),
        'joint': matiere('joint', '#0a0c10', 0.2, 0.9),
        'verre': matiere('verre', '#0b1a2c', 0.6, 0.04, 0.08),
        'tuyere': matiere('tuyere', '#3a3530', 0.92, 0.38),
        'chaud': matiere('chaud', '#6b4a36', 0.9, 0.3),
        'accent': matiere('accent', '#ffffff', 0, 0.5, 1.0, 'accent'),
        'accentDoux': matiere('accentDoux', '#ffffff', 0, 0.5, 0.4, 'accent'),
        'coeur': matiere('coeur', '#ffffff', 0, 0.3, 1.2, 'coeur'),
        'feuRouge': matiere('feuRouge', '#ff3b30', 0, 0.5, 1.4, 'clignote'),
        'feuBlanc': matiere('feuBlanc', '#f4f8ff', 0, 0.5, 1.4, 'clignote'),
        'navVert': matiere('navVert', '#4dffa0', 0, 0.5, 1.2),
        'jaune': matiere('jaune', '#e2a21c', 0.35, 0.5),
        'danger': matiere('danger', '#ff3a2e', 0, 0.5, 1.0, 'danger'),
    }


# ---------------------------------------------------------------------------
# La scène et les objets
# ---------------------------------------------------------------------------
def vider():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def objet_depuis_bmesh(nom, bm, mat=None):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat is not None:
        ob.data.materials.append(mat)
    return ob


def ajouter_matiere(ob, mat):
    """Ajoute la matière à l'objet (si absente) et renvoie son indice."""
    for i, m in enumerate(ob.data.materials):
        if m == mat:
            return i
    ob.data.materials.append(mat)
    return len(ob.data.materials) - 1


def modif(ob, type_, **params):
    m = ob.modifiers.new(type_.lower(), type_)
    for k, v in params.items():
        setattr(m, k, v)
    return m


def lisser(ob, angle=32):
    """Ombrage lisse, avec arêtes vives là où deux faces font plus de « angle » degrés (normales par coin).
    À appeler sur un maillage final (modificateurs appliqués)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    seuil = math.radians(angle)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0.0) < seuil
        else:
            e.smooth = False
    bm.to_mesh(ob.data)
    bm.free()


def appliquer(ob):
    """Applique tous les modificateurs de l'objet."""
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    for m in list(ob.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e:
            print('modificateur non appliqué', ob.name, m.name, e, file=sys.stderr)


def figer(ob):
    """Inscrit la transformation de l'objet (position, rotation, échelle) dans son maillage."""
    ob.data.transform(ob.matrix_basis)
    ob.matrix_basis = Matrix.Identity(4)


def joindre(objets, nom):
    """Fusionne des objets en un seul (les modificateurs doivent être appliqués)."""
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objets:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objets[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = nom
    return ob


# ---------------------------------------------------------------------------
# L'export PRM1
# ---------------------------------------------------------------------------
def vers_jeu(v):
    return (v[0], v[2], -v[1])


def maillage_jeu(ob):
    """
    Les sommets d'un objet, dédoublés par (position, normale de coin, matière), dans le repère du jeu.
    Renvoie positions, normales, indice de matière par sommet, palette des matières, index des triangles.
    """
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    mw = ob.matrix_world
    rot = mw.to_3x3().inverted().transposed()
    cn = me.corner_normals
    mats = [m for m in ob.data.materials]
    palette_idx, palette_mat = {}, []
    cle_vers_index = {}
    pos, nor, mat, idx = [], [], [], []
    for tri in me.loop_triangles:
        m = mats[tri.material_index] if tri.material_index < len(mats) and mats else None
        props = (m.get('jeu_couleur', '#888888'), m.get('jeu_metal', 0.5), m.get('jeu_rugo', 0.5), m.get('jeu_emission', 0.0), m.get('jeu_canal', 0)) if m else ('#888888', 0.5, 0.5, 0.0, 0)
        pi = palette_idx.get(props)
        if pi is None:
            pi = palette_idx[props] = len(palette_mat)
            c = hexa(props[0])
            palette_mat.append([round(c[0], 4), round(c[1], 4), round(c[2], 4), props[1], props[2], props[3], props[4]])
        for li in tri.loops:
            vi = me.loops[li].vertex_index
            p = mw @ me.vertices[vi].co
            n = (rot @ Vector(cn[li].vector)).normalized()
            pj = vers_jeu(p)
            nj = vers_jeu(n)
            cle = (vi, round(nj[0], 3), round(nj[1], 3), round(nj[2], 3), pi)
            i = cle_vers_index.get(cle)
            if i is None:
                i = len(pos)
                cle_vers_index[cle] = i
                pos.append(pj)
                nor.append(nj)
                mat.append(pi)
            idx.append(i)
    ev.to_mesh_clear()
    if len(palette_mat) > 255:
        raise ValueError(f'{ob.name} : trop de matières ({len(palette_mat)})')
    return pos, nor, mat, palette_mat, idx


def ecrire_prm(fichier, maillages, extra=None):
    """maillages : liste de (nom, objet, points d'ancrage {nom: [(x,y,z…) jeu]})."""
    entetes, blocs = [], []
    decalage = 0

    def bloc(b):
        nonlocal decalage
        while len(b) % 4:
            b += b'\0'
        blocs.append(b)
        d = decalage
        decalage += len(b)
        return d

    total_tri = 0
    for nom, ob, points in maillages:
        pos, nor, mat, pal, idx = maillage_jeu(ob)
        mn = [min(p[k] for p in pos) for k in range(3)]
        mx = [max(p[k] for p in pos) for k in range(3)]
        ech = [(mx[k] - mn[k]) or 1e-6 for k in range(3)]
        bp = bytearray()
        for p in pos:
            bp += struct.pack('<3h', *[int(round(((p[k] - mn[k]) / ech[k]) * 65535 - 32768)) for k in range(3)])
        bn = bytearray()
        for n in nor:
            bn += struct.pack('<4b', *[max(-127, min(127, int(round(n[k] * 127)))) for k in range(3)], 0)
        bm = bytes(mat)
        grand = len(pos) > 65535
        bi = struct.pack(f'<{len(idx)}{"I" if grand else "H"}', *idx)
        total_tri += len(idx) // 3
        entetes.append({
            'nom': nom, 'sommets': len(pos), 'index': len(idx), 'idx32': grand, 'min': mn, 'max': mx,
            'pos': bloc(bytes(bp)), 'nor': bloc(bytes(bn)), 'mat': bloc(bm), 'idx': bloc(bytes(bi)),
            'palette': pal, 'points': points or {},
        })
        print(f'  {nom}: {len(pos)} sommets, {len(idx) // 3} triangles, {len(pal)} matières')
    js = json.dumps({'version': 2, 'maillages': entetes, **(extra or {})}, separators=(',', ':')).encode('utf-8')
    while len(js) % 4:
        js += b' '
    fichier = Path(fichier)
    fichier.parent.mkdir(parents=True, exist_ok=True)
    with open(fichier, 'wb') as f:
        f.write(b'PRM1')
        f.write(struct.pack('<I', len(js)))
        f.write(js)
        for b in blocs:
            f.write(b)
    print(f'→ {fichier} ({fichier.stat().st_size / 1024:.0f} Ko, {total_tri} triangles)')


# ---------------------------------------------------------------------------
# L'aperçu : un rendu Cycles en studio (trois lumières, fond sombre), pour juger un modèle avant de l'intégrer.
# ---------------------------------------------------------------------------
def apercu(fichier, cible=(0, 0, 0), distance=6.0, azimut=35, elevation=22, taille=(960, 600), echantillons=24, fond=(0.02, 0.025, 0.035)):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = echantillons
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = taille
    sc.render.film_transparent = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new('monde')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (*fond, 1)
    bg.inputs[1].default_value = 1.0
    for nom, loc, energie, couleur in [('cle', (4, -3, 5), 4.0, (1, 0.96, 0.9)), ('contre', (-4, 4, 3), 3.0, (0.6, 0.75, 1.0)), ('dessous', (0, -2, -3), 0.8, (0.5, 0.7, 1))]:
        if nom not in bpy.data.objects:
            l = bpy.data.lights.new(nom, 'SUN')
            l.energy = energie
            l.color = couleur
            o = bpy.data.objects.new(nom, l)
            sc.collection.objects.link(o)
            o.location = loc
            o.rotation_euler = (Vector(cible) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.get('camera')
    if cam is None:
        cd = bpy.data.cameras.new('camera')
        cd.lens = 50
        cam = bpy.data.objects.new('camera', cd)
        sc.collection.objects.link(cam)
    a, e = math.radians(azimut), math.radians(elevation)
    cam.location = Vector(cible) + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * distance
    cam.rotation_euler = (Vector(cible) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.filepath = str(fichier)
    bpy.ops.render.render(write_still=True)
