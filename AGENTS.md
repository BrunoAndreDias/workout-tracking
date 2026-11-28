# Treino

A single-user workout log in European Portuguese: Workout Plans, the sets of each session, and Material. `CONTEXT.md` holds the domain vocabulary. Use its terms in code. `README.md` covers running the app and reaching it from the iPhone.

Run `npm run check` before every commit. It runs typecheck, lint, unit tests, `vite build`, a two-week `perf.mjs` smoke run that writes nothing, and every `e2e/*.mjs` against its own dev server. The `.githooks/pre-push` hook runs the same command before every push; `npm install` turns the hooks on through the `prepare` script. There is no CI.

`npm run perf` measures load and interaction times on a year of history and rewrites `perf/STATUS.md`. Run it after a change that could affect speed, and commit `perf/` with the change (README, Performance).

Before merging, review the diff against `CODING_STANDARDS.md`.
PRs target `main`.

## Rules

Each rule names what enforces it. When the user corrects a mistake, fix it and add a row here. If the row already exists and only "docs" enforces it, that's a repeat, so move it up to architecture, a type, a lint or a test in the same change. Drop a row once the mistake can no longer happen.

| Rule | Enforced by |
|---|---|
| A browser flow shared by several scripts (creating a Workout Plan, adding or swapping an Exercise, adding a Local) lives once, in `e2e/_driver.mjs`. Import it from e2e scripts and the verify-treino `session.mjs`; don't copy it. | Architecture: one module. |
| A change must build, not just typecheck. Dev mode drops CSS syntax errors that `vite build` rejects. | `npm run check` runs `vite build`, and the pre-push hook runs `npm run check`. |
| A behaviour change updates the browser checks in the same commit. | `npm run check` runs every `e2e/*.mjs`, found by directory listing, not a hand-kept list. |
| A behaviour change updates the verify-treino feature map (`.claude/skills/verify-treino/features/`) and any `CONTEXT.md` line that describes it. | Docs. Run `/pstack:maintain-verification-skill` after a feature lands. |
| Don't edit files another session has uncommitted changes in. Work in a worktree (run `scripts/link-node-modules.sh` in a new worktree), and check `git status` before touching the shared checkout. | Docs (judgment). |
| Don't change settled product decisions without asking: Treino as home, with its `Registo`, `Plano de treino` and `Material` tabs; no Apple Watch or Health data; Portuguese UI. | Docs (judgment). |
| Tests and agents never open the user's database; every dev server they start gets a temp `WORKOUT_DB`. | `scripts/testServer.mjs` (used by e2e) and verify-treino `launch.sh` set a temp `WORKOUT_DB` with `WORKOUT_TEST=1`, and `dbPath` refuses the default database under `WORKOUT_TEST=1` (`server/storeApi.test.ts`). |
| Port 5180 is the user's own dev server. Agents never use it; e2e picks a free port (or `E2E_PORT`), verify-treino uses 5190. | `scripts/testServer.mjs` picks a free port per run, uses `--strictPort` and refuses 5180; verify-treino `launch.sh` refuses 5180. |
| To show the user a worktree prototype on their own data, ask them to run `npm run dev -- --port 5181` in the worktree; agents never start a server on the user's database. | Docs (judgment). |
| Code has no comments. A decision goes into an ADR in `docs/adr/`, a hack into an issue, and anything else is deleted (`/delete-comment`). A change that touches a `src/domain` file with baseline comments clears them. It moves each comment that states an invariant to `CONTEXT.md` or an ADR unless one already records it, deletes the rest and runs `npm run comments:ratchet`. | `treino/no-comments` oxlint rule (`lint/no-comments.mjs`). Older files may keep the count in `lint/comment-baseline.json`, which only goes down: `npm run comments:ratchet`. Docs for the `src/domain` clean-up. |
| No file is over 5000 tokens (bytes / 4), so an agent can read and edit it in one pass. Editing a large file means splitting it in the same change. Lockfiles are exempt. | `.githooks/pre-commit` runs `scripts/check-file-tokens.ts` on staged files. |
