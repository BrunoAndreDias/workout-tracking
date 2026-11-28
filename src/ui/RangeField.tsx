import { rangeText } from '../domain/numbers.ts'
import { parseRepRange } from '../domain/workouts.ts'
import type { RepRange } from '../domain/workouts.ts'
import { useDraftText } from './useDraftText.ts'

const parse = (text: string) => parseRepRange(text) ?? undefined

export function RangeField({ value, label, onCommit }: { value: RepRange; label: string; onCommit: (value: RepRange) => void }) {
  const draft = useDraftText(value, rangeText, parse, onCommit)
  return <input className="count-input reps-input" type="text" aria-label={label} onFocus={(e) => e.currentTarget.select()} {...draft} />
}
