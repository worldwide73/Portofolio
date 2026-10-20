// PORTAL RUSH (Unity) — LA BARRE DU HAUT
//
// Comme dans le jeu web : à gauche, la touche Échap (cliquable) et ce qu'elle fera (Quitter, Retour, Pause…), puis
// le module où l'on est ; à droite, la langue (FR / EN, une petite liste), les records et l'engrenage des réglages,
// avec une infobulle (souris après un court délai, ou clavier). En course, seule la touche Échap reste ;
// en pause, pas de records.
#nullable enable
using System;
using PortalRush.Jeu;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  public sealed class Barre
  {
    readonly Interface ui;
    public readonly VisualElement Racine;
    readonly Button echap, langue, records, reglages, fr, en;
    readonly Label effet, module, code, languesTitre, frNom, enNom;
    readonly VisualElement liste, droite, moduleBloc;
    readonly Label info;
    VisualElement? cibleInfo;
    Func<string>? texteInfo;
    float delaiInfo = -1;

    public Barre(Interface ui, VisualElement racine)
    {
      this.ui = ui;
      Racine = racine;
      echap = Interface.Trouver<Button>(racine, "echap");
      effet = Interface.Trouver<Label>(racine, "echap-effet");
      moduleBloc = Interface.Trouver<VisualElement>(racine, "module");
      module = Interface.Trouver<Label>(racine, "module-texte");
      droite = Interface.Trouver<VisualElement>(racine, "barre-droite");
      langue = Interface.Trouver<Button>(racine, "btn-langue");
      code = Interface.Trouver<Label>(racine, "langue-code");
      liste = Interface.Trouver<VisualElement>(racine, "langues");
      languesTitre = Interface.Trouver<Label>(racine, "langues-titre");
      fr = Interface.Trouver<Button>(racine, "langue-fr");
      en = Interface.Trouver<Button>(racine, "langue-en");
      frNom = Interface.Trouver<Label>(racine, "langue-fr-nom");
      enNom = Interface.Trouver<Label>(racine, "langue-en-nom");
      records = Interface.Trouver<Button>(racine, "btn-records");
      reglages = Interface.Trouver<Button>(racine, "btn-reglages");
      info = Interface.Trouver<Label>(ui.Racine, "info");
      info.pickingMode = PickingMode.Ignore;
      Ui.Afficher(liste, false);
      Ui.Afficher(info, false);

      Ui.Clic(echap, ui.Echap);
      Ui.Clic(langue, () =>
      {
        if (LanguesOuvertes) FermerLangues(true);
        else OuvrirLangues();
      });
      Ui.Clic(fr, () => Choisir("fr"));
      Ui.Clic(en, () => Choisir("en"));
      Ui.Clic(records, () =>
      {
        if (ui.Partie != null) return;
        ui.EcranRecords.Onglet("resume");
        ui.Montrer(ui.EcranRecords);
      });
      Ui.Clic(reglages, () =>
      {
        if (ui.Reglages.Ouvert) ui.Reglages.Fermer(true);
        else ui.Reglages.Ouvrir("audio");
      });
      Infobulle(langue, () => Textes.De("barre.langue"));
      Infobulle(records, () => Textes.De("menu.records"));
      Infobulle(reglages, () => Textes.De("menu.reglages"));
    }

    public bool LanguesOuvertes => Ui.Affiche(liste);
    public VisualElement ZoneLangues => liste;

    public void Rafraichir()
    {
      Ui.Ecrire(code, Pont.Langue == "en" ? "EN" : "FR");
      Ui.Ecrire(languesTitre, Textes.Majuscules(Textes.De("barre.langue")));
      Ui.Ecrire(frNom, Textes.De("barre.langues.fr"));
      Ui.Ecrire(enNom, Textes.De("barre.langues.en"));
      fr.EnableInClassList("actif", Pont.Langue != "en");
      en.EnableInClassList("actif", Pont.Langue == "en");
      Maj();
    }

    /** Ce que dit la barre : l'effet d'Échap, le module ; ce qu'elle montre selon l'état. */
    public void Maj()
    {
      Ui.Ecrire(effet, Textes.Majuscules(ui.EffetEchap()));
      string m = ui.Reglages.Ouvert ? Textes.De("reglages.titre")
        : ui.Courant != null ? ui.Courant.Module
        : ui.Partie != null ? Textes.De("barre.course") : Textes.De("barre.principal");
      Ui.Ecrire(module, Textes.Majuscules(m));
      bool course = ui.Partie != null && ui.Courant == null;
      Ui.Afficher(droite, !course);
      Ui.Afficher(moduleBloc, !course);
      Ui.Afficher(records, ui.Partie == null);
    }

    /** La touche Échap s'enfonce brièvement quand on l'appuie au clavier. */
    public void Presser() => ui.Impulsion(echap, "pressee");

    void OuvrirLangues()
    {
      Ui.Afficher(liste, true);
      MasquerInfo();
      langue.AddToClassList("ouvert");
      ui.Focaliser(Pont.Langue == "en" ? fr : en);
      Maj();
    }

    public void FermerLangues(bool focus)
    {
      if (!LanguesOuvertes) return;
      Ui.Afficher(liste, false);
      langue.RemoveFromClassList("ouvert");
      if (focus) langue.Focus();
      Maj();
    }

    void Choisir(string l)
    {
      FermerLangues(true);
      if (l != Pont.Langue) Pont.ChangerLangue(l);
    }

    // ---- L'infobulle des icônes ----
    void Infobulle(VisualElement el, Func<string> texte)
    {
      el.RegisterCallback<PointerEnterEvent>(e =>
      {
        if (e.pointerType != "mouse") return;
        cibleInfo = el;
        texteInfo = texte;
        delaiInfo = 0.32f;
      });
      el.RegisterCallback<PointerLeaveEvent>(_ => MasquerInfo());
      el.RegisterCallback<FocusEvent>(_ =>
      {
        if (!ui.Racine.ClassListContains("clavier")) return;
        cibleInfo = el;
        texteInfo = texte;
        delaiInfo = 0f;
      });
      el.RegisterCallback<BlurEvent>(_ => MasquerInfo());
    }

    void MasquerInfo()
    {
      delaiInfo = -1;
      cibleInfo = null;
      Ui.Afficher(info, false);
    }

    public void Image(float dt)
    {
      if (delaiInfo < 0 || cibleInfo == null || texteInfo == null) return;
      delaiInfo -= dt;
      if (delaiInfo > 0) return;
      delaiInfo = -1;
      if (LanguesOuvertes) return;
      Ui.Ecrire(info, texteInfo());
      Ui.Afficher(info, true);
      // Sous l'icône, sans sortir de l'écran (la largeur est connue à l'image suivante : on centre au mieux).
      Rect b = cibleInfo.worldBound;
      Vector2 haut = ui.Racine.WorldToLocal(new Vector2(b.center.x, b.yMax + 8));
      float largeur = float.IsNaN(info.layout.width) || info.layout.width <= 0 ? 120 : info.layout.width;
      float max = ui.Racine.layout.width - largeur - 12;
      info.style.left = Mathf.Max(12, Mathf.Min(max, haut.x - largeur * 0.5f));
      info.style.top = haut.y;
    }
  }
}
