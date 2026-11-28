import { chromium } from 'playwright'
import { appUrl, assert, createWorkoutPlan, exactly, noHorizontalScroll, openFresh, openPage, openWorkoutTab, SHOTS } from './_driver.mjs'
const URL = appUrl()
const browser = await chromium.launch()
const { page, noErrors } = await openPage(browser)
await openFresh(page, URL)

await openWorkoutTab(page, 'Plano de treino')
await createWorkoutPlan(page, { name: 'Força', days: 3 })
const weekly = page.getByRole('region', { name: 'Músculos por semana', exact: true })
const ranked = weekly.getByRole('list', { name: /do que tem mais séries/ })
const gaps = weekly.getByRole('list', { name: 'Grupos sem séries' })
const rowOf = (name) => weekly.locator('.volume-row', { has: page.locator('.muscle-name', { hasText: exactly(name) }) })
const text = (loc, sel) => loc.locator(sel).allTextContents().then((t) => t.join('|'))
const pressed = () => text(weekly.locator('.volume-row[aria-pressed="true"]'), '.muscle-name')
const front = weekly.locator('.volume-figure').first()
const back = weekly.locator('.volume-figure').nth(1)

assert(await text(ranked, '.muscle-name') === 'Costas|Ombros|Peito|Bíceps|Tríceps|Abdominais|Quadríceps|Posteriores|Glúteos|Gémeos', 'the trained groups rank by weekly sets, equal ones in the picker’s order')
assert(await text(ranked, '.volume-sets') === '12 séries|12 séries|6 séries|6 séries|6 séries|6 séries|3 séries|3 séries|3 séries|3 séries', 'each with its weekly sets')
assert(await text(weekly.locator('.volume-row[data-top]'), '.muscle-name') === 'Costas|Ombros', 'every group tied for the most sets stands out')
assert(await text(rowOf('Costas'), '.volume-zone') === 'na zona' && await text(rowOf('Peito'), '.volume-zone') === 'abaixo', 'a tag says where the sets fall against 10–20')
assert(await text(gaps, '.volume-row') === 'Antebraçossem séries', 'an untrained group is listed apart, with no sets')
assert((await back.locator('[data-group="back"]').first().getAttribute('style')).includes('--volume: 100%') && (await front.locator('[data-group="chest"]').first().getAttribute('style')).includes('--volume: 61%'), 'the body shades each group by its sets over the most')
assert(await front.locator('[data-group="forearms"][data-untrained]').count() > 0, 'and outlines an untrained group')

await rowOf('Costas').click()
assert(await pressed() === 'Costas' && await text(rowOf('Costas'), '.volume-detail') === '20% das séries da semana · Pull · Full body', 'a row picks its group and says its share and days')
assert(await weekly.locator('.volume-row[data-dim]').count() === 10 && await back.locator('[data-group="back"][data-selected]').count() > 0, 'the other rows dim, and the body picks the group too')
await rowOf('Costas').click()
assert(await pressed() === '' && await weekly.locator('svg[data-picked]').count() === 0, 'the same row again clears it')

await front.locator('[data-group="chest"]').first().click()
assert(await pressed() === 'Peito', 'a tap on the body picks its group in the list')
await front.locator('[data-group="chest"]').nth(2).click()
assert(await pressed() === '', 'the mirrored half takes the tap too, and clears it')
await front.locator('[data-group="forearms"]').first().click()
assert(await pressed() === 'Antebraços' && await text(rowOf('Antebraços'), '.volume-detail') === 'Nenhum exercício do plano trabalha este grupo.', 'an untrained group says no Exercise trains it')
await weekly.screenshot({ path: `${SHOTS}/muscle-volume.png` })

const notes = await weekly.locator('.volume-notes li').allTextContents()
assert(notes.join(' / ') === 'Sem séries no plano: Antebraços. / Abaixo de 10 séries por semana: Peito (6), Quadríceps (3), Posteriores (3), Bíceps (6), Tríceps (6), Abdominais (6), Glúteos (3), Gémeos (3). / Costas tem 2,0× as séries de Peito.', 'Onde podes olhar notes the gaps, what is under 10 sets and an uneven pair')
assert(await weekly.getByText('Não é uma regra.', { exact: false }).count() === 1, 'and says the range is only a reference')

for (const width of [390, 375]) {
  await page.setViewportSize({ width, height: 844 })
  assert(await noHorizontalScroll(page), `Músculos por semana has no horizontal scroll at ${width} px`)
}
await weekly.screenshot({ path: `${SHOTS}/muscle-volume-mobile.png` })

noErrors()
await browser.close()
