import { addDays } from '../domain/dates.ts'
import type { IsoDate } from '../domain/types.ts'
import { formatLongDate } from './format.ts'
import { ChevronIcon } from './icons.tsx'

interface Props {
  date: IsoDate
  today: IsoDate
  onDate: (date: IsoDate) => void
  label: string
}

/** Previous and next day around the date, never past today. */
export function DateStepper({ date, today, onDate, label }: Props) {
  return (
    <section className="card date-stepper" aria-label={label}>
      <button type="button" className="icon-btn" aria-label="Dia anterior" onClick={() => onDate(addDays(date, -1))}>
        <ChevronIcon left />
      </button>
      <div className="date-stepper-title">
        <h2 className="cal-title">
          <span className="date-title">{formatLongDate(date)}</span>
        </h2>
        {date !== today && (
          <button type="button" className="link-btn" onClick={() => onDate(today)}>
            Voltar a hoje
          </button>
        )}
      </div>
      <button type="button" className="icon-btn" aria-label="Dia seguinte" disabled={date >= today} onClick={() => onDate(addDays(date, 1))}>
        <ChevronIcon left={false} />
      </button>
    </section>
  )
}
