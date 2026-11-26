// What scripts/perf.mjs measures, and how it writes perf/STATUS.md from perf/history.jsonl.
import { writeFileSync } from 'node:fs'

export const METRICS = [
  { key: 'coldLoadMs', label: 'First visit, until Registo', unit: 'ms' },
  { key: 'warmLoadMs', label: 'Reopen, until Registo', unit: 'ms' },
  { key: 'fcpMs', label: 'First visit, first paint', unit: 'ms' },
  { key: 'lcpMs', label: 'First visit, largest paint', unit: 'ms' },
  { key: 'startSessionMs', label: 'Começar <day>', unit: 'ms' },
  { key: 'tickMs', label: 'Tick a set ✓', unit: 'ms' },
  { key: 'typeKgMs', label: 'Type in a kg field', unit: 'ms' },
  { key: 'planTabMs', label: 'Open Plano de treino', unit: 'ms' },
  { key: 'registoTabMs', label: 'Back to Registo', unit: 'ms' },
  { key: 'jsKB', label: 'JS sent, first visit', unit: 'KB' },
  { key: 'cssKB', label: 'CSS sent, first visit', unit: 'KB' },
  { key: 'fontKB', label: 'Fonts sent, first visit', unit: 'KB' },
  { key: 'apiKB', label: 'Stores sent, first visit', unit: 'KB' },
]

const delta = (now, then) => (then ? `${now - then > 0 ? '+' : ''}${(((now - then) / then) * 100).toFixed(0)}%` : '—')

export function writeStatus(history, latest) {
  const base = history[0]
  const prev = history.length > 1 ? history[history.length - 2] : null
  const rows = METRICS.map(({ key, label, unit }) => {
    const m = latest.metrics[key]
    return `| ${label} | ${base.metrics[key]?.median ?? '—'} | ${prev?.metrics[key]?.median ?? '—'} | **${m.median}** (${m.min}–${m.max}) | ${unit} | ${delta(m.median, prev?.metrics[key]?.median)} | ${delta(m.median, base.metrics[key]?.median)} |`
  })
  const runs = history.slice().reverse().map((e) => `| ${e.at.slice(0, 16).replace('T', ' ')} | \`${e.commit}\` | ${e.label || ''} | ${e.metrics.warmLoadMs.median} | ${e.metrics.tickMs.median} | ${e.metrics.planTabMs.median} | ${e.metrics.jsKB.median} | ${e.errors.length} |`)
  writeFileSync('perf/STATUS.md', `# Performance status

Written by \`npm run perf\` (\`scripts/perf.mjs\`). Do not edit by hand; rerun it.

Last run ${latest.at.slice(0, 16).replace('T', ' ')} UTC on \`${latest.commit}\`${latest.label ? ` (${latest.label})` : ''}. Median of ${latest.runs} runs, range in brackets, ${latest.errors.length} errors.

**Workload.** The production build (\`server/serve.ts\`) at 390 × 844 with ${latest.cpuSlowdown}× CPU slowdown, holding a year of history: ${latest.work.sessions} sessions (${latest.work.sets} sets) on a 4-day plan of 6 blocks. "First visit" is an empty browser; "Reopen" is a reload with the stores and assets already cached. Interactions are the main-thread time from the event until the change is in the DOM and laid out.

| Metric | Baseline | Previous | Now | Unit | vs previous | vs baseline |
|---|---|---|---|---|---|---|
${rows.join('\n')}

Baseline is \`${base.commit}\` from ${base.at.slice(0, 10)}.

## Runs

| When (UTC) | Commit | Label | Reopen ms | Tick ms | Plano ms | JS KB | Errors |
|---|---|---|---|---|---|---|---|
${runs.join('\n')}
`)
}
