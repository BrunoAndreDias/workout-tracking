---
name: verify-treino
description: Drive the Treino workout app (React + Vite, data in a local SQLite store with localStorage as the working copy) in headless Chromium the way a user does, and capture screenshots, ARIA snapshots and stored state as proof. Use to verify any UI or behavior change in this repo — Workout Plans, Training Blocks, sessions and sets, After-effects, Material, backup, sync, theme — before calling it done.
---

# Verify Treino

The app is one page at `/` with one view, `#treino`: the Workout Plans, the sessions of a date and the Material, on three tabs in a `nav` named `Treino`, `Registo`, `Plano de treino` and `Material`; `#treino/YYYY-MM-DD` opens `Registo` on that date. Any other hash opens `Treino`. There is no header: the theme toggle sits at the end of that `Treino` tab row, and the sync line floats at the bottom. The UI is in European Portuguese. Each store (`workout-tracking:exercises`, `:workout-plans`, `:workout-sessions`, `:equipment`) lives in a SQLite file served by the dev server at `/api/stores`, and the browser keeps a working copy in localStorage under the same keys. `launch.sh` gives its server a database of its own in `$RUN_DIR/workout.sqlite`, and `openApp` empties it, so a drive starts with no data. `openApp` opens `#treino`.

Read [`features/README.md`](features/README.md) before driving, then the feature file that matches the change.

## Launch

Run from the repo root. Never use or stop port 5180: that is the user's own `npm run dev`, often already running.

```sh
.claude/skills/verify-treino/scripts/launch.sh          # port 5190; pass another port if busy
```

It starts `vite --port <port> --strictPort --host 127.0.0.1` with `WORKOUT_TEST=1` and `WORKOUT_DB=$RUN_DIR/workout.sqlite`, waits until `/` serves `<title>Treino</title>`, and prints:

```
RUN_DIR=<repo>/e2e/shots/verify/<timestamp>-<port>
APP_URL=http://127.0.0.1:<port>/
```

Export both for every later command. If `node_modules/.bin/vite` is missing, run `npm install` first. Vite hot-reloads source edits, so one instance serves a whole fix-and-reverify loop.

## Doctor

```sh
.claude/skills/verify-treino/scripts/doctor.sh "$RUN_DIR"
```

It runs read-only checks: our pid is alive, our pid owns the port, the shell HTML is served, `src/main.tsx` transforms, and it prints the git HEAD and the number of dirty files. Run it before the first drive and again after any drive that failed unexpectedly. A failing doctor means relaunch on a fresh port, not "drive anyway". Compile errors show up in `$RUN_DIR/vite.log` and as console errors in the page.

## Drive

Write a scenario script with Playwright through the session helper, then run it with `node`. Save scenario scripts in `$RUN_DIR` so they stay with the evidence. Import with an absolute path, because a relative import resolves from the scenario file:

```js
// $RUN_DIR/workouts.mjs
import { createWorkoutPlan } from '<repo>/e2e/_driver.mjs'
import { openApp } from '<repo>/.claude/skills/verify-treino/scripts/session.mjs'
const app = await openApp({ feature: 'workouts' })            // { mobile: true } for a 390 px phone
await app.workoutTab('Plano de treino')
await createWorkoutPlan(app.page, { name: 'Força', days: 3 })
app.check(await app.region('Push').count() === 1, 'the plan opens on its Push day')
await app.shot('plan')
await app.close()                                              // fails on any console error
```

```sh
APP_URL=$APP_URL RUN_DIR=$RUN_DIR node "$RUN_DIR/workouts.mjs"
```

`openApp` also takes `init`, a function (or `[function, arg]`) run in the page before the app's first load, to plant a browser-only store such as data from before the server, and `mic: true`, which adds a fake microphone and the `fakeWhisper` worker; `app.say(text)` then sets the next transcription.

The helper gives you `page`, `dialog`, `region(name)`, `workoutTab(name)`, `check(ok, msg)`, `stored()`, `saveStored(name)`, `shot(name)`, `aria(name, locator?)`, `confirms`, `errors`, `say(text)` (with `mic`), and `close()`. `window.confirm` prompts are accepted automatically and recorded in `confirms`. `workoutTab('Material')` clicks a Treino tab and waits until it is current. The other helpers don't navigate.

The shared flows live once in `e2e/_driver.mjs`: `createWorkoutPlan`, `workoutDay`, `addExercise`, `swapExercise`, `pickExercise`, `addGym`, `openWorkoutTab`, `reloadApp`, `synced`, `putStore`, `seedStored` and `fakeWhisper`. Import them instead of copying them.

Handles. Use accessible names, not CSS position:

- A Workout Day card or a session card: `page.getByRole('region', { name: 'Push', exact: true })`.
- An Exercise in a session: `getByRole('group', { name: '<exercise>' })`, its fields `Kg da série <n>` and `Repetições da série <n>`, and its tick `Série <n> de <exercise> feita`.
- Panels (exercise picker, backup import): `page.getByRole('dialog')`. Close one with `Fechar` or Escape.
- The exercise search box: `getByLabel('Pesquisar exercício')`. Result rows are `.result` buttons.

Each feature file lists the exact names its flow uses.

Full regressions already exist. Each one also works against your instance, and each starts by emptying your instance's database. Always pass `APP_URL`: without it every `e2e/*.mjs` script falls back to `http://localhost:5180/`, the user's own server:

```sh
APP_URL=$APP_URL SHOTS=$RUN_DIR/e2e node e2e/workout.mjs      # mkdir -p $RUN_DIR/e2e first
APP_URL=$APP_URL SHOTS=$RUN_DIR/e2e node e2e/backup.mjs
APP_URL=$APP_URL SHOTS=$RUN_DIR/e2e node e2e/mobile.mjs
APP_URL=$APP_URL SHOTS=$RUN_DIR/e2e WORKOUT_DB=$RUN_DIR/workout.sqlite node e2e/disk-store.mjs   # reads the instance's database
```

The other `e2e/*.mjs` (`blocks`, `dictation`, `equipment`, `muscle-map`, `muscle-volume`, `navigation`, `plan-rename`, `pwa`, `runs`) run the same way; `npm run check` runs them all.

Isolation: each run uses its own port and its own database, so its own origin, localStorage and stores, plus a fresh browser context. Two runs on different ports never share state, and none of them touches the user's browser, the user's dev server or the user's database in `~/.workout-tracking`. Two `openApp` calls in one drive share the server: the second one empties it unless you pass `{ fresh: false }`, which opens a second device on the same data.

## Evidence

Everything goes to `$RUN_DIR/<feature>/`, which is gitignored under `e2e/shots/`. Each folder holds a `steps.log` with every check, plus PNG screenshots, `.aria.yml` snapshots and `storage.json`. A proof:

- **Real user path.** Click the real buttons and type into the real fields. The behaviour under test goes through the UI: never dispatch reducer actions, never use `page.evaluate` to change state. The one exception is setup, and only through `seedStored` or `putStore` (the app boots from the server), never by writing localStorage yourself. `page.evaluate` is only for reading, through `stored()`.
- **Action and result.** Capture the state before and after: the sets before and after a tick, a screenshot of the open panel and of the view after confirming.
- **Side effects.** A change that persists is proven by `reloadApp(page)` from `e2e/_driver.mjs` (a reload that waits for the app to render, which happens after it fetches the stores) followed by the same assertions, plus `saveStored()` showing the stored value. A status line on screen alone is not proof.
- **Numbers.** Assert exact rendered values: kg, reps, set counts. "Something changed" is not an assertion. Numbers use pt-PT formatting: a decimal comma, and a narrow no-break space as the thousands separator.
- **Phone layout.** A layout change also needs `{ mobile: true }`, a screenshot, and `page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)`.
- **Console.** `close()` must pass, which means no console errors.

Report which feature IDs and entry points you drove, with the artifact paths. A path you didn't drive is unverified, even if a sibling path works.

## Cleanup

```sh
.claude/skills/verify-treino/scripts/cleanup.sh "$RUN_DIR"
```

It stops only the pid that `launch.sh` recorded (and its children), then deletes `server.pid` and `server.port`. It keeps `vite.log`, scenario scripts, screenshots, snapshots and logs in `$RUN_DIR`. Run it after every failed attempt too. Never `pkill node` or `pkill vite`: the user's dev server is a node process too. Delete old `e2e/shots/verify/*` folders only when the user asks.
