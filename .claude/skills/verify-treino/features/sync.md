# Server store

The user sees nothing while it works: every change is kept in a SQLite file on the machine and shows up in any other browser that opens the app. When the server does not answer, a line fixed at the bottom of the page says `Sem ligação ao servidor. As alterações ficam neste navegador até voltar.` (role `status`). When another device changed the same store first, it says `Os dados mudaram noutro dispositivo.` with a `Recarregar` button (role `alert`).

## Sub-features

- `sync-second-device` shows a change made in one browser in a fresh browser on the same server.
- `sync-disk` keeps each store as a row of `stores (key, doc, rev, updated_at)` in `WORKOUT_DB`, with `doc` the exact JSON text of the store's localStorage key. The first change of a local day copies the previous `doc` into `snapshots (day, key, doc)`.
- `sync-offline` shows the offline line while the server is unreachable, keeps the change in localStorage, and sends it when the browser is back online. The line goes away once a change is sent, so a browser that opened with the server down keeps it until its next change or a reload.
- `sync-conflict` refuses a change made on a stale copy: the server keeps the other device's document, the conflict line appears, and `Recarregar` reloads the page on the server's copy. The losing copy stays in localStorage under `workout-tracking:<store>:unsynced:<ISO time>`.
- `sync-open` pulls every store once as the app opens, with `GET /api/stores?have=<key>:<rev>,…` naming the copies the browser already holds. A store still at that rev comes back as `{ rev }` alone, so a reopen with nothing new downloads only the stores another device changed.
- `sync-refresh` takes the server's newer health store when the tab comes back into view (`visibilitychange` or `focus`), unless this browser has an unsent change to it or a conflict on it. It fetches only that store, with `GET /api/stores/<key>`. No other store refreshes while the app is open.
- `sync-upload` uploads a store only the browser has (data from before the server) when the server lacks it, saved in the current version after the app migrates it. A browser that never synced a store and holds a different copy of it keeps its own text, unsent, under `workout-tracking:<store>:unsynced:<ISO time>` before taking the server's. A store the browser holds only as the app's untouched default (no plans, no Locais) is never uploaded; it is sent once the user changes it.

## How to get to it (user POV)

- Any change in any view, then the same app in another browser or after `Recarregar`.

## Driving it with session.mjs

Preconditions:

- `launch.sh` printed `RUN_DIR`; the database is `$RUN_DIR/workout.sqlite`. The first `openApp` empties it.

- **Second device.** `const a = await openApp({ feature: 'sync' })`, change something (for example create a Workout Plan named `Força` with `createWorkoutPlan` from `e2e/_driver.mjs`), wait with `synced(a.page)`, then `const b = await openApp({ feature: 'sync', fresh: false })`. B lists `Força` under `Planos de treino`.
- **On disk.** `new DatabaseSync(process.env.RUN_DIR + '/workout.sqlite', { readOnly: true }).prepare('SELECT doc, rev FROM stores WHERE key = ?').get('workout-tracking:workout-plans')`. `JSON.parse(doc).plans[0].name` is `Força`.
- **Offline.** `b.page.context().setOffline(true)`, add a Local on `Material`, and `b.page.getByRole('status')` holds the offline line. The row is unchanged. `setOffline(false)`: the line detaches and the row holds the new value.
- **Conflict.** With A and B both open, add a Local in B and `synced(B)`, then add another in A. A's `getByRole('alert')` holds `Os dados mudaram noutro dispositivo.` and the row still holds B's value. Click `Recarregar`, wait for the load and the render: A shows B's Local and no alert.
- **Upload.** On an emptied server, open a fresh context first: after `synced` and a second the `workout-plans` row is still absent. Then seed a fresh context before the first load with `page.addInitScript` writing a version 1 `workout-tracking:workout-plans` document only when the key is empty, then open. The app shows its plan, and after `synced` the `workout-plans` row holds `version: 3`.
- **Proof.** `e2e/disk-store.mjs` drives the second device, the row on disk, offline (at 390 px), the conflict (at 1280 px) and the upload. It does not check `snapshots`, `sync-open` or the `:unsynced:` copy; `e2e/watch.mjs` drives `sync-refresh`. For those, read `snapshots` like `stores`, listen for `/api/stores?have=` with `page.on('response')` (the query is URL-encoded), and list `localStorage` keys after `Recarregar`.

## Gotchas

- `openApp` empties the server unless `{ fresh: false }`, so a second plain `openApp` is a new user, not a second device.
- Changes are sent 300 ms after they are made. Wait with `synced(page)` (no store waiting to be sent) before reading the database or opening another device.
- After a conflict that store is never sent again until `Recarregar`, so `synced(page)` on that page waits forever. Click `Recarregar` first.
- The browser logs every refused request (`Failed to load resource`: a 409, or offline) as a console error of its own. `close()` counts those; filter them in a scenario that conflicts or goes offline, as `e2e/disk-store.mjs` does.
- A raw `localStorage.setItem` from the page is overwritten by the server's copy on the next load. Plant a document with `putStore`.
- `DELETE /api/stores` works only on a server started with `WORKOUT_TEST=1` (`launch.sh`, `npm run e2e`). The user's server has no way to empty its database over HTTP.
