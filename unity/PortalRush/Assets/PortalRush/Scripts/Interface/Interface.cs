// PORTAL RUSH (Unity) — L'INTERFACE (UI Toolkit)
//
// Le composant de l'objet « Interface » (avec son UIDocument : Interface.uxml, thème PortalRush.tss). Il tient tous
// les écrans et le HUD, comme rush.ts dans le jeu web : un seul écran à la fois (ou aucun pendant la course), le
// panneau des réglages et les fenêtres de confirmation par-dessus, la barre du haut (Échap dit ce qu'il fera).
//
// L'ARRIVÉE : à la config de la page, la sortie du tunnel (Intro) si elle est demandée, puis le tutoriel au premier
// lancement, sinon le menu (ou l'écran demandé : réglages, commandes…). Sans page (éditeur), le Pont simule la config.
//
// LES TOUCHES (contrat §5.1 ; la course elle-même est lue par Session) :
//   Échap        ferme la liste ouverte, la fenêtre, le panneau ; met en pause ; reprend ; revient en arrière ;
//                depuis le menu principal, ferme le jeu (Pont.Fermer) ; passe la séquence de fin
//   ↑ ↓ ← →      d'une commande à la voisine (dans la fenêtre ouverte seulement) ; sur un curseur, ← → le règlent ;
//                sur des onglets ou des segments, ← → choisissent ; Tab / Maj+Tab : la suivante, la précédente
//   Entrée, Espace  la commande qui a le focus, sinon l'action principale de l'écran ; jamais deux fois par appui
//   R            recommencer (après une partie ; en pause, avec confirmation)
// La souris et le toucher passent par les boutons (UI Toolkit). Pendant la course, aucune commande n'a le focus :
// les flèches pilotent le vaisseau et ne bougent rien dans l'interface.
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;
using UnityEngine;
using UnityEngine.UIElements;

namespace PortalRush.Interface
{
  [RequireComponent(typeof(UIDocument))]
  [DefaultExecutionOrder(50)]
  public sealed class Interface : MonoBehaviour
  {
    public static Interface? Instance { get; private set; }

    [Tooltip("Utilisé si l'UIDocument n'a pas encore de document (Interface.uxml).")]
    public VisualTreeAsset? modele;

    UIDocument? document;
    VisualElement? racineDocument;
    VisualElement? arbreEcoute;
    bool erreurSignalee;

    public VisualElement Racine { get; private set; } = new VisualElement();
    public bool Construite { get; private set; }

    // ---- Les parties ----
    public Barre Barre { get; private set; } = null!;
    public Hud Hud { get; private set; } = null!;
    public EcranMenu EcranMenu { get; private set; } = null!;
    public EcranModes EcranModes { get; private set; } = null!;
    public EcranCampagne EcranCampagne { get; private set; } = null!;
    public EcranDifficultes EcranDifficultes { get; private set; } = null!;
    public EcranDefi EcranDefi { get; private set; } = null!;
    public EcranGarage EcranGarage { get; private set; } = null!;
    public EcranRecords EcranRecords { get; private set; } = null!;
    public EcranPause EcranPause { get; private set; } = null!;
    public EcranResultat EcranResultat { get; private set; } = null!;
    public PanneauReglages Reglages { get; private set; } = null!;
    public Confirmation Confirmation { get; private set; } = null!;
    public Tutoriel Tutoriel { get; private set; } = null!;
    VisualElement voile = new VisualElement();
    VisualElement cine = new VisualElement();
    Label cineTitre = new Label(), cineSous = new Label();
    VisualElement fondu = new VisualElement();
    Label cadreCode = new Label();

    // ---- L'état ----
    public Ecran? Courant { get; private set; }
    /** La difficulté choisie dans les menus (la page la garde aussi : Pont.ChoisirDifficulte). */
    public string Difficulte { get; private set; } = "as";
    /** Le secteur regardé dans la campagne. */
    public int Secteur { get; set; } = 1;
    Session? session;
    Config? config;
    bool configATraiter;
    bool arrivee;
    bool enIntro;
    float sansConfig;
    float cine1 = -1;
    string dernierEcranPont = "";
    readonly HashSet<KeyCode> tenues = new HashSet<KeyCode>();
    int cadreActivation = -10, cadreEchap = -10;
    VisualElement? focusEnAttente;
    int cadreFocus;
    readonly List<(VisualElement El, string Classe, int Cadre)> classesARetirer = new List<(VisualElement, string, int)>();

    public Partie? Partie => Session.Instance != null ? Session.Instance.Partie : null;
    public Lancement? Lancement => Session.Instance != null ? Session.Instance.Lancement : null;
    public bool EnPartie => Partie != null;
    public bool EnTutoriel => Lancement != null && Lancement.Tutoriel && Partie != null;
    /** La course est à l'écran (aucun écran, pas de séquence de fin). */
    public bool EnCourse => Partie != null && Courant == null && cine1 < 0 && !enIntro;
    public bool EnCinematique => cine1 >= 0;

    /** Animations coupées : mouvement réduit du système, animations du site coupées, ou effets réduits du jeu. */
    public static bool Reduit
    {
      get
      {
        var r = Pont.Vue != null ? Pont.Vue.reglages : null;
        var a = Pont.Config != null ? Pont.Config.appareil : null;
        return (r != null && (r.effetsReduits || r.animations <= 0)) || (a != null && (a.mouvementReduit || a.animations <= 0));
      }
    }

    public static bool Tactile
    {
      get
      {
        var a = Pont.Config != null ? Pont.Config.appareil : null;
        return (a != null && a.mobile) || Application.isMobilePlatform;
      }
    }

    // ==========================================================================
    // LA VIE DU COMPOSANT
    // ==========================================================================
    void Awake()
    {
      Instance = this;
      document = GetComponent<UIDocument>();
    }

    void OnEnable()
    {
      Pont.ConfigRecue += QuandConfig;
      Pont.VueChangee += QuandVue;
      Pont.BilanRecu += QuandBilan;
      Pont.LangueChangee += QuandLangue;
      Pont.RadioChangee += QuandRadio;
      Pont.PauseDemandee += QuandPauseDemandee;
      Pont.FermetureDemandee += QuandFermeture;
      Intro.Terminee += QuandIntroTerminee;
      Qualite.Changee += QuandQualite;
      Session.SurInterface = SurInterface;
    }

    void OnDisable()
    {
      Pont.ConfigRecue -= QuandConfig;
      Pont.VueChangee -= QuandVue;
      Pont.BilanRecu -= QuandBilan;
      Pont.LangueChangee -= QuandLangue;
      Pont.RadioChangee -= QuandRadio;
      Pont.PauseDemandee -= QuandPauseDemandee;
      Pont.FermetureDemandee -= QuandFermeture;
      Intro.Terminee -= QuandIntroTerminee;
      Qualite.Changee -= QuandQualite;
      if (Session.SurInterface == (Func<Vector2, bool>)SurInterface) Session.SurInterface = null;
      Desabonner();
      Oublier();
    }

    void OnDestroy()
    {
      if (Instance == this) Instance = null;
    }

    void Update()
    {
      if (document == null) return;
      if (document.visualTreeAsset == null && modele != null) document.visualTreeAsset = modele;
      if (document.rootVisualElement != racineDocument || (Construite && Racine.panel == null && document.rootVisualElement?.panel != null)) Construire();
      Abonner();
      if (!Construite) return;
      if (Racine.panel != null) Ecouter(Racine.panel);
      // La config arrive par l'évènement ; si elle était là avant nous, on la prend ici.
      if (config == null && Pont.Config != null) QuandConfig(Pont.Config);
      if (configATraiter) TraiterConfig();
      if (!arrivee && config == null)
      {
        sansConfig += Time.unscaledDeltaTime;
        // (Sans page ni simulation : le menu, après un court délai.)
        if (sansConfig > 1.5f) QuandConfig(new Config { vue = Pont.Vue, langue = Pont.Langue, intro = false, tutorielAFaire = false });
      }
    }

    void OnApplicationFocus(bool focus)
    {
      if (!focus) tenues.Clear();
    }

    void LateUpdate()
    {
      if (!Construite) return;
      float dt = Mathf.Min(0.1f, Time.unscaledDeltaTime);
      // Les focus et classes demandés pour l'image suivante (une fois la mise en page faite).
      if (focusEnAttente != null && Time.frameCount >= cadreFocus)
      {
        var f = focusEnAttente;
        focusEnAttente = null;
        if (f.canGrabFocus) f.Focus();
      }
      for (int i = classesARetirer.Count - 1; i >= 0; i--)
        if (Time.frameCount >= classesARetirer[i].Cadre)
        {
          classesARetirer[i].El.RemoveFromClassList(classesARetirer[i].Classe);
          classesARetirer.RemoveAt(i);
        }
      var p = Partie;
      if (p != null) Hud.Image(p, dt);
      if (Tutoriel.Actif) Tutoriel.Tic(dt);
      if (cine1 >= 0)
      {
        cine1 -= dt;
        if (cine1 < 0) FinCinematique();
      }
      Courant?.Image(dt);
      Barre.Image(dt);
    }

    // ==========================================================================
    // LA CONSTRUCTION (à chaque nouvel arbre de l'UIDocument)
    // ==========================================================================
    void Construire()
    {
      racineDocument = document != null ? document.rootVisualElement : null;
      Construite = false;
      var r = racineDocument?.Q<VisualElement>("interface");
      if (r == null)
      {
        if (racineDocument != null && !erreurSignalee && document != null && document.visualTreeAsset != null)
        {
          erreurSignalee = true;
          Debug.LogError("[Portal Rush] Interface.uxml introuvable dans l'UIDocument (élément « interface »).");
        }
        return;
      }
      Oublier();
      Racine = r;
      // Les calques plein écran laissent passer le pointeur ; seules les commandes l'attrapent.
      r.pickingMode = PickingMode.Ignore;
      r.Query<TemplateContainer>().ForEach(t => t.pickingMode = PickingMode.Ignore);
      r.Query<VisualElement>(className: "calque").ForEach(c => c.pickingMode = PickingMode.Ignore);
      r.Query<Button>().ForEach(Ui.Nettoyer);
      Formes.Habiller(r);

      voile = Trouver<VisualElement>(r, "voile");
      cine = Trouver<VisualElement>(r, "cine");
      cineTitre = Trouver<Label>(r, "cine-titre");
      cineSous = Trouver<Label>(r, "cine-sous");
      fondu = Trouver<VisualElement>(r, "fondu");
      cadreCode = Trouver<Label>(r, "cadre-code");
      Ui.Ecrire(cadreCode, "PR-OS · RULES v" + Donnees.ReglesVersion);

      Barre = new Barre(this, Trouver<VisualElement>(r, "barre"));
      Hud = new Hud(this, Trouver<VisualElement>(r, "hud-racine"));
      EcranMenu = new EcranMenu(this, Trouver<VisualElement>(r, "menu"));
      EcranModes = new EcranModes(this, Trouver<VisualElement>(r, "modes"));
      EcranCampagne = new EcranCampagne(this, Trouver<VisualElement>(r, "campagne"));
      EcranDifficultes = new EcranDifficultes(this, Trouver<VisualElement>(r, "difficultes"));
      EcranDefi = new EcranDefi(this, Trouver<VisualElement>(r, "defi"));
      EcranGarage = new EcranGarage(this, Trouver<VisualElement>(r, "garage"));
      EcranRecords = new EcranRecords(this, Trouver<VisualElement>(r, "records"));
      EcranPause = new EcranPause(this, Trouver<VisualElement>(r, "pause"));
      EcranResultat = new EcranResultat(this, Trouver<VisualElement>(r, "resultat"));
      Reglages = new PanneauReglages(this, Trouver<VisualElement>(r, "reglages-fond"));
      Confirmation = new Confirmation(this, Trouver<VisualElement>(r, "confirmation"));
      Tutoriel = new Tutoriel(this, Hud);
      foreach (var e in Ecrans()) Ui.Afficher(e.Racine, false);
      Ui.Afficher(cine, false);
      // Les formes des éléments créés par les écrans.
      Formes.Habiller(r);

      r.RegisterCallback<GeometryChangedEvent>(e => Dimensions(e.newRect));
      Construite = true;
      Classes();
      Rafraichir();
      // (Un nouvel arbre en cours de route : on retrouve l'état.)
      if (arrivee) RetrouverEtat();
      else Racine.AddToClassList("en-attente");
      if (configATraiter) TraiterConfig();
    }

    /** Un élément nommé de l'UXML (un élément vide s'il manque : une erreur claire, pas une exception). */
    public static T Trouver<T>(VisualElement racine, string nom) where T : VisualElement, new()
    {
      var el = racine.Q<T>(nom);
      if (el != null) return el;
      Debug.LogError($"[Portal Rush] élément « {nom} » ({typeof(T).Name}) absent de l'UXML.");
      return new T();
    }

    IEnumerable<Ecran> Ecrans()
    {
      yield return EcranMenu;
      yield return EcranModes;
      yield return EcranCampagne;
      yield return EcranDifficultes;
      yield return EcranDefi;
      yield return EcranGarage;
      yield return EcranRecords;
      yield return EcranPause;
      yield return EcranResultat;
    }

    void RetrouverEtat()
    {
      var c = Courant;
      Courant = null;
      if (c != null) Montrer(c);
      else if (Partie != null)
      {
        Hud.Commencer(Partie, Lancement);
        Montrer(Session.Instance != null && Session.Instance.EnPause ? EcranPause : null);
      }
      else Montrer(EcranMenu);
    }

    void Dimensions(Rect r)
    {
      if (r.width <= 0 || r.height <= 0) return;
      Racine.EnableInClassList("etroit", r.width < 1500);
      Racine.EnableInClassList("petit", r.width < 1000);
      Racine.EnableInClassList("portrait", r.height > r.width * 1.05f);
      Racine.EnableInClassList("bas", r.height < 820);
    }

    /** Les classes générales : animations, toucher, état de la course. */
    public void Classes()
    {
      if (!Construite) return;
      Racine.EnableInClassList("anime", !Reduit);
      Racine.EnableInClassList("reduit", Reduit);
      Racine.EnableInClassList("tactile", Tactile);
      var r = Pont.Vue != null ? Pont.Vue.reglages : null;
      Racine.EnableInClassList("sans-aide", r != null && !r.aideCommandes);
      bool partie = Partie != null;
      Racine.EnableInClassList("en-course", EnCourse);
      Racine.EnableInClassList("en-partie", partie);
      Racine.EnableInClassList("en-pause", Courant == EcranPause);
      Racine.EnableInClassList("en-cine", EnCinematique);
      Racine.EnableInClassList("en-intro", enIntro);
      Racine.EnableInClassList("en-tutoriel", EnTutoriel);
      Racine.EnableInClassList("avec-ecran", Courant != null);
      // Le décor 3D s'estompe derrière les écrans de détail ; pas derrière le menu, ni pendant la course.
      voile.EnableInClassList("leger", Courant == EcranMenu || Courant == EcranGarage);
      Ui.Afficher(voile, Courant != null && Courant.Voile || Reglages.Ouvert);
      // Le HUD : pendant la course, la pause et la séquence de fin.
      Hud.Afficher(partie && (Courant == null || Courant == EcranPause) && !enIntro);
      Barre.Maj();
    }

    /** Ajoute une classe et la retire à l'image suivante (départ d'une transition USS). */
    public void Impulsion(VisualElement el, string classe)
    {
      el.AddToClassList(classe);
      classesARetirer.RemoveAll(c => c.El == el && c.Classe == classe);
      classesARetirer.Add((el, classe, Time.frameCount + 2));
    }

    /** Donne le focus à l'image suivante (l'élément vient d'être affiché). */
    public void Focaliser(VisualElement? el)
    {
      focusEnAttente = el;
      cadreFocus = Time.frameCount + 1;
    }

    public Focusable? FocusCourant => Racine.focusController?.focusedElement;

    void Defocaliser()
    {
      focusEnAttente = null;
      var f = FocusCourant;
      if (f is VisualElement v && v.panel != null) v.Blur();
    }

    // ==========================================================================
    // LES ÉCRANS
    // ==========================================================================
    /** Montre un écran (null : la course). */
    public void Montrer(Ecran? e, bool focus = true)
    {
      if (!Construite) return;
      Barre.FermerLangues(false);
      EcranMenu.FermerListeRadio(false);
      if (Courant != null && Courant != e)
      {
        Courant.Sortir();
        Ui.Afficher(Courant.Racine, false);
      }
      bool nouveau = Courant != e;
      Courant = e;
      if (e != null)
      {
        Ui.Afficher(e.Racine, true);
        e.Entrer();
        if (nouveau && !Reduit) Impulsion(e.Racine, "entree");
        switch (e.Vitrine)
        {
          case Vitrine3D.Menu:
            Vitrine.Montrer(Pont.Vue.vehicule, Pont.Vue.equipement, false);
            break;
          case Vitrine3D.Garage:
            EcranGarage.MontrerVaisseau();
            break;
          default:
            if (Partie == null) Vitrine.Masquer();
            break;
        }
        if (focus)
        {
          Defocaliser();
          Focaliser(e.PremierFocus ?? Premier(e.Racine));
        }
      }
      else Defocaliser();
      Classes();
      EnvoyerEcran();
    }

    static VisualElement? Premier(VisualElement zone)
    {
      var a = Navigation.Arrets(zone);
      return a.Count > 0 ? a[0] : null;
    }

    /** Le nom de l'écran pour la page (une fois par changement). */
    public void EnvoyerEcran()
    {
      if (enIntro) return;
      string nom;
      if (Reglages.Ouvert) nom = "reglages";
      else if (Courant != null) nom = Courant.NomPont;
      // (Pendant la séquence de fin, la page garde la course jusqu'aux résultats.)
      else if (Partie != null) nom = EnTutoriel ? "tutoriel" : "jeu";
      else return;
      if (nom == dernierEcranPont) return;
      dernierEcranPont = nom;
      Pont.Ecran(nom);
    }

    /** Récrit tous les textes (langue) et les données (vue). */
    public void Rafraichir()
    {
      if (!Construite) return;
      Barre.Rafraichir();
      Hud.Rafraichir();
      Reglages.Rafraichir();
      Confirmation.Rafraichir();
      Courant?.Rafraichir();
      Classes();
    }

    // ==========================================================================
    // L'ARRIVÉE : config, intro, puis tutoriel ou menu
    // ==========================================================================
    void QuandConfig(Config c)
    {
      config = c;
      configATraiter = true;
      if (Construite) TraiterConfig();
    }

    void TraiterConfig()
    {
      var c = config;
      configATraiter = false;
      if (c == null) return;
      arrivee = true;
      Racine.RemoveFromClassList("en-attente");
      Difficulte = Vues.DifficulteJouable(string.IsNullOrEmpty(c.vue.difficulte) ? "as" : c.vue.difficulte);
      Secteur = Vues.NiveauMax;
      // Une nouvelle ouverture du jeu pendant une partie : on repart de zéro.
      if (Tutoriel.Actif) Tutoriel.Arreter();
      if (Partie != null) Session.Instance?.Abandonner();
      cine1 = -1;
      Ui.Afficher(cine, false);
      Reglages.Fermer(false);
      Confirmation.Fermer();
      Rafraichir();
      if (c.intro && Intro.Instance != null)
      {
        enIntro = true;
        Montrer(null, false);
        dernierEcranPont = "intro";
        Intro.Instance.Jouer();
        Classes();
        return;
      }
      Suite();
    }

    void QuandIntroTerminee()
    {
      if (!enIntro) return;
      enIntro = false;
      Suite();
    }

    /** Après l'intro : le tutoriel au premier lancement, sinon le menu (ou l'écran demandé par la page). */
    void Suite()
    {
      enIntro = false;
      var c = config;
      string demande = c != null && !string.IsNullOrEmpty(c.ecran) ? c.ecran : "accueil";
      var t = Pont.Vue.tutoriel;
      if ((c != null && c.tutorielAFaire && demande == "accueil") || demande == "tutoriel")
      {
        LancerTutoriel(t != null && t.etat == "commence" ? t.phase : 0);
        return;
      }
      switch (demande)
      {
        case "reglages":
          Montrer(EcranMenu);
          Reglages.Ouvrir("audio");
          break;
        case "commandes":
          Montrer(EcranMenu);
          Reglages.Ouvrir("commandes");
          break;
        case "campagne":
          Montrer(EcranCampagne);
          break;
        case "infini":
          EcranDifficultes.Preparer(Mode.Infini);
          Montrer(EcranDifficultes);
          break;
        case "defi":
          Montrer(EcranDefi);
          break;
        case "records":
          Montrer(EcranRecords);
          break;
        case "garage":
          Montrer(EcranGarage);
          break;
        default:
          Montrer(EcranMenu);
          break;
      }
    }

    // ==========================================================================
    // LA PAGE (Pont)
    // ==========================================================================
    void QuandVue(Vue v)
    {
      if (!Construite) return;
      if (!string.IsNullOrEmpty(v.difficulte) && Partie == null) Difficulte = Vues.DifficulteJouable(v.difficulte);
      Courant?.Rafraichir();
      Reglages.Rafraichir();
      Hud.Record();
      Classes();
    }

    void QuandBilan(Bilan b)
    {
      if (Construite) EcranResultat.Bilan(b);
    }

    void QuandLangue(string langue) => Rafraichir();

    void QuandRadio(EtatRadio e)
    {
      if (Construite) EcranMenu.Radio(e);
    }

    void QuandQualite(string effectif)
    {
      if (Construite) Reglages.Rafraichir();
    }

    void QuandPauseDemandee()
    {
      // (Session met aussi la partie en pause : l'écran suit PauseChangee.)
      if (EnCourse) Session.Instance?.MettreEnPause(true);
    }

    void QuandFermeture()
    {
      if (!Construite) return;
      if (Tutoriel.Actif) Tutoriel.Arreter();
      cine1 = -1;
      Ui.Afficher(cine, false);
      Reglages.Fermer(false);
      Confirmation.Fermer();
      Montrer(EcranMenu, false);
    }

    // ==========================================================================
    // LA SESSION (la partie)
    // ==========================================================================
    void Abonner()
    {
      var s = Session.Instance;
      if (s == session) return;
      Desabonner();
      session = s;
      if (s == null) return;
      s.Demarree += QuandDemarree;
      s.EvenementJeu += QuandEvenement;
      s.Terminee += QuandTerminee;
      s.PauseChangee += QuandPause;
      s.Decompte += QuandDecompte;
      s.Abandonnee += QuandAbandon;
    }

    void Desabonner()
    {
      if (session == null) return;
      session.Demarree -= QuandDemarree;
      session.EvenementJeu -= QuandEvenement;
      session.Terminee -= QuandTerminee;
      session.PauseChangee -= QuandPause;
      session.Decompte -= QuandDecompte;
      session.Abandonnee -= QuandAbandon;
      session = null;
    }

    /** Lance une partie (le choix des menus, avec le vaisseau choisi). */
    public void Lancer(Mode mode, string difficulte, int niveau)
    {
      var s = Session.Instance;
      if (s == null)
      {
        Debug.LogError("[Portal Rush] pas de Session dans la scène : la partie ne peut pas partir.");
        return;
      }
      if (Tutoriel.Actif) Tutoriel.Arreter();
      if (mode != Mode.Defi && difficulte != Difficulte) ChoisirDifficulte(difficulte);
      if (mode == Mode.Campagne) Secteur = niveau;
      s.Lancer(new Lancement { Mode = mode, Difficulte = Vues.VersDifficulte(difficulte), Niveau = niveau, Vehicule = Pont.Vue.vehicule });
    }

    /** La difficulté choisie dans un menu (la page la retient, comme le jeu web). */
    public void ChoisirDifficulte(string id)
    {
      if (!Vues.DifficulteOuverte(id)) return;
      if (id == Difficulte) return;
      Difficulte = id;
      Pont.ChoisirDifficulte(Vues.VersDifficulte(id));
    }

    public void LancerTutoriel(int phase)
    {
      if (Session.Instance == null)
      {
        Montrer(EcranMenu);
        return;
      }
      Reglages.Fermer(false);
      Confirmation.Fermer();
      Tutoriel.Demarrer(phase);
    }

    void QuandDemarree(Partie p)
    {
      if (!Construite) return;
      cine1 = -1;
      Ui.Afficher(cine, false);
      Reglages.Fermer(false);
      Confirmation.Fermer();
      EcranResultat.Oublier();
      Vitrine.Masquer();
      var l = Lancement;
      if (l != null && l.Tutoriel) Tutoriel.Brancher(p);
      else if (Tutoriel.Actif) Tutoriel.Arreter();
      Hud.Commencer(p, l);
      Montrer(null);
    }

    void QuandEvenement(Evenement e)
    {
      if (!Construite) return;
      var p = Partie;
      if (p == null) return;
      if (Tutoriel.Actif) Tutoriel.SurEvenement(e, p);
      Hud.Evenement(e, p);
    }

    void QuandDecompte(int n)
    {
      if (!Construite || EnTutoriel) return;
      Hud.Compte(n);
    }

    void QuandPause(bool pause)
    {
      if (!Construite) return;
      if (pause)
      {
        if (cine1 < 0) Montrer(EcranPause);
      }
      else
      {
        Reglages.Fermer(false);
        Confirmation.Fermer();
        if (Courant == EcranPause) Montrer(null);
      }
    }

    void QuandAbandon()
    {
      if (!Construite) return;
      cine1 = -1;
      Ui.Afficher(cine, false);
      if (Tutoriel.Actif) Tutoriel.Arreter();
      Hud.Afficher(false);
      Classes();
    }

    /** La partie est finie : la séquence de fin (comme finDePartie), puis les résultats ; le bilan arrive de la page. */
    void QuandTerminee(Resultat r)
    {
      if (!Construite) return;
      var l = Lancement;
      var p = Partie;
      if (l == null || p == null || l.Tutoriel) return;
      Reglages.Fermer(false);
      Confirmation.Fermer();
      EcranResultat.Preparer(r, l, p);
      bool victoire = (l.Mode == Mode.Campagne && r.Reussi) || (l.Mode == Mode.Defi && r.Arrive);
      bool courte = Pont.Vue.reglages.sequenceFin == "courte";
      float duree;
      bool bandes = false;
      if (Reduit) duree = 0.9f;
      else if (victoire && courte) duree = 1f;
      else
      {
        duree = victoire ? 3.35f : 1.3f;
        bandes = victoire;
      }
      cine1 = duree;
      Ui.Ecrire(cineTitre, bandes ? Textes.De("victoire.titre") : "");
      Ui.Ecrire(cineSous, bandes ? Textes.Majuscules(Vues.LibellePartie(l)) : "");
      Ui.Afficher(cine, true);
      cine.EnableInClassList("victoire", bandes);
      if (!Reduit) Impulsion(cine, "entree");
      Defocaliser();
      Classes();
    }

    /** Passer la séquence de fin (Entrée, Espace, Échap, un clic). */
    public void PasserCinematique()
    {
      if (cine1 >= 0) FinCinematique();
    }

    void FinCinematique()
    {
      cine1 = -1;
      Ui.Afficher(cine, false);
      if (Partie != null && Partie.Termine != null) Montrer(EcranResultat);
      else Classes();
    }

    // ==========================================================================
    // LES ACTIONS COMMUNES
    // ==========================================================================
    public void Pause()
    {
      if (EnCourse) Session.Instance?.MettreEnPause(true);
    }

    public void Reprendre()
    {
      Reglages.Fermer(false);
      Confirmation.Fermer();
      if (Session.Instance != null && Session.Instance.EnPause) Session.Instance.MettreEnPause(false);
      else Montrer(null);
    }

    /** Retour au menu principal (la partie est abandonnée, sans résultat ; l'entraînement reprendra à cette étape). */
    public void MenuPrincipal()
    {
      if (Tutoriel.Actif) Tutoriel.Arreter();
      if (Partie != null) Session.Instance?.Abandonner();
      cine1 = -1;
      Ui.Afficher(cine, false);
      Montrer(EcranMenu);
    }

    /** Quitter le jeu : retour au portfolio (la page ferme Unity et rend le focus). */
    public void Quitter()
    {
      if (Tutoriel.Actif) Tutoriel.Arreter();
      if (Partie != null) Session.Instance?.Abandonner();
      Pont.Son("sortie");
      Pont.Fermer();
      Montrer(EcranMenu, false);
    }

    /** Recommencer : la même partie (nouvelle graine), ou l'étape en cours de l'entraînement. */
    public void Recommencer()
    {
      if (EnTutoriel)
      {
        Tutoriel.Recommencer();
        return;
      }
      if (Session.Instance != null && Session.Instance.Lancement != null) Session.Instance.Recommencer();
    }

    /** Échap : son effet dépend de ce qui est ouvert (comme echap() de rush.ts). */
    public void Echap()
    {
      if (!Construite || enIntro) return;
      if (cine1 >= 0)
      {
        PasserCinematique();
        return;
      }
      if (EcranMenu.ListeRadioOuverte)
      {
        EcranMenu.FermerListeRadio(true);
        return;
      }
      if (Barre.LanguesOuvertes)
      {
        Barre.FermerLangues(true);
        return;
      }
      if (Confirmation.Ouverte)
      {
        Confirmation.Annuler();
        return;
      }
      if (Reglages.Ouvert)
      {
        Reglages.Fermer(true);
        return;
      }
      if (EnCourse)
      {
        Pause();
        return;
      }
      if (Courant == EcranPause)
      {
        Reprendre();
        return;
      }
      if (Courant == EcranMenu)
      {
        Quitter();
        return;
      }
      if (Courant == EcranResultat)
      {
        MenuPrincipal();
        return;
      }
      if (Courant != null) Courant.Retour();
      else Montrer(EcranMenu);
    }

    /** Ce que fera Échap, pour la barre du haut. */
    public string EffetEchap()
    {
      if (cine1 >= 0) return Textes.De("barre.echap.passer");
      if (EcranMenu.ListeRadioOuverte || Barre.LanguesOuvertes || Confirmation.Ouverte || Reglages.Ouvert) return Textes.De("barre.echap.fermer");
      if (EnCourse) return Textes.De("barre.echap.pause");
      if (Courant == EcranPause) return Textes.De("barre.echap.reprendre");
      if (Courant == EcranMenu) return Textes.De("barre.echap.quitter");
      if (Courant == EcranResultat) return Textes.De("barre.echap.menu");
      return Courant != null ? Courant.Echap : Textes.De("barre.echap.retour");
    }

    // ==========================================================================
    // LE CLAVIER ET LA NAVIGATION (écoutés tout en haut de l'arbre du panneau)
    // ==========================================================================
    void Ecouter(IPanel panel)
    {
      var arbre = panel.visualTree;
      if (arbre == arbreEcoute) return;
      Oublier();
      arbreEcoute = arbre;
      arbre.RegisterCallback<KeyDownEvent>(QuandTouche, TrickleDown.TrickleDown);
      arbre.RegisterCallback<KeyUpEvent>(QuandToucheRelachee, TrickleDown.TrickleDown);
      arbre.RegisterCallback<NavigationMoveEvent>(QuandDeplacement, TrickleDown.TrickleDown);
      arbre.RegisterCallback<NavigationSubmitEvent>(QuandValider, TrickleDown.TrickleDown);
      arbre.RegisterCallback<NavigationCancelEvent>(QuandAnnuler, TrickleDown.TrickleDown);
      arbre.RegisterCallback<PointerDownEvent>(QuandPointeur, TrickleDown.TrickleDown);
    }

    void Oublier()
    {
      if (arbreEcoute == null) return;
      arbreEcoute.UnregisterCallback<KeyDownEvent>(QuandTouche, TrickleDown.TrickleDown);
      arbreEcoute.UnregisterCallback<KeyUpEvent>(QuandToucheRelachee, TrickleDown.TrickleDown);
      arbreEcoute.UnregisterCallback<NavigationMoveEvent>(QuandDeplacement, TrickleDown.TrickleDown);
      arbreEcoute.UnregisterCallback<NavigationSubmitEvent>(QuandValider, TrickleDown.TrickleDown);
      arbreEcoute.UnregisterCallback<NavigationCancelEvent>(QuandAnnuler, TrickleDown.TrickleDown);
      arbreEcoute.UnregisterCallback<PointerDownEvent>(QuandPointeur, TrickleDown.TrickleDown);
      arbreEcoute = null;
    }

    void QuandTouche(KeyDownEvent e)
    {
      var k = e.keyCode;
      if (k == KeyCode.None) return;
      bool repete = !tenues.Add(k);
      Racine.AddToClassList("clavier");
      if (k == KeyCode.Escape)
      {
        e.StopPropagation();
        if (!repete && Time.frameCount != cadreEchap)
        {
          cadreEchap = Time.frameCount;
          Barre.Presser();
          Echap();
        }
        return;
      }
      if (enIntro) return;
      bool valider = k == KeyCode.Return || k == KeyCode.KeypadEnter || k == KeyCode.Space;
      if (cine1 >= 0)
      {
        if (valider && !repete) PasserCinematique();
        e.StopPropagation();
        return;
      }
      if (valider)
      {
        if (repete) return;
        if (EnCourse)
        {
          // En course, seul le bouton « Passer le tutoriel » peut avoir le focus (Tab).
          if (FocusCourant is Button b && b.userData is Action a)
          {
            a();
            e.StopPropagation();
          }
          return;
        }
        e.StopPropagation();
        Activer();
        return;
      }
      if (k == KeyCode.R && !repete && !EnCourse)
      {
        if (Courant == EcranResultat)
        {
          e.StopPropagation();
          EcranResultat.Rejouer();
        }
        else if (Courant == EcranPause && !Reglages.Ouvert && !Confirmation.Ouverte)
        {
          e.StopPropagation();
          EcranPause.DemanderRecommencer();
        }
      }
    }

    void QuandToucheRelachee(KeyUpEvent e) => tenues.Remove(e.keyCode);

    void QuandValider(NavigationSubmitEvent e)
    {
      // Toutes les validations passent par Activer (une seule fois par appui, même si la touche envoie aussi KeyDown).
      e.StopPropagation();
      if (enIntro) return;
      if (cine1 >= 0)
      {
        PasserCinematique();
        return;
      }
      if (EnCourse)
      {
        if (FocusCourant is Button b && b.userData is Action a) a();
        return;
      }
      Activer();
    }

    void QuandAnnuler(NavigationCancelEvent e)
    {
      e.StopPropagation();
      if (Time.frameCount == cadreEchap) return;
      cadreEchap = Time.frameCount;
      Echap();
    }

    /** Entrée ou Espace : la commande qui a le focus, sinon l'action principale de la zone ouverte. */
    void Activer()
    {
      if (Time.frameCount == cadreActivation) return;
      cadreActivation = Time.frameCount;
      var f = FocusCourant as VisualElement;
      if (f != null && f.panel != null && Navigation.Visible(f))
      {
        if (f is Button b && b.enabledInHierarchy && b.userData is Action a) a();
        return;
      }
      if (Confirmation.Ouverte || Reglages.Ouvert || Barre.LanguesOuvertes || EcranMenu.ListeRadioOuverte) return;
      var p = Courant?.Principale;
      if (p != null && p.enabledInHierarchy && p.userData is Action action) action();
    }

    /** La zone où la navigation reste enfermée (la fenêtre la plus haute ouverte). */
    List<VisualElement> ArretsDeLaZone()
    {
      if (Confirmation.Ouverte) return Navigation.Arrets(Confirmation.Zone);
      if (Barre.LanguesOuvertes) return Navigation.Arrets(Barre.ZoneLangues);
      if (EcranMenu.ListeRadioOuverte) return Navigation.Arrets(EcranMenu.ZoneRadio);
      if (Reglages.Ouvert) return Navigation.Arrets(Reglages.Zone);
      if (Courant != null) return Navigation.Arrets(Courant.Racine, Barre.Racine);
      return new List<VisualElement>();
    }

    void QuandDeplacement(NavigationMoveEvent e)
    {
      var d = e.direction;
      var ici = FocusCourant as VisualElement;
      // Pendant la course et la séquence de fin, rien ne bouge dans l'interface (les flèches pilotent).
      if (EnCourse || cine1 >= 0 || enIntro)
      {
        if (EnCourse && EnTutoriel && (d == NavigationMoveEvent.Direction.Next || d == NavigationMoveEvent.Direction.Previous)) Hud.FocaliserPasser();
        Bloquer(e);
        return;
      }
      bool horizontal = d == NavigationMoveEvent.Direction.Left || d == NavigationMoveEvent.Direction.Right;
      int sens = d == NavigationMoveEvent.Direction.Left || d == NavigationMoveEvent.Direction.Up || d == NavigationMoveEvent.Direction.Previous ? -1 : 1;
      if (ici != null && horizontal)
      {
        // Un curseur se règle lui-même avec ← → (on le laisse faire).
        if (ici.ClassListContains("curseur")) return;
        // Onglets et segments : ← → choisissent le voisin.
        var groupe = ici.parent;
        if (groupe != null && groupe.ClassListContains("lateral"))
        {
          var freres = new List<VisualElement>();
          foreach (var c in groupe.Children())
            if (c.focusable && c.canGrabFocus) freres.Add(c);
          int i = freres.IndexOf(ici);
          if (i >= 0 && freres.Count > 1)
          {
            var cible = freres[(i + sens + freres.Count) % freres.Count];
            cible.Focus();
            if (cible is Button b && b.userData is Action a) a();
          }
          Bloquer(e);
          return;
        }
      }
      var arrets = ArretsDeLaZone();
      Bloquer(e);
      if (arrets.Count == 0) return;
      if (ici == null || !arrets.Contains(ici))
      {
        var premier = Courant?.PremierFocus;
        (premier != null && arrets.Contains(premier) ? premier : arrets[0]).Focus();
        return;
      }
      VisualElement? suivant;
      if (d == NavigationMoveEvent.Direction.Next || d == NavigationMoveEvent.Direction.Previous) suivant = Navigation.Suivant(ici, arrets, sens);
      else
      {
        var v = d == NavigationMoveEvent.Direction.Left ? Vector2.left : d == NavigationMoveEvent.Direction.Right ? Vector2.right : d == NavigationMoveEvent.Direction.Up ? new Vector2(0, -1) : new Vector2(0, 1);
        suivant = Navigation.Voisin(ici, arrets, v);
        // En haut ou en bas d'une liste : on reboucle.
        if (suivant == null && !horizontal) suivant = Navigation.Extreme(arrets, sens > 0);
      }
      if (suivant != null && suivant != ici) suivant.Focus();
    }

    void Bloquer(NavigationMoveEvent e)
    {
      e.StopPropagation();
      Racine.focusController?.IgnoreEvent(e);
    }

    void QuandPointeur(PointerDownEvent e)
    {
      Racine.RemoveFromClassList("clavier");
      if (cine1 >= 0) PasserCinematique();
    }

    /** Pour Session : un point de l'écran (origine en bas à gauche) est-il sur une commande de l'interface ? */
    bool SurInterface(Vector2 ecran)
    {
      if (!Construite) return false;
      var panel = Racine.panel;
      if (panel == null) return false;
      var point = RuntimePanelUtils.ScreenToPanel(panel, new Vector2(ecran.x, Screen.height - ecran.y));
      for (var el = panel.Pick(point); el != null; el = el.parent)
      {
        if (el is Button || el.focusable) return el.enabledInHierarchy;
        if (el == Racine) break;
      }
      return false;
    }
  }
}
