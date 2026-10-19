// PORTAL RUSH (Unity) — LA VIGNETTE D'UN MONDE
//
// Le jeu web montre un aperçu rendu de chaque monde ; ici, une petite vue dessinée aux couleurs de sa palette
// (celles de la scène : horizon, accent, second accent) : la piste à trois voies qui file vers le portail, l'horizon
// lumineux, un motif propre au monde (lasers, tempête, boss…). Rien n'est chargé : tout est tracé par Painter2D.
#nullable enable
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class Vignette
  {
    readonly VisualElement el;
    string theme = "lancement";
    bool verrou;

    public Vignette(VisualElement element)
    {
      el = element;
      el.pickingMode = PickingMode.Ignore;
      el.generateVisualContent += Dessiner;
    }

    public string Theme
    {
      get => theme;
      set
      {
        if (value == theme) return;
        theme = value;
        el.MarkDirtyRepaint();
      }
    }

    /** Verrouillé : la vue s'éteint (couleurs pâlies). */
    public bool Verrou
    {
      get => verrou;
      set
      {
        if (value == verrou) return;
        verrou = value;
        el.MarkDirtyRepaint();
      }
    }

    static Color Alpha(Color c, float a)
    {
      c.a = a;
      return c;
    }

    void Dessiner(MeshGenerationContext mgc)
    {
      Rect b = Formes.Taille(mgc.visualElement);
      float l = b.width, h = b.height;
      if (l < 8 || h < 8) return;
      var p = mgc.painter2D;
      Color accent = Vues.Accent(theme), accent2 = Vues.Accent2(theme), horizon = Vues.Horizon(theme);
      if (verrou)
      {
        float g = accent.grayscale;
        accent = Color.Lerp(accent, new Color(g, g, g), 0.75f) * 0.7f;
        accent2 = Color.Lerp(accent2, new Color(g, g, g), 0.8f) * 0.6f;
        horizon = Color.Lerp(horizon, Color.black, 0.5f);
      }
      // Le ciel : la nuit, puis des bandes de plus en plus claires vers l'horizon.
      p.fillColor = Formes.Nuit;
      Rectangle(p, 0, 0, l, h);
      p.Fill();
      float yh = h * 0.47f;
      for (int i = 0; i < 9; i++)
      {
        float t = i / 8f;
        p.fillColor = Alpha(horizon, Mathf.Lerp(0.15f, 0.95f, t * t));
        float y0 = yh * (0.25f + 0.75f * t);
        Rectangle(p, 0, y0, l, yh - y0 + 1);
        p.Fill();
      }
      // Quelques étoiles, toujours aux mêmes places pour un monde.
      int graine = 17;
      foreach (char c in theme) graine = unchecked(graine * 31 + c);
      var hasard = new System.Random(graine);
      p.fillColor = Alpha(Color.white, verrou ? 0.25f : 0.55f);
      for (int i = 0; i < 18; i++)
      {
        float x = (float)hasard.NextDouble() * l, y = (float)hasard.NextDouble() * yh * 0.85f;
        float r = 0.6f + (float)hasard.NextDouble() * 0.9f;
        Rectangle(p, x, y, r, r);
        p.Fill();
      }
      // Le motif du monde, derrière la piste.
      Motif(p, l, h, yh, accent, accent2);
      // L'horizon : une ligne lumineuse.
      p.strokeColor = Alpha(accent, verrou ? 0.3f : 0.75f);
      p.lineWidth = 1.5f;
      p.BeginPath();
      p.MoveTo(new Vector2(0, yh));
      p.LineTo(new Vector2(l, yh));
      p.Stroke();
      // Le sol sombre.
      p.fillColor = Alpha(Formes.Nuit, 0.92f);
      Rectangle(p, 0, yh + 0.75f, l, h - yh);
      p.Fill();
      // La piste à trois voies, en perspective, vers le point de fuite.
      var fuite = new Vector2(l * 0.5f, yh);
      float bas = h + 2;
      p.fillColor = Alpha(accent, 0.07f);
      p.BeginPath();
      p.MoveTo(new Vector2(l * 0.1f, bas));
      p.LineTo(new Vector2(l * 0.47f, yh + 1));
      p.LineTo(new Vector2(l * 0.53f, yh + 1));
      p.LineTo(new Vector2(l * 0.9f, bas));
      p.ClosePath();
      p.Fill();
      p.lineCap = LineCap.Butt;
      for (int k = 0; k <= 3; k++)
      {
        float x = Mathf.Lerp(l * 0.1f, l * 0.9f, k / 3f);
        bool bord = k == 0 || k == 3;
        p.strokeColor = Alpha(accent, bord ? (verrou ? 0.35f : 0.85f) : 0.28f);
        p.lineWidth = bord ? 1.6f : 1f;
        p.BeginPath();
        p.MoveTo(new Vector2(x, bas));
        p.LineTo(Vector2.Lerp(new Vector2(x, bas), fuite, 0.97f));
        p.Stroke();
      }
      // Les traits de vitesse, de plus en plus serrés vers le fond.
      for (int k = 1; k <= 6; k++)
      {
        float t = Mathf.Pow(k / 7f, 1.9f);
        float y = Mathf.Lerp(yh, bas, t);
        float demi = Mathf.Lerp(l * 0.03f, l * 0.4f, t);
        p.strokeColor = Alpha(accent, 0.1f + 0.12f * t);
        p.lineWidth = 1f;
        p.BeginPath();
        p.MoveTo(new Vector2(l * 0.5f - demi, y));
        p.LineTo(new Vector2(l * 0.5f + demi, y));
        p.Stroke();
      }
      // Le portail au bout : un anneau et sa lueur.
      float rp = h * 0.11f;
      var cp = new Vector2(fuite.x, yh - rp * 0.15f);
      p.strokeColor = Alpha(accent2, verrou ? 0.15f : 0.25f);
      p.lineWidth = 6f;
      Formes.ArcLignes(p, cp, rp, 0, 360, true);
      p.Stroke();
      p.strokeColor = Alpha(accent2, verrou ? 0.45f : 0.95f);
      p.lineWidth = 1.6f;
      Formes.ArcLignes(p, cp, rp, 0, 360, true);
      p.Stroke();
      p.strokeColor = Alpha(Color.white, verrou ? 0.2f : 0.5f);
      p.lineWidth = 1f;
      Formes.ArcLignes(p, cp, rp * 0.55f, 0, 360, true);
      p.Stroke();
    }

    void Motif(Painter2D p, float l, float h, float yh, Color a, Color a2)
    {
      switch (theme)
      {
        case "laser":
          // Des portes laser rouges en travers du ciel.
          for (int i = 0; i < 4; i++)
          {
            float y = yh * (0.35f + i * 0.13f);
            p.strokeColor = Alpha(a2, 0.55f - i * 0.08f);
            p.lineWidth = 1.2f;
            p.BeginPath();
            p.MoveTo(new Vector2(l * 0.08f, y));
            p.LineTo(new Vector2(l * 0.92f, y));
            p.Stroke();
          }
          break;
        case "neon":
          // Un grand anneau magenta à l'horizon.
          p.strokeColor = Alpha(a2, 0.5f);
          p.lineWidth = 2f;
          Formes.ArcLignes(p, new Vector2(l * 0.5f, yh), yh * 0.8f, 180, 360, true);
          p.Stroke();
          break;
        case "debris":
          // Des éclats de roche qui dérivent.
          for (int i = 0; i < 7; i++)
          {
            float x = l * (0.12f + i * 0.13f), y = yh * (0.45f + 0.35f * Mathf.Sin(i * 1.7f) * 0.5f + 0.2f);
            float r = 2.5f + (i % 3) * 1.6f;
            p.fillColor = Alpha(a2, 0.45f);
            p.BeginPath();
            p.MoveTo(new Vector2(x, y - r));
            p.LineTo(new Vector2(x + r, y));
            p.LineTo(new Vector2(x + r * 0.2f, y + r));
            p.LineTo(new Vector2(x - r, y + r * 0.2f));
            p.ClosePath();
            p.Fill();
          }
          break;
        case "rift":
          // Des arcs de faille, violets et cyan.
          for (int i = 0; i < 3; i++)
          {
            p.strokeColor = Alpha(i % 2 == 0 ? a : a2, 0.45f);
            p.lineWidth = 1.4f;
            Formes.ArcLignes(p, new Vector2(l * (0.25f + i * 0.25f), yh * 0.55f), yh * 0.22f, 200, 340, true);
            p.Stroke();
          }
          break;
        case "tempete":
          // Des stries obliques.
          for (int i = 0; i < 14; i++)
          {
            float x = l * (i / 13f);
            p.strokeColor = Alpha(a, 0.18f);
            p.lineWidth = 1f;
            p.BeginPath();
            p.MoveTo(new Vector2(x, 0));
            p.LineTo(new Vector2(x - l * 0.12f, yh));
            p.Stroke();
          }
          break;
        case "sentinelle":
        case "singularite":
          // Le boss : un grand œil sombre cerclé de lumière.
          float rb = yh * (theme == "singularite" ? 0.62f : 0.5f);
          var cb = new Vector2(l * 0.5f, yh * 0.62f);
          p.fillColor = Alpha(Color.black, 0.85f);
          Formes.ArcLignes(p, cb, rb, 0, 360, true);
          p.ClosePath();
          p.Fill();
          p.strokeColor = Alpha(a2, 0.7f);
          p.lineWidth = 2f;
          Formes.ArcLignes(p, cb, rb, 0, 360, true);
          p.Stroke();
          p.strokeColor = Alpha(a, 0.4f);
          p.lineWidth = 1f;
          Formes.ArcLignes(p, cb, rb * 1.25f, 200, 340, true);
          p.Stroke();
          break;
        case "defi":
          // Le défi : une grille dorée.
          for (int i = 1; i < 6; i++)
          {
            p.strokeColor = Alpha(a, 0.14f);
            p.lineWidth = 1f;
            p.BeginPath();
            p.MoveTo(new Vector2(l * i / 6f, 0));
            p.LineTo(new Vector2(l * i / 6f, yh));
            p.Stroke();
          }
          break;
        default:
          // Le lancement : deux mâts de lumière.
          for (int i = 0; i < 2; i++)
          {
            float x = l * (i == 0 ? 0.22f : 0.78f);
            p.strokeColor = Alpha(a, 0.35f);
            p.lineWidth = 1.2f;
            p.BeginPath();
            p.MoveTo(new Vector2(x, yh));
            p.LineTo(new Vector2(x, yh * 0.35f));
            p.Stroke();
            p.fillColor = Alpha(a2, 0.8f);
            Rectangle(p, x - 1.5f, yh * 0.35f - 1.5f, 3, 3);
            p.Fill();
          }
          break;
      }
    }

    static void Rectangle(Painter2D p, float x, float y, float l, float h)
    {
      p.BeginPath();
      p.MoveTo(new Vector2(x, y));
      p.LineTo(new Vector2(x + l, y));
      p.LineTo(new Vector2(x + l, y + h));
      p.LineTo(new Vector2(x, y + h));
      p.ClosePath();
    }
  }
}
