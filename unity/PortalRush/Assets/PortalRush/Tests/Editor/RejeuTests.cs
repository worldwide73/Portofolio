// PORTAL RUSH (Unity) — TESTS EDITMODE : le moteur C# rejoue les parties de référence du jeu web.
// Window > General > Test Runner > EditMode > Run All. Les mêmes vérifications tournent hors de Unity :
// outils/unity/coeur-tests (dotnet run -c Release).
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

namespace PortalRush.Coeur.Verification
{
  public class RejeuTests
  {
    static string Dossier => Path.Combine(Application.dataPath, "PortalRush", "Tests", "Editor", "References");

    static IEnumerable<string> Parties()
    {
      if (!Directory.Exists(Dossier)) yield break;
      foreach (var f in Directory.GetFiles(Dossier, "*.json").OrderBy(f => f))
        if (Path.GetFileName(f) != "index.json") yield return Path.GetFileNameWithoutExtension(f);
    }

    [Test]
    public void IlYADesPartiesDeReference() => Assert.That(Parties().Count(), Is.GreaterThan(0), "Aucune partie de référence : lancer outils/unity/generer-references.mjs");

    [TestCaseSource(nameof(Parties))]
    public void LaPartieEstIdentiqueAuJeuWeb(string nom)
    {
      var verdict = Rejeu.Verifier(File.ReadAllText(Path.Combine(Dossier, nom + ".json")));
      Assert.IsTrue(verdict.Ok, nom + " :\n" + string.Join("\n", verdict.Ecarts.Take(20)));
    }

    [Test]
    public void LeTirageEstCeluiDuJeuWeb()
    {
      foreach (var (graine, attendus) in Rejeu.TiragesDeReference)
      {
        var h = new Hasard(graine);
        foreach (double v in attendus) Assert.AreEqual(v, h.Suivant(), 0.0, "graine " + graine);
      }
    }
  }
}
