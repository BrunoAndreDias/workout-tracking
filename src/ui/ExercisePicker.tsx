import { useId, useState } from 'react'
import { catalogEntry, exerciseKey, MUSCLE_LABEL, pickerList } from '../domain/exerciseCatalog.ts'
import type { CatalogEntry, Muscle } from '../domain/exerciseCatalog.ts'
import type { Exercise } from '../domain/workouts.ts'
import { SearchIcon } from './icons.tsx'
import { Panel } from './Panel.tsx'

interface Props {
  eyebrow: string
  /** The Exercise being swapped; its movement's other Exercises list first. Null when adding. */
  current: string | null
  /** The user's Exercises; those not in the catalog list under "Os teus". */
  exercises: readonly Exercise[]
  /** Names already in the day or session, which cannot be picked again. */
  taken: readonly string[]
  onPick: (name: string) => void
  onClose: () => void
}

const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[]

/** One tap picks a catalog Exercise, one of the user's own, or a new name. */
export function ExercisePicker({ eyebrow, current, exercises, taken, onPick, onClose }: Props) {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const { same, others } = pickerList(query, muscle, current)
  const words = exerciseKey(query).split(/\s+/).filter(Boolean)
  const own = muscle !== null ? [] : exercises.filter((e) => !catalogEntry(e.name) && words.every((w) => exerciseKey(e.name).includes(w)))
  const takenKeys = new Set(taken.map(exerciseKey))
  const q = query.trim()
  const exact = q !== '' && (catalogEntry(q) !== undefined || exercises.some((e) => exerciseKey(e.name) === exerciseKey(q)))
  const first = [...same, ...others].find((e) => !takenKeys.has(exerciseKey(e.name)))?.name ?? own.find((e) => !takenKeys.has(exerciseKey(e.name)))?.name
  const pick = (name: string) => {
    onPick(name)
    onClose()
  }

  const head = (
    <>
      <div className="search-field">
        <label htmlFor={searchId} className="search-label">Pesquisar exercício</label>
        <div className="search-box">
          <SearchIcon />
          <input
            id={searchId}
            type="search"
            className="search-input"
            autoComplete="off"
            placeholder="Ex.: bench, row, curl"
            autoFocus={current === null}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              const name = first ?? (q && !exact ? q : undefined)
              if (name) pick(name)
            }}
          />
        </div>
      </div>
      <div className="filter-chips" role="group" aria-label="Grupos musculares">
        <button type="button" className="filter-chip" aria-pressed={muscle === null} onClick={() => setMuscle(null)}>
          Todos
        </button>
        {MUSCLES.map((m) => (
          <button key={m} type="button" className="filter-chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>
            {MUSCLE_LABEL[m]}
          </button>
        ))}
      </div>
    </>
  )

  const row = (name: string, sub: string) => {
    const isTaken = takenKeys.has(exerciseKey(name))
    return (
      <li key={name}>
        <button type="button" className="result" disabled={isTaken} onClick={() => pick(name)}>
          <span className="result-main">
            <span className="result-name">{name}</span>
            <span className="result-sub">{isTaken ? 'Já adicionado' : sub}</span>
          </span>
        </button>
      </li>
    )
  }
  const catalogRow = (e: CatalogEntry) => row(e.name, MUSCLE_LABEL[e.muscle])

  return (
    <Panel eyebrow={eyebrow} title={current === null ? 'Adicionar exercício' : 'Trocar exercício'} onClose={onClose} head={head}>
      <div className="panel-body">
        {current !== null && (
          <div className="swap-card">
            <div className="swap-card-eyebrow">A trocar</div>
            <div className="swap-card-name">{current}</div>
          </div>
        )}
        {same.length > 0 && (
          <section aria-label="Mesmo movimento">
            <h3 className="results-count">Mesmo movimento</h3>
            <ul className="results">{same.map(catalogRow)}</ul>
          </section>
        )}
        {own.length > 0 && (
          <section aria-label="Os teus">
            <h3 className="results-count">Os teus</h3>
            <ul className="results">{own.map((e) => row(e.name, 'Criado por ti'))}</ul>
          </section>
        )}
        <section aria-label="Catálogo">
          <h3 className="results-count">{same.length > 0 ? 'Outros' : `${others.length} ${others.length === 1 ? 'exercício' : 'exercícios'}`}</h3>
          <ul className="results">{others.map(catalogRow)}</ul>
        </section>
        {q && same.length + others.length + own.length === 0 && <p className="results-hint">Nada encontrado para “{q}”.</p>}
        {q && !exact && (
          <button type="button" className="create-btn" onClick={() => pick(q)}>
            + Criar “{q}”
          </button>
        )}
      </div>
    </Panel>
  )
}
