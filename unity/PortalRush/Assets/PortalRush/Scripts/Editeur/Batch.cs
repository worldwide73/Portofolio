// PORTAL RUSH (Unity) — LES POINTS D'ENTRÉE DU MODE BATCH (docs/UNITY_ARCHITECTURE.md §6.2, outils/unity/unity.ps1)
//
//   Unity.exe -batchmode -projectPath unity/PortalRush -executeMethod PortalRush.Editeur.Batch.Configurer -logFile …
//   Unity.exe -batchmode -projectPath unity/PortalRush -buildTarget WebGL -executeMethod PortalRush.Editeur.Batch.Construire -logFile …
// Sans -quit : chaque méthode quitte elle-même Unity avec le code 0 (réussite) ou 1 (échec).
#nullable enable
using System;
using UnityEditor;
using UnityEngine;

namespace PortalRush.Editeur
{
  public static class Batch
  {
    public static void Configurer()
    {
      try
      {
        Configuration.Tout();
        // Les matériaux de la palette avant la scène (en batch, le passage différé de l'import n'a pas le temps de se faire).
        ImportModeles.Synchroniser();
        Scene.Construire();
        EditorApplication.Exit(0);
      }
      catch (Exception e)
      {
        Debug.LogException(e);
        EditorApplication.Exit(1);
      }
    }

    public static void Construire()
    {
      try
      {
        bool ok = Construction.Construire(out string message);
        Debug.Log("[Portal Rush] " + message);
        EditorApplication.Exit(ok ? 0 : 1);
      }
      catch (Exception e)
      {
        Debug.LogException(e);
        EditorApplication.Exit(1);
      }
    }
  }
}
