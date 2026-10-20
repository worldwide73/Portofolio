// DÉCLARATIONS MINIMALES des types mathématiques de UnityEngine (Runtime/Export/Math/**, 6000.3).
#pragma warning disable
using System;

namespace UnityEngine
{
  public struct Vector2 : IEquatable<Vector2>
  {
    public float x, y;
    public Vector2(float x, float y) { this.x = x; this.y = y; }
    public static Vector2 zero => default; public static Vector2 one => new Vector2(1, 1);
    public static Vector2 up => new Vector2(0, 1); public static Vector2 right => new Vector2(1, 0); public static Vector2 left => new Vector2(-1, 0); public static Vector2 down => new Vector2(0, -1);
    public float magnitude => 0; public float sqrMagnitude => 0; public Vector2 normalized => this;
    public static float Distance(Vector2 a, Vector2 b) => 0;
    public static float Dot(Vector2 a, Vector2 b) => 0;
    public static Vector2 Lerp(Vector2 a, Vector2 b, float t) => a;
    public static Vector2 operator +(Vector2 a, Vector2 b) => a;
    public static Vector2 operator -(Vector2 a, Vector2 b) => a;
    public static Vector2 operator -(Vector2 a) => a;
    public static Vector2 operator *(Vector2 a, float d) => a;
    public static Vector2 operator *(float d, Vector2 a) => a;
    public static Vector2 operator /(Vector2 a, float d) => a;
    public static bool operator ==(Vector2 a, Vector2 b) => true;
    public static bool operator !=(Vector2 a, Vector2 b) => false;
    public static implicit operator Vector2(Vector3 v) => default;
    public static implicit operator Vector3(Vector2 v) => default;
    public bool Equals(Vector2 o) => true; public override bool Equals(object? o) => true; public override int GetHashCode() => 0;
  }
  public struct Vector2Int
  {
    public int x { get; set; } public int y { get; set; }
    public Vector2Int(int x, int y) { this.x = x; this.y = y; }
  }
  public struct Vector3 : IEquatable<Vector3>
  {
    public float x, y, z;
    public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
    public Vector3(float x, float y) { this.x = x; this.y = y; z = 0; }
    public static Vector3 zero => default; public static Vector3 one => new Vector3(1, 1, 1);
    public static Vector3 up => new Vector3(0, 1, 0); public static Vector3 down => new Vector3(0, -1, 0);
    public static Vector3 forward => new Vector3(0, 0, 1); public static Vector3 back => new Vector3(0, 0, -1);
    public static Vector3 right => new Vector3(1, 0, 0); public static Vector3 left => new Vector3(-1, 0, 0);
    public float magnitude => 0; public float sqrMagnitude => 0; public Vector3 normalized => this;
    public void Normalize() { }
    public static Vector3 Cross(Vector3 a, Vector3 b) => a;
    public static float Dot(Vector3 a, Vector3 b) => 0;
    public static float Distance(Vector3 a, Vector3 b) => 0;
    public static Vector3 Lerp(Vector3 a, Vector3 b, float t) => a;
    public static Vector3 LerpUnclamped(Vector3 a, Vector3 b, float t) => a;
    public static Vector3 Slerp(Vector3 a, Vector3 b, float t) => a;
    public static Vector3 MoveTowards(Vector3 current, Vector3 target, float maxDistanceDelta) => current;
    public static Vector3 Normalize(Vector3 value) => value;
    public static Vector3 Project(Vector3 vector, Vector3 onNormal) => vector;
    public static Vector3 ProjectOnPlane(Vector3 vector, Vector3 planeNormal) => vector;
    public static Vector3 Scale(Vector3 a, Vector3 b) => a;
    public static Vector3 Min(Vector3 a, Vector3 b) => a; public static Vector3 Max(Vector3 a, Vector3 b) => a;
    public static float Angle(Vector3 from, Vector3 to) => 0;
    public static Vector3 operator +(Vector3 a, Vector3 b) => a;
    public static Vector3 operator -(Vector3 a, Vector3 b) => a;
    public static Vector3 operator -(Vector3 a) => a;
    public static Vector3 operator *(Vector3 a, float d) => a;
    public static Vector3 operator *(float d, Vector3 a) => a;
    public static Vector3 operator /(Vector3 a, float d) => a;
    public static bool operator ==(Vector3 a, Vector3 b) => true;
    public static bool operator !=(Vector3 a, Vector3 b) => false;
    public bool Equals(Vector3 o) => true; public override bool Equals(object? o) => true; public override int GetHashCode() => 0;
  }
  public struct Vector4
  {
    public float x, y, z, w;
    public Vector4(float x, float y, float z, float w) { this.x = x; this.y = y; this.z = z; this.w = w; }
    public static implicit operator Vector4(Vector3 v) => default;
    public static implicit operator Vector3(Vector4 v) => default;
    public static implicit operator Vector4(Vector2 v) => default;
    public static implicit operator Vector2(Vector4 v) => default;
  }
  public struct Quaternion : IEquatable<Quaternion>
  {
    public float x, y, z, w;
    public Quaternion(float x, float y, float z, float w) { this.x = x; this.y = y; this.z = z; this.w = w; }
    public static Quaternion identity => default;
    public Vector3 eulerAngles { get => default; set { } }
    public Quaternion normalized => this;
    public static Quaternion Euler(float x, float y, float z) => default;
    public static Quaternion Euler(Vector3 euler) => default;
    public static Quaternion AngleAxis(float angle, Vector3 axis) => default;
    public static Quaternion LookRotation(Vector3 forward) => default;
    public static Quaternion LookRotation(Vector3 forward, Vector3 upwards) => default;
    public static Quaternion Slerp(Quaternion a, Quaternion b, float t) => a;
    public static Quaternion SlerpUnclamped(Quaternion a, Quaternion b, float t) => a;
    public static Quaternion Lerp(Quaternion a, Quaternion b, float t) => a;
    public static Quaternion Inverse(Quaternion rotation) => rotation;
    public static Quaternion FromToRotation(Vector3 fromDirection, Vector3 toDirection) => default;
    public static Quaternion RotateTowards(Quaternion from, Quaternion to, float maxDegreesDelta) => from;
    public static float Angle(Quaternion a, Quaternion b) => 0;
    public static Quaternion operator *(Quaternion lhs, Quaternion rhs) => lhs;
    public static Vector3 operator *(Quaternion rotation, Vector3 point) => point;
    public static bool operator ==(Quaternion a, Quaternion b) => true;
    public static bool operator !=(Quaternion a, Quaternion b) => false;
    public bool Equals(Quaternion o) => true; public override bool Equals(object? o) => true; public override int GetHashCode() => 0;
  }
  public struct Pose
  {
    public Vector3 position;
    public Quaternion rotation;
    public Pose(Vector3 position, Quaternion rotation) { this.position = position; this.rotation = rotation; }
    public Vector3 forward => default; public Vector3 right => default; public Vector3 up => default;
    public static Pose identity => default;
  }
  public struct Bounds
  {
    public Bounds(Vector3 center, Vector3 size) : this() { }
    public Vector3 center { get; set; } public Vector3 size { get; set; } public Vector3 extents { get; set; }
    public Vector3 min { get; set; } public Vector3 max { get; set; }
    public void Encapsulate(Vector3 point) { }
    public void Encapsulate(Bounds bounds) { }
  }
  public struct Color : IEquatable<Color>
  {
    public float r, g, b, a;
    public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
    public Color(float r, float g, float b) { this.r = r; this.g = g; this.b = b; a = 1; }
    public static Color white => default; public static Color black => default; public static Color clear => default;
    public static Color red => default; public static Color green => default; public static Color blue => default;
    public static Color cyan => default; public static Color magenta => default; public static Color yellow => default;
    public static Color gray => default; public static Color grey => default;
    public float maxColorComponent => 0; public float grayscale => 0;
    public Color linear => this; public Color gamma => this;
    public static Color Lerp(Color a, Color b, float t) => a;
    public static Color LerpUnclamped(Color a, Color b, float t) => a;
    public static Color HSVToRGB(float H, float S, float V) => default;
    public static Color HSVToRGB(float H, float S, float V, bool hdr) => default;
    public static void RGBToHSV(Color rgbColor, out float H, out float S, out float V) { H = S = V = 0; }
    public static Color operator +(Color a, Color b) => a;
    public static Color operator -(Color a, Color b) => a;
    public static Color operator *(Color a, Color b) => a;
    public static Color operator *(Color a, float b) => a;
    public static Color operator *(float b, Color a) => a;
    public static Color operator /(Color a, float b) => a;
    public static bool operator ==(Color a, Color b) => true;
    public static bool operator !=(Color a, Color b) => false;
    public static implicit operator Vector4(Color c) => default;
    public static implicit operator Color(Vector4 v) => default;
    public bool Equals(Color o) => true; public override bool Equals(object? o) => true; public override int GetHashCode() => 0;
  }
  public struct Color32
  {
    public byte r, g, b, a;
    public Color32(byte r, byte g, byte b, byte a) { this.r = r; this.g = g; this.b = b; this.a = a; }
    public static implicit operator Color32(Color c) => default;
    public static implicit operator Color(Color32 c) => default;
  }
  public struct Rect
  {
    public Rect(float x, float y, float width, float height) : this() { }
    public float x { get; set; } public float y { get; set; } public float width { get; set; } public float height { get; set; }
    public Vector2 center { get; set; } public Vector2 size { get; set; } public Vector2 position { get; set; }
    public float xMin { get; set; } public float yMin { get; set; } public float xMax { get; set; } public float yMax { get; set; }
    public bool Contains(Vector2 point) => false;
  }
  public struct Matrix4x4
  {
    public static Matrix4x4 identity => default;
    public static Matrix4x4 TRS(Vector3 pos, Quaternion q, Vector3 s) => default;
    public Vector3 MultiplyPoint3x4(Vector3 point) => point;
  }
  public struct Mathf
  {
    public const float PI = 3.14159274F;
    public const float Infinity = float.PositiveInfinity;
    public const float Deg2Rad = PI * 2F / 360F;
    public const float Rad2Deg = 1F / Deg2Rad;
    public const float Epsilon = 1.401298E-45f;
    public static float Sin(float f) => 0; public static float Cos(float f) => 0; public static float Tan(float f) => 0;
    public static float Asin(float f) => 0; public static float Acos(float f) => 0; public static float Atan(float f) => 0; public static float Atan2(float y, float x) => 0;
    public static float Sqrt(float f) => 0; public static float Abs(float f) => 0; public static int Abs(int value) => 0;
    public static float Min(float a, float b) => a; public static float Min(params float[] values) => 0; public static int Min(int a, int b) => a; public static int Min(params int[] values) => 0;
    public static float Max(float a, float b) => a; public static float Max(params float[] values) => 0; public static int Max(int a, int b) => a; public static int Max(params int[] values) => 0;
    public static float Pow(float f, float p) => 0; public static float Exp(float power) => 0; public static float Log(float f) => 0; public static float Log10(float f) => 0;
    public static float Ceil(float f) => 0; public static float Floor(float f) => 0; public static float Round(float f) => 0;
    public static int CeilToInt(float f) => 0; public static int FloorToInt(float f) => 0; public static int RoundToInt(float f) => 0;
    public static float Sign(float f) => 0;
    public static float Clamp(float value, float min, float max) => value; public static int Clamp(int value, int min, int max) => value;
    public static float Clamp01(float value) => value;
    public static float Lerp(float a, float b, float t) => a; public static float LerpUnclamped(float a, float b, float t) => a;
    public static float InverseLerp(float a, float b, float value) => 0;
    public static float LerpAngle(float a, float b, float t) => a;
    public static float MoveTowards(float current, float target, float maxDelta) => current;
    public static float SmoothStep(float from, float to, float t) => from;
    public static float SmoothDamp(float current, float target, ref float currentVelocity, float smoothTime) => current;
    public static float Repeat(float t, float length) => 0;
    public static float PingPong(float t, float length) => 0;
    public static float PerlinNoise(float x, float y) => 0;
    public static float DeltaAngle(float current, float target) => 0;
    public static bool Approximately(float a, float b) => true;
  }
}
