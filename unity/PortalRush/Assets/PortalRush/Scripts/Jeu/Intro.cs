// PORTAL RUSH (Unity) — LA SORTIE DU TUNNEL TEMPOREL (fin de la cinématique d'entrée)
//
// La page joue le début (le bouton du Hub tremble, se fissure, se brise ; la faille s'ouvre ; le tunnel commence)
// pendant le chargement. Unity prend la suite sans écran noir : la caméra file dans un tunnel d'anneaux d'énergie qui
// accélère, un éclair, le tunnel s'ouvre sur le monde, le vaisseau arrive en mouvement depuis l'arrière, le moteur
// démarre. À la fin, Terminee est émis : l'interface lance le tutoriel (premier lancement) ou montre le menu.
// Effets réduits : un simple fondu court. Les couleurs suivent le monde affiché.
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;

namespace PortalRush.Jeu
{
  public sealed class Intro : MonoBehaviour
  {
    public static Intro? Instance { get; private set; }
    /** Vrai pendant la séquence. */
    public static bool EnCours { get; private set; }
    /** Décalage du vaisseau vers l'arrière (m) pendant son arrivée ; 0 hors séquence. */
    public static float RetardVaisseau { get; private set; }
    /** Le vaisseau est-il encore caché (dans le tunnel) ? */
    public static bool VaisseauCache { get; private set; }
    public static event Action? Terminee;

    public Transform? camera;
    public Material? anneaux;
    public Material? paroi;

    const float Duree = 2.6f, Ouverture = 1.7f;
    const int NbAnneaux = 34;
    const float Ecart = 7f;

    readonly List<Transform> cercles = new List<Transform>();
    GameObject? racine;
    float t = -1;
    bool court;

    void Awake()
    {
      Instance = this;
      // Copie : la couleur change pendant la séquence sans toucher au matériau du projet.
      if (anneaux != null) anneaux = new Material(anneaux);
    }

    void OnDestroy()
    {
      if (Instance == this) Instance = null;
    }

    /** Lance la séquence (la page l'a demandée dans config.intro). */
    public void Jouer()
    {
      court = Pont.Vue != null && Pont.Vue.reglages != null && Pont.Vue.reglages.effetsReduits;
      t = 0;
      EnCours = true;
      VaisseauCache = !court;
      RetardVaisseau = court ? 0 : 40f;
      if (!court) Construire();
      Pont.Ecran("intro");
    }

    void Construire()
    {
      if (racine != null) Destroy(racine);
      cercles.Clear();
      racine = new GameObject("Tunnel temporel");
      if (camera != null) racine.transform.SetParent(camera, false);
      var maillage = Anneau(6.5f, 0.12f, 48);
      for (int i = 0; i < NbAnneaux; i++)
      {
        var o = new GameObject("Anneau");
        o.transform.SetParent(racine.transform, false);
        o.AddComponent<MeshFilter>().sharedMesh = maillage;
        var r = o.AddComponent<MeshRenderer>();
        r.sharedMaterial = anneaux;
        r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        o.transform.localPosition = new Vector3(0, 0, i * Ecart);
        o.transform.localRotation = Quaternion.Euler(0, 0, i * 11f);
        cercles.Add(o.transform);
      }
      // La paroi : un tube sombre vu de l'intérieur, qui cache le monde jusqu'à l'ouverture.
      var oParoi = new GameObject("Paroi");
      oParoi.transform.SetParent(racine.transform, false);
      oParoi.AddComponent<MeshFilter>().sharedMesh = Tube(7.4f, NbAnneaux * Ecart + 20f, 32);
      var rendu = oParoi.AddComponent<MeshRenderer>();
      rendu.sharedMaterial = paroi;
      rendu.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
      oParoi.transform.localPosition = new Vector3(0, 0, -10f);
    }

    void Update()
    {
      if (t < 0) return;
      t += Time.unscaledDeltaTime;
      if (court)
      {
        if (t >= 0.5f) Finir();
        return;
      }
      // Les anneaux viennent vers la caméra, de plus en plus vite (40 → 220 m/s).
      float vitesse = Mathf.Lerp(40f, 220f, Mathf.Clamp01(t / Ouverture));
      float avance = vitesse * Time.unscaledDeltaTime;
      var accent = Monde.Instance != null ? Monde.Instance.Ambiance.Accent : new Color(0.5f, 0.9f, 1f);
      if (anneaux != null) anneaux.SetColor("_BaseColor", Color.Lerp(accent, Color.white, Mathf.Clamp01(t / Ouverture)) * (2.5f + 4f * Mathf.Clamp01((t - Ouverture + 0.3f) / 0.3f)));
      foreach (var c in cercles)
      {
        var p = c.localPosition;
        p.z -= avance;
        if (p.z < -2f) p.z += NbAnneaux * Ecart;
        c.localPosition = p;
        c.Rotate(0, 0, 40f * Time.unscaledDeltaTime, Space.Self);
      }
      // L'ouverture : le tunnel s'élargit d'un coup et disparaît, le monde apparaît.
      if (t >= Ouverture && racine != null)
      {
        float k = Mathf.Clamp01((t - Ouverture) / 0.45f);
        float e = 1f + k * k * 60f;
        racine.transform.localScale = new Vector3(e, e, 1f);
        VaisseauCache = false;
        if (k >= 1f) racine.SetActive(false);
      }
      // Le vaisseau arrive de l'arrière en ralentissant.
      if (t >= Ouverture)
      {
        float k = Mathf.Clamp01((t - Ouverture) / (Duree - Ouverture));
        RetardVaisseau = 40f * (1f - k) * (1f - k);
      }
      if (t >= Duree) Finir();
    }

    void Finir()
    {
      t = -1;
      EnCours = false;
      VaisseauCache = false;
      RetardVaisseau = 0;
      if (racine != null) Destroy(racine);
      racine = null;
      cercles.Clear();
      Terminee?.Invoke();
    }

    /** Un anneau plat (bande) de rayon r et d'épaisseur e, face à la caméra. */
    static Mesh Anneau(float r, float e, int n)
    {
      var m = new Mesh { name = "Anneau" };
      var v = new Vector3[n * 2];
      var tri = new int[n * 12];
      for (int i = 0; i < n; i++)
      {
        float a = Mathf.PI * 2 * i / n;
        var d = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0);
        v[i * 2] = d * (r - e);
        v[i * 2 + 1] = d * (r + e);
        int j = (i + 1) % n, k = i * 12;
        int a0 = i * 2, a1 = i * 2 + 1, b0 = j * 2, b1 = j * 2 + 1;
        // Les deux faces (on le voit de devant et de derrière).
        tri[k] = a0; tri[k + 1] = b0; tri[k + 2] = b1;
        tri[k + 3] = a0; tri[k + 4] = b1; tri[k + 5] = a1;
        tri[k + 6] = a0; tri[k + 7] = b1; tri[k + 8] = b0;
        tri[k + 9] = a0; tri[k + 10] = a1; tri[k + 11] = b1;
      }
      m.vertices = v;
      m.triangles = tri;
      m.RecalculateNormals();
      m.RecalculateBounds();
      return m;
    }

    /** Un tube ouvert (faces tournées vers l'intérieur), le long de +Z. */
    static Mesh Tube(float r, float longueur, int n)
    {
      var m = new Mesh { name = "Tube" };
      var v = new Vector3[n * 2];
      var tri = new int[n * 6];
      for (int i = 0; i < n; i++)
      {
        float a = Mathf.PI * 2 * i / n;
        var d = new Vector3(Mathf.Cos(a) * r, Mathf.Sin(a) * r, 0);
        v[i * 2] = d;
        v[i * 2 + 1] = d + new Vector3(0, 0, longueur);
        int j = (i + 1) % n, k = i * 6;
        tri[k] = i * 2; tri[k + 1] = i * 2 + 1; tri[k + 2] = j * 2 + 1;
        tri[k + 3] = i * 2; tri[k + 4] = j * 2 + 1; tri[k + 5] = j * 2;
      }
      m.vertices = v;
      m.triangles = tri;
      m.RecalculateNormals();
      m.bounds = new Bounds(new Vector3(0, 0, longueur / 2), new Vector3(r * 2, r * 2, longueur));
      return m;
    }
  }
}
