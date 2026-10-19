// PORTAL RUSH (Unity) — LE CHOIX DU MODE
//
// Trois grandes cartes, chacune avec sa vue du monde : la Campagne (huit secteurs, deux boss : où l'on en est),
// la Survie infinie (le meilleur score, la plus longue distance) et le Défi du jour (le même parcours pour tous :
// le meilleur résultat d'aujourd'hui). Le jeu web les montrait sur le menu principal ; ici, un écran à part.
#nullable enable
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranModes : Ecran
  {
    sealed class Carte
    {
      public Button Bouton = null!;
      public Label Titre = null!, Texte = null!, Etat = null!, Detail = null!;
      public Vignette Vue = null!;
    }

    readonly Label titre, sous;
    readonly Carte campagne, infini, defi;

    public EcranModes(Interface ui, VisualElement racine) : base(ui, racine)
    {
      titre = Interface.Trouver<Label>(racine, "modes-titre");
      sous = Interface.Trouver<Label>(racine, "modes-sous");
      campagne = Lire("mode-campagne", "lancement");
      infini = Lire("mode-infini", "infini");
      defi = Lire("mode-defi", "defi");
      Ui.Clic(campagne.Bouton, () =>
      {
        ui.Secteur = Vues.NiveauMax;
        ui.Montrer(ui.EcranCampagne);
      });
      Ui.Clic(infini.Bouton, () =>
      {
        ui.EcranDifficultes.Preparer(Mode.Infini);
        ui.Montrer(ui.EcranDifficultes);
      });
      Ui.Clic(defi.Bouton, () => ui.Montrer(ui.EcranDefi));
    }

    Carte Lire(string nom, string theme)
    {
      var b = Interface.Trouver<Button>(Racine, nom);
      var c = new Carte
      {
        Bouton = b,
        Titre = Interface.Trouver<Label>(b, nom + "-titre"),
        Texte = Interface.Trouver<Label>(b, nom + "-texte"),
        Etat = Interface.Trouver<Label>(b, nom + "-etat"),
        Detail = Interface.Trouver<Label>(b, nom + "-detail"),
        Vue = new Vignette(Interface.Trouver<VisualElement>(b, nom + "-vue")),
      };
      c.Vue.Theme = theme;
      return c;
    }

    public override string NomPont => "menu";
    public override string Module => Textes.De("ui.modes.titre");
    public override Button? Principale => campagne.Bouton;

    public override void Rafraichir()
    {
      Ui.Ecrire(titre, Textes.De("ui.modes.titre"));
      Ui.Ecrire(sous, Textes.De("ui.modes.texte"));

      Ui.Ecrire(campagne.Titre, Textes.Majuscules(Textes.De("menu.campagne")));
      Ui.Ecrire(campagne.Texte, Textes.De("descriptions.campagne"));
      Ui.Ecrire(campagne.Etat, Textes.Remplir("ui.modes.secteurs", "n", Vues.SecteursReussis().ToString(System.Globalization.CultureInfo.InvariantCulture), "t", Vues.NombreNiveaux.ToString(System.Globalization.CultureInfo.InvariantCulture)));
      Ui.Ecrire(campagne.Detail, Textes.De("stats.etoiles") + " " + Textes.Remplir("ui.etoiles.total", "n", Vues.TotalEtoiles().ToString(System.Globalization.CultureInfo.InvariantCulture), "t", (Vues.NombreNiveaux * 3 * Vues.Difficultes.Length).ToString(System.Globalization.CultureInfo.InvariantCulture)));
      campagne.Vue.Theme = Vues.Theme(Vues.NiveauMax);

      Ui.Ecrire(infini.Titre, Textes.Majuscules(Textes.De("menu.infini")));
      Ui.Ecrire(infini.Texte, Textes.De("descriptions.infini"));
      InfiniVue? meilleur = null;
      foreach (var d in Vues.Difficultes)
      {
        var r = Vues.Infini(d);
        if (r != null && (meilleur == null || r.score > meilleur.score)) meilleur = r;
      }
      Ui.Ecrire(infini.Etat, meilleur != null ? Textes.De("meilleur") + " " + Textes.Nombre(meilleur.score) : Textes.De("aucunRecord"));
      Ui.Ecrire(infini.Detail, meilleur != null ? Textes.Nombre(meilleur.distance) + " m · " + Vues.NomDifficulte(meilleur.difficulte) : Textes.De("hud.vie"));

      Ui.Ecrire(defi.Titre, Textes.Majuscules(Textes.De("menu.defi")));
      Ui.Ecrire(defi.Texte, Textes.De("descriptions.defi"));
      var jour = Vues.DefiDuJour();
      Ui.Ecrire(defi.Etat, jour != null ? Textes.De("defi.meilleur") + " " + Textes.Nombre(jour.meilleur) : Textes.De("defi.aucune"));
      Ui.Ecrire(defi.Detail, Textes.Date(System.DateTime.Now));
    }
  }
}
