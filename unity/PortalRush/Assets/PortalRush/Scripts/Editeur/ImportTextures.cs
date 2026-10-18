// PORTAL RUSH (Unity) — L'IMPORT DES TEXTURES (Assets/PortalRush/Textures, écrites par outils/unity/textures.py)
//
// *_Normal → normal map ; *_Masque → données linéaires (R = métal, A = lissé) ; *_Couleur → sRGB. Toutes : mipmaps,
// filtrage anisotrope (lisibilité de la route en vue rasante, sans scintillement), répétition, 1024 px au plus.
#nullable enable
using UnityEditor;
using UnityEngine;

namespace PortalRush.Editeur
{
  public sealed class ImportTextures : AssetPostprocessor
  {
    void OnPreprocessTexture()
    {
      if (!assetPath.StartsWith("Assets/PortalRush/Textures/")) return;
      var t = (TextureImporter)assetImporter;
      string nom = System.IO.Path.GetFileNameWithoutExtension(assetPath);
      t.mipmapEnabled = true;
      t.wrapMode = TextureWrapMode.Repeat;
      t.anisoLevel = 8;
      t.filterMode = FilterMode.Trilinear;
      t.maxTextureSize = 1024;
      t.textureCompression = TextureImporterCompression.Compressed;
      if (nom.EndsWith("_Normal"))
      {
        t.textureType = TextureImporterType.NormalMap;
        t.sRGBTexture = false;
      }
      else if (nom.EndsWith("_Masque"))
      {
        t.textureType = TextureImporterType.Default;
        t.sRGBTexture = false;
        t.alphaSource = TextureImporterAlphaSource.FromInput;
      }
      else
      {
        t.textureType = TextureImporterType.Default;
        t.sRGBTexture = true;
      }
    }
  }
}
