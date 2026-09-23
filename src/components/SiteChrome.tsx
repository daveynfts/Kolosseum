import type { FormEvent, ReactNode } from 'react'

export type SiteChromePage = 'map' | 'scex' | 'event'

type SearchProps = {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
}

type Props = {
  active: SiteChromePage
  search?: SearchProps
  trailing?: ReactNode
  overlay?: boolean
}

export function SiteChrome({ active, search, trailing, overlay }: Props) {
  const arena = active === 'scex'
  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    search?.onSubmit?.()
  }

  return (
    <header
      className={`site-chrome${overlay ? ' site-chrome--overlay glass-regular' : ''}${arena ? ' site-chrome--arena' : ''}`}
    >
      <a
        className="site-chrome__brand"
        href="/scex"
        title="Kolosseum"
      >
        <img
          className="site-chrome__mark"
          src="/kolosseum-mark.svg"
          alt=""
          width={64}
          height={64}
          decoding="async"
        />
        <span className="site-chrome__name">
          KOLOSSEUM
        </span>
      </a>

      <span className="site-chrome__arena-inscription" aria-hidden="true">
        THE KOL ARENA <i>✦</i> SOLANA DEVNET
      </span>
      {search ? (
        <form
          className={`site-chrome__search${overlay ? ' glass-fill' : ''}`}
          onSubmit={onSearchSubmit}
        >
          <span className="site-chrome__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder || 'Search KOL or @handle…'}
            aria-label="Search KOLs"
            autoComplete="off"
            enterKeyHint="search"
          />
          {search.value ? (
            <button
              type="button"
              className="site-chrome__search-clear"
              onClick={() => search.onChange('')}
              title="Clear search"
            >
              ×
            </button>
          ) : null}
        </form>
      ) : (
        <div className="site-chrome__spacer" />
      )}

      {trailing ? (
        <div className="site-chrome__trailing">{trailing}</div>
      ) : null}
    </header>
  )
}
