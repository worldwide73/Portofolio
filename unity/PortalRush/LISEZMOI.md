# Portal Rush — le projet Unity

Ce dossier est la future version **Unity 6.3 LTS (URP, build Web)** de Portal Rush, le jeu de course à trois
voies du portfolio. Le concept et les règles ne changent pas : elles viennent du jeu web
(`src/scripts/rush/`) et sont portées en C# dans `Assets/PortalRush/Scripts/Coeur/`.

**État (18 octobre 2026)** : seul le cœur de règles est écrit et vérifié, hors de Unity (.NET 8 :
29 parties sur 29 identiques au jeu web, `outils/unity/coeur-tests`). **Rien n'a encore été compilé ni ouvert
dans Unity.** L'ancien jeu reste le jeu du portfolio tant que cette version n'est pas validée.

## L'ouvrir (sur le PC Windows)

1. Unity Hub › **Installs** › installer **Unity 6.3 LTS** (6000.3.x) avec le module **Web Build Support**.
2. Unity Hub › **Projects** › **Add** › **Add project from disk** › choisir **ce dossier**
   (`…\Portofolio\unity\PortalRush`, celui qui contient `Assets`). Si Hub propose une autre version, choisir la
   6000.3 installée.
3. La première ouverture est longue (Unity fabrique `Library/`). Accepter l'installation des paquets proposée
   (URP, Input System, Test Framework).
4. Ou, sans ouvrir l'éditeur (éditeur **fermé**) : depuis la racine du dépôt,
   `powershell -ExecutionPolicy Bypass -File outils\unity\unity.ps1 -Tout`.

Après la première ouverture, **enregistrer dans Git les fichiers `.meta`, `Packages/` et `ProjectSettings/`**
créés par Unity (jamais `Library/`, `Temp/`, `Logs/`, `UserSettings/` : `.gitignore` les écarte). Travailler sur la
branche `claude/hopeful-ritchie-s4w21n`, jamais sur `main`.

## Pour aller plus loin

- `docs/UNITY_MIGRATION.md` : l'audit, les correspondances avec le jeu web, les choix techniques (avec leurs
  sources) et le **mode d'emploi pas à pas** sur le PC.
- `docs/UNITY_ARCHITECTURE.md` : le contrat du projet (assemblages, pont JavaScript ↔ Unity, manifeste du build).
