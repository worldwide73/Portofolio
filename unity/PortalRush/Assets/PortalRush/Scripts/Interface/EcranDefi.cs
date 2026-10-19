// PORTAL RUSH (Unity) — LE DÉFI DU JOUR
//
// Comme majDefi du jeu web : la date, les règles (3 000 m, un parcours tiré d'après la date, identique pour tous ;
// Ace ×1 ; la version des règles du score), le meilleur résultat du jour et la dernière tentative, et le rappel que
// le défi se court toujours en Aube. Lancer : le défi (Session prend la graine du jour).
#nullable enable
using System;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranDefi : Ecran
  {
    readonly Label titre, date, meilleurLibelle, meilleur, derniereLibelle, derniere, note, lancerTexte;
    readonly VisualElement regles;
    readonly Label[] lignes = new Label[4];
    readonly Button lancer;
    readonly Vignette vue;

    public EcranDefi(Interface ui, VisualElement racine) : base(ui, racine)
    {
      Label L(string nom) => Interface.Trouver<Label>(racine, nom);
      titre = L("defi-titre");
      date = L("defi-date");
      meilleurLibelle = L("defi-meilleur-libelle");
      meilleur = L("defi-meilleur");
      derniereLibelle = L("defi-derniere-libelle");
      derniere = L("defi-derniere");
      note = L("defi-note");
      lancer = Interface.Trouver<Button>(racine, "defi-lancer");
      lancerTexte = L("defi-lancer-texte");
      vue = new Vignette(Interface.Trouver<VisualElement>(racine, "defi-vue"));
      vue.Theme = "defi";
      regles = Interface.Trouver<VisualElement>(racine, "defi-regles");
      for (int i = 0; i < 4; i++)
      {
        var ligne = Ui.Element("defi__regle", regles);
        Ui.Texte(Textes.Deux(i + 1), "defi__regle-index", ligne);
        lignes[i] = Ui.Texte("", "defi__regle-texte", ligne);
      }
      Ui.Clic(lancer, () => ui.Lancer(Mode.Defi, "as", 1));
    }

    public override string NomPont => "niveaux";
    public override string Module => Textes.De("menu.defi");
    public override Button? Principale => lancer;

    public override bool Retour()
    {
      ui.Montrer(ui.EcranModes);
      return true;
    }

    public override void Rafraichir()
    {
      Ui.Ecrire(titre, Textes.De("defi.titre"));
      Ui.Ecrire(date, Textes.Majuscules(Textes.Date(DateTime.Now)));
      Ui.Ecrire(lignes[0], Textes.De("defi.objectif"));
      Ui.Ecrire(lignes[1], Textes.De("defi.parcours"));
      Ui.Ecrire(lignes[2], Textes.Remplir("defi.regles", "v", Donnees.ReglesVersion.ToString(System.Globalization.CultureInfo.InvariantCulture)));
      Ui.Ecrire(lignes[3], Textes.De("defi.score"));
      var jour = Vues.DefiDuJour();
      Ui.Ecrire(meilleurLibelle, Textes.Majuscules(Textes.De("defi.meilleur")));
      Ui.Ecrire(meilleur, jour != null ? Textes.Nombre(jour.meilleur) : Textes.De("defi.aucune"));
      meilleur.EnableInClassList("vide", jour == null);
      Ui.Ecrire(derniereLibelle, Textes.Majuscules(Textes.De("defi.derniere")));
      Ui.Ecrire(derniere, jour != null ? Textes.Nombre(jour.dernier) + " · " + Textes.Remplir("defi.tentatives", "n", jour.tentatives.ToString(System.Globalization.CultureInfo.InvariantCulture)) : "—");
      Ui.Ecrire(note, Textes.De("garage.vaisseaux.defi"));
      Ui.Ecrire(lancerTexte, Textes.Majuscules(Textes.De("defi.lancer")));
    }
  }
}
