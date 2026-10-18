# Portal Rush Unity — contrat d'architecture

Ce document fixe ce que chaque partie du projet Unity attend des autres. Il sert de référence à tous ceux qui
écrivent du code pour la version Unity (personnes ou agents), surtout tant que le projet n'a pas encore été ouvert
dans l'éditeur : chaque partie doit pouvoir être écrite séparément et s'assembler sans surprise.

État : **rien de la partie Unity n'a encore été compilé dans Unity**. Seul le cœur de règles (`Scripts/Coeur`) est
compilé et vérifié, en .NET 8 (`outils/unity/coeur-tests`, 29/29 parties identiques au moteur TypeScript).

## 1. Principes

- **Le concept ne change pas** : runner spatial à trois voies, mêmes règles, mêmes données. La règle vient du
  moteur TypeScript, portée ligne à ligne en C# (`Scripts/Coeur`) et vérifiée par des parties de référence.
- **Le JavaScript du portfolio reste propriétaire** de la sauvegarde (`localStorage`, clés `portal-rush-3*`, format
  v3 inchangé, fonctions `charger`, `enregistrer`, `ranger`…), de l'audio (moteur `sons.ts`, RUSH RADIO, DREAM
  RADIO, musique adaptative) et de la langue du site. Unity affiche et fait jouer ; il demande, le JavaScript décide
  et enregistre. Aucune donnée de joueur n'est dupliquée dans Unity (pas de `PlayerPrefs` dans le navigateur).
- **Unity dessine** : monde, piste, vaisseaux, obstacles, cinématique d'entrée, menus, garage, HUD (UI Toolkit).
- **L'ancien jeu reste le jeu par défaut** tant que la version Unity n'est pas validée. La version Unity s'active
  par un drapeau (voir §6) et retombe sur l'ancien jeu si le build manque ou échoue.

## 2. Dossiers et assemblages

```
unity/PortalRush/                         projet Unity (Unity 6.3 LTS, URP)
  ProjectSettings/ProjectVersion.txt      seul réglage versionné au départ ; Unity crée le reste à l'ouverture
  Assets/PortalRush/
    Scripts/Coeur/        PortalRush.Coeur         règles pures, sans UnityEngine (noEngineReferences)
    Scripts/Installation/ PortalRush.Installation  éditeur seul, AUCUNE référence : compile toujours
    Scripts/Jeu/          PortalRush.Jeu           exécution : session, parcours, route, vaisseau, caméra,
                                                   objets, qualité, vitrine ; Pont/ (pont JavaScript)
    Scripts/Interface/    PortalRush.Interface     exécution : écrans UI Toolkit, HUD, textes
    Scripts/Editeur/      PortalRush.Editeur       éditeur : configuration URP/Web, scène, import, construction
    Plugins/WebGL/PortalRushPont.jslib            côté navigateur du pont
    UI/                   UXML, USS, polices (licence jointe)
    Modeles/              FBX exportés depuis Blender + palette.json
    Materiaux/ Rendu/ Scenes/                     créés par l'installation (ne pas écrire à la main)
    Tests/Editor/         PortalRush.Tests.Editor  rejeu des parties de référence (EditMode)
```

Dépendances autorisées (sens unique) : `Coeur` ← `Jeu` ← `Interface` ← `Editeur`. `Jeu` ne connaît pas
`Interface`. `Installation` ne dépend de rien.

**Garde des paquets.** Avant l'installation des paquets (URP, Input System, Test Framework), tout assemblage qui en
dépend échouerait à la compilation et bloquerait l'éditeur. Les assemblages `Jeu`, `Interface`, `Editeur` et
`Tests.Editor` portent donc la contrainte `"defineConstraints": ["PORTALRUSH_PAQUETS"]`. Ce symbole est ajouté aux
symboles de script (Standalone et WebGL) par `Installation` une fois les paquets présents. Ainsi, à la première
ouverture, seuls `Coeur` et `Installation` compilent, et l'installateur peut faire son travail.

Paquets installés par nom (dernière version compatible de l'éditeur, sans version écrite à la main) :
`com.unity.render-pipelines.universal`, `com.unity.inputsystem`, `com.unity.test-framework`. Pas de paquet payant
ni de l'Asset Store. La trajectoire 3D est calculée par notre propre code (pas de dépendance au paquet Splines).

## 3. Règles de code (Unity 6.3, C# 9)

- C# 9 au plus : pas de `record`, pas de propriétés `init` (Unity ne fournit pas `IsExternalInit`), pas d'espaces
  de noms « fichier » (`namespace X;`), pas de `global using`. `#nullable enable` en tête de fichier.
- API Unity 6 : `Object.FindFirstObjectByType<T>()` / `FindAnyObjectByType<T>()` (pas `FindObjectOfType`),
  `Rigidbody.linearVelocity` (pas `velocity`), Input System (`UnityEngine.InputSystem.Keyboard.current`,
  `Touchscreen.current`), UI Toolkit (`UIDocument.rootVisualElement`).
- JSON d'exécution : `JsonUtility` avec des classes `[Serializable]` à champs publics (pas de dictionnaires, pas de
  tableaux de tableaux, pas de propriétés). Les nombres du JavaScript arrivent en `double`.
- Noms en français, comme le jeu web. Commentaires brefs et utiles.
- Le build Web ne doit utiliser que des fonctions disponibles en WebGL2 (voir `docs/UNITY_MIGRATION.md`) :
  chemin de rendu Forward (pas Forward+), éclairage global précalculé seulement, particules Shuriken (pas VFX
  Graph), pas de compute shaders indispensables.

## 4. Scène

Une scène unique `Assets/PortalRush/Scenes/PortalRush.unity`, **construite par code** (`Editeur/Scene.cs`, menu
*Portal Rush › Construire la scène*) pour éviter d'écrire du YAML Unity à la main. Objets :

| Objet | Composants | Rôle |
|---|---|---|
| `Pont` | `Jeu.Pont` | cible de `SendMessage` depuis la page (le nom `Pont` est fixe) |
| `Session` | `Jeu.Session` | fait vivre une `Partie` à pas fixe, lit les commandes |
| `Monde` | `Jeu.Parcours`, `Jeu.Route`, `Jeu.Decor`, `Jeu.Objets` | trajectoire 3D, route, décors, obstacles |
| `Vaisseau` | `Jeu.Vaisseau` | vaisseau du joueur (modèle, inclinaison, traînée) |
| `Camera` | `Camera`, `UniversalAdditionalCameraData`, `Jeu.CameraJeu` | caméra de poursuite |
| `Vitrine` | `Jeu.Vitrine` | vaisseau présenté dans les menus et le garage |
| `Interface` | `UIDocument`, `Interface.Interface` | tous les écrans et le HUD |
| `Soleil`, `Volume` | `Light`, `Volume` (post-traitement) | éclairage, étalonnage |

## 5. API C# entre les parties

### 5.1 `PortalRush.Jeu.Session` (exécution du jeu)

```csharp
public sealed class Lancement
{
  public Mode Mode = Mode.Campagne;
  public Difficulte Difficulte = Difficulte.Pilote;
  public int Niveau = 1;
  public string Vehicule = "aube";
  public double? Graine;      // null : tirée comme dans le jeu web (défi : graine du jour)
  public bool Tutoriel;       // partie scriptée du tutoriel
}

public sealed class Session : MonoBehaviour
{
  public static Session? Instance { get; }
  public Partie? Partie { get; }
  public Lancement? Lancement { get; }
  public bool EnCours { get; }            // une partie non terminée existe
  public bool EnPause { get; }
  public event Action<Partie>? Demarree;
  public event Action<Evenement>? EvenementJeu;   // chaque évènement du moteur, dans l'ordre
  public event Action<Resultat>? Terminee;
  public event Action<bool>? PauseChangee;
  public void Lancer(Lancement l);
  public void MettreEnPause(bool pause);
  public void Abandonner();               // retour au menu sans résultat
  public void Recommencer();              // même lancement, nouvelle graine (sauf défi)
  public void Deplacer(int sens);         // -1 gauche, +1 droite (aussi lu au clavier par Session)
  public void Overdrive();
}
```

Boucle : comme `rush.ts`, `dt = min(0.05, Time.unscaledDeltaTime)` accumulé et consommé par pas fixes de
**1/120 s** (`Partie.Avancer(1/120)`). Les évènements de la partie sont relayés (`EvenementJeu`) puis vidés.

Commandes en partie (identiques au jeu web) : gauche `←` `A` `Q` ; droite `→` `D` ; Overdrive `Espace` `↑` `W`
`Z` ; pause `P` ; `Échap` est traité par l'interface (pause en jeu, retour dans les menus, sortie vers le portfolio
depuis le menu principal). Tactile : réglage `tactile` = `toucher` (moitié gauche / droite) ou `glisser`.

### 5.2 `PortalRush.Jeu.Vitrine` et `PortalRush.Jeu.Qualite`

```csharp
public sealed class Vitrine : MonoBehaviour
{
  public static void Montrer(string vehicule, Equipement? equipement, bool garage);  // menus / garage
  public static void Masquer();
}
public static class Qualite
{
  public static string Mode { get; }                // "auto" | "elevee" | "equilibree" | "economie"
  public static string Effectif { get; }            // le niveau réellement appliqué (auto → l'un des trois)
  public static void Appliquer(string mode, bool effetsReduits);
}
```

### 5.3 `PortalRush.Jeu.Pont` (pont JavaScript)

Le composant écoute la page (`Recevoir`, cible de `SendMessage('Pont', 'Recevoir', json)`) et parle à la page par
le plugin `PortalRushPont.jslib` (`PortalRush_Envoyer(string json)` → `window.__portalRushUnity.recevoir(json)`).
Dans l'éditeur (pas de page), il simule le JavaScript : vue par défaut, bilan local minimal, aucune écriture
persistante, et journalise les messages envoyés.

```csharp
public sealed class Pont : MonoBehaviour
{
  public static Pont? Instance { get; }
  public static bool DansLaPage { get; }      // build Web avec le pont du portfolio
  public static Vue Vue { get; }              // dernière vue reçue
  public static Config? Config { get; }
  public static string Langue { get; }        // "fr" | "en"
  public static event Action<Config>? ConfigRecue;
  public static event Action<Vue>? VueChangee;
  public static event Action<Bilan>? BilanRecu;
  public static event Action<string>? LangueChangee;
  public static event Action<EtatRadio>? RadioChangee;
  public static event Action? PauseDemandee, ReprendreDemandee, FermetureDemandee;
  public void Recevoir(string json);
  public static void Pret();
  public static void Ecran(string nom);                                     // voir §5.4
  public static void EvenementJeu(Evenement e);                             // sons, musique, comme rush.ts
  public static void Moteur(bool actif, double vitesse, bool overdrive);    // 10 fois par seconde au plus
  public static void Fin(Lancement l, double graine, Resultat r);
  public static void Reglages(Reglages r);
  public static void ChoisirVehicule(string id);
  public static void Equiper(string emplacement, string piece);
  public static void Tutoriel(string etat, int phase);
  public static void Radio(string action, string? piste = null);
  public static void ChangerLangue(string langue);
  public static void Fermer();
}
```

### 5.4 Protocole des messages

Chaque message est un objet JSON `{"type": "...", ...}`.

**Page → Unity** (`SendMessage('Pont', 'Recevoir', json)`) :

| type | champs | effet |
|---|---|---|
| `config` | `vue`, `langue`, `intro` (bool : jouer la sortie du tunnel), `tutorielAFaire`, `audioDebloque`, `appareil` {`mobile`, `dpr`, `economie`} | premier message après le chargement |
| `vue` | `vue` | la progression ou les réglages ont changé |
| `bilan` | `bilan` (avec `vue`) | réponse à `fin` |
| `langue` | `langue` | la langue du site a changé |
| `radio` | `etat` | état de RUSH RADIO |
| `pause` / `reprendre` | — | onglet caché, fenêtre recouverte… |
| `fermer` | — | la page demande la fermeture (Unity coupe tout et répond `fermer`) |
| `audio` | `debloque` | l'audio du navigateur est débloqué |

**Unity → page** (`PortalRush_Envoyer`) :

| type | champs | effet côté page |
|---|---|---|
| `pret` | `version` | première image dessinée : la page peut fondre sa transition vers Unity |
| `ecran` | `nom` : `intro`, `menu`, `niveaux`, `garage`, `records`, `reglages`, `jeu`, `pause`, `fin`, `tutoriel` | musique de menu / de jeu, DREAM RADIO |
| `evenement` | `nom` (nom du moteur, ex. `fragment`, `fin-overdrive`), `valeur`, `voie` | sons et musique adaptative, comme `rush.ts` |
| `moteur` | `actif`, `vitesse`, `overdrive` | son du moteur (`moteurRush`) |
| `fin` | `mode`, `difficulte`, `niveau`, `vehicule`, `graine`, `resultat` (forme exacte de `Resultat` du jeu web) | `ranger(...)`, `enregistrer(...)`, puis répond `bilan` |
| `reglages` | `reglages` (objet complet) | enregistre, applique volume et qualité, répond `vue` |
| `vehicule` | `id` | change le vaisseau choisi, répond `vue` |
| `equiper` | `emplacement`, `piece` | équipe la pièce, répond `vue` |
| `tutoriel` | `etat`, `phase` | `noterTutoriel`, répond `vue` |
| `radio` | `action` (`lecture`, `pause`, `suivante`, `precedente`, `piste`), `piste` | pilote RUSH RADIO, répond `radio` |
| `langue` | `langue` | change la langue du site, répond `langue` |
| `fermer` | — | ferme le jeu, restaure le portfolio, rend le focus |
| `erreur` | `message` | journal, repli éventuel vers l'ancien jeu |

### 5.5 Formes des données (`JsonUtility`)

```csharp
[Serializable] public class Reglages { public double volume; public bool effetsReduits; public bool secousses;
  public bool aideCommandes; public string tactile; public bool musique; public double volumeMusique; public bool muet;
  public string piste; public string sequenceFin; public string qualite; }
[Serializable] public class ConditionVue { public string type; public double mesure; public double cible; public bool faite;
  public int niveau; public string rang; public string difficulte; public string stat; }
[Serializable] public class ScoreNiveau { public string difficulte; public bool reussi; public bool[] etoiles;
  public double record; public string rang; public double etoile; }   // etoile : score de l'étoile « score »
[Serializable] public class NiveauVue { public int id; public string theme; public bool debloque; public ScoreNiveau[] scores; }
[Serializable] public class DifficulteVue { public string id; public bool ouverte; }
[Serializable] public class VehiculeVue { public string id; public int modele; public bool debloque; public ConditionVue condition; }
[Serializable] public class PieceVue { public string id; public string emplacement; public string couleur;
  public bool debloquee; public bool equipee; public ConditionVue condition; }
[Serializable] public class Equipement { public string coque; public string trainee; public string overdrive; public string noyau; }
[Serializable] public class InfiniVue { public string difficulte; public double score; public double distance; }
[Serializable] public class DefiVue { public double graine; public double meilleur; public double dernier; public int tentatives; }
[Serializable] public class Totaux { public int parties; public int overdrives; public int parfaits; public double distance;
  public int multiplicateurMax; public double infiniMax; public bool rangS; public int meilleurCombo;
  public int meilleursParfaits; public double meilleureDistance; }
[Serializable] public class TutorielVue { public string etat; public int phase; public bool aFaire; }
[Serializable] public class DerniereVue { public bool existe; public string mode; public string difficulte; public int niveau; }
[Serializable] public class Vue { public int version; public string langue; public Reglages reglages; public TutorielVue tutoriel;
  public int niveauMax; public string difficulte; public string vehicule; public DifficulteVue[] difficultes;
  public NiveauVue[] niveaux; public VehiculeVue[] vehicules; public PieceVue[] pieces; public Equipement equipement;
  public InfiniVue[] infini; public DefiVue defi; public Totaux totaux; public double meilleurScore; public DerniereVue derniere; }
[Serializable] public class Bilan { public bool[] etoiles; public int[] nouvellesEtoiles; public bool record; public double ancienRecord;
  public int niveauDebloque; public bool cauchemarDebloque; public bool paradoxeDebloque; public string[] pieces;
  public string[] vehicules; public Vue vue; }
[Serializable] public class PisteRadio { public string id; public string titre; public string auteur; }
[Serializable] public class EtatRadio { public bool lecture; public string piste; public PisteRadio[] pistes; }
[Serializable] public class Appareil { public bool mobile; public double dpr; public bool economie; }
[Serializable] public class Config { public Vue vue; public string langue; public bool intro; public bool tutorielAFaire;
  public bool audioDebloque; public Appareil appareil; }
```

Ces classes vivent dans `Scripts/Jeu/Pont/Messages.cs` (espace de noms `PortalRush.Jeu`). La vue est calculée par le
JavaScript avec les fonctions existantes (`etoilesDe`, `avancement`, `difficulteOuverte`, `scoreEtoile`…) : Unity
n'a aucune règle de progression à réimplémenter. `niveauDebloque = 0` signifie « aucun ».

## 6. Intégration au portfolio

- Le build Web est copié dans `public/rush-unity/Build/` (`PortalRush.loader.js`, `.data`, `.framework.js`,
  `.wasm`, compressés en Brotli avec repli de décompression). Le portfolio n'utilise pas le `index.html` de Unity :
  il crée la toile dans la fenêtre Portal Rush existante et appelle `createUnityInstance`.
- Chargement à la demande : rien n'est téléchargé au chargement du portfolio. Préchargement discret (requêtes de
  faible priorité) quand le Hub orbital s'ouvre ou au survol du bouton Portal Rush ; chargement réel au clic,
  pendant la fissure et le tunnel temporel joués par le portfolio ; Unity enchaîne la sortie du tunnel (`intro`)
  et envoie `pret` à sa première image, la page fond alors sa transition : pas d'écran noir.
- Activation : drapeau `?rush=unity` (et réglage de développement) tant que la version n'est pas validée ; repli
  automatique sur l'ancien jeu si le build manque, si WebGL2 est absent ou si le chargement échoue.
- Focus clavier : la toile Unity reçoit le focus à l'ouverture ; `Échap` lui est transmis ; à la fermeture, le focus
  revient au bouton Portal Rush du Hub. Unity ne capture pas le clavier quand la toile n'a pas le focus.
- Audio : à l'ouverture, DREAM RADIO s'atténue et se suspend (et reprend à la fermeture dans son état précédent),
  comme pour l'ancien jeu ; le son de Unity est coupé (tout passe par le moteur audio du portfolio).

### 6.1 Manifeste du build

La construction (`Editeur/Construction.cs`) écrit, à côté du build, `public/rush-unity/portal-rush.json` : le
chargeur du portfolio ne lit que ce fichier pour trouver les autres (les noms changent selon la compression).

```json
{
  "version": "2026-10-18T12:00:00Z",
  "unity": "6000.3.xf1",
  "loader": "Build/PortalRush.loader.js",
  "data": "Build/PortalRush.data.unityweb",
  "framework": "Build/PortalRush.framework.js.unityweb",
  "code": "Build/PortalRush.wasm.unityweb",
  "octets": 25000000,
  "compression": "brotli",
  "repliDecompression": true
}
```

Absence du fichier (ou erreur de lecture) = pas de version Unity disponible → ancien jeu.

### 6.2 Points d'entrée du mode batch (PC)

Utilisés par `outils/unity/unity.ps1` (`Unity.exe -batchmode -projectPath unity/PortalRush -executeMethod …`) :

| Méthode | Rôle | Fin |
|---|---|---|
| `PortalRush.Installation.Installateur.InstallerEnBatch` | installe les paquets, ajoute `PORTALRUSH_PAQUETS` | `EditorApplication.Exit(0 / 1)` |
| `PortalRush.Editeur.Batch.Configurer` | URP, niveaux de qualité, réglages Web, matériaux, scène | `Exit(0 / 1)` |
| `PortalRush.Editeur.Batch.Construire` | build Web vers `public/rush-unity/` + manifeste | `Exit(0 / 1)` |
| `-runTests -testPlatform EditMode -testResults <fichier>` | rejeu des parties de référence | code de sortie de Unity |

Chaque étape est un lancement séparé de Unity : l'installation des paquets change la compilation, le lancement
suivant compile les assemblages gardés.

## 7. Vérifications

| Quoi | Où | Comment |
|---|---|---|
| Règles C# = règles TypeScript | ici (.NET 8) | `dotnet run -c Release` dans `outils/unity/coeur-tests` |
| Données C# à jour | ici | `node --experimental-strip-types --no-warnings outils/unity/exporter-donnees.mjs --verifier` |
| Rejeu dans Unity | PC (Unity) | Test Runner › EditMode, ou `outils/unity/unity.ps1 -Tests` |
| Compilation Unity, scène, build Web | PC (Unity) | `outils/unity/unity.ps1` (voir `docs/UNITY_MIGRATION.md`) |
| Pont et chargeur côté page | ici (Playwright) | recette avec une instance Unity simulée |
