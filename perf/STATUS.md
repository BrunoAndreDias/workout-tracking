# Performance status

Written by `npm run perf` (`scripts/perf.mjs`). Do not edit by hand; rerun it.

Last run 2026-11-21 15:12 UTC on `3487d01+dirty` (remove Apple Watch). Median of 7 runs, range in brackets, 0 errors.

**Workload.** The production build (`server/serve.ts`) at 390 × 844 with 4× CPU slowdown, holding a year of history: 208 sessions (4992 sets) on a 4-day plan of 6 blocks. "First visit" is an empty browser; "Reopen" is a reload with the stores and assets already cached. Interactions are the main-thread time from the event until the change is in the DOM and laid out.

| Metric | Baseline | Previous | Now | Unit | vs previous | vs baseline |
|---|---|---|---|---|---|---|
| First visit, until Registo | 173.9 | 157.8 | **145.5** (141.6–151.1) | ms | -8% | -16% |
| Reopen, until Registo | 74.4 | 61 | **52.6** (51.9–54) | ms | -14% | -29% |
| First visit, first paint | 184 | 168 | **152** (148–160) | ms | -10% | -17% |
| First visit, largest paint | 184 | 168 | **152** (148–160) | ms | -10% | -17% |
| Começar <day> | 39.4 | 37.9 | **38.2** (37.1–42.1) | ms | +1% | -3% |
| Tick a set ✓ | 6.9 | 5.2 | **4.9** (4.2–5.2) | ms | -6% | -29% |
| Type in a kg field | 5.2 | 3.2 | **3.1** (2.6–4.2) | ms | -3% | -40% |
| Open Plano de treino | 32.8 | 29.3 | **29.2** (27.3–31.8) | ms | -0% | -11% |
| Back to Registo | 14.4 | 12.6 | **13.4** (11.8–14.3) | ms | +6% | -7% |
| JS sent, first visit | 104.6 | 104.6 | **102.4** (102.4–102.4) | KB | -2% | -2% |
| CSS sent, first visit | 6.9 | 6.9 | **7.3** (7.3–7.3) | KB | +6% | +6% |
| Fonts sent, first visit | 155.4 | 155.4 | **155.4** (155.4–155.4) | KB | 0% | 0% |
| Stores sent, first visit | 27.6 | 27.6 | **17.1** (17.1–17.1) | KB | -38% | -38% |

Baseline is `cdd39c8` from 2026-11-15.

## Runs

| When (UTC) | Commit | Label | Reopen ms | Tick ms | Plano ms | JS KB | Errors |
|---|---|---|---|---|---|---|---|
| 2026-11-21 15:12 | `3487d01+dirty` | remove Apple Watch | 52.6 | 4.9 | 29.2 | 102.4 | 0 |
| 2026-11-15 15:59 | `ffac6d2` | mondayOf cache + per-session JSON | 61 | 5.2 | 29.3 | 104.6 | 0 |
| 2026-11-15 15:53 | `cdd39c8` | baseline | 74.4 | 6.9 | 32.8 | 104.6 | 0 |
