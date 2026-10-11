import { chromium } from 'playwright'
import { addExercise, addWorkoutDay, openFresh, putStore, readStored, reloadApp, rendered, seedStored, synced, todayIso } from './_driver.mjs'
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

await tab('Plano de treino').click()
await page.getByRole('button', { name: 'Criar plano de treino' }).click()
assert((await blocks.locator('.block-card-name').allTextContents()).join('|') === 'Bloco A', 'a new plan has one block, Bloco A')
assert(await card('Bloco A').locator('.block-card-meta').first().textContent() === '6 semanas', 'which lasts 6 weeks')
assert(await blocks.getByText('Ainda não começaste. Usa "Começar aqui" no primeiro bloco.').count() === 1, 'a cycle not started says how to start it')
assert(await page.getByRole('button', { name: 'Remover bloco' }).count() === 0, 'the only block cannot be removed')
await addWorkoutDay(page, 'Peito', ['Supino', 'Elevações'])
await page.getByLabel('RIR da semana 1 de Bloco A').fill('5-6')
await page.getByLabel('RIR da semana 1 de Bloco A').blur()
assert(await page.getByLabel('RIR da semana 1 de Bloco A').inputValue() === '5–6', 'a RIR target reads 5–6 once it loses focus')

await blocks.getByRole('button', { name: '+ Novo bloco' }).click()
assert((await blocks.locator('.block-card-name').allTextContents()).join('|') === 'Bloco A|Bloco B', '+ Novo bloco adds Bloco B')
assert(await card('Bloco B').getAttribute('aria-pressed') === 'true', 'and selects it')
assert(await page.getByLabel('RIR da semana 1 de Bloco B').inputValue() === '5–6', 'copying the RIR targets of the block it came from')
const peitoB = page.getByRole('region', { name: 'Peito', exact: true })
assert((await peitoB.locator('.planned-name').allTextContents()).join('|') === 'Supino|Elevações', 'and its days, with the same exercises')
await peitoB.getByRole('button', { name: 'Remover Elevações de Peito' }).click()
await addExercise(peitoB, 'Remo')
assert((await peitoB.locator('.planned-name').allTextContents()).join('|') === 'Supino|Remo · novo', 'an exercise not in the block before is marked novo')
assert(await peitoB.locator('.planned-new').count() === 1, 'and only that one')
await page.getByLabel('RIR da semana 1 de Bloco B').fill('3')
await page.getByLabel('Semanas de Bloco B').fill('4')
assert(await page.getByLabel(/^RIR da semana \d de Bloco B$/).count() === 4, 'four weeks have four RIR fields')
await page.screenshot({ path: `${S}/blocks-plan-desktop.png`, fullPage: true })

await card('Bloco A').click()
assert((await page.getByRole('region', { name: 'Peito', exact: true }).locator('.planned-name').allTextContents()).join('|') === 'Supino|Elevações', 'selecting Bloco A shows its own days, unchanged')
await page.getByLabel('Semanas de Bloco A').fill('1')
assert(await page.getByLabel(/^RIR da semana \d de Bloco A$/).count() === 1, 'one week keeps one RIR field')
assert(await page.getByLabel('RIR da semana 1 de Bloco A').inputValue() === '5–6', 'and its target')
await page.getByRole('button', { name: 'Começar aqui' }).click()
assert(await card('Bloco A').getAttribute('aria-current') === 'true', 'Começar aqui makes Bloco A the current block')
assert((await card('Bloco A').locator('.block-card-meta').allTextContents()).join('|') === '1 semana|Semana 1 de 1', 'in its week 1')
assert(await blocks.getByText('Ainda não começaste.', { exact: false }).count() === 0, 'and the not-started line goes')

await tab('Registo').click()
assert(await startCard().locator('.block-line').textContent() === 'Bloco A · semana 1 de 1 · RIR 5–6', 'Registo names the block, week and RIR')
assert((await startButtons()).join('|') === 'Peito|Treino livre', 'and starts from the current block’s days')
assert(await page.getByRole('region', { name: 'Novo bloco' }).count() === 0, 'the cycle’s first week has no new-block notice')

const stored = await readStored(page)
const plans = stored['workout-plans']
assert(plans.version === 2 && plans.plans[0].start.since === todayIso(), `the start is stored as today (got ${JSON.stringify(plans.plans[0].start)})`)
const supino = stored.exercises.exercises.find((e) => e.name === 'Supino').id
await putStore(page, URL, 'workout-plans', { ...plans, plans: [{ ...plans.plans[0], start: { ...plans.plans[0].start, since: mondayWeeksAgo(2) } }] })
await putStore(page, URL, 'workout-sessions', { version: 2, sessions: [{ id: 'seeded', date: mondayWeeksAgo(1), workoutDayId: null, exercises: [{ exerciseId: supino, sets: [{ reps: 8, kg: 60 }] }] }] })
await reloadApp(page)

const notice = page.getByRole('region', { name: 'Novo bloco' })
assert((await notice.locator('p').allTextContents()).join('|') === 'Começa o Bloco B esta semana.|Entram: Remo|Saem: Elevações', 'after a week without training and one with, Bloco B starts with what comes in and goes')
assert(await startCard().locator('.block-line').textContent() === 'Bloco B · semana 1 de 4 · RIR 3', 'Registo names Bloco B, its week 1 and RIR')
assert((await startButtons()).join('|') === 'Peito|Treino livre', 'the start buttons are Bloco B’s days')
await page.screenshot({ path: `${S}/blocks-registo-desktop.png`, fullPage: true })
await page.setViewportSize({ width: 390, height: 844 })
assert(await noScroll(), 'Registo with the notice has no horizontal scroll at 390 px')
await page.screenshot({ path: `${S}/blocks-registo-mobile.png`, fullPage: true })
await startCard().getByRole('button', { name: 'Peito', exact: true }).click()
const session = page.getByRole('region', { name: 'Peito', exact: true })
assert((await session.locator('.lift-name').allTextContents()).join('|') === 'Supino|Remo', 'starting Peito logs Bloco B’s exercises')
assert(await session.getByLabel('Kg da série 1 de Supino').inputValue() === '60', 'Supino pre-fills from the last time it was logged')

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
const DAY = { id: 'wd1', name: 'Pernas', exercises: [{ exerciseId: 'x1', sets: 3, reps: { min: 8, max: 12 } }] }
await seedStored(fresh, URL, {
  exercises: { version: 1, exercises: [{ id: 'x1', name: 'Agachamento' }] },
  'workout-plans': { version: 1, plans: [{ id: 'wp1', name: 'Antigo', days: [DAY] }], activePlanId: 'wp1' },
})
await fresh.goto(URL + '#treino')
await rendered(fresh)
await fresh.getByRole('navigation', { name: 'Treino' }).getByRole('button', { name: 'Plano de treino' }).click()
assert((await fresh.getByRole('region', { name: 'Blocos' }).locator('.block-card-name').allTextContents()).join('|') === 'Bloco A', 'a version 1 plan loads as Bloco A')
assert((await fresh.getByRole('region', { name: 'Pernas', exact: true }).locator('.planned-name').allTextContents()).join('|') === 'Agachamento', 'with its days')
assert(await fresh.getByLabel('Semanas de Bloco A').inputValue() === '6', 'of 6 weeks')

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
