# Backup

At the bottom of both views, `Exportar dados` downloads every store as one `treino-YYYY-MM-DD.json`, and `Importar dados` picks such a file, or a Backup the meal app exported (`plano-alimentar-YYYY-MM-DD.json`). A valid file opens a side panel that says what is in it, with `Juntar aos meus dados` and `Substituir tudo`. An invalid file shows an inline error and changes nothing. After applying, the page reloads.

Applying is all or nothing: if any of the six stores fails to write (full storage), every key goes back to its previous value and an inline alert says `Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.` Exporting names any store it had to leave out because its stored document no longer parses.

## Sub-features

- `backup-export` downloads exercises, workout plans, workout sessions (with each one's end feel and After-effects), Material (store `equipment`), watch values (store `health`) and Watch Workouts (store `watchWorkouts`), each as the document the app stores, under `app: "workout-tracking"`.
- `backup-meal-app` reads a file with `app: "plano-alimentar"`, the meal app's Backup: its `exercises`, `workoutPlans`, `workoutSessions`, `equipment`, `health` and `watchWorkouts` come in, and its food, unit, plan, day, sleep, Feeling and mood stores are ignored, even when one of them would not parse. This is how the user moves their data over from the meal app.
- `backup-import-merge` adds exercises, workout plans and workout sessions by id (an incoming Exercise named like one the user has becomes that one), watch values for a date and metric the user has none for, Watch Workouts by id, and Locais, the user's own Material and Material corrections as `mergeEquipment` says.
- `backup-import-replace` writes the file's stores over everything, after a confirm that names what is lost.
- `backup-export-skipped` shows, after the download, `Não foi possível exportar: valores do relógio. …` (role `status`) naming each store left out (`exercícios`, `planos de treino`, `treinos`, `valores do relógio`, `treinos do relógio`, `material`). A store never saved is not skipped.
- `backup-apply-atomic` shows the inline `alert` above and leaves every store key as it was when a write fails midway.
- `backup-reject` shows an error for a file that is not JSON, not a backup of either app (`Este ficheiro não é uma cópia de segurança do Treino.`), from an unknown backup version (`Esta cópia de segurança é de uma versão que a app não conhece.`), without stores, or with any invalid store this app keeps.

## How to get to it (user POV)

- The `Exportar dados` and `Importar dados` buttons in the region `Dados`, at the bottom of `Treino` and `Relógio`.

## Driving it with session.mjs

Preconditions: a fresh `openApp`. Build state under test through the UI; the meal-app fixture is `src/domain/fixtures/meal-app-backup.json`, a full Backup the meal app exported with its own code.

- **Export.** `const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar dados' }).click()])`, then `d.saveAs(path)`. `d.suggestedFilename()` matches `treino-YYYY-MM-DD.json`.
- **Choose a file.** `page.getByLabel('Ficheiro de dados').setInputFiles(path)`. The input is hidden, which Playwright allows.
- **Meal-app file.** Choose the fixture: `app.dialog.locator('.backup-summary')` reads `1 plano de treino, 1 treino, 3 valores do relógio, 1 treino do relógio, 1 local de treino`. Click `Juntar aos meus dados`, wait for the reload and `rendered(page)`. `app.stored()['workout-plans'].plans[0].name` is `Força`, `#treino/2026-05-01` shows the `Push` session, and `#relogio/2026-05-01` shows `Passos 8 123` in the `Dia` column. Every localStorage store key starts `workout-tracking:`. `e2e/backup.mjs` drives this.
- **Replace.** Click `Substituir tudo`. `app.confirms.at(-1)` starts `Substituir tudo?\n\nVais perder o que tens agora: ` and names both sides with the same summary.
- **Reject.** `page.getByRole('alert')` holds the message and no dialog opens. A file that is not JSON gives `Não foi possível ler o ficheiro: não é um JSON válido. Não foi alterado nada.`
- **Export skipped.** After the app has loaded, corrupt a store from the page (reading is the rule, but this is the documented seed exception): `localStorage.setItem('workout-tracking:health', JSON.stringify({ version: 99, samples: [] }))`. Do not reload, because the app rewrites its stores when it starts. Click `Exportar dados`: `page.getByRole('status')` names `valores do relógio`.
- **Failed apply.** Choose a file, then make `Storage.prototype.setItem` throw `QuotaExceededError` once for the key `workout-tracking:workout-sessions` (fault injection through `page.evaluate`, not a state change) and click `Substituir tudo`. Key it on a store: counting calls is fragile, because the sync bookkeeping (`workout-tracking:sync`) also calls `setItem` and swallows its own errors. `getByRole('alert')` holds the error, the import panel stays open, and the raw value of every `workout-tracking:*` store key equals what it was before.

## Gotchas

- Apply ends in `location.reload()`, so wait for the load before asserting.
- A merge never overwrites what the user has: existing ids, and existing watch values, win.
- A store the app cannot read (unknown or newer version, corrupt JSON) is copied to `workout-tracking:<store>:unreadable:<ISO time>` on load, once per distinct text, before the app starts fresh and saves over it.
- A store the app converts from an older version (version 1 or 2 workout plans, version 1 or 2 workout sessions) is copied to `workout-tracking:<store>:migrated:<ISO time>` on load, once per distinct text, before the converted document is saved over it.
- Never hand-write the backup from localStorage in a scenario. Export through the UI, or use the meal-app fixture.
- Apply writes every store through the same storage that sends changes to the server, and the reload comes before they are sent. The next start sends them first, so a fresh `openApp({ fresh: false })` after the apply sees the imported data (`e2e/disk-store.mjs` drives this).
