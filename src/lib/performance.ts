// Captured at module-evaluation time — as early as we can hook into JS
// execution within our own code (Expo Router's actual entry point,
// expo-router/entry, runs slightly before this, so this doesn't capture
// true native-process-launch-to-JS-start time on its own — that's what
// getNativeStartTime() is for).
//
// Uses Date.now() (epoch ms), not performance.now() (a monotonic clock
// relative to some internal origin) — deliberately, so this value shares
// the same time base as the native timestamps (Date().timeIntervalSince1970
// on iOS, System.currentTimeMillis() on Android) and can be directly
// subtracted against them. Mixing the two clock types would produce a
// meaningless number.
export const jsStartTime = Date.now();

export function reportStartupMetric(name: string, durationMs: number) {
  // Stand-in for real telemetry — Sentry access is currently blocked
  // (see notes/2026-07-13-sentry-blocked.md). Once unblocked, swap this
  // console.log for something like:
  //   Sentry.setMeasurement(name, durationMs, "millisecond")
  console.log(`[startup] ${name}: ${durationMs.toFixed(1)}ms`);
}
