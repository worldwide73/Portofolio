// PORTAL RUSH (Unity) — LES COMMANDES DE L'INTERFACE
//
// De petites briques construites sur UI Toolkit, au style du jeu (pas celui de Unity par défaut) :
//   Ui            fabriques (bouton sans le style Unity, étiquette en capitales, élément à classes) ;
//   Interrupteur  un réglage oui / non (un Button : clic, toucher, Entrée ou Espace) ;
//   Curseur       un réglage de 0 à 1 (glisser à la souris ou au doigt ; ← → au clavier, ↑ ↓ en sortent) ;
//   Choix         un choix entre quelques valeurs (segments) ;
//   Onglets       une barre d'onglets.
// Tout ce qui se clique est focalisable : la navigation au clavier de UI Toolkit (flèches, Entrée) y passe.
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public static class Ui
  {
    /** Un élément portant des classes (séparées par des espaces). */
    public static VisualElement Element(string classes = "", VisualElement? parent = null)
    {
      var el = new VisualElement();
      Classes(el, classes);
      parent?.Add(el);
      return el;
    }

    /** Un texte. */
    public static Label Texte(string texte, string classes = "", VisualElement? parent = null)
    {
      var l = new Label(texte);
      NettoyerTexte(l);
      Classes(l, classes);
      parent?.Add(l);
      return l;
    }

    /** Une étiquette (capitales espacées). */
    public static Label Etiquette(string texte, string classes = "", VisualElement? parent = null)
    {
      var l = Texte(Textes.Majuscules(texte), "etiquette " + classes, parent);
      return l;
    }

    /** Un bouton au style du jeu (sans la classe « unity-button » du thème par défaut). */
    public static Button Bouton(string classes, Action? clic, VisualElement? parent = null)
    {
      var b = new Button();
      Nettoyer(b);
      Classes(b, classes);
      if (clic != null) Clic(b, clic);
      parent?.Add(b);
      return b;
    }

    /**
     * L'action d'un bouton : au clic (souris, toucher) et, gardée dans userData, à Entrée ou Espace (l'interface valide
     * elle-même, une seule fois par appui). Une seule action par bouton.
     */
    public static void Clic(Button b, Action action)
    {
      if (b.userData is Action ancienne) b.clicked -= ancienne;
      b.clicked += action;
      b.userData = action;
    }

    /**
     * Retire le style par défaut de Unity d'un bouton (venu de l'UXML ou créé ici) : le thème du jeu le dessine
     * entièrement (plaques, états), sans les règles « .unity-button » du thème par défaut.
     */
    public static void Nettoyer(Button b)
    {
      b.RemoveFromClassList(Button.ussClassName);
      b.RemoveFromClassList(TextElement.ussClassName);
      b.text = "";
    }

    /** De même pour un texte : il hérite seulement des feuilles du jeu (police, taille, couleur de « .pr »). */
    public static void NettoyerTexte(Label l)
    {
      l.RemoveFromClassList(Label.ussClassName);
      l.RemoveFromClassList(TextElement.ussClassName);
    }

    public static void Classes(VisualElement el, string classes)
    {
      if (string.IsNullOrEmpty(classes)) return;
      foreach (var c in classes.Split(' '))
        if (c.Length > 0) el.AddToClassList(c);
    }

    /** Montre ou cache (display), sans toucher au reste du style. */
    public static void Afficher(VisualElement? el, bool visible)
    {
      if (el == null) return;
      var d = visible ? DisplayStyle.Flex : DisplayStyle.None;
      if (el.style.display.value != d || el.style.display.keyword != StyleKeyword.Undefined) el.style.display = d;
    }

    /**
     * L'élément est-il affiché ? Le style posé par le code compte tout de suite (le style résolu, lui, ne suit qu'à la
     * passe de style suivante).
     */
    public static bool Affiche(VisualElement? el)
    {
      if (el == null) return false;
      var d = el.style.display;
      if (d.keyword == StyleKeyword.Undefined) return d.value != DisplayStyle.None;
      return el.resolvedStyle.display != DisplayStyle.None;
    }

    /** Change un texte seulement s'il change (évite de refaire la mise en page du texte à chaque image). */
    public static void Ecrire(TextElement? el, string texte)
    {
      if (el != null && el.text != texte) el.text = texte;
    }

    /** Une barre qui se remplit (échelle horizontale, sans refaire la mise en page). */
    public static void Remplir(VisualElement? el, float part)
    {
      if (el == null) return;
      el.style.scale = new Scale(new Vector2(Mathf.Clamp01(part), 1f));
    }

    /** Une icône dessinée dans un nouvel élément. */
    public static VisualElement Icone(Icone icone, string classes = "", VisualElement? parent = null)
    {
      var el = Element("icone " + classes, parent);
      el.pickingMode = PickingMode.Ignore;
      Formes.Dessiner(el, icone);
      return el;
    }

    /** Une zone qui défile verticalement (molette, doigt), sans barre visible ; elle suit le focus du clavier. */
    public static ScrollView Defilement(string classes, VisualElement? parent = null)
    {
      var sv = new ScrollView(ScrollViewMode.Vertical);
      sv.horizontalScrollerVisibility = ScrollerVisibility.Hidden;
      sv.verticalScrollerVisibility = ScrollerVisibility.Hidden;
      Classes(sv, classes);
      sv.RegisterCallback<FocusInEvent>(e =>
      {
        if (e.target is VisualElement v && v != sv && sv.contentContainer.Contains(v)) sv.ScrollTo(v);
      });
      parent?.Add(sv);
      return sv;
    }

    /** Une touche de clavier dessinée (« Esc », « ← »…). */
    public static Label Touche(string texte, string classes = "", VisualElement? parent = null)
    {
      var l = Texte(texte, "touche " + classes, parent);
      l.pickingMode = PickingMode.Ignore;
      return l;
    }
  }

  // ==========================================================================
  // L'INTERRUPTEUR
  // ==========================================================================
  public sealed class Interrupteur
  {
    public readonly Button Racine;
    readonly Label titre;
    readonly Label detail;
    bool valeur;
    public event Action<bool>? Change;

    public Interrupteur(VisualElement parent)
    {
      Racine = Ui.Bouton("option interrupteur", Basculer, parent);
      var texte = Ui.Element("option__texte", Racine);
      titre = Ui.Texte("", "option__titre", texte);
      detail = Ui.Texte("", "option__detail", texte);
      var rail = Ui.Element("interrupteur__rail", Racine);
      Ui.Element("interrupteur__bouton", rail);
    }

    public void Libelles(string t, string d = "")
    {
      Ui.Ecrire(titre, t);
      Ui.Ecrire(detail, d);
      Ui.Afficher(detail, d.Length > 0);
    }

    public bool Valeur
    {
      get => valeur;
      set
      {
        valeur = value;
        Racine.EnableInClassList("actif", value);
      }
    }

    void Basculer()
    {
      Valeur = !valeur;
      Change?.Invoke(valeur);
    }
  }

  // ==========================================================================
  // LE CURSEUR
  // ==========================================================================
  public sealed class Curseur
  {
    public readonly VisualElement Racine;
    readonly Label titre;
    readonly Label sortie;
    readonly VisualElement rail;
    readonly VisualElement plein;
    readonly VisualElement poignee;
    readonly float pas;
    float valeur;
    int glisse = -1;
    /** Pendant le réglage (à chaque pas) ; puis à la fin d'un glissement ou d'un appui de touche. */
    public event Action<float>? Change;
    public event Action<float>? Fini;

    public Curseur(VisualElement parent, float pas = 0.05f)
    {
      this.pas = pas;
      Racine = Ui.Element("option curseur", parent);
      Racine.focusable = true;
      Racine.tabIndex = 0;
      var tete = Ui.Element("curseur__tete", Racine);
      titre = Ui.Texte("", "option__titre", tete);
      sortie = Ui.Texte("", "curseur__sortie", tete);
      rail = Ui.Element("curseur__rail", Racine);
      Ui.Element("curseur__piste", rail).pickingMode = PickingMode.Ignore;
      plein = Ui.Element("curseur__plein", rail);
      poignee = Ui.Element("curseur__poignee", rail);
      plein.pickingMode = PickingMode.Ignore;
      poignee.pickingMode = PickingMode.Ignore;

      rail.RegisterCallback<PointerDownEvent>(e =>
      {
        glisse = e.pointerId;
        rail.CapturePointer(e.pointerId);
        Racine.Focus();
        Placer(e.position);
        e.StopPropagation();
      });
      rail.RegisterCallback<PointerMoveEvent>(e =>
      {
        if (glisse != e.pointerId) return;
        Placer(e.position);
      });
      rail.RegisterCallback<PointerUpEvent>(e =>
      {
        if (glisse != e.pointerId) return;
        glisse = -1;
        rail.ReleasePointer(e.pointerId);
        Fini?.Invoke(valeur);
      });
      rail.RegisterCallback<PointerCaptureOutEvent>(_ =>
      {
        if (glisse < 0) return;
        glisse = -1;
        Fini?.Invoke(valeur);
      });
      // ← → règlent ; ↑ ↓ passent au réglage voisin (navigation normale).
      Racine.RegisterCallback<NavigationMoveEvent>(e =>
      {
        int sens = e.direction == NavigationMoveEvent.Direction.Left ? -1 : e.direction == NavigationMoveEvent.Direction.Right ? 1 : 0;
        if (sens == 0) return;
        Regler(valeur + sens * pas, true);
        Fini?.Invoke(valeur);
        e.StopPropagation();
        Racine.focusController?.IgnoreEvent(e);
      });
    }

    public void Libelle(string t) => Ui.Ecrire(titre, t);

    public float Valeur
    {
      get => valeur;
      set => Regler(value, false);
    }

    void Placer(Vector3 positionPanneau)
    {
      var local = rail.WorldToLocal(new Vector2(positionPanneau.x, positionPanneau.y));
      float l = rail.layout.width;
      if (l <= 1) return;
      float v = Mathf.Clamp01(local.x / l);
      v = Mathf.Round(v / pas) * pas;
      Regler(v, true);
    }

    void Regler(float v, bool notifier)
    {
      v = Mathf.Clamp01(v);
      bool change = Mathf.Abs(v - valeur) > 0.0001f;
      valeur = v;
      Ui.Remplir(plein, v);
      poignee.style.left = Length.Percent(v * 100f);
      Ui.Ecrire(sortie, Mathf.RoundToInt(v * 100f).ToString(System.Globalization.CultureInfo.InvariantCulture) + (Textes.Anglais ? "%" : " %"));
      if (notifier && change) Change?.Invoke(v);
    }
  }

  // ==========================================================================
  // LE CHOIX (segments)
  // ==========================================================================
  public sealed class Choix
  {
    public readonly VisualElement Racine;
    readonly VisualElement titreBloc;
    readonly Label titre;
    readonly Label detail;
    readonly VisualElement segments;
    readonly List<(string Valeur, Button Bouton, Label Texte)> options = new List<(string, Button, Label)>();
    string valeur = "";
    public event Action<string>? Change;

    public Choix(VisualElement parent, params string[] valeurs)
    {
      Racine = Ui.Element("option choix", parent);
      titreBloc = Ui.Element("option__texte", Racine);
      titre = Ui.Texte("", "option__titre", titreBloc);
      detail = Ui.Texte("", "option__detail", titreBloc);
      segments = Ui.Element("segments", Racine);
      foreach (var v in valeurs)
      {
        string val = v;
        var b = Ui.Bouton("segment", () => Choisir(val, true), segments);
        var t = Ui.Texte("", "segment__texte", b);
        options.Add((val, b, t));
      }
    }

    public void Libelles(string t, string d = "")
    {
      Ui.Ecrire(titre, t);
      Ui.Ecrire(detail, d);
      Ui.Afficher(detail, d.Length > 0);
    }

    public void Option(string v, string texte)
    {
      foreach (var o in options)
        if (o.Valeur == v) Ui.Ecrire(o.Texte, texte);
    }

    public string Valeur
    {
      get => valeur;
      set => Choisir(value, false);
    }

    void Choisir(string v, bool notifier)
    {
      bool change = v != valeur;
      valeur = v;
      foreach (var o in options) o.Bouton.EnableInClassList("actif", o.Valeur == v);
      if (notifier && change) Change?.Invoke(v);
    }

    /** Le segment choisi (pour lui donner le focus). */
    public Button? Bouton
    {
      get
      {
        foreach (var o in options)
          if (o.Valeur == valeur) return o.Bouton;
        return options.Count > 0 ? options[0].Bouton : null;
      }
    }
  }

  // ==========================================================================
  // LES ONGLETS
  // ==========================================================================
  public sealed class Onglets
  {
    public readonly VisualElement Racine;
    readonly List<(string Nom, Button Bouton, Label Texte)> onglets = new List<(string, Button, Label)>();
    public string Choisi { get; private set; } = "";
    public event Action<string>? Change;

    public Onglets(VisualElement parent, params string[] noms)
    {
      Racine = Ui.Element("onglets", parent);
      for (int i = 0; i < noms.Length; i++)
      {
        string nom = noms[i];
        var b = Ui.Bouton("onglet", () => Choisir(nom, true), Racine);
        Ui.Texte(Textes.Deux(i + 1), "onglet__index", b);
        var t = Ui.Texte("", "onglet__texte", b);
        onglets.Add((nom, b, t));
      }
    }

    public void Libelle(string nom, string texte)
    {
      foreach (var o in onglets)
        if (o.Nom == nom) Ui.Ecrire(o.Texte, Textes.Majuscules(texte));
    }

    public void Choisir(string nom, bool notifier)
    {
      bool change = nom != Choisi;
      Choisi = nom;
      foreach (var o in onglets) o.Bouton.EnableInClassList("actif", o.Nom == nom);
      if (notifier && change) Change?.Invoke(nom);
    }

    /** L'onglet suivant ou précédent (touches ← → sur la barre, comme dans le jeu web). */
    public void Decaler(int sens)
    {
      int i = onglets.FindIndex(o => o.Nom == Choisi);
      if (onglets.Count == 0) return;
      int j = ((i < 0 ? 0 : i) + sens + onglets.Count) % onglets.Count;
      Choisir(onglets[j].Nom, true);
      onglets[j].Bouton.Focus();
    }

    public bool Contient(Focusable? f)
    {
      foreach (var o in onglets)
        if (o.Bouton == f) return true;
      return false;
    }

    public Button? Bouton
    {
      get
      {
        foreach (var o in onglets)
          if (o.Nom == Choisi) return o.Bouton;
        return onglets.Count > 0 ? onglets[0].Bouton : null;
      }
    }
  }
}
