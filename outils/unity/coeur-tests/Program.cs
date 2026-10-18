// PORTAL RUSH → UNITY : TESTS DORÉS DU CŒUR C#
//
// Rejoue chaque partie de référence (unity/PortalRush/Assets/PortalRush/Tests/Editor/References, produites par
// outils/unity/generer-references.mjs avec le vrai moteur TypeScript) : mêmes commandes aux mêmes images, puis
// comparaison de chaque objet créé, de chaque évènement et de l'état final. Le moindre écart est signalé.
#nullable enable
using System;
using System.IO;
using System.Linq;
using PortalRush.Coeur;
using PortalRush.Coeur.Verification;

static class Programme
{
  static int Main(string[] args)
  {
    string dossier = args.Length > 0 ? args[0] : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../../unity/PortalRush/Assets/PortalRush/Tests/Editor/References"));
    if (!Directory.Exists(dossier))
    {
      Console.Error.WriteLine("Dossier des références introuvable : " + dossier);
      return 2;
    }
    var fichiers = Directory.GetFiles(dossier, "*.json").Where(f => Path.GetFileName(f) != "index.json").OrderBy(f => f).ToArray();
    int echecs = 0;
    var tirage = Rejeu.VerifierTirage();
    Console.WriteLine(tirage.Count == 0 ? "OK    tirage mulberry32 identique au jeu web" : "ÉCART tirage mulberry32");
    foreach (var e in tirage) Console.WriteLine("      " + e);
    if (tirage.Count > 0) echecs++;
    foreach (var f in fichiers)
    {
      var r = Rejeu.Verifier(File.ReadAllText(f));
      Console.WriteLine($"{(r.Ok ? "OK   " : "ÉCART")} {Path.GetFileNameWithoutExtension(f)} — {r.Resume}");
      if (!r.Ok)
      {
        echecs++;
        foreach (var e in r.Ecarts.Take(12)) Console.WriteLine("      " + e);
      }
    }
    Console.WriteLine($"{fichiers.Length - echecs + (tirage.Count > 0 ? 1 : 0)}/{fichiers.Length} parties identiques au moteur TypeScript.");
    return echecs == 0 && fichiers.Length > 0 ? 0 : 1;
  }
}
