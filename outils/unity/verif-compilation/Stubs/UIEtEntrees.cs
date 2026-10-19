// DÉCLARATIONS MINIMALES de UI Toolkit (Modules/UIElements, 6000.3) et de l'Input System (com.unity.inputsystem).
// Seulement ce qu'utilise le code de jeu ; l'interface (Scripts/Interface) a ses propres besoins, à compléter de la
// même façon (signature vérifiée dans le source) avant de la compiler ici (dotnet build -p:AvecInterface=oui).
#pragma warning disable
using System;
using System.Collections.Generic;

namespace UnityEngine.UIElements
{
  public enum PickingMode { Position = 0, Ignore = 1 }
  public interface IPanel
  {
    VisualElement visualTree { get; }
    VisualElement Pick(Vector2 point);
    VisualElement? focusedElement { get; }
  }
  public class Focusable
  {
    public bool focusable { get; set; }
    public int tabIndex { get; set; }
    public void Focus() { }
    public void Blur() { }
  }
  public partial class VisualElement : Focusable
  {
    public IPanel panel => null!;
    public PickingMode pickingMode { get; set; }
    public bool enabledInHierarchy => true;
    public bool enabledSelf => true;
    public string name { get; set; } = "";
    public VisualElement parent => null!;
  }
  public static class RuntimePanelUtils
  {
    public static Vector2 ScreenToPanel(IPanel panel, Vector2 screenPosition) => screenPosition;
  }
  public enum PanelScaleMode { ConstantPixelSize, ConstantPhysicalSize, ScaleWithScreenSize }
  public enum PanelScreenMatchMode { MatchWidthOrHeight, Shrink, Expand }
  public class StyleSheet : ScriptableObject { }
  public class ThemeStyleSheet : StyleSheet { }
  public class VisualTreeAsset : ScriptableObject
  {
    public TemplateContainer Instantiate() => null!;
    public void CloneTree(VisualElement target) { }
  }
  public class TemplateContainer : VisualElement { }
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

namespace UnityEngine.InputSystem
{
  using UnityEngine.InputSystem.Controls;

  public abstract class InputDevice { public static InputDevice? current => null; }
  public class Pointer : InputDevice
  {
    public static new Pointer? current => null;
    public ButtonControl press => null!;
    public Vector2Control position => null!;
    public Vector2Control delta => null!;
  }
  public class Mouse : Pointer
  {
    public static new Mouse? current => null;
    public ButtonControl leftButton => null!;
    public ButtonControl rightButton => null!;
    public Vector2Control scroll => null!;
  }
  public class Touchscreen : Pointer { public static new Touchscreen? current => null; }
  public class Keyboard : InputDevice
  {
    public static new Keyboard? current => null;
    public KeyControl this[Key key] => null!;
    public KeyControl leftArrowKey => null!; public KeyControl rightArrowKey => null!;
    public KeyControl upArrowKey => null!; public KeyControl downArrowKey => null!;
    public KeyControl aKey => null!; public KeyControl dKey => null!; public KeyControl qKey => null!;
    public KeyControl wKey => null!; public KeyControl zKey => null!; public KeyControl sKey => null!;
    public KeyControl pKey => null!; public KeyControl rKey => null!;
    public KeyControl spaceKey => null!; public KeyControl enterKey => null!; public KeyControl escapeKey => null!;
    public KeyControl tabKey => null!; public KeyControl backspaceKey => null!;
    public ButtonControl anyKey => null!;
  }
  public enum Key { None = 0, Space = 1, Enter = 2, Tab = 3, Escape = 60, LeftArrow = 61, RightArrow = 62, UpArrow = 63, DownArrow = 64, A = 15, D = 18, P = 30, Q = 31, W = 37, Z = 40 }
}

namespace UnityEngine.InputSystem.Controls
{
  public class InputControl { }
  public class InputControl<T> : InputControl where T : struct { public T ReadValue() => default; }
  public class AxisControl : InputControl<float> { }
  public class ButtonControl : AxisControl
  {
    public bool isPressed => false;
    public bool wasPressedThisFrame => false;
    public bool wasReleasedThisFrame => false;
  }
  public class KeyControl : ButtonControl { public UnityEngine.InputSystem.Key keyCode => default; }
  public class Vector2Control : InputControl<Vector2> { }
}
