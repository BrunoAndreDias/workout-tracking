# Treino verification map

This directory is the maintained source for verifying what a user can do in Treino. Read this index, then use the matching feature file as the recipe. The harness is `scripts/session.mjs`, described in `../SKILL.md`.

## Baseline preconditions

- Start an instance with `scripts/launch.sh`, and export the `RUN_DIR` and `APP_URL` it prints.
- `scripts/doctor.sh "$RUN_DIR"` prints `doctor: ok`.
- Every drive opens a fresh browser context through `openApp({ feature })`, on `Treino` (`#treino`, also what a bare URL opens), on its `Registo` tab for today. The app then has no Workout Plan, no session, and no Local.
- Never drive port 5180. It is the user's dev server, and its database holds the user's real data.

## Driving conventions

- Reach things by role and accessible name. Labels are in Portuguese and must match exactly, including accents and curly quotes.
- Panels are `role=dialog`. Wait for `dialog.waitFor({ state: 'detached' })` after a confirm before asserting on the plan.
- Gram fields commit on every keystroke. `fill('150')` is enough, and you don't need Enter or blur.
- Destructive actions use `window.confirm`. The harness accepts it and records the message in `app.confirms`, so assert on that text.
- The app renders only after it has fetched the server's stores, after the page's `load` event. After a reload use `reloadApp(page)` from `e2e/_driver.mjs`, or a locator that waits, before `.count()`.
- A raw `localStorage.setItem` from the page is overwritten by the server's copy on the next load. To plant a document, write it on the server with `putStore(page, APP_URL, '<store>', doc)` from `e2e/_driver.mjs` (`<store>` is a `STORE_KEY` name such as `workoutPlans`), then reload.
- Build the state under test through the UI (`createWorkoutPlan`, `addExercise` and the other flows in `e2e/_driver.mjs`), never by writing localStorage. Setup that is not under test may be planted with `seedStored(page, APP_URL, state)` before the first load.
- Switch Treino's tabs with `app.workoutTab('Registo' | 'Plano de treino' | 'Material')`, which waits until the tab is current. The hash is `#treino[/YYYY-MM-DD]`; any other hash, such as the old `#relogio`, opens Treino.
- Numbers group thousands with U+202F, a narrow no-break space. Compare text after `.replace(/\s/g, ' ')`, or strip whitespace.

## Proof and skip reporting

- **What a UI proof contains:** a screenshot plus `steps.log` assertions on exact rendered values: kg, reps, set counts.
- **What a change that persists needs on top:** a `reloadApp(page)` with the same assertions, and `saveStored()`.
- **Layout changes:** also drive `{ mobile: true }` and assert there's no horizontal scroll.
- **What to report for each run:** the feature IDs driven, the entry point used, and the artifact paths.
- **Paths you didn't drive:** a path not driven is reported as not verified. A different path to the same feature is no substitute.

## Feature entry contract

Each feature file starts with an H1 and one paragraph describing what the user sees. Then it has exactly four H2 sections, in this order:

1. `Sub-features` gives short IDs, one line each.
2. `How to get to it (user POV)` lists every entry point.
3. `Driving it with session.mjs` starts with `Preconditions:`. Then come labeled bullets, each pairing a user action with the exact call and the result you can observe.
4. `Gotchas` lists traps.

## Features

- [Workouts](./workouts.md): the `Treino` view, with Workout Plans made of a Training Split and Training Blocks, the exercise catalog, the session logger per date with suggested sets ticked with ✓, the end-of-session feel, and After-effects on the sessions of the last three days.
- [Training Blocks](./blocks.md): the blocks of a Workout Plan, with their weeks and the light switch `Semana leve`, `Começar aqui`, the week count, the new-block notice and the Exercise Runs to review.
- [Exercise picker](./picker.md): `Adicionar exercício` and `Trocar exercício`, with the search, the muscle-group filter, `+ Criar`, and each catalog Exercise's body map of where it is felt (`Alvo`, `Apoio`).
- [Material](./equipment.md): `Treino` → `Material`, with the Locais and their material, the user's own material, each Exercise's material with `Alterado` and `Repor`, and the picker's `Falta:` flags and order.
- [Backup](./backup.md): export all data to a JSON file, import it with merge or replace, and reject corrupt files.
- [Server store](./sync.md): the stores on disk, a second browser on the same server, the offline line, the conflict line with `Recarregar`, and the upload of a browser's data to an empty server.
- [Dictation](./dictation.md): the mic button on the exercise, workout and After-effect notes, on-device Whisper small, with the status line and the appended text.
- [Crash page](./crash.md): what shows instead of a blank page when the app fails to start or a render throws, with `Exportar dados` read straight from the browser and `Recarregar`.
- [Theme](./theme.md): the light and dark toggle at the end of the `Treino` tab row.
- [Home screen app](./pwa.md): the manifest, the icons and the head tags that let the iPhone add the app to its home screen.
