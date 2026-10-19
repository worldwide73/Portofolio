// PORTAL RUSH (Unity) — CE QUE L'INTERFACE LIT DANS LA VUE
//
// La progression vient de la page (Pont.Vue, calculée par le JavaScript avec les fonctions du jeu web : etoilesDe,
// avancement, difficulteOuverte…) : ici, on la lit et on la met en mots, comme rush.ts (majAccueil, majCampagne,
// conditionTexte, meilleurScore, prochainePiece…). Aucune règle de progression n'est refaite. Les champs reçus
// par JsonUtility peuvent manquer : tout est lu prudemment (listes vides, textes vides).
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Coeur;
using PortalRush.Jeu;

namespace PortalRush.Interface
{
  public static class Vues
  {
    public static readonly string[] Difficultes = { "pilote", "as", "expert", "cauchemar", "paradoxe" };
    public static readonly string[] Emplacements = { "coque", "trainee", "overdrive", "noyau" };
    public static int NombreNiveaux => Donnees.Niveaux.Length;

    public static Vue? V => Pont.Vue;

    public static string Id(Difficulte d) => Noms.De(d);

    public static Difficulte VersDifficulte(string? id)
    {
      switch (id)
      {
        case "pilote": return Difficulte.Pilote;
        case "expert": return Difficulte.Expert;
        case "cauchemar": return Difficulte.Cauchemar;
        case "paradoxe": return Difficulte.Paradoxe;
        default: return Difficulte.As;
      }
    }

    public static string NomDifficulte(string id) => Textes.De($"difficultes.{id}.nom");
    public static string NomNiveau(int id) => id >= 1 && id <= NombreNiveaux ? Textes.De($"niveaux.{id - 1}.nom") : "";
    public static string Secteur(int id) => Textes.Remplir("secteur", "n", Textes.Deux(id));
    /** Le nom d'une phase dans les textes (« acceleration »). */
    public static string Phase(NomPhase n)
    {
      string s = n.ToString();
      return char.ToLowerInvariant(s[0]) + s.Substring(1);
    }

    public static double ProfilScore(string id) => Donnees.Profils[VersDifficulte(id)].Score;

    // ==========================================================================
    // LA PROGRESSION
    // ==========================================================================
    public static int NiveauMax => Math.Max(1, Math.Min(NombreNiveaux, V?.niveauMax ?? 1));

    public static NiveauVue? Niveau(int id)
    {
      var liste = V?.niveaux;
      if (liste == null) return null;
      foreach (var n in liste)
        if (n != null && n.id == id) return n;
      return null;
    }

    public static ScoreNiveau? Score(int niveau, string difficulte)
    {
      var n = Niveau(niveau);
      if (n?.scores == null) return null;
      foreach (var s in n.scores)
        if (s != null && s.difficulte == difficulte) return s;
      return null;
    }

    public static bool Debloque(int niveau)
    {
      var n = Niveau(niveau);
      return n != null ? n.debloque : niveau <= NiveauMax;
    }

    public static bool Reussi(int niveau, string difficulte) => Score(niveau, difficulte)?.reussi ?? false;

    public static bool ReussiUneFois(int niveau)
    {
      foreach (var d in Difficultes)
        if (Reussi(niveau, d)) return true;
      return false;
    }

    public static int SecteursReussis()
    {
      int n = 0;
      for (int i = 1; i <= NombreNiveaux; i++)
        if (ReussiUneFois(i)) n++;
      return n;
    }

    public static bool[] Etoiles(int niveau, string difficulte)
    {
      var e = Score(niveau, difficulte)?.etoiles;
      var r = new bool[3];
      if (e != null)
        for (int i = 0; i < 3 && i < e.Length; i++) r[i] = e[i];
      return r;
    }

    public static int Compter(bool[] e)
    {
      int n = 0;
      foreach (var b in e)
        if (b) n++;
      return n;
    }

    /** Les étoiles gagnées, dans une difficulté ou en tout. */
    public static int TotalEtoiles(string? difficulte = null)
    {
      int n = 0;
      for (int i = 1; i <= NombreNiveaux; i++)
        foreach (var d in Difficultes)
          if (difficulte == null || d == difficulte) n += Compter(Etoiles(i, d));
      return n;
    }

    public static bool DifficulteOuverte(string id)
    {
      var liste = V?.difficultes;
      if (liste != null)
        foreach (var d in liste)
          if (d != null && d.id == id) return d.ouverte;
      return id != "cauchemar" && id != "paradoxe";
    }

    /** La plus haute difficulté ouverte, au plus « id » (difficulteJouable du jeu web). */
    public static string DifficulteJouable(string id)
    {
      if (DifficulteOuverte(id)) return id;
      if (id == "paradoxe" && DifficulteOuverte("cauchemar")) return "cauchemar";
      return id == "pilote" ? "pilote" : "expert";
    }

    public static double RecordCampagne(int niveau, string difficulte) => Score(niveau, difficulte)?.record ?? 0;

    public static InfiniVue? Infini(string difficulte)
    {
      var liste = V?.infini;
      if (liste == null) return null;
      foreach (var i in liste)
        if (i != null && i.difficulte == difficulte && (i.score > 0 || i.distance > 0)) return i;
      return null;
    }

    public static int GraineDuJour()
    {
      var j = DateTime.Now;
      return j.Year * 10000 + j.Month * 100 + j.Day;
    }

    /** Le défi d'aujourd'hui, s'il a déjà été tenté. */
    public static DefiVue? DefiDuJour()
    {
      var d = V?.defi;
      return d != null && (int)d.graine == GraineDuJour() && d.tentatives > 0 ? d : null;
    }

    /** Les défis du jour réussis (tous jours confondus). */
    public static int DefisReussis()
    {
      if (V?.defi != null && V.defi.reussis > 0) return V.defi.reussis;
      // (Repli : l'avancement de la pièce qui en dépend.)
      var pieces = V?.pieces;
      if (pieces != null)
        foreach (var p in pieces)
          if (p?.condition != null && p.condition.type == "total" && p.condition.stat == "defis") return (int)p.condition.mesure;
      return 0;
    }

    public static int Parties => V?.totaux?.parties ?? 0;

    /** Le premier lancement : aucune partie et aucun secteur réussi (« Commencer » au lieu de « Continuer »). */
    public static bool Premiere()
    {
      var r = V?.reprise;
      return r != null ? r.premiere : Parties == 0 && SecteursReussis() == 0;
    }

    /** Ce que lance « Continuer » : la reprise calculée par la page (le prochain secteur, une difficulté jouable). */
    public static (int Niveau, string Difficulte) Reprise(string difficulte)
    {
      var r = V?.reprise;
      if (r != null && r.niveau >= 1 && !string.IsNullOrEmpty(r.difficulte))
        return (Math.Min(NombreNiveaux, r.niveau), DifficulteJouable(r.difficulte));
      return (Premiere() ? 1 : NiveauMax, DifficulteJouable(difficulte));
    }

    /** Le meilleur score enregistré, tous modes confondus, et d'où il vient. */
    public static (double Score, string Origine) MeilleurScore()
    {
      double meilleur = 0;
      string origine = "";
      for (int i = 1; i <= NombreNiveaux; i++)
        foreach (var d in Difficultes)
        {
          double r = RecordCampagne(i, d);
          if (r > meilleur)
          {
            meilleur = r;
            origine = Secteur(i) + " · " + NomDifficulte(d);
          }
        }
      foreach (var d in Difficultes)
      {
        var r = Infini(d);
        if (r != null && r.score > meilleur)
        {
          meilleur = r.score;
          origine = Textes.De("menu.infini") + " · " + NomDifficulte(d);
        }
      }
      var defi = V?.defi;
      if (defi != null && defi.meilleur > meilleur)
      {
        meilleur = defi.meilleur;
        origine = Textes.De("defi.titre");
      }
      if (V != null && V.meilleurScore > meilleur)
      {
        meilleur = V.meilleurScore;
        origine = "";
      }
      return (meilleur, origine);
    }

    // ==========================================================================
    // LES TEXTES CALCULÉS (comme rush.ts)
    // ==========================================================================
    public static string ObjectifTexte(TypeObjectif type, double valeur)
    {
      if (type == TypeObjectif.ChocsMax && valeur == 0) return Textes.De("objectifs.aucunChoc");
      return Textes.Remplir($"objectifs.{Noms.De(type)}", "v", Textes.Nombre(valeur));
    }

    public static double ScoreEtoile(int niveau, Difficulte d)
    {
      if (niveau < 1 || niveau > NombreNiveaux) return 0;
      var e = Donnees.Niveaux[niveau - 1].Etoiles;
      int i = Array.IndexOf(Donnees.OrdreDifficultes, d);
      return e != null && i >= 0 && i < e.Length ? e[i] : 0;
    }

    /** Les libellés des trois étoiles d'un secteur, dans une difficulté. */
    public static string[] LibellesEtoiles(int niveau, Difficulte d)
    {
      var n = Donnees.Niveaux[Math.Max(0, Math.Min(NombreNiveaux - 1, niveau - 1))];
      return new[]
      {
        n.Objectif.Type == TypeObjectif.Fin ? Textes.De("etoiles.une") : ObjectifTexte(n.Objectif.Type, n.Objectif.Valeur),
        Textes.Remplir("etoiles.deux", "v", Textes.Nombre(ScoreEtoile(niveau, d))),
        n.Maitrise.Length > 0 ? ObjectifTexte(n.Maitrise[0].Type, n.Maitrise[0].Valeur) : "—",
      };
    }

    public static string NomPiece(string id) => Textes.De($"garage.pieces.{id}");
    public static string NomEmplacement(string id) => Textes.De($"garage.emplacements.{id}");
    public static string NomVehicule(string id) => Textes.De($"garage.vaisseaux.noms.{id}");

    public static string ConditionTexte(ConditionVue? c)
    {
      if (c == null) return "";
      switch (c.type)
      {
        case "depart": return Textes.De("garage.conditions.depart");
        case "niveau": return Textes.Remplir("garage.conditions.niveau", "v", Textes.Deux(c.niveau));
        case "rang": return Textes.De("garage.conditions.rang");
        case "difficulte": return Textes.Remplir("garage.conditions.difficulte", "v", NomDifficulte(c.difficulte ?? "expert"));
        case "infini": return Textes.Remplir("garage.conditions.infini", "v", Textes.Nombre(c.cible));
        case "total":
          string stat = c.stat == "overdrives" || c.stat == "parfaits" ? c.stat : "defis";
          return Textes.Remplir($"garage.conditions.{stat}", "v", Textes.Nombre(c.cible));
        case "multiplicateur": return Textes.Remplir("garage.conditions.multiplicateur", "v", Textes.Nombre(c.cible));
        default: return "";
      }
    }

    /** « · 12 / 25 » quand la condition se mesure (cible > 1) et n'est pas encore remplie. */
    public static string Progres(ConditionVue? c)
    {
      if (c == null || c.faite || c.cible <= 1) return "";
      return " · " + Textes.Remplir("garage.progres", "n", Textes.Nombre(c.mesure), "v", Textes.Nombre(c.cible));
    }

    public static PieceVue? Piece(string id)
    {
      var pieces = V?.pieces;
      if (pieces != null)
        foreach (var p in pieces)
          if (p != null && p.id == id) return p;
      return null;
    }

    /** La pièce verrouillée la plus proche d'être gagnée (calculée par la page : prochainePiece du jeu web). */
    public static PieceVue? ProchainePiece()
    {
      var suivante = V?.prochainePiece;
      if (suivante != null && !string.IsNullOrEmpty(suivante.id)) return Piece(suivante.id);
      var pieces = V?.pieces;
      if (pieces == null) return null;
      PieceVue? meilleure = null;
      double part = double.NegativeInfinity;
      foreach (var p in pieces)
      {
        if (p == null || p.debloquee || p.condition == null) continue;
        var c = p.condition;
        double x = c.type == "multiplicateur" ? (c.mesure - 1) / Math.Max(1e-6, c.cible - 1)
          : c.type == "niveau" ? Math.Min(0.95, (NiveauMax - 1) / (double)Math.Max(1, c.niveau))
          : c.cible > 0 ? c.mesure / c.cible : 0;
        if (meilleure == null || x > part)
        {
          meilleure = p;
          part = x;
        }
      }
      return meilleure;
    }

    /** Ce qu'un secteur peut encore débloquer dans une difficulté (seulement ce qui existe vraiment). */
    public static List<string> AGagner(int niveau, string difficulte)
    {
      var gains = new List<string>();
      if (niveau < NombreNiveaux && NiveauMax <= niveau) gains.Add(Textes.Remplir("etoiles.debloque", "n", Textes.Deux(niveau + 1)));
      var pieces = V?.pieces;
      if (pieces != null)
        foreach (var p in pieces)
          if (p?.condition != null && p.condition.type == "niveau" && p.condition.niveau == niveau && !p.debloquee)
            gains.Add(Textes.Remplir("etoiles.piece", "p", NomEmplacement(p.emplacement ?? "") + " · " + NomPiece(p.id ?? "")));
      var vehicules = V?.vehicules;
      if (vehicules != null)
        foreach (var v in vehicules)
          if (v?.condition != null && v.condition.type == "niveau" && v.condition.niveau == niveau && !v.debloque)
            gains.Add(Textes.Remplir("ui.recompense.vaisseau", "v", NomVehicule(v.id ?? "")));
      if (difficulte == "expert" && !DifficulteOuverte("cauchemar")) gains.Add(Textes.De("etoiles.cauchemar"));
      if (difficulte == "cauchemar" && !DifficulteOuverte("paradoxe")) gains.Add(Textes.De("etoiles.paradoxe"));
      return gains;
    }

    /** « Secteur 03 · Shattered Belt · Ace », « Survie infinie · Expert », « Défi du jour · 18 octobre ». */
    public static string LibellePartie(Lancement? l)
    {
      if (l == null) return "";
      if (l.Tutoriel) return Textes.De("tutoriel.titre");
      string d = NomDifficulte(Id(l.Difficulte));
      if (l.Mode == Mode.Campagne) return Secteur(l.Niveau) + " · " + NomNiveau(l.Niveau) + " · " + d;
      if (l.Mode == Mode.Infini) return Textes.De("menu.infini") + " · " + d;
      return Textes.De("defi.titre") + " · " + Textes.Date(DateTime.Now, false);
    }

    /** Le record qui sert de repère pendant une partie. */
    public static double RecordPour(Lancement? l, double graine)
    {
      if (l == null || l.Tutoriel) return 0;
      string d = Id(l.Difficulte);
      if (l.Mode == Mode.Campagne) return RecordCampagne(l.Niveau, d);
      if (l.Mode == Mode.Infini) return Infini(d)?.score ?? 0;
      var defi = V?.defi;
      return defi != null && (int)defi.graine == (int)graine ? defi.meilleur : 0;
    }

    /** La couleur d'accent d'un monde (palettes de la scène du jeu web). */
    public static string Theme(int niveau) => niveau >= 1 && niveau <= NombreNiveaux ? Noms.De(Donnees.Niveaux[niveau - 1].Theme) : "lancement";

    public static UnityEngine.Color Accent(string theme)
    {
      switch (theme)
      {
        case "neon": return Formes.Hex(0x5ef0ff);
        case "debris": return Formes.Hex(0xffd9a8);
        case "laser": return Formes.Hex(0x62f2ff);
        case "rift": return Formes.Hex(0xb48cff);
        case "tempete": return Formes.Hex(0xcfe0ff);
        case "sentinelle": return Formes.Hex(0xffb066);
        case "singularite": return Formes.Hex(0xe6dcff);
        case "defi": return Formes.Hex(0xffd678);
        default: return Formes.Hex(0x7fe3ff);
      }
    }

    public static UnityEngine.Color Accent2(string theme)
    {
      switch (theme)
      {
        case "neon": return Formes.Hex(0xff4fd8);
        case "debris": return Formes.Hex(0xff8a3a);
        case "laser": return Formes.Hex(0xff3b48);
        case "rift": return Formes.Hex(0x5ee8ff);
        case "tempete": return Formes.Hex(0xffb347);
        case "sentinelle": return Formes.Hex(0xff5a2a);
        case "singularite": return Formes.Hex(0xffffff);
        default: return Formes.Hex(0xffb04a);
      }
    }

    public static UnityEngine.Color Horizon(string theme)
    {
      switch (theme)
      {
        case "neon": return Formes.Hex(0x2a0d3d);
        case "debris": return Formes.Hex(0x1c1a1e);
        case "laser": return Formes.Hex(0x0a2230);
        case "rift": return Formes.Hex(0x22104a);
        case "tempete": return Formes.Hex(0x151a22);
        case "sentinelle": return Formes.Hex(0x2a1608);
        case "singularite": return Formes.Hex(0x0c0718);
        case "defi": return Formes.Hex(0x3a2a14);
        default: return Formes.Hex(0x0d2236);
      }
    }
  }
}
