// PORTAL RUSH (Unity) — LE PANNEAU DES RÉGLAGES (par-dessus l'écran en cours, sans rien relancer)
//
// Les trois pages du jeu web, avec tous les champs des réglages (contrat §5.5) :
//   Audio      volume des effets, effets sonores (réglage du site), RUSH RADIO à l'entrée, volume de la musique,
//              musique coupée ;
//   Affichage  animations (réglage du site), effets réduits, secousses, qualité graphique (Auto, Élevée,
//              Équilibrée, Économie ; ce qui est appliqué en ce moment), séquence de fin de secteur ;
//   Commandes  aide pendant la course, commandes tactiles, et l'aide clavier (touches du contrat §5.1, puis les
//              explications du jeu web).
// Chaque changement part vers la page (Pont.Reglages, objet complet) qui l'enregistre et renvoie la vue ; la qualité
// est appliquée tout de suite (Qualite.Appliquer). En pause, la partie reste en pause à la fermeture.
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Jeu;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class PanneauReglages
  {
    readonly Interface ui;
    public readonly VisualElement Fond;
    public readonly VisualElement Zone;
    readonly Label titre;
    readonly Button fermer;
    readonly Onglets onglets;
    readonly Dictionary<string, VisualElement> pages = new Dictionary<string, VisualElement>();
    readonly Curseur volume, volumeMusique;
    readonly Interrupteur sons, musique, muet, effetsReduits, secousses, aide;
    readonly Choix animations, qualite, sequenceFin, tactile;
    readonly Label qualiteEffective, touchesTitre, lignesTitre;
    readonly VisualElement touches, lignes;
    VisualElement? retour;
    float prochainEnvoi;
    Reglages? enAttente;

    public PanneauReglages(Interface ui, VisualElement fond)
    {
      this.ui = ui;
      Fond = fond;
      Zone = Interface.Trouver<VisualElement>(fond, "reglages-panneau");
      titre = Interface.Trouver<Label>(fond, "reglages-titre");
      fermer = Interface.Trouver<Button>(fond, "reglages-fermer");
      Ui.Clic(fermer, () => Fermer(true));
      onglets = new Onglets(Interface.Trouver<VisualElement>(fond, "reglages-onglets"), "audio", "affichage", "commandes");
      onglets.Racine.AddToClassList("lateral");
      onglets.Change += Page;
      var hote = Interface.Trouver<VisualElement>(fond, "reglages-pages");

      // ---- Audio ----
      var audio = Ui.Defilement("panneau__page", hote);
      pages["audio"] = audio;
      volume = new Curseur(audio, 0.05f);
      volume.Change += v => Changer(r => r.volume = Math.Round(v, 2), false);
      volume.Fini += v => Changer(r => r.volume = Math.Round(v, 2), true);
      sons = new Interrupteur(audio);
      sons.Change += v => Changer(r => r.sons = v, true);
      musique = new Interrupteur(audio);
      musique.Change += v => Changer(r => r.musique = v, true);
      volumeMusique = new Curseur(audio, 0.01f);
      volumeMusique.Change += v => Changer(r => r.volumeMusique = Math.Round(v, 2), false);
      volumeMusique.Fini += v => Changer(r => r.volumeMusique = Math.Round(v, 2), true);
      muet = new Interrupteur(audio);
      muet.Change += v => Changer(r => r.muet = v, true);

      // ---- Affichage ----
      var affichage = Ui.Defilement("panneau__page", hote);
      pages["affichage"] = affichage;
      animations = new Choix(affichage, "1", "0.5", "0");
      animations.Change += v => Changer(r => r.animations = v == "1" ? 1 : v == "0.5" ? 0.5 : 0, true);
      effetsReduits = new Interrupteur(affichage);
      effetsReduits.Change += v => Changer(r => r.effetsReduits = v, true);
      secousses = new Interrupteur(affichage);
      secousses.Change += v => Changer(r => r.secousses = v, true);
      qualite = new Choix(affichage, "auto", "elevee", "equilibree", "economie");
      qualite.Racine.AddToClassList("choix--quatre");
      qualite.Change += v => Changer(r => r.qualite = v, true);
      qualiteEffective = Ui.Etiquette("", "option__effectif", qualite.Racine);
      sequenceFin = new Choix(affichage, "complete", "courte");
      sequenceFin.Change += v => Changer(r => r.sequenceFin = v, true);

      // ---- Commandes ----
      var commandes = Ui.Defilement("panneau__page", hote);
      pages["commandes"] = commandes;
      aide = new Interrupteur(commandes);
      aide.Change += v => Changer(r => r.aideCommandes = v, true);
      tactile = new Choix(commandes, "toucher", "glisser");
      tactile.Change += v => Changer(r => r.tactile = v, true);
      touchesTitre = Ui.Etiquette("", "panneau__sous-titre", commandes);
      touches = Ui.Element("touches", commandes);
      lignesTitre = Ui.Etiquette("", "panneau__sous-titre", commandes);
      lignes = Ui.Element("commandes", commandes);

      foreach (var c in new[] { animations, qualite, sequenceFin, tactile })
      {
        // Les segments : ← → choisissent (comme les cases à choix du jeu web).
        var s = c.Racine.Q<VisualElement>(className: "segments");
        s?.AddToClassList("lateral");
      }
      fond.pickingMode = PickingMode.Position;
      // Un clic sur le fond (hors du panneau) le ferme.
      fond.RegisterCallback<PointerDownEvent>(e =>
      {
        if (e.target == fond) Fermer(true);
      });
      Ui.Afficher(fond, false);
    }

    public bool Ouvert => Ui.Affiche(Fond);

    public void Ouvrir(string onglet)
    {
      retour = ui.FocusCourant as VisualElement;
      Ui.Afficher(Fond, true);
      if (!Interface.Reduit) ui.Impulsion(Zone, "entree");
      ui.Barre.FermerLangues(false);
      Rafraichir();
      onglets.Choisir(onglet, false);
      Page(onglet);
      ui.Focaliser(onglets.Bouton);
      ui.Classes();
      ui.EnvoyerEcran();
    }

    public void Fermer(bool rendreFocus)
    {
      if (!Ouvert) return;
      Envoyer(true);
      Ui.Afficher(Fond, false);
      ui.Classes();
      ui.EnvoyerEcran();
      if (!rendreFocus) return;
      // (En pause, la partie reste en pause : seule une action explicite la reprend.)
      var cible = retour != null && retour.panel != null && Navigation.Visible(retour) ? retour : ui.Courant?.PremierFocus;
      if (cible != null) ui.Focaliser(cible);
    }

    void Page(string nom)
    {
      foreach (var p in pages) Ui.Afficher(p.Value, p.Key == nom);
    }

    /** Un réglage change : une copie complète des réglages part vers la page (au plus 8 fois par seconde en glissant). */
    void Changer(Action<Reglages> modifier, bool tout)
    {
      var r = (enAttente ?? Pont.Vue.reglages).Copie();
      modifier(r);
      enAttente = r;
      // La qualité et les effets réduits s'appliquent tout de suite (la vue suivra).
      if (r.qualite != Qualite.Mode || r.effetsReduits != Qualite.EffetsReduits) Qualite.Appliquer(r.qualite, r.effetsReduits);
      Envoyer(tout);
    }

    void Envoyer(bool maintenant)
    {
      if (enAttente == null) return;
      if (!maintenant && Time.unscaledTime < prochainEnvoi) return;
      prochainEnvoi = Time.unscaledTime + 0.12f;
      var r = enAttente;
      enAttente = null;
      Pont.Reglages(r);
    }

    public void Rafraichir()
    {
      var r = enAttente ?? Pont.Vue.reglages;
      Ui.Ecrire(titre, Textes.De("reglages.titre"));
      foreach (var o in new[] { "audio", "affichage", "commandes" }) onglets.Libelle(o, Textes.De($"reglages.onglets.{o}"));

      volume.Libelle(Textes.De("reglages.effets"));
      volume.Valeur = (float)r.volume;
      sons.Libelles(Textes.De("reglages.sons"), Textes.De("reglages.sonsTexte"));
      sons.Valeur = r.sons;
      musique.Libelles(Textes.De("reglages.musique"), Textes.De("reglages.partage"));
      musique.Valeur = r.musique;
      volumeMusique.Libelle(Textes.De("reglages.volumeMusique"));
      volumeMusique.Valeur = (float)r.volumeMusique;
      muet.Libelles(Textes.De("site.radio.muet"));
      muet.Valeur = r.muet;

      animations.Libelles(Textes.De("reglages.animations"), Textes.De("reglages.animationsTexte"));
      animations.Option("1", Textes.De("reglages.animationsChoix.complet"));
      animations.Option("0.5", Textes.De("reglages.animationsChoix.allege"));
      animations.Option("0", Textes.De("reglages.animationsChoix.coupe"));
      animations.Valeur = r.animations >= 1 ? "1" : r.animations > 0 ? "0.5" : "0";
      effetsReduits.Libelles(Textes.De("reglages.effetsReduits"), Textes.De("reglages.effetsReduitsTexte"));
      effetsReduits.Valeur = r.effetsReduits;
      secousses.Libelles(Textes.De("reglages.secousses"));
      secousses.Valeur = r.secousses;
      qualite.Libelles(Textes.De("reglages.qualite"), Textes.De("reglages.qualiteTexte"));
      foreach (var q in new[] { "auto", "elevee", "equilibree", "economie" }) qualite.Option(q, Textes.De($"reglages.qualiteChoix.{q}"));
      qualite.Valeur = string.IsNullOrEmpty(r.qualite) ? "auto" : r.qualite;
      Ui.Ecrire(qualiteEffective, Textes.Majuscules(Textes.Remplir("ui.reglages.qualiteEffective", "q", Textes.De($"reglages.qualiteChoix.{Qualite.Effectif}"))));
      sequenceFin.Libelles(Textes.De("reglages.sequenceFin"), Textes.De("reglages.sequenceFinTexte"));
      sequenceFin.Option("complete", Textes.De("reglages.sequenceChoix.complete"));
      sequenceFin.Option("courte", Textes.De("reglages.sequenceChoix.courte"));
      sequenceFin.Valeur = r.sequenceFin == "courte" ? "courte" : "complete";

      aide.Libelles(Textes.De("reglages.aide"));
      aide.Valeur = r.aideCommandes;
      tactile.Libelles(Textes.De("reglages.tactile"));
      tactile.Option("toucher", Textes.De("reglages.toucher"));
      tactile.Option("glisser", Textes.De("reglages.glisser"));
      tactile.Valeur = r.tactile == "glisser" ? "glisser" : "toucher";
      Touches();
    }

    /** L'aide clavier : les touches du jeu (contrat §5.1), puis les explications du jeu web. */
    void Touches()
    {
      Ui.Ecrire(touchesTitre, Textes.Majuscules(Textes.De("ui.touches.titre")));
      touches.Clear();
      void Ligne(string cle, params string[] cles)
      {
        var l = Ui.Element("touches__ligne", touches);
        var c = Ui.Element("touches__cles", l);
        foreach (var k in cles) Ui.Touche(k, "", c);
        Ui.Texte(Textes.De(cle), "touches__texte", l);
      }
      string entree = Textes.De("barre.entree"), espace = Textes.De("barre.espace");
      Ligne("ui.touches.voie", "←", "→", "A", "D", "Q");
      Ligne("ui.touches.overdrive", espace, "↑", "W", "Z");
      Ligne("ui.touches.pause", "Esc", "P");
      Ligne("ui.touches.recommencer", "R");
      Ligne("ui.touches.naviguer", "↑", "↓", "←", "→", "Tab");
      Ligne("ui.touches.valider", entree, espace);
      Ligne("ui.touches.retour", "Esc");
      Ligne("ui.touches.passer", entree, espace, "Esc");
      Ui.Ecrire(lignesTitre, Textes.Majuscules(Textes.De("commandes.titre")));
      lignes.Clear();
      int n = Textes.Taille("commandes.lignes");
      for (int i = 0; i < n; i++)
      {
        var l = Ui.Element("commandes__ligne", lignes);
        Ui.Element("commandes__puce", l);
        Ui.Texte(Textes.De($"commandes.lignes.{i}"), "commandes__texte", l);
      }
    }
  }
}
