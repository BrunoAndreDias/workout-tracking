import { useState } from 'react'
import { REGIONS, workedRegions } from '../domain/anatomy.ts'
import type { Activation, Involvement, Region } from '../domain/anatomy.ts'
import { BodyFigure } from './BodyMap.tsx'
import { SIDE_LABEL } from './bodyShape.ts'

interface Props {
  activation: Activation
  /** `<muscle group> · <material>`, as on the Exercise's row. */
  sub: string
  /** What the active Local lacks for it, or null. */
  missing: string | null
  taken: boolean
  onPick: () => void
}

const INVOLVEMENT: Record<Involvement, { title: string; hint: string }> = {
  target: { title: 'Alvo', hint: 'onde deves sentir' },
  assist: { title: 'Apoio', hint: 'também trabalham' },
}

/** Where a catalog Exercise should be felt: front and back figures and the worked regions, each naming the other. */
export function MuscleDetail({ activation, sub, missing, taken, onPick }: Props) {
  const [hovered, setHovered] = useState<Region | null>(null)
  const [selected, setSelected] = useState<Region | null>(null)
  const active = hovered ?? selected
  const worked = workedRegions(activation)
  const activeInv = worked.find((w) => w.region === active)?.involvement
  const select = (region: Region | null) => setSelected((s) => (region === s ? null : region))

  return (
    <>
      <div className="panel-body muscle-detail">
        <p className="md-sub">{sub}</p>
        {missing && <p className="missing-line">Falta: {missing}</p>}
        <div className="md-map">
          <div className="md-figures">
            {(['front', 'back'] as const).map((side) => (
              <figure key={side} className="md-figure">
                <BodyFigure side={side} activation={activation} active={active} onHover={setHovered} onSelect={select} />
                <figcaption>{SIDE_LABEL[side]}</figcaption>
              </figure>
            ))}
          </div>
          <p className="md-readout" data-inv={activeInv}>
            {active && activeInv ? (
              <>
                <span className="md-readout-name">{REGIONS[active].label}</span>
                <span className="md-readout-inv">
                  {INVOLVEMENT[activeInv].title}: {INVOLVEMENT[activeInv].hint}
                </span>
              </>
            ) : (
              <span className="md-readout-hint">Toca ou aponta um músculo para ver o nome.</span>
            )}
          </p>
        </div>
        {(['target', 'assist'] as const).map((inv) => {
          const regions = worked.filter((w) => w.involvement === inv)
          if (regions.length === 0) return null
          return (
            <section key={inv} className="md-group" aria-label={INVOLVEMENT[inv].title}>
              <h3 className="md-group-title">
                <span className="md-swatch" data-inv={inv} aria-hidden="true" />
                {INVOLVEMENT[inv].title}
                <span className="md-group-hint">{INVOLVEMENT[inv].hint}</span>
              </h3>
              <ul className="md-regions">
                {regions.map(({ region }) => (
                  <li key={region}>
                    <button
                      type="button"
                      className="md-region"
                      data-inv={inv}
                      data-active={region === active || undefined}
                      aria-pressed={region === selected}
                      onPointerEnter={() => setHovered(region)}
                      onPointerLeave={() => setHovered(null)}
                      onFocus={() => setHovered(region)}
                      onBlur={() => setHovered(null)}
                      onClick={() => select(region)}
                    >
                      <span className="md-swatch" data-inv={inv} aria-hidden="true" />
                      {REGIONS[region].label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <div className="panel-foot">
        <button type="button" className="primary md-pick" disabled={taken} onClick={onPick}>
          {taken ? 'Já adicionado' : 'Escolher'}
        </button>
      </div>
    </>
  )
}
