# Creating a Custom TurboModule — Step by Step

**Note: this doc covers the raw React Native TurboModule pattern** (codegen spec + `RCT_EXTERN_REMAP_MODULE`/`RCT_EXTERN_METHOD` on iOS, a real Kotlin abstract base class on Android) — the same mechanism you'd use in a bare, non-Expo RN project. It's what actually generated the Obj-C++/bridging-header pain documented in Step 8 below.

Expo also ships its **own** abstraction over this — the [Expo Modules API](https://docs.expo.dev/modules/module-api/) — with a declarative `Function()`/`AsyncFunction()` DSL inside a `Module` subclass, scaffolded via `npx create-expo-module@latest --local`. It sidesteps the raw pattern's Obj-C++/`ReactCodegen`-module friction entirely (no bridging header, no manual Xcode target-membership step — autolinking handles it), at the cost of not seeing the underlying codegen/interop mechanics directly. We used the Expo path for the Week 10 native-view-component project instead of the raw `RCTViewManager` pattern, precisely to avoid repeating the same landmine once the underlying mechanism was already understood from this doc.

**Use the raw pattern (this doc) when the goal is understanding RN internals. Use Expo's Modules API when the goal is just shipping a working module with less friction** — both produce a real native module/component, this is a "how much of the machinery do you want to see" choice, not a correctness one.

## 1. Generate native projects (if not already present)

```
npx expo prebuild
```

Creates `android/` and `ios/` folders from your Expo config. Skip if they already exist.

## 2. Write the TypeScript Spec file

Create `specs/Native<ModuleName>.ts` — the `Native` prefix is required by codegen convention.

```ts
// specs/NativeCustomDeviceInfo.ts
import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  getModel(): string; // synchronous — plain return type
  getSystemVersion(): string; // synchronous
  getBatteryLevel(): Promise<number>; // async — wrap in Promise
}

export default TurboModuleRegistry.getEnforcing<Spec>("CustomDeviceInfo");
```

Rules:

- Use real method syntax (`getModel(): string`), never arrow-property syntax (`getModel: () => string`) — codegen fails to parse the latter.
- Pick a unique registered name and Spec filename — colliding with an existing module name (including RN's own built-in modules, e.g. `'DeviceInfo'`) causes a C++ symbol redefinition error at native build time.
- Avoid naming a method `getName` — every native module already has a framework-required `getName()` (returns the module's registration name), unrelated to your own method.

## 3. Configure codegen in package.json

```json
"codegenConfig": {
  "name": "RnInternalsSpecs",
  "type": "modules",
  "jsSrcsDir": "specs",
  "android": {
    "javaPackageName": "com.yourapp.package.specs"
  }
}
```

## 4. Run codegen to generate native interfaces

Android:

```
cd android && ./gradlew generateCodegenArtifactsFromSchema
```

Generates a Java abstract class: `android/app/build/generated/source/codegen/java/.../Native<ModuleName>Spec.java`

iOS:

```
cd ios && pod install
```

Generates an Objective-C++ protocol: `ios/build/generated/ios/ReactCodegen/<CodegenName>/<CodegenName>.h`

Always inspect the generated file before writing your implementation — it tells you the exact method signatures, and whether a method is sync (`isBlockingSynchronousMethod = true` / plain ObjC return) or async (`Promise` param / `resolve:reject:` blocks). **On iOS, also check the top of the generated header for a `#ifndef __cplusplus / #error` guard — see the iOS section below for why this matters.**

## 5. Write the Android (Kotlin) implementation

`android/app/src/main/java/com/yourapp/package/<ModuleName>Module.kt`:

```kotlin
package com.yourapp.package

import android.content.Context
import android.os.BatteryManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.yourapp.package.specs.NativeCustomDeviceInfoSpec

class DeviceInfoModule(reactContext: ReactApplicationContext) :
    NativeCustomDeviceInfoSpec(reactContext) {

    override fun getModel(): String = Build.MODEL

    override fun getSystemVersion(): String = Build.VERSION.RELEASE

    override fun getBatteryLevel(promise: Promise) {
        val batteryManager =
            reactApplicationContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        promise.resolve(level)
    }
}
```

Note the `:` with parentheses — `NativeCustomDeviceInfoSpec(reactContext)` means extending a real class (calling its constructor), not implementing an interface. Kotlin codegen generates an actual abstract base class, not just a protocol — this is a real architectural difference from iOS (see Step 8).

## 6. Write the Android ReactPackage

`android/app/src/main/java/com/yourapp/package/<ModuleName>Package.kt`:

```kotlin
package com.yourapp.package

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.yourapp.package.specs.NativeCustomDeviceInfoSpec

class DeviceInfoPackage : TurboReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == NativeCustomDeviceInfoSpec.NAME) {
            DeviceInfoModule(reactContext)
        } else {
            null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
            mapOf(
                NativeCustomDeviceInfoSpec.NAME to ReactModuleInfo(
                    NativeCustomDeviceInfoSpec.NAME,
                    NativeCustomDeviceInfoSpec.NAME,
                    false, // canOverrideExistingModule
                    false, // needsEagerInit — false = lazy loading
                    false, // isCxxModule
                    true   // isTurboModule
                )
            )
        }
    }
}
```

## 7. Register the package in MainApplication.kt

Find the `PackageList(this).packages.apply { }` block and add:

```kotlin
packageList =
    PackageList(this).packages.apply {
        add(DeviceInfoPackage())
    }
```

## 8. Write the iOS (Swift) implementation

**Correction (learned the hard way building this project's `DeviceInfoModule` and `BiometricAuthModule`): do not conform directly to the generated `Native<ModuleName>Spec` protocol from Swift, and do not import the generated codegen header into your bridging header.** The rest of this section explains why, then gives the pattern that actually works.

### Why direct protocol conformance breaks

The naive approach — mirroring what Android does with its abstract base class — looks like this:

```swift
import UIKit

@objc(DeviceInfoModule)
class DeviceInfoModule: NSObject, NativeCustomDeviceInfoSpec {   // ❌ breaks the build
    ...
}
```

This requires Swift to see the `NativeCustomDeviceInfoSpec` protocol, which means importing the generated header (e.g. `RnInternalsSpecs.h`) somewhere Swift can reach it — typically the bridging header. Two things go wrong:

1. **The generated header is Obj-C++-only.** It starts with a hard compiler guard:

   ```c
   #ifndef __cplusplus
   #error This file must be compiled as Obj-C++. If you are importing it, you must change your file extension to .mm.
   #endif
   ```

   Swift's bridging header is compiled through a PCH build step that doesn't give you real Obj-C++ semantics the way a `.mm` source file does.

2. **It's not a standalone header — it's one file inside a shared `ReactCodegen` Clang module** that also bundles the Fabric component codegen for every other codegen'd library in your app (Reanimated, Screens, SafeAreaContext, etc.). Importing it via a modular `#import <X/X.h>` forces Clang to build the _entire_ `ReactCodegen` module, dragging in unrelated Fabric C++ headers. In practice this surfaced as:
   ```
   ❌ 'memory' file not found  (in React-Fabric/.../BaseViewEventEmitter.h)
   ❌ could not build module 'ReactCodegen'
   ```
   — a failure with nothing to do with the module you're actually writing.

This is an iOS/Swift-specific problem. Android's codegen output is a real Kotlin/Java abstract class in the same language your module is written in, so there's no cross-language header-import boundary to cross — Step 5/6 above just work as written.

### The pattern that actually works

Swift class: plain `NSObject`, **no protocol conformance**, `@objc` methods only.

`ios/<AppName>/<ModuleName>Module.swift`:

```swift
import UIKit

@objc(DeviceInfoModule)
class DeviceInfoModule: NSObject {

    @objc
    func getModel() -> String {
        return UIDevice.current.model
    }

    @objc
    func getSystemVersion() -> String {
        return UIDevice.current.systemVersion
    }

    @objc
    func getBatteryLevel(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let level = UIDevice.current.batteryLevel
        resolve(level * 100)
    }
}
```

Bridging header (`ios/<AppName>/<AppName>-Bridging-Header.h`) — only needs the plain ObjC types used in method signatures (`RCTPromiseResolveBlock`/`RCTPromiseRejectBlock`), never the generated Spec header:

```c
#import <React/RCTBridgeModule.h>
```

Companion Objective-C bridge file — this **is** required for Swift modules, unlike what we originally assumed. Note it's a **`.m` file, not a `.h` file** — no header is needed for this pattern; the `@interface ... @end` block below just happens to _look_ like a header declaration even though it lives in a `.m`.

Create it via Xcode's **File → New → File → Objective-C File** (not externally) so target membership gets set at creation time — same reasoning as the Swift file. Name it `ios/<AppName>/<ModuleName>Module.m`, same folder as the Swift implementation. If Xcode asks about configuring a bridging header, decline — one already exists from Step 8's Swift file.

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_REMAP_MODULE(CustomDeviceInfo, DeviceInfoModule, NSObject)

RCT_EXTERN_METHOD(getModel)
RCT_EXTERN_METHOD(getSystemVersion)
RCT_EXTERN_METHOD(getBatteryLevel:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
```

### How `RCT_EXTERN_REMAP_MODULE` actually works

`RCT_EXTERN_REMAP_MODULE(jsName, className, superclass)` takes three arguments — `jsName` is the string JS-side `TurboModuleRegistry.getEnforcing('...')` looks up, `className` must match the Swift class's `@objc(...)` name **exactly**, `superclass` is normally `NSObject`. (The plain two-argument `RCT_EXTERN_MODULE(className, superclass)` exists too, for when the JS-facing name and the class name are identical — we need the REMAP variant here because e.g. `'CustomDeviceInfo'` (JS) differs from `DeviceInfoModule` (Swift class).)

Under the hood, this macro expands to an Objective-C category declaration containing a `+(void)load` class method. `+load` is special: the Objective-C runtime calls it automatically on every loaded class, at binary load time, before `main()` even runs — nobody explicitly invokes it. Inside, it calls `RCTRegisterModule(self)`, which stashes the class into a global dictionary keyed by `jsName`. This is exactly how a module becomes discoverable by string name later — the registration happens the instant the binary loads, driven entirely by this macro, not by anything you write in `application(_:didFinishLaunchingWithOptions:)` or similar.

**If `className` doesn't match `@objc(...)` exactly:** most likely a compile error ("cannot find interface declaration for 'X'"), since the macro references that class name directly and no class exists under it. In the unlucky case where the typo happens to collide with some other real class in your codebase, you'd get a silent wrong registration instead — `TurboModuleRegistry.getEnforcing(jsName)` would resolve to the wrong native object, and any method call on it crashes at runtime with "unrecognized selector sent to instance."

### How `RCT_EXTERN_METHOD` actually works

Each `RCT_EXTERN_METHOD` call registers metadata for **one** method — its Objective-C selector and argument types — so React Native's runtime knows the method exists and how to invoke it, without needing any Swift/C++ compile-time type information. It must be declared once per method you want JS to reach; `RCT_EXTERN_REMAP_MODULE` alone only registers the class↔name mapping, nothing about individual methods.

The declaration's shape must exactly mirror the real Objective-C selector your Swift method compiles down to. Swift's `func getBatteryLevel(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock)` compiles to the selector `getBatteryLevel:reject:` — the leading `_` drops the external label on the first parameter (folding it into the base method name instead of a separate labeled segment), while `reject:` keeps its label as the second colon-separated segment. Each colon-separated fragment in the macro call corresponds to one parameter, in order, and has to line up exactly with what Swift actually generates.

### The full runtime call path

Putting both macros together, here's what happens when JS calls e.g. `NativeCustomDeviceInfo.getBatteryLevel()`:

1. JS's `TurboModuleRegistry.getEnforcing('CustomDeviceInfo')` looks for a module registered under that name.
2. Since our Swift class doesn't conform to the codegen'd C++ Spec protocol (see above), no direct JSI trampoline exists — React Native's TurboModule manager falls back to its **legacy-interop adapter**.
3. That adapter looks up `'CustomDeviceInfo'` in the registry populated by `RCT_EXTERN_REMAP_MODULE`'s `+load`/`RCTRegisterModule` call, and finds the `DeviceInfoModule` class.
4. For the actual method call, it consults the metadata `RCT_EXTERN_METHOD` registered, builds an `NSInvocation` (Objective-C's reflection-based "package up a method call as an object" primitive) targeting selector `getBatteryLevel:reject:` on an instance of that class, and passes along the resolve/reject blocks.

Nothing in this path is checked against the generated Spec protocol at compile time — it's pure runtime selector-name matching, which is exactly why a mismatch between what `RCT_EXTERN_METHOD` declares and what Swift actually compiles to fails at **runtime** ("unrecognized selector sent to instance"), not at build time — both halves can individually look syntactically fine and still not agree with each other.

### Why this still works under the New Architecture

This is the pre-TurboModule "legacy bridge" registration mechanism (`RCTBridgeModule` + `RCT_EXTERN_METHOD`), not something deprecated by TurboModules. RN ships a **legacy-interop layer**: when a registered `RCTBridgeModule`-conforming class doesn't statically implement the codegen'd Spec protocol, the TurboModule manager falls back to resolving methods by Objective-C selector at runtime (via `NSInvocation`) instead of the compile-time-checked C++ JSI trampoline. Functionally identical to JS — you lose compile-time verification that your Swift signatures match the spec exactly, but you gain "it actually compiles" on Swift + Fabric-heavy Expo projects.

Key points:

- `@objc(ClassName)` fixes a stable, predictable Objective-C name (Swift otherwise mangles names).
- Must inherit `NSObject` to be visible to the Objective-C runtime at all.
- **Do not** conform to the generated `Native<ModuleName>Spec` protocol — see above.
- **Do** create the `.m` bridge file described above; it is required, not optional, for Swift-authored modules.
- Async method signatures come as two blocks (`resolve`, `reject`) — not one `Promise` object like Android.
- `evaluatePolicy`-style async system APIs (and similar) may invoke their completion handler on a background queue — hop back to `DispatchQueue.main.async` before calling `resolve`/`reject` if you're touching anything UI-adjacent.

## 9. Add the Swift file and the .m bridge file to the Xcode target

The two files from Step 8 — `<ModuleName>Module.swift` and `<ModuleName>Module.m` — need to be added to the Xcode target. (Android has no equivalent step: Gradle auto-picks-up any `.kt` file under `src/main/java/...`, so Steps 5–7 don't need this.)

Files created outside Xcode (terminal, external editor) are **not** automatically part of the Xcode project or its target — this is a separate step from writing the files, and skipping it produces confusing "symbol not found" runtime crashes that look unrelated to target membership.

- If you create the files via Xcode itself (**File → New → File**), the "Add to targets" checkbox is part of the same creation dialog — do this when possible, it's one less step to forget.
- If the files already exist on disk (e.g. written by an editor/agent), add them via: right-click the project's source group in the Project Navigator → **"Add Files to '<AppName>'…"** → select both files → choose **"Reference files in place"** (not copy/move, since they're already in the correct location) → check the app target's checkbox → Add.
- Verify: select the file, open the File Inspector (right-hand panel, first tab), confirm **Target Membership** has your app target checked. Right-click context menu does **not** expose Target Membership — it's inspector-only, and only appears once the file is already a project member.

## 10. Build and run

```
npm run android   # full native build + install on device/emulator
npm run ios       # full native build + install on simulator/device
```

If a simulator/device destination is stale or missing a platform runtime:

```
npx expo run:ios --device
```

opens an interactive picker of currently-available destinations.

No `pod install` is needed for pure-Swift/Kotlin changes with no new native dependency — only run it when you've added a new codegen spec file (to regenerate the Obj-C++ protocol header) or a new CocoaPods/Gradle dependency.

## 11. Use it from JS

```ts
import NativeCustomDeviceInfo from "../../specs/NativeCustomDeviceInfo";

const model = NativeCustomDeviceInfo.getModel(); // sync
const version = NativeCustomDeviceInfo.getSystemVersion(); // sync
const battery = await NativeCustomDeviceInfo.getBatteryLevel(); // async
```

---

## Common pitfalls we actually hit, worth remembering

- **Swift can't safely conform to the generated Spec protocol** (Step 8) — the generated header is Obj-C++-only and lives inside a shared `ReactCodegen` module with unrelated Fabric C++ code from other libraries. Use the `RCT_EXTERN_REMAP_MODULE` / `RCT_EXTERN_METHOD` bridge-file pattern instead; it's not a downgrade, it's the pattern that actually works with Swift on iOS's New Architecture in practice.
- **Files aren't part of the Xcode target just because they're on disk in the right folder** (Step 9) — this is a distinct manual step, and forgetting it produces a crash that looks like a symbol/linking problem, not a "you forgot a checkbox" problem.
- **Never hand-edit anything under `android/app/build/` or `ios/build/`** — those are regenerated output directories; put real source files in `android/app/src/main/java/...` and `ios/<AppName>/...`.
- **A module/Spec name colliding with an existing one** (RN core or another library) causes a native build error, not a runtime one — rename both the Spec filename and the registered string to fix.
- **Codegen requires strict method syntax** and a restricted TypeScript subset — no arrow-property methods, no exotic generics in the Spec.
- **Stale `Podfile.lock`/`Pods/` after an Expo SDK version bump** produces a dyld symbol-mismatch crash at app launch (`Symbol not found: ... Referenced from: ExpoFont.framework Expected in: ExpoModulesCore.framework`), not a build-time error — if you bump `expo` in `package.json` without running `npx expo install --fix`, the other `expo-*` packages silently stay on the old SDK version and the frameworks become ABI-incompatible. Fix: `npx expo install --fix`, then delete `ios/Pods`, `ios/Podfile.lock`, and stale `DerivedData` before `pod install`.
- **Synchronous (non-Promise) methods can only return object types on iOS — never a raw primitive.** Apple's own constraint: a sync method's return type "must be of object type (`id`)" — `nil`, `NSNumber`, `NSString`, `NSArray`, or `NSDictionary` only. A Swift method declared `-> Double` compiles to return via the ARM64 floating-point register (`d0`), but the `NSInvocation`-based interop layer reads return values from the general-purpose pointer register (`x0`), expecting an object pointer. The result is a **hard, uncatchable crash** — no JS-catchable error, no red screen, the app just terminates — because it's a genuine memory-safety violation (reading garbage from `x0` and treating it as an object pointer), not a normal thrown exception that RN's TurboModule exception-handling machinery could intercept. `getModel()`/`getSystemVersion()` never hit this because `String` bridges directly to `NSString *`, already an object type. Fix: wrap primitives explicitly — `NSNumber(value: someDouble)` — for any synchronous method returning a number. Diagnostic signature to recognize this class of bug: a hard crash with zero catchable JS error, right at the call site of a sync method whose return type differs from other already-working sync methods in the same file.
