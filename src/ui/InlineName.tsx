import { useState } from 'react'

interface Props {
  name: string
  onRename: (name: string) => void
  label: string
  className?: string
}

export function InlineName({ name, onRename, label, className }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  if (!editing) {
    return (
      <button
        type="button"
        className={`inline-name ${className ?? ''}`}
        onClick={() => {
          setDraft(name)
          setEditing(true)
        }}
        aria-label={`${label}: ${name}. Clique para renomear`}
        title="Renomear"
      >
        {name}
      </button>
    )
  }

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) onRename(trimmed)
    setEditing(false)
  }
  return (
    <input
      className={`inline-name-input ${className ?? ''}`}
      autoFocus
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
    />
  )
}
