const int = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 })
const one = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
const oneFixed = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const two = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 })

export const formatKcal = (v: number) => int.format(v)
export const formatGrams = (v: number) => one.format(v)
/** Fixed one decimal, for macro columns where aligned digits matter. */
export const formatMacro = (v: number) => oneFixed.format(v)
export const formatPercent = (fraction: number) => `${int.format(fraction * 100)} %`

export function formatSigned(v: number, format: (n: number) => string): string {
  const rounded = Number(format(Math.abs(v)).replace(',', '.').replace(/\s/g, ''))
  if (rounded === 0) return format(0)
  return `${v > 0 ? '+' : '−'}${format(Math.abs(v))}`
}

export function formatAmount(v: number, unit: string): string {
  if (unit === 'kcal' || unit === 'kJ') return int.format(v)
  if (v >= 100) return int.format(v)
  if (v >= 10) return one.format(v)
  return two.format(v)
}

export const formatPortionCount = (p: number) => one.format(Math.round(p * 10) / 10)
