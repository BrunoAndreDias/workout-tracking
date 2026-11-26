import type { CSSProperties } from 'react'
import { involvement, mainSide, REGIONS, workedOn } from '../domain/anatomy.ts'
import type { Activation, Region, Side } from '../domain/anatomy.ts'
import { HALVES, regionsOf } from './bodyHalves.ts'
import { FIGURE_BOX, MIRROR, SIDE_LABEL } from './bodyShape.ts'

/** Each region reads its fill from a custom property, so one set of shapes serves every figure. */
const regionFill = (region: Region): CSSProperties => ({ fill: `var(--bm-${region}, var(--bm-idle))` })

function litRegions(activation: Activation): CSSProperties {
  const style: Record<string, string> = {}
  for (const r of activation.target) style[`--bm-${r}`] = 'var(--bm-target)'
  for (const r of activation.assist) style[`--bm-${r}`] = 'var(--bm-assist)'
  return style
}

/** The figure's accessible name: what it shows lit. */
function figureLabel(activation: Activation, side: Side): string {
  const worked = workedOn(activation, side)
  const names = (inv: 'target' | 'assist') => worked.filter((w) => w.involvement === inv).map((w) => REGIONS[w.region].label).join(', ')
  const parts = [names('target') && `alvo ${names('target')}`, names('assist') && `apoio ${names('assist')}`].filter(Boolean)
  return `${SIDE_LABEL[side]}: ${parts.length > 0 ? parts.join('; ') : 'nada trabalhado deste lado'}`
}

/** The two figures' shapes, once in the page, for every thumbnail to reuse. */
export function BodySprite() {
  return (
    <svg className="bm-sprite" aria-hidden="true" focusable="false">
      {(['front', 'back'] as const).map((side) => (
        <symbol key={side} id={`bm-${side}`} viewBox={FIGURE_BOX}>
          <g id={`bm-${side}-half`}>
            <path className="bm-base" d={HALVES[side].outline} />
            {regionsOf(side).map(([region, d]) => (
              <path key={region} className="bm-region" d={d} style={regionFill(region)} />
            ))}
          </g>
          <use href={`#bm-${side}-half`} transform={MIRROR} />
        </symbol>
      ))}
    </svg>
  )
}

/** A small figure of the side that shows most of what the Exercise targets. Needs a `BodySprite` in the page. */
export function BodyThumb({ activation }: { activation: Activation }) {
  return (
    <svg className="bm bm-thumb" viewBox={FIGURE_BOX} aria-hidden="true" focusable="false" style={litRegions(activation)}>
      <use href={`#bm-${mainSide(activation)}`} />
    </svg>
  )
}

interface FigureProps {
  side: Side
  activation: Activation
  /** The region named and outlined; the others dim. */
  active: Region | null
  onHover: (region: Region | null) => void
  onSelect: (region: Region | null) => void
}

/** A large figure whose worked regions answer the pointer. */
export function BodyFigure({ side, activation, active, onHover, onSelect }: FigureProps) {
  const regions = regionsOf(side)
  const half = (
    <>
      <path className="bm-base" d={HALVES[side].outline} />
      {regions.map(([region, d]) => {
        const inv = involvement(activation, region)
        if (!inv) return <path key={region} className="bm-region" d={d} style={regionFill(region)} />
        return (
          <path
            key={region}
            className="bm-region"
            d={d}
            style={regionFill(region)}
            data-inv={inv}
            data-active={region === active || undefined}
            onPointerEnter={() => onHover(region)}
            onPointerLeave={() => onHover(null)}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(region)
            }}
          />
        )
      })}
      {regions.filter(([region]) => region === active).map(([region, d]) => <path key={region} className="bm-ring" d={d} />)}
    </>
  )
  return (
    <svg
      className="bm bm-figure"
      viewBox={FIGURE_BOX}
      role="img"
      aria-label={figureLabel(activation, side)}
      style={litRegions(activation)}
      data-active={active !== null || undefined}
      onClick={() => onSelect(null)}
    >
      <g>{half}</g>
      <g transform={MIRROR}>{half}</g>
    </svg>
  )
}
