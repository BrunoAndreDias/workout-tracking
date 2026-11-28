import { useId } from 'react'
import { SearchIcon } from './icons.tsx'

interface Props {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  onEnter?: () => void
}

export function SearchField({ value, onChange, autoFocus, onEnter }: Props) {
  const id = useId()
  return (
    <div className="search-field">
      <label htmlFor={id} className="search-label">
        Pesquisar exercício
      </label>
      <div className="search-box">
        <SearchIcon />
        <input
          id={id}
          type="search"
          className="search-input"
          autoComplete="off"
          placeholder="Ex.: bench, row, curl"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={
            onEnter &&
            ((e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              onEnter()
            })
          }
        />
      </div>
    </div>
  )
}
