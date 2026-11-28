# Backup

At the bottom of `Treino`, `Exportar dados` downloads every store as one `treino-YYYY-MM-DD.json`, and `Importar dados` picks such a file. A valid file opens a side panel that says what is in it, with `Juntar aos meus dados` and `Substituir tudo`. An invalid file shows an inline error and changes nothing. After applying, the page reloads.

Applying is all or nothing: if any of the four stores fails to write (full storage), every key goes back to its previous value and an inline alert says `Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.` Exporting names any store it had to leave out because its stored document no longer parses.

## Sub-features

- `backup-export` downloads exercises, workout plans, workout sessions (with each one's end feel and After-effects), and Material (store `equipment`), each as the document the app stores, under `app: "workout-tracking"`.
- `backup-import-merge` adds exercises, workout plans and workout sessions by id (an incoming Exercise named like one the user has becomes that one), and Locais, the user's own Material and Material corrections as `mergeEquipment` says.
- `backup-import-replace` writes the file's stores over everything, after a confirm that names what is lost.
- `backup-export-skipped` shows, after the download, `Não foi possível exportar: planos de treino. …` (role `status`) naming each store left out (`exercícios`, `planos de treino`, `treinos`, `material`). A store never saved is not skipped.
- `backup-apply-atomic` shows the inline `alert` above and leaves every store key as it was when a write fails midway.
- `backup-reject` shows an error for a file that is not JSON, not a Treino backup, including one from the meal app (`Este ficheiro não é uma cópia de segurança do Treino.`), from an unknown backup version (`Esta cópia de segurança é de uma versão que a app não conhece.`), without stores (`A cópia de segurança está danificada: faltam os dados.`), or with any invalid store this app keeps (`A cópia de segurança está danificada: os dados de <store> não são válidos. Não foi alterado nada.`). Any store this app does not keep, such as the old `health` and `watchWorkouts`, is ignored.

## How to get to it (user POV)

- The `Exportar dados` and `Importar dados` buttons in the region `Dados`, at the bottom of `Treino`.

## Driving it with session.mjs

Preconditions: a fresh `openApp`. Build state under test through the UI; `e2e/fixtures/treino-backup.json` is a small Treino Backup with one plan, one session and one Local.

- **Export.** `const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar dados' }).click()])`, then `d.saveAs(path)`. `d.suggestedFilename()` matches `treino-YYYY-MM-DD.json`.
- **Choose a file.** `page.getByLabel('Ficheiro de dados').setInputFiles(path)`. The input is hidden, which Playwright allows.
- **Fixture file.** Choose the fixture: the dialog `Cópia de segurança` (eyebrow `Importar dados`) opens, and `app.dialog.locator('.backup-summary')` reads `1 plano de treino, 1 treino, 1 local de treino`. Click `Juntar aos meus dados`, wait for the reload and `rendered(page)`. `(await app.stored()).workoutPlans.plans[0].name` is `Força`, and `#treino/2026-05-01` shows the `Push` session. `e2e/backup.mjs` drives this, after checking that a meal-app file (`app: "plano-alimentar"`) is rejected.
- **Replace.** Click `Substituir tudo`. `app.confirms.at(-1)` is `Substituir tudo?\n\nVais perder o que tens agora: <summary>.\nFicas com o que está no ficheiro: <summary>.`, Both sides use the `.backup-summary` wording. After a merge of the fixture and one more plan they read `2 planos de treino, 1 treino, 1 local de treino` and `1 plano de treino, 1 treino, 1 local de treino`.
- **Reject.** `page.getByRole('alert')` holds the message and no dialog opens. A file that is not JSON gives `Não foi possível ler o ficheiro: não é um JSON válido. Não foi alterado nada.`
- **Export skipped.** After the app has loaded, corrupt a store from the page (reading is the rule, but this is the documented seed exception): `localStorage.setItem('workout-tracking:workout-plans', JSON.stringify({ version: 99, plans: [] }))`. A reload keeps it: the app leaves a store it cannot read in place, and the server sends its copy only once another device has changed it. Click `Exportar dados`: the `status` line reads `Não foi possível exportar: planos de treino. Os dados guardados no navegador não são válidos e ficaram de fora do ficheiro.`, and the file has no `workoutPlans`.
- **Failed apply.** Choose a file, then make `Storage.prototype.setItem` throw `QuotaExceededError` once for the key `workout-tracking:workout-sessions` (fault injection through `page.evaluate`, not a state change) and click `Substituir tudo`. Key it on a store: counting calls is fragile, because the sync bookkeeping (`workout-tracking:sync`) also calls `setItem` between the stores and swallows its own errors. `page.getByRole('region', { name: 'Dados' }).getByRole('alert')` reads `Não foi possível guardar os dados: o armazenamento do navegador não tem espaço. Não foi alterado nada.`, the import panel stays open, and the raw value of every `workout-tracking:*` store key equals what it was before. Scope the alert to `Dados`, because the failed write also raises the storage-full `alert` at the bottom of the page.

## Gotchas

- Apply ends in `location.reload()`, so wait for the load before asserting.
- A merge never overwrites what the user has: existing ids win.
- A store the app cannot read (unknown or newer version, corrupt JSON) is copied to `workout-tracking:<store>:unreadable:<ISO time>` on load, once per distinct text. The app starts fresh but leaves the unreadable text in place until the store changes.
- A store the app converts from an older version (version 1 to 3 workout plans or workout sessions) is copied to `workout-tracking:<store>:migrated:<ISO time>` on load, once per distinct text, before the converted document is saved over it.
- Never hand-write the backup from localStorage in a scenario. Export through the UI, or use `e2e/fixtures/treino-backup.json`.
- Apply writes every store through the same storage that sends changes to the server, and the reload comes before they are sent. The next start sends them first, so a fresh `openApp({ fresh: false })` after the apply sees the imported data (`e2e/disk-store.mjs` drives this).
