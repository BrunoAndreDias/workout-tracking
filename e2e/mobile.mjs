import { chromium } from 'playwright'
import { addFood } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = process.env.APP_URL ?? 'http://localhost:5180/'
const W = 390
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: 844 }, hasTouch: true, isMobile: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(URL)
await page.evaluate(() => localStorage.clear())
await page.reload()
const dialog = page.getByRole('dialog')
const fits = async (where) => assert(await page.evaluate((w) => document.documentElement.scrollWidth <= w, W), `no horizontal scroll at ${W} px (${where})`)

const add = (mealName, query, pick, grams) => addFood(page, mealName, query, pick, grams)

await add('Pequeno-almoço', 'flocos de aveia', 'Flocos de aveia')
await add('Pequeno-almoço', 'banana', 'Banana')
await add('Almoço', 'frango peito sem pele cozido', 'Frango, peito sem pele, cozido')
await add('Almoço', 'arroz cozido', 'Arroz cozido simples')
await page.screenshot({ path: `${S}/mobile-390-plan.png`, fullPage: true })
await fits('plan')

await page.getByRole('button', { name: 'Adicionar alimento ao Jantar', exact: true }).click()
await dialog.waitFor()
const box = await dialog.boundingBox()
assert(box.width === W && box.x === 0, 'add panel is full width')
await page.screenshot({ path: `${S}/mobile-390-add.png` })
await fits('add panel')
await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()

await page.getByRole('button', { name: 'Trocar Frango, peito sem pele, cozido' }).click()
await dialog.locator('.result').first().click()
assert(await dialog.getByRole('button', { name: 'Confirmar troca' }).isVisible(), 'confirm button visible with a pick')
await page.screenshot({ path: `${S}/mobile-390-swap.png` })
await fits('swap panel')
assert(errors.length === 0, 'no console errors: ' + errors.join(' / '))
await browser.close()
