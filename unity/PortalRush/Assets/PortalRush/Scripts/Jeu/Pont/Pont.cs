// PORTAL RUSH (Unity) — LE PONT AVEC LA PAGE DU PORTFOLIO (contrat docs/UNITY_ARCHITECTURE.md, §5.3 à §5.6)
//
// La page (src/scripts/rush-unity/pont.ts) garde la sauvegarde, l'audio et la langue ; Unity affiche et fait jouer.
//   Page → Unity : SendMessage('Pont', 'Recevoir', json) sur l'objet « Pont » de la scène ;
//   Unity → page : PortalRush_Envoyer(json) (Plugins/WebGL/PortalRushPont.jslib) → window.__portalRushUnity.recevoir.
// Pont envoie lui-même « pret » à la fin de sa première image : la page attend ce signal pour lui parler (en Unity 6,
// un SendMessage juste après createUnityInstance peut ne pas trouver l'objet), puis répond « config ».
// Qui appelle quoi : Session appelle EvenementJeu (chaque évènement), Moteur (10 fois par seconde au plus ; vitesse
// en m/s, Pont la ramène de 0 à 1 comme rush.ts) et Fin (dès la fin de la partie, avant la séquence de fin) ;
// l'interface appelle Ecran, Son, Reglages, ChoisirVehicule, Equiper, ChoisirDifficulte, Tutoriel, Radio,
// ChangerLangue et Fermer. Pont n'abonne rien lui-même.
// Dans l'éditeur (ou un build Web ouvert sans le portfolio), Pont simule la page : vue par défaut, bilan local
// minimal, aucune écriture persistante, et chaque message est écrit dans la console.
#nullable enable
using System;
using System.Collections;
using System.Linq;
using PortalRush.Coeur;
using UnityEngine;
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace PortalRush.Jeu
{
  [DisallowMultipleComponent]
  [DefaultExecutionOrder(-100)]
  public sealed class Pont : MonoBehaviour
  {
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] static extern void PortalRush_Envoyer(string json);
    [DllImport("__Internal")] static extern int PortalRush_DansLaPage();
#endif

    public static Pont? Instance { get; private set; }
    /** Build Web ouvert par le portfolio (window.__portalRushUnity existe). */
    public static bool DansLaPage { get; private set; }
    /** La dernière vue reçue (jamais nulle : une vue par défaut avant la première). */
    public static Vue Vue { get; private set; } = Simulation.VueParDefaut();
    public static Config? Config { get; private set; }
    /** « fr » | « en ». */
    public static string Langue { get; private set; } = "fr";
    /** (ajout) Le dernier état de RUSH RADIO, et l'audio du navigateur débloqué. */
    public static EtatRadio? RadioEtat { get; private set; }
    public static bool AudioDebloque { get; private set; }
    /** Écrire chaque message dans la console (toujours dans l'éditeur ; dans le navigateur, build de développement). */
    public static bool Journaliser;

    public static event Action<Config>? ConfigRecue;
    public static event Action<Vue>? VueChangee;
    public static event Action<Bilan>? BilanRecu;
    public static event Action<string>? LangueChangee;
    public static event Action<EtatRadio>? RadioChangee;
    public static event Action? PauseDemandee, ReprendreDemandee, FermetureDemandee;

    [Header("Simulation de la page (éditeur, ou build Web sans le portfolio)")]
    [Tooltip("La config simulée demande la sortie du tunnel (faux : on arrive tout de suite au menu).")]
    public bool simulerIntro;
    [Tooltip("La config simulée lance le tutoriel (premier lancement).")]
    public bool simulerTutoriel;

    static bool pretEnvoye;
    static bool moteurActif, moteurOverdrive;
    static float prochainMoteur;

    // (Sans rechargement du domaine à l'entrée en jeu dans l'éditeur, les champs statiques survivraient d'une fois à l'autre.)
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
    static void Reinitialiser()
    {
      Instance = null;
      DansLaPage = false;
      Vue = Simulation.VueParDefaut();
      Config = null;
      Langue = "fr";
      RadioEtat = null;
      AudioDebloque = false;
      Journaliser = Application.isEditor || Debug.isDebugBuild;
      ConfigRecue = null;
      VueChangee = null;
      BilanRecu = null;
      LangueChangee = null;
      RadioChangee = null;
      PauseDemandee = ReprendreDemandee = FermetureDemandee = null;
      pretEnvoye = false;
      moteurActif = moteurOverdrive = false;
      prochainMoteur = 0;
    }

    void Awake()
    {
      if (Instance != null && Instance != this)
      {
        Debug.LogWarning("[Pont] un seul Pont par scène : celui-ci est retiré.");
        Destroy(this);
        return;
      }
      Instance = this;
      Journaliser = Application.isEditor || Debug.isDebugBuild;
#if UNITY_WEBGL && !UNITY_EDITOR
      DansLaPage = PortalRush_DansLaPage() == 1;
      // Le clavier n'est lu que sur la toile, quand elle a le focus : le portfolio garde le sien le reste du temps.
      WebGLInput.captureAllKeyboardInput = false;
#endif
      // Tout le son passe par la page (sons.ts, RUSH RADIO) : Unity reste muet.
      if (DansLaPage) AudioListener.volume = 0f;
    }

    void OnDestroy()
    {
      if (Instance == this) Instance = null;
    }

    IEnumerator Start()
    {
      // « pret » : la première image est dessinée.
      yield return null;
      Pret();
    }

    // ==========================================================================
    // PAGE → UNITY
    // ==========================================================================
    /** Cible de SendMessage('Pont', 'Recevoir', json). */
    public void Recevoir(string json)
    {
      MessageEntrant? m;
      try
      {
        m = JsonUtility.FromJson<MessageEntrant>(json);
      }
      catch (Exception e)
      {
        Debug.LogWarning($"[Pont] message illisible : {e.Message}");
        return;
      }
      if (m == null || string.IsNullOrEmpty(m.type)) return;
      if (Journaliser) Debug.Log($"[Pont] page → Unity : {Abreger(json)}");
      switch (m.type)
      {
        case "config":
          var c = new Config { vue = m.vue, langue = m.langue, intro = m.intro, tutorielAFaire = m.tutorielAFaire, audioDebloque = m.audioDebloque, appareil = m.appareil, ecran = string.IsNullOrEmpty(m.ecran) ? "accueil" : m.ecran };
          Config = c;
          AudioDebloque = m.audioDebloque;
          Vue = m.vue;
          PoserLangue(m.langue, false);
          ConfigRecue?.Invoke(c);
          VueChangee?.Invoke(Vue);
          break;
        case "vue":
          Vue = m.vue;
          VueChangee?.Invoke(Vue);
          break;
        case "bilan":
          Vue = m.bilan.vue;
          VueChangee?.Invoke(Vue);
          BilanRecu?.Invoke(m.bilan);
          break;
        case "langue":
          PoserLangue(m.langue, true);
          break;
        case "radio":
          RadioEtat = m.etat;
          RadioChangee?.Invoke(m.etat);
          break;
        case "pause":
          PauseDemandee?.Invoke();
          break;
        case "reprendre":
          // (Comme le jeu web, la course ne reprend jamais seule : c'est au joueur de quitter l'écran de pause.)
          ReprendreDemandee?.Invoke();
          break;
        case "fermer":
          // La page demande la fermeture : tout s'arrête (Session abandonne la partie), puis on répond « fermer ».
          FermetureDemandee?.Invoke();
          Fermer();
          break;
        case "audio":
          AudioDebloque = m.debloque;
          break;
        default:
          Debug.LogWarning($"[Pont] message inconnu : {m.type}");
          break;
      }
    }

    static void PoserLangue(string langue, bool prevenir)
    {
      string l = langue == "en" ? "en" : "fr";
      bool change = l != Langue;
      Langue = l;
      if (prevenir || change) LangueChangee?.Invoke(l);
    }

    // ==========================================================================
    // UNITY → PAGE
    // ==========================================================================
    /** « pret » (une seule fois) : Pont écoute et la première image est dessinée. Pont l'envoie lui-même. */
    public static void Pret()
    {
      if (pretEnvoye) return;
      pretEnvoye = true;
      Envoyer(new MessagePret { version = Application.version });
    }

    /** L'écran affiché : intro, menu, niveaux, garage, records, reglages, jeu, pause, fin (les résultats), tutoriel. */
    public static void Ecran(string nom) => Envoyer(new MessageEcran { nom = nom });

    /** Chaque évènement du moteur, dans l'ordre (la page en fait les sons et la musique, comme rush.ts). */
    public static void EvenementJeu(Evenement e) => Envoyer(new MessageEvenement { nom = Noms.De(e.Type), valeur = e.Valeur ?? 0, voie = e.Voie ?? -1 });

    /**
     * Le moteur du vaisseau. « vitesse » en m/s (celle de la partie) : ramenée de 0 (départ du profil) à 1 (maximum),
     * comme rush.ts. Avec l'avancée, les boucliers et le boss de la partie en cours : la musique adaptative.
     * Au plus 10 messages par seconde ; un changement (marche, arrêt, Overdrive) part tout de suite.
     */
    public static void Moteur(bool actif, double vitesse, bool overdrive)
    {
      float maintenant = Time.unscaledTime;
      bool change = actif != moteurActif || overdrive != moteurOverdrive;
      if (!change && (!actif || maintenant < prochainMoteur)) return;
      prochainMoteur = maintenant + 0.1f;
      moteurActif = actif;
      moteurOverdrive = overdrive;
      var m = new MessageMoteur { actif = actif, overdrive = overdrive };
      var p = Session.Instance != null ? Session.Instance.Partie : null;
      if (p != null)
      {
        double depart = p.Profil.Vitesse.Depart, max = p.Profil.Vitesse.Max;
        m.vitesse = Math.Max(0, Math.Min(1, (vitesse - depart) / Math.Max(1, max - depart)));
        // (rush.ts : l'avancée ne compte que sur un parcours de longueur finie ; pas en survie ni face au boss.)
        m.avancement = double.IsInfinity(p.Longueur) ? 0 : p.Avancement;
        m.boucliers = p.Boucliers;
        m.boss = p.Boss != null;
      }
      else m.boucliers = 99;
      Envoyer(m);
    }

    /** La partie est finie (dès la fin, avant la séquence de fin) : la page range le résultat et répond « bilan ». */
    public static void Fin(Lancement l, double graine, Resultat r)
    {
      // (Comme le jeu web : le défi se court en Ace et en Aube ; survie et défi comptent « secteur 1 ».)
      bool defi = l.Mode == Mode.Defi;
      Envoyer(new MessageFin
      {
        mode = Noms.De(l.Mode),
        difficulte = Noms.De(defi ? Donnees.DifficulteDefi : l.Difficulte),
        niveau = l.Mode == Mode.Campagne ? Mathf.Clamp(l.Niveau, 1, Donnees.Niveaux.Length) : 1,
        vehicule = defi ? Donnees.VehiculeDepart : l.Vehicule,
        graine = graine,
        resultat = ResultatJson.De(r),
      });
    }

    /** Les réglages, objet complet : partir d'une copie de Vue.reglages (Reglages.Copie()). La page répond « vue ». */
    public static void Reglages(Reglages r) => Envoyer(new MessageReglages { reglages = r });
    /** Un vaisseau gagné devient le vaisseau choisi ; la page répond « vue ». */
    public static void ChoisirVehicule(string id) => Envoyer(new MessageVehicule { id = id });
    /** Équipe une pièce gagnée (emplacement : coque, trainee, overdrive, noyau) ; la page répond « vue ». */
    public static void Equiper(string emplacement, string piece) => Envoyer(new MessageEquiper { emplacement = emplacement, piece = piece });
    /** (ajout) La difficulté choisie dans un menu ; la page répond « vue ». */
    public static void ChoisirDifficulte(Difficulte d) => Envoyer(new MessageDifficulte { difficulte = Noms.De(d) });
    /** L'état du tutoriel (nouveau, commence, termine, passe) et l'étape ; la page répond « vue ». */
    public static void Tutoriel(string etat, int phase) => Envoyer(new MessageTutoriel { etat = etat, phase = phase });
    /** RUSH RADIO : lecture, pause, suivante, precedente, piste (avec son id) ; la page répond « radio ». */
    public static void Radio(string action, string? piste = null) => Envoyer(new MessageRadio { action = action, piste = piste ?? "" });
    /** Change la langue du site ; la page répond « langue ». */
    public static void ChangerLangue(string langue) => Envoyer(new MessageLangue { langue = langue == "en" ? "en" : "fr" });
    /** (ajout) Un son de l'interface ou d'une cinématique : deplacement, pret, fragment, ouverture, sortie, victoire… */
    public static void Son(string nom) => Envoyer(new MessageSon { nom = nom });
    /** Ferme le jeu : la page restaure le portfolio et rend le focus. */
    public static void Fermer() => Envoyer(new MessageSimple { type = "fermer" });
    /** Une erreur à signaler à la page (avant « config », elle la fait revenir à l'ancien jeu). */
    public static void Erreur(string message) => Envoyer(new MessageErreur { message = message });

    static void Envoyer(object message)
    {
      string json = JsonUtility.ToJson(message);
      if (Journaliser && !(message is MessageMoteur)) Debug.Log($"[Pont] Unity → page : {Abreger(json)}");
#if UNITY_WEBGL && !UNITY_EDITOR
      if (DansLaPage)
      {
        PortalRush_Envoyer(json);
        return;
      }
#endif
      Simulation.Repondre(message);
    }

    static string Abreger(string json) => json.Length > 400 ? json.Substring(0, 400) + "…" : json;

    /** Pour la simulation : rejoue un message de la page au prochain passage (jamais pendant l'appel). */
    internal static void Simuler(string json)
    {
      if (Instance != null) Instance.StartCoroutine(Instance.Differer(json));
      else Debug.Log($"[Pont] (simulation, pas de Pont actif) {Abreger(json)}");
    }

    IEnumerator Differer(string json)
    {
      yield return null;
      Recevoir(json);
    }

    // ==========================================================================
    // LA SIMULATION DE LA PAGE (éditeur, ou build Web sans le portfolio) : rien n'est enregistré
    // ==========================================================================
    static class Simulation
    {
      static string Camel(string s) => char.ToLowerInvariant(s[0]) + s.Substring(1);

      static ConditionVue Condition(PortalRush.Coeur.Condition c)
      {
        var v = new ConditionVue { type = c.Type, niveau = c.Niveau, rang = c.Rang, stat = c.Stat, difficulte = c.Type == "difficulte" ? Noms.De(c.Difficulte) : "" };
        switch (c.Type)
        {
          case "depart": v.faite = true; v.mesure = 1; v.cible = 1; break;
          case "infini": case "total": v.cible = c.Valeur; break;
          case "multiplicateur": v.mesure = 1; v.cible = c.Valeur; break;
          default: v.cible = 1; break;
        }
        return v;
      }

      /** La vue d'un profil neuf (la sauvegarde vide du jeu web). */
      public static Vue VueParDefaut()
      {
        var maintenant = DateTime.Now;
        var equipement = new Equipement();
        string[] equipes = { equipement.coque, equipement.trainee, equipement.overdrive, equipement.noyau };
        return new Vue
        {
          difficultes = Donnees.OrdreDifficultes.Select(d => new DifficulteVue { id = Noms.De(d), ouverte = d != Difficulte.Cauchemar && d != Difficulte.Paradoxe }).ToArray(),
          niveaux = Donnees.Niveaux.Select(n => new NiveauVue
          {
            id = n.Id,
            theme = Noms.De(n.Theme),
            debloque = n.Id == 1,
            scores = Donnees.OrdreDifficultes.Select((d, i) => new ScoreNiveau { difficulte = Noms.De(d), etoile = n.Etoiles != null && i < n.Etoiles.Length ? n.Etoiles[i] : 0 }).ToArray(),
          }).ToArray(),
          vehicules = Donnees.Vehicules.Select(x => new VehiculeVue { id = x.Id, modele = x.Modele, debloque = x.Condition.Type == "depart", condition = Condition(x.Condition) }).ToArray(),
          pieces = Donnees.Pieces.Select(p => new PieceVue
          {
            id = p.Id,
            emplacement = Camel(p.Emplacement.ToString()),
            couleur = p.Couleur,
            debloquee = p.Condition.Type == "depart",
            equipee = Array.IndexOf(equipes, p.Id) >= 0,
            condition = Condition(p.Condition),
          }).ToArray(),
          equipement = equipement,
          defi = new DefiVue { graine = maintenant.Year * 10000 + maintenant.Month * 100 + maintenant.Day },
        };
      }

      /** Ce que la page répondrait (simplifié : aucune règle de progression complète, rien d'enregistré). */
      public static void Repondre(object message)
      {
        var v = Vue;
        switch (message)
        {
          case MessagePret _:
            Simuler(JsonUtility.ToJson(new MessageEntrant
            {
              type = "config",
              vue = v,
              langue = Langue,
              intro = Instance != null && Instance.simulerIntro,
              tutorielAFaire = Instance != null && Instance.simulerTutoriel,
              audioDebloque = true,
              appareil = new Appareil { mobile = Application.isMobilePlatform, dpr = 1 },
              ecran = Instance != null && Instance.simulerTutoriel ? "tutoriel" : "accueil",
            }));
            break;
          case MessageReglages r:
            v.reglages = r.reglages.Copie();
            Simuler(JsonUtility.ToJson(new MessageEntrant { type = "vue", vue = v }));
            break;
          case MessageVehicule r:
            if (v.vehicules.Any(x => x.id == r.id && x.debloque)) v.vehicule = r.id;
            Simuler(JsonUtility.ToJson(new MessageEntrant { type = "vue", vue = v }));
            break;
          case MessageEquiper r:
            var piece = v.pieces.FirstOrDefault(x => x.id == r.piece && x.emplacement == r.emplacement && x.debloquee);
            if (piece != null)
            {
              foreach (var x in v.pieces) if (x.emplacement == r.emplacement) x.equipee = x == piece;
              switch (r.emplacement)
              {
                case "coque": v.equipement.coque = r.piece; break;
                case "trainee": v.equipement.trainee = r.piece; break;
                case "overdrive": v.equipement.overdrive = r.piece; break;
                case "noyau": v.equipement.noyau = r.piece; break;
              }
            }
            Simuler(JsonUtility.ToJson(new MessageEntrant { type = "vue", vue = v }));
            break;
          case MessageDifficulte r:
            if (v.difficultes.Any(x => x.id == r.difficulte && x.ouverte)) v.difficulte = r.difficulte;
            Simuler(JsonUtility.ToJson(new MessageEntrant { type = "vue", vue = v }));
            break;
          case MessageTutoriel r:
            if (v.tutoriel.etat != "termine" && !(v.tutoriel.etat == "passe" && r.etat != "termine"))
            {
              v.tutoriel.etat = r.etat;
              v.tutoriel.phase = r.phase;
              v.tutoriel.aFaire = r.etat == "nouveau" || r.etat == "commence";
            }
            Simuler(JsonUtility.ToJson(new MessageEntrant { type = "vue", vue = v }));
            break;
          case MessageFin r:
            Simuler(JsonUtility.ToJson(new MessageEntrant { type = "bilan", bilan = BilanMinimal(v, r) }));
            break;
          case MessageRadio r:
            var e = RadioEtat ?? new EtatRadio { piste = "neon-rush" };
            if (r.action == "lecture") e.lecture = true;
            else if (r.action == "pause") e.lecture = false;
            else if (r.action == "piste" && !string.IsNullOrEmpty(r.piste)) { e.piste = r.piste; e.lecture = true; }
            Simuler(JsonUtility.ToJson(new MessageEntrant { type = "radio", etat = e }));
            break;
          case MessageLangue r:
            Simuler(JsonUtility.ToJson(new MessageEntrant { type = "langue", langue = r.langue }));
            break;
          case MessageSimple r when r.type == "fermer":
            Debug.Log("[Pont] (simulation) la page fermerait le jeu ici et rendrait le portfolio.");
            break;
        }
      }

      /** Un bilan local, minimal : la réussite, le record, le secteur suivant ; la vue suit (en mémoire seulement). */
      static Bilan BilanMinimal(Vue v, MessageFin f)
      {
        var r = f.resultat;
        var b = new Bilan();
        var n = f.mode == "campagne" ? v.niveaux.FirstOrDefault(x => x.id == f.niveau) : null;
        var score = n?.scores.FirstOrDefault(x => x.difficulte == f.difficulte);
        if (score != null)
        {
          b.ancienRecord = score.record;
          if (r.reussi)
          {
            bool[] cetteFois = { true, r.score >= score.etoile, r.objectifs.Skip(1).Any(o => o.atteint) };
            var avant = score.etoiles.Length == 3 ? score.etoiles : new bool[3];
            var apres = avant.Select((x, i) => x || cetteFois[i]).ToArray();
            b.etoiles = apres;
            b.nouvellesEtoiles = Enumerable.Range(0, 3).Where(i => apres[i] && !avant[i]).ToArray();
            score.etoiles = apres;
            score.reussi = true;
            b.record = r.score > score.record;
            if (b.record) { score.record = r.score; score.rang = r.rang; }
            if (f.niveau >= v.niveauMax && f.niveau < v.niveaux.Length)
            {
              v.niveauMax = f.niveau + 1;
              b.niveauDebloque = f.niveau + 1;
              foreach (var x in v.niveaux) x.debloque = x.id <= v.niveauMax;
            }
          }
        }
        v.totaux.parties++;
        b.vue = v;
        return b;
      }
    }
  }
}
