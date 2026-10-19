// PORTAL RUSH (Unity) — L'IMPORT DES MODÈLES BLENDER (Assets/PortalRush/Modeles, voir son LISEZMOI.md)
//
// Les FBX sont produits par outils/assets/exporter_unity.py : un objet nommé par modèle logique, en mètres, le nez et
// le sens de la course vers +Z, une matière « PR_<nom> » par entrée de palette. Ce fichier :
//   - règle l'import de chaque FBX du dossier (échelle 1, normales du fichier, tangentes calculées, pas de rig ni
//     d'animation, pas de lecture/écriture, compression selon l'usage) ;
//   - crée ou met à jour les matériaux URP Lit Assets/PortalRush/Materiaux/Palette/PR_<nom>.mat depuis palette.json ;
//   - remplace les matériaux importés par ceux de la palette.
//
// Pourquoi le remappage (ModelImporter.AddRemap) plutôt que remplacer les matériaux dans OnPostprocessModel :
//   c'est le mécanisme natif de Unity (celui du bouton « Remap » de l'inspecteur) : il est écrit dans le .meta du
//   modèle, Unity ne fabrique plus de matériau intégré pour ces noms, le prefab importé pointe directement sur le
//   matériau partagé, et le résultat ne dépend plus de ce script une fois écrit. OnPostprocessModel laisserait des
//   matériaux intégrés orphelins et dépendrait de l'ordre d'import ; SearchAndRemapMaterials cherche par nom dans tout
//   le projet (il pourrait prendre un autre « PR_… ») et ne doit pas être appelé pendant un import.
//   Créer des assets pendant un import est interdit : les .mat sont donc créés après l'import (OnPostprocessAllAssets,
//   puis EditorApplication.delayCall), et un modèle importé avant eux est réimporté une fois, ses remappages posés.
#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.AssetImporters;
using UnityEngine;

namespace PortalRush.Editeur
{
  // ---------------------------------------------------------------------------------------------------------------
  // palette.json
  // ---------------------------------------------------------------------------------------------------------------
  [Serializable]
  public sealed class EntreePalette
  {
    public string nom = "";
    public string source = "";
    public string famille = "";
    public string hex = "";
    /** sRGB 0-1, comme le jeu web (Material.SetColor la linéarise dans un projet en espace linéaire). */
    public float[] couleur = new float[3];
    public float metal;
    public float rugosite;
    public float emission;
    /** fixe, peinture, accent, accent2, danger, coeur, ligne, fissure, clignote, peinture2, revetement. */
    public string canal = "fixe";

    public Color CouleurSrgb => couleur != null && couleur.Length >= 3 ? new Color(couleur[0], couleur[1], couleur[2], 1f) : Color.gray;

    /** L'émission en linéaire (HDR), comme le jeu web : couleur linéaire × émission × facteur. */
    public Color EmissionLineaire(float facteur)
    {
      Color c = CouleurSrgb.linear * (emission * facteur);
      c.a = 1f;
      return c;
    }
  }

  [Serializable]
  public sealed class CanalPalette
  {
    public string nom = "";
    public int index;
    /** D'où vient la couleur : palette, peinture, accent, accent2, danger, coeur. */
    public string couleur = "";
    public bool anime;
    public string role = "";
  }

  [Serializable]
  sealed class FichierPalette
  {
    public int version = 1;
    public string espaceCouleur = "sRGB";
    public float facteurEmission = 3.2f;
    public EntreePalette[] matieres = Array.Empty<EntreePalette>();
    public CanalPalette[] canaux = Array.Empty<CanalPalette>();
  }

  /** La palette des matières des modèles (palette.json) et ses matériaux URP. */
  public static class Palette
  {
    public const string DossierModeles = "Assets/PortalRush/Modeles";
    public const string Chemin = DossierModeles + "/palette.json";
    public const string DossierMateriaux = "Assets/PortalRush/Materiaux/Palette";
    public const string NomShader = "Universal Render Pipeline/Lit";
    /** Étiquette posée sur chaque matériau : son canal, lisible en jeu par material.GetTag(EtiquetteCanal, false). */
    public const string EtiquetteCanal = "PortalRushCanal";

    static FichierPalette? fichier;
    static Dictionary<string, EntreePalette>? parNom;
    static bool shaderSignale;

    public static IReadOnlyList<EntreePalette> Entrees => Lire().matieres;
    public static IReadOnlyList<CanalPalette> Canaux => Lire().canaux;
    public static float FacteurEmission => Lire().facteurEmission;

    public static bool Trouver(string nom, out EntreePalette entree)
    {
      Lire();
      if (parNom != null && parNom.TryGetValue(nom, out var e))
      {
        entree = e;
        return true;
      }
      entree = new EntreePalette();
      return false;
    }

    /** Les noms des matières d'un canal (ex. « peinture » : les matériaux qui prennent la couleur du garage). */
    public static List<string> DuCanal(string canal)
    {
      var noms = new List<string>();
      foreach (var e in Entrees) if (e.canal == canal) noms.Add(e.nom);
      return noms;
    }

    public static string CheminMateriau(string nom) => DossierMateriaux + "/" + nom + ".mat";

    public static Material? Materiau(string nom) => AssetDatabase.LoadAssetAtPath<Material>(CheminMateriau(nom));

    public static void Recharger()
    {
      fichier = null;
      parNom = null;
    }

    static FichierPalette Lire()
    {
      if (fichier != null) return fichier;
      fichier = new FichierPalette();
      parNom = new Dictionary<string, EntreePalette>();
      if (!File.Exists(Chemin))
      {
        Debug.LogWarning("[Portal Rush] " + Chemin + " introuvable : lancer outils/assets/exporter_unity.py.");
        return fichier;
      }
      try
      {
        fichier = JsonUtility.FromJson<FichierPalette>(File.ReadAllText(Chemin)) ?? new FichierPalette();
      }
      catch (Exception ex)
      {
        Debug.LogWarning("[Portal Rush] palette.json illisible : " + ex.Message);
        fichier = new FichierPalette();
      }
      fichier.matieres ??= Array.Empty<EntreePalette>();
      fichier.canaux ??= Array.Empty<CanalPalette>();
      foreach (var e in fichier.matieres) if (!string.IsNullOrEmpty(e.nom)) parNom[e.nom] = e;
      return fichier;
    }

    /**
     * Crée ou met à jour les matériaux URP Lit de la palette (seulement ce qui a changé). Rend le nombre de
     * matériaux créés ou modifiés, ou −1 si le shader URP est introuvable (URP pas encore installé : rien n'est fait,
     * les modèles gardent leurs matériaux importés).
     */
    public static int MettreAJourMateriaux()
    {
      var shader = Shader.Find(NomShader);
      if (shader == null)
      {
        if (!shaderSignale)
        {
          shaderSignale = true;
          Debug.LogWarning("[Portal Rush] Shader « " + NomShader + " » introuvable (URP n'est pas encore installé ?) : " +
            "matériaux de la palette non créés, les modèles gardent leurs matériaux importés. Relancer Portal Rush › Modèles › Synchroniser après l'installation.");
        }
        return -1;
      }
      if (Entrees.Count == 0) return 0;
      CreerDossier(DossierMateriaux);
      int changes = 0;
      AssetDatabase.StartAssetEditing();
      try
      {
        foreach (var e in Entrees)
        {
          string chemin = CheminMateriau(e.nom);
          var m = AssetDatabase.LoadAssetAtPath<Material>(chemin);
          if (m == null)
          {
            m = new Material(shader) { name = e.nom };
            Appliquer(m, shader, e, FacteurEmission);
            AssetDatabase.CreateAsset(m, chemin);
            changes++;
          }
          else if (Appliquer(m, shader, e, FacteurEmission))
          {
            EditorUtility.SetDirty(m);
            changes++;
          }
        }
      }
      finally
      {
        AssetDatabase.StopAssetEditing();
      }
      if (changes > 0) AssetDatabase.SaveAssets();
      return changes;
    }

    /** Règle un matériau URP Lit (flux métallique, opaque) d'après l'entrée ; rend vrai s'il a changé. */
    static bool Appliquer(Material m, Shader shader, EntreePalette e, float facteur)
    {
      bool change = false;
      if (m.shader != shader)
      {
        m.shader = shader;
        change = true;
      }
      Color baseSrgb = e.CouleurSrgb;
      change |= Couleur(m, "_BaseColor", baseSrgb);
      change |= Couleur(m, "_Color", baseSrgb);  // (la copie lue par le précalcul d'éclairage, comme le fait URP)
      change |= Nombre(m, "_WorkflowMode", 1f);  // 1 : métallique
      change |= Nombre(m, "_Metallic", Mathf.Clamp01(e.metal));
      change |= Nombre(m, "_Smoothness", Mathf.Clamp01(1f - e.rugosite));
      // L'émission : la valeur voulue est linéaire (HDR) ; les couleurs d'un matériau sont rangées en gamma et
      // linéarisées au rendu, d'où .gamma (comme le fait URP pour la couleur de base des FBX).
      bool emissif = e.emission > 0f;
      change |= Couleur(m, "_EmissionColor", emissif ? e.EmissionLineaire(facteur).gamma : Color.black);
      change |= MotCle(m, "_EMISSION", emissif);
      change |= MotCle(m, "_SPECULAR_SETUP", false);
      // Seul l'éclairage précalculé existe dans le build Web : l'émission y contribue (BakedEmissive).
      var gi = emissif ? MaterialGlobalIlluminationFlags.BakedEmissive : MaterialGlobalIlluminationFlags.EmissiveIsBlack;
      if (m.globalIlluminationFlags != gi)
      {
        m.globalIlluminationFlags = gi;
        change = true;
      }
      if (!m.enableInstancing)
      {
        m.enableInstancing = true;  // (modules répétés : bordures, roches… ; le SRP Batcher reste prioritaire)
        change = true;
      }
      if (m.GetTag(EtiquetteCanal, false) != e.canal)
      {
        m.SetOverrideTag(EtiquetteCanal, e.canal);
        change = true;
      }
      return change;
    }

    static bool Couleur(Material m, string propriete, Color c)
    {
      if (!m.HasProperty(propriete)) return false;
      Color a = m.GetColor(propriete);
      if (Mathf.Abs(a.r - c.r) < 1e-4f && Mathf.Abs(a.g - c.g) < 1e-4f && Mathf.Abs(a.b - c.b) < 1e-4f && Mathf.Abs(a.a - c.a) < 1e-4f) return false;
      m.SetColor(propriete, c);
      return true;
    }

    static bool Nombre(Material m, string propriete, float v)
    {
      if (!m.HasProperty(propriete) || Mathf.Abs(m.GetFloat(propriete) - v) < 1e-5f) return false;
      m.SetFloat(propriete, v);
      return true;
    }

    static bool MotCle(Material m, string mot, bool actif)
    {
      if (m.IsKeywordEnabled(mot) == actif) return false;
      if (actif) m.EnableKeyword(mot);
      else m.DisableKeyword(mot);
      return true;
    }

    static void CreerDossier(string chemin)
    {
      if (AssetDatabase.IsValidFolder(chemin)) return;
      string parent = Path.GetDirectoryName(chemin)!.Replace('\\', '/');
      CreerDossier(parent);
      AssetDatabase.CreateFolder(parent, Path.GetFileName(chemin));
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // modeles.json (le manifeste écrit par l'export) : fichiers, objets, matières, bornes et ancrages (repère Unity)
  // ---------------------------------------------------------------------------------------------------------------
  [Serializable]
  public sealed class AncrageModele
  {
    /** tuyere, emetteur ou halo. */
    public string type = "";
    public float[] position = new float[3];
    public float rayon;
    public float[] couleur = Array.Empty<float>();
    public float intensite;
  }

  [Serializable]
  public sealed class ObjetModele
  {
    public string nom = "";
    public int triangles;
    public string[] matieres = Array.Empty<string>();
    public float[] min = new float[3];
    public float[] max = new float[3];
    public AncrageModele[] ancrages = Array.Empty<AncrageModele>();
  }

  [Serializable]
  public sealed class FichierModele
  {
    /** Relatif à Assets/PortalRush/Modeles (ex. « Obstacles/rochers.fbx »). */
    public string chemin = "";
    public string dossier = "";
    public string source = "";
    public ObjetModele[] objets = Array.Empty<ObjetModele>();
    public long octets;
  }

  [Serializable]
  sealed class FichierManifeste
  {
    public int version = 1;
    public FichierModele[] fichiers = Array.Empty<FichierModele>();
  }

  public static class Manifeste
  {
    public const string Chemin = Palette.DossierModeles + "/modeles.json";
    static FichierManifeste? lu;

    public static IReadOnlyList<FichierModele> Fichiers
    {
      get
      {
        if (lu != null) return lu.fichiers;
        lu = new FichierManifeste();
        try
        {
          if (File.Exists(Chemin)) lu = JsonUtility.FromJson<FichierManifeste>(File.ReadAllText(Chemin)) ?? new FichierManifeste();
        }
        catch (Exception ex)
        {
          Debug.LogWarning("[Portal Rush] modeles.json illisible : " + ex.Message);
        }
        lu.fichiers ??= Array.Empty<FichierModele>();
        return lu.fichiers;
      }
    }

    /** L'entrée du manifeste pour un chemin d'asset (« Assets/PortalRush/Modeles/… »), ou null. */
    public static FichierModele? De(string cheminAsset)
    {
      string relatif = cheminAsset.StartsWith(Palette.DossierModeles + "/", StringComparison.Ordinal) ? cheminAsset.Substring(Palette.DossierModeles.Length + 1) : cheminAsset;
      foreach (var f in Fichiers) if (f.chemin == relatif) return f;
      return null;
    }

    public static void Recharger() => lu = null;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // L'import
  // ---------------------------------------------------------------------------------------------------------------
  public sealed class ImportModeles : AssetPostprocessor
  {
    // (Changer ce numéro réimporte les modèles : à augmenter quand les réglages ci-dessous changent.)
    public override uint GetVersion() => 1;

    static readonly HashSet<string> enAttente = new HashSet<string>();
    static readonly HashSet<string> dejaReimportes = new HashSet<string>();
    static bool programme, tout;

    static bool Concerne(string chemin) =>
      chemin.StartsWith(Palette.DossierModeles + "/", StringComparison.Ordinal) && chemin.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase);

    static string DossierDe(string chemin)
    {
      string relatif = chemin.Substring(Palette.DossierModeles.Length + 1);
      int i = relatif.IndexOf('/');
      return i < 0 ? "" : relatif.Substring(0, i);
    }

    void OnPreprocessModel()
    {
      if (!Concerne(assetPath) || !(assetImporter is ModelImporter importeur)) return;
      string dossier = DossierDe(assetPath);

      // La scène : mètres (unité du fichier = 1 m), axes déjà ceux de Unity, une racine explicite par fichier
      // (chaque modèle logique est un enfant nommé : « roches/roche-2 »).
      importeur.globalScale = 1f;
      importeur.useFileScale = true;
      importeur.bakeAxisConversion = false;
      importeur.preserveHierarchy = true;
      importeur.sortHierarchyByName = true;
      importeur.importVisibility = false;
      importeur.importCameras = false;
      importeur.importLights = false;
      importeur.importBlendShapes = false;
      importeur.addCollider = false;  // (les collisions sont celles du moteur de règles)

      // Les maillages : normales du fichier (celles du jeu web, arêtes vives comprises), tangentes MikkTSpace (UV
      // en projection boîte, 1 unité = 1 m), pas de copie lisible en mémoire.
      importeur.importNormals = ModelImporterNormals.Import;
      importeur.importTangents = ModelImporterTangents.CalculateMikk;
      importeur.isReadable = false;
      importeur.keepQuads = false;
      importeur.weldVertices = true;
      importeur.indexFormat = ModelImporterIndexFormat.Auto;
      importeur.meshOptimizationFlags = MeshOptimizationFlags.Everything;
      // Compression : aucune pour la route (les modules se raccordent bord à bord, sans fente), légère pour les
      // vaisseaux (vus de près au garage), moyenne pour le reste (taille du build Web).
      importeur.meshCompression = dossier == "Piste" ? ModelImporterMeshCompression.Off
        : dossier == "Vaisseaux" ? ModelImporterMeshCompression.Low
        : ModelImporterMeshCompression.Medium;
      // Pas d'UV de lightmap : route, décor et obstacles sont posés en cours de partie (Route, Decor, Objets), où un
      // précalcul ne s'applique pas. À activer ici pour un décor posé à la main dans une scène et précalculé.
      importeur.generateSecondaryUV = false;

      // Ni rig ni animation (les pièces mobiles sont des objets séparés, animés par le jeu).
      importeur.animationType = ModelImporterAnimationType.None;
      importeur.importAnimation = false;
      importeur.importConstraints = false;

      // Les matériaux : importés par description (le défaut de Unity 6), puis remappés vers ceux de la palette.
      importeur.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
      importeur.materialLocation = ModelImporterMaterialLocation.InPrefab;
      if (context != null)
      {
        // (Réimporter si la palette ou le manifeste changent : nouvelles matières à remapper.)
        if (File.Exists(Palette.Chemin)) context.DependsOnSourceAsset(Palette.Chemin);
        if (File.Exists(Manifeste.Chemin)) context.DependsOnSourceAsset(Manifeste.Chemin);
      }
      Remapper(importeur, assetPath, context);
    }

    /** Les matières d'un fichier : celles du manifeste, sinon toute la palette. */
    static IEnumerable<string> MatieresDe(string chemin)
    {
      var f = Manifeste.De(chemin);
      if (f == null)
      {
        foreach (var e in Palette.Entrees) yield return e.nom;
        yield break;
      }
      var vues = new HashSet<string>();
      foreach (var o in f.objets)
        foreach (var m in o.matieres)
          if (vues.Add(m)) yield return m;
    }

    /** Pose les remappages « PR_<nom> » → matériau de la palette (ceux qui existent déjà). */
    static int Remapper(ModelImporter importeur, string chemin, AssetImportContext? ctx)
    {
      int n = 0;
      foreach (var nom in MatieresDe(chemin))
      {
        string cheminMat = Palette.CheminMateriau(nom);
        if (!File.Exists(cheminMat)) continue;
        // (Pendant un import, un asset chargé doit être déclaré : Unity l'importe d'abord et suit ses changements.)
        ctx?.DependsOnArtifact(cheminMat);
        var m = AssetDatabase.LoadAssetAtPath<Material>(cheminMat);
        if (m == null) continue;
        importeur.AddRemap(new AssetImporter.SourceAssetIdentifier(typeof(Material), nom), m);
        n++;
      }
      return n;
    }

    static void OnPostprocessAllAssets(string[] importes, string[] supprimes, string[] deplaces, string[] depuis)
    {
      bool palette = false;
      foreach (var c in importes)
      {
        if (c == Palette.Chemin) palette = true;
        else if (c == Manifeste.Chemin) Manifeste.Recharger();
        else if (Concerne(c)) enAttente.Add(c);
      }
      if (palette)
      {
        Palette.Recharger();
        tout = true;
      }
      if ((enAttente.Count == 0 && !tout) || programme) return;
      // (Hors du cycle d'import : on peut y créer des assets et réimporter.)
      programme = true;
      EditorApplication.delayCall += () =>
      {
        programme = false;
        var chemins = tout ? null : new List<string>(enAttente);
        enAttente.Clear();
        tout = false;
        Synchroniser(chemins);
      };
    }

    /**
     * Matériaux de la palette à jour, puis chaque modèle vérifié : s'il ne pointe pas sur les matériaux de la palette
     * (importé avant leur création), ses remappages sont posés et il est réimporté (une fois par session au plus).
     * À appeler aussi depuis le mode batch (Batch.Configurer), où delayCall n'a pas toujours le temps de passer.
     */
    public static void Synchroniser(IEnumerable<string>? chemins = null)
    {
      if (Palette.MettreAJourMateriaux() < 0) return;
      var aReimporter = new List<string>();
      foreach (var chemin in chemins ?? TousLesModeles())
      {
        if (MateriauxAJour(chemin)) continue;
        if (!dejaReimportes.Add(chemin))
        {
          Debug.LogWarning("[Portal Rush] " + chemin + " : les matériaux de la palette n'ont pas pu être appliqués (voir l'onglet Materials du modèle).");
          continue;
        }
        if (AssetImporter.GetAtPath(chemin) is ModelImporter importeur && Remapper(importeur, chemin, null) > 0)
        {
          AssetDatabase.WriteImportSettingsIfDirty(chemin);
          aReimporter.Add(chemin);
        }
      }
      if (aReimporter.Count == 0) return;
      AssetDatabase.StartAssetEditing();
      try
      {
        foreach (var c in aReimporter) AssetDatabase.ImportAsset(c, ImportAssetOptions.ForceUpdate);
      }
      finally
      {
        AssetDatabase.StopAssetEditing();
      }
      Debug.Log("[Portal Rush] Modèles réimportés avec les matériaux de la palette : " + aReimporter.Count);
    }

    /** Vrai si chaque matériau « PR_… » du modèle importé est bien celui de la palette. */
    static bool MateriauxAJour(string chemin)
    {
      var racine = AssetDatabase.LoadAssetAtPath<GameObject>(chemin);
      if (racine == null) return true;
      foreach (var r in racine.GetComponentsInChildren<Renderer>(true))
        foreach (var m in r.sharedMaterials)
        {
          if (m == null || !m.name.StartsWith("PR_", StringComparison.Ordinal)) continue;
          var attendu = Palette.Materiau(m.name);
          if (attendu != null && attendu != m) return false;
        }
      return true;
    }

    static List<string> TousLesModeles()
    {
      var liste = new List<string>();
      if (!Directory.Exists(Palette.DossierModeles)) return liste;
      foreach (var f in Directory.GetFiles(Palette.DossierModeles, "*.fbx", SearchOption.AllDirectories))
        liste.Add(f.Replace('\\', '/'));
      liste.Sort(StringComparer.Ordinal);
      return liste;
    }

    [MenuItem("Portal Rush/Modèles/Synchroniser les matériaux de la palette")]
    static void MenuSynchroniser()
    {
      Palette.Recharger();
      Manifeste.Recharger();
      dejaReimportes.Clear();
      Synchroniser();
    }
  }
}
