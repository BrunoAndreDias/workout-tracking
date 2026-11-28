import { useState } from 'react'
import type { Dispatch } from 'react'
import { newId } from '../domain/ids.ts'
import { SPLIT_IDS, SPLITS } from '../domain/splits.ts'
import type { IsoDate, WorkoutBlockId, WorkoutPlanId } from '../domain/types.ts'
import type { Split } from '../domain/workouts.ts'
import type { WorkoutAction } from '../domain/workoutReducer.ts'
import { splitDayNames } from './format.ts'

export function NewPlan({ count, today, onCreate, onCancel }: { count: number; today: IsoDate; onCreate: Dispatch<WorkoutAction>; onCancel: (() => void) | null }) {
  const defaultName = `Plano de treino ${count + 1}`
  const [name, setName] = useState(defaultName)
  const [split, setSplit] = useState<Split>('ppf')
  return (
    <section className="card new-plan" aria-labelledby="novo-plano-treino">
      <h2 id="novo-plano-treino" className="session-title">
        Novo plano de treino
      </h2>
      <label className="field">
        <span className="field-label">Nome</span>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="split-tiles" role="group" aria-label="Divisão">
        {SPLIT_IDS.map((s) => (
          <button key={s} type="button" className="tile split-tile" aria-pressed={split === s} onClick={() => setSplit(s)}>
            <span className="split-tile-label">{SPLITS[s].label}</span>
            <span className="tile-sub">{splitDayNames(s)}</span>
          </button>
        ))}
      </div>
      <p className="muted workout-empty">Cada dia vem com exercícios, séries e repetições. Troca o que quiseres depois.</p>
      <div className="day-start">
        <button
          type="button"
          className="primary"
          onClick={() => onCreate({ type: 'createPlan', planId: newId<WorkoutPlanId>(), blockId: newId<WorkoutBlockId>(), name: name.trim() || defaultName, split, today })}
        >
          Criar plano
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </section>
  )
}
