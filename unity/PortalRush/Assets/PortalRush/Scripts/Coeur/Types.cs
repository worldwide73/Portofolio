// PORTAL RUSH (Unity) — LES TYPES DE LA RÈGLE
//
// Portage fidèle de src/scripts/rush/donnees.ts, equilibrage.ts et moteur.ts (jeu web). Ce dossier « Coeur » ne
// dépend pas de Unity : il se compile aussi en .NET pur (outils/unity/coeur-tests) et rejoue les parties de
// référence enregistrées par le moteur TypeScript. Les noms suivent ceux du jeu web.
#nullable enable
using System;
using System.Collections.Generic;

namespace PortalRush.Coeur
{
  public enum Mode { Campagne, Infini, Defi }
  public enum Difficulte { Pilote, As, Expert, Cauchemar, Paradoxe }
  public enum Famille { Simple, Double, Escalier, Zigzag, Couloir, Essaim, Laser, Glissement, Portail, Risque, Frappe, Balayage, Grille, Effondrement, Drones, Portes, Rotors, Chutes, Convoi }
  public enum NomPhase { Calibrage, Acceleration, Pression, Finale, Assaut, Tempete, Effondrement }
  public enum TypeObjectif { Fin, Fragments, Parfaits, Portails, Boss, Score, Combo, ChocsMax }
  public enum Theme { Lancement, Neon, Debris, Laser, Rift, Tempete, Sentinelle, Singularite, Infini, Defi }
  public enum Emplacement { Coque, Trainee, Overdrive, Noyau }
  public enum TypeObjet { Bloc, Debris, Laser, Mobile, Faille, Portail, Fragment, Dore, Noyau, Frappe, Drone, Porte, Rotor, Chute, Eclaireur }
  public enum TypeEvenement { Deplacement, Parfait, Fragment, Dore, Noyau, Choc, Portail, Overdrive, FinOverdrive, Pret, Detruit, BossTouche, PhaseBoss, Phase, Motif, ComboPerdu, Conseil, OdOuvert, Fin }
  public enum EtatOverdrive { Verrouille, Charge, Pret, Actif, Utilise }

  public sealed class Objectif
  {
    public readonly TypeObjectif Type;
    public readonly double Valeur;
    public Objectif(TypeObjectif type, double valeur) { Type = type; Valeur = valeur; }
  }

  public sealed class Phase
  {
    /** Jusqu'où va la phase : fraction du parcours, dégâts faits au boss, ou mètres (survie). */
    public readonly double Fin;
    public readonly NomPhase Nom;
    /** Les familles de motifs et leurs poids, DANS L'ORDRE du jeu web (le tirage en dépend). */
    public readonly (Famille Famille, double Poids)[] Familles;
    public readonly bool Pression;
    public Phase(double fin, NomPhase nom, (Famille, double)[] familles, bool pression)
    {
      Fin = fin;
      Nom = nom;
      Familles = familles;
      Pression = pression;
    }
  }

  public sealed class BossDef
  {
    public readonly double Vie;
    public readonly int Phases;
    public BossDef(double vie, int phases) { Vie = vie; Phases = phases; }
  }

  public sealed class Niveau
  {
    public int Id;
    /** Longueur (m) ; 0 : jusqu'à la chute du boss ; l'infini en survie. */
    public double Longueur;
    public Theme Theme;
    public double Vitesse, Ecart, Complexite;
    public Phase[] Phases = Array.Empty<Phase>();
    public Objectif Objectif = new Objectif(TypeObjectif.Fin, 0);
    public Objectif[] Maitrise = Array.Empty<Objectif>();
    public double[]? Etoiles;
    public double? Brume;
    public BossDef? Boss;
    public bool Tutoriel;
  }

  public sealed class Profil
  {
    public double Score;
    public (double Depart, double Max, double Acceleration) Vitesse;
    public (double Depart, double Min, double Resserrement) Ecart;
    public (double Depart, double Min, double Sur) Reaction;
    public (double Depart, double Max, double ParMotif) Complexite;
    public int Boucliers;
    public double Invulnerable, Fragments, GainOverdrive;
    public (double Duree, int Charges, double Multiplicateur) Overdrive;
    public double Parfait, ComboDelai;
    public (double ToutesLes, int Motifs) Pression;
  }

  public sealed class Condition
  {
    public string Type = "depart";
    public int Niveau;
    public string Rang = "";
    public Difficulte Difficulte;
    public double Valeur;
    public string Stat = "";
    public static Condition Depart() => new Condition { Type = "depart" };
    public static Condition ParNiveau(int n) => new Condition { Type = "niveau", Niveau = n };
    public static Condition ParRang(string r) => new Condition { Type = "rang", Rang = r };
    public static Condition ParDifficulte(Difficulte d) => new Condition { Type = "difficulte", Difficulte = d };
    public static Condition ParInfini(double distance) => new Condition { Type = "infini", Valeur = distance };
    public static Condition ParTotal(string stat, double valeur) => new Condition { Type = "total", Stat = stat, Valeur = valeur };
    public static Condition ParMultiplicateur(double valeur) => new Condition { Type = "multiplicateur", Valeur = valeur };
  }

  public sealed class Vehicule
  {
    public readonly string Id;
    /** La silhouette (0 Aube, 1 Faucon, 2 Bastion, 3 Spectre). */
    public readonly int Modele;
    /** Durée d'un changement de voie (facteur), boucliers en plus ou en moins, fenêtre du Perfect Dodge, gain de jauge. */
    public readonly double Deplacement;
    public readonly int Boucliers;
    public readonly double Parfait, Jauge;
    public readonly Condition Condition;
    public Vehicule(string id, int modele, double deplacement, int boucliers, double parfait, double jauge, Condition condition)
    {
      Id = id;
      Modele = modele;
      Deplacement = deplacement;
      Boucliers = boucliers;
      Parfait = parfait;
      Jauge = jauge;
      Condition = condition;
    }
  }

  public sealed class Piece
  {
    public readonly string Id;
    public readonly Emplacement Emplacement;
    /** « r, g, b » ou « prisme ». */
    public readonly string Couleur;
    public readonly Condition Condition;
    public Piece(string id, Emplacement emplacement, string couleur, Condition condition)
    {
      Id = id;
      Emplacement = emplacement;
      Couleur = couleur;
      Condition = condition;
    }
  }

  /** Un objet du parcours (obstacle, fragment, portail…). */
  public sealed class Objet
  {
    public int Id;
    public TypeObjet Type;
    /** Sa position sur le parcours (m) : le début, pour un couloir. */
    public double Pos;
    /** Les voies qu'il bloque une fois sa configuration figée (ou la voie qu'il occupe). */
    public int[] Voies = Array.Empty<int>();
    public double? Longueur;
    /** Les configurations d'approche, chacune valable tant que l'objet est plus loin que « Des » (m). */
    public List<(double Des, int[] Voies)>? Avant;
    public double? Fige;
    public int? Vers;
    public bool Chaud;
    public int? Lie;
    public int? Motif;
    public bool Passe, Touche, Detruit;
    public double Graine;
  }

  public readonly struct Evenement
  {
    public readonly TypeEvenement Type;
    public readonly double? Valeur;
    public readonly int? Voie;
    public Evenement(TypeEvenement type, double? valeur = null, int? voie = null)
    {
      Type = type;
      Valeur = valeur;
      Voie = voie;
    }
  }

  public sealed class ObjectifAtteint
  {
    public TypeObjectif Type;
    public double Valeur;
    public bool Atteint;
    public double Mesure;
  }

  public sealed class Resultat
  {
    public bool Reussi, Arrive;
    public List<ObjectifAtteint> Objectifs = new List<ObjectifAtteint>();
    public double Score;
    public string Rang = "—";
    public double Note;
    public int Fragments, FragmentsVus, Parfaits, ComboMax, MultiplicateurMax, Motifs;
    public double Distance, Temps;
    public int Chocs, Portails, Overdrives;
  }

  /** Les noms du jeu web (sauvegardes, pont JavaScript, parties de référence). */
  public static class Noms
  {
    static string Kebab(string s)
    {
      var r = new System.Text.StringBuilder();
      for (int i = 0; i < s.Length; i++)
      {
        char c = s[i];
        if (char.IsUpper(c) && i > 0) r.Append('-');
        r.Append(char.ToLowerInvariant(c));
      }
      return r.ToString();
    }
    static string Camel(string s) => char.ToLowerInvariant(s[0]) + s.Substring(1);
    public static string De(TypeObjet t) => Camel(t.ToString());
    public static string De(TypeEvenement t) => Kebab(t.ToString());
    public static string De(Difficulte d) => Camel(d.ToString());
    public static string De(Mode m) => Camel(m.ToString());
    public static string De(Theme t) => Camel(t.ToString());
    public static string De(TypeObjectif t) => Camel(t.ToString());
    public static string De(EtatOverdrive e) => Camel(e.ToString());
    public static T Vers<T>(string nom) where T : struct, Enum
    {
      foreach (T v in (T[])Enum.GetValues(typeof(T)))
      {
        string n = typeof(T) == typeof(TypeEvenement) ? Kebab(v.ToString()) : Camel(v.ToString());
        if (n == nom) return v;
      }
      throw new ArgumentException($"Nom inconnu pour {typeof(T).Name} : {nom}");
    }
  }
}
