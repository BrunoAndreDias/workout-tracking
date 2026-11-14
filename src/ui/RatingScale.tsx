import { RATINGS } from '../domain/rating.ts'
import type { Rating } from '../domain/rating.ts'

interface Props {
  /** Names each button, as in `Sono: Bem`. */
  label: string
  value: Rating | undefined
  /** Null when the chosen rating is tapped again, which clears it. */
  onPick: (rating: Rating | null) => void
}

/** The 1–5 scale in words, one tap to rate. */
export function RatingScale({ label, value, onPick }: Props) {
  return (
    <div className="rating-scale">
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          className="rating-pick"
          aria-pressed={value === r.value}
          aria-label={`${label}: ${r.label}`}
          onClick={() => onPick(value === r.value ? null : r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
