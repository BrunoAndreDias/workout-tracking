import { decimalText, parseTyped } from '../domain/numbers.ts'
import { useDraftText } from './useDraftText.ts'

type Props = {
  label: string
  decimal?: boolean
  min?: number
  placeholder?: string
  className?: string
} & ({ required: true; value: number; onCommit: (value: number) => void } | { required?: false; value: number | null; onCommit: (value: number | null) => void })

const countText = (value: number | null) => (value === null ? '' : decimalText(value))

export function CountField(props: Props) {
  const { label, decimal = false, min = 0, placeholder, className = 'count-input' } = props
  const parse = (text: string) => {
    const n = parseTyped(text, decimal, min)
    return n === null && props.required ? undefined : n
  }
  const commit = (n: number | null) => {
    if (!props.required) props.onCommit(n)
    else if (n !== null) props.onCommit(n)
  }
  const draft = useDraftText(props.value, countText, parse, commit)
  return (
    <input
      className={className}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      aria-label={label}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      {...draft}
    />
  )
}
