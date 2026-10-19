// PORTAL RUSH (Unity) — LE HUD
//
// Ce que lit le pilote pendant la course, comme majHud et evenements de rush.ts : en haut à gauche le secteur, la
// phase, le score (qui monte, avec le gain du dernier succès) et le record à battre ; en haut au centre l'avancement
// (repères des phases), l'objectif, la barre du boss et sa phase ; en haut à droite les boucliers, les fragments et
// la pause ; à gauche la jauge d'Overdrive (anneau : verrouillé, en charge, prêt, actif, utilisé) ; à droite le
// multiplicateur, le combo et son délai. Au centre, les annonces (Perfect Dodge, Overdrive prêt, phase, record…)
// et le compte à rebours ; en bas, les conseils (si l'aide est active) et, pendant l'entraînement, sa consigne.
// Les valeurs ne sont récrites que si elles changent (pas de mise en page à chaque image).
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class Hud
  {
    readonly Interface ui;
    public readonly VisualElement Racine;
    readonly Label secteur, phase, score, gain, recordLibelle, record, objectif, bossLibelle, bossPhase;
    readonly Label bouclierLibelle, fragmentsLibelle, fragments, odLibelle, odTouche, odEtat, odValeur;
    readonly Label comboLibelle, combo, mult, annonce, compte, conseil, odTactileTexte;
    readonly VisualElement progressionPlein, reperes, curseurProgression, boss, bossVie, bossPhases, boucliers;
    readonly VisualElement overdrive, anneauElement, comboBloc, delai, scoreBloc;
    readonly Button pause, odTactile;
    readonly Anneau anneau;
    readonly VisualElement alerte;
    // Le tutoriel
    readonly VisualElement tuto, tutoTouches, tutoTactile, tutoProgres, tutoOk, tutoFin, tutoGauche, tutoDroite, tutoZoneGauche, tutoZoneDroite;
    readonly Label tutoEtape, tutoTitre, tutoConsigne, tutoFinTitre, tutoFinSous, passerTexte;
    readonly Button passer;
    readonly List<VisualElement> pas = new List<VisualElement>();

    readonly List<VisualElement> boucliersEls = new List<VisualElement>();
    double scoreAffiche;
    long scoreEcrit = -1;
    double recordPartie;
    bool recordAnnonce;
    float tempsAnnonce = -1, tempsGain = -1, tempsConseil = -1, tempsCompte = -1, tempsGagne = -1;
    string etatOd = "";
    int multEcrit = -1, comboEcrit = -1, fragmentsEcrits = -1, boucliersEcrits = -1;
    string objectifEcrit = "";

    public Hud(Interface ui, VisualElement racine)
    {
      this.ui = ui;
      Racine = racine;
      Label L(string nom) => Interface.Trouver<Label>(racine, nom);
      VisualElement E(string nom) => Interface.Trouver<VisualElement>(racine, nom);
      secteur = L("hud-secteur");
      phase = L("hud-phase");
      scoreBloc = E("hud-score-bloc");
      score = L("hud-score");
      gain = L("hud-gain");
      recordLibelle = L("hud-record-libelle");
      record = L("hud-record");
      progressionPlein = E("hud-progression-plein");
      reperes = E("hud-reperes");
      curseurProgression = E("hud-curseur");
      objectif = L("hud-objectif");
      boss = E("hud-boss");
      bossLibelle = L("hud-boss-libelle");
      bossVie = E("hud-boss-vie");
      bossPhases = E("hud-boss-phases");
      bossPhase = L("hud-boss-phase");
      bouclierLibelle = L("hud-boucliers-libelle");
      boucliers = E("hud-boucliers");
      fragmentsLibelle = L("hud-fragments-libelle");
      fragments = L("hud-fragments");
      pause = Interface.Trouver<Button>(racine, "hud-pause");
      overdrive = E("hud-overdrive");
      anneauElement = E("hud-anneau");
      odValeur = L("hud-od-valeur");
      odLibelle = L("hud-od-libelle");
      odTouche = L("hud-od-touche");
      odEtat = L("hud-od-etat");
      comboBloc = E("hud-combo");
      mult = L("hud-mult");
      comboLibelle = L("hud-combo-libelle");
      combo = L("hud-combo");
      delai = E("hud-delai");
      odTactile = Interface.Trouver<Button>(racine, "hud-od-tactile");
      odTactileTexte = L("hud-od-tactile-texte");
      annonce = L("annonce");
      compte = L("compte");
      conseil = L("conseil");
      tuto = E("tuto");
      tutoEtape = L("tuto-etape");
      tutoTitre = L("tuto-titre");
      tutoConsigne = L("tuto-consigne");
      tutoTouches = E("tuto-touches");
      tutoGauche = E("tuto-gauche");
      tutoDroite = E("tuto-droite");
      tutoTactile = E("tuto-tactile");
      tutoZoneGauche = E("tuto-zone-gauche");
      tutoZoneDroite = E("tuto-zone-droite");
      tutoProgres = E("tuto-progres");
      tutoOk = E("tuto-ok");
      tutoFin = E("tuto-fin");
      tutoFinTitre = L("tuto-fin-titre");
      tutoFinSous = L("tuto-fin-sous");
      passer = Interface.Trouver<Button>(racine, "tuto-passer");
      passerTexte = L("tuto-passer-texte");
      alerte = Interface.Trouver<VisualElement>(ui.Racine, "alerte");
      foreach (var c in tutoProgres.Children()) pas.Add(c);
      anneau = new Anneau(anneauElement);

      // Rien du HUD n'attrape le pointeur, sauf ses trois boutons (pause, Overdrive tactile, passer le tutoriel).
      racine.Query<VisualElement>().ForEach(el => el.pickingMode = PickingMode.Ignore);
      foreach (var b in new[] { pause, odTactile, passer })
      {
        b.pickingMode = PickingMode.Position;
        b.focusable = b == passer;
      }
      Ui.Clic(pause, ui.Pause);
      Ui.Clic(odTactile, () => Session.Instance?.Overdrive());
      Ui.Clic(passer, () => ui.Tutoriel.Passer());
      Formes.Dessiner(tutoOk, Icone.Coche);
      Ui.Afficher(racine, false);
    }

    public void Afficher(bool visible) => Ui.Afficher(Racine, visible);

    public void Rafraichir()
    {
      Ui.Ecrire(recordLibelle, Textes.Majuscules(Textes.De("hud.record")));
      Ui.Ecrire(bossLibelle, Textes.Majuscules(Textes.De("hud.boss")));
      Ui.Ecrire(bouclierLibelle, Textes.Majuscules(Textes.De("hud.boucliers")));
      Ui.Ecrire(fragmentsLibelle, Textes.Majuscules(Textes.De("hud.fragments")));
      Ui.Ecrire(odLibelle, Textes.Majuscules(Textes.De("hud.overdrive")));
      Ui.Ecrire(comboLibelle, Textes.Majuscules(Textes.De("hud.combo")));
      Ui.Ecrire(odTactileTexte, Textes.Majuscules(Textes.De("hud.overdrive")));
      Ui.Ecrire(passerTexte, Textes.Majuscules(Textes.De("tutoriel.passer")));
      Ui.Ecrire(odTouche, Interface.Tactile ? Textes.De("hud.toucheTactile") : Textes.Majuscules(Textes.De("hud.touche")));
      var p = ui.Partie;
      if (p != null) Secteur(p, ui.Lancement);
      objectifEcrit = "";
      etatOd = "";
    }

    void Secteur(Partie p, Lancement? l)
    {
      string s;
      if (l != null && l.Tutoriel) s = Textes.De("tutoriel.titre");
      else if (p.Mode == Mode.Campagne) s = Textes.Deux(p.NiveauBase.Id) + " · " + Vues.NomNiveau(p.NiveauBase.Id);
      else if (p.Mode == Mode.Infini) s = Textes.De("menu.infini");
      else s = Textes.De("defi.titre");
      Ui.Ecrire(secteur, Textes.Majuscules(s));
    }

    // ==========================================================================
    // UNE NOUVELLE PARTIE
    // ==========================================================================
    public void Commencer(Partie p, Lancement? l)
    {
      bool tutoriel = l != null && l.Tutoriel;
      Secteur(p, l);
      Ui.Afficher(boss, p.Boss != null);
      // Les repères des phases sur la barre d'avancement (pas en survie : elle n'a pas de fin).
      reperes.Clear();
      if (!double.IsInfinity(p.Longueur) && !tutoriel)
      {
        var ph = p.NiveauBase.Phases;
        for (int i = 0; i < ph.Length - 1; i++)
        {
          var r = Ui.Element("hud__repere", reperes);
          r.style.left = Length.Percent((float)(ph[i].Fin * 100));
        }
      }
      bossPhases.Clear();
      if (p.Boss != null)
        for (int k = 1; k < p.Boss.Phases; k++)
        {
          var r = Ui.Element("hud__repere", bossPhases);
          r.style.left = Length.Percent(100f * k / p.Boss.Phases);
        }
      boucliers.Clear();
      boucliersEls.Clear();
      for (int i = 0; i < p.BouclierMax; i++) boucliersEls.Add(Ui.Icone(Icone.Bouclier, "hud__bouclier", boucliers));
      foreach (var el in boucliersEls) el.pickingMode = PickingMode.Ignore;
      recordPartie = Vues.RecordPour(l, p.Graine);
      recordAnnonce = tutoriel;
      Ui.Ecrire(record, recordPartie > 0 ? Textes.Nombre(recordPartie) : "—");
      Racine.RemoveFromClassList("bat-record");
      Racine.EnableInClassList("tutoriel", tutoriel);
      Racine.EnableInClassList("survie", p.Mode == Mode.Infini);
      Racine.EnableInClassList("avec-boss", p.Boss != null);
      Ui.Afficher(odTactile, Interface.Tactile);
      Ui.Afficher(tuto, false);
      Ui.Afficher(tutoFin, false);
      Ui.Afficher(passer, tutoriel);
      Ui.Afficher(annonce, false);
      Ui.Afficher(compte, false);
      Ui.Afficher(conseil, false);
      Ui.Afficher(gain, false);
      tempsAnnonce = tempsGain = tempsConseil = tempsCompte = tempsGagne = -1;
      scoreAffiche = 0;
      scoreEcrit = -1;
      multEcrit = comboEcrit = fragmentsEcrits = boucliersEcrits = -1;
      objectifEcrit = "";
      etatOd = "";
      string theme = Noms.De(p.NiveauBase.Theme);
      foreach (var c in new List<string>(Racine.GetClasses()))
        if (c.StartsWith("theme-", StringComparison.Ordinal)) Racine.RemoveFromClassList(c);
      Racine.AddToClassList("theme-" + theme);
      Rafraichir();
      Image(p, 0);
    }

    /** Le record à battre a peut-être changé (nouvelle vue) : seulement avant d'être battu. */
    public void Record()
    {
      var p = ui.Partie;
      if (p == null || recordAnnonce) return;
      recordPartie = Vues.RecordPour(ui.Lancement, p.Graine);
      Ui.Ecrire(record, recordPartie > 0 ? Textes.Nombre(recordPartie) : "—");
    }

    // ==========================================================================
    // À CHAQUE IMAGE
    // ==========================================================================
    public void Image(Partie p, float dt)
    {
      // Le score monte vers sa valeur (sans jamais la dépasser).
      scoreAffiche = dt <= 0 ? p.Score : scoreAffiche + (p.Score - scoreAffiche) * Math.Min(1, dt * 14);
      if (p.Score - scoreAffiche < 1) scoreAffiche = p.Score;
      long s = (long)Textes.Arrondi(scoreAffiche);
      if (s != scoreEcrit)
      {
        scoreEcrit = s;
        Ui.Ecrire(score, Textes.Nombre(s));
      }
      Ui.Ecrire(phase, p.Scriptee ? "" : Textes.Majuscules(Textes.De($"phases.{Vues.Phase(p.PhaseCourante.Nom)}")));
      // L'avancement (l'entraînement : ses cinq étapes).
      float avance = p.Scriptee ? Mathf.Min(1f, (float)ui.Tutoriel.Phase / 5f) : (float)p.Avancement;
      Ui.Remplir(progressionPlein, avance);
      curseurProgression.style.left = Length.Percent(avance * 100f);
      string o = ObjectifTexte(p);
      if (o != objectifEcrit)
      {
        objectifEcrit = o;
        Ui.Ecrire(objectif, Textes.Majuscules(o));
      }
      if (p.Boss != null)
      {
        Ui.Remplir(bossVie, (float)(p.Boss.Vie / Math.Max(1, p.Boss.Max)));
        Ui.Ecrire(bossPhase, Textes.Majuscules(Textes.Remplir("annonces.phase", "n", p.Boss.Phase.ToString(System.Globalization.CultureInfo.InvariantCulture))));
      }
      if (p.Boucliers != boucliersEcrits)
      {
        boucliersEcrits = p.Boucliers;
        for (int i = 0; i < boucliersEls.Count; i++) boucliersEls[i].EnableInClassList("perdu", i >= p.Boucliers);
        bool danger = p.Boucliers <= 1 && p.BouclierMax > 1 && !p.Scriptee;
        Racine.EnableInClassList("danger", danger);
        alerte.EnableInClassList("danger", danger);
      }
      if (p.Fragments != fragmentsEcrits)
      {
        fragmentsEcrits = p.Fragments;
        Ui.Ecrire(fragments, p.Fragments.ToString(System.Globalization.CultureInfo.InvariantCulture));
      }
      Overdrive(p);
      int m = p.Multiplicateur;
      if (m != multEcrit)
      {
        multEcrit = m;
        Ui.Ecrire(mult, "×" + m.ToString(System.Globalization.CultureInfo.InvariantCulture));
        comboBloc.EnableInClassList("haut", m >= 5);
        comboBloc.EnableInClassList("max", m >= Donnees.ComboMax);
        if (m > 1 && !Interface.Reduit) ui.Impulsion(mult, "monte");
      }
      if (p.Combo != comboEcrit)
      {
        comboEcrit = p.Combo;
        Ui.Ecrire(combo, p.Combo.ToString(System.Globalization.CultureInfo.InvariantCulture));
      }
      Ui.Remplir(delai, (float)p.ComboRestant);
      // Battre son record en pleine partie : un évènement à part entière.
      if (!recordAnnonce && recordPartie > 0 && p.Score > recordPartie)
      {
        recordAnnonce = true;
        Racine.AddToClassList("bat-record");
        Annoncer(Textes.De("annonces.record"), "record");
        Pont.Son("victoire");
      }
      Minuteries(dt);
    }

    string ObjectifTexte(Partie p)
    {
      if (p.Scriptee) return Textes.Remplir("tutoriel.etape", "n", Math.Min(5, (int)Math.Floor(ui.Tutoriel.Phase) + 1).ToString(System.Globalization.CultureInfo.InvariantCulture));
      var o = p.NiveauBase.Objectif;
      if (p.Mode == Mode.Infini) return Textes.Nombre(p.Distance) + " m · " + Textes.Nombre(p.Vitesse * 3.6) + " km/h";
      if (p.Mode == Mode.Defi || o.Type == TypeObjectif.Fin) return Textes.Nombre(p.Distance) + " / " + Textes.Nombre(p.Longueur) + " m";
      if (o.Type == TypeObjectif.Boss) return Vues.ObjectifTexte(o.Type, o.Valeur);
      int mesure = o.Type == TypeObjectif.Fragments ? p.Fragments : o.Type == TypeObjectif.Parfaits ? p.Parfaits : o.Type == TypeObjectif.Portails ? p.Portails : 0;
      return Vues.ObjectifTexte(o.Type, o.Valeur) + " · " + mesure.ToString(System.Globalization.CultureInfo.InvariantCulture) + " / " + Textes.Nombre(o.Valeur);
    }

    /** L'Overdrive rare (V4) : verrouillé au départ, en charge, prêt, actif, puis « utilisé » jusqu'à la fin. */
    void Overdrive(Partie p)
    {
      bool actif = p.Overdrive > 0;
      anneau.Valeur = (float)Math.Min(1, actif ? p.Overdrive / Math.Max(0.001, p.Profil.Overdrive.Duree) : p.Jauge);
      string e = Noms.De(p.EtatOverdrive);
      if (e != etatOd)
      {
        foreach (var c in new[] { "od-verrouille", "od-charge", "od-pret", "od-actif", "od-utilise" }) overdrive.RemoveFromClassList(c);
        overdrive.AddToClassList("od-" + e);
        Racine.EnableInClassList("od-pret", e == "pret");
        Racine.EnableInClassList("en-overdrive", e == "actif");
        alerte.EnableInClassList("overdrive", e == "actif");
        odTactile.EnableInClassList("pret", e == "pret");
        if (e == "pret" && !Interface.Reduit) ui.Impulsion(anneauElement, "nourrie");
        etatOd = e;
      }
      string etat = actif
        ? Textes.Remplir("hud.charges", "n", p.Charges.ToString(System.Globalization.CultureInfo.InvariantCulture))
        : e == "verrouille" ? Textes.Remplir("hud.odVerrouille", "n", Textes.Nombre(p.SeuilOverdrive))
        : e == "utilise" ? Textes.De("hud.odUtilise")
        : e == "charge" ? Textes.De("hud.odCharge") : "";
      Ui.Ecrire(odEtat, Textes.Majuscules(etat));
      Ui.Ecrire(odValeur, actif ? "×" + Textes.Virgule(p.MultOverdrive, 1)
        : e == "charge" || e == "pret" ? Mathf.RoundToInt((float)p.Jauge * 100f).ToString(System.Globalization.CultureInfo.InvariantCulture) + "%"
        : "");
    }

    void Minuteries(float dt)
    {
      if (tempsAnnonce >= 0 && (tempsAnnonce -= dt) < 0) Ui.Afficher(annonce, false);
      if (tempsGain >= 0 && (tempsGain -= dt) < 0) Ui.Afficher(gain, false);
      if (tempsConseil >= 0 && (tempsConseil -= dt) < 0) Ui.Afficher(conseil, false);
      if (tempsCompte >= 0 && (tempsCompte -= dt) < 0) Ui.Afficher(compte, false);
      if (tempsGagne >= 0 && (tempsGagne -= dt) < 0) scoreBloc.RemoveFromClassList("a-gagne");
    }

    // ==========================================================================
    // LES ÉVÈNEMENTS DE LA COURSE
    // ==========================================================================
    public void Evenement(Evenement e, Partie p)
    {
      switch (e.Type)
      {
        case TypeEvenement.Fragment:
        case TypeEvenement.Dore:
          Gagner(e.Valeur);
          if (!Interface.Reduit) ui.Impulsion(anneauElement, "nourrie");
          break;
        case TypeEvenement.Noyau:
        case TypeEvenement.Detruit:
          Gagner(e.Valeur);
          break;
        case TypeEvenement.Parfait:
          Annoncer(Textes.De("annonces.parfait"), "parfait");
          Gagner(e.Valeur);
          break;
        case TypeEvenement.Motif:
          Annoncer(Textes.De("annonces.motif"), "motif");
          Gagner(e.Valeur);
          break;
        case TypeEvenement.Choc:
          if (!p.Scriptee) Annoncer(Textes.De((e.Valeur ?? 0) == 1 ? "annonces.dernier" : "annonces.choc"), "choc");
          if (!Interface.Reduit)
          {
            ui.Impulsion(boucliers, "choc");
            ui.Impulsion(alerte, "choc");
          }
          break;
        case TypeEvenement.ComboPerdu:
          Annoncer(Textes.De("annonces.comboPerdu"), "choc");
          break;
        case TypeEvenement.Portail:
          Annoncer(Textes.De("annonces.portail"), "portail");
          break;
        case TypeEvenement.Overdrive:
          Annoncer(Textes.Remplir("annonces.overdrive", "n", Textes.Virgule(e.Valeur ?? 2, 1)), "overdrive");
          break;
        case TypeEvenement.OdOuvert:
          Annoncer(Textes.De("annonces.odOuvert"), "pret");
          break;
        case TypeEvenement.Pret:
          Annoncer(Textes.De("annonces.pret"), "pret");
          break;
        case TypeEvenement.PhaseBoss:
          Annoncer(Textes.Remplir("annonces.phase", "n", ((int)(e.Valeur ?? 1)).ToString(System.Globalization.CultureInfo.InvariantCulture)), "phase");
          break;
        case TypeEvenement.Phase:
          int i = (int)(e.Valeur ?? 0);
          var phases = p.NiveauBase.Phases;
          if (i > 0 && i < phases.Length) Annoncer(Textes.De($"phases.{Vues.Phase(phases[i].Nom)}"), "phase");
          break;
        case TypeEvenement.Conseil:
          Conseil((int)(e.Valeur ?? 0));
          break;
      }
    }

    public void Annoncer(string texte, string genre)
    {
      Ui.Ecrire(annonce, Textes.Majuscules(texte));
      foreach (var c in new List<string>(annonce.GetClasses()))
        if (c.StartsWith("annonce--", StringComparison.Ordinal)) annonce.RemoveFromClassList(c);
      annonce.AddToClassList("annonce--" + genre);
      Ui.Afficher(annonce, true);
      if (!Interface.Reduit) ui.Impulsion(annonce, "entree");
      tempsAnnonce = genre == "record" ? 1.8f : 1.15f;
    }

    void Gagner(double? points)
    {
      if (points == null || points.Value <= 0) return;
      Ui.Ecrire(gain, "+" + Textes.Nombre(points.Value));
      Ui.Afficher(gain, true);
      if (!Interface.Reduit) ui.Impulsion(gain, "entree");
      tempsGain = 0.7f;
      scoreBloc.AddToClassList("a-gagne");
      tempsGagne = 0.16f;
    }

    /** Le compte à rebours : 3, 2, 1, puis « Go ». */
    public void Compte(int n)
    {
      Ui.Ecrire(compte, n > 0 ? n.ToString(System.Globalization.CultureInfo.InvariantCulture) : Textes.Majuscules(Textes.De("annonces.depart")));
      compte.EnableInClassList("depart", n <= 0);
      Ui.Afficher(compte, true);
      if (!Interface.Reduit) ui.Impulsion(compte, "entree");
      tempsCompte = n > 0 ? 0.5f : 0.7f;
    }

    /** Un conseil du secteur 01 (si l'aide aux commandes est active). */
    void Conseil(int n)
    {
      var r = Pont.Vue.reglages;
      if (r != null && !r.aideCommandes) return;
      string liste = Interface.Tactile ? "conseils.tactile" : "conseils.clavier";
      if (n < 0 || n >= Textes.Taille(liste)) return;
      Ui.Ecrire(conseil, Textes.De($"{liste}.{n}"));
      Ui.Afficher(conseil, true);
      if (!Interface.Reduit) ui.Impulsion(conseil, "entree");
      tempsConseil = 4.2f;
    }

    // ==========================================================================
    // L'ENTRAÎNEMENT (Tutoriel.cs) : sa consigne, ses touches, son avancée
    // ==========================================================================
    public void TutoAfficher(int phaseTuto, string titre, string consigne, bool gauche, bool droite, string message, string genre, bool etapeFaite)
    {
      Ui.Afficher(tuto, true);
      Ui.Afficher(tutoFin, false);
      Ui.Afficher(passer, true);
      Ui.Ecrire(tutoEtape, Textes.Majuscules(Textes.Remplir("tutoriel.etape", "n", (phaseTuto + 1).ToString(System.Globalization.CultureInfo.InvariantCulture))));
      Ui.Ecrire(tutoTitre, Textes.Majuscules(titre));
      Ui.Ecrire(tutoConsigne, consigne);
      bool touches = gauche || droite;
      tuto.EnableInClassList("sans-touches", !touches);
      tutoGauche.EnableInClassList("attendue", gauche);
      tutoDroite.EnableInClassList("attendue", droite);
      tutoZoneGauche.EnableInClassList("attendue", gauche);
      tutoZoneDroite.EnableInClassList("attendue", droite);
      Ui.Afficher(tutoTouches, touches && !Interface.Tactile);
      Ui.Afficher(tutoTactile, touches && Interface.Tactile);
      for (int k = 0; k < pas.Count; k++)
      {
        pas[k].EnableInClassList("fait", k < phaseTuto || (k == phaseTuto && etapeFaite));
        pas[k].EnableInClassList("actif", k == phaseTuto);
      }
      tutoOk.RemoveFromClassList("rate");
      tutoOk.RemoveFromClassList("info");
      if (message.Length > 0)
      {
        Formes.Dessiner(tutoOk, genre == "rate" ? Icone.Recommencer : Icone.Coche);
        tutoOk.EnableInClassList("rate", genre == "rate");
        Ui.Afficher(tutoOk, true);
        if (!Interface.Reduit) ui.Impulsion(tutoOk, "entree");
      }
      else Ui.Afficher(tutoOk, false);
      tuto.EnableInClassList("info", genre == "info");
      tuto.EnableInClassList("rate", genre == "rate");
      tuto.EnableInClassList("ok", genre == "ok");
    }

    /** La courte finale : le texte de fin au centre (le menu s'ouvre ensuite). */
    public void TutoFinale(string titre, string sous)
    {
      Ui.Afficher(tuto, false);
      Ui.Afficher(passer, false);
      Ui.Ecrire(tutoFinTitre, titre);
      Ui.Ecrire(tutoFinSous, sous);
      Ui.Afficher(tutoFin, true);
      if (!Interface.Reduit) ui.Impulsion(tutoFin, "entree");
    }

    public void TutoRanger()
    {
      Ui.Afficher(tuto, false);
      Ui.Afficher(tutoFin, false);
      Ui.Afficher(passer, false);
    }

    /** Tab pendant l'entraînement : le bouton « Passer le tutoriel » (puis Entrée). */
    public void FocaliserPasser()
    {
      if (Ui.Affiche(passer)) passer.Focus();
    }
  }
}
