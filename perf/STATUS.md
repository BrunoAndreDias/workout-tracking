# Performance status

Written by `npm run perf` (`scripts/perf.mjs`). Do not edit by hand; rerun it.

Last run 2026-11-28 14:58 UTC on `5669dc9` (static Public Sans, Newsreader at 500). Median of 7 runs, range in brackets, 0 errors.

**Workload.** The production build (`server/serve.ts`) at 390 × 844 with 4× CPU slowdown, holding a year of history: 208 sessions (4992 sets) on a 4-day plan of 6 blocks. "First visit" is an empty browser; "Reopen" is a reload with the stores and assets already cached. Interactions are the main-thread time from the event until the change is in the DOM and laid out.

| Metric | Baseline | Previous | Now | Unit | vs previous | vs baseline |
|---|---|---|---|---|---|---|
| First visit, until Registo | 173.9 | 145.1 | **156.1** (152.5–179.3) | ms | +8% | -10% |
| Reopen, until Registo | 74.4 | 52.8 | **50.1** (49.3–58.2) | ms | -5% | -33% |
| First visit, first paint | 184 | 152 | **164** (160–188) | ms | +8% | -11% |
| First visit, largest paint | 184 | 152 | **164** (160–188) | ms | +8% | -11% |
| Começar <day> | 39.4 | 37.3 | **32.4** (31.3–33.6) | ms | -13% | -18% |
| Tick a set ✓ | 6.9 | 5.1 | **4.9** (4.6–5.7) | ms | -4% | -29% |
| Type in a kg field | 5.2 | 2.8 | **3.2** (2.9–4.1) | ms | +14% | -38% |
| Open Plano de treino | 32.8 | 33.2 | **29** (27.1–31.4) | ms | -13% | -12% |
| Back to Registo | 14.4 | 13.8 | **13.3** (10.2–14.6) | ms | -4% | -8% |
| JS sent, first visit | 104.6 | 104.1 | **105.3** (105.3–105.3) | KB | +1% | +1% |
| CSS sent, first visit | 6.9 | 8 | **8** (8–8) | KB | 0% | +16% |
| Fonts sent, first visit | 155.4 | 155.4 | **96.9** (96.9–96.9) | KB | -38% | -38% |
| Stores sent, first visit | 27.6 | 17.1 | **17.2** (17.2–17.2) | KB | +1% | -38% |

Baseline is `cdd39c8` from 2026-11-15.

## Runs

| When (UTC) | Commit | Label | Reopen ms | Tick ms | Plano ms | JS KB | Errors |
|---|---|---|---|---|---|---|---|
| 2026-11-28 14:58 | `5669dc9` | static Public Sans, Newsreader at 500 | 50.1 | 4.9 | 29 | 105.3 | 0 |
| 2026-11-21 16:23 | `701622d+dirty` |  | 52.8 | 5.1 | 33.2 | 104.1 | 0 |
| 2026-11-21 15:12 | `3487d01+dirty` | remove Apple Watch | 52.6 | 4.9 | 29.2 | 102.4 | 0 |
| 2026-11-15 15:59 | `ffac6d2` | mondayOf cache + per-session JSON | 61 | 5.2 | 29.3 | 104.6 | 0 |
| 2026-11-15 15:53 | `cdd39c8` | baseline | 74.4 | 6.9 | 32.8 | 104.6 | 0 |
