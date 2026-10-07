# Plano alimentar

A private, single-user meal-planning app in Portuguese. `CONTEXT.md` holds the domain vocabulary. Use its terms in code. `README.md` covers running the app and rebuilding the data.

Run `npm run check` before every commit. It runs typecheck, lint, unit tests, `vite build` and every `e2e/*.mjs` against its own dev server. The `.githooks/pre-push` hook runs the same command before every push (enable it with `git config core.hooksPath .githooks`); there is no CI, to save private Actions minutes.

Before merging, review the diff against `CODING_STANDARDS.md`.
PRs target `main`.

## Rules

Each rule names what enforces it. When the user corrects a mistake, fix it and add a row here. If the row already exists and only "docs" enforces it, that's a repeat, so move it up to architecture, a type, a lint or a test in the same change. Drop a row once the mistake can no longer happen.

| Rule | Enforced by |
|---|---|
| Every quantity field opens in grams, never in a household unit, even one that fits the grams. Adding a food defaults to its APN portion in grams. | Architecture: `QuantityStepper` starts at `'g'` and the unit-picking `unitView` is deleted. Test: `e2e/units.mjs` "meal row opens in g although 50 g is exactly 1 × ovo M". |
| A browser flow shared by several scripts (adding or swapping a food, setting goals) lives once, in `e2e/_driver.mjs`. Import it from e2e scripts, the verify-plano `session.mjs` and the `scripts/plano.mjs` CLI; don't copy it. | Architecture: one module. `e2e/cli.mjs` proves the CLI and the driver reach the same state. |
| A change must build, not just typecheck. Dev mode drops CSS syntax errors that `vite build` rejects. | `npm run check` runs `vite build`, and the pre-push hook runs `npm run check`. |
| A behaviour change updates the browser checks in the same commit. | `npm run check` runs every `e2e/*.mjs`, found by directory listing, not a hand-kept list. |
| A PR that changes the UI attaches before and after shots with `plano compare … --pr <n>`. | Docs. |
| A behaviour change updates the verify-plano feature map (`.claude/skills/verify-plano/features/`) and any `CONTEXT.md` line that describes it. | Docs. Run `/pstack:maintain-verification-skill` after a feature lands. |
| Don't edit files another session has uncommitted changes in. Work in a worktree (run `scripts/link-node-modules.sh` in a new worktree), and check `git status` before touching the shared checkout. | Docs (judgment). |
| Don't change settled product decisions without asking: the Diário as home with the calendar and the day, week and month overview, and each category's input on its own tab (Alimentação with Planos, Hoje and Histórico; Treino; Corpo), foods in grams, Portuguese UI, APN equivalents for swaps, a ±5 % band for met targets. | Docs (judgment). Tests pin the band (`src/domain/goals.test.ts`). |
| PortFIR and APN data stay local. Never deploy the app publicly or commit `data/raw/tca.xlsx` or `data/raw/apn.txt`. | `.gitignore` for `data/raw/*`; docs for deploys. |
| Tests and agents never open the user's database; every dev server they start gets a temp `PLANO_DB`. | `scripts/testServer.mjs` (used by e2e and `plano compare`) and verify-plano `launch.sh` set a temp `PLANO_DB` with `PLANO_TEST=1`, and `dbPath` refuses the default database under `PLANO_TEST=1` (`server/storeApi.test.ts`). |
| Port 5180 is the user's own dev server. Agents never use it; e2e picks a free port (or `E2E_PORT`), verify-plano uses 5190. | `scripts/testServer.mjs` picks a free port per run, uses `--strictPort` and refuses 5180; verify-plano `launch.sh` refuses 5180. |
