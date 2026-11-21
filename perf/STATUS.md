# Performance status

Written by `npm run perf` (`scripts/perf.mjs`). Do not edit by hand; rerun it.

Last run 2026-11-21 16:23 UTC on `701622d+dirty`. Median of 7 runs, range in brackets, 0 errors.

**Workload.** The production build (`server/serve.ts`) at 390 × 844 with 4× CPU slowdown, holding a year of history: 208 sessions (4992 sets) on a 4-day plan of 6 blocks. "First visit" is an empty browser; "Reopen" is a reload with the stores and assets already cached. Interactions are the main-thread time from the event until the change is in the DOM and laid out.

| Metric | Baseline | Previous | Now | Unit | vs previous | vs baseline |
|---|---|---|---|---|---|---|
| First visit, until Registo | 173.9 | 145.5 | **145.1** (143.7–149.4) | ms | -0% | -17% |
| Reopen, until Registo | 74.4 | 52.6 | **52.8** (51.7–54.5) | ms | +0% | -29% |
| First visit, first paint | 184 | 152 | **152** (152–156) | ms | 0% | -17% |
| First visit, largest paint | 184 | 152 | **152** (152–156) | ms | 0% | -17% |
| Começar <day> | 39.4 | 38.2 | **37.3** (36.8–42.7) | ms | -2% | -5% |
| Tick a set ✓ | 6.9 | 4.9 | **5.1** (4.8–6) | ms | +4% | -26% |
| Type in a kg field | 5.2 | 3.1 | **2.8** (2.4–3.4) | ms | -10% | -46% |
| Open Plano de treino | 32.8 | 29.2 | **33.2** (32.1–36.5) | ms | +14% | +1% |
| Back to Registo | 14.4 | 13.4 | **13.8** (12.6–14.7) | ms | +3% | -4% |
| JS sent, first visit | 104.6 | 102.4 | **104.1** (104.1–104.1) | KB | +2% | -0% |
| CSS sent, first visit | 6.9 | 7.3 | **8** (8–8) | KB | +10% | +16% |
| Fonts sent, first visit | 155.4 | 155.4 | **155.4** (155.4–155.4) | KB | 0% | 0% |
| Stores sent, first visit | 27.6 | 17.1 | **17.1** (17.1–17.1) | KB | 0% | -38% |

Baseline is `cdd39c8` from 2026-11-15.

## Runs

| When (UTC) | Commit | Label | Reopen ms | Tick ms | Plano ms | JS KB | Errors |
|---|---|---|---|---|---|---|---|
| 2026-11-21 16:23 | `701622d+dirty` |  | 52.8 | 5.1 | 33.2 | 104.1 | 0 |
| 2026-11-21 15:12 | `3487d01+dirty` | remove Apple Watch | 52.6 | 4.9 | 29.2 | 102.4 | 0 |
| 2026-11-15 15:59 | `ffac6d2` | mondayOf cache + per-session JSON | 61 | 5.2 | 29.3 | 104.6 | 0 |
| 2026-11-15 15:53 | `cdd39c8` | baseline | 74.4 | 6.9 | 32.8 | 104.6 | 0 |
