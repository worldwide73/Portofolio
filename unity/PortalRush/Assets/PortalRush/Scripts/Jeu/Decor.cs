// PORTAL RUSH (Unity) — LE DÉCOR le long de la route
//
// Par tranches de 96 m, placées de façon reproductible (graine de la partie + numéro de tranche) : piliers sous la
// route, portiques lumineux (rythme propre à chaque monde), nervures de tunnel pour les mondes à voûte, tours et
// structures sur plusieurs plans de profondeur. Les modules viennent du catalogue (modèles Blender) : « monde/usage »
// puis « commun/usage » ; sinon une forme simple de prototype (Formes), à remplacer par la production graphique.
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Coeur;
using UnityEngine;

namespace PortalRush.Jeu
{
  public sealed class Decor : MonoBehaviour
  {
    const int LongueurTranche = 96;
    public Catalogue? catalogue;
    public float vue = 700f;

    readonly Dictionary<int, GameObject> tranches = new Dictionary<int, GameObject>();
    readonly List<int> aRetirer = new List<int>();
    Parcours? parcours;
    Ambiance style = Ambiances.De(Theme.Lancement);
    double graine;
    bool signale;

    public void Preparer(Parcours p, Ambiance a, double g)
    {
      parcours = p;
      style = a;
      graine = g;
      foreach (var t in tranches.Values) Destroy(t);
      tranches.Clear();
    }

    /** Mode infini : les tranches suivantes prennent le style du nouveau monde. */
    public void ChangerStyle(Ambiance a) => style = a;

    void LateUpdate()
    {
      var m = Monde.Instance;
      if (parcours == null || m == null) return;
      double d = m.Distance;
      int premier = Mathf.FloorToInt((float)((d - 60) / LongueurTranche));
      int dernier = Mathf.FloorToInt((float)((d + vue) / LongueurTranche));
      aRetirer.Clear();
      foreach (var kv in tranches) if (kv.Key < premier || kv.Key > dernier) aRetirer.Add(kv.Key);
      foreach (int n in aRetirer)
      {
        Destroy(tranches[n]);
        tranches.Remove(n);
      }
      for (int n = Math.Max(0, premier); n <= dernier; n++)
      {
        if (tranches.ContainsKey(n)) continue;
        tranches[n] = Construire(n);
        break; // une tranche par image au plus
      }
    }

    GameObject? Modele(string usage, int variante)
    {
      if (catalogue == null) return null;
      string monde = Noms.De(style.Theme);
      return Catalogue.Trouver(catalogue.decor, monde + "/" + usage, variante) ?? Catalogue.Trouver(catalogue.decor, "commun/" + usage, variante);
    }

    GameObject Construire(int n)
    {
      var tranche = new GameObject("Decor " + n);
      tranche.transform.SetParent(transform, false);
      var h = new Hasard(graine * 31 + n * 977 + 5);
      int s0 = n * LongueurTranche;
      var p = parcours!;

      // Piliers sous la route.
      for (int s = s0; s < s0 + LongueurTranche; s += 24)
      {
        if (s < 30) continue;
        var pose = p.CentreA(s);
        Poser(tranche, Modele("pilier", (int)(h.Suivant() * 8)), pose, new Vector3(0, -1.2f, 0), () => Formes.Pilier(catalogue?.metal, 34f));
      }
      // Portiques.
      if (style.Portiques > 0)
      {
        float pas = style.Portiques;
        double premier = Math.Ceiling(s0 / pas) * pas;
        for (double s = premier; s < s0 + LongueurTranche; s += pas)
        {
          if (s < 60) continue;
          Poser(tranche, Modele("portique", (int)(h.Suivant() * 8)), p.CentreA(s), Vector3.zero, () => Formes.Portique(catalogue?.metal, catalogue?.energie, Route.DemiLargeur + 1.6f, 7.6f));
        }
      }
      // Tunnel (mondes à voûte) : une tranche sur trois, nervures tous les 12 m.
      if (style.Voute && n % 3 == 1)
        for (int s = s0; s < s0 + LongueurTranche; s += 12)
          Poser(tranche, Modele("voute", 0), p.CentreA(s), Vector3.zero, () => Formes.Nervure(catalogue?.metal, catalogue?.energie, Route.DemiLargeur + 2.2f, 9f));
      // Tours et structures, à plusieurs distances.
      for (int k = 0; k < 5; k++)
      {
        double s = s0 + h.Suivant() * LongueurTranche;
        float cote = h.Suivant() < 0.5 ? -1f : 1f;
        float loin = Mathf.Lerp(26f, 190f, (float)Math.Pow(h.Suivant(), 1.6));
        float haut = Mathf.Lerp(18f, 150f, (float)h.Suivant());
        float large = Mathf.Lerp(5f, 18f, (float)h.Suivant());
        int variante = (int)(h.Suivant() * 16);
        float lacet = (float)(h.Suivant() * 360);
        var pose = p.CentreA(s);
        Poser(tranche, Modele("tour", variante), pose, new Vector3(cote * loin, -40f, 0), () => Formes.Tour(catalogue?.metal, catalogue?.energie, haut, large), lacet);
      }
      return tranche;
    }

    void Poser(GameObject parent, GameObject? modele, Pose pose, Vector3 decalage, Func<GameObject> secours, float lacet = 0)
    {
      GameObject o;
      if (modele != null) o = Instantiate(modele, parent.transform);
      else
      {
        if (!signale)
        {
          signale = true;
          Debug.Log("[Portal Rush] Décor : modèles absents du catalogue, formes de prototype utilisées.");
        }
        o = secours();
        o.transform.SetParent(parent.transform, false);
      }
      // Les structures latérales restent verticales (pas de dévers), le reste suit la route.
      bool vertical = Mathf.Abs(decalage.x) > 20f;
      var rot = vertical ? Quaternion.Euler(0, pose.rotation.eulerAngles.y + lacet, 0) : pose.rotation;
      o.transform.SetPositionAndRotation(pose.position + pose.rotation * new Vector3(decalage.x, 0, 0) + Vector3.up * decalage.y, rot);
    }
  }
}
