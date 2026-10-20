// PORTAL RUSH (Unity) — LE CIEL : dégradé haut / horizon / bas, deux nébuleuses, étoiles, halo du soleil.
// Palettes reprises de l'ancien rendu (Jeu/Ambiances.cs). Shader de ciel simple, compatible WebGL2 (GLSL ES 3.0).
// Les étoiles sont des points doux de taille fixe dans la direction de vue : elles ne scintillent pas quand la
// caméra tourne (pas de détail plus fin qu'un pixel).
Shader "PortalRush/Ciel"
{
    Properties
    {
        _Haut ("Haut", Color) = (0.012, 0.027, 0.06, 1)
        _Horizon ("Horizon", Color) = (0.086, 0.19, 0.3, 1)
        _Bas ("Bas", Color) = (0.008, 0.016, 0.04, 1)
        _Nebuleuse1 ("Nebuleuse 1", Color) = (0.11, 0.24, 0.44, 1)
        _Nebuleuse2 ("Nebuleuse 2", Color) = (0.23, 0.12, 0.37, 1)
        _Soleil ("Soleil", Color) = (1, 0.94, 0.85, 1)
        _SoleilDirection ("Direction du soleil", Vector) = (-0.55, 0.42, 0.72, 0)
        _Etoiles ("Etoiles", Float) = 1
    }
    SubShader
    {
        Tags { "Queue" = "Background" "RenderType" = "Background" "PreviewType" = "Skybox" "RenderPipeline" = "UniversalPipeline" }
        Cull Off
        ZWrite Off
        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half4 _Haut;
                half4 _Horizon;
                half4 _Bas;
                half4 _Nebuleuse1;
                half4 _Nebuleuse2;
                half4 _Soleil;
                float4 _SoleilDirection;
                float _Etoiles;
            CBUFFER_END

            struct Attributs { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 direction : TEXCOORD0; };

            Varyings vert(Attributs entree)
            {
                Varyings sortie;
                sortie.positionCS = TransformObjectToHClip(entree.positionOS.xyz);
                sortie.direction = entree.positionOS.xyz;
                return sortie;
            }

            float Hachage(float3 p)
            {
                p = frac(p * 0.3183099 + 0.1);
                p *= 17.0;
                return frac(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            float Bruit(float3 x)
            {
                float3 i = floor(x);
                float3 f = frac(x);
                f = f * f * (3.0 - 2.0 * f);
                return lerp(lerp(lerp(Hachage(i + float3(0, 0, 0)), Hachage(i + float3(1, 0, 0)), f.x),
                                 lerp(Hachage(i + float3(0, 1, 0)), Hachage(i + float3(1, 1, 0)), f.x), f.y),
                            lerp(lerp(Hachage(i + float3(0, 0, 1)), Hachage(i + float3(1, 0, 1)), f.x),
                                 lerp(Hachage(i + float3(0, 1, 1)), Hachage(i + float3(1, 1, 1)), f.x), f.y), f.z);
            }

            float Nuages(float3 p)
            {
                float v = 0.0;
                float a = 0.5;
                for (int k = 0; k < 4; k++)
                {
                    v += a * Bruit(p);
                    p *= 2.03;
                    a *= 0.5;
                }
                return v;
            }

            half4 frag(Varyings entree) : SV_Target
            {
                float3 d = normalize(entree.direction);
                float y = d.y;
                half3 c = y > 0.0 ? lerp(_Horizon.rgb, _Haut.rgb, pow(saturate(y), 0.55)) : lerp(_Horizon.rgb, _Bas.rgb, pow(saturate(-y), 0.45));

                // Nébuleuses : deux couches de bruit lent, plus fortes au-dessus de l'horizon.
                float n1 = Nuages(d * 2.2 + float3(3.1, 0.0, 1.7));
                float n2 = Nuages(d * 3.4 + float3(-5.0, 2.0, 0.4));
                float ciel = saturate(y * 1.5 + 0.35);
                c += _Nebuleuse1.rgb * smoothstep(0.48, 0.82, n1) * 0.55 * ciel;
                c += _Nebuleuse2.rgb * smoothstep(0.52, 0.86, n2) * 0.42 * ciel;

                // Étoiles : une par cellule au plus, point doux, moins près de l'horizon.
                float3 p = d * 140.0;
                float3 cellule = floor(p);
                float h = Hachage(cellule);
                float3 centre = cellule + 0.5 + (float3(Hachage(cellule + 1.3), Hachage(cellule + 2.7), Hachage(cellule + 4.1)) - 0.5) * 0.6;
                float r = length(p - centre);
                float etoile = step(0.965, h) * saturate(1.0 - r * 2.4);
                c += etoile * etoile * _Etoiles * (0.5 + 1.5 * Hachage(cellule + 7.0)) * saturate(y * 4.0 + 0.3);

                // Le soleil : un disque net et un large halo.
                float3 s = normalize(_SoleilDirection.xyz);
                float m = saturate(dot(d, s));
                c += _Soleil.rgb * (smoothstep(0.9993, 0.9997, m) * 6.0 + pow(m, 14.0) * 0.22 + pow(m, 3.0) * 0.05);
                return half4(c, 1.0);
            }
            ENDHLSL
        }
    }
    Fallback Off
}
