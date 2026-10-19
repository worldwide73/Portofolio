// DÉCLARATIONS MINIMALES de l'API UnityEngine (6000.3) pour le contrôle de compilation hors Unity.
// Signatures recopiées de UnityCsReference (branche 6000.3) : Runtime/Export/**, Modules/**. Corps vides.
// N'ajouter un membre qu'après l'avoir trouvé dans le source officiel (même nom, mêmes types).
#pragma warning disable
using System;
using System.Collections;
using System.Collections.Generic;

namespace UnityEngine
{
  public class Object
  {
    public string name { get; set; } = "";
    public HideFlags hideFlags { get; set; }
    public static void Destroy(Object obj) { }
    public static void Destroy(Object obj, float t) { }
    public static void DestroyImmediate(Object obj) { }
    public static void DestroyImmediate(Object obj, bool allowDestroyingAssets) { }
    public static T Instantiate<T>(T original) where T : Object => original;
    public static T Instantiate<T>(T original, Transform parent) where T : Object => original;
    public static T Instantiate<T>(T original, Transform parent, bool worldPositionStays) where T : Object => original;
    public static T Instantiate<T>(T original, Vector3 position, Quaternion rotation) where T : Object => original;
    public static T[] FindObjectsByType<T>(FindObjectsSortMode sortMode) where T : Object => new T[0];
    public static T[] FindObjectsByType<T>(FindObjectsInactive findObjectsInactive, FindObjectsSortMode sortMode) where T : Object => new T[0];
    public static T FindFirstObjectByType<T>() where T : Object => null!;
    public static T FindAnyObjectByType<T>() where T : Object => null!;
    public static void DontDestroyOnLoad(Object target) { }
    public static implicit operator bool(Object? exists) => exists is not null;
  }
  [Flags] public enum HideFlags { None = 0, HideInHierarchy = 1, HideInInspector = 2, DontSaveInEditor = 4, NotEditable = 8, DontSaveInBuild = 16, DontUnloadUnusedAsset = 32, DontSave = 52, HideAndDontSave = 61 }
  public enum FindObjectsSortMode { None = 0, InstanceID = 1 }
  public enum FindObjectsInactive { Exclude = 0, Include = 1 }

  public class Component : Object
  {
    public Transform transform => null!;
    public GameObject gameObject => null!;
    public string tag { get; set; } = "";
    public T GetComponent<T>() => default!;
    public Component GetComponent(Type type) => null!;
    public bool TryGetComponent<T>(out T component) { component = default!; return false; }
    public T GetComponentInChildren<T>() => default!;
    public T GetComponentInChildren<T>(bool includeInactive) => default!;
    public T[] GetComponentsInChildren<T>() => new T[0];
    public T[] GetComponentsInChildren<T>(bool includeInactive) => new T[0];
    public void GetComponentsInChildren<T>(bool includeInactive, List<T> result) { }
    public void GetComponentsInChildren<T>(List<T> results) { }
    public T GetComponentInParent<T>() => default!;
  }
  public class Behaviour : Component
  {
    public bool enabled { get; set; }
    public bool isActiveAndEnabled => true;
  }
  public class MonoBehaviour : Behaviour
  {
    public Coroutine StartCoroutine(IEnumerator routine) => null!;
    public void StopCoroutine(Coroutine routine) { }
    public void StopAllCoroutines() { }
    public void Invoke(string methodName, float time) { }
    public void CancelInvoke() { }
    public bool useGUILayout { get; set; }
  }
  public sealed class Coroutine { }
  public class ScriptableObject : Object
  {
    public static T CreateInstance<T>() where T : ScriptableObject => default!;
    public static ScriptableObject CreateInstance(Type type) => null!;
  }

  public sealed class GameObject : Object
  {
    public GameObject() { }
    public GameObject(string name) { }
    public GameObject(string name, params Type[] components) { }
    public Transform transform => null!;
    public GameObject gameObject => this;
    public string tag { get; set; } = "";
    public int layer { get; set; }
    public bool activeSelf => true;
    public bool activeInHierarchy => true;
    public void SetActive(bool value) { }
    public T AddComponent<T>() where T : Component => default!;
    public Component AddComponent(Type componentType) => null!;
    public T GetComponent<T>() => default!;
    public Component GetComponent(Type type) => null!;
    public bool TryGetComponent<T>(out T component) { component = default!; return false; }
    public T GetComponentInChildren<T>() => default!;
    public T GetComponentInChildren<T>(bool includeInactive) => default!;
    public T[] GetComponentsInChildren<T>() => new T[0];
    public T[] GetComponentsInChildren<T>(bool includeInactive) => new T[0];
    public void GetComponentsInChildren<T>(bool includeInactive, List<T> results) { }
    public static GameObject CreatePrimitive(PrimitiveType type) => null!;
    public static GameObject Find(string name) => null!;
  }
  public enum PrimitiveType { Sphere = 0, Capsule = 1, Cylinder = 2, Cube = 3, Plane = 4, Quad = 5 }
  public enum Space { World = 0, Self = 1 }

  public class Transform : Component, IEnumerable
  {
    public Vector3 position { get; set; }
    public Vector3 localPosition { get; set; }
    public Quaternion rotation { get; set; }
    public Quaternion localRotation { get; set; }
    public Vector3 localScale { get; set; }
    public Vector3 eulerAngles { get; set; }
    public Vector3 localEulerAngles { get; set; }
    public Vector3 forward { get; set; }
    public Vector3 right { get; set; }
    public Vector3 up { get; set; }
    public Transform parent { get; set; } = null!;
    public int childCount => 0;
    public Transform GetChild(int index) => null!;
    public void SetParent(Transform p) { }
    public void SetParent(Transform parent, bool worldPositionStays) { }
    public void SetPositionAndRotation(Vector3 position, Quaternion rotation) { }
    public void SetLocalPositionAndRotation(Vector3 localPosition, Quaternion localRotation) { }
    public void Rotate(Vector3 eulers, Space relativeTo = Space.Self) { }
    public void Rotate(float xAngle, float yAngle, float zAngle, Space relativeTo = Space.Self) { }
    public void Rotate(Vector3 axis, float angle, Space relativeTo = Space.Self) { }
    public void LookAt(Vector3 worldPosition) { }
    public void LookAt(Vector3 worldPosition, Vector3 worldUp) { }
    public void LookAt(Transform target) { }
    public Vector3 TransformPoint(Vector3 position) => position;
    public Vector3 InverseTransformPoint(Vector3 position) => position;
    public Vector3 TransformDirection(Vector3 direction) => direction;
    public IEnumerator GetEnumerator() => null!;
  }

  // ---- Attributs ----
  [AttributeUsage(AttributeTargets.Class)] public sealed class DefaultExecutionOrder : Attribute { public DefaultExecutionOrder(int order) { } public int order => 0; }
  [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)] public sealed class RequireComponent : Attribute { public RequireComponent(Type requiredComponent) { } public RequireComponent(Type requiredComponent, Type requiredComponent2) { } }
  [AttributeUsage(AttributeTargets.Field)] public class PropertyAttribute : Attribute { }
  [AttributeUsage(AttributeTargets.Field, Inherited = true, AllowMultiple = false)] public class TooltipAttribute : PropertyAttribute { public TooltipAttribute(string tooltip) { } }
  [AttributeUsage(AttributeTargets.Field, Inherited = true, AllowMultiple = true)] public class HeaderAttribute : PropertyAttribute { public HeaderAttribute(string header) { } }
  [AttributeUsage(AttributeTargets.Field)] public class RangeAttribute : PropertyAttribute { public RangeAttribute(float min, float max) { } }
  [AttributeUsage(AttributeTargets.Field)] public sealed class SerializeField : Attribute { }
  [AttributeUsage(AttributeTargets.Field)] public sealed class HideInInspector : Attribute { }
  [AttributeUsage(AttributeTargets.Class)] public sealed class CreateAssetMenuAttribute : Attribute { public string menuName { get; set; } = ""; public string fileName { get; set; } = ""; public int order { get; set; } }
  [AttributeUsage(AttributeTargets.Class)] public sealed class DisallowMultipleComponent : Attribute { }
  [AttributeUsage(AttributeTargets.Class)] public sealed class AddComponentMenu : Attribute { public AddComponentMenu(string menuName) { } }

  // ---- Temps, écran, journal, application ----
  public static class Time
  {
    public static float time => 0; public static float deltaTime => 0; public static float unscaledTime => 0; public static float unscaledDeltaTime => 0;
    public static float timeScale { get; set; }
    public static int frameCount => 0;
    public static float realtimeSinceStartup => 0;
  }
  public static class Screen
  {
    public static int width => 0; public static int height => 0; public static float dpi => 0;
  }
  public static class Debug
  {
    public static void Log(object message) { }
    public static void Log(object message, Object context) { }
    public static void LogWarning(object message) { }
    public static void LogWarning(object message, Object context) { }
    public static void LogError(object message) { }
    public static void LogError(object message, Object context) { }
    public static void LogException(Exception exception) { }
    public static void LogFormat(string format, params object[] args) { }
    public static void LogWarningFormat(string format, params object[] args) { }
    public static void LogErrorFormat(string format, params object[] args) { }
    public static void DrawLine(Vector3 start, Vector3 end, Color color) { }
  }
  public static class Application
  {
    public static bool isBatchMode => false;
    public static bool isPlaying => false;
    public static bool isEditor => false;
    public static string dataPath => "";
    public static string unityVersion => "";
    public static string streamingAssetsPath => "";
    public static RuntimePlatform platform => default;
    public static int targetFrameRate { get; set; }
    public static bool runInBackground { get; set; }
    public static void Quit() { }
    public static void OpenURL(string url) { }
  }
  public enum RuntimePlatform { WindowsEditor = 7, WebGLPlayer = 17, OSXEditor = 0, LinuxEditor = 16 }
  public static class Random
  {
    public static float Range(float minInclusive, float maxInclusive) => 0;
    public static int Range(int minInclusive, int maxExclusive) => 0;
    public static float value => 0;
    public static void InitState(int seed) { }
  }
  public sealed class PlayerPrefs
  {
    public static void SetString(string key, string value) { }
    public static string GetString(string key, string defaultValue) => defaultValue;
    public static string GetString(string key) => "";
    public static void SetInt(string key, int value) { }
    public static int GetInt(string key, int defaultValue) => defaultValue;
    public static void SetFloat(string key, float value) { }
    public static float GetFloat(string key, float defaultValue) => defaultValue;
    public static bool HasKey(string key) => false;
    public static void DeleteKey(string key) { }
    public static void Save() { }
  }
  public static class JsonUtility
  {
    public static string ToJson(object obj) => "";
    public static string ToJson(object obj, bool prettyPrint) => "";
    public static T FromJson<T>(string json) => default!;
    public static object FromJson(string json, Type type) => null!;
    public static void FromJsonOverwrite(string json, object objectToOverwrite) { }
  }
  public static class ColorUtility
  {
    public static bool TryParseHtmlString(string htmlString, out Color color) { color = default; return false; }
    public static string ToHtmlStringRGB(Color color) => "";
    public static string ToHtmlStringRGBA(Color color) => "";
  }

  // ---- Rendu ----
  public class Shader : Object
  {
    public static Shader Find(string name) => null!;
    public static int PropertyToID(string name) => 0;
    public static void SetGlobalColor(string name, Color value) { }
    public static void SetGlobalColor(int nameID, Color value) { }
    public static void SetGlobalFloat(string name, float value) { }
    public static void SetGlobalFloat(int nameID, float value) { }
    public static void SetGlobalVector(string name, Vector4 value) { }
    public static void SetGlobalVector(int nameID, Vector4 value) { }
  }
  public class Material : Object
  {
    public Material(Shader shader) { }
    public Material(Material source) { }
    public Shader shader { get; set; } = null!;
    public Color color { get; set; }
    public Texture mainTexture { get; set; } = null!;
    public int renderQueue { get; set; }
    public MaterialGlobalIlluminationFlags globalIlluminationFlags { get; set; }
    public bool enableInstancing { get; set; }
    public void SetColor(string name, Color value) { }
    public void SetColor(int nameID, Color value) { }
    public Color GetColor(string name) => default;
    public Color GetColor(int nameID) => default;
    public void SetFloat(string name, float value) { }
    public void SetFloat(int nameID, float value) { }
    public float GetFloat(string name) => 0;
    public float GetFloat(int nameID) => 0;
    public void SetInt(string name, int value) { }
    public void SetVector(string name, Vector4 value) { }
    public void SetVector(int nameID, Vector4 value) { }
    public void SetTexture(string name, Texture value) { }
    public void SetTexture(int nameID, Texture value) { }
    public Texture GetTexture(string name) => null!;
    public void EnableKeyword(string keyword) { }
    public void DisableKeyword(string keyword) { }
    public bool IsKeywordEnabled(string keyword) => false;
    public bool HasProperty(string name) => false;
    public bool HasProperty(int nameID) => false;
  }
  [Flags] public enum MaterialGlobalIlluminationFlags { None = 0, RealtimeEmissive = 1, BakedEmissive = 2, EmissiveIsBlack = 4, AnyEmissive = 3 }
  public sealed class MaterialPropertyBlock
  {
    public void SetColor(string name, Color value) { }
    public void SetColor(int nameID, Color value) { }
    public void SetFloat(string name, float value) { }
    public void SetFloat(int nameID, float value) { }
    public void SetVector(int nameID, Vector4 value) { }
    public void Clear() { }
  }
  public class Texture : Object
  {
    public int width { get; set; }
    public int height { get; set; }
    public FilterMode filterMode { get; set; }
    public TextureWrapMode wrapMode { get; set; }
    public int anisoLevel { get; set; }
  }
  public sealed class Texture2D : Texture
  {
    public Texture2D(int width, int height) { }
    public Texture2D(int width, int height, TextureFormat textureFormat, bool mipChain) { }
    public void SetPixels(Color[] colors) { }
    public void SetPixel(int x, int y, Color color) { }
    public void Apply() { }
    public void Apply(bool updateMipmaps) { }
    public static Texture2D whiteTexture => null!;
    public static Texture2D blackTexture => null!;
  }
  public enum TextureFormat { RGBA32 = 4, RGB24 = 3, ARGB32 = 5 }
  public enum FilterMode { Point = 0, Bilinear = 1, Trilinear = 2 }
  public enum TextureWrapMode { Repeat = 0, Clamp = 1, Mirror = 2, MirrorOnce = 3 }
  public enum ColorSpace { Uninitialized = -1, Gamma = 0, Linear = 1 }

  public class Renderer : Component
  {
    public bool enabled { get; set; }
    public Material material { get; set; } = null!;
    public Material sharedMaterial { get; set; } = null!;
    public Material[] materials { get; set; } = null!;
    public Material[] sharedMaterials { get; set; } = null!;
    public Rendering.ShadowCastingMode shadowCastingMode { get; set; }
    public bool receiveShadows { get; set; }
    public Bounds bounds { get; set; }
    public bool isVisible => false;
    public int sortingOrder { get; set; }
    public void GetPropertyBlock(MaterialPropertyBlock properties) { }
    public void SetPropertyBlock(MaterialPropertyBlock properties) { }
  }
  public class MeshRenderer : Renderer { }
  public class SkinnedMeshRenderer : Renderer { }
  public sealed class MeshFilter : Component
  {
    public Mesh sharedMesh { get; set; } = null!;
    public Mesh mesh { get; set; } = null!;
  }
  public sealed class Mesh : Object
  {
    public Mesh() { }
    public Vector3[] vertices { get; set; } = null!;
    public Vector3[] normals { get; set; } = null!;
    public Vector2[] uv { get; set; } = null!;
    public Color[] colors { get; set; } = null!;
    public int[] triangles { get; set; } = null!;
    public Bounds bounds { get; set; }
    public int subMeshCount { get; set; }
    public int vertexCount => 0;
    public Rendering.IndexFormat indexFormat { get; set; }
    public void Clear() { }
    public void Clear(bool keepVertexLayout) { }
    public void MarkDynamic() { }
    public void SetVertices(List<Vector3> inVertices) { }
    public void SetVertices(Vector3[] inVertices) { }
    public void SetNormals(List<Vector3> inNormals) { }
    public void SetNormals(Vector3[] inNormals) { }
    public void SetUVs(int channel, List<Vector2> uvs) { }
    public void SetUVs(int channel, Vector2[] uvs) { }
    public void SetColors(List<Color> inColors) { }
    public void SetTriangles(int[] triangles, int submesh) { }
    public void SetTriangles(int[] triangles, int submesh, bool calculateBounds) { }
    public void SetTriangles(int[] triangles, int submesh, bool calculateBounds, int baseVertex) { }
    public void SetTriangles(List<int> triangles, int submesh) { }
    public void SetTriangles(List<int> triangles, int submesh, bool calculateBounds) { }
    public void SetTriangles(List<int> triangles, int submesh, bool calculateBounds, int baseVertex) { }
    public void SetIndices(int[] indices, MeshTopology topology, int submesh) { }
    public void RecalculateBounds() { }
    public void RecalculateNormals() { }
    public void RecalculateTangents() { }
    public void UploadMeshData(bool markNoLongerReadable) { }
  }
  public enum MeshTopology { Triangles = 0, Quads = 2, Lines = 3, LineStrip = 4, Points = 5 }
  public class Collider : Component { public bool enabled { get; set; } }

  public sealed class Light : Behaviour
  {
    public LightType type { get; set; }
    public LightShadows shadows { get; set; }
    public float intensity { get; set; }
    public Color color { get; set; }
    public float range { get; set; }
    public float spotAngle { get; set; }
    public float shadowStrength { get; set; }
    public float shadowBias { get; set; }
    public float shadowNormalBias { get; set; }
    public LightRenderMode renderMode { get; set; }
    public int cullingMask { get; set; }
  }
  public enum LightType { Spot = 0, Directional = 1, Point = 2, Rectangle = 3, Disc = 4 }
  public enum LightShadows { None = 0, Hard = 1, Soft = 2 }
  public enum LightRenderMode { Auto = 0, ForcePixel = 1, ForceVertex = 2 }

  public sealed class Camera : Behaviour
  {
    public static Camera main => null!;
    public float fieldOfView { get; set; }
    public float nearClipPlane { get; set; }
    public float farClipPlane { get; set; }
    public CameraClearFlags clearFlags { get; set; }
    public Color backgroundColor { get; set; }
    public bool allowHDR { get; set; }
    public bool allowMSAA { get; set; }
    public int cullingMask { get; set; }
    public float depth { get; set; }
    public float aspect { get; set; }
    public int targetDisplay { get; set; }
    public Vector3 WorldToScreenPoint(Vector3 position) => position;
    public Vector3 ScreenToWorldPoint(Vector3 position) => position;
    public Ray ScreenPointToRay(Vector3 pos) => default;
  }
  public enum CameraClearFlags { Skybox = 1, Color = 2, SolidColor = 2, Depth = 3, Nothing = 4 }
  public struct Ray { public Vector3 origin { get; set; } public Vector3 direction { get; set; } }

  public sealed class ReflectionProbe : Behaviour
  {
    public Rendering.ReflectionProbeMode mode { get; set; }
    public Rendering.ReflectionProbeRefreshMode refreshMode { get; set; }
    public Rendering.ReflectionProbeTimeSlicingMode timeSlicingMode { get; set; }
    public Rendering.ReflectionProbeClearFlags clearFlags { get; set; }
    public int resolution { get; set; }
    public Vector3 size { get; set; }
    public Vector3 center { get; set; }
    public int cullingMask { get; set; }
    public bool hdr { get; set; }
    public int importance { get; set; }
    public float intensity { get; set; }
    public bool boxProjection { get; set; }
    public float farClipPlane { get; set; }
    public float nearClipPlane { get; set; }
    public int RenderProbe() => 0;
    public int RenderProbe(RenderTexture targetTexture) => 0;
  }
  public class RenderTexture : Texture { }

  public sealed class RenderSettings : Object
  {
    public static bool fog { get; set; }
    public static FogMode fogMode { get; set; }
    public static Color fogColor { get; set; }
    public static float fogDensity { get; set; }
    public static float fogStartDistance { get; set; }
    public static float fogEndDistance { get; set; }
    public static Rendering.AmbientMode ambientMode { get; set; }
    public static Color ambientSkyColor { get; set; }
    public static Color ambientEquatorColor { get; set; }
    public static Color ambientGroundColor { get; set; }
    public static Color ambientLight { get; set; }
    public static float ambientIntensity { get; set; }
    public static Material skybox { get; set; } = null!;
    public static Light sun { get; set; } = null!;
    public static float reflectionIntensity { get; set; }
  }
  public enum FogMode { Linear = 1, Exponential = 2, ExponentialSquared = 3 }
  public sealed class QualitySettings : Object
  {
    public static string[] names => new string[0];
    public static int GetQualityLevel() => 0;
    public static void SetQualityLevel(int index) { }
    public static void SetQualityLevel(int index, bool applyExpensiveChanges) { }
    public static int antiAliasing { get; set; }
    public static int vSyncCount { get; set; }
    public static float lodBias { get; set; }
    public static Rendering.RenderPipelineAsset renderPipeline { get; set; } = null!;
  }
  public static class DynamicGI { public static void UpdateEnvironment() { } }

  // ---- Particules, traînées ----
  public sealed partial class ParticleSystem : Component
  {
    public MainModule main => default;
    public EmissionModule emission => default;
    public ShapeModule shape => default;
    public VelocityOverLifetimeModule velocityOverLifetime => default;
    public ColorOverLifetimeModule colorOverLifetime => default;
    public SizeOverLifetimeModule sizeOverLifetime => default;
    public bool isPlaying => false;
    public int particleCount => 0;
    public void Play() { }
    public void Play(bool withChildren) { }
    public void Stop() { }
    public void Stop(bool withChildren) { }
    public void Stop(bool withChildren, ParticleSystemStopBehavior stopBehavior) { }
    public void Clear() { }
    public void Emit(int count) { }
    public void Emit(EmitParams emitParams, int count) { }

    public struct MainModule
    {
      public MinMaxCurve startLifetime { get; set; }
      public MinMaxCurve startSpeed { get; set; }
      public MinMaxCurve startSize { get; set; }
      public MinMaxGradient startColor { get; set; }
      public MinMaxCurve startRotation { get; set; }
      public MinMaxCurve gravityModifier { get; set; }
      public ParticleSystemSimulationSpace simulationSpace { get; set; }
      public int maxParticles { get; set; }
      public bool playOnAwake { get; set; }
      public bool loop { get; set; }
      public float duration { get; set; }
      public float simulationSpeed { get; set; }
      public ParticleSystemScalingMode scalingMode { get; set; }
    }
    public struct EmissionModule
    {
      public bool enabled { get; set; }
      public MinMaxCurve rateOverTime { get; set; }
      public MinMaxCurve rateOverDistance { get; set; }
    }
    public struct ShapeModule
    {
      public bool enabled { get; set; }
      public ParticleSystemShapeType shapeType { get; set; }
      public float radius { get; set; }
      public float radiusThickness { get; set; }
      public float angle { get; set; }
      public float arc { get; set; }
      public Vector3 position { get; set; }
      public Vector3 rotation { get; set; }
      public Vector3 scale { get; set; }
    }
    public struct VelocityOverLifetimeModule
    {
      public bool enabled { get; set; }
      public ParticleSystemSimulationSpace space { get; set; }
      public MinMaxCurve x { get; set; }
      public MinMaxCurve y { get; set; }
      public MinMaxCurve z { get; set; }
    }
    public struct ColorOverLifetimeModule { public bool enabled { get; set; } public MinMaxGradient color { get; set; } }
    public struct SizeOverLifetimeModule { public bool enabled { get; set; } public MinMaxCurve size { get; set; } }
    public struct MinMaxCurve
    {
      public MinMaxCurve(float constant) { }
      public MinMaxCurve(float min, float max) { }
      public float constant { get; set; }
      public static implicit operator MinMaxCurve(float constant) => default;
    }
    public struct MinMaxGradient
    {
      public MinMaxGradient(Color color) { }
      public MinMaxGradient(Color min, Color max) { }
      public Color color { get; set; }
      public static implicit operator MinMaxGradient(Color color) => default;
    }
    public struct EmitParams
    {
      public Vector3 position { get; set; }
      public Vector3 velocity { get; set; }
      public float startLifetime { get; set; }
      public float startSize { get; set; }
      public Color32 startColor { get; set; }
      public bool applyShapeToPosition { get; set; }
    }
  }
  public enum ParticleSystemSimulationSpace { Local = 0, World = 1, Custom = 2 }
  public enum ParticleSystemScalingMode { Hierarchy = 0, Local = 1, Shape = 2 }
  public enum ParticleSystemShapeType { Sphere = 0, Hemisphere = 2, Cone = 4, Box = 5, Mesh = 6, Circle = 10, Edge = 12, Donut = 17, Rectangle = 18 }
  public enum ParticleSystemStopBehavior { StopEmittingAndClear = 0, StopEmitting = 1 }
  public enum ParticleSystemRenderMode { Billboard = 0, Stretch = 1, HorizontalBillboard = 2, VerticalBillboard = 3, Mesh = 4, None = 5 }
  public sealed class ParticleSystemRenderer : Renderer
  {
    public ParticleSystemRenderMode renderMode { get; set; }
    public float velocityScale { get; set; }
    public float lengthScale { get; set; }
    public float cameraVelocityScale { get; set; }
    public float minParticleSize { get; set; }
    public float maxParticleSize { get; set; }
  }
  public sealed class TrailRenderer : Renderer
  {
    public float time { get; set; }
    public float minVertexDistance { get; set; }
    public float widthMultiplier { get; set; }
    public float startWidth { get; set; }
    public float endWidth { get; set; }
    public Color startColor { get; set; }
    public Color endColor { get; set; }
    public bool emitting { get; set; }
    public LineAlignment alignment { get; set; }
    public void Clear() { }
  }
  public enum LineAlignment { View = 0, Local = 1, TransformZ = 1 }
  public sealed class LineRenderer : Renderer { public int positionCount { get; set; } public void SetPosition(int index, Vector3 position) { } public float widthMultiplier { get; set; } }

  // ---- Entrées héritées (compilées seulement sans ENABLE_INPUT_SYSTEM) ----
  public sealed class Input
  {
    public static bool GetKeyDown(KeyCode key) => false;
    public static bool GetKey(KeyCode key) => false;
    public static bool GetMouseButtonDown(int button) => false;
    public static bool GetMouseButtonUp(int button) => false;
    public static Vector3 mousePosition => default;
    public static int touchCount => 0;
  }
  public enum KeyCode { None = 0, Space = 32, A = 97, D = 100, P = 112, Q = 113, W = 119, Z = 122, UpArrow = 273, DownArrow = 274, RightArrow = 275, LeftArrow = 276, Escape = 27, Return = 13 }

  public sealed class WebGLInput
  {
    public static bool captureAllKeyboardInput { get; set; }
  }
}

namespace UnityEngine.Rendering
{
  public enum ShadowCastingMode { Off = 0, On = 1, TwoSided = 2, ShadowsOnly = 3 }
  public enum AmbientMode { Skybox = 0, Trilight = 1, Flat = 3, Custom = 4 }
  public enum IndexFormat { UInt16 = 0, UInt32 = 1 }
  public enum ReflectionProbeMode { Baked = 0, Realtime = 1, Custom = 2 }
  public enum ReflectionProbeRefreshMode { OnAwake = 0, EveryFrame = 1, ViaScripting = 2 }
  public enum ReflectionProbeTimeSlicingMode { AllFacesAtOnce = 0, IndividualFaces = 1, NoTimeSlicing = 2 }
  public enum ReflectionProbeClearFlags { Skybox = 1, SolidColor = 2 }
  public enum GraphicsDeviceType { OpenGLES3 = 11, Vulkan = 21, Direct3D11 = 2, Direct3D12 = 18, Metal = 16, WebGPU = 28, Null = 4 }
  public abstract class RenderPipelineAsset : ScriptableObject { }
  public sealed class GraphicsSettings : Object
  {
    public static RenderPipelineAsset defaultRenderPipeline { get; set; } = null!;
    public static RenderPipelineAsset currentRenderPipeline => null!;
  }
}
