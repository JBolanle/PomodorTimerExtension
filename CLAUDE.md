# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome/Firefox browser extension for a Pomodoro timer, built with Manifest V3. The UI is built with React + Vite + Tailwind CSS + shadcn/ui components.

## Development

```bash
bun install          # install dependencies
bun run dev          # vite dev server (HMR for popup/options pages)
bun run build        # production build → dist/ (Chrome)
bun run build:firefox  # Firefox build → dist-firefox/
bun run build:all      # build both Chrome and Firefox
```

Load the extension in the browser:

- **Chrome**: `chrome://extensions` → Enable Developer Mode → Load unpacked → select `dist/`
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist-firefox/manifest.json`

The build uses a `BROWSER` env var (`chrome` default, `firefox`) to transform the manifest at build time. Firefox gets `background.scripts` instead of `background.service_worker` and `browser_specific_settings.gecko`.

No test framework is configured yet.

## Architecture

The extension uses Chrome's Manifest V3 architecture with three execution contexts:

- **Background service worker** (`public/background/service-worker.js`): Runs independently of the popup. Manages timer state using `chrome.alarms` API (survives popup close). Persists state (`endTime`, `running`, `completedSessions`) in `chrome.storage.local`. Sends `chrome.notifications` on timer completion.

- **Popup** (`src/popup/`): Ephemeral UI that opens/closes on toolbar icon click. Polls background for state via messaging every 500ms while open. Has no persistent state of its own — all state comes from the background service worker. Built with React.

- **Options page** (`src/options/`): Full settings page using React Router (HashRouter). Contains pages for timer settings, theme selection, history/stats, and about.

Key design constraint: The popup can be destroyed at any time (user closes it), so all timer logic and state must live in the service worker. The popup is purely a view layer.

### Source Structure

```
src/
  components/     # React components (timer/, settings/, history/, layout/, ui/)
  hooks/          # Custom React hooks (useTimer, useTheme, useSettings, etc.)
  lib/            # Utility functions
  styles/         # globals.css with theme variables and effects
  types/          # TypeScript type definitions
  popup/          # Popup entry point (App.tsx, main.tsx, index.html)
  options/        # Options page entry point with HashRouter
public/
  background/     # Service worker (copied as-is to dist/)
  icons/          # Extension icons
```

## Conventions

- All Chrome extension APIs used: `chrome.alarms`, `chrome.storage.local`, `chrome.notifications`, `chrome.runtime.sendMessage/onMessage`
- Timer defaults: 25min work, 5min short break, 15min long break, 4 sessions before long break (defined as `DEFAULTS` in service worker)
- Three themes: Arctic (light, default), Obsidian (dark, chrome-extruded), Ember (warm, golden) — switched via `data-theme` attribute on `<html>`
- Theme-specific CSS effects (timer text shadows, session dot glow, ember glow) are in `src/styles/globals.css`
- UI components from shadcn/ui live in `src/components/ui/`
