import { useState } from 'react'
import { formatDecimal } from './format.ts'

interface Props {
  value: number | null
  /** Called with null when the box is emptied, unless `required`. */
  onCommit: (value: number | null) => void
  label: string
  /** Allows one decimal, typed with a comma or a point, as for kg. */
  decimal?: boolean
  required?: boolean
  placeholder?: string
  className?: string
}

const parse = (raw: string, decimal: boolean): number | null | undefined => {
  if (raw.trim() === '') return null
  const n = Number(raw.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 9999 && (decimal || Number.isInteger(n)) ? n : undefined
}

// Keeps the raw text while typing, as NumberField does, so "62," is not rewritten under the cursor.
export function CountField({ value, onCommit, label, decimal = false, required = false, placeholder, className = 'count-input' }: Props) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value === null ? '' : formatDecimal(value))
  return (
    <input
      className={className}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      placeholder={placeholder}
      value={shown}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value)
        const n = parse(e.target.value, decimal)
        if (n !== undefined && (n !== null || !required)) onCommit(n)
      }}
      onBlur={() => setText(null)}
    />
  )
}
