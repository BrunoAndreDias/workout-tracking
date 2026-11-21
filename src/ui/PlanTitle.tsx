import { useState } from 'react'
import { PencilIcon } from './icons.tsx'

interface Props {
  name: string
  onRename: (name: string) => void
}

/** The Workout Plan's title, with a pencil that opens a field to rename it. */
export function PlanTitle({ name, onRename }: Props) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft === null) {
    return (
      <div className="plan-title-row">
        <h2 className="workout-plan-title">{name}</h2>
        <button type="button" className="icon-btn" aria-label="Mudar o nome do plano" title="Mudar nome" onClick={() => setDraft(name)}>
          <PencilIcon />
        </button>
      </div>
    )
  }

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) onRename(trimmed)
    setDraft(null)
  }
  return (
    <form
      className="plan-title-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <input
        className="field-input plan-title-input"
        autoFocus
        aria-label="Nome do plano de treino"
        value={draft}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setDraft(null)
        }}
      />
      <button type="submit" className="primary">
        Guardar
      </button>
      <button type="button" className="secondary" onClick={() => setDraft(null)}>
        Cancelar
      </button>
    </form>
  )
}
