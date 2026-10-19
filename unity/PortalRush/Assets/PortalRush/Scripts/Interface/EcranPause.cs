// PORTAL RUSH (Unity) — LA PAUSE ET LES CONFIRMATIONS
//
// La pause (comme le jeu web) : Reprendre (Entrée ; un bref compte à rebours pour se replacer), Recommencer (R),
// Réglages, Menu principal, Quitter vers le portfolio. Ce qui abandonne la course se confirme : le jeu web demandait
// un second appui ; ici, une fenêtre de confirmation (Entrée confirme, Échap annule ; R, R recommence). Pendant
// l'entraînement, rien ne se perd (l'étape est gardée) : le menu s'ouvre sans confirmation.
#nullable enable
using System;
using PortalRush.Jeu;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranPause : Ecran
  {
    readonly Label sous, titre, partie;
    readonly Button reprendre, recommencer, reglages, menu, quitter;
    readonly Label[] textes = new Label[5];
    readonly Label toucheReprendre;

    public EcranPause(Interface ui, VisualElement racine) : base(ui, racine)
    {
      sous = Interface.Trouver<Label>(racine, "pause-sous");
      titre = Interface.Trouver<Label>(racine, "pause-titre");
      partie = Interface.Trouver<Label>(racine, "pause-partie");
      var entrees = Interface.Trouver<VisualElement>(racine, "pause-entrees");
      Button Entree(int i, Action action, string touche)
      {
        var b = Ui.Bouton("entree plaque", action, entrees);
        Ui.Texte(Textes.Deux(i + 1), "entree__index", b);
        textes[i] = Ui.Texte("", "entree__titre", b);
        if (touche.Length > 0) Ui.Touche(touche, "entree__touche", b);
        return b;
      }
      reprendre = Entree(0, ui.Reprendre, "");
      reprendre.AddToClassList("entree--principale");
      toucheReprendre = Ui.Touche("", "entree__touche", reprendre);
      recommencer = Entree(1, DemanderRecommencer, "R");
      reglages = Entree(2, () => ui.Reglages.Ouvrir("audio"), "");
      menu = Entree(3, DemanderMenu, "");
      quitter = Entree(4, DemanderQuitter, "");
    }

    public override string NomPont => "pause";
    public override string Module => Textes.De("pause.titre");
    public override string Echap => Textes.De("barre.echap.reprendre");
    public override Vitrine3D Vitrine => Vitrine3D.Aucune;
    public override Button? Principale => reprendre;

    public override bool Retour()
    {
      ui.Reprendre();
      return true;
    }

    public override void Rafraichir()
    {
      Ui.Ecrire(sous, Textes.Majuscules(Textes.De("pause.sousTitre")));
      Ui.Ecrire(titre, Textes.De("pause.titre"));
      Ui.Ecrire(partie, Textes.Majuscules(Vues.LibellePartie(ui.Lancement)));
      Ui.Ecrire(textes[0], Textes.De("pause.reprendre"));
      Ui.Ecrire(toucheReprendre, Textes.De("barre.entree"));
      Ui.Ecrire(textes[1], Textes.De("pause.recommencer"));
      Ui.Ecrire(textes[2], Textes.De("pause.reglages"));
      Ui.Ecrire(textes[3], Textes.De("pause.menu"));
      Ui.Ecrire(textes[4], Textes.De("pause.quitter"));
    }

    /** Recommencer : confirmé (R une seconde fois, ou Entrée) ; à l'entraînement, l'étape en cours. */
    public void DemanderRecommencer()
    {
      if (ui.Confirmation.Ouverte)
      {
        if (ui.Confirmation.Cle == "recommencer") ui.Confirmation.Confirmer();
        return;
      }
      ui.Confirmation.Demander("recommencer", Textes.De("pause.recommencer"),
        Textes.De(ui.EnTutoriel ? "ui.confirmation.tutoriel" : "ui.confirmation.perte"), Textes.De("pause.confirmer"), ui.Recommencer);
    }

    void DemanderMenu()
    {
      // (Pendant l'entraînement, rien ne se perd : l'étape est sauvegardée, pas besoin de confirmer.)
      if (ui.EnTutoriel)
      {
        ui.MenuPrincipal();
        return;
      }
      ui.Confirmation.Demander("menu", Textes.De("pause.menu"), Textes.De("ui.confirmation.perte"), Textes.De("pause.confirmerMenu"), ui.MenuPrincipal);
    }

    void DemanderQuitter()
    {
      ui.Confirmation.Demander("quitter", Textes.De("pause.quitter"),
        Textes.De(ui.EnTutoriel ? "ui.confirmation.tutoriel" : "ui.confirmation.perte"), Textes.De("pause.confirmerQuitter"), ui.Quitter);
    }
  }

  /** La fenêtre de confirmation (par-dessus tout : la navigation y reste enfermée). */
  public sealed class Confirmation
  {
    readonly Interface ui;
    public readonly VisualElement Zone;
    readonly VisualElement fenetre;
    readonly Label module, titre, texte, ouiTexte, nonTexte;
    readonly Button oui, non;
    Action? faire;
    VisualElement? retour;
    public string Cle { get; private set; } = "";

    public Confirmation(Interface ui, VisualElement racine)
    {
      this.ui = ui;
      Zone = racine;
      fenetre = Interface.Trouver<VisualElement>(racine, "confirmation-fenetre");
      module = Interface.Trouver<Label>(racine, "confirmation-module");
      titre = Interface.Trouver<Label>(racine, "confirmation-titre");
      texte = Interface.Trouver<Label>(racine, "confirmation-texte");
      oui = Interface.Trouver<Button>(racine, "confirmation-oui");
      non = Interface.Trouver<Button>(racine, "confirmation-non");
      ouiTexte = Interface.Trouver<Label>(racine, "confirmation-oui-texte");
      nonTexte = Interface.Trouver<Label>(racine, "confirmation-non-texte");
      Ui.Clic(oui, Confirmer);
      Ui.Clic(non, Annuler);
      racine.pickingMode = PickingMode.Position;
      Ui.Afficher(racine, false);
    }

    public bool Ouverte => Ui.Affiche(Zone);

    public void Rafraichir()
    {
      Ui.Ecrire(nonTexte, Textes.Majuscules(Textes.De("ui.confirmation.annuler")));
    }

    public void Demander(string cle, string t, string detail, string confirmer, Action action)
    {
      Cle = cle;
      faire = action;
      retour = ui.FocusCourant as VisualElement;
      Ui.Ecrire(module, "SYS · " + Textes.Majuscules(cle == "quitter" ? "EXIT" : cle == "menu" ? "MENU" : "RESET"));
      Ui.Ecrire(titre, t);
      Ui.Ecrire(texte, detail);
      Ui.Ecrire(ouiTexte, Textes.Majuscules(confirmer));
      Rafraichir();
      Ui.Afficher(Zone, true);
      if (!Interface.Reduit) ui.Impulsion(fenetre, "entree");
      ui.Focaliser(oui);
      ui.Barre.Maj();
    }

    public void Confirmer()
    {
      var a = faire;
      Fermer();
      a?.Invoke();
    }

    public void Annuler()
    {
      var r = retour;
      Fermer();
      if (r != null && r.panel != null && r.canGrabFocus) r.Focus();
    }

    public void Fermer()
    {
      if (!Ouverte) return;
      faire = null;
      Cle = "";
      Ui.Afficher(Zone, false);
      ui.Barre.Maj();
    }
  }
}
