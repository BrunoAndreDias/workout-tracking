# Performance status

Written by `npm run perf` (`scripts/perf.mjs`). Do not edit by hand; rerun it.

Last run 2026-11-15 15:59 UTC on `ffac6d2` (mondayOf cache + per-session JSON). Median of 7 runs, range in brackets, 0 errors.

**Workload.** The production build (`server/serve.ts`) at 390 × 844 with 4× CPU slowdown, holding a year of history: 208 sessions (4992 sets) on a 4-day plan of 6 blocks, 2555 watch values and 208 Watch Workouts. "First visit" is an empty browser; "Reopen" is a reload with the stores and assets already cached. Interactions are the main-thread time from the event until the change is in the DOM and laid out.

| Metric | Baseline | Previous | Now | Unit | vs previous | vs baseline |
|---|---|---|---|---|---|---|
| First visit, until Registo | 173.9 | 173.9 | **157.8** (156.1–162.4) | ms | -9% | -9% |
| Reopen, until Registo | 74.4 | 74.4 | **61** (59.8–68.4) | ms | -18% | -18% |
| First visit, first paint | 184 | 184 | **168** (164–172) | ms | -9% | -9% |
| First visit, largest paint | 184 | 184 | **168** (164–172) | ms | -9% | -9% |
| Começar <day> | 39.4 | 39.4 | **37.9** (36.9–42.2) | ms | -4% | -4% |
| Tick a set ✓ | 6.9 | 6.9 | **5.2** (4.6–5.8) | ms | -25% | -25% |
| Type in a kg field | 5.2 | 5.2 | **3.2** (2.8–3.9) | ms | -38% | -38% |
| Open Plano de treino | 32.8 | 32.8 | **29.3** (28–36.5) | ms | -11% | -11% |
| Back to Registo | 14.4 | 14.4 | **12.6** (12.4–16.5) | ms | -13% | -13% |
| Open Relógio | 9.2 | 9.2 | **9.2** (8.6–9.6) | ms | 0% | 0% |
| JS sent, first visit | 104.6 | 104.6 | **104.6** (104.6–104.6) | KB | 0% | 0% |
| CSS sent, first visit | 6.9 | 6.9 | **6.9** (6.9–6.9) | KB | 0% | 0% |
| Fonts sent, first visit | 155.4 | 155.4 | **155.4** (155.4–155.4) | KB | 0% | 0% |
| Stores sent, first visit | 27.6 | 27.6 | **27.6** (27.6–27.6) | KB | 0% | 0% |

Baseline is `cdd39c8` from 2026-11-15.

## Runs

| When (UTC) | Commit | Label | Reopen ms | Tick ms | Plano ms | JS KB | Errors |
|---|---|---|---|---|---|---|---|
| 2026-11-15 15:59 | `ffac6d2` | mondayOf cache + per-session JSON | 61 | 5.2 | 29.3 | 104.6 | 0 |
| 2026-11-15 15:53 | `cdd39c8` | baseline | 74.4 | 6.9 | 32.8 | 104.6 | 0 |
