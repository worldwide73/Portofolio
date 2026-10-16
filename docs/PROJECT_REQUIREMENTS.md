## Portal Rush V4 et le son (16 octobre 2026, en cours)

| Demande | État | Preuve |
|---|---|---|
| Icône casque juste à côté du drapeau (bureau et téléphone), même style, boutons inchangés | V | recette `portal-rush-v4.mjs` (positions, tailles, écarts) + captures |
| Lecteur DREAM RADIO complet (titre, artiste, liste, lecture, précédente/suivante, volume, progression, sourdine) | V | recette + captures |
| Musique coupée au lancement, jamais de lecture automatique | V | recette (au chargement, après 3 s, anciens réglages « musique activée ») |
| Fermer le lecteur n'arrête pas la musique ; elle continue entre destinations | V | recette |
| Atténuation 10–25 % sur de vrais effets, seulement effets activés, sans pompage | V (mesurée, pas écoutée) | recette (carte : −18 %, remontée ; effets coupés : 0) |
| Ambiances et musique retirées des réglages ; effets activés par défaut | V | recette (page Son) |
| Morceaux légaux, crédités, licences vérifiées | V | `public/audio/CREDITS.txt`, `docs/AUDIO.md` (AUTHORS.txt de Pioneer, historique git, README Kenney) |
| Une seule bande-son (DREAM suspendue dans Rush, reprise seulement si elle jouait) | V | recette (deux cas) |
| Sauvegarde versionnée, migration sans perte, corruption, secours, fusion, sans stockage | V | recette (5 contrôles) |
| RUSH RADIO : lecteur compact en bas à droite du menu, caché en course | V | recette (position, liste, Échap, course) + capture |
| Musique adaptative par couches réelles (vitesse, danger, Overdrive, pause, défaite, victoire), sans changement de tempo | V (couches mesurées, pas écoutées) | recette (menu → course → pause) ; morceaux enregistrés : filtre seulement, dit dans la liste |
| Son moteur synchronisé à la vitesse | V (code), non écouté | `sons.ts` `moteurRush` |
| Entrée cinématique, tunnel 3D, tutoriel | À faire | — |
| Overdrive extrêmement rare (1 fois, pas au départ, exigeant, non rechargeable, on finit sans) | V | recette (3 contrôles) + simulation |
| Nouvelle difficulté au-dessus de Nightmare (Paradoxe), extrêmement dure mais jouable | V (simulation) | recette ; simulation : secteurs 1–3, 6, 7 réussis par le pilote automatique |
| Difficulté qui monte dans chaque niveau | V | `moteur.ts` (complexité + avancée), vitesse et écarts existants |
| Survie : une vie, vitesse continue, Overdrive rare | V | recette |
| Obstacles mobiles variés, lisibles, jamais impossibles | V (simulation, rendu logiciel) | recette (5 types posés) ; simulation ; captures 3D |
| Vaisseaux aux vraies statistiques, sauvegardés | V | recette ; garage (captures) |
| Séquence de fin raccourcissable | V | réglage Complète / Courte |
| Piste qui monte, descend, tourne, s'incline (par monde) | V (existant, conservé) | `scene/parcours.ts` (virages, reliefs, dévers par monde, bornés pour l'équité) ; pas de nouvelle déformation ajoutée |
| Interface AAA | À faire | — |

## Retours du 16 octobre 2026 (4ᵉ lot) — remplacent la ligne « Animation du portail = celle de l'accueil » du 2ᵉ lot

| Demande | État | Preuve |
|---|---|---|
| Le passage du bas se fissure et ouvre la carte sur place (sauf l'accueil, grand portail) | V (rendu logiciel) | recette `retours-lot4.mjs` (classes, toile de fissures, moments charge/rupture, destination inchangée) + captures ralenties ; son non écouté |
| Pas d'écran noir derrière la carte | V | recette (contenu effacé, voile léger, fond du désert) + capture |
| Réalisations dans une lame de verre, fond réglable | V | recette (bordure, coins, fond suit l'opacité) + captures bureau/téléphone/compact |
| Texte des fins de page plus grand | V | recette (≥ 40 px à 1440) + capture |
| Le nom ouvre le menu déroulant, comme le chevron | V | recette bureau et téléphone |
| Fil des Compétences sans saut (01 → 06) | V | recette (molette et clics) |
| Flèches ↑ ↓ font défiler chaque destination | V | recette (5 destinations, réduit) |
| Aide clavier à jour | V | recette |
| CV renommé `CV_Matheo_Maleyran.pdf` | V | recette (réponse 200, liens) |

## Huit améliorations du 16 octobre 2026 (3ᵉ lot)

| Demande | État | Preuve |
|---|---|---|
| Densités Compact / Équilibré / Cinématique ; l'actuel = Équilibré, par défaut, inchangé | V | relevé des boîtes avant/après identique ; recette (titres, hero, portail, débordement) ; captures 1440/390/320 |
| Densité instantanée et mémorisée | V | recette (changement sans rechargement, rechargement) |
| Restaurer l'affichage d'origine, sans toucher au reste | V | recette (5 réglages rétablis, stockage et sons intacts, confirmation) |
| Mémoire des destinations visitées sur la carte | V | recette (marques, stockage, passage par l'accueil exclu) + capture |
| Mini-guidage de première visite, fermable, mémorisé, revoir | V | recette bureau, téléphone, réduit + captures |
| Reflets de verre au curseur (quelques surfaces) | V (souris émulée) | recette (suivi, extinction, aucune surface en réduit) ; rendu examiné sur capture |
| Fin de chapitre sur le fil, sans répétition | V | recette (molette, saut exclu, aller-retour sans nouvelle animation) + capture |
| Recherche : synonymes, variantes, accents, FR/EN, état vide | V | recette (18 requêtes FR) + 11 requêtes EN |
| Aide clavier : raccourcis réels, Échap, clavier | V | recette + captures FR/EN |
| Non-régression (portail, carte, galerie, Hub, Rush, navigation) | V | recettes navigation 24/24, corrections 21/21, portail, finitions, icone-orbit, saut-ambiances |

## Retours du 16 octobre 2026 (2ᵉ lot) — remplacent les lignes « Barre », « cassure du bouton Portail » et « raccourci P » du lot ci-dessous

| Demande | État | Preuve |
|---|---|---|
| Pas d'écran noir en revenant au grand portail | V | recette « arrivée sur #contact puis portail » (toile WebGL à la taille du cadre) + capture |
| Animation du portail = celle de l'accueil (cube qui se brise, mêmes sons) | V (rendu logiciel) | recette (détour par l'accueil, classe `carte-en-transition`, carte sans fond noir) + captures ; son non écouté |
| Texte à l'arrivée sans retard ni saut | V (rendu logiciel) | capture à 0,7 s : tout le texte visible, titre découpé en une ligne |
| Galerie en anneau, qui tourne comme avant | V | recette (écarts des cartes) + captures |
| CV retiré de la carte ; cinq planètes espacées régulièrement | V | recette (5 destinations) + captures |
| Passages « Traverser le portail » hors des panneaux ; Contact resserré | V | recette (aucun passage dans `#contact`) + captures |
| « Revenir en haut » retiré | V | recette |
| Plus de mouvement de page une fois la carte ouverte | V | recette (molette + PageDown : position inchangée) |
| Barre : lieu non cliquable (blanc), puis Rechercher, Visite rapide ; portail seulement en bas des pages | V | recette (bureau, anglais, téléphone) |

## Lot du 16 octobre 2026 — navigation par destinations (Claude Code Cloud)

| Demande | État | Preuve |
|---|---|---|
| Destinations indépendantes, molette limitée à la destination | V | navigation-destinations.mjs (accueil, Réalisations, Contact) |
| Barre : Portail, Rechercher, Visite rapide (esthétique conservée) | V | recette + captures bureau/téléphone |
| Animation de cassure du bouton Portail → carte existante | V (rendu logiciel) | recette (classes, toile, nettoyage, carte unique) + images examinées au ralenti ; fluidité GPU à valider par Mathéo |
| Fermeture de la carte : retour à la même destination et position | V | recette |
| « Rejoindre le portail » (fin de l'accueil) sans second clic | V | recette |
| Fil des chapitres (Accueil 4, Compétences 6, Réalisations 7 synchronisé avec la galerie, Veille, Contact 3) | V | recette + captures |
| Fins de destination | V | captures |
| Recherche sur le contenu réel, états vides, clavier, Échap | V | recette (python, supabase, electron, cv, xyzabc, tweaks, secure boot) |
| Visite rapide (remplace l'ancien mode recruteur) | V | recette |
| Raccourcis P, Ctrl/Cmd+K, ← → chapitres, Échap ; pas de conflit avec Portal Rush | V | recette |
| Menu d'identité sans navigation parallèle, actions réelles | V | recette ; copie presse-papiers non testée hors navigateur de test |
| FR/EN sans rechargement, destination conservée | V | recette |
| Grand portail, carte, Orbital Hub, saut, dunes inchangés | V | `git diff` vide sur ces fichiers |
| Mouvement réduit, téléphone 390 px | V (émulation) | recette ; vrai téléphone non testé |

> **16 octobre — derniers réglages de vitesse demandés.** Intro −0,2 s par rapport au lot précédent : réduction cumulée 1,7 s ; 3 957 ms mesurées avec Playwright GPU. Saut Accueil ↔ Contact en Chill : multiplicateur local 1,1, soit environ 10 % plus rapide ; intro et autres ambiances indépendantes. Durée transmise au son et au fil ajustée au même multiplicateur. Fichiers : intro.ts, saut.ts, voyage.ts. Tests : duree-intro.mjs réussi ; saut-ambiances.mjs (12 trajets, origine/Focus/Chill, normal/réduit, aller/retour + animations coupées) réussi sans exception JS ; build 18 pages réussi. Ces valeurs remplacent les précédentes ci-dessous.

> **16 octobre — durée intro rétablie à la demande de Mathéo : +0,5 s.** Réduction cumulée de la partition revenue à 1,5 s (remplace la valeur 2 s ci-dessous). Mesure Playwright avec GPU : 4 120 ms (`outils/recettes/duree-intro.mjs`). Première mesure sans les arguments GPU non exploitable : assertion échouée ; relance GPU réussie. Seule la vitesse de l’intro a changé, aucun effet retiré. La cinématique Accueil ↔ Contact reste inchangée : 0,6 s + 0,55 s nominales, rythme global préexistant dépendant de l’ambiance (Chill 0,85 ; Focus 1,5). Pas de modification de ce rythme dans ce lot. Seuil de recette trois-corrections adapté à la nouvelle durée.

> **16 octobre — transition Accueil ↔ Contact en Focus : corrigée et testée.** La cinématique existait toujours mais voyage.ts exigeait ambiance.eclats >= 0.3 ; Focus donne 0. Absence reproduite dans les deux sens avant correction. Ce filtre d’ambiance est retiré : animations complètes = saut dans les deux sens, quelle que soit l’ambiance. Les animations allégées/coupées et prefers-reduced-motion restent respectées. Recette `outils/recettes/saut-ambiances.mjs` : 8 trajets origine/Focus × normal/réduit × aller/retour, déclenchement de la toile, destination et nettoyage vérifiés ; animations coupées aussi testées ; aucune exception JS. Build 18 pages réussi. Diagnostic avant : `outils/recettes/diagnostic-saut.mjs`. Aucun réglage utilisateur changé dans son navigateur.

> **Correctif du 16 octobre — icône Orbit invisible en Focus.** La règle `html[data-atmosphere="focus"] .jeu-bouton { display:none }` masquait le Hub, même après rechargement puisque le réglage persiste. Règle retirée de `src/styles/reglages.css`, sans changer l’icône. Recette `outils/recettes/icone-orbit.mjs` : visibilité et ouverture/fermeture dans les quatre ambiances, Focus après reload, animations normales/réduites (10 contrôles OK, zéro exception JS). Build Astro 18 pages réussi. La dissimulation temporaire pendant intro/menu/carte reste normale.

## Mise à jour prioritaire — 16 octobre 2026

| Demande actuelle | État | Preuve nouvelle |
|---|---|---|
| Intro −0,5 s supplémentaires | V | Réduction cumulée 2 s ; mesure navigateur 3 574 ms |
| Lame droite après retour Home | V pour les scénarios testés | Bug reproduit avant correction (visée Y=3,894), coordonnées bornées et recentrage ; sections, Contact, flèche et visite en normal/réduit |
| Panneau Orbit plus petit, icône intacte | V | 390 × 560 px, icône 40 × 40 ; réponse utilisable et cadre contenu à 390 px |

Recette : outils/recettes/trois-corrections.mjs ; rapport et captures : captures/ciblees/. Captures examinées. Build Astro réussi (18 pages), zéro exception JS dans cette recette. Les mesures de durée et dimensions ci-dessous sont historiques, remplacées par ce lot. Aucun test sur téléphone physique.

# Exigences et preuves

> Priorité actuelle : correction ciblée du 15 octobre. Mission globale et configuration environnement différées. Image demandée : capture complète de l’accueil (précision ultérieure), pas dunes seules. Bouton Orbit extérieur original. Intro −1,5 s cumulées. Refresh au début.

Statuts : **V** terminé et vérifié durant cette reprise ; **P** partiel ; **N** présent mais non vérifié durant cette reprise ; **A** non commencé ; **B** bloqué (raison explicite). Les succès historiques du README ne suffisent pas à passer en V.

## Corrections ciblées (demande la plus récente)

| Point | État réel | Preuve |
|---|---|---|
| Bouton Orbit Claude | V | Archive comparée + cercle 40 px testé |
| Capture réelle du portfolio + description | V | Galerie, fiche, Constellation FR/EN ; captures examinées |
| Intro −0,5 s supplémentaires | V | Partition conservée, environ 4,2 s observées ; Skip |
| Refresh au début | V | Depuis section, position résiduelle de langue, mode réduit |
| Aperçu du portail | V | Souris/clavier/focus, clics rapides, retour et destinations |
| Orbit et visites utiles | V pour les scénarios testés | 21/21 + comparaison, flèches, lancement depuis fiche ; voix non testée |
| Constellation utile | V | Filtres sur relations réelles, sept projets, aperçus et liens communs |

Bilan complet : `CORRECTIONS_CIBLEES_2026-10-15.md`. Les états globaux plus bas sont ceux de la mission précédente ; ils ne constituent pas une promesse de couverture exhaustive. Mobile général et Skills sont différés.

## Mission globale du 15 octobre (hors du lot ciblé)

| ID | Demande | Implantation / état initial | Statut | Vérification ou validation nécessaire |
|---|---|---|---|---|
| M01 | Sauvegarde avant correction | Archive `.backups/avant-codex-20261015-170633.zip` | V | 10 537 fichiers, CRC et manifeste |
| M02 | Mémoire commune Claude/Codex | AGENTS, CLAUDE, README, exigences, relais | P | Maintenir après chaque lot |
| M03 | Symbole du portail ne persiste pas | `gl/champ.ts`, `explorateur.ts`, `accueil.css` | N | Souris, clavier, clics rapides, fermeture |
| M04 | Introduction raccourcie d'environ 1 s | `intro.ts` | A | Mesure avant/après, Skip, interactivité |
| M05 | Constellation utile | Domaines actuellement non interactifs ; projets BTS seulement | P | Navigation par compétence, relations explicites, liens |
| M06 | Orbit : bouton et interface soignés | `OrbitalHub.astro`, `hub.css`, `jeu.css` | P | Bureau, tactile, états et débordements |
| M07 | Orbit : réponses documentées, utiles | Données actuelles limitées à phrase + stack | P | Objectifs, rôle, résultat, suivi de question, aucun fait inventé |
| M08 | Mobile complet | Défauts de composition déjà notés dans README | P | 320–1920 px, portrait/paysage/tablettes, tactile, menus et jeu |
| M09 | Crédits honnêtes Claude Code/autres outils | Pied de page cite IA et stack mais pas Claude Code | P | FR/EN ; aucune attribution inventée |
| M10 | Réalisation correspondant à l'image d'accueil | Dunes Figma AI et fiche portfolio existantes ; Portal Rush déjà présent | P | Identifier la ressource et éviter un doublon artificiel |
| M11 | Audit sécurité | `netlify.toml`, dépendances, entrées et stockage | A | Sources OWASP, audit dépendances, build sous CSP, secrets |
| M12 | Vérification exhaustive | Présent tableau | P | Compléter les preuves et les écarts |
| M13 | Trois prompts de reconstruction/réutilisation | `docs/` | A | Basés sur la version réelle et ses ressources |
| M14 | Tutoriels interactifs futurs | Proposition à documenter | A | Sans refonte de la galerie |

## Exigences conservées du prompt et des décisions successives

| ID | Exigence actuelle | Fichiers principaux | Statut / contrôle prévu |
|---|---|---|---|
| E01 | Dunes inchangées, verre partout, portail sans texte permanent | assets/scene, tokens, base, gl | N — empreintes et captures |
| E02 | Cinq sections, flèches circulaires, scroll libre, historique | voyage, defilement, nav | N — destinations/alignement/retour navigateur |
| E03 | Saut spectaculaire Contact ↔ Accueil ; navigation légère ailleurs | saut, voyage | N — les deux sens sont une décision explicite |
| E04 | Intro à chaque chargement, seule commande Skip, pas en navigation interne | intro, public/avant.js | N — mouvement normal/réduit |
| E05 | Galerie 3D 0,68 ; hover 40 %, maintien pause, compteur, liens | galerie | N — pas de galerie épinglée (ancienne demande remplacée) |
| E06 | Carte monumentale, six destinations, orbite, retour fragments | explorateur, gl | N — vide ne ferme pas ; logo/bouton/Échap ferment |
| E07 | FR/EN sans reload, section/scroll/réglages conservés | langue, contenu | N — fiches et panneaux compris |
| E08 | Audio procédural, volumes réels, Atmosphere quatre modes | sons, ambiances, atmosphere, reglages | N — autoplay soumis au navigateur ; écoute humaine à valider |
| E09 | Thème verre unique, opacité/flou/lueur utiles, sans Recruiter View | tokens, reglages | N — ne pas restaurer les thèmes retirés |
| E10 | Contenu réel : formation, histoire, IA, projet professionnel | contenu, PageAccueil | N — validation personnelle des textes |
| E11 | Compétences reliées aux preuves, tableau BTS/CSV | referentiel, filtres, tableau-bts-sio.csv | N — pas de compétence inventée |
| E12 | Fiches : phrase, contexte, objectifs, réalisation, difficultés, résultat, compétences, bilan | FicheProjet, contenu | N — `[À COMPLÉTER]` à lister ; vidéos optionnelles |
| E13 | Veille deux sujets, sources, dates, modèle Markdown | contenu/veille | N — les avis personnels attendent validation |
| E14 | Contact/CV/LinkedIn/GitHub/partage/raccourcis réels | contact, acces, Chrome | N — liens, presse-papiers, clavier |
| E15 | Explore My Universe et Behind the Build réels | hub | N — parcours et flèches ; technologies du code |
| E16 | Portal Rush 3 voies, collisions, combos, Overdrive, records, rangs | rush/moteur, equilibrage, sauvegarde | N — simulations distinctes des parties humaines |
| E17 | 8 secteurs, 4 difficultés, boss, Endless, Daily déterministe | rush/donnees, moteur | N — équité et objectifs |
| E18 | Garage/déblocages/étoiles persistants, commandes clavier/tactiles | rush, sauvegarde | N — nouvelle partie, reload, pause, reprise |
| E19 | Vraie 3D : décors/virages/relief/vaisseau, fin cinématique, repli 2D | rush/scene, rendu | N — WebGL et repli ; sortie vers accueil |
| E20 | Encart compact 4 s, barre blanche, entrée Work jouable | vitrine, PageAccueil | N — compte à rebours et jeu |
| E21 | Souris/focus, réduit, sans WebGL, menus/fiches accessibles | styles, outils, gl | N — clavier, zoom et émulation |
| E22 | SEO/OG/JSON-LD/sitemap/robots/404/image partage | Base, pages, public | N — build, titres et ressources |
| E23 | Lighthouse ≥90/95/95/100, LCP<2,5s CLS<0,05 INP<200ms | outils | B — Lighthouse absent, installation soumise à accord ; ne pas annoncer ces scores |
| E24 | Console, builds, captures sept largeurs, liens, rapides clics | outils/recettes à créer | P — historique non transféré automatiquement |
| E25 | Anonymisation capture Windows | worldwide-check.jpg | N — contrôle visuel |
| E26 | Design system, animations expliquées, glossaire, jury, contenu/déploiement | docs et README | P — documentation initiale incomplète |
| E27 | Rien en ligne, budget nul, aucune API IA payante, pas de secrets | Ensemble | N — local seulement ; déploiement réservé à l'accord explicite |

## Décisions remplacées et questions

- Mobile auparavant différé : repris explicitement par M08.
- Intro auparavant rallongée : M04 demande maintenant environ une seconde de moins, effets conservés.
- Thèmes clair/sombre, Recruiter View, scroll piégé, galerie plate : abandonnés explicitement ; ne pas les réintroduire.
- Son par défaut / saut uniquement dans un sens dans certains prompts : décisions explicites conservées (musique 2 %, saut bidirectionnel).
- Réalisation image d'accueil : ne pas inventer un auteur ou une nouvelle production ; vérifier s'il s'agit des dunes ou de Portal Rush déjà listé.
