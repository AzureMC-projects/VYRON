# VYRON

**Your web. Your rules.**

VYRON is an experimental, customisable desktop browser project focused on user control, performance-conscious defaults, and privacy features.

## Current status

Early prototype scaffold. This is not yet a production-ready secure browser.

## Planned features

- Customisable themes, accent colour, compact/comfortable density, and start page
- Tabbed browsing and keyboard shortcuts
- Built-in content blocking with filter-list support
- Privacy and site-permission controls
- Safe defaults: isolated renderer, context isolation, sandboxing, restrictive navigation and permission handling
- Lightweight UI and performance profiling

## Development

Requirements: Node.js 20+ and npm.

```bash
npm install
npm start
```

## Security notes

This project is an early-stage prototype. Do not use it for sensitive browsing or treat its security features as a substitute for a mature browser. A production browser needs a threat model, timely Chromium/Electron updates, robust URL/navigation validation, permission controls, filter-list update verification, automated tests, and independent security review.

The initial scaffold uses Electron with context isolation, sandboxing, and Node integration disabled in the renderer. Remote pages must never receive privileged IPC access. Review every change that affects navigation, permissions, downloads, certificates, or content blocking.

## Roadmap

1. Establish a working desktop shell and customisable start page.
2. Add tab management and reliable navigation controls.
3. Implement a maintainable content-blocking engine and filter updates.
4. Add security tests, CI, packaging, and update strategy.
