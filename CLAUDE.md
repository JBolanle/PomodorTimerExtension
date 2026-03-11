# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome/Firefox browser extension for a Pomodoro timer, built with Manifest V3. Pure vanilla JS — no build step, no bundler, no framework.

## Development

No build or install step. Load directly in the browser:

- **Chrome**: `chrome://extensions` → Enable Developer Mode → Load unpacked → select project root
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`

No test framework is configured yet.

## Architecture

The extension uses Chrome's Manifest V3 architecture with two execution contexts that communicate via `chrome.runtime.sendMessage`:

- **Background service worker** (`background/service-worker.js`): Runs independently of the popup. Manages timer state using `chrome.alarms` API (survives popup close). Persists state (`endTime`, `running`, `completedSessions`) in `chrome.storage.local`. Sends `chrome.notifications` on timer completion.

- **Popup** (`popup/`): Ephemeral UI that opens/closes on toolbar icon click. Polls background for state via messaging every 500ms while open. Has no persistent state of its own — all state comes from the background service worker.

Key design constraint: The popup can be destroyed at any time (user closes it), so all timer logic and state must live in the service worker. The popup is purely a view layer.

## Conventions

- All Chrome extension APIs used: `chrome.alarms`, `chrome.storage.local`, `chrome.notifications`, `chrome.runtime.sendMessage/onMessage`
- Timer defaults: 25min work, 5min short break, 15min long break, 4 sessions before long break (defined as `DEFAULTS` in service worker)
- CSS uses dark theme with accent color `#e94560`
