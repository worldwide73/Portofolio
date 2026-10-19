// PORTAL RUSH (Unity) — LES RÉSULTATS : VICTOIRE, DÉFAITE, FIN DE SURVIE, FIN DU DÉFI
//
// Comme terminer() du jeu web. Session envoie la fin à la page (Pont.Fin) dès la fin de la partie ; la page range le
// résultat (records, étoiles, déblocages) et répond « bilan ». L'écran s'affiche avec ce que la partie sait déjà
// (score, rang, objectifs, statistiques) et « Enregistrement du résultat… » ; le bilan complète : nouvelles étoiles,
// record, secteur, difficultés, pièces et vaisseaux débloqués, prochaine pièce.
//   Victoire (campagne réussie) : les trois étoiles (gagnées, nouvelles), le rang, le score, le record, les
//   déblocages ; Secteur suivant, Rejouer, Menu.
//   Sinon : le titre (vaisseau détruit, objectif manqué, fin de course, défi terminé), le score et l'écart au record,
//   les statistiques, les objectifs, les étoiles à gagner, la prochaine pièce ; Rejouer, Autre difficulté, Menu.
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranResultat : Ecran
  {
    readonly Label surtitre, titre, rang, score, record, attente, objectifsTitre, recompensesTitre, etoilesTitre, progres;
    readonly VisualElement etoilesBloc, etoiles, stats, objectifsBloc, objectifs, recompensesBloc, recompenses, actions, portail;
    readonly Button suivant, rejouer, autre, menu;
    readonly Label suivantTexte, rejouerTexte, autreTexte, menuTexte;
    readonly List<(VisualElement Bloc, VisualElement Etoile, Label Texte, Label Nouvelle)> blocsEtoiles = new List<(VisualElement, VisualElement, Label, Label)>();

    Resultat? resultat;
    Lancement? lancement;
    double avancement;
    Bilan? bilan;
    bool[] etoilesAvant = new bool[3];

    public EcranResultat(Interface ui, VisualElement racine) : base(ui, racine)
    {
      Label L(string nom) => Interface.Trouver<Label>(racine, nom);
      VisualElement E(string nom) => Interface.Trouver<VisualElement>(racine, nom);
      portail = E("res-portail");
      surtitre = L("res-surtitre");
      titre = L("res-titre");
      etoilesBloc = E("res-etoiles-bloc");
      etoilesTitre = L("res-etoiles-titre");
      etoiles = E("res-etoiles");
      rang = L("res-rang");
      score = L("res-score");
      record = L("res-record");
      attente = L("res-attente");
      stats = E("res-stats");
      objectifsBloc = E("res-objectifs-bloc");
      objectifsTitre = L("res-objectifs-titre");
      objectifs = E("res-objectifs");
      recompensesBloc = E("res-recompenses-bloc");
      recompensesTitre = L("res-recompenses-titre");
      recompenses = E("res-recompenses");
      progres = L("res-progres");
      actions = E("res-actions");
      for (int k = 0; k < 3; k++)
      {
        var bloc = Ui.Element("etoile-resultat", etoiles);
        var e = Ui.Element("etoile etoile--grande", bloc);
        Formes.Etoile(e);
        var texte = Ui.Texte("", "etoile-resultat__texte", bloc);
        var nouvelle = Ui.Etiquette("", "etoile-resultat__nouvelle", bloc);
        blocsEtoiles.Add((bloc, e, texte, nouvelle));
      }
      Button Bouton(string classes, Action a, out Label texte)
      {
        var b = Ui.Bouton(classes, a, actions);
        texte = Ui.Texte("", "action__texte", b);
        return b;
      }
      suivant = Bouton("lancer plaque", Suivant, out suivantTexte);
      Ui.Icone(Icone.Chevron, "lancer__icone", suivant);
      rejouer = Bouton("action plaque", Rejouer, out rejouerTexte);
      Ui.Touche("R", "action__touche", rejouer);
      autre = Bouton("action plaque", Autre, out autreTexte);
      menu = Bouton("action plaque", ui.MenuPrincipal, out menuTexte);
    }

    public override string NomPont => "fin";
    public override string Module => Victoire ? Textes.De("victoire.titre") : Textes.De("fin.score");
    public override string Echap => Textes.De("barre.echap.menu");
    public override Vitrine3D Vitrine => Vitrine3D.Aucune;
    public override Button? Principale => Ui.Affiche(suivant) ? suivant : rejouer;

    public override bool Retour()
    {
      ui.MenuPrincipal();
      return true;
    }

    bool Victoire => resultat != null && lancement != null && lancement.Mode == Mode.Campagne && resultat.Reussi;

    /** La partie vient de finir : ce qu'on sait déjà (le bilan suivra). */
    public void Preparer(Resultat r, Lancement l, Partie p)
    {
      resultat = r;
      lancement = l.Copie();
      avancement = p.Avancement;
      bilan = null;
      etoilesAvant = l.Mode == Mode.Campagne ? Vues.Etoiles(l.Niveau, Vues.Id(l.Difficulte)) : new bool[3];
      if (ui.Courant == this) Rafraichir();
    }

    public void Bilan(Bilan b)
    {
      if (resultat == null) return;
      bilan = b;
      if (ui.Courant == this) Rafraichir();
    }

    public void Oublier()
    {
      resultat = null;
      lancement = null;
      bilan = null;
    }

    public override void Rafraichir()
    {
      var r = resultat;
      var l = lancement;
      if (r == null || l == null) return;
      bool victoire = Victoire;
      bool campagne = l.Mode == Mode.Campagne;
      Racine.EnableInClassList("victoire", victoire);
      Racine.EnableInClassList("defaite", !victoire);
      Ui.Afficher(portail, victoire);
      Ui.Ecrire(surtitre, Textes.Majuscules(Vues.LibellePartie(l)));
      Ui.Ecrire(titre, victoire ? Textes.De("victoire.titre")
        : l.Mode == Mode.Infini ? Textes.De("fin.titreInfini")
        : r.Arrive ? Textes.De(l.Mode == Mode.Defi ? "fin.titreDefi" : "fin.objectifManque")
        : Textes.De("fin.titre"));
      Ui.Ecrire(score, Textes.Nombre(r.Score));
      Ui.Ecrire(rang, r.Rang != "—" ? r.Rang : "");
      Ui.Afficher(rang, r.Rang != "—");
      rang.EnableInClassList("rang--sss", r.Rang == "SSS");
      rang.EnableInClassList("rang--s", r.Rang == "S");

      // Le record (le bilan le dit).
      var b = bilan;
      Ui.Afficher(attente, b == null);
      Ui.Ecrire(attente, Textes.Majuscules(Textes.De("ui.bilan.attente")));
      record.EnableInClassList("nouveau", b != null && b.record);
      if (b == null) Ui.Ecrire(record, "");
      else if (b.record) Ui.Ecrire(record, Textes.Majuscules(Textes.De("fin.nouveau")));
      else if (victoire) Ui.Ecrire(record, Textes.Majuscules(Textes.De("meilleur") + " " + Textes.Nombre(Math.Max(b.ancienRecord, r.Score))));
      else Ui.Ecrire(record, b.ancienRecord > r.Score ? Textes.Majuscules(Textes.Remplir("fin.ecart", "n", Textes.Nombre(b.ancienRecord - r.Score))) : "");

      Etoiles(r, l, b, victoire, campagne);
      Statistiques(r, l, victoire);
      Objectifs(r, victoire);
      Recompenses(b, victoire);

      // La prochaine pièce (hors victoire, comme le jeu web).
      var suite = !victoire ? Vues.ProchainePiece() : null;
      Ui.Afficher(progres, suite != null);
      if (suite != null)
      {
        string avance = suite.condition != null && suite.condition.cible > 1
          ? " (" + Textes.Remplir("garage.progres", "n", Textes.Nombre(suite.condition.mesure), "v", Textes.Nombre(suite.condition.cible)) + ")" : "";
        Ui.Ecrire(progres, Textes.De("fin.progres") + " " + Vues.NomEmplacement(suite.emplacement) + " · " + Vues.NomPiece(suite.id) + " — " + Vues.ConditionTexte(suite.condition) + avance);
      }

      // Les actions.
      bool aSuivant = victoire && l.Niveau < Vues.NombreNiveaux && l.Niveau + 1 <= Vues.NiveauMax;
      Ui.Afficher(suivant, aSuivant);
      Ui.Ecrire(suivantTexte, Textes.Majuscules(Textes.De("victoire.suivant")));
      Ui.Ecrire(rejouerTexte, Textes.Majuscules(Textes.De(victoire ? "victoire.rejouer" : "fin.rejouer")));
      rejouer.EnableInClassList("lancer", !aSuivant);
      rejouer.EnableInClassList("action", aSuivant);
      Ui.Afficher(autre, !victoire && l.Mode != Mode.Defi);
      Ui.Ecrire(autreTexte, Textes.Majuscules(Textes.De("fin.autreDifficulte")));
      Ui.Ecrire(menuTexte, Textes.Majuscules(Textes.De(victoire ? "victoire.menu" : "fin.menu")));
    }

    void Etoiles(Resultat r, Lancement l, Bilan? b, bool victoire, bool campagne)
    {
      Ui.Afficher(etoilesBloc, campagne);
      if (!campagne) return;
      etoilesBloc.EnableInClassList("petit", !victoire);
      Ui.Ecrire(etoilesTitre, Textes.Majuscules(Textes.De(victoire ? "etoiles.titre" : "etoiles.aGagner")));
      var libelles = Vues.LibellesEtoiles(l.Niveau, l.Difficulte);
      bool[] gagnees = b != null && b.etoiles.Length >= 3 ? b.etoiles : etoilesAvant;
      // Les mesures : l'objectif principal, le score face au score de l'étoile, la maîtrise.
      var mesures = new (TypeObjectif Type, double Mesure, double Valeur)?[3];
      if (r.Objectifs.Count > 0) mesures[0] = (r.Objectifs[0].Type, r.Objectifs[0].Mesure, r.Objectifs[0].Valeur);
      mesures[1] = (TypeObjectif.Score, r.Score, Vues.ScoreEtoile(l.Niveau, l.Difficulte));
      if (r.Objectifs.Count > 1) mesures[2] = (r.Objectifs[1].Type, r.Objectifs[1].Mesure, r.Objectifs[1].Valeur);
      for (int k = 0; k < 3; k++)
      {
        var (bloc, etoile, texte, nouvelle) = blocsEtoiles[k];
        bool gagnee = k < gagnees.Length && gagnees[k];
        bool estNouvelle = victoire && b != null && Array.IndexOf(b.nouvellesEtoiles, k) >= 0;
        etoile.EnableInClassList("gagnee", gagnee);
        bloc.EnableInClassList("gagnee", gagnee);
        bloc.EnableInClassList("nouvelle", estNouvelle);
        if (estNouvelle && !Interface.Reduit) ui.Impulsion(bloc, "entree");
        string suivi = "";
        var m = mesures[k];
        if (victoire && m != null && !gagnee && m.Value.Type != TypeObjectif.Fin && m.Value.Type != TypeObjectif.Boss && m.Value.Type != TypeObjectif.ChocsMax)
          suivi = " · " + Textes.Nombre(m.Value.Mesure) + " / " + Textes.Nombre(m.Value.Valeur);
        Ui.Ecrire(texte, libelles[k] + suivi);
        Ui.Ecrire(nouvelle, estNouvelle ? Textes.Majuscules(Textes.De("etoiles.nouvelle")) : "");
        Ui.Afficher(nouvelle, estNouvelle);
      }
    }

    void Statistiques(Resultat r, Lancement l, bool victoire)
    {
      stats.Clear();
      Ui.Afficher(stats, !victoire);
      if (victoire) return;
      void Ligne(string cle, string valeur)
      {
        var bloc = Ui.Element("stat-resultat", stats);
        Ui.Etiquette(Textes.De(cle), "stat-resultat__libelle", bloc);
        Ui.Texte(valeur, "stat-resultat__valeur", bloc);
      }
      if (l.Mode == Mode.Infini) Ligne("fin.distance", Textes.Nombre(r.Distance) + " m");
      else Ligne("fin.progression", Textes.Nombre(avancement * 100) + (Textes.Anglais ? "%" : "\u00A0%"));
      if (r.Rang != "—") Ligne("fin.rang", r.Rang);
      Ligne("fin.combo", r.ComboMax.ToString(System.Globalization.CultureInfo.InvariantCulture));
      Ligne("fin.parfaits", r.Parfaits.ToString(System.Globalization.CultureInfo.InvariantCulture));
      Ligne("fin.fragments", r.Fragments + " / " + r.FragmentsVus);
      Ligne("fin.temps", Textes.Temps(r.Temps));
    }

    void Objectifs(Resultat r, bool victoire)
    {
      objectifs.Clear();
      Ui.Afficher(objectifsBloc, !victoire && r.Objectifs.Count > 0);
      Ui.Ecrire(objectifsTitre, Textes.Majuscules(Textes.De("fin.objectifs")));
      foreach (var o in r.Objectifs)
      {
        var ligne = Ui.Element("objectif", objectifs);
        ligne.EnableInClassList("atteint", o.Atteint);
        Ui.Icone(o.Atteint ? Icone.Coche : Icone.Croix, "objectif__icone", ligne);
        string t = Vues.ObjectifTexte(o.Type, o.Valeur);
        Ui.Texte(t, "objectif__texte", ligne);
        if (o.Type != TypeObjectif.Fin && o.Type != TypeObjectif.Boss && o.Type != TypeObjectif.ChocsMax)
          Ui.Texte(Textes.Nombre(o.Mesure) + " / " + Textes.Nombre(o.Valeur), "objectif__mesure", ligne);
      }
    }

    void Recompenses(Bilan? b, bool victoire)
    {
      recompenses.Clear();
      // Les déblocages : à la victoire comme le jeu web, et aussi après une autre partie s'il y en a (pièces, vaisseaux).
      var gains = new List<string>();
      if (b != null)
      {
        if (b.niveauDebloque > 0) gains.Add(Textes.Remplir("victoire.secteurDebloque", "n", Textes.Deux(b.niveauDebloque)) + " · " + Vues.NomNiveau(b.niveauDebloque));
        if (b.cauchemarDebloque) gains.Add(Textes.De("victoire.cauchemar"));
        if (b.paradoxeDebloque) gains.Add(Textes.De("victoire.paradoxe"));
        foreach (var id in b.pieces)
        {
          var p = Vues.Piece(id);
          gains.Add((p != null ? Vues.NomEmplacement(p.emplacement) + " · " : "") + Vues.NomPiece(id));
        }
        foreach (var id in b.vehicules) gains.Add(Textes.Remplir("ui.recompense.vaisseau", "v", Vues.NomVehicule(id)));
      }
      Ui.Afficher(recompensesBloc, victoire || gains.Count > 0);
      Ui.Ecrire(recompensesTitre, Textes.Majuscules(Textes.De("victoire.recompenses")));
      if (b == null)
      {
        Ui.Texte("…", "recompense recompense--vide", recompenses);
        return;
      }
      if (gains.Count == 0) Ui.Texte(Textes.De("victoire.aucune"), "recompense recompense--vide", recompenses);
      foreach (var g in gains)
      {
        var ligne = Ui.Element("recompense recompense--nouvelle", recompenses);
        Ui.Element("recompense__puce", ligne);
        Ui.Texte(g, "recompense__texte", ligne);
      }
    }

    // ==========================================================================
    // LES ACTIONS
    // ==========================================================================
    /** Rejouer (R) : la même partie, nouvelle graine (le défi garde celle du jour). */
    public void Rejouer()
    {
      if (Session.Instance != null && Session.Instance.Lancement != null) Session.Instance.Recommencer();
      else if (lancement != null) ui.Lancer(lancement.Mode, Vues.Id(lancement.Difficulte), lancement.Niveau);
    }

    void Suivant()
    {
      if (lancement == null) return;
      int n = Math.Min(Vues.NombreNiveaux, lancement.Niveau + 1);
      ui.Lancer(Mode.Campagne, Vues.Id(lancement.Difficulte), n);
    }

    void Autre()
    {
      var l = lancement;
      if (l == null) return;
      if (ui.Partie != null) Session.Instance?.Abandonner();
      if (l.Mode == Mode.Infini)
      {
        ui.EcranDifficultes.Preparer(Mode.Infini);
        ui.Montrer(ui.EcranDifficultes);
      }
      else
      {
        ui.Secteur = l.Niveau;
        ui.EcranDifficultes.Preparer(Mode.Campagne, l.Niveau);
        ui.Montrer(ui.EcranDifficultes);
      }
    }
  }
}
