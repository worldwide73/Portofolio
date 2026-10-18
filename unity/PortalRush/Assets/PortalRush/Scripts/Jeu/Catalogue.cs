// PORTAL RUSH (Unity) — LE CATALOGUE DES MODÈLES
//
// La liste des modèles (FBX exportés depuis Blender, Assets/PortalRush/Modeles) rangés par usage : vaisseaux par
// identifiant (aube, faucon, bastion, spectre), obstacles et objets à collecter par type du moteur (bloc, debris,
// laser…, plusieurs variantes possibles), modules de décor par monde. Il est rempli par l'éditeur (menu Portal Rush ›
// Construire la scène) ; ce qui manque est remplacé par des formes simples, signalées dans la console (prototype).
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;

namespace PortalRush.Jeu
{
  [CreateAssetMenu(menuName = "Portal Rush/Catalogue", fileName = "Catalogue")]
  public sealed class Catalogue : ScriptableObject
  {
    [Serializable]
    public sealed class Entree
    {
      public string nom = "";
      public GameObject? modele;
    }

    public List<Entree> vaisseaux = new List<Entree>();
    public List<Entree> objets = new List<Entree>();
    /** Nom « monde/usage » (ex. « lancement/pylone », « commun/portique »). */
    public List<Entree> decor = new List<Entree>();

    [Header("Matériaux de secours (formes simples)")]
    public Material? coque;
    public Material? danger;
    public Material? energie;
    public Material? dore;
    public Material? faille;
    public Material? portail;
    public Material? metal;

    /** Les noms des matériaux de la palette dont la couleur suit le garage (canal « peinture », « peinture2 »…). */
    public List<string> peinture = new List<string>();
    public List<string> peinture2 = new List<string>();
    public List<string> accents = new List<string>();

    /** Le premier modèle de ce nom, ou une variante « nom-0 », « nom-1 »… tirée par « variante ». */
    public static GameObject? Trouver(List<Entree> liste, string nom, int variante = 0)
    {
      GameObject? exact = null;
      int nb = 0;
      foreach (var e in liste)
      {
        if (e.modele == null) continue;
        if (e.nom == nom) exact = e.modele;
        else if (e.nom.StartsWith(nom + "-", StringComparison.Ordinal)) nb++;
      }
      if (nb == 0) return exact;
      int cible = ((variante % nb) + nb) % nb;
      foreach (var e in liste)
      {
        if (e.modele == null || !e.nom.StartsWith(nom + "-", StringComparison.Ordinal)) continue;
        if (cible-- == 0) return e.modele;
      }
      return exact;
    }
  }
}
