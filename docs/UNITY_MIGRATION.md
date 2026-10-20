# Portal Rush → Unity : dossier de migration

Rédigé le 18 octobre 2026 (Claude Code Cloud, branche `claude/hopeful-ritchie-s4w21n`). Ce document est la
**phase A** de la migration (audit et correspondances) et le **mode d'emploi pour le PC Windows** de Mathéo, où
Unity pourra enfin tourner. Le contrat technique du projet Unity est `docs/UNITY_ARCHITECTURE.md` : ce dossier ne
le remplace pas, il dit **d'où l'on part, ce qui est fait, pourquoi ces choix, et comment continuer**.

## Comment lire les niveaux de preuve

Chaque affirmation importante porte l'un de ces repères :

| Repère | Signification |
|---|---|
| **[exécuté]** | commande lancée ici le 18 octobre 2026, résultat observé |
| **[code]** | vérifié en lisant les fichiers du dépôt (ou le code source public de Unity) |
| **[source]** | documentation officielle (Unity, GitHub, Netlify…), lien en fin de document |
| **[communauté]** | forum, blog ou dépôt tiers : sérieux mais non officiel |
| **[hypothèse]** | non vérifiable ici : **à vérifier dans Unity sur le PC** |

Ce conteneur n'a ni éditeur Unity, ni licence, ni carte graphique, et les serveurs de Unity y sont bloqués : les
pages de documentation Unity ont été lues par un service de recherche, et **rien n'a été compilé dans Unity**.

---

## 0. En bref

- **Fait et vérifié** : le cœur de règles du jeu (générateur, collisions, score, difficultés, Overdrive, boss des
  secteurs 7 et 8, conseils du secteur 1) est porté en C# et rejoue **29 parties de référence sur 29 à
  l'identique** du moteur TypeScript, plus le tirage pseudo-aléatoire **[exécuté]** (`dotnet run -c Release` dans
  `outils/unity/coeur-tests`, 18 octobre 2026). Le mode « partie scriptée » du tutoriel est porté aussi, mais
  aucune partie de référence ne le couvre encore. Les données C# sont à jour **[exécuté]**
  (`exporter-donnees.mjs --verifier` : « Données C# à jour. »).
- **Écrit mais jamais compilé dans Unity** : installateur des paquets, configuration URP/Web, scène et build par
  script, scripts de jeu (session, trajectoire, route, vaisseau, caméra, objets, décor, qualité, intro), shaders,
  interface UI Toolkit, tests EditMode. Ces scripts **compilent hors de Unity** contre une copie minimale de l'API
  recopiée du source officiel 6000.3 / URP 17.3 **[exécuté]** (`outils/unity/verif-compilation`, mise à jour du
  19 octobre ci-dessous) : cela écarte les fautes de C#, pas les erreurs que seul Unity voit.
- **Intégration au portfolio écrite et vérifiée avec une instance Unity simulée** (19 octobre) : recette
  `outils/recettes/rush-unity-pont.mjs` 39/39 **[exécuté]** ; ancien jeu inchangé (27/27 et 20/20).
- **Choix techniques confirmés par les sources** : Unity 6.3 LTS ; **WebGL2 seul** (WebGPU est expérimental dans
  6.3) ; URP en **Forward** (Forward+ a un défaut connu sous Chrome) ; pas de VFX Graph, de compute shaders ni de GPU
  Resident Drawer ; éclairage global **précalculé** seulement ; build **Brotli avec repli de décompression**.
- **Trois pièges trouvés pendant l'audit** (à traiter avant toute mise en ligne, avec l'accord de Mathéo) :
  1. la **politique de sécurité** (`Content-Security-Policy`) de `netlify.toml` (`script-src 'self'`) **bloquerait
     le build Unity en ligne** : il faut au minimum `'wasm-unsafe-eval'` et `blob:` dans `script-src`
     **[communauté]** ; en local (`npm run dev`) il n'y a pas de CSP, donc tout paraîtra marcher ;
  2. Netlify **ignore** un en-tête `Content-Encoding` personnalisé **[source]** : le repli de décompression du
     contrat est donc indispensable, pas facultatif ;
  3. le réglage de **compression des textures** du build est rangé dans `Library/` (non versionné) **[source]** :
     il doit être posé par script à chaque construction.
- **Sur le PC** : installer Unity 6.3 LTS + Web Build Support, ouvrir `unity/PortalRush`, accepter les paquets,
  puis `outils\unity\unity.ps1 -Tout` ; **enregistrer les `.meta` créés par Unity**. Pas à pas en §6.

---

## 1. Audit du jeu actuel

Tailles mesurées au commit `1de077e` (avant les lots Unity en cours) **[exécuté]** (`wc -lc`). « Ko » = 1 024 octets.

### 1.1 Vue d'ensemble

| # | Système | Fichiers | Taille | Rôle | Ce qui se réutilise |
|---|---|---|---|---|---|
| 1 | **Moteur 3D actuel** | `src/scripts/rush/scene/` : `scene.ts` (2 158 l.), `modeles.ts` (1 088), `materiaux.ts` (788), `mondes2.ts` (582), `mondes.ts` (442), `geometrie.ts` (396), `post.ts` (293), `textures.ts` (246), `assets.ts` (149), `parcours.ts` (123), `ombres.ts` (103), `kits.ts` (27) | 12 fichiers, 6 395 l., 297 Ko | Rendu WebGL 2 avec la bibliothèque **OGL** : caméra, piste pliée, mondes, obstacles, vaisseau, ombres, 8 lumières, textures procédurales triplanaires, post-traitement, qualité adaptative (détail : `docs/RUSH_3D.md`) | **Pas le code** (OGL → URP). Se réutilisent comme **spécifications** : formules du pli du parcours, palettes et identité des 8 mondes, réglages de caméra, niveaux de qualité et règle de descente automatique, liste des effets |
| 2 | **Fichiers Blender** | `outils/assets/*.py` : `objets_mecanismes.py` (67 Ko), `objets_mobiles.py` (43), `vaisseau_bastion.py` (40), `decor_mondes.py` (39), `vaisseau_spectre.py` (39), `vaisseau_faucon.py` (27), `decor.py` (19), `vaisseaux.py` (16), `piste.py` (16), `commun.py` (13), `formes.py` (13), `objets.py` (12), `objets_collecte.py` (5) | 13 scripts, 342 Ko | Modélisation **reproductible par scripts** (Blender 5.2 comme module Python `bpy`, environnement isolé) ; aucun fichier `.blend` versionné | **Tels quels** : les mêmes fonctions de construction servent à l'export FBX pour Unity (`exporter_unity.py`, lot en cours) |
| 3 | **Modèles** | `public/rush/modeles/*.prm` (vaisseaux `aube`, `faucon`, `bastion`, `spectre` ; `decor`, `piste`, 6 `monde-*`, `objets*`) | 16 fichiers, 2,75 Mo | Format binaire **maison « PRM1 »** (positions 16 bits, normales 8 bits, indice de matière par sommet, palette dans l'en-tête), lu par `scene/assets.ts` | **Pas le fichier** : Unity n'importe pas le PRM1. Les modèles sont **réexportés en FBX** depuis les mêmes scripts Blender (contrat §2 : `Modeles/` + `palette.json`) |
| 4 | **Circuits et géométrie** | `scene/mondes.ts`, `mondes2.ts`, `kits.ts`, `parcours.ts`, `geometrie.ts` ; `VOIE = 3.0` m (`modeles.ts`) | (inclus en 1) | Tronçons de 48 m recyclés ; 3 voies droites pour la règle, **virages et reliefs seulement dans l'image** (pli des sommets, somme d'ondes) | Les **paramètres et formules** (portés dans `Jeu/Parcours.cs`, `Route.cs`, `Decor.cs`, écrits, non compilés) |
| 5 | **Obstacles et motifs** | `rush/moteur.ts` (familles de motifs, obstacles mobiles), `rush/donnees.ts` (phases par niveau) ; visuels dans `scene/modeles.ts` et `objets*.py` | (voir 6) | Barrières, cristaux, lasers, failles, portails, drones, portes, rotors, chutes, éclaireurs, attaques des boss | **Règles : portées et vérifiées** (C#). **Visuels : à refaire** (FBX + `Jeu/Objets.cs`) |
| 6 | **Générateur** | `rush/moteur.ts` (1 014 l., 45 Ko) | — | Pose des **motifs** selon la phase et la complexité, avec la **règle de justice** (une voie libre toujours atteignable) ; même graine = même parcours | **Porté ligne à ligne** dans `Coeur/Partie.cs` (936 l.), **vérifié** **[exécuté]** |
| 7 | **Difficultés** | `rush/equilibrage.ts` (210 l.) ; 5 difficultés (`pilote`, `as`, `expert`, `cauchemar`, `paradoxe`), règles version 5 | 10 Ko | Courbes vitesse / écart / réaction / complexité, boucliers, Overdrive, points | **Exporté automatiquement** en `Coeur/Donnees.Generees.cs` (`outils/unity/exporter-donnees.mjs`), **à jour** **[exécuté]** |
| 8 | **Collisions** | `rush/moteur.ts` | — | Au passage de chaque objet : choc, esquive, Perfect Dodge ou ramassage, **par voie** (pas de physique) | **Porté et vérifié** : chaque objet créé, chaque évènement et l'état final sont comparés **[exécuté]** |
| 9 | **Commandes** | `rush/rush.ts` (1 844 l., 85 Ko) | — | ← → A/D/Q changer de voie, Espace/↑/W/Z Overdrive, Échap/P pause, R recommencer ; tactile « toucher » (moitiés d'écran) ou « glisser » ; boucle à pas fixe 1/120 s | Règle (`Deplacer`, `Overdrive`) **portée** ; lecture du clavier et du tactile dans `Jeu/Session.cs` (Input System) **écrite, non compilée** |
| 10 | **Progression** | `rush/sauvegarde.ts` (495 l., 25 Ko), `rush/donnees.ts` (8 secteurs, survie, défi du jour ; 4 vaisseaux ; 15 pièces de garage en 4 emplacements) | — | Secteurs débloqués, difficultés ouvertes (Cauchemar, Paradoxe), vaisseaux et pièces gagnés par conditions | **Reste en JavaScript** (contrat §1) : Unity reçoit une `Vue` calculée par les fonctions existantes |
| 11 | **Étoiles et records** | `sauvegarde.ts` (`ranger`, `etoilesDe`, `scoreEtoile`, `totalEtoiles`), `donnees.ts` (seuils d'étoiles par secteur et difficulté) | — | 3 étoiles par secteur et difficulté (terminer, score, maîtrise) ; records par secteur, survie, défi ; version des règles gardée avec chaque record | **Reste en JavaScript**. Le `Resultat` d'une partie (score, rang, objectifs) vient du cœur C# **porté et vérifié** |
| 12 | **Tutoriel** | `rush/tutoriel.ts` (260 l.) | 11 Ko | 5 phases jouées (déplacements, esquive, énergie, obstacle mobile, arrivée), échec = phase recommencée, état sauvegardé par phase | Le **mode scripté du moteur** (`Scriptee`, `Figee`, objets posés à la main) est **porté** **[code]** mais **non couvert** par les parties de référence ; le **scénario des 5 phases** est à porter dans `Jeu` (**à faire**) ; l'état reste sauvegardé par le JavaScript (`noterTutoriel`) |
| 13 | **Tunnel temporel** | `rush/tunnel.ts` (593 l.) | 26 Ko | Fissure du bouton du Hub, éclats de verre 3D, tunnel WebGL 2 (4 à 7 s), version réduite, sons synchronisés | **Réutilisé tel quel côté JavaScript** (contrat §6) : le portfolio joue la fissure et le tunnel pendant le chargement ; Unity enchaîne seulement la **sortie du tunnel** (`intro`) |
| 14 | **DREAM RADIO et RUSH RADIO** | `src/scripts/audio/` : `compositions.ts` (606 l.), `radio.ts` (473), `dream.ts` (238), `moteur.ts` (150), `catalogue.ts` (56), `rush-radio.ts` (25) ; `src/scripts/sons.ts` (798) ; `public/audio/` : 5 morceaux MP3 (12,5 Mo, Pioneer Space Sim, CC BY-SA 3.0) + 5 effets (132 Ko, Kenney, CC0), `CREDITS.txt` | ≈ 2 350 l. de code | Moteur audio commun, 2 radios (7 et 4 pistes), compositions jouées par le code (dont 2 adaptatives à couches), son du moteur, sons de course (`sonRush`) | **Réutilisé tel quel côté JavaScript** (contrat §1) : Unity a le son coupé et envoie ses évènements ; les crédits ne changent pas |
| 15 | **Sauvegardes** | `rush/sauvegarde.ts` | — | Voir §1.2 | **Reste en JavaScript**, format v3 inchangé ; **aucun `PlayerPrefs`** dans Unity |
| 16 | **Interfaces** | `src/components/PortalRush.astro` (643 l., 38 Ko), `src/styles/rush.css` (4 685 l., 92 Ko), `rush.ts` | — | Barre du haut, HUD, menu, campagne, survie, défi, records, garage, pause, fin, victoire, réglages, RUSH RADIO compacte | **Structure des écrans, textes et couleurs** comme spécification ; l'interface Unity est refaite en **UI Toolkit** (`Interface/`, lot en cours) |
| 17 | **Traductions** | `src/contenu/fr.ts` (partie `rush`, l. 260–598), `en.ts` (l. 255–593), `types.ts` | ≈ 340 l. par langue | Tous les textes du jeu, transmis à la page par `data-textes` | **Exportés automatiquement** vers C# (`outils/unity/exporter-textes.mjs` → `Interface/Textes.Generees.cs`, lot en cours) ; la langue reste celle du site (contrat) |

Autres éléments de l'ancien jeu, qui **restent** dans le portfolio : le rendu 2D de secours `rush/rendu.ts`
(743 l., si WebGL 2 manque), les recettes Playwright `outils/recettes/portal-rush-v4.mjs`, `portal-rush-v4c.mjs`,
`rush-3d-*.mjs`, `simulation-rush.mjs`. L'ancien jeu reste **le jeu par défaut** et le **repli** de la version Unity.

**Format des modèles, vérifié** **[exécuté]** : aucun fichier `.glb`, `.gltf`, `.fbx`, `.obj` ni `.blend` dans
`src/`, `public/` ou `outils/` (`find`), et aucun chargeur glTF dans le code (`grep gltf|glb|GLTFLoader` : rien).
Le seul format de modèle du jeu est le PRM1.

### 1.2 Les sauvegardes en détail

**[code]** `src/scripts/rush/sauvegarde.ts`, `src/scripts/audio/radio.ts`, `src/scripts/audio/dream.ts` :

| Clé | Stockage | Contenu |
|---|---|---|
| `portal-rush-3` | `localStorage` | sauvegarde principale, **version 3** (`VERSION_SAUVEGARDE = 3`), avec un numéro de `revision` à chaque écriture |
| `portal-rush-3-secours` | `localStorage` | copie de l'écriture précédente (reprise si la principale est illisible) |
| `portal-rush-3-illisible` | `localStorage` | une sauvegarde au JSON cassé, mise de côté telle quelle (jamais détruite) |
| `portal-rush-2`, `portal-rush-1` | `localStorage` | anciennes versions : **migrées** vers la v3 à la lecture, puis **laissées en place** comme témoins |
| `dream-radio` | `localStorage` | préférences de DREAM RADIO (piste, volume, sourdine) |
| `dream-radio-reprise` | `sessionStorage` | position de la musique pour la proposer en reprise sur une autre page |

Ce que contient la v3 : tutoriel (état, phase), secteur maximal, secteurs réussis, étoiles, records (avec date et
version des règles), survie, défi du jour, totaux, dernière partie, difficulté, pièces débloquées, équipement,
vaisseaux, réglages du jeu (dont RUSH RADIO et la **qualité graphique** `auto | elevee | equilibree | economie`).
Sûretés : **migration** v1 → v3 et v2 → v3 sans perte ; **validation** champ par champ ; **copie de secours** ;
**fusion** si un autre onglet a écrit entre-temps (le meilleur des deux) ; jeu jouable **sans stockage** (navigation
privée stricte). Le contrat garde tout cela côté JavaScript : Unity envoie `fin`, `reglages`, `vehicule`, `equiper`,
`tutoriel` ; la page enregistre et répond `vue` ou `bilan`.

---

## 2. Table de correspondance

Cibles d'après le contrat (`docs/UNITY_ARCHITECTURE.md`). État mis à jour le 19 octobre 2026. « Compile hors
Unity » = accepté par `outils/unity/verif-compilation` (API recopiée du source officiel) ; **rien n'a été compilé
ni lancé dans Unity**.

| Ancien système | Implémentation Unity (fichier / assemblage) | Statut |
|---|---|---|
| Règles : `moteur.ts` (générateur, motifs, collisions, score, combo, Overdrive, boss, mode scripté) | `Scripts/Coeur/Partie.cs`, `Types.cs`, `Hasard.cs` — `PortalRush.Coeur` (sans UnityEngine) | **Porté et vérifié** : 29/29 parties de référence identiques + tirage mulberry32 identique, en .NET 8 **[exécuté]** |
| Données : `donnees.ts`, `equilibrage.ts` | `Scripts/Coeur/Donnees.Generees.cs` (généré par `outils/unity/exporter-donnees.mjs`) | **Porté et vérifié** (`--verifier` : à jour) **[exécuté]** |
| Parties de référence (jeu web) | `Tests/Editor/References/*.json` (29), `outils/unity/generer-references.mjs` | **Fait** (produites par le vrai moteur TypeScript) |
| Rejeu dans Unity | `Tests/Editor/RejeuTests.cs` + `Verification/` — `PortalRush.Tests.Editor` | `Verification/` **compilé et exécuté en .NET** **[exécuté]** ; `RejeuTests.cs` (NUnit, 31 tests attendus : 29 parties + 2) **préparé, non compilé dans Unity** |
| Installation des paquets | `Scripts/Installation/Installateur.cs` — `PortalRush.Installation` | **Écrit, non compilé dans Unity** (enregistré, commit `deb1a52`) |
| Configuration URP / Web / qualité | `Scripts/Editeur/Configuration.cs` — `PortalRush.Editeur` | **Écrit, compile hors Unity** (Forward, WebGL2 seul, Brotli + repli, 3 niveaux URP, mémoire, son de Unity coupé) |
| Points d'entrée batch `Batch.Configurer`, `Batch.Construire`, scène construite par code, manifeste | `Scripts/Editeur/` (Batch, Scene, Construction, ImportModeles, ImportTextures) | **Écrit, compile hors Unity** |
| Boucle de partie, commandes clavier / tactile | `Scripts/Jeu/Session.cs` — `PortalRush.Jeu` | **Écrit, compile hors Unity** |
| Pli du parcours (`parcours.ts`), piste (`mondes*.ts`) | `Jeu/Parcours.cs`, `Route.cs`, `Monde.cs`, `Decor.cs`, `Ambiances.cs` | **Écrit, compile hors Unity** (modules Blender du catalogue, formes de prototype en secours) |
| Vaisseau, caméra, objets, effets | `Jeu/Vaisseau.cs`, `CameraJeu.cs`, `Objets.cs`, `Effets.cs`, `Formes.cs`, `Catalogue.cs`, `Vitrine.cs` ; `Shaders/Ciel.shader`, `Particules.shader` | **Écrit, compile hors Unity** (shaders jamais compilés) |
| Qualité graphique Auto / Élevée / Équilibrée / Économie | `Jeu/Qualite.cs` + niveaux de `Configuration.cs` | **Écrit, compile hors Unity** ; réglages à mesurer dans le navigateur **[hypothèse]** |
| Modèles PRM1 (`outils/assets/*.py`) | `outils/assets/exporter_unity.py` → `Assets/PortalRush/Modeles/*.fbx`, `palette.json`, `modeles.json` | **Fait** (43 FBX ; orientation vérifiée contre les `.prm`) |
| Textes FR/EN (`fr.ts`, `en.ts`) | `outils/unity/exporter-textes.mjs` → `Interface/Textes.Generees.cs`, `Textes.cs` | **Fait** (`--verifier` : à jour) |
| Interface (`PortalRush.astro`, `rush.css`, `rush.ts`) | `Scripts/Interface/` (UI Toolkit), `UI/` (polices Geist Mono et Tektur sous OFL, images) | **Écrit, compile hors Unity** (11 écrans, HUD, barre, réglages, RUSH RADIO) |
| Tutoriel (scénario des 5 phases) | `Interface/Tutoriel.cs` + partie scriptée de `Session` | **Écrit, compile hors Unity** |
| Cinématiques : sortie du tunnel, fin de secteur, victoire, défaite | `Jeu/Intro.cs`, `Jeu/CameraJeu.cs` + `Interface` | Sortie du tunnel **écrite** ; séquence de fin de victoire **en cours** |
| Pont JavaScript ↔ Unity | `Jeu/Pont/Pont.cs`, `Messages.cs`, `Plugins/WebGL/PortalRushPont.jslib` | **Écrit, compile hors Unity** ; format des messages vérifié par la recette du pont |
| Chargeur, drapeau `?rush=unity`, pont côté page | `src/scripts/rush-unity/` (`chargeur.ts`, `drapeau.ts`, `pont.ts`, `protocole.ts`, `vue.ts`), `src/scripts/rush/sons-course.ts` | **Fait, vérifié avec une instance simulée** (39/39) **[exécuté]** |
| Sauvegarde, progression, étoiles, records | `src/scripts/rush/sauvegarde.ts` | **Réutilisé tel quel côté JavaScript** |
| DREAM RADIO, RUSH RADIO, sons, musique adaptative | `src/scripts/audio/*`, `sons.ts` | **Réutilisé tel quel côté JavaScript** |
| Fissure et tunnel temporel | `src/scripts/rush/tunnel.ts` | **Réutilisé tel quel côté JavaScript** |
| Langue du site | `fr.ts` / `en.ts`, message `langue` | **Réutilisé tel quel côté JavaScript** |
| Rendu 2D de secours, ancien rendu 3D | `rush/rendu.ts`, `rush/scene/*` | **Conservés** : c'est l'ancien jeu, repli de la version Unity |
| Build Web, en-têtes, CSP | `public/rush-unity/`, `netlify.toml` | Build par `Construction.cs` **écrit, jamais lancé** ; changement de CSP **soumis à l'accord de Mathéo** (§3.7) |

---

## 3. Choix techniques, avec leurs sources

### 3.1 Pourquoi Unity 6.3 LTS

- **Unity 6.3 LTS** est sortie le **4 décembre 2025** ; c'est la première version « support à long terme » depuis
  Unity 6.0 LTS **[source S1]**. Elle est **suivie jusqu'en décembre 2027** (un an de plus pour les abonnements
  Enterprise et Industry) ; Unity 6.0 LTS n'est plus suivie après **octobre 2026** **[source S1, S2]**.
- C'est encore la LTS en cours d'après les pages de Unity consultées le 18 octobre 2026 ; une « 6.7 LTS » n'est
  évoquée que par des sources non officielles, sans date **[communauté]**. Ne pas changer de version en cours de
  route sans raison.
- Correctif constaté : **6000.3.26f1** (dépôt public `Unity-Technologies/UnityCsReference`, branche 6000.3),
  inscrit dans `unity/PortalRush/ProjectSettings/ProjectVersion.txt` **[code]**. Toute 6000.3 plus récente
  proposée par Unity Hub convient.
- URP livré avec 6.3 : paquet `com.unity.render-pipelines.universal` **17.3.0** (`"unity": "6000.3"`) **[code]**
  (code source public du paquet).

### 3.2 Modules et licence

- Module indispensable : **Web Build Support** (ancien nom « WebGL Build Support ») **[source S4]**. Facultatifs :
  Microsoft Visual Studio Community (éditeur de code gratuit pour un particulier), documentation, pack de langue.
- Licence **Unity Personal**, gratuite : réservée aux personnes et petites structures dont les **revenus et fonds
  levés sont inférieurs à 200 000 $ sur les 12 derniers mois** ; pour un particulier, on compte ce qu'il gagne
  **avec Unity** (pas son autre travail) ; l'écran de démarrage Unity est facultatif depuis Unity 6 **[source S3]**.
  Un étudiant inscrit peut aussi demander le plan **Unity Student**, gratuit **[source S3]**. Unity peut demander
  de remplir un questionnaire à l'activation **[source S3]**.

### 3.3 API graphique : WebGL2, et pas (encore) WebGPU

- **WebGL2** est l'API par défaut du Web dans Unity, compatible avec la plupart des appareils et navigateurs
  **[source S5]**.
- **WebGPU** est marqué **« Experimental »** dans la documentation 6000.3, « pas recommandé en production »
  **[source S5]** ; il n'est pas activé par défaut **[source S6]**.
- Pour l'essayer un jour (sans s'en rendre dépendant) **[source S6]** : *Edit › Project Settings › Player › Web ›
  Other Settings*, décocher **Auto Graphics API**, **+** › **WebGPU**, garder **WebGL 2** dans la liste et **glisser
  WebGPU en tête** : Unity essaie WebGPU, puis retombe sur WebGL2 si le navigateur ne le gère pas.
- Pourquoi ne pas en dépendre : expérimental dans 6.3 ; pas disponible partout (Safari, Firefox n'ont pas toutes
  les extensions utilisées par Unity) ; et tout ce que WebGPU apporte (compute shaders, rendu indirect, VFX Graph)
  disparaîtrait de toute façon sur le repli WebGL2 **[source S6]**. Le jeu est donc conçu pour WebGL2 ;
  `Configuration.cs` pose **WebGL2 seul** **[code]**.

### 3.4 URP sur le Web : ce qui marche, ce qui ne marche pas

| Fonction | Décision pour Portal Rush | Preuve |
|---|---|---|
| **Chemin de rendu** | **Forward**. Pas Forward+ : Unity reconnaît un défaut du compilateur de shaders de Chrome sous Windows qui casse Forward+ avec les ombres des lumières additionnelles, et recommande Forward | **[source S7]** (fiche de bogue Unity, « Third Party Issue ») |
| Nombre de lumières | Forward : jusqu'à **9 lumières en temps réel par objet** (soleil + 8) — assez pour les 8 lumières dynamiques du jeu web | **[source S8]** |
| Deferred | Non : pas de MSAA, G-buffer coûteux sur mobile | **[source S8]** |
| **MSAA** | « WebGL prend en charge l'anticrénelage sur la plupart des combinaisons navigateur / GPU, **pas toutes** » ; un bogue « scène non rendue » (MSAA + empilement de caméras ou passe de profondeur seule) est **corrigé dans 6.3** (UUM-90459). Décision : MSAA ×4 seulement en Élevée (c'est ce que pose `Configuration.cs`), **aucun empilement de caméras** (l'interface UI Toolkit n'en a pas besoin), à vérifier dans le navigateur | **[source S5, S9]**, **[code]**, **[hypothèse]** pour notre scène |
| « Depth priming » | Désactivé d'office par URP sur WebGL | **[code]** (URP 17.3, `UniversalRenderer.cs`) |
| **HDR** | Oui sauf en Économie. URP choisit `B10G11R11` si le navigateur le permet, sinon `RGBA16F`, sinon un format qui « peut être LDR sur de vieux appareils » | **[code]** (URP 17.3, `UniversalRenderPipelineCore.cs`) |
| **Post-traitement** (bloom, tonemapping ACES, vignettage, aberration chromatique, grain) | Volumes URP intégrés ; flou radial de vitesse = passe plein écran personnalisée | **[hypothèse]** : prévu pour marcher en WebGL2, à vérifier et mesurer |
| **SSAO** | Élevée seulement (`Configuration.cs`) : coûteux | **[code]** ; coût **[hypothèse]** |
| **Ombres** | Soleil seulement (cascades selon la qualité) ; **pas d'ombres de lumières additionnelles** (défaut Chrome ci-dessus, et coût) | **[source S7]** |
| **Sondes de réflexion** | Précalculées ; en Forward, mélange de 2 sondes au plus (plus de 2 demande Forward+) | **[source S8]** |
| **Éclairage global** | **Précalculé seulement**, lightmaps **non directionnelles** ; pas de GI temps réel sur le Web. Les « Adaptive Probe Volumes » sont désactivés par URP sur WebGL | **[source S5]**, **[code]** (URP 17.3, `ForwardLights.cs`) |
| **VFX Graph** | **Non** : « WebGL ne gère pas les compute shaders nécessaires au VFX » (Won't Fix). Particules **Shuriken** à la place | **[source S10]** |
| **Compute shaders** | **Non** en WebGL2 (c'est WebGPU qui les apporte) | **[source S6]** |
| **GPU Resident Drawer** | **Non** : demande des compute shaders et Forward+ ; OpenGL / GLES (donc WebGL) explicitement exclus. À la place : SRP Batcher + instanciation GPU. `Configuration.cs` le désactive | **[communauté]** (messages d'ingénieurs Unity, S11), **[code]** |
| Variantes de shaders | Limiter les variantes (mémoire du Web) | **[source S5]** |
| Polices | Le Web n'a pas accès aux polices du système : toutes les polices sont **dans le projet** (`UI/Polices`, licences OFL jointes) | **[source S5]**, **[code]** |

### 3.5 Compression des textures

- Bureau : **DXT** (BCn) ; mobile : **ASTC** (ou ETC2). Un format non géré par l'appareil est **décompressé par
  logiciel** au chargement : ça marche, mais avec plus de mémoire et plus lentement **[source S12]**.
- Le réglage du build (*File › Build Profiles › Web › Texture Compression*) l'emporte sur celui du Player, et il
  est **enregistré dans `Library/`, donc pas dans Git** **[source S12]** : `Batch.Construire` doit le poser par
  script à chaque build (**DXT** pour le premier build).
- Unity recommande **deux builds** pour viser bureau et mobile (DXT et ASTC) **[source S12]**. Proposition pour la
  phase F/G : un second build ASTC et une entrée « mobile » dans le manifeste ; d'ici là, sur mobile, l'ancien jeu
  peut rester le repli (décision à prendre avec Mathéo, qui a remis le mobile dans le périmètre).

### 3.6 Compression du build et en-têtes du serveur

- **Brotli** donne les plus petits fichiers mais Chrome et Firefox ne le décodent nativement **qu'en HTTPS** ;
  Gzip est plus gros mais marche en HTTP et HTTPS **[source S13]**.
- **Repli de décompression** (*Decompression Fallback*) : Unity embarque un décompresseur JavaScript utilisé si le
  navigateur n'a pas décompressé ; les fichiers prennent l'extension **`.unityweb`** ; chargeur plus gros, et pas de
  compilation WebAssembly en flux **[source S13]**. Sans ce repli, le serveur doit envoyer `Content-Encoding: br`
  (ou `gzip`) et `Content-Type: application/wasm` pour le `.wasm` **[source S13]**.
- **Hébergement prévu** : **Netlify** (`netlify.toml` : « l'hébergeur prévu pour matheomaleyran.com », build
  `npm run build`, dossier `dist`) **[code]** ; rien n'est en ligne. Netlify liste `Content-Encoding` parmi les
  en-têtes personnalisés **« typiquement ignorés »** **[source S14]** (des articles de 2020 disent le contraire
  **[communauté]** : non vérifiable ici, et un essai demanderait un déploiement, donc l'accord de Mathéo).
- **Décision (déjà dans le contrat et dans `Configuration.cs`)** : **Brotli + repli de décompression**. Le build
  marche partout : en local (`npm run dev` n'envoie aucun `Content-Encoding`), sur Netlify, ou ailleurs ; si un
  jour le serveur envoie le bon en-tête, le navigateur décompresse lui-même et le démarrage est plus rapide.
- **Cache** : les noms de fichiers du build sont fixes (`nameFilesAsHashes = false` **[code]**) ; proposition : le
  chargeur ajoute `?v=<version du manifeste>` aux URL et lit le manifeste sans cache.

### 3.7 La politique de sécurité du site (piège trouvé)

`netlify.toml` envoie `Content-Security-Policy: default-src 'self'; script-src 'self'; …` **[code]**. Un build Web
Unity a besoin, d'après plusieurs retours concordants **[communauté, S15]** :

- de **`'wasm-unsafe-eval'`** dans `script-src` (sinon : « call to WebAssembly.instantiate() blocked by CSP ») ;
- de **`blob:`** dans `script-src` (le chargeur exécute le framework depuis une URL `blob:`, en particulier avec le
  repli de décompression).

Il n'y a pas de CSP en local : **tout paraîtra marcher sur le PC et échouera en ligne**. La modification de
`netlify.toml` (au minimum `script-src 'self' 'wasm-unsafe-eval' blob:`) touche la sécurité du site : elle est
**à soumettre à Mathéo** et à vérifier sur un aperçu Netlify (déploiement = accord explicite). Le contrat (§6) ne
l'évoque pas encore.

### 3.8 Mémoire

- Le tas de Unity est un bloc **contigu** qui grandit au besoin ; s'il ne peut plus grandir, l'application
  plante : il faut le garder **le plus petit possible** **[source S16]**.
- Valeurs recommandées par défaut : taille initiale **32 Mo**, maximum **2 048 Mo** **[source S16]**. Pour les
  navigateurs mobiles, régler la taille initiale sur l'usage typique du jeu **[source S16]**.
- `Configuration.cs` ne règle pas encore la mémoire **[code]** : à mesurer avec un build de développement et le
  Profiler, puis à fixer **[hypothèse : quelques centaines de Mo suffisent pour une scène de cette taille]**.

### 3.9 Profils de qualité

Le jeu web a quatre réglages, **Auto, Élevée, Équilibrée, Économie** ; l'automatique part en Élevée sur ordinateur,
Équilibrée au doigt, Économie sans accélération graphique, et descend d'un cran si la moyenne dépasse **21 ms par
image sur 180 images**, sans jamais remonter seul **[code]** (`docs/RUSH_3D.md`, `scene/scene.ts`). Unity reprend
la même règle (`Jeu/Qualite.cs`, contrat §5.2) avec trois niveaux URP **[code]** (`Configuration.cs`) :

| Niveau | Échelle de rendu | MSAA | HDR | Ombres du soleil | Lumières additionnelles | SSAO |
|---|---|---|---|---|---|---|
| Économie | 0,7 | non | non | non | aucune | non |
| Équilibrée (défaut) | 0,9 | non | oui | 1 024², 1 cascade, 70 m | 2 | non |
| Élevée | 1,0 | ×4 | oui | 2 048², 2 cascades, 120 m | 4 | oui |

Ces valeurs sont des **points de départ** **[hypothèse]** : elles se règlent après mesure dans Chrome, Edge,
Firefox et Safari, et sur un téléphone.

### 3.10 Mobile et navigateurs faibles : jamais d'écran noir

- Navigateurs pris en charge par Unity 6.3 : Chrome, Firefox, Edge, Safari (macOS) sur ordinateur, s'ils gèrent
  WebGL2 et WebAssembly en 64 bits ; **Safari iOS 15+** et **Chrome Android 58+** sur mobile **[source S17]**.
- Règle du contrat (§1, §6) : **l'ancien jeu reste le repli**. Le chargeur bascule sur l'ancien jeu si le
  manifeste manque, si WebGL2 est absent ou si le chargement échoue, dans le même voyage (pas de second tunnel)
  **[exécuté]** (recette du pont, partie F).
  Propositions complémentaires **[hypothèse]** : un délai maximal entre le clic et le message `pret` ; un message
  `erreur` de Unity qui déclenche aussi le repli ; sur mobile, tant que le build ASTC n'existe pas, préférer
  l'ancien jeu.
- **Clavier** : par défaut, Unity Web **capte tout le clavier de la page**, même sans focus ; pour respecter le
  contrat (« Unity ne capture pas le clavier quand la toile n'a pas le focus »), il faut
  `WebGLInput.captureAllKeyboardInput = false` **[source S18]**. La touche **Échap** est protégée par certains
  navigateurs (plein écran) et peut ne pas arriver à Unity **[source S18]** : la page la relaie (contrat §6).

### 3.11 La ligne de commande (pour `outils/unity/unity.ps1`)

| Argument | Ce qu'en dit Unity | Usage dans le script |
|---|---|---|
| `-batchmode` | sans interaction ; **impossible d'ouvrir un projet déjà ouvert par l'éditeur** ; une exception arrête Unity avec le code 1 **[source S19]** | toutes les étapes ; le script détecte `Temp/UnityLockfile` avant |
| `-executeMethod` | méthode statique d'éditeur ; erreur = exception (code 1) ou `EditorApplication.Exit(≠0)` **[source S19]** | Installer, Configurer, Construire |
| `-quit` | « avec `-runTests`, Unity quitte **avant la fin des tests** » ; avec du code asynchrone, peut **bloquer** **[source S19]** | **jamais** : les méthodes du contrat appellent `Exit` elles-mêmes, le Test Framework ferme Unity seul |
| `-nographics` | pas de carte graphique initialisée ; pas de calcul d'éclairage ; journaux seulement avec `-logFile` **[source S19]**. Rien n'est garanti pour la compilation des shaders et le build | **Installer et Tests seulement** (pas Configurer ni Construire, par prudence) |
| `-buildTarget WebGL` | plateforme active au lancement ; sans elle, un projet jamais importé démarre sur la plateforme par défaut **[source S19]** | toutes les étapes (pas de changement de plateforme entre deux lancements) |
| `-logFile <fichier>` | journal de l'éditeur **[source S19]** | `unity/PortalRush/Logs/batch/` (ignoré par Git) |
| `-runTests -testPlatform EditMode -testResults <xml>` | résultats au format NUnit **[source S20]** | étape Tests |
| Codes de sortie des tests | 0 réussi, 2 échecs, 3 erreur d'exécution (dont compilation), 4 plateforme introuvable | **[communauté]** (code du Test Framework 1.1.22 copié dans un dépôt tiers, S21) ; à confirmer avec la version de 6.3 |

---

## 4. Plan par phases (A à G) et état au 19 octobre 2026

| Phase | Contenu | État |
|---|---|---|
| **A. Audit** | inventaire, correspondances, choix techniques, mode d'emploi PC (ce document) ; cœur C# porté et vérifié hors de Unity | **Fait** |
| **B. Prototype graphique** | projet configuré (URP Forward, WebGL2, qualité), scène construite par code, trajectoire et route courbes, un monde, vaisseau Aube, caméra ; **premier build Web mesuré dans le navigateur** | **Écrit, compile hors Unity** ; tout reste à ouvrir et mesurer sur le PC |
| **C. Gameplay** | session à 1/120 s, commandes clavier et tactile, objets et collisions affichés, Overdrive, boss, tutoriel scripté ; rejeu EditMode vert | Cœur **fait et vérifié** ; `Session.cs`, `Objets.cs`, tutoriel **écrits, compilent hors Unity** ; rejeu EditMode à lancer sur le PC |
| **D. Production graphique** | 8 mondes, piste construite, obstacles et vaisseaux en FBX, textures, lumières, post-traitement, effets, profils de qualité réglés | FBX **faits** ; route, décor, textures PBR, post-traitement, effets **écrits** ; réglage à l'œil **sur le PC** |
| **E. Interface et cinématiques** | écrans UI Toolkit (menu, campagne, survie, défi, records, garage, réglages, pause, fin), HUD, textes FR/EN, sortie du tunnel, fins | Textes, interface, sortie du tunnel **écrits** ; séquence de fin de victoire **en cours** |
| **F. Intégration** | pont (`.jslib` + `Pont.cs` + `pont.ts`), chargeur, manifeste, `?rush=unity`, repli, focus clavier, audio par le portfolio, **CSP et en-têtes** | **Écrite des deux côtés ; vérifiée avec une instance simulée (39/39)** ; CSP **à décider avec Mathéo** |
| **G. Tests** | rejeu Unity, recette Playwright avec une instance Unity simulée, essais réels Chrome / Edge / Firefox / Safari et téléphone, mesures (temps de chargement, images par seconde, mémoire), mode réduit | Rejeu .NET 29/29, compilation hors Unity, recette du pont 39/39 **faits** ; tout ce qui demande Unity ou un vrai navigateur avec carte graphique **à faire sur le PC** |

---

## 5. Ce qui manque ici (et ce qui reste invérifiable sans le PC)

- **Aucune compilation Unity** : pas d'éditeur, pas de licence, serveurs Unity bloqués. Les scripts hors de
  `Coeur/` et `Tests/Editor/Verification/` n'ont été compilés **que contre une copie minimale de l'API**
  (`outils/unity/verif-compilation`, signatures recopiées du source officiel) : des erreurs `error CS…` restent
  possibles à la première ouverture (API mal recopiée, différences de version), et les shaders n'ont jamais été
  compilés.
- **Pas de fichiers `.meta`** : Unity les crée à la première ouverture ; ils **doivent être enregistrés dans Git**
  (sinon les liens entre scènes, matériaux et scripts changent d'un ordinateur à l'autre).
- **Pas de `Packages/manifest.json`** : l'installateur ajoute les paquets par leur nom à l'ouverture ; Unity écrit
  `manifest.json` et `packages-lock.json`, à enregistrer ensuite.
- **Pas encore** : la séquence de fin de victoire (en cours), le réglage fin des mondes à l'œil, les mesures de
  fluidité et de mémoire, le build ASTC pour mobile.
- **Invérifiable ici** : la fluidité sur une vraie carte graphique, le rendu réel de URP dans un navigateur
  (MSAA, HDR, post-traitement), le comportement de Netlify avec les en-têtes, la CSP en ligne, WebGPU, le mobile.
- **Le script `outils/unity/unity.ps1` n'a jamais été lancé sous Windows ni avec un vrai Unity** : il a été analysé
  et essayé ici avec **PowerShell 7.4** (paquet officiel Microsoft installé hors du dépôt) et un **faux Unity**
  (chemins avec espaces, échec de compilation, échec des tests, build et manifeste, verrou tenu ou orphelin,
  délai dépassé). Windows PowerShell 5.1 n'a pas pu être essayé ; la syntaxe a été relue pour lui (pas de `??`,
  pas d'opérateur ternaire, pas de `&&`) et le fichier est en **UTF-8 avec BOM** (sinon 5.1 lit mal les accents).

---

## 6. Mode d'emploi sur le PC Windows, pas à pas

À faire dans l'ordre. Rien ici ne publie ni ne paie quoi que ce soit.

### 6.1 Avant de commencer

- Windows 10 ou 11, 64 bits ; prévoir **une dizaine de Go** libres (éditeur + module Web + `Library/`)
  **[hypothèse]**.
- Déjà installés d'après le README : **Node.js 24** et **Git**. Unity Hub vient d'être installé.
- Placer le dépôt dans un **chemin court et hors OneDrive** (exemple : `C:\Projets\Portofolio`) : la
  synchronisation de OneDrive gêne `Library/` et les chemins trop longs posent problème sous Windows
  **[hypothèse, cause fréquente]**.

### 6.2 Licence Unity (gratuite)

1. Ouvrir **Unity Hub** et se connecter avec un compte Unity (en créer un si besoin).
2. **Préférences** (roue dentée) › **Licenses** › **Add** › **Get a free personal license** **[communauté S22]**
   (libellés exacts susceptibles de varier selon la version de Hub).
3. Conditions de la licence Personal : §3.2. Alternative pour un étudiant : Unity Student.

### 6.3 Installer Unity 6.3 LTS avec le module Web

1. Unity Hub › **Installs** › **Install Editor**.
2. Choisir **Unity 6.3 (LTS)** — idéalement **6000.3.26f1**, sinon la 6000.3 la plus récente proposée.
3. Cocher le module **Web Build Support** (facultatif : *Microsoft Visual Studio Community*). **Install**,
   accepter les conditions, attendre la fin (icône des téléchargements).
4. Si Unity 6.3 est déjà installé sans le module : **Installs** › (la 6000.3) › **Manage** › **Add modules** ›
   **Web Build Support** › **Install** **[source S4]**.

### 6.4 Récupérer le dépôt et la bonne branche

Le dépôt GitHub `worldwide73/Portofolio` est **privé** **[exécuté]** : il faut être connecté à GitHub.

- **Avec GitHub Desktop** (gratuit) : *File › Clone repository* › `worldwide73/Portofolio` › dossier
  `C:\Projets\Portofolio` › **Clone**. Puis en haut, **Current branch** › `claude/hopeful-ritchie-s4w21n`, et
  **Fetch origin** / **Pull origin**.
- **En ligne de commande** :

  ```powershell
  git clone https://github.com/worldwide73/Portofolio.git C:\Projets\Portofolio
  cd C:\Projets\Portofolio
  git switch claude/hopeful-ritchie-s4w21n
  ```

- **Si le dépôt est déjà sur le PC** : `git fetch`, `git switch claude/hopeful-ritchie-s4w21n`, `git pull`.

Ne jamais travailler sur `main`.

### 6.5 Ajouter le projet dans Unity Hub

1. Unity Hub › **Projects** › **Add** › **Add project from disk** **[source S4]**.
2. Choisir le dossier **`C:\Projets\Portofolio\unity\PortalRush`** (celui qui contient `Assets`), pas la racine du
   dépôt.
3. Si Hub signale une version manquante ou différente : choisir la **6000.3** installée (jamais une 6.4, 6.5… ni
   une 2022) **[source S4]**.

### 6.6 Première ouverture

1. Cliquer le projet dans Hub. La première ouverture est **longue** (Unity fabrique `Library/`).
2. À ce stade seuls `PortalRush.Coeur` et `PortalRush.Installation` compilent (garde `PORTALRUSH_PAQUETS`,
   contrat §2). Une fenêtre propose **d'installer les paquets** (URP, Input System, Test Framework) : accepter
   (aussi au menu *Portal Rush › 1. Installer les paquets*) **[code]**.
3. Unity recompile ensuite le reste. Si l'Input System demande de **redémarrer l'éditeur** pour activer le nouveau
   système d'entrée, accepter **[hypothèse]**.
4. Si des erreurs rouges apparaissent dans la **Console** (*Window › General › Console*), ou si Unity propose le
   **Safe Mode** : c'est attendu pour du code jamais compilé. Noter les erreurs `error CS…` (fichier et ligne) et
   les faire corriger (§7) ; ne pas modifier `Coeur/` à la main sans relancer le rejeu .NET.
5. **Enregistrer tout de suite dans Git** ce que Unity a créé : les `.meta`, `Packages/manifest.json`,
   `Packages/packages-lock.json`, `ProjectSettings/` (§6.12).

### 6.7 Les menus « Portal Rush »

Dans la barre de menus de Unity, le menu **Portal Rush** regroupe les actions du projet. Présents dans le code au
18 octobre 2026 **[code]** : **1. Installer les paquets**, **2. Configurer le projet**. Annoncés par le contrat :
**Construire la scène** et la construction du build Web. Ordre d'emploi : installer, configurer, construire la
scène, jouer, construire le build.

### 6.8 Lancer les tests (Test Runner)

1. *Window › General › Test Runner* › onglet **EditMode** › **Run All**.
2. Attendu : **31 tests verts** (une vérification de présence, 29 parties de référence, le tirage) **[code]**.
   Ce sont les mêmes vérifications que `outils/unity/coeur-tests`, ici dans Unity.
3. Équivalent sans ouvrir l'éditeur : `unity.ps1 -Tests` (§6.13).

### 6.9 Jouer la scène

1. Ouvrir `Assets/PortalRush/Scenes/PortalRush.unity` (créée par *Construire la scène*).
2. Cliquer **Play** (▶). Commandes : ← → (ou A/Q, D), Espace pour l'Overdrive, P ou Échap pour la pause. Dans
   l'éditeur, le pont simule la page (vue par défaut, rien n'est enregistré) — contrat §5.3.
3. Pour juger la fluidité, **ne pas se fier à l'éditeur** : seul le build Web dans le navigateur compte.

### 6.10 Construire le build Web

- **Fermer l'éditeur**, puis depuis la racine du dépôt : `powershell -ExecutionPolicy Bypass -File outils\unity\unity.ps1 -Construire`
  (ou le menu *Portal Rush* quand il existera).
- Sortie attendue : `public/rush-unity/Build/` (`PortalRush.loader.js`, `.data.unityweb`, `.framework.js.unityweb`,
  `.wasm.unityweb`) et `public/rush-unity/portal-rush.json` (contrat §6.1). Le premier build peut prendre plusieurs
  dizaines de minutes **[hypothèse]**.
- Ne pas utiliser *File › Build Profiles › Build* directement : il ne poserait pas le manifeste ni le bon dossier.

### 6.11 Vérifier dans le portfolio, en local

1. À la racine du dépôt : `npm install` (la première fois), puis `npm run dev`.
2. Ouvrir **`http://localhost:4321/?rush=unity`**, puis l'Orbital Hub › **Portal Rush**. Sans `?rush=unity`,
   l'ancien jeu s'ouvre (normal). `?rush=web` revient à l'ancien jeu pour l'onglet **[code]** (`drapeau.ts` ; non couvert par la recette).
3. Vérifier : pas d'écran noir (la transition du tunnel s'enchaîne), clavier, son (par le portfolio), retour au Hub,
   et le repli : renommer temporairement `public/rush-unity/portal-rush.json` → l'ancien jeu doit s'ouvrir.
4. Ce test local **ne prouve pas** que le site en ligne marchera (CSP et en-têtes de Netlify : §3.6, §3.7).

### 6.12 Enregistrer et pousser

Avec GitHub Desktop :

1. Vérifier la liste des changements. **Doivent y être** : `unity/PortalRush/Assets/**` avec leurs **`.meta`**,
   `unity/PortalRush/Packages/`, `unity/PortalRush/ProjectSettings/`. **Ne doivent pas y être** : `Library/`,
   `Temp/`, `Logs/`, `UserSettings/`, `*.csproj`, `*.sln` (écartés par `unity/PortalRush/.gitignore`).
2. Le build `public/rush-unity/` (≈ 25 Mo d'après l'exemple du contrat **[hypothèse]**) : ne l'enregistrer que
   lorsqu'il est **validé**, pour ne pas alourdir l'historique à chaque essai.
3. Écrire un résumé (ex. « Unity : première ouverture, .meta et réglages »), **Commit to
   claude/hopeful-ritchie-s4w21n**, puis **Push origin**.
4. Jamais de commit sur `main`, jamais de fusion, jamais de déploiement sans l'accord de Mathéo.

### 6.13 Le script `outils/unity/unity.ps1`

À lancer **éditeur Unity fermé**, depuis la racine du dépôt :

```powershell
powershell -ExecutionPolicy Bypass -File outils\unity\unity.ps1 -Tout
```

`-ExecutionPolicy Bypass` ne vaut que pour ce lancement (Windows bloque souvent les scripts par défaut) ; rien
n'est changé durablement.

| Paramètre | Effet |
|---|---|
| `-Installer` | `PortalRush.Installation.Installateur.InstallerEnBatch` (paquets + `PORTALRUSH_PAQUETS`) |
| `-Configurer` | `PortalRush.Editeur.Batch.Configurer` |
| `-Tests` | `-runTests -testPlatform EditMode -testResults …` |
| `-Construire` | `PortalRush.Editeur.Batch.Construire`, puis lecture du manifeste |
| `-Tout` | les quatre dans cet ordre, **un lancement de Unity par étape**, arrêt à la première erreur |
| `-Unity <chemin>` | Unity.exe à utiliser ; sinon `UNITY_EXE` ; sinon la **6000.3 la plus récente** de `C:\Program Files\Unity\Hub\Editor\` (ou de l'emplacement choisi dans Hub) |
| `-Projet <dossier>` | autre dossier de projet (par défaut `unity\PortalRush`) |
| `-DelaiMinutes <n>` | durée maximale d'une étape (120 par défaut), puis arrêt de Unity |

Ce que le script affiche : la commande exacte, une ligne de suivi toutes les 30 s, le **code de sortie**, les
dernières erreurs **`error CS…`**, les causes connues (projet déjà ouvert, méthode introuvable, licence), le résumé
des tests (réussis / en échec, avec le nom des tests en échec), et pour le build la date et le contenu du
manifeste. Journaux et résultats : `unity/PortalRush/Logs/batch/` (ignoré par Git). Codes de sortie du script :
0 ; celui de Unity pour l'étape en échec ; 9 Unity introuvable ; 10 projet ouvert dans l'éditeur ; 11 projet
introuvable ; 124 délai dépassé. Il ne lance **aucune** commande Git et ne publie rien.

---

## 7. Avec Claude Code sur le PC

Claude Code installé sur le PC peut lancer Unity en mode batch, lire les journaux et corriger le code : c'est ce
qui manque à la session dans le nuage. L'ouvrir **à la racine du dépôt**, sur la branche
`claude/hopeful-ritchie-s4w21n`.

**À lui demander** (exemple de message) :

> Lis `CLAUDE.md`, `AGENTS.md`, `docs/UNITY_ARCHITECTURE.md` et `docs/UNITY_MIGRATION.md`. L'éditeur Unity est
> fermé. Lance `powershell -ExecutionPolicy Bypass -File outils\unity\unity.ps1 -Tout`, lis les journaux de
> `unity/PortalRush/Logs/batch/`, corrige les erreurs de compilation (`error CS…`) dans
> `unity/PortalRush/Assets/PortalRush/` en respectant le contrat (C# 9, assemblages, garde `PORTALRUSH_PAQUETS`),
> et relance jusqu'à ce que l'installation, la configuration, les 31 tests EditMode et le build passent. Si tu
> touches à `Scripts/Coeur/`, relance `dotnet run -c Release` dans `outils/unity/coeur-tests` et
> `node --experimental-strip-types --no-warnings outils/unity/exporter-donnees.mjs --verifier`. Montre-moi le
> résultat avant tout commit.

Utile aussi : lui faire lire `%LOCALAPPDATA%\Unity\Editor\Editor.log` (journal de l'éditeur ouvert à la main)
quand une erreur survient dans l'éditeur, et lui faire mettre à jour le README, `docs/SESSION_HANDOFF.md` et
`docs/PROJECT_REQUIREMENTS.md` après chaque lot (consignes d'`AGENTS.md`). Le rejeu .NET demande le **SDK .NET 8**
(gratuit) sur le PC.

**Ce qu'il ne doit pas faire** :

- publier ou déployer (Netlify ou autre), ni modifier `netlify.toml` / la CSP sans l'accord de Mathéo ;
- commiter ou pousser sur `main`, fusionner une branche, accepter une pull request ;
- utiliser un service payant (Asset Store payant, Unity Cloud Build, minutes GitHub Actions payantes…) ou
  installer quoi que ce soit sans accord ;
- changer de version de Unity, ou « corriger » le cœur C# pour faire passer un test (un écart avec le jeu web est
  une vraie erreur à comprendre) ;
- supprimer des fichiers suivis par Git ou des anciennes mémoires du projet.

---

## 8. Option non activée : construction automatique sur GitHub (GameCI)

**Rien n'est mis en place** (aucun dossier `.github/`). Cette option exige **l'accord explicite de Mathéo**.

- **Principe** : à chaque envoi sur GitHub, une machine de GitHub Actions lance Unity dans un conteneur (actions
  libres de **GameCI** : `game-ci/unity-test-runner`, `game-ci/unity-builder` avec `targetPlatform: WebGL`) et
  rend le build en « artifact » **[source S23]**.
- **Coûts** : le dépôt est **privé** **[exécuté]**. GitHub Free inclut **2 000 minutes par mois** et **500 Mo**
  de stockage d'artifacts pour les dépôts privés ; au-delà, Linux 2 cœurs à **0,006 $ / minute** ; **sans moyen de
  paiement enregistré, l'usage est bloqué** une fois le quota épuisé (pas de facture surprise) **[source S24]**.
  Une construction Unity Web prend probablement 15 à 40 minutes **[hypothèse]**, soit quelques dizaines de builds
  par mois au mieux ; les machines standard n'ont que **14 Go de disque** **[source S24]**, juste pour une image
  Unity **[hypothèse]**.
- **Données sensibles** à confier à GitHub comme « secrets » **[source S23]** : `UNITY_LICENSE` (contenu du fichier
  de licence `.ulf`, sous Windows `C:\ProgramData\Unity\Unity_lic.ulf`), `UNITY_EMAIL` et **`UNITY_PASSWORD`** du
  compte Unity. GameCI dit ne pas les conserver, mais c'est le mot de passe du compte qui part sur GitHub.
- **Conclusion** : utile plus tard pour vérifier chaque envoi ; inutile tant que le PC suffit. À ne mettre en place
  qu'à la demande de Mathéo, avec lui pour les secrets.

---

## 9. Sources

Pages consultées le 18 octobre 2026 (les serveurs de Unity étant bloqués ici, leur contenu a été lu par un service
de recherche ; les URL sont celles des pages officielles).

- **S1** Unity 6.3 LTS : <https://unity.com/blog/unity-6-3-lts-is-now-available>
- **S2** Support de Unity 6 : <https://unity.com/releases/unity-6/support>
- **S3** Licences : <https://unity.com/products/unity-personal> ; conditions (seuils) :
  <https://unity.com/pages/license-compliance> ; changements de 2024 : <https://unity.com/products/pricing-updates> ;
  plans (dont Student) : <https://unity.com/products>
- **S4** Unity Hub : ajouter des modules <https://docs.unity.com/en-us/hub/add-modules> ; gérer les projets
  <https://docs.unity.com/en-us/hub/project-manage> ; module Web Build Support
  <https://learn.unity.com/tutorial/publish-on-unity-play>
- **S5** Web (6000.3) : API graphiques
  <https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/develop/graphics> ; WebGL2
  <https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/develop/graphics/web-gl2> ; exigences
  URP <https://docs.unity.com/en-us/engine/6000.3/manual/render-pipelines/universal-render-pipeline/requirements> ;
  comparaison des pipelines
  <https://docs.unity.com/en-us/engine/6000.3/manual/render-pipelines/choose-a-render-pipeline/feature-comparison>
- **S6** WebGPU (6000.3) : <https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU.html> ; activation
  <https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU-enable.html> ; limites
  <https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/develop/graphics/web-gpu/limitations> ;
  fonctions (compute, VFX Graph)
  <https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/webgl/develop/graphics/web-gpu/features>
- **S7** Forward+ et Chrome (fiche Unity) :
  <https://issuetracker.unity.com/issues/13594/urplit-and-urpsimple-lit-and-shaders-based-on-these-do-not-render-in-webgl-player>
- **S8** Chemins de rendu URP : <https://docs.unity3d.com/Manual/urp/rendering-paths-comparison.html>
- **S9** MSAA sur WebGL (UUM-90459, corrigé dans 6.3) :
  <https://issuetracker.unity.com/issues/19838/scene-is-not-rendered-and-renderpass-errors-in-webgl-when-msaa-is-enabled-on-urp-asset-and-the-camera-or-overlay-camera-stacking-is-used>
- **S10** VFX Graph et WebGL (UUM-27156) : <https://issuetracker.unity.com/issues/14504/vfx-is-not-rendering-when-in-webgl-build>
- **S11** GPU Resident Drawer (messages d'ingénieurs Unity) : <https://discussions.unity.com/t/gpu-driven-rendering-in-unity/930675> ;
  <https://discussions.unity.com/t/unity-6-gpu-resident-drawer-gpu-occlusion-cullling-with-webgl-and-gpu-instancing/1491870/4>
- **S12** Compression des textures (Web) : <https://docs.unity3d.com/6/Documentation/Manual/webgl-texture-compression.html> ;
  réglages du build Web <https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/building-distribution/web-build-settings> ;
  formats par plateforme <https://docs.unity.com/en-us/engine/6000.0/manual/materials-and-shaders/textures/textures-getting-started/texture-compression-formats/texture-formats-reference>
- **S13** Déployer un build Web (compression, repli, en-têtes) : <https://docs.unity3d.com/6000.1/Documentation/Manual/webgl-deploying.html>
- **S14** Netlify, en-têtes personnalisés (liste des en-têtes ignorés) : <https://docs.netlify.com/manage/routing/headers> ;
  avis contraire [communauté] : <https://gist.github.com/marcusx2/959908bccde199bf75eb2c39683bb37c>
- **S15** CSP et Unity [communauté] : <https://discussions.unity.com/t/minimal-content-security-policy-csp-for-webgl-builds/950829> ;
  <https://bits.dividat.com/2022/strictest-content-security-policy-for-unity-games/> ;
  <https://gamedev.stackexchange.com/questions/211329/minimal-content-security-policy-csp-for-webgl-builds>
- **S16** Mémoire : <https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/develop/memory> ;
  <https://docs.unity3d.com/6000.6/Documentation/ScriptReference/PlayerSettings.WebGL-maximumMemorySize.html> ;
  <https://docs.unity3d.com/ScriptReference/PlayerSettings.WebGL-initialMemorySize.html>
- **S17** Navigateurs (6000.3) : <https://docs.unity3d.com/6000.3/Documentation/Manual/webgl-browsercompatibility.html> ;
  optimisation mobile <https://docs.unity3d.com/6000.3/Documentation/Manual/web-optimization-mobile.html>
- **S18** Entrées sur le Web : <https://docs.unity3d.com/Manual/webgl-input.html> ;
  <https://docs.unity3d.com/6000.0/Documentation/ScriptReference/WebGLInput-captureAllKeyboardInput.html>
- **S19** Ligne de commande de l'éditeur : <https://docs.unity.com/en-us/engine/6000.0/manual/unity-editor/command-line-arguments/editor> ;
  `-batchmode`, `-nographics`, `-buildTarget` : <https://docs.unity.cn/6000.1/Documentation/Manual/EditorCommandLineArguments.html>
- **S20** Test Framework en ligne de commande : <https://docs.unity3d.com/Packages/com.unity.test-framework@1.4/manual/reference-command-line.html>
- **S21** Codes de sortie des tests [communauté] : copie de `Executer.cs` (Test Framework 1.1.22)
  <https://gitlab.cas.mcmaster.ca/palanicv/3xa3__l01_gr16_project/-/blob/77af86af0e4f8cad3f0f5f3cce4d98ecde909fbf/src/Library/PackageCache/com.unity.test-framework@1.1.22/UnityEditor.TestRunner/CommandLineTest/Executer.cs> ;
  `-quit` et `-runTests` : <https://discussions.unity.com/t/why-does-the-quit-cli-option-prevent-tests-from-running/899854>
- **S22** Activer une licence Personal dans Hub (GameCI) : <https://game.ci/docs/github/activation/>
- **S23** GameCI, construction : <https://github.com/game-ci/documentation/blob/main/docs/03-github/04-builder.mdx>
- **S24** GitHub Actions : facturation <https://docs.github.com/en/billing/concepts/product-billing/github-actions> ;
  tarifs <https://docs.github.com/en/billing/reference/actions-minute-multipliers> ; machines
  <https://docs.github.com/en/actions/reference/runners/github-hosted-runners>
- Code source public lu **[code]** : `Unity-Technologies/UnityCsReference` (branche 6000.3) et le paquet URP 17.3.0
  (`ForwardLights.cs`, `UniversalRenderer.cs`, `UniversalRenderPipelineCore.cs`), copies hors du dépôt.
