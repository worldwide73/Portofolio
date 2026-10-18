// PORTAL RUSH (Unity) — LES AMBIANCES DES MONDES
//
// Les palettes viennent de l'ancien rendu (src/scripts/rush/scene/mondes.ts et mondes2.ts : ciel, soleil, brume,
// accents) pour garder l'identité de chaque monde ; s'y ajoutent les réglages propres à Unity : forme de la
// trajectoire (virages, reliefs, dévers) et style de la route. Données visuelles seulement (aucune règle de jeu).
#nullable enable
using System.Collections.Generic;
using PortalRush.Coeur;
using UnityEngine;

namespace PortalRush.Jeu
{
  public sealed class Ambiance
  {
    public Theme Theme;
    public string Nom = "";
    // ---- Ciel et lumière ----
    public Color Haut, Horizon, Bas, Nebuleuse1, Nebuleuse2;
    public Vector3 SoleilDirection;
    public Color Soleil;
    public float SoleilForce;
    public Color Ciel;
    public float CielForce;
    public Color Sol, Brouillard;
    /** Brume : début et fin (m). */
    public Vector2 Brume;
    public Color Accent, Accent2;
    public float Exposition;
    public bool Eclairs;
    public float Etoiles;
    // ---- Trajectoire (Parcours) ----
    /** Amplitude des virages (rad) et longueur d'onde (m) ; le rayon minimal reste ≥ RayonMin. */
    public float Virages = 0.5f, OndeVirages = 900f;
    /** Amplitude des reliefs (m) et longueur d'onde (m). */
    public float Reliefs = 10f, OndeReliefs = 700f;
    /** Dévers maximal dans les virages (rad). */
    public float Devers = 0.28f;
    // ---- Route (Route) ----
    /** Hauteur des bordures (m), présence d'une voûte / d'un tunnel, rythme des portiques (m, 0 : aucun). */
    public float Bordures = 0.55f;
    public bool Voute;
    public float Portiques = 120f;
    /** Couleur du revêtement et de la structure. */
    public Color Revetement = new Color(0.075f, 0.08f, 0.095f);
    public Color Structure = new Color(0.32f, 0.34f, 0.38f);

    public Ambiance Copie() => (Ambiance)MemberwiseClone();
  }

  public static class Ambiances
  {
    static Color C(string hexa)
    {
      return ColorUtility.TryParseHtmlString(hexa, out var c) ? c : Color.magenta;
    }

    static readonly Dictionary<Theme, Ambiance> table = new Dictionary<Theme, Ambiance>();

    public static Ambiance De(Theme t)
    {
      if (table.Count == 0) Remplir();
      return table.TryGetValue(t, out var a) ? a : table[Theme.Lancement];
    }

    static void Ajouter(Ambiance a) => table[a.Theme] = a;

    static void Remplir()
    {
      // LAUNCH PROTOCOL : complexe de lancement, rail surélevé, tours de service. Virages amples, reliefs doux.
      Ajouter(new Ambiance
      {
        Theme = Theme.Lancement, Nom = "Launch Protocol",
        Haut = C("#03070f"), Horizon = C("#16314d"), Bas = C("#02040a"), Nebuleuse1 = C("#1d3d70"), Nebuleuse2 = C("#3b1f5e"),
        SoleilDirection = new Vector3(-0.55f, 0.42f, -0.72f), Soleil = C("#fff0d8"), SoleilForce = 2.6f, Ciel = C("#5d86bd"), CielForce = 0.55f,
        Sol = C("#1a2232"), Brouillard = C("#0d1a2c"), Brume = new Vector2(80, 520), Accent = C("#7fe3ff"), Accent2 = C("#ffb04a"), Exposition = 1.15f, Etoiles = 1f,
        Virages = 0.38f, OndeVirages = 1100f, Reliefs = 8f, OndeReliefs = 900f, Devers = 0.2f, Bordures = 0.6f, Portiques = 140f,
        Revetement = C("#141820"), Structure = C("#5a6270"),
      });
      // NEON DRIFT : autoroute antigravité dans une mégapole néon.
      Ajouter(new Ambiance
      {
        Theme = Theme.Neon, Nom = "Neon Drift",
        Haut = C("#05030d"), Horizon = C("#2a0d3d"), Bas = C("#030208"), Nebuleuse1 = C("#5a1a6e"), Nebuleuse2 = C("#0d4a6e"),
        SoleilDirection = new Vector3(0.3f, 0.5f, -0.8f), Soleil = C("#ffd6f0"), SoleilForce = 1.4f, Ciel = C("#7a4aa8"), CielForce = 0.55f,
        Sol = C("#140a1e"), Brouillard = C("#120820"), Brume = new Vector2(60, 400), Accent = C("#5ef0ff"), Accent2 = C("#ff4fd8"), Exposition = 1.25f, Etoiles = 0.6f,
        Virages = 0.55f, OndeVirages = 850f, Reliefs = 12f, OndeReliefs = 650f, Devers = 0.32f, Bordures = 0.5f, Portiques = 90f,
        Revetement = C("#0e0b16"), Structure = C("#3a3448"),
      });
      // SHATTERED BELT : ceinture d'astéroïdes, structures brisées.
      Ajouter(new Ambiance
      {
        Theme = Theme.Debris, Nom = "Shattered Belt",
        Haut = C("#040507"), Horizon = C("#1c1a1e"), Bas = C("#030304"), Nebuleuse1 = C("#3a2a1e"), Nebuleuse2 = C("#1e2a3a"),
        SoleilDirection = new Vector3(0.6f, 0.35f, -0.7f), Soleil = C("#ffe2c0"), SoleilForce = 3f, Ciel = C("#5a5560"), CielForce = 0.45f,
        Sol = C("#16130f"), Brouillard = C("#0d0c0e"), Brume = new Vector2(90, 560), Accent = C("#ffd9a8"), Accent2 = C("#ff8a3a"), Exposition = 1.15f, Etoiles = 1f,
        Virages = 0.5f, OndeVirages = 950f, Reliefs = 16f, OndeReliefs = 600f, Devers = 0.3f, Bordures = 0.45f, Portiques = 0f,
        Revetement = C("#17140f"), Structure = C("#5c5246"),
      });
      // LASER GRID : installation de défense, grilles et faisceaux.
      Ajouter(new Ambiance
      {
        Theme = Theme.Laser, Nom = "Laser Grid",
        Haut = C("#020407"), Horizon = C("#0a2230"), Bas = C("#010204"), Nebuleuse1 = C("#0a3a4a"), Nebuleuse2 = C("#3a0a14"),
        SoleilDirection = new Vector3(-0.3f, 0.6f, -0.7f), Soleil = C("#d8f4ff"), SoleilForce = 1.9f, Ciel = C("#3a7a9a"), CielForce = 0.55f,
        Sol = C("#081014"), Brouillard = C("#06141c"), Brume = new Vector2(70, 440), Accent = C("#62f2ff"), Accent2 = C("#ff3b48"), Exposition = 1.18f, Etoiles = 0.8f,
        Virages = 0.42f, OndeVirages = 1000f, Reliefs = 9f, OndeReliefs = 800f, Devers = 0.24f, Bordures = 0.7f, Voute = true, Portiques = 70f,
        Revetement = C("#0b1216"), Structure = C("#3f5560"),
      });
      // RIFT : zone énergétique instable, failles violettes.
      Ajouter(new Ambiance
      {
        Theme = Theme.Rift, Nom = "Rift",
        Haut = C("#04020a"), Horizon = C("#22104a"), Bas = C("#020106"), Nebuleuse1 = C("#5a2aa8"), Nebuleuse2 = C("#1a6aa8"),
        SoleilDirection = new Vector3(0.2f, 0.7f, -0.6f), Soleil = C("#e6d8ff"), SoleilForce = 1.7f, Ciel = C("#8a6ad8"), CielForce = 0.6f,
        Sol = C("#120a22"), Brouillard = C("#100826"), Brume = new Vector2(70, 480), Accent = C("#b48cff"), Accent2 = C("#5ee8ff"), Exposition = 1.22f, Etoiles = 1f,
        Virages = 0.6f, OndeVirages = 900f, Reliefs = 18f, OndeReliefs = 560f, Devers = 0.34f, Bordures = 0.5f, Portiques = 110f,
        Revetement = C("#120d1c"), Structure = C("#4a3c66"),
      });
      // TEMPÊTE : orage magnétique, brume dense, éclairs.
      Ajouter(new Ambiance
      {
        Theme = Theme.Tempete, Nom = "Storm",
        Haut = C("#020305"), Horizon = C("#151a22"), Bas = C("#020203"), Nebuleuse1 = C("#2a3344"), Nebuleuse2 = C("#1a1e2a"),
        SoleilDirection = new Vector3(-0.2f, 0.4f, -0.9f), Soleil = C("#c8d4ff"), SoleilForce = 1.3f, Ciel = C("#56607a"), CielForce = 0.5f,
        Sol = C("#0c0e12"), Brouillard = C("#11151c"), Brume = new Vector2(25, 170), Accent = C("#cfe0ff"), Accent2 = C("#ffb347"), Exposition = 1.3f, Eclairs = true, Etoiles = 0.2f,
        Virages = 0.45f, OndeVirages = 800f, Reliefs = 14f, OndeReliefs = 520f, Devers = 0.3f, Bordures = 0.65f, Voute = true, Portiques = 100f,
        Revetement = C("#101318"), Structure = C("#454c58"),
      });
      // SENTINELLE : forteresse du gardien (boss).
      Ajouter(new Ambiance
      {
        Theme = Theme.Sentinelle, Nom = "Sentinel",
        Haut = C("#050302"), Horizon = C("#2a1608"), Bas = C("#030201"), Nebuleuse1 = C("#5a2a0a"), Nebuleuse2 = C("#3a0a0a"),
        SoleilDirection = new Vector3(0f, 0.45f, -1f), Soleil = C("#ffd2a0"), SoleilForce = 2.2f, Ciel = C("#a8683a"), CielForce = 0.5f,
        Sol = C("#1a0e06"), Brouillard = C("#1c0f07"), Brume = new Vector2(80, 560), Accent = C("#ffb066"), Accent2 = C("#ff5a2a"), Exposition = 1.15f, Etoiles = 0.5f,
        Virages = 0.32f, OndeVirages = 1200f, Reliefs = 7f, OndeReliefs = 900f, Devers = 0.2f, Bordures = 0.8f, Voute = true, Portiques = 80f,
        Revetement = C("#1a120c"), Structure = C("#6a5444"),
      });
      // SINGULARITÉ : aux abords d'un trou noir, disque d'accrétion.
      Ajouter(new Ambiance
      {
        Theme = Theme.Singularite, Nom = "Singularity",
        Haut = C("#000000"), Horizon = C("#0c0718"), Bas = C("#000000"), Nebuleuse1 = C("#3a1a6a"), Nebuleuse2 = C("#6a3a1a"),
        SoleilDirection = new Vector3(0f, 0.25f, -1f), Soleil = C("#f0e6ff"), SoleilForce = 1.9f, Ciel = C("#6a5aa8"), CielForce = 0.5f,
        Sol = C("#08060e"), Brouillard = C("#06040c"), Brume = new Vector2(70, 540), Accent = C("#e6dcff"), Accent2 = C("#ffffff"), Exposition = 1.22f, Etoiles = 1.2f,
        Virages = 0.62f, OndeVirages = 950f, Reliefs = 20f, OndeReliefs = 620f, Devers = 0.36f, Bordures = 0.5f, Portiques = 130f,
        Revetement = C("#0b0912"), Structure = C("#40385a"),
      });
      // L'infini et le défi reprennent des mondes existants (comme le jeu web).
      var infini = Copie(table[Theme.Neon], Theme.Infini, "Infinite");
      Ajouter(infini);
      var defi = Copie(table[Theme.Laser], Theme.Defi, "Daily challenge");
      Ajouter(defi);
    }

    static Ambiance Copie(Ambiance a, Theme t, string nom)
    {
      var b = a.Copie();
      b.Theme = t;
      b.Nom = nom;
      return b;
    }
  }
}
