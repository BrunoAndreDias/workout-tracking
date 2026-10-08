# Plano alimentar

A private meal-planning web app. You keep day plans (for example "Dia de treino"), see calories and macros per meal and per day, and swap foods using the Portuguese APN equivalents table with a live preview of the effect on the meal and the day.

The app opens on the `Diário`: a calendar that marks trained days and how you felt, a `Como te sentes` card where you rate the night's sleep and the day's mood and write a mood note, and the selected date's day, week and month across food, training, how you felt, and the watch. The tabs are `Diário`, `Treino` and `Alimentação`. `Alimentação` has three sub-tabs: `Planos` edits the meal plans, `Hoje` logs today's intake (or any date's), and `Histórico` reports on the logged days. A day on `Hoje` starts with the meals and goals of one of your plans, and each meal's `Importar` button picks a meal from any plan to add what you ate. A day repeated from an earlier one starts unchecked instead: each meal's unchecked food waits in a `Do plano` tray, where you use one food (`Usar <food>`) or the whole meal (`Usar o plano`). Only checked food counts. It is also a workout log. The `Treino` view holds your own workout plan (days, exercises, sets and rep ranges) and the sets you did each date, pre-filled from the last time you did each exercise, how each session felt at its end, and, on the following days, how it still feels, for the whole session or one exercise, so an injury that shows a day or two late can be followed. The Diário's `Relógio` card shows the Apple Watch values, which an iOS Shortcut sends to the app each day (see [Apple Watch import](#apple-watch-import)). The workouts the watch records come from the Health app's export instead, and show on `Treino` and the `Diário` (see [Workouts from the Health export](#workouts-from-the-health-export)).

Personal use only. The food data comes from INSA's PortFIR table and the APN *Manual de Equivalentes Alimentares*, and both are "todos os direitos reservados". Do not deploy this publicly without written permission from both.

## Run

```sh
npm install
npm run dev            # http://localhost:5180
```

## Where the data lives

Plans, day logs, custom foods, units, workouts, sleep, mood ratings and notes, watch values and watch workouts live in a SQLite file on this machine, `~/.plano-alimentar/plano.sqlite`. Set `PLANO_DB` to use another file. The file is outside the repo on purpose, so `git clean` and worktrees never touch it and it is never committed. `npm run dev`, `vite preview` and `npm run serve` all read and write it through `/api/stores`, and take the watch's values at `/api/health`.

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
pnpm dev-read          # the same on all interfaces, printing the addresses for the iPhone on the Wi-Fi
PORT=8080 PLANO_DB=/path/to/plano.sqlite npm run serve
```

It listens on this machine only. `HOST=0.0.0.0` would open it to your network, and it has no login: anyone who can reach it reads and changes everything. Put it behind authentication before that, and never deploy it publicly (see the licence note above).

Tests never open this file. `npm run e2e` and the verify-plano skill give each dev server they start a temp `PLANO_DB` and `PLANO_TEST=1`, which is also the only way the API allows `DELETE /api/stores`.

## No iPhone

The app installs on the iPhone home screen as a web app, with its own icon and no browser bars. There is no App Store step.

1. Open the app in Safari on the iPhone (see below for the address).
2. Tap `Partilhar`, then `Adicionar ao ecrã principal`.

The phone must reach the server, the same as for the [Apple Watch import](#apple-watch-import):

- **Same Wi-Fi.** `pnpm dev-read` (or `npm run dev-read`, the same as `HOST=0.0.0.0 npm run serve`) builds, serves on port 4173 and prints the addresses to open on the iPhone. Open the `http://<Mac name>.local:4173/` one. The API has no login, so everyone on that Wi-Fi can read and change everything. Use a network you trust.
- **Tailscale.** Install it on the Mac and the iPhone. `tailscale serve --bg 4173` gives an HTTPS address on your tailnet, and the server keeps listening on `127.0.0.1` only.

The microphone needs HTTPS, so dictation works on the phone only through the Tailscale address. Over plain `http://` on the Wi-Fi, the rest of the app works and the mic button does not.

There is no service worker. The app needs the Mac's server for its data anyway, so it does not launch offline. The manifest and icons are static files in `public/`. `node scripts/build-icons.mjs` redraws the icons from `public/favicon.svg`.

**Untested on a device.** The manifest, the icons and the head tags are checked in `e2e/pwa.mjs`. Adding to the home screen has not been tried on an iPhone.

## Apple Watch import

A web page cannot read HealthKit, so an iOS Shortcut does: each run posts the last 14 days and today to the app's server, by hand or from an optional Personal Automation. `Ligar Apple Watch`, next to the backup buttons, leads with `Instalar atalho`, which downloads that Shortcut ready-made (see [Atalho iOS](#atalho-ios)), and shows the address it posts to (`<the address you opened the app at>/api/health`) with a `Copiar` button, the latest date the app has a watch value for (`Último valor do relógio: 5 out`), and the install steps in short.

**Untested on a device.** The endpoint, the signing, the panel and the merge are tested here (`server/storeApi.test.ts`, `server/healthShortcut.test.ts`, `e2e/watch.mjs`); the Shortcut and the automation have not run on an iPhone.

The phone must reach the server. `npm run dev` and `npm run serve` listen on this machine only, so:

- **Same Wi-Fi.** `pnpm dev-read` (or `npm run dev-read`) prints the addresses to open. Open the app on the iPhone at the `http://<Mac name>.local:4173/` one and install the Shortcut from `Ligar Apple Watch` there. Prefer the `.local` name over the IP, because it stays the same when the Mac gets a new IP and the Shortcut keeps working. Untested on a device: that the iPhone's Shortcuts resolves `.local` names (iOS supports mDNS, and the Mac resolves its own name). The printed IPs skip VPN tunnels such as `utun`, which the phone cannot reach. A `localhost` address works only on the Mac, and the panel says so. Everyone else on that Wi-Fi can then reach the app too, so do this only on a network you trust.
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

A bare list of the same objects works too, and so does one object on its own, which is what the installed Shortcut posts. `date` is `YYYY-MM-DD`, `value` is a number of at least 0, and `metric` is one of:

| `metric` | Unit | Row in the Diário's Relógio card |
|---|---|---|
| `standHours` | h | Horas em pé (h) 9 |
| `standMinutes` | min | Tempo em pé (min) 42 |
| `steps` | steps | Passos 8 123 |
| `activeEnergy` | kcal | Energia ativa (kcal) 412 |
| `exerciseMinutes` | min | Exercício (min) 31 |
| `sleepMinutes` | min | Sono 7 h 11 min, and Relógio: 7 h 11 min beside the sleep rating |
| `restingHeartRate` | bpm | FC em repouso (bpm) 54 |

A date and metric already stored is overwritten, so sending the same values twice changes nothing. Any bad row (unknown metric, bad date, negative or non-number value, or a date and metric repeated in the paste) rejects the whole request or paste with a message naming the row, and nothing is stored. `sleepMinutes` belongs to the date you woke up, like a Sleep Entry.

### Atalho iOS

**Untested on a device.** The Shortcut is built from Shortcuts' own action definitions and from shortcuts other people run, not run on an iPhone here. `docs/research/ios-shortcut-plist.md` lists each action, its source, and what is still a guess.

`Ligar Apple Watch` → `Instalar atalho` downloads `Plano - Saude.shortcut`, a Shortcut already set up for this app. The server builds it for the address you opened the app at (`server/healthShortcut.ts`) and signs it with the Mac's `shortcuts sign --mode anyone`, so any iPhone can add it. Only a Mac can sign: elsewhere the panel says so, and you build the Shortcut by hand (below) or use `Colar manualmente`.

On the iPhone:

1. Open the app at the Mac's network or VPN address (not `localhost`) and tap `Ligar Apple Watch` → `Instalar atalho`. Safari downloads the file; open it from the downloads.
2. Tap **Add Shortcut** (`Adicionar atalho`).
3. Run it once in Shortcuts and tap **Allow** (`Permitir`) on the Health sheet, for every type it asks for. The phone may also ask to reach devices on the local network: allow that too.
4. Optional: run it by hand now and then, or in Shortcuts → Automation add a **Time of Day** (`Hora do dia`) automation, at any frequency (daily or weekly), set to **Run Immediately** (`Executar imediatamente`), running `Plano - Saude`. Health is locked while the iPhone is, so a run in the night can find nothing.

It sends the last 14 days and today each time it runs. For each metric below it finds the last 15 days grouped by day and skips the window's first day, which can be partial, so it sends today plus the 14 days before. Then it posts one `{ "date", "metric", "value" }` to `/api/health` per day and metric (up to 75 per run). A day with no samples sends nothing. Posting a day again replaces its value, so today's partial value is replaced by a fuller one on a later run. Values come in the unit the Health app shows, so Active Energy must show kcal there.

| `metric` | Find Health Samples type | Day value |
|---|---|---|
| `standMinutes` | Stand Time | Sum |
| `steps` | Steps | Sum |
| `activeEnergy` | Active Calories | Sum |
| `exerciseMinutes` | Exercise Time | Sum |
| `restingHeartRate` | Resting Heart Rate | Average |

It cannot send `sleepMinutes` or `standHours`. Their Health samples are categories (asleep or awake, stood or idle), and Shortcuts gives their value only as a word in the phone's language, so no filter in the Shortcut works on every phone. To send them, add your own blocks to the Shortcut: **Find Health Samples** of type `Sleep` or `Stand Hour` with the value filter your phone offers, then a sum of durations in minutes or a count, and a **Get Contents of URL** like the others.

When the phone cannot reach the server yet, a hand-built Shortcut can end with **Copy to Clipboard**, then in the app tap `Ligar Apple Watch` → `Colar manualmente` → `Colar da área de transferência`, check the preview and tap `Importar`. A day with no rows at all is rejected as "Não há valores para importar."

### Workouts from the Health export

Shortcuts cannot read workouts: `Find Health Samples` has no workout type, and the only workout action logs one. The Health app's own export has them all, free and with no other app.

1. On the iPhone, open Saúde, tap your profile picture, then `Exportar todos os dados de saúde`. It takes a while and gives `export.zip`.
2. Save it to Ficheiros, or AirDrop it to the Mac.
3. In the app, `Ligar Apple Watch` → `Treinos do relógio` → `Escolher ficheiro`, and pick `export.zip` (or the `export.xml` inside it).
4. Check the preview (`132 treinos do relógio, de 3/1 a 6/10`) and tap `Importar treinos`.

The file is read in the browser and never sent anywhere; only the workouts are kept, in the `watch-workouts` store, which syncs and goes into the Backup like the others. The app streams `export.xml` out of the zip (`src/zip.ts`, Zip64 too) and through a parser that keeps only the current element (`src/domain/watchWorkouts.ts`), so a multi-GB export never sits in memory. A Workout it cannot read is skipped, and the preview says how many. Importing the same export twice changes nothing.

Each workout shows on `Treino` for its date, and as a line on the `Diário` and on `Alimentação` → `Hoje`, as `Relógio · Força tradicional · 18:02 · 52 min · 311 kcal` (and km when the watch has a distance). They do not count in the Diário's training numbers.

**Untested on a device.** No real Health export was read here. The parser and the zip reader are tested on files built in the tests (`src/domain/watchWorkouts.test.ts`, `src/zip.test.ts`, `src/healthExport.test.ts`, `e2e/watch-workouts.mjs`).

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

Every note has a mic button: plan, meal, mood, exercise, workout and after-workout notes. Speech is transcribed on the device with OpenAI's Whisper small model through Transformers.js, in a Web Worker. The first use downloads about 250 MB of model files (and the wasm runtime from jsdelivr), which the browser then caches. No audio leaves the device. `npm run e2e` caches the model under `e2e/.cache/` (gitignored) so only the first run downloads it.

## Checks

```sh
npm test                 # vitest: domain logic and generated data
npm run typecheck
npm run lint
npm run e2e              # every e2e/*.mjs against its own dev server (a free port per run, or `E2E_PORT`); screenshots in e2e/shots/
npm run e2e -- units     # one script
npm run check            # all of the above plus vite build: run before every commit
npm run perf             # times opening the Diário and its daily taps on a year of data, at 4x CPU slowdown
```

`npm run perf -- <baseline checkout> .` alternates runs between a baseline checkout and this one; `--net 40` adds a 40 Mbit/s link, as the phone has to the Mac, and `--profile <dir>` writes a CPU profile per scenario instead. Raw results go to `perf-results/`, which git ignores.

`git config core.hooksPath .githooks` makes every `git push` run `npm run check` first. There is no CI, so private GitHub Actions minutes stay unused.

`CONTEXT.md` holds the domain vocabulary.
