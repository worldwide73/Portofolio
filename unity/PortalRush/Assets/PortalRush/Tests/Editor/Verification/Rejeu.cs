// PORTAL RUSH (Unity) — LE REJEU DES PARTIES DE RÉFÉRENCE
//
// Une partie de référence (Tests/Editor/References/*.json) a été jouée par le vrai moteur TypeScript du jeu web
// (outils/unity/generer-references.mjs) : commandes à chaque image (pas fixe 1/60 s), objets créés, évènements,
// état final. Ici, le moteur C# rejoue les mêmes commandes et on compare tout. Partagé entre les tests EditMode de
// Unity (RejeuTests.cs) et le programme .NET outils/unity/coeur-tests.
#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace PortalRush.Coeur.Verification
{
  public sealed class Verdict
  {
    public bool Ok => Ecarts.Count == 0;
    public readonly List<string> Ecarts = new List<string>();
    public string Resume = "";
    /** Les nombres égaux à la tolérance près sans l'être bit pour bit (après l'arrondi à 1e-9 de la référence). */
    public int Approches;
  }

  public static class Rejeu
  {
    const double Tolerance = 1e-6;

    /** Les trois premiers tirages de hasardGraine(graine) dans le jeu web (Node 22), à retrouver bit pour bit. */
    public static readonly (double Graine, double[] Tirages)[] TiragesDeReference =
    {
      (1001, new[] { 0.14117497857660055, 0.26740360795520246, 0.11109626526013017 }),
      (0, new[] { 0.26642920868471265, 0.0003297457005828619, 0.2232720274478197 }),
      (4294967297, new[] { 0.6270739405881613, 0.002735721180215478, 0.5274470399599522 }),
      (20261018, new[] { 0.6241667082067579, 0.7992063749115914, 0.4817302452865988 }),
    };

    /** Vérifie le tirage : rend la liste des écarts (vide si tout concorde). */
    public static List<string> VerifierTirage()
    {
      var ecarts = new List<string>();
      foreach (var (graine, attendus) in TiragesDeReference)
      {
        var h = new Hasard(graine);
        for (int i = 0; i < attendus.Length; i++)
        {
          double v = h.Suivant();
          if (v != attendus[i]) ecarts.Add($"hasard({graine}) tirage {i} : attendu {attendus[i]:R}, obtenu {v:R}");
        }
      }
      return ecarts;
    }

    /** L'arrondi de la référence : Math.round(v * 1e9) / 1e9 en JavaScript. */
    static double Arrondi9(double v) => Math.Floor(v * 1e9 + 0.5) / 1e9;

    static double Nb(object? o) => o is double d ? d : throw new FormatException("nombre attendu");
    static List<object?> Liste(object? o) => o as List<object?> ?? throw new FormatException("tableau attendu");
    static Dictionary<string, object?> Dico(object? o) => o as Dictionary<string, object?> ?? throw new FormatException("objet attendu");

    static string Ecrire(object? v)
    {
      switch (v)
      {
        case null: return "null";
        case double d: return d.ToString("R", CultureInfo.InvariantCulture);
        case bool b: return b ? "true" : "false";
        case string s: return "\"" + s + "\"";
        case List<object?> l: return "[" + string.Join(",", l.Select(Ecrire)) + "]";
        default: return v.ToString() ?? "?";
      }
    }

    sealed class Comparateur
    {
      public readonly Verdict V = new Verdict();
      public void Nombre(string ou, object? attendu, double? obtenu)
      {
        if (attendu == null)
        {
          if (obtenu.HasValue) V.Ecarts.Add($"{ou} : attendu null, obtenu {Ecrire(obtenu.Value)}");
          return;
        }
        double a = Nb(attendu);
        if (!obtenu.HasValue)
        {
          V.Ecarts.Add($"{ou} : attendu {Ecrire(a)}, obtenu null");
          return;
        }
        double b = Arrondi9(obtenu.Value);
        if (a == b) return;
        if (Math.Abs(a - b) <= Tolerance * Math.Max(1, Math.Abs(a))) { V.Approches++; return; }
        V.Ecarts.Add($"{ou} : attendu {Ecrire(a)}, obtenu {Ecrire(b)}");
      }
      public void Egal(string ou, object? attendu, object? obtenu)
      {
        if (Ecrire(attendu) != Ecrire(obtenu)) V.Ecarts.Add($"{ou} : attendu {Ecrire(attendu)}, obtenu {Ecrire(obtenu)}");
      }
      public void Voies(string ou, object? attendu, int[]? obtenu)
      {
        Egal(ou, attendu, obtenu == null ? null : (object)obtenu.Select(x => (object?)(double)x).ToList());
      }
    }

    static Mode ModeDe(string s) => Noms.Vers<Mode>(s);
    static Difficulte DifficulteDe(string s) => Noms.Vers<Difficulte>(s);

    public static Verdict Verifier(string json)
    {
      var racine = Dico(Json.Lire(json));
      var sc = Dico(racine["scenario"]);
      var mode = ModeDe((string)sc["mode"]!);
      var difficulte = DifficulteDe((string)sc["difficulte"]!);
      int niveau = (int)Nb(sc["niveau"]);
      double graine = Nb(sc["graine"]);
      string vehicule = (string)sc["vehicule"]!;
      double dt = Nb(sc["dt"]);
      int images = (int)Math.Floor(Nb(sc["secondes"]) / dt + 0.5);

      var commandes = new Dictionary<int, string>();
      foreach (var e in Liste(racine["entrees"]))
      {
        var l = Liste(e);
        commandes[(int)Nb(l[0])] = (string)l[1]!;
      }

      var p = new Partie(mode, difficulte, niveau, graine, vehicule);
      var vus = new HashSet<int>();
      var objets = new List<Objet>();
      var evenements = new List<(int Image, Evenement E)>();
      int i = 0;
      for (; i < images && p.Termine == null; i++)
      {
        if (commandes.TryGetValue(i, out var c))
        {
          if (c == "g") p.Deplacer(-1);
          else if (c == "d") p.Deplacer(1);
          else if (c == "o") p.Declencher();
        }
        p.Avancer(dt);
        foreach (var e in p.Evenements) evenements.Add((i, e));
        p.Evenements.Clear();
        foreach (var o in p.Objets)
          if (vus.Add(o.Id)) objets.Add(Copie(o));
      }

      var k = new Comparateur();

      // ---- Les objets, dans l'ordre de leur première apparition ----
      var refObjets = Liste(racine["objets"]);
      if (refObjets.Count != objets.Count) k.V.Ecarts.Add($"objets : attendu {refObjets.Count}, obtenu {objets.Count}");
      for (int n = 0; n < Math.Min(refObjets.Count, objets.Count); n++)
      {
        var r = Liste(refObjets[n]);
        var o = objets[n];
        string ou = $"objet n°{n} (id {Ecrire(r[0])}, {Ecrire(r[1])})";
        int avant = k.V.Ecarts.Count;
        k.Egal(ou + " id", r[0], (double)o.Id);
        k.Egal(ou + " type", r[1], Noms.De(o.Type));
        k.Nombre(ou + " pos", r[2], o.Pos);
        k.Voies(ou + " voies", r[3], o.Voies);
        k.Nombre(ou + " longueur", r[4], o.Longueur);
        if (r[5] == null || o.Avant == null) k.Egal(ou + " avant", r[5] == null ? "absent" : "présent", o.Avant == null ? "absent" : "présent");
        else
        {
          var ra = Liste(r[5]);
          k.Egal(ou + " avant (nombre)", (double)ra.Count, (double)o.Avant.Count);
          for (int a = 0; a < Math.Min(ra.Count, o.Avant.Count); a++)
          {
            var ea = Liste(ra[a]);
            k.Nombre($"{ou} avant[{a}].des", ea[0], o.Avant[a].Des);
            k.Voies($"{ou} avant[{a}].voies", ea[1], o.Avant[a].Voies);
          }
        }
        k.Nombre(ou + " fige", r[6], o.Fige);
        k.Nombre(ou + " vers", r[7], o.Vers);
        k.Egal(ou + " chaud", r[8], o.Chaud);
        k.Nombre(ou + " lie", r[9], o.Lie);
        k.Nombre(ou + " motif", r[10], o.Motif);
        k.Nombre(ou + " graine", r[11], o.Graine);
        // Au premier objet faux, la suite l'est forcément : on s'arrête là pour garder un rapport lisible.
        if (k.V.Ecarts.Count > avant) break;
      }

      // ---- Les évènements ----
      var refEv = Liste(racine["evenements"]);
      if (refEv.Count != evenements.Count) k.V.Ecarts.Add($"évènements : attendu {refEv.Count}, obtenu {evenements.Count}");
      for (int n = 0; n < Math.Min(refEv.Count, evenements.Count); n++)
      {
        var r = Liste(refEv[n]);
        var (image, e) = evenements[n];
        string ou = $"évènement n°{n} ({Ecrire(r[1])}, image {Ecrire(r[0])})";
        int avant = k.V.Ecarts.Count;
        k.Egal(ou + " image", r[0], (double)image);
        k.Egal(ou + " type", r[1], Noms.De(e.Type));
        k.Nombre(ou + " valeur", r[2], e.Valeur);
        k.Nombre(ou + " voie", r[3], e.Voie);
        if (k.V.Ecarts.Count > avant) break;
      }

      // ---- L'état final ----
      var f = Dico(racine["final"]);
      k.Egal("final.images", f["images"], (double)i);
      k.Nombre("final.distance", f["distance"], p.Distance);
      k.Nombre("final.temps", f["temps"], p.Temps);
      k.Nombre("final.vitesse", f["vitesse"], p.Vitesse);
      k.Nombre("final.score", f["score"], p.Score);
      k.Nombre("final.combo", f["combo"], p.Combo);
      k.Nombre("final.comboMax", f["comboMax"], p.ComboMax);
      k.Nombre("final.boucliers", f["boucliers"], p.Boucliers);
      k.Nombre("final.jauge", f["jauge"], p.Jauge);
      k.Nombre("final.overdrives", f["overdrives"], p.Overdrives);
      k.Nombre("final.fragments", f["fragments"], p.Fragments);
      k.Nombre("final.parfaits", f["parfaits"], p.Parfaits);
      k.Nombre("final.chocs", f["chocs"], p.Chocs);
      k.Nombre("final.portails", f["portails"], p.Portails);
      k.Nombre("final.motifs", f["motifs"], p.MotifsReussis);
      k.Nombre("final.phase", f["phase"], p.PhaseIndex);
      if (f["boss"] == null || p.Boss == null) k.Egal("final.boss", f["boss"] == null ? "absent" : "présent", p.Boss == null ? "absent" : "présent");
      else
      {
        var b = Dico(f["boss"]);
        k.Nombre("final.boss.vie", b["vie"], p.Boss.Vie);
        k.Nombre("final.boss.max", b["max"], p.Boss.Max);
        k.Nombre("final.boss.phase", b["phase"], p.Boss.Phase);
      }
      if (f["resultat"] == null || p.Termine == null) k.Egal("final.resultat", f["resultat"] == null ? "absent" : "présent", p.Termine == null ? "absent" : "présent");
      else
      {
        var r = Dico(f["resultat"]);
        var t = p.Termine;
        k.Egal("resultat.reussi", r["reussi"], t.Reussi);
        k.Egal("resultat.arrive", r["arrive"], t.Arrive);
        k.Nombre("resultat.score", r["score"], t.Score);
        k.Egal("resultat.rang", r["rang"], t.Rang);
        k.Nombre("resultat.note", r["note"], t.Note);
        k.Nombre("resultat.fragments", r["fragments"], t.Fragments);
        k.Nombre("resultat.fragmentsVus", r["fragmentsVus"], t.FragmentsVus);
        k.Nombre("resultat.parfaits", r["parfaits"], t.Parfaits);
        k.Nombre("resultat.comboMax", r["comboMax"], t.ComboMax);
        k.Nombre("resultat.multiplicateurMax", r["multiplicateurMax"], t.MultiplicateurMax);
        k.Nombre("resultat.motifs", r["motifs"], t.Motifs);
        k.Nombre("resultat.distance", r["distance"], t.Distance);
        k.Nombre("resultat.temps", r["temps"], t.Temps);
        k.Nombre("resultat.chocs", r["chocs"], t.Chocs);
        k.Nombre("resultat.portails", r["portails"], t.Portails);
        k.Nombre("resultat.overdrives", r["overdrives"], t.Overdrives);
        var ro = Liste(r["objectifs"]);
        k.Egal("resultat.objectifs (nombre)", (double)ro.Count, (double)t.Objectifs.Count);
        for (int n = 0; n < Math.Min(ro.Count, t.Objectifs.Count); n++)
        {
          var a = Dico(ro[n]);
          var b = t.Objectifs[n];
          k.Egal($"resultat.objectifs[{n}].type", a["type"], Noms.De(b.Type));
          k.Nombre($"resultat.objectifs[{n}].valeur", a["valeur"], b.Valeur);
          k.Egal($"resultat.objectifs[{n}].atteint", a["atteint"], b.Atteint);
          k.Nombre($"resultat.objectifs[{n}].mesure", a["mesure"], b.Mesure);
        }
      }

      string issue = p.Termine == null ? "en cours" : p.Termine.Reussi ? "réussi" : p.Termine.Arrive ? "arrivé" : "perdu";
      k.V.Resume = $"{i} images, {objets.Count} objets, {evenements.Count} évènements, {issue}, score {Math.Floor(p.Score + 0.5)}" + (k.V.Approches > 0 ? $" ({k.V.Approches} nombres égaux à {Tolerance} près)" : "");
      return k.V;
    }

    /** L'objet tel qu'à sa création (le moteur modifie ensuite Passe, Touche, Detruit). */
    static Objet Copie(Objet o) => new Objet
    {
      Id = o.Id, Type = o.Type, Pos = o.Pos, Voies = (int[])o.Voies.Clone(), Longueur = o.Longueur,
      Avant = o.Avant?.Select(a => (a.Des, (int[])a.Voies.Clone())).ToList(), Fige = o.Fige, Vers = o.Vers, Chaud = o.Chaud,
      Lie = o.Lie, Motif = o.Motif, Graine = o.Graine,
    };
  }
}
