# Crash page

When the app fails to start, or a render throws, the page shows `Algo correu mal no Treino.` and `Os teus dados continuam neste navegador.` instead of a blank page, with `Exportar dados` and `Recarregar`. `Exportar dados` reads the stores straight from localStorage, without the app's state, and downloads the same `treino-YYYY-MM-DD.json` Backup as the normal export.

## Sub-features

- `crash-start` shows the crash page when starting fails: the sync start or loading the app's code (`main.tsx`).
- `crash-render` shows it when any component throws while rendering (`RootErrorBoundary`).
- `crash-export` downloads the Backup from localStorage; a store left out is named in an inline `alert`.
- `crash-reload` reloads the page.

## How to get to it (user POV)

- Only when something breaks. There is no way to open it on purpose.

## Driving it with session.mjs

Preconditions: a fresh `openApp`, or a server seeded with `e2e/fixtures/treino-backup.json`'s stores. Faults are injected through Playwright routes, never a hook in the app.

- **Failed start.** `openApp` has already loaded the app, so add `page.route('**/src/App.tsx*', (r) => r.abort())`, then `page.reload()` and wait for the heading `Algo correu mal no Treino.`.
- **Render throws.** `page.route('**/src/ui/SyncLine.tsx*', (r) => r.fulfill({ contentType: 'text/javascript', body: "export function SyncLine() { throw new Error('x') }" }))` and reload: the same heading shows.
- **Export.** `app.download(page.getByRole('button', { name: 'Exportar dados' }))`: `treino-<today>.json`, and its `stores` equal what the server held. `e2e/crash.mjs` drives all of this, but not the skipped store.
- **Skipped store.** `putStore(page, APP_URL, 'equipment', { version: 999 })`, then the failed start and `Exportar dados`: `getByRole('alert')` reads `Não foi possível exportar: material.`, and the file has no `equipment`.

## Gotchas

- Both faults log console errors (the aborted request, the thrown error); drop them before `close()`.
- Unroute before `Recarregar`, or the page crashes again.
- **Paths you didn't drive:** a path not driven is reported as not verified. A different path to the same feature is no substitute.
