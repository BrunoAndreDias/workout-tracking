import { useState } from 'react'
import type { ChangeEvent } from 'react'

export function useDraftText<T>(value: T, format: (value: T) => string, parse: (text: string) => T | undefined, onCommit: (value: T) => void) {
  const [text, setText] = useState<string | null>(null)
  return {
    value: text ?? format(value),
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setText(e.target.value)
      const parsed = parse(e.target.value)
      if (parsed !== undefined) onCommit(parsed)
    },
    onBlur: () => setText(null),
  }
}
