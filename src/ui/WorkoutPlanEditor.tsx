import { useState } from 'react'
import type { Dispatch } from 'react'
import { newId } from '../domain/plans.ts'
import { defaultRole, ROLE_LABEL, ROLES, SPLIT_IDS, SPLITS } from '../domain/splits.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId, WorkoutPlanId } from '../domain/types.ts'
import { blockExercises, currentBlock, parseRepRange, parseRir } from '../domain/workouts.ts'
import type { RepRange, RirTarget, Role, Split, WorkoutAction, WorkoutBlock, WorkoutDay, WorkoutPlan, WorkoutState } from '../domain/workouts.ts'
import { CountField } from './CountField.tsx'
import { ExercisePicker } from './ExercisePicker.tsx'
import { formatRange, plural } from './format.ts'
import { CloseIcon, PlusIcon } from './icons.tsx'
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

function NewPlan({ count, dispatch, onCancel }: { count: number; dispatch: Dispatch<WorkoutAction>; onCancel: (() => void) | null }) {
  const [name, setName] = useState(`Plano de treino ${count + 1}`)
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
            <span className="tile-sub">{(SPLITS[s].days as readonly { name: string }[]).map((d) => d.name).join(' · ')}</span>
          </button>
        ))}
      </div>
      <p className="muted workout-empty">Cada dia vem com exercícios, séries e repetições. Troca o que quiseres depois.</p>
      <div className="day-start">
        <button
          type="button"
          className="primary"
          onClick={() => dispatch({ type: 'createPlan', planId: newId<WorkoutPlanId>(), blockId: newId<WorkoutBlockId>(), name: name.trim() || `Plano de treino ${count + 1}`, split })}
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

export function WorkoutPlanEditor({ state, dispatch, today }: Props) {
  const [selectedId, setSelectedId] = useState<WorkoutBlockId | null>(null)
  const [creating, setCreating] = useState(false)
  const plan = state.plans.find((p) => p.id === state.activePlanId)
  const create = (action: WorkoutAction) => {
    dispatch(action)
    setCreating(false)
  }

  if (!plan) return <NewPlan count={state.plans.length} dispatch={create} onCancel={null} />

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
        <NewPlan count={state.plans.length} dispatch={create} onCancel={() => setCreating(false)} />
      ) : (
        <>
          <h2 className="workout-plan-title">
            <InlineName name={plan.name} label="Nome do plano de treino" onRename={(name) => dispatch({ type: 'renamePlan', planId, name })} />
          </h2>
          <p className="muted workout-plan-note">
            {SPLITS[plan.split].label}: {(SPLITS[plan.split].days as readonly { name: string }[]).map((d) => d.name).join(' · ')}. O plano ativo é o que aparece ao começar um treino.
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

          <BlockEditor key={block.id} plan={plan} block={block} today={today} exercises={state.exercises} dispatch={dispatch} />
        </>
      )}
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

      <div className="plan-bar">
        <nav className="tabs" aria-label={`Dias de ${block.name}`}>
          {days.map((d, i) => (
            <button key={d.id} type="button" className="tab" aria-current={d.id === day.id ? 'page' : undefined} onClick={() => setDayIndex(i)}>
              {d.name}
            </button>
          ))}
        </nav>
      </div>
      <DayEditor key={day.id} planId={planId} blockId={blockId} day={day} before={before} exercises={exercises} dispatch={dispatch} />
    </>
  )
}

interface DayProps {
  planId: WorkoutPlanId
  blockId: WorkoutBlockId
  day: WorkoutDay
  /** The Exercises of the block before, to mark the new ones; null for the first block. */
  before: ReadonlySet<ExerciseId> | null
  exercises: WorkoutState['exercises']
  dispatch: Dispatch<WorkoutAction>
}

function DayEditor({ planId, blockId, day, before, exercises, dispatch }: DayProps) {
  const [picking, setPicking] = useState<{ swapping: ExerciseId | null } | null>(null)
  const dayId: WorkoutDayId = day.id
  const names = new Map(exercises.map((e) => [e.id, e.name]))
  const nameOf = (id: ExerciseId) => names.get(id) ?? 'Exercício desconhecido'
  const onPick = (name: string) => {
    const swapping = picking?.swapping ?? null
    if (swapping === null) dispatch({ type: 'addPlannedExercise', planId, blockId, dayId, name, role: defaultRole(name), newExerciseId: newId<ExerciseId>() })
    else dispatch({ type: 'swapPlannedExercise', planId, blockId, dayId, exerciseId: swapping, name, newExerciseId: newId<ExerciseId>() })
  }

  return (
    <section className="card workout-day" aria-label={day.name}>
      {day.exercises.length === 0 && <p className="muted workout-empty">Sem exercícios. Adiciona o primeiro abaixo.</p>}
      <ul className="planned-list">
        {day.exercises.map((p) => {
          const name = nameOf(p.exerciseId)
          const isNew = before !== null && !before.has(p.exerciseId)
          const set = (change: Partial<typeof p>) => dispatch({ type: 'setPlannedExercise', planId, blockId, dayId, planned: { ...p, ...change } })
          return (
            <li key={p.exerciseId} className="planned">
              <span className="planned-main">
                <span className={`role-pick role-${p.role}`}>
                  {ROLE_LABEL[p.role]}
                  <span className="stepper-caret" aria-hidden="true">
                    ▾
                  </span>
                  <select aria-label={`Função de ${name}`} value={p.role} onChange={(e) => set({ role: e.target.value as Role })}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </span>
                <span className={isNew ? 'planned-name planned-new' : 'planned-name'}>
                  {name}
                  {isNew && ' · novo'}
                </span>
              </span>
              <span className="planned-fields">
                <CountField value={p.sets} required label={`Séries de ${name}`} onCommit={(n) => n && set({ sets: n })} />
                <span className="unit">×</span>
                <RangeField value={p.reps} label={`Repetições de ${name}`} parse={parseRepRange} onCommit={(reps) => reps && set({ reps })} />
                <span className="unit">reps</span>
              </span>
              <button type="button" className="icon-btn planned-swap" aria-label={`Trocar ${name}`} onClick={() => setPicking({ swapping: p.exerciseId })}>
                ⇄
              </button>
              <button type="button" className="icon-btn" aria-label={`Remover ${name} de ${day.name}`} onClick={() => dispatch({ type: 'removePlannedExercise', planId, blockId, dayId, exerciseId: p.exerciseId })}>
                <CloseIcon />
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="text-btn add-exercise" onClick={() => setPicking({ swapping: null })}>
        <PlusIcon />
        Exercício
      </button>
      {picking && (
        <ExercisePicker
          eyebrow={day.name}
          current={picking.swapping === null ? null : nameOf(picking.swapping)}
          exercises={exercises}
          taken={day.exercises.map((p) => nameOf(p.exerciseId))}
          onPick={onPick}
          onClose={() => setPicking(null)}
        />
      )}
    </section>
  )
}
