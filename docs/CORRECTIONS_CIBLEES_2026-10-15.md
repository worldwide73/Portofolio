# Corrections ciblées — 15 octobre 2026

Ce lot traite seulement la dernière demande de Mathéo. Il remplace le périmètre de la mission globale précédente : audit général, refonte mobile générale et configuration des Skills restent en attente. Aucune installation, publication ni nouvelle image générée.

## Changements

| Point | Correction | Preuve |
|---|---|---|
| Bouton Orbit | Suppression du texte ajouté ; restauration du symbole seul, cercle 40 px et CSS Claude original | Comparaison du balisage à l’archive ; `jeu.css` inchangé ; contrôle navigateur |
| Projet portfolio | Capture réelle 1600 × 1000 de l’accueil, avec le nom, la lame, les dunes et la navigation ; réutilisée dans galerie, fiche et Constellation | Captures `galerie-portfolio.png`, `constellation.png`, `fiche.png` ; ressources chargées |
| Description | Présentation FR/EN du but, des usages et de la réalisation technique ; pas de nouveau fait personnel ni retour d’expérience inventé | Lecture et test des fiches/assistant ; le retour personnel reste à compléter |
| Intro | Réduction supplémentaire de 0,5 s (1,5 s cumulées par rapport à la partition antérieure), effets conservés | Durée complète observée d’environ 4,2 s depuis l’activation ; Skip et mode réduit testés ; capture pendant l’intro |
| Refresh | Un rechargement de `/` ou `/en/` efface l’ancre et repart en haut ; l’ancien secours de position du changement de langue est ignoré au refresh | Refresh depuis Réalisations, avec une position de langue résiduelle, et en mode réduit |
| Aperçu du portail | Nettoyage commun souris/clavier/Hub dès l’activation ; fermeture et sélection tuent la séquence précédente ; le focus automatiquement restitué ne réactive plus l’aperçu | Bug initial : opacité 0,92 après Échap, même souris hors lame. Après correctif : 0. Tests souris, clavier, double Entrée, fermeture précoce, réouverture, retour navigateur et destinations |
| Intérieur Orbit | Onglets lisibles, zone de réponse défilante, saisie contenue à 320 px ; une réponse longue se présente depuis son début | Captures desktop, 390 et 320 px, géométrie du panneau et de la saisie contrôlée |
| Réponses | Objectifs, réalisation, résultat et technologies issus des fiches ; comparaison de projets ; suivi du projet cité ; détail absent reconnu ; CV prioritaire | Questions FR/EN réellement soumises ; liens associés ; aucun appel IA distant |
| Explore My Universe | Parcours qui mènent à une preuve : fiche, comparaison Constellation, tableau BTS, CV ; une visite demandée depuis une fiche commence à l’arrivée | Parcours depuis accueil/fiche, action de comparaison et flèches précédent/suivant testés |
| Constellation | Sept projets, filtres par domaine réel avec compte, aperçu de projet, compétences et technologies, trois propositions liées avec liens communs nommés | Filtres comparés aux relations source ; sélection et liens entre projets vérifiés ; captures grand/petit écran |

La Constellation distingue les compétences du référentiel des technologies indiquées dans les projets. Portal Rush est visible mais n’est pas artificiellement rattaché au référentiel BTS. Les filtres comptent uniquement les preuves déjà présentes dans le contenu.

## Fichiers de ce lot ciblé

- `src/assets/projets/portfolio-accueil.jpg` : capture réelle, nouvelle ressource.
- `src/contenu/index.ts`, `fr.ts`, `en.ts`, `types.ts` : ressource, descriptions, libellés et actions des visites.
- `src/components/PageAccueil.astro` : couverture portfolio sans recadrage ; `Constellation.astro` : filtres, aperçus et relations ; `OrbitalHub.astro` : bouton original, savoir documenté, actions de visite.
- `src/scripts/intro.ts`, `details.ts`, `public/avant.js` : durée et rechargement.
- `src/scripts/explorateur.ts`, `src/scripts/gl/champ.ts` : cycle de carte et nettoyage de survol/focus (le premier correctif de ce même problème avait commencé avant la demande ciblée).
- `src/scripts/hub.ts`, `constellation.ts` : réponses, parcours et interactions.
- `src/styles/accueil.css`, `galerie.css`, `hub.css`, `constellation.css` : aperçu, couverture entière et panneaux concernés.
- `outils/capture-accueil.mjs`, `outils/recettes/corrections-ciblees.mjs`, `outils/recettes/finitions-ciblees.mjs` : capture reproductible et vérifications.
- `README.md`, `docs/SESSION_HANDOFF.md`, `docs/PROJECT_REQUIREMENTS.md`, présent document : mémoire et preuves.

Les modifications du lot antérieur (stockage, JSON-LD, permissions micro, crédits et fichiers AGENTS/CLAUDE) sont conservées. Elles ne sont pas présentées comme de nouvelles corrections demandées ici ni comme un audit global achevé.

## Vérifications et fichiers de preuve

- `node outils/recettes/corrections-ciblees.mjs` : **21/21** contrôles réussis lors de la dernière exécution. Rapport : `captures/ciblees/resultats.json`.
- `node outils/recettes/finitions-ciblees.mjs` : durée observée, Skip, refresh avec état résiduel, autres destinations, vignette centrale, comparaison, visites au clavier, coulisses et ouverture/fermeture du jeu. Rapport : `captures/ciblees/finitions.json`.
- Captures réellement examinées : accueil source, intro, galerie portfolio, Constellation/relations, Orbit sur ordinateur et à 320/390 px, fiche détaillée.
- Build Astro réussi, 18 pages statiques. Un build ne remplace pas une analyse TypeScript complète ; `@astrojs/check` n’a pas été installé.
- Dunes paysage/portrait et `jeu.css` comparés à `.backups/avant-codex-20261015-170633.zip` : empreintes identiques.

Serveur testé : `http://127.0.0.1:4321/`. Commande : `npm run dev -- --host 127.0.0.1 --port 4321`. Arrêt dans son terminal avec `Ctrl+C`. Le serveur de développement répercute les changements locaux ; ne pas modifier `src/` pendant les recettes. Pour les captures générales, `outils/captures.mjs` attend maintenant la fin réelle de l’intro.

## Limites

- Orbit est une assistance locale à réponses documentées, pas une IA conversationnelle générale. Les données non renseignées restent signalées comme telles.
- Aucun test humain sur téléphone physique ; 320/390 px sont des vues navigateur émulées, limitées aux éléments de ce lot.
- Voix non testée au micro ; sa disponibilité et son traitement dépendent du navigateur. L’audio automatique reste soumis à l’autorisation du navigateur.
- L’intro animée ne se joue pas si la préférence système ou les réglages du visiteur coupent les animations ; le refresh repart néanmoins au début.
- Qualité visuelle contrôlée sur captures et interactions automatisées ; l’appréciation esthétique finale appartient à Mathéo. Aucun score Lighthouse annoncé, aucun audit global relancé.
