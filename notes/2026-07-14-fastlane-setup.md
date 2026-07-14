# Fastlane Setup (gym, iOS) — What Actually Worked

## Scope

Hands-on with `gym` (iOS build/archive/export) only — `match` and `deliver` need a paid Apple Developer Program membership we don't have, so those stayed conceptual. `gym` itself doesn't need one: it can export using the same free-tier "development" signing (automatic Personal Team) we've used successfully all session for installing on a real device.

## The real blocker: macOS's system Ruby is far too old

Current Fastlane requires **Ruby 3.3.0+**. macOS ships (and freezes) a system Ruby that was `2.6.10` on this machine — installing fails outright (`bundle install` tries to write to `/Library/Ruby/Gems/2.6.0`, needs `sudo`, and even then the gem versions Fastlane needs won't install on 2.6).

Fix: use `rbenv` (was already installed, plus a modern Homebrew Ruby 4.0.1 — neither was actually wired into the shell). Installed/activated Ruby 3.4.4 via rbenv:
```
rbenv versions   # confirmed 3.4.4 already installed and set as global
```
Then added to `~/.zshrc` (was missing entirely — rbenv had never been initialized in the shell):
```sh
eval "$(rbenv init - zsh)"
```
New terminal / `source ~/.zshrc` afterward to pick it up.

## A gotcha specific to running commands via an agent/tool (not a real terminal)

Even after fixing `.zshrc`, a tool-invoked non-interactive shell (Claude Code's Bash tool, likely also true for CI runners in some configurations) **did not** pick up `rbenv`'s shims automatically — `.zshrc` only reliably sources for genuinely interactive shells. Running `bundle install` through that path still hit the old system Ruby and failed with the same `sudo` error, even though the user's own interactive terminal had it working correctly by that point. Explicitly exporting `PATH="$HOME/.rbenv/shims:$PATH"` before the command fixes it for that one invocation, but isn't a substitute for the permanent `.zshrc` fix for normal interactive use.

## Working Fastfile (`ios/fastlane/Fastfile`)

```ruby
default_platform(:ios)

platform :ios do
  desc "Build the app locally using the free-tier Personal Team signing (development export, no paid Apple Developer account needed)"
  lane :build do
    gym(
      workspace: "rninternals.xcworkspace",
      scheme: "rninternals",
      configuration: "Debug",
      export_method: "development",
      export_options: {
        signingStyle: "automatic"
      }
    )
  end
end
```

Run with `bundle exec fastlane build`. Produces a signed `.ipa` plus a compressed `.dSYM.zip` — the same native debug-symbol bundle Sentry crash reporting needs for symbolication (see `notes/2026-07-13-sentry-blocked.md`), generated as a side effect even though Sentry itself isn't set up yet.

## If adding Android's Fastlane (`gradle` action) later

Same Ruby/rbenv setup applies (one Ruby environment, shared `Gemfile`/`bundle` across both platforms is fine) — the `platform :android do ... end` block would sit in the same `Fastfile` at the repo root or wherever `fastlane init` is run for that platform, using the `gradle` action as Android's rough equivalent to `gym`. No paid-account blocker on Android the way iOS has for `match`/`deliver` — signing a `.aab`/`.apk` locally works regardless of Google Play Developer account status.
