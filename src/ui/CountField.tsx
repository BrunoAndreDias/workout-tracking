import { useState } from 'react'
import { decimalText, parseTyped } from '../domain/numbers.ts'

interface Props {
  value: number | null
  /** Called with null when the box is emptied, unless `required`. */
  onCommit: (value: number | null) => void
  label: string
  /** Allows kg decimals, typed with a comma or a point and rounded to two places. */
  decimal?: boolean
  required?: boolean
  placeholder?: string
  className?: string
}

// Keeps the raw text while typing, as RangeField does, so "62," is not rewritten under the cursor.
export function CountField({ value, onCommit, label, decimal = false, required = false, placeholder, className = 'count-input' }: Props) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value === null ? '' : decimalText(value))
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
        const n = parseTyped(e.target.value, decimal)
        if (n !== undefined && (n !== null || !required)) onCommit(n)
      }}
      onBlur={() => setText(null)}
    />
  )
}
