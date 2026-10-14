# VYRON

**Your web. Your rules.**

VYRON is a customisable desktop browser built on Electron/Chromium. The repository contains a working desktop application with tabbed browsing, configurable appearance, bookmarks, search-engine selection, downloads, privacy controls, and network request blocking.

## Features

- Tabbed browsing, back/forward/reload, URL entry and web search
- Keyboard shortcuts: Ctrl/Cmd+L (address bar), Ctrl/Cmd+T (new tab), Ctrl/Cmd+W (close tab), Ctrl/Cmd+D (bookmark)
- Bookmarks stored locally on the device
- Custom themes, accent colour, compact/comfortable layout and reduced motion
- Selectable DuckDuckGo, Google or Bing search
- Persistent browsing session and download save prompts
- EasyList/uBlock Origin-compatible advertising and tracking filters, cached locally, with a bundled domain-list fallback when the filter download is unavailable
- Site permissions denied by default
- Electron renderer sandbox, context isolation, Node integration disabled, and restrictive app-shell navigation

## Run from source

Requirements: Node.js 22.12+ and npm.

```bash
npm install
npm start
```

Check JavaScript syntax:

```bash
npm run check
```

## Build installers

Build on the target operating system (native signing/notarisation credentials are separate requirements):

```bash
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Installers are written to `release/`. Cross-platform packaging may require platform-specific build tools. Code signing and macOS notarisation are not configured.

## Privacy and security boundaries

VYRON is an independently developed browser application, not a replacement for the security engineering and update infrastructure of a major browser vendor. Chromium's engine is supplied by Electron and must be kept updated. The filter engine uses maintained ad/tracker lists and will not block every ad, cosmetic element, or tracking technique; when list downloads fail, it falls back to a smaller domain list. Site permissions are denied by default; this can break websites that rely on camera, microphone, notifications, or geolocation.

Before using this as your primary browser for sensitive accounts, it needs automated integration tests, an explicit threat model, a mature and regularly updated ad-filter engine, secure auto-updates, signed releases, dependency auditing, and independent security review. Do not disable certificate validation or grant remote pages privileged application APIs.

## Project

Repository: https://github.com/AzureMC-projects/VYRON
