// PORTAL RUSH (Unity) — FORMES DE PROTOTYPE
//
// Des formes simples, construites à partir des primitives de Unity, utilisées UNIQUEMENT quand le catalogue n'a pas
// encore le modèle Blender correspondant : elles gardent la bonne taille et la bonne lecture (danger rouge, énergie
// cyan, doré…) pour tester le jeu. La production graphique les remplace par les vrais modèles.
#nullable enable
using UnityEngine;

namespace PortalRush.Jeu
{
  public static class Formes
  {
    /** Un pavé (sans collisionneur : les collisions sont calculées par les règles). */
    public static GameObject Pave(Transform? parent, Material? m, Vector3 position, Vector3 taille, string nom = "Pave", PrimitiveType type = PrimitiveType.Cube)
    {
      var o = GameObject.CreatePrimitive(type);
      o.name = nom;
      var c = o.GetComponent<Collider>();
      if (c != null) Object.Destroy(c);
      if (parent != null) o.transform.SetParent(parent, false);
      o.transform.localPosition = position;
      o.transform.localScale = taille;
      var r = o.GetComponent<MeshRenderer>();
      if (m != null) r.sharedMaterial = m;
      return o;
    }

    static GameObject Racine(string nom) => new GameObject(nom + " (prototype)");

    public static GameObject Pilier(Material? metal, float hauteur)
    {
      var o = Racine("Pilier");
      Pave(o.transform, metal, new Vector3(0, -hauteur / 2, 0), new Vector3(1.6f, hauteur, 1.6f));
      Pave(o.transform, metal, new Vector3(0, -0.4f, 0), new Vector3(6f, 0.8f, 1.2f));
      return o;
    }

    public static GameObject Portique(Material? metal, Material? energie, float demiLargeur, float hauteur)
    {
      var o = Racine("Portique");
      foreach (float c in new[] { -1f, 1f })
      {
        Pave(o.transform, metal, new Vector3(c * demiLargeur, hauteur / 2, 0), new Vector3(0.9f, hauteur, 1.4f));
        Pave(o.transform, energie, new Vector3(c * (demiLargeur - 0.5f), hauteur / 2, 0), new Vector3(0.08f, hauteur * 0.8f, 0.3f));
      }
      Pave(o.transform, metal, new Vector3(0, hauteur, 0), new Vector3(demiLargeur * 2 + 0.9f, 0.9f, 1.4f));
      Pave(o.transform, energie, new Vector3(0, hauteur - 0.5f, 0), new Vector3(demiLargeur * 2 - 1f, 0.1f, 0.3f));
      return o;
    }

    public static GameObject Nervure(Material? metal, Material? energie, float demiLargeur, float hauteur)
    {
      var o = Racine("Nervure");
      const int morceaux = 9;
      for (int i = 0; i <= morceaux; i++)
      {
        float a = Mathf.PI * i / morceaux;
        var pos = new Vector3(-Mathf.Cos(a) * demiLargeur, Mathf.Sin(a) * hauteur, 0);
        var p = Pave(o.transform, i % 3 == 0 ? energie : metal, pos, new Vector3(1.2f, 1.2f, 0.7f));
        p.transform.localRotation = Quaternion.Euler(0, 0, -Mathf.Rad2Deg * a);
      }
      return o;
    }

    public static GameObject Tour(Material? metal, Material? energie, float hauteur, float largeur)
    {
      var o = Racine("Tour");
      Pave(o.transform, metal, new Vector3(0, hauteur / 2, 0), new Vector3(largeur, hauteur, largeur));
      Pave(o.transform, metal, new Vector3(0, hauteur + 2, 0), new Vector3(largeur * 0.6f, 4f, largeur * 0.6f));
      for (float y = 8; y < hauteur; y += 11)
        Pave(o.transform, energie, new Vector3(0, y, 0), new Vector3(largeur * 1.02f, 0.25f, largeur * 1.02f));
      return o;
    }

    // ---- Les objets du parcours ----
    public static GameObject Objet(string type, Catalogue? c)
    {
      var o = Racine(type);
      var t = o.transform;
      switch (type)
      {
        case "bloc":
          Pave(t, c?.metal, new Vector3(0, 0.8f, 0), new Vector3(2.7f, 1.6f, 0.9f));
          Pave(t, c?.danger, new Vector3(0, 1.2f, -0.47f), new Vector3(2.5f, 0.18f, 0.04f));
          break;
        case "debris":
          var r = Pave(t, c?.metal, new Vector3(0, 0.9f, 0), new Vector3(1.9f, 1.5f, 1.7f), "Rocher", PrimitiveType.Sphere);
          r.transform.localRotation = Quaternion.Euler(20, 35, 10);
          break;
        case "laser":
          Pave(t, c?.metal, new Vector3(-1.5f, 0.9f, 0), new Vector3(0.25f, 1.8f, 0.25f));
          Pave(t, c?.metal, new Vector3(1.5f, 0.9f, 0), new Vector3(0.25f, 1.8f, 0.25f));
          Pave(t, c?.danger, new Vector3(0, 0.9f, 0), new Vector3(3f, 0.07f, 0.07f), "Faisceau");
          Pave(t, c?.danger, new Vector3(0, 0.45f, 0), new Vector3(3f, 0.05f, 0.05f), "Faisceau");
          break;
        case "mobile":
        case "eclaireur":
          Pave(t, c?.metal, new Vector3(0, 0.9f, 0), new Vector3(2.4f, 1.1f, 2.2f));
          Pave(t, c?.danger, new Vector3(0, 0.9f, -1.12f), new Vector3(2f, 0.2f, 0.04f));
          break;
        case "drone":
          Pave(t, c?.metal, new Vector3(0, 1.6f, 0), new Vector3(1.6f, 0.5f, 1.6f), "Corps", PrimitiveType.Sphere);
          Pave(t, c?.danger, new Vector3(0, 1.6f, -0.6f), new Vector3(0.5f, 0.5f, 0.2f), "Oeil", PrimitiveType.Sphere);
          break;
        case "porte":
          Pave(t, c?.metal, new Vector3(0, 1.4f, 0), new Vector3(3f, 2.8f, 0.4f));
          Pave(t, c?.danger, new Vector3(0, 1.4f, -0.22f), new Vector3(0.12f, 2.6f, 0.04f));
          break;
        case "rotor":
          Pave(t, c?.metal, new Vector3(0, 1.1f, 0), new Vector3(0.6f, 0.6f, 0.6f), "Moyeu", PrimitiveType.Cylinder);
          Pave(t, c?.danger, new Vector3(0, 1.1f, 0), new Vector3(5.8f, 0.2f, 0.35f), "Pale");
          break;
        case "chute":
          Pave(t, c?.metal, new Vector3(0, 1f, 0), new Vector3(2.6f, 2f, 2.6f));
          Pave(t, c?.danger, new Vector3(0, 0.02f, 0), new Vector3(2.8f, 0.02f, 2.8f), "Ombre");
          break;
        case "frappe":
          Pave(t, c?.danger, new Vector3(0, 1.2f, 0), new Vector3(2.8f, 2.4f, 1.2f));
          break;
        case "faille":
          Pave(t, c?.faille, new Vector3(0, 0.03f, 0.5f), new Vector3(3f, 0.04f, 1f), "Champ");
          break;
        case "portail":
          var anneau = Pave(t, c?.portail, new Vector3(0, 1.4f, 0), new Vector3(2.6f, 0.12f, 2.6f), "Anneau", PrimitiveType.Cylinder);
          anneau.transform.localRotation = Quaternion.Euler(90, 0, 0);
          break;
        case "fragment":
          Pave(t, c?.energie, new Vector3(0, 1.1f, 0), new Vector3(0.55f, 0.85f, 0.55f), "Cristal", PrimitiveType.Capsule);
          break;
        case "dore":
          Pave(t, c?.dore, new Vector3(0, 1.1f, 0), new Vector3(0.7f, 1f, 0.7f), "Cristal", PrimitiveType.Capsule);
          break;
        case "noyau":
          Pave(t, c?.dore, new Vector3(0, 1.3f, 0), new Vector3(1f, 1f, 1f), "Noyau", PrimitiveType.Sphere);
          break;
        default:
          Pave(t, c?.danger, new Vector3(0, 0.8f, 0), new Vector3(2.4f, 1.6f, 1f));
          break;
      }
      return o;
    }

    /** Un vaisseau de prototype (nez vers +Z), aux proportions du vaisseau du joueur. */
    public static GameObject Vaisseau(Catalogue? c)
    {
      var o = Racine("Vaisseau");
      var t = o.transform;
      var corps = Pave(t, c?.coque, new Vector3(0, 0, 0), new Vector3(1.1f, 0.38f, 3.4f));
      corps.name = "Coque";
      Pave(t, c?.coque, new Vector3(-1.05f, -0.05f, -0.5f), new Vector3(1.1f, 0.18f, 1.8f), "Aile");
      Pave(t, c?.coque, new Vector3(1.05f, -0.05f, -0.5f), new Vector3(1.1f, 0.18f, 1.8f), "Aile");
      Pave(t, c?.energie, new Vector3(-0.42f, 0, -1.72f), new Vector3(0.3f, 0.22f, 0.06f), "Tuyere");
      Pave(t, c?.energie, new Vector3(0.42f, 0, -1.72f), new Vector3(0.3f, 0.22f, 0.06f), "Tuyere");
      return o;
    }
  }
}
