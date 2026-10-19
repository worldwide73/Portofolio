// DÉCLARATIONS MINIMALES de UI Toolkit (Modules/UIElements/Core, UnityCsReference 6000.3) : seulement ce qu'utilisent
// Scripts/Jeu et Scripts/Interface, signatures recopiées du source (types, paramètres, valeurs par défaut).
#pragma warning disable
using System;
using System.Collections.Generic;

namespace UnityEngine
{
  // Runtime/Export/Input/KeyCode.cs (valeurs de Unity)
  public enum KeyCode { None = 0, Backspace = 8, Tab = 9, Return = 13, Escape = 27, Space = 32, A = 97, D = 100, P = 112, Q = 113, R = 114, W = 119, Z = 122, KeypadEnter = 271, UpArrow = 273, DownArrow = 274, RightArrow = 275, LeftArrow = 276 }
  public class Gradient { }
}

namespace UnityEngine.UIElements
{
  public enum PickingMode { Position = 0, Ignore = 1 }
  public enum TrickleDown { NoTrickleDown = 0, TrickleDown = 1 }
  public delegate void EventCallback<in TEventType>(TEventType evt);

  public interface IEventHandler
  {
    void SendEvent(EventBase e);
    void HandleEvent(EventBase evt);
    bool HasTrickleDownHandlers();
    bool HasBubbleUpHandlers();
  }

  public abstract class CallbackEventHandler : IEventHandler
  {
    public void RegisterCallback<TEventType>(EventCallback<TEventType> callback, TrickleDown useTrickleDown = TrickleDown.NoTrickleDown) where TEventType : EventBase<TEventType>, new() { }
    public void UnregisterCallback<TEventType>(EventCallback<TEventType> callback, TrickleDown useTrickleDown = TrickleDown.NoTrickleDown) where TEventType : EventBase<TEventType>, new() { }
    public abstract void SendEvent(EventBase e);
    void IEventHandler.HandleEvent(EventBase evt) { }
    public bool HasTrickleDownHandlers() => false;
    public bool HasBubbleUpHandlers() => false;
  }

  public abstract class Focusable : CallbackEventHandler
  {
    public abstract FocusController focusController { get; }
    public virtual bool focusable { get; set; }
    public int tabIndex { get; set; }
    public bool delegatesFocus { get; set; }
    public virtual bool canGrabFocus => focusable;
    public virtual void Focus() { }
    public virtual void Blur() { }
  }

  public class FocusController
  {
    public Focusable focusedElement => null!;
    public void IgnoreEvent(EventBase evt) { }
  }

  public interface IPanel : IDisposable
  {
    VisualElement visualTree { get; }
    FocusController focusController { get; }
    VisualElement Pick(Vector2 point);
  }

  public static class RuntimePanelUtils
  {
    public static Vector2 ScreenToPanel(IPanel panel, Vector2 screenPosition) => screenPosition;
  }

  // ---- Le style ----
  public enum StyleKeyword { Undefined, Null, Auto, None, Initial }
  public enum DisplayStyle { Flex = 0, None = 1 }
  public enum Visibility { Visible = 0, Hidden = 1 }
  public enum LengthUnit { Pixel = 0, Percent = 1 }
  public struct Length
  {
    public Length(float value) : this() { }
    public Length(float value, LengthUnit unit) : this() { }
    public static Length Pixels(float value) => default;
    public static Length Percent(float value) => default;
    public static Length Auto() => default;
    public static Length None() => default;
    public float value { get; set; }
    public static implicit operator Length(float value) => default;
  }
  public struct Scale
  {
    public Scale(Vector2 scale) : this() { }
    public Scale(Vector3 scale) : this() { }
    public static Scale None() => default;
    public Vector3 value { get; set; }
  }
  public struct Translate
  {
    public Translate(Length x, Length y, float z) : this() { }
    public Translate(Length x, Length y) : this() { }
    public static Translate None() => default;
  }
  public struct StyleEnum<T> where T : struct, IConvertible
  {
    public StyleEnum(T v) : this() { }
    public StyleEnum(StyleKeyword keyword) : this() { }
    public T value { get; set; }
    public StyleKeyword keyword { get; set; }
    public static implicit operator StyleEnum<T>(StyleKeyword keyword) => default;
    public static implicit operator StyleEnum<T>(T v) => default;
  }
  public struct StyleFloat
  {
    public float value { get; set; }
    public StyleKeyword keyword { get; set; }
    public static implicit operator StyleFloat(StyleKeyword keyword) => default;
    public static implicit operator StyleFloat(float v) => default;
  }
  public struct StyleLength
  {
    public Length value { get; set; }
    public StyleKeyword keyword { get; set; }
    public static implicit operator StyleLength(StyleKeyword keyword) => default;
    public static implicit operator StyleLength(float v) => default;
    public static implicit operator StyleLength(Length v) => default;
  }
  public struct StyleColor
  {
    public Color value { get; set; }
    public StyleKeyword keyword { get; set; }
    public static implicit operator StyleColor(StyleKeyword keyword) => default;
    public static implicit operator StyleColor(Color v) => default;
  }
  public struct StyleScale
  {
    public StyleScale(Scale v) : this() { }
    public StyleScale(StyleKeyword keyword) : this() { }
    public StyleScale(Vector2 scale) : this() { }
    public Scale value { get; set; }
    public StyleKeyword keyword { get; set; }
    public static implicit operator StyleScale(Vector2 scale) => default;
    public static implicit operator StyleScale(Vector3 scale) => default;
    public static implicit operator StyleScale(StyleKeyword keyword) => default;
    public static implicit operator StyleScale(Scale v) => default;
  }
  public struct StyleTranslate
  {
    public static implicit operator StyleTranslate(StyleKeyword keyword) => default;
    public static implicit operator StyleTranslate(Translate v) => default;
    public static implicit operator StyleTranslate(Vector3 v) => default;
    public static implicit operator StyleTranslate(Vector2 v) => default;
  }
  public partial interface IStyle
  {
    StyleColor backgroundColor { get; set; }
    StyleColor color { get; set; }
    StyleEnum<DisplayStyle> display { get; set; }
    StyleEnum<Visibility> visibility { get; set; }
    StyleLength left { get; set; }
    StyleLength top { get; set; }
    StyleLength width { get; set; }
    StyleLength height { get; set; }
    StyleFloat opacity { get; set; }
    StyleScale scale { get; set; }
    StyleTranslate translate { get; set; }
  }
  public partial interface IResolvedStyle
  {
    DisplayStyle display { get; }
    Visibility visibility { get; }
    float opacity { get; }
    float width { get; }
    float height { get; }
    Color color { get; }
  }
  public struct CustomStyleProperty<T> : IEquatable<CustomStyleProperty<T>>
  {
    public CustomStyleProperty(string propertyName) : this() { }
    public string name { get; }
    public bool Equals(CustomStyleProperty<T> other) => true;
  }
  public interface ICustomStyle
  {
    bool TryGetValue(CustomStyleProperty<float> property, out float value);
    bool TryGetValue(CustomStyleProperty<int> property, out int value);
    bool TryGetValue(CustomStyleProperty<bool> property, out bool value);
    bool TryGetValue(CustomStyleProperty<Color> property, out Color value);
    bool TryGetValue(CustomStyleProperty<Texture2D> property, out Texture2D value);
    bool TryGetValue(CustomStyleProperty<string> property, out string value);
  }

  // ---- Le dessin (Painter2D) ----
  public enum LineJoin { Miter, Bevel, Round }
  public enum LineCap { Butt, Round }
  public enum FillRule { NonZero, OddEven }
  public enum ArcDirection { Clockwise, CounterClockwise }
  public class Painter2D : IDisposable
  {
    public float lineWidth { get; set; }
    public Color strokeColor { get; set; }
    public Color fillColor { get; set; }
    public LineJoin lineJoin { get; set; }
    public LineCap lineCap { get; set; }
    public float miterLimit { get; set; }
    public void BeginPath() { }
    public void ClosePath() { }
    public void MoveTo(Vector2 pos) { }
    public void LineTo(Vector2 pos) { }
    public void ArcTo(Vector2 p1, Vector2 p2, float radius) { }
    public void Arc(Vector2 center, float radius, Angle startAngle, Angle endAngle, ArcDirection direction = ArcDirection.Clockwise) { }
    public void BezierCurveTo(Vector2 p1, Vector2 p2, Vector2 p3) { }
    public void QuadraticCurveTo(Vector2 p1, Vector2 p2) { }
    public void Stroke() { }
    public void Fill(FillRule fillRule = FillRule.NonZero) { }
    public void Dispose() { }
  }
  public struct Angle
  {
    public Angle(float value) : this() { }
    public static Angle Degrees(float value) => default;
    public static implicit operator Angle(float value) => default;
  }
  public class MeshGenerationContext
  {
    public VisualElement visualElement { get; private set; } = null!;
    public Painter2D painter2D => null!;
  }

  // ---- Les éléments ----
  public partial class VisualElement : Focusable
  {
    public VisualElement() { }
    public string name { get; set; } = "";
    public PickingMode pickingMode { get; set; }
    public object userData { get; set; } = null!;
    public IPanel panel => null!;
    public VisualElement parent => null!;
    public Hierarchy hierarchy => default;
    public struct Hierarchy
    {
      public VisualElement parent => null!;
      public int childCount => 0;
    }
    public virtual VisualElement contentContainer => this;
    public override FocusController focusController => null!;
    public override bool canGrabFocus => false;
    public bool enabledInHierarchy => true;
    public bool enabledSelf => true;
    public void SetEnabled(bool value) { }
    public bool visible { get; set; }
    public IStyle style => null!;
    public IResolvedStyle resolvedStyle => null!;
    public ICustomStyle customStyle => null!;
    public Rect layout => default;
    public Rect contentRect => default;
    public Rect worldBound => default;
    public Rect localBound => default;
    public Action<MeshGenerationContext> generateVisualContent { get; set; } = null!;
    public void MarkDirtyRepaint() { }
    public int childCount => 0;
    public VisualElement ElementAt(int index) => null!;
    public IEnumerable<VisualElement> Children() => null!;
    public void Add(VisualElement child) { }
    public void Insert(int index, VisualElement element) { }
    public void Remove(VisualElement element) { }
    public void RemoveAt(int index) { }
    public void Clear() { }
    public void RemoveFromHierarchy() { }
    public void BringToFront() { }
    public void SendToBack() { }
    public bool Contains(VisualElement child) => false;
    public IEnumerable<string> GetClasses() => null!;
    public void ClearClassList() { }
    public void AddToClassList(string className) { }
    public void RemoveFromClassList(string className) { }
    public void ToggleInClassList(string className) { }
    public void EnableInClassList(string className, bool enable) { }
    public bool ClassListContains(string cls) => false;
    public string tooltip { get; set; } = "";
    public sealed override void SendEvent(EventBase e) { }
  }
  public static partial class VisualElementExtensions
  {
    public static Vector2 WorldToLocal(this VisualElement ele, Vector2 p) => p;
    public static Vector2 LocalToWorld(this VisualElement ele, Vector2 p) => p;
  }
  public static class PointerCaptureHelper
  {
    public static bool HasPointerCapture(this IEventHandler handler, int pointerId) => false;
    public static void CapturePointer(this IEventHandler handler, int pointerId) { }
    public static void ReleasePointer(this IEventHandler handler, int pointerId) { }
  }
  public struct UQueryBuilder<T> where T : VisualElement
  {
    public List<T> ToList() => null!;
    public void ToList(List<T> results) { }
    public void ForEach(Action<T> funcCall) { }
    public T First() => null!;
  }
  public static class UQueryExtensions
  {
    public static T Q<T>(this VisualElement e, string name = null, params string[] classes) where T : VisualElement => null!;
    public static VisualElement Q(this VisualElement e, string name = null, params string[] classes) => null!;
    public static T Q<T>(this VisualElement e, string name = null, string className = null) where T : VisualElement => null!;
    public static VisualElement Q(this VisualElement e, string name = null, string className = null) => null!;
    public static UQueryBuilder<T> Query<T>(this VisualElement e, string name = null, params string[] classes) where T : VisualElement => default;
    public static UQueryBuilder<T> Query<T>(this VisualElement e, string name = null, string className = null) where T : VisualElement => default;
  }
  public class BindableElement : VisualElement { }
  public class TemplateContainer : BindableElement { }
  public class TextElement : BindableElement
  {
    public static readonly string ussClassName = "unity-text-element";
    public virtual string text { get; set; } = "";
  }
  public class Label : TextElement
  {
    public new static readonly string ussClassName = "unity-label";
    public Label() { }
    public Label(string text) { }
  }
  public class Button : TextElement
  {
    public new static readonly string ussClassName = "unity-button";
    public Button() { }
    public Button(Action clickEvent) { }
    public event Action clicked { add { } remove { } }
  }
  public enum ScrollViewMode { Vertical, Horizontal, VerticalAndHorizontal }
  public enum ScrollerVisibility { Auto, AlwaysVisible, Hidden }
  public class ScrollView : VisualElement
  {
    public ScrollView() { }
    public ScrollView(ScrollViewMode scrollViewMode) { }
    public ScrollerVisibility horizontalScrollerVisibility { get; set; }
    public ScrollerVisibility verticalScrollerVisibility { get; set; }
    public override VisualElement contentContainer => null!;
    public void ScrollTo(VisualElement child) { }
  }

  // ---- Les évènements ----
  public abstract class EventBase : IDisposable
  {
    public IEventHandler target { get; set; } = null!;
    public IEventHandler currentTarget => null!;
    public bool isPropagationStopped => false;
    public void StopPropagation() { }
    public void StopImmediatePropagation() { }
    public void Dispose() { }
  }
  public abstract class EventBase<T> : EventBase where T : EventBase<T>, new()
  {
    public static T GetPooled() => new T();
  }
  public abstract class KeyboardEventBase<T> : EventBase<T> where T : KeyboardEventBase<T>, new()
  {
    public char character { get; protected set; }
    public KeyCode keyCode { get; protected set; }
    public bool shiftKey => false;
    public bool ctrlKey => false;
    public bool altKey => false;
  }
  public class KeyDownEvent : KeyboardEventBase<KeyDownEvent> { }
  public class KeyUpEvent : KeyboardEventBase<KeyUpEvent> { }
  public abstract class NavigationEventBase<T> : EventBase<T> where T : NavigationEventBase<T>, new()
  {
    public bool shiftKey => false;
  }
  public class NavigationMoveEvent : NavigationEventBase<NavigationMoveEvent>
  {
    public enum Direction { None, Left, Up, Right, Down, Next, Previous }
    public Direction direction { get; private set; }
    public Vector2 move { get; private set; }
  }
  public class NavigationSubmitEvent : NavigationEventBase<NavigationSubmitEvent> { }
  public class NavigationCancelEvent : NavigationEventBase<NavigationCancelEvent> { }
  public abstract class PointerEventBase<T> : EventBase<T> where T : PointerEventBase<T>, new()
  {
    public int pointerId { get; protected set; }
    public string pointerType { get; protected set; } = "";
    public int button { get; protected set; }
    public Vector3 position { get; protected set; }
    public Vector3 localPosition { get; protected set; }
  }
  public sealed class PointerDownEvent : PointerEventBase<PointerDownEvent> { }
  public sealed class PointerMoveEvent : PointerEventBase<PointerMoveEvent> { }
  public sealed class PointerUpEvent : PointerEventBase<PointerUpEvent> { }
  public sealed class PointerEnterEvent : PointerEventBase<PointerEnterEvent> { }
  public sealed class PointerLeaveEvent : PointerEventBase<PointerLeaveEvent> { }
  public abstract class PointerCaptureEventBase<T> : EventBase<T> where T : PointerCaptureEventBase<T>, new()
  {
    public int pointerId { get; protected set; }
  }
  public class PointerCaptureOutEvent : PointerCaptureEventBase<PointerCaptureOutEvent> { }
  public abstract class FocusEventBase<T> : EventBase<T> where T : FocusEventBase<T>, new()
  {
    public Focusable relatedTarget { get; protected set; } = null!;
  }
  public class FocusEvent : FocusEventBase<FocusEvent> { }
  public class BlurEvent : FocusEventBase<BlurEvent> { }
  public class FocusInEvent : FocusEventBase<FocusInEvent> { }
  public class FocusOutEvent : FocusEventBase<FocusOutEvent> { }
  public class GeometryChangedEvent : EventBase<GeometryChangedEvent>
  {
    public Rect oldRect { get; private set; }
    public Rect newRect { get; private set; }
  }
  public class CustomStyleResolvedEvent : EventBase<CustomStyleResolvedEvent>
  {
    public ICustomStyle customStyle => null!;
  }
  public class AttachToPanelEvent : EventBase<AttachToPanelEvent> { }

  // ---- Les documents ----
  public enum PanelScaleMode { ConstantPixelSize, ConstantPhysicalSize, ScaleWithScreenSize }
  public enum PanelScreenMatchMode { MatchWidthOrHeight, Shrink, Expand }
  public class StyleSheet : ScriptableObject { }
  public class ThemeStyleSheet : StyleSheet { }
  public class VisualTreeAsset : ScriptableObject
  {
    public TemplateContainer Instantiate() => null!;
    public void CloneTree(VisualElement target) { }
  }
  public class PanelSettings : ScriptableObject
  {
    public ThemeStyleSheet themeStyleSheet { get; set; } = null!;
    public PanelScaleMode scaleMode { get; set; }
    public Vector2Int referenceResolution { get; set; }
    public PanelScreenMatchMode screenMatchMode { get; set; }
    public float match { get; set; }
    public float sortingOrder { get; set; }
    public int targetDisplay { get; set; }
    public bool clearColor { get; set; }
    public float scale { get; set; }
  }
  public sealed class UIDocument : MonoBehaviour
  {
    public PanelSettings panelSettings { get; set; } = null!;
    public VisualTreeAsset visualTreeAsset { get; set; } = null!;
    public VisualElement rootVisualElement => null!;
    public float sortingOrder { get; set; }
  }
}
