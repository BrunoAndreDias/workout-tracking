import { useContext, useId, useState } from 'react'
import { activeGym, allEquipment, equipmentLabel, isChanged, missingAt, needsOf, newCustomEquipmentId } from '../domain/equipment.ts'
import type { EquipmentId } from '../domain/equipment.ts'
import { CATALOG } from '../domain/catalogEntries.ts'
import { catalogEntry, exerciseKey, MUSCLE_LABEL } from '../domain/exerciseCatalog.ts'
import type { CatalogEntry, Muscle } from '../domain/exerciseCatalog.ts'
import { MUSCLES } from '../domain/muscles.ts'
import { newId } from '../domain/ids.ts'
import type { GymId } from '../domain/types.ts'
import type { Exercise } from '../domain/workouts.ts'
import { EquipmentContext } from './equipmentContext.ts'
import { materialText } from './format.ts'
import { SearchIcon } from './icons.tsx'
import { InlineName } from './InlineName.tsx'

/** A name field and its button; Enter adds too. The field empties once a name is added. */
function AddName({ label, button, onAdd }: { label: string; button: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const add = () => {
    if (!name.trim()) return
    onAdd(name)
    setName('')
  }
  return (
    <div className="equipment-add">
      <input
        className="field-input"
        aria-label={label}
        placeholder={label}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          add()
        }}
      />
      <button type="button" className="secondary" disabled={!name.trim()} onClick={add}>
        {button}
      </button>
    </div>
  )
}

function Gyms() {
  const { state, dispatch } = useContext(EquipmentContext)
  const gym = activeGym(state)
  return (
    <section className="card equipment-card" aria-labelledby="locais-treino">
      <h2 id="locais-treino" className="blocks-title">
        Locais
      </h2>
      <p className="muted hint">Marca o material de cada sítio onde treinas. Ao escolher um exercício, o que dá para fazer no local ativo aparece primeiro.</p>
      {state.gyms.length > 0 && (
        <div className="filter-chips" role="group" aria-label="Local ativo">
          {state.gyms.map((g) => (
            <button key={g.id} type="button" className="filter-chip" aria-pressed={g.id === gym?.id} onClick={() => dispatch({ type: 'setActiveGym', gymId: g.id })}>
              {g.name}
            </button>
          ))}
        </div>
      )}
      <AddName label="Nome do novo local" button="Adicionar local" onAdd={(name) => dispatch({ type: 'addGym', gymId: newId<GymId>(), name })} />
      {gym && (
        <fieldset className="equipment-has">
          <legend className="equipment-has-head">
            <InlineName name={gym.name} label="Nome do local" onRename={(name) => dispatch({ type: 'renameGym', gymId: gym.id, name })} />
          </legend>
          <div className="equipment-has-actions">
            <span className="muted hint">
              {gym.has.length} de {allEquipment(state).length}
            </span>
            <button type="button" className="link-btn" onClick={() => dispatch({ type: 'setAllHas', gymId: gym.id })}>
              Marcar tudo
            </button>
            <button type="button" className="link-btn" onClick={() => dispatch({ type: 'clearHas', gymId: gym.id })}>
              Limpar
            </button>
            <button
              type="button"
              className="link-btn danger"
              onClick={() => window.confirm(`Remover o local "${gym.name}"?`) && dispatch({ type: 'removeGym', gymId: gym.id })}
            >
              Remover local
            </button>
          </div>
          <ul className="equipment-checks" aria-label={`Material em ${gym.name}`}>
            {allEquipment(state).map((e) => (
              <li key={e.id}>
                <label className="equipment-check">
                  <input type="checkbox" checked={gym.has.includes(e.id)} onChange={() => dispatch({ type: 'toggleHas', gymId: gym.id, equipmentId: e.id })} />
                  {e.label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </section>
  )
}

function OwnEquipment() {
  const { state, dispatch } = useContext(EquipmentContext)
  return (
    <section className="card equipment-card" aria-labelledby="o-teu-material">
      <h2 id="o-teu-material" className="blocks-title">
        O teu material
      </h2>
      <p className="muted hint">Material que não está na lista, como elásticos ou um TRX.</p>
      {state.custom.length > 0 && (
        <ul className="own-list">
          {state.custom.map((c) => (
            <li key={c.id} className="own-row">
              <span className="own-main">
                <InlineName name={c.name} label="Nome do material" onRename={(name) => dispatch({ type: 'renameCustom', id: c.id, name })} />
              </span>
              <button
                type="button"
                className="link-btn danger"
                aria-label={`Remover ${c.name}`}
                onClick={() => window.confirm(`Remover "${c.name}"? Sai dos locais e dos exercícios que o pedem.`) && dispatch({ type: 'removeCustom', id: c.id })}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <AddName label="Novo material" button="Adicionar material" onAdd={(name) => dispatch({ type: 'addCustom', id: newCustomEquipmentId(), name })} />
    </section>
  )
}

function ExerciseNeeds({ name, sub }: { name: string; sub: string }) {
  const { state, dispatch } = useContext(EquipmentContext)
  const needs = needsOf(state, name)
  const missing = missingAt(state, name) ?? []
  const set = (next: readonly EquipmentId[]) => dispatch({ type: 'setNeeds', name, needs: next })
  const addable = allEquipment(state).filter((e) => !needs.includes(e.id))
  return (
    <li className={missing.length > 0 ? 'equipment-exercise is-missing' : 'equipment-exercise'}>
      <div className="equipment-exercise-head">
        <span className="result-main">
          <span className="result-name">{name}</span>
          <span className="result-sub">{sub}</span>
        </span>
        {isChanged(state, name) && (
          <>
            <span className="changed-tag">Alterado</span>
            <button type="button" className="link-btn" aria-label={`Repor o material de ${name}`} onClick={() => dispatch({ type: 'resetNeeds', name })}>
              Repor
            </button>
          </>
        )}
      </div>
      <ul className="equipment-needs" aria-label={`Material de ${name}`}>
        {needs.length === 0 && <li className="muted hint">Sem material</li>}
        {needs.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={missing.includes(id) ? 'need-chip lacking' : 'need-chip'}
              aria-label={`Tirar ${equipmentLabel(state, id)} de ${name}`}
              onClick={() => set(needs.filter((n) => n !== id))}
            >
              {equipmentLabel(state, id)}
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
        <li>
          <select
            className="need-add"
            aria-label={`Juntar material a ${name}`}
            value=""
            onChange={(e) => e.target.value && set([...needs, e.target.value as EquipmentId])}
          >
            <option value="">+ Material</option>
            {addable.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </li>
      </ul>
      {missing.length > 0 && <p className="missing-line">Falta: {materialText(state, missing)}</p>}
    </li>
  )
}

type Shelf = Muscle | 'changed' | 'own'

/** One shelf at a time keeps the list short; a search looks through every Exercise instead. */
function ExerciseList({ exercises }: { exercises: readonly Exercise[] }) {
  const { state } = useContext(EquipmentContext)
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [shelf, setShelf] = useState<Shelf>('chest')
  const words = exerciseKey(query).split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const matches = (name: string) => words.every((w) => exerciseKey(name).includes(w))
  const onShelf = (name: string, entry?: CatalogEntry) => (shelf === 'changed' ? isChanged(state, name) : shelf === 'own' ? !entry : entry?.muscle === shelf)
  const shown = (name: string, entry?: CatalogEntry) => (searching ? matches(name) : onShelf(name, entry))
  const own = exercises.filter((e) => !catalogEntry(e.name) && shown(e.name))
  const catalog = CATALOG.filter((e) => shown(e.name, e))
  const chip = (id: Shelf, label: string) => (
    <button key={id} type="button" className="filter-chip" aria-pressed={!searching && shelf === id} onClick={() => (setShelf(id), setQuery(''))}>
      {label}
    </button>
  )
  return (
    <section className="card equipment-card" aria-labelledby="material-exercicios">
      <h2 id="material-exercicios" className="blocks-title">
        Exercícios
      </h2>
      <p className="muted hint">Cada exercício vem com o material que costuma pedir. Se não bate certo com o que fazes, tira ou junta material.</p>
      <div className="search-field">
        <label htmlFor={searchId} className="search-label">
          Pesquisar exercício
        </label>
        <div className="search-box">
          <SearchIcon />
          <input id={searchId} type="search" className="search-input" autoComplete="off" placeholder="Ex.: bench, row, curl" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="filter-chips" role="group" aria-label="Mostrar">
        {chip('changed', 'Alterados')}
        {exercises.some((e) => !catalogEntry(e.name)) && chip('own', 'Os teus')}
        {MUSCLES.map((m) => chip(m, MUSCLE_LABEL[m]))}
      </div>
      <ul className="equipment-exercises">
        {own.map((e) => (
          <ExerciseNeeds key={e.id} name={e.name} sub="Criado por ti" />
        ))}
        {catalog.map((e) => (
          <ExerciseNeeds key={e.id} name={e.name} sub={MUSCLE_LABEL[e.muscle]} />
        ))}
      </ul>
      {own.length + catalog.length === 0 && (
        <p className="results-hint">{searching ? `Nada encontrado para “${query.trim()}”.` : shelf === 'changed' ? 'Ainda não corrigiste o material de nenhum exercício.' : 'Nenhum exercício aqui.'}</p>
      )}
    </section>
  )
}

/** Treino → Material: the Gyms and what each has, the user's own material, and what each Exercise needs. */
export function EquipmentView({ exercises }: { exercises: readonly Exercise[] }) {
  return (
    <>
      <Gyms />
      <OwnEquipment />
      <ExerciseList exercises={exercises} />
    </>
  )
}
