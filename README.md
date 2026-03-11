# Pomodoro Timer Extension

Chrome/Firefox browser extension for a Pomodoro timer, built with Manifest V3. The UI is built with React + Vite + Tailwind CSS + shadcn/ui components.

## Development

```bash
bun install          # install dependencies
bun run dev          # vite dev server (HMR for popup/options pages)
bun run build        # production build → dist/
```

Load the extension in the browser from the `dist/` directory:

- **Chrome**: `chrome://extensions` → Enable Developer Mode → Load unpacked → select `dist/`
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `dist/manifest.json`

## Features

- Configurable work, short break, and long break durations
- Session tracking with history and stats
- Three themes: Arctic (light), Obsidian (dark), Ember (warm)
- Desktop notifications on timer completion
- Timer persists when popup is closed (runs in background service worker)
