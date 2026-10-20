// PORTAL RUSH (Unity) — L'INSTALLATEUR DES PAQUETS
//
// Le seul code qui compile dès la première ouverture du projet : il n'a besoin d'aucun paquet. Il installe les
// paquets gratuits de Unity dont dépend le jeu (URP, Input System, Test Framework), par leur nom, ce qui prend la
// dernière version compatible de l'éditeur (rien n'est écrit à la main dans Packages/manifest.json). Ensuite il
// ajoute le symbole PORTALRUSH_PAQUETS : les assemblages du jeu (Jeu, Interface, Editeur, Tests) en dépendent et
// ne compilent qu'à partir de là. Voir docs/UNITY_ARCHITECTURE.md §2.
//
// Dans l'éditeur : une fenêtre propose l'installation à l'ouverture (menu Portal Rush › 1. Installer les paquets).
// En mode batch : Unity.exe -batchmode -projectPath … -executeMethod PortalRush.Installation.Installateur.InstallerEnBatch
// (sans -quit : Unity s'arrête de lui-même avec le code 0 si tout est en place, 1 sinon).
#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.PackageManager;
using UnityEditor.PackageManager.Requests;
using UnityEngine;

namespace PortalRush.Installation
{
  [InitializeOnLoad]
  public static class Installateur
  {
    public const string Symbole = "PORTALRUSH_PAQUETS";

    /** Les paquets du jeu : tous gratuits, publiés par Unity. */
    public static readonly string[] Paquets =
    {
      "com.unity.render-pipelines.universal",
      "com.unity.inputsystem",
      "com.unity.test-framework",
    };

    static readonly NamedBuildTarget[] Cibles = { NamedBuildTarget.Standalone, NamedBuildTarget.WebGL };
    const string CleRefus = "PortalRush.Installation.Refus";
    const string CleBatch = "PortalRush.Installation.Batch";
    const double DelaiMax = 20 * 60;

    static Installateur()
    {
      // Après un rechargement du code pendant l'installation en batch, on reprend la vérification pour pouvoir quitter.
      if (Application.isBatchMode)
      {
        if (SessionState.GetBool(CleBatch, false)) EditorApplication.delayCall += () => Verifier(false, true, FinBatch);
        return;
      }
      EditorApplication.delayCall += () => Verifier(true, false, null);
    }

    [MenuItem("Portal Rush/1. Installer les paquets", false, 1)]
    static void Menu() => Verifier(true, true, ok =>
    {
      if (ok) EditorUtility.DisplayDialog("Portal Rush", "Les paquets sont en place. Unity recompile le jeu ; ensuite : Portal Rush › 2. Configurer le projet.", "OK");
    });

    /** Point d'entrée du mode batch (docs/UNITY_ARCHITECTURE.md §6.2). */
    public static void InstallerEnBatch()
    {
      SessionState.SetBool(CleBatch, true);
      Verifier(false, true, FinBatch);
    }

    static void FinBatch(bool ok)
    {
      SessionState.SetBool(CleBatch, false);
      AssetDatabase.SaveAssets();
      Debug.Log(ok ? "[Portal Rush] Installation terminée." : "[Portal Rush] Installation ÉCHOUÉE (voir les erreurs ci-dessus).");
      EditorApplication.Exit(ok ? 0 : 1);
    }

    /** Regarde quels paquets manquent ; propose (ou fait) l'installation ; tient le symbole à jour. */
    static void Verifier(bool interactif, bool forcer, Action<bool>? fin)
    {
      ListRequest liste = Client.List(true, false);
      Attendre(liste, () =>
      {
        if (liste.Status != StatusCode.Success)
        {
          Debug.LogError("[Portal Rush] Liste des paquets impossible : " + (liste.Error?.message ?? "erreur inconnue"));
          fin?.Invoke(false);
          return;
        }
        var presents = new HashSet<string>(liste.Result.Select(p => p.name));
        string[] manquants = Paquets.Where(p => !presents.Contains(p)).ToArray();
        if (manquants.Length == 0)
        {
          ReglerSymbole(true);
          fin?.Invoke(true);
          return;
        }
        // Sans ses paquets, le code du jeu ne doit pas compiler (il bloquerait l'éditeur).
        ReglerSymbole(false);
        if (interactif && !forcer && SessionState.GetBool(CleRefus, false)) return;
        if (interactif)
        {
          string message = "Portal Rush a besoin de paquets gratuits de Unity :\n\n• " + string.Join("\n• ", manquants) +
            "\n\nLes installer maintenant ? (Unity choisit la version compatible avec cet éditeur.)";
          if (!EditorUtility.DisplayDialog("Portal Rush — installation", message, "Installer", "Plus tard"))
          {
            SessionState.SetBool(CleRefus, true);
            return;
          }
        }
        Installer(manquants, fin);
      });
    }

    static void Installer(string[] manquants, Action<bool>? fin)
    {
      Debug.Log("[Portal Rush] Installation des paquets : " + string.Join(", ", manquants));
      AddAndRemoveRequest requete = Client.AddAndRemove(manquants, null);
      Attendre(requete, () =>
      {
        if (requete.Status != StatusCode.Success)
        {
          Debug.LogError("[Portal Rush] Installation impossible : " + (requete.Error?.message ?? "erreur inconnue"));
          fin?.Invoke(false);
          return;
        }
        ReglerSymbole(true);
        fin?.Invoke(true);
      });
    }

    /** Appelle « suite » quand la requête est terminée (ou abandonne après DelaiMax). */
    static void Attendre(Request requete, Action suite)
    {
      double debut = EditorApplication.timeSinceStartup;
      EditorApplication.CallbackFunction? tic = null;
      tic = () =>
      {
        if (!requete.IsCompleted)
        {
          if (EditorApplication.timeSinceStartup - debut < DelaiMax) return;
          Debug.LogError("[Portal Rush] Le gestionnaire de paquets ne répond pas.");
        }
        EditorApplication.update -= tic;
        suite();
      };
      EditorApplication.update += tic;
    }

    /** Ajoute ou retire PORTALRUSH_PAQUETS des symboles de script (Standalone, pour l'éditeur, et WebGL). */
    public static void ReglerSymbole(bool present)
    {
      bool change = false;
      foreach (var cible in Cibles)
      {
        PlayerSettings.GetScriptingDefineSymbols(cible, out string[] symboles);
        bool a = Array.IndexOf(symboles, Symbole) >= 0;
        if (a == present) continue;
        var liste = new List<string>(symboles);
        if (present) liste.Add(Symbole);
        else liste.RemoveAll(s => s == Symbole);
        PlayerSettings.SetScriptingDefineSymbols(cible, liste.ToArray());
        change = true;
      }
      if (!change) return;
      AssetDatabase.SaveAssets();
      Debug.Log(present ? "[Portal Rush] Symbole " + Symbole + " ajouté : le code du jeu va compiler." : "[Portal Rush] Symbole " + Symbole + " retiré en attendant les paquets.");
    }
  }
}
