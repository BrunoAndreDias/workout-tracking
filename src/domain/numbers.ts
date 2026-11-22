const decimal = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2, useGrouping: false })
const oneDecimal = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })

const MAX_TYPED = 9999

export const roundKg = (kg: number) => Math.round(kg * 100) / 100

export const decimalText = (n: number) => decimal.format(n)

export const kgText = (kg: number) => `${decimalText(kg)} kg`

export const ratioText = (ratio: number) => oneDecimal.format(ratio)

export const rangeText = ({ min, max }: { readonly min: number; readonly max: number }) => (min === max ? `${min}` : `${min}–${max}`)

const DECIMAL = /^(\d+([.,]\d*)?|[.,]\d+)$/
const INTEGER = /^\d+$/

export function parseTyped(raw: string, allowDecimals: boolean): number | null | undefined {
  const text = raw.trim()
  if (text === '') return null
  if (!(allowDecimals ? DECIMAL : INTEGER).test(text)) return undefined
  const n = roundKg(Number(text.replace(',', '.')))
  return n <= MAX_TYPED ? n : undefined
}
