# Adding Native Modules/Views via the Expo Modules API — Step by Step

Companion to [`2026-07-07-custom-turbomodules.md`](./2026-07-07-custom-turbomodules.md), which covers the **raw React Native TurboModule pattern**. This doc covers Expo's own abstraction over the same underlying problem — worth reading that doc's intro note first for the "when to use which" framing. Short version: raw pattern when the goal is understanding RN internals, Expo Modules API when the goal is shipping a working module/view with less friction. We used this path for the Week 10 camera-preview **view** component specifically to avoid repeating the Obj-C++/`ReactCodegen`-module landmine documented in the other doc's Step 8, now that the underlying mechanism was already understood.

Covers both platforms — Steps 1–8 below are the iOS implementation (Swift/AVFoundation), Step 9 covers the Android counterpart (Kotlin/CameraX).

## 1. Scaffold a local module

```
npx create-expo-module@latest --local
```

The `--local` flag is the key thing — it scaffolds *inside* the current app's `modules/` directory (not a separate standalone/publishable package), and Expo's autolinking automatically discovers anything under `./modules/` at build time. No manual Podfile edit, no manual Xcode "Add Files to target" step — a real, meaningful improvement over the raw pattern's Step 9.

Interactive prompts:
- **Local module name** (kebab-case, npm-style, becomes the folder name) — e.g. `expo-camera-preview`
- **Native module name** (PascalCase — note the CLI may auto-prefix `Expo`, e.g. you type `CameraPreview` and get `ExpoCameraPreview`; whatever it lands on becomes the registered name everywhere, so use the actual generated names, not what you typed)
- **Target platforms** — pick just Apple/iOS for now if doing platforms one at a time
- **Which feature examples to include** — select **View** for a native-view module (this scaffolds an `ExpoView` example + `View()` DSL block). Worth double-checking after scaffolding that this actually landed — in practice, the generated `Module.swift` came out with only a bare `Name(...)` and no `View()` block despite selecting View, so we added the view scaffolding by hand instead of trusting the CLI's output blindly.
- **Android package name** — any valid reverse-domain string works, no functional landmine. Expo's own convention for locally-scaffolded modules is `expo.modules.<modulename>`, independent of the host app's own package name.

## 2. The generated file structure — four layers, four responsibilities

```
modules/expo-camera-preview/
├── android/
│   └── src/main/java/expo/modules/camerapreview/ExpoCameraPreviewModule.kt
├── ios/
│   ├── ExpoCameraPreview.podspec
│   └── ExpoCameraPreviewModule.swift
├── src/
│   ├── ExpoCameraPreview.types.ts
│   └── ExpoCameraPreviewModule.ts
└── expo-module.config.json
```

**Note the module's own `ios/` folder is separate from the app's `ios/rninternals/` folder** where raw-pattern TurboModules (`DeviceInfoModule.swift`, `BiometricAuthModule.swift`) live. This tripped us up once — "update `ios/ExpoCameraPreviewModule.swift`" is ambiguous; the real path is `modules/expo-camera-preview/ios/ExpoCameraPreviewModule.swift`, and it will never show up in Xcode's main project navigator the way Week 9's files did (it's pulled in via CocoaPods/autolinking, not manually added to the Xcode target).

Each file in a native-view module answers a different question, at a different layer:

1. **`Info.plist` (XML, OS-level, app's own file)** — the **permission layer**. iOS refuses hardware access (camera, biometrics, etc.) without the matching purpose-string key, independent of anything your Swift code does.
2. **`<ViewName>.swift` (Swift, native implementation)** — the **actual rendering implementation**. Has zero awareness that React Native exists; could theoretically be reused in a pure native iOS app with no RN involved.
3. **`<ModuleName>Module.swift` (Swift, registration/bridge)** — the **glue layer**, telling the Expo Modules system "this Swift class is a view, expose it under this name." Direct equivalent of what `RCT_EXTERN_REMAP_MODULE` did in the raw pattern, via a much less painful mechanism.
4. **`<ViewName>.tsx` (TypeScript/JSX, JS-facing API)** — the layer your actual app code touches, hiding the native-connection plumbing behind an ordinary-looking React component.

## 3. Write the native view (Swift)

`modules/expo-camera-preview/ios/ExpoCameraPreviewView.swift` — worked example, a live camera preview using AVFoundation:

```swift
import ExpoModulesCore
import AVFoundation

class ExpoCameraPreviewView: ExpoView {
  private let captureSession = AVCaptureSession()
  private lazy var previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
    setupCaptureSession()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
  }

  private func setupCaptureSession() {
    AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
      guard granted, let self else { return }
      guard let device = AVCaptureDevice.default(for: .video),
            let input = try? AVCaptureDeviceInput(device: device) else { return }
      self.captureSession.beginConfiguration()
      if self.captureSession.canAddInput(input) {
        self.captureSession.addInput(input)
      }
      self.captureSession.commitConfiguration()
      self.captureSession.startRunning()
    }
  }

  deinit {
    captureSession.stopRunning()
  }
}
```

Key points:
- Extends `ExpoView` (from `ExpoModulesCore`), not `NSObject`/`UIView` directly — `ExpoView` is Expo's own base class wiring up the registration plumbing automatically. **No `@objc(...)` needed** — unlike the raw pattern, this registration doesn't depend on the Objective-C runtime finding a class by string name; it's resolved via a direct Swift type reference in the Module file (`View(ExpoCameraPreviewView.self)` below), a compile-time reference, not a runtime string lookup.
- `required init(appContext: AppContext? = nil)` — this exact signature is mandated by `ExpoView`'s designated initializer; `required` guarantees the Expo Modules system can always construct instances generically, the Swift analogue of why `NSObject` conformance mattered for the raw pattern's ObjC-runtime-based registration.
- `AVCaptureVideoPreviewLayer` is a `CALayer`, not a `UIView` — added via `layer.addSublayer(...)`, not `addSubview(...)`. Because it's a bare layer, it does **not** auto-resize with the parent view; `layoutSubviews` must manually keep `previewLayer.frame` synced to `bounds` on every layout pass (including ones triggered by RN's Yoga engine resizing the view via style/prop changes).
- `AVCaptureDevice.requestAccess` is genuinely asynchronous and its callback isn't guaranteed to run on any particular thread — hence `[weak self]` to avoid a retain cycle (the closure is held alive by system machinery for the duration of the async permission check), and the two-part `guard granted, let self else { return }` to bail cleanly if permission was denied or the view was already deallocated.
- `deinit { captureSession.stopRunning() }` matters — without it, the camera hardware (and its in-use indicator) stays active even after the view leaves the screen, since nothing else would ever tell the session to stop.
- **The iOS Simulator has no real camera hardware** — `AVCaptureDevice.default(for: .video)` returns `nil` there, so the `guard` above silently bails early. The view still renders (proving the whole registration chain works), just black — that's expected, not a bug. Confirming real camera footage requires a physical device.

## 4. Register the view in the Module definition

`modules/expo-camera-preview/ios/ExpoCameraPreviewModule.swift`:

```swift
import ExpoModulesCore

public class ExpoCameraPreviewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoCameraPreview")

    View(ExpoCameraPreviewView.self) {
    }
  }
}
```

`Name(...)` is the string JS looks up later. `View(ExpoCameraPreviewView.self) { }` connects the Swift class to that registration — the body block is where you'd declare `Prop(...)`/`Events(...)` if the view needs configurable props or emits events back to JS (not needed for this minimal example).

## 5. Write the JS-facing wrapper

`modules/expo-camera-preview/src/ExpoCameraPreviewView.tsx`:

```tsx
import { requireNativeView } from "expo";
import { ViewProps } from "react-native";

const NativeView = requireNativeView("ExpoCameraPreview");

export default function ExpoCameraPreviewView(props: ViewProps) {
  return <NativeView {...props} />;
}
```

**Watch the function name here** — this is a real mistake we made and caught: `requireNativeView` (for views, renders inline in the tree) is a completely different function from `requireNativeModule` (for callable-method modules, like `NativeCustomDeviceInfo`/`NativeBiometricAuth` in the other doc). Copy-pasting a `.ts` module-wrapper file as a starting point for a `.tsx` view-wrapper file will produce something that type-checks-adjacent but is semantically wrong — `requireNativeModule` resolves method-style modules, not renderable views, and using it here would fail. Confirmed the correct current export by checking `node_modules/expo/build/Expo.d.ts` directly: `requireNativeViewManager as requireNativeView` — so `requireNativeView` (imported from `'expo'`) is the right, current name.

## 6. Permission string

Same category of requirement as `NSFaceIDUsageDescription` in the other doc — add to the **app's** `ios/rninternals/Info.plist` (not the module's own folder):

```xml
<key>NSCameraUsageDescription</key>
<string>This app uses the camera to show a live preview.</string>
```

## 7. Rebuild

Because this is a **brand-new podspec** (`ExpoCameraPreview.podspec`, newly discovered by autolinking), CocoaPods needs to register it once:

```
cd ios && npx pod-install
```

Then `npx expo run:ios` as usual. This is different from the raw-pattern doc's Step 10 guidance ("no pod install needed for pure Swift/Kotlin changes") — that applied to editing *existing* files with no new dependency; a first-time new local module is a new dependency, so it does need the one-time `pod install`.

## 8. Use it from JS

```tsx
import ExpoCameraPreviewView from "../../modules/expo-camera-preview/src/ExpoCameraPreviewView";

<ExpoCameraPreviewView style={{ flex: 1, backgroundColor: "black" }} />
```

Renders inline like any other RN view — no method call, no promise, just a component in the tree. The `.tsx` wrapper from Step 5 is already cross-platform — `requireNativeView("ExpoCameraPreview")` resolves to whichever native implementation exists per-platform automatically, so no separate JS file is needed for Android.

## 9. Android implementation (Kotlin/CameraX)

### Why the architecture differs from iOS

CameraX (Android's modern Jetpack camera library) has real structural differences from AVFoundation, not just syntax:

- **Lifecycle-bound by design.** Where AVFoundation's `AVCaptureSession` is manually started/stopped, CameraX's `bindToLifecycle(lifecycleOwner, cameraSelector, useCase)` ties the camera's active state directly to a `LifecycleOwner` — it starts/stops automatically as that owner moves through its lifecycle states.
- **`PreviewView`** (from `androidx.camera.view`) is a real `View` you add as a child — simpler than iOS's manual `CALayer` frame-syncing in `layoutSubviews`.
- **Permission handling is the trickiest divergence.** `CAMERA` is a "dangerous" runtime permission on Android — unlike iOS's `NSCameraUsageDescription` (a declarative manifest key that triggers the system prompt automatically on first hardware access), Android requires an explicit runtime request tied to an Activity, with the result delivered via a callback on that Activity — awkward to wire up from inside a View class. Cleaner fix used here: **request the permission from the JS side before ever mounting the view** (via React Native's built-in `PermissionsAndroid`), so the native Kotlin code only ever needs to *check* (not request) permission, synchronously, before starting the camera.

### 9a. JS-side permission request (before rendering the view)

```tsx
import { PermissionsAndroid, Platform } from "react-native";

useEffect(() => {
  if (Platform.OS === "android") {
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  }
}, []);
```

Gate rendering `<ExpoCameraPreviewView />` until this resolves — don't mount camera UI before you know permission was actually granted.

### 9b. Manifest permission

`modules/expo-camera-preview/android/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.CAMERA"/>
</manifest>
```

**The `xmlns:android` namespace declaration on the root `<manifest>` tag is not optional** — without it, `android:name` is an undeclared namespace prefix and the Gradle manifest merger fails with an opaque XML parse error (`Error parsing .../AndroidManifest.xml`, no further detail) rather than a permission-specific one. This bit us directly — the scaffolded file's root tag had no namespace declaration at all.

### 9c. CameraX + lifecycle dependencies

The module's own `android/build.gradle` (not the app's) — note this module's generated file nests `dependencies { }` inside the `android { }` block rather than as a top-level block, which is non-standard Gradle convention but works fine here (don't "fix" it, it's how `expo-module-gradle-plugin` expects it):

```gradle
dependencies {
  implementation "androidx.camera:camera-core:1.3.4"
  implementation "androidx.camera:camera-camera2:1.3.4"
  implementation "androidx.camera:camera-lifecycle:1.3.4"
  implementation "androidx.camera:camera-view:1.3.4"
  implementation "androidx.lifecycle:lifecycle-runtime-ktx:2.8.7"
}
```

The last line matters and is easy to miss: `findViewTreeLifecycleOwner()` (used below) is **not** pulled in transitively by the CameraX artifacts — omitting it produces `Unresolved reference: findViewTreeLifecycleOwner` at compile time, a plain missing-dependency error, not a code bug.

### 9d. The Kotlin view

`modules/expo-camera-preview/android/src/main/java/expo/modules/camerapreview/ExpoCameraPreviewView.kt`:

```kotlin
package expo.modules.camerapreview

import android.content.Context
import android.content.pm.PackageManager
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.findViewTreeLifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class ExpoCameraPreviewView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val previewView = PreviewView(context)

  init {
    addView(previewView)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    startCamera()
  }

  private fun startCamera() {
    val hasPermission = ContextCompat.checkSelfPermission(
      context, android.Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED
    if (!hasPermission) return

    val lifecycleOwner = findViewTreeLifecycleOwner() ?: return
    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

    cameraProviderFuture.addListener({
      val cameraProvider = cameraProviderFuture.get()
      val preview = Preview.Builder().build().also {
        it.setSurfaceProvider(previewView.surfaceProvider)
      }

      cameraProvider.unbindAll()
      cameraProvider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview)
    }, ContextCompat.getMainExecutor(context))
  }
}
```

Key points:
- Constructor takes both `context: Context` and `appContext: AppContext` — `ExpoView` on Android (extends RN's `RCTView`, ultimately `View`/`ViewGroup`) needs the plain Android `Context` for standard view construction alongside Expo's own `AppContext`. Since `ExpoView`'s Android base is a `ViewGroup`, `addView(previewView)` works directly — no manual layer-compositing the way iOS needed.
- Camera setup happens in `onAttachedToWindow()`, not the constructor — `findViewTreeLifecycleOwner()` walks up the view hierarchy to find the nearest `LifecycleOwner` (normally set automatically by the hosting `ComponentActivity`), and that relationship only exists once the view is actually attached to a window, not at construction time.
- Permission is only **checked** (`ContextCompat.checkSelfPermission`), never **requested**, here — the request already happened on the JS side (Step 9a). This sidesteps needing an Activity-result-callback dance inside a View class entirely.
- `ProcessCameraProvider.getInstance(context)` returns a `ListenableFuture` — camera setup is asynchronous, hence the `addListener` callback, run on the main executor (`ContextCompat.getMainExecutor`) since it eventually touches the view's `previewView.surfaceProvider`.
- `cameraProvider.unbindAll()` before `bindToLifecycle` clears any prior use-case bindings — defensive, avoids conflicting bindings if this ever runs more than once for the same provider.

### 9e. Register it in the Module

`modules/expo-camera-preview/android/src/main/java/expo/modules/camerapreview/ExpoCameraPreviewModule.kt`:

```kotlin
package expo.modules.camerapreview

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoCameraPreviewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoCameraPreview")

    View(ExpoCameraPreviewView::class) {
    }
  }
}
```

Direct Kotlin analogue of the Swift `Module`/`View(...)` pattern from Step 4 — `View(ExpoCameraPreviewView::class)` (Kotlin class reference) instead of `View(ExpoCameraPreviewView.self)` (Swift metatype), same underlying idea.

### 9f. Rebuild

```
npx expo run:android
```

No separate "install pods" equivalent step needed — Gradle's autolinking picks up the new `modules/expo-camera-preview/android/` folder (including its own `build.gradle` dependencies) automatically on the next build.

---

## Common pitfalls hit building this

- **File path ambiguity**: "update `ios/ExpoCameraPreviewModule.swift`" without the `modules/expo-camera-preview/` prefix is genuinely ambiguous given the raw-pattern modules already live in the app's own `ios/rninternals/` — always give the full path from repo root when instructing edits across two different native-module patterns in the same project.
- **`requireNativeModule` vs `requireNativeView`** — easy to mix up if copy-pasting between a module wrapper and a view wrapper; they resolve fundamentally different things (callable methods vs. renderable views) and the wrong one won't work.
- **CLI-selected feature examples aren't guaranteed to land** — selecting "View" during scaffolding didn't actually produce a `View()` block in the generated `Module.swift` in practice; verify the generated output rather than assuming the prompt selection took effect.
- **Even Expo-Modules-API-based local modules break Expo Go** — being built with Expo's own tooling doesn't grant Expo Go compatibility. "Expo Modules API" describes *how* you write native code, not *where it can run*. Any module living in your project's own `modules/` folder (or any custom native code at all, including raw-pattern TurboModules) requires a custom dev-client build (`npx expo run:ios`/`--device`) — Expo Go only contains Expo's own officially pre-published packages, nothing local or third-party, regardless of which pattern was used to author it.
- **Simulator has no camera hardware** — expect a permission prompt to fire successfully, then a black view; that's success, not failure, for anything camera-related tested only in Simulator. Real footage needs a physical device, which itself needs at least one USB cable connection to Xcode the very first time (a hard Apple requirement, not an Expo/RN limitation) before wireless deployment becomes possible.
- **Android manifest missing `xmlns:android`** — the module's scaffolded `AndroidManifest.xml` had a bare `<manifest>` root tag with no namespace declaration. Adding `<uses-permission android:name="...">` under it fails the Gradle manifest merger with an opaque XML parse error, not a permission-specific message — always confirm the root `<manifest>` tag has `xmlns:android="http://schemas.android.com/apk/res/android"` before adding any `android:`-prefixed attribute to a from-scratch manifest file.
- **`findViewTreeLifecycleOwner` is not transitively included by CameraX** — using it (needed to bind the camera to the view's lifecycle) requires explicitly adding `androidx.lifecycle:lifecycle-runtime-ktx` as its own dependency; without it, compilation fails with `Unresolved reference`, which reads like a code mistake but is actually just a missing Gradle dependency.
