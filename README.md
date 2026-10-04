# Plano alimentar

A private meal-planning web app. You keep day plans (for example "Dia de treino"), see calories and macros per meal and per day, and swap foods using the Portuguese APN equivalents table with a live preview of the effect on the meal and the day.

Personal use only. The food data comes from INSA's PortFIR table and the APN *Manual de Equivalentes Alimentares*, and both are "todos os direitos reservados". Do not deploy this publicly without written permission from both.

## Run

```sh
npm install
npm run dev            # http://localhost:5180
```

Plans are saved in the browser's localStorage.

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
npm run dev & npm run e2e   # drives the core loop in headless Chromium, screenshots in e2e/shots/
```

`CONTEXT.md` holds the domain vocabulary.
