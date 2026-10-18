// PORTAL RUSH (Unity) — LE VAISSEAU DU JOUEUR (et celui de la vitrine)
//
// Il suit Partie.Distance et Partie.X (position réelle, qui glisse vers la voie visée) sur la trajectoire, flotte un
// peu au-dessus de la route, s'incline quand il change de voie et dans les virages, clignote pendant
// l'invulnérabilité, s'illumine en Overdrive. Le modèle vient du catalogue (aube, faucon, bastion, spectre) ; la coque
// et la traînée prennent les couleurs de l'équipement (pièces du garage, « r, g, b » ou « prisme »).
#nullable enable
using System.Collections.Generic;
using PortalRush.Coeur;
using UnityEngine;

namespace PortalRush.Jeu
{
  [DefaultExecutionOrder(10)]
  public sealed class Vaisseau : MonoBehaviour
  {
    public Catalogue? catalogue;
    public TrailRenderer[] trainees = new TrailRenderer[0];
    public Light? reacteur;
    public float survol = 0.62f;

    GameObject? modele;
    string affiche = "";
    int versionVitrine = -1;
    double xPrecedent = 1;
    float roulis, tangage, lacet, flash, secousse;
    readonly List<Renderer> rendus = new List<Renderer>();
    readonly List<int> peints = new List<int>();
    MaterialPropertyBlock bloc = null!;
    Color coque = Color.white, trainee = new Color(0.6f, 0.75f, 1f);
    bool coquePrisme, traineePrisme;
    static readonly int IdBaseColor = Shader.PropertyToID("_BaseColor");

    /** La position monde du vaisseau (pour la caméra et les effets). */
    public Vector3 Position => transform.position;
    public double Distance { get; private set; }
    public double X { get; private set; } = 1;
    /** Le sursaut d'un choc (0 à 1), que la caméra utilise pour trembler. */
    public float Secousse => secousse;

    void Awake()
    {
      bloc = new MaterialPropertyBlock();
    }

    void Start()
    {
      if (Session.Instance != null) Session.Instance.EvenementJeu += QuandEvenement;
    }

    void OnDestroy()
    {
      if (Session.Instance != null) Session.Instance.EvenementJeu -= QuandEvenement;
    }

    void QuandEvenement(Evenement e)
    {
      if (e.Type == TypeEvenement.Choc)
      {
        flash = 1f;
        secousse = 1f;
      }
      else if (e.Type == TypeEvenement.Parfait) flash = Mathf.Max(flash, 0.35f);
    }

    void LateUpdate()
    {
      var m = Monde.Instance;
      if (m == null) return;
      var s = Session.Instance;
      var p = s != null ? s.Partie : null;
      float t = Time.unscaledTime;
      float dt = Mathf.Max(1e-4f, Time.unscaledDeltaTime);
      string vehicule;
      double x;
      if (p != null)
      {
        vehicule = p.Vehicule.Id;
        Distance = p.Distance;
        x = p.X;
      }
      else
      {
        vehicule = Vitrine.Vehicule;
        Distance = m.Distance + 14;
        x = Vitrine.Mode == Vitrine.Etat.Garage ? 1 : 1 + Mathf.Sin(t * 0.35f) * 0.45f;
      }
      bool visible = p != null || Vitrine.Mode != Vitrine.Etat.Masquee;
      if (modele != null && modele.activeSelf != visible) modele.SetActive(visible);
      if (vehicule != affiche || versionVitrine != Vitrine.Version) Equiper(vehicule);
      if (!visible) return;

      // Inclinaisons : changement de voie (vitesse latérale), virage (courbure), petit flottement.
      float vx = (float)((x - xPrecedent) / dt);
      xPrecedent = x;
      float courbure = m.parcours.CourbureA(Distance);
      roulis = Mathf.Lerp(roulis, Mathf.Clamp(-vx * 9f, -30f, 30f) - courbure * 2200f, 1f - Mathf.Exp(-dt * 10f));
      lacet = Mathf.Lerp(lacet, Mathf.Clamp(vx * 3.5f, -10f, 10f), 1f - Mathf.Exp(-dt * 8f));
      tangage = Mathf.Lerp(tangage, p != null && p.Overdrive > 0 ? -3f : 0f, 1f - Mathf.Exp(-dt * 4f));
      float flotte = Mathf.Sin(t * 2.1f) * 0.05f + Mathf.Sin(t * 3.7f) * 0.02f;
      X = x;
      var pose = m.parcours.PoseA(Distance, x, survol + flotte);
      transform.SetPositionAndRotation(pose.position, pose.rotation * Quaternion.Euler(tangage, lacet, roulis));

      // Invulnérabilité (hors Overdrive) : clignotement ; chocs et Perfect Dodge : éclair bref.
      bool clignote = p != null && p.Invincible > 0 && p.Overdrive <= 0 && Mathf.Repeat(t * 12f, 1f) < 0.5f;
      foreach (var r in rendus) if (r != null) r.enabled = !clignote;
      flash = Mathf.Max(0, flash - dt * 3f);
      secousse = Mathf.Max(0, secousse - dt * 2.5f);
      if (reacteur != null)
      {
        float od = p != null && p.Overdrive > 0 ? 1f : 0f;
        reacteur.intensity = 2.2f + od * 6f + flash * 4f;
        reacteur.color = Color.Lerp(trainee, Color.white, od * 0.5f);
      }
      if (coquePrisme || traineePrisme) Peindre(t);
    }

    /** Le modèle du vaisseau et ses couleurs (équipement de la vitrine ou de la vue). */
    void Equiper(string vehicule)
    {
      versionVitrine = Vitrine.Version;
      if (vehicule != affiche || modele == null)
      {
        affiche = vehicule;
        if (modele != null) Destroy(modele);
        var source = catalogue != null ? Catalogue.Trouver(catalogue.vaisseaux, vehicule) : null;
        modele = source != null ? Instantiate(source, transform) : Formes.Vaisseau(catalogue);
        modele.transform.SetParent(transform, false);
        modele.transform.localPosition = Vector3.zero;
        modele.transform.localRotation = Quaternion.identity;
        rendus.Clear();
        peints.Clear();
        modele.GetComponentsInChildren(true, rendus);
        for (int i = 0; i < rendus.Count; i++)
        {
          var mats = rendus[i].sharedMaterials;
          foreach (var mat in mats)
          {
            if (mat == null) continue;
            string nom = mat.name;
            if (catalogue == null || catalogue.peinture.Count == 0 ? nom.Contains("coque") || nom.Contains("peinture") : catalogue.peinture.Contains(nom))
            {
              peints.Add(i);
              break;
            }
          }
        }
      }
      var e = Vitrine.Equipement ?? (Pont.Vue != null ? Pont.Vue.equipement : null);
      coque = CouleurPiece(e != null ? e.coque : null, Color.white, out coquePrisme);
      trainee = CouleurPiece(e != null ? e.trainee : null, new Color(0.6f, 0.75f, 1f), out traineePrisme);
      Peindre(Time.unscaledTime);
    }

    void Peindre(float t)
    {
      var c = coquePrisme ? Color.HSVToRGB(Mathf.Repeat(t * 0.1f, 1f), 0.5f, 1f) : coque;
      var tr = traineePrisme ? Color.HSVToRGB(Mathf.Repeat(t * 0.25f, 1f), 0.8f, 1f) : trainee;
      foreach (int i in peints)
      {
        if (i >= rendus.Count || rendus[i] == null) continue;
        rendus[i].GetPropertyBlock(bloc);
        bloc.SetColor(IdBaseColor, c);
        rendus[i].SetPropertyBlock(bloc);
      }
      foreach (var tre in trainees)
      {
        if (tre == null) continue;
        tre.startColor = tr * 2.5f;
        tre.endColor = new Color(tr.r, tr.g, tr.b, 0f);
      }
    }

    /** La couleur d'une pièce du garage (« r, g, b » de 0 à 255, ou « prisme »). */
    static Color CouleurPiece(string? piece, Color parDefaut, out bool prisme)
    {
      prisme = false;
      if (string.IsNullOrEmpty(piece)) return parDefaut;
      foreach (var p in Donnees.Pieces)
      {
        if (p.Id != piece) continue;
        if (p.Couleur == "prisme")
        {
          prisme = true;
          return parDefaut;
        }
        var parts = p.Couleur.Split(',');
        if (parts.Length == 3 && float.TryParse(parts[0].Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float r)
          && float.TryParse(parts[1].Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float g)
          && float.TryParse(parts[2].Trim(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out float b))
          return new Color(r / 255f, g / 255f, b / 255f);
      }
      return parDefaut;
    }
  }
}
