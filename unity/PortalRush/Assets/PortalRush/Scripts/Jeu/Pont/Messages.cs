// PORTAL RUSH (Unity) — LES MESSAGES DU PONT AVEC LA PAGE (contrat docs/UNITY_ARCHITECTURE.md, §5.4 à §5.6)
//
// Les mêmes formes que src/scripts/rush-unity/protocole.ts, pour JsonUtility : classes [Serializable] à champs
// publics, aucun dictionnaire, aucune propriété. JsonUtility n'a pas de null : chaque champ a une valeur par défaut
// (texte vide, tableau vide, objet neuf). Les ajouts au contrat d'origine sont marqués « (ajout) ».
#nullable enable
using System;

namespace PortalRush.Jeu
{
  // ==========================================================================
  // LES DONNÉES (§5.5) : la vue est calculée par la page, avec les fonctions du jeu web
  // ==========================================================================
  [Serializable]
  public class Reglages
  {
    public double volume = 1;
    public bool effetsReduits;
    public bool secousses = true;
    public bool aideCommandes = true;
    public string tactile = "toucher";
    public bool musique = true;
    public double volumeMusique = 0.6;
    public bool muet;
    public string piste = "";
    public string sequenceFin = "complete";
    public string qualite = "auto";
    /** (ajout) Effets sonores du site, et animations du site (1, 0,5 allégées, 0 coupées). */
    public bool sons = true;
    public double animations = 1;

    public Reglages Copie() => (Reglages)MemberwiseClone();
  }

  [Serializable]
  public class ConditionVue
  {
    public string type = "depart";
    public double mesure;
    public double cible;
    public bool faite;
    public int niveau;
    public string rang = "";
    public string difficulte = "";
    public string stat = "";
  }

  [Serializable]
  public class ScoreNiveau
  {
    public string difficulte = "";
    public bool reussi;
    public bool[] etoiles = new bool[3];
    public double record;
    public string rang = "";
    /** Le score de l'étoile « score ». */
    public double etoile;
  }

  [Serializable]
  public class NiveauVue
  {
    public int id;
    public string theme = "";
    public bool debloque;
    public ScoreNiveau[] scores = Array.Empty<ScoreNiveau>();
  }

  [Serializable]
  public class DifficulteVue
  {
    public string id = "";
    public bool ouverte;
  }

  [Serializable]
  public class VehiculeVue
  {
    public string id = "";
    public int modele;
    public bool debloque;
    public ConditionVue condition = new ConditionVue();
  }

  [Serializable]
  public class PieceVue
  {
    public string id = "";
    public string emplacement = "";
    public string couleur = "";
    public bool debloquee;
    public bool equipee;
    public ConditionVue condition = new ConditionVue();
  }

  [Serializable]
  public class Equipement
  {
    public string coque = "coque-givre";
    public string trainee = "trainee-givre";
    public string overdrive = "overdrive-standard";
    public string noyau = "noyau-blanc";
  }

  [Serializable]
  public class InfiniVue
  {
    public string difficulte = "";
    public double score;
    public double distance;
  }

  [Serializable]
  public class DefiVue
  {
    /** La graine du défi du jour (AAAAMMJJ) ; meilleur, dernier et tentatives sont ceux de ce jour-là. */
    public double graine;
    public double meilleur;
    public double dernier;
    public int tentatives;
    /** (ajout) Les défis menés au bout, tous jours confondus. */
    public int reussis;
  }

  [Serializable]
  public class Totaux
  {
    public int parties;
    public int overdrives;
    public int parfaits;
    public double distance;
    public int multiplicateurMax = 1;
    public double infiniMax;
    public bool rangS;
    public int meilleurCombo;
    public int meilleursParfaits;
    public double meilleureDistance;
  }

  [Serializable]
  public class TutorielVue
  {
    public string etat = "nouveau";
    public int phase;
    public bool aFaire = true;
  }

  [Serializable]
  public class DerniereVue
  {
    public bool existe;
    public string mode = "";
    public string difficulte = "";
    public int niveau;
  }

  /** (ajout) « Continuer » : le prochain secteur et sa difficulté ; « premiere » : « Commencer » le secteur 01. */
  [Serializable]
  public class RepriseVue
  {
    public bool premiere = true;
    public int niveau = 1;
    public string difficulte = "as";
  }

  /** (ajout) La pièce verrouillée la plus proche d'être gagnée ; id vide : aucune. */
  [Serializable]
  public class PieceSuivanteVue
  {
    public string id = "";
    public double mesure;
    public double cible;
  }

  [Serializable]
  public class Vue
  {
    /** La version du format de sauvegarde de la page (3). */
    public int version = 3;
    public string langue = "fr";
    public Reglages reglages = new Reglages();
    public TutorielVue tutoriel = new TutorielVue();
    public int niveauMax = 1;
    /** La difficulté choisie, ramenée à une difficulté ouverte. */
    public string difficulte = "as";
    public string vehicule = "aube";
    public DifficulteVue[] difficultes = Array.Empty<DifficulteVue>();
    public NiveauVue[] niveaux = Array.Empty<NiveauVue>();
    public VehiculeVue[] vehicules = Array.Empty<VehiculeVue>();
    public PieceVue[] pieces = Array.Empty<PieceVue>();
    public Equipement equipement = new Equipement();
    public InfiniVue[] infini = Array.Empty<InfiniVue>();
    public DefiVue defi = new DefiVue();
    public Totaux totaux = new Totaux();
    public double meilleurScore;
    public DerniereVue derniere = new DerniereVue();
    public RepriseVue reprise = new RepriseVue();
    public PieceSuivanteVue prochainePiece = new PieceSuivanteVue();
  }

  [Serializable]
  public class Bilan
  {
    /** Les étoiles du secteur après la partie (vide hors campagne réussie). */
    public bool[] etoiles = Array.Empty<bool>();
    public int[] nouvellesEtoiles = Array.Empty<int>();
    public bool record;
    public double ancienRecord;
    /** 0 : aucun. */
    public int niveauDebloque;
    public bool cauchemarDebloque;
    public bool paradoxeDebloque;
    public string[] pieces = Array.Empty<string>();
    public string[] vehicules = Array.Empty<string>();
    public Vue vue = new Vue();
  }

  [Serializable]
  public class PisteRadio
  {
    public string id = "";
    public string titre = "";
    public string auteur = "";
    /** (ajout) La licence telle qu'affichée (« original » : composition du site), sa source, et les couches. */
    public string licence = "";
    public string lien = "";
    public bool adaptative;
  }

  [Serializable]
  public class EtatRadio
  {
    public bool lecture;
    public string piste = "";
    public PisteRadio[] pistes = Array.Empty<PisteRadio>();
  }

  [Serializable]
  public class Appareil
  {
    public bool mobile;
    /** Le rapport de pixels réel ; la toile est rendue à min(dpr, 1,5) comme la 3D du jeu web. */
    public double dpr = 1;
    public bool economie;
    /** (ajout) Mouvement réduit (système) ou animations coupées (site) : fondus brefs, pas de cinématique. */
    public bool mouvementReduit;
    /** (ajout) Animations du site : 1, 0,5 (allégées) ou 0. */
    public double animations = 1;
  }

  [Serializable]
  public class Config
  {
    public Vue vue = new Vue();
    public string langue = "fr";
    /** Jouer la sortie du tunnel (la page a joué la fissure et le tunnel, sans qu'on les passe). */
    public bool intro;
    /** Le tutoriel se lance directement (premier lancement depuis le menu). */
    public bool tutorielAFaire;
    public bool audioDebloque;
    public Appareil appareil = new Appareil();
    /** (ajout) L'écran demandé : « accueil » (le menu), « tutoriel », « reglages », « commandes »… */
    public string ecran = "accueil";
  }

  // ==========================================================================
  // PAGE → UNITY : un seul format d'entrée, qui réunit les champs de tous les messages (§5.4)
  // ==========================================================================
  [Serializable]
  public class MessageEntrant
  {
    public string type = "";
    // config
    public Vue vue = new Vue();
    public string langue = "";
    public bool intro;
    public bool tutorielAFaire;
    public bool audioDebloque;
    public Appareil appareil = new Appareil();
    public string ecran = "";
    // bilan
    public Bilan bilan = new Bilan();
    // radio
    public EtatRadio etat = new EtatRadio();
    // audio
    public bool debloque;
  }

  // ==========================================================================
  // UNITY → PAGE (§5.4)
  // ==========================================================================
  [Serializable] public class MessagePret { public string type = "pret"; public string version = ""; }
  [Serializable] public class MessageEcran { public string type = "ecran"; public string nom = ""; }
  /** voie −1 : non précisée. */
  [Serializable] public class MessageEvenement { public string type = "evenement"; public string nom = ""; public double valeur; public int voie = -1; }
  /** vitesse de 0 à 1 ; (ajout) avancement, boucliers et boss : la musique adaptative de la page. */
  [Serializable]
  public class MessageMoteur
  {
    public string type = "moteur";
    public bool actif;
    public double vitesse;
    public bool overdrive;
    public double avancement;
    public int boucliers;
    public bool boss;
  }
  [Serializable]
  public class MessageFin
  {
    public string type = "fin";
    public string mode = "";
    public string difficulte = "";
    public int niveau = 1;
    public string vehicule = "";
    public double graine;
    public ResultatJson resultat = new ResultatJson();
  }
  [Serializable] public class MessageReglages { public string type = "reglages"; public Reglages reglages = new Reglages(); }
  [Serializable] public class MessageVehicule { public string type = "vehicule"; public string id = ""; }
  [Serializable] public class MessageEquiper { public string type = "equiper"; public string emplacement = ""; public string piece = ""; }
  [Serializable] public class MessageTutoriel { public string type = "tutoriel"; public string etat = ""; public int phase; }
  [Serializable] public class MessageRadio { public string type = "radio"; public string action = ""; public string piste = ""; }
  [Serializable] public class MessageLangue { public string type = "langue"; public string langue = ""; }
  [Serializable] public class MessageSimple { public string type = ""; }
  [Serializable] public class MessageErreur { public string type = "erreur"; public string message = ""; }
  /** (ajout) Un son de l'interface ou d'une cinématique (le son de Unity est coupé : tout passe par la page). */
  [Serializable] public class MessageSon { public string type = "son"; public string nom = ""; }
  /** (ajout) La difficulté choisie dans un menu (la page la garde, comme le jeu web). */
  [Serializable] public class MessageDifficulte { public string type = "difficulte"; public string difficulte = ""; }

  /** Un objectif atteint ou non, comme dans le Resultat du jeu web (moteur.ts). */
  [Serializable]
  public class ObjectifJson
  {
    public string type = "";
    public double valeur;
    public bool atteint;
    public double mesure;
  }

  /** La forme EXACTE du Resultat du jeu web (moteur.ts) : la page le range tel quel (ranger, format v3). */
  [Serializable]
  public class ResultatJson
  {
    public bool reussi;
    public bool arrive;
    public ObjectifJson[] objectifs = Array.Empty<ObjectifJson>();
    public double score;
    public string rang = "—";
    public double note;
    public int fragments;
    public int fragmentsVus;
    public int parfaits;
    public int comboMax;
    public int multiplicateurMax = 1;
    public int motifs;
    public double distance;
    public double temps;
    public int chocs;
    public int portails;
    public int overdrives;

    public static ResultatJson De(PortalRush.Coeur.Resultat r)
    {
      var objectifs = new ObjectifJson[r.Objectifs.Count];
      for (int i = 0; i < objectifs.Length; i++)
      {
        var o = r.Objectifs[i];
        objectifs[i] = new ObjectifJson { type = PortalRush.Coeur.Noms.De(o.Type), valeur = o.Valeur, atteint = o.Atteint, mesure = o.Mesure };
      }
      return new ResultatJson
      {
        reussi = r.Reussi,
        arrive = r.Arrive,
        objectifs = objectifs,
        score = r.Score,
        rang = r.Rang,
        note = r.Note,
        fragments = r.Fragments,
        fragmentsVus = r.FragmentsVus,
        parfaits = r.Parfaits,
        comboMax = r.ComboMax,
        multiplicateurMax = r.MultiplicateurMax,
        motifs = r.Motifs,
        distance = r.Distance,
        temps = r.Temps,
        chocs = r.Chocs,
        portails = r.Portails,
        overdrives = r.Overdrives,
      };
    }
  }
}
