// FICHIER GÉNÉRÉ par outils/unity/exporter-donnees.mjs à partir de src/scripts/rush/donnees.ts et equilibrage.ts.
// NE PAS MODIFIER À LA MAIN : changer le jeu web, puis relancer l'export (la règle doit rester la même des deux côtés).
// Règles version 5.
#nullable enable
using System.Collections.Generic;

namespace PortalRush.Coeur
{
  public static partial class Donnees
  {
    public const int ReglesVersion = 5;

    public static readonly Niveau[] Niveaux = new[]
    {
      new Niveau {
        Id = 1, Longueur = 2200, Theme = Theme.Lancement, Vitesse = 0.95, Ecart = 1.05, Complexite = -0.08,
        Phases = new[] {
          new Phase(0.3, NomPhase.Calibrage, new (Famille, double)[] { (Famille.Simple, 3), (Famille.Double, 2), (Famille.Escalier, 1) }, false),
          new Phase(0.7, NomPhase.Acceleration, new (Famille, double)[] { (Famille.Double, 2), (Famille.Escalier, 2), (Famille.Zigzag, 1), (Famille.Risque, 1) }, false),
          new Phase(1, NomPhase.Pression, new (Famille, double)[] { (Famille.Double, 1), (Famille.Escalier, 1), (Famille.Zigzag, 2), (Famille.Risque, 1) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Fin, 0),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.Parfaits, 8) },
        Etoiles = new double[] { 55000, 90000, 175000, 170000, 205000 },
        Brume = null, Boss = null, Tutoriel = true,
      },
      new Niveau {
        Id = 2, Longueur = 2800, Theme = Theme.Neon, Vitesse = 0.96, Ecart = 1.05, Complexite = -0.05,
        Phases = new[] {
          new Phase(0.3, NomPhase.Calibrage, new (Famille, double)[] { (Famille.Double, 2), (Famille.Couloir, 2), (Famille.Escalier, 1) }, false),
          new Phase(0.7, NomPhase.Acceleration, new (Famille, double)[] { (Famille.Couloir, 3), (Famille.Zigzag, 1), (Famille.Risque, 2), (Famille.Double, 1), (Famille.Drones, 1) }, false),
          new Phase(1, NomPhase.Pression, new (Famille, double)[] { (Famille.Couloir, 2), (Famille.Zigzag, 2), (Famille.Risque, 2), (Famille.Drones, 2) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Fragments, 30),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.Combo, 60) },
        Etoiles = new double[] { 105000, 155000, 230000, 265000, 295000 },
        Brume = null, Boss = null, Tutoriel = false,
      },
      new Niveau {
        Id = 3, Longueur = 3000, Theme = Theme.Debris, Vitesse = 1, Ecart = 0.95, Complexite = 0,
        Phases = new[] {
          new Phase(0.35, NomPhase.Calibrage, new (Famille, double)[] { (Famille.Essaim, 3), (Famille.Simple, 1), (Famille.Double, 1) }, false),
          new Phase(0.75, NomPhase.Acceleration, new (Famille, double)[] { (Famille.Essaim, 3), (Famille.Zigzag, 2), (Famille.Double, 1), (Famille.Risque, 1), (Famille.Chutes, 2) }, false),
          new Phase(1, NomPhase.Pression, new (Famille, double)[] { (Famille.Essaim, 3), (Famille.Zigzag, 2), (Famille.Couloir, 1), (Famille.Chutes, 2) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Fin, 0),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.ChocsMax, 0) },
        Etoiles = new double[] { 50000, 75000, 135000, 100000, 80000 },
        Brume = null, Boss = null, Tutoriel = false,
      },
      new Niveau {
        Id = 4, Longueur = 3200, Theme = Theme.Laser, Vitesse = 1, Ecart = 1, Complexite = 0.05,
        Phases = new[] {
          new Phase(0.3, NomPhase.Calibrage, new (Famille, double)[] { (Famille.Laser, 3), (Famille.Double, 1) }, false),
          new Phase(0.7, NomPhase.Acceleration, new (Famille, double)[] { (Famille.Laser, 3), (Famille.Couloir, 1), (Famille.Zigzag, 1), (Famille.Risque, 1), (Famille.Rotors, 2) }, false),
          new Phase(1, NomPhase.Pression, new (Famille, double)[] { (Famille.Laser, 2), (Famille.Zigzag, 2), (Famille.Couloir, 1), (Famille.Rotors, 2), (Famille.Portes, 2) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Parfaits, 12),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.Combo, 50) },
        Etoiles = new double[] { 105000, 155000, 235000, 310000, 370000 },
        Brume = null, Boss = null, Tutoriel = false,
      },
      new Niveau {
        Id = 5, Longueur = 3600, Theme = Theme.Rift, Vitesse = 1.08, Ecart = 0.9, Complexite = 0.12,
        Phases = new[] {
          new Phase(0.3, NomPhase.Calibrage, new (Famille, double)[] { (Famille.Glissement, 3), (Famille.Portail, 2), (Famille.Double, 1) }, false),
          new Phase(0.65, NomPhase.Acceleration, new (Famille, double)[] { (Famille.Glissement, 3), (Famille.Portail, 2), (Famille.Couloir, 2), (Famille.Laser, 1), (Famille.Portes, 2) }, false),
          new Phase(1, NomPhase.Pression, new (Famille, double)[] { (Famille.Glissement, 2), (Famille.Couloir, 2), (Famille.Zigzag, 2), (Famille.Laser, 1), (Famille.Portail, 1), (Famille.Portes, 2), (Famille.Drones, 2) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Portails, 5),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.Parfaits, 15) },
        Etoiles = new double[] { 225000, 275000, 465000, 670000, 805000 },
        Brume = null, Boss = null, Tutoriel = false,
      },
      new Niveau {
        Id = 6, Longueur = 4200, Theme = Theme.Tempete, Vitesse = 1.12, Ecart = 0.85, Complexite = 0.18,
        Phases = new[] {
          new Phase(0.25, NomPhase.Tempete, new (Famille, double)[] { (Famille.Essaim, 2), (Famille.Couloir, 2), (Famille.Double, 2) }, false),
          new Phase(0.55, NomPhase.Pression, new (Famille, double)[] { (Famille.Laser, 2), (Famille.Glissement, 2), (Famille.Essaim, 2), (Famille.Zigzag, 2) }, true),
          new Phase(0.8, NomPhase.Tempete, new (Famille, double)[] { (Famille.Couloir, 2), (Famille.Glissement, 2), (Famille.Laser, 2), (Famille.Essaim, 2), (Famille.Risque, 1), (Famille.Convoi, 2), (Famille.Chutes, 1) }, false),
          new Phase(1, NomPhase.Finale, new (Famille, double)[] { (Famille.Zigzag, 3), (Famille.Glissement, 2), (Famille.Laser, 1), (Famille.Couloir, 2), (Famille.Convoi, 2), (Famille.Rotors, 2) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Fin, 0),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.ChocsMax, 1) },
        Etoiles = new double[] { 120000, 155000, 300000, 305000, 260000 },
        Brume = 80, Boss = null, Tutoriel = false,
      },
      new Niveau {
        Id = 7, Longueur = 0, Theme = Theme.Sentinelle, Vitesse = 1.1, Ecart = 0.9, Complexite = 0.2,
        Phases = new[] {
          new Phase(0.33, NomPhase.Assaut, new (Famille, double)[] { (Famille.Frappe, 4), (Famille.Double, 1) }, false),
          new Phase(0.66, NomPhase.Assaut, new (Famille, double)[] { (Famille.Frappe, 3), (Famille.Balayage, 3), (Famille.Zigzag, 1), (Famille.Drones, 2) }, false),
          new Phase(1, NomPhase.Finale, new (Famille, double)[] { (Famille.Grille, 3), (Famille.Frappe, 2), (Famille.Balayage, 2) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Boss, 0),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.ChocsMax, 0) },
        Etoiles = new double[] { 135000, 180000, 540000, 665000, 765000 },
        Brume = null, Boss = new BossDef(40, 3), Tutoriel = false,
      },
      new Niveau {
        Id = 8, Longueur = 0, Theme = Theme.Singularite, Vitesse = 1.18, Ecart = 0.82, Complexite = 0.3,
        Phases = new[] {
          new Phase(0.25, NomPhase.Assaut, new (Famille, double)[] { (Famille.Frappe, 3), (Famille.Glissement, 2), (Famille.Essaim, 1) }, false),
          new Phase(0.5, NomPhase.Assaut, new (Famille, double)[] { (Famille.Balayage, 3), (Famille.Laser, 2), (Famille.Couloir, 2), (Famille.Convoi, 2) }, false),
          new Phase(0.75, NomPhase.Pression, new (Famille, double)[] { (Famille.Grille, 3), (Famille.Glissement, 2), (Famille.Zigzag, 2), (Famille.Portes, 2) }, true),
          new Phase(1, NomPhase.Effondrement, new (Famille, double)[] { (Famille.Effondrement, 4), (Famille.Balayage, 2), (Famille.Grille, 2) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Boss, 0),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.Combo, 120) },
        Etoiles = new double[] { 460000, 770000, 1900000, 3500000, 4200000 },
        Brume = 100, Boss = new BossDef(60, 4), Tutoriel = false,
      }
    };

    public static Niveau NiveauInfini() => new Niveau {
        Id = 0, Longueur = double.PositiveInfinity, Theme = Theme.Infini, Vitesse = 1, Ecart = 1, Complexite = 0,
        Phases = new[] {
          new Phase(400, NomPhase.Calibrage, new (Famille, double)[] { (Famille.Simple, 2), (Famille.Double, 2), (Famille.Escalier, 1) }, false),
          new Phase(1200, NomPhase.Acceleration, new (Famille, double)[] { (Famille.Double, 2), (Famille.Escalier, 1), (Famille.Zigzag, 2), (Famille.Couloir, 1), (Famille.Risque, 1) }, false),
          new Phase(2400, NomPhase.Pression, new (Famille, double)[] { (Famille.Zigzag, 2), (Famille.Couloir, 2), (Famille.Essaim, 2), (Famille.Laser, 1), (Famille.Risque, 1), (Famille.Drones, 2), (Famille.Chutes, 1) }, true),
          new Phase(4000, NomPhase.Tempete, new (Famille, double)[] { (Famille.Couloir, 2), (Famille.Essaim, 2), (Famille.Laser, 2), (Famille.Glissement, 2), (Famille.Portail, 1), (Famille.Zigzag, 2), (Famille.Portes, 2), (Famille.Rotors, 1) }, true),
          new Phase(double.PositiveInfinity, NomPhase.Effondrement, new (Famille, double)[] { (Famille.Zigzag, 2), (Famille.Couloir, 2), (Famille.Laser, 2), (Famille.Glissement, 2), (Famille.Essaim, 2), (Famille.Portail, 1), (Famille.Drones, 2), (Famille.Portes, 2), (Famille.Rotors, 2), (Famille.Convoi, 2), (Famille.Chutes, 1) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Fin, 0),
        Maitrise = new Objectif[] {  },
        Etoiles = null,
        Brume = null, Boss = null, Tutoriel = false,
      };

    public static readonly Niveau Defi = new Niveau {
        Id = 0, Longueur = 3000, Theme = Theme.Defi, Vitesse = 1, Ecart = 1, Complexite = 0.05,
        Phases = new[] {
          new Phase(0.3, NomPhase.Calibrage, new (Famille, double)[] { (Famille.Double, 2), (Famille.Escalier, 1), (Famille.Couloir, 1), (Famille.Risque, 1) }, false),
          new Phase(0.7, NomPhase.Acceleration, new (Famille, double)[] { (Famille.Zigzag, 2), (Famille.Couloir, 2), (Famille.Laser, 1), (Famille.Essaim, 1), (Famille.Glissement, 1), (Famille.Risque, 1), (Famille.Drones, 1), (Famille.Chutes, 1) }, false),
          new Phase(1, NomPhase.Pression, new (Famille, double)[] { (Famille.Zigzag, 2), (Famille.Couloir, 2), (Famille.Laser, 2), (Famille.Glissement, 1), (Famille.Essaim, 1), (Famille.Portail, 1), (Famille.Portes, 2), (Famille.Convoi, 1) }, true)
        },
        Objectif = new Objectif(TypeObjectif.Fin, 0),
        Maitrise = new Objectif[] { new Objectif(TypeObjectif.Parfaits, 15), new Objectif(TypeObjectif.ChocsMax, 0) },
        Etoiles = null,
        Brume = null, Boss = null, Tutoriel = false,
      };
    public const Difficulte DifficulteDefi = Difficulte.As;

    public static readonly Dictionary<Difficulte, Profil> Profils = new()
    {
      [Difficulte.Pilote] = new Profil {
        Score = 0.75,
        Vitesse = (30, 60, 0.14),
        Ecart = (30, 15, 0.08),
        Reaction = (0.5, 0.32, 120),
        Complexite = (0.12, 0.7, 0.006),
        Boucliers = 4, Invulnerable = 1.2, Fragments = 1.15, GainOverdrive = 0.9,
        Overdrive = (6, 3, 2),
        Parfait = 0.28, ComboDelai = 6, Pression = (1100, 2),
      },
      [Difficulte.As] = new Profil {
        Score = 1,
        Vitesse = (36, 64, 0.17),
        Ecart = (24, 13, 0.08),
        Reaction = (0.4, 0.28, 110),
        Complexite = (0.32, 0.92, 0.008),
        Boucliers = 3, Invulnerable = 1, Fragments = 1, GainOverdrive = 0.8,
        Overdrive = (5, 2, 2),
        Parfait = 0.22, ComboDelai = 4.5, Pression = (800, 3),
      },
      [Difficulte.Expert] = new Profil {
        Score = 1.5,
        Vitesse = (42, 74, 0.23),
        Ecart = (20, 11, 0.09),
        Reaction = (0.32, 0.23, 100),
        Complexite = (0.55, 1, 0.01),
        Boucliers = 2, Invulnerable = 0.85, Fragments = 0.8, GainOverdrive = 0.7,
        Overdrive = (4.5, 1, 2.5),
        Parfait = 0.18, ComboDelai = 3.5, Pression = (600, 4),
      },
      [Difficulte.Cauchemar] = new Profil {
        Score = 2,
        Vitesse = (48, 84, 0.3),
        Ecart = (17, 9.5, 0.1),
        Reaction = (0.27, 0.2, 90),
        Complexite = (0.75, 1, 0.012),
        Boucliers = 1, Invulnerable = 0.7, Fragments = 0.65, GainOverdrive = 0.6,
        Overdrive = (4, 1, 3),
        Parfait = 0.15, ComboDelai = 2.8, Pression = (450, 5),
      },
      [Difficulte.Paradoxe] = new Profil {
        Score = 2.6,
        Vitesse = (54, 92, 0.36),
        Ecart = (15, 8.5, 0.11),
        Reaction = (0.24, 0.18, 80),
        Complexite = (0.85, 1, 0.014),
        Boucliers = 1, Invulnerable = 0.6, Fragments = 0.55, GainOverdrive = 0.5,
        Overdrive = (3.5, 1, 3.5),
        Parfait = 0.13, ComboDelai = 2.4, Pression = (380, 5),
      }
    };

    public static readonly Difficulte[] OrdreDifficultes = { Difficulte.Pilote, Difficulte.As, Difficulte.Expert, Difficulte.Cauchemar, Difficulte.Paradoxe };

    public static class Points
    {
      public const double Metre = 0.4;
      public const double Fragment = 40;
      public const double Dore = 120;
      public const double Parfait = 100;
      public const double Motif = 120;
      public const double MotifComplexite = 360;
      public const double Brise = 60;
      public const double Objectif = 600;
      public const double Boss = 150;
    }
    public const int ComboParCran = 4, ComboMax = 10;
    public static class Jauge
    {
      public const double Fragment = 0.011;
      public const double Dore = 0.024;
      public const double Parfait = 0.024;
      public const double Motif = 0.01;
      public const double Choc = 0.25;
    }
    public const int OverdriveParPartie = 1;
    public const double OverdriveDepartMetres = 700, OverdriveDepartPart = 0.3;
    public const int InfiniBoucliers = 1;
    public const double InfiniSurcroit = 0.05, InfiniPlafond = 140;
    public const double OverdriveComboCombo = 24, OverdriveComboBonus = 1;
    public static readonly Dictionary<Difficulte, double> BossVie = new()
    {
      [Difficulte.Pilote] = 0.85,
      [Difficulte.As] = 1,
      [Difficulte.Expert] = 1.25,
      [Difficulte.Cauchemar] = 1.5,
      [Difficulte.Paradoxe] = 1.75,
    };
    public const double BossDegatsParfait = 1, BossDegatsNoyau = 2, BossDegatsOverdrive = 3, BossDegatsBrise = 1;
    public static readonly (string Rang, double Seuil)[] Rangs = { ("SSS", 97), ("S", 88), ("A", 75), ("B", 60), ("C", 0) };
    public const double Deplacement = 0.12;

    public static readonly Vehicule[] Vehicules =
    {
      new Vehicule("aube", 0, 1, 0, 1, 1, Condition.Depart()),
      new Vehicule("faucon", 1, 0.8, -1, 1, 1, Condition.ParNiveau(3)),
      new Vehicule("bastion", 2, 1.18, 1, 1, 0.85, Condition.ParNiveau(5)),
      new Vehicule("spectre", 3, 1, 0, 1.3, 0.8, Condition.ParRang("S")),
    };
    public const string VehiculeDepart = "aube";

    public static readonly Piece[] Pieces =
    {
      new Piece("coque-givre", Emplacement.Coque, "238, 244, 255", Condition.Depart()),
      new Piece("coque-aurore", Emplacement.Coque, "170, 255, 225", Condition.ParNiveau(4)),
      new Piece("coque-comete", Emplacement.Coque, "255, 228, 160", Condition.ParInfini(3000)),
      new Piece("coque-eclipse", Emplacement.Coque, "20, 22, 30", Condition.ParDifficulte(Difficulte.Cauchemar)),
      new Piece("trainee-givre", Emplacement.Trainee, "150, 192, 255", Condition.Depart()),
      new Piece("trainee-aurore", Emplacement.Trainee, "90, 240, 200", Condition.ParNiveau(2)),
      new Piece("trainee-braise", Emplacement.Trainee, "255, 150, 90", Condition.ParNiveau(7)),
      new Piece("trainee-prisme", Emplacement.Trainee, "prisme", Condition.ParRang("S")),
      new Piece("trainee-singularite", Emplacement.Trainee, "170, 120, 255", Condition.ParNiveau(8)),
      new Piece("overdrive-standard", Emplacement.Overdrive, "236, 244, 255", Condition.Depart()),
      new Piece("overdrive-nova", Emplacement.Overdrive, "120, 230, 255", Condition.ParTotal("overdrives", 8)),
      new Piece("overdrive-spectre", Emplacement.Overdrive, "190, 150, 255", Condition.ParMultiplicateur(10)),
      new Piece("noyau-blanc", Emplacement.Noyau, "255, 255, 255", Condition.Depart()),
      new Piece("noyau-braise", Emplacement.Noyau, "255, 170, 110", Condition.ParTotal("defis", 3)),
      new Piece("noyau-violet", Emplacement.Noyau, "190, 150, 255", Condition.ParTotal("parfaits", 100)),
    };
  }
}
