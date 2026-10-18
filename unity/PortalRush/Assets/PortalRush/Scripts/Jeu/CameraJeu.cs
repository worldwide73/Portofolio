// PORTAL RUSH (Unity) — LA CAMÉRA
//
// En partie : derrière et au-dessus du vaisseau, elle suit la trajectoire (pas le vaisseau en ligne droite : elle
// reste dans le repère de la route, ce qui garde les voies lisibles dans les virages) et regarde loin devant pour
// laisser voir venir les obstacles. Le champ de vision s'élargit avec la vitesse et l'Overdrive ; un choc la fait
// trembler (réglage « secousses », jamais avec les effets réduits). Hors partie : survol lent (menus) ou orbite
// autour du vaisseau (garage).
#nullable enable
using UnityEngine;

namespace PortalRush.Jeu
{
  [DefaultExecutionOrder(20)]
  [RequireComponent(typeof(Camera))]
  public sealed class CameraJeu : MonoBehaviour
  {
    public Vaisseau? vaisseau;
    public float recul = 7.2f;
    public float hauteur = 2.6f;
    public float visee = 26f;
    public float champ = 62f;

    Camera cam = null!;
    float xCam = 1;
    float champCourant;
    float orbite;
    Vector3 lisse;
    Quaternion lisseRot = Quaternion.identity;
    bool premiere = true;

    void Awake()
    {
      cam = GetComponent<Camera>();
      champCourant = champ;
    }

    static bool Reduits => Pont.Vue != null && Pont.Vue.reglages != null && Pont.Vue.reglages.effetsReduits;
    static bool Secousses => Pont.Vue == null || Pont.Vue.reglages == null || Pont.Vue.reglages.secousses;

    void LateUpdate()
    {
      var m = Monde.Instance;
      if (m == null) return;
      var s = Session.Instance;
      var p = s != null ? s.Partie : null;
      float dt = Mathf.Max(1e-4f, Time.unscaledDeltaTime);
      Vector3 position;
      Quaternion rotation;
      float champVoulu = champ;

      if (p != null || Vitrine.Mode != Vitrine.Etat.Garage)
      {
        double d = vaisseau != null ? vaisseau.Distance : m.Distance + 14;
        float x = vaisseau != null ? (float)vaisseau.X : 1f;
        // La caméra suit la voie à moitié : le vaisseau se déplace dans l'image, la route reste stable.
        xCam = Mathf.Lerp(xCam, 1f + (x - 1f) * 0.55f, 1f - Mathf.Exp(-dt * 6f));
        var arriere = m.parcours.PoseA(d - recul, xCam, hauteur);
        var cible = m.parcours.PoseA(d + visee, 1f + (xCam - 1f) * 0.4f, 0.9f);
        position = arriere.position;
        var haut = arriere.rotation * Vector3.up;
        rotation = Quaternion.LookRotation(cible.position - position, haut);
        if (p != null)
        {
          float v = (float)p.Vitesse;
          champVoulu = champ + Mathf.Clamp01((v - 30f) / 60f) * (Reduits ? 3f : 9f) + (p.Overdrive > 0 && !Reduits ? 7f : 0f);
        }
        else champVoulu = champ - 4f;
        // Secousse d'un choc.
        if (vaisseau != null && vaisseau.Secousse > 0 && Secousses && !Reduits)
        {
          float k = vaisseau.Secousse * vaisseau.Secousse * 0.35f;
          float t = Time.unscaledTime * 47f;
          position += rotation * new Vector3(Mathf.PerlinNoise(t, 0.3f) - 0.5f, Mathf.PerlinNoise(0.7f, t) - 0.5f, 0) * k;
        }
      }
      else
      {
        // Garage : orbite lente autour du vaisseau de la vitrine.
        orbite += dt * 14f;
        var centre = vaisseau != null ? vaisseau.Position : m.parcours.PoseA(m.Distance + 14).position;
        var repere = m.parcours.PoseA(vaisseau != null ? vaisseau.Distance : m.Distance + 14).rotation;
        var dir = repere * (Quaternion.Euler(14f, orbite, 0) * Vector3.back);
        position = centre + dir * 6.5f + repere * Vector3.up * 0.6f;
        rotation = Quaternion.LookRotation(centre - position, repere * Vector3.up);
        champVoulu = 40f;
      }

      // Lissage léger (pas en partie : la caméra doit rester exacte par rapport à la route).
      if (premiere || p != null)
      {
        lisse = position;
        lisseRot = rotation;
        premiere = false;
      }
      else
      {
        float k = 1f - Mathf.Exp(-dt * 5f);
        lisse = Vector3.Lerp(lisse, position, k);
        lisseRot = Quaternion.Slerp(lisseRot, rotation, k);
      }
      transform.SetPositionAndRotation(lisse, lisseRot);
      champCourant = Mathf.Lerp(champCourant, champVoulu, 1f - Mathf.Exp(-dt * 3f));
      cam.fieldOfView = champCourant;
    }
  }
}
