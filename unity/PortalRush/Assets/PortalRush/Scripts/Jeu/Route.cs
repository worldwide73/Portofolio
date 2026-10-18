// PORTAL RUSH (Unity) — LA ROUTE : un profil en coupe extrudé le long de la trajectoire.
//
// Le profil (moitié droite, symétrique) : un revêtement large et continu (trois voies + accotements), des bordures
// profilées avec un rail lumineux intérieur, un flanc avec un liseré lumineux extérieur, une quille de structure
// dessous. Les séparations de voies sont des tirets lumineux posés sur le revêtement. La route est construite par
// tronçons de 32 m (un anneau par mètre : surface lisse dans les virages), créés devant le vaisseau et recyclés
// derrière lui. Quatre sous-maillages : revêtement, structure, lumière, lignes (matériaux affectés par la scène).
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace PortalRush.Jeu
{
  public sealed class Route : MonoBehaviour
  {
    public const int Revetement = 0, Structure = 1, Lumiere = 2, Lignes = 3;
    /** Demi-largeur du revêtement (m) : 1,5 voie + accotement. */
    public const float DemiLargeur = Parcours.Voie * 1.5f + 0.8f;
    const int LongueurTroncon = 32;

    [Tooltip("Revêtement, structure, lumière, lignes")]
    public Material[] materiaux = new Material[4];
    /** Distance de vue devant le vaisseau (m) ; réglée par la qualité. */
    public float vue = 650f;
    public float derriere = 48f;

    struct Segment
    {
      public Vector2 A, B;
      public int Matiere;
      public Segment(float ax, float ay, float bx, float by, int m) { A = new Vector2(ax, ay); B = new Vector2(bx, by); Matiere = m; }
    }

    sealed class Troncon
    {
      public GameObject Objet = null!;
      public Mesh Maillage = null!;
      public int Numero;
    }

    readonly Dictionary<int, Troncon> actifs = new Dictionary<int, Troncon>();
    readonly Stack<Troncon> libres = new Stack<Troncon>();
    readonly List<int> aRetirer = new List<int>();
    Segment[] profil = Array.Empty<Segment>();
    Parcours? parcours;
    int generation;

    // Tampons réutilisés.
    readonly List<Vector3> sommets = new List<Vector3>(8192);
    readonly List<Vector3> normales = new List<Vector3>(8192);
    readonly List<Vector2> uvs = new List<Vector2>(8192);
    readonly List<int>[] triangles = { new List<int>(8192), new List<int>(8192), new List<int>(4096), new List<int>(2048) };

    /** Repart de zéro (nouvelle trajectoire ou nouveau style). */
    public void Preparer(Parcours p, Ambiance a)
    {
      parcours = p;
      profil = Profil(a.Bordures);
      generation++;
      foreach (var t in actifs.Values) Liberer(t);
      actifs.Clear();
    }

    /** Le profil en coupe, sens horaire vu de derrière (la normale est à gauche du sens de parcours). */
    static Segment[] Profil(float b)
    {
      float d = DemiLargeur;
      var droite = new List<Segment>
      {
        new Segment(0, 0, d, 0, Revetement),
        new Segment(d, 0, d, 0.26f, Structure),
        new Segment(d, 0.26f, d, 0.4f, Lumiere),
        new Segment(d, 0.4f, d + 0.14f, b, Structure),
        new Segment(d + 0.14f, b, d + 0.78f, b, Structure),
        new Segment(d + 0.78f, b, d + 1.08f, b - 0.22f, Structure),
        new Segment(d + 1.08f, b - 0.22f, d + 1.08f, -0.52f, Structure),
        new Segment(d + 1.08f, -0.52f, d + 1.08f, -0.66f, Lumiere),
        new Segment(d + 1.08f, -0.66f, d - 0.4f, -0.95f, Structure),
        new Segment(d - 0.4f, -0.95f, 2.2f, -1.22f, Structure),
        new Segment(2.2f, -1.22f, 0, -1.3f, Structure),
      };
      // La moitié gauche : le miroir, parcouru à l'envers pour garder le sens horaire.
      var tout = new List<Segment>(droite);
      for (int i = droite.Count - 1; i >= 0; i--)
      {
        var s = droite[i];
        tout.Add(new Segment(-s.B.x, s.B.y, -s.A.x, s.A.y, s.Matiere));
      }
      return tout.ToArray();
    }

    void LateUpdate()
    {
      var m = Monde.Instance;
      if (parcours == null || m == null || profil.Length == 0) return;
      double d = m.Distance;
      int premier = Mathf.FloorToInt((float)((d - derriere) / LongueurTroncon));
      int dernier = Mathf.FloorToInt((float)((d + vue) / LongueurTroncon));
      aRetirer.Clear();
      foreach (var kv in actifs) if (kv.Key < premier || kv.Key > dernier) aRetirer.Add(kv.Key);
      foreach (int n in aRetirer)
      {
        Liberer(actifs[n]);
        actifs.Remove(n);
      }
      // Au plus deux tronçons neufs par image : pas d'à-coup.
      int construits = 0;
      for (int n = Math.Max(0, premier); n <= dernier && construits < 2; n++)
      {
        if (actifs.ContainsKey(n)) continue;
        actifs[n] = Construire(n);
        construits++;
      }
    }

    void Liberer(Troncon t)
    {
      t.Objet.SetActive(false);
      libres.Push(t);
    }

    Troncon Neuf()
    {
      if (libres.Count > 0)
      {
        var t = libres.Pop();
        t.Objet.SetActive(true);
        return t;
      }
      var o = new GameObject("Troncon");
      o.transform.SetParent(transform, false);
      var mf = o.AddComponent<MeshFilter>();
      var mr = o.AddComponent<MeshRenderer>();
      mr.sharedMaterials = materiaux;
      mr.shadowCastingMode = ShadowCastingMode.Off;
      mr.receiveShadows = true;
      var mesh = new Mesh { name = "Route" };
      mesh.MarkDynamic();
      mf.sharedMesh = mesh;
      return new Troncon { Objet = o, Maillage = mesh };
    }

    Troncon Construire(int numero)
    {
      var t = Neuf();
      t.Numero = numero;
      t.Objet.name = "Troncon " + numero;
      var p = parcours!;
      sommets.Clear();
      normales.Clear();
      uvs.Clear();
      foreach (var l in triangles) l.Clear();
      int s0 = numero * LongueurTroncon;
      int anneaux = LongueurTroncon + 1;

      // ---- Le profil extrudé ----
      float longueurProfil = 0;
      foreach (var seg in profil)
      {
        Vector2 dir = seg.B - seg.A;
        float lg = dir.magnitude;
        if (lg < 1e-4f) continue;
        var n2 = new Vector3(-dir.y, dir.x, 0) / lg;
        int base0 = sommets.Count;
        for (int j = 0; j < anneaux; j++)
        {
          double s = s0 + j;
          var pose = p.CentreA(s);
          sommets.Add(pose.position + pose.rotation * new Vector3(seg.A.x, seg.A.y, 0));
          sommets.Add(pose.position + pose.rotation * new Vector3(seg.B.x, seg.B.y, 0));
          var n = pose.rotation * n2;
          normales.Add(n);
          normales.Add(n);
          float v = (float)(s / 8.0);
          if (seg.Matiere == Revetement)
          {
            uvs.Add(new Vector2(seg.A.x / (2 * DemiLargeur) + 0.5f, v));
            uvs.Add(new Vector2(seg.B.x / (2 * DemiLargeur) + 0.5f, v));
          }
          else
          {
            uvs.Add(new Vector2(longueurProfil / 2f, v));
            uvs.Add(new Vector2((longueurProfil + lg) / 2f, v));
          }
        }
        longueurProfil += lg;
        var tri = triangles[seg.Matiere];
        for (int j = 0; j < anneaux - 1; j++)
        {
          int a = base0 + j * 2, b = a + 1, a2 = a + 2, b2 = a + 3;
          tri.Add(a); tri.Add(a2); tri.Add(b2);
          tri.Add(a); tri.Add(b2); tri.Add(b);
        }
      }

      // ---- Les séparations de voies (tirets de 5 m, 3 m d'écart) et les lignes de rive (continues) ----
      float[] tirets = { -Parcours.Voie / 2, Parcours.Voie / 2 };
      foreach (float x in tirets) Bande(p, s0, x, 0.09f, true);
      Bande(p, s0, -(Parcours.Voie * 1.5f + 0.35f), 0.12f, false);
      Bande(p, s0, Parcours.Voie * 1.5f + 0.35f, 0.12f, false);

      var mesh = t.Maillage;
      mesh.Clear();
      mesh.SetVertices(sommets);
      mesh.SetNormals(normales);
      mesh.SetUVs(0, uvs);
      mesh.subMeshCount = 4;
      for (int i = 0; i < 4; i++) mesh.SetTriangles(triangles[i], i, false);
      mesh.RecalculateBounds();
      mesh.RecalculateTangents();
      return t;
    }

    /** Une bande lumineuse posée sur le revêtement, en tirets ou continue. */
    void Bande(Parcours p, int s0, float x, float demi, bool enTirets)
    {
      var tri = triangles[Lignes];
      for (int j = 0; j < LongueurTroncon; j++)
      {
        int s = s0 + j;
        if (enTirets && (s % 8) >= 5) continue;
        var a = p.CentreA(s);
        var b = p.CentreA(s + 1);
        int i0 = sommets.Count;
        sommets.Add(a.position + a.rotation * new Vector3(x - demi, 0.015f, 0));
        sommets.Add(a.position + a.rotation * new Vector3(x + demi, 0.015f, 0));
        sommets.Add(b.position + b.rotation * new Vector3(x - demi, 0.015f, 0));
        sommets.Add(b.position + b.rotation * new Vector3(x + demi, 0.015f, 0));
        var n = a.rotation * Vector3.up;
        normales.Add(n); normales.Add(n); normales.Add(b.rotation * Vector3.up); normales.Add(b.rotation * Vector3.up);
        float v0 = s / 4f, v1 = (s + 1) / 4f;
        uvs.Add(new Vector2(0, v0)); uvs.Add(new Vector2(1, v0)); uvs.Add(new Vector2(0, v1)); uvs.Add(new Vector2(1, v1));
        tri.Add(i0); tri.Add(i0 + 2); tri.Add(i0 + 3);
        tri.Add(i0); tri.Add(i0 + 3); tri.Add(i0 + 1);
      }
    }
  }
}
