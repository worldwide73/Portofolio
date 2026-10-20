# PORTAL RUSH — LES QUATRE VAISSEAUX (Blender). Voir commun.py pour la chaîne et le format.
#
# Chaque vaisseau a sa silhouette, ses proportions et sa personnalité (pas une même forme repeinte) :
#   Aube     — le coureur équilibré : fuselage en coin, deux nacelles latérales sur pylônes, ailes en flèche,
#              blindage en plaques peintes, liserés lumineux sur quelques jointures ;
#   Faucon   — l'agile : fuseau effilé, plans canard, une grosse tuyère centrale et deux petites, dérive haute ;
#   Bastion  — le lourd : caisse large et basse, quatre moteurs en bloc, étrave blindée, patins épais ;
#   Spectre  — le furtif : aile volante à facettes, tuyères en fente, peinture sombre, liserés violets.
# Dimensions proches de l'ancien modèle (longueur ~3,5 m, le nez vers +Y dans Blender, −Z dans le jeu) : la
# collision reste celle du moteur de jeu.

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import SORTIE, appliquer, ajouter_matiere, apercu, ecrire_prm, figer, joindre, lisser, modif, palette, vider  # noqa: E402
from formes import aile, boite, coque, couronne, miroir_x, piece, plaques, revolution, tube  # noqa: E402


def section_coin(l, haut, bas, epaule=0.55, bouchain=0.02):
    """La moitié droite d'une section de fuselage « en coin » : dos bombé, épaule, bouchain vif, ventre plat."""
    return [(0, haut), (l * 0.5, haut * 0.96), (l * 0.86, haut * epaule), (l, bouchain), (l * 0.82, bas * 0.7), (l * 0.42, bas), (0, bas)]


def nacelle(nom, P, x, z, y0, y1, r, couleur_coque):
    """
    Une nacelle moteur le long de Y (de y1 à l'avant, à y0 à l'arrière) : lèvre d'entrée d'air, carénage, bagues,
    tuyère à volets, cœur lumineux, aubes visibles dans l'entrée. Renvoie la liste des objets et le point de tuyère.
    """
    L = y1 - y0
    profil = [
        (r * 0.72, y1 + 0.02), (r * 0.9, y1 + 0.03), (r * 1.0, y1 - 0.02),       # la lèvre
        (r * 1.04, y1 - L * 0.12), (r * 1.06, y1 - L * 0.45), (r * 1.02, y1 - L * 0.7),  # le carénage
        (r * 1.06, y1 - L * 0.72), (r * 1.06, y1 - L * 0.76), (r * 0.98, y1 - L * 0.78),  # une bague
        (r * 0.94, y0 + L * 0.12), (r * 0.86, y0 + 0.02),                       # le cône arrière
    ]
    mats = [P['alliage'], P['alliage'], couleur_coque, couleur_coque, couleur_coque, P['acier'], P['blindageClair'], P['acier'], P['blindage'], P['tuyere']]
    corps = revolution(nom + '-corps', profil, couleur_coque, segments=40, mats_par_bande=mats)
    # L'intérieur de l'entrée d'air : un conduit sombre et un disque d'aubes.
    conduit = revolution(nom + '-conduit', [(r * 0.72, y1 + 0.02), (r * 0.7, y1 - 0.12), (r * 0.3, y1 - 0.18)], P['joint'], segments=32)

    def aube(bm):
        boite(bm, (r * 0.36, 0, 0), (r * 0.62, 0.008, r * 0.16), Matrix.Rotation(0.5, 3, 'X'))

    aubes = couronne(nom + '-aubes', 14, aube, 0.0, centre=(0, y1 - 0.11, 0))
    aubes.data.materials.append(P['alliage'])
    # La tuyère : une couronne de volets inclinés, l'intérieur chaud, le cœur lumineux.
    def volet(bm):
        boite(bm, (r * 0.78, -0.06, 0), (0.02, 0.14, r * 0.42), Matrix.Rotation(-0.22, 3, 'Z'))

    volets = couronne(nom + '-volets', 12, volet, 0.0, centre=(0, y0 + 0.02, 0))
    volets.data.materials.append(P['tuyere'])
    interieur = revolution(nom + '-chaud', [(r * 0.8, y0 + 0.03), (r * 0.62, y0 + 0.1), (r * 0.42, y0 + 0.16)], P['chaud'], segments=32)
    coeur = revolution(nom + '-coeur', [(r * 0.42, y0 + 0.16), (r * 0.2, y0 + 0.17), (0.001, y0 + 0.17)], P['accent'], segments=24)
    objets = [corps, conduit, aubes, volets, interieur, coeur]
    for o in objets:
        o.location = (x, o.location.y, z)  # (garder le recul des pièces centrées hors de l'origine : volets, aubes)
    return objets, (x, z, y0 - 0.02)


def tuyere(nom, P, x, z, y, r, longueur=0.13):
    """Une tuyère au bout d'une nacelle (vers −Y) : bague, volets, intérieur chaud, cœur lumineux."""
    bague = revolution(nom + '-bague', [(r * 1.02, y + 0.06), (r * 1.08, y + 0.03), (r * 1.08, y - 0.02), (r * 1.0, y - 0.04), (r * 0.92, y - 0.03)], P['acier'], segments=36)

    def volet(bm):
        # (Des volets courts, légèrement ouverts : on voit l'intérieur chaud et le cœur depuis l'arrière.)
        boite(bm, (r * 0.9, -longueur * 0.5, 0), (0.016, longueur, r * 0.36), Matrix.Rotation(0.12, 3, 'Z'))

    volets = couronne(nom + '-volets', 14, volet, 0.0, centre=(0, y - 0.02, 0))
    volets.data.materials.append(P['tuyere'])
    chaud = revolution(nom + '-chaud', [(r * 0.84, y - 0.02), (r * 0.66, y + 0.06), (r * 0.46, y + 0.12)], P['chaud'], segments=32)
    coeur = revolution(nom + '-coeur', [(r * 0.46, y + 0.12), (r * 0.22, y + 0.13), (0.001, y + 0.13)], P['accent'], segments=24)
    objets = [bague, volets, chaud, coeur]
    for o in objets:
        o.location = (x, o.location.y, z)  # (garder le recul des pièces centrées hors de l'origine : volets, aubes)
    return objets, (x, z, -(y - longueur))


def aube_vaisseau(P):
    """
    AUBE : le coureur équilibré. Un corps central bas et long (le pilote), deux nacelles-moteurs écartées, reliées
    par des ailes en flèche épaisses (le pont), des dérives inclinées, des tuyères à volets. Lecture immédiate :
    trois volumes, deux gros moteurs, un pont lumineux.
    """
    from formes import fuseau, ruban, super_ellipse
    ob = []
    X = 0.8  # l'écartement des nacelles

    # ---- Le corps central : bas, nez en ciseau, ventre plat ----
    def sec(y, rx, rz, cz=0.04, n=3.2):
        return (y, super_ellipse(0, cz, rx, rz, n=n, points=24, aplatir_bas=0.55))
    corps = fuseau('corps', [(2.08, [(0, -0.01)]), sec(1.86, 0.05, 0.028, 0.0), sec(1.55, 0.12, 0.052, 0.01), sec(1.15, 0.2, 0.085, 0.025), sec(0.7, 0.26, 0.12), sec(0.2, 0.3, 0.145, 0.05), sec(-0.4, 0.31, 0.15, 0.05), sec(-0.95, 0.29, 0.135, 0.045), sec(-1.3, 0.26, 0.115), sec(-1.44, 0.245, 0.1)], P['blindage'], subdivision=1)
    ob.append(corps)

    # ---- Les nacelles : pointes en avant (des crocs), moteurs à l'arrière ----
    def pod(y, rx, rz, cz=0.02):
        return (y, super_ellipse(X, cz, rx, rz, n=3.0, points=20, aplatir_bas=0.35))
    nac = fuseau('nacelle', [(1.52, [(X - 0.02, -0.025)]), pod(1.32, 0.05, 0.035, -0.01), pod(0.98, 0.1, 0.075, 0.0), pod(0.42, 0.15, 0.115, 0.01), pod(-0.4, 0.175, 0.135), pod(-1.1, 0.18, 0.14), pod(-1.46, 0.175, 0.135)], P['blindage'], subdivision=1)
    ob.append(nac)
    # Le capot (peint) en trois plaques, la bande de course au sommet, les flancs clairs à liseré lumineux.
    coupes = [0.72, 0.1, -0.55]
    xb = (X - 0.055, X + 0.055)
    plans = [((0, y, 0), (0, 1, 0)) for y in coupes] + [((0, 0, 0.1), (0, 0, 1)), ((0, 0, -0.05), (0, 0, 1)), ((xb[0], 0, 0), (1, 0, 0)), ((xb[1], 0, 0), (1, 0, 0)), ((X + 0.1, 0, 0), (1, 0, 0))]

    def region_nac(c):
        if c.y > 1.2 or c.y < -1.4:
            return None
        b = sum(1 for y in coupes if c.y < y)
        if c.z >= 0.1:
            return ('bande', b) if xb[0] < c.x < xb[1] else ('capot', b, c.x > X)
        if -0.05 < c.z < 0.1 and c.x > X + 0.1 and -1.3 < c.y < 1.0:
            return ('flanc', b)
        return None

    def filtre(type_):
        return lambda c: (lambda r: r if r and r[0] == type_ else None)(region_nac(c))
    ob.append(plaques('capots', nac, (plans, filtre('capot')), P['coque'], epaisseur=0.012, jour=0.014, mat_tranche=P['joint']))
    ob.append(plaques('bande', nac, (plans, filtre('bande')), P['peinture2'], epaisseur=0.018, jour=0.012, mat_tranche=P['joint']))
    ob.append(plaques('flancs', nac, (plans, filtre('flanc')), P['blindageClair'], epaisseur=0.01, jour=0.014, mat_tranche=P['accentDoux']))

    # ---- Le dos du corps : plaques peintes autour de la verrière, une épine dorsale sombre à l'arrière ----
    coupes_c = [1.3, 0.85, 0.25, -0.45]
    plans_c = [((0, y, 0), (0, 1, 0)) for y in coupes_c] + [((0.09, 0, 0), (1, 0, 0)), ((-0.09, 0, 0), (1, 0, 0)), ((0, 0, 0.11), (0, 0, 1))]

    def dos(c):
        if c.z < 0.11 or c.y > 1.75 or c.y < -1.38:
            return None
        cote = 0 if c.x < -0.09 else (1 if c.x <= 0.09 else 2)
        if cote == 1 and (0.25 < c.y < 1.3 or c.y < -0.45):
            return None  # la verrière ; l'épine dorsale
        return (sum(1 for y in coupes_c if c.y < y), cote)
    ob.append(plaques('dos', corps, (plans_c, dos), P['coque'], epaisseur=0.014, jour=0.016, mat_tranche=P['joint']))
    # L'épine dorsale : une poutre sombre à ouïes derrière la verrière.
    def epine(bm):
        boite(bm, (0, -0.95, 0.19), (0.12, 1.0, 0.035))
        for k in range(7):
            boite(bm, (0, -0.55 - k * 0.12, 0.21), (0.09, 0.03, 0.012))
    ob.append(piece('epine', epine, P['carbone'], biseau=0.008))

    # ---- Le pont : des ailes en flèche épaisses entre le corps et les nacelles ----
    pont = aile('pont', [(0.15, 0.78, -1.02, 0.085, 0.035), (0.45, 0.48, -1.12, 0.072, 0.045), (X - 0.05, 0.12, -1.2, 0.06, 0.055)], P['blindageClair'], subdivision=0)
    modif(pont, 'BEVEL', width=0.008, segments=2, limit_method='ANGLE', angle_limit=math.radians(25))
    appliquer(pont)
    ob.append(pont)
    # Le dessus du pont : un panneau peint (couleur 2) en retrait, le bord d'attaque lumineux.
    def panneau_pont(bm):
        v = [bm.verts.new(p) for p in [(0.33, 0.5, 0.09), (0.6, 0.24, 0.1), (0.6, -0.95, 0.093), (0.33, -0.9, 0.088)]]
        bm.faces.new(v)
    pp = piece('pont-peint', panneau_pont, P['peinture2'])
    modif(pp, 'SOLIDIFY', thickness=0.012, offset=1.0)
    ob.append(pp)
    # (Le bord d'attaque suit la flèche de l'aile : on le pose sur son nez, à demi enfoncé.)
    ob.append(ruban('bord-pont', [(0.3, 0.645, 0.034), (0.45, 0.475, 0.045), (0.7, 0.19, 0.053)], 0.024, 0.016, P['accent']))
    # Dessous : une poutre de structure et deux vérins (la mécanique visible entre les volumes).
    ob.append(piece('poutre', lambda bm: boite(bm, (0.46, -0.6, -0.03), (0.42, 0.12, 0.06)), P['carbone'], biseau=0.01))
    def verins(bm):
        tube(bm, (0.3, 0.2, -0.04), (0.64, -0.2, -0.03), 0.018, 8)
        tube(bm, (0.3, 0.1, -0.04), (0.42, -0.04, -0.035), 0.028, 8)
    ob.append(piece('verins', verins, P['alliage']))

    # ---- La verrière : basse, en goutte ; son arête et son arceau ----
    def bul(y, rx, rz):
        return (y, super_ellipse(0, 0.12, rx, rz, n=2.4, points=20, aplatir_bas=0.9))
    ob.append(fuseau('verriere', [(1.34, [(0, 0.12)]), bul(1.2, 0.06, 0.04), bul(0.95, 0.13, 0.085), bul(0.65, 0.15, 0.1), bul(0.42, 0.12, 0.075), (0.27, [(0, 0.13)])], P['verre'], subdivision=1))
    ob.append(ruban('arete-verriere', [(0, 1.2, 0.163), (0, 0.95, 0.208), (0, 0.65, 0.222), (0, 0.42, 0.198), (0, 0.29, 0.15)], 0.016, 0.012, P['alliage'], normale=(1, 0, 0)))
    pts = [(-0.15 * math.cos(a), 0.78, 0.12 + 0.1 * math.sin(a)) for a in [i * math.pi / 8 for i in range(9)]]
    ob.append(ruban('arceau', pts, 0.022, 0.014, P['alliage'], normale=(0, 1, 0)))

    # ---- Les dérives sur les nacelles, inclinées vers l'extérieur ; leur bord d'attaque lumineux ----
    # (Une aile posée sur la tranche : l'envergure x devient la hauteur, inclinée de 16° vers l'extérieur.)
    cant = math.radians(90 - 16)
    der_sections = [(0.0, -0.45, -1.42, 0.05, 0.0), (0.3, -0.9, -1.5, 0.036, 0.0), (0.54, -1.22, -1.58, 0.024, 0.0)]
    der = aile('derive', der_sections, P['coque'], subdivision=0)
    modif(der, 'BEVEL', width=0.006, segments=2, limit_method='ANGLE', angle_limit=math.radians(25))
    appliquer(der)
    der.rotation_euler = (0, -cant, 0)
    der.location = (X + 0.03, 0, 0.11)
    figer(der)
    ob.append(der)

    def sur_derive(s, y):
        return (X + 0.03 + s * math.cos(cant), y, 0.11 + s * math.sin(cant))
    ob.append(ruban('liseré-derive', [sur_derive(s, y + 0.004) for s, y, *_ in der_sections], 0.014, 0.03, P['accentDoux'], normale=(math.sin(cant), 0, -math.cos(cant))))
    # L'aérofrein (s'ouvre au freinage dans le jeu : ici fermé) et sa charnière.
    ob.append(piece('aerofrein', lambda bm: boite(bm, (X - 0.12, -1.05, 0.16), (0.1, 0.3, 0.012), Matrix.Rotation(0.1, 3, 'X')), P['blindageClair'], biseau=0.004))

    # ---- Les tuyères ----
    tu, point = tuyere('tuyere', P, X, 0.02, -1.48, 0.17)
    ob += tu

    # ---- L'arrière du corps : un radiateur à lamelles éclairé de l'intérieur ----
    def arriere(bm):
        boite(bm, (0, -1.43, 0.05), (0.38, 0.04, 0.15))
        for k in range(6):
            boite(bm, (-0.155 + k * 0.062, -1.455, 0.05), (0.028, 0.02, 0.12))
    ob.append(piece('arriere', arriere, P['carbone'], biseau=0.004))
    ob.append(piece('coeur-arriere', lambda bm: boite(bm, (0, -1.47, 0.05), (0.34, 0.006, 0.02)), P['coeur']))

    # ---- Le ventre : patins anti-gravité lumineux dans leurs logements ----
    for x, y in [(X, 0.4), (X, -0.95)]:
        ob.append(piece('logement', lambda bm, x=x, y=y: boite(bm, (x, y, -0.115), (0.2, 0.34, 0.04)), P['carbone'], biseau=0.012, segments=2))
        ob.append(piece('patin', lambda bm, x=x, y=y: boite(bm, (x, y, -0.137), (0.14, 0.26, 0.006)), P['accent']))

    # ---- Les détails : ouïes des nacelles, conduit le long du flanc, capteurs, feux ----
    def ouies(bm):
        for k in range(6):
            boite(bm, (X + 0.178, -0.3 - k * 0.07, 0.03), (0.012, 0.035, 0.07))
    ob.append(piece('ouies', ouies, P['carbone']))
    ob.append(piece('conduit', lambda bm: tube(bm, (X + 0.17, 0.85, -0.06), (X + 0.185, -1.25, -0.06), 0.014, 6), P['alliage']))
    ob.append(piece('capteur', lambda bm: boite(bm, (0.06, 1.6, 0.045), (0.025, 0.08, 0.012)), P['verre']))
    ob.append(piece('feu-nav', lambda bm: boite(bm, (X - 0.02, 1.36, 0.0), (0.02, 0.04, 0.02)), P['navVert']))
    ob.append(piece('feu-arriere', lambda bm: boite(bm, (X + 0.14, -1.42, 0.09), (0.03, 0.02, 0.03)), P['feuBlanc']))

    # Tout ce qui est d'un côté est mis en miroir.
    seuls = ('corps', 'verriere', 'arete-verriere', 'arceau', 'dos', 'epine', 'arriere', 'coeur-arriere')
    for o in list(ob):
        if o is None or o.name.split('.')[0] in seuls:
            continue
        appliquer(o)
        c = miroir_x(o)
        if o.name.startswith('feu-nav'):
            c.data.materials[0] = P['feuRouge']
        ob.append(c)
    ob = [o for o in ob if o is not None]
    t = (point[0], point[1], point[2], 0.17)
    points = {'tuyeres': [t, (-t[0], t[1], t[2], t[3])], 'emetteurs': [(0.45, 0.1, 0.1), (-0.45, 0.1, 0.1), (0.62, 0.08, 0.55), (-0.62, 0.08, 0.55)]}
    return ob, points


NOMS = ('aube', 'faucon', 'bastion', 'spectre')


def fabrique(nom):
    """La fonction qui construit le vaisseau « nom » (Aube ici ; les autres dans vaisseau_<nom>.py)."""
    if nom == 'aube':
        return aube_vaisseau
    import importlib
    return getattr(importlib.import_module(f'vaisseau_{nom}'), f'{nom}_vaisseau')


def construire(nom, fn, P):
    objets, points = fn(P)
    comptes = {}
    for o in objets:
        appliquer(o)
        o.data.calc_loop_triangles()
        k = o.name.split('.')[0]
        comptes[k] = comptes.get(k, 0) + len(o.data.loop_triangles)
    print('  triangles par pièce :', ', '.join(f'{k} {v}' for k, v in sorted(comptes.items(), key=lambda kv: -kv[1])))
    ob = joindre(objets, nom)
    lisser(ob, 34)
    # (Les points sont déjà dans le repère du jeu : x, y = z Blender, z = −y Blender.)
    return ob, points


if __name__ == '__main__':
    P = palette()
    choix = [a for a in sys.argv[sys.argv.index('--') + 1:] if not a.startswith('--')] if '--' in sys.argv else list(NOMS)
    apercus = Path(__file__).resolve().parents[2] / 'captures' / 'v4h' / 'modeles'
    apercus.mkdir(parents=True, exist_ok=True)
    for nom in choix:
        vider()
        P = palette()
        ob, pts = construire(nom, fabrique(nom), P)
        ecrire_prm(SORTIE / f'{nom}.prm', [(nom, ob, pts)])
        if '--sans-apercu' not in sys.argv:
            for o in bpy.data.objects:
                o.hide_render = o.type == 'MESH' and o != ob
            apercu(apercus / f'{nom}-arriere.png', cible=(0, -0.2, 0.05), distance=6.2, azimut=30, elevation=24)
            apercu(apercus / f'{nom}-avant.png', cible=(0, 0, 0.05), distance=6.0, azimut=150, elevation=18)
