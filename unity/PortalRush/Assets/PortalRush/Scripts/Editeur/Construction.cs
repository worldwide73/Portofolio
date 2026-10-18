// PORTAL RUSH (Unity) — LA CONSTRUCTION DU BUILD WEB pour le portfolio
//
// Construit la scène en WebGL dans unity/PortalRush/Builds/PortalRush (ignoré par git), puis copie le dossier Build/
// dans public/rush-unity/Build/ du dépôt et écrit public/rush-unity/portal-rush.json, le manifeste que lit le
// chargeur du portfolio (docs/UNITY_ARCHITECTURE.md §6.1). Le index.html de Unity n'est pas utilisé.
// Rien n'est publié : le build reste local tant que l'utilisateur ne décide pas de le mettre en ligne.
// Menu : Portal Rush › 4. Construire pour le portfolio (Web). Batch : PortalRush.Editeur.Batch.Construire.
#nullable enable
using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace PortalRush.Editeur
{
  public static class Construction
  {
    static string Projet => Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
    static string Depot => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", ".."));
    public static string Sortie => Path.Combine(Projet, "Builds", "PortalRush");
    public static string Public => Path.Combine(Depot, "public", "rush-unity");

    [MenuItem("Portal Rush/4. Construire pour le portfolio (Web)", false, 4)]
    static void Menu()
    {
      bool ok = Construire(out string message);
      EditorUtility.DisplayDialog("Portal Rush", message, "OK");
      if (ok) EditorUtility.RevealInFinder(Public);
    }

    public static bool Construire(out string message)
    {
      if (!File.Exists(Path.Combine(Projet, Scene.Chemin)))
      {
        message = "La scène n'existe pas encore : Portal Rush › 2. Configurer le projet.";
        Debug.LogError("[Portal Rush] " + message);
        return false;
      }
      if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.WebGL)
        EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.WebGL, BuildTarget.WebGL);

      if (Directory.Exists(Sortie)) Directory.Delete(Sortie, true);
      var options = new BuildPlayerOptions
      {
        scenes = new[] { Scene.Chemin },
        locationPathName = Sortie,
        target = BuildTarget.WebGL,
        targetGroup = BuildTargetGroup.WebGL,
        options = BuildOptions.None,
      };
      var rapport = BuildPipeline.BuildPlayer(options);
      if (rapport.summary.result != BuildResult.Succeeded)
      {
        message = $"La construction a échoué ({rapport.summary.result}, {rapport.summary.totalErrors} erreur(s)). Voir la console.";
        Debug.LogError("[Portal Rush] " + message);
        return false;
      }

      string build = Path.Combine(Sortie, "Build");
      string[] fichiers = Directory.GetFiles(build).Select(f => Path.GetFileName(f) ?? "").Where(f => f.Length > 0).ToArray();
      string? Trouver(string fin) => fichiers.FirstOrDefault(f => f.EndsWith(fin, StringComparison.Ordinal) || f.Contains(fin + "."));
      string? loader = fichiers.FirstOrDefault(f => f.EndsWith(".loader.js", StringComparison.Ordinal));
      string? data = Trouver(".data");
      string? framework = Trouver(".framework.js");
      string? code = Trouver(".wasm");
      if (loader == null || data == null || framework == null || code == null)
      {
        message = "Build incomplet : fichiers attendus introuvables dans " + build;
        Debug.LogError("[Portal Rush] " + message);
        return false;
      }

      // Copie vers public/rush-unity/Build (on repart d'un dossier propre).
      string cible = Path.Combine(Public, "Build");
      if (Directory.Exists(cible)) Directory.Delete(cible, true);
      Directory.CreateDirectory(cible);
      long octets = 0;
      foreach (string f in fichiers)
      {
        File.Copy(Path.Combine(build, f), Path.Combine(cible, f), true);
        octets += new FileInfo(Path.Combine(cible, f)).Length;
      }

      string compression = PlayerSettings.WebGL.compressionFormat == WebGLCompressionFormat.Brotli ? "brotli" : PlayerSettings.WebGL.compressionFormat == WebGLCompressionFormat.Gzip ? "gzip" : "aucune";
      var json = new StringBuilder();
      json.Append("{\n");
      json.Append($"  \"version\": \"{DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture)}\",\n");
      json.Append($"  \"unity\": \"{Application.unityVersion}\",\n");
      json.Append($"  \"loader\": \"Build/{loader}\",\n");
      json.Append($"  \"data\": \"Build/{data}\",\n");
      json.Append($"  \"framework\": \"Build/{framework}\",\n");
      json.Append($"  \"code\": \"Build/{code}\",\n");
      json.Append($"  \"octets\": {octets.ToString(CultureInfo.InvariantCulture)},\n");
      json.Append($"  \"compression\": \"{compression}\",\n");
      json.Append($"  \"repliDecompression\": {(PlayerSettings.WebGL.decompressionFallback ? "true" : "false")}\n");
      json.Append("}\n");
      File.WriteAllText(Path.Combine(Public, "portal-rush.json"), json.ToString());

      message = $"Build Web prêt ({octets / (1024f * 1024f):0.0} Mo) dans public/rush-unity/. Rien n'a été publié.\nPour l'essayer : npm run dev, puis le portfolio avec ?rush=unity.";
      Debug.Log("[Portal Rush] " + message);
      return true;
    }
  }
}
