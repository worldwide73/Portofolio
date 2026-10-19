// DÉCLARATIONS MINIMALES de UnityEditor (Editor/Mono/**, Modules/PackageManager, Modules/AssetPipelineEditor, 6000.3).
#pragma warning disable
using System;
using System.Collections.Generic;
using UnityEngine;

namespace UnityEditor
{
  [AttributeUsage(AttributeTargets.Class)] public class InitializeOnLoadAttribute : Attribute { }
  [AttributeUsage(AttributeTargets.Method)] public class InitializeOnLoadMethodAttribute : Attribute { }
  [AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
  public sealed class MenuItem : Attribute
  {
    public MenuItem(string itemName) { }
    public MenuItem(string itemName, bool isValidateFunction) { }
    public MenuItem(string itemName, bool isValidateFunction, int priority) { }
  }

  public sealed class EditorApplication
  {
    public delegate void CallbackFunction();
    public static CallbackFunction delayCall = null!;
    public static CallbackFunction update = null!;
    public static double timeSinceStartup => 0;
    public static bool isPlaying { get; set; }
    public static bool isCompiling => false;
    public static void Exit(int returnValue) { }
    public static bool ExecuteMenuItem(string menuItemPath) => false;
  }
  public static class SessionState
  {
    public static bool GetBool(string key, bool defaultValue) => defaultValue;
    public static void SetBool(string key, bool value) { }
    public static int GetInt(string key, int defaultValue) => defaultValue;
    public static void SetInt(string key, int value) { }
    public static string GetString(string key, string defaultValue) => defaultValue;
    public static void SetString(string key, string value) { }
  }
  public sealed class EditorPrefs
  {
    public static bool GetBool(string key, bool defaultValue) => defaultValue;
    public static void SetBool(string key, bool value) { }
  }
  public sealed class EditorUtility
  {
    public static void SetDirty(UnityEngine.Object target) { }
    public static bool DisplayDialog(string title, string message, string ok, string cancel) => true;
    public static bool DisplayDialog(string title, string message, string ok) => true;
    public static void RevealInFinder(string path) { }
    public static void DisplayProgressBar(string title, string info, float progress) { }
    public static void ClearProgressBar() { }
  }
  public sealed class AssetDatabase
  {
    public static T LoadAssetAtPath<T>(string assetPath) where T : UnityEngine.Object => null!;
    public static UnityEngine.Object LoadAssetAtPath(string assetPath, Type type) => null!;
    public static UnityEngine.Object[] LoadAllAssetsAtPath(string assetPath) => new UnityEngine.Object[0];
    public static void CreateAsset(UnityEngine.Object asset, string path) { }
    public static void AddObjectToAsset(UnityEngine.Object objectToAdd, string path) { }
    public static void AddObjectToAsset(UnityEngine.Object objectToAdd, UnityEngine.Object assetObject) { }
    public static void RemoveObjectFromAsset(UnityEngine.Object objectToRemove) { }
    public static void SaveAssets() { }
    public static void Refresh() { }
    public static bool IsValidFolder(string path) => false;
    public static string CreateFolder(string parentFolder, string newFolderName) => "";
    public static string[] FindAssets(string filter) => new string[0];
    public static string[] FindAssets(string filter, string[] searchInFolders) => new string[0];
    public static string GUIDToAssetPath(string guid) => "";
    public static string GetAssetPath(UnityEngine.Object assetObject) => "";
    public static bool DeleteAsset(string path) => false;
    public static void ImportAsset(string path) { }
    public static void ImportAsset(string path, ImportAssetOptions options) { }
  }
  [Flags] public enum ImportAssetOptions { Default = 0, ForceUpdate = 1, ForceSynchronousImport = 8 }

  public class SerializedObject : IDisposable
  {
    public SerializedObject(UnityEngine.Object obj) { }
    public SerializedProperty FindProperty(string propertyPath) => null!;
    public bool ApplyModifiedProperties() => true;
    public bool ApplyModifiedPropertiesWithoutUndo() => true;
    public void Update() { }
    public void Dispose() { }
  }
  public class SerializedProperty
  {
    public int arraySize { get; set; }
    public string stringValue { get; set; } = "";
    public int intValue { get; set; }
    public float floatValue { get; set; }
    public bool boolValue { get; set; }
    public UnityEngine.Object objectReferenceValue { get; set; } = null!;
    public SerializedProperty GetArrayElementAtIndex(int index) => null!;
    public SerializedProperty FindPropertyRelative(string relativePropertyPath) => null!;
    public void ClearArray() { }
    public void InsertArrayElementAtIndex(int index) { }
    public void DeleteArrayElementAtIndex(int index) { }
  }

  // ---- Réglages du lecteur, construction ----
  public enum BuildTarget { StandaloneWindows64 = 19, WebGL = 20, StandaloneLinux64 = 24, StandaloneOSX = 2 }
  public enum BuildTargetGroup { Unknown = 0, Standalone = 1, WebGL = 25 }
  [Flags] public enum BuildOptions { None = 0, Development = 1, AutoRunPlayer = 4, CleanBuildCache = 1 << 30 }
  public struct BuildPlayerOptions
  {
    public string[] scenes { get; set; }
    public string locationPathName { get; set; }
    public string assetBundleManifestPath { get; set; }
    public BuildTargetGroup targetGroup { get; set; }
    public BuildTarget target { get; set; }
    public int subtarget { get; set; }
    public BuildOptions options { get; set; }
    public string[] extraScriptingDefines { get; set; }
  }
  public class BuildPipeline
  {
    public static Build.Reporting.BuildReport BuildPlayer(BuildPlayerOptions buildPlayerOptions) => null!;
  }
  public enum WebGLTextureSubtarget { Generic = 0, DXT = 1, ETC2 = 3, ASTC = 4 }
  public class EditorUserBuildSettings
  {
    public static BuildTarget activeBuildTarget => default;
    public static bool SwitchActiveBuildTarget(BuildTargetGroup targetGroup, BuildTarget target) => true;
    public static WebGLTextureSubtarget webGLBuildSubtarget { get; set; }
    public static bool development { get; set; }
  }
  public sealed class EditorBuildSettingsScene
  {
    public EditorBuildSettingsScene() { }
    public EditorBuildSettingsScene(string path, bool enabled) { }
    public bool enabled { get; set; }
    public string path { get; set; } = "";
  }
  public class EditorBuildSettings : UnityEngine.Object
  {
    public static EditorBuildSettingsScene[] scenes { get; set; } = new EditorBuildSettingsScene[0];
  }
  public enum WebGLExceptionSupport { None = 0, ExplicitlyThrownExceptionsOnly = 1, FullWithoutStacktrace = 2, FullWithStacktrace = 3 }
  public enum WebGLCompressionFormat { Brotli, Gzip, Disabled }
  public enum WebGLLinkerTarget { Asm, Wasm }
  public enum WebGLPowerPreference { Default = 0, LowPower = 1, HighPerformance = 2 }
  public enum WebGLDebugSymbolMode { Off = 0, External = 1, Embedded = 2 }
  public enum ManagedStrippingLevel { Disabled = 0, Low = 1, Medium = 2, High = 3, Minimal = 4 }
  public sealed partial class PlayerSettings : UnityEngine.Object
  {
    public static string companyName { get; set; } = "";
    public static string productName { get; set; } = "";
    public static string bundleVersion { get; set; } = "";
    public static ColorSpace colorSpace { get; set; }
    public static bool runInBackground { get; set; }
    public static bool stripEngineCode { get; set; }
    public static void SetGraphicsAPIs(BuildTarget platform, UnityEngine.Rendering.GraphicsDeviceType[] apis) { }
    public static void SetUseDefaultGraphicsAPIs(BuildTarget platform, bool automatic) { }
    public static void GetScriptingDefineSymbols(Build.NamedBuildTarget buildTarget, out string[] defines) { defines = new string[0]; }
    public static string GetScriptingDefineSymbols(Build.NamedBuildTarget buildTarget) => "";
    public static void SetScriptingDefineSymbols(Build.NamedBuildTarget buildTarget, string defines) { }
    public static void SetScriptingDefineSymbols(Build.NamedBuildTarget buildTarget, string[] defines) { }
    public static void SetManagedStrippingLevel(Build.NamedBuildTarget buildTarget, ManagedStrippingLevel level) { }
    public sealed class WebGL
    {
      public static int memorySize { get; set; }
      public static WebGLExceptionSupport exceptionSupport { get; set; }
      public static bool dataCaching { get; set; }
      public static string template { get; set; } = "";
      public static bool threadsSupport { get; set; }
      public static WebGLLinkerTarget linkerTarget { get; set; }
      public static WebGLCompressionFormat compressionFormat { get; set; }
      public static bool nameFilesAsHashes { get; set; }
      public static WebGLDebugSymbolMode debugSymbolMode { get; set; }
      public static bool showDiagnostics { get; set; }
      public static bool decompressionFallback { get; set; }
      public static int initialMemorySize { get; set; }
      public static int maximumMemorySize { get; set; }
      public static WebGLPowerPreference powerPreference { get; set; }
      public static bool closeOnQuit { get; set; }
    }
  }

  // ---- Import des assets ----
  public class AssetImporter : UnityEngine.Object
  {
    public string assetPath => "";
    public string userData { get; set; } = "";
    public void SaveAndReimport() { }
    public void AddRemap(SourceAssetIdentifier identifier, UnityEngine.Object externalObject) { }
    public bool RemoveRemap(SourceAssetIdentifier identifier) => false;
    public Dictionary<SourceAssetIdentifier, UnityEngine.Object> GetExternalObjectMap() => new Dictionary<SourceAssetIdentifier, UnityEngine.Object>();
    public static AssetImporter GetAtPath(string path) => null!;
  }
  public struct SourceAssetIdentifier
  {
    public SourceAssetIdentifier(UnityEngine.Object asset) { type = null!; name = ""; }
    public SourceAssetIdentifier(Type type, string name) { this.type = type; this.name = name; }
    public Type type;
    public string name;
  }
  public class AssetPostprocessor
  {
    public string assetPath { get; set; } = "";
    public AssetImporter assetImporter => null!;
    public virtual int GetPostprocessOrder() => 0;
    public virtual uint GetVersion() => 0;
  }
  public enum TextureImporterType { Default = 0, NormalMap = 1, GUI = 2, Sprite = 8, Cursor = 7, Cookie = 4, Lightmap = 6, SingleChannel = 10 }
  public enum TextureImporterCompression { Uncompressed = 0, Compressed = 1, CompressedHQ = 2, CompressedLQ = 3 }
  public enum TextureImporterAlphaSource { None = 0, FromInput = 1, FromGrayScale = 2 }
  public sealed class TextureImporter : AssetImporter
  {
    public TextureImporterType textureType { get; set; }
    public bool sRGBTexture { get; set; }
    public bool mipmapEnabled { get; set; }
    public TextureWrapMode wrapMode { get; set; }
    public FilterMode filterMode { get; set; }
    public int anisoLevel { get; set; }
    public int maxTextureSize { get; set; }
    public TextureImporterCompression textureCompression { get; set; }
    public TextureImporterAlphaSource alphaSource { get; set; }
    public bool isReadable { get; set; }
    public bool alphaIsTransparency { get; set; }
  }
  public enum ModelImporterMaterialImportMode { None = 0, ImportStandard = 1, ImportViaMaterialDescription = 2 }
  public enum ModelImporterNormals { Import = 0, Calculate = 1, None = 2 }
  public enum ModelImporterTangents { Import = 0, CalculateLegacy = 1, CalculateLegacyWithSplitTangents = 4, CalculateMikk = 3, None = 2 }
  public enum ModelImporterMeshCompression { Off = 0, Low = 1, Medium = 2, High = 3 }
  public enum ModelImporterAnimationType { None = 0, Legacy = 1, Generic = 2, Human = 3 }
  public enum ModelImporterMaterialLocation { External = 0, InPrefab = 1 }
  public enum ModelImporterMaterialName { BasedOnTextureName = 0, BasedOnMaterialName = 1, BasedOnModelNameAndMaterialName = 2 }
  public enum ModelImporterMaterialSearch { Local = 0, RecursiveUp = 1, Everywhere = 2 }
  public class ModelImporter : AssetImporter
  {
    public float globalScale { get; set; }
    public bool useFileScale { get; set; }
    public bool useFileUnits { get; set; }
    public bool bakeAxisConversion { get; set; }
    public ModelImporterMaterialImportMode materialImportMode { get; set; }
    public ModelImporterMaterialLocation materialLocation { get; set; }
    public ModelImporterMaterialName materialName { get; set; }
    public ModelImporterMaterialSearch materialSearch { get; set; }
    public ModelImporterNormals importNormals { get; set; }
    public float normalSmoothingAngle { get; set; }
    public ModelImporterTangents importTangents { get; set; }
    public ModelImporterMeshCompression meshCompression { get; set; }
    public bool isReadable { get; set; }
    public bool generateSecondaryUV { get; set; }
    public ModelImporterAnimationType animationType { get; set; }
    public bool importAnimation { get; set; }
    public bool importCameras { get; set; }
    public bool importLights { get; set; }
    public bool importBlendShapes { get; set; }
    public bool importVisibility { get; set; }
    public bool addCollider { get; set; }
    public bool optimizeMeshPolygons { get; set; }
    public bool optimizeMeshVertices { get; set; }
    public bool weldVertices { get; set; }
    public bool preserveHierarchy { get; set; }
    public bool sortHierarchyByName { get; set; }
    public bool SearchAndRemapMaterials(ModelImporterMaterialName nameOption, ModelImporterMaterialSearch searchOption) => false;
  }
}

namespace UnityEditor.Build
{
  public readonly struct NamedBuildTarget : IEquatable<NamedBuildTarget>
  {
    public static readonly NamedBuildTarget Unknown = default;
    public static readonly NamedBuildTarget Standalone = default;
    public static readonly NamedBuildTarget WebGL = default;
    public static readonly NamedBuildTarget Android = default;
    public static readonly NamedBuildTarget iOS = default;
    public string TargetName => "";
    public bool Equals(NamedBuildTarget other) => true;
  }
}

namespace UnityEditor.Build.Reporting
{
  public enum BuildResult { Unknown = 0, Succeeded = 1, Failed = 2, Cancelled = 3 }
  public struct BuildSummary
  {
    public BuildResult result => default;
    public int totalErrors => 0;
    public int totalWarnings => 0;
    public ulong totalSize => 0;
    public string outputPath => "";
  }
  public sealed class BuildReport : UnityEngine.Object { public BuildSummary summary => default; }
}

namespace UnityEditor.SceneManagement
{
  public enum NewSceneSetup { EmptyScene = 0, DefaultGameObjects = 1 }
  public enum NewSceneMode { Single = 0, Additive = 1 }
  public sealed class EditorSceneManager
  {
    public static UnityEngine.SceneManagement.Scene NewScene(NewSceneSetup setup, NewSceneMode mode) => default;
    public static UnityEngine.SceneManagement.Scene NewScene(NewSceneSetup setup) => default;
    public static bool SaveScene(UnityEngine.SceneManagement.Scene scene, string dstScenePath) => true;
    public static bool SaveScene(UnityEngine.SceneManagement.Scene scene) => true;
    public static UnityEngine.SceneManagement.Scene OpenScene(string scenePath) => default;
  }
}

namespace UnityEngine.SceneManagement
{
  public struct Scene { public string name => ""; public string path => ""; public bool IsValid() => true; }
}

namespace UnityEditor.PackageManager
{
  public enum StatusCode { InProgress, Success, Failure }
  public enum ErrorCode { Unknown, NotFound, Forbidden, InvalidParameter, Conflict }
  public class Error { public ErrorCode errorCode => default; public string message => ""; }
  public sealed class PackageInfo { public string name => ""; public string version => ""; public string displayName => ""; }
  public class PackageCollection : IEnumerable<PackageInfo>
  {
    public Error error => null!;
    public IEnumerator<PackageInfo> GetEnumerator() => null!;
    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => null!;
  }
  public static class Client
  {
    public static Requests.ListRequest List(bool offlineMode, bool includeIndirectDependencies) => null!;
    public static Requests.ListRequest List(bool offlineMode) => null!;
    public static Requests.ListRequest List() => null!;
    public static Requests.AddRequest Add(string identifier) => null!;
    public static Requests.AddAndRemoveRequest AddAndRemove(string[] packagesToAdd = null!, string[] packagesToRemove = null!) => null!;
  }
}

namespace UnityEditor.PackageManager.Requests
{
  public abstract partial class Request
  {
    public StatusCode Status => default;
    public bool IsCompleted => true;
    public Error Error => null!;
  }
  public abstract class Request<T> : Request { public T Result => default!; }
  public sealed partial class ListRequest : Request<PackageCollection> { }
  public sealed partial class AddRequest : Request<PackageInfo> { }
  public sealed partial class AddAndRemoveRequest : Request<PackageCollection> { }
}
