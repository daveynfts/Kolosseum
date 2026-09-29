import { useId, useRef, useState } from 'react'
import type { ScexActor } from '../data/scexTracking'
import { XProfileAvatar } from './XProfileAvatar'

type Props = { actors: ScexActor[]; onSelect: (actor: ScexActor) => void }

/** Keyboard-accessible discovery, independent of matrix filters. */
export function ArenaSearch({ actors, onSelect }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const term = query.trim().replace(/^@/, '').toLocaleLowerCase()
  const matches = term ? actors.filter(actor => !actor.isDenylisted &&
    (actor.displayName + ' ' + actor.handle).toLocaleLowerCase().includes(term)).slice(0, 8) : []
  const expanded = open && term.length > 0
  const select = (actor: ScexActor) => {
    setOpen(false)
    setQuery('')
    setActive(-1)
    input.current?.focus()
    onSelect(actor)
  }

  return (
    <div className="premium-kol-search" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <label htmlFor={id}>Find your next perspective</label>
      <div className="arena-search-field">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input ref={input} id={id} type="search" role="combobox" aria-autocomplete="list"
          aria-expanded={expanded} aria-controls={id + '-results'}
          aria-activedescendant={expanded && matches[active] ? id + '-option-' + active : undefined}
          aria-describedby={id + '-hint'} placeholder="Search a name or @handle" value={query}
          autoComplete="off" spellCheck={false}
          onFocus={() => setOpen(true)}
          onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1) }}
          onKeyDown={event => {
            if (event.key === 'Escape') { setOpen(false); setActive(-1); event.stopPropagation() }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
              if (matches.length) {
                const next = event.key === 'ArrowDown' ? (active + 1) % matches.length : (active <= 0 ? matches.length : active) - 1
                setActive(next)
                document.getElementById(id + '-option-' + next)?.scrollIntoView({ block: 'nearest' })
              }
            }
            if (event.key === 'Enter' && expanded && matches.length) {
              event.preventDefault()
              select(matches[active >= 0 ? active : 0])
            }
          }}
        />
        {query && <button type="button" className="arena-search-clear" aria-label="Clear KOL search"
          onClick={() => { setQuery(''); setActive(-1); input.current?.focus() }}>×</button>}
      </div>
      <span id={id + '-hint'} className="arena-search-hint">Explore a profile, then follow the evidence.</span>
      <div className="premium-search-results" hidden={!expanded}>
        <div className="arena-search-status" role="status">{matches.length ? matches.length + ' matching profiles' : 'No matching profiles. Try another name.'}</div>
        <ul id={id + '-results'} role="listbox" aria-label="KOL search results">
          {matches.map((actor, index) => <li id={id + '-option-' + index} key={actor.id}
            role="option" aria-selected={index === active} onMouseDown={event => event.preventDefault()}
            onClick={() => select(actor)} onMouseMove={() => setActive(index)}>
            <XProfileAvatar handle={actor.handle} name={actor.displayName} avatarUrl={actor.avatarUrl} size={36} />
            <span>{actor.displayName}<small>@{actor.handle}</small></span><span aria-hidden="true">↗</span>
          </li>)}
        </ul>
      </div>
    </div>
  )
}
