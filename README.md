# Plano alimentar

A private meal-planning web app. You keep day plans (for example "Dia de treino"), see calories and macros per meal and per day, and swap foods using the Portuguese APN equivalents table with a live preview of the effect on the meal and the day.

It is also a workout log. The `Treino` view holds your own workout plan (days, exercises, sets and rep ranges) and the sets you did each date, pre-filled from the last time you did each exercise.

Personal use only. The food data comes from INSA's PortFIR table and the APN *Manual de Equivalentes Alimentares*, and both are "todos os direitos reservados". Do not deploy this publicly without written permission from both.

## Run

```sh
npm install
npm run dev            # http://localhost:5180
```

Plans, day logs and workouts are saved in the browser's localStorage.

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
