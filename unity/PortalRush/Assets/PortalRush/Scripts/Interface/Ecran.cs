// PORTAL RUSH (Unity) — UN ÉCRAN, ET LA NAVIGATION AU CLAVIER
//
// Chaque écran (menu, modes, campagne…) est une classe qui tient sa partie de l'UXML : elle écrit ses textes
// (Rafraichir, aussi après un changement de langue ou de vue), dit son action principale (Entrée ou Espace quand
// rien n'a le focus), son premier focus, ce que fait Échap (Retour), et le nom envoyé à la page (Pont.Ecran).
//
// La navigation : l'interface la fait elle-même, dans la « zone » ouverte (fenêtre de confirmation, réglages,
// liste de langues, écran), pour qu'une flèche ne sorte jamais d'une fenêtre : ↑ ↓ ← → vont vers la commande la
// plus proche dans cette direction (grilles des secteurs, des vaisseaux) ; Tab et Maj+Tab suivent l'ordre.
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public abstract class Ecran
  {
    protected readonly Interface ui;
    public readonly VisualElement Racine;

    protected Ecran(Interface ui, VisualElement racine)
    {
      this.ui = ui;
      Racine = racine;
    }

    /** Le nom envoyé à la page (contrat §5.4 : menu, niveaux, garage, records, pause, fin…). */
    public abstract string NomPont { get; }
    /** Ce qu'écrit la barre du haut (« Menu principal », « Campagne »…). */
    public abstract string Module { get; }
    /** Ce que fait Échap, écrit à côté de la touche. */
    public virtual string Echap => Textes.De("barre.echap.retour");
    /** Le vaisseau en vitrine derrière l'écran : aucun, menu ou garage. */
    public virtual Vitrine3D Vitrine => Vitrine3D.Menu;
    /** Le décor 3D s'estompe derrière les écrans de détail (comme le jeu web). */
    public virtual bool Voile => true;

    /** Écrit les textes et les données (aussi après un changement de langue ou de vue). */
    public abstract void Rafraichir();
    public virtual void Entrer() => Rafraichir();
    public virtual void Sortir() { }
    /** L'action principale (Entrée ou Espace quand rien n'a le focus). */
    public virtual Button? Principale => null;
    /** Où va le focus à l'ouverture. */
    public virtual VisualElement? PremierFocus => Principale;
    /** Échap : revient en arrière (au menu principal, par défaut). Vrai si quelque chose a été fait. */
    public virtual bool Retour()
    {
      ui.Montrer(ui.EcranMenu);
      return true;
    }
    /** À chaque image, quand l'écran est affiché. */
    public virtual void Image(float dt) { }
  }

  public enum Vitrine3D { Aucune, Menu, Garage }

  public static class Navigation
  {
    /** L'élément est-il vraiment affiché (lui et ses parents, jusqu'à « limite ») ? */
    public static bool Visible(VisualElement el, VisualElement? limite = null)
    {
      for (VisualElement? e = el; e != null; e = e.hierarchy.parent)
      {
        if (!Ui.Affiche(e) || e.resolvedStyle.visibility == Visibility.Hidden) return false;
        if (e == limite) break;
      }
      var b = el.worldBound;
      return el.enabledInHierarchy && !float.IsNaN(b.width) && b.width > 0.5f && b.height > 0.5f;
    }

    /** Les commandes atteignables d'une zone, dans l'ordre de l'arbre. */
    public static List<VisualElement> Arrets(params VisualElement?[] zones)
    {
      var liste = new List<VisualElement>();
      foreach (var zone in zones)
      {
        if (zone == null || !Visible(zone)) continue;
        zone.Query<VisualElement>().ForEach(el =>
        {
          if (el.focusable && el.canGrabFocus && !el.ClassListContains("hors-navigation") && Visible(el, zone)) liste.Add(el);
        });
      }
      return liste;
    }

    /** La commande la plus proche dans une direction (sens : ←, →, ↑, ↓ ; y vers le bas). */
    public static VisualElement? Voisin(VisualElement ici, List<VisualElement> arrets, Vector2 sens)
    {
      Rect a = ici.worldBound;
      VisualElement? meilleur = null;
      float score = float.MaxValue;
      bool horizontal = Mathf.Abs(sens.x) > 0;
      foreach (var el in arrets)
      {
        if (el == ici) continue;
        Rect b = el.worldBound;
        // L'écart dans la direction voulue (de bord à bord), et le décalage sur l'autre axe.
        float avance = horizontal
          ? (sens.x > 0 ? b.xMin - a.xMax : a.xMin - b.xMax)
          : (sens.y > 0 ? b.yMin - a.yMax : a.yMin - b.yMax);
        float centre = horizontal ? (sens.x > 0 ? b.center.x - a.center.x : a.center.x - b.center.x) : (sens.y > 0 ? b.center.y - a.center.y : a.center.y - b.center.y);
        if (centre <= 1f) continue;
        float decalage = horizontal
          ? Mathf.Max(0, Mathf.Max(a.yMin, b.yMin) - Mathf.Min(a.yMax, b.yMax))
          : Mathf.Max(0, Mathf.Max(a.xMin, b.xMin) - Mathf.Min(a.xMax, b.xMax));
        float s = Mathf.Max(0, avance) + decalage * 2.5f + Mathf.Abs(horizontal ? b.center.y - a.center.y : b.center.x - a.center.x) * 0.05f;
        if (s < score)
        {
          score = s;
          meilleur = el;
        }
      }
      return meilleur;
    }

    /** La commande suivante ou précédente dans l'ordre (en boucle). */
    public static VisualElement? Suivant(VisualElement? ici, List<VisualElement> arrets, int sens)
    {
      if (arrets.Count == 0) return null;
      int i = ici == null ? -1 : arrets.IndexOf(ici);
      if (i < 0) return arrets[sens > 0 ? 0 : arrets.Count - 1];
      return arrets[(i + sens + arrets.Count) % arrets.Count];
    }

    /** La première (ou la dernière) commande dans un sens vertical : pour reboucler en haut ou en bas d'une liste. */
    public static VisualElement? Extreme(List<VisualElement> arrets, bool haut)
    {
      VisualElement? r = null;
      foreach (var el in arrets)
        if (r == null || (haut ? el.worldBound.yMin < r.worldBound.yMin - 1 : el.worldBound.yMax > r.worldBound.yMax + 1)) r = el;
      return r;
    }
  }
}
