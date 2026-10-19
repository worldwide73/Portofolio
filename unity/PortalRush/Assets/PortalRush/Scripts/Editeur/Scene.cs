// PORTAL RUSH (Unity) — LA SCÈNE, CONSTRUITE PAR CODE
//
// Pour ne jamais écrire de YAML Unity à la main : matériaux, catalogue des modèles (rempli depuis les FBX de
// Assets/PortalRush/Modeles), profil de post-traitement, réglages du panneau d'interface, puis la scène unique
// Assets/PortalRush/Scenes/PortalRush.unity avec tous ses objets reliés (docs/UNITY_ARCHITECTURE.md §4).
// Peut être relancée à tout moment (menu Portal Rush › 3. Construire la scène) : la scène est refaite à neuf.
#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using PortalRush.Jeu;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UIElements;

namespace PortalRush.Editeur
{
  public static class Scene
  {
    public const string Chemin = Configuration.DossierScenes + "/PortalRush.unity";
    const string DossierUI = Configuration.Racine + "/UI";
    const string DossierModeles = Configuration.Racine + "/Modeles";
    const string CheminCatalogue = Configuration.Racine + "/Catalogue.asset";
    const string CheminPanneau = DossierUI + "/PanelSettings.asset";
    const string CheminTheme = DossierUI + "/PortalRush.tss";
    const string CheminInterface = DossierUI + "/Interface.uxml";
    const string CheminProfil = Configuration.DossierRendu + "/PostTraitement.asset";

    sealed class Materiaux
    {
      public Material Revetement = null!, Structure = null!, Lumiere = null!, Lignes = null!;
      public Material Coque = null!, Metal = null!, Danger = null!, Energie = null!, Dore = null!, Faille = null!, Portail = null!;
      public Material Particules = null!, Trainee = null!, Ciel = null!, IntroAnneaux = null!, IntroParoi = null!;
    }

    [MenuItem("Portal Rush/3. Construire la scène", false, 3)]
    static void Menu()
    {
      Construire();
      EditorUtility.DisplayDialog("Portal Rush", "Scène construite : " + Chemin, "OK");
    }

    public static void Construire()
    {
      Configuration.Dossier(Configuration.DossierMateriaux);
      Configuration.Dossier(Configuration.DossierScenes);
      Configuration.Dossier(DossierUI);
      var m = CreerMateriaux();
      var catalogue = RemplirCatalogue(m);
      var profil = PostTraitement();
      var panneau = Panneau();
      AssetDatabase.SaveAssets();

      var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
      RenderSettings.skybox = m.Ciel;

      // ---- Caméra ----
      var oCamera = new GameObject("Camera") { tag = "MainCamera" };
      var cam = oCamera.AddComponent<Camera>();
      cam.nearClipPlane = 0.3f;
      cam.farClipPlane = 3000f;
      cam.clearFlags = CameraClearFlags.Skybox;
      cam.allowHDR = true;
      cam.allowMSAA = true;
      cam.fieldOfView = 62f;
      var donneesCamera = cam.GetUniversalAdditionalCameraData();
      donneesCamera.renderPostProcessing = true;
      donneesCamera.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
      donneesCamera.antialiasingQuality = AntialiasingQuality.High;
      var cameraJeu = oCamera.AddComponent<CameraJeu>();

      // ---- Lumière, post-traitement, reflets ----
      var oSoleil = new GameObject("Soleil");
      var soleil = oSoleil.AddComponent<Light>();
      soleil.type = LightType.Directional;
      soleil.shadows = LightShadows.Soft;
      soleil.intensity = 2f;
      soleil.shadowBias = 0.05f;
      oSoleil.transform.rotation = Quaternion.Euler(35f, -30f, 0f);
      RenderSettings.sun = soleil;

      var oVolume = new GameObject("Volume");
      var volume = oVolume.AddComponent<Volume>();
      volume.isGlobal = true;
      volume.sharedProfile = profil;

      var oReflets = new GameObject("Reflets");
      var reflets = oReflets.AddComponent<ReflectionProbe>();
      reflets.mode = ReflectionProbeMode.Realtime;
      reflets.refreshMode = ReflectionProbeRefreshMode.ViaScripting;
      reflets.timeSlicingMode = ReflectionProbeTimeSlicingMode.NoTimeSlicing;
      reflets.resolution = 128;
      reflets.size = Vector3.one * 100000f;
      reflets.cullingMask = 0; // le ciel seul
      reflets.clearFlags = ReflectionProbeClearFlags.Skybox;
      reflets.hdr = true;
      reflets.importance = 1;

      // ---- Le jeu ----
      new GameObject("Session").AddComponent<Session>();
      new GameObject("Pont").AddComponent<Pont>();
      new GameObject("Vitrine").AddComponent<Vitrine>();

      var oEffets = new GameObject("Effets");
      var effets = oEffets.AddComponent<Effets>();
      effets.particules = m.Particules;
      effets.camera = oCamera.transform;

      var oIntro = new GameObject("Intro");
      var intro = oIntro.AddComponent<Intro>();
      intro.camera = oCamera.transform;
      intro.anneaux = m.IntroAnneaux;
      intro.paroi = m.IntroParoi;

      var oMonde = new GameObject("Monde");
      var parcours = oMonde.AddComponent<Parcours>();
      var route = oMonde.AddComponent<Route>();
      route.materiaux = new[] { m.Revetement, m.Structure, m.Lumiere, m.Lignes };
      var decor = oMonde.AddComponent<Decor>();
      decor.catalogue = catalogue;
      var objets = oMonde.AddComponent<Objets>();
      objets.catalogue = catalogue;
      objets.effets = effets;
      var monde = oMonde.AddComponent<Monde>();
      monde.parcours = parcours;
      monde.route = route;
      monde.decor = decor;
      monde.objets = objets;
      monde.soleil = soleil;
      monde.ciel = m.Ciel;
      monde.reflets = reflets;
      oMonde.AddComponent<QualiteAuto>();

      var oVaisseau = new GameObject("Vaisseau");
      var vaisseau = oVaisseau.AddComponent<Vaisseau>();
      vaisseau.catalogue = catalogue;
      var trainees = new List<TrailRenderer>();
      foreach (float cote in new[] { -0.42f, 0.42f })
      {
        var o = new GameObject(cote < 0 ? "Trainee gauche" : "Trainee droite");
        o.transform.SetParent(oVaisseau.transform, false);
        o.transform.localPosition = new Vector3(cote, 0.02f, -1.8f);
        var t = o.AddComponent<TrailRenderer>();
        t.time = 0.32f;
        t.minVertexDistance = 0.4f;
        t.widthMultiplier = 0.24f;
        t.sharedMaterial = m.Trainee;
        t.shadowCastingMode = ShadowCastingMode.Off;
        t.receiveShadows = false;
        t.alignment = LineAlignment.View;
        trainees.Add(t);
      }
      vaisseau.trainees = trainees.ToArray();
      var oReacteur = new GameObject("Reacteur");
      oReacteur.transform.SetParent(oVaisseau.transform, false);
      oReacteur.transform.localPosition = new Vector3(0, 0.15f, -2.1f);
      var reacteur = oReacteur.AddComponent<Light>();
      reacteur.type = LightType.Point;
      reacteur.range = 7f;
      reacteur.intensity = 2.2f;
      reacteur.shadows = LightShadows.None;
      vaisseau.reacteur = reacteur;
      cameraJeu.vaisseau = vaisseau;

      // ---- L'interface (UI Toolkit) ----
      var oInterface = new GameObject("Interface");
      var document = oInterface.AddComponent<UIDocument>();
      document.panelSettings = panneau;
      var arbre = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>(CheminInterface);
      if (arbre != null) document.visualTreeAsset = arbre;
      else Debug.LogWarning("[Portal Rush] " + CheminInterface + " introuvable : l'interface sera vide.");
      var typeInterface = Type.GetType("PortalRush.Interface.Interface, PortalRush.Interface");
      if (typeInterface != null) oInterface.AddComponent(typeInterface);
      else Debug.LogWarning("[Portal Rush] Composant PortalRush.Interface.Interface introuvable (assemblage non compilé ?).");

      EditorSceneManager.SaveScene(scene, Chemin);
      EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(Chemin, true) };
      AssetDatabase.SaveAssets();
      Debug.Log("[Portal Rush] Scène construite : " + Chemin);
    }

    // ==========================================================================
    // MATÉRIAUX
    // ==========================================================================
    static Material Materiau(string nom, string shader)
    {
      string chemin = $"{Configuration.DossierMateriaux}/{nom}.mat";
      var s = Shader.Find(shader);
      if (s == null) throw new InvalidOperationException("Shader introuvable : " + shader + " (URP installé ? scripts compilés ?)");
      var m = AssetDatabase.LoadAssetAtPath<Material>(chemin);
      if (m == null)
      {
        m = new Material(s);
        AssetDatabase.CreateAsset(m, chemin);
      }
      else m.shader = s;
      return m;
    }

    static Material Lit(string nom, Color couleur, float metal, float lisse)
    {
      var m = Materiau(nom, "Universal Render Pipeline/Lit");
      m.SetColor("_BaseColor", couleur);
      m.SetFloat("_Metallic", metal);
      m.SetFloat("_Smoothness", lisse);
      EditorUtility.SetDirty(m);
      return m;
    }

    /** Ajoute les textures PBR d'outils/unity/textures.py (couleur, normal map, masque métal/lissé) si elles existent. */
    static void Texturer(Material m, string nom, float relief = 1f)
    {
      string dossier = Configuration.Racine + "/Textures/";
      var couleur = AssetDatabase.LoadAssetAtPath<Texture2D>(dossier + nom + "_Couleur.png");
      var normal = AssetDatabase.LoadAssetAtPath<Texture2D>(dossier + nom + "_Normal.png");
      var masque = AssetDatabase.LoadAssetAtPath<Texture2D>(dossier + nom + "_Masque.png");
      if (couleur != null) m.SetTexture("_BaseMap", couleur);
      if (normal != null)
      {
        m.SetTexture("_BumpMap", normal);
        m.SetFloat("_BumpScale", relief);
        m.EnableKeyword("_NORMALMAP");
      }
      if (masque != null)
      {
        m.SetTexture("_MetallicGlossMap", masque);
        m.SetFloat("_SmoothnessTextureChannel", 0f); // lissé dans l'alpha du masque
        m.EnableKeyword("_METALLICSPECGLOSSMAP");
        // Avec le masque, _Smoothness devient un facteur et _Metallic n'est plus lu.
        m.SetFloat("_Smoothness", 1f);
      }
      if (couleur == null) Debug.LogWarning("[Portal Rush] Textures " + nom + " absentes : lancer outils/unity/textures.py.");
      EditorUtility.SetDirty(m);
    }

    /** Un matériau lumineux : couleur HDR (au-delà de 1, le bloom la fait rayonner). */
    static Material Lumineux(string nom, Color hdr)
    {
      var m = Materiau(nom, "Universal Render Pipeline/Unlit");
      m.SetColor("_BaseColor", hdr);
      EditorUtility.SetDirty(m);
      return m;
    }

    static Materiaux CreerMateriaux()
    {
      var m = new Materiaux
      {
        Revetement = Lit("Route_Revetement", new Color(0.08f, 0.085f, 0.1f), 0.55f, 0.66f),
        Structure = Lit("Route_Structure", new Color(0.34f, 0.36f, 0.4f), 0.85f, 0.52f),
        Lumiere = Lumineux("Route_Lumiere", new Color(0.5f, 0.9f, 1f) * 3f),
        Lignes = Lumineux("Route_Lignes", new Color(0.5f, 0.9f, 1f) * 1.6f),
        Coque = Lit("Proto_Coque", new Color(0.9f, 0.92f, 0.95f), 0.45f, 0.75f),
        Metal = Lit("Proto_Metal", new Color(0.3f, 0.32f, 0.36f), 0.8f, 0.45f),
        Danger = Lumineux("Proto_Danger", new Color(1f, 0.18f, 0.16f) * 2.6f),
        Energie = Lumineux("Proto_Energie", new Color(0.35f, 0.92f, 1f) * 2.6f),
        Dore = Lumineux("Proto_Dore", new Color(1f, 0.76f, 0.28f) * 2.6f),
        Faille = Lumineux("Proto_Faille", new Color(0.75f, 0.2f, 1f) * 1.8f),
        Portail = Lumineux("Proto_Portail", new Color(0.7f, 0.5f, 1f) * 2.8f),
        Particules = Materiau("Particules", "PortalRush/Particules"),
        Trainee = Materiau("Trainee", "PortalRush/Particules"),
        Ciel = Materiau("Ciel", "PortalRush/Ciel"),
        IntroAnneaux = Lumineux("Intro_Anneaux", new Color(0.5f, 0.9f, 1f) * 3f),
        IntroParoi = Lumineux("Intro_Paroi", new Color(0.012f, 0.02f, 0.045f)),
      };
      // Revêtement continu et métal de structure : textures PBR (la couleur du monde teinte _BaseColor).
      m.Revetement.SetColor("_BaseColor", Color.white);
      Texturer(m.Revetement, "Revetement", 1f);
      m.Structure.SetColor("_BaseColor", Color.white);
      Texturer(m.Structure, "Structure", 1f);
      Texturer(m.Metal, "Structure", 0.8f);
      // Les couleurs des particules et des traînées sont stockées sur 8 bits : l'éclat HDR (bloom) vient du matériau.
      m.Particules.SetFloat("_Intensite", 3f);
      m.Trainee.SetFloat("_Trainee", 1f);
      m.Trainee.SetFloat("_Intensite", 2.5f);
      EditorUtility.SetDirty(m.Particules);
      EditorUtility.SetDirty(m.Trainee);
      return m;
    }

    // ==========================================================================
    // CATALOGUE DES MODÈLES
    // ==========================================================================
    /**
     * Nom d'objet Blender (début du nom, dans l'ordre : le premier qui correspond gagne) → clé du catalogue.
     * D'après Modeles/modeles.json et le rapport de l'export (outils/assets/exporter_unity.py). À compléter quand les
     * modèles changent ; les objets non classés sont listés dans la console à chaque construction.
     */
    static readonly (string Debut, string Cle)[] Obstacles =
    {
      ("cristal-fragment", "fragment"), ("cristal-dore", "dore"), ("cristal-noyau", "noyau"),
      ("bloc-chute", "chute"), ("barriere", "bloc"), ("rochers", "debris"), ("pylones", "laser"),
      ("cargo", "mobile"), ("lance", "frappe"), ("drone", "drone"), ("eclaireur", "eclaireur"),
      ("porte", "porte"), ("rotor", "rotor"),
      // (faille, portail, boss : pas de modèle Blender, procéduraux comme dans le jeu web.)
    };
    static readonly (string Debut, string Cle)[] Usages =
    {
      ("portique", "portique"), ("scanner", "portique"), ("arche-cristal", "portique"),
      ("cadre-station", "portique"), ("cadre-brise", "portique"),
      ("paratonnerre", "tour"), ("tour-neon", "tour"), ("colonne-forteresse", "tour"), ("anneau-brise", "tour"),
      ("pilier", "pilier"), ("voute", "voute"),
    };

    static string? Correspondance((string Debut, string Cle)[] table, string nom)
    {
      string n = nom.ToLowerInvariant();
      foreach (var (debut, cle) in table) if (n.StartsWith(debut, StringComparison.Ordinal)) return cle;
      return null;
    }

    static Catalogue RemplirCatalogue(Materiaux m)
    {
      var c = AssetDatabase.LoadAssetAtPath<Catalogue>(CheminCatalogue);
      if (c == null)
      {
        c = ScriptableObject.CreateInstance<Catalogue>();
        AssetDatabase.CreateAsset(c, CheminCatalogue);
      }
      c.coque = m.Coque;
      c.metal = m.Metal;
      c.danger = m.Danger;
      c.energie = m.Energie;
      c.dore = m.Dore;
      c.faille = m.Faille;
      c.portail = m.Portail;
      c.vaisseaux.Clear();
      c.objets.Clear();
      c.decor.Clear();
      var compte = new Dictionary<string, int>();
      var ignores = new List<string>();

      void Ajouter(List<Catalogue.Entree> liste, string cle, GameObject modele)
      {
        compte.TryGetValue(cle, out int n);
        compte[cle] = n + 1;
        liste.Add(new Catalogue.Entree { nom = cle + "-" + n, modele = modele });
      }

      if (AssetDatabase.IsValidFolder(DossierModeles))
      {
        foreach (string guid in AssetDatabase.FindAssets("t:Model", new[] { DossierModeles }))
        {
          string chemin = AssetDatabase.GUIDToAssetPath(guid);
          var racine = AssetDatabase.LoadAssetAtPath<GameObject>(chemin);
          if (racine == null) continue;
          string relatif = chemin.Substring(DossierModeles.Length + 1);
          string[] parties = relatif.Split('/');
          string groupe = parties.Length > 1 ? parties[0].ToLowerInvariant() : "";
          string fichier = Path.GetFileNameWithoutExtension(chemin).ToLowerInvariant();
          if (groupe == "vaisseaux")
          {
            c.vaisseaux.Add(new Catalogue.Entree { nom = fichier, modele = racine });
            continue;
          }
          // Les autres fichiers rassemblent plusieurs objets : chaque enfant direct est une entrée.
          var enfants = new List<GameObject>();
          foreach (Transform t in racine.transform) enfants.Add(t.gameObject);
          if (enfants.Count == 0) enfants.Add(racine);
          foreach (var e in enfants)
          {
            if (groupe == "obstacles" || groupe == "collecte" || groupe == "objets")
            {
              string? cle = Correspondance(Obstacles, e.name);
              if (cle != null) Ajouter(c.objets, cle, e);
              else ignores.Add(relatif + " › " + e.name);
            }
            else if (groupe == "decor" || groupe == "mondes")
            {
              string monde = groupe == "mondes" && parties.Length > 2 ? parties[1].ToLowerInvariant() : "commun";
              string? usage = Correspondance(Usages, e.name);
              if (usage != null) Ajouter(c.decor, monde + "/" + usage, e);
              else ignores.Add(relatif + " › " + e.name);
            }
          }
        }
      }
      LirePalette(c);
      EditorUtility.SetDirty(c);
      Debug.Log($"[Portal Rush] Catalogue : {c.vaisseaux.Count} vaisseaux, {c.objets.Count} objets, {c.decor.Count} modules de décor." +
        (ignores.Count > 0 ? "\nNon classés (ajouter une correspondance dans Editeur/Scene.cs) :\n  " + string.Join("\n  ", ignores) : ""));
      return c;
    }

    /** Les matériaux dont la couleur suit le garage, d'après Modeles/palette.json (canal « peinture », « peinture2 », « accent »). */
    static void LirePalette(Catalogue c)
    {
      c.peinture.Clear();
      c.peinture2.Clear();
      c.accents.Clear();
      string chemin = Path.Combine(Application.dataPath, "PortalRush", "Modeles", "palette.json");
      if (!File.Exists(chemin)) return;
      string texte = File.ReadAllText(chemin);
      // Deux formes acceptées : { "PR_x": { …, "canal": "…" } } ou [ { "nom": "PR_x", …, "canal": "…" } ].
      var formes = new[]
      {
        new Regex("\"(PR_[^\"]+)\"\\s*:\\s*\\{[^}]*?\"canal\"\\s*:\\s*\"(\\w+)\""),
        new Regex("\"nom\"\\s*:\\s*\"(PR_[^\"]+)\"[^}]*?\"canal\"\\s*:\\s*\"(\\w+)\""),
      };
      foreach (var r in formes)
        foreach (Match x in r.Matches(texte))
        {
          string nom = x.Groups[1].Value, canal = x.Groups[2].Value;
          if (canal == "peinture" && !c.peinture.Contains(nom)) c.peinture.Add(nom);
          else if (canal == "peinture2" && !c.peinture2.Contains(nom)) c.peinture2.Add(nom);
          else if ((canal == "accent" || canal == "accent2") && !c.accents.Contains(nom)) c.accents.Add(nom);
        }
    }

    // ==========================================================================
    // POST-TRAITEMENT ET INTERFACE
    // ==========================================================================
    static VolumeProfile PostTraitement()
    {
      var p = AssetDatabase.LoadAssetAtPath<VolumeProfile>(CheminProfil);
      if (p == null)
      {
        p = ScriptableObject.CreateInstance<VolumeProfile>();
        AssetDatabase.CreateAsset(p, CheminProfil);
      }
      T Composant<T>() where T : VolumeComponent
      {
        if (p.TryGet(out T c)) return c;
        c = p.Add<T>(true);
        AssetDatabase.AddObjectToAsset(c, p);
        return c;
      }
      // Bloom maîtrisé : seules les sources HDR (rails, lignes, énergie) rayonnent ; pas de flou général.
      var bloom = Composant<Bloom>();
      bloom.threshold.Override(1.05f);
      bloom.intensity.Override(0.6f);
      bloom.scatter.Override(0.6f);
      bloom.highQualityFiltering.Override(false);
      var tonemapping = Composant<Tonemapping>();
      tonemapping.mode.Override(TonemappingMode.ACES);
      var couleurs = Composant<ColorAdjustments>();
      couleurs.postExposure.Override(0.1f);
      couleurs.contrast.Override(10f);
      couleurs.saturation.Override(6f);
      var vignette = Composant<Vignette>();
      vignette.intensity.Override(0.2f);
      vignette.smoothness.Override(0.45f);
      var aberration = Composant<ChromaticAberration>();
      aberration.intensity.Override(0.03f);
      EditorUtility.SetDirty(p);
      return p;
    }

    static PanelSettings Panneau()
    {
      var ps = AssetDatabase.LoadAssetAtPath<PanelSettings>(CheminPanneau);
      if (ps == null)
      {
        ps = ScriptableObject.CreateInstance<PanelSettings>();
        AssetDatabase.CreateAsset(ps, CheminPanneau);
      }
      ps.scaleMode = PanelScaleMode.ScaleWithScreenSize;
      ps.referenceResolution = new Vector2Int(1920, 1080);
      ps.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
      ps.match = 0.5f;
      var theme = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(CheminTheme);
      if (theme != null) ps.themeStyleSheet = theme;
      else Debug.LogWarning("[Portal Rush] Thème " + CheminTheme + " introuvable.");
      EditorUtility.SetDirty(ps);
      return ps;
    }
  }
}
