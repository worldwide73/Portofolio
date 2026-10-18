// PORTAL RUSH (Unity) — UN PETIT LECTEUR JSON pour les parties de référence.
// Unity n'embarque pas System.Text.Json et JsonUtility ne lit pas les tableaux hétérogènes : ce lecteur minimal
// (objets, tableaux, nombres, chaînes, booléens, null) sert aux tests, dans Unity comme en .NET pur.
#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace PortalRush.Coeur.Verification
{
  public static class Json
  {
    /** Rend : Dictionary<string, object?>, List<object?>, double, string, bool ou null. */
    public static object? Lire(string texte)
    {
      int i = 0;
      var v = Valeur(texte, ref i);
      Blancs(texte, ref i);
      if (i != texte.Length) throw new FormatException("JSON : texte en trop à la position " + i);
      return v;
    }

    static void Blancs(string s, ref int i)
    {
      while (i < s.Length && (s[i] == ' ' || s[i] == '\n' || s[i] == '\r' || s[i] == '\t')) i++;
    }

    static object? Valeur(string s, ref int i)
    {
      Blancs(s, ref i);
      if (i >= s.Length) throw new FormatException("JSON : fin inattendue");
      char c = s[i];
      if (c == '{')
      {
        i++;
        var d = new Dictionary<string, object?>();
        Blancs(s, ref i);
        if (s[i] == '}') { i++; return d; }
        while (true)
        {
          Blancs(s, ref i);
          string cle = Chaine(s, ref i);
          Blancs(s, ref i);
          if (s[i++] != ':') throw new FormatException("JSON : « : » attendu à " + i);
          d[cle] = Valeur(s, ref i);
          Blancs(s, ref i);
          char f = s[i++];
          if (f == '}') return d;
          if (f != ',') throw new FormatException("JSON : « , » attendu à " + i);
        }
      }
      if (c == '[')
      {
        i++;
        var l = new List<object?>();
        Blancs(s, ref i);
        if (s[i] == ']') { i++; return l; }
        while (true)
        {
          l.Add(Valeur(s, ref i));
          Blancs(s, ref i);
          char f = s[i++];
          if (f == ']') return l;
          if (f != ',') throw new FormatException("JSON : « , » attendu à " + i);
        }
      }
      if (c == '"') return Chaine(s, ref i);
      if (s.Length - i >= 4 && string.CompareOrdinal(s, i, "true", 0, 4) == 0) { i += 4; return true; }
      if (s.Length - i >= 5 && string.CompareOrdinal(s, i, "false", 0, 5) == 0) { i += 5; return false; }
      if (s.Length - i >= 4 && string.CompareOrdinal(s, i, "null", 0, 4) == 0) { i += 4; return null; }
      int debut = i;
      while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
      if (i == debut) throw new FormatException("JSON : valeur inattendue à " + i);
      return double.Parse(s.Substring(debut, i - debut), NumberStyles.Float, CultureInfo.InvariantCulture);
    }

    static string Chaine(string s, ref int i)
    {
      if (s[i] != '"') throw new FormatException("JSON : chaîne attendue à " + i);
      i++;
      var b = new StringBuilder();
      while (s[i] != '"')
      {
        char c = s[i++];
        if (c != '\\') { b.Append(c); continue; }
        char e = s[i++];
        switch (e)
        {
          case 'n': b.Append('\n'); break;
          case 't': b.Append('\t'); break;
          case 'r': b.Append('\r'); break;
          case 'b': b.Append('\b'); break;
          case 'f': b.Append('\f'); break;
          case 'u': b.Append((char)Convert.ToInt32(s.Substring(i, 4), 16)); i += 4; break;
          default: b.Append(e); break;
        }
      }
      i++;
      return b.ToString();
    }
  }
}
