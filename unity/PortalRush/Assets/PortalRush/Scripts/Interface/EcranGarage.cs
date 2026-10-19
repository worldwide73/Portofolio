// PORTAL RUSH (Unity) — LE GARAGE
//
// Comme majGarage du jeu web : à gauche, la baie où tourne le vaisseau en 3D (Vitrine, mode garage) ; à droite, les
// quatre vaisseaux (vraies différences de pilotage : changement de voie, boucliers, fenêtre Perfect, charge
// d'Overdrive ; choisi, ou verrouillé avec sa condition et son avancement) et les pièces des quatre emplacements
// (coque, traînée, Overdrive, noyau : équipée, ou verrouillée avec sa condition). Un vaisseau gagné se choisit ; un
// vaisseau verrouillé se regarde seulement (au clavier, il suffit de le regarder). Les choix partent vers la page,
// qui les enregistre et renvoie la vue.
#nullable enable
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranGarage : Ecran
  {
    sealed class CarteVaisseau
    {
      public string Id = "";
      public Button Bouton = null!;
      public Label Nom = null!, Etat = null!, Role = null!;
      public readonly Label[] Libelles = new Label[4];
    }

    sealed class CartePiece
    {
      public string Id = "", Emplacement = "";
      public Button Bouton = null!;
      public Label Nom = null!, Etat = null!;
    }

    readonly Label titre, sous, repere, vuNom, vuEtat, vuRole, note;
    readonly List<CarteVaisseau> vaisseaux = new List<CarteVaisseau>();
    readonly List<CartePiece> pieces = new List<CartePiece>();
    readonly List<(string Emplacement, Label Titre)> titresEmplacements = new List<(string, Label)>();
    readonly Label titreVaisseaux;
    /** Le vaisseau regardé (un vaisseau verrouillé peut être regardé, pas choisi). */
    string? vu;

    public EcranGarage(Interface ui, VisualElement racine) : base(ui, racine)
    {
      Label L(string nom) => Interface.Trouver<Label>(racine, nom);
      titre = L("garage-titre");
      sous = L("garage-sous");
      repere = L("garage-repere");
      vuNom = L("garage-vu-nom");
      vuEtat = L("garage-vu-etat");
      vuRole = L("garage-vu-role");
      var hote = Interface.Trouver<VisualElement>(racine, "garage-liste");
      var liste = Ui.Defilement("garage__defile", hote);

      // Les vaisseaux.
      var blocV = Ui.Element("garage__bloc", liste);
      var teteV = Ui.Element("garage__bloc-tete", blocV);
      Ui.Texte("00", "garage__index", teteV);
      titreVaisseaux = Ui.Etiquette("", "garage__bloc-titre", teteV);
      var flotte = Ui.Element("garage__flotte", blocV);
      foreach (var v in Donnees.Vehicules)
      {
        var c = new CarteVaisseau { Id = v.Id };
        string id = v.Id;
        c.Bouton = Ui.Bouton("vaisseau plaque", () => CliquerVaisseau(id), flotte);
        var tete = Ui.Element("vaisseau__tete", c.Bouton);
        c.Nom = Ui.Texte("", "vaisseau__nom", tete);
        c.Etat = Ui.Etiquette("", "vaisseau__etat", tete);
        c.Role = Ui.Texte("", "vaisseau__role", c.Bouton);
        var statsBloc = Ui.Element("vaisseau__stats", c.Bouton);
        // Les quatre caractéristiques (comme les barres du jeu web).
        string[] valeurs =
        {
          Textes.Virgule(Donnees.Deplacement * v.Deplacement, 3) + " s",
          v.Boucliers > 0 ? "+" + v.Boucliers : v.Boucliers < 0 ? "−" + (-v.Boucliers) : "±0",
          "×" + Textes.Virgule(v.Parfait),
          "×" + Textes.Virgule(v.Jauge),
        };
        float[] parts =
        {
          (float)((1.25 - v.Deplacement) * 2),
          (v.Boucliers + 1) * 0.5f,
          (float)((v.Parfait - 0.7) * 1.25),
          (float)((v.Jauge - 0.6) * 2),
        };
        for (int k = 0; k < 4; k++)
        {
          var ligne = Ui.Element("vaisseau__stat", statsBloc);
          var haut = Ui.Element("vaisseau__stat-haut", ligne);
          c.Libelles[k] = Ui.Texte("", "vaisseau__stat-nom", haut);
          Ui.Texte(valeurs[k], "vaisseau__stat-valeur", haut);
          var barre = Ui.Element("vaisseau__barre", ligne);
          Ui.Remplir(Ui.Element("vaisseau__barre-plein", barre), parts[k]);
        }
        c.Bouton.RegisterCallback<FocusEvent>(_ =>
        {
          if (ui.Racine.ClassListContains("clavier")) Regarder(id);
        });
        vaisseaux.Add(c);
      }
      note = Ui.Etiquette("", "garage__note", blocV);

      // Les pièces, par emplacement.
      for (int i = 0; i < Vues.Emplacements.Length; i++)
      {
        string emplacement = Vues.Emplacements[i];
        var bloc = Ui.Element("garage__bloc", liste);
        var tete = Ui.Element("garage__bloc-tete", bloc);
        Ui.Texte(Textes.Deux(i + 1), "garage__index", tete);
        titresEmplacements.Add((emplacement, Ui.Etiquette("", "garage__bloc-titre", tete)));
        var rangee = Ui.Element("garage__pieces", bloc);
        foreach (var p in Donnees.Pieces)
        {
          if (Cle(p.Emplacement) != emplacement) continue;
          var c = new CartePiece { Id = p.Id, Emplacement = emplacement };
          string pid = p.Id;
          c.Bouton = Ui.Bouton("piece plaque", () => Pont.Equiper(emplacement, pid), rangee);
          Teinte(Ui.Element("piece__teinte", c.Bouton), p.Couleur);
          var texte = Ui.Element("piece__texte", c.Bouton);
          c.Nom = Ui.Texte("", "piece__nom", texte);
          c.Etat = Ui.Texte("", "piece__etat", texte);
          pieces.Add(c);
        }
      }
    }

    static string Cle(Emplacement e)
    {
      string s = e.ToString();
      return char.ToLowerInvariant(s[0]) + s.Substring(1);
    }

    /** La couleur d'une pièce ; « prisme » : quatre bandes irisées. */
    static void Teinte(VisualElement el, string couleur)
    {
      el.pickingMode = PickingMode.Ignore;
      if (couleur == "prisme")
      {
        el.AddToClassList("piece__teinte--prisme");
        foreach (var c in new[] { 0x88ffff, 0xff88ff, 0xffff88, 0x88ffff })
        {
          var bande = Ui.Element("piece__bande", el);
          bande.style.backgroundColor = Formes.Hex(c);
        }
      }
      else el.style.backgroundColor = Formes.DepuisRgb(couleur);
    }

    public override string NomPont => "garage";
    public override string Module => Textes.De("menu.garage");
    public override Vitrine3D Vitrine => Vitrine3D.Garage;
    public override VisualElement? PremierFocus
    {
      get
      {
        foreach (var c in vaisseaux)
          if (c.Id == Pont.Vue.vehicule) return c.Bouton;
        return vaisseaux.Count > 0 ? vaisseaux[0].Bouton : null;
      }
    }

    public override void Sortir() => vu = null;

    VehiculeVue? Vehicule(string id)
    {
      foreach (var v in Pont.Vue.vehicules)
        if (v != null && v.id == id) return v;
      return null;
    }

    bool Gagne(string id) => Vehicule(id)?.debloque ?? id == Donnees.VehiculeDepart;

    void CliquerVaisseau(string id)
    {
      if (Gagne(id))
      {
        vu = null;
        if (id != Pont.Vue.vehicule) Pont.ChoisirVehicule(id);
      }
      else
      {
        vu = vu == id ? null : id;
        Pont.Son("deplacement");
      }
      Rafraichir();
      MontrerVaisseau();
    }

    void Regarder(string id)
    {
      vu = id == Pont.Vue.vehicule ? null : id;
      Rafraichir();
      MontrerVaisseau();
    }

    /** Le vaisseau de la baie : celui qu'on regarde, sinon le vaisseau choisi. */
    public void MontrerVaisseau() => PortalRush.Jeu.Vitrine.Montrer(vu ?? Pont.Vue.vehicule, Pont.Vue.equipement, true);

    public override void Rafraichir()
    {
      Ui.Ecrire(titre, Textes.De("garage.titre"));
      Ui.Ecrire(sous, Textes.De("garage.texte"));
      Ui.Ecrire(repere, Textes.Majuscules("PR-07 · " + Textes.De("garage.titre")));
      Ui.Ecrire(titreVaisseaux, Textes.Majuscules(Textes.De("garage.vaisseaux.titre")));
      Ui.Ecrire(note, Textes.Majuscules(Textes.De("garage.vaisseaux.defi")));
      string choisi = Pont.Vue.vehicule;
      string[] cles = { "garage.vaisseaux.stats.deplacement", "garage.vaisseaux.stats.boucliers", "garage.vaisseaux.stats.parfait", "garage.vaisseaux.stats.jauge" };
      foreach (var c in vaisseaux)
      {
        var v = Vehicule(c.Id);
        bool gagne = Gagne(c.Id);
        bool estChoisi = c.Id == choisi;
        c.Bouton.EnableInClassList("choisi", estChoisi);
        c.Bouton.EnableInClassList("verrouille", !gagne);
        c.Bouton.EnableInClassList("vu", vu == c.Id && !estChoisi);
        Ui.Ecrire(c.Nom, Textes.Majuscules(Vues.NomVehicule(c.Id)));
        Ui.Ecrire(c.Role, Textes.De($"garage.vaisseaux.roles.{c.Id}"));
        Ui.Ecrire(c.Etat, Textes.Majuscules(estChoisi ? Textes.De("garage.vaisseaux.choisi") : gagne ? "" : Vues.ConditionTexte(v?.condition) + Vues.Progres(v?.condition)));
        for (int k = 0; k < 4; k++) Ui.Ecrire(c.Libelles[k], Textes.De(cles[k]));
      }
      foreach (var (emplacement, t) in titresEmplacements) Ui.Ecrire(t, Textes.Majuscules(Vues.NomEmplacement(emplacement)));
      foreach (var c in pieces)
      {
        var p = Vues.Piece(c.Id);
        bool gagnee = p != null ? p.debloquee : false;
        bool equipee = p != null && p.equipee;
        c.Bouton.SetEnabled(gagnee);
        c.Bouton.EnableInClassList("equipee", equipee);
        c.Bouton.EnableInClassList("verrouille", !gagnee);
        Ui.Ecrire(c.Nom, Vues.NomPiece(c.Id));
        Ui.Ecrire(c.Etat, equipee ? Textes.De("garage.equipe") : gagnee ? "" : Vues.ConditionTexte(p?.condition) + Vues.Progres(p?.condition));
      }
      // La baie : le vaisseau regardé, son rôle, et s'il est verrouillé, comment le gagner.
      string montre = vu ?? choisi;
      var vm = Vehicule(montre);
      Ui.Ecrire(vuNom, Textes.Majuscules(Vues.NomVehicule(montre)));
      Ui.Ecrire(vuRole, Textes.De($"garage.vaisseaux.roles.{montre}"));
      bool gagneMontre = Gagne(montre);
      Ui.Ecrire(vuEtat, Textes.Majuscules(montre == choisi ? Textes.De("garage.vaisseaux.choisi")
        : gagneMontre ? Textes.De("garage.vaisseaux.apercu")
        : Textes.Remplir("ui.garage.verrou", "c", Vues.ConditionTexte(vm?.condition) + Vues.Progres(vm?.condition))));
      vuEtat.EnableInClassList("verrouille", !gagneMontre);
      // (Une pièce équipée, un vaisseau choisi : la vue de la page revient, le vaisseau 3D suit.)
      if (ui.Courant == this) MontrerVaisseau();
    }
  }
}
