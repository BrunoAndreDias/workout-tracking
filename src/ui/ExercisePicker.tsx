import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { activationByName } from '../domain/anatomy.ts'
import { activeGym, missingAt, needsOf, readyFirst } from '../domain/equipment.ts'
import type { CatalogEntry, Muscle } from '../domain/catalogEntries.ts'
import { catalogEntry, MUSCLE_LABEL, pickerList } from '../domain/exerciseCatalog.ts'
import { MUSCLES } from '../domain/muscles.ts'
import { nameKey, nameMatcher } from '../domain/names.ts'
import type { Exercise } from '../domain/workouts.ts'
import { EquipmentContext } from './equipmentContext.ts'
import { materialText } from './format.ts'
import { BodySprite, BodyThumb } from './BodyMap.tsx'
import { ChevronIcon } from './icons.tsx'
import { MuscleDetail } from './MuscleDetail.tsx'
import { Panel } from './Panel.tsx'
import { SearchField } from './SearchField.tsx'

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

/**
 * One tap picks a catalog Exercise, one of the user's own, or a new name. With an active Gym, what it has the material
 * for lists first in each section, and the rest is flagged with what it lacks but stays pickable. A catalog Exercise's
 * figure opens where it should be felt, inside the panel; going back keeps the search, the filter and the scroll.
 */
export function ExercisePicker({ eyebrow, current, exercises, taken, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listScroll = useRef(0)
  const returnTo = useRef<string | null>(null)
  const { state: equipment, dispatch: dispatchEquipment } = useContext(EquipmentContext)
  const listed = pickerList(query, muscle, current)
  const same = readyFirst(equipment, listed.same, (e) => e.name)
  const others = readyFirst(equipment, listed.others, (e) => e.name)
  const matches = nameMatcher(query)
  const own = muscle !== null ? [] : readyFirst(equipment, exercises.filter((e) => !catalogEntry(e.name) && matches(e.name)), (e) => e.name)
  const gym = activeGym(equipment)
  const takenKeys = new Set(taken.map(nameKey))
  const q = query.trim()
  const exact = q !== '' && (catalogEntry(q) !== undefined || exercises.some((e) => nameKey(e.name) === nameKey(q)))
  const first = [...same, ...others].find((e) => !takenKeys.has(nameKey(e.name)))?.name ?? own.find((e) => !takenKeys.has(nameKey(e.name)))?.name
  const pick = (name: string) => {
    onPick(name)
    onClose()
  }
  const sub = (name: string, group: string) => `${group} · ${materialText(equipment, needsOf(equipment, name))}`
  const openDetail = (name: string) => {
    listScroll.current = listRef.current?.scrollTop ?? 0
    setDetail(name)
  }
  const closeDetail = () => {
    returnTo.current = detail
    setDetail(null)
  }

  useLayoutEffect(() => {
    const list = listRef.current
    if (detail !== null || !list || returnTo.current === null) return
    list.scrollTop = listScroll.current
    const name = returnTo.current
    returnTo.current = null
    list.querySelector<HTMLElement>(`.muscles-btn[data-name="${CSS.escape(name)}"]`)?.focus({ preventScroll: true })
  }, [detail])

  const detailEntry = detail === null ? undefined : catalogEntry(detail)
  const activation = detailEntry && activationByName(detailEntry.name)
  if (detailEntry && activation) {
    const missing = missingAt(equipment, detailEntry.name)
    return (
      <Panel
        eyebrow="Músculos trabalhados"
        title={detailEntry.name}
        onClose={onClose}
        onEscape={closeDetail}
        head={
          <button type="button" className="text-btn md-back" autoFocus onClick={closeDetail}>
            <ChevronIcon left />
            Voltar à lista
          </button>
        }
      >
        <MuscleDetail
          activation={activation}
          sub={sub(detailEntry.name, MUSCLE_LABEL[detailEntry.muscle])}
          missing={missing.length > 0 ? materialText(equipment, missing) : null}
          taken={takenKeys.has(nameKey(detailEntry.name))}
          onPick={() => pick(detailEntry.name)}
        />
      </Panel>
    )
  }

  const head = (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        autoFocus={current === null}
        onEnter={() => {
          const name = first ?? (q && !exact ? q : undefined)
          if (name) pick(name)
        }}
      />
      {equipment.gyms.length > 1 && (
        <div className="filter-chips" role="group" aria-label="Local">
          <span className="filter-label" aria-hidden="true">
            Local
          </span>
          {equipment.gyms.map((g) => (
            <button key={g.id} type="button" className="filter-chip" aria-pressed={g.id === gym?.id} onClick={() => dispatchEquipment({ type: 'setActiveGym', gymId: g.id })}>
              {g.name}
            </button>
          ))}
        </div>
      )}
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

  const row = (name: string, group: string) => {
    const isTaken = takenKeys.has(nameKey(name))
    const missing = missingAt(equipment, name)
    const worked = activationByName(name)
    return (
      <li key={name} className="pick-row">
        {worked ? (
          <button type="button" className="muscles-btn" data-name={name} aria-label={`Ver músculos de ${name}`} onClick={() => openDetail(name)}>
            <BodyThumb activation={worked} />
          </button>
        ) : (
          <span className="muscles-btn" aria-hidden="true" />
        )}
        <button type="button" className={missing.length > 0 ? 'result is-missing' : 'result'} disabled={isTaken} onClick={() => pick(name)}>
          <span className="result-main">
            <span className="result-name">{name}</span>
            <span className="result-sub">{isTaken ? 'Já adicionado' : sub(name, group)}</span>
            {!isTaken && missing.length > 0 && <span className="missing-line">Falta: {materialText(equipment, missing)}</span>}
          </span>
        </button>
      </li>
    )
  }
  const catalogRow = (e: CatalogEntry) => row(e.name, MUSCLE_LABEL[e.muscle])

  return (
    <Panel eyebrow={eyebrow} title={current === null ? 'Adicionar exercício' : 'Trocar exercício'} onClose={onClose} head={head}>
      <div ref={listRef} className="panel-body">
        <BodySprite />
        {!gym && <p className="muted hint picker-hint">Marca o material que tens em Treino → Material, e o que dá para fazer aparece primeiro.</p>}
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
