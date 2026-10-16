# Mode d'emploi : lancer ton portfolio avec Claude Code

## 1. Ce qui est déjà prêt (dans `portfolio-2026.zip`)

```
portfolio-2026/
  PROMPT_PORTFOLIO_CLAUDE_CODE.md      ← le prompt à coller
  MODE_EMPLOI.md                       ← ce fichier
  brief/
    profil-matheo.md                   ← ton profil
    stratum-hero-reference.md          ← le code du site Stratum (photo 7)
    references/                        ← tes 7 captures de sites, déjà renommées
    ancien-portfolio/                  ← tes 2 captures de projets
    projets/                           ← un dossier vide par projet
    METS-TON-CV-ICI.txt
```

Déjà intégré dans le prompt : ton profil, tes 5 sections, ton master Data et IA, tes projets WorldWide (avec world-forensics.xyz), ton ancien portfolio comme projet, ton GitHub, la veille, le défilement horizontal des projets et le thème libre en couleurs neutres. Pas de vidéo pour l'instant, et aucun chiffre inventé.

## 2. Ce qu'il te reste à faire (3 choses)

1. **Ajouter ton CV** : `brief/cv.pdf`.
2. **Ajouter les captures de tes projets** dans les dossiers `brief/projets/…`, en priorité les 4 WorldWide. Pleine résolution, sans recadrage, 2 à 5 par projet. Sans captures, Claude Code utilisera celles de ton ancien portfolio et du site world-forensics.xyz.
3. **Lancer Claude Code** dans le dossier `portfolio-2026/`, effort au maximum, mode Plan activé, et coller tout le contenu de `PROMPT_PORTFOLIO_CLAUDE_CODE.md`.

## 3. Ce qui va se passer

Claude Code s'arrête 4 fois pour te demander ton avis :
1. **Ses questions** : chacune a une réponse recommandée, tu peux répondre « OK pour tout sauf… ».
2. **La prévisualisation** du design et des animations (hero, galerie qui défile, curseur, fond, contact). Rien n'est développé en entier avant ton accord.
3. **Le contenu** rédigé.
4. **La mise en ligne** : rien n'est publié sans ton accord.

## 4. Conseils

- Regarde bien la prévisualisation sur ordinateur **et** sur téléphone : c'est le moment où tes retours comptent le plus.
- Pour ajouter des vidéos plus tard : dépose un `.mp4` dans le dossier du projet et demande à Claude Code de l'intégrer.
- Si la session devient très longue, demande-lui de mettre le README à jour, puis continue dans une nouvelle session en lui disant de lire le README d'abord.
