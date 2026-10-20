// DÉCLARATIONS MINIMALES de Core RP (Volume) et d'URP 17.3 (Unity-Technologies/Graphics, branche 6000.3/staging).
#pragma warning disable
using System;
using System.Collections.Generic;

namespace UnityEngine.Rendering
{
  public enum GPUResidentDrawerMode { Disabled = 0, InstancedDrawing = 1 }
  public abstract class VolumeParameter { public bool overrideState { get; set; } }
  public class VolumeParameter<T> : VolumeParameter
  {
    public virtual T value { get; set; } = default!;
    public void Override(T x) { }
  }
  public class FloatParameter : VolumeParameter<float> { public FloatParameter(float value, bool overrideState = false) { } }
  public class MinFloatParameter : FloatParameter { public MinFloatParameter(float value, float min, bool overrideState = false) : base(value) { } }
  public class ClampedFloatParameter : FloatParameter { public ClampedFloatParameter(float value, float min, float max, bool overrideState = false) : base(value) { } }
  public class ClampedIntParameter : VolumeParameter<int> { public ClampedIntParameter(int value, int min, int max, bool overrideState = false) { } }
  public class BoolParameter : VolumeParameter<bool> { public BoolParameter(bool value, bool overrideState = false) { } }
  public class ColorParameter : VolumeParameter<Color> { public ColorParameter(Color value, bool overrideState = false) { } }
  public class VolumeComponent : ScriptableObject { public bool active { get; set; } }
  public sealed class VolumeProfile : ScriptableObject
  {
    public List<VolumeComponent> components = new List<VolumeComponent>();
    public T Add<T>(bool overrides = false) where T : VolumeComponent => default!;
    public VolumeComponent Add(Type type, bool overrides = false) => null!;
    public bool TryGet<T>(out T component) where T : VolumeComponent { component = default!; return false; }
    public bool Has<T>() where T : VolumeComponent => false;
    public void Remove<T>() where T : VolumeComponent { }
  }
  public class Volume : MonoBehaviour
  {
    public bool isGlobal { get; set; }
    public float priority { get; set; }
    public float weight;
    public float blendDistance;
    public VolumeProfile sharedProfile = null!;
    public VolumeProfile profile { get; set; } = null!;
  }
}

namespace UnityEngine.Rendering.Universal
{
  public enum RenderingMode { Forward = 0, ForwardPlus = 2, Deferred = 1, DeferredPlus = 3 }
  public enum DepthPrimingMode { Disabled, Auto, Forced }
  public enum LightRenderingMode { Disabled = 0, PerVertex = 2, PerPixel = 1 }
  public enum ColorGradingMode { LowDynamicRange, HighDynamicRange }
  public enum AntialiasingMode { None, FastApproximateAntialiasing, SubpixelMorphologicalAntiAliasing, TemporalAntiAliasing }
  public enum AntialiasingQuality { Low, Medium, High }
  public enum TonemappingMode { None, Neutral, ACES }

  public sealed class PostProcessData : ScriptableObject { }
  public abstract class ScriptableRendererFeature : ScriptableObject { public bool isActive => true; public void SetActive(bool active) { } }
  public class ScreenSpaceAmbientOcclusion : ScriptableRendererFeature { }
  public abstract class ScriptableRendererData : ScriptableObject
  {
    public List<ScriptableRendererFeature> rendererFeatures => new List<ScriptableRendererFeature>();
    public new void SetDirty() { }
  }
  public class UniversalRendererData : ScriptableRendererData
  {
    public PostProcessData postProcessData = null!;
    public RenderingMode renderingMode { get; set; }
    public DepthPrimingMode depthPrimingMode { get; set; }
    public bool shadowTransparentReceive { get; set; }
  }
  public class UniversalRenderPipelineAsset : RenderPipelineAsset
  {
    public static UniversalRenderPipelineAsset Create(ScriptableRendererData rendererData = null!) => null!;
    public bool supportsCameraDepthTexture { get; set; }
    public bool supportsCameraOpaqueTexture { get; set; }
    public bool supportsHDR { get; set; }
    public int msaaSampleCount { get; set; }
    public float renderScale { get; set; }
    public bool supportsMainLightShadows { get; set; }
    public int mainLightShadowmapResolution { get; set; }
    public LightRenderingMode mainLightRenderingMode { get; set; }
    public LightRenderingMode additionalLightsRenderingMode { get; set; }
    public int maxAdditionalLightsCount { get; set; }
    public bool supportsAdditionalLightShadows { get; set; }
    public bool reflectionProbeBlending { get; set; }
    public bool reflectionProbeBoxProjection { get; set; }
    public float shadowDistance { get; set; }
    public int shadowCascadeCount { get; set; }
    public bool supportsSoftShadows { get; set; }
    public bool supportsDynamicBatching { get; set; }
    public bool useSRPBatcher { get; set; }
    public ColorGradingMode colorGradingMode { get; set; }
    public int colorGradingLutSize { get; set; }
    public GPUResidentDrawerMode gpuResidentDrawerMode { get; set; }
    public VolumeProfile volumeProfile { get; set; } = null!;
  }
  public class UniversalAdditionalCameraData : MonoBehaviour
  {
    public bool renderPostProcessing { get; set; }
    public AntialiasingMode antialiasing { get; set; }
    public AntialiasingQuality antialiasingQuality { get; set; }
    public bool renderShadows { get; set; }
    public bool stopNaN { get; set; }
    public bool dithering { get; set; }
  }
  public static class CameraExtensions
  {
    public static UniversalAdditionalCameraData GetUniversalAdditionalCameraData(this Camera camera) => null!;
  }

  public sealed class Bloom : VolumeComponent
  {
    public MinFloatParameter threshold = new MinFloatParameter(0.9f, 0f);
    public MinFloatParameter intensity = new MinFloatParameter(0f, 0f);
    public ClampedFloatParameter scatter = new ClampedFloatParameter(0.7f, 0f, 1f);
    public MinFloatParameter clamp = new MinFloatParameter(65472f, 0f);
    public ColorParameter tint = new ColorParameter(Color.white);
    public BoolParameter highQualityFiltering = new BoolParameter(false);
    public ClampedIntParameter maxIterations = new ClampedIntParameter(6, 2, 8);
  }
  public sealed class TonemappingModeParameter : VolumeParameter<TonemappingMode> { public TonemappingModeParameter(TonemappingMode value, bool overrideState = false) { } }
  public sealed class Tonemapping : VolumeComponent { public TonemappingModeParameter mode = new TonemappingModeParameter(TonemappingMode.None); }
  public sealed class ColorAdjustments : VolumeComponent
  {
    public FloatParameter postExposure = new FloatParameter(0f);
    public ClampedFloatParameter contrast = new ClampedFloatParameter(0f, -100f, 100f);
    public ColorParameter colorFilter = new ColorParameter(Color.white);
    public ClampedFloatParameter hueShift = new ClampedFloatParameter(0f, -180f, 180f);
    public ClampedFloatParameter saturation = new ClampedFloatParameter(0f, -100f, 100f);
  }
  public sealed class Vignette : VolumeComponent
  {
    public ColorParameter color = new ColorParameter(Color.black);
    public ClampedFloatParameter intensity = new ClampedFloatParameter(0f, 0f, 1f);
    public ClampedFloatParameter smoothness = new ClampedFloatParameter(0.2f, 0.01f, 1f);
  }
  public sealed class ChromaticAberration : VolumeComponent { public ClampedFloatParameter intensity = new ClampedFloatParameter(0f, 0f, 1f); }
  public sealed class FilmGrain : VolumeComponent { public ClampedFloatParameter intensity = new ClampedFloatParameter(0f, 0f, 1f); }
  public sealed class MotionBlur : VolumeComponent { public ClampedFloatParameter intensity = new ClampedFloatParameter(0f, 0f, 1f); }
  public sealed class LensDistortion : VolumeComponent { public ClampedFloatParameter intensity = new ClampedFloatParameter(0f, -1f, 1f); }
}
