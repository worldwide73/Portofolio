// DÉCLARATIONS MINIMALES de UI Toolkit (Modules/UIElements, 6000.3) et de l'Input System (com.unity.inputsystem).
// Seulement ce qu'utilise le code de jeu ; l'interface (Scripts/Interface) a ses propres besoins, à compléter de la
// même façon (signature vérifiée dans le source) avant de la compiler ici (dotnet build -p:AvecInterface=oui).
#pragma warning disable
using System;
using System.Collections.Generic;

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
