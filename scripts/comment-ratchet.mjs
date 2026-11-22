import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const PATH = 'lint/comment-baseline.json'
const init = process.argv.includes('--init')
const baseline = init ? {} : JSON.parse(readFileSync(PATH, 'utf8'))
if (init) writeFileSync(PATH, '{}\n')

let out
try {
  out = execFileSync('npx', ['oxlint', '-f', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
} catch (e) {
  out = e.stdout
}
const counts = {}
for (const d of JSON.parse(out).diagnostics) {
  const m = d.code?.includes('no-comments') && d.message.match(/^comments=(\d+) allowed=(\d+)/)
  if (m) counts[d.filename] = Number(m[1])
}

const next = {}
const raised = []
for (const [file, count] of Object.entries(counts)) {
  if (!init && count > (baseline[file] ?? 0)) raised.push(`${file}: ${count} > ${baseline[file] ?? 0}`)
  else if (count > 0) next[file] = count
}
for (const [file, count] of Object.entries(baseline)) if (!(file in counts) && existsSync(file)) next[file] = count
if (raised.length) {
  console.error(`The ratchet only goes down. Delete these comments instead:\n${raised.join('\n')}`)
  process.exit(1)
}
const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(PATH, `${JSON.stringify(sorted, null, 2)}\n`)
const total = Object.values(sorted).reduce((a, b) => a + b, 0)
console.log(`${PATH}: ${Object.keys(sorted).length} files, ${total} comments allowed.`)
