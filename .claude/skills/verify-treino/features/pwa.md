# Home screen app

The app can be added to the iPhone home screen. Safari reads a web app manifest, an apple-touch-icon and some head tags, so the app opens full screen with its own icon. There is no service worker, so it never launches offline. None of this changes what the page shows.

## Sub-features

- `pwa-manifest` serves `/manifest.webmanifest` with the name `Treino`, short name `Treino`, `display` `standalone`, `start_url` and `scope` `/`, and `lang` `pt-PT`.
- `pwa-icons` serves the manifest icons (192, 512, maskable 512) and `/apple-touch-icon.png` (180) as opaque PNGs of exactly those sizes.
- `pwa-head` has the web-app-capable metas, the home-screen name `Treino` in `apple-mobile-web-app-title` (the page `<title>` is `Treino` too), and one `theme-color` per colour scheme.

## How to get to it (user POV)

- Safari on the iPhone: `Partilhar`, then `Adicionar ao ecrã principal`. Headless Chromium cannot do this, so only the files and tags are verifiable here.

## Driving it with session.mjs

Preconditions: a running instance and `APP_URL`; no browser state needed.

- **Head tags.** `page.evaluate(() => document.querySelector('link[rel="manifest"]').href)` ends in `/manifest.webmanifest`, and `link[rel="apple-touch-icon"]` ends in `/apple-touch-icon.png`.
- **Manifest.** `page.request.get(manifestUrl)` answers 200, and `.json()` has the literal values listed under `pwa-manifest`.
- **Icons.** `page.request.get(iconUrl)` answers 200 with `content-type: image/png`, and the UInt32BE at bytes 16 and 20 hold the width and height (PNG IHDR).
- **Proof.** `APP_URL=$APP_URL node e2e/pwa.mjs` checks the manifest, the icons and that the head links exist (it needs `APP_URL`: on any server not started with `WORKOUT_TEST=1` it stops when the reset is refused). It does not check the link paths, the `theme-color` values or the scroll, so assert those in a session drive with `{ mobile: true }`, since the head tags must not move the layout.

## Gotchas

- Vite's dev server answers an unknown path with `index.html` and status 200, so check the content type, not only the status.
- Regenerate the PNGs with `node scripts/build-icons.mjs` after the favicon changes.
- Not verified without a device: that iOS accepts the icon, the title and the standalone launch.
