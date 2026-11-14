import { chromium } from 'playwright'
import { openFresh, readStored, reloadApp, synced, watchDay } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
await context.grantPermissions(['clipboard-read', 'clipboard-write'])
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await openFresh(page, URL + '#relogio')

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = iso(now)
const yesterday = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12))
const todayLabel = `${now.getDate()} ${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][now.getMonth()]}`
const endpoint = new globalThis.URL('/api/health', URL).href
const relogio = page.getByRole('region', { name: 'Relógio', exact: true })
const dialog = page.getByRole('dialog')
const serverHealth = async () => (await (await page.request.get(new globalThis.URL('/api/stores', URL).href)).json())['workout-tracking:health']
const post = async (body) => {
  const res = await page.request.post(endpoint, { headers: { 'content-type': 'application/json' }, data: body })
  return { status: res.status(), body: await res.json() }
}
const tabComesBack = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

await relogio.waitFor()
await page.getByRole('button', { name: 'Ligar Apple Watch' }).click()
const urlField = dialog.getByRole('textbox', { name: 'Endereço do Atalho' })
assert(await urlField.inputValue() === endpoint, `the panel shows the address the Shortcut calls (got ${await urlField.inputValue()})`)
const install = dialog.getByRole('link', { name: 'Instalar atalho' })
const installHref = await install.getAttribute('href')
assert(installHref === `${new globalThis.URL(URL).origin}/api/health/shortcut?url=${encodeURIComponent(endpoint)}`, `Instalar atalho asks for the Shortcut that posts to the panel's address (got ${installHref})`)
if (process.platform === 'darwin') {
  const file = await page.request.get(installHref, { timeout: 30_000 })
  const head = (await file.body()).subarray(0, 4).toString()
  assert(file.status() === 200 && head === 'AEA1' && file.headers()['content-disposition'] === 'attachment; filename="Treino - Saude.shortcut"', `on a Mac, the link downloads a signed Shortcut (got ${file.status()} ${head})`)
}
assert(await dialog.getByText('os valores do relógio dos últimos 14 dias e de hoje', { exact: false }).count() === 1, 'the hint says the Shortcut sends the last 14 days and today')
assert(await dialog.getByText('Aberta em localhost, a app dá um atalho que só funciona neste computador.', { exact: false }).count() === 1, 'a localhost address is flagged as unreachable from the iPhone')
assert(await dialog.locator('.health-latest').textContent() === 'Ainda não chegou nenhum valor do relógio.', 'with no value yet, the panel says so')
await dialog.getByRole('button', { name: 'Copiar' }).click()
assert(await page.evaluate(() => navigator.clipboard.readText()) === endpoint, 'Copiar puts the address on the clipboard')
assert(await dialog.getByRole('status').textContent() === 'Endereço copiado.', 'and says it did')
assert(await dialog.getByLabel('Dados do Apple Watch').isVisible() === false, 'the manual paste starts collapsed')
assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the panel has no horizontal scroll at 390 px')
await page.screenshot({ path: `${S}/watch-panel.png` })
await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()

const first = JSON.stringify({
  samples: [
    { date: today, metric: 'standHours', value: 9 },
    { date: today, metric: 'steps', value: 8123 },
    { date: yesterday, metric: 'restingHeartRate', value: 54 },
  ],
})
assert(JSON.stringify(await post(first)) === `{"status":200,"body":{"count":3,"from":"${yesterday}","to":"${today}"}}`, 'the server takes the Shortcut text')
assert(JSON.stringify(await post(first)) === `{"status":200,"body":{"count":3,"from":"${yesterday}","to":"${today}"}}`, 'and takes it again')
assert((await serverHealth()).rev === 1, 'posting the same text twice is one write')
assert(await watchDay(page) === '', 'the open tab has not looked yet')

await tabComesBack()
await page.waitForFunction(() => [...document.querySelectorAll('section:has(#ov-relogio) .ov-value')].some((v) => v.textContent !== '—'))
assert(await watchDay(page) === 'Horas em pé (h) 9 · Passos 8 123', `coming back to the tab shows the posted values (got ${await watchDay(page)})`)
await synced(page)
assert((await serverHealth()).rev === 1, 'taking the server copy sends nothing back')
assert(JSON.stringify((await readStored(page)).health) === (await serverHealth()).doc, 'the tab keeps the server copy')

await page.getByRole('button', { name: 'Ligar Apple Watch' }).click()
assert(await dialog.locator('.health-latest').textContent() === `Último valor do relógio: ${todayLabel}`, 'the panel names the latest day with a value')
await dialog.getByText('Colar manualmente').click()
await dialog.getByLabel('Dados do Apple Watch').fill(JSON.stringify([{ date: today, metric: 'activeEnergy', value: 412 }]))
await dialog.getByRole('button', { name: 'Importar', exact: true }).click()
await dialog.waitFor({ state: 'detached' })
await synced(page)
assert((await serverHealth()).rev === 2, 'a paste after the refresh reaches the server')
assert(await page.getByRole('alert').filter({ hasText: 'Os dados mudaram noutro dispositivo.' }).count() === 0, 'with no conflict')

assert(JSON.stringify(await post(JSON.stringify({ date: today, metric: 'steps', value: 9001 }))) === `{"status":200,"body":{"count":1,"from":"${today}","to":"${today}"}}`, 'a later post of one sample on its own, as the installed Shortcut sends it, replaces one value')
const bad = await post(JSON.stringify([{ date: today, metric: 'steps', value: 1 }, { date: today, metric: 'sittingHours', value: 6 }]))
assert(bad.status === 400 && bad.body.error === 'Valor n.º 2: a métrica "sittingHours" não existe. Não foi alterado nada.', `a bad row is refused with the paste's message (got ${JSON.stringify(bad)})`)
assert((await serverHealth()).rev === 3, 'and changes nothing')

await reloadApp(page)
await relogio.waitFor()
assert(await watchDay(page) === 'Horas em pé (h) 9 · Passos 9 001 · Energia ativa (kcal) 412', `after a reload the Relógio tab shows the newest values (got ${await watchDay(page)})`)
await relogio.screenshot({ path: `${S}/watch-relogio.png` })

assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
