# Modèles Blender → Unity

Fichiers **produits** par `outils/assets/exporter_unity.py` : ne pas les modifier à la main, régénérer. Le script
réutilise les constructeurs des scripts Blender du jeu web (`outils/assets/*.py`, mêmes sessions, mêmes matières),
vérifie qu'ils redonnent les `.prm` de `public/rush/modeles/` (sans les réécrire), puis écrit :

- `<Dossier>/<fichier>.fbx` : un objet nommé par modèle logique (`roches.fbx` contient `roche-0` … `roche-3`) ;
- `palette.json` : une entrée par matière `PR_<nom>` (lue par `Scripts/Editeur/ImportModeles.cs`) ;
- `modeles.json` : le manifeste (fichiers, objets, triangles, matières, bornes, ancrages : tuyères, émetteurs, halos).

## Régénérer

Python 3.13 avec Blender en module (`pip install bpy==5.2.2` dans un environnement isolé, gratuit), depuis la racine
du dépôt :

```
<venv>/bin/python outils/assets/exporter_unity.py             # tout exporter, puis tout vérifier (≈ 25 s)
<venv>/bin/python outils/assets/exporter_unity.py --verifier  # seulement relire et vérifier les FBX présents
```

L'export est reproductible à l'octet (horodatage FBX fixe, `PYTHONHASHSEED=0`, triangles et sommets rangés dans un
ordre canonique) : sans changement des scripts, Git ne voit aucune différence — sauf `Mondes/tempete/paratonnerre.fbx`,
dont Blender calcule les normales avec un bruit de dernier bit variable d'une exécution à l'autre (géométrie identique,
normales à 1e-6 près ; son `.prm` varie de même). Code de sortie 0 seulement si toutes les vérifications passent.

## Repères et échelle

| | haut | avant (nez, sens de la course) | droite |
|---|---|---|---|
| Blender (scripts) | +Z | +Y | +X |
| jeu web (OGL, main droite) | +y | −z | +x |
| **Unity (main gauche)** | **+Y** | **+Z** | **+X** |

- Unity (x, y, z) = Blender (x, z, y) = jeu web (x, y, −z). Mètres, origines inchangées (route en y = 0, modules de
  6 m centrés en z = 0, voies en x = −3, 0, 3), transformations des objets nulles (position 0, rotation 0, échelle 1).
- Pour passer une pose du jeu web à Unity : position (x, y, −z) ; angles autour de X et de Y **opposés**, autour de Z
  inchangés (ex. `rotation.y = θ` → `Quaternion.Euler(0, −θ°, 0)`).
- En-tête FBX standard (Y en haut, avant +Z, X à droite, unité 1 m = `UnitScaleFactor` 100) : le maillage est tourné
  d'un demi-tour autour de Z dans Blender puis exporté avec les axes par défaut ; Unity, qui inverse X pour changer de
  main, retombe sur le repère voulu sans conversion d'axes ni rotation à la racine.
- Vérifié à chaque export (sans Unity) : en-tête relu brut (axes, unité, transformations) ; FBX réimporté dans bpy dans
  le repère du fichier, X inversé comme Unity : noms, matières, triangles, UV, bornes ; vaisseaux plus longs en z
  qu'en x, nez du côté +Z, tuyères en z < 0 ; chaque coin (position, normale) retrouvé dans le `.prm` du jeu web passé
  dans le repère Unity.

## Fichiers

<!-- tableau des fichiers : début (écrit par exporter_unity.py) -->
| Fichier | Objets | Triangles | Matières | Taille |
|---|---|---:|---:|---:|
| `Collecte/dore.fbx` | cristal-dore | 320 | 3 | 27 Ko |
| `Collecte/fragment.fbx` | cristal-fragment | 272 | 3 | 23 Ko |
| `Collecte/noyau.fbx` | cristal-noyau | 536 | 3 | 34 Ko |
| `Decor/Mecanismes/balise.fbx` | balise-mat, balise-tete | 1924 | 12 | 81 Ko |
| `Decor/Mecanismes/plateforme.fbx` | plateforme-meca | 1616 | 13 | 62 Ko |
| `Decor/Mecanismes/presse.fbx` | presse-cadre, presse-tete | 5190 | 15 | 155 Ko |
| `Decor/Mecanismes/radar.fbx` | radar-tour, radar-antenne | 5994 | 13 | 195 Ko |
| `Decor/Mecanismes/turbine.fbx` | turbine-cadre, turbine-rotor | 5436 | 13 | 185 Ko |
| `Decor/bordure.fbx` | bordure | 656 | 11 | 38 Ko |
| `Decor/chevron.fbx` | chevron | 292 | 5 | 26 Ko |
| `Decor/portique.fbx` | portique | 5364 | 9 | 158 Ko |
| `Decor/roches.fbx` | roche-0, roche-1, roche-2, roche-3 | 2694 | 1 | 118 Ko |
| `Mondes/laser/mur-tranchee.fbx` | mur-tranchee | 960 | 12 | 45 Ko |
| `Mondes/laser/scanner.fbx` | scanner | 1596 | 7 | 56 Ko |
| `Mondes/neon/tour-neon-a.fbx` | tour-neon-a | 1480 | 8 | 52 Ko |
| `Mondes/neon/tour-neon-b.fbx` | tour-neon-b | 1060 | 9 | 46 Ko |
| `Mondes/rift/arche-cristal.fbx` | arche-cristal | 1438 | 4 | 76 Ko |
| `Mondes/rift/grappe-cristaux.fbx` | grappe-cristaux | 218 | 3 | 27 Ko |
| `Mondes/sentinelle/colonne-forteresse.fbx` | colonne-forteresse | 1564 | 6 | 61 Ko |
| `Mondes/sentinelle/tourelle.fbx` | tourelle | 648 | 5 | 38 Ko |
| `Mondes/singularite/anneau-brise.fbx` | anneau-brise | 980 | 5 | 45 Ko |
| `Mondes/singularite/fragment-coque.fbx` | fragment-coque | 456 | 4 | 30 Ko |
| `Mondes/tempete/cadre-brise.fbx` | cadre-brise | 444 | 4 | 30 Ko |
| `Mondes/tempete/cadre-station.fbx` | cadre-station | 384 | 6 | 28 Ko |
| `Mondes/tempete/paratonnerre.fbx` | paratonnerre | 2100 | 6 | 77 Ko |
| `Obstacles/barriere.fbx` | barriere | 1064 | 10 | 52 Ko |
| `Obstacles/bloc-chute.fbx` | bloc-chute | 2484 | 13 | 85 Ko |
| `Obstacles/cargo.fbx` | cargo | 3272 | 13 | 106 Ko |
| `Obstacles/drone.fbx` | drone | 2500 | 10 | 103 Ko |
| `Obstacles/eclaireur.fbx` | eclaireur | 1442 | 13 | 73 Ko |
| `Obstacles/lance.fbx` | lance | 2418 | 12 | 109 Ko |
| `Obstacles/laser.fbx` | pylones | 2984 | 11 | 95 Ko |
| `Obstacles/porte.fbx` | porte-cadre, porte-battant | 3496 | 13 | 108 Ko |
| `Obstacles/rochers.fbx` | rochers-0, rochers-1, rochers-2 | 11942 | 3 | 452 Ko |
| `Obstacles/rotor.fbx` | rotor-moyeu, rotor-pale | 2084 | 8 | 78 Ko |
| `Piste/bord-ouvert.fbx` | bord-ouvert | 650 | 9 | 36 Ko |
| `Piste/bord-tunnel.fbx` | bord-tunnel | 1602 | 10 | 57 Ko |
| `Piste/chaussee.fbx` | chaussee | 444 | 8 | 32 Ko |
| `Piste/voute.fbx` | voute | 868 | 6 | 41 Ko |
| `Vaisseaux/aube.fbx` | aube | 16614 | 17 | 593 Ko |
| `Vaisseaux/bastion.fbx` | bastion | 16356 | 18 | 563 Ko |
| `Vaisseaux/faucon.fbx` | faucon | 18008 | 18 | 625 Ko |
| `Vaisseaux/spectre.fbx` | spectre | 12584 | 17 | 485 Ko |
| **43 fichiers** | 54 objets | 144434 | 85 | 5407 Ko |
<!-- tableau des fichiers : fin -->

Normales : celles du jeu web, par coin (arêtes vives comprises). UV : projection boîte, 1 unité = 1 m (de quoi poser
des textures de détail ; Unity en tire des tangentes). Pas de texture, pas d'animation, pas de rig.

## Matières et canaux

Chaque matière Blender devient un slot `PR_<nom>` ; si deux scripts donnent au même nom des réglages différents, la
seconde variante prend `PR_<nom>_<famille>` (aujourd'hui : `PR_neonBlanc_objets`, émission 1,4 au lieu de 1,6).
`palette.json` donne pour chacune : `couleur` **sRGB 0–1** (l'hexadécimal du jeu web / 255 ; `Material.SetColor` la
linéarise), `metal`, `rugosite`, `emission`, `canal`. `ImportModeles.cs` en fait des matériaux URP Lit
`Assets/PortalRush/Materiaux/Palette/PR_<nom>.mat` (`_Smoothness` = 1 − rugosité ; émission linéaire = couleur
linéaire × émission × `facteurEmission` 3,2, le facteur du shader web) et les substitue aux matériaux importés. Chaque
matériau porte l'étiquette `PortalRushCanal` (= son canal), lisible en jeu par `material.GetTag("PortalRushCanal", false)`.

| canal | couleur en jeu (vaisseau / ailleurs) | animé | matières |
|---|---|---|---|
| `fixe` | celle de la palette | non | la plupart |
| `peinture` | pièce « coque » du garage | non | `PR_coque` |
| `peinture2` | accent2 × 0,8 : pièce « overdrive » / seconde couleur du monde | non | `PR_peinture2` |
| `accent` | lueur : pièce « traînée » / accent du monde | impulsions vers l'avant (combo, Overdrive) | `PR_accent`, `PR_accentDoux`, `PR_railLumineux`, `PR_cristalLueur` |
| `accent2` | lueur : pièce « overdrive » / seconde couleur du monde | non | `PR_accent2`, `PR_poussee`, `PR_railLumineux2` |
| `danger` | lueur : danger du monde | non | `PR_danger`, `PR_dangerDoux`, `PR_dangerFort`, `PR_hachureRouge` |
| `coeur` | lueur : pièce « noyau » / couleur d'état de l'objet | non | `PR_coeur` |
| `ligne` | accent du monde | tirets qui défilent, plus longs en Overdrive | `PR_ligne` |
| `clignote` | celle de la palette | éclats brefs, chacun son rythme | `PR_feuBlanc`, `PR_feuRouge`, `PR_feuAmbre` |
| `revetement` | celle de la palette | non (reflets des rails dans le web) | `PR_revetement`, `PR_revetement2` |
| `fissure` | danger du monde | palpite | (aucune matière pour l'instant) |

## Import dans Unity (`Scripts/Editeur/ImportModeles.cs`)

- Échelle 1 (unité du fichier), normales importées, tangentes MikkTSpace, lecture/écriture désactivée, pas de rig,
  d'animation, de caméra, de lumière ni de collider, une racine par fichier (`preserveHierarchy`) ; compression :
  aucune pour `Piste/` (raccords bord à bord), faible pour `Vaisseaux/`, moyenne ailleurs ; pas d'UV de lightmap (tout
  est posé en cours de partie).
- Matériaux : remappage natif `PR_<nom>` → `Materiaux/Palette/PR_<nom>.mat` (écrit dans le `.meta`). Les `.mat` sont
  créés après l'import ; un modèle importé avant eux est réimporté une fois. Sans URP (shader introuvable) : un
  avertissement, rien d'autre ; menu **Portal Rush › Modèles › Synchroniser les matériaux de la palette** ensuite.
  En mode batch, appeler `PortalRush.Editeur.ImportModeles.Synchroniser()`.

## Pièces mobiles (pivots du jeu web, repère Unity)

- `porte.fbx` : `porte-cadre` ; `porte-battant` (x de −0,56 à 0,56) deux fois : à gauche tel quel, à droite tourné de
  180° autour de Y ; chacun glisse en x de ±(0,56 + 1,05 × ouverture).
- `rotor.fbx` : `rotor-moyeu` ; une tête en (0 ; 1,0 ; 0) porte trois `rotor-pale` (le long de +X) à 0°, 120°, 240°
  autour de Y ; la tête tourne autour de Y.
- `Decor/Mecanismes/` posés sur `plateforme.fbx` (corps à y = 3,1 turbine, 3,0 radar, 1,15 presse, 0,4 balise) :
  `turbine-rotor` en (0 ; 2,6 ; −0,1), tourne autour de Z, corps tourné de +0,9 rad autour de Y ; `radar-antenne`
  en (0 ; 3,9 ; 0), autour de Y ; `presse-tete` monte et descend (y de 0,15 à 3,55), corps tourné de −90° autour de Y ;
  `balise-tete` en (0 ; 2,5 ; 0), autour de Y.

## Correspondance avec le catalogue (`Scripts/Jeu/Catalogue.cs`)

Dans Unity, chaque fichier donne un prefab dont la racine porte le nom du fichier et dont chaque objet ci-dessous est
un enfant (`rochers/rochers-1`) : c'est cet enfant qu'on range dans le catalogue (Instantiate le copie seul).

| liste | clé | fichier / objet | remarque |
|---|---|---|---|
| vaisseaux | `aube`, `faucon`, `bastion`, `spectre` | `Vaisseaux/<id>.fbx` / `<id>` | ancrages `tuyere`, `emetteur` dans `modeles.json` |
| objets | `bloc` | `Obstacles/barriere.fbx` / `barriere` | |
| objets | `debris-0`, `debris-1`, `debris-2` | `Obstacles/rochers.fbx` / `rochers-0`, `-1`, `-2` | le jeu web choisit la variante par le paramètre du type (`debris:N`) |
| objets | `laser` | `Obstacles/laser.fbx` / `pylones` | le faisceau reste procédural (y = 0,78, x de −1,15 à 1,15) |
| objets | `mobile` | `Obstacles/cargo.fbx` / `cargo` | |
| objets | `frappe` | `Obstacles/lance.fbx` / `lance` | |
| objets | `drone` | `Obstacles/drone.fbx` / `drone` | |
| objets | `chute` | `Obstacles/bloc-chute.fbx` / `bloc-chute` | |
| objets | `eclaireur` | `Obstacles/eclaireur.fbx` / `eclaireur` | |
| objets | `porte` | `Obstacles/porte.fbx` / racine `porte` | `porte-cadre` + `porte-battant` à doubler (voir les pièces mobiles) |
| objets | `rotor` | `Obstacles/rotor.fbx` / racine `rotor` | `rotor-moyeu` + `rotor-pale` à tripler |
| objets | `fragment`, `dore`, `noyau` | `Collecte/<clé>.fbx` / `cristal-<clé>` | |
| objets | `faille`, `portail`, `boss` | — | pas de modèle Blender (procéduraux dans le jeu web) |
| décor | `commun/portique` | `Decor/portique.fbx` / `portique` | portique en treillis, pieds à y = −3 |
| décor | `laser/portique` | `Mondes/laser/scanner.fbx` / `scanner` | |
| décor | `rift/portique` | `Mondes/rift/arche-cristal.fbx` / `arche-cristal` | |
| décor | `tempete/portique-0`, `-1` | `Mondes/tempete/cadre-station.fbx`, `cadre-brise.fbx` | cadres au-dessus de la piste |
| décor | `tempete/tour` | `Mondes/tempete/paratonnerre.fbx` / `paratonnerre` | 37 m |
| décor | `neon/tour-0`, `-1` | `Mondes/neon/tour-neon-a.fbx`, `tour-neon-b.fbx` | 83 m et 50 m |
| décor | `sentinelle/tour` | `Mondes/sentinelle/colonne-forteresse.fbx` / `colonne-forteresse` | 42 m |
| décor | `singularite/tour` | `Mondes/singularite/anneau-brise.fbx` / `anneau-brise` | modelé d'un côté (x de 3,3 à 13,2) |

Proposition pour le décor (le jeu web les pose autrement) ; sans usage dans `Decor.cs` aujourd'hui : `pilier` et
`voute` (aucun modèle n'y correspond : le vrai tunnel est `Piste/bord-tunnel` des deux côtés + `Piste/voute`, à poser
par la route), `Piste/*` (route), `Decor/bordure`, `Decor/chevron`, `Decor/roches` (rayon 1, à mettre à l'échelle),
`Decor/Mecanismes/*`, `laser/mur-tranchee`, `rift/grappe-cristaux`, `sentinelle/tourelle`, `singularite/fragment-coque`.
Listes du catalogue : `peinture` = `PR_coque` ; `peinture2` = `PR_peinture2` ; `accents` (canal `accent`) =
`PR_accent`, `PR_accentDoux`, `PR_railLumineux`, `PR_cristalLueur`. Sur les quatre vaisseaux, les matières non fixes
sont `PR_coque`, `PR_peinture2`, `PR_accent`, `PR_accentDoux`, `PR_coeur` et les feux `PR_feuRouge`, `PR_feuBlanc`
(`clignote`) ; les matières de chaque objet sont dans `modeles.json`.
