// PORTAL RUSH (Unity) — LES RECORDS
//
// Comme majRecords du jeu web : uniquement ce qui est enregistré, et un état vide pour commencer. Quatre onglets :
// la vue d'ensemble (meilleur score en survie, plus longue distance, meilleur combo, Perfect Dodges en une partie,
// étoiles par difficulté, défis réussis), la campagne (huit secteurs × cinq difficultés : score, étoiles, rang),
// la survie (score et distance par difficulté) et le défi du jour.
#nullable enable
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranRecords : Ecran
  {
    readonly Label titre, sous, videTitre, videTexte, videAction, note;
    readonly VisualElement vide, plein;
    readonly Button premiere;
    readonly Onglets onglets;
    readonly Dictionary<string, VisualElement> pages = new Dictionary<string, VisualElement>();
    readonly Dictionary<string, (Label Valeur, Label Detail, Label Libelle, VisualElement Carte)> cartes = new Dictionary<string, (Label, Label, Label, VisualElement)>();
    readonly List<Label> enTetes = new List<Label>();
    sealed class Cellule
    {
      public VisualElement Racine = null!;
      public Label Score = null!, Rang = null!;
      public VisualElement Etoiles = null!;
      public readonly VisualElement[] Etoile = new VisualElement[3];
    }

    readonly Cellule[,] cellules;
    readonly Label[] lignesNiveaux;
    readonly List<(string Difficulte, Label Nom, Label Score, Label Distance)> infini = new List<(string, Label, Label, Label)>();
    readonly Label[] defiLibelles = new Label[3], defiValeurs = new Label[3];
    readonly List<Label> enTetesInfini = new List<Label>();
    string ongletDemande = "resume";

    public EcranRecords(Interface ui, VisualElement racine) : base(ui, racine)
    {
      Label L(string nom) => Interface.Trouver<Label>(racine, nom);
      titre = L("records-titre");
      sous = L("records-sous");
      vide = Interface.Trouver<VisualElement>(racine, "records-vide");
      videTitre = L("records-vide-titre");
      videTexte = L("records-vide-texte");
      premiere = Interface.Trouver<Button>(racine, "records-premiere");
      videAction = L("records-premiere-texte");
      plein = Interface.Trouver<VisualElement>(racine, "records-plein");
      note = L("records-note");
      Ui.Clic(premiere, () =>
      {
        ui.Secteur = 1;
        ui.Lancer(Mode.Campagne, Vues.Reprise(ui.Difficulte).Difficulte, 1);
      });

      var hoteOnglets = Interface.Trouver<VisualElement>(racine, "records-onglets");
      onglets = new Onglets(hoteOnglets, "resume", "campagne", "infini", "defi");
      onglets.Racine.AddToClassList("lateral");
      onglets.Change += Montrer;
      var hotePages = Interface.Trouver<VisualElement>(racine, "records-pages");

      // Vue d'ensemble : six cartes.
      var resume = Ui.Element("records__page records__cartes", hotePages);
      pages["resume"] = resume;
      foreach (var k in new[] { "infini", "distance", "combo", "parfaits", "etoiles", "defi" })
      {
        var c = Ui.Element("carte-record plaque", resume);
        var libelle = Ui.Etiquette("", "carte-record__libelle", c);
        var valeur = Ui.Texte("", "carte-record__valeur", c);
        var detail = Ui.Etiquette("", "carte-record__detail", c);
        cartes[k] = (valeur, detail, libelle, c);
      }

      // Campagne : un tableau.
      var campagne = Ui.Defilement("records__page records__defile", hotePages);
      pages["campagne"] = campagne;
      var table = Ui.Element("table plaque", campagne);
      var tete = Ui.Element("table__ligne table__ligne--tete", table);
      enTetes.Add(Ui.Etiquette("", "table__cellule table__cellule--nom", tete));
      for (int d = 0; d < Vues.Difficultes.Length; d++) enTetes.Add(Ui.Etiquette("", "table__cellule", tete));
      cellules = new Cellule[Vues.NombreNiveaux, Vues.Difficultes.Length];
      lignesNiveaux = new Label[Vues.NombreNiveaux];
      for (int n = 0; n < Vues.NombreNiveaux; n++)
      {
        var ligne = Ui.Element("table__ligne", table);
        var nom = Ui.Element("table__cellule table__cellule--nom", ligne);
        Ui.Texte(Textes.Deux(n + 1), "table__numero", nom);
        lignesNiveaux[n] = Ui.Texte("", "table__niveau", nom);
        for (int d = 0; d < Vues.Difficultes.Length; d++)
        {
          var c = new Cellule { Racine = Ui.Element("table__cellule", ligne) };
          c.Score = Ui.Texte("", "table__score", c.Racine);
          var bas = Ui.Element("table__detail", c.Racine);
          c.Etoiles = Ui.Element("table__etoiles", bas);
          for (int k = 0; k < 3; k++)
          {
            c.Etoile[k] = Ui.Element("etoile etoile--mini", c.Etoiles);
            Formes.Etoile(c.Etoile[k]);
          }
          c.Rang = Ui.Texte("", "table__rang", bas);
          cellules[n, d] = c;
        }
      }

      // Survie : score et distance par difficulté.
      var pageInfini = Ui.Element("records__page", hotePages);
      pages["infini"] = pageInfini;
      var tableInfini = Ui.Element("table table--etroite plaque", pageInfini);
      var teteInfini = Ui.Element("table__ligne table__ligne--tete", tableInfini);
      for (int i = 0; i < 3; i++) enTetesInfini.Add(Ui.Etiquette("", i == 0 ? "table__cellule table__cellule--nom" : "table__cellule", teteInfini));
      foreach (var d in Vues.Difficultes)
      {
        var ligne = Ui.Element("table__ligne", tableInfini);
        infini.Add((d, Ui.Texte("", "table__cellule table__cellule--nom", ligne), Ui.Texte("", "table__cellule", ligne), Ui.Texte("", "table__cellule", ligne)));
      }

      // Défi du jour.
      var pageDefi = Ui.Element("records__page records__defi", hotePages);
      pages["defi"] = pageDefi;
      for (int i = 0; i < 3; i++)
      {
        var c = Ui.Element("carte-record plaque", pageDefi);
        defiLibelles[i] = Ui.Etiquette("", "carte-record__libelle", c);
        defiValeurs[i] = Ui.Texte("", "carte-record__valeur", c);
      }
    }

    public override string NomPont => "records";
    public override string Module => Textes.De("menu.records");
    public override Button? Principale => Ui.Affiche(vide) ? premiere : null;
    public override VisualElement? PremierFocus => Ui.Affiche(vide) ? premiere : onglets.Bouton;

    /** L'onglet à montrer à la prochaine ouverture. */
    public void Onglet(string nom) => ongletDemande = nom;

    public override void Entrer()
    {
      onglets.Choisir(ongletDemande, false);
      Montrer(ongletDemande);
      base.Entrer();
    }

    void Montrer(string nom)
    {
      ongletDemande = nom;
      foreach (var p in pages) Ui.Afficher(p.Value, p.Key == nom);
    }

    public override void Rafraichir()
    {
      var vue = Pont.Vue;
      Ui.Ecrire(titre, Textes.De("records.titre"));
      Ui.Ecrire(sous, Textes.De("records.sousTitre"));
      bool aucun = Vues.Parties == 0 && Vues.MeilleurScore().Score <= 0;
      Ui.Afficher(vide, aucun);
      Ui.Afficher(plein, !aucun);
      Ui.Ecrire(videTitre, Textes.De("records.vide.titre"));
      Ui.Ecrire(videTexte, Textes.De("records.vide.texte"));
      Ui.Ecrire(videAction, Textes.Majuscules(Textes.De("records.vide.action")));
      foreach (var o in new[] { "resume", "campagne", "infini", "defi" }) onglets.Libelle(o, Textes.De($"records.onglets.{o}"));

      // Vue d'ensemble.
      foreach (var k in new[] { "infini", "distance", "combo", "parfaits", "etoiles", "defi" }) Ui.Ecrire(cartes[k].Libelle, Textes.Majuscules(Textes.De($"records.cartes.{k}")));
      InfiniVue? meilleurInfini = null;
      foreach (var d in Vues.Difficultes)
      {
        var r = Vues.Infini(d);
        if (r != null && (meilleurInfini == null || r.score > meilleurInfini.score)) meilleurInfini = r;
      }
      Carte("infini", meilleurInfini != null ? Textes.Nombre(meilleurInfini.score) : "—",
        meilleurInfini != null ? Vues.NomDifficulte(meilleurInfini.difficulte) + " · " + Textes.Multiplicateur(Vues.ProfilScore(meilleurInfini.difficulte)) : "");
      var t = vue.totaux;
      double distance = System.Math.Max(t.meilleureDistance, t.infiniMax);
      Carte("distance", distance > 0 ? Textes.Nombre(distance) + " m" : "—", "");
      Carte("combo", t.meilleurCombo > 0 ? Textes.Nombre(t.meilleurCombo) : "—", "");
      Carte("parfaits", t.meilleursParfaits > 0 ? Textes.Nombre(t.meilleursParfaits) : "—", "");
      var detail = new List<string>();
      foreach (var d in Vues.Difficultes) detail.Add(Vues.NomDifficulte(d) + " " + Vues.TotalEtoiles(d));
      Carte("etoiles", Vues.TotalEtoiles() + " / " + Vues.NombreNiveaux * 3 * Vues.Difficultes.Length, string.Join(" · ", detail));
      var jour = Vues.DefiDuJour();
      Carte("defi", Vues.DefisReussis().ToString(System.Globalization.CultureInfo.InvariantCulture), jour != null ? Textes.De("records.aujourdhui") + " " + Textes.Nombre(jour.meilleur) : "");

      // Campagne.
      Ui.Ecrire(enTetes[0], Textes.Majuscules(Textes.De("records.niveau")));
      for (int d = 0; d < Vues.Difficultes.Length; d++)
        Ui.Ecrire(enTetes[d + 1], Textes.Majuscules(Vues.NomDifficulte(Vues.Difficultes[d]) + " " + Textes.Multiplicateur(Vues.ProfilScore(Vues.Difficultes[d]))));
      for (int n = 0; n < Vues.NombreNiveaux; n++)
      {
        Ui.Ecrire(lignesNiveaux[n], Vues.NomNiveau(n + 1));
        for (int d = 0; d < Vues.Difficultes.Length; d++)
        {
          var s = Vues.Score(n + 1, Vues.Difficultes[d]);
          bool a = s != null && s.record > 0;
          var cel = cellules[n, d];
          cel.Racine.EnableInClassList("a-record", a);
          var e = Vues.Etoiles(n + 1, Vues.Difficultes[d]);
          for (int k = 0; k < 3; k++) cel.Etoile[k].EnableInClassList("gagnee", e[k]);
          Ui.Ecrire(cel.Score, a ? Textes.Nombre(s!.record) : Textes.De("records.aucun"));
          Ui.Ecrire(cel.Rang, a && !string.IsNullOrEmpty(s!.rang) && s.rang != "—" ? s.rang : "");
          Ui.Afficher(cel.Etoiles.parent, a);
        }
      }

      // Survie.
      Ui.Ecrire(enTetesInfini[0], Textes.Majuscules(Textes.De("difficulte")));
      Ui.Ecrire(enTetesInfini[1], Textes.Majuscules(Textes.De("records.score")));
      Ui.Ecrire(enTetesInfini[2], Textes.Majuscules(Textes.De("records.distance")));
      foreach (var (d, nom, score, dist) in infini)
      {
        var r = Vues.Infini(d);
        Ui.Ecrire(nom, Vues.NomDifficulte(d) + " " + Textes.Multiplicateur(Vues.ProfilScore(d)));
        Ui.Ecrire(score, r != null ? Textes.Nombre(r.score) : Textes.De("records.aucun"));
        Ui.Ecrire(dist, r != null ? Textes.Nombre(r.distance) + " m" : Textes.De("records.aucun"));
        score.EnableInClassList("a-record", r != null);
        dist.EnableInClassList("a-record", r != null);
      }

      // Défi.
      Ui.Ecrire(defiLibelles[0], Textes.Majuscules(Textes.De("records.aujourdhui")));
      Ui.Ecrire(defiValeurs[0], jour != null ? Textes.Nombre(jour.meilleur) : Textes.De("records.aucun"));
      Ui.Ecrire(defiLibelles[1], Textes.Majuscules(Textes.De("records.tentatives")));
      Ui.Ecrire(defiValeurs[1], (jour != null ? jour.tentatives : 0).ToString(System.Globalization.CultureInfo.InvariantCulture));
      Ui.Ecrire(defiLibelles[2], Textes.Majuscules(Textes.De("stats.defis")));
      Ui.Ecrire(defiValeurs[2], Vues.DefisReussis().ToString(System.Globalization.CultureInfo.InvariantCulture));

      Ui.Ecrire(note, Textes.Remplir("records.regles", "v", Donnees.ReglesVersion.ToString(System.Globalization.CultureInfo.InvariantCulture)));
    }

    void Carte(string k, string valeur, string detail)
    {
      var c = cartes[k];
      Ui.Ecrire(c.Valeur, valeur);
      Ui.Ecrire(c.Detail, Textes.Majuscules(detail));
      Ui.Afficher(c.Detail, detail.Length > 0);
      c.Carte.EnableInClassList("vide", valeur == "—");
    }
  }
}
