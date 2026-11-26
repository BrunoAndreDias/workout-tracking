import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { appUrl, assert, rendered, seedStored } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = appUrl()
const fixture = JSON.parse(readFileSync('e2e/fixtures/treino-backup.json', 'utf8'))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
const crash = page.getByRole('heading', { name: 'Algo correu mal no Treino.' })

await seedStored(page, URL, fixture.stores)
await page.route('**/src/App.tsx*', (route) => route.abort())
await page.goto(URL)
await crash.waitFor()
assert(await page.getByText('Os teus dados continuam neste navegador.').count() === 1, 'a failed start shows the crash page')
await page.screenshot({ path: `${S}/crash-start.png` })

const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar dados' }).click()])
const file = JSON.parse(readFileSync(await download.path(), 'utf8'))
assert(download.suggestedFilename().startsWith('treino-'), 'Exportar dados downloads the Backup file')
assert(file.app === 'workout-tracking' && file.version === 1, 'the file is a Treino Backup')
assert(JSON.stringify(file.stores) === JSON.stringify(fixture.stores), 'the file holds every store, read straight from the browser')

await page.unroute('**/src/App.tsx*')
await page.route('**/src/ui/SyncLine.tsx*', (route) => route.fulfill({ contentType: 'text/javascript', body: "export function SyncLine() { throw new Error('crash test') }" }))
await page.getByRole('button', { name: 'Recarregar' }).click()
await crash.waitFor()
assert(await page.getByRole('button', { name: 'Exportar dados' }).count() === 1, 'a render that throws shows the crash page')

await page.unroute('**/src/ui/SyncLine.tsx*')
await page.getByRole('button', { name: 'Recarregar' }).click()
await rendered(page)
await page.getByRole('region', { name: 'Dados' }).waitFor()
assert(await crash.count() === 0, 'Recarregar starts the app again')

await browser.close()
