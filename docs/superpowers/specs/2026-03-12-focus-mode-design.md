# Focus Mode (Site Blocker) Design Spec

## Overview

Block distracting websites during work sessions. Sites are redirected to a theme-aware blocked page showing the remaining timer, a motivational quote, a "Go Back" button, and a temporary "Allow once" escape hatch.

**Scope:** Active during work sessions only (including while paused). Settings UI is advanced-mode-only. Supports both Chrome (`declarativeNetRequest`) and Firefox (`webRequest`).

## Decisions

- **Pause behavior:** Focus mode stays active while paused (user is still "in" a work session)
- **Settings visibility:** Advanced mode only (behind mode toggle, like auto-start and badge settings)
- **Blocked page theming:** Theme-aware — reads user's theme from storage and applies matching CSS variables
- **Browser support:** Chrome and Firefox from the start

## Data Model

### Blocklist Categories

```typescript
// src/data/blocklists.ts

export interface BlocklistCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  domains: string[];
  enabled: boolean; // default state
}
```

Five predefined categories:
- **Social Media** (enabled by default): facebook.com, twitter.com, x.com, instagram.com, tiktok.com, snapchat.com, linkedin.com, reddit.com, threads.net, mastodon.social, bsky.app
- **Video & Streaming** (enabled by default): youtube.com, netflix.com, twitch.tv, hulu.com, disneyplus.com, primevideo.com, max.com
- **News & Media** (disabled by default): news.google.com, news.ycombinator.com, cnn.com, bbc.com, nytimes.com, theguardian.com
- **Shopping** (disabled by default): amazon.com, ebay.com, etsy.com, aliexpress.com
- **Gaming** (disabled by default): store.steampowered.com, steamcommunity.com, discord.com, epicgames.com, itch.io

Each category includes `www.` variants and common subdomains.

### Focus Mode Settings (stored in `chrome.storage.local`)

```typescript
export interface FocusModeSettings {
  enabled: boolean;                    // Master toggle (default: true)
  categories: Record<string, boolean>; // Category ID -> enabled
  customDomains: string[];             // User-added domains
  allowOnceMinutes: number;            // Duration for "allow once" (default: 5)
}
```

## Architecture

### Service Worker Integration

Focus mode controller functions are added directly to `service-worker.js` since they need access to `timerState` and the existing message handler pattern.

**Key functions:**
- `enableFocusMode()` — reads settings, builds domain list, applies blocking rules
- `disableFocusMode()` — removes all blocking rules, clears temporary allows
- `allowOnce(domain, minutes)` — temporarily unblocks a domain using alarm-based expiration
- `isDomainBlocked(domain, settings)` — checks if a domain is in the active blocklist
- `generateBlockedDomains(settings)` — collects all domains from enabled categories + custom domains

**Timer integration points:**
- `doStartTimer(phase, minutes)` — call `enableFocusMode()` if `phase === 'work'`
- `doResume()` — call `enableFocusMode()` if `currentPhase === 'work'` (re-applies rules in case SW restarted)
- `handleTimerComplete()` — call `disableFocusMode()` if `currentPhase === 'work'`
- `doSkip()` — call `disableFocusMode()` if `currentPhase === 'work'`
- `doEndActivity()` — always call `disableFocusMode()`

**Note:** `doPause()` does NOT disable focus mode (sites stay blocked while paused).

**New message handlers:**
- `getFocusModeSettings` — returns current settings
- `updateFocusModeSettings` — merges updates, re-applies rules if currently in work session
- `allowOnce` — temporarily allows a domain
- `getFocusModeStatus` — returns `{ active, blockedCount, temporaryAllows }`

### Chrome Backend: declarativeNetRequest

Uses dynamic rules (not static rule resources) for flexibility.

```
enableFocusMode():
  1. Read focusModeSettings from storage
  2. If not enabled, return early
  3. Build domain list from enabled categories + custom domains
  4. Generate redirect rules: each domain -> blocked.html?url=<domain>
  5. Remove existing dynamic rules, add new ones via updateDynamicRules()

allowOnce(domain):
  1. Remove the block rule for the domain
  2. Create alarm `focus-reblock-<domain>` with delay
  3. On alarm: if still in work session, re-add the block rule

disableFocusMode():
  1. Get all dynamic rules, remove them all
  2. Clear temporary allows map
```

Rule structure:
- Block rules: priority 1, action `redirect` to `blocked/blocked.html?url=<domain>`, condition `urlFilter: ||<domain>`, resourceTypes `['main_frame']`
- Rule IDs start at 1, assigned sequentially

### Firefox Backend: webRequest

Firefox doesn't support `declarativeNetRequest`. Uses `webRequest.onBeforeRequest` with blocking.

```
enableFocusModeFirefox():
  1. Build blocked domains list
  2. Set focusModeActive = true
  3. Add webRequest.onBeforeRequest listener with blocking redirect

handleRequest(details):
  1. Parse URL hostname, strip www.
  2. Check against blocked domains (exact match or subdomain)
  3. If blocked, return { redirectUrl: browser.runtime.getURL('blocked/blocked.html?url=...') }

disableFocusModeFirefox():
  1. Set focusModeActive = false, clear domains list
  2. Remove webRequest listener
```

### Browser Detection

```javascript
const IS_FIREFOX = typeof browser !== 'undefined' && !chrome.declarativeNetRequest;
```

The `enableFocusMode()` and `disableFocusMode()` functions dispatch to the appropriate backend based on this check.

### Manifest Changes

**Chrome (manifest.json):**
```json
{
  "permissions": [...existing, "declarativeNetRequest"],
  "host_permissions": ["<all_urls>"]
}
```

**Firefox (vite plugin transform):**
The existing vite `copy-manifest` plugin is extended to:
- Remove `declarativeNetRequest` from permissions
- Add `webRequest` and `webRequestBlocking` to permissions
- Add `<all_urls>` to permissions (Firefox uses flat permissions, not host_permissions)

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
- Shows blocked domain name
- Polls `getState` every 1 second for countdown display
- When timer ends or session changes to non-work: auto-redirects back (after 2s delay)
- "Go Back" button: `history.back()` or `window.close()`
- "Allow once" button: sends `allowOnce` message, then redirects to `https://<domain>`

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

### Popup Indicator

A small `FocusModeIndicator` component shown in the popup during active work sessions when focus mode is active. Displays "Focus Mode Active" with a shield icon in a green pill badge.

Positioned above the timer controls in `popup/App.tsx`. Only shown when `timerState === 'running' || timerState === 'paused'` AND `currentPhase === 'work'` AND focus mode status reports active.

## Vite Build Integration

The blocked page files (`public/blocked/`) are in the `public/` directory, so Vite copies them as-is to the output. No additional rollup input entries needed.

## New Files Summary

| File | Purpose |
|------|---------|
| `src/data/blocklists.ts` | Predefined categories, types, defaults |
| `public/blocked/blocked.html` | Blocked page HTML |
| `public/blocked/blocked.js` | Blocked page logic |
| `public/blocked/blocked.css` | Blocked page styles (theme-aware) |
| `src/components/settings/FocusModeSettings.tsx` | Settings panel |

## Modified Files Summary

| File | Changes |
|------|---------|
| `manifest.json` | Add `declarativeNetRequest` permission, `host_permissions` |
| `public/background/service-worker.js` | Add focus mode controller, integrate with timer functions, add message handlers |
| `vite.config.ts` | Extend Firefox manifest transform for webRequest permissions |
| `src/options/pages/SettingsPage.tsx` | Add FocusModeSettings section (advanced only) |
| `src/popup/App.tsx` | Add FocusModeIndicator during work sessions |
