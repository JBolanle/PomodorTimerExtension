# Focus Mode (Site Blocker) Implementation

## Overview

Block distracting websites during work sessions:
- **Method**: Redirect to custom blocked page
- **Blocklist**: Predefined categories + custom URLs
- **Active**: During work sessions only
- **Blocked page**: Shows timer + motivational message + escape hatch

---

## Permissions Required

### Chrome Manifest

```json
{
  "permissions": [
    "alarms",
    "notifications",
    "storage",
    "offscreen",
    "declarativeNetRequest",
    "declarativeNetRequestFeedback"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "declarative_net_request": {
    "rule_resources": [{
      "id": "focus_mode_rules",
      "enabled": false,
      "path": "rules/focus_rules.json"
    }]
  }
}
```

### Firefox Manifest

Firefox uses `webRequest` instead of `declarativeNetRequest`:

```json
{
  "permissions": [
    "alarms",
    "notifications",
    "storage",
    "webRequest",
    "webRequestBlocking",
    "<all_urls>"
  ]
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Service Worker                      │
│  ┌───────────────┐    ┌──────────────────────────┐  │
│  │ Timer State   │───▶│ Focus Mode Controller    │  │
│  │ (work/break)  │    │ - Enable/disable rules   │  │
│  └───────────────┘    │ - Manage blocklist       │  │
│                       │ - Handle "allow once"    │  │
│                       └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────┐
│           declarativeNetRequest API                  │
│  - Redirects blocked URLs to blocked.html           │
│  - Rules dynamically enabled during work            │
└─────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────┐
│               blocked.html                           │
│  - Shows remaining time                              │
│  - Motivational message                              │
│  - "Go Back" button                                  │
│  - "Allow once (5 min)" escape hatch                │
└─────────────────────────────────────────────────────┘
```

---

## 1. Predefined Blocklists

```typescript
// data/blocklists.ts

export interface BlocklistCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  domains: string[];
  enabled: boolean; // default state
}

export const PREDEFINED_BLOCKLISTS: BlocklistCategory[] = [
  {
    id: 'social',
    name: 'Social Media',
    emoji: '📱',
    description: 'Facebook, Twitter, Instagram, TikTok, etc.',
    domains: [
      'facebook.com',
      'www.facebook.com',
      'twitter.com',
      'www.twitter.com',
      'x.com',
      'www.x.com',
      'instagram.com',
      'www.instagram.com',
      'tiktok.com',
      'www.tiktok.com',
      'snapchat.com',
      'www.snapchat.com',
      'linkedin.com',
      'www.linkedin.com',
      'reddit.com',
      'www.reddit.com',
      'old.reddit.com',
      'threads.net',
      'www.threads.net',
      'mastodon.social',
      'bsky.app',
    ],
    enabled: true,
  },
  {
    id: 'video',
    name: 'Video & Streaming',
    emoji: '📺',
    description: 'YouTube, Netflix, Twitch, etc.',
    domains: [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'netflix.com',
      'www.netflix.com',
      'twitch.tv',
      'www.twitch.tv',
      'hulu.com',
      'www.hulu.com',
      'disneyplus.com',
      'www.disneyplus.com',
      'primevideo.com',
      'www.primevideo.com',
      'hbomax.com',
      'www.hbomax.com',
      'max.com',
      'www.max.com',
    ],
    enabled: true,
  },
  {
    id: 'news',
    name: 'News & Media',
    emoji: '📰',
    description: 'News sites and aggregators',
    domains: [
      'news.google.com',
      'news.ycombinator.com',
      'cnn.com',
      'www.cnn.com',
      'foxnews.com',
      'www.foxnews.com',
      'bbc.com',
      'www.bbc.com',
      'nytimes.com',
      'www.nytimes.com',
      'theguardian.com',
      'www.theguardian.com',
      'huffpost.com',
      'www.huffpost.com',
      'buzzfeed.com',
      'www.buzzfeed.com',
    ],
    enabled: false,
  },
  {
    id: 'shopping',
    name: 'Shopping',
    emoji: '🛒',
    description: 'Amazon, eBay, etc.',
    domains: [
      'amazon.com',
      'www.amazon.com',
      'ebay.com',
      'www.ebay.com',
      'etsy.com',
      'www.etsy.com',
      'aliexpress.com',
      'www.aliexpress.com',
      'wish.com',
      'www.wish.com',
    ],
    enabled: false,
  },
  {
    id: 'gaming',
    name: 'Gaming',
    emoji: '🎮',
    description: 'Gaming platforms and communities',
    domains: [
      'store.steampowered.com',
      'steamcommunity.com',
      'discord.com',
      'www.discord.com',
      'epicgames.com',
      'www.epicgames.com',
      'itch.io',
    ],
    enabled: false,
  },
];

// Storage schema
export interface FocusModeSettings {
  enabled: boolean;                    // Master toggle
  categories: Record<string, boolean>; // Category ID -> enabled
  customDomains: string[];             // User-added domains
  allowOnceMinutes: number;            // Duration for "allow once" (default: 5)
}

export const DEFAULT_FOCUS_MODE_SETTINGS: FocusModeSettings = {
  enabled: true,
  categories: {
    social: true,
    video: true,
    news: false,
    shopping: false,
    gaming: false,
  },
  customDomains: [],
  allowOnceMinutes: 5,
};
```

---

## 2. Dynamic Rule Generation

Chrome's `declarativeNetRequest` requires rules in a specific format.

```typescript
// utils/focusModeRules.ts

import { PREDEFINED_BLOCKLISTS, FocusModeSettings } from '../data/blocklists';

interface DNRRule {
  id: number;
  priority: number;
  action: {
    type: 'redirect';
    redirect: {
      extensionPath: string;
    };
  };
  condition: {
    urlFilter: string;
    resourceTypes: string[];
  };
}

export function generateBlockRules(settings: FocusModeSettings): DNRRule[] {
  const rules: DNRRule[] = [];
  let ruleId = 1;

  // Get all blocked domains
  const blockedDomains: string[] = [];

  // Add domains from enabled categories
  for (const category of PREDEFINED_BLOCKLISTS) {
    if (settings.categories[category.id]) {
      blockedDomains.push(...category.domains);
    }
  }

  // Add custom domains
  blockedDomains.push(...settings.customDomains);

  // Create a rule for each domain
  for (const domain of blockedDomains) {
    rules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: `/blocked/blocked.html?url=${encodeURIComponent(domain)}`,
        },
      },
      condition: {
        urlFilter: `||${domain}`,
        resourceTypes: ['main_frame'],
      },
    });
  }

  return rules;
}

// For temporary "allow once" exceptions
export function generateAllowRule(domain: string, ruleId: number): DNRRule {
  return {
    id: ruleId,
    priority: 2, // Higher priority than block rules
    action: {
      type: 'allow' as any,
    },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ['main_frame'],
    },
  };
}
```

---

## 3. Service Worker - Focus Mode Controller

```javascript
// background/focus-mode.js (or add to service-worker.js)

const FOCUS_MODE_RULESET_ID = 'focus_mode_rules';
const ALLOW_ONCE_BASE_ID = 100000; // Rule IDs for temporary allows

// Track temporary allows
let temporaryAllows = new Map(); // domain -> { ruleId, expiresAt }

// Initialize focus mode
async function initFocusMode() {
  const { focusModeSettings } = await chrome.storage.local.get('focusModeSettings');
  
  if (!focusModeSettings) {
    await chrome.storage.local.set({ 
      focusModeSettings: DEFAULT_FOCUS_MODE_SETTINGS 
    });
  }
}

// Enable focus mode (call when work session starts)
async function enableFocusMode() {
  const { focusModeSettings } = await chrome.storage.local.get('focusModeSettings');
  
  if (!focusModeSettings?.enabled) {
    console.log('Focus mode is disabled in settings');
    return;
  }

  const rules = generateBlockRules(focusModeSettings);
  
  try {
    // Remove existing rules first
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: rules,
    });
    
    console.log(`Focus mode enabled with ${rules.length} block rules`);
  } catch (error) {
    console.error('Failed to enable focus mode:', error);
  }
}

// Disable focus mode (call when work session ends/pauses)
async function disableFocusMode() {
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: [],
    });
    
    // Clear temporary allows
    temporaryAllows.clear();
    
    console.log('Focus mode disabled');
  } catch (error) {
    console.error('Failed to disable focus mode:', error);
  }
}

// Allow a domain temporarily (escape hatch)
async function allowOnce(domain, minutes = 5) {
  const ruleId = ALLOW_ONCE_BASE_ID + temporaryAllows.size;
  const expiresAt = Date.now() + (minutes * 60 * 1000);
  
  // Track the allow
  temporaryAllows.set(domain, { ruleId, expiresAt });
  
  // Remove the block rule for this domain temporarily
  // We do this by adding a higher-priority allow rule
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const blockRuleForDomain = existingRules.find(r => 
      r.condition.urlFilter?.includes(domain)
    );
    
    if (blockRuleForDomain) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [blockRuleForDomain.id],
      });
    }
    
    // Set alarm to re-block
    chrome.alarms.create(`focus-reblock-${domain}`, {
      delayInMinutes: minutes,
    });
    
    console.log(`Allowed ${domain} for ${minutes} minutes`);
    return { success: true };
  } catch (error) {
    console.error('Failed to allow domain:', error);
    return { success: false, error: error.message };
  }
}

// Handle reblock alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('focus-reblock-')) {
    const domain = alarm.name.replace('focus-reblock-', '');
    
    // Check if still in work session
    if (timerState.state === 'running' && timerState.currentPhase === 'work') {
      // Re-enable blocking for this domain
      const { focusModeSettings } = await chrome.storage.local.get('focusModeSettings');
      
      // Find if domain should be blocked
      const shouldBlock = isDomainBlocked(domain, focusModeSettings);
      
      if (shouldBlock) {
        const rule = {
          id: temporaryAllows.get(domain)?.ruleId || ALLOW_ONCE_BASE_ID + 999,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              extensionPath: `/blocked/blocked.html?url=${encodeURIComponent(domain)}`,
            },
          },
          condition: {
            urlFilter: `||${domain}`,
            resourceTypes: ['main_frame'],
          },
        };
        
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: [rule],
        });
      }
    }
    
    temporaryAllows.delete(domain);
  }
});

// Helper: check if domain is in blocklist
function isDomainBlocked(domain, settings) {
  // Check custom domains
  if (settings.customDomains.includes(domain)) {
    return true;
  }
  
  // Check predefined categories
  for (const category of PREDEFINED_BLOCKLISTS) {
    if (settings.categories[category.id] && category.domains.includes(domain)) {
      return true;
    }
  }
  
  return false;
}

// Message handlers
const focusModeHandlers = {
  getFocusModeSettings: async () => {
    const { focusModeSettings } = await chrome.storage.local.get('focusModeSettings');
    return focusModeSettings || DEFAULT_FOCUS_MODE_SETTINGS;
  },
  
  updateFocusModeSettings: async (msg) => {
    const { focusModeSettings: current } = await chrome.storage.local.get('focusModeSettings');
    const updated = { ...current, ...msg.settings };
    await chrome.storage.local.set({ focusModeSettings: updated });
    
    // If currently in work session, update rules
    if (timerState.state === 'running' && timerState.currentPhase === 'work') {
      await enableFocusMode();
    }
    
    return { success: true };
  },
  
  allowOnce: async (msg) => {
    return await allowOnce(msg.domain, msg.minutes);
  },
  
  getFocusModeStatus: async () => {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    return {
      active: rules.length > 0,
      blockedCount: rules.length,
      temporaryAllows: Array.from(temporaryAllows.keys()),
    };
  },
};

// Add to main message handler
Object.assign(messageHandlers, focusModeHandlers);
```

---

## 4. Integrate with Timer

```javascript
// In service-worker.js - update timer functions

async function doStartTimer(phase, minutes) {
  // ... existing code ...
  
  // Enable focus mode for work sessions
  if (phase === 'work') {
    await enableFocusMode();
  }
  
  // ... rest of existing code ...
}

async function doPause() {
  // ... existing code ...
  
  // Optionally disable focus mode on pause
  // (Or keep it enabled - user preference?)
  // await disableFocusMode();
  
  // ... rest of existing code ...
}

async function doResume() {
  // ... existing code ...
  
  // Re-enable focus mode
  if (timerState.currentPhase === 'work') {
    await enableFocusMode();
  }
  
  // ... rest of existing code ...
}

async function handleTimerComplete() {
  // ... existing code ...
  
  // Disable focus mode when work ends
  if (timerState.currentPhase === 'work') {
    await disableFocusMode();
  }
  
  // ... rest of existing code ...
}

async function doSkip() {
  // ... existing code ...
  
  // Disable focus mode when skipping work
  if (timerState.currentPhase === 'work') {
    await disableFocusMode();
  }
  
  // ... rest of existing code ...
}

async function doEndActivity() {
  // ... existing code ...
  
  // Always disable focus mode
  await disableFocusMode();
  
  // ... rest of existing code ...
}
```

---

## 5. Blocked Page

Create `blocked/blocked.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site Blocked - Focus Mode</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      text-align: center;
      max-width: 500px;
    }

    .icon {
      font-size: 80px;
      margin-bottom: 24px;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 12px;
      color: #e74c3c;
    }

    .blocked-url {
      font-size: 0.9rem;
      color: #888;
      margin-bottom: 24px;
      word-break: break-all;
    }

    .timer-section {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .timer-label {
      font-size: 0.9rem;
      color: #aaa;
      margin-bottom: 8px;
    }

    .timer-display {
      font-size: 3rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #e74c3c;
    }

    .quote {
      font-style: italic;
      color: #aaa;
      margin-bottom: 32px;
      line-height: 1.6;
    }

    .quote-author {
      display: block;
      margin-top: 8px;
      font-style: normal;
      font-size: 0.85rem;
      color: #666;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .btn {
      padding: 14px 28px;
      font-size: 1rem;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #e74c3c;
      color: white;
    }

    .btn-primary:hover {
      background: #c0392b;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #aaa;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }

    .escape-hatch {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .escape-text {
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 12px;
    }

    .btn-escape {
      background: transparent;
      border: 1px solid #444;
      color: #666;
      font-size: 0.85rem;
      padding: 10px 20px;
    }

    .btn-escape:hover {
      border-color: #666;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🎯</div>
    
    <h1>Stay Focused!</h1>
    
    <p class="blocked-url" id="blocked-url"></p>
    
    <div class="timer-section">
      <p class="timer-label">Time remaining in this session</p>
      <div class="timer-display" id="timer-display">--:--</div>
    </div>

    <p class="quote" id="quote"></p>

    <div class="actions">
      <button class="btn btn-primary" id="btn-back">
        ← Take Me Back
      </button>
    </div>

    <div class="escape-hatch">
      <p class="escape-text">Really need to access this site?</p>
      <button class="btn btn-escape" id="btn-allow">
        Allow for 5 minutes
      </button>
    </div>
  </div>

  <script src="blocked.js"></script>
</body>
</html>
```

---

## 6. Blocked Page JavaScript

Create `blocked/blocked.js`:

```javascript
// Blocked page script

const MOTIVATIONAL_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Productivity is never an accident. It is always the result of commitment to excellence.", author: "Paul J. Meyer" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
  { text: "You don't have to see the whole staircase, just take the first step.", author: "Martin Luther King Jr." },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
];

let timerInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Get blocked URL from query param
  const params = new URLSearchParams(window.location.search);
  const blockedUrl = params.get('url') || 'this site';
  
  document.getElementById('blocked-url').textContent = 
    `${blockedUrl} is blocked during focus time`;

  // Show random quote
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  document.getElementById('quote').innerHTML = 
    `"${quote.text}"<span class="quote-author">— ${quote.author}</span>`;

  // Get timer state and start countdown
  await updateTimer();
  timerInterval = setInterval(updateTimer, 1000);

  // Set up buttons
  document.getElementById('btn-back').addEventListener('click', goBack);
  document.getElementById('btn-allow').addEventListener('click', () => allowOnce(blockedUrl));
});

async function updateTimer() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getState' });
    
    if (response && response.isRunning && response.endTime) {
      const remaining = Math.max(0, response.endTime - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      
      document.getElementById('timer-display').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      // If timer ended, redirect away
      if (remaining <= 0) {
        goBack();
      }
    } else {
      // Not in a work session anymore
      document.getElementById('timer-display').textContent = 'Session ended';
      clearInterval(timerInterval);
      
      // Auto-redirect after 2 seconds
      setTimeout(goBack, 2000);
    }
  } catch (error) {
    console.error('Failed to get timer state:', error);
  }
}

function goBack() {
  // Try to go back in history, or close tab
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
}

async function allowOnce(domain) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'allowOnce',
      domain: domain,
      minutes: 5,
    });

    if (response.success) {
      // Redirect to the originally blocked site
      window.location.href = `https://${domain}`;
    } else {
      alert('Failed to allow site. Please try again.');
    }
  } catch (error) {
    console.error('Failed to allow once:', error);
    alert('Failed to allow site. Please try again.');
  }
}
```

---

## 7. Settings UI - Focus Mode Section

```tsx
// components/FocusModeSettings.tsx
import { useState, useEffect } from 'react';
import { Shield, Plus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PREDEFINED_BLOCKLISTS, FocusModeSettings } from '../data/blocklists';

export function FocusModeSettingsPanel() {
  const [settings, setSettings] = useState<FocusModeSettings | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [status, setStatus] = useState<{ active: boolean; blockedCount: number } | null>(null);

  useEffect(() => {
    loadSettings();
    loadStatus();
  }, []);

  async function loadSettings() {
    const response = await chrome.runtime.sendMessage({ action: 'getFocusModeSettings' });
    setSettings(response);
  }

  async function loadStatus() {
    const response = await chrome.runtime.sendMessage({ action: 'getFocusModeStatus' });
    setStatus(response);
  }

  async function updateSettings(updates: Partial<FocusModeSettings>) {
    const newSettings = { ...settings, ...updates };
    await chrome.runtime.sendMessage({
      action: 'updateFocusModeSettings',
      settings: newSettings,
    });
    setSettings(newSettings as FocusModeSettings);
  }

  function toggleCategory(categoryId: string) {
    if (!settings) return;
    const newCategories = {
      ...settings.categories,
      [categoryId]: !settings.categories[categoryId],
    };
    updateSettings({ categories: newCategories });
  }

  function addCustomDomain() {
    if (!settings || !newDomain.trim()) return;
    
    // Normalize domain
    let domain = newDomain.trim().toLowerCase();
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    domain = domain.split('/')[0];
    
    if (!domain || settings.customDomains.includes(domain)) {
      setNewDomain('');
      return;
    }
    
    updateSettings({
      customDomains: [...settings.customDomains, domain],
    });
    setNewDomain('');
  }

  function removeCustomDomain(domain: string) {
    if (!settings) return;
    updateSettings({
      customDomains: settings.customDomains.filter(d => d !== domain),
    });
  }

  if (!settings) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Focus Mode</h3>
        </div>
        {status?.active && (
          <span className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full">
            Active ({status.blockedCount} sites blocked)
          </span>
        )}
      </div>

      {/* Master toggle */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div>
          <p className="font-medium">Enable Focus Mode</p>
          <p className="text-sm text-muted-foreground">
            Block distracting sites during work sessions
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => updateSettings({ enabled: checked })}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Predefined categories */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Block Categories
            </h4>
            {PREDEFINED_BLOCKLISTS.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 bg-muted/20 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{category.emoji}</span>
                  <div>
                    <p className="font-medium text-sm">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.categories[category.id] ?? false}
                  onCheckedChange={() => toggleCategory(category.id)}
                />
              </div>
            ))}
          </div>

          {/* Custom domains */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Custom Blocked Sites
            </h4>
            
            {/* Add new domain */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomDomain()}
                placeholder="example.com"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
              <Button onClick={addCustomDomain} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Custom domain list */}
            {settings.customDomains.length > 0 ? (
              <div className="space-y-2">
                {settings.customDomains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between p-2 bg-muted/20 rounded-lg"
                  >
                    <span className="text-sm">{domain}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCustomDomain(domain)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No custom sites added
              </p>
            )}
          </div>

          {/* Allow once duration */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              "Allow Once" Duration
            </h4>
            <select
              value={settings.allowOnceMinutes}
              onChange={(e) => updateSettings({ allowOnceMinutes: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            >
              <option value={1}>1 minute</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 8. Popup - Focus Mode Indicator

Show when focus mode is active:

```tsx
// components/FocusModeIndicator.tsx
import { Shield, ShieldOff } from 'lucide-react';

interface FocusModeIndicatorProps {
  active: boolean;
  blockedCount: number;
}

export function FocusModeIndicator({ active, blockedCount }: FocusModeIndicatorProps) {
  if (!active) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
      <Shield className="w-3.5 h-3.5 text-green-500" />
      <span className="text-xs text-green-500 font-medium">
        Focus Mode Active
      </span>
    </div>
  );
}
```

Add to popup during work sessions:

```tsx
// In Popup.tsx

const [focusStatus, setFocusStatus] = useState(null);

useEffect(() => {
  if (state === 'running' && currentPhase === 'work') {
    loadFocusStatus();
  }
}, [state, currentPhase]);

async function loadFocusStatus() {
  const response = await chrome.runtime.sendMessage({ action: 'getFocusModeStatus' });
  setFocusStatus(response);
}

// In JSX
{state === 'running' && currentPhase === 'work' && focusStatus?.active && (
  <FocusModeIndicator active={true} blockedCount={focusStatus.blockedCount} />
)}
```

---

## Firefox Compatibility

Firefox doesn't support `declarativeNetRequest` the same way. Use `webRequest` API instead:

```javascript
// background/focus-mode-firefox.js

// Firefox uses webRequest to intercept and redirect

let focusModeActive = false;
let blockedDomains = [];

function enableFocusModeFirefox(domains) {
  blockedDomains = domains;
  focusModeActive = true;
  
  browser.webRequest.onBeforeRequest.addListener(
    handleRequest,
    { urls: ["<all_urls>"], types: ["main_frame"] },
    ["blocking"]
  );
}

function disableFocusModeFirefox() {
  focusModeActive = false;
  blockedDomains = [];
  
  browser.webRequest.onBeforeRequest.removeListener(handleRequest);
}

function handleRequest(details) {
  if (!focusModeActive) return {};
  
  const url = new URL(details.url);
  const domain = url.hostname.replace('www.', '');
  
  if (blockedDomains.some(d => domain === d || domain.endsWith('.' + d))) {
    return {
      redirectUrl: browser.runtime.getURL(
        `/blocked/blocked.html?url=${encodeURIComponent(domain)}`
      )
    };
  }
  
  return {};
}
```

---

## Summary

### Files to Create

| File | Purpose |
|------|---------|
| `data/blocklists.ts` | Predefined blocklists + types |
| `utils/focusModeRules.ts` | Generate DNR rules |
| `background/focus-mode.js` | Controller logic |
| `blocked/blocked.html` | Blocked page UI |
| `blocked/blocked.js` | Blocked page logic |
| `components/FocusModeSettings.tsx` | Settings UI |
| `components/FocusModeIndicator.tsx` | Popup indicator |

### Manifest Additions

- `declarativeNetRequest` permission (Chrome)
- `webRequest`, `webRequestBlocking` (Firefox)
- `host_permissions: ["<all_urls>"]`

---

## Prompt for Claude Code

```
Implement Focus Mode (site blocker) following FOCUS_MODE_IMPLEMENTATION.md.

Key features:
1. Block distracting sites during work sessions only
2. Predefined categories (Social, Video, News, Shopping, Gaming)
3. Custom domain list
4. Redirect to blocked.html showing timer + escape hatch
5. "Allow once" for 5 minutes

Manifest needs:
- declarativeNetRequest permission (Chrome)
- host_permissions: ["<all_urls>"]

Create:
- data/blocklists.ts with predefined lists
- blocked/blocked.html + blocked.js
- FocusModeSettings component
- Focus mode controller in service worker

Integrate with timer: enable on work start, disable on end/pause.
```

---

## Testing Checklist

1. ☐ Focus mode enables when work session starts
2. ☐ Blocked sites redirect to blocked.html
3. ☐ Timer displays correctly on blocked page
4. ☐ "Go Back" button works
5. ☐ "Allow once" grants temporary access
6. ☐ Site re-blocks after allow period expires
7. ☐ Focus mode disables on break/completion
8. ☐ Category toggles work in settings
9. ☐ Custom domains can be added/removed
10. ☐ Focus mode indicator shows in popup
11. ☐ Works when master toggle is off (no blocking)
12. ☐ Firefox fallback works
