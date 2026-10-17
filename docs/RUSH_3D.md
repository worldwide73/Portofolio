# Portal Rush — le rendu 3D : inspection et refonte V4-H (17 octobre 2026)

Demande de Mathéo (17 octobre) : un jeu bien plus réaliste en pleine partie — vaisseaux modélisés avec soin,
matériaux métalliques crédibles, vraies textures, éclairages travaillés, circuits 3D complexes, structures
mécaniques, ombres, effets de vitesse, collisions, dégâts, collectables, décors riches — sans perdre la fluidité,
les circuits mobiles et déformables, les obstacles animés, la difficulté ni le son. Étape distincte de V4-F
(l'interface). Référence qualitative : la vidéo YouTube `Sqq0Uz3Bd1w` (Antigraviator). **Elle n'a pas pu être
regardée** : YouTube est bloqué par le réseau de cet environnement (comme la précédente) ; la référence est donc
prise au sens général (course anti-gravité : métal usé, lumières, vitesse), pas image par image.

Honnêteté sur le niveau atteignable : le jeu tourne dans une page web (WebGL 2, sans moteur commercial, sans
artistes ni bibliothèque de modèles et de textures sous licence). Il peut gagner beaucoup en matière, en lumière
et en effets ; il n'aura pas la densité d'un jeu commercial AAA (modèles sculptés à la main, textures photo
scannées, éclairage global précalculé).

## 1. Ce qui existe déjà (inspection du code, `src/scripts/rush/scene/`)

| Domaine | Implémenté | Où |
|---|---|---|
| Moteur de rendu | WebGL 2 par OGL ; rendu direct en un passage ; `dpr` ≤ 1,5 (1,25 au doigt) ; anticrénelage MSAA du navigateur | `scene.ts` |
| Géométrie | Modèles **procéduraux** assemblés pièce par pièce (`Assembleur` : boîtes chanfreinées, prismes, cylindres, tores, sphères à relief, coques par sections, poutres), fusionnés en un seul maillage par objet ; **aucun UV** | `geometrie.ts`, `modeles.ts` |
| Vaisseaux | 4 silhouettes (Aube, Faucon, Bastion, Spectre) : fuselage à 11 sections, verrière à arceaux, ailes et dérives, nacelles, entrées d'air à aubes, tuyères, antennes, feux à éclats, bandes de course ; flammes de réacteur (shader de bruit), bulle de bouclier, émetteurs (un par bouclier), 2 rubans de traînée | `modeles.ts` (`vaisseau`), `scene.ts` (`creerVaisseau`) |
| Matières | Un shader « surface » : couleur par sommet + métal / rugosité / émission / canal (peinture, accents animés, danger, cœur, lignes de piste, fissures, feux clignotants) ; soleil directionnel, ambiance ciel/sol, spéculaire Blinn-Phong normalisé, Fresnel, reflet d'un **dégradé** ciel/sol, grain de bruit très léger, brouillard, courbe filmique ACES **dans chaque shader** | `materiaux.ts` |
| Circuit | Tronçons de 48 m recyclés (3 voies de plaques, rainures, plots, joints lumineux, bordures, poutres porteuses, sous-couche) ; **pli du parcours** dans le shader de sommets (virages, reliefs à 4 harmoniques, dévers) — la collision reste sur 3 voies droites ; couloirs effondrés découpés dans la piste | `mondes.ts`, `parcours.ts`, `materiaux.ts` (`PLIER`) |
| Mondes | 8 mondes + défi : portiques, anneaux de propulsion, tours, réservoirs, tuyaux, passerelles, lampadaires, aires de lancement… ; lointain (planètes à atmosphère, anneaux, disque d'accrétion, station orbitale, trafic de cargos) ; ciel procédural (nébuleuse, étoiles, soleil, éclairs de tempête) | `mondes.ts`, `mondes2.ts`, `materiaux.ts` (`ciel`, `planete`, `anneau`) |
| Obstacles | Barrières, rochers, pylônes laser + faisceau, cargos, lances, failles, portails à voile, drones, portes à battants animés, rotors à pales animées, blocs qui tombent, éclaireurs, boss (Sentinelle, Gardien de la singularité) | `modeles.ts`, `scene.ts` (`creerVisuel`, `placerObjets`, `creerBoss`) |
| Effets | 360 particules (étincelles), 140 grains de poussière, 90 traits de vitesse, ondes (Perfect Dodge, collecte), fragments aspirés par le vaisseau, éclair d'exposition, secousse de caméra, vignette rouge d'alerte (toile 2D), textes flottants | `scene.ts` |
| Caméra | Suit le vaisseau, roulis dans les virages, champ qui s'ouvre avec la vitesse et l'Overdrive, cinématiques d'entrée, de sortie, de victoire (tour du vaisseau, porte d'arrivée), de défaite | `scene.ts` (`cadrer`, `dessiner`) |
| Repli | Rendu 2D complet si WebGL 2 manque | `rendu.ts` |

## 2. Ce qui manque (et qui fait « démo 3D aux formes simples et néons »)

1. **Aucune texture** : chaque face est d'une couleur unie (à 7 % de grain près). Pas de plaques, rivets,
   rayures, usure, salissure ; pas de variation de rugosité ; pas de relief de surface (cartes de normales).
2. **Aucune ombre** : le vaisseau ne projette rien sur la piste, les portiques non plus ; rien n'ancre les objets.
3. **Pas de post-traitement** : pas de halo lumineux (bloom) autour des néons, des réacteurs, des cristaux ;
   pas de flou de vitesse ; la courbe filmique est appliquée objet par objet.
4. **Une seule lumière** (le soleil) + l'ambiance : les réacteurs, les fragments, les feux de danger n'éclairent
   rien autour d'eux. Les reflets du métal ne montrent qu'un dégradé.
5. **Dégâts invisibles** sur le vaisseau (seuls les émetteurs s'éteignent) ; chocs = quelques étincelles et un
   flash ; pas de débris.
6. **Facettes plates** sur beaucoup de pièces (normales par facette) : lisible, mais « low-poly ».
7. **Pas de réglage de qualité** : tout ou rien (3D ou 2D).

## 3. Les modifications techniques (V4-H), dans l'ordre de leur effet visible

| # | Changement | Technique | Coût | Repli |
|---|---|---|---|---|
| H1 | Post-traitement | Rendu dans une cible ; bloom (seuil, chaîne de 4 réductions, flou séparable) ; composition : vignettage, grain, flou radial avec la vitesse, aberration chromatique en Overdrive | 5 passes plein écran à résolution décroissante | désactivé en qualité « Économie » |
| H2 | **Vraies textures** (procédurales) | Générées une fois au chargement, **sur le GPU** (shaders vers textures 1024², mipmaps) : métal en plaques (joints, rivets, trappes, rayures, usure des arêtes, coulures), matière brute (béton composite, roche) ; cartes de détail (albédo, rugosité, cavité) et de **normales** ; appliquées en **triplanaire** dans le repère local (pas besoin d'UV, elles suivent le pli du parcours) | 6 lectures de texture par pixel | échelle réduite / coupées en « Économie » |
| H3 | **Ombres** | Carte d'ombres du soleil (2048² ou 1024²) centrée sur le vaisseau : vaisseau, obstacles et tronçons proches ; même pli de parcours dans le passage d'ombre ; PCF | 1 passage de profondeur | ombre de contact sous le vaisseau |
| H4 | **Lumières dynamiques** et reflets | 8 lumières ponctuelles (réacteurs, fragments, danger, portails) dans le shader de surface ; reflets d'environnement : horizon, voûte, lignes de piste reflétées ; vernis sur les peintures | quelques boucles par pixel | 4 lumières en « Équilibrée » |
| H5 | Dégâts, impacts, collectes | Brûlures et fissures incandescentes selon les boucliers perdus, étincelles et fumée ; débris et onde aux chocs ; éclat de collecte | particules | réduits en mouvement réduit |
| H6 | Qualité adaptative | Réglage Automatique / Élevée / Équilibrée / Économie ; l'automatique descend d'un cran si les images dépassent ~20 ms en moyenne | — | — |

Ce qui ne change pas : le moteur de jeu (`moteur.ts`), les collisions, la difficulté, les obstacles et leurs
animations, le pli du parcours, la musique et les sons.

## 4. Vérification

Ce conteneur n'a pas de carte graphique : la 3D y est émulée par le processeur (SwiftShader, 1 à 5 images/s).
On y vérifie le **rendu réel** (captures en pleine partie, avant/après, chaque monde) et le **coût relatif**
(temps d'image avant/après dans le même émulateur). La fluidité sur une vraie carte graphique reste à confirmer
sur la machine de Mathéo ; la qualité adaptative est là pour la garantir.
