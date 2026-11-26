import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { appUrl, assert, openFresh, readStored } from './_driver.mjs'
const S = process.env.SHOTS ?? 'e2e/shots'
const URL = appUrl()
const CACHE = 'e2e/.cache/whisper'
const CLIP = resolve('e2e/fixtures/nota.wav')
mkdirSync(CACHE, { recursive: true })

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${CLIP}%noloop`],
})
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['microphone'] })

// The model is 250 MB. Fetch each remote file once, keep it on disk, and replay it from a local server:
// Chromium's devtools pipe cannot carry the 92 MB encoder inside a fulfilled response.
// Transformers.js sizes each file with a one-byte Range request, so the server answers ranges.
const cached = new Map()
const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', 'access-control-allow-headers': '*' }
const cacheServer = createServer((req, res) => {
  const entry = cached.get(req.url)
  if (!entry) { res.writeHead(404, cors).end(); return }
  const body = readFileSync(entry.file)
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '')
  const headers = { ...cors, 'content-type': entry.type, 'accept-ranges': 'bytes' }
  if (range) {
    const start = Number(range[1])
    const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1 })
    res.end(body.subarray(start, end + 1))
  } else {
    res.writeHead(200, { ...headers, 'content-length': body.length })
    res.end(body)
  }
})
await new Promise((ok) => cacheServer.listen(0, '127.0.0.1', ok))
const cacheOrigin = `http://127.0.0.1:${cacheServer.address().port}`
const appOrigin = new globalThis.URL(URL).origin
let downloaded = 0
await context.route((u) => u.origin !== appOrigin && u.origin !== cacheOrigin && u.protocol.startsWith('http'), async (route) => {
  const key = createHash('sha1').update(route.request().url()).digest('hex')
  const file = `${CACHE}/${key}.bin`
  const typeFile = `${CACHE}/${key}.type`
  if (!existsSync(typeFile)) {
    const { range: _range, ...headers } = route.request().headers()
    const res = await route.fetch({ headers, timeout: 0 })
    if (!res.ok()) return route.fulfill({ response: res })
    writeFileSync(file, await res.body())
    writeFileSync(typeFile, res.headers()['content-type'] ?? 'application/octet-stream')
    downloaded++
  }
  cached.set(`/${key}`, { file, type: readFileSync(typeFile, 'utf8') })
  await route.fulfill({ status: 307, headers: { ...cors, location: `${cacheOrigin}/${key}` } })
})

const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('dialog', (d) => d.accept())
page.on('crash', () => console.error('the page crashed'))
await openFresh(page, URL + '#treino')

const modelRequests = []
page.on('request', (r) => /huggingface|jsdelivr/.test(r.url()) && modelRequests.push(r.url()))
assert(modelRequests.length === 0, 'the app start loads no model files')

await page.getByRole('button', { name: 'Treino livre' }).click()
const notes = page.getByLabel('Notas do treino', { exact: true })
const field = notes.locator('xpath=..')
await notes.fill('Bom treino.')
await page.screenshot({ path: `${S}/dictation-desktop-light.png`, fullPage: true })

await field.getByRole('button', { name: 'Ditar nota' }).click()
await page.getByRole('button', { name: 'Parar ditado' }).waitFor()
assert(await page.getByRole('status').filter({ hasText: 'A ouvir…' }).count() === 1, 'the status line says A ouvir… while recording')
await page.waitForTimeout(11000) // the clip is 8 s of speech, then 5 s of silence
const stoppedAt = Date.now()
const micState = await page.evaluate(
  () => [...document.querySelectorAll('.dictate-btn')].map((b) => `${b.getAttribute('aria-label')}${b.disabled ? ' (disabled)' : ''}`).join(', ') +
    ` / status "${[...document.querySelectorAll('.dictate-status')].map((p) => p.textContent).join('|')}" at ${location.href}`,
)
assert(micState.startsWith('Parar ditado'), `still recording before the stop tap (${micState})`)
await page.getByRole('button', { name: 'Parar ditado' }).click()
await page.waitForFunction(() => document.querySelector('[aria-label="Notas do treino"]').value.length > 12, null, { timeout: 600_000 })
console.log(`transcribed ${(Date.now() - stoppedAt) / 1000} s after stop (${downloaded} files downloaded this run)`)

const text = await notes.inputValue()
console.log('note:', JSON.stringify(text))
assert(text.startsWith('Bom treino. '), 'the dictation follows the existing note after a space')
assert(/supino/i.test(text), 'the note holds the words of the clip')
assert((await readStored(page)).workoutSessions.sessions[0].note.text === text, 'the dictated note is persisted')
assert(await page.locator('.dictate-status').first().textContent() === '', 'the status line is empty again')
await page.screenshot({ path: `${S}/dictation-desktop-after.png`, fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: `${S}/dictation-phone-light.png`, fullPage: true })
await page.getByRole('button', { name: 'Mudar para modo escuro' }).click()
await page.screenshot({ path: `${S}/dictation-phone-dark.png`, fullPage: true })
await page.setViewportSize({ width: 1280, height: 900 })
await page.screenshot({ path: `${S}/dictation-desktop-dark.png`, fullPage: true })

assert(errors.length === 0, `no page errors (${errors.join('; ')})`)
await browser.close()
cacheServer.close()
