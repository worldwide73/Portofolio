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

## 5. Ce qui est fait (17 octobre 2026)

| # | Fait | Où | Vérifié |
|---|---|---|---|
| H1 | **Post-traitement** : la scène est dessinée dans un tampon multi-échantillonné (anticrénelage gardé), résolu, puis halo lumineux (seuil doux, 4 réductions à 13 lectures, 3 remontées en tente), et composition : mélange « écran », flou radial qui grandit avec la vitesse (net au centre, 8 lectures, désactivé en mouvement réduit), aberration chromatique légère en Overdrive et aux chocs, vignettage, grain fin | `scene/post.ts`, `scene/scene.ts` | captures en pleine partie, A/B avec et sans halo |
| H2 | **Textures procédurales réelles** : calculées une fois sur le GPU (1024², 512 au doigt), relues, mipmaps + anisotrope ×8 : « plaques » (calepinage de panneaux de tailles variées, joints creusés, rivets, trappes vissées, grilles, rayures, usure des arêtes, crasse, coulures), « brut » (fissures, piqûres, taches), normales calculées sans quantification. Appliquées en triplanaire dans le repère de l'objet (elles suivent le pli du parcours), normales perturbées, rugosité et cavité variables ; atténuées sur les peintures, effacées au-delà de 140 m | `scene/textures.ts`, `scene/materiaux.ts` | planche des textures ; A/B avec et sans |
| H3 | **Ombres du soleil** : carte 2048² (Élevée) ou 1024² (Équilibrée), centrée sur la zone de jeu (vaisseau → 78 m devant), pli du parcours compris ; vaisseau, obstacles, tronçons et mécanismes projettent leur ombre ; PCF 3 × 3, biais selon la pente, fondu en bordure ; l'ombre éteint aussi la part « soleil » des reflets et voile l'ambiance (sinon invisible sur le métal) ; en Économie, une ombre de contact sous le vaisseau | `scene/ombres.ts`, `scene/materiaux.ts` | A/B ombres ; ombre du vaisseau visible sur la piste (monde Débris) |
| H4 | **Lumières dynamiques** : jusqu'à 8 (Élevée) ou 4 (Équilibrée) lumières ponctuelles : les deux réacteurs (couleur de la traînée, plus fortes en Overdrive), les fragments, cristaux, portails, lasers, barrières, drones, éclaireurs les plus proches, et des **éclairs** brefs (choc orange, collecte de la couleur du fragment) ; **reflets d'environnement** refaits (voûte, horizon clair, deux grandes sources douces qui dessinent le métal, lignes de piste reflétées) ; **vernis** sur les peintures | `scene/materiaux.ts`, `scene/scene.ts` (`poserLumieres`) | A/B lumières |
| H5 | **Dégâts** : à chaque bouclier perdu, des brûlures gagnent la coque (suie, rugosité) ; à la fin, des fissures incandescentes qui palpitent ; au dernier bouclier, la coque crache des étincelles. **Chocs** : 6 débris de tôle (3 formes) qui tournoient, rebondissent sur la piste et restent en arrière, encore chauds, + éclair orange. **Collecte** : éclair de la couleur du fragment. **Mécanismes du bord de piste** : turbines (6 pales qui tournent), radars (antenne en treillis qui pivote), presses (marteau qui frappe), balises (gyrophare), sur plateformes reliées à la piste par une passerelle ; choisis par monde, posés de façon déterministe, hors des voies. **Roches** lissées (normales moyennées) + texture « brute » | `scene/materiaux.ts` (`uDegats`), `scene/scene.ts`, `scene/modeles.ts` (`eclat`, `turbine…`, `radar…`, `presse…`, `balise…`, `plateformeMeca`), `scene/geometrie.ts` | captures |
| H6 | **Qualité graphique** : réglage Auto / Élevée / Équilibrée / Économie (Réglages du jeu → Affichage), sauvegardé ; l'automatique part en Élevée (Équilibrée au doigt, **Économie sans carte graphique**), et descend d'un cran si la moyenne dépasse 21 ms par image sur 180 images de course (jamais de remontée seule : pas de va-et-vient) | `scene/scene.ts`, `rush.ts`, `sauvegarde.ts`, `PortalRush.astro` | sauvegarde validée ; détection du rendu logiciel vérifiée ici |

Inchangés : `moteur.ts` (collisions, difficulté, obstacles), le pli du parcours, les sons, l'interface (V4-F).

## 6. Mesures (17 octobre 2026, conteneur sans carte graphique)

Recette `outils/recettes/rush-3d-perf.mjs` : même image de course figée (secteur 1, 960 × 540), 15 s par niveau.
Le rendu est émulé par le processeur (SwiftShader) : les chiffres absolus ne disent rien de la fluidité sur une
vraie carte graphique ; seuls les **rapports** renseignent sur le travail demandé au GPU.

| Version | Images/s (émulateur) | JavaScript par image |
|---|---|---|
| Avant V4-H (référence, même scène) | 1,7 à 1,9 | — |
| V4-H, Économie (shader léger compilé à part) | 1,5 à 1,6 | ~1,5–3 ms |
| V4-H, Équilibrée | 0,53 | ~1,5–2 ms |
| V4-H, Élevée | 0,53 | ~1,5–2 ms |

- Le coût est entièrement côté GPU (le JavaScript reste à 1,5–3 ms par image) : textures triplanaires (6 lectures),
  ombres (9 lectures + un passage de profondeur), lumières (boucle), post-traitement (6 passes).
- **Variantes de shader** : un rendu logiciel exécute toutes les branches, même désactivées ; « Économie »
  compile donc un shader sans textures, ombres ni lumières (recompilé à chaud quand la qualité change). Reste
  ~15 % d'écart avec la référence dans l'émulateur (ombre de contact, mécanismes : ~5 %).
- **Qualité automatique** : Élevée par défaut sur ordinateur, Équilibrée au doigt, **Économie si le navigateur
  n'a pas d'accélération graphique** (détection « SwiftShader / llvmpipe / software ») ; descend d'un cran si la
  moyenne dépasse 21 ms par image en course.
- **Non mesuré** : la fluidité sur une vraie carte graphique (à vérifier sur la machine de Mathéo, réglage
  « Élevée » et « Auto »).

## 7. V4-H7 — direction artistique et production d'assets (17 octobre 2026, en cours)

Nouvelle demande de Mathéo : une vraie direction artistique de course futuriste à esthétique cyberpunk, des
modèles 3D réellement détaillés (et non des primitives), des circuits qui paraissent construits, des mondes à
l'identité forte. Ce chapitre suit cette refonte ; il ne la déclare pas terminée.

### 7.1 Les références (ce qui a pu être vu, honnêtement)

- **La vidéo `Sqq0Uz3Bd1w` n'a pas pu être regardée** : YouTube et la plupart des hébergeurs d'images sont
  bloqués par le réseau de cet environnement (seuls GitHub, npm et PyPI répondent). Elle n'est pas analysée ici.
- **Captures réelles étudiées** : deux captures d'écran d'un jeu de course anti-gravité en 3D (projet de
  formation Unity « Hover Racer », dépôts publics `pale-cinder/Hover-Racer-Training` et
  `maxi-jp/HoverRacer_UnityTraining`), récupérées par git et gardées hors du dépôt. Étudiées pour la densité et
  les proportions, **rien n'en est repris** (ni modèle, ni texture, ni forme). Ce qu'elles montrent :
  - une piste **continue et sombre** (pas un carrelage), lisible grâce à un **liseré blanc très lumineux** sur
    l'arête de la bordure, des bandes de hachures jaunes le long des voies, des rainures et des plaques de service ;
  - un **mur de bordure à chevrons blancs** tous les quelques mètres, qui donne la vitesse et le sens du virage ;
  - un vaisseau aux **volumes épais et lisibles** (carénages en couches, entrées d'air, liserés lumineux sur les
    jointures), des structures en **treillis** au-dessus de la piste, un post-traitement fort (aberration, grain).
- La recherche de captures d'Antigraviator elle-même (presse, Steam) n'a renvoyé que du texte : aucune image
  n'a pu être téléchargée. Les autres sources d'assets libres citées par Mathéo (Poly Haven, ambientCG,
  Sketchfab, Kenney, OpenGameArt) sont également bloquées ici.

### 7.2 Le choix technique : modéliser dans Blender, par scripts

Faute d'accès aux bibliothèques d'assets, les modèles sont **construits dans Blender** (5.2, logiciel libre
GPL ; utilisé comme module Python dans un environnement isolé, rien n'est installé dans le projet) par des
scripts reproductibles (`outils/assets/`) : coques par sections lissées, plaques de blindage découpées sur la
coque avec un jour régulier et une tranche de couleur, nacelles et tuyères de révolution à volets, ailes à
profil, vérins, conduits, ouïes, feux. Chaque modèle est vérifié deux fois : un rendu Cycles de studio
(`captures/v4h/modeles/`, hors dépôt) et un rendu dans le **vrai shader du jeu** (banc d'essai). Les modèles sont
**originaux** (aucun asset d'un autre jeu) ; leur licence est celle du portfolio.

Format d'export « PRM1 » (`outils/assets/commun.py` → `src/scripts/rush/scene/assets.ts`) : positions
quantifiées sur 16 bits, normales sur 8 bits, un indice de matière par sommet (palette dans l'en-tête), index
16/32 bits — ~11 octets par sommet. Les modèles passent par les mêmes shaders, ombres, textures triplanaires et
variantes de qualité que le reste de la scène. Chargés à la demande ; la silhouette procédurale reste en repli.

### 7.3 L'identité de chaque monde (direction artistique)

Principe commun : **trois plans** (premier plan riche qui défile vite, plan moyen d'architecture, lointain
monumental), une **lumière dominante** par monde et une couleur d'accent ; un contraste net entre zones sombres
et sources lumineuses ; plus on avance dans la campagne, plus les mondes sont instables et dangereux.

| Monde | Identité | Architecture et premier plan | Lointain monumental | Lumière, atmosphère |
|---|---|---|---|---|
| 1 Launch Protocol | Station de lancement militaire-industrielle, propre et fonctionnelle | Rail surélevé, portiques de lancement en treillis, anneaux de propulsion, tours de service, réservoirs | Planète bleue, lune, station orbitale annulaire | Soleil blanc froid, accent cyan ; peu de brume |
| 2 Neon Drift | Mégapole verticale la nuit | Piste suspendue entre des tours, enseignes holographiques, passerelles, conduits | Forêt de gratte-ciel lumineux, trafic aérien | Nuit, magenta / cyan, brume basse, reflets humides |
| 3 Shattered Belt | Chantier minier dans une ceinture d'astéroïdes | Piste posée sur des roches, échafaudages, câbles, foreuses, débris qui dérivent | Astéroïdes géants, station minière éventrée | Soleil rasant orange, ombres dures, poussière |
| 4 Laser Matrix | Installation technologique fermée | Tunnels techniques, grilles, émetteurs, panneaux de contrôle, câbles en faisceaux | Salles immenses, cœurs de calcul | Lumière artificielle froide, rouge des lasers, contrastes forts |
| 5 Quantum Rift | Monde instable, la réalité se déchire | Piste fragmentée, plaques qui flottent, portails, structures cristallines | Faille dimensionnelle, géométries impossibles | Violet / vert, lueurs pulsées, brume colorée |
| 6 Voidstorm | Circuit suspendu dans une tempête | Piste battue par la pluie et les éclairs, pylônes, paratonnerres, structures arrachées | Nuages-orage, colonnes d'éclairs | Sombre, éclairs blancs, pluie et étincelles |
| 7 Core Sentinel | Forteresse d'un gardien mécanique | Remparts, tourelles, blindages épais, portes lourdes | Le noyau de la Sentinelle, mégastructure armée | Rouge alarme, projecteurs, fumée |
| 8 Singularity | Les abords d'un trou noir | Piste qui se tord, installations endommagées, débris aspirés | Disque d'accrétion, lentille gravitationnelle | Orange-blanc du disque, ombres profondes, distorsion |

### 7.4 Le plan de production (sous-étape H7, avant de considérer V4-H terminée)

| # | Contenu | État |
|---|---|---|
| H7.0 | Références, direction artistique par monde (ce chapitre) | fait (limites ci-dessus) |
| H7.1 | Chaîne Blender → PRM1 → chargeur ; le vaisseau importé remplace la silhouette procédurale ; flammes, traînées et lumières sur les tuyères du modèle (2 à 4) | fait |
| H7.2 | Quatre vaisseaux modélisés, silhouettes distinctes : **Aube** (trimaran : corps central, deux nacelles reliées par un pont en flèche, dérives inclinées ; 16,6 k triangles, 280 Ko / 158 Ko compressé) ; Faucon, Bastion, Spectre | Aube fait ; les trois autres en cours |
| H7.3 | Piste construite : revêtement continu et marquages, bordures à liseré blanc et chevrons, structure porteuse, modules Blender | à faire |
| H7.4 | Environnements par monde : modules d'architecture, lointain monumental, atmosphère | à faire |
| H7.5 | Obstacles remodelés, effets, évaluation avant/après dans les mêmes conditions, mesures | à faire |
