/**
 * Admin: partner event ribbon — text fields + logo/art upload to R2.
 */
import { useRef, useState, type ReactNode } from 'react'
import {
  resolveBannerArt,
  resolveBannerLogo,
  BANNER_ART_SPEC,
  BANNER_COPY_LIMITS,
  BANNER_LOGO_SPEC,
  type SiteBannerConfig,
} from '../data/siteBanner'
import { uploadBannerImage } from '../lib/bannerImageUpload'
import { getAdminToken, setAdminToken } from '../lib/feedStore'
import {
  clearSiteBannerCache,
  exportSiteBannerJson,
  importSiteBannerJson,
  loadSiteBannerWithSource,
  saveSiteBannerToServer,
  seedSiteBanner,
} from '../lib/siteBannerStore'
import { SiteBannerRibbon } from '../components/ScexEventBanner'
import {
  confirmDiscardUnsaved,
  useDirtyRef,
  useRegisterAdminOps,
  useRemoteDatasetLoad,
} from '../lib/adminLoadGuard'

interface Props {
  onToast: (msg: string) => void
}

export function AdminBannerEditor({ onToast }: Props) {
  const [config, setConfig] = useState<SiteBannerConfig>(() => seedSiteBanner())
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useDirtyRef(dirty)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'art' | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const artInputRef = useRef<HTMLInputElement>(null)

  useRemoteDatasetLoad(loadSiteBannerWithSource, dirtyRef, (r) => {
    setConfig(r.config)
    setSource(r.source)
  })

  const patch = (patch: Partial<SiteBannerConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const onSave = async () => {
    const token = getAdminToken()
    if (!token) {
      onToast('Dán FEED_ADMIN_TOKEN ở thanh ops rồi Save (R2)')
      return
    }
    setAdminToken(token)
    setSaving(true)
    const result = await saveSiteBannerToServer(
      config,
      'admin site banner',
      token,
    )
    setSaving(false)
    if (!result.ok) {
      onToast(`Publish thất bại: ${result.error}`)
      return
    }
    setConfig(result.config)
    setSource('server')
    setDirty(false)
    onToast('Đã publish banner → R2')
  }

  const onReload = () => {
    if (!confirmDiscardUnsaved(dirty)) return
    void loadSiteBannerWithSource().then((r) => {
      setConfig(r.config)
      setSource(r.source)
      setDirty(false)
      onToast(`Reloaded from ${r.source}`)
    })
  }

  const onResetSeed = () => {
    if (!confirm('Reset về seed mặc định trong repo?')) return
    clearSiteBannerCache()
    setConfig(seedSiteBanner())
    setSource('seed')
    setDirty(true)
    onToast('Seed loaded — Save (R2) để publish')
  }

  const onExport = () => {
    const blob = new Blob([exportSiteBannerJson(config)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `site-banner-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    onToast('Exported JSON')
  }

  const onImport = async (file: File) => {
    try {
      const imported = importSiteBannerJson(await file.text())
      setConfig(imported)
      setSource('seed')
      setDirty(true)
      onToast('Imported banner JSON')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Import failed')
    }
  }

  const onUpload = async (file: File, slot: 'logo' | 'art') => {
    const token = getAdminToken()
    if (!token) {
      onToast('Dán FEED_ADMIN_TOKEN ở thanh ops trước khi upload')
      return
    }
    setAdminToken(token)
    setUploading(slot)
    const result = await uploadBannerImage(file, slot, token)
    setUploading(null)
    if (!result.ok) {
      onToast(`Upload thất bại: ${result.error}`)
      return
    }
    if (slot === 'logo') {
      patch({ logoUrl: result.url })
    } else {
      patch({ artUrl: result.url })
    }
    onToast(`Đã upload ${slot} → R2`)
  }

  useRegisterAdminOps('banner', {
    dirty,
    saving,
    source,
    updatedAt: config.updatedAt ?? null,
    save: () => void onSave(),
    reload: onReload,
  })

  return (
    <div className="admin-feed admin-banner-page">
      <div className="admin-banner-toolbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={saving || !dirty}
          onClick={() => void onSave()}
        >
          {saving ? 'Saving…' : 'Save → R2'}
        </button>
        <button type="button" className="btn" onClick={onReload}>
          Reload
        </button>
        <button type="button" className="btn" onClick={onResetSeed}>
          Reset seed
        </button>
        <button type="button" className="btn" onClick={onExport}>
          Export JSON
        </button>
        <label className="btn btn--file">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
        </label>
        <label className="admin-banner-enable">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          Hiển thị trên /scex
        </label>
      </div>

      <section className="admin-banner-preview">
        <div className="admin-banner-preview__bar">
          <h3>Preview</h3>
          <span>Đúng chiều rộng cột admin · trên /scex banner full viewport</span>
        </div>
        <div className="admin-banner-preview__live">
          {config.enabled ? (
            <SiteBannerRibbon config={config} />
          ) : (
            <p className="admin-banner-preview__off">
              Banner đang tắt — bật “Hiển thị trên /scex” để xem ribbon.
            </p>
          )}
        </div>
        <div className="admin-banner-preview__narrow">
          <span>Mobile (~720px) — subtitle ẩn, CTA rút</span>
          <div className="admin-banner-preview__narrow-frame">
            {config.enabled ? <SiteBannerRibbon config={config} /> : null}
          </div>
        </div>
      </section>

      <section className="admin-banner-form">
        <h3>Nội dung ribbon</h3>
        <p className="admin-banner-lead">
          Ribbon cao 76px, chữ 1 dòng. Vượt gợi ý ký tự thì preview/live sẽ cắt
          bằng ellipsis.
        </p>
        <div className="admin-banner-fields">
          <CopyField
            className="admin-banner-field--span2"
            label="Link đích"
            value={config.href}
          >
            <input
              type="url"
              value={config.href}
              onChange={(e) => patch({ href: e.target.value })}
              placeholder="https://…"
            />
          </CopyField>
          <CopyField
            label="Eyebrow"
            value={config.eyebrow}
            max={BANNER_COPY_LIMITS.eyebrow}
          >
            <input
              type="text"
              value={config.eyebrow}
              onChange={(e) => patch({ eyebrow: e.target.value })}
            />
          </CopyField>
          <CopyField
            label="Title"
            value={config.title}
            max={BANNER_COPY_LIMITS.title}
          >
            <input
              type="text"
              value={config.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </CopyField>
          <CopyField
            className="admin-banner-field--span2"
            label="Subtitle"
            value={config.subtitle}
            max={BANNER_COPY_LIMITS.subtitle}
          >
            <input
              type="text"
              value={config.subtitle}
              onChange={(e) => patch({ subtitle: e.target.value })}
            />
          </CopyField>
          <CopyField
            label="Pill (badge phải, ≥900px)"
            value={config.pill}
            max={BANNER_COPY_LIMITS.pill}
          >
            <input
              type="text"
              value={config.pill}
              onChange={(e) => patch({ pill: e.target.value })}
            />
          </CopyField>
          <CopyField
            label="CTA"
            value={config.cta}
            max={BANNER_COPY_LIMITS.cta}
          >
            <input
              type="text"
              value={config.cta}
              onChange={(e) => patch({ cta: e.target.value })}
            />
          </CopyField>
          <CopyField
            className="admin-banner-field--span2"
            label="aria-label"
            value={config.ariaLabel || ''}
          >
            <input
              type="text"
              value={config.ariaLabel || ''}
              onChange={(e) => patch({ ariaLabel: e.target.value })}
              placeholder="Đọc cho screen reader khi không có title"
            />
          </CopyField>
        </div>
      </section>

      <section className="admin-banner-assets">
        <article className="admin-banner-asset">
          <h3>Logo</h3>
          <div className="admin-banner-asset__frame admin-banner-asset__frame--logo">
            <img src={resolveBannerLogo(config)} alt="" />
          </div>
          <p className="admin-banner-asset__spec">
            Tỷ lệ <strong>{BANNER_LOGO_SPEC.ratio}</strong> ·{' '}
            {BANNER_LOGO_SPEC.width}×{BANNER_LOGO_SPEC.height}px ·{' '}
            {BANNER_LOGO_SPEC.format}
            <br />
            {BANNER_LOGO_SPEC.hint}
          </p>
          <p className="admin-banner-asset__url">
            {config.logoUrl ? config.logoUrl : 'Fallback public/scex-banner/scex-logo.png'}
          </p>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onUpload(f, 'logo')
              e.target.value = ''
            }}
          />
          <div className="admin-banner-asset__btns">
            <button
              type="button"
              className="btn"
              disabled={uploading === 'logo'}
              onClick={() => logoInputRef.current?.click()}
            >
              {uploading === 'logo' ? 'Uploading…' : 'Upload logo'}
            </button>
            {config.logoUrl ? (
              <button
                type="button"
                className="btn"
                onClick={() => patch({ logoUrl: '' })}
              >
                Dùng fallback
              </button>
            ) : null}
          </div>
        </article>

        <article className="admin-banner-asset">
          <h3>Art / background</h3>
          <div className="admin-banner-asset__frame admin-banner-asset__frame--art">
            <img src={resolveBannerArt(config)} alt="" />
          </div>
          <p className="admin-banner-asset__spec">
            Tỷ lệ <strong>{BANNER_ART_SPEC.ratio}</strong> ·{' '}
            {BANNER_ART_SPEC.width}×{BANNER_ART_SPEC.height}px ·{' '}
            {BANNER_ART_SPEC.format}
            <br />
            {BANNER_ART_SPEC.hint} Crop: {BANNER_ART_SPEC.objectPosition}.
          </p>
          <p className="admin-banner-asset__url">
            {config.artUrl ? config.artUrl : 'Fallback public/scex-banner/x-banner.jpg'}
          </p>
          <input
            ref={artInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onUpload(f, 'art')
              e.target.value = ''
            }}
          />
          <div className="admin-banner-asset__btns">
            <button
              type="button"
              className="btn"
              disabled={uploading === 'art'}
              onClick={() => artInputRef.current?.click()}
            >
              {uploading === 'art' ? 'Uploading…' : 'Upload art'}
            </button>
            {config.artUrl ? (
              <button
                type="button"
                className="btn"
                onClick={() => patch({ artUrl: '' })}
              >
                Dùng fallback
              </button>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  )
}

function CopyField({
  label,
  value,
  max,
  className,
  children,
}: {
  label: string
  value: string
  max?: number
  className?: string
  children: ReactNode
}) {
  const over = max != null && value.length > max
  return (
    <label
      className={`admin-banner-field${className ? ` ${className}` : ''}${over ? ' is-over' : ''}`}
    >
      <span className="admin-banner-field__lab">
        {label}
        {max != null ? (
          <em>
            {value.length}/{max}
          </em>
        ) : null}
      </span>
      {children}
    </label>
  )
}
