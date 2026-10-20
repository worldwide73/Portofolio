// PORTAL RUSH (Unity) — LE MONDE : trajectoire, route, décor, objets et ambiance, réglés pour la partie en cours.
//
// En partie, la distance de référence est celle de la partie ; dans les menus, la route défile doucement (vitrine).
// Le mode infini enchaîne les huit mondes tous les 1 500 m, comme le jeu web (scene.ts : CYCLE_INFINI, ETAPE_INFINI),
// avec un fondu des couleurs. La tempête a ses éclairs (sauf effets réduits).
#nullable enable
using System;
using PortalRush.Coeur;
using UnityEngine;
using UnityEngine.Rendering;

namespace PortalRush.Jeu
{
  [DefaultExecutionOrder(-40)]
  public sealed class Monde : MonoBehaviour
  {
    public static Monde? Instance { get; private set; }

    public static readonly Theme[] CycleInfini = { Theme.Lancement, Theme.Neon, Theme.Debris, Theme.Laser, Theme.Rift, Theme.Tempete, Theme.Sentinelle, Theme.Singularite };
    public const double EtapeInfini = 1500;
    const double VitesseVitrine = 26;

    public Parcours parcours = null!;
    public Route route = null!;
    public Decor? decor;
    public Objets? objets;
    public Light? soleil;
    /** Le matériau du ciel (shader PortalRush/Ciel), dupliqué au démarrage. */
    public Material? ciel;
    public ReflectionProbe? reflets;

    public double Distance { get; private set; }
    public Ambiance Ambiance { get; private set; } = Ambiances.De(Theme.Lancement);
    public bool EnPartie { get; private set; }
    public event Action<Ambiance>? AmbianceChangee;

    bool infini;
    int etapeInfini = -1;
    Ambiance? depart;
    float fondu = 1f;
    float prochainEclair = 5f;
    float eclair;

    static readonly int IdBaseColor = Shader.PropertyToID("_BaseColor");
    static readonly int IdEmission = Shader.PropertyToID("_EmissionColor");

    void Awake()
    {
      Instance = this;
      // Copies : les couleurs changent selon le monde sans toucher aux matériaux du projet.
      for (int i = 0; i < route.materiaux.Length; i++)
        if (route.materiaux[i] != null) route.materiaux[i] = new Material(route.materiaux[i]);
      if (ciel != null)
      {
        ciel = new Material(ciel);
        RenderSettings.skybox = ciel;
      }
    }

    void OnDestroy()
    {
      if (Instance == this) Instance = null;
    }

    void Start()
    {
      var s = Session.Instance;
      if (s != null)
      {
        s.Demarree += QuandDemarree;
        s.Abandonnee += QuandAbandon;
      }
      Preparer(Theme.Lancement, 1, false);
    }

    void QuandDemarree(Partie p)
    {
      EnPartie = true;
      Preparer(p.NiveauBase.Theme, p.Graine, p.Mode == Mode.Infini);
    }

    void QuandAbandon()
    {
      EnPartie = false;
      Preparer(Ambiance.Theme == Theme.Infini ? Theme.Lancement : Ambiance.Theme, 1, false);
    }

    /** Une nouvelle trajectoire, une nouvelle route, un nouveau décor ; l'ambiance du monde. */
    public void Preparer(Theme theme, double graine, bool modeInfini)
    {
      infini = modeInfini;
      etapeInfini = modeInfini ? 0 : -1;
      var a = modeInfini ? Ambiances.De(CycleInfini[0]) : Ambiances.De(theme);
      Distance = 0;
      parcours.Preparer(a, graine, modeInfini ? (Func<double, Ambiance>)StyleInfini : null);
      route.Preparer(parcours, a);
      decor?.Preparer(parcours, a, graine);
      objets?.Vider();
      depart = null;
      fondu = 1f;
      Appliquer(a, a, 1f);
      Ambiance = a;
      AmbianceChangee?.Invoke(a);
      if (reflets != null) reflets.RenderProbe();
    }

    static Ambiance StyleInfini(double s) => Ambiances.De(CycleInfini[(int)Math.Floor(Math.Max(0, s) / EtapeInfini) % CycleInfini.Length]);

    void Update()
    {
      var p = Session.Instance != null ? Session.Instance.Partie : null;
      if (p != null) Distance = p.Distance;
      else Distance += VitesseVitrine * Time.unscaledDeltaTime;

      if (infini)
      {
        int etape = (int)Math.Floor(Distance / EtapeInfini);
        if (etape != etapeInfini)
        {
          etapeInfini = etape;
          depart = Ambiance;
          Ambiance = Ambiances.De(CycleInfini[etape % CycleInfini.Length]);
          fondu = 0f;
          decor?.ChangerStyle(Ambiance);
          AmbianceChangee?.Invoke(Ambiance);
        }
      }
      if (fondu < 1f && depart != null)
      {
        fondu = Mathf.Min(1f, fondu + Time.unscaledDeltaTime / 3f);
        Appliquer(depart, Ambiance, Mathf.SmoothStep(0, 1, fondu));
        if (fondu >= 1f && reflets != null) reflets.RenderProbe();
      }
      Eclairs();
    }

    /** Ciel, brume, lumière ambiante, soleil et couleurs de la route, en fondu de a vers b. */
    void Appliquer(Ambiance a, Ambiance b, float t)
    {
      Color L(Color x, Color y) => Color.Lerp(x, y, t);
      float F(float x, float y) => Mathf.Lerp(x, y, t);

      RenderSettings.fog = true;
      RenderSettings.fogMode = FogMode.Linear;
      RenderSettings.fogColor = L(a.Brouillard, b.Brouillard);
      RenderSettings.fogStartDistance = F(a.Brume.x, b.Brume.x);
      RenderSettings.fogEndDistance = F(a.Brume.y, b.Brume.y) * 1.6f;
      RenderSettings.ambientMode = AmbientMode.Trilight;
      RenderSettings.ambientSkyColor = L(a.Ciel, b.Ciel) * F(a.CielForce, b.CielForce);
      RenderSettings.ambientEquatorColor = L(a.Horizon, b.Horizon) * 0.8f;
      RenderSettings.ambientGroundColor = L(a.Sol, b.Sol) * 0.6f;

      if (ciel != null)
      {
        ciel.SetColor("_Haut", L(a.Haut, b.Haut));
        ciel.SetColor("_Horizon", L(a.Horizon, b.Horizon));
        ciel.SetColor("_Bas", L(a.Bas, b.Bas));
        ciel.SetColor("_Nebuleuse1", L(a.Nebuleuse1, b.Nebuleuse1));
        ciel.SetColor("_Nebuleuse2", L(a.Nebuleuse2, b.Nebuleuse2));
        ciel.SetFloat("_Etoiles", F(a.Etoiles, b.Etoiles));
        ciel.SetColor("_Soleil", L(a.Soleil, b.Soleil));
        ciel.SetVector("_SoleilDirection", Vers(Vector3.Slerp(a.SoleilDirection, b.SoleilDirection, t)));
      }
      if (soleil != null)
      {
        var dir = Vers(Vector3.Slerp(a.SoleilDirection, b.SoleilDirection, t));
        soleil.transform.rotation = Quaternion.LookRotation(-dir, Vector3.up);
        soleil.color = L(a.Soleil, b.Soleil);
        soleil.intensity = F(a.SoleilForce, b.SoleilForce) * 0.75f;
      }
      var m = route.materiaux;
      if (m.Length >= 4)
      {
        // Les textures portent déjà la luminosité : le monde ne donne qu'une teinte (et un léger écart de clarté).
        if (m[Route.Revetement] != null) m[Route.Revetement].SetColor(IdBaseColor, Teinte(L(a.Revetement, b.Revetement), 0.35f));
        if (m[Route.Structure] != null) m[Route.Structure].SetColor(IdBaseColor, Teinte(L(a.Structure, b.Structure), 0.45f));
        if (m[Route.Lumiere] != null) m[Route.Lumiere].SetColor(IdBaseColor, L(a.Accent, b.Accent) * 3.2f);
        if (m[Route.Lignes] != null) m[Route.Lignes].SetColor(IdBaseColor, L(a.Accent, b.Accent) * 1.6f);
      }
    }

    /** Une teinte proche du blanc qui garde la couleur dominante de c (force : 0 = blanc, 1 = couleur pure). */
    static Color Teinte(Color c, float force)
    {
      float max = Mathf.Max(0.001f, Mathf.Max(c.r, Mathf.Max(c.g, c.b)));
      var pure = new Color(c.r / max, c.g / max, c.b / max);
      float clarte = Mathf.Lerp(0.85f, 1.15f, Mathf.Clamp01(max * 3f));
      return Color.Lerp(Color.white, pure, force) * clarte;
    }

    /** Les directions du jeu web (repère droit, -Z devant) vers Unity (repère gauche, +Z devant). */
    static Vector3 Vers(Vector3 web) => new Vector3(web.x, web.y, -web.z).normalized;

    void Eclairs()
    {
      if (soleil == null) return;
      bool reduits = Pont.Vue != null && Pont.Vue.reglages != null && Pont.Vue.reglages.effetsReduits;
      if (!Ambiance.Eclairs || reduits)
      {
        eclair = 0;
        return;
      }
      prochainEclair -= Time.unscaledDeltaTime;
      if (prochainEclair <= 0)
      {
        prochainEclair = UnityEngine.Random.Range(3.5f, 9f);
        eclair = 1f;
      }
      if (eclair > 0)
      {
        eclair = Mathf.Max(0, eclair - Time.unscaledDeltaTime * 6f);
        RenderSettings.ambientSkyColor = Ambiance.Ciel * Ambiance.CielForce * (1f + eclair * 3f);
      }
    }
  }
}
