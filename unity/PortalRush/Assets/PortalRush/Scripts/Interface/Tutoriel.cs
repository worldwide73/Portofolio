// PORTAL RUSH (Unity) — LE TUTORIEL IMMERSIF (portage de src/scripts/rush/tutoriel.ts)
//
// À la toute première entrée (une fois par profil : terminé ou passé, il ne revient plus seul), on arrive de la
// sortie du tunnel directement dans la course : pas de menu, pas de « Commencer », pas de 3-2-1. Cinq phases courtes
// (une trentaine de secondes) apprennent le jeu en le jouant :
//   1. premiers déplacements : changer de voie, à gauche puis à droite (les vraies touches) ;
//   2. esquiver : trois obstacles simples ; s'il ne bouge pas, le vaisseau ralentit et attend (assistance) ;
//   3. l'énergie : ramasser au moins trois fragments ; la jauge se remplit en partie (aucun Overdrive offert) ;
//   4. un obstacle mobile : un drone qui glisse puis se pose ; l'éviter ;
//   5. l'arrivée : le vaisseau accélère, une courte finale, « Entraînement terminé. Bienvenue dans Portal Rush. »,
//      et le menu principal s'ouvre de lui-même.
// Chaque phase demande une vraie action ; un échec la fait recommencer. « Passer le tutoriel » (en bas à droite)
// arrête tout et ouvre le menu. Rien n'est compté (Session ne range pas la partie scriptée). L'état part vers la page
// à chaque phase (Pont.Tutoriel : une sortie en plein milieu reprend à la même phase la fois suivante).
//
// La partie : Session.Lancer(Lancement { Tutoriel = true }) crée la Partie scriptée (graine 20261016, générateur
// muet, chocs sans coût) ; ici, on pose les objets (Partie.Placer, Vider), on impose la vitesse (VitesseImposee) et
// on lit les évènements du moteur. Les minuteries comptent en temps de jeu (elles s'arrêtent en pause).
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;

namespace PortalRush.Interface
{
  public sealed class Tutoriel
  {
    static readonly double[] Vitesses = { 15, 19, 17, 19, 30 };

    readonly Interface ui;
    readonly Hud hud;
    Partie? partie;
    /** La phase (0 à 4 ; n + 0,5 entre deux phases ; 5 à la fin). */
    public double Phase { get; private set; }
    /** L'entraînement est en cours (jusqu'au menu). */
    public bool Actif { get; private set; }
    /** Les étapes réagissent (faux pendant la finale et entre deux lancements). */
    bool etapes;
    int compte;
    string[] attendu = Array.Empty<string>();
    int suivant;
    bool enAttente;
    int derniereVoie = 1;
    double termineLe;
    int phaseDemandee;
    readonly HashSet<Objet> poses = new HashSet<Objet>();
    float minuterie = -1;
    Action? apres;
    float finale = -1;

    public Tutoriel(Interface ui, Hud hud)
    {
      this.ui = ui;
      this.hud = hud;
    }

    /** Faut-il appeler Tic (étapes en cours, minuterie ou finale) ? */
    public bool Vivant => Actif || finale >= 0;

    /** Lance l'entraînement à une phase (0 : depuis le début). */
    public void Demarrer(int phase)
    {
      minuterie = -1;
      apres = null;
      finale = -1;
      phaseDemandee = Math.Max(0, Math.Min(4, phase));
      var s = Session.Instance;
      if (s == null) return;
      Actif = true;
      s.Lancer(new Lancement
      {
        Tutoriel = true,
        Mode = Mode.Campagne,
        Difficulte = Difficulte.Pilote,
        Niveau = 1,
        Vehicule = Pont.Vue.vehicule,
        Graine = Session.GraineTutoriel,
      });
    }

    /** La partie scriptée vient de démarrer (Session.Demarree). */
    public void Brancher(Partie p)
    {
      partie = p;
      p.Scriptee = true;
      p.Boucliers = p.BouclierMax;
      derniereVoie = p.Voie;
      poses.Clear();
      Actif = true;
      Entrer(phaseDemandee);
    }

    /** Recommencer depuis la pause : l'étape en cours (jamais une vraie partie). */
    public void Recommencer() => Demarrer((int)Math.Floor(Math.Min(4, Phase)));

    string Titre(int n) => Textes.De($"tutoriel.phases.{n}.titre");
    string Consigne(int n) => Textes.De(Interface.Tactile ? $"tutoriel.phases.{n}.tactile" : $"tutoriel.phases.{n}.consigne");

    void Afficher(int n, string consigne, bool gauche, bool droite, string message = "", string genre = "", bool etapeFaite = false) =>
      hud.TutoAfficher(n, Titre(n), consigne, gauche, droite, message, genre, etapeFaite);

    /** Entre dans une phase : consigne, vitesse, objets. */
    void Entrer(int n)
    {
      var p = partie;
      if (p == null) return;
      Phase = n;
      etapes = true;
      compte = 0;
      suivant = 0;
      enAttente = false;
      p.Vider();
      p.VitesseImposee = Vitesses[n];
      p.Figee = false;
      Pont.Tutoriel("commence", n);
      if (n == 0)
      {
        // Une voie, puis l'autre : d'abord vers le bord le plus proche du centre.
        attendu = p.Voie == 0 ? new[] { "droite", "gauche" } : new[] { "gauche", "droite" };
        Afficher(0, Consigne(0), attendu[0] == "gauche", attendu[0] == "droite");
      }
      else
      {
        bool touches = n == 1 || n == 2 || n == 3;
        Afficher(n, Consigne(n), touches, touches);
        Preparer(n);
      }
    }

    /** Pose les objets d'une phase (devant le vaisseau, à des distances qui laissent toujours le temps). */
    void Preparer(int n)
    {
      var p = partie!;
      int ici = p.VoieOccupee;
      if (n == 1)
      {
        // Trois obstacles, l'un après l'autre : chacun bloque la voie où l'on est quand il est posé.
        PoserObstacle(ici, 70);
      }
      else if (n == 2)
      {
        // Cinq fragments en zigzag, à portée.
        int[] voies = { ici, ici == 1 ? 0 : 1, ici == 1 ? 2 : ici, 1, ici };
        for (int k = 0; k < voies.Length; k++) p.Placer(TypeObjet.Fragment, 45 + k * 22, new[] { voies[k] });
      }
      else if (n == 3)
      {
        // Un drone qui glisse d'un bord à l'autre, puis se pose sur la voie du vaisseau.
        int autre = ici == 0 ? 2 : 0;
        p.Placer(TypeObjet.Drone, 90, new[] { ici }, new List<(double, int[])> { (70, new[] { autre }), (45, new[] { 1 }) }, 32);
      }
      else if (n == 4)
      {
        // L'arrivée : plus rien sur la piste, le vaisseau accélère.
        termineLe = p.Distance + 140;
      }
    }

    void PoserObstacle(int voie, double devant) => partie?.Placer(TypeObjet.Bloc, devant, new[] { voie });

    /** Les évènements du moteur (déplacements, chocs, fragments). */
    public void SurEvenement(Evenement e, Partie p)
    {
      if (!Actif || !etapes || p != partie) return;
      if (e.Type == TypeEvenement.Deplacement)
      {
        int voie = e.Voie ?? p.Voie;
        string sens = voie < derniereVoie ? "gauche" : "droite";
        derniereVoie = voie;
        if (Phase == 0 && suivant < attendu.Length && attendu[suivant] == sens)
        {
          suivant++;
          Pont.Son("parfait");
          if (suivant >= attendu.Length) Reussir();
          else Afficher(0, Consigne(0), attendu[suivant] == "gauche", attendu[suivant] == "droite", "✓", "ok");
        }
        // (Le vaisseau ralenti repart dès qu'on a bougé.)
        if (enAttente)
        {
          enAttente = false;
          p.VitesseImposee = Vitesses[(int)Math.Floor(Math.Min(4, Phase))];
        }
      }
      else if (e.Type == TypeEvenement.Choc && (Phase == 1 || Phase == 3))
      {
        Rater();
      }
      else if ((e.Type == TypeEvenement.Fragment || e.Type == TypeEvenement.Dore) && Phase == 2)
      {
        compte++;
        // La jauge se remplit en partie (jamais pleine : l'Overdrive se mérite en course).
        p.Jauge = Math.Min(0.6, compte * 0.12);
        if (compte == 3) Afficher(2, Textes.De("tutoriel.energie"), false, false, "✓", "ok");
      }
    }

    void Reussir()
    {
      Pont.Son("pret");
      int n = (int)Phase;
      Afficher(n, Textes.De("tutoriel.bravo"), false, false, "✓", "ok", true);
      Phase = n + 0.5; // (entre deux phases : rien ne compte)
      Minuter(n == 2 ? 2.6f : 0.9f, () => Entrer(n + 1));
    }

    /** Un choc ou un fragment manqué : l'étape recommence (sans rejouer l'introduction). */
    void Rater()
    {
      int n = (int)Math.Floor(Phase);
      Afficher(n, Textes.De("tutoriel.rate"), false, false, "↺", "rate");
      Phase = n + 0.5;
      partie?.Vider();
      Minuter(1.1f, () => Entrer(n));
    }

    void Minuter(float secondes, Action action)
    {
      minuterie = secondes;
      apres = action;
    }

    /** À chaque image : l'avancée des phases, l'assistance (ralentir et attendre), la fin. */
    public void Tic(float dt)
    {
      var s = Session.Instance;
      bool pause = s == null || s.EnPause;
      if (finale >= 0)
      {
        finale -= dt;
        if (finale < 0) Finir();
        return;
      }
      if (pause) return;
      if (minuterie >= 0)
      {
        minuterie -= dt;
        if (minuterie < 0)
        {
          var a = apres;
          apres = null;
          if (Actif && partie != null && partie == ui.Partie) a?.Invoke();
        }
      }
      var p = partie;
      if (!Actif || !etapes || p == null || p != ui.Partie || Phase % 1 != 0) return;
      int ici = p.VoieOccupee;
      var devant = new List<Objet>();
      foreach (var o in p.Objets)
        if (!o.Passe && o.Pos > p.Distance) devant.Add(o);
      if (Phase == 1)
      {
        // Un obstacle franchi sans choc : le suivant ; trois, la phase est réussie.
        Objet? bloc = devant.Find(o => o.Type == TypeObjet.Bloc);
        if (bloc == null)
        {
          compte++;
          if (compte >= 3)
          {
            Reussir();
            return;
          }
          PoserObstacle(ici, 60);
          return;
        }
        // Assistance : à moins de 16 m, si le vaisseau est toujours sur la voie de l'obstacle, il ralentit et attend.
        if (bloc.Pos - p.Distance < 16 && Array.IndexOf(bloc.Voies, ici) >= 0 && !enAttente)
        {
          enAttente = true;
          p.VitesseImposee = 2.5;
          Afficher(1, Textes.De("tutoriel.ralenti"), true, true, "", "info");
        }
      }
      else if (Phase == 2)
      {
        if (!devant.Exists(o => o.Type == TypeObjet.Fragment))
        {
          if (compte >= 3) Reussir();
          else Rater();
        }
      }
      else if (Phase == 3)
      {
        Objet? drone = devant.Find(o => o.Type == TypeObjet.Drone);
        if (drone != null && drone.Pos - p.Distance <= (drone.Fige ?? 0) && drone.Voies.Length > 0)
        {
          // Le drone s'est posé : sur la voie du vaisseau au moment où il se fige (il faut vraiment l'éviter).
          if (poses.Add(drone)) drone.Voies = new[] { ici };
          if (drone.Pos - p.Distance < 12 && Array.IndexOf(drone.Voies, ici) >= 0 && !enAttente)
          {
            enAttente = true;
            p.VitesseImposee = 2.5;
            Afficher(3, Textes.De("tutoriel.ralenti"), true, true, "", "info");
          }
        }
        if (drone == null) Reussir();
      }
      else if (Phase == 4)
      {
        // (Le jeu web ajoute 0,25 m/s à chaque image, à 60 images par seconde : 15 m/s².)
        p.VitesseImposee = Math.Min(48, (p.VitesseImposee ?? 30) + 15 * dt);
        if (p.Distance >= termineLe)
        {
          Phase = 5;
          etapes = false;
          Pont.Son("victoire");
          Pont.Tutoriel("termine", 5);
          hud.TutoFinale(Textes.De("tutoriel.fin.0"), Textes.De("tutoriel.fin.1"));
          finale = Interface.Reduit ? 1.8f : 3.2f;
        }
      }
    }

    /** La fin de la finale : le menu principal s'ouvre de lui-même. */
    void Finir()
    {
      finale = -1;
      Actif = false;
      etapes = false;
      partie = null;
      hud.TutoRanger();
      if (ui.Partie != null) Session.Instance?.Abandonner();
      ui.Montrer(ui.EcranMenu);
    }

    /** Passer le tutoriel : tout s'arrête proprement, le menu s'ouvre. */
    public void Passer()
    {
      if (!Actif) return;
      minuterie = -1;
      apres = null;
      finale = -1;
      Actif = false;
      etapes = false;
      Pont.Tutoriel("passe", (int)Math.Floor(Math.Min(4, Phase)));
      partie = null;
      hud.TutoRanger();
      if (ui.Partie != null) Session.Instance?.Abandonner();
      ui.Montrer(ui.EcranMenu);
    }

    /** Quitter en plein milieu (menu de pause, fermeture du jeu) : l'état reste « commencé » à cette phase. */
    public void Arreter()
    {
      minuterie = -1;
      apres = null;
      finale = -1;
      Actif = false;
      etapes = false;
      partie = null;
      hud.TutoRanger();
    }
  }
}
