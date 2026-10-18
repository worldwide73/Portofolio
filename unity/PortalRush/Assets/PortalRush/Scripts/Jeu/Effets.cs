// PORTAL RUSH (Unity) — LES EFFETS : éclats (collecte, choc, obstacle brisé) et lignes de vitesse.
// (Les couleurs de particules sont sur 8 bits : l'éclat HDR qui déclenche le bloom vient du matériau, _Intensite.)
//
// Particules Shuriken uniquement (le VFX Graph demande des compute shaders, absents en WebGL2). Un seul système
// d'éclats, émis à la demande (Emit) ; un système de lignes de vitesse accroché à la caméra, dont le débit suit la
// vitesse et l'Overdrive. Effets réduits : lignes coupées, éclats discrets.
#nullable enable
using PortalRush.Coeur;
using UnityEngine;

namespace PortalRush.Jeu
{
  public sealed class Effets : MonoBehaviour
  {
    public enum Genre { Energie, Dore, Choc, Debris }

    public Material? particules;
    public Transform? camera;

    ParticleSystem? eclats;
    ParticleSystem? lignes;

    static bool Reduits => Pont.Vue != null && Pont.Vue.reglages != null && Pont.Vue.reglages.effetsReduits;

    void Start()
    {
      eclats = Creer("Eclats", transform, false);
      var main = eclats.main;
      main.startLifetime = new ParticleSystem.MinMaxCurve(0.25f, 0.6f);
      main.startSpeed = new ParticleSystem.MinMaxCurve(4f, 14f);
      main.startSize = new ParticleSystem.MinMaxCurve(0.06f, 0.2f);
      main.gravityModifier = 0.4f;
      var forme = eclats.shape;
      forme.shapeType = ParticleSystemShapeType.Sphere;
      forme.radius = 0.3f;

      if (camera != null)
      {
        lignes = Creer("Lignes de vitesse", camera, true);
        var m = lignes.main;
        m.startLifetime = 0.45f;
        m.startSpeed = 0f;
        m.startSize = new ParticleSystem.MinMaxCurve(0.02f, 0.05f);
        m.simulationSpace = ParticleSystemSimulationSpace.Local;
        var v = lignes.velocityOverLifetime;
        v.enabled = true;
        v.space = ParticleSystemSimulationSpace.Local;
        v.z = new ParticleSystem.MinMaxCurve(-90f, -60f);
        v.x = new ParticleSystem.MinMaxCurve(0f, 0f);
        v.y = new ParticleSystem.MinMaxCurve(0f, 0f);
        var f = lignes.shape;
        f.shapeType = ParticleSystemShapeType.Circle;
        f.radius = 9f;
        f.radiusThickness = 0.35f;
        f.position = new Vector3(0, 0, 38f);
        var r = lignes.GetComponent<ParticleSystemRenderer>();
        r.renderMode = ParticleSystemRenderMode.Stretch;
        r.velocityScale = 0.06f;
        r.lengthScale = 2f;
        var e = lignes.emission;
        e.enabled = true;
        e.rateOverTime = 0;
      }
    }

    ParticleSystem Creer(string nom, Transform parent, bool emission)
    {
      var go = new GameObject(nom);
      go.transform.SetParent(parent, false);
      var ps = go.AddComponent<ParticleSystem>();
      ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
      var main = ps.main;
      main.maxParticles = 600;
      main.simulationSpace = ParticleSystemSimulationSpace.World;
      main.playOnAwake = false;
      var e = ps.emission;
      e.enabled = emission;
      var r = go.GetComponent<ParticleSystemRenderer>();
      if (particules != null) r.sharedMaterial = particules;
      r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
      r.receiveShadows = false;
      ps.Play();
      return ps;
    }

    public void Eclat(Vector3 position, Genre genre)
    {
      if (eclats == null) return;
      Color c;
      int n;
      switch (genre)
      {
        case Genre.Dore: c = new Color(1f, 0.78f, 0.3f); n = 26; break;
        case Genre.Choc: c = new Color(1f, 0.25f, 0.2f); n = 34; break;
        case Genre.Debris: c = new Color(1f, 0.6f, 0.3f); n = 40; break;
        default: c = Monde.Instance != null ? Monde.Instance.Ambiance.Accent : Color.cyan; n = 20; break;
      }
      if (Reduits) n /= 3;
      var p = new ParticleSystem.EmitParams { position = position, startColor = c, applyShapeToPosition = true };
      eclats.Emit(p, n);
    }

    void Update()
    {
      if (lignes == null) return;
      var s = Session.Instance;
      var partie = s != null ? s.Partie : null;
      float debit = 0;
      if (partie != null && !Reduits && s!.EnCours && !s.EnPause && s.Compte <= 0)
      {
        float v = (float)partie.Vitesse;
        debit = Mathf.Clamp01((v - 30f) / 50f) * 140f + (partie.Overdrive > 0 ? 220f : 0f);
      }
      var e = lignes.emission;
      e.rateOverTime = debit;
      var m = lignes.main;
      var accent = Monde.Instance != null ? Monde.Instance.Ambiance.Accent : Color.white;
      // (Couleurs sur 8 bits : l'intensité vient du matériau ; l'Overdrive les rend plus opaques.)
      var teinte = Color.Lerp(Color.white, accent, 0.5f);
      teinte.a = partie != null && partie.Overdrive > 0 ? 1f : 0.55f;
      m.startColor = teinte;
    }
  }
}
