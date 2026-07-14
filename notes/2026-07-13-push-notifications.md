# Push Notifications (APNs/FCM via expo-notifications) — Architecture + Implementation

## The architecture, conceptually

Push notifications solve one problem: letting a backend server wake/notify an app without that app maintaining its own always-on connection. The full path:

1. App registers for remote notifications on launch → OS contacts APNs (iOS) / FCM (Android) → gets a unique, opaque **device token**.
2. App sends that token to **your own backend** — APNs/FCM know nothing about your backend; the token is the only bridge between "Apple/Google's delivery network" and "your server's idea of who this device is."
3. Backend later sends a payload + token to APNs/FCM, authenticated with server credentials (`.p8` key for APNs, service account for FCM).
4. APNs/FCM relay to the device over a persistent, low-power connection **the OS itself maintains, shared across every app** — not one connection per app. This is why push doesn't drain battery the way naive per-app polling would.
5. Delivery differs by app state:
   - **Foreground**: app is already running, gets the payload directly via a handler. iOS does **not** auto-show a banner while foregrounded unless you explicitly opt in.
   - **Background**: OS shows the banner/sound/badge automatically, may briefly wake the app afterward with a limited time budget.
   - **Terminated**: OS still shows the visible notification on its own; app code generally doesn't run until the user taps it, at which point the app cold-launches.

**Silent/background push** (`content-available: 1` on iOS) shows nothing to the user and requires **no notification permission at all** — permission only gates what's shown to the user, not whether the app can receive data. This is a deliberate split: if silent push required the same permission as visible alerts, declining alerts (a common, often privacy-motivated choice) would also break basic background sync, conflating two genuinely separate user intents ("don't interrupt me" vs. "it's fine if the app quietly stays fresh"). Apple polices misuse of silent push differently — by rate-limiting/deprioritizing apps that send it too frequently, not by gating it behind a permission prompt.

## Infrastructure prerequisites (and what we could test without them)

- **iOS**: the Push Notifications capability/entitlement requires a **paid Apple Developer Program membership** — not available on a free Apple ID.
- **Android**: needs a Firebase project for FCM credentials.
- **Sending a real push** requires something server-side calling APNs/FCM directly — Expo's own Push Notification service can proxy this for testing, but even that needs an EAS project ID.

We had **neither** set up. What that meant in practice: the token-registration round trip (`getExpoPushTokenAsync`) fails with a clear "no project ID" error — that failure is itself proof the code path is wired correctly, not a dead end. Everything else — how the app reacts to a received notification, foreground vs. background vs. terminated behavior, tap-to-deep-link — is fully testable locally via two mechanisms that never touch real APNs/FCM servers:
- `xcrun simctl push` (iOS Simulator only) — injects a raw payload directly into a running app.
- `Notifications.scheduleNotificationAsync` (local notifications) — genuinely on-device, no server involved at all, and goes through the *identical* client-side handling pipeline as a real push once delivered.

## Setup

### 1. Install + config plugin

```
npx expo install expo-notifications
```

`app.json`:
```json
"plugins": [
  ...,
  "expo-notifications"
]
```

Note: not every `expo-*` package needs a `plugins` entry — only ones that modify native project files at prebuild time (permission strings, entitlements, build settings, bundled assets). `expo-notifications` needs one because push requires the iOS Push Notifications capability + Android's default notification icon/channel config. Packages with no native-project-file requirements (e.g. `expo-device` in this project) have no plugin and aren't listed, even though they're installed.

### 2. Global handler + listeners (`src/app/_layout.tsx`)

```tsx
import { DarkTheme, DefaultTheme, router, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function navigateFromNotificationData(data: Record<string, unknown>) {
  const route = data?.route;
  if (typeof route === 'string') {
    router.push(route as any);
  }
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[notifications] received while foregrounded:', notification.request.content);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationData(response.notification.request.content.data);
    });

    // Cold start: app was fully terminated, this launch was caused by tapping
    // a notification. The listener above only catches taps while the app is
    // already running (foregrounded or backgrounded) — this is the separate
    // check needed specifically for the terminated case.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateFromNotificationData(response.notification.request.content.data);
        Notifications.clearLastNotificationResponseAsync();
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* ...rest of layout... */}
    </ThemeProvider>
  );
}
```

Key points:
- **`setNotificationHandler` is module-level**, not inside the component — it's global configuration for how the OS should treat notifications delivered while foregrounded, needs to run once regardless of render cycles.
- **Two fundamentally different listener situations**, both needed for "foreground, background, deep link on tap":
  - `addNotificationReceivedListener` — fires only while the app is already foregrounded. The user is actively in the app; there's no "tap" here since they never left. Useful for reacting programmatically (badge counts, in-app state) independent of whether a banner is shown.
  - `addNotificationResponseReceivedListener` — fires on **user interaction** (tap), regardless of foreground/background, **as long as the app was already running in memory**.
- **`getLastNotificationResponseAsync()` is a third, separate mechanism**, not a variant of the listener — it's checked once on startup to answer "was this specific app launch caused by tapping a notification," covering the case the listener structurally cannot catch: the app was fully terminated, so no JS listener existed yet at the moment of the tap.
- **`clearLastNotificationResponseAsync()` after handling** — without it, the same stored response could be read again (e.g. on a remount) and re-trigger navigation unexpectedly.
- **`route` inside `data` is a convention we invented**, not a built-in APNs/FCM/Expo field. Backend and app have to agree on this contract; the push services relay whatever `data` you send verbatim, uninterpreted.

### 3. Demo UI (`src/app/index.tsx`)

Permission request, token fetch (expected to fail without an EAS project ID — that's proof of correct wiring, not a bug), and two local-notification triggers for testing without any server infrastructure:

```tsx
import * as Notifications from "expo-notifications";

// Fires almost immediately — exercises the FOREGROUND path only, since you can
// only press this button while the app is already open.
await Notifications.scheduleNotificationAsync({
  content: { title: "...", body: "...", data: { route: "/explore" } },
  trigger: null,
});

// Fires after a delay — gives you a window to background or kill the app first,
// exercising the BACKGROUND and TERMINATED/cold-start paths without needing
// xcrun simctl push or any server at all.
await Notifications.scheduleNotificationAsync({
  content: { title: "...", body: "...", data: { route: "/explore" } },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 5,
  },
});
```

## Testing via `xcrun simctl push` (iOS Simulator, raw APNs format)

```
xcrun simctl push booted <bundle-id> payload.json
```

Payload — `aps` at the **top level** (Apple's reserved fields for alert/sound/badge), custom app-specific keys sit **alongside** `aps` at the root, not nested inside it:

```json
{
  "aps": {
    "alert": {
      "title": "New message from Alice",
      "body": "Hey, are you free?"
    },
    "sound": "default"
  },
  "route": "/explore"
}
```

**Do not confuse this with Expo's own Push API format** (`{"to": "...", "data": {...}}`) — that's the shape for sending through `exp.host/--/api/v2/push/send` (Expo's relay to real APNs/FCM), a completely different JSON contract from what `xcrun simctl push` expects. Mixing these up is an easy, silent mistake — both are plausible-looking JSON that reference "data," but only one is correct for local Simulator testing.

## Common pitfalls hit building this

- **Confusing Expo's Push API payload format with the raw APNs Simulator format** — the two look superficially similar (both involve a `data`-shaped concept) but are structurally different; verify which one applies to the specific sending mechanism being used before constructing a test payload.
- **Assuming the tap listener alone covers "deep link on tap"** — it doesn't cover a fully terminated app. `getLastNotificationResponseAsync()` on startup is a separate, required mechanism for that case, easy to miss since the listener-only version *looks* complete (works fine for foreground/background) until tested from a truly killed state.
- **Forgetting `clearLastNotificationResponseAsync()`** — without it, a stale cold-start response can be read again and re-trigger navigation on a later remount.
- **`trigger: null` local notifications can only ever test the foreground path** — by construction, since you have to be actively tapping a button in the running app. A delayed `TIME_INTERVAL` trigger is needed to test background/terminated with local notifications instead of `xcrun simctl push`.
- **Not every `expo-*` package belongs in `app.json`'s `plugins` array** — only ones needing native-project-file changes at prebuild time. Check the package's own docs page for a `"plugins": [...]` snippet; if it's not shown, skip it.
