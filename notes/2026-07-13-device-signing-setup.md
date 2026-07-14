# Physical iOS Device Setup — Resolved

**Status: done.** Physical device ("Hazo's iPhone") connects and runs successfully. Kept for reference — the Developer Mode discovery-order gotcha and the provisioning-profile GUI-signing fix are both genuinely reusable knowledge, not just session scratch notes.

## Resolution

The Xcode GUI signing fix (Steps 1–9 below) worked. One more thing hit after that, worth recording: building via Xcode's GUI directly (instead of `npx expo run:ios --device`) skips the automatic Metro-bundler-start step that the Expo CLI normally does — resulted in a "No script URL provided... unsanitizedScriptUrlString = null" error on first launch. Fixed by starting Metro separately (`npx expo start --dev-client`) with the device on the same WiFi network, then relaunching the app. Also hit iOS's **Local Network permission** prompt ("Allow rn-internals to find devices on local networks") — expected and required, since the dev-client app discovers the Metro server via Bonjour/mDNS; this is dev-only, a real production build wouldn't trigger it. And the standard **"Untrusted Developer"** block on first launch — resolved via Settings → General → VPN & Device Management → trust the developer certificate.

Now that the provisioning profile exists locally, future runs should work via the normal one-command flow (`npx expo run:ios --device`) without needing the Xcode GUI workaround again.

## Why

Getting a real iPhone connected for Week 11's Security topic (Keychain, biometric auth gate) — Simulator's Keychain/biometric behavior isn't backed by the same real secure hardware a physical device has, so some of that topic benefits from testing on real hardware rather than Simulator (unlike most of Weeks 9–10, which ran fine entirely on Simulator).

## What's already done

1. Connected iPhone ("Hazo's iPhone") to the Mac via USB cable.
2. First `npx expo run:ios --device` attempt failed — device wasn't in Developer Mode yet. This is expected: the **Developer Mode toggle in Settings → Privacy & Security is hidden until you've already attempted an install** — you can't pre-enable it, the failed attempt itself is what surfaces the toggle.
3. Enabled Developer Mode: Settings → Privacy & Security → Developer Mode → toggled on → phone restarted → confirmed enabling it on the lock-screen prompt after restart.
4. Second `npx expo run:ios --device` attempt got past Developer Mode but failed differently:
   ```
   ❌  No profiles for 'com.spacehaz.rninternals' were found: Xcode couldn't find any iOS
   App Development provisioning profiles matching 'com.spacehaz.rninternals'. Automatic
   signing is disabled and unable to generate a profile. To enable automatic signing,
   pass -allowProvisioningUpdates to xcodebuild.
   ```
   This is misleading — `-allowProvisioningUpdates` (and `-allowProvisioningDeviceRegistration`) were **already** being passed by Expo's build tooling (visible in the full `xcodebuild` invocation logged earlier). The real cause: headless `xcodebuild` auto-signing frequently can't complete first-time interactive Apple ID authentication / device registration for a fresh **Personal Team** (free Apple ID — `spacehaz@gmail.com`, team ID `JZMZ7BQ8S9`, no paid Apple Developer Program membership). This needs an actual interactive Xcode GUI session the first time.
5. Hit an unrelated but urgent problem mid-session: **disk was almost completely full** (92% capacity, ~1.1GB free out of 228GB) — bad enough that even simple file writes and running `df -h` itself failed with `ENOSPC`. Gave cleanup commands (Xcode DerivedData, stale Simulator devices, CocoaPods cache, npm cache, Xcode Archives) — **check whether these were actually run and whether disk space is healthy again before resuming**, since a near-full disk can cause mysterious build failures independent of the signing issue below.

## Next step — where to resume

Fix the signing/provisioning through Xcode's GUI directly (this is the step we were on, not yet attempted):

1. Open `ios/rninternals.xcworkspace` in Xcode (the `.xcworkspace`, not `.xcodeproj` — required since this project uses CocoaPods).
2. Project Navigator: `Cmd+1` (or click the first icon in the left sidebar's top icon row if the sidebar isn't showing at all — `Cmd+0` toggles it open).
3. Click the blue `rninternals` project icon at the top of the file tree (not any individual file) — opens the project/target settings editor in the main pane.
4. Under **TARGETS** (left column of that settings editor), select **rninternals**.
5. Click the **Signing & Capabilities** tab along the top of that pane.
6. Confirm **"Automatically manage signing"** is checked.
7. Confirm the **Team** dropdown shows the Personal Team tied to `spacehaz@gmail.com`. If the dropdown is empty: Xcode → Settings (`Cmd+,`) → **Accounts** tab → confirm that Apple ID is signed in there, add it if not.
8. With the iPhone connected and selected as the run destination (device picker next to the scheme selector, top toolbar), click **Run** (▶) directly in Xcode. This is the step that hasn't been tried yet — the GUI-driven build should handle the interactive registration/profile-generation the CLI invocation couldn't.
9. Once that succeeds once via Xcode, the provisioning profile exists locally — `npx expo run:ios --device` from the terminal should then work directly, no more GUI needed for subsequent builds.

## After the device connects successfully

Resume the actual Week 11 topic: **Security — Keychain (iOS) / Keystore (Android), secure token storage, SSL pinning, biometric auth gate.** This ties directly back to two things already built: the MMKV-encryption-key-needs-secure-storage point flagged during the MMKV work, and Week 9's `BiometricAuthModule` (previously just a local UI gate — this topic is where the "real" biometric-gated secure storage pattern gets built on top of it).
