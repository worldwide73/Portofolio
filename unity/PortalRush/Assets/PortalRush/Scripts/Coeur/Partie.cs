// PORTAL RUSH (Unity) — LE MOTEUR (règles, version 5)
//
// Portage ligne à ligne de src/scripts/rush/moteur.ts (classe Partie). Toute la règle, sans rien dessiner : le
// parcours est une ligne droite de « Distance » mètres ; chaque objet a une position fixe ; à son passage, on
// regarde la voie (choc, esquive, Perfect Dodge, ramassage). Le générateur pose des MOTIFS en garantissant
// qu'une voie libre reste atteignable (règle de justice). Voir l'en-tête du fichier TypeScript.
//
// FIDÉLITÉ. Les mêmes graines donnent exactement les mêmes parcours que le jeu web : les tirages se font dans le
// même ordre (y compris les évaluations court-circuitées « a || h() < x »), les ensembles gardent l'ordre
// d'insertion (Set JavaScript), Math.round est reproduit (arrondi vers +∞ à 0,5). Vérifié par les parties de
// référence (Tests/Editor/References, et outils/unity/coeur-tests en .NET).
//
// Dans Unity, la scène lit cet état à chaque image (Distance, X, objets, évènements) pour poser le monde courbe :
// la piste 3D est une ligne droite « dépliée » le long d'une trajectoire (Jeu/Parcours.cs).
#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;

namespace PortalRush.Coeur
{
  /** Un ensemble d'entiers qui garde l'ordre d'insertion (comme Set en JavaScript). */
  sealed class Ensemble
  {
    readonly List<int> v = new List<int>();
    public Ensemble() { }
    public Ensemble(IEnumerable<int> init) { foreach (var x in init) Ajouter(x); }
    public void Ajouter(int x) { if (!v.Contains(x)) v.Add(x); }
    public void Retirer(int x) { v.Remove(x); }
    public bool Contient(int x) => v.Contains(x);
    public int Taille => v.Count;
    public int[] Liste() => v.ToArray();
  }

  public sealed class Partie
  {
    public readonly Mode Mode;
    public readonly Difficulte Difficulte;
    public readonly Profil Profil;
    public readonly Niveau NiveauBase;
    public readonly double Graine;
    Hasard hasard;
    public readonly Vehicule Vehicule;
    public readonly double DureeDeplacement;

    // ---- L'état visible ----
    public double Distance, Temps, Vitesse;
    /** La voie visée (0, 1, 2) et la position réelle du vaisseau, qui glisse vers elle. */
    public int Voie = 1;
    public double X = 1;
    public int VoiePrecedente = 1;
    public double DernierDeplacement = -10;
    public int Boucliers;
    public int BouclierMax = 1;
    public double Invincible;
    /** Une étape du tutoriel retient le vaisseau. */
    public bool Figee;
    /** Le tutoriel pilote la partie (générateur muet, objets posés à la main, vitesse imposée, chocs sans coût). */
    public bool Scriptee;
    public double? VitesseImposee;
    bool odAnnonce;
    public double Score;
    public int Combo, ComboMax, MultiplicateurMax = 1;
    public double DernierSucces;
    public double Jauge;
    public double Overdrive;
    public int Charges;
    public double MultOverdrive = 1;
    public int Overdrives, Fragments, FragmentsVus, Parfaits, Portails, Chocs, MotifsReussis;
    public List<Objet> Objets = new List<Objet>();
    public readonly List<Evenement> Evenements = new List<Evenement>();
    public Resultat? Termine;
    public sealed class EtatBoss { public double Vie; public double Max; public int Phase; public int Phases; }
    public EtatBoss? Boss;
    public int Conseil = -1;
    public int PhaseIndex;

    // ---- Le générateur ----
    double derniere = 50;
    Ensemble atteignables = new Ensemble(new[] { 1 });
    int compteur;
    int motifsPoses;
    double prochainePression;
    readonly HashSet<int> signatures = new HashSet<int>();
    sealed class Motif { public int Id; public Famille Famille; public double Complexite; public double Fin; public int Chocs; public bool Regle; }
    readonly Dictionary<int, Motif> motifs = new Dictionary<int, Motif>();
    double incertainJusqua;

    static readonly int[] Toutes = { 0, 1, 2 };
    const int Voies = 3;
    static double Borner(double v, double min, double max) => Math.Min(max, Math.Max(min, v));
    /** Math.round de JavaScript. */
    static double Arrondi(double x) => Math.Floor(x + 0.5);
    static bool EstFini(double x) => !double.IsInfinity(x) && !double.IsNaN(x);
    public static bool EstObstacle(TypeObjet t) => t == TypeObjet.Bloc || t == TypeObjet.Debris || t == TypeObjet.Laser || t == TypeObjet.Mobile || t == TypeObjet.Faille || t == TypeObjet.Frappe || t == TypeObjet.Drone || t == TypeObjet.Porte || t == TypeObjet.Rotor || t == TypeObjet.Chute || t == TypeObjet.Eclaireur;
    /** Distance d'apparition des objets : au moins 95 m, et 1,4 s à la vitesse en cours. */
    public static double ApparitionA(double vitesse) => Math.Max(95, vitesse * 1.4);

    /** graine : null → tirée au hasard (ou celle du jour pour le défi), comme dans le jeu web. */
    public Partie(Mode mode, Difficulte difficulte, int niveauId = 1, double? graine = null, string? vehicule = null, DateTime? aujourdhui = null)
    {
      Mode = mode;
      Difficulte = mode == Mode.Defi ? Donnees.DifficulteDefi : difficulte;
      Profil = Donnees.Profils[Difficulte];
      string idVehicule = mode == Mode.Defi ? "aube" : vehicule ?? "";
      Vehicule = Array.Find(Donnees.Vehicules, v => v.Id == idVehicule) ?? Donnees.Vehicules[0];
      DureeDeplacement = Donnees.Deplacement * Vehicule.Deplacement;
      NiveauBase = mode == Mode.Campagne ? Donnees.Niveaux[niveauId - 1] : mode == Mode.Defi ? Donnees.Defi : Donnees.NiveauInfini();
      DateTime jour = aujourdhui ?? DateTime.Now;
      Graine = graine ?? (mode == Mode.Defi ? jour.Year * 10000 + jour.Month * 100 + jour.Day : Math.Floor(new Random().NextDouble() * 1e9));
      hasard = new Hasard(Graine);
      Boucliers = mode == Mode.Infini ? Donnees.InfiniBoucliers : Math.Max(1, Profil.Boucliers + Vehicule.Boucliers);
      BouclierMax = Boucliers;
      if (NiveauBase.Boss != null)
      {
        double vie = Arrondi(NiveauBase.Boss.Vie * Donnees.BossVie[Difficulte]);
        Boss = new EtatBoss { Vie = vie, Max = vie, Phase = 1, Phases = NiveauBase.Boss.Phases };
      }
      prochainePression = Profil.Pression.ToutesLes;
      Vitesse = VitesseA(0);
    }

    // ==========================================================================
    // LES COURBES
    // ==========================================================================
    double V0 => Profil.Vitesse.Depart * NiveauBase.Vitesse;
    public double VitesseA(double pos)
    {
      double a = Profil.Vitesse.Acceleration, vmax = Profil.Vitesse.Max;
      double v = Math.Sqrt(V0 * V0 + 2 * a * Math.Max(0, pos));
      if (v <= vmax || Mode != Mode.Infini) return Math.Min(vmax, v);
      double dmax = (vmax * vmax - V0 * V0) / (2 * a);
      double s = Donnees.InfiniSurcroit;
      return Math.Min(Donnees.InfiniPlafond, Math.Sqrt(vmax * vmax + 2 * s * Math.Max(0, pos - dmax)));
    }
    public double TempsA(double pos)
    {
      double a = Profil.Vitesse.Acceleration, vmax = Profil.Vitesse.Max;
      double dmax = (vmax * vmax - V0 * V0) / (2 * a);
      if (pos <= dmax) return (VitesseA(pos) - V0) / a;
      if (Mode == Mode.Infini)
      {
        double v = VitesseA(pos);
        double s = Donnees.InfiniSurcroit;
        double dplaf = dmax + (Math.Pow(Donnees.InfiniPlafond, 2) - vmax * vmax) / (2 * s);
        if (pos <= dplaf) return (vmax - V0) / a + (v - vmax) / s;
        return (vmax - V0) / a + (Donnees.InfiniPlafond - vmax) / s + (pos - dplaf) / Donnees.InfiniPlafond;
      }
      return (vmax - V0) / a + (pos - dmax) / vmax;
    }
    public double EcartA(double pos)
    {
      var e = Profil.Ecart;
      return Math.Max(e.Min, e.Depart * NiveauBase.Ecart - e.Resserrement * TempsA(pos));
    }
    public double ReactionA(double pos)
    {
      var r = Profil.Reaction;
      return Math.Max(r.Min, r.Depart - (r.Depart - r.Min) * Math.Min(1, TempsA(pos) / r.Sur));
    }
    public double Complexite
    {
      get
      {
        var c = Profil.Complexite;
        double avancee = Mode == Mode.Campagne && EstFini(Longueur) ? 0.18 * Borner(derniere / Longueur, 0, 1) : 0;
        return Borner(c.Depart + NiveauBase.Complexite + c.ParMotif * motifsPoses + avancee, 0, c.Max);
      }
    }

    // ---- L'Overdrive rare ----
    public bool OverdriveOuvert
    {
      get
      {
        if (Overdrives >= Donnees.OverdriveParPartie) return false;
        double seuil = EstFini(Longueur) ? Math.Max(Donnees.OverdriveDepartMetres, Donnees.OverdriveDepartPart * Longueur) : Donnees.OverdriveDepartMetres;
        return Boss != null ? Avancement >= 0.2 || Distance >= Donnees.OverdriveDepartMetres : Distance >= seuil;
      }
    }
    public EtatOverdrive EtatOverdrive
    {
      get
      {
        if (Overdrive > 0) return EtatOverdrive.Actif;
        if (Overdrives >= Donnees.OverdriveParPartie) return EtatOverdrive.Utilise;
        if (!OverdriveOuvert) return EtatOverdrive.Verrouille;
        return Jauge >= 1 ? EtatOverdrive.Pret : EtatOverdrive.Charge;
      }
    }
    public double SeuilOverdrive => EstFini(Longueur) && Boss == null ? Math.Max(Donnees.OverdriveDepartMetres, Donnees.OverdriveDepartPart * Longueur) : Donnees.OverdriveDepartMetres;
    public double Apparition => ApparitionA(Vitesse);
    public double Longueur => NiveauBase.Longueur > 0 ? NiveauBase.Longueur : double.PositiveInfinity;
    public double Avancement
    {
      get
      {
        if (Boss != null) return 1 - Boss.Vie / Boss.Max;
        return EstFini(Longueur) ? Borner(Distance / Longueur, 0, 1) : 0;
      }
    }
    public int Multiplicateur => (int)Math.Min(Donnees.ComboMax, 1 + Math.Floor((double)Combo / Donnees.ComboParCran));
    public double ComboRestant => Combo == 0 ? 0 : Borner(1 - (Temps - DernierSucces) / Profil.ComboDelai, 0, 1);
    public int PhaseA(double pos)
    {
      var phases = NiveauBase.Phases;
      double repere = Mode == Mode.Infini ? pos : Boss != null ? Avancement : EstFini(Longueur) ? pos / Longueur : 0;
      int i = Array.FindIndex(phases, p => repere < p.Fin);
      return i < 0 ? phases.Length - 1 : i;
    }
    public Phase PhaseCourante => NiveauBase.Phases[PhaseIndex];

    // ==========================================================================
    // LES COMMANDES
    // ==========================================================================
    public void Deplacer(int sens)
    {
      if (Figee || Termine != null) return;
      int cible = (int)Borner(Voie + sens, 0, Voies - 1);
      if (cible == Voie) return;
      VoiePrecedente = Voie;
      Voie = cible;
      DernierDeplacement = Temps;
      Evenements.Add(new Evenement(TypeEvenement.Deplacement, null, cible));
    }

    public bool Declencher()
    {
      if (Termine != null || Jauge < 1 || Overdrive > 0 || !OverdriveOuvert) return false;
      var o = Profil.Overdrive;
      Overdrive = o.Duree;
      Charges = o.Charges;
      MultOverdrive = o.Multiplicateur + Donnees.OverdriveComboBonus * Math.Min(1, Combo / Donnees.OverdriveComboCombo);
      Jauge = 0;
      Overdrives++;
      Evenements.Add(new Evenement(TypeEvenement.Overdrive, MultOverdrive));
      if (Boss != null) ToucherBoss(Donnees.BossDegatsOverdrive);
      return true;
    }

    // ==========================================================================
    // UNE IMAGE DU JEU
    // ==========================================================================
    public void Avancer(double dt)
    {
      if (Termine != null) return;
      Temps += dt;
      Vitesse = VitesseImposee ?? VitesseA(Distance);
      double pas = Vitesse * dt;
      Distance += pas;
      double glisse = dt / DureeDeplacement;
      X += Borner(Voie - X, -glisse, glisse);
      Invincible = Math.Max(0, Invincible - dt);
      if (Overdrive > 0)
      {
        Overdrive -= dt;
        if (Overdrive <= 0)
        {
          Overdrive = 0;
          Charges = 0;
          Evenements.Add(new Evenement(TypeEvenement.FinOverdrive));
        }
      }
      if (Combo > 0 && Temps - DernierSucces > Profil.ComboDelai)
      {
        Combo = 0;
        Evenements.Add(new Evenement(TypeEvenement.ComboPerdu));
      }
      Score += pas * Donnees.Points.Metre * Profil.Score * (Overdrive > 0 ? MultOverdrive : 1);

      int phase = PhaseA(Distance);
      if (phase != PhaseIndex && !Scriptee)
      {
        PhaseIndex = phase;
        Evenements.Add(new Evenement(TypeEvenement.Phase, phase));
      }
      Tutoriel();
      if (!odAnnonce && !Scriptee && OverdriveOuvert && Overdrives == 0)
      {
        odAnnonce = true;
        Evenements.Add(new Evenement(TypeEvenement.OdOuvert));
      }
      GenererJusqua(Distance + Apparition);

      foreach (var o in Objets)
      {
        if (o.Detruit && o.Type != TypeObjet.Faille) continue;
        if (o.Type == TypeObjet.Faille && o.Longueur.HasValue && o.Longueur.Value != 0)
        {
          double l = o.Longueur.Value;
          if (!o.Touche && !o.Detruit && Distance >= o.Pos && Distance <= o.Pos + l && Array.IndexOf(o.Voies, VoieOccupee) >= 0) Heurter(o);
          if (!o.Passe && Distance > o.Pos + l)
          {
            o.Passe = true;
            FinirMotif(o);
          }
          continue;
        }
        if (o.Passe || o.Pos > Distance) continue;
        o.Passe = true;
        Franchir(o);
        if (Termine != null) return;
      }
      Objets = Objets.Where(o => o.Pos + (o.Longueur ?? 0) - Distance > -16).ToList();

      if (Scriptee) return;
      if (Boss != null ? Boss.Vie <= 0 : Distance >= Longueur) Finir(true);
    }

    /** Le tutoriel pose un objet à « devant » mètres du vaisseau. */
    public Objet Placer(TypeObjet type, double devant, int[] voies, List<(double Des, int[] Voies)>? avant = null, double? fige = null)
    {
      var o = NouvelObjet(type, Distance + devant, voies, EstObstacle(type) ? 0 : (int?)null);
      if (avant != null) o.Avant = avant;
      if (fige.HasValue) o.Fige = fige;
      return o;
    }
    /** Retire tout ce qui est encore devant le vaisseau. */
    public void Vider() => Objets = Objets.Where(o => o.Pos < Distance - 1).ToList();

    /** Les voies bloquées par un obstacle quand il est à « z » mètres du vaisseau. */
    public int[] VoiesA(Objet o, double z)
    {
      if (o.Avant == null || z <= (o.Fige ?? 0)) return o.Voies;
      foreach (var etat in o.Avant) if (z > etat.Des) return etat.Voies;
      return o.Voies;
    }

    public int VoieOccupee => (int)Arrondi(X);

    void Franchir(Objet o)
    {
      int ici = VoieOccupee;
      if (o.Type == TypeObjet.Fragment || o.Type == TypeObjet.Dore || o.Type == TypeObjet.Noyau)
      {
        if (o.Type != TypeObjet.Noyau) FragmentsVus++;
        if (o.Voies[0] != ici) return;
        o.Detruit = true;
        if (o.Type == TypeObjet.Noyau)
        {
          double gain = Reussite(Donnees.Points.Dore, Donnees.Jauge.Dore);
          Evenements.Add(new Evenement(TypeEvenement.Noyau, gain, ici));
          ToucherBoss(Donnees.BossDegatsNoyau);
        }
        else
        {
          Fragments++;
          bool dore = o.Type == TypeObjet.Dore;
          double gain = Reussite(dore ? Donnees.Points.Dore : Donnees.Points.Fragment, dore ? Donnees.Jauge.Dore : Donnees.Jauge.Fragment);
          Evenements.Add(new Evenement(dore ? TypeEvenement.Dore : TypeEvenement.Fragment, gain, ici));
        }
        return;
      }
      if (o.Type == TypeObjet.Portail)
      {
        if (o.Voies[0] != ici || !o.Vers.HasValue) return;
        Voie = o.Vers.Value;
        X = o.Vers.Value;
        VoiePrecedente = o.Vers.Value;
        Portails++;
        Evenements.Add(new Evenement(TypeEvenement.Portail, null, o.Vers.Value));
        return;
      }
      var bloquees = VoiesA(o, 0);
      if (Array.IndexOf(bloquees, ici) >= 0) Heurter(o);
      else if (Array.IndexOf(bloquees, VoiePrecedente) >= 0 && VoiePrecedente != ici && Temps - DernierDeplacement <= Profil.Parfait * Vehicule.Parfait)
      {
        Parfaits++;
        double gain = Reussite(Donnees.Points.Parfait, Donnees.Jauge.Parfait);
        Evenements.Add(new Evenement(TypeEvenement.Parfait, gain, VoiePrecedente));
        if (Boss != null && o.Chaud) ToucherBoss(Donnees.BossDegatsParfait);
      }
      FinirMotif(o);
    }

    void Heurter(Objet o)
    {
      o.Touche = true;
      if (Overdrive > 0 && Charges > 0)
      {
        Charges--;
        o.Detruit = true;
        Score += Donnees.Points.Brise * Profil.Score * MultOverdrive;
        Evenements.Add(new Evenement(TypeEvenement.Detruit, Arrondi(Donnees.Points.Brise * Profil.Score * MultOverdrive), VoieOccupee));
        if (Boss != null) ToucherBoss(Donnees.BossDegatsBrise);
        return;
      }
      if (Invincible > 0) return;
      if (Scriptee)
      {
        Chocs++;
        Invincible = 0.6;
        Evenements.Add(new Evenement(TypeEvenement.Choc, Boucliers));
        return;
      }
      Boucliers--;
      Chocs++;
      Combo = 0;
      if (Overdrive <= 0) Jauge = Math.Max(0, Jauge - Donnees.Jauge.Choc);
      Invincible = Profil.Invulnerable;
      if (o.Motif.HasValue && motifs.TryGetValue(o.Motif.Value, out var m)) m.Chocs++;
      Evenements.Add(new Evenement(TypeEvenement.Choc, Boucliers));
      if (Boucliers <= 0) Finir(false);
    }

    double Reussite(double points, double jauge)
    {
      Combo++;
      DernierSucces = Temps;
      ComboMax = Math.Max(ComboMax, Combo);
      MultiplicateurMax = Math.Max(MultiplicateurMax, Multiplicateur);
      double gain = Arrondi(points * Multiplicateur * Profil.Score * (Overdrive > 0 ? MultOverdrive : 1));
      Score += gain;
      if (Overdrive <= 0 && OverdriveOuvert)
      {
        double avant = Jauge;
        Jauge = Math.Min(1, Jauge + jauge * Profil.GainOverdrive * Vehicule.Jauge);
        if (avant < 1 && Jauge >= 1) Evenements.Add(new Evenement(TypeEvenement.Pret));
      }
      return gain;
    }

    void FinirMotif(Objet o)
    {
      if (!o.Motif.HasValue) return;
      if (!motifs.TryGetValue(o.Motif.Value, out var m) || m.Regle || o.Pos + (o.Longueur ?? 0) < m.Fin) return;
      m.Regle = true;
      motifs.Remove(m.Id);
      if (m.Chocs > 0) return;
      MotifsReussis++;
      double gain = Reussite(Donnees.Points.Motif + Donnees.Points.MotifComplexite * m.Complexite, Donnees.Jauge.Motif);
      Evenements.Add(new Evenement(TypeEvenement.Motif, gain));
    }

    void ToucherBoss(double degats)
    {
      if (Boss == null || Boss.Vie <= 0) return;
      Boss.Vie = Math.Max(0, Boss.Vie - degats);
      Score += Donnees.Points.Boss * degats * Profil.Score;
      Evenements.Add(new Evenement(TypeEvenement.BossTouche, Boss.Vie));
      int phase = (int)Math.Min(Boss.Phases, 1 + Math.Floor((1 - Boss.Vie / Boss.Max) * Boss.Phases));
      if (phase != Boss.Phase && Boss.Vie > 0)
      {
        Boss.Phase = phase;
        Evenements.Add(new Evenement(TypeEvenement.PhaseBoss, phase));
      }
    }

    void Tutoriel()
    {
      if (!NiveauBase.Tutoriel || Mode != Mode.Campagne || Scriptee) return;
      double[] etapes = { 20, 380, 760, 1150 };
      int prochain = Conseil + 1;
      if (prochain < etapes.Length && Distance >= etapes[prochain])
      {
        Conseil = prochain;
        Evenements.Add(new Evenement(TypeEvenement.Conseil, prochain));
      }
    }

    double Mesurer(Objectif o)
    {
      switch (o.Type)
      {
        case TypeObjectif.Fragments: return Fragments;
        case TypeObjectif.Parfaits: return Parfaits;
        case TypeObjectif.Portails: return Portails;
        case TypeObjectif.Combo: return ComboMax;
        case TypeObjectif.ChocsMax: return Chocs;
        case TypeObjectif.Score: return Arrondi(Score);
        case TypeObjectif.Boss: return Boss != null ? Arrondi((1 - Boss.Vie / Boss.Max) * 100) : 0;
        default: return Arrondi(Distance);
      }
    }
    bool Atteint(Objectif o, bool arrive)
    {
      double m = Mesurer(o);
      switch (o.Type)
      {
        case TypeObjectif.Fin: return arrive;
        case TypeObjectif.Boss: return arrive && Boss != null && Boss.Vie <= 0;
        case TypeObjectif.ChocsMax: return arrive && m <= o.Valeur;
        default: return m >= o.Valeur;
      }
    }

    void Finir(bool arrive)
    {
      if (Termine != null) return;
      var n = NiveauBase;
      bool infini = Mode == Mode.Infini;
      var principal = new ObjectifAtteint { Type = n.Objectif.Type, Valeur = n.Objectif.Valeur, Atteint = Atteint(n.Objectif, arrive), Mesure = Mesurer(n.Objectif) };
      var maitrise = infini ? new List<ObjectifAtteint>() : n.Maitrise.Select(o => new ObjectifAtteint { Type = o.Type, Valeur = o.Valeur, Atteint = Atteint(o, arrive), Mesure = Mesurer(o) }).ToList();
      bool reussi = arrive && principal.Atteint && !infini;
      foreach (var o in maitrise) if (o.Atteint) Score += Donnees.Points.Objectif * Profil.Score;
      double cible = n.Objectif.Type == TypeObjectif.Parfaits ? n.Objectif.Valeur : 10;
      double note = Arrondi(
        (reussi ? 35 : 10) +
        (30.0 * maitrise.Count(o => o.Atteint)) / Math.Max(1, maitrise.Count) +
        15 * Math.Min(1, Parfaits / cible) +
        10 * (Chocs == 0 ? 1 : Math.Pow(0.4, Chocs)) +
        10 * (FragmentsVus != 0 ? (double)Fragments / FragmentsVus : 1));
      string rang = "C";
      foreach (var (r, seuil) in Donnees.Rangs) if (note >= seuil) { rang = r; break; }
      if (rang == "SSS" && Chocs > 0) rang = "S";
      if (!reussi || infini) rang = "—";
      Score = Arrondi(Score);
      var objectifs = new List<ObjectifAtteint>();
      if (!infini)
      {
        objectifs.Add(principal);
        objectifs.AddRange(maitrise);
      }
      Termine = new Resultat
      {
        Reussi = reussi,
        Arrive = arrive,
        Objectifs = objectifs,
        Score = Score,
        Rang = rang,
        Note = note,
        Fragments = Fragments,
        FragmentsVus = FragmentsVus,
        Parfaits = Parfaits,
        ComboMax = ComboMax,
        MultiplicateurMax = MultiplicateurMax,
        Motifs = MotifsReussis,
        Distance = Arrondi(Distance),
        Temps = Temps,
        Chocs = Chocs,
        Portails = Portails,
        Overdrives = Overdrives,
      };
      Evenements.Add(new Evenement(TypeEvenement.Fin));
    }

    // ==========================================================================
    // LE GÉNÉRATEUR
    // ==========================================================================
    double H() => hasard.Suivant();
    int Tirer(int[] liste) => liste[(int)Math.Floor(H() * liste.Length) % liste.Length];
    static int[] Sauf(int libre) => Toutes.Where(v => v != libre).ToArray();

    public void GenererJusqua(double limite)
    {
      if (Scriptee) return;
      while (derniere < limite)
      {
        if (derniere > Longueur - 90)
        {
          derniere = double.PositiveInfinity;
          return;
        }
        int phaseIndex = PhaseA(derniere);
        var phase = NiveauBase.Phases[phaseIndex];
        if (!signatures.Contains(phaseIndex) && Mode != Mode.Infini && derniere > 150)
        {
          signatures.Add(phaseIndex);
          MotifSignature(phaseIndex);
          continue;
        }
        bool enPression = derniere >= prochainePression || (phase.Pression && H() < 0.12);
        if (enPression && derniere > 250)
        {
          prochainePression = derniere + Profil.Pression.ToutesLes * (phase.Pression ? 0.6 : 1);
          for (int k = 0; k < Profil.Pression.Motifs; k++) PoserMotif(ChoisirFamille(phase), k == 0 ? 0.8 : 0.35);
          continue;
        }
        PoserMotif(ChoisirFamille(phase), derniere < 120 ? 1.3 : 1);
      }
    }

    Famille ChoisirFamille(Phase phase)
    {
      var poids = phase.Familles.Where(f => f.Poids > 0).ToArray();
      double total = poids.Sum(f => f.Poids);
      double tirage = H() * total;
      foreach (var (f, p) in poids)
      {
        tirage -= p;
        if (tirage <= 0) return f;
      }
      return poids.Length > 0 ? poids[0].Famille : Famille.Simple;
    }

    void MotifSignature(int phaseIndex)
    {
      var sauve = hasard;
      hasard = new Hasard(NiveauBase.Id * 1000 + phaseIndex * 37 + 7);
      var phase = NiveauBase.Phases[phaseIndex];
      var familles = phase.Familles.Select(f => f.Famille).ToArray();
      PoserMotif(Array.IndexOf(familles, Famille.Zigzag) >= 0 ? Famille.Zigzag : familles[0], 1);
      hasard = sauve;
    }

    /** Une rangée à poser, telle qu'un motif la décrit. */
    sealed class Etape
    {
      public TypeObjet Type;
      public int[] Voies = Array.Empty<int>();
      public double Ecart;
      public bool Chaine, Changeant, Chaud, Choix;
      public double? Longueur;
      public int? Portail;
      public List<(int Voie, bool Dore, double? Nombre)>? Fragments;
      public int? Noyau;
    }

    void PoserMotif(Famille famille, double ecartMotif)
    {
      double c = Complexite;
      var etapes = Construire(famille, c);
      if (etapes.Count == 0) return;
      etapes[0].Ecart *= ecartMotif;
      var m = new Motif { Id = ++compteur, Famille = famille, Complexite = c };
      motifs[m.Id] = m;
      Objet? precedent = null;
      foreach (var etape in etapes)
      {
        var o = Poser(etape, m.Id);
        if (precedent != null && o != null) precedent.Lie = o.Id;
        if (o != null) precedent = o;
        m.Fin = Math.Max(m.Fin, o != null ? o.Pos + (o.Longueur ?? 0) : m.Fin);
      }
      motifsPoses++;
      if (H() < 0.3 * Profil.Fragments)
      {
        double pos = derniere + 4;
        int v = Tirer(atteignables.Liste());
        NouvelObjet(TypeObjet.Fragment, pos, new[] { v });
      }
    }

    int VoieAtteinte() => Tirer(atteignables.Liste());
    int[] Bloquer(int nombre, int? eviter = null)
    {
      int premiere = H() < 0.6 ? VoieAtteinte() : Tirer(Toutes);
      var bloquees = new Ensemble(new[] { premiere });
      while (bloquees.Taille < nombre) bloquees.Ajouter(Tirer(Toutes));
      if (eviter.HasValue && bloquees.Contient(eviter.Value) && bloquees.Taille == 2)
      {
        bloquees.Retirer(eviter.Value);
        int autre = Array.Find(Toutes, v => !bloquees.Contient(v) && v != eviter.Value);
        bloquees.Ajouter(Array.Exists(Toutes, v => !bloquees.Contient(v) && v != eviter.Value) ? autre : premiere);
      }
      if (bloquees.Taille >= 3) bloquees.Retirer(Tirer(bloquees.Liste()));
      return bloquees.Liste();
    }

    List<Etape> Construire(Famille famille, double c)
    {
      var etapes = new List<Etape>();
      switch (famille)
      {
        case Famille.Simple:
          etapes.Add(new Etape { Type = TypeObjet.Bloc, Voies = Bloquer(1), Ecart = 1 });
          break;
        case Famille.Double:
        {
          var voies = Bloquer(2);
          int libre = Toutes.Where(v => Array.IndexOf(voies, v) < 0).DefaultIfEmpty(1).First();
          var e = new Etape { Type = TypeObjet.Bloc, Voies = voies, Ecart = 1 };
          if (H() < 0.3) e.Fragments = new List<(int, bool, double?)> { (libre, false, null) };
          etapes.Add(e);
          break;
        }
        case Famille.Escalier:
        {
          int n = 3 + (int)Arrondi(2 * c);
          int sens = H() < 0.5 ? 1 : -1;
          int libre = sens > 0 ? 0 : 2;
          for (int k = 0; k < n; k++)
          {
            etapes.Add(new Etape { Type = TypeObjet.Bloc, Voies = Sauf(libre), Ecart = k == 0 ? 1 : 0.55, Chaine = k > 0 });
            libre = (int)Borner(libre + sens, 0, 2);
          }
          break;
        }
        case Famille.Zigzag:
        {
          int n = 3 + (int)Arrondi(3 * c);
          bool large = c >= 0.35;
          int libre = Tirer(large ? new[] { 0, 2 } : Toutes);
          for (int k = 0; k < n; k++)
          {
            etapes.Add(new Etape { Type = TypeObjet.Bloc, Voies = Sauf(libre), Ecart = k == 0 ? 1 : 0.45, Chaine = k > 0, Choix = c > 0.35 });
            libre = large ? 2 - libre : libre == 1 ? Tirer(new[] { 0, 2 }) : 1;
          }
          break;
        }
        case Famille.Couloir:
        {
          bool deux = c >= 0.3 || H() < 0.5;
          var voies = deux ? Bloquer(2) : Bloquer(1);
          var libres = Toutes.Where(v => Array.IndexOf(voies, v) < 0).ToArray();
          double longueur = 22 + 45 * c + H() * 12;
          int voieFragments = Tirer(libres);
          etapes.Add(new Etape
          {
            Type = TypeObjet.Faille, Voies = voies, Longueur = longueur, Ecart = 1, Choix = true,
            Fragments = new List<(int, bool, double?)> { (voieFragments, c > 0.45, 2 + Arrondi(2 * c)) },
          });
          if (c > 0.4) etapes.Add(new Etape { Type = TypeObjet.Bloc, Voies = libres, Ecart = 0.35, Chaine = true });
          break;
        }
        case Famille.Essaim:
        {
          int n = 5 + (int)Arrondi(6 * c);
          for (int k = 0; k < n; k++)
          {
            int nb = c > 0.6 && H() < 0.3 ? 2 : 1;
            etapes.Add(new Etape { Type = TypeObjet.Debris, Voies = Bloquer(nb), Ecart = k == 0 ? 1 : 0.38, Chaine = k > 0 });
          }
          break;
        }
        case Famille.Laser:
        {
          int n = 1 + (int)Arrondi(2 * c);
          for (int k = 0; k < n; k++) etapes.Add(new Etape { Type = TypeObjet.Laser, Voies = Bloquer(c < 0.2 ? 1 : 2), Ecart = k == 0 ? 1 : 0.7, Changeant = true, Chaine = k > 0 });
          break;
        }
        case Famille.Glissement:
          etapes.Add(new Etape { Type = TypeObjet.Mobile, Voies = Bloquer(1), Ecart = 1, Changeant = true });
          if (c > 0.5) etapes.Add(new Etape { Type = TypeObjet.Mobile, Voies = Bloquer(c > 0.75 ? 2 : 1), Ecart = 0.6, Changeant = true, Chaine = true });
          if (c > 0.65) etapes.Add(new Etape { Type = TypeObjet.Bloc, Voies = Bloquer(2), Ecart = 0.5, Chaine = true });
          break;
        case Famille.Portail:
        {
          int voie = VoieAtteinte();
          int vers = Tirer(Toutes.Where(v => v != voie).ToArray());
          etapes.Add(new Etape { Type = TypeObjet.Portail, Voies = new[] { voie }, Portail = vers, Ecart = 1, Fragments = new List<(int, bool, double?)> { (vers, true, null) } });
          etapes.Add(new Etape { Type = TypeObjet.Bloc, Voies = Sauf(vers), Ecart = 0.45, Chaine = true, Choix = true });
          break;
        }
        case Famille.Risque:
        {
          var premiere = Bloquer(1);
          var libres = Toutes.Where(v => Array.IndexOf(premiere, v) < 0).ToArray();
          int riche = Tirer(libres);
          etapes.Add(new Etape { Type = TypeObjet.Bloc, Voies = premiere, Ecart = 1, Fragments = new List<(int, bool, double?)> { (riche, true, 2) } });
          var voies2 = new List<int> { riche };
          if (c > 0.55) voies2.Add(Tirer(Toutes.Where(v => v != riche).ToArray()));
          etapes.Add(new Etape { Type = TypeObjet.Bloc, Voies = voies2.ToArray(), Ecart = 0.42, Chaine = true });
          break;
        }
        case Famille.Frappe:
        {
          int phase = Boss?.Phase ?? 1;
          int n = 1 + (phase >= 2 ? 1 : 0) + (c > 0.6 ? 1 : 0);
          for (int k = 0; k < n; k++)
          {
            int nb = phase >= 2 && H() < 0.6 ? 2 : 1;
            var voies = Bloquer(nb);
            int? noyau = H() < 0.3 ? 1 : (int?)null;
            etapes.Add(new Etape { Type = TypeObjet.Frappe, Voies = voies, Ecart = k == 0 ? 1.1 : 0.55, Chaud = true, Chaine = k > 0, Noyau = noyau });
          }
          break;
        }
        case Famille.Balayage:
        {
          int n = 2 + (c > 0.5 ? 1 : 0);
          for (int k = 0; k < n; k++) etapes.Add(new Etape { Type = TypeObjet.Mobile, Voies = Bloquer(1), Ecart = k == 0 ? 1 : 0.6, Changeant = true, Chaud = true, Chaine = k > 0 });
          break;
        }
        case Famille.Grille:
          etapes.Add(new Etape { Type = TypeObjet.Laser, Voies = Bloquer(2), Ecart = 1, Changeant = true });
          etapes.Add(new Etape { Type = TypeObjet.Laser, Voies = Bloquer(2), Ecart = 0.6, Changeant = true, Chaine = true });
          etapes.Add(new Etape { Type = TypeObjet.Frappe, Voies = Bloquer(2), Ecart = 0.5, Chaud = true, Chaine = true, Noyau = 1 });
          break;
        case Famille.Drones:
        {
          int n = 1 + (c > 0.45 ? 1 : 0) + (c > 0.8 ? 1 : 0);
          for (int k = 0; k < n; k++)
          {
            int nb = c > 0.6 && H() < 0.4 ? 2 : 1;
            etapes.Add(new Etape { Type = TypeObjet.Drone, Voies = Bloquer(nb), Ecart = k == 0 ? 1 : 0.6, Changeant = true, Chaine = k > 0 });
          }
          break;
        }
        case Famille.Portes:
          etapes.Add(new Etape { Type = TypeObjet.Porte, Voies = Bloquer(2), Ecart = 1, Changeant = true });
          if (c > 0.55) etapes.Add(new Etape { Type = TypeObjet.Porte, Voies = Bloquer(2), Ecart = 0.7, Changeant = true, Chaine = true });
          break;
        case Famille.Rotors:
        {
          int n = 1 + (c > 0.5 ? 1 : 0);
          for (int k = 0; k < n; k++) etapes.Add(new Etape { Type = TypeObjet.Rotor, Voies = Bloquer(2), Ecart = k == 0 ? 1 : 0.7, Changeant = true, Chaine = k > 0 });
          break;
        }
        case Famille.Chutes:
        {
          int n = 2 + (int)Arrondi(2 * c);
          for (int k = 0; k < n; k++)
          {
            int nb = c > 0.7 && H() < 0.3 ? 2 : 1;
            etapes.Add(new Etape { Type = TypeObjet.Chute, Voies = Bloquer(nb), Ecart = k == 0 ? 1 : 0.5, Chaine = k > 0 });
          }
          break;
        }
        case Famille.Convoi:
        {
          int n = 2 + (int)Arrondi(2 * c);
          int voie = VoieAtteinte();
          for (int k = 0; k < n; k++)
          {
            etapes.Add(new Etape { Type = TypeObjet.Eclaireur, Voies = new[] { voie }, Ecart = k == 0 ? 1 : 0.45, Chaine = k > 0 });
            int precedente = voie;
            voie = Tirer(Toutes.Where(v => v != precedente).ToArray());
          }
          break;
        }
        case Famille.Effondrement:
        {
          var voies = Bloquer(2);
          int libre = Toutes.Where(v => Array.IndexOf(voies, v) < 0).DefaultIfEmpty(1).First();
          etapes.Add(new Etape { Type = TypeObjet.Faille, Voies = voies, Longueur = 40 + 30 * c, Ecart = 1, Choix = true, Fragments = new List<(int, bool, double?)> { (libre, true, 3) } });
          etapes.Add(new Etape { Type = TypeObjet.Mobile, Voies = new[] { libre }, Ecart = 0.4, Changeant = true, Chaud = true, Chaine = true });
          etapes.Add(new Etape { Type = TypeObjet.Frappe, Voies = Bloquer(2), Ecart = 0.5, Chaud = true, Chaine = true, Noyau = 1 });
          break;
        }
      }
      return etapes;
    }

    /** Pose une étape en respectant la règle de justice. */
    Objet? Poser(Etape e, int motif)
    {
      double pos0 = derniere;
      double v = VitesseA(pos0 + 40) * 1.03;
      double reaction = ReactionA(pos0);
      double r = e.Chaine ? Math.Max(0.12, reaction * 0.55) : reaction;
      bool pieges = e.Choix || Difficulte == Difficulte.Expert || Difficulte == Difficulte.Cauchemar || Difficulte == Difficulte.Paradoxe;

      if (e.Type == TypeObjet.Portail && e.Portail.HasValue)
      {
        double posP = pos0 + Math.Max(EcartA(pos0) * e.Ecart, v * (r + DureeDeplacement) + 3);
        var oP = NouvelObjet(TypeObjet.Portail, posP, e.Voies, motif);
        oP.Vers = e.Portail;
        PoserFragments(e, posP, motif);
        derniere = posP;
        var nouvelles = new Ensemble(atteignables.Liste());
        nouvelles.Ajouter(e.Portail.Value);
        atteignables = nouvelles;
        return oP;
      }

      var libres = Toutes.Where(x => Array.IndexOf(e.Voies, x) < 0).ToArray();
      if (libres.Length == 0) return null;
      double TempsVers(int a, int l) => a == l ? 0 : r + Math.Abs(a - l) * DureeDeplacement;
      var depuis = atteignables.Liste();
      double Meilleur(int a) => libres.Min(l => TempsVers(a, l));
      bool incertain = e.Changeant || pos0 < incertainJusqua;
      double besoin = pieges && !incertain ? depuis.Min(a => Meilleur(a)) : depuis.Max(a => Meilleur(a));
      double ecart = Math.Max(EcartA(pos0) * e.Ecart, v * besoin + 4);
      double? fige = e.Changeant ? v * (reaction + 2 * DureeDeplacement + 0.08) : (double?)null;
      double pos = pos0 + ecart;
      double dt = ecart / v;
      var suivantes = new Ensemble(libres.Where(l => depuis.Any(a => TempsVers(a, l) <= dt + 1e-9)));
      var o = NouvelObjet(e.Type, pos, e.Voies, motif);
      if (e.Chaud) o.Chaud = true;
      if (e.Type == TypeObjet.Faille && e.Longueur.HasValue && e.Longueur.Value != 0)
      {
        o.Longueur = e.Longueur;
        derniere = pos + e.Longueur.Value;
      }
      else derniere = pos;
      if (e.Changeant && fige.HasValue)
      {
        Changer(o, fige.Value);
        incertainJusqua = Math.Max(incertainJusqua, pos + ApparitionA(v));
      }
      PoserFragments(e, pos, motif);
      if (e.Noyau.HasValue && Boss != null)
      {
        int voieNoyau = Tirer(libres);
        NouvelObjet(TypeObjet.Noyau, pos - 3, new[] { voieNoyau }, motif);
      }
      atteignables = suivantes.Taille > 0 ? suivantes : new Ensemble(libres);
      if (e.Type == TypeObjet.Faille)
      {
        var sortie = new Ensemble(atteignables.Liste());
        foreach (int l in sortie.Liste())
          foreach (int voisin in new[] { l - 1, l + 1 })
            if (Array.IndexOf(libres, voisin) >= 0) sortie.Ajouter(voisin);
        atteignables = sortie;
      }
      return o;
    }

    void Changer(Objet o, double fige)
    {
      o.Fige = fige;
      double loin = ApparitionA(VitesseA(o.Pos));
      double pas = (loin - fige) / 3;
      o.Avant = new List<(double, int[])>();
      for (int k = 0; k < 2; k++)
      {
        int[] voies;
        if (o.Type == TypeObjet.Mobile || o.Type == TypeObjet.Drone)
        {
          int decalage = (k == 0 ? 2 : 1) * (H() < 0.5 ? 1 : -1);
          var e = new Ensemble(o.Voies.Select(b => (int)Borner(b + decalage, 0, 2)));
          voies = e.Liste();
        }
        else if (o.Type == TypeObjet.Porte)
        {
          voies = k == 0 ? Array.Empty<int>() : new[] { o.Voies[(int)Math.Floor(H() * o.Voies.Length) % o.Voies.Length] };
        }
        else
        {
          int libreAvant = Tirer(Toutes);
          voies = Toutes.Where(x => x != libreAvant).Take(o.Voies.Length).ToArray();
        }
        o.Avant.Add((loin - pas * (k + 1), voies));
      }
    }

    void PoserFragments(Etape e, double pos, int motif)
    {
      if (e.Fragments == null) return;
      foreach (var f in e.Fragments)
      {
        int n = (int)Math.Max(1, Arrondi((f.Nombre ?? 1) * (f.Dore ? 1 : Profil.Fragments)));
        for (int k = 0; k < n; k++)
          NouvelObjet(f.Dore ? TypeObjet.Dore : TypeObjet.Fragment, pos - 3 - k * 5 + (e.Type == TypeObjet.Faille ? (e.Longueur ?? 0) * 0.5 + k * 10 : 0), new[] { f.Voie }, motif);
      }
    }

    Objet NouvelObjet(TypeObjet type, double pos, int[] voies, int? motif = null)
    {
      var o = new Objet { Id = ++compteur, Type = type, Pos = pos, Voies = voies, Graine = H(), Motif = EstObstacle(type) ? motif : null };
      Objets.Add(o);
      return o;
    }
  }
}
