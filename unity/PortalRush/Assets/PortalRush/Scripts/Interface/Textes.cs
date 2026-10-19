// PORTAL RUSH (Unity) — LES TEXTES DE L'INTERFACE
//
// Les textes du jeu web arrivent par Textes.Generees.cs (outils/unity/exporter-textes.mjs) ; ce fichier-ci donne
// l'accès (Textes.De("menu.continuer")), la mise en forme des nombres et des dates dans la langue du site
// (Pont.Langue), et les quelques textes propres à l'interface Unity (clés « ui. »), en français et en anglais.
// L'export vérifie (--verifier) que chaque clé écrite dans le code existe et que chaque texte nouveau a ses deux langues.
#nullable enable
using System;
using System.Collections.Generic;
using System.Text;
using PortalRush.Jeu;

namespace PortalRush.Interface
{
  public static partial class Textes
  {
    public static bool Anglais => Pont.Langue == "en";

    static readonly HashSet<string> signales = new HashSet<string>();

    /** Le texte d'une clé, dans la langue du site (la clé elle-même s'il manque, signalé une fois). */
    public static string De(string cle)
    {
      bool en = Anglais;
      if ((en ? WebEn : WebFr).TryGetValue(cle, out var t)) return t;
      if ((en ? NouveauxEn : NouveauxFr).TryGetValue(cle, out t)) return t;
      if (signales.Add(cle)) UnityEngine.Debug.LogWarning("[Portal Rush] Texte introuvable : " + cle);
      return cle;
    }

    /** La longueur d'une liste de textes (ex. « commandes.lignes »). */
    public static int Taille(string cle) => (Anglais ? TaillesEn : TaillesFr).TryGetValue(cle, out var n) ? n : 0;

    /** Le texte d'une clé, « {nom} » remplacé par la valeur. */
    public static string Remplir(string cle, string nom, string valeur) => De(cle).Replace("{" + nom + "}", valeur);

    public static string Remplir(string cle, string nom1, string valeur1, string nom2, string valeur2) =>
      De(cle).Replace("{" + nom1 + "}", valeur1).Replace("{" + nom2 + "}", valeur2);

    public static string Remplir(string cle, string nom1, string valeur1, string nom2, string valeur2, string nom3, string valeur3) =>
      De(cle).Replace("{" + nom1 + "}", valeur1).Replace("{" + nom2 + "}", valeur2).Replace("{" + nom3 + "}", valeur3);

    // ==========================================================================
    // LA MISE EN FORME (comme toLocaleString('fr-FR' / 'en-GB') dans le jeu web)
    // ==========================================================================
    /** Math.round de JavaScript. */
    public static double Arrondi(double x) => Math.Floor(x + 0.5);

    /** Un entier lisible : « 12 345 » (espace insécable) ou « 12,345 ». */
    public static string Nombre(double valeur)
    {
      if (double.IsNaN(valeur) || double.IsInfinity(valeur)) return "—";
      long n = (long)Arrondi(valeur);
      bool negatif = n < 0;
      string chiffres = Math.Abs(n).ToString(System.Globalization.CultureInfo.InvariantCulture);
      var sb = new StringBuilder(chiffres.Length + 6);
      if (negatif) sb.Append('-');
      string separateur = Anglais ? "," : " ";
      for (int i = 0; i < chiffres.Length; i++)
      {
        if (i > 0 && (chiffres.Length - i) % 3 == 0) sb.Append(separateur);
        sb.Append(chiffres[i]);
      }
      return sb.ToString();
    }

    /** Un nombre à virgule, au plus « decimales » chiffres après la virgule, sans zéros inutiles (« 0,75 », « 2.5 »). */
    public static string Virgule(double valeur, int decimales = 3)
    {
      double p = Math.Pow(10, decimales);
      double r = Math.Round(valeur * p) / p;
      string s = r.ToString("0." + new string('#', Math.Max(1, decimales)), System.Globalization.CultureInfo.InvariantCulture);
      return Anglais ? s : s.Replace('.', ',');
    }

    /** Le multiplicateur d'une difficulté : « ×0,75 ». */
    public static string Multiplicateur(double valeur) => "×" + Virgule(valeur);

    /** Deux chiffres : « 03 ». */
    public static string Deux(int n) => n.ToString("00", System.Globalization.CultureInfo.InvariantCulture);

    /** Une durée : « 1:07 ». */
    public static string Temps(double secondes)
    {
      int s = (int)Math.Max(0, Math.Floor(secondes));
      return (s / 60).ToString(System.Globalization.CultureInfo.InvariantCulture) + ":" + (s % 60).ToString("00", System.Globalization.CultureInfo.InvariantCulture);
    }

    /** Une date : « 18 octobre 2026 » ou « 18 October 2026 » (sans l'année : « 18 octobre »). */
    public static string Date(DateTime jour, bool annee = true)
    {
      string mois = De($"ui.mois.{jour.Month}");
      string texte = jour.Day.ToString(System.Globalization.CultureInfo.InvariantCulture) + " " + mois;
      return annee ? texte + " " + jour.Year.ToString(System.Globalization.CultureInfo.InvariantCulture) : texte;
    }

    /** Les étiquettes s'écrivent en capitales (USS n'a pas de text-transform). */
    public static string Majuscules(string texte) => texte.ToUpperInvariant();

    // ==========================================================================
    // LES TEXTES NOUVEAUX (propres à l'interface Unity)
    // ==========================================================================
    static readonly Dictionary<string, string> NouveauxFr = new Dictionary<string, string>
    {
      { "ui.modes.titre", "Modes de jeu" },
      { "ui.modes.texte", "Campagne, survie infinie ou défi du jour" },
      { "ui.modes.secteurs", "{n} / {t} secteurs réussis" },
      { "ui.difficultes.choisir", "Choisir la difficulté" },
      { "ui.difficultes.titre", "Difficulté" },
      { "ui.difficultes.ultime", "Difficulté ultime" },
      { "ui.difficultes.pourSecteur", "Pour le secteur {n} · {nom}" },
      { "ui.difficultes.pourInfini", "Pour la survie infinie : une seule vie" },
      { "ui.confirmation.annuler", "Annuler" },
      { "ui.confirmation.perte", "La course en cours sera perdue." },
      { "ui.confirmation.tutoriel", "L'entraînement reprendra à cette étape la prochaine fois." },
      { "ui.bilan.attente", "Enregistrement du résultat…" },
      { "ui.garage.choisir", "Choisir ce vaisseau" },
      { "ui.garage.verrou", "Pour le débloquer : {c}" },
      { "ui.recompense.vaisseau", "Vaisseau : {v}" },
      { "ui.touches.titre", "Touches" },
      { "ui.touches.voie", "Changer de voie" },
      { "ui.touches.overdrive", "Overdrive" },
      { "ui.touches.pause", "Pause" },
      { "ui.touches.recommencer", "Recommencer (fin de partie, pause)" },
      { "ui.touches.naviguer", "Menus : se déplacer" },
      { "ui.touches.valider", "Menus : choisir" },
      { "ui.touches.retour", "Retour, pause, quitter" },
      { "ui.touches.passer", "Passer une séquence" },
      { "ui.radio.aucune", "Aucune piste" },
      { "ui.radio.pistes", "Pistes" },
      { "ui.reglages.qualiteEffective", "En ce moment : {q}" },
      { "ui.etoiles.total", "{n} / {t}" },
      { "ui.mois.1", "janvier" },
      { "ui.mois.2", "février" },
      { "ui.mois.3", "mars" },
      { "ui.mois.4", "avril" },
      { "ui.mois.5", "mai" },
      { "ui.mois.6", "juin" },
      { "ui.mois.7", "juillet" },
      { "ui.mois.8", "août" },
      { "ui.mois.9", "septembre" },
      { "ui.mois.10", "octobre" },
      { "ui.mois.11", "novembre" },
      { "ui.mois.12", "décembre" },
    };

    static readonly Dictionary<string, string> NouveauxEn = new Dictionary<string, string>
    {
      { "ui.modes.titre", "Game modes" },
      { "ui.modes.texte", "Campaign, endless survival or the daily challenge" },
      { "ui.modes.secteurs", "{n} / {t} sectors cleared" },
      { "ui.difficultes.choisir", "Choose difficulty" },
      { "ui.difficultes.titre", "Difficulty" },
      { "ui.difficultes.ultime", "Ultimate difficulty" },
      { "ui.difficultes.pourSecteur", "For sector {n} · {nom}" },
      { "ui.difficultes.pourInfini", "For endless survival: a single life" },
      { "ui.confirmation.annuler", "Cancel" },
      { "ui.confirmation.perte", "The current run will be lost." },
      { "ui.confirmation.tutoriel", "Training will resume at this step next time." },
      { "ui.bilan.attente", "Saving the result…" },
      { "ui.garage.choisir", "Select this ship" },
      { "ui.garage.verrou", "To unlock it: {c}" },
      { "ui.recompense.vaisseau", "Ship: {v}" },
      { "ui.touches.titre", "Keys" },
      { "ui.touches.voie", "Change lanes" },
      { "ui.touches.overdrive", "Overdrive" },
      { "ui.touches.pause", "Pause" },
      { "ui.touches.recommencer", "Restart (end of run, pause)" },
      { "ui.touches.naviguer", "Menus: move" },
      { "ui.touches.valider", "Menus: select" },
      { "ui.touches.retour", "Back, pause, quit" },
      { "ui.touches.passer", "Skip a sequence" },
      { "ui.radio.aucune", "No track" },
      { "ui.radio.pistes", "Tracks" },
      { "ui.reglages.qualiteEffective", "Right now: {q}" },
      { "ui.etoiles.total", "{n} / {t}" },
      { "ui.mois.1", "January" },
      { "ui.mois.2", "February" },
      { "ui.mois.3", "March" },
      { "ui.mois.4", "April" },
      { "ui.mois.5", "May" },
      { "ui.mois.6", "June" },
      { "ui.mois.7", "July" },
      { "ui.mois.8", "August" },
      { "ui.mois.9", "September" },
      { "ui.mois.10", "October" },
      { "ui.mois.11", "November" },
      { "ui.mois.12", "December" },
    };
  }
}
