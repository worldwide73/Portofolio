// PORTAL RUSH (Unity) — PARTICULES ADDITIVES : éclats et lignes de vitesse (couleur HDR des particules).
Shader "PortalRush/Particules"
{
    Properties
    {
        _Intensite ("Intensite", Float) = 1
        _Trainee ("Trainee (fondu en travers seulement)", Float) = 0
    }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "IgnoreProjector" = "True" "RenderPipeline" = "UniversalPipeline" }
        Blend One One
        ZWrite Off
        Cull Off
        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float _Intensite;
                float _Trainee;
            CBUFFER_END

            struct Attributs { float4 positionOS : POSITION; half4 couleur : COLOR; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; half4 couleur : COLOR; float2 uv : TEXCOORD0; };

            Varyings vert(Attributs e)
            {
                Varyings s;
                s.positionCS = TransformObjectToHClip(e.positionOS.xyz);
                s.couleur = e.couleur;
                s.uv = e.uv;
                return s;
            }

            half4 frag(Varyings e) : SV_Target
            {
                // Un point doux (le quad de la particule, uv 0..1) ; une traînée ne s'estompe qu'en travers.
                float2 q = e.uv * 2.0 - 1.0;
                float a = _Trainee > 0.5 ? saturate(1.0 - abs(q.y)) : saturate(1.0 - dot(q, q));
                a *= a;
                return half4(e.couleur.rgb * e.couleur.a * a * _Intensite, 0);
            }
            ENDHLSL
        }
    }
    Fallback Off
}
