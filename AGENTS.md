# Consignes communes du portfolio

- Lire intégralement `README.md`, puis `docs/SESSION_HANDOFF.md` et `docs/PROJECT_REQUIREMENTS.md` avant toute modification. Au premier démarrage, lire le prompt original et les mémoires conservées dans `docs/claude-memory/`.
- Répondre en français simplement. Travailler par lots locaux vérifiés, sans reconstruire le site.
- Préserver les deux dunes dans `src/assets/scene/`, la lame sans texte, le verre translucide, la galerie 3D à 0,68 projet/s, le grand portail et la carte du portail (apparence et animations validées, à ne pas refaire).
- Navigation par destinations (16 octobre 2026, remplace la navigation circulaire entre sections) : une destination affichée à la fois ; le portail (sa carte) voyage entre destinations ; la barre du haut porte Portail, Rechercher, Visite rapide ; le fil du bas et les flèches ← → passent d'un chapitre à l'autre de la destination ; le menu d'identité ne répète pas les destinations. Ne pas restaurer l'ancien menu des cinq sections ni le passage d'une section à l'autre à la molette.
- Conserver les décisions explicites : saut Contact ↔ Accueil dans les deux sens, musique 2 %, effets 8 %, intro 5 % sous réserve des restrictions du navigateur ; aucun sélecteur de thème. L'ancienne « Recruiter View » reste abandonnée ; la « Visite rapide » de la barre (16 octobre 2026) en tient lieu.
- Aucun achat, installation, téléchargement, publication ou déploiement sans accord explicite. Aucun secret dans le code. Aucune information personnelle inventée ; utiliser `[À COMPLÉTER]`.
- Vérifier une sauvegarde avant de gros changements. Ne jamais supprimer les anciennes mémoires ni réinitialiser les fichiers.
- Tester les animations avec `reducedMotion: 'no-preference'` ET le mode réduit. Windows peut demander le mode réduit par défaut. Ne pas modifier `src/` pendant les tests.
- Distinguer inspection du code, tests automatisés, examen des captures et test humain. Ne jamais recopier un ancien succès comme une nouvelle vérification.
- Après chaque lot : actualiser le point actuel du README, le suivi des exigences et le passage de relais. Conserver l'historique mais indiquer les décisions remplacées.
- Une contradiction non tranchée entre deux souhaits explicites doit être signalée. La mission du 15 octobre remet explicitement le mobile dans le périmètre.
