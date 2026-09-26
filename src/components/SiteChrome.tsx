import type { FormEvent, ReactNode } from 'react'
import { WalletButton } from '../research/WalletButton'

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

      {arena && <nav className="premium-nav" aria-label="Main navigation"><a href="/scex" aria-current={window.location.pathname === '/scex' ? 'page' : undefined}>Arena</a>{(__SURF_DEMO_ENABLED__ || __DEEP_RESEARCH_ENABLED__) && <a href="/me" aria-current={window.location.pathname === '/me' ? 'page' : undefined}>My Reports</a>}</nav>}
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
      {arena && <div className="premium-header-wallet"><span className="premium-network"><i /> Solana Devnet</span><WalletButton /></div>}
    </header>
  )
}
