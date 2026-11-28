import { useState } from 'react'
import type { Dispatch } from 'react'
import { LIGHT_RIR_EXTRA } from '../domain/splits.ts'
import type { IsoDate } from '../domain/types.ts'
import { blockExercises } from '../domain/blocks.ts'
import type { WorkoutBlock, WorkoutDay, WorkoutPlan, WorkoutSession, WorkoutState } from '../domain/workouts.ts'
import type { WorkoutAction } from '../domain/workoutReducer.ts'
import { BlockMuscles } from './BlockMuscles.tsx'
import { CountField } from './CountField.tsx'
import { DayEditor } from './DayEditor.tsx'
import { InlineName } from './InlineName.tsx'

interface BlockProps {
  plan: WorkoutPlan
  block: WorkoutBlock
  isCurrent: boolean
  today: IsoDate
  exercises: WorkoutState['exercises']
  sessions: readonly WorkoutSession[]
  dispatch: Dispatch<WorkoutAction>
}

export function BlockEditor({ plan, block, isCurrent, today, exercises, sessions, dispatch }: BlockProps) {
  const [dayIndex, setDayIndex] = useState(0)
  const planId = plan.id
  const blockId = block.id
  const blocks: readonly WorkoutBlock[] = plan.blocks
  const index = blocks.indexOf(block)
  const before = index > 0 ? new Set(blockExercises(blocks[index - 1])) : null
  const days: readonly WorkoutDay[] = block.days
  const day = days[dayIndex] ?? days[0]
  const startHere = () => {
    if (plan.start && !window.confirm(`Recomeçar o ciclo no ${block.name} esta semana?`)) return
    dispatch({ type: 'setCycleStart', planId, blockId, since: today })
  }

  return (
    <>
      <section className="card workout-block" aria-labelledby="bloco-selecionado">
        <header className="session-head">
          <h3 id="bloco-selecionado" className="session-title">
            <InlineName name={block.name} label="Nome do bloco" onRename={(name) => dispatch({ type: 'renameBlock', planId, blockId, name })} />
          </h3>
          {blocks.length > 1 && (
            <button
              type="button"
              className="link-btn danger"
              onClick={() => {
                if (window.confirm(`Remover o ${block.name} e os seus dias? Os treinos registados ficam.`)) dispatch({ type: 'removeBlock', planId, blockId })
              }}
            >
              Remover bloco
            </button>
          )}
        </header>
        <div className="block-fields">
          <label className="block-field">
            <span className="field-label">Semanas</span>
            <CountField
              value={block.weeks}
              required
              min={1}
              label={`Semanas de ${block.name}`}
              onCommit={(weeks) => dispatch({ type: 'setBlockWeeks', planId, blockId, weeks })}
            />
          </label>
          <button type="button" className="secondary" onClick={startHere}>
            Começar aqui
          </button>
        </div>
        <label className="block-light">
          <input type="checkbox" checked={block.light} onChange={(e) => dispatch({ type: 'setBlockLight', planId, blockId, light: e.target.checked })} />
          <span>
            Semana leve <span className="hint">mais {LIGHT_RIR_EXTRA} RIR em cada exercício, para descarregar</span>
          </span>
        </label>
      </section>

      <div className="plan-bar">
        <nav className="tabs" aria-label={`Dias de ${block.name}`}>
          {days.map((d, i) => (
            <button key={d.id} type="button" className="tab" aria-current={d.id === day.id ? 'page' : undefined} onClick={() => setDayIndex(i)}>
              {d.name}
            </button>
          ))}
        </nav>
      </div>
      <DayEditor key={day.id} planId={planId} blockId={blockId} day={day} before={before} exercises={exercises} runs={isCurrent ? sessions : null} today={today} dispatch={dispatch} />
      <BlockMuscles days={days} exercises={exercises} />
    </>
  )
}
