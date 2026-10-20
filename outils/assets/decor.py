# PORTAL RUSH — LES MODULES DU CIRCUIT ET DU DÉCOR (Blender). Voir commun.py pour la chaîne et le format.
#
# Des pièces d'architecture posées par le jeu dans ses tronçons de 48 m (src/scripts/rush/scene/mondes*.ts) :
#   bordure  — 6 m de bordure droite : bordure basse, muret incliné à gorge lumineuse, chapeau au liseré blanc,
#              face externe à nervures, chemin de câbles, poutre porteuse (la gauche est la même, en miroir) ;
#   chevron  — un mât de signalisation à trois chevrons blancs lumineux, posé sur le muret tous les 12 m ;
#   portique — un portique en treillis qui enjambe la piste : deux pylônes à quatre membrures, une poutre-caisson
#              en treillis, une rampe de projecteurs, un panneau lumineux, des faisceaux de câbles, des feux.
# Repère du jeu (après conversion) : x latéral, y vers le haut, z vers l'arrière ; la piste est en y = 0, ses
# voies en x = −2,6, 0, 2,6, sa bordure droite vers x = 3,9. Les modules sont centrés en z = 0.
# Dans Blender (Z vers le haut, Y vers l'avant) : jeu (x, y, z) = Blender (x, z, −y).

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import SORTIE, apercu, appliquer, ecrire_prm, figer, joindre, lisser, matiere, modif, objet_depuis_bmesh, palette, vider  # noqa: E402
from formes import boite, piece, tube  # noqa: E402


def matieres_decor(P):
    P = dict(P)
    P['neonBlanc'] = matiere('neonBlanc', '#f2f7ff', 0, 0.4, 1.6)
    P['neonLigne'] = matiere('neonLigne', '#e8f1ff', 0, 0.4, 0.75)
    P['kerbClair'] = matiere('kerbClair', '#c9d0da', 0.3, 0.45)
    P['kerbSombre'] = matiere('kerbSombre', '#1d2129', 0.4, 0.55)
    P['muret'] = matiere('muret', '#323a47', 0.75, 0.42)
    P['ecran'] = matiere('ecran', '#0a1220', 0.5, 0.08, 0.05)
    P['ligne'] = matiere('ligne', '#0e1622', 0.3, 0.55, 1.0, 'ligne')
    P['accent2'] = matiere('accent2', '#ffffff', 0, 0.5, 1.0, 'accent2')
    P['roche'] = matiere('roche', '#3d3936', 0.05, 0.92)
    return P


def extrusion(nom, profil, y0, y1, mat, segments=6, mats=None):
    """Un profil (x, z) Blender extrudé le long de Y, de y0 à y1, en « segments » tronçons (pour suivre le pli
    du parcours). « mats » : une matière par arête du profil (sinon « mat »)."""
    bm = bmesh.new()
    anneaux = []
    for k in range(segments + 1):
        y = y0 + (y1 - y0) * k / segments
        anneaux.append([bm.verts.new((x, y, z)) for x, z in profil])
    faces = []
    for a, b in zip(anneaux, anneaux[1:]):
        for j in range(len(profil) - 1):
            faces.append((j, bm.faces.new([a[j], a[j + 1], b[j + 1], b[j]])))
    bm.faces.new(anneaux[0][::-1])
    bm.faces.new(anneaux[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = objet_depuis_bmesh(nom, bm, mat)
    if mats:
        index = {}
        for j, m in enumerate(mats):
            if m is None:
                continue
            if m.name not in index:
                ob.data.materials.append(m)
                index[m.name] = len(ob.data.materials) - 1
        # (Les faces latérales sont créées dans l'ordre : segment par segment, arête par arête.)
        for i, poly in enumerate(ob.data.polygons[: segments * (len(profil) - 1)]):
            j = i % (len(profil) - 1)
            if mats[j] is not None:
                poly.material_index = index[mats[j].name]
    return ob


# ---------------------------------------------------------------------------
# LA BORDURE (côté droit, 6 m)
# ---------------------------------------------------------------------------
def bordure(P):
    ob = []
    L = 3.0  # demi-longueur (Blender Y de −3 à 3)
    # Le muret : bordure basse, face interne inclinée, gorge, chapeau, face externe, dessous.
    profil = [
        (3.8, -0.02), (3.86, 0.05), (3.98, 0.1),          # la bordure basse (arrondie)
        (4.0, 0.14), (4.02, 0.3),                          # le bas de la face interne
        (4.05, 0.31), (4.05, 0.37), (4.03, 0.38),          # la gorge (une rainure lumineuse y sera posée)
        (4.05, 0.62), (4.09, 0.68),                        # le haut de la face interne, l'arête biseautée
        (4.42, 0.7), (4.5, 0.64),                          # le chapeau
        (4.53, 0.0), (4.5, -0.32), (3.8, -0.32),           # la face externe, le dessous
    ]
    mats = [P['kerbSombre'], P['kerbSombre'], P['muret'], P['muret'], P['joint'], P['joint'], P['joint'], P['muret'], P['acier'], P['blindageClair'], P['acier'], P['blindage'], P['blindage'], P['blindage']]
    ob.append(extrusion('muret', profil, -L, L, P['muret'], segments=6, mats=mats))
    # La bordure basse : des bandes alternées claires et sombres (tous les mètres), en léger relief.
    for k in range(6):
        if k % 2 == 0:
            y = -L + 0.5 + k
            ob.append(extrusion('kerb', [(3.79, 0.0), (3.86, 0.065), (3.99, 0.115)], y - 0.48, y + 0.48, P['kerbClair'], segments=1))
    # Le liseré blanc sur l'arête du chapeau : la signature de la piste, visible de loin.
    ob.append(extrusion('liseré', [(4.05, 0.64), (4.07, 0.69), (4.1, 0.705), (4.09, 0.67)], -L, L, P['neonLigne'], segments=6))
    # La gorge : une ligne de la couleur du monde (canal « ligne » : elle s'anime avec le combo).
    ob.append(extrusion('gorge', [(4.045, 0.322), (4.045, 0.362), (4.03, 0.362), (4.03, 0.322)], -L, L, P['ligne'], segments=6))
    # La face externe : nervures verticales, et un chemin de câbles sur consoles.
    def nervures(bm):
        for k in range(4):
            y = -L + 0.75 + k * 1.5
            boite(bm, (4.56, y, 0.16), (0.07, 0.09, 0.9))
            boite(bm, (4.66, y, -0.02), (0.22, 0.07, 0.04))  # la console du chemin de câbles
    ob.append(piece('nervures', nervures, P['acier']))
    ob.append(piece('chemin', lambda bm: boite(bm, (4.7, 0, 0.0), (0.16, 2 * L, 0.012)), P['blindage']))
    def cables(bm):
        for x, z, r in [(4.66, 0.04, 0.026), (4.73, 0.035, 0.02)]:
            for k in range(4):
                y = -L + k * 1.5
                tube(bm, (x, y, z), (x, y + 1.5, z), r, 6)
    ob.append(piece('cables', cables, P['caoutchouc']))
    # La poutre porteuse sous la bordure : un profilé en I.
    def poutre(bm):
        boite(bm, (4.15, 0, -0.36), (0.5, 2 * L, 0.05))
        boite(bm, (4.15, 0, -0.62), (0.08, 2 * L, 0.5))
        boite(bm, (4.15, 0, -0.88), (0.4, 2 * L, 0.05))
        for k in range(3):
            boite(bm, (4.15, -L + 1 + k * 2, -0.62), (0.3, 0.04, 0.46))  # raidisseurs
    ob.append(piece('poutre', poutre, P['blindage']))
    # Des feux de position dans la gorge, aux extrémités du module.
    ob.append(piece('feux', lambda bm: [boite(bm, (4.04, y, 0.342), (0.02, 0.12, 0.03)) for y in (-L + 0.25, L - 0.25)], P['accent2']))
    for o in ob:
        appliquer(o)
    return ob


# ---------------------------------------------------------------------------
# LE MÂT À CHEVRONS (posé sur le muret, côté droit)
# ---------------------------------------------------------------------------
def chevron(P):
    ob = []
    # Le panneau : une lame épaisse, biseautée, posée sur le chapeau du muret, inclinée vers la piste.
    def lame(bm):
        boite(bm, (4.3, 0, 1.12), (0.1, 1.3, 0.86))
    ob.append(piece('lame', lame, P['blindage'], biseau=0.025, segments=2))
    ob.append(piece('pied', lambda bm: [boite(bm, (4.3, y, 0.69), (0.22, 0.16, 0.08)) for y in (-0.45, 0.45)], P['acier'], biseau=0.01))
    # Le cadre et le fond sombre du panneau, côté piste.
    ob.append(piece('fond', lambda bm: boite(bm, (4.245, 0, 1.12), (0.012, 1.16, 0.7)), P['ecran']))
    # Trois chevrons « > » qui pointent vers l'avant (+Y Blender, −z dans le jeu) : deux barres chacun.
    def chevrons(bm):
        for k in range(3):
            y = -0.34 + k * 0.32
            for s in (1, -1):
                boite(bm, (4.236, y + 0.07, 1.12 + s * 0.13), (0.012, 0.075, 0.3), Matrix.Rotation(s * 0.62, 3, 'X'))
    ob.append(piece('chevrons', chevrons, P['neonBlanc']))
    # Un feu à éclats au sommet.
    ob.append(piece('feu', lambda bm: boite(bm, (4.3, 0, 1.58), (0.08, 0.08, 0.05)), P['feuRouge']))
    for o in ob:
        appliquer(o)
    return ob


# ---------------------------------------------------------------------------
# LE PORTIQUE EN TREILLIS
# ---------------------------------------------------------------------------
def barre(bm, a, b, e):
    """Une barre de section carrée (côté e) de a à b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    q = d.to_track_quat('Z', 'Y')
    m = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((e, e, d.length, 1))
    r = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=m, verts=r['verts'])


def treillis(bm, coins_bas, coins_haut, etages, e_membrure, e_diag):
    """Une tour en treillis : quatre membrures (des coins du bas à ceux du haut), des ceintures à chaque étage,
    des diagonales en zigzag sur chaque face."""
    for cb, ch in zip(coins_bas, coins_haut):
        barre(bm, cb, ch, e_membrure)

    def point(i, t):
        cb, ch = Vector(coins_bas[i]), Vector(coins_haut[i])
        return cb + (ch - cb) * t

    for k in range(etages + 1):
        t = k / etages
        for i in range(4):
            barre(bm, point(i, t), point((i + 1) % 4, t), e_diag * 1.2)
    for k in range(etages):
        t0, t1 = k / etages, (k + 1) / etages
        for i in range(4):
            j = (i + 1) % 4
            if k % 2:
                barre(bm, point(i, t0), point(j, t1), e_diag)
            else:
                barre(bm, point(j, t0), point(i, t1), e_diag)


def portique(P):
    ob = []
    H = 9.6       # hauteur de la poutre (bas)
    X = 6.6       # position des pylônes
    # Les deux pylônes : base 1,6 m, sommet 1,1 m, du sol des quais (z = −3) jusqu'à la poutre.
    def pylones(bm):
        for s in (1, -1):
            x = s * X
            bas = [(x - 0.8, -0.8, -3), (x + 0.8, -0.8, -3), (x + 0.8, 0.8, -3), (x - 0.8, 0.8, -3)]
            haut = [(x - 0.55, -0.55, H + 1.4), (x + 0.55, -0.55, H + 1.4), (x + 0.55, 0.55, H + 1.4), (x - 0.55, 0.55, H + 1.4)]
            treillis(bm, bas, haut, 9, 0.16, 0.07)
    ob.append(piece('pylones', pylones, P['blindageClair']))
    # Les socles (béton armé, plaques boulonnées) et les jambes de force vers la bordure.
    def socles(bm):
        for s in (1, -1):
            boite(bm, (s * X, 0, -2.4), (2.2, 2.2, 1.2))
            boite(bm, (s * X, 0, -1.7), (1.9, 1.9, 0.2))
            for dx in (-0.75, 0.75):
                for dy in (-0.75, 0.75):
                    boite(bm, (s * X + dx, dy, -1.56), (0.12, 0.12, 0.08))
    ob.append(piece('socles', socles, P['acier'], biseau=0.04))
    def jambes(bm):
        for s in (1, -1):
            barre(bm, (s * (X - 0.6), 0, 2.2), (s * 4.7, 0, -0.5), 0.26)
            barre(bm, (s * (X - 0.6), 0.5, 2.2), (s * (X - 0.6), 0.5, -1.6), 0.18)
    ob.append(piece('jambes', jambes, P['blindage'], biseau=0.02))
    # La poutre : un caisson en treillis de 15 m, 1,4 m de haut, 1,2 m de profondeur.
    def poutre(bm):
        bas = [(-X - 0.6, -0.6, H), (-X - 0.6, 0.6, H), (-X - 0.6, 0.6, H + 1.4), (-X - 0.6, -0.6, H + 1.4)]
        haut = [(X + 0.6, -0.6, H), (X + 0.6, 0.6, H), (X + 0.6, 0.6, H + 1.4), (X + 0.6, -0.6, H + 1.4)]
        treillis(bm, bas, haut, 12, 0.14, 0.06)
    ob.append(piece('poutre', poutre, P['blindageClair']))
    # Le plancher de service sur la poutre et son garde-corps.
    ob.append(piece('plancher', lambda bm: boite(bm, (0, 0, H + 1.45), (2 * X + 1.2, 1.3, 0.05)), P['blindage']))
    def garde(bm):
        for y in (-0.62, 0.62):
            barre(bm, (-X - 0.6, y, H + 2.4), (X + 0.6, y, H + 2.4), 0.04)
            for k in range(13):
                x = -X - 0.6 + k * (2 * X + 1.2) / 12
                barre(bm, (x, y, H + 1.45), (x, y, H + 2.4), 0.035)
    ob.append(piece('garde', garde, P['jaune']))
    # La rampe de projecteurs sous la poutre : boîtiers et diffuseurs blancs.
    def boitiers(bm):
        for k in range(-3, 4):
            boite(bm, (k * 1.8, 0, H - 0.18), (1.0, 0.5, 0.3))
    ob.append(piece('boitiers', boitiers, P['blindage'], biseau=0.03))
    ob.append(piece('diffuseurs', lambda bm: [boite(bm, (k * 1.8, 0, H - 0.34), (0.86, 0.36, 0.02)) for k in range(-3, 4)], P['neonBlanc']))
    # Le panneau lumineux au centre, tourné vers le pilote qui arrive (vers −Y Blender, +z dans le jeu).
    ob.append(piece('panneau', lambda bm: boite(bm, (0, -0.7, H + 0.7), (5.2, 0.2, 1.3)), P['blindage'], biseau=0.04))
    ob.append(piece('ecran', lambda bm: boite(bm, (0, -0.81, H + 0.7), (4.8, 0.02, 1.0)), P['ecran']))
    def motif(bm):
        # Des bandes de lumière de la couleur du monde (des flèches stylisées et un bandeau).
        boite(bm, (0, -0.83, H + 0.28), (4.6, 0.01, 0.06))
        boite(bm, (0, -0.83, H + 1.12), (4.6, 0.01, 0.06))
        # (Des chevrons « ^ » : vers l'avant, la direction de la course.)
        for k in range(-2, 3):
            for s in (1, -1):
                boite(bm, (k * 0.9 - s * 0.11, -0.83, H + 0.66), (0.06, 0.01, 0.34), Matrix.Rotation(s * 0.75, 3, 'Y'))
    ob.append(piece('motif', motif, P['accent']))
    # Les faisceaux de câbles qui descendent le long d'un pylône, et une échelle.
    def cables(bm):
        for s in (1, -1):
            for k, dx in enumerate((-0.3, -0.18, -0.06)):
                tube(bm, (s * (X + 0.62) , dx, -1.6), (s * (X + 0.55), dx, H + 1.3), 0.045 + k * 0.01, 6)
    ob.append(piece('cables', cables, P['caoutchouc']))
    def echelle(bm):
        x = X - 0.62
        for y in (-0.25, 0.25):
            barre(bm, (x, y, -1.6), (x, y, H), 0.035)
        for k in range(int((H + 1.6) / 0.35)):
            barre(bm, (x, -0.25, -1.4 + k * 0.35), (x, 0.25, -1.4 + k * 0.35), 0.025)
    ob.append(piece('echelle', echelle, P['acier']))
    # Les feux à éclats au sommet des pylônes.
    ob.append(piece('feux', lambda bm: [boite(bm, (s * X, 0, H + 1.6), (0.18, 0.18, 0.14)) for s in (1, -1)], P['feuRouge']))
    for o in ob:
        appliquer(o)
    return ob


# ---------------------------------------------------------------------------
# LES ROCHES (astéroïdes, éboulis) : une icosphère déformée par trois bruits (cellules de Voronoï pour les
# cassures, nuages pour l'irrégularité, une grande onde pour la forme), puis décimée pour garder des plans de
# fracture nets. Rayon ~1 (le jeu les met à l'échelle et les recolore selon le monde).
# ---------------------------------------------------------------------------
def roche(graine):
    def fabrique(P):
        import random
        rnd = random.Random(graine * 7919 + 13)
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        e = (rnd.uniform(1.05, 1.4), rnd.uniform(0.8, 1.0), rnd.uniform(0.7, 0.95))
        bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*e, 1)), verts=bm.verts[:])
        # Des plans de fracture au hasard : chacun tranche la roche et la referme d'une face plane.
        for _ in range(16):
            n = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))).normalized()
            d = rnd.uniform(0.6, 0.92)
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=n * d, plane_no=n, clear_outer=True)
            bord = [ed for ed in bm.edges if ed.is_boundary]
            if bord:
                bmesh.ops.holes_fill(bm, edges=bord, sides=0)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        ob = objet_depuis_bmesh(f'roche-{graine}', bm, P['roche'])
        # Un grain de surface sur les faces de fracture (subdivision simple, bruit léger), puis on allège.
        modif(ob, 'SUBSURF', subdivision_type='SIMPLE', levels=2)
        tex = bpy.data.textures.new(f'grain-{graine}', 'CLOUDS')
        tex.noise_scale = 0.28
        tex.noise_depth = 2
        modif(ob, 'DISPLACE', texture=tex, strength=0.09, mid_level=0.5)
        tex2 = bpy.data.textures.new(f'cassures-{graine}', 'VORONOI')
        tex2.noise_scale = 0.35
        modif(ob, 'DISPLACE', texture=tex2, strength=0.05, mid_level=0.5)
        appliquer(ob)
        modif(ob, 'DECIMATE', ratio=0.12)
        appliquer(ob)
        r = max(v.co.length for v in ob.data.vertices)
        ob.data.transform(Matrix.Scale(1 / r, 4))
        return [ob]
    return fabrique

MODULES = {'bordure': bordure, 'chevron': chevron, 'portique': portique, **{f'roche-{k}': roche(k) for k in range(4)}}


def construire(nom, P):
    objets = MODULES[nom](P)
    comptes = {}
    for o in objets:
        o.data.calc_loop_triangles()
        k = o.name.split('.')[0]
        comptes[k] = comptes.get(k, 0) + len(o.data.loop_triangles)
    print(f'  {nom} :', ', '.join(f'{k} {v}' for k, v in sorted(comptes.items(), key=lambda kv: -kv[1])))
    ob = joindre(objets, nom)
    lisser(ob, 40)
    return ob


if __name__ == '__main__':
    vider()
    P = matieres_decor(palette())
    apercus = Path(__file__).resolve().parents[2] / 'captures' / 'v4h' / 'modeles'
    apercus.mkdir(parents=True, exist_ok=True)
    resultats = []
    for nom in MODULES:
        ob = construire(nom, P)
        resultats.append((nom, ob, {}))
    ecrire_prm(SORTIE / 'decor.prm', resultats)
    if '--roches' in sys.argv:
        # Les quatre roches côte à côte.
        for o in bpy.data.objects:
            o.hide_render = o.type == 'MESH' and not o.name.startswith('roche')
        for k in range(4):
            bpy.data.objects[f'roche-{k}'].location = (-4.5 + k * 3, 0, 0)
        apercu(apercus / 'decor-roches.png', cible=(0, 0, 0), distance=11, azimut=20, elevation=25, echantillons=16)
    elif '--sans-apercu' not in sys.argv:
        # L'aperçu : une bordure de chaque côté (la gauche en miroir), deux mâts, le portique.
        ob_b = bpy.data.objects['bordure']
        for nom in ('bordure', 'chevron'):
            o = bpy.data.objects[nom]
            c = o.copy()
            c.data = o.data
            c.scale.x = -1
            bpy.context.scene.collection.objects.link(c)
        apercu(apercus / 'decor-portique.png', cible=(0, 0, 4.5), distance=34, azimut=20, elevation=10, echantillons=16)
        apercu(apercus / 'decor-bordure.png', cible=(4.2, 0, 0.4), distance=4.2, azimut=235, elevation=20, echantillons=16)
