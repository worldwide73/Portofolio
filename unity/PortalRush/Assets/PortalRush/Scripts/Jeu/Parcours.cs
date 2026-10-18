// PORTAL RUSH (Unity) — LA TRAJECTOIRE 3D
//
// Les règles voient le parcours comme une ligne droite de « Distance » mètres, avec trois voies (X = 0, 1, 2). Ici,
// cette ligne est « posée » sur une trajectoire 3D : virages, montées, descentes et dévers. Chaque mètre a une pose
// (position + orientation) ; une voie est un décalage latéral dans ce repère. Ainsi les voies, les obstacles, le
// vaisseau et la caméra suivent exactement les courbes, sans rien changer à la règle.
//
// Lisibilité (le joueur doit toujours voir venir les dangers) : la courbure est bornée (rayon ≥ RayonMin) pour
// qu'un obstacle qui apparaît (≈ 95 à 130 m) reste dans le champ de la caméra, et les 120 premiers mètres sont droits.
// La forme est tirée de la graine de la partie et du monde : la même partie donne toujours la même route.
#nullable enable
using System;
using System.Collections.Generic;
using PortalRush.Coeur;
using UnityEngine;

namespace PortalRush.Jeu
{
  public sealed class Parcours : MonoBehaviour
  {
    /** L'écart entre deux voies (m). Le jeu web utilise 3,0 m ; la route Unity est plus large. */
    public const float Voie = 3.2f;
    /** Le rayon de virage minimal (m). */
    public const float RayonMin = 230f;
    const float CourbureMax = 1f / RayonMin;

    // Un échantillon par mètre : l'index i est la pose à i mètres.
    readonly List<Vector3> positions = new List<Vector3>(4096);
    readonly List<Quaternion> orientations = new List<Quaternion>(4096);
    readonly List<float> courbures = new List<float>(4096);

    float cap;          // le cap courant (rad, autour de Y ; positif = vers la droite)
    float[] phases = new float[6];
    Func<double, Ambiance>? styleA;
    Ambiance style = Ambiances.De(Theme.Lancement);

    public int Echantillons => positions.Count;

    /** Repart de zéro pour une partie (ou pour l'écran d'accueil). styleA : le style à une distance (mode infini). */
    public void Preparer(Ambiance ambiance, double graine, Func<double, Ambiance>? styleSelonDistance = null)
    {
      style = ambiance;
      styleA = styleSelonDistance;
      var h = new Hasard(graine * 7.0 + (int)ambiance.Theme * 1013 + 17);
      for (int i = 0; i < phases.Length; i++) phases[i] = (float)(h.Suivant() * Math.PI * 2);
      positions.Clear();
      orientations.Clear();
      courbures.Clear();
      cap = 0;
      positions.Add(Vector3.zero);
      orientations.Add(Quaternion.identity);
      courbures.Add(0);
      Etendre(800);
    }

    static float Rampe(double s) => Mathf.SmoothStep(0f, 1f, (float)((s - 120) / 260));

    Ambiance StyleA(double s) => styleA != null ? styleA(s) : style;

    /** La courbure voulue à s (rad/m) : somme de sinus lents, bornée. */
    float Courbure(double s)
    {
      var a = StyleA(s);
      float l = Mathf.Max(300f, a.OndeVirages);
      float A = a.Virages;
      double k = 2 * Math.PI;
      double c = A * 0.55 * (k / l) * Math.Cos(k * s / l + phases[0])
        + A * 0.25 * (k / (l * 0.47)) * Math.Cos(k * s / (l * 0.47) + phases[1])
        + A * 1.6 * (k / (l * 4.3)) * Math.Cos(k * s / (l * 4.3) + phases[2]);
      return Mathf.Clamp((float)c * Rampe(s), -CourbureMax, CourbureMax);
    }

    /** La pente (dh/ds) à s : reliefs lents. */
    float Pente(double s)
    {
      var a = StyleA(s);
      float m = Mathf.Max(300f, a.OndeReliefs);
      double k = 2 * Math.PI;
      double p = a.Reliefs * (k / m) * Math.Cos(k * s / m + phases[3]) + a.Reliefs * 0.4 * (k / (m * 0.43)) * Math.Cos(k * s / (m * 0.43) + phases[4]);
      return Mathf.Clamp((float)p * Rampe(s), -0.22f, 0.22f);
    }

    /** Ajoute des échantillons jusqu'à « jusqua » mètres. */
    public void Etendre(double jusqua)
    {
      int fin = (int)Math.Ceiling(jusqua) + 2;
      while (positions.Count < fin)
      {
        int i = positions.Count;
        double s = i - 0.5;
        float k = Courbure(s);
        cap += k;
        float pente = Pente(s);
        float horizontal = Mathf.Sqrt(Mathf.Max(0.0f, 1f - pente * pente));
        var avant = new Vector3(Mathf.Sin(cap) * horizontal, pente, Mathf.Cos(cap) * horizontal);
        positions.Add(positions[i - 1] + avant);
        // Le repère : avant, droite horizontale, puis le dévers (on penche vers l'intérieur du virage).
        var droite = Vector3.Cross(Vector3.up, avant).normalized;
        var haut = Vector3.Cross(avant, droite);
        float devers = -StyleA(s).Devers * Mathf.Clamp(k / CourbureMax, -1f, 1f);
        var r = Quaternion.AngleAxis(devers * Mathf.Rad2Deg, avant) * Quaternion.LookRotation(avant, haut);
        orientations.Add(r);
        courbures.Add(k);
      }
    }

    /** La pose de la piste à « distance » mètres, sur la voie « x » (0 à 2, continue), à « hauteur » au-dessus. */
    public Pose PoseA(double distance, double x = 1, float hauteur = 0)
    {
      if (positions.Count < 2) Etendre(800);
      float lateral = (float)((x - 1) * Voie);
      if (distance <= 0)
      {
        var r0 = orientations[0];
        return new Pose(positions[0] + r0 * new Vector3(lateral, hauteur, (float)distance), r0);
      }
      if (distance + 2 >= positions.Count) Etendre(distance + 400);
      int i = (int)Math.Floor(distance);
      float t = (float)(distance - i);
      var p = Vector3.LerpUnclamped(positions[i], positions[i + 1], t);
      var q = Quaternion.SlerpUnclamped(orientations[i], orientations[i + 1], t);
      return new Pose(p + q * new Vector3(lateral, hauteur, 0), q);
    }

    /** Le centre de la piste et son repère (sans décalage). */
    public Pose CentreA(double distance) => PoseA(distance, 1, 0);

    /** La courbure (rad/m, positive à droite) : pour incliner le vaisseau et la caméra. */
    public float CourbureA(double distance)
    {
      if (distance <= 0 || courbures.Count == 0) return 0;
      if (distance + 2 >= courbures.Count) Etendre(distance + 400);
      return courbures[(int)Math.Floor(distance)];
    }
  }
}
