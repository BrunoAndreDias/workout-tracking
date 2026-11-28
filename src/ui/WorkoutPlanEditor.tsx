import { useState } from 'react'
import type { Dispatch } from 'react'
import { newId } from '../domain/ids.ts'
import { SPLITS } from '../domain/splits.ts'
import type { IsoDate, WorkoutBlockId } from '../domain/types.ts'
import { currentBlock } from '../domain/blocks.ts'
import type { WorkoutBlock, WorkoutState } from '../domain/workouts.ts'
import type { WorkoutAction } from '../domain/workoutReducer.ts'
import { BlockEditor } from './BlockEditor.tsx'
import { plural, splitDayNames } from './format.ts'
import { NewPlan } from './NewPlan.tsx'
import { PlanTitle } from './PlanTitle.tsx'

interface Props {
  state: WorkoutState
  dispatch: Dispatch<WorkoutAction>
  today: IsoDate
}

export function WorkoutPlanEditor({ state, dispatch, today }: Props) {
  const [selectedId, setSelectedId] = useState<WorkoutBlockId | null>(null)
  const [creating, setCreating] = useState(false)
  const plan = state.plans.find((p) => p.id === state.activePlanId)
  const create = (action: WorkoutAction) => {
    dispatch(action)
    setCreating(false)
  }

  if (!plan) return <NewPlan count={state.plans.length} today={today} onCreate={create} onCancel={null} />

  const planId = plan.id
  const { block: current, position } = currentBlock(plan, state.sessions, today)
  const blocks: readonly WorkoutBlock[] = plan.blocks
  const block = blocks.find((b) => b.id === selectedId) ?? current
  const addBlock = () => {
    const blockId = newId<WorkoutBlockId>()
    dispatch({ type: 'addBlock', planId, blockId, copyOf: block.id })
    setSelectedId(blockId)
  }

  return (
    <>
      <div className="plan-bar">
        <nav className="tabs" aria-label="Planos de treino">
          {state.plans.map((p) => (
            <button
              key={p.id}
              type="button"
              className="tab"
              aria-current={p.id === planId && !creating ? 'page' : undefined}
              onClick={() => {
                setCreating(false)
                dispatch({ type: 'activatePlan', planId: p.id })
              }}
            >
              {p.name}
            </button>
          ))}
          <button type="button" className="tab tab-add" aria-current={creating ? 'page' : undefined} onClick={() => setCreating(true)}>
            + Novo plano
          </button>
        </nav>
        {!creating && (
          <div className="plan-actions">
            <button
              type="button"
              className="quiet-btn danger"
              onClick={() => {
                if (window.confirm(`Eliminar o plano de treino "${plan.name}"? Os treinos registados ficam.`)) dispatch({ type: 'deletePlan', planId })
              }}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {creating ? (
        <NewPlan count={state.plans.length} today={today} onCreate={create} onCancel={() => setCreating(false)} />
      ) : (
        <>
          <PlanTitle name={plan.name} onRename={(name) => dispatch({ type: 'renamePlan', planId, name })} />
          <p className="muted workout-plan-note">
            {SPLITS[plan.split].label}: {splitDayNames(plan.split)}. O plano ativo é o que aparece ao começar um treino.
          </p>

          <section className="card workout-blocks" aria-labelledby="blocos-treino">
            <header className="session-head">
              <h3 id="blocos-treino" className="blocks-title">
                Blocos
              </h3>
              <button type="button" className="text-btn" onClick={addBlock}>
                + Novo bloco
              </button>
            </header>
            <ul className="block-strip">
              {blocks.map((b) => {
                const isCurrent = position?.block.id === b.id
                return (
                  <li key={b.id}>
                    <button type="button" className="block-card" aria-pressed={b.id === block.id} aria-current={isCurrent ? 'true' : undefined} onClick={() => setSelectedId(b.id)}>
                      <span className="block-card-name">{b.name}</span>
                      <span className="block-card-meta">{plural(b.weeks, 'semana', 'semanas')}</span>
                      {isCurrent && (
                        <>
                          <span className="track" aria-hidden="true">
                            <span className="block-progress" style={{ width: `${(position.week / b.weeks) * 100}%` }} />
                          </span>
                          <span className="block-card-meta">
                            Semana {position.week} de {b.weeks}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="muted blocks-note">Só contam as semanas com treino. Uma semana sem treino não avança o bloco.</p>
            {!plan.start && <p className="muted blocks-note">Ainda não começaste. Usa "Começar aqui" no primeiro bloco.</p>}
          </section>

          <BlockEditor key={block.id} plan={plan} block={block} isCurrent={block.id === current.id} today={today} exercises={state.exercises} sessions={state.sessions} dispatch={dispatch} />
        </>
      )}
    </>
  )
}
