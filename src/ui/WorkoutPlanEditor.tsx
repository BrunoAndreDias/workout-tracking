import { useContext, useState } from 'react'
import type { Dispatch } from 'react'
import { missingAt } from '../domain/equipment.ts'
import { MUSCLE_LABEL } from '../domain/exerciseCatalog.ts'
import { dayMuscleSets } from '../domain/muscles.ts'
import type { DayMuscle } from '../domain/muscles.ts'
import { newId } from '../domain/ids.ts'
import { rangeText } from '../domain/numbers.ts'
import { defaultRole, LIGHT_RIR_EXTRA, ROLE_LABEL, ROLES, SPLIT_IDS, SPLITS } from '../domain/splits.ts'
import type { ExerciseId, IsoDate, WorkoutBlockId, WorkoutDayId, WorkoutPlanId } from '../domain/types.ts'
import { blockExercises, currentBlock, isRunDue, isRunWeeks, weeksRun } from '../domain/blocks.ts'
import { nameLookup, parseRepRange } from '../domain/workouts.ts'
import type { RepRange, Role, Split, WorkoutBlock, WorkoutDay, WorkoutPlan, WorkoutSession, WorkoutState } from '../domain/workouts.ts'
import type { WorkoutAction } from '../domain/workoutReducer.ts'
import { BlockMuscles } from './BlockMuscles.tsx'
import { CountField } from './CountField.tsx'
import { EquipmentContext } from './equipmentContext.ts'
import { ExercisePicker } from './ExercisePicker.tsx'
import { materialText, plural } from './format.ts'
import { CloseIcon, PlusIcon } from './icons.tsx'
import { InlineName } from './InlineName.tsx'
import { PlanTitle } from './PlanTitle.tsx'

function RangeField({ value, label, parse, onCommit }: { value: RepRange; label: string; parse: (text: string) => RepRange | null; onCommit: (value: RepRange) => void }) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      className="count-input reps-input"
      type="text"
      aria-label={label}
      value={text ?? rangeText(value)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = parse(e.target.value)
        if (parsed) onCommit(parsed)
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

const splitDayNames = (split: Split) => (SPLITS[split].days as readonly { name: string }[]).map((d) => d.name).join(' · ')

function NewPlan({ count, today, onCreate, onCancel }: { count: number; today: IsoDate; onCreate: Dispatch<WorkoutAction>; onCancel: (() => void) | null }) {
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

interface BlockProps {
  plan: WorkoutPlan
  block: WorkoutBlock
  /** The block sessions start from, whose Exercise Runs are shown. */
  isCurrent: boolean
  today: IsoDate
  exercises: WorkoutState['exercises']
  sessions: readonly WorkoutSession[]
  dispatch: Dispatch<WorkoutAction>
}

function BlockEditor({ plan, block, isCurrent, today, exercises, sessions, dispatch }: BlockProps) {
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

function DayMuscles({ day, muscles }: { day: string; muscles: readonly DayMuscle[] }) {
  const most = Math.max(...muscles.map((m) => m.sets))
  return (
    <aside className="day-muscle-sets" aria-label={`Músculos de ${day}`}>
      <h4 className="day-muscles-title">Músculos neste dia</h4>
      <ul className="day-muscle-rows">
        {muscles.map((m) => (
          <li key={m.muscle} className="day-muscle">
            <span className="muscle-name">{MUSCLE_LABEL[m.muscle]}</span>
            <span className="muscle-sets">{plural(m.sets, 'série', 'séries')}</span>
            <span className="track muscle-track" aria-hidden="true">
              <span style={{ width: `${(m.sets / most) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

interface DayProps {
  planId: WorkoutPlanId
  blockId: WorkoutBlockId
  day: WorkoutDay
  /** The Exercises of the block before, to mark the new ones; null for the first block. */
  before: ReadonlySet<ExerciseId> | null
  exercises: WorkoutState['exercises']
  /** The sessions that count each Exercise Run, or null when the block is not current and shows none. */
  runs: readonly WorkoutSession[] | null
  today: IsoDate
  dispatch: Dispatch<WorkoutAction>
}

function RunLine({ weeks, done }: { weeks: number | null; done: number }) {
  if (isRunDue(weeks, done)) return <span className="missing-line">Rever: {plural(done, 'semana feita', 'semanas feitas')}</span>
  return <span className="run-line">{weeks === null ? `semana ${done + 1} · sem limite` : `semana ${done + 1} de ${weeks}`}</span>
}

function DayEditor({ planId, blockId, day, before, exercises, runs, today, dispatch }: DayProps) {
  const [picking, setPicking] = useState<{ swapping: ExerciseId | null } | null>(null)
  const { state: equipment } = useContext(EquipmentContext)
  const dayId: WorkoutDayId = day.id
  const nameOf = nameLookup(exercises)
  const muscles = dayMuscleSets(day, nameOf)
  const onPick = (name: string) => {
    const swapping = picking?.swapping ?? null
    if (swapping === null) dispatch({ type: 'addPlannedExercise', planId, blockId, dayId, name, role: defaultRole(name), newExerciseId: newId<ExerciseId>(), today })
    else dispatch({ type: 'swapPlannedExercise', planId, blockId, dayId, exerciseId: swapping, name, newExerciseId: newId<ExerciseId>(), today })
  }

  return (
    <section className={muscles.length > 0 ? 'card workout-day day-trains' : 'card workout-day'} aria-label={day.name}>
      {muscles.length > 0 && <DayMuscles day={day.name} muscles={muscles} />}
      <div className="day-planned">
        {day.exercises.length === 0 && <p className="muted workout-empty">Sem exercícios. Adiciona o primeiro abaixo.</p>}
        <ul className="planned-list">
          {day.exercises.map((p) => {
            const name = nameOf(p.exerciseId)
            const isNew = before !== null && !before.has(p.exerciseId)
            const missing = missingAt(equipment, name) ?? []
            const set = (change: Partial<typeof p>) => dispatch({ type: 'setPlannedExercise', planId, blockId, dayId, planned: { ...p, ...change } })
            return (
              <li key={p.exerciseId} className="planned">
                <span className="planned-main">
                  <span className={`role-pick role-${p.role}`}>
                    <span className="role-label">{ROLE_LABEL[p.role]}</span>
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
                  {missing.length > 0 && <span className="missing-line">Falta: {materialText(equipment, missing)}</span>}
                  {runs && <RunLine weeks={p.weeks} done={weeksRun(p, runs, today)} />}
                </span>
                <span className="planned-fields">
                  <CountField value={p.sets} required label={`Séries de ${name}`} onCommit={(n) => n && set({ sets: n })} />
                  <span className="unit">×</span>
                  <RangeField value={p.reps} label={`Repetições de ${name}`} parse={parseRepRange} onCommit={(reps) => set({ reps })} />
                  <span className="unit">reps</span>
                  <CountField value={p.weeks} placeholder="∞" label={`Semanas de ${name}`} onCommit={(weeks) => isRunWeeks(weeks) && set({ weeks })} />
                  <span className="unit">semanas</span>
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
      </div>
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
