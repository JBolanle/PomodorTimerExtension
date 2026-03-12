# Focus Mode (Site Blocker) Design Spec

## Overview

Block distracting websites during work sessions. Sites are redirected to a theme-aware blocked page showing the remaining timer, a motivational quote, a "Go Back" button, and a temporary "Allow once" escape hatch.

**Scope:** Active during work sessions only (including while paused). Settings UI is advanced-mode-only. Both Chrome and Firefox use `declarativeNetRequest`.

## Decisions

- **Pause behavior:** Focus mode stays active while paused (user is still "in" a work session)
- **Settings visibility:** Advanced mode only (behind mode toggle, like auto-start and badge settings)
- **Blocked page theming:** Theme-aware — reads user's theme from storage and applies matching CSS variables
- **Browser support:** Both Chrome and Firefox use `declarativeNetRequest`. Firefox minimum version bumped to 128.0
- **No separate webRequest backend** — Firefox 128+ supports `declarativeNetRequest`, eliminating the need for a second implementation

## Data Model

### Blocklist Categories

```typescript
// src/data/blocklists.ts

export interface BlocklistCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  domains: string[];  // Base domains only (no www. prefix needed — urlFilter ||domain covers subdomains)
  enabled: boolean;   // Default state
}
```

Five predefined categories:
- **Social Media** (enabled by default): facebook.com, twitter.com, x.com, instagram.com, tiktok.com, snapchat.com, linkedin.com, reddit.com, threads.net, mastodon.social, bsky.app
- **Video & Streaming** (enabled by default): youtube.com, netflix.com, twitch.tv, hulu.com, disneyplus.com, primevideo.com, max.com
- **News & Media** (disabled by default): news.ycombinator.com, cnn.com, bbc.com, nytimes.com, theguardian.com
- **Shopping** (disabled by default): amazon.com, ebay.com, etsy.com, aliexpress.com
- **Gaming** (disabled by default): store.steampowered.com, steamcommunity.com, discord.com, epicgames.com, itch.io

Domain lists typically use base domains, but subdomain-specific entries are used when blocking the entire base domain would be too broad (e.g., `news.ycombinator.com` instead of `ycombinator.com`, `store.steampowered.com` instead of `steampowered.com`). The `||` prefix in `urlFilter` matches the specified domain and all its subdomains.

### Focus Mode Settings (stored in `chrome.storage.local`)

```typescript
export interface FocusModeSettings {
  enabled: boolean;                    // Master toggle (default: true)
  categories: Record<string, boolean>; // Category ID -> enabled
  customDomains: string[];             // User-added domains (normalized base domains)
  allowOnceMinutes: number;            // Duration for "allow once" (default: 5)
}
```

### Blocklist Data Sharing

The service worker (`public/background/service-worker.js`) is plain JS copied as-is by Vite — it cannot import TypeScript modules. The blocklist category data is therefore maintained in two places:

1. **`src/data/blocklists.ts`** — TypeScript source for the settings UI (categories with metadata: name, emoji, description)
2. **`service-worker.js`** — Plain JS constant `FOCUS_BLOCKLISTS` with the same domain arrays, keyed by category ID

When the user toggles categories or adds custom domains, only the `focusModeSettings` (toggle map + custom domains) is saved to `chrome.storage.local`. The service worker reads settings and looks up domains from its own hardcoded copy. The settings UI uses `blocklists.ts` for display metadata.

If category domains need to change, both files must be updated. This is acceptable since category changes are infrequent and the alternative (bundling the service worker) would be a larger architectural change.

## Architecture

### Service Worker Integration

Focus mode controller functions are added directly to `service-worker.js` since they need access to `timerState` and the existing message handler pattern.

**Key functions:**
- `enableFocusMode()` — reads settings, builds domain list, applies blocking rules
- `disableFocusMode()` — removes all blocking rules, clears temporary allows, clears `focus-reblock-*` alarms
- `allowOnce(domain, minutes)` — temporarily unblocks a domain using alarm-based expiration
- `isDomainBlocked(domain, settings)` — checks if a domain is in the active blocklist
- `generateBlockedDomains(settings)` — collects all domains from enabled categories + custom domains

**Timer integration points:**
- `doStartTimer(phase, minutes)` — call `enableFocusMode()` if `phase === 'work'`
- `doResume()` — call `enableFocusMode()` if `currentPhase === 'work'` (re-applies rules in case SW restarted)
- `handleTimerComplete()` — call `disableFocusMode()` **before** state transitions to `'transition'`, if `currentPhase === 'work'`
- `doSkip()` — call `disableFocusMode()` if `currentPhase === 'work'` (phase is still `'work'` at this point in the function)
- `doEndActivity()` — always call `disableFocusMode()`

**Note:** `doPause()` does NOT disable focus mode (sites stay blocked while paused).

**New message handlers:**
- `getFocusModeSettings` — returns current settings
- `updateFocusModeSettings` — merges updates, re-applies rules if currently in work session
- `allowOnce` — temporarily allows a domain
- `getFocusModeStatus` — returns `{ active, blockedCount, temporaryAllows }`

### Service Worker Recovery

The `initialize()` function must handle focus mode state on SW restart:
- If timer is running or paused in `work` phase: call `enableFocusMode()` (declarativeNetRequest dynamic rules persist across SW restarts, but this ensures consistency)
- If timer is idle, in transition, or in a break phase: call `disableFocusMode()` to clean up any stale rules (handles browser crash / unexpected shutdown during a work session)

### declarativeNetRequest (Both Browsers)

Uses dynamic rules (not static rule resources) for flexibility.

```
enableFocusMode():
  1. Read focusModeSettings from storage
  2. If not enabled, return early
  3. Build domain list from enabled categories + custom domains
  4. Generate redirect rules using regexFilter + regexSubstitution (see Rule Structure)
  5. Remove existing dynamic rules (in focus mode ID range), add new ones via updateDynamicRules()
  6. Store domain-to-ruleId mapping in memory (`focusRuleMap: Map<string, number>`)

allowOnce(domain):
  1. Look up rule ID from focusRuleMap
  2. Remove that specific rule via updateDynamicRules({ removeRuleIds: [id] })
  3. Track in temporaryAllows map
  4. Create alarm `focus-reblock-<domain>` with delay
  5. On alarm: if still in work session, re-add the block rule using the same ID

disableFocusMode():
  1. Get all dynamic rules in focus mode ID range, remove them
  2. Clear focusRuleMap and temporaryAllows map
  3. Clear all `focus-reblock-*` alarms
```

**Rule structure:**
- Each rule uses `regexFilter` to match the domain and `regexSubstitution` to redirect with the domain in the query string
- `regexFilter`: `^https?://([^/]*\\.)?<escaped-domain>/` (matches domain and all subdomains)
- `action.redirect.regexSubstitution`: redirect to `chrome.runtime.getURL('blocked/blocked.html')` + `?url=<domain>`
- Since `regexSubstitution` doesn't support dynamic extension URLs, use `extensionPath: '/blocked/blocked.html'` for the redirect and have `blocked.js` extract the blocked domain from `document.referrer` or by querying the service worker instead of from a query parameter
- **Simplified approach:** Use `urlFilter: ||<domain>` with `extensionPath: '/blocked/blocked.html'`. The blocked page extracts the originally-requested URL from `document.referrer` (the page that triggered the redirect). If `document.referrer` is empty, it displays a generic "site blocked" message.
- `resourceTypes: ['main_frame']`
- Rule IDs use reserved range **10000–19999** to avoid collision with future features
- IDs assigned as 10001, 10002, ... sequentially. A `focusRuleMap` (`Map<string, number>`) maps domain -> ruleId for use by `allowOnce()` and reblock

**Alarm handling:**
The existing `chrome.alarms.onAlarm` listener must be extended to handle `focus-reblock-*` alarms:
- Parse domain from alarm name (`focus-reblock-<domain>`)
- Check if still in work session (`timerState.state === 'running' || timerState.state === 'paused'`) AND `timerState.currentPhase === 'work'`
- If yes, re-add the block rule for that domain
- Remove domain from temporary allows map

### Manifest Changes

**manifest.json:**
```json
{
  "permissions": [...existing, "declarativeNetRequest"],
  "host_permissions": ["<all_urls>"],
  "web_accessible_resources": [{
    "resources": ["blocked/blocked.html", "blocked/blocked.css", "blocked/blocked.js"],
    "matches": ["<all_urls>"]
  }]
}
```

Both `declarativeNetRequest` and `host_permissions` are required together — `declarativeNetRequest` alone cannot redirect arbitrary URLs without host permissions.

`web_accessible_resources` is required so that the `declarativeNetRequest` redirect to the extension's `blocked.html` page works. Without this, the browser blocks access to the extension page from web context.

**vite.config.ts Firefox transform:**
The existing vite `copy-manifest` plugin is extended to:
- Keep `declarativeNetRequest` in permissions (Firefox 128+ supports it)
- Add `host_permissions: ["<all_urls>"]` (same as Chrome)
- Bump `strict_min_version` from `109.0` to `128.0`

## Blocked Page

### Files
- `public/blocked/blocked.html` — HTML structure
- `public/blocked/blocked.js` — Logic (timer polling, allow-once, go-back)
- `public/blocked/blocked.css` — Styles with theme support

### Theme Support
On load, `blocked.js`:
1. Reads `theme` from `chrome.storage.local`
2. Sets `data-theme` attribute on `<html>`
3. CSS uses theme-scoped variables matching the three themes (Arctic, Obsidian, Ember)

Default fallback: Obsidian (dark) if no theme is set.

### Behavior
- Extracts blocked domain from `document.referrer` (set by the redirect). If empty, shows generic "site blocked" message.
- Polls `getState` every 1 second for countdown display
- Auto-redirects when: timer ends, session changes to non-work phase, OR `state === 'idle'` (user ended session from popup). Redirect happens after 2s delay with "Session ended" message.
- "Go Back" button: `history.back()` or `window.close()`
- "Allow once" button: sends `allowOnce` message with configured duration, then redirects to the referrer URL

### Motivational Quotes
10 hardcoded quotes displayed randomly on each page load.

## Settings UI

### FocusModeSettings Component

Located at `src/components/settings/FocusModeSettings.tsx`. Rendered in `SettingsPage.tsx` inside an `{isAdvanced && ...}` guard, after the Behavior section.

**Layout:**
1. Header with Shield icon + "Focus Mode" title + active status badge
2. Master toggle: "Enable Focus Mode" with description
3. When enabled:
   - Block Categories: list of 5 predefined categories with emoji, name, description, and Switch toggle
   - Custom Blocked Sites: text input + add button, list of custom domains with delete button
   - "Allow Once" Duration: select dropdown (1, 5, 10, 15 minutes)

**Custom domain validation on add:**
- Strip protocol (`http://`, `https://`)
- Strip `www.` prefix
- Strip paths, query strings, fragments (take only hostname)
- Lowercase
- Reject empty strings and duplicates
- No further validation (any hostname-shaped string is accepted)

### Popup Indicator

A small `FocusModeIndicator` component shown in the popup during active work sessions when focus mode is active. Displays "Focus Mode Active" with a shield icon in a green pill badge.

Positioned above the timer controls in `popup/App.tsx`. Only shown when `timerState === 'running' || timerState === 'paused'` AND `currentPhase === 'work'` AND focus mode status reports active.

## Vite Build Integration

The blocked page files (`public/blocked/`) are in the `public/` directory, so Vite copies them as-is to the output. No additional rollup input entries needed.

## New Files Summary

| File | Purpose |
|------|---------|
| `src/data/blocklists.ts` | Predefined categories (with UI metadata), types, defaults |
| `public/blocked/blocked.html` | Blocked page HTML |
| `public/blocked/blocked.js` | Blocked page logic |
| `public/blocked/blocked.css` | Blocked page styles (theme-aware) |
| `src/components/settings/FocusModeSettings.tsx` | Settings panel |

## Modified Files Summary

| File | Changes |
|------|---------|
| `manifest.json` | Add `declarativeNetRequest` permission, `host_permissions: ["<all_urls>"]` |
| `public/background/service-worker.js` | Add `FOCUS_BLOCKLISTS` constant, focus mode controller functions, alarm handler for `focus-reblock-*`, integrate with timer functions, add message handlers, add recovery logic in `initialize()` |
| `vite.config.ts` | Extend Firefox manifest transform: keep declarativeNetRequest, add host_permissions, bump min version to 128.0 |
| `src/options/pages/SettingsPage.tsx` | Add FocusModeSettings section (advanced only) |
| `src/popup/App.tsx` | Add FocusModeIndicator during work sessions |
