import type { FormEvent, ReactNode } from 'react'

export type SiteChromePage = 'map' | 'scex' | 'event'

const TABS: Array<{ id: SiteChromePage; href: string; label: string }> = [
  { id: 'map', href: '/', label: 'VN KOLs' },
  { id: 'scex', href: '/scex', label: 'SCEX' },
  {
    id: 'event',
    href: '/event',
    label: 'Events',
  },
]

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
  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    search?.onSubmit?.()
  }

  return (
    <header
      className={`site-chrome${overlay ? ' site-chrome--overlay glass-regular' : ''}`}
    >
      <a className="site-chrome__brand" href="/" title="Davey's Radar">
        <img
          className="site-chrome__mark"
          src="/logo.jpg"
          alt=""
          width={64}
          height={64}
          decoding="async"
        />
        <span className="site-chrome__name">Davey's Radar</span>
      </a>

      <nav className="site-chrome__tabs" aria-label="Sản phẩm">
        {TABS.map((t) => (
          <a
            key={t.id}
            href={t.href}
            className={`site-chrome__tab ${active === t.id ? 'is-active' : ''}`}
            aria-current={active === t.id ? 'page' : undefined}
          >
            {t.label}
          </a>
        ))}
      </nav>

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
            placeholder={search.placeholder || 'Tìm KOL, @handle…'}
            aria-label="Tìm KOL"
            autoComplete="off"
            enterKeyHint="search"
          />
          {search.value ? (
            <button
              type="button"
              className="site-chrome__search-clear"
              onClick={() => search.onChange('')}
              title="Xóa"
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
