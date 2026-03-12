# Cross-Browser Compatibility Guide

## Current State Assessment

Your project **already works cross-browser** for most features. Here's what's in place:

| Component | Chrome | Firefox | Status |
|-----------|--------|---------|--------|
| **Manifest** | `dist/manifest.json` | `dist-firefox/manifest.json` | ✅ Correct |
| **Background** | `service_worker` | `scripts[]` | ✅ Works |
| **APIs** | `chrome.*` | `chrome.*` (Firefox compat layer) | ✅ Works |
| **Focus Mode** | `declarativeNetRequest` | Same (Firefox 128+) | ✅ Works |
| **Audio** | Offscreen Document | **Silently fails** | ❌ **Broken** |
| **Notifications** | Full features | Basic (no buttons) | ⚠️ Degraded |

### What's Already Working

1. **Same service worker code** — Firefox supports the `chrome.*` namespace for compatibility
2. **Focus mode** — Both use `declarativeNetRequest` (Firefox 128+ required)
3. **Timer, alarms, storage, badge** — All work identically
4. **Two separate dist folders** — Clean separation for store uploads

### What Needs Fixing

**Audio is broken on Firefox.** The current code at line ~1036:

```javascript
if (!chrome.offscreen) {
  // Firefox fallback — no offscreen API
  return;  // ← Silently returns, no sound plays!
}
```

---

## Fix: Firefox Audio Playback

Firefox doesn't support the Offscreen Document API, but it **can** play audio directly in the background script (unlike Chrome MV3). Here's the targeted fix:

### Option A: Inline Fix (Minimal Change)

Update `playNotificationSound()` in `service-worker.js`:

```javascript
async function playNotificationSound(phase) {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    const soundEnabled = settings?.soundEnabled ?? true;
    if (!soundEnabled) return;

    const volume = settings?.soundVolume ?? 1.0;
    const soundPath = getSoundForPhase(phase, settings);

    // Chrome: Use Offscreen Document API
    if (chrome.offscreen) {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        action: 'playSound',
        sound: soundPath,
        volume,
      });
      return;
    }

    // Firefox: Direct Audio playback works in background scripts
    const audio = new Audio(chrome.runtime.getURL(soundPath));
    audio.volume = volume;
    await audio.play();
  } catch (err) {
    console.error('[Pomodoro] Sound playback failed:', err);
  }
}
```

### Option B: Separate Audio Module (Cleaner)

Create `background/audio.js`:

```javascript
// background/audio.js

const isChrome = !!chrome.offscreen;
let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  if (!isChrome) return;
  
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl],
  });
  
  if (existingContexts.length > 0) return;
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play notification sound when timer completes',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

export async function playSound(soundPath, volume = 1.0) {
  if (isChrome) {
    // Chrome: Offscreen Document required for MV3
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({
      action: 'playSound',
      sound: soundPath,
      volume,
    });
  } else {
    // Firefox: Direct Audio works in background
    const audio = new Audio(chrome.runtime.getURL(soundPath));
    audio.volume = volume;
    await audio.play();
  }
}
```

Then in service-worker.js:
```javascript
import { playSound } from './audio.js';

async function playNotificationSound(phase) {
  const { settings } = await chrome.storage.local.get('settings');
  if (!(settings?.soundEnabled ?? true)) return;

  const volume = settings?.soundVolume ?? 1.0;
  const soundPath = getSoundForPhase(phase, settings);
  
  try {
    await playSound(soundPath, volume);
  } catch (err) {
    console.error('[Pomodoro] Sound playback failed:', err);
  }
}
```

---

## Manifest Differences Explained

### Chrome (`dist/manifest.json`)

```json
{
  "permissions": ["alarms", "notifications", "offscreen", "storage", "declarativeNetRequest"],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "commands": {
    "_execute_action": { ... }
  }
}
```

### Firefox (`dist-firefox/manifest.json`)

```json
{
  "permissions": ["alarms", "notifications", "storage", "declarativeNetRequest"],
  "background": {
    "scripts": ["background/service-worker.js"]
  },
  "commands": {
    "_execute_browser_action": { ... }
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "pomodoro-timer@example.com",
      "strict_min_version": "128.0"
    }
  }
}
```

**Key differences:**
| Field | Chrome | Firefox |
|-------|--------|---------|
| `offscreen` permission | ✅ Required | ❌ Not supported |
| Background | `service_worker` | `scripts[]` |
| Popup command | `_execute_action` | `_execute_browser_action` |
| Gecko settings | N/A | Required for AMO |

---

## Build Process

Your current setup with separate `dist/` and `dist-firefox/` folders is correct. When building:

1. **Chrome build** → `dist/`
2. **Firefox build** → `dist-firefox/`
3. Zip each folder separately for store submission

If you want to automate this with Vite, add to `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import fs from 'fs';

const browser = process.env.BROWSER || 'chrome';

export default defineConfig({
  build: {
    outDir: browser === 'firefox' ? 'dist-firefox' : 'dist',
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        const manifest = browser === 'firefox' 
          ? 'manifest.firefox.json' 
          : 'manifest.chrome.json';
        // Copy appropriate manifest
      }
    }
  ]
});
```

**Package.json scripts:**
```json
{
  "scripts": {
    "build": "npm run build:chrome && npm run build:firefox",
    "build:chrome": "BROWSER=chrome vite build",
    "build:firefox": "BROWSER=firefox vite build",
    "zip:chrome": "cd dist && zip -r ../pomodoro-chrome.zip .",
    "zip:firefox": "cd dist-firefox && zip -r ../pomodoro-firefox.zip ."
  }
}
```

---

## Testing Checklist

### Chrome
1. ☐ Load unpacked from `dist/`
2. ☐ Timer starts/pauses/completes
3. ☐ Sound plays on completion ✅
4. ☐ Focus mode blocks sites
5. ☐ Notifications appear with actions
6. ☐ Keyboard shortcuts work
7. ☐ State persists after browser restart

### Firefox (128+)
1. ☐ Load temporary add-on from `dist-firefox/`
2. ☐ Timer starts/pauses/completes
3. ☐ Sound plays on completion ← **Currently broken!**
4. ☐ Focus mode blocks sites
5. ☐ Notifications appear (basic, no buttons)
6. ☐ Keyboard shortcuts work
7. ☐ State persists after browser restart

---

## Summary

| What | Status | Action Needed |
|------|--------|---------------|
| Architecture | ✅ Simple & correct | None |
| Manifests | ✅ Properly separated | None |
| Focus Mode | ✅ Unified (DNR) | None |
| Audio | ❌ Firefox broken | Add Firefox fallback |
| Notifications | ⚠️ Degraded | Accept limitation |

**The only code change needed is fixing Firefox audio playback.** Everything else is already working correctly.

---

## Claude Code Prompt

```
Fix Firefox audio playback in the Pomodoro extension.

Current issue: In service-worker.js, playNotificationSound() silently returns 
when chrome.offscreen is undefined (Firefox). Sound doesn't play.

Fix: Add Firefox fallback using direct Audio() API, which works in Firefox
background scripts but not Chrome MV3 service workers.

Location: Around line 1036 in dist/background/service-worker.js and 
dist-firefox/background/service-worker.js

The fix should:
1. Keep existing Offscreen Document logic for Chrome
2. Add else branch for Firefox using: new Audio(chrome.runtime.getURL(soundPath))
3. Handle errors gracefully
```
