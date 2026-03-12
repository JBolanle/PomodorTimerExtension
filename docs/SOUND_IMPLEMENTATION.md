# Sound Implementation Instructions for Claude Code

## Files Provided
- `notification.mp3` - 8KB MP3 notification chime
- `notification.ogg` - 8KB OGG fallback (better Firefox support)

## Implementation Steps

### 1. Add Sound Files to Project

Copy `notification.mp3` to `src/assets/sounds/` (or wherever your build copies static assets).

Make sure it gets included in the `dist/assets/` or `dist/sounds/` folder after build.

### 2. Update Chrome Manifest (manifest.json)

Add the "offscreen" permission:

```json
{
  "permissions": [
    "alarms",
    "notifications",
    "storage",
    "offscreen"
  ]
}
```

### 3. Create Offscreen Document (Chrome MV3)

Create `src/offscreen/offscreen.html`:

```html
<!DOCTYPE html>
<html>
<head><title>Offscreen Audio</title></head>
<body>
  <audio id="audio"></audio>
  <script src="offscreen.js"></script>
</body>
</html>
```

Create `src/offscreen/offscreen.js`:

```javascript
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'playSound') {
    const audio = document.getElementById('audio');
    audio.src = chrome.runtime.getURL(message.sound);
    audio.volume = message.volume ?? 1.0;
    audio.play().catch(console.error);
  }
});
```

### 4. Add Sound Playback to Service Worker

In `background/service-worker.js`, add these functions:

```javascript
// --- Audio Playback (Chrome MV3 Offscreen) ---

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen/offscreen.html');
  
  // Check if already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  
  if (existingContexts.length > 0) return;
  
  // Avoid race conditions
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  
  creatingOffscreen = chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play notification sound when timer completes'
  });
  
  await creatingOffscreen;
  creatingOffscreen = null;
}

async function playNotificationSound() {
  const { settings } = await chrome.storage.local.get('settings');
  const soundEnabled = settings?.soundEnabled ?? true;
  const volume = settings?.soundVolume ?? 1.0;
  
  if (!soundEnabled) return;
  
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({
      action: 'playSound',
      sound: 'assets/sounds/notification.mp3', // adjust path as needed
      volume: volume
    });
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
}
```

### 5. Call playNotificationSound() on Timer Complete

In `handleTimerComplete()`, after the notification:

```javascript
async function handleTimerComplete() {
  // ... existing code ...
  
  // Notify
  const { settings } = await chrome.storage.local.get('settings');
  const notificationsEnabled = settings?.notificationsEnabled ?? true;
  if (notificationsEnabled) {
    await sendNotification(getCompletionMessage());
  }
  
  // Play sound
  await playNotificationSound();
  
  // ... rest of existing code ...
}
```

Also call it in `doSkip()` if you want sound on skip.

### 6. Add Settings UI (Options Page)

Add toggles to the options page:
- `soundEnabled` (boolean, default: true)
- `soundVolume` (number 0-1, default: 1.0)

### 7. Firefox Compatibility

Firefox doesn't support `chrome.offscreen` yet. Add a fallback:

```javascript
async function playNotificationSound() {
  const { settings } = await chrome.storage.local.get('settings');
  const soundEnabled = settings?.soundEnabled ?? true;
  
  if (!soundEnabled) return;
  
  // Check if offscreen API is available (Chrome)
  if (chrome.offscreen) {
    // Chrome path - use offscreen document
    try {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        action: 'playSound',
        sound: 'assets/sounds/notification.mp3',
        volume: settings?.soundVolume ?? 1.0
      });
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  } else {
    // Firefox fallback - inject into active tab or skip
    // The system notification sound will play with the notification
    console.log('Offscreen API not available, relying on system notification sound');
  }
}
```

### 8. Build Configuration

Make sure your Vite/build config copies:
- `offscreen/offscreen.html` and `offscreen/offscreen.js` to dist
- `assets/sounds/notification.mp3` to dist

In `vite.config.js`, you may need:

```javascript
{
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        options: 'src/options/index.html',
        offscreen: 'src/offscreen/offscreen.html',
        // ...
      }
    }
  }
}
```

## Testing

1. Load the extension
2. Start a short timer (set work to 1 minute for testing)
3. Let it complete
4. You should hear the chime + see the notification

## Sound Characteristics

- Frequency: 880Hz (A5) with bell-like harmonics
- Duration: 1 second with exponential decay
- Format: MP3, mono, ~8KB
- Style: Pleasant chime, not jarring
