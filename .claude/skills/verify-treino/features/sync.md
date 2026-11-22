# Server store

The user sees nothing while it works: every change is kept in a SQLite file on the machine and shows up in any other browser that opens the app. When the server does not answer, a line fixed at the bottom of the page says `Sem ligação ao servidor. As alterações ficam neste navegador até voltar.` (role `status`). When another device changed the same store first, it says `Os dados mudaram noutro dispositivo.` with a `Recarregar` button (role `alert`).

## Sub-features

- `sync-second-device` shows a change made in one browser in a fresh browser on the same server.
- `sync-disk` keeps each store as a row of `stores (key, doc, rev, updated_at)` in `WORKOUT_DB`, with `doc` the exact JSON text of the store's localStorage key. The first change of a local day copies the previous `doc` into `snapshots (day, key, doc)`.
- `sync-offline` shows the offline line while the server is unreachable (no answer, an error, an answer that is not the expected JSON, or no answer within 4 s for the pull and 20 s for a send), keeps the change in localStorage, and sends it when the browser is back online, when the page becomes visible or hidden, and every 15 s while offline. The line goes away once a change is sent, or, with nothing to send, once the server answers the retry, which does not refresh any store.
- `sync-conflict` refuses a change made on a stale copy: the server keeps the other device's document, the conflict line appears, and `Recarregar` reloads the page on the server's copy. Until then the losing text is still the store's own key; the reload saves it under `workout-tracking:<store>:unsynced:<ISO time>`. The conflict line stays until that reload, even if the server stops answering, while the other stores keep syncing.
- `sync-open` pulls every store once as the app opens, with `GET /api/stores?have=<key>:<rev>,…` naming the copies the browser already holds. A store still at that rev comes back as `{ rev }` alone, so a reopen with nothing new downloads only the stores another device changed. No store refreshes while the app is open.
- `sync-upload` uploads a store only the browser has (data from before the server) when the server lacks it, in two steps: the raw text as the app opens (rev 1), then the migrated current version once the app has loaded it (rev 2), so the row ends at `version: 4` and rev 2, and the day's `snapshots` row holds the old text. A browser that never synced a store and holds a different copy of it keeps its own text, unsent, under `workout-tracking:<store>:unsynced:<ISO time>` before taking the server's. A store the browser holds only as the app's untouched default (no Workout Plan, no Local) is never uploaded; it is sent once the user changes it.

## How to get to it (user POV)

- Any change in any view, then the same app in another browser or after `Recarregar`.

## Driving it with session.mjs

Preconditions:

- `launch.sh` printed `RUN_DIR`; the database is `$RUN_DIR/workout.sqlite`. The first `openApp` empties it.

- **Second device.** `const a = await openApp({ feature: 'sync' })`, change something (for example `a.workoutTab('Plano de treino')` and create a Workout Plan named `Força` with `createWorkoutPlan` from `e2e/_driver.mjs`), wait with `synced(a.page)`, then `const b = await openApp({ feature: 'sync', fresh: false })` and `b.workoutTab('Plano de treino')`. B lists `Força` under `Planos de treino`.
- **On disk.** `new DatabaseSync(process.env.RUN_DIR + '/workout.sqlite', { readOnly: true }).prepare('SELECT doc, rev FROM stores WHERE key = ?').get('workout-tracking:workout-plans')`. `JSON.parse(doc).plans[0].name` is `Força`.
- **Offline.** `b.page.context().setOffline(true)`, add a Local on `Material`, and `b.page.getByRole('status')` holds the offline line. The row is unchanged. `setOffline(false)`: the line detaches and the row holds the new value. To check the page-visible flush without the `online` event, block the API with `page.route('**/api/stores**', (r) => r.abort())`, add a Local, `unroute`, then dispatch `visibilitychange` on `document`: the line detaches within 3 s, before the 15 s retry.
- **Conflict.** With A and B both open, add a Local in B and `synced(B)`, then add another in A. A's `getByRole('alert')` holds `Os dados mudaram noutro dispositivo.` and the row still holds B's value. No `:unsynced:` key yet. Click `Recarregar`, wait for the load and the render: A shows B's Local and no alert, and one localStorage key starts with `workout-tracking:equipment:unsynced:`.
- **Upload.** On an emptied server, open a fresh context first: after `synced` and a second the `workout-plans` row is still absent. Then `openApp({ feature: 'sync', init: [(doc) => localStorage.getItem('workout-tracking:workout-plans') ?? localStorage.setItem('workout-tracking:workout-plans', doc), JSON.stringify(v1Plans)] })` (`v1Plans` as in `e2e/disk-store.mjs`): `init` runs before the first load. The app shows `Plano antigo`, and after `synced` the `workout-plans` row holds `version: 4` at rev 2, with a `workout-tracking:workout-plans:migrated:<time>` copy in localStorage.
- **Proof.** `e2e/disk-store.mjs` drives all of this; `app.shot` the conflict and the offline line at 390 px.

## Gotchas

- `openApp` empties the server unless `{ fresh: false }`, so a second plain `openApp` is a new user, not a second device.
- Changes are sent 300 ms after they are made, and retried every 15 s while the line says offline. Wait with `synced(page)` (no store waiting to be sent) before reading the database or opening another device.
- The browser logs every refused request (`Failed to load resource`: a 409, or offline) as a console error of its own. `close()` counts those; in a scenario that conflicts or goes offline, drop them before `close()`: `app.errors.splice(0, app.errors.length, ...app.errors.filter((e) => !e.startsWith('Failed to load resource')))`.
- A raw `localStorage.setItem` from the page is overwritten by the server's copy on the next load. Plant a document with `putStore`.
- `DELETE /api/stores` works only on a server started with `WORKOUT_TEST=1` (`launch.sh`, `npm run e2e`). The user's server has no way to empty its database over HTTP.
