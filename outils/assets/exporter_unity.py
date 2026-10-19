# PORTAL RUSH — L'EXPORT FBX POUR UNITY (Blender). Voir commun.py pour la chaîne et unity/…/Modeles/LISEZMOI.md.
#
# Reconstruit les modèles avec les constructeurs des scripts PRM (mêmes fonctions, mêmes sessions, mêmes matières :
# aucune géométrie n'est recopiée ici), vérifie qu'ils redonnent les .prm du jeu web (réécrits à part, jamais dans
# public/), puis écrit :
#   unity/PortalRush/Assets/PortalRush/Modeles/<Dossier>/<fichier>.fbx  un objet nommé par modèle logique (« roche-2 »)
#   …/Modeles/palette.json   une entrée par matière « PR_<nom> » (couleur sRGB, métal, rugosité, émission, canal)
#   …/Modeles/modeles.json   le manifeste : fichiers, objets, triangles, matières, bornes et ancrages (repère Unity)
#
# Repères. Blender : Z en haut, nez des vaisseaux et sens de la course vers +Y, droite +X. Jeu web : y en haut, nez
# vers −z, jeu (x, y, z) = Blender (x, z, −y) (commun.vers_jeu). Unity (main gauche) : Y en haut, nez et sens de la
# course vers +Z, droite +X : Unity (x, y, z) = Blender (x, z, y) = jeu (x, y, −z).
# Pour l'obtenir avec un en-tête FBX standard (Y en haut, avant +Z, X à droite : aucune conversion d'axes ambiguë
# dans Unity), le maillage est tourné d'un demi-tour autour de Z, puis exporté avec les axes par défaut (−Z avant,
# Y en haut, transformation inscrite dans les sommets). Unity, qui change de main en inversant X, retombe sur
# Unity = Blender (x, z, y). Échelle : mètres (unité FBX = 100 cm, facteur d'import Unity 1).
#
# Lancer (Python 3.13 + bpy 5.2 en module, environnement isolé ; voir le LISEZMOI) :
#   <venv>/bin/python outils/assets/exporter_unity.py            tout exporter, puis tout vérifier (réimport bpy)
#   <venv>/bin/python outils/assets/exporter_unity.py --verifier seulement vérifier les FBX existants

import hashlib
import json
import math
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402  (bpy d'abord : il rend bmesh et mathutils importables)
from mathutils import Matrix, Vector  # noqa: E402

from commun import CANAL, SORTIE, ecrire_prm, hexa, palette, vider  # noqa: E402

RACINE = Path(__file__).resolve().parents[2]
CIBLE = RACINE / 'unity' / 'PortalRush' / 'Assets' / 'PortalRush' / 'Modeles'
NOM_CANAL = {v: k for k, v in CANAL.items()}
# Le demi-tour autour de Z qui fait regarder le modèle vers +Z Unity (voir l'en-tête).
DEMI_TOUR = Matrix.Rotation(math.pi, 4, 'Z')
# Le facteur d'émission du shader du jeu web (materiaux.ts : couleur += lueur * émission * 3,2).
FACTEUR_EMISSION = 3.2
MATIERE_DEFAUT = ('#888888', 0.5, 0.5, 0.0, 0)  # (celle de maillage_jeu quand un triangle n'a pas de matière)


# ---------------------------------------------------------------------------
# Les sessions : une par fichier PRM, exactement comme les scripts d'origine (vider, matières, constructeurs).
# Chacune renvoie [(nom, objet joint, points d'ancrage {clé: [(x, y, z, …) jeu]})].
# ---------------------------------------------------------------------------
def session_vaisseau(nom):
    def construire():
        import vaisseaux
        vider()
        ob, pts = vaisseaux.construire(nom, vaisseaux.fabrique(nom), palette())
        return [(nom, ob, pts)]
    return construire


def session_piste():
    import piste
    vider()
    P = piste.matieres_piste(palette())
    return [(nom, *piste.construire(nom, fn, P)) for nom, fn in piste.MODULES.items()]


def session_decor():
    import decor
    vider()
    P = decor.matieres_decor(palette())
    return [(nom, decor.construire(nom, P), {}) for nom in decor.MODULES]


def session_objets(module):
    def construire():
        import importlib
        import objets
        famille = importlib.import_module(module)
        vider()
        P = objets.matieres_objets(palette())  # (comme objets.executer)
        return [(nom, *objets.construire(nom, fn, P)) for nom, fn in famille.OBJETS.items()]
    return construire


def session_monde(monde):
    def construire():
        import decor
        import decor_mondes
        vider()
        P = decor.matieres_decor(palette())
        return [(nom, *decor_mondes.construire(nom, fn, P)) for nom, fn in decor_mondes.MONDES[monde].items()]
    return construire


def sessions():
    """(fichier PRM, famille des matières, constructeur, destination(nom) → chemin FBX relatif), dans l'ordre."""
    import decor_mondes
    import vaisseaux

    def groupe(table, defaut):
        return lambda nom: table.get(nom, defaut(nom))
    s = [(f'{v}.prm', 'vaisseaux', session_vaisseau(v), lambda nom: f'Vaisseaux/{nom}.fbx') for v in vaisseaux.NOMS]
    s.append(('piste.prm', 'piste', session_piste, lambda nom: f'Piste/{nom}.fbx'))
    s.append(('decor.prm', 'decor', session_decor, lambda nom: 'Decor/roches.fbx' if nom.startswith('roche-') else f'Decor/{nom}.fbx'))
    s.append(('objets.prm', 'objets', session_objets('objets'), lambda nom: 'Obstacles/rochers.fbx' if nom.startswith('rochers-') else f'Obstacles/{nom}.fbx'))
    s.append(('objets-mobiles.prm', 'objets', session_objets('objets_mobiles'), lambda nom: f'Obstacles/{nom}.fbx'))
    # Les mécanismes : un fichier par mécanisme, ses pièces mobiles comme objets séparés (pivots du jeu web).
    meca = {'pylones': 'Obstacles/laser.fbx', 'plateforme-meca': 'Decor/Mecanismes/plateforme.fbx'}
    for p in ('porte', 'rotor'):
        meca.update({f'{p}-{q}': f'Obstacles/{p}.fbx' for q in ('cadre', 'battant', 'moyeu', 'pale')})
    for p, q in (('turbine', ('cadre', 'rotor')), ('radar', ('tour', 'antenne')), ('presse', ('cadre', 'tete')), ('balise', ('mat', 'tete'))):
        meca.update({f'{p}-{x}': f'Decor/Mecanismes/{p}.fbx' for x in q})
    s.append(('objets-mecanismes.prm', 'objets', session_objets('objets_mecanismes'), groupe(meca, lambda nom: f'Obstacles/{nom}.fbx')))
    s.append(('objets-collecte.prm', 'objets', session_objets('objets_collecte'), lambda nom: f'Collecte/{nom.removeprefix("cristal-")}.fbx'))
    for monde in decor_mondes.MONDES:
        s.append((f'monde-{monde}.prm', 'mondes', session_monde(monde), lambda nom, monde=monde: f'Mondes/{monde}/{nom}.fbx'))
    return s


# ---------------------------------------------------------------------------
# La palette Unity : un nom « PR_<nom> » par matière ; si deux scripts donnent au même nom des réglages différents
# (neonBlanc : 1,6 dans le décor, 1,4 dans les obstacles), le premier dans l'ordre d'export garde le nom court,
# l'autre prend « PR_<nom>_<famille> ».
# ---------------------------------------------------------------------------
class Palette:
    def __init__(self):
        self.entrees = {}  # nom Unity → (props, nom Blender, famille)

    def nommer(self, nom, props, famille):
        for cand in (f'PR_{nom}', f'PR_{nom}_{famille}', *(f'PR_{nom}_{famille}{k}' for k in range(2, 99))):
            e = self.entrees.get(cand)
            if e is None:
                self.entrees[cand] = (props, nom, famille)
                return cand
            if e[0] == props:
                return cand
        raise ValueError(f'matière {nom} : trop de variantes')

    def json(self):
        matieres = []
        for nom in sorted(self.entrees):
            (c, metal, rugo, emi, canal), source, famille = self.entrees[nom]
            matieres.append({
                'nom': nom, 'source': source, 'famille': famille, 'hex': c.lower(),
                'couleur': [round(v, 4) for v in hexa(c)], 'metal': float(metal), 'rugosite': float(rugo), 'emission': float(emi),
                'canal': NOM_CANAL[canal],
            })
        return {
            'version': 1,
            'espaceCouleur': 'sRGB',  # comme le jeu web : hexadécimal / 255, linéarisé par le moteur (≈ puissance 2,2)
            'facteurEmission': FACTEUR_EMISSION,
            'note': 'couleur : sRGB 0-1 (Material.SetColor la linéarise). Émission linéaire = couleur linéaire × emission × facteurEmission.',
            'matieres': matieres,
            'canaux': CANAUX,
        }


# Ce que fait chaque canal dans le jeu web (materiaux.ts, scene.ts : equiper) : d'où vient la couleur, ce qui l'anime.
# Sur le vaisseau, accent, accent2 et coeur suivent les pièces du garage ; ailleurs, les couleurs du monde.
CANAUX = [
    {'nom': 'fixe', 'index': 0, 'couleur': 'palette', 'anime': False, 'role': 'couleur de la palette, telle quelle'},
    {'nom': 'peinture', 'index': 1, 'couleur': 'peinture', 'anime': False, 'role': 'vaisseau : couleur de la pièce « coque » du garage (la palette donne la teinte par défaut)'},
    {'nom': 'accent', 'index': 2, 'couleur': 'accent', 'anime': True, 'role': "lueur — vaisseau : pièce « traînée » ; ailleurs : accent du monde ; impulsions qui courent vers l'avant (combo, Overdrive)"},
    {'nom': 'accent2', 'index': 3, 'couleur': 'accent2', 'anime': False, 'role': 'lueur — vaisseau : pièce « overdrive » ; ailleurs : seconde couleur du monde'},
    {'nom': 'danger', 'index': 4, 'couleur': 'danger', 'anime': False, 'role': 'lueur à la couleur de danger du monde'},
    {'nom': 'coeur', 'index': 5, 'couleur': 'coeur', 'anime': False, 'role': "lueur — vaisseau : pièce « noyau » (et éclats de l'Overdrive) ; objets : couleur de leur état"},
    {'nom': 'ligne', 'index': 6, 'couleur': 'accent', 'anime': True, 'role': "lignes de guidage : tirets à la couleur d'accent qui défilent, s'allongent en Overdrive"},
    {'nom': 'fissure', 'index': 7, 'couleur': 'danger', 'anime': True, 'role': 'fissures qui palpitent (réseau de bruit attaché à la piste)'},
    {'nom': 'clignote', 'index': 8, 'couleur': 'palette', 'anime': True, 'role': 'feux à éclats : éclair bref, chaque feu à son rythme'},
    {'nom': 'peinture2', 'index': 9, 'couleur': 'accent2', 'anime': False, 'role': 'seconde peinture (bandes) : couleur accent2 × 0,8 (vaisseau : pièce « overdrive »)'},
    {'nom': 'revetement', 'index': 10, 'couleur': 'palette', 'anime': False, 'role': 'revêtement de route : détail très discret, reflets des rails'},
]


def props_matiere(m):
    if m is None:
        return MATIERE_DEFAUT
    return (m.get('jeu_couleur', '#888888'), m.get('jeu_metal', 0.5), m.get('jeu_rugo', 0.5), m.get('jeu_emission', 0.0), m.get('jeu_canal', 0))


# ---------------------------------------------------------------------------
# Le maillage d'export : les triangles exacts du jeu web (ceux de maillage_jeu), ses normales de coin, une
# matière par entrée de palette réellement utilisée, des UV en projection boîte (1 unité = 1 m), le demi-tour.
# ---------------------------------------------------------------------------
def maillage_export(nom, ob, pal, famille):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    M = DEMI_TOUR @ ob.matrix_world
    R = M.to_3x3().inverted().transposed()
    cn = me.corner_normals
    mats = list(ob.data.materials)
    pos = [M @ v.co for v in me.vertices]
    tris = []
    for tri in me.loop_triangles:
        m = mats[tri.material_index] if mats and tri.material_index < len(mats) else None
        nom_u = pal.nommer(m.name if m else 'defaut', props_matiere(m), famille)
        coins = [(me.loops[li].vertex_index, (R @ Vector(cn[li].vector)).normalized()) for li in tri.loops]
        cles = [(*(round(c, 5) for c in pos[vi]), *(round(c, 4) for c in n)) for vi, n in coins]
        k = cles.index(min(cles))  # (le même triangle commence toujours au même coin, sens conservé)
        tris.append(((nom_u, *cles[k:], *cles[:k]), nom_u, coins[k:] + coins[:k]))
    ev.to_mesh_clear()
    # Un ordre canonique (matière, puis géométrie) : l'ordre des triangles et des sommets ne dépend plus de
    # l'assemblage dans Blender (variable d'une exécution à l'autre pour certains modèles) — export reproductible.
    tris.sort(key=lambda t: t[0])
    utilisees = sorted({t[1] for t in tris})
    nouveaux, sommets, faces, normales, indices = {}, [], [], [], []
    for _, nom_u, coins in tris:
        face = []
        for vi, n in coins:
            if vi not in nouveaux:
                nouveaux[vi] = len(sommets)
                sommets.append(pos[vi])
            face.append(nouveaux[vi])
            normales.append(n)
        faces.append(tuple(face))
        indices.append(utilisees.index(nom_u))

    nm = bpy.data.meshes.new(nom)
    nm.from_pydata(sommets, [], faces)
    if len(nm.polygons) != len(faces) or len(nm.loops) != 3 * len(faces):
        raise ValueError(f'{nom} : triangles perdus à la reconstruction')
    for nom_u in utilisees:
        mat = bpy.data.materials.get(nom_u)
        if mat is None:
            # (Une matière d'export sans nœuds : son nom suffit à Unity ; la couleur ne sert qu'à l'aperçu.)
            c, metal, rugo = pal.entrees[nom_u][0][:3]
            mat = bpy.data.materials.new(nom_u)
            mat.diffuse_color = (*[v ** 2.2 for v in hexa(c)], 1)
            mat.metallic, mat.roughness = metal, rugo
        nm.materials.append(mat)
    nm.polygons.foreach_set('material_index', indices)
    # Les normales « libres » (Blender 5 : un vecteur par coin, sans encodage par éventail) : exactes partout, même
    # sur les rares triangles d'aire nulle hérités des biseaux.
    cn_libre = nm.attributes.new('custom_normal', 'FLOAT_VECTOR', 'CORNER')
    cn_libre.data.foreach_set('vector', [x for n in normales for x in n])
    # Les UV : chaque triangle projeté sur le plan de sa normale dominante (de quoi poser plus tard des textures de
    # détail en mètres ; Unity en tire aussi des tangentes valables).
    uv = nm.uv_layers.new(name='UVMap')
    co = [v.co for v in nm.vertices]
    for p in nm.polygons:
        n = p.normal
        u, v = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[max(range(3), key=lambda k: abs(n[k]))]
        for li in p.loop_indices:
            c = co[nm.loops[li].vertex_index]
            uv.data[li].uv = (c[u], c[v])
    nouv = bpy.data.objects.new(nom, nm)
    bpy.context.scene.collection.objects.link(nouv)
    return nouv, utilisees


def exporter_fbx(objets, chemin):
    # Un export reproductible à l'octet (pas de différence Git sans changement réel) : horodatage fixe ; les
    # identifiants des nœuds viennent de hash() des noms, d'où PYTHONHASHSEED=0 (voir __main__).
    import datetime
    from io_scene_fbx import export_fbx_bin

    class Date(datetime.datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 1, 1)
    export_fbx_bin.datetime = type('datetime', (), {'datetime': Date})
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objets:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objets[0]
    chemin.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.fbx(
        filepath=str(chemin), use_selection=True, object_types={'MESH'},
        axis_forward='-Z', axis_up='Y',                   # en-tête standard (Y en haut, avant +Z, X à droite)
        global_scale=1.0, apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS',  # sommets en m, unité 100 cm
        use_space_transform=True, bake_space_transform=True,  # le changement d'axes inscrit dans les sommets
        use_mesh_modifiers=True, mesh_smooth_type='OFF',  # normales de coin (pas de groupes de lissage)
        use_tspace=False, use_triangles=False,            # (déjà en triangles ; Unity calcule les tangentes)
        colors_type='NONE', use_custom_props=False, use_mesh_edges=False, use_subsurf=False,
        add_leaf_bones=False, bake_anim=False, path_mode='STRIP', embed_textures=False, use_metadata=True,
    )


def vers_unity(p):
    """Un point du jeu web (x, y, z) → Unity (x, y, −z)."""
    return [round(p[0], 5), round(p[1], 5), round(-p[2], 5)]


def ancrages(points):
    """Les points d'ancrage du jeu web, dans le repère Unity : tuyères [x, y, z, rayon], émetteurs [x, y, z], halos
    [x, y, z, rayon, r, v, b, intensité]."""
    sortie = []
    for cle, liste in (points or {}).items():
        for p in liste:
            a = {'type': cle.rstrip('s') if cle != 'halos' else 'halo', 'position': vers_unity(p)}
            if len(p) > 3:
                a['rayon'] = round(p[3], 5)
            if len(p) >= 7:
                a['couleur'] = [round(v, 4) for v in p[4:7]]
            if len(p) >= 8:
                a['intensite'] = round(p[7], 4)
            sortie.append(a)
    return sortie


def bornes_unity(ob):
    """Les bornes d'un objet d'export (repère Blender tourné) dans le repère Unity : (x, y, z) = (−x, z, −y)."""
    pts = [(-v.co.x, v.co.z, -v.co.y) for v in ob.data.vertices]
    return [round(min(p[k] for p in pts), 4) for k in range(3)], [round(max(p[k] for p in pts), 4) for k in range(3)]


def ecrire_json(fichier, donnees):
    """Du JSON lisible : indenté, mais les listes de nombres (et de noms) sur une ligne."""
    import re
    texte = json.dumps(donnees, ensure_ascii=False, indent=1)
    texte = re.sub(r'\[\s*((?:-?[\d.e+-]+|"[^"\n]*")(?:,\s*(?:-?[\d.e+-]+|"[^"\n]*"))*)\s*\]', lambda m: '[' + re.sub(r',\s*', ', ', m.group(1)) + ']', texte)
    fichier.write_text(texte + '\n', encoding='utf-8')


def tableau_lisezmoi(manifeste):
    """Réécrit, dans LISEZMOI.md, le tableau des fichiers (entre ses deux balises) d'après le manifeste."""
    lisezmoi = CIBLE / 'LISEZMOI.md'
    if not lisezmoi.exists():
        return
    debut, fin = '<!-- tableau des fichiers : début (écrit par exporter_unity.py) -->', '<!-- tableau des fichiers : fin -->'
    texte = lisezmoi.read_text(encoding='utf-8')
    if debut not in texte or fin not in texte:
        return
    lignes = ['| Fichier | Objets | Triangles | Matières | Taille |', '|---|---|---:|---:|---:|']
    for f in manifeste['fichiers']:
        tri = sum(o['triangles'] for o in f['objets'])
        mats = len({m for o in f['objets'] for m in o['matieres']})
        lignes.append(f"| `{f['chemin']}` | {', '.join(o['nom'] for o in f['objets'])} | {tri} | {mats} | {f['octets'] / 1024:.0f} Ko |")
    total = sum(f['octets'] for f in manifeste['fichiers'])
    lignes.append(f"| **{len(manifeste['fichiers'])} fichiers** | {sum(len(f['objets']) for f in manifeste['fichiers'])} objets | {sum(o['triangles'] for f in manifeste['fichiers'] for o in f['objets'])} | {len({m for f in manifeste['fichiers'] for o in f['objets'] for m in o['matieres']})} | {total / 1024:.0f} Ko |")
    avant, reste = texte.split(debut, 1)
    apres = reste.split(fin, 1)[1]
    lisezmoi.write_text(avant + debut + '\n' + '\n'.join(lignes) + '\n' + fin + apres, encoding='utf-8')


def sha(fichier):
    return hashlib.sha256(Path(fichier).read_bytes()).hexdigest()


def exporter(temp):
    """Construit tout, écrit les FBX, la palette et le manifeste ; « temp » reçoit les PRM reconstruits (sans
    toucher à public/rush/modeles)."""
    pal = Palette()
    fichiers = {}  # chemin relatif → {objets: [...]}
    prm_identiques = []
    for prm, famille, construire, destination in sessions():
        print(f'== {prm}')
        resultats = construire()
        # 1) Les mêmes modèles que le jeu web : on réécrit le PRM à côté et on compare les octets. (Deux exceptions
        # connues : monde-tempete, dont Blender assemble le paratonnerre dans un ordre variable d'une exécution à
        # l'autre — même géométrie — et faucon.prm, publié avant la dernière retouche de son script : tuyères et
        # matière « chaud ». La comparaison géométrique de verifier() tranche.)
        ecrire_prm(temp / prm, resultats)
        ok = (SORTIE / prm).exists() and sha(temp / prm) == sha(SORTIE / prm)
        prm_identiques.append((prm, ok))
        print(f'  PRM reconstruit {"identique" if ok else "différent"} de public/rush/modeles/{prm}')
        # 2) Les objets d'export (les sources sont renommées pour libérer leurs noms).
        for nom, ob, _ in resultats:
            ob.name = ob.data.name = f'source~{nom}'
        groupes = {}
        for nom, ob, pts in resultats:
            nouv, mats = maillage_export(nom, ob, pal, famille)
            mn, mx = bornes_unity(nouv)
            groupes.setdefault(destination(nom), []).append((nouv, {
                'nom': nom, 'triangles': len(nouv.data.polygons), 'matieres': mats, 'min': mn, 'max': mx,
                'ancrages': ancrages(pts),
            }))
        for chemin, liste in groupes.items():
            exporter_fbx([o for o, _ in liste], CIBLE / chemin)
            fichiers[chemin] = {'chemin': chemin, 'dossier': chemin.split('/')[0], 'source': prm, 'objets': [d for _, d in liste]}
            print(f'  → {chemin} ({(CIBLE / chemin).stat().st_size / 1024:.0f} Ko)')
    # 3) La palette et le manifeste.
    ecrire_json(CIBLE / 'palette.json', pal.json())
    for f in fichiers.values():
        f['octets'] = (CIBLE / f['chemin']).stat().st_size
    manifeste = {
        'version': 1,
        'axes': 'Unity : +X droite, +Y haut, +Z avant (nez des vaisseaux, sens de la course) ; Unity = jeu web (x, y, -z)',
        'unite': 'm',
        'fichiers': [fichiers[k] for k in sorted(fichiers)],
    }
    ecrire_json(CIBLE / 'modeles.json', manifeste)
    tableau_lisezmoi(manifeste)
    produits = {CIBLE / k for k in fichiers}
    for f in sorted(CIBLE.rglob('*.fbx')):
        if f not in produits:
            print(f'  attention : {f.relative_to(CIBLE)} n\'est plus produit (à supprimer à la main)')
    print('PRM reconstruits identiques (octets) :', sum(ok for _, ok in prm_identiques), '/', len(prm_identiques))
    if not all(ok for _, ok in prm_identiques):
        print('  différents :', ', '.join(p for p, ok in prm_identiques if not ok), '(voir la comparaison géométrique)')


# ---------------------------------------------------------------------------
# LA VÉRIFICATION : chaque FBX relu deux fois. (a) brut (parse_fbx, ce que lit Unity) : axes, unité, transformations
# des nœuds, et chaque coin (position, normale) comparé au PRM du jeu web ; (b) réimporté dans bpy sans conversion
# d'axes (repère du fichier), comparé au manifeste dans le repère Unity (x inversé, comme le fait Unity) : noms,
# matières, triangles, UV, bornes, sens du nez et des tuyères. (Les normales du réimport bpy ne servent pas : Blender
# ne sait pas garder une normale personnalisée sur un triangle d'aire nulle ; le fichier, lui, la contient.)
# ---------------------------------------------------------------------------
def lire_fbx(chemin):
    """Le FBX tel que Unity le lit : réglages globaux, propriétés des nœuds, et pour chaque nœud ses coins
    (position, normale) dans le repère du fichier, à l'échelle UnitScaleFactor / 100 (mètres)."""
    from io_scene_fbx import parse_fbx
    racine, _ = parse_fbx.parse(str(chemin))

    def enfant(e, nom):
        return next((c for c in e.elems if c.id == nom), None)

    def props(e):
        p70 = enfant(e, b'Properties70')
        return {p.props[0].decode(): p.props[4:] for p in (p70.elems if p70 else [])}
    reglages = props(enfant(racine, b'GlobalSettings'))
    echelle = reglages['UnitScaleFactor'][0] / 100
    noeuds, modeles, geos = {}, {}, {}
    for e in enfant(racine, b'Objects').elems:
        if e.id == b'Model':
            nom = e.props[1].split(b'\x00')[0].decode()
            noeuds[nom] = props(e)
            modeles[e.props[0]] = nom
        elif e.id == b'Geometry':
            v = enfant(e, b'Vertices').props[0]
            idx = enfant(e, b'PolygonVertexIndex').props[0]
            ln = enfant(e, b'LayerElementNormal')
            nrm = enfant(ln, b'Normals').props[0]
            ni = enfant(ln, b'NormalsIndex')
            ni = ni.props[0] if ni is not None else range(len(idx))
            coins = [(tuple(x * echelle for x in v[3 * (i if i >= 0 else ~i):3 * (i if i >= 0 else ~i) + 3]), tuple(nrm[3 * ni[k]:3 * ni[k] + 3])) for k, i in enumerate(idx)]
            geos[e.props[0]] = coins
    coins = {}
    for c in enfant(racine, b'Connections').elems:
        if c.props[0] == b'OO' and c.props[1] in geos and c.props[2] in modeles:
            coins[modeles[c.props[2]]] = geos[c.props[1]]
    return reglages, noeuds, coins


def lire_prm(fichier):
    """Les maillages d'un PRM du jeu web : {nom: (positions, normales, entête)} dans le repère du jeu."""
    import struct
    b = Path(fichier).read_bytes()
    n = struct.unpack_from('<I', b, 4)[0]
    tete = json.loads(b[8:8 + n].decode('utf-8'))
    base = 8 + n
    sortie = {}
    for m in tete['maillages']:
        k = m['sommets']
        q = struct.unpack_from(f'<{3 * k}h', b, base + m['pos'])
        e = [(m['max'][j] - m['min'][j]) or 1e-6 for j in range(3)]
        pos = [tuple(m['min'][j] + (q[3 * i + j] + 32768) / 65535 * e[j] for j in range(3)) for i in range(k)]
        r = struct.unpack_from(f'<{4 * k}b', b, base + m['nor'])
        nor = [(r[4 * i] / 127, r[4 * i + 1] / 127, r[4 * i + 2] / 127) for i in range(k)]
        sortie[m['nom']] = (pos, nor, m)
    return sortie


def comparer_prm(coins, prm):
    """Chaque coin du FBX (repère du fichier) doit retrouver un sommet du PRM du jeu web à la même place et avec la
    même normale, une fois le PRM passé dans le repère du fichier : jeu (x, y, z) → Unity (x, y, −z) → fichier
    (−x, y, −z). Renvoie (part des coins retrouvés, écart de position maximal, bornes Unity du PRM)."""
    from mathutils.kdtree import KDTree
    pos, nor, tete = prm
    arbre = KDTree(len(pos))
    for i, p in enumerate(pos):
        arbre.insert((-p[0], p[1], -p[2]), i)
    arbre.balance()
    pas = max(((tete['max'][j] - tete['min'][j]) / 65535 for j in range(3)))
    tol = 1.5 * pas + 1e-5
    trouves, ecart = 0, 0.0
    for p, n in coins:
        proches = arbre.find_range(p, tol)
        ecart = max(ecart, min((d for _, _, d in proches), default=1.0))
        if any(abs(-nor[i][0] - n[0]) + abs(nor[i][1] - n[1]) + abs(-nor[i][2] - n[2]) < 0.05 for _, i, _ in proches):
            trouves += 1
    mn, mx = tete['min'], tete['max']
    return trouves / max(1, len(coins)), ecart, ([mn[0], mn[1], -mx[2]], [mx[0], mx[1], -mn[2]])


def verifier(reconstruits=None):
    """Vérifie les FBX. Chaque coin est comparé au PRM reconstruit par cet export (obligatoire : 100 %) et au PRM
    publié du jeu web (information : montre ce qui diffère de l'ancien jeu)."""
    manifeste = json.loads((CIBLE / 'modeles.json').read_text(encoding='utf-8'))
    prms = {}
    ecarts_publies = []
    palette_u = {m['nom'] for m in json.loads((CIBLE / 'palette.json').read_text(encoding='utf-8'))['matieres']}
    erreurs, lignes = [], []

    def exiger(cond, msg):
        if not cond:
            erreurs.append(msg)
    for f in manifeste['fichiers']:
        chemin = CIBLE / f['chemin']
        reg, noeuds, coins_fbx = lire_fbx(chemin)
        axes = tuple(reg[k][0] for k in ('UpAxis', 'UpAxisSign', 'FrontAxis', 'FrontAxisSign', 'CoordAxis', 'CoordAxisSign'))
        exiger(axes == (1, 1, 2, 1, 0, 1), f'{f["chemin"]} : axes FBX {axes}')
        exiger(abs(reg['UnitScaleFactor'][0] - 100.0) < 1e-9, f'{f["chemin"]} : UnitScaleFactor {reg["UnitScaleFactor"][0]}')
        for n, p in noeuds.items():
            for k, attendu in (('Lcl Translation', (0, 0, 0)), ('Lcl Rotation', (0, 0, 0)), ('Lcl Scaling', (1, 1, 1))):
                v = p.get(k, attendu)
                exiger(all(abs(a - b) < 1e-6 for a, b in zip(v, attendu)), f'{f["chemin"]} : {n} {k} = {v}')
        # Réimport dans le repère du fichier (aucune conversion), puis Unity = (−x, y, z) × UnitScaleFactor / 100.
        vider()
        bpy.ops.import_scene.fbx(filepath=str(chemin), use_manual_orientation=True, axis_forward='Y', axis_up='Z', global_scale=1.0, use_custom_normals=True)
        importes = {o.name: o for o in bpy.data.objects if o.type == 'MESH'}
        exiger(sorted(importes) == sorted(o['nom'] for o in f['objets']), f'{f["chemin"]} : objets {sorted(importes)}')
        for o in f['objets']:
            ob = importes.get(o['nom'])
            if ob is None:
                continue
            ob.data.calc_loop_triangles()
            tri = len(ob.data.loop_triangles)
            mats = [m.name for m in ob.data.materials]
            mw = ob.matrix_world
            pts = [mw @ v.co for v in ob.data.vertices]
            mn = [min(-p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)]
            mx = [max(-p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)]
            exiger(tri == o['triangles'], f'{o["nom"]} : {tri} triangles, {o["triangles"]} attendus')
            exiger(mats == o['matieres'], f'{o["nom"]} : matières {mats}')
            exiger(all(m in palette_u for m in mats), f'{o["nom"]} : matière hors palette')
            ecart = max(abs(a - b) for a, b in zip(mn + mx, o['min'] + o['max']))
            exiger(ecart < 2e-3, f'{o["nom"]} : bornes Unity {mn} {mx}, attendues {o["min"]} {o["max"]}')
            exiger(all(abs(a - b) < 1e-6 for r1, r2 in zip(mw, Matrix.Identity(4)) for a, b in zip(r1, r2)), f'{o["nom"]} : transformation non nulle')
            exiger('UVMap' in ob.data.uv_layers, f'{o["nom"]} : pas d\'UV')
            # Le jeu web, indépendamment : mêmes sommets, mêmes normales, mêmes bornes (repère Unity).
            for cle, dossier in (('ref', reconstruits), ('pub', SORTIE)):
                if dossier is not None and (cle, f['source']) not in prms and (Path(dossier) / f['source']).exists():
                    prms[(cle, f['source'])] = lire_prm(Path(dossier) / f['source'])
            ref = prms.get(('ref', f['source'])) or prms[('pub', f['source'])]
            part, ecart_prm, (pmn, pmx) = comparer_prm(coins_fbx.get(o['nom'], []), ref[o['nom']])
            exiger(part == 1.0, f'{o["nom"]} : {part:.3%} des coins retrouvés dans le PRM')
            exiger(max(abs(a - b) for a, b in zip(mn + mx, pmn + pmx)) < 2e-3, f'{o["nom"]} : bornes {mn} {mx} ≠ PRM {pmn} {pmx}')
            if ('ref', f['source']) in prms:
                part_pub = comparer_prm(coins_fbx.get(o['nom'], []), prms[('pub', f['source'])][o['nom']])[0]
                if part_pub < 1.0:
                    ecarts_publies.append(f'{o["nom"]} : {part_pub:.2%} des coins identiques au PRM publié ({f["source"]})')
            if f['dossier'] == 'Vaisseaux':
                # Le nez vers +Z Unity : plus long en z qu'en x ; la pointe avant (+z) plus loin que l'arrière ;
                # les tuyères à l'arrière (z < 0), en haut le dos (y max) au-dessus du ventre.
                long_z, larg_x = mx[2] - mn[2], mx[0] - mn[0]
                tuy = [a['position'][2] for a in o['ancrages'] if a['type'] == 'tuyere']
                exiger(long_z > larg_x, f'{o["nom"]} : pas plus long en z ({long_z:.2f}) qu\'en x ({larg_x:.2f})')
                exiger(mx[2] > -mn[2], f'{o["nom"]} : le nez n\'est pas du côté +z ({mn[2]:.2f} … {mx[2]:.2f})')
                exiger(tuy and all(z < 0 for z in tuy), f'{o["nom"]} : tuyères pas à l\'arrière {tuy}')
            lignes.append((f['chemin'], o['nom'], tri, len(mats), mn, mx, part, ecart_prm))
    print('\n| fichier | objet | triangles | matières | bornes Unity min → max (m) | coins = PRM | écart max |')
    print('|---|---|---:|---:|---|---:|---:|')
    for c, n, t, m, mn, mx, part, ec in lignes:
        print(f'| {c} | {n} | {t} | {m} | ({mn[0]:.2f}, {mn[1]:.2f}, {mn[2]:.2f}) → ({mx[0]:.2f}, {mx[1]:.2f}, {mx[2]:.2f}) | {part:.2%} | {ec * 1000:.2f} mm |')
    total = sum(f['octets'] for f in manifeste['fichiers'])
    print(f'\n{len(manifeste["fichiers"])} FBX, {len(lignes)} objets, {sum(l[2] for l in lignes)} triangles, {total / 1024:.0f} Ko')
    for f in manifeste['fichiers']:
        if f['octets'] > 3 * 1024 * 1024:
            print(f'  attention : {f["chemin"]} dépasse 3 Mo ({f["octets"] / 1048576:.1f} Mo)')
    for e in ecarts_publies:
        print('  écart avec le jeu web publié :', e)
    if erreurs:
        print(f'\nÉCHEC : {len(erreurs)} erreur(s)')
        for e in erreurs:
            print('  -', e)
        return False
    print('Vérification : tout est conforme.')
    return True


if __name__ == '__main__':
    if sys.flags.hash_randomization:
        # (Relance avec un hachage fixe : les identifiants des nœuds FBX viennent de hash() des noms.)
        os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, 'PYTHONHASHSEED': '0'})
    with tempfile.TemporaryDirectory(prefix='prm-unity-') as temp:
        if '--verifier' in sys.argv:
            # (Seulement reconstruire les PRM de référence, à côté, sans écrire de FBX.)
            for prm, _, construire, _ in sessions():
                ecrire_prm(Path(temp) / prm, construire())
        else:
            exporter(Path(temp))
        ok = verifier(Path(temp))
    sys.exit(0 if ok else 1)
