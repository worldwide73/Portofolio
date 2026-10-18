# PORTAL RUSH — LA ROUTE (Blender) → public/rush/modeles/piste.prm. Voir commun.py et decor.py.
#
# La route est refaite comme une vraie infrastructure de course anti-gravité (références étudiées : la piste
# en demi-tube aux rails lumineux qui épousent les courbes, les tunnels aux murs galbés chargés de conduites) :
#   chaussee     — 6 m de chaussée continue, lisse et sombre (pas de carrelage) : trois voies de 3 m, sillons
#                  des séparateurs avec leurs filets lumineux, joint de dilatation éclairé, dalle épaisse et
#                  poutre-caisson dessous (visible quand la piste est suspendue) ;
#   bord-ouvert  — 6 m de bord droit (le gauche en miroir) : la chaussée se relève en congé arrondi, un rail
#                  lumineux épais court au pied de la courbe, un second plus haut, panneaux galbés, couronnement
#                  arrondi, face externe nervurée, chemin de câbles ;
#   bord-tunnel  — 6 m de mur de tunnel : même pied, puis un mur concave haut (5,6 m) à grands panneaux, caissons
#                  lumineux, faisceau de conduites à brides et bagues lumineuses, cadre porteur ;
#   voute        — 6 m de voûte de tunnel : arc porteur, panneaux, rampe lumineuse qui suit l'arc, poutre à
#                  hachures, câbles.
# Repère du jeu : x latéral, y vers le haut, z vers l'arrière ; chaussée en y = 0, voies en x = −3, 0, 3
# (VOIE = 3 m) ; modules centrés en z = 0. Dans Blender (Z en haut, Y vers l'avant) : jeu (x, y, z) = (x, z, −y).
# Les modules sont découpés tous les 1,5 m le long de la piste : le pli du parcours (virages, reliefs, dévers,
# appliqué au sommet dans le shader) reste parfaitement lisse.

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402  (bpy d'abord : il rend bmesh et mathutils importables)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from commun import SORTIE, apercu, appliquer, ecrire_prm, figer, joindre, lisser, matiere, palette, vider  # noqa: E402
from decor import barre, extrusion, matieres_decor  # noqa: E402
from formes import boite, piece, tube  # noqa: E402

L = 3.0       # demi-longueur d'un module (Blender Y de −3 à 3)
SEG = 4       # découpes le long de la piste (tous les 1,5 m)
XR = 4.8      # bord de la chaussée


def matieres_piste(P):
    P = matieres_decor(P)
    # La chaussée : un composite métallique sombre, satiné (il reflète les rails lumineux), canal « revetement ».
    P['revetement'] = matiere('revetement', '#1a2029', 0.35, 0.24, 0, 'revetement')
    P['revetement2'] = matiere('revetement2', '#1e252f', 0.4, 0.3, 0, 'revetement')
    P['sillon'] = matiere('sillon', '#0b0e13', 0.4, 0.6)
    P['panneau'] = matiere('panneauPiste', '#2a313c', 0.75, 0.38)
    P['panneauClair'] = matiere('panneauPisteClair', '#3b4452', 0.8, 0.34)
    P['structure'] = matiere('structurePiste', '#20262f', 0.82, 0.45)
    P['rail'] = matiere('railLumineux', '#ffffff', 0, 0.3, 1.25, 'accent')
    P['rail2'] = matiere('railLumineux2', '#ffffff', 0, 0.3, 1.1, 'accent2')
    P['caisson'] = matiere('caissonLumineux', '#e9f2ff', 0, 0.4, 0.9)
    return P


def arc(cx, cz, r, a0, a1, n):
    """Les points d'un arc de cercle (centre cx, cz ; angles en degrés, de a0 à a1), n segments."""
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cz + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


# ---------------------------------------------------------------------------
# LA CHAUSSÉE
# ---------------------------------------------------------------------------
def chaussee(P):
    ob = []
    # La dalle : le dessus en plusieurs bandes (les sillons des séparateurs de voies à x = ±1,5), le chant, le dessous.
    s = 1.5
    profil = [
        (-XR, 0.0), (-s - 0.1, 0.0), (-s - 0.05, -0.025), (-s + 0.05, -0.025), (-s + 0.1, 0.0),
        (s - 0.1, 0.0), (s - 0.05, -0.025), (s + 0.05, -0.025), (s + 0.1, 0.0), (XR, 0.0),
        (XR, -0.55), (-XR, -0.55),
    ]
    rv, sl = P['revetement'], P['sillon']
    mats = [rv, rv, sl, rv, rv, rv, sl, rv, rv, P['structure'], P['structure']]
    ob.append(extrusion('dalle', profil, -L, L, rv, segments=SEG, mats=mats))
    # Les filets lumineux dans les sillons : des tirets de 1,2 m (canal « ligne » : ils s'animent avec le combo).
    def filets(bm):
        for x in (-s, s):
            for k in range(4):
                y = -L + 0.75 + k * 1.5
                boite(bm, (x, y, -0.012), (0.045, 1.1, 0.02))
    ob.append(piece('filets', filets, P['ligne']))
    # Le joint de dilatation en bout de module : une gorge sombre et un fil de lumière encastré.
    ob.append(piece('joint', lambda bm: boite(bm, (0, L - 0.04, -0.02), (2 * XR - 0.2, 0.08, 0.04)), sl))
    ob.append(piece('joint-feu', lambda bm: boite(bm, (0, L - 0.04, -0.006), (2 * XR - 0.6, 0.025, 0.014)), P['accentDoux']))
    # Des pastilles lumineuses encastrées le long des bords de la chaussée (tous les 1,5 m), et des plaques de
    # service vissées, légèrement plus claires (le revêtement n'est pas uniforme).
    ob.append(piece('pastilles', lambda bm: [boite(bm, (sx * (XR - 0.35), -L + 0.75 + k * 1.5, -0.004), (0.16, 0.05, 0.012)) for sx in (1, -1) for k in range(4)], P['caisson']))
    def plaques(bm):
        for x, y, lx, ly in [(-3.0, -1.2, 1.6, 2.2), (3.0, 1.4, 1.6, 1.8), (0.0, 0.6, 1.4, 1.0)]:
            boite(bm, (x, y, -0.003), (lx, ly, 0.01))
    ob.append(piece('plaques', plaques, P['revetement2']))
    # La poutre-caisson sous la dalle : deux âmes, une semelle, des diagonales de contreventement.
    def caisson(bm):
        for sx in (1, -1):
            boite(bm, (sx * 2.6, 0, -1.3), (0.3, 2 * L, 1.5))
        boite(bm, (0, 0, -2.05), (5.8, 2 * L, 0.18))
    ob.append(piece('caisson', caisson, P['structure']))
    def diagonales(bm):
        for y in (-L + 0.2, 0.0):
            barre(bm, (-2.45, y, -0.6), (2.45, y + 0.6, -1.95), 0.16)
            barre(bm, (2.45, y + 1.5, -0.6), (-2.45, y + 2.1, -1.95), 0.16)
    ob.append(piece('diagonales', diagonales, P['acier']))
    for o in ob:
        appliquer(o)
    return ob, {}


# ---------------------------------------------------------------------------
# LE PIED DE BORD (commun aux bords ouvert et tunnel) : congé arrondi et rail lumineux
# ---------------------------------------------------------------------------
def profil_pied():
    """Le profil du congé : depuis le bord de la chaussée (XR, 0), un quart de cercle de rayon 1,1 qui se relève
    jusqu'à ~68°. Renvoie les points (x, z)."""
    R = 1.1
    return arc(XR, R, R, -90, -22, 9)


def rails(P, haut=True):
    ob = []
    # Le rail lumineux du pied : un tube épais dans une gorge, juste au-dessus du congé.
    def gorge(bm):
        boite(bm, (XR + 0.12, 0, 0.05), (0.2, 2 * L, 0.1))
    ob.append(piece('gorge', gorge, P['sillon']))
    ob.append(piece('rail', lambda bm: [tube(bm, (XR + 0.12, -L + k * 1.5, 0.07), (XR + 0.12, -L + (k + 1) * 1.5, 0.07), 0.055, 8) for k in range(4)], P['rail']))
    if haut:
        # Le second rail, plus haut sur la courbe, de la seconde couleur du monde, sur des pattes.
        x, z = XR + 1.1 - 1.1 * math.cos(math.radians(55)), 1.1 - 1.1 * math.sin(math.radians(55))
        ob.append(piece('rail-haut', lambda bm: [tube(bm, (x - 0.05, -L + k * 1.5, z + 0.05), (x - 0.05, -L + (k + 1) * 1.5, z + 0.05), 0.035, 6) for k in range(4)], P['rail2']))
        ob.append(piece('pattes', lambda bm: [boite(bm, (x + 0.02, -L + 0.75 + k * 1.5, z + 0.02), (0.1, 0.08, 0.08)) for k in range(4)], P['acier']))
    return ob


# ---------------------------------------------------------------------------
# LE BORD OUVERT
# ---------------------------------------------------------------------------
def bord_ouvert(P):
    ob = []
    pied = profil_pied()
    xh, zh = pied[-1]
    # Le profil complet : congé, pente jusqu'au couronnement, couronnement arrondi, face externe, dessous.
    haut = [(xh + 0.35, zh + 0.85)]
    couronne = arc(xh + 0.55, zh + 0.85, 0.2, 180, 0, 6)
    profil = pied + haut + couronne[1:] + [(xh + 0.8, zh + 0.6), (xh + 0.85, -0.3), (XR + 0.6, -0.55), (XR, -0.55)]
    n_pied = len(pied) - 1
    mats = [P['revetement']] * n_pied + [P['panneau']] + [P['acier']] * (len(couronne) - 1) + [P['structure']] * 4
    ob.append(extrusion('bord', profil, -L, L, P['panneau'], segments=SEG, mats=mats))
    ob += rails(P)
    # Des feux encastrés dans la pente.
    ob.append(piece('feux', lambda bm: [boite(bm, (xh + 0.22, -L + 0.75 + k * 3.0, zh + 0.55), (0.03, 0.4, 0.06), Matrix.Rotation(math.radians(-20), 3, 'Y')) for k in range(2)], P['caisson']))
    # La face externe : nervures et chemin de câbles.
    ob.append(piece('nervures', lambda bm: [boite(bm, (xh + 0.9, -L + 0.75 + k * 1.5, 0.3), (0.08, 0.1, 1.2)) for k in range(4)], P['acier']))
    ob.append(piece('cables', lambda bm: [tube(bm, (xh + 0.97, -L + j * 1.5, 0.05 + i * 0.07), (xh + 0.97, -L + (j + 1) * 1.5, 0.05 + i * 0.07), 0.025, 5) for i in range(2) for j in range(4)], P['caoutchouc']))
    for o in ob:
        appliquer(o)
    return ob, {}


# ---------------------------------------------------------------------------
# LE BORD TUNNEL : le même pied, puis un mur concave de 5,6 m, chargé de panneaux, caissons et conduites.
# ---------------------------------------------------------------------------
def bord_tunnel(P):
    ob = []
    pied = profil_pied()
    xh, zh = pied[-1]
    # Le mur : il monte, puis se penche vers la piste (concave).
    mur = [(xh + 0.25, zh + 0.7), (xh + 0.4, 2.0)] + arc(xh - 0.6, 2.0, 1.0, 0, 55, 5)[1:] + [(xh - 0.8, 5.6)]
    profil = pied + mur + [(xh + 1.3, 5.6), (xh + 1.3, -0.55), (XR, -0.55)]
    n_pied = len(pied) - 1
    mats = [P['revetement']] * n_pied + [P['panneau']] * len(mur) + [P['structure']] * 3
    ob.append(extrusion('mur', profil, -L, L, P['panneau'], segments=SEG, mats=mats))
    ob += rails(P)
    # Les grands panneaux du mur, en relief, avec un jour entre eux, et leurs caissons lumineux.
    def panneaux(bm):
        for y in (-1.5, 1.5):
            boite(bm, (xh + 0.32, y, 2.55), (0.08, 2.86, 1.5))
    ob.append(piece('panneaux', panneaux, P['panneauClair'], biseau=0.02))
    ob.append(piece('caissons', lambda bm: [boite(bm, (xh + 0.27, y, 2.95), (0.02, 1.6, 0.32)) for y in (-1.5, 1.5)], P['caisson']))
    ob.append(piece('grilles', lambda bm: [boite(bm, (xh + 0.27, y - 0.55 + k * 0.22, 2.25), (0.02, 0.1, 0.5)) for y in (-1.5, 1.5) for k in range(6)], P['sillon']))
    # Le faisceau de conduites qui court le long du mur, sur des consoles, avec brides et bagues lumineuses.
    conduites = [(xh + 0.05, 3.65, 0.28), (xh + 0.1, 4.25, 0.2), (xh + 0.0, 1.65, 0.16)]
    def tuyaux(bm):
        for x, z, r in conduites:
            for k in range(4):
                tube(bm, (x - r * 0.3, -L + k * 1.5, z), (x - r * 0.3, -L + (k + 1) * 1.5, z), r, 12)
    ob.append(piece('tuyaux', tuyaux, P['blindageClair']))
    def brides(bm):
        for x, z, r in conduites[:2]:
            for y in (-L + 0.05, 0.0):
                tube(bm, (x - r * 0.3, y - 0.06, z), (x - r * 0.3, y + 0.06, z), r * 1.18, 12)
    ob.append(piece('brides', brides, P['acier']))
    ob.append(piece('bagues', lambda bm: [tube(bm, (conduites[0][0] - 0.08, y - 0.02, conduites[0][1]), (conduites[0][0] - 0.08, y + 0.02, conduites[0][1]), conduites[0][2] * 1.06, 12) for y in (-1.5, 1.5)], P['rail']))
    ob.append(piece('consoles', lambda bm: [boite(bm, (xh + 0.45, y, z), (0.3, 0.12, 0.12)) for y in (-1.5, 1.5) for z in (3.65, 4.25)], P['acier']))
    # Le cadre porteur au bout du module (il rejoint l'arc de la voûte).
    def cadre(bm):
        boite(bm, (xh + 0.35, L - 0.15, 2.8), (0.35, 0.3, 5.6))
    ob.append(piece('cadre', cadre, P['structure'], biseau=0.03))
    ob.append(piece('cadre-feu', lambda bm: boite(bm, (xh + 0.17, L - 0.15, 3.2), (0.02, 0.06, 2.6)), P['rail']))
    for o in ob:
        appliquer(o)
    return ob, {}


# ---------------------------------------------------------------------------
# LA VOÛTE
# ---------------------------------------------------------------------------
def voute(P):
    ob = []
    xh = profil_pied()[-1][0]
    X0 = xh - 0.8   # le haut des murs
    H0, H1 = 5.6, 7.8
    # La voûte : un arc surbaissé de mur à mur, extrudé ; un arc porteur en bout de module.
    pts = [(X0 * math.cos(math.radians(a)), H0 + (H1 - H0) * math.sin(math.radians(a))) for a in range(0, 181, 15)]
    profil = pts + [(-X0 - 0.4, H0 + 0.3)] + [(x * 1.08, z + 0.5) for x, z in reversed(pts)] + [(X0 + 0.4, H0 + 0.3)]
    ob.append(extrusion('voute', profil, -L, L, P['panneau'], segments=SEG))
    def arc_porteur(bm):
        for i in range(len(pts) - 1):
            (x0, z0), (x1, z1) = pts[i], pts[i + 1]
            barre(bm, (x0 * 0.97, L - 0.15, z0 - 0.2), (x1 * 0.97, L - 0.15, z1 - 0.2), 0.32)
    ob.append(piece('arc', arc_porteur, P['structure']))
    def arc_feu(bm):
        for i in range(len(pts) - 1):
            (x0, z0), (x1, z1) = pts[i], pts[i + 1]
            barre(bm, (x0 * 0.94, L - 0.32, z0 - 0.38), (x1 * 0.94, L - 0.32, z1 - 0.38), 0.05)
    ob.append(piece('arc-feu', arc_feu, P['rail']))
    # Une rampe de caissons lumineux au sommet, le long de la piste.
    ob.append(piece('rampe', lambda bm: [boite(bm, (sx * 1.6, 0, H1 - 0.06), (0.5, 2 * L - 0.6, 0.06)) for sx in (1, -1)], P['caisson']))
    # Une poutre à hachures jaunes et noires en travers, et des câbles qui pendent.
    def poutre(bm):
        boite(bm, (0, -1.0, H1 - 0.45), (2 * X0 - 1.0, 0.4, 0.4))
    ob.append(piece('poutre', poutre, P['structure']))
    def hachures(bm):
        for k in range(-9, 10):
            boite(bm, (k * 0.5, -1.0 - 0.21, H1 - 0.45), (0.24, 0.01, 0.36), Matrix.Rotation(0.6, 3, 'Y'))
    ob.append(piece('hachures', hachures, P['jaune']))
    ob.append(piece('cables', lambda bm: [tube(bm, (x, 0.5, H1 - 0.1), (x + 0.2, 0.8, H1 - 1.2), 0.03, 5) for x in (-2.6, -2.3, 3.1)], P['caoutchouc']))
    for o in ob:
        appliquer(o)
    return ob, {'halos': [[0, H1 - 0.2, 0, 3.0, 0.85, 0.92, 1, 0.18]]}


MODULES = {'chaussee': chaussee, 'bord-ouvert': bord_ouvert, 'bord-tunnel': bord_tunnel, 'voute': voute}


def construire(nom, fn, P):
    objets, points = fn(P)
    comptes = {}
    for o in objets:
        appliquer(o)
        o.data.calc_loop_triangles()
        k = o.name.split('.')[0]
        comptes[k] = comptes.get(k, 0) + len(o.data.loop_triangles)
    print(f'  {nom} :', ', '.join(f'{k} {v}' for k, v in sorted(comptes.items(), key=lambda kv: -kv[1])))
    ob = joindre(objets, nom)
    lisser(ob, 38)
    return ob, points


if __name__ == '__main__':
    vider()
    P = matieres_piste(palette())
    resultats = []
    for nom, fn in MODULES.items():
        ob, pts = construire(nom, fn, P)
        resultats.append((nom, ob, pts))
    ecrire_prm(SORTIE / 'piste.prm', resultats)
    if '--sans-apercu' not in sys.argv:
        # L'aperçu : trois modules de suite, bords des deux côtés (tunnel à gauche, ouvert à droite), voûte.
        apercus = Path(__file__).resolve().parents[2] / 'captures' / 'v4h' / 'modeles'
        objets = {nom: ob for nom, ob, _ in resultats}
        for k in (-1, 0, 1):
            for nom, sx in (('chaussee', 1), ('bord-ouvert', 1), ('bord-tunnel', -1), ('voute', 1)):
                if nom == 'voute' and k == 1:
                    continue
                o = objets[nom]
                c = o.copy()
                c.data = o.data
                c.location = (0, k * 2 * L, 0)
                c.scale.x = sx
                bpy.context.scene.collection.objects.link(c)
        for o in objets.values():
            o.hide_render = True
        apercu(apercus / 'piste-vue.png', cible=(0, 6, 1.0), distance=14, azimut=180, elevation=14, echantillons=16)
        apercu(apercus / 'piste-detail.png', cible=(5.4, 2, 1.0), distance=6, azimut=215, elevation=12, echantillons=16)
