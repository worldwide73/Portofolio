// PORTAL RUSH (Unity) — LA VITRINE : le vaisseau montré dans les menus et au garage (contrat §5.2).
//
// Hors partie, le vaisseau choisi glisse sur la route qui défile (menus) ; au garage, la caméra tourne autour de lui
// (CameraJeu lit ce mode). L'interface appelle Montrer / Masquer ; l'équipement colore la coque et la traînée.
#nullable enable
using UnityEngine;

namespace PortalRush.Jeu
{
  public sealed class Vitrine : MonoBehaviour
  {
    public enum Etat { Masquee, Menu, Garage }

    public static Etat Mode { get; private set; } = Etat.Menu;
    public static string Vehicule { get; private set; } = "aube";
    public static Equipement? Equipement { get; private set; }
    /** Change à chaque appel : le vaisseau sait qu'il doit se rafraîchir. */
    public static int Version { get; private set; }

    public static void Montrer(string vehicule, Equipement? equipement, bool garage)
    {
      Vehicule = string.IsNullOrEmpty(vehicule) ? "aube" : vehicule;
      Equipement = equipement;
      Mode = garage ? Etat.Garage : Etat.Menu;
      Version++;
    }

    public static void Masquer()
    {
      Mode = Etat.Masquee;
      Version++;
    }
  }
}
