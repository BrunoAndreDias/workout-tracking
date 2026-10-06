# Plano alimentar

A private meal-planning web app. You keep day plans (for example "Dia de treino"), see calories and macros per meal and per day, and swap foods using the Portuguese APN equivalents table with a live preview of the effect on the meal and the day.

It is also a workout log. The `Treino` view holds your own workout plan (days, exercises, sets and rep ranges) and the sets you did each date, pre-filled from the last time you did each exercise. Each Diário day also has a `Corpo` section for the night's sleep, any pains, and the day's Apple Watch values, which you import by pasting (see [Apple Watch import](#apple-watch-import)).

Personal use only. The food data comes from INSA's PortFIR table and the APN *Manual de Equivalentes Alimentares*, and both are "todos os direitos reservados". Do not deploy this publicly without written permission from both.

## Run

```sh
npm install
npm run dev            # http://localhost:5180
```

Plans, day logs, workouts, sleep, pains and watch values are saved in the browser's localStorage.

## Apple Watch import

`Importar do Apple Watch`, next to the backup buttons, takes pasted JSON:

```json
{ "samples": [
  { "date": "2026-10-05", "metric": "standHours", "value": 9 },
  { "date": "2026-10-05", "metric": "steps", "value": 8123 }
] }
```

A bare list of the same objects works too. `date` is `YYYY-MM-DD`, `value` is a number of at least 0, and `metric` is one of:

| `metric` | Unit | Shown as |
|---|---|---|
| `standHours` | h | Em pé 9 h |
| `standMinutes` | min | Em pé 42 min |
| `steps` | steps | 8 123 passos |
| `activeEnergy` | kcal | 412 kcal ativas |
| `exerciseMinutes` | min | Exercício 31 min |
| `sleepMinutes` | min | Sono 431 min |
| `restingHeartRate` | bpm | FC em repouso 54 bpm |

A date and metric already stored is overwritten, so pasting the same export twice changes nothing. Any bad row (unknown metric, bad date, negative or non-number value, or a date and metric repeated in the paste) rejects the whole paste with a message naming the row, and nothing is stored. `sleepMinutes` belongs to the date you woke up, like a Sleep Entry.

### Atalho iOS

**Untested on a device.** These steps were written from the Shortcuts documentation, not run on an iPhone; action and Health type names can differ between iOS versions and languages.

Build a shortcut that exports yesterday:

1. **Date**, set to `Current Date`, then **Adjust Date**: subtract 1 day. Then **Format Date** with a custom format `yyyy-MM-dd`, and **Set Variable** `day` to the result.
2. For each metric, add a block:
   1. **Find Health Samples** where `Type` is the Health type from the table below and `Start Date` is `yesterday`. Group by `Day` for the summed types.
   2. **Calculate Statistics** on the samples' values with the statistic from the table, then **Round Number** if you want whole numbers.
   3. **Dictionary** with `date` = `day` (text), `metric` = the key (text) and `value` = the result (number).
   4. **Add to Variable** `samples`.
3. **Dictionary** with one key, `samples`, of type array, set to the variable `samples`.
4. **Copy to Clipboard** with that dictionary. Shortcuts should write a dictionary as JSON text. If step 3 will not take the variable as an array, copy the `samples` variable itself instead: the app also accepts the bare list.
5. On the phone, open the app, tap `Importar do Apple Watch`, then `Colar da área de transferência`, check the preview and tap `Importar`.

| `metric` | Health type | Statistic |
|---|---|---|
| `standHours` | Stand Hours (Apple Stand Hour), samples whose value is `Stood` | Count |
| `standMinutes` | Stand Minutes (Apple Stand Time) | Sum |
| `steps` | Steps | Sum |
| `activeEnergy` | Active Energy | Sum |
| `exerciseMinutes` | Exercise Minutes (Apple Exercise Time) | Sum |
| `sleepMinutes` | Sleep, asleep samples ending on the date, by duration in minutes | Sum |
| `restingHeartRate` | Resting Heart Rate | Average |

Leave out a metric the watch has no data for rather than sending 0. A day with no rows at all is rejected as "Não há valores para importar."

## Data

The source files live in `data/raw/` and are gitignored. They are `tca.xlsx` (the [PortFIR workbook](https://portfir.insa.min-saude.pt/pt/)) and `apn.txt` (a text extract of the APN manual).

```sh
npm run import:portfir       # data/raw/tca.xlsx -> src/data/foods.json
npm run build:equivalents    # data/apn-table.ts + data/apn-portfir-map.ts -> src/data/equivalents.json
npm run check:equivalents    # outlier report: each portion vs its group's anchor nutrient
node scripts/unmapped-candidates.ts   # PortFIR candidates for APN labels mapped to []
```

`data/apn-table.ts` is the hand-transcribed APN table. `data/apn-portfir-map.ts` maps each APN label to PortFIR food codes. Edit those two files and rebuild.

## Checks

```sh
npm test                 # vitest: domain logic and generated data
npm run typecheck
npm run lint
npm run e2e              # every e2e/*.mjs against its own dev server (E2E_PORT, default 5199); screenshots in e2e/shots/
npm run e2e -- units     # one script
npm run check            # all of the above plus vite build: run before every commit
```

`git config core.hooksPath .githooks` makes every `git push` run `npm run check` first. There is no CI, so private GitHub Actions minutes stay unused.

`CONTEXT.md` holds the domain vocabulary.
