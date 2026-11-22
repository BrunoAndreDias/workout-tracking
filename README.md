# Treino

A private, single-user workout log in European Portuguese, for the gym.

The app opens on `Treino`. Its `Plano de treino` tab holds your workout plan: a 3-day split (Push, Pull, Full body) or a 4-day one (Upper and Lower twice), which starts filled with exercises from a catalog you swap and add to, each with its sets and rep range. The plan names the muscle groups each day trains and adds up the block's sets a week per muscle group, so a group left untrained shows. It is written as training blocks, each with a length, such as 6 weeks, and an optional light switch for a deload. Each set aims at about 80% effort: 2 reps in reserve on compound lifts and 1 to 3 on isolation and core work, 2 more in a light block. The app counts the weeks you trained, starts the next day of the rotation from the current block, and on the week a new block starts says which exercises come in and go. `Registo` logs the sets of one date: each set comes with a suggested weight and reps worked out from the last time, and one tap marks it done; the session names the muscle groups its done sets trained. It also keeps how each session felt at its end and, on the following days, how it still feels, for the whole session or one exercise, so an injury that shows a day or two late can be followed. `Material` says what each exercise needs and what each place you train has, so the exercise picker lists first what you can do there.

## Run

```sh
npm install
npm run dev            # http://localhost:5180
```

## Where the data lives

Exercises, workout plans, sessions and material live in a SQLite file on this machine, `~/.workout-tracking/workout.sqlite`. Set `WORKOUT_DB` to use another file. The file is outside the repo on purpose, so `git clean` and worktrees never touch it and it is never committed. `npm run dev`, `vite preview` and `npm run serve` all read and write it through `/api/stores`.

The browser keeps a working copy in localStorage, under `workout-tracking:` keys. When the page opens, it takes the server's copy of each store, sends any change it made that the server never got, and uploads any store the server does not have yet. After that, each change is sent a moment after it is made. If the server does not answer, the app runs from the browser's copy and says `Sem ligação ao servidor. As alterações ficam neste navegador até voltar.`, and it sends the changes when the server answers again. If another device changed the same store first, it says `Os dados mudaram noutro dispositivo.` and stops sending that store until you press `Recarregar`, which takes the server's copy and drops this browser's unsent change to it.

The first time a browser opens the app against an empty database, it uploads what it has in localStorage, except a store it holds only as the app's untouched starting copy. If a browser replaces a store it never sent, it keeps its own copy, unsent, under `workout-tracking:<store>:unsynced:<ISO time>`.

Each store's first change of a day keeps the version from before it in the `snapshots` table, so a bad day can be undone from the file:

```sh
node -e 'const db = new (require("node:sqlite").DatabaseSync)(process.argv[1]); console.log(db.prepare("SELECT day, key, length(doc) FROM snapshots ORDER BY day DESC LIMIT 20").all())' "$WORKOUT_DB"
```

To run the built app on its own Node server:

```sh
npm run serve          # builds, then serves dist/ and /api/stores on http://127.0.0.1:4173
npm run dev-read       # the same on all interfaces, printing the addresses for the iPhone on the Wi-Fi
PORT=8080 WORKOUT_DB=/path/to/workout.sqlite npm run serve
```

It listens on this machine only. `HOST=0.0.0.0` would open it to your network, and it has no login: anyone who can reach it reads and changes everything. Put it behind authentication before that.

Tests never open this file. `npm run e2e` and the verify-treino skill give each dev server they start a temp `WORKOUT_DB` and `WORKOUT_TEST=1`, which is also the only way the API allows `DELETE /api/stores`.

## On the iPhone

The app installs on the iPhone home screen as a web app, with its own icon and no browser bars. There is no App Store step.

1. Open the app in Safari on the iPhone (see below for the address).
2. Tap `Partilhar`, then `Adicionar ao ecrã principal`.

The phone must reach the server. `npm run dev` and `npm run serve` listen on this machine only, so:

- **Same Wi-Fi.** `pnpm dev-read` (or `npm run dev-read`, the same as `HOST=0.0.0.0 npm run serve`) builds, serves on port 4173 and prints the addresses to open on the iPhone. Open the `http://<Mac name>.local:4173/` one: it stays the same when the Mac gets a new IP. The printed IPs skip VPN tunnels such as `utun`, which the phone cannot reach. The API has no login, so everyone on that Wi-Fi can read and change everything. Use a network you trust.
- **Tailscale.** Install it on the Mac and the iPhone. `tailscale serve --bg 4173` gives an HTTPS address on your tailnet, and the server keeps listening on `127.0.0.1` only.

The microphone needs HTTPS, so dictation works on the phone only through the Tailscale address. Over plain `http://` on the Wi-Fi, the rest of the app works and the mic button does not.

There is no service worker. The app needs the Mac's server for its data anyway, so it does not launch offline. The manifest and icons are static files in `public/`. `node scripts/build-icons.mjs` redraws the icons from `public/favicon.svg`.

**Untested on a device.** The manifest, the icons and the head tags are checked in `e2e/pwa.mjs`. Adding to the home screen has not been tried on an iPhone.

## Backup

`Exportar dados`, at the bottom of `Treino`, downloads every store as one `treino-<date>.json`. `Importar dados` reads such a file. `Juntar aos meus dados` adds what you do not have yet, by id (an exercise named like one you have becomes that one), and keeps what you have. `Substituir tudo` replaces everything, after a confirm that says what you lose. A file with any damaged store changes nothing. The Apple Watch stores of a file from an older version are ignored.

## Dictation

Every note has a mic button: exercise, workout and after-workout notes. Speech is transcribed on the device with OpenAI's Whisper small model through Transformers.js, in a Web Worker. The first use downloads about 250 MB of model files (and the wasm runtime from jsdelivr), which the browser then caches. No audio leaves the device. `npm run e2e` caches the model under `e2e/.cache/` (gitignored) so only the first run downloads it.

## Checks

```sh
npm test                 # vitest: domain logic
npm run typecheck
npm run lint
npm run e2e              # every e2e/*.mjs against its own dev server (a free port per run, or `E2E_PORT`); screenshots in e2e/shots/
npm run e2e -- workout   # one script
npm run check            # all of the above plus vite build: run before every commit
```

`git config core.hooksPath .githooks` makes every `git commit` refuse a staged file over 5000 tokens and every `git push` run `npm run check` first.

`CONTEXT.md` holds the domain vocabulary.

## Performance

`npm run perf` builds the app, serves it with `server/serve.ts` on a free port and a temp database, and seeds a year of history: about 200 sessions on a 4-day plan. It then times load and the main interactions in headless Chromium at phone size with 4× CPU slowdown, as the median of 7 runs. It writes `perf/STATUS.md` (baseline, previous run and now for each metric), `perf/latest.json` and `perf/history.jsonl`. Commit those three with the change they measure.

```sh
npm run perf -- --label "after X"      # record a run
npm run perf -- --no-write --weeks 156 # three years of history, nothing written
npm run perf -- --against ../other     # alternate runs with another worktree and compare; nothing written
npm run perf -- --profile              # top self-time functions of a reopen and of 20 kg keystrokes
```

## Licence

MIT, see `LICENSE`.
