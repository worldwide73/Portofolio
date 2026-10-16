---
name: verification-visuelle-portfolio
description: "Sur le PC kyuu0, Windows a les animations coupées ; comment vérifier visuellement le portfolio malgré ça"
metadata:
  node_type: memory
  type: reference
  originSessionId: b2aec5be-a11a-4027-936b-4c9edea9fd7c
  modified: 2026-10-14T22:19:16.379Z
---

Constaté le 13 octobre 2026 sur l'ordinateur `kyuu0` (Windows 10 Pro) : le réglage Windows « Afficher les animations » est désactivé (SPI_GETCLIENTAREAANIMATION = False). Conséquences pour le projet `Documents/portfolio-2026` :

- Tout navigateur de cette machine, y compris le panneau d'aperçu intégré de Claude, annonce `prefers-reduced-motion: reduce`. Le site s'affiche donc en mode accessible : scène WebGL figée, pas d'entrée de page, galerie en ruban. Ce n'est pas un bug. Mathéo s'en est étonné (« tout est figé ? ») : le lui rappeler si la question revient.
- Le panneau d'aperçu intégré est en plus souvent masqué : ses captures d'écran expirent. Il reste utilisable pour lire le DOM et la console.
- Pour vérifier le rendu animé, utiliser l'outil du projet, qui force les animations et la vraie carte graphique : `node outils/captures.mjs <taille> <défilements…>` (réglages `THEME=clair`, `MENU=1`, `CLIC=x,y`, `REDUIT=1`, `SUFFIXE=`), puis lire les PNG du dossier `captures/`.
- Un script Playwright hors projet peut charger la bibliothèque du projet avec `createRequire('C:/Users/kyuu0/Documents/portfolio-2026/')`. Vérifié le 15 octobre 2026 : Chromium lancé par Playwright (args `--enable-gpu --use-angle=d3d11 --ignore-gpu-blocklist`) annonce `prefers-reduced-motion: no-preference`, donc les animations y tournent (contrairement au panneau d'aperçu).
- Juste après une modification de fichier, le serveur de dev Astro répond « à froid » : les premiers clics d'un test peuvent arriver avant la fin des transitions et échouer. Relancer le test avant de conclure à une régression, et ne jamais modifier `src/` pendant qu'un test tourne (rechargement à chaud = test cassé).

Voir aussi [[consignes-matheo-portfolio]].
