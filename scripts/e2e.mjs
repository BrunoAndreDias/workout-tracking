// Runs every e2e/*.mjs script against its own Vite server, so `npm run check` proves the browser flows too.
// Usage: node scripts/e2e.mjs [name ...]   (names without .mjs; none runs them all)
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync } from 'node:fs'
import { startTestServer } from './testServer.mjs'

const names = process.argv.slice(2)
const scripts = readdirSync('e2e')
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
  .filter((f) => names.length === 0 || names.includes(f.replace(/\.mjs$/, '')))
if (scripts.length === 0) throw new Error(`no e2e script matches ${names.join(', ')}`)

mkdirSync('e2e/shots', { recursive: true })
const server = await startTestServer({ port: process.env.E2E_PORT })
process.on('exit', server.stop)

const failed = []
for (const script of scripts) {
  console.log(`\n== e2e/${script}`)
  const run = spawnSync('node', [`e2e/${script}`], { stdio: 'inherit', env: { ...server.env, APP_URL: server.url } })
  if (run.status !== 0) failed.push(script)
}
server.stop()
if (failed.length) {
  console.error(`\ne2e failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`\ne2e passed: ${scripts.length} scripts`)
