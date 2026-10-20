// PORTAL RUSH (Unity) — LE TIRAGE REPRODUCTIBLE (mulberry32), identique bit pour bit à hasardGraine() du jeu web.
#nullable enable
using System;

namespace PortalRush.Coeur
{
  public sealed class Hasard
  {
    uint a;

    /** « graine >>> 0 » en JavaScript : l'entier ramené modulo 2^32. */
    public Hasard(double graine)
    {
      a = unchecked((uint)(long)Math.Truncate(graine));
    }

    public double Suivant()
    {
      unchecked
      {
        a += 0x6D2B79F5u;
        int t = (int)a;
        t = (t ^ (int)((uint)t >> 15)) * (t | 1);
        t ^= t + (t ^ (int)((uint)t >> 7)) * (t | 61);
        uint r = (uint)(t ^ (int)((uint)t >> 14));
        return r / 4294967296.0;
      }
    }
  }
}
