import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { REGIONS } from '../domain/anatomy.ts'
import type { Region, Side } from '../domain/anatomy.ts'
import { MUSCLE_LABEL } from '../domain/exerciseCatalog.ts'
import type { Muscle } from '../domain/exerciseCatalog.ts'
import { blockMuscles } from '../domain/muscles.ts'
import type { MuscleVolume } from '../domain/muscles.ts'
import { ratioText } from '../domain/numbers.ts'
import { rankedVolumes, REFERENCE_RANGE, volumeNotes, volumeZone } from '../domain/volume.ts'
import type { VolumeNote, VolumeZone } from '../domain/volume.ts'
import { nameLookup } from '../domain/workouts.ts'
import type { WorkoutDay, WorkoutState } from '../domain/workouts.ts'
import { BACK } from './bodyBack.ts'
import { FRONT } from './bodyFront.ts'
import { FIGURE_BOX, MIRROR, SIDE_LABEL } from './bodyShape.ts'
import { plural } from './format.ts'

const HALVES = { front: FRONT, back: BACK } as const
const ZONE_LABEL: Record<VolumeZone, string> = { below: 'abaixo', within: 'na zona', above: 'acima' }
const sets = (n: number) => plural(n, 'série', 'séries')
const percent = (n: number, of: number) => `${Math.round((n / of) * 100)}%`

interface Selection {
  selected: Muscle | null
  onSelect: (muscle: Muscle | null) => void
}

/** One side of the body, each region as dark as its group's share of the most-trained group's sets. Both halves are drawn, so either takes a tap. */
function VolumeFigure({ side, sets: setsOf, most, selected, onSelect }: Selection & { side: Side; sets: Readonly<Record<Muscle, number>>; most: number }) {
  const regions = Object.entries(HALVES[side].regions) as [Region, string][]
  const half = (transform?: string) => (
    <g transform={transform}>
      <path className="bm-base" d={HALVES[side].outline} />
      {regions.map(([region, d]) => {
        const group = REGIONS[region].group
        if (!group) return <path key={region} className="bm-region" d={d} />
        const n = setsOf[group]
        const style = n > 0 ? ({ '--volume': `${Math.round(22 + (n / most) * 78)}%` } as CSSProperties) : undefined
        return (
          <path
            key={region}
            className="bm-region volume-region"
            d={d}
            style={style}
            data-group={group}
            data-untrained={n === 0 || undefined}
            data-selected={group === selected || undefined}
            onClick={() => onSelect(group === selected ? null : group)}
          >
            <title>{`${REGIONS[region].label}: ${n === 0 ? 'sem séries' : sets(n)}`}</title>
          </path>
        )
      })}
    </g>
  )
  return (
    <figure className="volume-figure">
      <svg className="bm" viewBox={FIGURE_BOX} aria-hidden="true" focusable="false" data-picked={selected !== null || undefined}>
        {half()}
        {half(MIRROR)}
      </svg>
      <figcaption>{SIDE_LABEL[side]}</figcaption>
    </figure>
  )
}

function VolumeRow({ volume, top, total, scale, selected, onSelect }: Selection & { volume: MuscleVolume; top: boolean; total: number; scale: number }) {
  const ref = useRef<HTMLButtonElement>(null)
  const picked = selected === volume.muscle
  useEffect(() => {
    if (picked) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [picked])
  const zone = volumeZone(volume.sets)
  const at = (n: number) => `${(n / scale) * 100}%`
  return (
    <li>
      <button
        ref={ref}
        type="button"
        className="volume-row"
        aria-pressed={picked}
        data-top={top || undefined}
        data-dim={(selected !== null && !picked) || undefined}
        onClick={() => onSelect(picked ? null : volume.muscle)}
      >
        <span className="muscle-name">{MUSCLE_LABEL[volume.muscle]}</span>
        <span className="volume-track" aria-hidden="true" style={{ '--low': at(REFERENCE_RANGE.low), '--high': at(REFERENCE_RANGE.high) } as CSSProperties}>
          <span className="volume-bar" style={{ width: at(volume.sets) }} />
        </span>
        <span className="volume-sets">{volume.sets === 0 ? 'sem séries' : sets(volume.sets)}</span>
        {zone ? <span className={`volume-zone zone-${zone}`}>{ZONE_LABEL[zone]}</span> : <span />}
        {picked && (
          <span className="volume-detail">
            {volume.sets === 0 ? 'Nenhum exercício do plano trabalha este grupo.' : `${percent(volume.sets, total)} das séries da semana · ${volume.days.join(' · ')}`}
          </span>
        )}
      </button>
    </li>
  )
}

const list = (ms: readonly MuscleVolume[], withSets: boolean) => ms.map((m) => (withSets ? `${MUSCLE_LABEL[m.muscle]} (${m.sets})` : MUSCLE_LABEL[m.muscle])).join(', ')

function noteText(note: VolumeNote): string {
  const { low, high } = REFERENCE_RANGE
  switch (note.kind) {
    case 'untrained':
      return `Sem séries no plano: ${list(note.muscles, false)}.`
    case 'below':
      return `Abaixo de ${low} séries por semana: ${list(note.muscles, true)}.`
    case 'above':
      return `Acima de ${high} séries por semana: ${list(note.muscles, true)}.`
    case 'uneven':
      return `${MUSCLE_LABEL[note.more.muscle]} tem ${ratioText(note.ratio)}× as séries de ${MUSCLE_LABEL[note.less.muscle]}.`
  }
}

export function BlockMuscles({ days, exercises }: { days: readonly WorkoutDay[]; exercises: WorkoutState['exercises'] }) {
  const [selected, setSelected] = useState<Muscle | null>(null)
  const { muscles, ungrouped } = blockMuscles(days, nameLookup(exercises))
  const ranked = rankedVolumes(muscles)
  const untrained = muscles.filter((m) => m.sets === 0)
  const most = ranked[0]?.sets ?? 0
  const total = ranked.reduce((n, m) => n + m.sets, 0)
  const scale = Math.max(most, REFERENCE_RANGE.high + 4)
  const setsOf = Object.fromEntries(muscles.map((m) => [m.muscle, m.sets])) as Record<Muscle, number>
  const notes = volumeNotes(muscles)
  const pick = { selected, onSelect: setSelected }
  const row = (m: MuscleVolume) => <VolumeRow key={m.muscle} volume={m} top={m.sets > 0 && m.sets === most} total={total} scale={scale} {...pick} />
  return (
    <section className="card block-muscles" aria-labelledby="musculos-semana" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
      <h3 id="musculos-semana" className="blocks-title">
        Músculos por semana
      </h3>
      <div className="volume-layout">
        <div className="volume-body">
          <div className="volume-figures">
            <VolumeFigure side="front" sets={setsOf} most={most || 1} {...pick} />
            <VolumeFigure side="back" sets={setsOf} most={most || 1} {...pick} />
          </div>
          <p className="volume-legend muted">
            Menos <span className="volume-scale" aria-hidden="true" /> Mais <span className="volume-untrained-key" aria-hidden="true" /> Sem séries
          </p>
          <p className="muted volume-hint">Toca num músculo para o ver na lista.</p>
        </div>
        <div className="volume-lists">
          <ol className="volume-rows" aria-label="Grupos musculares, do que tem mais séries ao que tem menos">
            {ranked.map(row)}
          </ol>
          {untrained.length > 0 && (
            <ul className="volume-rows volume-gaps" aria-label="Grupos sem séries">
              {untrained.map(row)}
            </ul>
          )}
          <p className="muted muscles-note">
            A faixa tracejada marca {REFERENCE_RANGE.low}–{REFERENCE_RANGE.high} séries.
          </p>
        </div>
      </div>
      {ungrouped.length > 0 && <p className="muted muscles-note">Sem grupo muscular: {ungrouped.map((u) => `${u.name} (${sets(u.sets)})`).join(' · ')}</p>}
      <div className="volume-notes">
        <h4 className="day-muscles-title">Onde podes olhar</h4>
        {notes.length > 0 ? (
          <ul>
            {notes.map((n) => (
              <li key={n.kind === 'uneven' ? `${n.more.muscle}-${n.less.muscle}` : n.kind}>{noteText(n)}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nada a assinalar.</p>
        )}
        <p className="muted">
          Para referência: {REFERENCE_RANGE.low}–{REFERENCE_RANGE.high} séries por semana é um intervalo comum para crescer. Não é uma regra.
        </p>
      </div>
      <p className="muted muscles-note">Séries planeadas por semana, contando cada dia uma vez.</p>
    </section>
  )
}
