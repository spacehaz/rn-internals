# Sentry Crash Reporting — Blocked, Resume Point

**Status: not started (blocked on account access, not code).**

## What happened

Attempted to set up Sentry via `npx @sentry/wizard@latest -i reactNative` (the correct, current setup command — handles login, project creation, DSN wiring, and native build-phase config for source map/dSYM upload automatically). Wizard needs a Sentry account, which required visiting `sentry.io` to sign up.

`sentry.io` returned **403 Forbidden** — consistently, across:
- Incognito browser window (rules out extensions)
- VPN disabled (rules out VPN-IP blocking)
- A different browser entirely
- Cellular connection instead of WiFi (rules out home-network/ISP-level blocking)

Ruled out on the Mac side: `/etc/hosts` has no sentry.io entries, and DNS resolves `sentry.io` cleanly and consistently (`35.186.247.156`) across both the local resolver and Cloudflare's `1.1.1.1` directly — so it's not a DNS-level or local-hosts-file block.

Given real browsers fail this consistently across every network path tried, this looks like either a Sentry/Cloudflare-side IP-reputation or regional block, or something account/fingerprint-level — not something fixable from local machine config, and not diagnosable further without reaching the site.

## Next step

Get a Sentry account/DSN via a different network path (different physical location, or have someone else create the project) — should take 5 minutes once reachable. Nothing about our code or setup needs to change; the wizard command is correct and ready to run:

```
npx @sentry/wizard@latest -i reactNative
```

## After that

Resume Week 11's Sentry topic — the conceptual pass (symbolication as a dual JS-source-map + native-dSYM/mapping-file problem, breadcrumbs, why crash reporting matters) is already covered in conversation; what's left is purely hands-on: install, trigger a real captured error, and specifically prove the symbolication story (build Release config, see raw minified stack trace, upload source maps, see it resolve to real source).

Then the final Week 11 item after this: **Performance monitoring — measuring real-user startup time, JS bundle parse time.**
