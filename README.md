# Plano alimentar

A private meal-planning web app. You keep day plans (for example "Dia de treino"), see calories and macros per meal and per day, and swap foods using the Portuguese APN equivalents table with a live preview of the effect on the meal and the day.

The app opens on the `Diário` calendar; the meal plans live in the `Alimentação` tab. A Diário day follows one of your plans: its food starts unchecked, and you check what you ate, a food at a time or a whole meal with `Comi tudo`, swap what you ate instead, and leave the rest unchecked. Only checked food counts. It is also a workout log. The `Treino` view holds your own workout plan (days, exercises, sets and rep ranges) and the sets you did each date, pre-filled from the last time you did each exercise. Each Diário day also has a `Corpo` section for the night's sleep (your wake-up rating plus the watch's duration), a Humor note for how you felt, and the day's Apple Watch values, which an iOS Shortcut sends to the app each day (see [Apple Watch import](#apple-watch-import)).

Personal use only. The food data comes from INSA's PortFIR table and the APN *Manual de Equivalentes Alimentares*, and both are "todos os direitos reservados". Do not deploy this publicly without written permission from both.

## Run

```sh
npm install
npm run dev            # http://localhost:5180
```

## Where the data lives

Plans, day logs, custom foods, units, workouts, sleep, Humor notes and watch values live in a SQLite file on this machine, `~/.plano-alimentar/plano.sqlite`. Set `PLANO_DB` to use another file. The file is outside the repo on purpose, so `git clean` and worktrees never touch it and it is never committed. `npm run dev`, `vite preview` and `npm run serve` all read and write it through `/api/stores`, and take the watch's values at `/api/health`.

The browser keeps a working copy in localStorage. When the page opens, it takes the server's copy of each store, sends any change it made that the server never got, and uploads any store the server does not have yet. After that, each change is sent a moment after it is made. If the server does not answer, the app runs from the browser's copy and says `Sem ligação ao servidor. As alterações ficam neste navegador até voltar.`, and it sends the changes when the server answers again. If another device changed the same store first, it says `Os dados mudaram noutro dispositivo.` and stops sending that store until you press `Recarregar`, which takes the server's copy and drops this browser's unsent change to it.

The first time a browser opens the app against an empty database, it uploads what it has in localStorage, except a store it holds only as the app's untouched starting copy, such as the default `Plano 1`. Open the browser that holds your data first. A second browser that already has its own data then gets the server's copy instead, so export a Backup from it before and import it with `Juntar aos meus dados` after. If you forget, that browser keeps each store it replaced, unsent, in its own localStorage under `nutrition-tracking:<store>:unsynced:<ISO time>`.

Each store's first change of a day keeps the version from before it in the `snapshots` table, so a bad day can be undone from the file:

```sh
node -e 'const db = new (require("node:sqlite").DatabaseSync)(process.argv[1]); console.log(db.prepare("SELECT day, key, length(doc) FROM snapshots ORDER BY day DESC LIMIT 20").all())' ~/.plano-alimentar/plano.sqlite
```

To see what the database holds without opening it by hand, run `! npm run plano -- inspect` in Claude Code, or `npm run plano -- inspect` in a terminal. It opens `PLANO_DB` read-only and prints, per store, its rev, when it was last written and its size in bytes, plus the count and the first and last date for the days, sleep, pains, health and workout sessions. It never prints a document's contents. Agents don't run it: `.claude/settings.json` denies it, and they never open the real database.

To run the built app on its own Node server:

```sh
npm run serve          # builds, then serves dist/ and /api/stores on http://127.0.0.1:4173
PORT=8080 PLANO_DB=/path/to/plano.sqlite npm run serve
```

It listens on this machine only. `HOST=0.0.0.0` would open it to your network, and it has no login: anyone who can reach it reads and changes everything. Put it behind authentication before that, and never deploy it publicly (see the licence note above).

Tests never open this file. `npm run e2e` and the verify-plano skill give each dev server they start a temp `PLANO_DB` and `PLANO_TEST=1`, which is also the only way the API allows `DELETE /api/stores`.

## Apple Watch import

A web page cannot read HealthKit, so an iOS Shortcut does: once a day a Personal Automation runs it without a tap, and it posts the day's values to the app's server. `Ligar Apple Watch`, next to the backup buttons, shows the address to post to (`<the address you opened the app at>/api/health`) with a `Copiar` button, the latest date the app has a watch value for (`Último valor do relógio: 5 out`), and the steps below in short.

**Untested on a device.** The endpoint, the panel and the merge are tested here (`server/storeApi.test.ts`, `e2e/watch.mjs`); the Shortcut and the automation were written from the Shortcuts documentation and have not run on an iPhone.

The phone must reach the server. `npm run dev` and `npm run serve` listen on this machine only, so:

- **Same Wi-Fi.** `HOST=0.0.0.0 npm run serve`, then open the app on the iPhone at `http://<the Mac's local IP>:4173/` and copy the address from `Ligar Apple Watch` there. A `localhost` address works only on the Mac, and the panel says so. Everyone else on that Wi-Fi can then reach the app too, so do this only on a network you trust.
- **Anywhere.** A private VPN such as Tailscale, with the iPhone and the Mac on it, and the Mac's VPN address in place of the local IP.

The API has no login: anyone who reaches it reads and changes everything. Keep it on your own network or VPN, and never expose it to the internet.

### The endpoint

`POST /api/health` takes the same text the paste takes, as the request body:

```json
{ "samples": [
  { "date": "2026-10-05", "metric": "standHours", "value": 9 },
  { "date": "2026-10-05", "metric": "steps", "value": 8123 }
] }
```

It answers `200 { "count": 2, "from": "2026-10-05", "to": "2026-10-05" }`. A body the paste would reject answers `400 { "error": "<the same message>" }` and stores nothing. The server merges the values into the health store itself, so this is the one store whose contents it reads. If the stored health document cannot be read, it answers `409` and leaves it alone; open the app, which keeps an unreadable copy aside before it starts again. An open tab picks the new values up when you come back to it.

A bare list of the same objects works too. `date` is `YYYY-MM-DD`, `value` is a number of at least 0, and `metric` is one of:

| `metric` | Unit | Shown as |
|---|---|---|
| `standHours` | h | Em pé 9 h |
| `standMinutes` | min | Em pé 42 min |
| `steps` | steps | 8 123 passos |
| `activeEnergy` | kcal | 412 kcal ativas |
| `exerciseMinutes` | min | Exercício 31 min |
| `sleepMinutes` | min | Relógio: 7 h 11 min, beside the sleep rating |
| `restingHeartRate` | bpm | FC em repouso 54 bpm |

A date and metric already stored is overwritten, so sending the same values twice changes nothing. Any bad row (unknown metric, bad date, negative or non-number value, or a date and metric repeated in the paste) rejects the whole request or paste with a message naming the row, and nothing is stored. `sleepMinutes` belongs to the date you woke up, like a Sleep Entry.

### Atalho iOS

**Untested on a device.** These steps were written from the Shortcuts documentation, not run on an iPhone; action and Health type names can differ between iOS versions and languages.

Build a shortcut that sends yesterday:

1. **Date**, set to `Current Date`, then **Adjust Date**: subtract 1 day. Then **Format Date** with a custom format `yyyy-MM-dd`, and **Set Variable** `day` to the result.
2. For each metric, add a block:
   1. **Find Health Samples** where `Type` is the Health type from the table below and `Start Date` is `yesterday`. Group by `Day` for the summed types.
   2. **Calculate Statistics** on the samples' values with the statistic from the table, then **Round Number** if you want whole numbers.
   3. **Dictionary** with `date` = `day` (text), `metric` = the key (text) and `value` = the result (number).
   4. **Add to Variable** `samples`.
3. **Dictionary** with one key, `samples`, of type array, set to the variable `samples`.
4. **Get Contents of URL** (`Obter conteúdo do URL`) with the address from `Ligar Apple Watch`, method `POST`, and request body `JSON` with one field, `samples`, of type array, set to the variable `samples`. If the body will not take the variable as an array, choose request body `File` with the dictionary from step 3: Shortcuts should write a dictionary as JSON text.
5. In Shortcuts → Automation, add a **Personal Automation** (`Automação pessoal`) → **Time of Day** (`Hora do dia`), daily, in the morning. Turn on **Run Immediately** (`Executar imediatamente`) and pick the shortcut.

When the phone cannot reach the server yet, end the shortcut with **Copy to Clipboard** instead, then in the app tap `Ligar Apple Watch` → `Colar manualmente` → `Colar da área de transferência`, check the preview and tap `Importar`.

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

## Dictation

Every note has a mic button: plan, meal, Humor, exercise and workout notes. Speech is transcribed on the device with OpenAI's Whisper small model through Transformers.js, in a Web Worker. The first use downloads about 250 MB of model files (and the wasm runtime from jsdelivr), which the browser then caches. No audio leaves the device. `npm run e2e` caches the model under `e2e/.cache/` (gitignored) so only the first run downloads it.

## Checks

```sh
npm test                 # vitest: domain logic and generated data
npm run typecheck
npm run lint
npm run e2e              # every e2e/*.mjs against its own dev server (a free port per run, or `E2E_PORT`); screenshots in e2e/shots/
npm run e2e -- units     # one script
npm run check            # all of the above plus vite build: run before every commit
```

`git config core.hooksPath .githooks` makes every `git push` run `npm run check` first. There is no CI, so private GitHub Actions minutes stay unused.

`CONTEXT.md` holds the domain vocabulary.
