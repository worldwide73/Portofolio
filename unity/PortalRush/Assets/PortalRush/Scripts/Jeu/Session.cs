// PORTAL RUSH (Unity) — LA SESSION : fait vivre une Partie (règles du cœur C#) comme rush.ts le fait dans le jeu web.
//
// Même boucle : dt = min(0,05 s, durée de l'image), consommé par pas fixes de 1/120 s ; même compte à rebours
// (1,2 s au départ, 0,9 s à la reprise, plus courts si les effets sont réduits) ; mêmes commandes (contrat §5.1).
// Les évènements de la partie sont relayés à l'interface (EvenementJeu) et à la page (Pont.EvenementJeu), puis vidés.
#nullable enable
using System;
using PortalRush.Coeur;
using UnityEngine;
using UnityEngine.UIElements;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace PortalRush.Jeu
{
  /** Ce qu'il faut pour lancer une partie (contrat §5.1). */
  public sealed class Lancement
  {
    public Mode Mode = Mode.Campagne;
    public Difficulte Difficulte = Difficulte.Pilote;
    public int Niveau = 1;
    public string Vehicule = "aube";
    /** null : tirée comme dans le jeu web (défi : graine du jour). */
    public double? Graine;
    /** La partie scriptée du tutoriel (pilotée par l'interface, sans compte à rebours). */
    public bool Tutoriel;

    public Lancement Copie() => new Lancement { Mode = Mode, Difficulte = Difficulte, Niveau = Niveau, Vehicule = Vehicule, Graine = Graine, Tutoriel = Tutoriel };
  }

  [DefaultExecutionOrder(-50)]
  public sealed class Session : MonoBehaviour
  {
    /** Le pas fixe des règles (rush.ts : PAS = 1/120). */
    public const double Pas = 1.0 / 120;
    /** La graine du tutoriel (tutoriel.ts). */
    public const double GraineTutoriel = 20261016;

    public static Session? Instance { get; private set; }

    public Partie? Partie { get; private set; }
    public Lancement? Lancement { get; private set; }
    public bool EnPause { get; private set; }
    public bool EnCours => Partie != null && Partie.Termine == null;
    /** Le compte à rebours restant (s) ; 0 : on joue. */
    public double Compte { get; private set; }
    /** Le temps « de jeu » écoulé (s), pour les animations qui suivent la partie (ralenties en pause). */
    public float Horloge { get; private set; }

    public event Action<Partie>? Demarree;
    public event Action<Evenement>? EvenementJeu;
    public event Action<Resultat>? Terminee;
    public event Action<bool>? PauseChangee;
    /** 3, 2, 1, puis 0 au départ (comme les annonces du jeu web). */
    public event Action<int>? Decompte;
    /** La partie a été abandonnée (retour au menu sans résultat). */
    public event Action? Abandonnee;

    /**
     * Facultatif : l'interface dit si un point de l'écran (origine en bas à gauche) est sur un de ses éléments,
     * pour qu'un toucher sur un bouton ne déplace pas le vaisseau. Sans cela, on interroge les panneaux UI Toolkit.
     */
    public static Func<Vector2, bool>? SurInterface;

    double reste;
    bool finSignalee;
    float prochainMoteur;
    Vector2? departPointeur;
    UIDocument[] documents = Array.Empty<UIDocument>();

    void Awake()
    {
      Instance = this;
    }

    void OnEnable()
    {
      Pont.PauseDemandee += QuandPauseDemandee;
      Pont.ReprendreDemandee += QuandReprendreDemandee;
      Pont.FermetureDemandee += QuandFermeture;
    }

    void OnDisable()
    {
      Pont.PauseDemandee -= QuandPauseDemandee;
      Pont.ReprendreDemandee -= QuandReprendreDemandee;
      Pont.FermetureDemandee -= QuandFermeture;
      if (Instance == this) Instance = null;
    }

    void Start()
    {
      documents = FindObjectsByType<UIDocument>(FindObjectsSortMode.None);
    }

    /** Comme animationsCoupees() de rush.ts : mouvement réduit du système, ou animations du site coupées. */
    static bool AnimationsCoupees =>
      (Pont.Config != null && Pont.Config.appareil != null && Pont.Config.appareil.mouvementReduit)
      || (Pont.Vue != null && Pont.Vue.reglages != null && Pont.Vue.reglages.animations <= 0);

    // ==========================================================================
    // LANCER, METTRE EN PAUSE, ARRÊTER
    // ==========================================================================
    public void Lancer(Lancement l)
    {
      Lancement = l.Copie();
      Partie p;
      if (l.Tutoriel)
      {
        p = new Partie(Mode.Campagne, Difficulte.Pilote, 1, GraineTutoriel, l.Vehicule);
        p.Scriptee = true;
      }
      else p = new Partie(l.Mode, l.Difficulte, Mathf.Clamp(l.Niveau, 1, Donnees.Niveaux.Length), l.Graine, l.Vehicule);
      Partie = p;
      EnPause = false;
      finSignalee = false;
      reste = 0;
      Compte = l.Tutoriel ? 0 : AnimationsCoupees ? 0.4 : 1.2;
      departPointeur = null;
      Demarree?.Invoke(p);
      if (Compte <= 0) Decompte?.Invoke(0);
    }

    /** Même lancement, nouvelle graine (sauf le défi, dont la graine est celle du jour). */
    public void Recommencer()
    {
      if (Lancement == null) return;
      var l = Lancement.Copie();
      if (l.Mode != Mode.Defi) l.Graine = null;
      Lancer(l);
    }

    public void MettreEnPause(bool pause)
    {
      if (Partie == null || Partie.Termine != null || pause == EnPause) return;
      EnPause = pause;
      // La reprise passe par un bref compte à rebours, pour se replacer (rien n'a bougé pendant la pause).
      if (!pause && Lancement != null && !Lancement.Tutoriel) Compte = AnimationsCoupees ? 0.3 : 0.9;
      Pont.Moteur(false, 0, false);
      PauseChangee?.Invoke(pause);
    }

    public void Abandonner()
    {
      if (Partie == null) return;
      Partie = null;
      EnPause = false;
      Compte = 0;
      Pont.Moteur(false, 0, false);
      Abandonnee?.Invoke();
    }

    public void Deplacer(int sens)
    {
      if (!CommandesActives()) return;
      Partie!.Deplacer(sens < 0 ? -1 : 1);
    }

    public void Overdrive()
    {
      if (!CommandesActives()) return;
      Partie!.Declencher();
    }

    bool CommandesActives() => Partie != null && Partie.Termine == null && !EnPause && Compte <= 0;

    void QuandPauseDemandee() => MettreEnPause(true);
    void QuandReprendreDemandee() { /* La reprise reste un choix du joueur (écran de pause). */ }
    void QuandFermeture() => Abandonner();

    // ==========================================================================
    // L'IMAGE
    // ==========================================================================
    void Update()
    {
      float dt = Mathf.Min(0.05f, Mathf.Max(0f, Time.unscaledDeltaTime));
      var p = Partie;
      if (p == null) return;
      bool actif = !EnPause && p.Termine == null;
      Horloge += actif ? dt : dt * 0.35f;
      if (actif)
      {
        LireCommandes();
        if (Compte > 0)
        {
          double avant = Compte;
          Compte = Math.Max(0, Compte - dt);
          double pas = AnimationsCoupees ? 0.15 : 0.3;
          int etapeAvant = (int)Math.Ceiling(avant / pas);
          int etape = (int)Math.Ceiling(Compte / pas);
          if (etape != etapeAvant) Decompte?.Invoke(Math.Max(0, etape));
        }
        else
        {
          reste += dt;
          while (reste >= Pas && p.Termine == null)
          {
            p.Avancer(Pas);
            reste -= Pas;
          }
        }
      }
      Relayer(p);
      if (Time.unscaledTime >= prochainMoteur)
      {
        prochainMoteur = Time.unscaledTime + 0.1f;
        Pont.Moteur(actif && Compte <= 0, p.Vitesse, p.Overdrive > 0);
      }
      if (p.Termine != null && !finSignalee)
      {
        finSignalee = true;
        Pont.Moteur(false, 0, false);
        if (Lancement != null && !Lancement.Tutoriel) Pont.Fin(Lancement, p.Graine, p.Termine);
        Terminee?.Invoke(p.Termine);
      }
    }

    void Relayer(Partie p)
    {
      if (p.Evenements.Count == 0) return;
      // Copie : un abonné peut relancer une partie pendant la distribution.
      var liste = p.Evenements.ToArray();
      p.Evenements.Clear();
      foreach (var e in liste)
      {
        EvenementJeu?.Invoke(e);
        Pont.EvenementJeu(e);
      }
    }

    // ==========================================================================
    // LES COMMANDES (clavier : codes physiques, comme e.code dans le jeu web)
    // ==========================================================================
    void LireCommandes()
    {
#if ENABLE_INPUT_SYSTEM
      var k = Keyboard.current;
      if (k != null)
      {
        if (k.leftArrowKey.wasPressedThisFrame || k.aKey.wasPressedThisFrame || k.qKey.wasPressedThisFrame) Deplacer(-1);
        else if (k.rightArrowKey.wasPressedThisFrame || k.dKey.wasPressedThisFrame) Deplacer(1);
        else if (k.spaceKey.wasPressedThisFrame || k.upArrowKey.wasPressedThisFrame || k.wKey.wasPressedThisFrame || k.zKey.wasPressedThisFrame) Overdrive();
        if (k.pKey.wasPressedThisFrame) MettreEnPause(true);
      }
      var pointeur = Pointer.current;
      if (pointeur != null)
      {
        if (pointeur.press.wasPressedThisFrame) Appui(pointeur.position.ReadValue());
        if (pointeur.press.wasReleasedThisFrame) Relache(pointeur.position.ReadValue(), pointeur is Mouse);
      }
#else
      if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A) || Input.GetKeyDown(KeyCode.Q)) Deplacer(-1);
      else if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) Deplacer(1);
      else if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.Z)) Overdrive();
      if (Input.GetKeyDown(KeyCode.P)) MettreEnPause(true);
      if (Input.GetMouseButtonDown(0)) Appui(Input.mousePosition);
      if (Input.GetMouseButtonUp(0)) Relache(Input.mousePosition, Input.touchCount == 0);
#endif
    }

    void Appui(Vector2 ecran)
    {
      departPointeur = PointSurInterface(ecran) ? (Vector2?)null : ecran;
    }

    /** Comme rush.ts : glisser à gauche/droite (> 28 px) = changer de voie ; vers le haut (> 40 px) = Overdrive ; sinon toucher. */
    void Relache(Vector2 ecran, bool souris)
    {
      if (departPointeur == null) return;
      Vector2 d = ecran - departPointeur.Value;
      departPointeur = null;
      // Les seuils du jeu web sont en pixels CSS : on les ramène à l'échelle de la toile.
      float echelle = Mathf.Max(1f, Screen.dpi > 0 ? Screen.dpi / 96f : 1f);
      // (y Unity vers le haut : un glissement vers le haut donne d.y > 0.)
      if (Mathf.Abs(d.x) > 28 * echelle && Mathf.Abs(d.x) > Mathf.Abs(d.y)) Deplacer(d.x < 0 ? -1 : 1);
      else if (d.y > 40 * echelle) Overdrive();
      else
      {
        string tactile = Pont.Vue != null && Pont.Vue.reglages != null && !string.IsNullOrEmpty(Pont.Vue.reglages.tactile) ? Pont.Vue.reglages.tactile : "toucher";
        if (tactile == "toucher" || souris) Deplacer(ecran.x < Screen.width / 2f ? -1 : 1);
      }
    }

    bool PointSurInterface(Vector2 ecran)
    {
      if (SurInterface != null) return SurInterface(ecran);
      var haut = new Vector2(ecran.x, Screen.height - ecran.y);
      foreach (var doc in documents)
      {
        if (doc == null || !doc.isActiveAndEnabled) continue;
        var racine = doc.rootVisualElement;
        if (racine == null || racine.panel == null) continue;
        var point = RuntimePanelUtils.ScreenToPanel(racine.panel, haut);
        var element = racine.panel.Pick(point);
        if (element != null && element != racine && element.pickingMode == PickingMode.Position && element.enabledInHierarchy) return true;
      }
      return false;
    }
  }
}
