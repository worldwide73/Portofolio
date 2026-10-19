// PORTAL RUSH (Unity) — LES DIFFICULTÉS
//
// Cinq cartes, de Pilot à Paradoxe (la difficulté ultime, à part) : leur rôle, leur multiplicateur de score et ce
// qu'elles changent (les textes du jeu web), le verrou de Nightmare et de Paradoxe avec sa condition, et selon le
// mode : les étoiles et le record du secteur choisi (campagne), ou le record de survie et sa distance (infini).
// ← → passent d'une carte à l'autre et la choisissent (au clavier, regarder = choisir) ; Entrée lance. Le choix part vers la page (comme le jeu web
// le retient dans la sauvegarde).
#nullable enable
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranDifficultes : Ecran
  {
    sealed class Carte
    {
      public string Id = "";
      public Button Bouton = null!;
      public Label Nom = null!, Role = null!, Mult = null!, Texte = null!, Verrou = null!, Record = null!, Ultime = null!;
      public VisualElement Etoiles = null!;
      public readonly List<VisualElement> EtoilesEls = new List<VisualElement>();
    }

    readonly Label module, titre, sous, verrou, lancerTexte;
    readonly Button lancer;
    readonly List<Carte> cartes = new List<Carte>();
    Mode mode = Mode.Campagne;
    int niveau = 1;

    public EcranDifficultes(Interface ui, VisualElement racine) : base(ui, racine)
    {
      Label L(string nom) => Interface.Trouver<Label>(racine, nom);
      module = L("diff-module");
      titre = L("diff-titre");
      sous = L("diff-sous");
      verrou = L("diff-verrou");
      lancer = Interface.Trouver<Button>(racine, "diff-lancer");
      lancerTexte = L("diff-lancer-texte");
      Ui.Clic(lancer, Lancer);
      var liste = Interface.Trouver<VisualElement>(racine, "diff-cartes");
      for (int i = 0; i < Vues.Difficultes.Length; i++)
      {
        string id = Vues.Difficultes[i];
        var c = new Carte { Id = id };
        c.Bouton = Ui.Bouton("difficulte plaque difficulte--" + id, () => Choisir(id, true), liste);
        var tete = Ui.Element("difficulte__tete", c.Bouton);
        Ui.Texte(Textes.Deux(i + 1), "difficulte__index", tete);
        c.Mult = Ui.Texte("", "difficulte__mult", tete);
        c.Ultime = Ui.Etiquette("", "difficulte__ultime", c.Bouton);
        c.Nom = Ui.Texte("", "difficulte__nom", c.Bouton);
        c.Role = Ui.Etiquette("", "difficulte__role", c.Bouton);
        c.Texte = Ui.Texte("", "difficulte__texte", c.Bouton);
        c.Etoiles = Ui.Element("difficulte__etoiles", c.Bouton);
        for (int k = 0; k < 3; k++)
        {
          var e = Ui.Element("etoile etoile--petite", c.Etoiles);
          Formes.Etoile(e);
          c.EtoilesEls.Add(e);
        }
        c.Record = Ui.Etiquette("", "difficulte__record", c.Bouton);
        var v = Ui.Element("difficulte__verrou", c.Bouton);
        Ui.Icone(Icone.Verrou, "difficulte__verrou-icone", v);
        c.Verrou = Ui.Texte("", "difficulte__verrou-texte", v);
        // Au clavier, regarder une carte la choisit (si elle est ouverte).
        c.Bouton.RegisterCallback<FocusEvent>(_ =>
        {
          if (ui.Racine.ClassListContains("clavier")) Choisir(id, false);
        });
        cartes.Add(c);
      }
    }

    /** Pour quel mode (et quel secteur) on choisit. */
    public void Preparer(Mode m, int n = 0)
    {
      mode = m;
      niveau = n > 0 ? n : ui.Secteur;
    }

    public override string NomPont => "niveaux";
    public override string Module => Textes.De(mode == Mode.Infini ? "menu.infini" : "menu.campagne");
    public override Button? Principale => lancer;
    public override VisualElement? PremierFocus
    {
      get
      {
        string d = Vues.DifficulteJouable(ui.Difficulte);
        foreach (var c in cartes)
          if (c.Id == d) return c.Bouton;
        return lancer;
      }
    }

    public override bool Retour()
    {
      ui.Montrer(mode == Mode.Infini ? (Ecran)ui.EcranModes : ui.EcranCampagne);
      return true;
    }

    void Choisir(string id, bool clic)
    {
      if (!Vues.DifficulteOuverte(id))
      {
        // Une difficulté verrouillée se regarde : sa condition s'affiche.
        Ui.Ecrire(verrou, Textes.De(id == "paradoxe" ? "verrouParadoxe" : "verrouCauchemar"));
        Ui.Afficher(verrou, true);
        return;
      }
      if (clic && id == ui.Difficulte && ui.Racine.ClassListContains("clavier"))
      {
        Lancer();
        return;
      }
      ui.ChoisirDifficulte(id);
      Rafraichir();
    }

    void Lancer()
    {
      string d = Vues.DifficulteJouable(ui.Difficulte);
      if (mode == Mode.Infini) ui.Lancer(Mode.Infini, d, 1);
      else if (Vues.Debloque(niveau)) ui.Lancer(Mode.Campagne, d, niveau);
    }

    public override void Rafraichir()
    {
      string choisie = Vues.DifficulteJouable(ui.Difficulte);
      bool infini = mode == Mode.Infini;
      Ui.Ecrire(module, infini ? "END · 02" : "CMP · 01");
      Ui.Ecrire(titre, infini ? Textes.De("infini.titre") : Textes.De("ui.difficultes.titre"));
      Ui.Ecrire(sous, infini ? Textes.De("infini.texte") : Textes.Remplir("ui.difficultes.pourSecteur", "n", Textes.Deux(niveau), "nom", Vues.NomNiveau(niveau)));
      Ui.Ecrire(lancerTexte, Textes.Majuscules(Textes.De(infini ? "infini.lancer" : "menu.lancer")));
      Ui.Afficher(verrou, false);
      foreach (var c in cartes)
      {
        bool ouverte = Vues.DifficulteOuverte(c.Id);
        c.Bouton.EnableInClassList("verrouille", !ouverte);
        c.Bouton.EnableInClassList("choisi", c.Id == choisie);
        Ui.Ecrire(c.Nom, Vues.NomDifficulte(c.Id));
        Ui.Ecrire(c.Role, Textes.Majuscules(Textes.De($"difficultes.{c.Id}.role")));
        Ui.Ecrire(c.Mult, Textes.Multiplicateur(Vues.ProfilScore(c.Id)));
        Ui.Ecrire(c.Texte, Textes.De($"difficultes.{c.Id}.texte"));
        Ui.Ecrire(c.Ultime, c.Id == "paradoxe" ? Textes.Majuscules(Textes.De("ui.difficultes.ultime")) : "");
        Ui.Afficher(c.Ultime, c.Id == "paradoxe");
        string condition = c.Id == "paradoxe" ? Textes.De("verrouParadoxe") : c.Id == "cauchemar" ? Textes.De("verrouCauchemar") : "";
        Ui.Ecrire(c.Verrou, condition);
        Ui.Afficher(c.Verrou.parent, !ouverte && condition.Length > 0);
        Ui.Afficher(c.Etoiles, !infini);
        if (infini)
        {
          var r = Vues.Infini(c.Id);
          Ui.Ecrire(c.Record, Textes.Majuscules(r != null ? Textes.De("meilleur") + " " + Textes.Nombre(r.score) + " · " + Textes.Nombre(r.distance) + " m" : Textes.De("aucunRecord")));
        }
        else
        {
          var e = Vues.Etoiles(niveau, c.Id);
          for (int k = 0; k < 3; k++) c.EtoilesEls[k].EnableInClassList("gagnee", e[k]);
          double rec = Vues.RecordCampagne(niveau, c.Id);
          Ui.Ecrire(c.Record, Textes.Majuscules(rec > 0 ? Textes.De("meilleur") + " " + Textes.Nombre(rec) : Textes.De("aucunRecord")));
        }
      }
      lancer.SetEnabled(infini || Vues.Debloque(niveau));
    }
  }
}
