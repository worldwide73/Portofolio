// PORTAL RUSH (Unity) — LES FORMES DE L'INTERFACE
//
// Direction « PR-OS » du jeu web (rush.css) : des plaques de verre sombre aux angles coupés, des traits d'un pixel,
// une seule touche lumineuse par élément. UI Toolkit n'a ni clip-path ni dégradé CSS : ces formes sont dessinées
// par Painter2D (generateVisualContent). Leurs couleurs viennent des feuilles USS par des propriétés
// personnalisées (--plaque-fond, --icone-couleur…), lues à chaque résolution du style (CustomStyleResolvedEvent) :
// :hover, :focus et les classes d'état (.actif, .verrouille…) changent donc aussi le dessin.
//
// Dans l'UXML, il suffit d'une classe : « plaque », « reperes », « etoile », « icone icone--roue »… ;
// Formes.Habiller(racine) branche le dessin sur tout ce qui la porte (une seule fois par élément).
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  /** Les icônes dessinées (traits fins, angles nets, comme celles du jeu web). */
  public enum Icone
  {
    Aucune, Roue, Trophee, Fermer, Campagne, Infini, Defi, Garage, Verrou, Lecture, Pause, Precedente, Suivante, Liste,
    Coche, Croix, Recommencer, Bouclier, Fragment, Gauche, Droite, Haut, Etoile, Eclair, Chevron, Modes, Clavier, Retour,
  }

  public static class Formes
  {
    // ---- Les couleurs de la direction artistique (rush.css) ----
    public static readonly Color Nuit = Hex(0x03060c);
    public static readonly Color Glacier = Hex(0xa8ecff);
    public static readonly Color Cyan = Hex(0x62d9ff);
    public static readonly Color Blanc = Hex(0xf2f8ff);
    public static readonly Color Texte = Hex(0xdce8f6);
    public static readonly Color Violet = Hex(0xa98cff);
    public static readonly Color Rouge = Hex(0xff5b54);
    public static readonly Color Or = Hex(0xffcf6a);

    public static Color Hex(int rgb, float alpha = 1f) =>
      new Color(((rgb >> 16) & 0xff) / 255f, ((rgb >> 8) & 0xff) / 255f, (rgb & 0xff) / 255f, alpha);

    /** « r, g, b » (couleur d'une pièce du garage) ; « prisme » et les erreurs donnent du blanc. */
    public static Color DepuisRgb(string? texte)
    {
      if (string.IsNullOrEmpty(texte)) return Blanc;
      var parts = texte!.Split(',');
      if (parts.Length != 3) return Blanc;
      float[] v = new float[3];
      for (int i = 0; i < 3; i++)
        if (!float.TryParse(parts[i].Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out v[i])) return Blanc;
      return new Color(v[0] / 255f, v[1] / 255f, v[2] / 255f, 1f);
    }

    static readonly CustomStyleProperty<Color> PFond = new CustomStyleProperty<Color>("--plaque-fond");
    static readonly CustomStyleProperty<Color> PBord = new CustomStyleProperty<Color>("--plaque-bord");
    static readonly CustomStyleProperty<Color> PAccent = new CustomStyleProperty<Color>("--plaque-accent");
    static readonly CustomStyleProperty<Color> PLueur = new CustomStyleProperty<Color>("--plaque-lueur");
    static readonly CustomStyleProperty<float> PCoupe = new CustomStyleProperty<float>("--plaque-coupe");
    static readonly CustomStyleProperty<float> PTrait = new CustomStyleProperty<float>("--plaque-trait");
    static readonly CustomStyleProperty<float> PAccentLongueur = new CustomStyleProperty<float>("--plaque-accent-longueur");
    static readonly CustomStyleProperty<int> PForme = new CustomStyleProperty<int>("--plaque-forme");
    static readonly CustomStyleProperty<Color> RCouleur = new CustomStyleProperty<Color>("--reperes-couleur");
    static readonly CustomStyleProperty<float> RTaille = new CustomStyleProperty<float>("--reperes-taille");
    static readonly CustomStyleProperty<Color> EFond = new CustomStyleProperty<Color>("--etoile-fond");
    static readonly CustomStyleProperty<Color> EBord = new CustomStyleProperty<Color>("--etoile-bord");
    static readonly CustomStyleProperty<Color> ICouleur = new CustomStyleProperty<Color>("--icone-couleur");
    static readonly CustomStyleProperty<float> ITrait = new CustomStyleProperty<float>("--icone-trait");

    const string Habille = "pr-habille";

    // ==========================================================================
    // LE BRANCHEMENT
    // ==========================================================================
    /** Branche le dessin de toutes les formes déclarées par classe sous « racine » (y compris elle). */
    public static void Habiller(VisualElement racine)
    {
      var liste = new List<VisualElement>();
      racine.Query<VisualElement>(className: "plaque").ToList(liste);
      foreach (var el in liste) Plaque(el);
      liste.Clear();
      racine.Query<VisualElement>(className: "reperes").ToList(liste);
      foreach (var el in liste) Reperes(el);
      liste.Clear();
      racine.Query<VisualElement>(className: "etoile").ToList(liste);
      foreach (var el in liste) Etoile(el);
      liste.Clear();
      racine.Query<VisualElement>(className: "icone").ToList(liste);
      foreach (var el in liste)
      {
        var icone = IconeDesClasses(el);
        if (icone != Icone.Aucune) Dessiner(el, icone);
      }
    }

    static Icone IconeDesClasses(VisualElement el)
    {
      foreach (var classe in el.GetClasses())
      {
        if (!classe.StartsWith("icone--", StringComparison.Ordinal)) continue;
        string nom = classe.Substring(7);
        foreach (Icone i in (Icone[])Enum.GetValues(typeof(Icone)))
          if (string.Equals(i.ToString(), nom, StringComparison.OrdinalIgnoreCase)) return i;
      }
      return Icone.Aucune;
    }

    static bool Marquer(VisualElement el, string quoi)
    {
      string classe = Habille + "-" + quoi;
      if (el.ClassListContains(classe)) return false;
      el.AddToClassList(classe);
      return true;
    }

    // ==========================================================================
    // LA PLAQUE : verre sombre, angles coupés, filet, touche lumineuse
    // ==========================================================================
    sealed class StylePlaque
    {
      public Color Fond = new Color(0.024f, 0.043f, 0.082f, 0.62f);
      public Color Bord = new Color(0.63f, 0.86f, 1f, 0.22f);
      public Color Accent = new Color(0, 0, 0, 0);
      public Color Lueur = new Color(0, 0, 0, 0);
      public float Coupe = 12, Trait = 1, AccentLongueur = 44;
      public int Forme;

      public void Lire(ICustomStyle c)
      {
        if (c.TryGetValue(PFond, out var fond)) Fond = fond;
        if (c.TryGetValue(PBord, out var bord)) Bord = bord;
        if (c.TryGetValue(PAccent, out var accent)) Accent = accent;
        if (c.TryGetValue(PLueur, out var lueur)) Lueur = lueur;
        if (c.TryGetValue(PCoupe, out var coupe)) Coupe = coupe;
        if (c.TryGetValue(PTrait, out var trait)) Trait = trait;
        if (c.TryGetValue(PAccentLongueur, out var longueur)) AccentLongueur = longueur;
        if (c.TryGetValue(PForme, out var forme)) Forme = forme;
      }
    }

    public static void Plaque(VisualElement el)
    {
      if (!Marquer(el, "plaque")) return;
      el.RegisterCallback<CustomStyleResolvedEvent>(_ => el.MarkDirtyRepaint());
      el.generateVisualContent += mgc =>
      {
        // (Le style est relu à chaque dessin : il peut avoir été résolu avant que le dessin soit branché.)
        var s = new StylePlaque();
        s.Lire(mgc.visualElement.customStyle);
        DessinerPlaque(mgc, s);
      };
    }

    static void DessinerPlaque(MeshGenerationContext mgc, StylePlaque s)
    {
      var r = Taille(mgc.visualElement);
      if (r.width < 2 || r.height < 2) return;
      var p = mgc.painter2D;
      float coupe = Mathf.Min(s.Coupe, Mathf.Min(r.width, r.height) * 0.45f);
      p.lineJoin = LineJoin.Miter;
      // La lueur : trois contours larges et pâles, à l'extérieur du verre.
      if (s.Lueur.a > 0.001f)
      {
        for (int k = 3; k >= 1; k--)
        {
          var c = s.Lueur;
          c.a *= 0.22f * (4 - k) / 3f;
          p.strokeColor = c;
          p.lineWidth = k * 3f;
          Chemin(p, Retrait(r, -k * 0.5f), coupe + k * 0.5f, s.Forme);
          p.Stroke();
        }
      }
      if (s.Fond.a > 0.001f)
      {
        p.fillColor = s.Fond;
        Chemin(p, r, coupe, s.Forme);
        p.Fill();
      }
      if (s.Bord.a > 0.001f && s.Trait > 0)
      {
        p.strokeColor = s.Bord;
        p.lineWidth = s.Trait;
        Chemin(p, Retrait(r, s.Trait * 0.5f), Mathf.Max(0, coupe - s.Trait * 0.3f), s.Forme);
        p.Stroke();
      }
      // La touche lumineuse : le long du coin coupé en haut à gauche, puis du bord du haut.
      if (s.Accent.a > 0.001f && s.AccentLongueur > 0)
      {
        float t = Mathf.Max(1.5f, s.Trait + 0.5f);
        p.strokeColor = s.Accent;
        p.lineWidth = t;
        p.lineCap = LineCap.Butt;
        float y = t * 0.5f;
        p.BeginPath();
        if (s.Forme == 2)
        {
          p.MoveTo(new Vector2(0, y));
          p.LineTo(new Vector2(Mathf.Min(r.width, s.AccentLongueur), y));
        }
        else
        {
          p.MoveTo(new Vector2(t * 0.5f, coupe + t));
          p.LineTo(new Vector2(coupe + t * 0.2f, y));
          p.LineTo(new Vector2(Mathf.Min(r.width - coupe, coupe + s.AccentLongueur), y));
        }
        p.Stroke();
      }
    }

    /** La taille de l'élément, en coordonnées locales (celles du dessin : 0, 0 en haut à gauche). */
    public static Rect Taille(VisualElement el)
    {
      float l = el.layout.width, h = el.layout.height;
      return new Rect(0, 0, float.IsNaN(l) ? 0 : l, float.IsNaN(h) ? 0 : h);
    }

    static Rect Retrait(Rect r, float d) => new Rect(r.x + d, r.y + d, Mathf.Max(0, r.width - 2 * d), Mathf.Max(0, r.height - 2 * d));

    /** Le contour d'une plaque. Forme 0 : coins coupés en haut à gauche et en bas à droite ; 1 : les quatre ; 2 : aucun ; 3 : en haut à gauche. */
    public static void Chemin(Painter2D p, Rect r, float coupe, int forme = 0)
    {
      float x0 = r.xMin, y0 = r.yMin, x1 = r.xMax, y1 = r.yMax;
      p.BeginPath();
      if (forme == 2 || coupe <= 0.01f)
      {
        p.MoveTo(new Vector2(x0, y0));
        p.LineTo(new Vector2(x1, y0));
        p.LineTo(new Vector2(x1, y1));
        p.LineTo(new Vector2(x0, y1));
      }
      else if (forme == 3)
      {
        // Seulement le coin du haut à gauche (une vue posée en haut d'une plaque).
        p.MoveTo(new Vector2(x0 + coupe, y0));
        p.LineTo(new Vector2(x1, y0));
        p.LineTo(new Vector2(x1, y1));
        p.LineTo(new Vector2(x0, y1));
        p.LineTo(new Vector2(x0, y0 + coupe));
      }
      else if (forme == 1)
      {
        p.MoveTo(new Vector2(x0 + coupe, y0));
        p.LineTo(new Vector2(x1 - coupe, y0));
        p.LineTo(new Vector2(x1, y0 + coupe));
        p.LineTo(new Vector2(x1, y1 - coupe));
        p.LineTo(new Vector2(x1 - coupe, y1));
        p.LineTo(new Vector2(x0 + coupe, y1));
        p.LineTo(new Vector2(x0, y1 - coupe));
        p.LineTo(new Vector2(x0, y0 + coupe));
      }
      else
      {
        p.MoveTo(new Vector2(x0 + coupe, y0));
        p.LineTo(new Vector2(x1, y0));
        p.LineTo(new Vector2(x1, y1 - coupe));
        p.LineTo(new Vector2(x1 - coupe, y1));
        p.LineTo(new Vector2(x0, y1));
        p.LineTo(new Vector2(x0, y0 + coupe));
      }
      p.ClosePath();
    }

    // ==========================================================================
    // LES REPÈRES : quatre équerres aux coins (baie du garage, cadre de l'écran)
    // ==========================================================================
    sealed class StyleReperes
    {
      public Color Couleur = new Color(0.66f, 0.92f, 1f, 0.45f);
      public float Taille = 18;
    }

    public static void Reperes(VisualElement el)
    {
      if (!Marquer(el, "reperes")) return;
      el.RegisterCallback<CustomStyleResolvedEvent>(_ => el.MarkDirtyRepaint());
      el.generateVisualContent += mgc =>
      {
        var s = new StyleReperes();
        if (mgc.visualElement.customStyle.TryGetValue(RCouleur, out var couleur)) s.Couleur = couleur;
        if (mgc.visualElement.customStyle.TryGetValue(RTaille, out var taille)) s.Taille = taille;
        Rect b = Taille(mgc.visualElement);
        float l = b.width, h = b.height, t = s.Taille;
        if (l < 4 || h < 4) return;
        var p = mgc.painter2D;
        p.strokeColor = s.Couleur;
        p.lineWidth = 1.5f;
        p.lineJoin = LineJoin.Miter;
        p.lineCap = LineCap.Butt;
        Equerre(p, new Vector2(1, 1), new Vector2(1, 1), t);
        Equerre(p, new Vector2(l - 1, 1), new Vector2(-1, 1), t);
        Equerre(p, new Vector2(1, h - 1), new Vector2(1, -1), t);
        Equerre(p, new Vector2(l - 1, h - 1), new Vector2(-1, -1), t);
      };
    }

    static void Equerre(Painter2D p, Vector2 coin, Vector2 sens, float t)
    {
      p.BeginPath();
      p.MoveTo(coin + new Vector2(0, sens.y * t));
      p.LineTo(coin);
      p.LineTo(coin + new Vector2(sens.x * t, 0));
      p.Stroke();
    }

    // ==========================================================================
    // L'ÉTOILE (étoiles des secteurs) : pleine si gagnée, en creux sinon
    // ==========================================================================
    sealed class StyleEtoile
    {
      public Color Fond = new Color(1f, 0.81f, 0.42f, 0f);
      public Color Bord = new Color(0.8f, 0.88f, 0.96f, 0.4f);
    }

    public static void Etoile(VisualElement el)
    {
      if (!Marquer(el, "etoile")) return;
      el.RegisterCallback<CustomStyleResolvedEvent>(_ => el.MarkDirtyRepaint());
      el.generateVisualContent += mgc =>
      {
        var s = new StyleEtoile();
        if (mgc.visualElement.customStyle.TryGetValue(EFond, out var fond)) s.Fond = fond;
        if (mgc.visualElement.customStyle.TryGetValue(EBord, out var bord)) s.Bord = bord;
        Rect b = Taille(mgc.visualElement);
        float rayon = Mathf.Min(b.width, b.height) * 0.5f - 1f;
        if (rayon < 2) return;
        var p = mgc.painter2D;
        var centre = new Vector2(b.width * 0.5f, b.height * 0.52f);
        p.lineJoin = LineJoin.Miter;
        if (s.Fond.a > 0.001f)
        {
          p.fillColor = s.Fond;
          CheminEtoile(p, centre, rayon);
          p.Fill();
        }
        if (s.Bord.a > 0.001f)
        {
          p.strokeColor = s.Bord;
          p.lineWidth = Mathf.Max(1f, rayon * 0.09f);
          CheminEtoile(p, centre, rayon - 0.5f);
          p.Stroke();
        }
      };
    }

    public static void CheminEtoile(Painter2D p, Vector2 centre, float rayon, float creux = 0.46f)
    {
      p.BeginPath();
      for (int i = 0; i < 10; i++)
      {
        float a = (-90f + i * 36f) * Mathf.Deg2Rad;
        float r = i % 2 == 0 ? rayon : rayon * creux;
        var pt = centre + new Vector2(Mathf.Cos(a) * r, Mathf.Sin(a) * r);
        if (i == 0) p.MoveTo(pt);
        else p.LineTo(pt);
      }
      p.ClosePath();
    }

    // ==========================================================================
    // LES ICÔNES (grille de 24 × 24, comme les SVG du jeu web)
    // ==========================================================================
    sealed class StyleIcone
    {
      public Color Couleur = new Color(0.86f, 0.91f, 0.96f, 1f);
      public float Trait = 1.6f;
      public Icone Icone;
    }

    /** Dessine une icône dans l'élément (sa couleur : --icone-couleur ; son trait : --icone-trait). */
    public static void Dessiner(VisualElement el, Icone icone)
    {
      if (!Marquer(el, "icone"))
      {
        // (Déjà branchée : on change seulement l'icône.)
        if (el.userData is StyleIcone deja)
        {
          deja.Icone = icone;
          el.MarkDirtyRepaint();
        }
        return;
      }
      var s = new StyleIcone { Icone = icone };
      el.userData = s;
      el.RegisterCallback<CustomStyleResolvedEvent>(_ => el.MarkDirtyRepaint());
      el.generateVisualContent += mgc =>
      {
        if (mgc.visualElement.customStyle.TryGetValue(ICouleur, out var couleur)) s.Couleur = couleur;
        if (mgc.visualElement.customStyle.TryGetValue(ITrait, out var trait)) s.Trait = trait;
        DessinerIcone(mgc, s);
      };
    }

    static void DessinerIcone(MeshGenerationContext mgc, StyleIcone s)
    {
      Rect b = Taille(mgc.visualElement);
      float taille = Mathf.Min(b.width, b.height);
      if (taille < 4) return;
      float k = taille / 24f;
      var o = new Vector2((b.width - taille) * 0.5f, (b.height - taille) * 0.5f);
      Vector2 P(float x, float y) => o + new Vector2(x * k, y * k);
      var p = mgc.painter2D;
      p.strokeColor = s.Couleur;
      p.fillColor = s.Couleur;
      p.lineWidth = Mathf.Max(1f, s.Trait * Mathf.Clamp(k, 0.75f, 1.6f));
      p.lineJoin = LineJoin.Round;
      p.lineCap = LineCap.Round;

      void Ligne(params Vector2[] points)
      {
        p.BeginPath();
        p.MoveTo(points[0]);
        for (int i = 1; i < points.Length; i++) p.LineTo(points[i]);
        p.Stroke();
      }
      void Ferme(bool plein, params Vector2[] points)
      {
        p.BeginPath();
        p.MoveTo(points[0]);
        for (int i = 1; i < points.Length; i++) p.LineTo(points[i]);
        p.ClosePath();
        if (plein) p.Fill();
        else p.Stroke();
      }
      void Cercle(Vector2 c, float r, bool plein)
      {
        ArcLignes(p, P(c.x, c.y), r * k, 0, 360, true);
        p.ClosePath();
        if (plein) p.Fill();
        else p.Stroke();
      }

      switch (s.Icone)
      {
        case Icone.Roue:
        {
          // Huit dents autour d'un moyeu.
          var c = P(12, 12);
          p.BeginPath();
          for (int i = 0; i < 16; i++)
          {
            float a0 = (i * 22.5f - 6f) * Mathf.Deg2Rad, a1 = (i * 22.5f + 6f) * Mathf.Deg2Rad;
            float r = (i % 2 == 0 ? 9.2f : 7f) * k;
            var q0 = c + new Vector2(Mathf.Cos(a0) * r, Mathf.Sin(a0) * r);
            var q1 = c + new Vector2(Mathf.Cos(a1) * r, Mathf.Sin(a1) * r);
            if (i == 0) p.MoveTo(q0);
            else p.LineTo(q0);
            p.LineTo(q1);
          }
          p.ClosePath();
          p.Stroke();
          Cercle(new Vector2(12, 12), 3.2f, false);
          break;
        }
        case Icone.Trophee:
          Ferme(false, P(7.5f, 3.5f), P(16.5f, 3.5f), P(16.5f, 8.3f), P(14.5f, 11.8f), P(12, 12.8f), P(9.5f, 11.8f), P(7.5f, 8.3f));
          Ligne(P(7.5f, 5.2f), P(4.2f, 5.2f), P(4.2f, 6.6f), P(5.6f, 9f), P(7.8f, 9.9f));
          Ligne(P(16.5f, 5.2f), P(19.8f, 5.2f), P(19.8f, 6.6f), P(18.4f, 9f), P(16.2f, 9.9f));
          Ligne(P(12, 12.8f), P(12, 16.4f));
          Ferme(false, P(9.4f, 16.4f), P(14.6f, 16.4f), P(15.4f, 20.5f), P(8.6f, 20.5f));
          break;
        case Icone.Fermer:
        case Icone.Croix:
          Ligne(P(6.5f, 6.5f), P(17.5f, 17.5f));
          Ligne(P(17.5f, 6.5f), P(6.5f, 17.5f));
          break;
        case Icone.Campagne:
          Ligne(P(4, 18.5f), P(9, 14.5f), P(13.5f, 17), P(20, 8));
          Cercle(new Vector2(4, 18.5f), 1.6f, true);
          Cercle(new Vector2(9, 14.5f), 1.6f, true);
          Cercle(new Vector2(13.5f, 17), 1.6f, true);
          Cercle(new Vector2(20, 8), 1.9f, true);
          break;
        case Icone.Infini:
        {
          // Une lemniscate, en segments.
          p.BeginPath();
          for (int i = 0; i <= 64; i++)
          {
            float t = i / 64f * Mathf.PI * 2f;
            float d = 1 + Mathf.Sin(t) * Mathf.Sin(t);
            var q = P(12 + 8.6f * Mathf.Cos(t) / d, 12 + 8.6f * Mathf.Sin(t) * Mathf.Cos(t) / d);
            if (i == 0) p.MoveTo(q);
            else p.LineTo(q);
          }
          p.Stroke();
          break;
        }
        case Icone.Defi:
          Ferme(false, P(4.5f, 6.5f), P(19.5f, 6.5f), P(19.5f, 19.5f), P(4.5f, 19.5f));
          Ligne(P(4.5f, 10.5f), P(19.5f, 10.5f));
          Ligne(P(8.5f, 4), P(8.5f, 8));
          Ligne(P(15.5f, 4), P(15.5f, 8));
          Ligne(P(10, 15), P(11.6f, 16.6f), P(15, 13));
          break;
        case Icone.Garage:
          Ferme(false, P(12, 3.5f), P(14.3f, 10.7f), P(20.5f, 15), P(13.9f, 15.9f), P(12, 20.5f), P(10.1f, 15.9f), P(3.5f, 15), P(9.7f, 10.7f));
          break;
        case Icone.Modes:
          Ferme(false, P(3.5f, 5), P(10.5f, 5), P(10.5f, 11), P(3.5f, 11));
          Ferme(false, P(13.5f, 5), P(20.5f, 5), P(20.5f, 11), P(13.5f, 11));
          Ferme(false, P(3.5f, 14), P(10.5f, 14), P(10.5f, 20), P(3.5f, 20));
          Ferme(true, P(13.5f, 14), P(20.5f, 14), P(20.5f, 20), P(13.5f, 20));
          break;
        case Icone.Verrou:
          Ferme(false, P(5.5f, 10.5f), P(18.5f, 10.5f), P(18.5f, 20), P(5.5f, 20));
          p.BeginPath();
          p.MoveTo(P(8.3f, 10.5f));
          p.LineTo(P(8.3f, 7.6f));
          ArcLignes(p, P(12, 7.6f), 3.7f * k, 180, 360, false, true);
          p.LineTo(P(15.7f, 10.5f));
          p.Stroke();
          break;
        case Icone.Lecture:
          Ferme(true, P(7.3f, 4.3f), P(19.6f, 12), P(7.3f, 19.7f));
          break;
        case Icone.Pause:
          Ferme(true, P(6.7f, 4.7f), P(10.2f, 4.7f), P(10.2f, 19.3f), P(6.7f, 19.3f));
          Ferme(true, P(13.8f, 4.7f), P(17.3f, 4.7f), P(17.3f, 19.3f), P(13.8f, 19.3f));
          break;
        case Icone.Precedente:
          Ligne(P(5.3f, 4.7f), P(5.3f, 19.3f));
          Ferme(true, P(19.3f, 5), P(19.3f, 19), P(8.5f, 12));
          break;
        case Icone.Suivante:
          Ligne(P(18.7f, 4.7f), P(18.7f, 19.3f));
          Ferme(true, P(4.7f, 5), P(4.7f, 19), P(15.5f, 12));
          break;
        case Icone.Liste:
          Ligne(P(5, 7), P(19, 7));
          Ligne(P(5, 12), P(19, 12));
          Ligne(P(5, 17), P(14, 17));
          break;
        case Icone.Coche:
          Ligne(P(5, 12.5f), P(10, 17.5f), P(19, 6.5f));
          break;
        case Icone.Recommencer:
          p.BeginPath();
          ArcLignes(p, P(12, 12), 7.2f * k, -60, 230, false);
          p.Stroke();
          {
            float a = -60f * Mathf.Deg2Rad;
            var bout = P(12, 12) + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * 7.2f * k;
            Ferme(true, bout + new Vector2(-4.2f, -1.2f) * k, bout + new Vector2(1.6f, -3.6f) * k, bout + new Vector2(0.8f, 2.6f) * k);
          }
          break;
        case Icone.Retour:
          Ligne(P(14.5f, 5.5f), P(8, 12), P(14.5f, 18.5f));
          break;
        case Icone.Chevron:
          Ligne(P(9.5f, 5.5f), P(16, 12), P(9.5f, 18.5f));
          break;
        case Icone.Bouclier:
          Ferme(true, P(12, 3), P(19.5f, 6.5f), P(18.5f, 14), P(12, 21), P(5.5f, 14), P(4.5f, 6.5f));
          break;
        case Icone.Fragment:
          Ferme(true, P(12, 3.5f), P(18, 12), P(12, 20.5f), P(6, 12));
          break;
        case Icone.Gauche:
          Ligne(P(19, 12), P(5.5f, 12));
          Ligne(P(10.5f, 6.5f), P(5, 12), P(10.5f, 17.5f));
          break;
        case Icone.Droite:
          Ligne(P(5, 12), P(18.5f, 12));
          Ligne(P(13.5f, 6.5f), P(19, 12), P(13.5f, 17.5f));
          break;
        case Icone.Haut:
          Ligne(P(12, 19), P(12, 5.5f));
          Ligne(P(6.5f, 10.5f), P(12, 5), P(17.5f, 10.5f));
          break;
        case Icone.Etoile:
          CheminEtoile(p, P(12, 12.6f), 9.4f * k);
          p.Fill();
          break;
        case Icone.Eclair:
          Ferme(true, P(13.5f, 2.5f), P(5.5f, 13.5f), P(11, 13.5f), P(10, 21.5f), P(18.5f, 10), P(12.8f, 10));
          break;
        case Icone.Clavier:
          Ferme(false, P(2.5f, 6.5f), P(21.5f, 6.5f), P(21.5f, 17.5f), P(2.5f, 17.5f));
          Ligne(P(6, 10), P(6.5f, 10));
          Ligne(P(10, 10), P(10.5f, 10));
          Ligne(P(14, 10), P(14.5f, 10));
          Ligne(P(18, 10), P(18.5f, 10));
          Ligne(P(7.5f, 14), P(16.5f, 14));
          break;
      }
    }

    /**
     * Un arc fait de segments (indépendant des conventions de Painter2D.Arc). Angles en degrés, 0 à droite,
     * sens horaire (l'axe y descend). « nouveau » : commence un chemin ; « suite » : continue le chemin en cours.
     */
    public static void ArcLignes(Painter2D p, Vector2 centre, float rayon, float debut, float fin, bool nouveau, bool suite = false)
    {
      int n = Mathf.Max(2, Mathf.CeilToInt(Mathf.Abs(fin - debut) / 4f));
      if (nouveau) p.BeginPath();
      for (int i = 0; i <= n; i++)
      {
        float a = Mathf.Lerp(debut, fin, i / (float)n) * Mathf.Deg2Rad;
        var pt = centre + new Vector2(Mathf.Cos(a) * rayon, Mathf.Sin(a) * rayon);
        if (i == 0 && !suite) p.MoveTo(pt);
        else p.LineTo(pt);
      }
    }
  }

  /**
   * La jauge d'Overdrive : un anneau ouvert (270°) gradué. Valeur 0 à 1 ; couleurs : --anneau-fond, --anneau-plein,
   * --anneau-lueur (changées par les classes d'état du HUD : .od-verrouille, .od-pret, .od-actif…).
   */
  public sealed class Anneau
  {
    static readonly CustomStyleProperty<Color> AFond = new CustomStyleProperty<Color>("--anneau-fond");
    static readonly CustomStyleProperty<Color> APlein = new CustomStyleProperty<Color>("--anneau-plein");
    static readonly CustomStyleProperty<Color> ALueur = new CustomStyleProperty<Color>("--anneau-lueur");
    static readonly CustomStyleProperty<float> AEpaisseur = new CustomStyleProperty<float>("--anneau-epaisseur");

    readonly VisualElement el;
    Color fond = new Color(0.63f, 0.86f, 1f, 0.14f);
    Color plein = Formes.Violet;
    Color lueur = new Color(0.66f, 0.55f, 1f, 0.35f);
    float epaisseur = 8;
    float valeur;
    const float Debut = 135, Ouverture = 270;

    public Anneau(VisualElement element)
    {
      el = element;
      el.RegisterCallback<CustomStyleResolvedEvent>(_ => el.MarkDirtyRepaint());
      el.generateVisualContent += Dessiner;
    }

    public float Valeur
    {
      get => valeur;
      set
      {
        float v = Mathf.Clamp01(value);
        if (Mathf.Abs(v - valeur) < 0.002f) return;
        valeur = v;
        el.MarkDirtyRepaint();
      }
    }

    void Dessiner(MeshGenerationContext mgc)
    {
      var c0 = mgc.visualElement.customStyle;
      if (c0.TryGetValue(AFond, out var f)) fond = f;
      if (c0.TryGetValue(APlein, out var pl)) plein = pl;
      if (c0.TryGetValue(ALueur, out var lu)) lueur = lu;
      if (c0.TryGetValue(AEpaisseur, out var ep)) epaisseur = ep;
      Rect b = Formes.Taille(mgc.visualElement);
      float rayon = Mathf.Min(b.width, b.height) * 0.5f - epaisseur * 0.5f - 3f;
      if (rayon < 4) return;
      var c = new Vector2(b.width * 0.5f, b.height * 0.5f);
      var p = mgc.painter2D;
      p.lineCap = LineCap.Butt;
      p.lineJoin = LineJoin.Round;
      // Le rail.
      p.strokeColor = fond;
      p.lineWidth = epaisseur;
      Formes.ArcLignes(p, c, rayon, Debut, Debut + Ouverture, true);
      p.Stroke();
      // Les graduations, tous les dixièmes.
      p.lineWidth = 1.2f;
      for (int i = 0; i <= 10; i++)
      {
        float a = (Debut + Ouverture * i / 10f) * Mathf.Deg2Rad;
        var dir = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
        var gris = fond;
        gris.a = Mathf.Min(1, fond.a * 3f);
        p.strokeColor = gris;
        p.BeginPath();
        p.MoveTo(c + dir * (rayon + epaisseur * 0.5f + 2f));
        p.LineTo(c + dir * (rayon + epaisseur * 0.5f + (i % 5 == 0 ? 7f : 4f)));
        p.Stroke();
      }
      if (valeur <= 0.001f) return;
      float fin = Debut + Ouverture * valeur;
      // La lueur, puis la charge.
      if (lueur.a > 0.001f)
      {
        p.strokeColor = lueur;
        p.lineWidth = epaisseur + 8f;
        Formes.ArcLignes(p, c, rayon, Debut, fin, true);
        p.Stroke();
      }
      p.strokeColor = plein;
      p.lineWidth = epaisseur;
      Formes.ArcLignes(p, c, rayon, Debut, fin, true);
      p.Stroke();
      // Le bout lumineux.
      float af = fin * Mathf.Deg2Rad;
      var d = new Vector2(Mathf.Cos(af), Mathf.Sin(af));
      p.strokeColor = Color.white;
      p.lineWidth = 2f;
      p.BeginPath();
      p.MoveTo(c + d * (rayon - epaisseur * 0.6f));
      p.LineTo(c + d * (rayon + epaisseur * 0.6f));
      p.Stroke();
    }
  }
}
