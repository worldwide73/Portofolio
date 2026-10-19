// PORTAL RUSH (Unity) — LE MENU PRINCIPAL
//
// Comme le menu du jeu web (majAccueil) : au centre, le logotype et l'action principale (Continuer le prochain
// secteur, ou Commencer le secteur 01 au premier lancement ; Entrée ou Espace), puis les modes de jeu, le garage et
// « Refaire l'entraînement » ; en bas, l'état de la progression (campagne, étoiles, garage, défis, dernière partie),
// le meilleur score (discret) et RUSH RADIO (lecture, pistes, volume), qui suit l'état envoyé par la page.
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class EcranMenu : Ecran
  {
    readonly Label surtitre, accroche, continuerTitre, continuerDesc, toucheEntree, toucheEspace, bienvenue;
    readonly Button continuer, modes, garage, tutoriel;
    readonly Label modesTitre, modesDesc, garageTitre, garageDesc, tutorielTitre, tutorielDesc;
    readonly Label meilleurLibelle, meilleur, meilleurOrigine;
    readonly VisualElement stats;
    readonly Label[] statLibelles = new Label[5];
    readonly Label[] statValeurs = new Label[5];
    readonly List<VisualElement> segments = new List<VisualElement>();
    // RUSH RADIO
    readonly VisualElement radio, radioListe, radioPistes, ondes;
    readonly Button radioLecture, radioTitres, radioPrecedente, radioSuivante;
    readonly VisualElement radioIcone;
    readonly Label radioMarque, radioTitre, radioDetail, radioListeTitre;
    readonly Curseur radioVolume;
    float prochainVolume;

    public EcranMenu(Interface ui, VisualElement racine) : base(ui, racine)
    {
      Label L(string nom) => Interface.Trouver<Label>(racine, nom);
      Button B(string nom) => Interface.Trouver<Button>(racine, nom);
      surtitre = L("menu-surtitre");
      accroche = L("menu-accroche");
      continuer = B("menu-continuer");
      continuerTitre = L("menu-continuer-titre");
      continuerDesc = L("menu-continuer-desc");
      toucheEntree = L("menu-touche-entree");
      toucheEspace = L("menu-touche-espace");
      bienvenue = L("menu-bienvenue");
      modes = B("menu-modes");
      modesTitre = L("menu-modes-titre");
      modesDesc = L("menu-modes-desc");
      garage = B("menu-garage");
      garageTitre = L("menu-garage-titre");
      garageDesc = L("menu-garage-desc");
      tutoriel = B("menu-tutoriel");
      tutorielTitre = L("menu-tutoriel-titre");
      tutorielDesc = L("menu-tutoriel-desc");
      meilleurLibelle = L("menu-meilleur-libelle");
      meilleur = L("menu-meilleur");
      meilleurOrigine = L("menu-meilleur-origine");
      stats = Interface.Trouver<VisualElement>(racine, "menu-stats");

      Ui.Clic(continuer, Continuer);
      Ui.Clic(modes, () => ui.Montrer(ui.EcranModes));
      Ui.Clic(garage, () => ui.Montrer(ui.EcranGarage));
      Ui.Clic(tutoriel, () => ui.LancerTutoriel(0));

      // L'état de la progression : cinq valeurs (la campagne avec ses huit segments).
      for (int i = 0; i < 5; i++)
      {
        var bloc = Ui.Element("stat", stats);
        statLibelles[i] = Ui.Etiquette("", "stat__libelle", bloc);
        var ligne = Ui.Element("stat__ligne", bloc);
        statValeurs[i] = Ui.Texte("", "stat__valeur", ligne);
        if (i == 0)
        {
          var s = Ui.Element("stat__segments", ligne);
          for (int k = 0; k < Vues.NombreNiveaux; k++) segments.Add(Ui.Element("stat__segment", s));
        }
      }

      // RUSH RADIO : le lecteur compact.
      radio = Interface.Trouver<VisualElement>(racine, "radio");
      radioLecture = Ui.Bouton("radio__lecture", Basculer, radio);
      radioIcone = Ui.Icone(Icone.Lecture, "radio__icone", radioLecture);
      radioTitres = Ui.Bouton("radio__titres", () =>
      {
        if (ListeRadioOuverte) FermerListeRadio(true);
        else OuvrirListe();
      }, radio);
      var marque = Ui.Element("radio__marque", radioTitres);
      radioMarque = Ui.Texte("RUSH RADIO", "radio__nom", marque);
      ondes = Ui.Element("radio__ondes", marque);
      for (int i = 0; i < 4; i++) Ui.Element("radio__onde", ondes);
      radioTitre = Ui.Texte("", "radio__titre", radioTitres);
      radioDetail = Ui.Texte("", "radio__detail", radioTitres);
      radioPrecedente = Ui.Bouton("radio__saut", () => Pont.Radio("precedente"), radio);
      Ui.Icone(Icone.Precedente, "radio__icone radio__icone--petite", radioPrecedente);
      radioSuivante = Ui.Bouton("radio__saut", () => Pont.Radio("suivante"), radio);
      Ui.Icone(Icone.Suivante, "radio__icone radio__icone--petite", radioSuivante);
      radioVolume = new Curseur(radio, 0.01f);
      radioVolume.Racine.AddToClassList("radio__volume");
      radioVolume.Change += v => Volume(v, false);
      radioVolume.Fini += v => Volume(v, true);
      radioListe = Ui.Element("radio__liste plaque", radio);
      radioListeTitre = Ui.Etiquette("", "radio__liste-titre", radioListe);
      radioPistes = Ui.Element("radio__pistes", radioListe);
      Ui.Afficher(radioListe, false);
    }

    public override string NomPont => "menu";
    public override string Module => Textes.De("barre.principal");
    public override string Echap => Textes.De("barre.echap.quitter");
    public override Button? Principale => continuer;

    public override void Rafraichir()
    {
      Ui.Ecrire(surtitre, Textes.Majuscules(Textes.De("surtitre")));
      Ui.Ecrire(accroche, Textes.De("accroche"));
      // Continuer : le prochain secteur de la campagne ; sans partie jouée, « Commencer » le secteur 01.
      bool premiere = Vues.Premiere();
      var r = Vues.Reprise(ui.Difficulte);
      Ui.Ecrire(continuerTitre, Textes.Majuscules(Textes.De(premiere ? "menu.commencer" : "menu.continuer")));
      Ui.Ecrire(continuerDesc, premiere
        ? Textes.Remplir("descriptions.commencer", "nom", Vues.NomNiveau(1))
        : Textes.Remplir("descriptions.continuer", "n", Textes.Deux(r.Niveau), "nom", Vues.NomNiveau(r.Niveau), "d", Vues.NomDifficulte(r.Difficulte)));
      Ui.Ecrire(toucheEntree, Textes.De("barre.entree"));
      Ui.Ecrire(toucheEspace, Textes.De("barre.espace"));
      Ui.Ecrire(bienvenue, Textes.De("stats.bienvenue"));
      Ui.Afficher(bienvenue, Vues.Parties == 0);
      Ui.Ecrire(modesTitre, Textes.De("ui.modes.titre"));
      Ui.Ecrire(modesDesc, Textes.De("ui.modes.texte"));
      Ui.Ecrire(garageTitre, Textes.De("menu.garage"));
      Ui.Ecrire(garageDesc, Textes.De("descriptions.garage"));
      Ui.Ecrire(tutorielTitre, Textes.De("tutoriel.refaire"));
      Ui.Ecrire(tutorielDesc, Textes.De("tutoriel.refaireTexte"));

      int faits = Vues.SecteursReussis();
      string[] libelles = { "stats.campagne", "stats.etoiles", "stats.pieces", "stats.defis", "stats.derniere" };
      for (int i = 0; i < 5; i++) Ui.Ecrire(statLibelles[i], Textes.Majuscules(Textes.De(libelles[i])));
      Ui.Ecrire(statValeurs[0], faits + " / " + Vues.NombreNiveaux);
      for (int k = 0; k < segments.Count; k++) segments[k].EnableInClassList("fait", k < faits);
      Ui.Ecrire(statValeurs[1], Vues.TotalEtoiles() + " / " + Vues.NombreNiveaux * 3 * Vues.Difficultes.Length);
      int pieces = 0, total = 0;
      foreach (var p in Pont.Vue.pieces)
      {
        if (p == null) continue;
        total++;
        if (p.debloquee) pieces++;
      }
      Ui.Ecrire(statValeurs[2], pieces + " / " + Math.Max(total, Donnees.Pieces.Length));
      Ui.Ecrire(statValeurs[3], Vues.DefisReussis().ToString(System.Globalization.CultureInfo.InvariantCulture));
      var d = Pont.Vue.derniere;
      Ui.Ecrire(statValeurs[4], d != null && d.existe
        ? (d.mode == "campagne" ? Vues.Secteur(d.niveau) : d.mode == "infini" ? Textes.De("menu.infini") : Textes.De("menu.defi")) + " · " + Vues.NomDifficulte(d.difficulte)
        : "—");

      var m = Vues.MeilleurScore();
      Ui.Ecrire(meilleurLibelle, Textes.Majuscules(Textes.De("stats.meilleur")));
      Ui.Ecrire(meilleur, m.Score > 0 ? Textes.Nombre(m.Score) : "—");
      Ui.Ecrire(meilleurOrigine, Textes.Majuscules(m.Origine));
      Ui.Afficher(meilleurOrigine, m.Origine.Length > 0);
      Radio(Pont.RadioEtat);
    }

    void Continuer()
    {
      var r = Vues.Reprise(ui.Difficulte);
      ui.Secteur = r.Niveau;
      ui.Lancer(Mode.Campagne, r.Difficulte, r.Niveau);
    }

    public override bool Retour()
    {
      ui.Quitter();
      return true;
    }

    public override void Image(float dt)
    {
      if (prochainVolume > 0) prochainVolume -= dt;
    }

    // ==========================================================================
    // RUSH RADIO
    // ==========================================================================
    public bool ListeRadioOuverte => Ui.Affiche(radioListe);
    public VisualElement ZoneRadio => radioListe;

    /** L'état envoyé par la page (lecture, piste, liste) ; null : pas encore reçu. */
    public void Radio(EtatRadio? e)
    {
      var r = Pont.Vue.reglages;
      bool lecture = e != null && e.lecture;
      radio.EnableInClassList("lecture", lecture);
      Formes.Dessiner(radioIcone, lecture ? Icone.Pause : Icone.Lecture);
      PisteRadio? piste = null;
      if (e != null)
        foreach (var p in e.pistes)
          if (p != null && p.id == e.piste) piste = p;
      if (piste == null && e != null && e.pistes.Length > 0) piste = e.pistes[0];
      Ui.Ecrire(radioMarque, Textes.De("radio.titre"));
      Ui.Ecrire(radioTitre, piste != null ? piste.titre : Textes.De("ui.radio.aucune"));
      Ui.Ecrire(radioDetail, piste != null ? Detail(piste) : "");
      Ui.Ecrire(radioListeTitre, Textes.Majuscules(Textes.De("ui.radio.pistes")));
      radioVolume.Libelle("");
      if (r != null) radioVolume.Valeur = r.muet ? 0 : (float)r.volumeMusique;
      // La liste des pistes.
      var pistes = e != null ? e.pistes : Array.Empty<PisteRadio>();
      if (radioPistes.childCount != pistes.Length) radioPistes.Clear();
      for (int i = 0; i < pistes.Length; i++)
      {
        var p = pistes[i];
        if (p == null) continue;
        Button b;
        if (radioPistes.childCount <= i)
        {
          string id = p.id;
          b = Ui.Bouton("radio__piste", () => ChoisirPiste(id), radioPistes);
          Ui.Texte(Textes.Deux(i + 1), "radio__numero", b);
          var t = Ui.Element("radio__piste-texte", b);
          Ui.Texte("", "radio__piste-titre", t);
          Ui.Texte("", "radio__piste-detail", t);
          Ui.Texte("", "radio__piste-genre", t);
        }
        else b = (Button)radioPistes.ElementAt(i);
        var texte = b.ElementAt(1);
        Ui.Ecrire(texte.ElementAt(0) as Label, p.titre);
        Ui.Ecrire(texte.ElementAt(1) as Label, p.licence == "original" ? Textes.De("radio.original") : p.auteur + (p.licence.Length > 0 ? " · " + p.licence : ""));
        Ui.Ecrire(texte.ElementAt(2) as Label, Textes.De(p.adaptative ? "radio.adaptative" : "radio.fixe"));
        b.EnableInClassList("actif", e != null && p.id == e.piste);
      }
      radioLecture.SetEnabled(e != null);
      radioPrecedente.SetEnabled(e != null && pistes.Length > 1);
      radioSuivante.SetEnabled(e != null && pistes.Length > 1);
    }

    string Detail(PisteRadio p)
    {
      if (p.adaptative) return Textes.De("radio.adaptative");
      string licence = p.licence == "original" ? Textes.De("radio.original") : p.licence;
      return p.auteur.Length > 0 ? p.auteur + (licence.Length > 0 ? " · " + licence : "") : licence;
    }

    void Basculer()
    {
      var e = Pont.RadioEtat;
      Pont.Radio(e != null && e.lecture ? "pause" : "lecture");
    }

    void ChoisirPiste(string id)
    {
      Pont.Radio("piste", id);
      FermerListeRadio(true);
    }

    void OuvrirListe()
    {
      Ui.Afficher(radioListe, true);
      radioTitres.AddToClassList("ouvert");
      VisualElement? cible = null;
      foreach (var c in radioPistes.Children())
        if (c.ClassListContains("actif")) cible = c;
      ui.Focaliser(cible ?? (radioPistes.childCount > 0 ? radioPistes.ElementAt(0) : null));
      ui.Barre.Maj();
    }

    public void FermerListeRadio(bool focus)
    {
      if (!ListeRadioOuverte) return;
      Ui.Afficher(radioListe, false);
      radioTitres.RemoveFromClassList("ouvert");
      if (focus) radioTitres.Focus();
      ui.Barre.Maj();
    }

    /** Le volume de la musique du jeu : un réglage (la page l'applique tout de suite), au plus 8 fois par seconde. */
    void Volume(float v, bool fin)
    {
      if (!fin && prochainVolume > 0) return;
      prochainVolume = 0.12f;
      var r = Pont.Vue.reglages.Copie();
      r.volumeMusique = Math.Round(v, 2);
      r.muet = v <= 0.001f;
      Pont.Reglages(r);
    }
  }
}
