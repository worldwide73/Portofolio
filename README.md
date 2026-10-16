> **POINT ACTUEL — 16 octobre 2026 (Claude Code Cloud) : refonte de la navigation par destinations.** Ce bloc remplace, pour la navigation, tout ce qui est écrit plus bas (menu des cinq sections, fil des sections, flèches ← → entre sections, « pas de vue recruteur »). Branche de travail : `claude/hopeful-ritchie-s4w21n` (rien dans `main`, rien en ligne).
>
> **Le principe** : le portail sert à voyager entre les grandes destinations, la molette à explorer la destination affichée, le fil du bas à passer d'un chapitre à l'autre de cette destination.
>
> | Élément | Rôle | Fichiers |
> |---|---|---|
> | Destinations | Accueil, Compétences, Réalisations, Veille, Contact : une seule affichée à la fois (`html[data-lieu]`, posé dès le `<head>` d'après l'adresse) ; la molette s'arrête à la fin de la destination. Adresse `#competences`…, bouton « précédent » du navigateur (retour au même endroit), lien direct, refresh = accueil + intro (inchangé). Saut Accueil ↔ Contact conservé. | `public/avant.js`, `src/scripts/voyage.ts`, `src/styles/destinations.css` |
> | Barre du haut | Même pastille de verre, trois outils : **Portail** (blanc au repos), **Rechercher**, **Visite rapide**. Téléphone : dans le menu plein écran. | `Chrome.astro`, `src/scripts/nav.ts` |
> | Bouton Portail | Ouvre la carte du portail **existante** (aucune modification de la carte ni du grand portail). Grand portail à l'écran : il se brise comme avant. Ailleurs : le bouton s'allume, tremble, se fissure, se brise en éclats, puis une ouverture lumineuse aspire vers le centre où la constellation se forme (~0,8 s, son discret, clics répétés ignorés, version directe en mouvement réduit). Fermer la carte sans choisir : même destination, même position. Touche **P**. Depuis une fiche : retour à l'accueil (`?portail`) et ouverture. | `src/scripts/portail.ts`, `sons.ts` (`sonPortailBouton`) |
> | Recherche | Ctrl/Cmd + K ou bouton. Index construit au build à partir du contenu réel (réalisations, compétences, référentiel BTS, méthode, parcours, veille, contact, CV, Portal Rush). Résultat → destination et chapitre (note de veille ouverte, projet amené de face dans la galerie). États vides, ↑ ↓ Entrée Échap, focus restitué. Le terminal caché garde ² et « trace ». | `Recherche.astro`, `src/scripts/recherche.ts` |
> | Visite rapide | Profil, réalisations (7), compétences, parcours, CV (ouvrir / télécharger), contact, sans animation secondaire ; Échap ou « Revenir au mode immersif ». **Décision remplacée** : le « mode recruteur » retiré le 14 octobre est remplacé par cet outil, demandé le 16 octobre. | `VisiteRapide.astro`, `src/scripts/rapide.ts` |
> | Fil du bas | Même dessin ; il montre les chapitres de la destination : Accueil (Intro, Méthode, Parcours, Explorer), Compétences (5 domaines + tableau BTS), Réalisations (les 7 projets, synchronisé avec la galerie 3D, sans second contrôleur), Veille (les notes), Contact (Présentation, Coordonnées, Crédits). État « Destination · 02 / 04 ». Flèches ← → = chapitre précédent/suivant. | `src/scripts/fil.ts`, `data-chapitre-*` dans `PageAccueil.astro` |
> | Fins de destination | Accueil : chapitre 4 « L'exploration ne fait que commencer. » + « Rejoindre le portail » (remonte au grand portail et l'ouvre, sans second clic). Autres destinations : une phrase et « Traverser le portail » (le bouton cliqué se brise). | `Suite.astro` |
> | Menu d'identité | Mon CV (+ Télécharger), Mon LinkedIn, Mon GitHub, Copier mon e-mail (+ Écrire), Partager le portfolio (adresse publique de la page et de la destination), Commandes clavier (P, Ctrl+K, ← →, Échap, ?, ²). Aucune destination répétée. | `Chrome.astro`, `acces.ts`, `fr.ts`/`en.ts` |
>
> **Inchangés (vérifié par `git diff`)** : grand portail et shaders (`gl/`), carte du portail (`explorateur.ts`, `Explorateur.astro`, `explorateur.css`), saut (`saut.ts`), Orbital Hub (`OrbitalHub.astro`, `hub.css`, `jeu.css`), constellation des réalisations, dunes. Seule retouche technique de la scène : son rendu est suspendu pendant la visite rapide (`champ.ts`). Galerie : rotation, survol, clic inchangés ; ajout d'un évènement `galerie` (carte de face) et d'une demande `galerie-aller`, et l'entrée en balayage part quand la galerie devient visible. Portal Rush : « Quitter » ramène toujours en haut de l'accueil (`revenirAccueil`). Assistant Orbit : « Six réalisations » corrigé (il y en a sept), « carte » et la visite « Libre » passent par le bouton Portail.
>
> **Tests réellement exécutés (conteneur cloud, Chromium 141, rendu WebGL logiciel ≈ 5 images/s)** : `npm run build` (18 pages) ; nouvelle recette `outils/recettes/navigation-destinations.mjs` **19/19** (accueil sans passage à Compétences, Rejoindre le portail, carte → Réalisations, molette, fil → projet, cassure du bouton puis carte unique, fermeture = même position, clics répétés, P → Contact → crédits, précédent du navigateur, recherche réelle et vide, visite rapide, menu d'identité, FR → EN sans rechargement, Portal Rush sans conflit de touches, mouvement réduit, téléphone 390 px, zéro exception JS) ; `saut-ambiances.mjs` et `icone-orbit.mjs` réussies ; `corrections-ciblees.mjs` 21/21 (deux assertions « défilement > 500 px » remplacées par « destination Réalisations affichée », seul changement voulu). Si une recette importe un module par son adresse (`/src/scripts/…`) après une modification du code, redémarrer le serveur de dev avant de conclure. Animation de cassure examinée image par image (horloge ralentie). **Non testé** : fluidité réelle avec carte graphique, son à l'oreille, vrai téléphone. Les recettes antérieures qui supposaient une page continue (positions de défilement entre sections) ne décrivent plus le comportement voulu.

> **16 octobre — derniers réglages de vitesse demandés.** Intro −0,2 s par rapport au lot précédent : réduction cumulée 1,7 s ; 3 957 ms mesurées avec Playwright GPU. Saut Accueil ↔ Contact en Chill : multiplicateur local 1,1, soit environ 10 % plus rapide ; intro et autres ambiances indépendantes. Durée transmise au son et au fil ajustée au même multiplicateur. Fichiers : intro.ts, saut.ts, voyage.ts. Tests : duree-intro.mjs réussi ; saut-ambiances.mjs (12 trajets, origine/Focus/Chill, normal/réduit, aller/retour + animations coupées) réussi sans exception JS ; build 18 pages réussi. Ces valeurs remplacent les précédentes ci-dessous.

> **16 octobre — durée intro rétablie à la demande de Mathéo : +0,5 s.** Réduction cumulée de la partition revenue à 1,5 s (remplace la valeur 2 s ci-dessous). Mesure Playwright avec GPU : 4 120 ms (`outils/recettes/duree-intro.mjs`). Première mesure sans les arguments GPU non exploitable : assertion échouée ; relance GPU réussie. Seule la vitesse de l’intro a changé, aucun effet retiré. La cinématique Accueil ↔ Contact reste inchangée : 0,6 s + 0,55 s nominales, rythme global préexistant dépendant de l’ambiance (Chill 0,85 ; Focus 1,5). Pas de modification de ce rythme dans ce lot. Seuil de recette trois-corrections adapté à la nouvelle durée.

> **16 octobre — transition Accueil ↔ Contact en Focus : corrigée et testée.** La cinématique existait toujours mais voyage.ts exigeait ambiance.eclats >= 0.3 ; Focus donne 0. Absence reproduite dans les deux sens avant correction. Ce filtre d’ambiance est retiré : animations complètes = saut dans les deux sens, quelle que soit l’ambiance. Les animations allégées/coupées et prefers-reduced-motion restent respectées. Recette `outils/recettes/saut-ambiances.mjs` : 8 trajets origine/Focus × normal/réduit × aller/retour, déclenchement de la toile, destination et nettoyage vérifiés ; animations coupées aussi testées ; aucune exception JS. Build 18 pages réussi. Diagnostic avant : `outils/recettes/diagnostic-saut.mjs`. Aucun réglage utilisateur changé dans son navigateur.

> **Correctif du 16 octobre — icône Orbit invisible en Focus.** La règle `html[data-atmosphere="focus"] .jeu-bouton { display:none }` masquait le Hub, même après rechargement puisque le réglage persiste. Règle retirée de `src/styles/reglages.css`, sans changer l’icône. Recette `outils/recettes/icone-orbit.mjs` : visibilité et ouverture/fermeture dans les quatre ambiances, Focus après reload, animations normales/réduites (10 contrôles OK, zéro exception JS). Build Astro 18 pages réussi. La dissimulation temporaire pendant intro/menu/carte reste normale.

> **POINT ACTUEL — 16 octobre 2026 : trois corrections ciblées terminées.**
> - Intro : encore −0,5 s (réduction cumulée 2 s de la partition), 3 574 ms observées cette fois.
> - Lame penchée : bug reproduit avant correction. Le pointeur global enregistrait sourisY=3,894 pendant que le canvas était hors écran ; cette visée persistait au retour. Les coordonnées sont désormais bornées, les mouvements hors écran ignorés et la visée/lissage recentrés quand la scène redevient visible. Les petites oscillations voulues sont conservées.
> - Panneau Orbital Hub : 390 × 560 px au lieu de 420 × 650, adapté aux écrans courts ; icône extérieure inchangée (40 × 40).
> - Vérification du lot : `node outils/recettes/trois-corrections.mjs`, deux modes de mouvement, retours depuis Réalisations/Compétences/Contact, flèche gauche, visite aller-retour, réponse assistant et panneau mobile 390 px. Aucune exception JS. Captures avant/après examinées ; `npm run build` réussi (18 pages). Rapport `captures/ciblees/trois-corrections.json`. Aucun test sur téléphone physique.
> - Serveur : http://127.0.0.1:4321/ ; les anciennes mesures ci-dessous restent historiques. Aucun paquet installé.

> **État actuel — 15 octobre 2026, corrections ciblées terminées**
>
> Les notes ci-dessous sont historiques. Le bilan actuel est dans [docs/CORRECTIONS_CIBLEES_2026-10-15.md](docs/CORRECTIONS_CIBLEES_2026-10-15.md), avec la liste des fichiers, les preuves et les limites.
>
> - **Orbit extérieur** : bouton Claude original restauré et comparé à la sauvegarde ; cercle de 40 px, symbole seul. Intérieur amélioré, réponses documentées plus complètes, comparaison et suivi des projets, visites avec des actions utiles. Pas d’IA distante.
> - **Projet portfolio** : vraie capture complète de l’accueil (`src/assets/projets/portfolio-accueil.jpg`), nom et navigation conservés dans la vignette ; description utile en FR/EN. Même capture dans la galerie, la fiche et la Constellation.
> - **Intro** : encore 0,5 s de moins, soit 1,5 s cumulées ; environ 4,2 s observées depuis son activation. Le refresh de l’accueil repart en haut et rejoue l’intro, sauf mouvement réduit. Skip fonctionne.
> - **Portail** : correction du survol persistant et du focus restitué après fermeture. Les clics rapides, souris, clavier, retour navigateur et déplacements hors portail ont été testés.
> - **Constellation** : sept projets, filtres par compétences réellement documentées, aperçus, liens entre réalisations et technologies communes. Portal Rush reste distinct du référentiel BTS.
>
> **Validation** : 21/21 contrôles ciblés réussis, vérifications complémentaires dans `captures/ciblees/finitions.json`, captures réellement examinées, build Astro réussi (18 pages). Les vues à 320/390 px sont émulées, pas testées sur un téléphone physique. Aucun score Lighthouse ni audit global complet annoncé.
>
> **Localhost** : `http://127.0.0.1:4321/` ; démarrer avec `npm run dev -- --host 127.0.0.1 --port 4321`, arrêter avec `Ctrl+C` dans son terminal. Changements locaux répercutés par Astro. Recettes : `node outils/recettes/corrections-ciblees.mjs` et `node outils/recettes/finitions-ciblees.mjs`. Aucune modification de source pendant les tests. Les recettes forcent `no-preference` pour le mouvement normal et testent également `reduce`.
>
> **Préservation** : deux dunes originales inchangées (empreintes vérifiées), aucune installation/publication. Archive intégrale `.backups/avant-codex-20261015-170633.zip` : 10 537 fichiers, CRC vérifié, manifeste JSON. Les consignes communes restent dans `AGENTS.md` et `CLAUDE.md`.
>
> **En attente, hors de ce lot** : mission globale antérieure, configuration des Skills/outils, responsive général, textes personnels à compléter. La dernière demande imposait de travailler uniquement sur les corrections ci-dessus. Les corrections de stockage/JSON-LD/micro et les crédits commencés avant cette restriction sont conservés ; leur audit général reste distinct.

# Portfolio de Mathéo Maleyran (v2)

Ce fichier grandit à chaque phase. Il contient pour l'instant : comment lancer le projet, à quoi sert chaque fichier, et le journal des décisions. Les sections « chaque animation expliquée », « glossaire » et « questions de jury » seront écrites à la phase 5, quand le site sera figé.

> État au 13 octobre 2026 : **aperçu de la phase 1**, direction visuelle approuvée par Mathéo (« là j'aime bien »), ajouts en cours. Rien n'est en ligne.
>
> **Note de reprise, 13 octobre 2026 au soir (deuxième ordinateur).** Les trois fichiers « écrits mais pas branchés » de la section ci-dessous sont maintenant branchés et vérifiés (thème clair, apparitions, détails), et les animations demandées sont en place : étoile filante, voiles de sable, lame qui pivote au clic et réagit au défilement, entrée en balayage de la galerie, compteur qui roule, curseur fantôme. Mathéo a ensuite demandé de **terminer tout ce que prévoit la demande d'origine** (`PROMPT_PORTFOLIO_CLAUDE_CODE.md`, phases 2 à 5) sans arrêt intermédiaire, ses améliorations venant après. Seule la mise en ligne reste soumise à son accord. Ce README sera réécrit en entier à la fin de ce travail ; tant que cette note est là, la section « Où on en est exactement » décrit l'état d'AVANT cette reprise.
>
> **POINT DE REPRISE, 15 octobre 2026, matin (à lire en tout premier ; il complète le point de fin de nuit, juste en dessous).**
>
> *Deuxième liste de Mathéo (ordinateur d'abord ; le téléphone reste noté pour plus tard) :*
> - **Lames de verre partout, par défaut** (`tokens.css`, `reglages.css`, `base.css`) : l'ancien thème « verre » (retiré le 14 octobre avec le bouton de thème) redevient LE style du site, sans bouton : paysage du hero flouté derrière toute la page, sections À propos / Compétences / Veille en panneaux de verre fumé, filets bleu glacier. Le hero garde ses couleurs. **Réglages d'origine : panneaux à 25 % d'opacité, flou à 5 %** (clé de mémorisation passée à `reglages-5` : les anciens réglages enregistrés ne sont pas repris).
> - **Carte du portail** (`explorateur.ts`) : les amas sont posés sur les côtés de leur planète, à 80–120 px (avant 36–62 px, collés) ; éclats répartis sur toutes les orbites, milieu compris, en moindre nombre (cube cassé en 12 rayons au lieu de 14, trois éclats par planète, trois autour du noyau, 16 grains de poussière au lieu de 46).
> - **Lame penchée au retour sur l'accueil** (`champ.ts`, `defilement.ts`) : sa bascule suit la vitesse du défilement ; cette vitesse pouvait rester figée (scène en pause hors de l'écran, ou vitesse périmée de Lenis après un saut immédiat). Elle repart de zéro quand la scène réapparaît, et n'est lue que pendant un vrai défilement. (Bug intermittent : correction raisonnée, pas reproduit à coup sûr avant.)
> - **Intro plus longue et non interruptible** (`intro.ts`) : environ 2 s de plus (6 s mesurées jusqu'à l'accueil) ; seul le bouton « Passer » l'interrompt ; clic, touche, molette et clic sur le portail n'y font plus rien, et la page ne défile pas pendant ce temps.
> - **Son de la première intro** (`sons.ts`, `sonIntro`) : toujours joué à **5 %**, même effets coupés ; les autres sons restent réglables. Limite des navigateurs : sans geste préalable du visiteur, le son ne peut pas démarrer ; le premier clic ou la première touche pendant l'intro le débloque.
> - **Changement de langue** (`langue.ts`) : voile un peu moins sombre (contenu à 42 % au lieu de 30 %) et transition plus longue (1,3 s au lieu de 0,46 s ; 1,66 s essayé d'abord, jugé un peu lent). J'ai compris la « poussière noire » comme ce voile : aucune autre poussière n'apparaît pendant le changement.
> - **Curseur** (`chrome.css`) : blanc et lumineux partout (halo), plus d'inversion des couleurs qui le rendait beige sur les images des projets ; un liseré sombre très fin le garde lisible sur le panneau clair du contact.
> - **Menu du nom, en haut à gauche → panneau d'actions rapides** (`Chrome.astro`, `acces.ts`, `identite.css`) : il ne répète plus les catégories du site. Il propose Mon LinkedIn et Mon GitHub (URL réelles du bloc contact, nouvel onglet, `rel="noopener noreferrer"`), Télécharger le CV (le vrai PDF), Partager le portfolio (copie `https://matheomaleyran.com/`, confirmation « Lien copié », secours si le presse-papiers est indisponible : l'adresse s'affiche, sélectionnée), Contact rapide (copier l'e-mail réel, ou Écrire en `mailto:`), Raccourcis clavier (une fenêtre qui liste seulement les raccourcis qui existent dans le code ; la touche « ? » l'ouvre aussi). Pas de « Recruiter View » : le mode recruteur a été retiré le 14 octobre (Mathéo), My LinkedIn le remplace. Recette `scratchpad/acces.mjs` : 34 sur 34 (ordinateur, téléphone en émulation, anglais).
> - **Contact refait + pied de page avec crédits** (`PageAccueil.astro`, `contact.css`, `contact.ts`, `saut.ts`, `nav.ts`, `voyage.ts`) : Contact n'est plus un panneau clair « à l'inverse du site » mais la dernière lame de verre (même verre, filets bleu glacier, lueur). Grand titre éditorial (« Parlons de votre prochain projet. » / « Let's talk about your next project. »), repère « Contact · 05 / 05 », l'e-mail en très grand (lien `mailto:`, « Écrire un e-mail », « Copier l'adresse » avec confirmation) et LinkedIn en tuile de verre ; puis téléphone, GitHub, CV ; ligne de disponibilité avec l'heure de Lyon. Le pied de page (sur le décor, sans panneau) : symbole et nom, « Portfolio, édition 2026 », crédits (Design et développement : Mathéo Maleyran, « conçu par moi, développé avec l'IA » ; Construit avec Astro, TypeScript, GSAP, WebGL (OGL), confirmé par le code), liens LinkedIn, GitHub, CV, coulisses, © année du jour (calculée au chargement), « Revenir en haut » (qui déclenche le grand retour Contact → Accueil, inchangé). Barre, fil et trait de progression ne passent plus en version claire sur Contact. Recette `scratchpad/contact.mjs` : 27 sur 27 (1440, 1280, téléphone en émulation, anglais).
> - **Titre de l'accueil sous le panneau « J'utilise l'IA… »** (`champ.ts`) : il s'efface en douceur dès que le panneau passe dessus (dégradé qui suit le bord du panneau, léger flou, petite élévation) ; rien ne transparaît sous le verre.
>
> **POINT DE REPRISE, 15 octobre 2026, fin de nuit (il complète le point de la nuit, juste en dessous).**
>
> *Consigne de Mathéo : « fais la version parfaite sur PC, on s'occupera de la version téléphone plus tard, mais note les soucis ».* Tout ce qui suit a été vérifié sur ordinateur (Playwright, vraie carte graphique) ; le téléphone attend.
> - **Encart « Création à la une »** (`vitrine.ts`, `accueil.css`) : plus petit (179 × 107 px au lieu de 352 × 219) ; une fois l'entrée de page finie, un trait blanc se vide dessous en **4 secondes** avec un compte à rebours (4s, 3s, 2s, 1s), puis l'encart part (il revient au prochain chargement) ; pause tant que la souris ou le clavier sont dessus, quand l'onglet est caché et pendant une partie.
> - **Le jeu bouge** (`rush/scene/parcours.ts`, shaders dans `materiaux.ts`) : le moteur garde trois voies droites (difficulté et collisions inchangées), mais tout le monde 3D est plié à l'image : **virages, montées et descentes, dévers** dans les virages ; la caméra vise dans la courbe et se penche ; ciel, planètes et soleil pivotent avec le cap. Équité vérifiée par le calcul (`scratchpad/relief.mjs`) : les reliefs sont asymétriques (creux marqués, sommets doux) pour qu'un sommet ne cache jamais la piste avant 140 m (la distance d'apparition maximale), et les virages restent assez larges pour que la ligne de vue reste sur la piste jusqu'à 100 m. Plus doux en mouvement réduit (sans dévers).
> - **Vaisseau refait** (`modeles.ts`) : même taille, beaucoup plus de détails (fuselage à 11 sections, lignes de panneaux, bandes de course de la couleur d'Overdrive, verrière à arceaux, sonde et capteurs, ailerons, nacelles sous les ailes, deux dérives, entrées d'air à aubes, tuyères à volets, grilles, antenne, trappes, **feux qui clignotent**).
> - **Fonds** : Voie lactée et étoiles fines de couleurs variées, deux galaxies lointaines ; planètes qui tournent, **lumières des villes** sur la face de nuit, reflet du soleil sur les océans, tempête sur la géante gazeuse, cratères ; **trafic lointain** (cargos à conteneurs, un vaisseau amiral à hublots) dans six mondes sur huit.
> - **Overdrive deux fois plus long à gagner** (`equilibrage.ts`, règles **version 4**) ; scores cibles des étoiles recalculés (80 % de la médiane du pilote simulé expert ; secteurs 4 et 5 : × 0,86, car le pilote simulé ne vise ni les esquives parfaites ni les portails).
> - **Séquence de fin de niveau** : victoire (3,4 s) = bandes de cinéma, « Secteur terminé », la caméra tourne autour du vaisseau au ralenti, tonneau, Overdrive, traversée d'une **porte d'arrivée** à damier dans un éclair blanc, puis les étoiles ; échec (1,3 s) = le monde ralentit, la caméra recule. Entrée, Espace, Échap (repère « Passer ») ou un clic la passent. Sans animations : résultats après 0,9 s, comme avant.
> - **Aide Orbit retirée du jeu** (entrée « Aide (Orbit Assistant) » du menu pause). L'option « Afficher les commandes pendant la course » reste (ce n'est pas Orbit).
> - **Quitter le jeu ramène toujours en haut de l'accueil** (choix de Mathéo, 15 octobre ; avant : la même position). Depuis une fiche, on part vers l'accueil.
> - **Orbital Hub resserré** (`hub.css`) : 384 × 520 px au lieu de 430 × 620 ; une seule échelle (commandes de 32 à 36 px, textes de 0,72 à 0,8 rem) ; onglets plus grands, deux par deux, « Jouable » écrit sur Portal Rush ; rien ne dépasse du cadre (avant : « Fermer », « Envoyer » et le 4e onglet étaient coupés).
>
> *Téléphone : soucis notés, à reprendre plus tard (Mathéo).* Sur téléphone court (375 × 667, 320 × 568), l'indication « Explorer le portfolio » chevauche le titre de l'accueil et le titre passe sur la lame ; en téléphone couché (844 × 390), tout l'accueil se superpose à la lame ; la pastille « Création à la une » (sous l'en-tête) frôle le haut de la lame à 320 × 568 ; vérifier le hub, le jeu (HUD, séquence de fin, bandes de cinéma) et l'encart minuté sur un vrai téléphone.
>
> **POINT DE REPRISE, 15 octobre 2026, nuit (il complète le point du 14 au soir, juste en dessous).**
>
> *Portal Rush : les quatre demandes du 14 au soir sont faites (Playwright, vraie carte graphique ; simulations ≠ tests humains)* :
> - **Ouverture et fermeture** : depuis le bouton cliqué (icône du hub ou bouton « Jouer »), onde, particules qui convergent, assombrissement, puis le portail s'ouvre au centre et la caméra recule (1,5 s en tout) ; la fermeture (0,66 s) se referme dans le noyau du vaisseau et rend le portfolio à la même position. Icônes Records (trophée) et Réglages (roue) en haut à droite, avec infobulles ; panneau de réglages par-dessus l'écran (onglets Audio, Affichage, Commandes ; Échap le ferme sans relancer une partie en pause) ; écran Records (état vide « lancer ma première partie ») ; CONTINUER au centre ; Entrée / Espace selon le contexte (Espace reste l'Overdrive en course).
> - **Refonte esthétique** (direction « PR-OS ») sans toucher aux décors : Geist italique (police déjà installée), plaques chanfreinées, onglets, interrupteurs et curseurs dessinés pour le jeu ; **sélecteur de langue** en haut à droite (le drapeau du portfolio, FR / EN sans rechargement, partie conservée) ; meilleur score plus petit et à au moins 56 px des bords ; repère **« Échap · Quitter »** en haut à gauche (son libellé suit le contexte ; confirmation quand une progression serait perdue). Recette `rush-ui3.mjs`.
> - **Fluidité et vraie piste en mouvement** : le rendu est interpolé entre deux pas du moteur (120 pas par seconde) : images sans avance visible de la course, 6 068 sur 6 668 avant, moins de 10 après (`fluidite.mjs`, `fluidite-apres.mjs`). La piste est faite de tronçons de 48 m replacés à chaque image d'après cette distance ; tout ce qui donne la vitesse est attaché à la coordonnée de piste (lignes de voie en tirets, joints lumineux, renforts, plots de bordure tous les 3 m) ; lignes de vitesse ; en Overdrive les tirets s'étirent, le champ de vision s'ouvre, les lignes se densifient. **Couloirs effondrés** : la piste est réellement percée (découpe dans le shader) au-dessus d'un gouffre modélisé (fond fissuré, parois nervurées, poutres, plaques pendantes) ; avant, ils étaient construits sous les plaques et seuls leurs halos rouges se voyaient (sans doute le « sol rouge immobile »). Ligne de guidage supprimée. **Collecte de l'énergie bleue** : le cristal est aspiré vers le noyau, un anneau part, un trait file jusqu'à la jauge, qui pulse (une seule fois par collecte). Gouffres préparés pendant le compte à rebours (fini l'accroc de 54 ms).
> - **Mise en valeur sur le portfolio** : encart « Création à la une » dans l'accueil (plaque de verre à droite sur ordinateur, pastille sous l'en-tête sur tablette et téléphone) ; Portal Rush en **première carte des Réalisations** (repère « Jouable », bouton « Jouer à Portal Rush » qui ouvre le jeu sans ouvrir la fiche) ; fiche `/realisations/portal-rush/` et `/en/work/portal-rush/` avec bouton Jouer (image : vraie capture du jeu) ; repère « Jouable » sur l'onglet de l'Orbital Hub. Le jeu est **hors référentiel BTS** (`horsReferentiel`) : absent du tableau de compétences, du CSV, des filtres et de la constellation. « Ce que j'en retiens » reste `[À COMPLÉTER]` : c'est à Mathéo de l'écrire. Recette `vitrine.mjs`.
> - **Corrigé au passage** : le titre des fiches projet restait invisible jusqu'au premier défilement (`titres.ts`, déclencheur sans `clamp()`) ; compteur de la galerie écrasé sur deux lignes à 390 px de large ; rayon négatif (erreur console) dans l'animation de passage.
>
> *Restes connus, non corrigés (antérieurs à ces demandes)* : sur téléphone court (375 × 667) l'indication « Explorer le portfolio » chevauche le titre de l'accueil ; en téléphone couché (844 × 390) l'accueil entier se superpose à la lame. Aucun test humain ni sur un vrai téléphone (émulation seulement).
>
> **POINT DE REPRISE, 14 octobre 2026, soir (il complète les points de l'après-midi, juste en dessous).**
>
> *Portal Rush, terminé et vérifié (Playwright, vraie carte graphique ; simulations ≠ tests humains)* :
> - **Difficulté refaite** (règles **version 3**) : tous les chiffres dans `rush/equilibrage.ts` (anciennes valeurs en en-tête) ; quatre courbes séparées (vitesse, écart, réaction, complexité) ; 4 difficultés aux profils distincts ; générateur par motifs, **justice vérifiée sur 28 363 rangées** (`scratchpad/rush-moteur2.mjs`) ; défi du jour identique pour tous ; records locaux avec la version des règles (pas de classement en ligne : aucun serveur).
> - **Interface arcade** : menu (Continuer, Campagne, Survie, Défi, Records, Garage, Réglages, vraies statistiques), carte de campagne, préparation, verrou de Nightmare (réussir un secteur en Expert), HUD, pause (Recommencer confirmé, reprise après compte à rebours), fin et victoire distinctes, garage (15 pièces, conditions réelles), réglages du jeu. Recette `scratchpad/rush-ui2.mjs` : **59 sur 59**.
> - **Vraie 3D** (`rush/scene/` : `geometrie.ts`, `materiaux.ts`, `modeles.ts`, `mondes.ts`, `mondes2.ts`, `kits.ts`, `scene.ts`) avec **OGL, déjà présent dans le projet (rien installé)** : caméra en perspective, maillages en volume construits en code (aucun modèle téléchargé), matières (métal, verre, alliage, émission), soleil, brouillard, ciel procédural, planètes ; piste recyclée par tronçons de 48 m ; **huit mondes à l'architecture propre** (station de lancement, couloirs néon, ceinture d'astéroïdes, tranchée laser, arches de cristal, station éventrée dans la tempête, arène monumentale, trou noir) ; vaisseau modélisé (nez, cockpit, ailes, dérives, deux moteurs, feux), inclinaison au changement de voie, bouclier rouge au choc, Overdrive (moteurs, champ de vision) ; deux boss modélisés ; la survie traverse les huit mondes (un tous les 1 500 m). **60 images/s** sur ce PC, ordinateur et téléphone (`mondes3d.mjs`). Repli automatique sur l'ancien rendu 2D sans WebGL 2 (vérifié). Le code 3D (70 Ko) ne se charge qu'à l'approche du jeu.
> - **Étoiles** : 1 = terminer, 2 = score cible (≈ 80 % du score médian d'un pilote simulé expert, **par niveau et par difficulté**, `donnees.ts`), 3 = un objectif de maîtrise annoncé avant de jouer. Gardées par difficulté, jamais retirées ; carte de campagne avec **aperçus des mondes rendus par la scène 3D**, étoiles, meilleur score, récompenses réelles ; victoire avec étoiles animées.
>
> *Demande suivante de Mathéo (prompt « ANIMATIONS D'OUVERTURE/FERMETURE ET REFONTE DE L'INTERFACE DU MENU »), **faite depuis** (voir le point du 15 octobre)* : ouverture cinématographique depuis l'Orbital Hub (700 à 1 200 ms), fermeture plus courte qui revient au portfolio à la même position ; icônes Réglages (roue) et Records (trophée) en haut à droite ; panneau de réglages par-dessus le menu (Échap le ferme, ne relance pas une partie en pause) ; écran Records refait (records personnels par mode, niveau, difficulté ; état vide avec « lancer ma première partie ») ; bouton CONTINUER au centre ; Entrée / Espace selon le contexte (Espace reste l'Overdrive en course).
>
> **POINT DE REPRISE, 14 octobre 2026, après-midi (il complète le point d'étape du 14 octobre juste en dessous).**
>
> *Terminé et vérifié dans un vrai navigateur (Playwright, carte graphique réelle)* :
> - **Galerie des réalisations** (`galerie.ts`, `galerie.css`) : l'anneau 3D d'origine (cylindre, perspective 1700 px) a été **retrouvé dans l'historique de la conversation** après que Mathéo a refusé la bande plate du « lot 16 ». Rotation continue à **0,68 réalisation par seconde** (réglée par Mathéo, en quatre fois) ; **survol = ralentit à 40 %, sans s'arrêter** ; **clic gauche maintenu = arrêt**, glisser = tourner à la main, **relâcher = reprise** ; clic bref sur la carte de face = sa fiche ; clic sur une carte de côté = elle vient devant ; flèches et Tab = un pas exact ; **compteur « 02 / 06 » juste à chaque instant** ; jamais d'épinglage ni de molette retenue ; arrêt hors écran ; ruban au doigt sur téléphone ; pas de rotation en mouvement réduit. Recette `galerie2.mjs` : 25 vérifications sur 25.
> - **Carte du portail** : Mathéo la valide telle quelle (« ne la refais pas »). Ajouts demandés : **les six destinations tournent lentement autour du noyau** (0,075 rad/s, un tour en 84 s, profondeur : devant plus grand et plus vif), **le survol ralentit l'orbite à 12 % sans l'arrêter**, les liens, lignes et amas d'éclats suivent, les noms glissent autour de leur point et ne sortent jamais de l'écran ; **son de fermeture** (impulsion, aspiration, résonance, 0,55 s) au bouton « Fermer », au symbole du centre et à Échap (évènement `carte-referme`, `sons.ts`) ; **un clic dans le vide ne referme plus la carte**. Recette `orbite.mjs` : tout passe (ordinateur, sans son, mouvement réduit, téléphone).
>
> - **Un seul thème**, celui de base (sombre, panneaux de verre translucides) : le bouton de contraste, le choix « Apparence » des réglages, la commande `theme` et les styles des thèmes « verre » et « clair » sont retirés (`theme.ts` supprimé). Les réglages (opacité, flou, lueur, animations, sons, musique, ambiances) sont inchangés. **Pas de vue recruteur** : Mathéo n'en veut pas (14 octobre). Recette `theme-unique.mjs` : 15 sur 15.
> - **Orbital Hub** (`OrbitalHub.astro`, `hub.ts`, `hub.css`) : l'icône flottante en bas à droite (qui ouvrait l'ancien mini-jeu Portal Recovery, retiré) ouvre un panneau sur l'**Orbit Assistant** ; onglets Portal Rush, Explore My Universe (visites guidées de 3 à 4 étapes, flèches ← → pour passer d'une explication à l'autre), Behind the Build (coulisses réelles). L'assistant est **local et gratuit** (Mathéo ne peut pas financer d'IA en ligne) : il connaît le contenu réel du site, reconnaît projets, technologies et intentions en français et en anglais, propose des actions ; **micro** (reconnaissance vocale du navigateur) et **lecture à voix haute**. Recettes `hub-ui.mjs`, `orbit-questions.mjs` (47 questions sur 47 comprises), `correctifs-hub.mjs`.
> - **Portal Rush** (`src/scripts/rush/` : `donnees.ts`, `moteur.ts`, `rendu.ts`, `sauvegarde.ts`, `rush.ts` ; `PortalRush.astro`, `rush.css`) : course à trois voies, obstacles en verre, fragments d'énergie, Perfect Dodge, combo (×1 à ×8), Overdrive (Espace), 8 niveaux (Launch Protocol → Singularity, deux boss à phases), 4 difficultés (Pilot ×0,75, Ace ×1, Expert ×1,5, Nightmare ×2 : vitesse, densité, temps de réaction, boucliers, ressources, motifs), survie infinie, défi du jour (graine = date), rangs C à SSS, 7 couleurs à gagner (hangar), sauvegardes locales, pause, clavier (flèches aussi dans les menus) et tactile. **Règle de justice** : aucune rangée impossible (vérifié sur 12 020 rangées). Recettes `rush-moteur.mjs` (dont un pilote automatique qui finit les 8 niveaux) et `hub-ui.mjs`.
> - Saut Contact ↔ Accueil revérifié après tout cela : `retour.mjs`, 30 sur 30.
>
> *Décisions de Mathéo sur les contradictions entre ses prompts (14 octobre)* : **on garde le grand saut dans les deux sens** (Contact → Accueil et Accueil → Contact) et **la musique d'office à 2 %** (effets à 8 %), comme il l'avait demandé dans le chat.
>
> *Reste à faire, dans l'ordre* : (1) l'audit complet de toutes ses demandes (tableau d'états) ; (2) les restes de la demande d'origine : flouter le nom d'utilisateur et de machine dans `worldwide-check.jpg`, régénérer `partage.jpg` et `icone-180.png`, contrôle aux sept largeurs, clavier, liens ; (3) revoir à l'œil le trait fin du changement de langue, élargir la tolérance du clic sur le cube ; (4) continuer d'améliorer Portal Rush selon ses retours ; (5) réécrire ce README et `docs/DESIGN_SYSTEM.md` ; remettre à jour les vieilles recettes (`nav.mjs`, `carte.mjs`, `controle.mjs`, `lot1-test.mjs`, `intro.mjs`).
>
> *Les recettes* sont des scripts Playwright du dossier de travail de Claude (`scratchpad`), qui ne suit pas le projet : une copie des principales sera rangée dans `outils/recettes/` à la fin.
>
> **Point d'étape, 14 octobre 2026 (à lire en premier si la session a été coupée ; il remplace le « reste à faire » du point du 13 octobre, plus bas).**
>
> *Fait et vérifié depuis le 13 octobre* : symbole personnel (`Symbole.astro`), introduction « initialisation du portail » avec bouton « Passer » (`intro.ts`), mini-jeu Portal Recovery (`jeu.ts`), palette de commandes Ctrl + K (`terminal.ts`), constellation des réalisations (`Constellation.astro`), fêlures du décor sous le curseur, réglage du flou, lien « coulisses » en pied de page.
>
> *Décision de Mathéo, 14 octobre : le tunnel plein écran à chaque changement de section fatigue.* Il est remplacé :
> - **Fil lumineux** (`src/scripts/voyage.ts`, `.trajet` dans `Chrome.astro` et `chrome.css`) : tout lien vers une section (menu, boutons, points du fil, flèches gauche / droite, palette) fait un fondu de 0,4 s avec un léger glissement horizontal ; un faisceau file sur la ligne du bas de l'écran, qui suit aussi le défilement. Le fil boucle. L'adresse suit la section (`#competences`…), donc le bouton « précédent » du navigateur fonctionne ; l'accueil n'a pas d'ancre, pour qu'une actualisation y rejoue l'introduction.
> - **Carte du portail** (`Explorateur.astro`, `explorateur.ts`, `explorateur.css`) : un clic sur le portail ouvre une plaque de verre avec les destinations (5 sections et le CV) en constellation ; choisir une étoile trace un trait de lumière puis rejoint la section. Au survol, un scanner révèle ces étoiles dans le verre (`verre.frag.glsl`, uniform `uScan`). Le clic maintenu fait toujours éclater le portail, puis ouvre la carte. Le portail reste vide au repos : rien n'y est écrit.
> - Le tunnel (`gl/tunnel.frag.glsl`) ne sert plus qu'en éclair : fin de l'introduction et rupture du portail.
> - Recette : `scratchpad/nav.mjs`, 38 vérifications passées (ordinateur, téléphone, mouvement réduit, anglais, historique, clics en rafale).
>
> *Fait ensuite (14 octobre)* : bloc d'identité en haut à gauche avec menu d'accès rapide (`identite.css`, `acces.ts`) ; **changement de langue sans rechargement** (`langue.ts`, `langue.css`) : la page d'origine est téléchargée dans les deux langues, comparée, et seules les différences sont reportées sur la page affichée ; position, thème, réglages et sons sont conservés. Recette : `scratchpad/langue.mjs`.
>
> **LISTE DE CE QUE MATHÉO A DEMANDÉ ET QUI RESTE À FAIRE, DANS L'ORDRE (ne rien oublier ; cocher au fur et à mesure) :**
> 1. Langue : quatre corrections (numéro de téléphone au bon format après changement, message du mini-jeu, libellé en cours de décodage, position dans la galerie épinglée).
> 2. Retouches demandées le 14 octobre : (a) retirer le métier sous le nom, en haut à gauche (« ça fait trop gros ») ; (b) **supprimer entièrement le mode recruteur** (« il est nul, je le veux plus ») ; (c) **son actif par défaut** : son de l'introduction pas trop fort, musique de fond lancée d'office à 15 %, effets de transition à 20 % (limite : un navigateur ne laisse rien jouer avant le premier geste du visiteur) ; (d) sur une fiche, cliquer l'image du projet ramène aux réalisations ; (e) en anglais, écrire « CV » et non « Résumé » en haut à droite ; (f) le trait en haut de page doit avancer par catégorie (25 % par section) et être plus blanc.
> 3. Panneau « Atmosphère » : quatre modes (Chill, Deep Space, Focus, Silent) qui changent vraiment lumière, vitesse des animations, particules et sons, indépendants des thèmes ; lecteur avec liste de pistes (titre, description, lecture / pause, volume, choix), effets sonores réglés à part. Aucun fichier audio dans le projet : pistes générées par le code, à dire clairement à Mathéo, avec ce qu'il faudrait pour ajouter de vrais morceaux.
> 4. Cinquième prompt, partie 1 : **alignement exact des sections** au clic du menu et des flèches (titre visible, jamais masqué par la barre, pas de saut après l'arrivée, même règle partout, section active sans oscillation). Chercher la cause réelle, pas une valeur arbitraire.
> 5. Cinquième prompt, partie 2 : **grande transition de Contact vers l'accueil uniquement** (0,8 à 1,2 s : convergence, fragmentation en éclats, traversée en recul, révélation de l'accueil ; sons du projet ; jamais dans un autre sens ; robuste aux clics rapides et au mouvement réduit).
> 6. Cinquième prompt, partie 3 : **carte du portail repensée** : le cube s'illumine, se fracture en éclats de verre qui forment une constellation des six destinations (Accueil, Compétences, Réalisations, Veille, Contact, CV) ; au survol d'un point : nom, courte description, les autres s'atténuent ; à la sélection : ligne d'énergie vers le centre, la constellation se referme en traînée et la navigation s'enchaîne sans temps mort ; fermeture par bouton, Échap ou clic à côté (les éclats reforment le cube) ; clavier, téléphone, version simple en mouvement réduit.
> 7. Reste de la demande d'origine : flouter le nom d'utilisateur et de machine dans `worldwide-check.jpg` ; régénérer `partage.jpg` et `icone-180.png` ; contrôle aux sept largeurs, clavier, liens ; remettre à jour `scratchpad/controle.mjs` (il attend encore deux thèmes) ; réécrire ce README en entier et `docs/DESIGN_SYSTEM.md`.
> 8. Bilan final à Mathéo, pour chacun de ses prompts : ce qui est fait, corrigé, testé (avec les résultats réels), et ce qui reste.
> 9. Questions qui attendent sa réponse : identité Git ; accord pour installer Lighthouse et `@astrojs/check` ; textes `[À COMPLÉTER]` des fiches ; relecture des quatre notes de veille ; plugin `security-guidance` cassé sur ce PC.
>
> *Environnement* : le plugin `security-guidance` de Claude est cassé sur ce PC (script introuvable) et affiche une erreur après chaque modification de fichier ; les modifications s'appliquent quand même. Les commandes de plus de 8 000 caractères échouent dans le shell : écrire les scripts dans un fichier puis les lancer.
>
> **Point d'étape, 13 octobre 2026, 20 h.**
>
> *Sauvegarde* : avant les « ajustements », copie intégrale du projet dans `Documents\portfolio-2026-backup-2026-10-13` (état : demande d'origine quasi terminée, voir plus bas).
>
> *Fait et vérifié depuis la note ci-dessus* (demande d'origine) : contenu complet en français et en anglais (`src/contenu/fr.ts`, `en.ts`), suite de l'accueil (histoire, parcours, cap : `apropos.css`), section Compétences avec filtre par réalisation et tableau de synthèse BTS SIO (intitulés vérifiés sur la fiche RNCP40792 ; `referentiel.ts`, `/tableau-bts-sio.csv`), section Veille (une fiche Markdown par note dans `src/contenu/veille/`, modèle `_modele.md`, quatre sources réelles vérifiées), fiches projets complètes avec précédent / suivant et emplacement vidéo, pages 404, référencement (`Base.astro`, `sitemap.xml`, `robots.txt`, image de partage via `outils/images-partage.mjs`), `netlify.toml`, terminal caché (touche ² ou mot « trace »).
>
> *Les « ajustements » de Mathéo* (son second prompt, « expérience spatiale ») sont en cours. **Règle absolue : ne jamais remplacer les deux photographies de dunes** (`src/assets/scene/`), seulement leur superposer des effets. Faits et vérifiés :
> - **Voyage par le portail** (`src/scripts/voyage.ts`, shader `gl/tunnel.frag.glsl`) : clic sur la lame = traversée vers la section suivante ; tunnel de filets lumineux ; retour par le tunnel inversé ; saut dans le temps vers l'accueil. Rail du trajet en bas au centre (`.trajet`). **Le trajet boucle** (après Contact on revient à l'accueil, et inversement), au rail comme aux **flèches gauche / droite du clavier** ; dans la galerie, les flèches font d'abord défiler les projets.
> - **Portail** (`gl/champ.ts`, `gl/verre.frag.glsl`) : énergie au survol, fissures (diagramme de Voronoï), clic maintenu 1 s = tremblement puis rupture et traversée. **Mathéo ne veut aucun texte écrit sur le portail** (essayé puis retiré à sa demande).
> - **Sons** (`sons.ts`) : tout est fabriqué avec la Web Audio API, coupé par défaut, activable dans les réglages ; musique d'ambiance générée.
> - **Réglages** (`reglages.ts`, `reglages-panneau.ts`, `reglages.css`) : trois thèmes (nuit, verre, clair ; `theme.ts`), opacité des panneaux 20 à 90 %, intensité lumineuse, niveau d'animation, sons, musique, mode recruteur. L'opacité monte pendant le zoom d'une traversée puis revient.
>
> *Reste à faire*, dans l'ordre : (1) symbole personnel « orbite et portail » puis **introduction « Portal Initialization »** de 3 à 3,5 s, rejouée à chaque chargement, sans indicateur mémorisé (troisième prompt de Mathéo, reçu coupé après « COMPORTEMENT AU CHARGEMENT » : lui redemander la fin) ; (2) mini-jeu Portal Recovery (icône flottante en bas à droite) ; (3) palette de commandes Ctrl+K ; (4) constellation de projets ; (5) fissures discrètes du décor sous le curseur ; (6) pied de page « Behind the Build » ; (7) flouter le nom d'utilisateur et de machine dans `worldwide-check.jpg` avant toute mise en ligne ; (8) contrôle aux sept largeurs d'écran, navigation clavier, liens ; (9) réécrire ce README en entier (sections 1 à 11 de la demande d'origine) et `docs/DESIGN_SYSTEM.md` ; (10) Git : aucune identité configurée sur ce PC, demander à Mathéo laquelle utiliser. Lighthouse demande une installation : attendre son accord.
>
> *Points où seul Mathéo peut répondre* : les textes `[À COMPLÉTER]` des fiches (une vraie difficulté résolue et « ce que j'en retiens » pour chaque projet), la relecture des quatre notes de veille écrites en son nom, la fin de son troisième prompt.
>
> **Sur cet ordinateur, Windows a les animations désactivées** : tous les navigateurs y affichent donc le site en mode « mouvement réduit » (figé, c'est voulu). Pour le voir animé : Paramètres → Options d'ergonomie → Affichage → « Afficher les animations dans Windows ». L'outil de captures, lui, force toujours les animations.

## Reprendre le projet (nouvelle session ou autre ordinateur)

La conversation avec Claude ne suit pas le projet d'un ordinateur à l'autre : c'est ce fichier qui porte la mémoire du travail. Dans une nouvelle session, commence par : **« Lis le README.md en entier et reprends où on en était. »**

### Installer le projet sur un autre ordinateur

1. Copier le dossier du projet (sans `node_modules`, `dist`, `.astro`, `captures`) dans `Documents`.
2. Dans le dossier, installer les dépendances : `npm install`
3. Pour les captures d'écran automatiques, installer le navigateur de test : `npx playwright install chromium`
4. Lancer le site : `npm run dev`, puis ouvrir `http://localhost:4321`.

### Où on en est exactement

**Fait et vérifié** (captures à 1440 × 900 et 390 × 844, console sans erreur, `astro build` réussi avec 14 pages) : hero en carte arrondie avec la scène de dunes animée et la lame de verre, menu en pastilles, méthode en panneau de verre, galerie, fiches projets, contact, version anglaise, version téléphone, mode « mouvement réduit ».

**Écrit mais pas encore branché** (travail interrompu en cours de route) :

| Fichier | Ce qu'il fait | Ce qu'il reste à faire |
|---|---|---|
| `src/scripts/theme.ts` | Bouton de contraste clair / sombre, avec révélation circulaire | L'importer et l'appeler dans `principal.ts` ; ajouter `jour` à `etat` dans `gl/champ.ts` et l'uniform `uJour` dans les shaders ; poser la classe `toujours-sombre` sur `.hero__cadre` |
| `src/scripts/apparitions.ts` | Apparition des éléments au défilement, barre de progression | L'importer dans `principal.ts` ; poser `data-apparait` sur les éléments de `PageAccueil.astro` |
| `src/scripts/details.ts` | Titre d'onglet, mot dans la console, position gardée au changement de langue | L'importer dans `principal.ts` (`initDetails`, puis `restaurerPosition` après la mise en place) |

Conséquence visible aujourd'hui : dans la barre, le bouton drapeau fonctionne (il mène à l'autre langue), mais **le bouton de contraste ne fait encore rien**. Les couleurs des deux thèmes sont prêtes dans `tokens.css` ; le thème clair n'a pas encore été regardé à l'écran.

**Demandé par Mathéo, à faire ensuite** :

1. Brancher les trois fichiers ci-dessus et vérifier le thème clair sur toutes les sections.
2. Plus d'animations, fond compris. Pistes prévues : étoile filante et voiles de sable dans le shader, lame qui pivote au clic et réagit au défilement, cartes de la galerie qui entrent en balayage, compteur qui roule, et sur téléphone un « curseur fantôme » qui fait vivre la scène sans souris.
3. Version téléphone soignée et animée (le menu en cascade est déjà écrit dans `chrome.css` ; langue, contraste et CV sont rangés dans le menu).
4. Reprendre des captures, contrôler, puis demander la validation de la phase 1 avant de passer à la phase 2 (contenu).

### Ce que Mathéo veut (à respecter dans toute nouvelle session)

- **Le design d'abord**, niveau Awwwards. Portfolio professionnel général, pas un site de recherche d'alternance : pas de badge de disponibilité.
- **La grammaire de ses trois images de référence** (`brief/references/` : Infinite, Outsourced, Portal) : grande carte arrondie, scène cinématographique photoréaliste, petit menu en pastilles, titre en grotesque sobre et petit, boutons en pastilles. Fond sombre mais pas noir pur. Fond animé et réactif à la souris.
- **Refusé** : le long voyage au défilement, le fond noir abstrait, la grande police à empattements, tout ce qui rappelle sa v1.
- **L'IA est au centre de son identité** ; les projets WorldWide sont une partie du fil rouge.
- Français et anglais, pas de photo, rien de public sur GitHub pour l'instant.
- **Attendre sa réponse explicite** avant toute installation, dépense ou mise en ligne. Ne jamais payer ni souscrire à sa place. Deux images ont été générées avec Figma AI (avec son accord) : redemander avant toute nouvelle génération payante.

## Lancer le projet

Prérequis : Node.js 24 et Git (installés le 13 octobre 2026).

```bash
npm install
```

```bash
npm run dev
```

Puis ouvrir `http://localhost:4321` (français) ou `http://localhost:4321/en/` (anglais).

Pour prendre des captures d'écran en vraie résolution (le serveur doit tourner) :

```bash
node outils/captures.mjs
```

Elles arrivent dans le dossier `captures/`.

## La pile technique, et pourquoi

| Outil | Rôle | Pourquoi lui |
|---|---|---|
| **Astro 7** | Assemble le site en pages HTML statiques | Deux langues, une page par projet, images optimisées, zéro JavaScript imposé |
| **TypeScript** | Le JavaScript du site, avec des types | Les erreurs de nom ou de forme sont signalées avant d'arriver dans le navigateur |
| **GSAP** (ScrollTrigger, SplitText) | Animations et déclenchement au défilement | La référence du métier, précise à la milliseconde |
| **Lenis** | Défilement amorti | Donne de l'inertie à la molette |
| **OGL** | WebGL (la scène du hero) | Très léger, et assez court pour être lu et expliqué |
| **Geist** | La police, hébergée avec le site | Une grotesque nette et neutre ; aucun appel à un serveur de polices |
| **Playwright** | Captures d'écran automatiques | Contrôle visuel aux différentes tailles d'écran |

## Arborescence

```
brief/                    Les sources fournies par Mathéo (profil, CV, références, captures). On n'y touche pas.
outils/captures.mjs       Prend des captures d'écran du site local.
public/                   Fichiers servis tels quels : favicon, CV en PDF.
src/
  assets/projets/         Les captures des projets (optimisées automatiquement par Astro).
  assets/scene/           Les deux photographies de dunes du hero (large et verticale).
  contenu/
    fr.ts                 TOUT le texte français. C'est ici qu'on change un mot.
    en.ts                 TOUT le texte anglais.
    types.ts              La forme que les deux fichiers doivent respecter.
    index.ts              Choix de la langue, adresses des pages, typographie automatique.
  layouts/Base.astro      Le squelette commun à toutes les pages.
  components/
    Chrome.astro          La barre du haut (marque, menu, langue, CV) et le curseur.
    PageAccueil.astro     Les 5 sections de l'accueil.
    FicheProjet.astro     La page d'une réalisation.
  pages/                  Une adresse par fichier : / , /en/ , /realisations/<projet>/ , /en/work/<projet>/
  scripts/
    principal.ts          Démarre tous les modules, dans l'ordre.
    voyage.ts             Les destinations : laquelle est affichée, passer de l'une à l'autre, l'historique (16 oct.).
    fil.ts                Le fil du bas : les chapitres de la destination affichée (16 oct.).
    portail.ts            Le bouton Portail : sa cassure, puis l'ouverture de la carte du portail (16 oct.).
    recherche.ts          La recherche (Ctrl + K) sur l'index du contenu réel (16 oct.).
    rapide.ts             La visite rapide (16 oct.).
    defilement.ts         Défilement amorti (Lenis) et liens internes.
    nav.ts                Menu : catégorie active, version téléphone.
    intro.ts              L'entrée de page (tableau des délais en tête du fichier).
    titres.ts             Titres qui montent ligne par ligne ; étapes qui s'éclairent.
    galerie.ts            La galerie des réalisations (anneau sur ordinateur, ruban sur téléphone).
    curseur.ts            Curseur personnalisé et boutons magnétiques.
    decode.ts             L'effet de « décodage » des libellés.
    contact.ts            Copie de l'adresse, numéro de téléphone.
    horloge.ts            L'heure de Lyon.
    outils.ts             Petites fonctions partagées.
    gl/champ.ts           La scène WebGL : création, boucle de rendu, souris.
    gl/communs.glsl       Comment la photographie est rendue vivante (nuages, brume, parallaxe, onde).
    gl/fond.frag.glsl     Le fond : paysage + lampe du curseur + onde du clic.
    gl/verre.vert.glsl    La lame de verre : géométrie.
    gl/verre.frag.glsl    La lame de verre : réfraction, dispersion, reflets.
  styles/
    tokens.css            Les jetons de design : couleurs, tailles, rayons, courbes, durées.
    base.css              Remise à zéro, titres, accessibilité.
    chrome.css            Barre du haut, menu, curseur, boutons.
    accueil.css           Hero, méthode, sections d'attente.
    galerie.css           Galerie.
    contact.css           Contact.
    fiche.css             Fiche projet.
```

## Modifier un texte

Ouvre `src/contenu/fr.ts`, change le texte entre les guillemets, enregistre : la page se met à jour toute seule. Pense à reporter le changement dans `src/contenu/en.ts`. Écris normalement : les espaces insécables et les apostrophes courbes sont ajoutés automatiquement.

## Journal des étapes

### Phase 0 — Analyse et questions (13 octobre 2026)

- Lecture complète du `brief/`, visite de la v1 et de la page de connexion de world-forensics.xyz.
- Trente questions posées, chacune avec une recommandation. Réponses de Mathéo, en résumé :
  - portfolio professionnel général, pas un site « recherche d'alternance » ; **pas de badge de disponibilité** ;
  - le design passe avant tout, niveau Awwwards ; l'IA est au centre de son identité ;
  - français et anglais ; pas de photo ; téléphone affiché ; âge non affiché ;
  - la v1 n'est ni archivée ni montrée (il n'en aime pas l'esthétique) ;
  - les « sites de tutoriels » sont WorldWide Forensics : la galerie compte 6 projets ;
  - rien de public sur GitHub pour l'instant : lien vers le profil seulement ;
  - veille : IA générative dans le développement, sécurité des systèmes Windows ; sources suivies : OpenAI, Anthropic ;
  - le CV aura sa propre présentation, à part des projets.
- Le projet a été remonté d'un niveau : la racine est `Documents/portfolio-2026/`.

### Phase 1 — Direction artistique et aperçu (13 octobre 2026)

Trois directions ont été construites puis montrées à Mathéo, qui a tranché en direct.

1. **« Signal »** : fond noir abstrait, grande police à empattements, navigation en règle graduée, long voyage au défilement. *Refusée* : trop de défilement, fond noir, police non souhaitée.
2. **Scène de dunes entièrement calculée par le code** : étape intermédiaire, remplacée dès que Mathéo a autorisé la génération d'images.
3. **Direction retenue pour l'aperçu, calquée sur la grammaire de ses trois images de référence** :
   - le hero est une grande carte arrondie contenant une scène cinématographique ;
   - menu en pastilles en haut, cinq catégories, la catégorie active glisse ;
   - titre sobre et de taille mesurée en bas à gauche, paragraphe discret en bas à droite, boutons en pastilles ;
   - fond de page sombre mais pas noir (`#0c0d10`), une seule police (Geist) ;
   - beaucoup moins de défilement : la galerie ne s'épingle plus qu'un tiers d'écran par carte.

**La scène du hero.** Deux photographies de dunes noires à l'heure bleue (une large, une verticale) générées avec Figma AI, avec l'accord de Mathéo. Elles ne sont pas affichées telles quelles : un shader les rend vivantes (nuages qui dérivent, brume dans les creux, étoiles, aube qui respire) et réactives (profondeur à la souris, lignes de relief sous le curseur, onde au clic). Une lame de verre en 3D flotte devant et réfracte le paysage en temps réel.

**Ce que contient l'aperçu** : hero complet avec son entrée, méthode en panneau de verre, galerie (anneau, glisser, flèches, clavier), transition carte → fiche, fiches projets (structure en place, textes à la phase 2), contact, version anglaise, version téléphone, mode « mouvement réduit ». Les sections Compétences et Veille sont des emplacements.

**Vérifié** : captures à 1440 × 900 et 390 × 844 sur toutes les sections, fiche projet, page anglaise, mouvement réduit ; aucune erreur ni avertissement dans la console.

**Pas encore vérifié** (prévu en phase 4) : les cinq autres largeurs d'écran, la navigation complète au clavier, tous les liens, Lighthouse, le retour arrière du navigateur.

**Points connus à traiter** :

- les photographies font 1376 px de large : un peu juste sur les très grands écrans ;
- les captures de projets contiennent un nom d'utilisateur et un nom de machine à flouter avant toute mise en ligne ;
- les intitulés du référentiel BTS SIO restent à contrôler sur la source officielle.

**Suite** : validation du design par Mathéo, puis phase 2 (rédaction du contenu).
