// PORTAL RUSH (Unity) — LES OBJETS DU PARCOURS, tels que la partie les décrit
//
// Chaque objet de Partie.Objets est montré à sa position exacte (o.Pos) sur la trajectoire, dans sa voie : les
// collisions restent calculées par les règles (Partie.Franchir / Heurter), l'affichage ne fait que suivre. Les
// obstacles changeants (o.Avant : mobiles, drones, lasers, portes…) glissent vers la configuration du moment
// (Partie.VoiesA), les failles suivent la courbe de la route, les objets à ramasser tournent et disparaissent quand
// ils sont pris, les obstacles brisés par l'Overdrive éclatent. Le boss flotte devant le vaisseau.
#nullable enable
using System.Collections.Generic;
using PortalRush.Coeur;
using UnityEngine;

namespace PortalRush.Jeu
{
  public sealed class Objets : MonoBehaviour
  {
    public Catalogue? catalogue;
    public Effets? effets;

    sealed class Vue
    {
      public Objet Objet = null!;
      public GameObject Racine = null!;
      public readonly List<Transform> Morceaux = new List<Transform>();
      public readonly List<float> X = new List<float>();
      public float Disparition = -1;
      public bool Collecte;
    }

    readonly Dictionary<int, Vue> vues = new Dictionary<int, Vue>();
    readonly HashSet<int> presents = new HashSet<int>();
    readonly List<int> aRetirer = new List<int>();
    GameObject? boss;
    bool signale;

    public void Vider()
    {
      foreach (var v in vues.Values) Destroy(v.Racine);
      vues.Clear();
      if (boss != null) Destroy(boss);
      boss = null;
    }

    void Start()
    {
      if (Session.Instance != null) Session.Instance.EvenementJeu += QuandEvenement;
    }

    void OnDestroy()
    {
      if (Session.Instance != null) Session.Instance.EvenementJeu -= QuandEvenement;
    }

    static bool EstCollecte(TypeObjet t) => t == TypeObjet.Fragment || t == TypeObjet.Dore || t == TypeObjet.Noyau;

    void LateUpdate()
    {
      var m = Monde.Instance;
      var s = Session.Instance;
      var p = s != null ? s.Partie : null;
      if (m == null || p == null)
      {
        if (vues.Count > 0) Vider();
        return;
      }
      float temps = s!.Horloge;
      presents.Clear();
      foreach (var o in p.Objets)
      {
        presents.Add(o.Id);
        if (!vues.TryGetValue(o.Id, out var v))
        {
          v = Creer(o, m.parcours);
          vues[o.Id] = v;
        }
        Placer(v, p, m.parcours, temps);
      }
      aRetirer.Clear();
      foreach (var kv in vues) if (!presents.Contains(kv.Key)) aRetirer.Add(kv.Key);
      foreach (int id in aRetirer)
      {
        Destroy(vues[id].Racine);
        vues.Remove(id);
      }
      Boss(p, m.parcours, temps);
    }

    Vue Creer(Objet o, Parcours parcours)
    {
      string nom = Noms.De(o.Type);
      var v = new Vue { Objet = o, Collecte = EstCollecte(o.Type) };
      v.Racine = new GameObject(nom + " " + o.Id);
      v.Racine.transform.SetParent(transform, false);
      if (o.Type == TypeObjet.Faille)
      {
        foreach (int voie in o.Voies) v.Morceaux.Add(Faille(v.Racine.transform, o, voie, parcours));
        return v;
      }
      // Le nombre de morceaux : la configuration la plus large (une instance par voie bloquée).
      int n = o.Voies.Length;
      if (o.Avant != null) foreach (var a in o.Avant) n = Mathf.Max(n, a.Voies.Length);
      n = Mathf.Max(1, n);
      for (int i = 0; i < n; i++)
      {
        var modele = catalogue != null ? Catalogue.Trouver(catalogue.objets, nom, (int)(o.Graine * 997) + i) : null;
        GameObject morceau;
        if (modele != null)
        {
          morceau = Instantiate(modele, v.Racine.transform);
          Assembler(morceau.transform, o.Type);
        }
        else
        {
          if (!signale)
          {
            signale = true;
            Debug.Log("[Portal Rush] Objets : modèles absents du catalogue, formes de prototype utilisées.");
          }
          morceau = Formes.Objet(nom, catalogue);
          morceau.transform.SetParent(v.Racine.transform, false);
        }
        v.Morceaux.Add(morceau.transform);
        v.X.Add(i < o.Voies.Length ? o.Voies[i] : 1);
      }
      return v;
    }

    /**
     * Les modèles exportés en pièces (outils/assets/exporter_unity.py) : le rotor a une seule pale, à répéter à 120°
     * et 240° autour de l'axe vertical ; la porte a un seul battant, à doubler (le second tourné d'un demi-tour).
     */
    static void Assembler(Transform racine, TypeObjet type)
    {
      string? piece = type == TypeObjet.Rotor ? "rotor-pale" : type == TypeObjet.Porte ? "porte-battant" : null;
      if (piece == null) return;
      Transform? source = null;
      foreach (var t in racine.GetComponentsInChildren<Transform>(true))
        if (t.name.StartsWith(piece, System.StringComparison.Ordinal)) { source = t; break; }
      if (source == null) return;
      var angles = type == TypeObjet.Rotor ? new[] { 120f, 240f } : new[] { 180f };
      foreach (float a in angles)
      {
        var copie = Instantiate(source.gameObject, source.parent).transform;
        copie.localPosition = Quaternion.Euler(0, a, 0) * source.localPosition;
        copie.localRotation = Quaternion.Euler(0, a, 0) * source.localRotation;
      }
    }

    /** Une bande de faille posée sur la voie, qui suit la courbe de la route de Pos à Pos + Longueur. */
    Transform Faille(Transform parent, Objet o, int voie, Parcours parcours)
    {
      var go = new GameObject("Faille " + voie);
      go.transform.SetParent(parent, false);
      var mesh = new Mesh { name = "Faille" };
      float longueur = (float)(o.Longueur ?? 20);
      int n = Mathf.Max(2, Mathf.CeilToInt(longueur / 2f));
      var sommets = new Vector3[(n + 1) * 2];
      var uvs = new Vector2[sommets.Length];
      var tri = new int[n * 6];
      for (int j = 0; j <= n; j++)
      {
        double s = o.Pos + longueur * j / n;
        var a = parcours.PoseA(s, voie, 0.03f);
        sommets[j * 2] = a.position + a.rotation * new Vector3(-1.45f, 0, 0);
        sommets[j * 2 + 1] = a.position + a.rotation * new Vector3(1.45f, 0, 0);
        uvs[j * 2] = new Vector2(0, longueur * j / n / 4f);
        uvs[j * 2 + 1] = new Vector2(1, longueur * j / n / 4f);
        if (j == n) break;
        int k = j * 6, i0 = j * 2;
        tri[k] = i0; tri[k + 1] = i0 + 2; tri[k + 2] = i0 + 3;
        tri[k + 3] = i0; tri[k + 4] = i0 + 3; tri[k + 5] = i0 + 1;
      }
      mesh.vertices = sommets;
      mesh.uv = uvs;
      mesh.triangles = tri;
      mesh.RecalculateNormals();
      mesh.RecalculateBounds();
      go.AddComponent<MeshFilter>().sharedMesh = mesh;
      var r = go.AddComponent<MeshRenderer>();
      r.sharedMaterial = catalogue != null ? catalogue.faille : null;
      r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
      return go.transform;
    }

    void Placer(Vue v, Partie p, Parcours parcours, float temps)
    {
      var o = v.Objet;
      if (o.Type == TypeObjet.Faille) return; // posée une fois pour toutes
      double z = o.Pos - p.Distance;
      // Disparition (ramassé, brisé) : un bref grossissement puis plus rien.
      if (o.Detruit && v.Disparition < 0) v.Disparition = 0;
      if (v.Disparition >= 0)
      {
        v.Disparition += Time.deltaTime;
        float f = v.Disparition / 0.22f;
        foreach (var t in v.Morceaux) t.localScale = Vector3.one * (1f + f * (v.Collecte ? 0.8f : 0.3f)) * Mathf.Max(0, 1 - f);
        if (f >= 1) v.Racine.SetActive(false);
      }
      int[] voies = o.Type == TypeObjet.Portail || v.Collecte ? o.Voies : p.VoiesA(o, System.Math.Max(0, z));
      float dt = Time.deltaTime;
      for (int i = 0; i < v.Morceaux.Count; i++)
      {
        var t = v.Morceaux[i];
        bool actif = i < voies.Length;
        if (t.gameObject.activeSelf != actif) t.gameObject.SetActive(actif);
        if (!actif) continue;
        // Les obstacles changeants glissent vers leur nouvelle voie (8 voies/s), les autres y sont d'emblée.
        v.X[i] = Mathf.MoveTowards(v.X[i], voies[i], dt * 8f);
        float hauteur = 0;
        var tourne = Quaternion.identity;
        switch (o.Type)
        {
          case TypeObjet.Fragment:
          case TypeObjet.Dore:
          case TypeObjet.Noyau:
            hauteur = Mathf.Sin(temps * 3f + o.Id) * 0.18f;
            tourne = Quaternion.Euler(0, temps * 140f + o.Id * 37, 0);
            break;
          case TypeObjet.Chute:
            hauteur = Mathf.Max(0f, (float)(z - 14) * 0.9f);
            break;
          case TypeObjet.Frappe:
            hauteur = z > 26 ? 7f : z > 9 ? Mathf.Lerp(0f, 7f, (float)((z - 9) / 17)) : 0f;
            break;
          case TypeObjet.Drone:
            hauteur = Mathf.Sin(temps * 2.4f + o.Id) * 0.25f;
            break;
          case TypeObjet.Rotor:
            // Le rotor balaie la route à l'horizontale (pales autour de l'axe vertical, comme le jeu web).
            tourne = Quaternion.Euler(0, temps * 220f, 0);
            break;
        }
        var pose = parcours.PoseA(o.Pos, v.X[i], hauteur);
        t.SetPositionAndRotation(pose.position, pose.rotation * tourne);
      }
    }

    void Boss(Partie p, Parcours parcours, float temps)
    {
      if (p.Boss == null)
      {
        if (boss != null) Destroy(boss);
        boss = null;
        return;
      }
      if (boss == null)
      {
        var modele = catalogue != null ? Catalogue.Trouver(catalogue.objets, "boss") : null;
        boss = modele != null ? Instantiate(modele, transform) : Formes.Pave(transform, catalogue?.danger, Vector3.zero, new Vector3(7f, 7f, 7f), "Boss (prototype)", PrimitiveType.Sphere);
      }
      // Devant le vaisseau, au-dessus de la route ; il s'éloigne un peu à chaque phase.
      double devant = 62 + 6 * p.Boss.Phase;
      var pose = parcours.PoseA(p.Distance + devant, 1 + Mathf.Sin(temps * 0.7f) * 0.6f, 9f + Mathf.Sin(temps * 1.3f));
      boss.transform.SetPositionAndRotation(pose.position, pose.rotation * Quaternion.Euler(0, 180, 0));
      boss.SetActive(p.Boss.Vie > 0);
    }

    void QuandEvenement(Evenement e)
    {
      if (effets == null || Monde.Instance == null) return;
      var p = Session.Instance != null ? Session.Instance.Partie : null;
      if (p == null) return;
      var parcours = Monde.Instance.parcours;
      switch (e.Type)
      {
        case TypeEvenement.Fragment:
        case TypeEvenement.Dore:
        case TypeEvenement.Noyau:
          effets.Eclat(parcours.PoseA(p.Distance, e.Voie ?? p.X, 1.1f).position, e.Type == TypeEvenement.Fragment ? Effets.Genre.Energie : Effets.Genre.Dore);
          break;
        case TypeEvenement.Detruit:
          effets.Eclat(parcours.PoseA(p.Distance + 2, e.Voie ?? p.X, 0.9f).position, Effets.Genre.Debris);
          break;
        case TypeEvenement.Choc:
          effets.Eclat(parcours.PoseA(p.Distance + 1, p.X, 0.8f).position, Effets.Genre.Choc);
          break;
        case TypeEvenement.BossTouche:
          if (boss != null) effets.Eclat(boss.transform.position, Effets.Genre.Choc);
          break;
      }
    }
  }
}
