// PORTAL RUSH (Unity) — LA CONFIGURATION DU PROJET (rendu URP, niveaux de qualité, réglages Web)
//
// Tout est écrit par code, à partir de rien, et peut être relancé sans risque (les assets existants sont mis à jour) :
//   • trois assets URP (Economie, Equilibree, Elevee), chacun avec son renderer « Forward » (Forward+ est signalé
//     instable sur le Web ; voir docs/UNITY_MIGRATION.md), le SSAO seulement en Élevée ;
//   • trois niveaux de qualité Unity portant ces assets (Équilibrée par défaut, aussi pour le Web) ;
//   • les réglages du lecteur Web : espace de couleur linéaire, WebGL2, compression Brotli avec repli de
//     décompression (le build marche même si le serveur n'envoie pas l'en-tête Content-Encoding), WebAssembly,
//     exceptions explicites seulement, cache des données, GPU « haute performance ».
// Menu : Portal Rush › 2. Configurer le projet. Batch : PortalRush.Editeur.Batch.Configurer.
#nullable enable
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace PortalRush.Editeur
{
  public static class Configuration
  {
    public const string Racine = "Assets/PortalRush";
    public const string DossierRendu = Racine + "/Rendu";
    public const string DossierMateriaux = Racine + "/Materiaux";
    public const string DossierScenes = Racine + "/Scenes";
    const string DonneesPostTraitement = "Packages/com.unity.render-pipelines.universal/Runtime/Data/PostProcessData.asset";

    /** Nom (= nom du niveau de qualité, lu par Jeu/Qualite.cs), MSAA, échelle de rendu, HDR, ombres, cascades, distance des ombres, SSAO, lumières ponctuelles. */
    sealed class Niveau
    {
      public string Nom = "";
      public int Msaa = 1;
      public float Echelle = 1f;
      public bool Hdr = true;
      public int Ombres;
      public int Cascades = 1;
      public float DistanceOmbres = 80f;
      public bool Ssao;
      public int Lumieres;
      public float LodBias = 1f;
    }

    static readonly Niveau[] Niveaux =
    {
      new Niveau { Nom = "Economie", Msaa = 1, Echelle = 0.7f, Hdr = false, Ombres = 0, Cascades = 1, DistanceOmbres = 0, Ssao = false, Lumieres = 0, LodBias = 0.6f },
      new Niveau { Nom = "Equilibree", Msaa = 1, Echelle = 0.9f, Hdr = true, Ombres = 1024, Cascades = 1, DistanceOmbres = 70, Ssao = false, Lumieres = 2, LodBias = 1f },
      new Niveau { Nom = "Elevee", Msaa = 4, Echelle = 1f, Hdr = true, Ombres = 2048, Cascades = 2, DistanceOmbres = 120, Ssao = true, Lumieres = 4, LodBias = 1.5f },
    };

    [MenuItem("Portal Rush/2. Configurer le projet", false, 2)]
    static void Menu()
    {
      Tout();
      Scene.Construire();
      EditorUtility.DisplayDialog("Portal Rush", "Projet configuré et scène construite (Assets/PortalRush/Scenes/PortalRush.unity).\n\nEnsuite : Window › General › Test Runner (EditMode), puis Play.", "OK");
    }

    public static void Tout()
    {
      Dossier(DossierRendu);
      Dossier(DossierMateriaux);
      Dossier(DossierScenes);
      var assets = new List<UniversalRenderPipelineAsset>();
      foreach (var n in Niveaux) assets.Add(Rendu(n));
      Qualites(assets);
      GraphicsSettings.defaultRenderPipeline = assets[1];
      Lecteur();
      AssetDatabase.SaveAssets();
      AssetDatabase.Refresh();
      Debug.Log("[Portal Rush] Configuration terminée (URP, qualité, Web).");
    }

    public static void Dossier(string chemin)
    {
      if (AssetDatabase.IsValidFolder(chemin)) return;
      string parent = Path.GetDirectoryName(chemin)!.Replace('\\', '/');
      Dossier(parent);
      AssetDatabase.CreateFolder(parent, Path.GetFileName(chemin));
    }

    static UniversalRenderPipelineAsset Rendu(Niveau n)
    {
      string cheminRendu = $"{DossierRendu}/Rendu_{n.Nom}.asset";
      string cheminAsset = $"{DossierRendu}/URP_{n.Nom}.asset";
      var donnees = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(cheminRendu);
      if (donnees == null)
      {
        // Comme le menu de l'éditeur (UniversalRenderPipelineAsset.CreateRendererData) : données de post-traitement par défaut.
        donnees = ScriptableObject.CreateInstance<UniversalRendererData>();
        donnees.postProcessData = AssetDatabase.LoadAssetAtPath<PostProcessData>(DonneesPostTraitement);
        AssetDatabase.CreateAsset(donnees, cheminRendu);
      }
      if (donnees.postProcessData == null) donnees.postProcessData = AssetDatabase.LoadAssetAtPath<PostProcessData>(DonneesPostTraitement);
      if (donnees.postProcessData == null) Debug.LogWarning("[Portal Rush] PostProcessData introuvable : le post-traitement sera inactif.");
      donnees.renderingMode = RenderingMode.Forward;
      donnees.depthPrimingMode = DepthPrimingMode.Disabled;
      ReglerSsao(donnees, n.Ssao);
      EditorUtility.SetDirty(donnees);

      var urp = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(cheminAsset);
      if (urp == null)
      {
        urp = UniversalRenderPipelineAsset.Create(donnees);
        AssetDatabase.CreateAsset(urp, cheminAsset);
      }
      urp.msaaSampleCount = n.Msaa;
      urp.renderScale = n.Echelle;
      urp.supportsHDR = n.Hdr;
      urp.colorGradingMode = n.Hdr ? ColorGradingMode.HighDynamicRange : ColorGradingMode.LowDynamicRange;
      urp.supportsMainLightShadows = n.Ombres > 0;
      urp.mainLightShadowmapResolution = Mathf.Max(256, n.Ombres);
      urp.shadowCascadeCount = n.Cascades;
      urp.shadowDistance = n.DistanceOmbres;
      urp.supportsSoftShadows = n.Ombres >= 2048;
      urp.additionalLightsRenderingMode = n.Lumieres > 0 ? LightRenderingMode.PerPixel : LightRenderingMode.Disabled;
      urp.maxAdditionalLightsCount = n.Lumieres;
      urp.supportsAdditionalLightShadows = false;
      urp.supportsCameraDepthTexture = n.Ssao;
      urp.supportsCameraOpaqueTexture = false;
      urp.useSRPBatcher = true;
      urp.supportsDynamicBatching = false;
      urp.reflectionProbeBlending = false;
      urp.reflectionProbeBoxProjection = false;
      // Le GPU Resident Drawer demande des compute shaders : jamais sur le Web.
      urp.gpuResidentDrawerMode = GPUResidentDrawerMode.Disabled;
      EditorUtility.SetDirty(urp);
      return urp;
    }

    static void ReglerSsao(UniversalRendererData donnees, bool voulu)
    {
      ScreenSpaceAmbientOcclusion? existant = null;
      foreach (var f in donnees.rendererFeatures) if (f is ScreenSpaceAmbientOcclusion s) existant = s;
      if (voulu && existant == null)
      {
        var ssao = ScriptableObject.CreateInstance<ScreenSpaceAmbientOcclusion>();
        ssao.name = "SSAO";
        AssetDatabase.AddObjectToAsset(ssao, donnees);
        donnees.rendererFeatures.Add(ssao);
      }
      else if (!voulu && existant != null)
      {
        donnees.rendererFeatures.Remove(existant);
        AssetDatabase.RemoveObjectFromAsset(existant);
        Object.DestroyImmediate(existant, true);
      }
    }

    /** Trois niveaux de qualité, portant chacun son asset URP (pas d'API publique : réglages sérialisés, comme l'inspecteur). */
    static void Qualites(List<UniversalRenderPipelineAsset> assets)
    {
      var objets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/QualitySettings.asset");
      if (objets == null || objets.Length == 0)
      {
        Debug.LogError("[Portal Rush] QualitySettings.asset introuvable.");
        return;
      }
      var so = new SerializedObject(objets[0]);
      var liste = so.FindProperty("m_QualitySettings");
      liste.arraySize = Niveaux.Length;
      for (int i = 0; i < Niveaux.Length; i++)
      {
        var e = liste.GetArrayElementAtIndex(i);
        Ecrire(e, "name", Niveaux[i].Nom);
        var rp = e.FindPropertyRelative("customRenderPipeline");
        if (rp != null) rp.objectReferenceValue = assets[i];
        Ecrire(e, "antiAliasing", 0);
        Ecrire(e, "vSyncCount", 0);
        Ecrire(e, "lodBias", Niveaux[i].LodBias);
        Ecrire(e, "realtimeReflectionProbes", true);
        Ecrire(e, "anisotropicTextures", i == 0 ? 0 : 2);
        var exclus = e.FindPropertyRelative("excludedTargetPlatforms");
        if (exclus != null) exclus.ClearArray();
      }
      var courant = so.FindProperty("m_CurrentQuality");
      if (courant != null) courant.intValue = 1;
      var defauts = so.FindProperty("m_PerPlatformDefaultQuality");
      if (defauts != null)
      {
        bool web = false;
        for (int i = 0; i < defauts.arraySize; i++)
        {
          var e = defauts.GetArrayElementAtIndex(i);
          e.FindPropertyRelative("second").intValue = 1;
          if (e.FindPropertyRelative("first").stringValue == "WebGL") web = true;
        }
        if (!web)
        {
          defauts.arraySize++;
          var e = defauts.GetArrayElementAtIndex(defauts.arraySize - 1);
          e.FindPropertyRelative("first").stringValue = "WebGL";
          e.FindPropertyRelative("second").intValue = 1;
        }
      }
      so.ApplyModifiedPropertiesWithoutUndo();
    }

    static void Ecrire(SerializedProperty parent, string nom, object valeur)
    {
      var p = parent.FindPropertyRelative(nom);
      if (p == null) return;
      switch (valeur)
      {
        case string s: p.stringValue = s; break;
        case int i: p.intValue = i; break;
        case float f: p.floatValue = f; break;
        case bool b: p.boolValue = b; break;
      }
    }

    static void Lecteur()
    {
      PlayerSettings.companyName = "Portfolio";
      PlayerSettings.productName = "Portal Rush";
      PlayerSettings.colorSpace = ColorSpace.Linear;
      PlayerSettings.runInBackground = false;
      // WebGL2 uniquement pour l'instant (WebGPU est expérimental dans Unity 6.3 : voir docs/UNITY_MIGRATION.md).
      PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
      PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.OpenGLES3 });
      PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Brotli;
      PlayerSettings.WebGL.decompressionFallback = true;
      PlayerSettings.WebGL.linkerTarget = WebGLLinkerTarget.Wasm;
      PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;
      PlayerSettings.WebGL.dataCaching = true;
      PlayerSettings.WebGL.nameFilesAsHashes = false;
      PlayerSettings.WebGL.showDiagnostics = false;
      PlayerSettings.WebGL.powerPreference = WebGLPowerPreference.HighPerformance;
      PlayerSettings.WebGL.threadsSupport = false;
      PlayerSettings.WebGL.template = "APPLICATION:Minimal";
      // Le portfolio ferme proprement l'instance (Quit) : la mémoire est rendue.
      PlayerSettings.WebGL.closeOnQuit = true;
      PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.WebGL, ManagedStrippingLevel.Low);
      PlayerSettings.stripEngineCode = true;
      // Tout le son passe par le moteur audio du portfolio (sons.ts, RUSH RADIO, DREAM RADIO) : Unity n'ouvre aucune sortie audio.
      var audio = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/AudioManager.asset");
      if (audio != null && audio.Length > 0)
      {
        var so = new SerializedObject(audio[0]);
        var coupe = so.FindProperty("m_DisableAudio");
        if (coupe != null)
        {
          coupe.boolValue = true;
          so.ApplyModifiedPropertiesWithoutUndo();
        }
      }
    }
  }
}
