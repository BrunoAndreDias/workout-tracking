import { chromium } from 'playwright'
import { addExercise, createWorkoutPlan, openFresh, putStore, readStored, reloadApp, rendered, seedStored, synced, todayIso, workoutDay } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('dialog', (d) => d.accept())
await openFresh(page, URL + '#treino')

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const mondayWeeksAgo = (n) => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * n); return iso(d) }
const tab = (name) => page.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name })
const blocks = page.getByRole('region', { name: 'Blocos' })
const card = (name) => blocks.locator('.block-card', { has: page.locator('.block-card-name', { hasText: new RegExp(`^${name}$`) }) })
const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
const startCard = () => page.getByRole('region', { name: /^(Sem treino registado|Registar as séries)$/ })
const startButtons = () => startCard().locator('.day-start button').allTextContents()
const names = (day) => day.locator('.planned-name').allTextContents().then((t) => t.join('|'))
const UPPER_A = 'Flat Barbell Bench Press|Bent Over Barbell Rows|Pull-Ups|Standing Overhead Barbell Press|Standing Barbell Curls|Cable Press-Downs|Cable Crunches|Hanging Leg Raises'

await tab('Plano de treino').click()
await createWorkoutPlan(page, { days: 4 })
assert((await blocks.locator('.block-card-name').allTextContents()).join('|') === 'Bloco A', 'a new plan has one block, Bloco A')
assert(await card('Bloco A').locator('.block-card-meta').first().textContent() === '6 semanas', 'which lasts 6 weeks')
assert(await blocks.getByText('Ainda não começaste. Usa "Começar aqui" no primeiro bloco.').count() === 1, 'a cycle not started says how to start it')
assert(await page.getByRole('button', { name: 'Remover bloco' }).count() === 0, 'the only block cannot be removed')
assert(await names(await workoutDay(page, 'Upper A')) === UPPER_A, 'Upper A comes filled from the template')
await page.getByLabel('RIR da semana 1 de Bloco A').fill('5-6')
await page.getByLabel('RIR da semana 1 de Bloco A').blur()
assert(await page.getByLabel('RIR da semana 1 de Bloco A').inputValue() === '5–6', 'a RIR target reads 5–6 once it loses focus')

await blocks.getByRole('button', { name: '+ Novo bloco' }).click()
assert((await blocks.locator('.block-card-name').allTextContents()).join('|') === 'Bloco A|Bloco B', '+ Novo bloco adds Bloco B')
assert(await card('Bloco B').getAttribute('aria-pressed') === 'true', 'and selects it')
assert(await page.getByLabel('RIR da semana 1 de Bloco B').inputValue() === '5–6', 'copying the RIR targets of the block it came from')
const upperB = await workoutDay(page, 'Upper A')
assert(await names(upperB) === UPPER_A, 'and its days, with the same exercises')
await upperB.getByRole('button', { name: 'Remover Standing Barbell Curls de Upper A' }).click()
await addExercise(upperB, 'Cable Curls')
assert((await names(upperB)).endsWith('Hanging Leg Raises|Cable Curls · novo'), 'an exercise not in the block before is marked novo')
assert(await upperB.locator('.planned-new').count() === 1, 'and only that one')
await page.getByLabel('RIR da semana 1 de Bloco B').fill('3')
await page.getByLabel('Semanas de Bloco B').fill('4')
assert(await page.getByLabel(/^RIR da semana \d de Bloco B$/).count() === 4, 'four weeks have four RIR fields')
await page.screenshot({ path: `${S}/blocks-plan-desktop.png`, fullPage: true })

await card('Bloco A').click()
assert(await names(await workoutDay(page, 'Upper A')) === UPPER_A, 'selecting Bloco A shows its own days, unchanged')
await page.getByLabel('Semanas de Bloco A').fill('1')
assert(await page.getByLabel(/^RIR da semana \d de Bloco A$/).count() === 1, 'one week keeps one RIR field')
assert(await page.getByLabel('RIR da semana 1 de Bloco A').inputValue() === '5–6', 'and its target')
await page.getByRole('button', { name: 'Começar aqui' }).click()
assert(await card('Bloco A').getAttribute('aria-current') === 'true', 'Começar aqui makes Bloco A the current block')
assert((await card('Bloco A').locator('.block-card-meta').allTextContents()).join('|') === '1 semana|Semana 1 de 1', 'in its week 1')
assert(await blocks.getByText('Ainda não começaste.', { exact: false }).count() === 0, 'and the not-started line goes')

await tab('Registo').click()
assert(await startCard().locator('.block-line').textContent() === 'Bloco A · semana 1 de 1 · RIR 5–6', 'Registo names the block, week and RIR')
assert((await startButtons()).join('|') === 'Começar Upper A|Lower A|Upper B|Lower B|Treino livre', 'and starts from the current block’s days')
assert(await page.getByRole('region', { name: 'Novo bloco' }).count() === 0, 'the cycle’s first week has no new-block notice')

const stored = await readStored(page)
const plans = stored['workout-plans']
assert(plans.version === 3 && plans.plans[0].split === 'ul' && plans.plans[0].start.since === todayIso(), `the start is stored as today (got ${JSON.stringify(plans.plans[0].start)})`)
const bench = stored.exercises.exercises.find((e) => e.name === 'Flat Barbell Bench Press').id
const pressDowns = stored.exercises.exercises.find((e) => e.name === 'Cable Press-Downs').id
const upperADay = plans.plans[0].blocks[0].days[0].id
await putStore(page, URL, 'workout-plans', { ...plans, plans: [{ ...plans.plans[0], start: { ...plans.plans[0].start, since: mondayWeeksAgo(2) } }] })
const seeded = { id: 'seeded', date: mondayWeeksAgo(1), workoutDayId: upperADay, exercises: [
  { exerciseId: bench, sets: [{ done: true, kg: 60, reps: 7, rir: 2 }], target: { kg: 60, reps: 7, rir: 2 } },
  { exerciseId: pressDowns, sets: [{ done: true, kg: 20, reps: 12, rir: 1 }] },
] }
await putStore(page, URL, 'workout-sessions', { version: 3, sessions: [seeded] })
await reloadApp(page)

const notice = page.getByRole('region', { name: 'Novo bloco' })
assert((await notice.locator('p').allTextContents()).join('|') === 'Começa o Bloco B esta semana.|Entram: Cable Curls|Saem: Standing Barbell Curls', 'after a week without training and one with, Bloco B starts with what comes in and goes')
assert(await startCard().locator('.block-line').textContent() === 'Bloco B · semana 1 de 4 · RIR 3', 'Registo names Bloco B, its week 1 and RIR')
assert((await startButtons()).join('|') === 'Começar Lower A|Upper A|Upper B|Lower B|Treino livre', 'the rotation carries into Bloco B: after Upper A comes Lower A')
await page.screenshot({ path: `${S}/blocks-registo-desktop.png`, fullPage: true })
await page.setViewportSize({ width: 390, height: 844 })
assert(await noScroll(), 'Registo with the notice has no horizontal scroll at 390 px')
await page.screenshot({ path: `${S}/blocks-registo-mobile.png`, fullPage: true })
await startCard().getByRole('button', { name: 'Upper A', exact: true }).click()
const session = page.getByRole('region', { name: 'Upper A', exact: true })
assert((await session.locator('.lift-name').allTextContents()).at(-1) === 'Cable Curls', 'starting Upper A logs Bloco B’s exercises')
assert(await session.getByLabel('Kg da série 1 de Flat Barbell Bench Press').inputValue() === '60', 'the bench press is suggested from the last time it was done')
assert(await session.getByLabel('Repetições da série 1 de Flat Barbell Bench Press').inputValue() === '8', 'at Principal’s RIR Target 2, whatever Bloco B’s RIR 3 says: one rep more than the 7 done at RIR 2')
const liftNote = (name) => session.getByRole('group', { name }).locator('.lift-note').textContent()
assert((await liftNote('Flat Barbell Bench Press')).endsWith('Última: 60 kg × 7 · RIR 2, alvo 2. Faz 8 com 60 kg.'), `the reason line names the logged RIR and the target (got ${await liftNote('Flat Barbell Bench Press')})`)
assert((await liftNote('Cable Press-Downs')).endsWith('Última: 20 kg × 12 · RIR 1, alvo 1–3. Faz 13 com 20 kg.'), `RIR 1 sits inside Isolamento’s 1–3, so one rep more (got ${await liftNote('Cable Press-Downs')})`)
const targetChips = (name) => session.getByRole('group', { name: `RIR da série 1 de ${name}` }).locator('.rir-target').allTextContents()
assert((await targetChips('Flat Barbell Bench Press')).join(' ') === '2', 'the bench press’s RIR chips highlight its target, RIR 2')
const started = (await readStored(page))['workout-sessions']
const pressDownsOnly = { ...started.sessions[1], exercises: started.sessions[1].exercises.filter((e) => e.exerciseId === pressDowns) }
assert(JSON.stringify(pressDownsOnly.exercises[0].target) === '{"kg":20,"reps":13,"rir":1,"rirMax":3}', `an Isolamento exercise keeps its RIR Target 1–3 (got ${JSON.stringify(pressDownsOnly.exercises[0].target)})`)
await putStore(page, URL, 'workout-sessions', { ...started, sessions: [started.sessions[0], pressDownsOnly] })
await reloadApp(page)
assert((await targetChips('Cable Press-Downs')).join(' ') === '1 2 3', 'its RIR chips highlight every RIR from 1 to 3')

await tab('Plano de treino').click()
assert(await card('Bloco B').getAttribute('aria-current') === 'true', 'the plan marks Bloco B as current')
assert(await noScroll(), 'Plano de treino with two blocks has no horizontal scroll at 390 px')
await page.screenshot({ path: `${S}/blocks-plan-mobile.png`, fullPage: true })

await page.getByRole('button', { name: 'Remover bloco' }).click()
assert((await blocks.locator('.block-card-name').allTextContents()).join('|') === 'Bloco A', 'Remover bloco removes the selected block')
assert(await page.getByRole('button', { name: 'Remover bloco' }).count() === 0, 'and the last one stays')

await synced(page)
await page.close()
const fresh = await browser.newPage()
fresh.on('pageerror', (e) => errors.push(e.message))
fresh.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const v2Day = (id, name, rows) => ({ id, name, exercises: rows.map((exerciseId) => ({ exerciseId, sets: 3, reps: { min: 8, max: 12 } })) })
const v2Block = (id, days) => ({ id, name: 'Bloco A', weeks: 6, rir: Array(6).fill(null), days })
await seedStored(fresh, URL, {
  exercises: { version: 1, exercises: [{ id: 'x1', name: 'Agachamento' }, { id: 'x2', name: 'Prensa' }] },
  'workout-plans': {
    version: 2,
    plans: [
      { id: 'cinco', name: 'Cinco dias', blocks: [v2Block('b5', ['a', 'b', 'c', 'd', 'e'].map((d) => v2Day(`b5${d}`, d, ['x1'])))], start: null },
      { id: 'tres', name: 'Antigo', blocks: [v2Block('b3', [v2Day('p', 'Pernas', ['x1', 'x2']), v2Day('q', 'Peito', []), v2Day('r', 'Costas', [])])], start: null },
    ],
    activePlanId: 'cinco',
  },
  'workout-sessions': { version: 2, sessions: [{ id: 'old', date: mondayWeeksAgo(1), workoutDayId: 'b5a', exercises: [{ exerciseId: 'x1', sets: [{ reps: 5, kg: 100 }, { reps: null, kg: 100 }] }] }] },
})
await fresh.goto(URL + '#treino')
await rendered(fresh)
await fresh.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name: 'Plano de treino' }).click()
assert((await fresh.getByRole('navigation', { name: 'Planos de treino' }).getByRole('button').allTextContents()).join('|') === 'Antigo|+ Novo plano', 'a version 2 plan of 3 days is kept and one of 5 days is dropped')
assert((await fresh.getByRole('navigation', { name: 'Dias de Bloco A' }).getByRole('button').allTextContents()).join('|') === 'Pernas|Peito|Costas', 'keeping its own day names')
const pernas = fresh.getByRole('region', { name: 'Pernas', exact: true })
assert((await pernas.locator('.role-label').allTextContents()).join('|') === 'Principal|Isolamento', 'the first exercise of a day is guessed as the main lift')
const migrated = await readStored(fresh)
assert(migrated['workout-plans'].version === 3 && migrated['workout-sessions'].version === 3, 'both stores are saved as version 3')
assert(JSON.stringify(migrated['workout-sessions'].sessions[0].exercises[0].sets.map((s) => s.done)) === '[true,false]', 'a set with reps reads as done, one without as pending')
await fresh.goto(`${URL}#treino/${mondayWeeksAgo(1)}`)
await fresh.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name: 'Registo' }).click()
await fresh.locator('.session-title', { hasText: 'Dia de treino eliminado' }).waitFor()
console.log('ok: a session from a dropped plan reads Dia de treino eliminado')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
