import { useState } from 'react'
import type { Dispatch } from 'react'
import { newId } from '../domain/plans.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId, WorkoutPlanId } from '../domain/types.ts'
import { blockExercises, currentBlock, parseRepRange, parseRir } from '../domain/workouts.ts'
import type { RepRange, RirTarget, WorkoutAction, WorkoutBlock, WorkoutPlan, WorkoutState } from '../domain/workouts.ts'
import { CountField } from './CountField.tsx'
import { ExerciseAdder } from './ExerciseAdder.tsx'
import { formatRange, plural } from './format.ts'
import { CloseIcon } from './icons.tsx'
import { InlineName } from './InlineName.tsx'

function RangeField<T extends RepRange | RirTarget>({ value, label, parse, onCommit, optional = false }: { value: T | null; label: string; parse: (text: string) => T | null; onCommit: (value: T | null) => void; optional?: boolean }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      className="count-input reps-input"
      type="text"
      aria-label={label}
      placeholder={optional ? '—' : undefined}
      value={text ?? (value ? formatRange(value) : '')}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = parse(e.target.value)
        if (parsed || (optional && e.target.value.trim() === '')) onCommit(parsed)
      }}
      onBlur={() => setText(null)}
    />
  )
}

interface Props {
  state: WorkoutState
  dispatch: Dispatch<WorkoutAction>
  today: IsoDate
}

export function WorkoutPlanEditor({ state, dispatch, today }: Props) {
  const [selectedId, setSelectedId] = useState<WorkoutBlockId | null>(null)
  const plan = state.plans.find((p) => p.id === state.activePlanId)
  const createPlan = () => dispatch({ type: 'createPlan', planId: newId<WorkoutPlanId>(), blockId: newId<WorkoutBlockId>(), name: `Plano de treino ${state.plans.length + 1}` })

  if (!plan) {
    return (
      <section className="card day-empty" aria-labelledby="sem-plano-treino">
        <h2 id="sem-plano-treino" className="session-title">Sem plano de treino</h2>
        <p className="muted">Escreve aqui o teu plano: os dias de treino e, em cada um, os exercícios com séries e repetições.</p>
        <div className="day-start">
          <button type="button" className="primary" onClick={createPlan}>
            Criar plano de treino
          </button>
        </div>
      </section>
    )
  }

  const planId = plan.id
  const { block: current, position } = currentBlock(plan, state.sessions, today)
  const block = plan.blocks.find((b) => b.id === selectedId) ?? current
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
            <button key={p.id} type="button" className="tab" aria-current={p.id === planId ? 'page' : undefined} onClick={() => dispatch({ type: 'activatePlan', planId: p.id })}>
              {p.name}
            </button>
          ))}
          <button type="button" className="tab tab-add" onClick={createPlan}>
            + Novo plano
          </button>
        </nav>
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
      </div>

      <h2 className="workout-plan-title">
        <InlineName name={plan.name} label="Nome do plano de treino" onRename={(name) => dispatch({ type: 'renamePlan', planId, name })} />
      </h2>
      <p className="muted workout-plan-note">O plano ativo é o que aparece ao começar um treino.</p>

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
          {plan.blocks.map((b) => {
            const current = position?.block.id === b.id
            return (
              <li key={b.id}>
                <button type="button" className="block-card" aria-pressed={b.id === block.id} aria-current={current ? 'true' : undefined} onClick={() => setSelectedId(b.id)}>
                  <span className="block-card-name">{b.name}</span>
                  <span className="block-card-meta">{plural(b.weeks, 'semana', 'semanas')}</span>
                  {current && (
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

      <BlockEditor key={block.id} plan={plan} block={block} today={today} exercises={state.exercises} dispatch={dispatch} />
    </>
  )
}

interface BlockProps {
  plan: WorkoutPlan
  block: WorkoutBlock
  today: IsoDate
  exercises: WorkoutState['exercises']
  dispatch: Dispatch<WorkoutAction>
}

function BlockEditor({ plan, block, today, exercises, dispatch }: BlockProps) {
  const planId = plan.id
  const blockId = block.id
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const index = plan.blocks.indexOf(block)
  const before = index > 0 ? new Set(blockExercises(plan.blocks[index - 1])) : null
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
          {plan.blocks.length > 1 && (
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
              label={`Semanas de ${block.name}`}
              onCommit={(n) => n && dispatch({ type: 'setBlockWeeks', planId, blockId, weeks: n })}
            />
          </label>
          <button type="button" className="secondary" onClick={startHere}>
            Começar aqui
          </button>
        </div>
        <fieldset className="block-rir">
          <legend className="field-label">RIR por semana</legend>
          <ol className="block-rir-weeks">
            {block.rir.map((rir, i) => (
              <li key={i} className="block-rir-week">
                <span className="unit">S{i + 1}</span>
                <RangeField value={rir} optional label={`RIR da semana ${i + 1} de ${block.name}`} parse={parseRir} onCommit={(r) => dispatch({ type: 'setBlockRir', planId, blockId, week: i + 1, rir: r })} />
              </li>
            ))}
          </ol>
        </fieldset>
      </section>

      {block.days.map((day) => {
        const dayId = day.id
        return (
          <section key={dayId} className="card workout-day" aria-label={day.name}>
            <header className="session-head">
              <h3 className="session-title">
                <InlineName name={day.name} label="Nome do dia de treino" onRename={(name) => dispatch({ type: 'renameDay', planId, blockId, dayId, name })} />
              </h3>
              <button
                type="button"
                className="link-btn danger"
                onClick={() => {
                  if (window.confirm(`Remover o dia "${day.name}"?`)) dispatch({ type: 'removeDay', planId, blockId, dayId })
                }}
              >
                Remover dia
              </button>
            </header>
            {day.exercises.length === 0 && <p className="muted workout-empty">Sem exercícios. Escreve o nome de um abaixo.</p>}
            <ul className="planned-list">
              {day.exercises.map((p) => {
                const name = names.get(p.exerciseId) ?? 'Exercício desconhecido'
                const isNew = before !== null && !before.has(p.exerciseId)
                const set = (change: Partial<typeof p>) => dispatch({ type: 'setPlannedExercise', planId, blockId, dayId, planned: { ...p, ...change } })
                return (
                  <li key={p.exerciseId} className="planned">
                    <span className={isNew ? 'planned-name planned-new' : 'planned-name'}>
                      {name}
                      {isNew && ' · novo'}
                    </span>
                    <span className="planned-fields">
                      <CountField value={p.sets} required label={`Séries de ${name}`} onCommit={(n) => n && set({ sets: n })} />
                      <span className="unit">×</span>
                      <RangeField value={p.reps} label={`Repetições de ${name}`} parse={parseRepRange} onCommit={(reps) => reps && set({ reps })} />
                      <span className="unit">reps</span>
                    </span>
                    <button type="button" className="icon-btn" aria-label={`Remover ${name} de ${day.name}`} onClick={() => dispatch({ type: 'removePlannedExercise', planId, blockId, dayId, exerciseId: p.exerciseId })}>
                      <CloseIcon />
                    </button>
                  </li>
                )
              })}
            </ul>
            <ExerciseAdder exercises={exercises} onAdd={(name) => dispatch({ type: 'addPlannedExercise', planId, blockId, dayId, name, newExerciseId: newId<ExerciseId>() })} />
          </section>
        )
      })}

      <button type="button" className="add-meal" onClick={() => dispatch({ type: 'addDay', planId, blockId, dayId: newId<WorkoutDayId>(), name: `Dia ${block.days.length + 1}` })}>
        + Adicionar dia
      </button>
    </>
  )
}
