# PORTAL RUSH — LES OBSTACLES (Blender). Voir commun.py pour la chaîne et le format.
#
# Chaque obstacle remplace le modèle procédural du même nom (scene.ts : geo / double) ; il garde son
# encombrement (les collisions sont celles du moteur de jeu : une voie de 2,6 m de large) et ses animations.
# Repère du jeu : x latéral, y vers le haut, z vers l'arrière ; la face d'un obstacle tournée vers le pilote
# qui arrive est sa face +z (Blender −Y). Dans Blender (Z vers le haut) : jeu (x, y, z) = Blender (x, z, −y).
# Points facultatifs (repère du jeu) : « halos » = [[x, y, z, rayon, r, v, b, intensité], …] (des halos lumineux
# posés par le jeu sur les feux du modèle).

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import SORTIE, apercu, appliquer, ecrire_prm, figer, joindre, lisser, matiere, modif, objet_depuis_bmesh, palette, vider  # noqa: E402
from formes import boite, miroir_x, piece, plaques, tube  # noqa: E402


def matieres_objets(P):
    P = dict(P)
    P['rouille'] = matiere('rouille', '#5b2420', 0.55, 0.42)
    P['hachureNoire'] = matiere('hachureNoire', '#121317', 0.35, 0.6)
    P['hachureRouge'] = matiere('hachureRouge', '#ff3a2e', 0, 0.5, 0.55, 'danger')
    P['dangerFort'] = matiere('dangerFort', '#ff3a2e', 0, 0.5, 1.0, 'danger')
    P['neonBlanc'] = matiere('neonBlanc', '#f2f7ff', 0, 0.4, 1.4)
    return P


def prisme(bm, pts, y0, y1):
    """Un prisme : un profil (x, z) fermé, extrudé de y0 à y1 (Blender)."""
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([a[i], a[j], b[j], b[i]])
    bm.faces.new(a[::-1])
    bm.faces.new(b)


# ---------------------------------------------------------------------------
# LA BARRIÈRE (2,2 m de large, 1,7 m de haut) : un bouclier blindé incliné vers le pilote, sur un traîneau
# anti-gravité, encadré de deux vérins-montants à gyrophare, rampe lumineuse au sommet.
# ---------------------------------------------------------------------------
def barriere(P):
    ob = []
    # Le traîneau : une semelle épaisse aux flancs chanfreinés, des patins, deux émetteurs dessous.
    def traineau(bm):
        prisme(bm, [(-1.08, 0.0), (1.08, 0.0), (1.12, 0.12), (1.0, 0.24), (-1.0, 0.24), (-1.12, 0.12)], -0.58, 0.58)
    ob.append(piece('traineau', traineau, P['blindage'], biseau=0.02))
    ob.append(piece('patins', lambda bm: [boite(bm, (s * 0.8, 0, 0.0), (0.22, 1.2, 0.06)) for s in (1, -1)], P['carbone'], biseau=0.01))
    ob.append(piece('emetteurs', lambda bm: [boite(bm, (s * 0.8, 0, -0.035), (0.14, 0.9, 0.012)) for s in (1, -1)], P['dangerFort']))
    # Le bouclier : une dalle épaisse inclinée (le haut recule), profil en coin, face avant légèrement bombée.
    def bouclier(bm):
        prisme(bm, [(-0.92, 0.0), (0.92, 0.0), (0.92, 1.05), (0.84, 1.18), (-0.84, 1.18), (-0.92, 1.05)], -0.2, 0.2)
    b = piece('bouclier', bouclier, P['rouille'], biseau=0.035, segments=2)
    appliquer(b)
    b.rotation_euler = (math.radians(-12), 0, 0)  # le haut part vers l'arrière (+Y Blender = loin du pilote)
    b.location = (0, 0.05, 0.24)
    figer(b)
    ob.append(b)
    # Les hachures de danger sur la face avant (vers −Y) : bandes rouges lumineuses et noires, en biais.
    def hachures(bm, rouge):
        for i in range(-4, 4):
            if (i % 2 == 0) != rouge:
                continue
            x0 = i * 0.22
            v = [bm.verts.new(p) for p in [(x0, 0, 0.18), (x0 + 0.11, 0, 0.18), (x0 + 0.42, 0, 1.0), (x0 + 0.31, 0, 1.0)]]
            # On rogne au bord du bouclier.
            for vv in v:
                vv.co.x = max(-0.84, min(0.84, vv.co.x))
            bm.faces.new(v[::-1])
    for rouge in (True, False):
        h = piece('hachures', lambda bm, rouge=rouge: hachures(bm, rouge), P['hachureRouge'] if rouge else P['hachureNoire'])
        modif(h, 'SOLIDIFY', thickness=0.012, offset=1.0)
        appliquer(h)
        h.rotation_euler = (math.radians(-12), 0, 0)
        h.location = (0, 0.05 - 0.205 - 0.012, 0.24)
        figer(h)
        ob.append(h)
    # Le cadre de la face : un liseré métallique en haut et en bas, des boulons.
    def cadre(bm):
        boite(bm, (0, 0, 0.13), (1.86, 0.03, 0.08))
        boite(bm, (0, 0, 1.08), (1.7, 0.03, 0.08))
        for x in (-0.78, -0.26, 0.26, 0.78):
            for z in (0.13, 1.08):
                boite(bm, (x, -0.02, z), (0.05, 0.03, 0.05))
    c = piece('cadre', cadre, P['acier'])
    c.rotation_euler = (math.radians(-12), 0, 0)
    c.location = (0, 0.05 - 0.22, 0.24)
    figer(c)
    ob.append(c)
    # Les montants : des vérins (corps, tige chromée), un gyrophare en haut, une console qui tient le bouclier.
    def montant(bm):
        boite(bm, (0.99, 0.05, 0.75), (0.17, 0.3, 1.0))
        boite(bm, (0.99, 0.05, 0.28), (0.24, 0.42, 0.12))
    ob.append(piece('montant', montant, P['blindageClair'], biseau=0.02))
    ob.append(piece('tige', lambda bm: tube(bm, (0.99, 0.05, 1.25), (0.99, 0.05, 1.55), 0.045, 10), P['alliage']))
    ob.append(piece('gyrophare', lambda bm: tube(bm, (0.99, 0.05, 1.55), (0.99, 0.05, 1.68), 0.075, 10), P['dangerFort']))
    ob.append(piece('console', lambda bm: boite(bm, (0.9, 0.08, 0.95), (0.12, 0.2, 0.1)), P['acier']))
    # La rampe lumineuse au sommet, entre les montants.
    ob.append(piece('rampe', lambda bm: boite(bm, (0, 0.18, 1.5), (1.7, 0.12, 0.1)), P['blindage'], biseau=0.015))
    ob.append(piece('rampe-feu', lambda bm: boite(bm, (0, 0.11, 1.5), (1.5, 0.02, 0.05)), P['dangerFort']))
    # L'arrière : deux jambes de force, une grille de ventilation, un câble.
    def arriere(bm):
        for s in (1, -1):
            v = Vector((s * 0.6, 0.55, 0.24))
            w = Vector((s * 0.6, 0.22, 1.0))
            d = w - v
            q = d.to_track_quat('Z', 'Y')
            r = bmesh.ops.create_cube(bm, size=1.0)
            bmesh.ops.transform(bm, matrix=Matrix.Translation((v + w) / 2) @ q.to_matrix().to_4x4() @ Matrix.Diagonal((0.09, 0.09, d.length, 1)), verts=r['verts'])
        for k in range(5):
            boite(bm, (-0.36 + k * 0.18, 0.28, 0.62), (0.1, 0.02, 0.5))
    ob.append(piece('arriere', arriere, P['acier']))
    ob.append(piece('cable', lambda bm: tube(bm, (-0.99, 0.2, 0.35), (-0.4, 0.5, 0.26), 0.02, 6), P['caoutchouc']))
    # (Les montants, tiges, gyrophares, consoles : miroir.)
    for o in list(ob):
        if o.name.split('.')[0] in ('montant', 'tige', 'gyrophare', 'console'):
            appliquer(o)
            ob.append(miroir_x(o))
    halos = [[s * 0.99, 1.62, -0.05, 0.4, 1, 0.25, 0.2, 0.75] for s in (1, -1)] + [[0, 1.5, 0.0, 0.9, 1, 0.25, 0.2, 0.55], [0, 0.1, 0.6, 1.3, 1, 0.2, 0.15, 0.4]]
    return ob, {'halos': halos}


# ---------------------------------------------------------------------------
# LES ROCHERS (obstacle « debris », trois variantes) : trois roches fracturées, chacune éclatée en quartiers
# légèrement écartés qui laissent voir un cœur en fusion. Mêmes places et tailles que le modèle procédural.
# ---------------------------------------------------------------------------
def rochers(graine):
    def fabrique(P):
        import random
        from decor import roche
        rnd = random.Random(100 + graine)
        braise = matiere('braise', '#ff6a2a', 0, 0.6, 1.4)
        tranche = matiere('trancheRoche', '#2a1a14', 0.1, 0.9, 0.25)
        P2 = dict(P)
        P2['roche'] = matiere('rocheObjet', '#3d3936', 0.05, 0.92)
        ob = []
        # (Places du modèle procédural, en jeu : x, y, z, taille → Blender : x, −z, y.)
        for k, (x, y, z, t) in enumerate([(-0.45, 0.62, 0.1, 0.62), (0.5, 0.7, -0.15, 0.55), (0.05, 1.18, 0.05, 0.42)]):
            base = roche(graine * 3 + k)(P2)[0]
            base.data.transform(Matrix.Scale(t, 4))
            # Deux plans de cassure perpendiculaires : quatre quartiers.
            n1 = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 0.5))).normalized()
            n2 = n1.cross(Vector((0, 0, 1))).normalized()
            for s1 in (1, -1):
                for s2 in (1, -1):
                    bm = bmesh.new()
                    bm.from_mesh(base.data)
                    for n, sg in ((n1, s1), (n2, s2)):
                        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
                        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, 0), plane_no=n * sg, clear_inner=True)
                        bord = [e for e in bm.edges if e.is_boundary]
                        if bord:
                            r_ = bmesh.ops.holes_fill(bm, edges=bord, sides=0)
                            for f in r_['faces']:
                                f.material_index = 1
                    if not bm.faces:
                        bm.free()
                        continue
                    # Le quartier s'écarte du centre : on voit le cœur entre les cassures.
                    d = (n1 * s1 + n2 * s2).normalized() * t * 0.09
                    bmesh.ops.translate(bm, vec=d, verts=bm.verts[:])
                    me = bpy.data.meshes.new(f'quartier-{k}')
                    bm.to_mesh(me)
                    bm.free()
                    q = bpy.data.objects.new(f'quartier-{k}', me)
                    bpy.context.scene.collection.objects.link(q)
                    me.materials.append(P2['roche'])
                    me.materials.append(tranche)
                    q.location = (x, -z, y)
                    ob.append(q)
            bpy.data.objects.remove(base)
            # Le cœur en fusion, au centre.
            bm = bmesh.new()
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=t * 0.62)
            c = bpy.data.objects.new(f'coeur-{k}', bpy.data.meshes.new(f'coeur-{k}'))
            bm.to_mesh(c.data)
            bm.free()
            bpy.context.scene.collection.objects.link(c)
            c.data.materials.append(braise)
            c.location = (x, -z, y)
            ob.append(c)
        for o in ob:
            figer(o)
        halos = [[x, y, z, t * 1.6, 1, 0.45, 0.2, 0.5] for x, y, z, t in [(-0.45, 0.62, 0.1, 0.62), (0.5, 0.7, -0.15, 0.55), (0.05, 1.18, 0.05, 0.42)]]
        return ob, {'halos': halos}
    return fabrique


OBJETS = {'barriere': barriere, **{f'rochers-{k}': rochers(k) for k in range(3)}}


def construire(nom, fn, P):
    objets, points = fn(P)
    for o in objets:
        appliquer(o)
    comptes = {}
    for o in objets:
        o.data.calc_loop_triangles()
        k = o.name.split('.')[0]
        comptes[k] = comptes.get(k, 0) + len(o.data.loop_triangles)
    print(f'  {nom} :', ', '.join(f'{k} {v}' for k, v in sorted(comptes.items(), key=lambda kv: -kv[1])))
    ob = joindre(objets, nom)
    lisser(ob, 40)
    return ob, points


def executer(objets, fichier, cadrages=None):
    """
    Construit les obstacles du dictionnaire {nom: fonction(P) → (objets, points)}, les exporte dans
    public/rush/modeles/<fichier>, et fait un aperçu Cycles de chacun (sauf --sans-apercu ; noms après « -- »
    pour n'en prévisualiser que certains). « cadrages » : {nom: (cible, distance)} pour l'aperçu.
    """
    vider()
    P = matieres_objets(palette())
    choix = [a for a in sys.argv[sys.argv.index('--') + 1:] if not a.startswith('--')] if '--' in sys.argv else []
    apercus = Path(__file__).resolve().parents[2] / 'captures' / 'v4h' / 'modeles'
    apercus.mkdir(parents=True, exist_ok=True)
    resultats = []
    for nom, fn in objets.items():
        ob, pts = construire(nom, fn, P)
        resultats.append((nom, ob, pts))
    ecrire_prm(SORTIE / fichier, resultats)
    if '--sans-apercu' not in sys.argv:
        for nom, ob, _ in resultats:
            if choix and nom not in choix:
                continue
            for o in bpy.data.objects:
                o.hide_render = o.type == 'MESH' and o != ob
            cible, distance = (cadrages or {}).get(nom, ((0, 0, 0.8), 5.5))
            apercu(apercus / f'objet-{nom}.png', cible=cible, distance=distance, azimut=25, elevation=16, echantillons=16)


if __name__ == '__main__':
    executer(OBJETS, 'objets.prm')
