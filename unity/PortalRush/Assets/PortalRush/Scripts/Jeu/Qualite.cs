// PORTAL RUSH (Unity) — LA QUALITÉ GRAPHIQUE : Auto, Élevée, Équilibrée, Économie (comme le jeu web).
//
// Trois niveaux de qualité Unity (créés par l'éditeur, Portal Rush › Configurer le projet), chacun avec son asset URP :
//   Elevee     : échelle de rendu 1, MSAA 4×, ombres 2048 (2 cascades), SSAO, HDR, vue 700 m ;
//   Equilibree : échelle 0,9, SMAA, ombres 1024, HDR, vue 560 m ;
//   Economie   : échelle 0,7, FXAA, sans ombres ni HDR, vue 400 m.
// Auto part d'Équilibrée (Économie sur mobile ou appareil modeste), mesure la durée des images et descend d'un niveau si
// le jeu rame (moyenne > 1/42 s), remonte prudemment s'il est très fluide (2 fois au plus). L'image n'est jamais coupée :
// au pire, on reste en Économie.
#nullable enable
using System;
using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace PortalRush.Jeu
{
  public static class Qualite
  {
    public static readonly string[] Niveaux = { "Economie", "Equilibree", "Elevee" };
    static readonly float[] Vues = { 400f, 560f, 700f };

    /** "auto" | "elevee" | "equilibree" | "economie" */
    public static string Mode { get; private set; } = "auto";
    /** Le niveau appliqué : "economie" | "equilibree" | "elevee". */
    public static string Effectif { get; private set; } = "equilibree";
    public static bool EffetsReduits { get; private set; }
    public static event Action<string>? Changee;

    internal static int Index { get; private set; } = 1;

    public static void Appliquer(string mode, bool effetsReduits)
    {
      Mode = string.IsNullOrEmpty(mode) ? "auto" : mode;
      EffetsReduits = effetsReduits;
      int i;
      switch (Mode)
      {
        case "elevee": i = 2; break;
        case "equilibree": i = 1; break;
        case "economie": i = 0; break;
        default:
          var a = Pont.Config != null ? Pont.Config.appareil : null;
          i = a != null && (a.mobile || a.economie) ? 0 : 1;
          break;
      }
      Niveau(i);
    }

    internal static void Niveau(int i)
    {
      i = Mathf.Clamp(i, 0, Niveaux.Length - 1);
      Index = i;
      Effectif = i == 2 ? "elevee" : i == 1 ? "equilibree" : "economie";
      int unity = Array.IndexOf(QualitySettings.names, Niveaux[i]);
      if (unity >= 0 && QualitySettings.GetQualityLevel() != unity) QualitySettings.SetQualityLevel(unity, true);
      var cam = Camera.main;
      if (cam != null)
      {
        var donnees = cam.GetUniversalAdditionalCameraData();
        donnees.antialiasing = i == 2 ? AntialiasingMode.None : i == 1 ? AntialiasingMode.SubpixelMorphologicalAntiAliasing : AntialiasingMode.FastApproximateAntialiasing;
        donnees.antialiasingQuality = AntialiasingQuality.High;
        donnees.renderPostProcessing = true;
        // (Élevée : le MSAA 4× est réglé dans son asset URP.)
      }
      var m = Monde.Instance;
      if (m != null)
      {
        m.route.vue = Vues[i];
        if (m.decor != null) m.decor.vue = Vues[i] + 60;
      }
      Changee?.Invoke(Effectif);
    }
  }

  /** Le mode Auto, et l'application des réglages reçus de la page. */
  public sealed class QualiteAuto : MonoBehaviour
  {
    float cumul;
    int images;
    float fluide;
    float attente = 3f;
    int remontees;

    void OnEnable()
    {
      Pont.ConfigRecue += QuandConfig;
      Pont.VueChangee += QuandVue;
    }

    void OnDisable()
    {
      Pont.ConfigRecue -= QuandConfig;
      Pont.VueChangee -= QuandVue;
    }

    void Start()
    {
      var r = Pont.Vue != null ? Pont.Vue.reglages : null;
      Qualite.Appliquer(r != null ? r.qualite : "auto", r != null && r.effetsReduits);
    }

    void QuandConfig(Config c) => QuandVue(c.vue);

    void QuandVue(Vue v)
    {
      if (v == null || v.reglages == null) return;
      if (v.reglages.qualite != Qualite.Mode || v.reglages.effetsReduits != Qualite.EffetsReduits)
      {
        Qualite.Appliquer(v.reglages.qualite, v.reglages.effetsReduits);
        attente = 3f;
      }
    }

    void Update()
    {
      if (Qualite.Mode != "auto") return;
      float dt = Time.unscaledDeltaTime;
      // On n'évalue qu'en partie, une fois le jeu lancé (pas pendant un chargement ni un compte à rebours).
      var s = Session.Instance;
      if (s == null || !s.EnCours || s.EnPause || s.Compte > 0 || dt > 0.25f)
      {
        cumul = 0;
        images = 0;
        return;
      }
      if (attente > 0)
      {
        attente -= dt;
        return;
      }
      cumul += dt;
      images++;
      if (cumul < 2f) return;
      float moyenne = cumul / images;
      cumul = 0;
      images = 0;
      if (moyenne > 1f / 42f && Qualite.Index > 0)
      {
        Qualite.Niveau(Qualite.Index - 1);
        attente = 3f;
        fluide = 0;
      }
      else if (moyenne < 1f / 58f && Qualite.Index < 2 && remontees < 2)
      {
        fluide += 2f;
        if (fluide >= 10f)
        {
          Qualite.Niveau(Qualite.Index + 1);
          remontees++;
          fluide = 0;
          attente = 3f;
        }
      }
      else fluide = 0;
    }
  }
}
