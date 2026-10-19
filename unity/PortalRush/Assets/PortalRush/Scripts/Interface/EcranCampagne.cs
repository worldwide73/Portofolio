// PORTAL RUSH (Unity) — LA CAMPAGNE : LES HUIT MONDES
//
// Comme majCampagne et majPreparation du jeu web : la carte des huit secteurs (vue du monde, numéro, nom, trois
// étoiles dans la difficulté choisie, record ou état, verrou), et à droite la préparation du secteur regardé : son
// nom et sa mécanique, ses trois étoiles et leurs objectifs, ce qu'il peut encore débloquer, le record, le verrou,
// et « Lancer ». La difficulté se change par la puce du haut (écran des difficultés).
// Au clavier, regarder un secteur le choisit (la préparation suit) ; Entrée sur le secteur choisi le lance.
#nullable enable
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranCampagne : Ecran
  {
    sealed class Case
    {
      public int Id;
      public Button Bouton = null!;
      public Vignette Vue = null!;
      public Label Nom = null!, Etat = null!;
      public VisualElement Verrou = null!;
      public readonly List<VisualElement> Etoiles = new List<VisualElement>();
    }

    readonly Label titre, difficulteLibelle, difficulteNom, total;
    readonly Button difficulte, lancer;
    readonly Label prepSecteur, prepNom, prepMecanique, prepEtoilesTitre, prepRecompensesTitre, prepRecord, prepVerrou, lancerTexte;
    readonly VisualElement prepEtoiles, prepRecompenses;
    readonly Vignette prepVue;
    readonly List<Case> cases = new List<Case>();
    readonly List<(VisualElement Etoile, Label Texte, VisualElement Ligne)> lignesEtoiles = new List<(VisualElement, Label, VisualElement)>();

    public EcranCampagne(Interface ui, VisualElement racine) : base(ui, racine)
    {
      Label L(string nom) => Interface.Trouver<Label>(racine, nom);
      titre = L("campagne-titre");
      difficulte = Interface.Trouver<Button>(racine, "campagne-difficulte");
      difficulteLibelle = L("campagne-difficulte-libelle");
      difficulteNom = L("campagne-difficulte-nom");
      total = L("campagne-etoiles");
      prepVue = new Vignette(Interface.Trouver<VisualElement>(racine, "prep-vue")) { Coupe = 17 };
      prepSecteur = L("prep-secteur");
      prepNom = L("prep-nom");
      prepMecanique = L("prep-mecanique");
      prepEtoilesTitre = L("prep-etoiles-titre");
      prepEtoiles = Interface.Trouver<VisualElement>(racine, "prep-etoiles");
      prepRecompensesTitre = L("prep-recompenses-titre");
      prepRecompenses = Interface.Trouver<VisualElement>(racine, "prep-recompenses");
      prepRecord = L("prep-record");
      prepVerrou = L("prep-verrou");
      lancer = Interface.Trouver<Button>(racine, "prep-lancer");
      lancerTexte = L("prep-lancer-texte");

      Ui.Clic(difficulte, () =>
      {
        ui.EcranDifficultes.Preparer(Mode.Campagne, ui.Secteur);
        ui.Montrer(ui.EcranDifficultes);
      });
      Ui.Clic(lancer, Lancer);

      var grille = Interface.Trouver<VisualElement>(racine, "campagne-secteurs");
      for (int i = 1; i <= Vues.NombreNiveaux; i++)
      {
        int id = i;
        var c = new Case { Id = id };
        c.Bouton = Ui.Bouton("secteur plaque", () => Cliquer(id), grille);
        var image = Ui.Element("secteur__image", c.Bouton);
        c.Vue = new Vignette(Ui.Element("secteur__vue", image));
        c.Vue.Theme = Vues.Theme(id);
        c.Vue.Coupe = 11;
        Ui.Texte(Textes.Deux(id), "secteur__numero", image);
        c.Verrou = Ui.Icone(Icone.Verrou, "secteur__verrou", image);
        var bas = Ui.Element("secteur__bas", c.Bouton);
        c.Nom = Ui.Texte("", "secteur__nom", bas);
        var etoiles = Ui.Element("secteur__etoiles", bas);
        for (int k = 0; k < 3; k++)
        {
          var e = Ui.Element("etoile etoile--petite", etoiles);
          Formes.Etoile(e);
          c.Etoiles.Add(e);
        }
        c.Etat = Ui.Etiquette("", "secteur__etat", c.Bouton);
        // Au clavier, regarder un secteur le choisit.
        c.Bouton.RegisterCallback<FocusEvent>(_ =>
        {
          if (ui.Racine.ClassListContains("clavier") && ui.Secteur != id) Choisir(id);
        });
        cases.Add(c);
      }
      for (int k = 0; k < 3; k++)
      {
        var ligne = Ui.Element("etoiles-liste__ligne", prepEtoiles);
        var e = Ui.Element("etoile", ligne);
        Formes.Etoile(e);
        lignesEtoiles.Add((e, Ui.Texte("", "etoiles-liste__texte", ligne), ligne));
      }
    }

    public override string NomPont => "niveaux";
    public override string Module => Textes.De("menu.campagne");
    public override Button? Principale => lancer;
    public override VisualElement? PremierFocus
    {
      get
      {
        foreach (var c in cases)
          if (c.Id == ui.Secteur) return c.Bouton;
        return lancer;
      }
    }

    public override bool Retour()
    {
      ui.Montrer(ui.EcranModes);
      return true;
    }

    void Cliquer(int id)
    {
      // Entrée (au clavier) sur le secteur déjà choisi : on le lance ; sinon, on le choisit.
      if (id == ui.Secteur && ui.Racine.ClassListContains("clavier") && Vues.Debloque(id))
      {
        Lancer();
        return;
      }
      Choisir(id);
    }

    void Choisir(int id)
    {
      ui.Secteur = id;
      Pont.Son("deplacement");
      Rafraichir();
    }

    void Lancer()
    {
      if (!Vues.Debloque(ui.Secteur)) return;
      ui.Lancer(Mode.Campagne, Vues.DifficulteJouable(ui.Difficulte), ui.Secteur);
    }

    public override void Rafraichir()
    {
      string d = Vues.DifficulteJouable(ui.Difficulte);
      if (ui.Secteur < 1 || ui.Secteur > Vues.NombreNiveaux) ui.Secteur = Vues.NiveauMax;
      Ui.Ecrire(titre, Textes.De("menu.campagne"));
      Ui.Ecrire(difficulteLibelle, Textes.Majuscules(Textes.De("difficulte")));
      Ui.Ecrire(difficulteNom, Vues.NomDifficulte(d) + " " + Textes.Multiplicateur(Vues.ProfilScore(d)));
      difficulte.EnableInClassList("paradoxe", d == "paradoxe");
      Ui.Ecrire(total, Textes.Remplir("ui.etoiles.total", "n", Vues.TotalEtoiles(d).ToString(System.Globalization.CultureInfo.InvariantCulture), "t", (Vues.NombreNiveaux * 3).ToString(System.Globalization.CultureInfo.InvariantCulture)) + " · " + Vues.NomDifficulte(d));

      foreach (var c in cases)
      {
        bool libre = Vues.Debloque(c.Id);
        bool termine = Vues.Reussi(c.Id, d);
        c.Bouton.EnableInClassList("termine", termine);
        c.Bouton.EnableInClassList("disponible", libre && !termine);
        c.Bouton.EnableInClassList("verrouille", !libre);
        c.Bouton.EnableInClassList("choisi", c.Id == ui.Secteur);
        c.Vue.Verrou = !libre;
        Ui.Afficher(c.Verrou, !libre);
        Ui.Ecrire(c.Nom, Vues.NomNiveau(c.Id));
        double record = Vues.RecordCampagne(c.Id, d);
        Ui.Ecrire(c.Etat, Textes.Majuscules(termine && record > 0 ? Textes.De("meilleur") + " " + Textes.Nombre(record) : libre ? Textes.De("etats.disponible") : Textes.De("etats.verrouille")));
        var e = Vues.Etoiles(c.Id, d);
        for (int k = 0; k < 3; k++) c.Etoiles[k].EnableInClassList("gagnee", e[k]);
      }
      Preparation(d);
    }

    void Preparation(string d)
    {
      int id = ui.Secteur;
      bool libre = Vues.Debloque(id);
      var dif = Vues.VersDifficulte(d);
      prepVue.Theme = Vues.Theme(id);
      prepVue.Verrou = !libre;
      Ui.Ecrire(prepSecteur, Textes.Majuscules(Vues.Secteur(id) + " · " + Vues.NomDifficulte(d) + " " + Textes.Multiplicateur(Vues.ProfilScore(d))));
      Ui.Ecrire(prepNom, Vues.NomNiveau(id));
      Ui.Ecrire(prepMecanique, Textes.De($"niveaux.{id - 1}.mecanique"));
      Ui.Ecrire(prepEtoilesTitre, Textes.Majuscules(Textes.De("etoiles.titre")));
      // Les trois étoiles : leur objectif, et celles déjà gagnées dans cette difficulté.
      var etoiles = Vues.Etoiles(id, d);
      var libelles = Vues.LibellesEtoiles(id, dif);
      for (int k = 0; k < 3; k++)
      {
        lignesEtoiles[k].Etoile.EnableInClassList("gagnee", etoiles[k]);
        lignesEtoiles[k].Ligne.EnableInClassList("gagnee", etoiles[k]);
        Ui.Ecrire(lignesEtoiles[k].Texte, libelles[k]);
      }
      // Ce que ce secteur peut encore débloquer (rien d'inventé : seulement ce qui existe vraiment).
      Ui.Ecrire(prepRecompensesTitre, Textes.Majuscules(Textes.De("etoiles.recompenses")));
      prepRecompenses.Clear();
      var gains = Vues.AGagner(id, d);
      if (gains.Count == 0) Ui.Texte(Textes.De("etoiles.aucune"), "recompense recompense--vide", prepRecompenses);
      else
        foreach (var g in gains)
        {
          var ligne = Ui.Element("recompense", prepRecompenses);
          Ui.Element("recompense__puce", ligne);
          Ui.Texte(g, "recompense__texte", ligne);
        }
      var s = Vues.Score(id, d);
      Ui.Ecrire(prepRecord, Textes.Majuscules(s != null && s.record > 0 ? Textes.De("meilleur") + " " + Textes.Nombre(s.record) + (string.IsNullOrEmpty(s.rang) ? "" : " · " + s.rang) : Textes.De("aucunRecord")));
      Ui.Ecrire(prepVerrou, libre ? "" : Textes.Remplir("verrou", "n", Textes.Deux(id - 1)));
      Ui.Afficher(prepVerrou, !libre);
      Ui.Ecrire(lancerTexte, Textes.Majuscules(Textes.De("menu.lancer")));
      lancer.SetEnabled(libre);
    }
  }
}
