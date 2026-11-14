import { HEALTH_METRICS } from '../domain/health.ts'
import type { HealthLog } from '../domain/health.ts'
import type { IsoDate } from '../domain/types.ts'
import { periodOf, watchSummary } from '../domain/watchSummary.ts'
import type { PeriodKind, WatchSummary } from '../domain/watchSummary.ts'
import { formatDayMonth, formatDayRange, formatMonthName, formatWatchValue, plural } from './format.ts'

/** The quiet month column is narrower and muted, behind the day and week. */
const COLUMNS: readonly { kind: PeriodKind; title: string; sub: (s: WatchSummary) => string; quiet: boolean }[] = [
  { kind: 'day', title: 'Dia', sub: (s) => formatDayMonth(s.period.from), quiet: false },
  { kind: 'week', title: 'Semana', sub: (s) => formatDayRange(s.period.from, s.period.to), quiet: false },
  { kind: 'month', title: 'Mês', sub: (s) => formatMonthName(s.period.from), quiet: true },
]

interface Props {
  date: IsoDate
  today: IsoDate
  health: HealthLog
}

/** The Apple Watch values of the date, its week and its month, each averaged over the days that have it. */
export function WatchCard({ date, today, health }: Props) {
  const summaries = COLUMNS.map((c) => watchSummary(periodOf(c.kind, date), health, today))
  return (
    <section className="card ov-card" aria-labelledby="ov-relogio">
      <h2 id="ov-relogio" className="ov-title">
        Relógio
      </h2>
      <table className="ruled-table ov-table" aria-labelledby="ov-relogio">
        <thead>
          <tr>
            <td />
            {COLUMNS.map((c, i) => (
              <th key={c.kind} scope="col" className={c.quiet ? 'ov-quiet' : undefined}>
                <span className="ov-col">{c.title}</span>
                <span className="ov-sub">{c.sub(summaries[i])}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HEALTH_METRICS.map((m) => (
            <tr key={m.key}>
              <th scope="row">{m.unit === null ? m.label : `${m.label} (${m.unit})`}</th>
              {summaries.map((s, i) => {
                const value = s.metrics[m.key]
                return (
                  <td key={s.period.kind} className={COLUMNS[i].quiet ? 'ov-quiet' : undefined}>
                    <span className="ov-value">{value ? formatWatchValue(m.key, value.average) : '—'}</span>
                    {value && s.period.kind !== 'day' && <span className="ov-sub">{plural(value.days, 'dia', 'dias')}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
