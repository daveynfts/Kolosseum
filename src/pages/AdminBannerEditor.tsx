/**
 * Admin: partner event ribbon — text fields + logo/art upload to R2.
 */
import { useEffect, useRef, useState } from 'react'
import {
  resolveBannerArt,
  resolveBannerLogo,
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

interface Props {
  onToast: (msg: string) => void
}

export function AdminBannerEditor({ onToast }: Props) {
  const [config, setConfig] = useState<SiteBannerConfig>(() => seedSiteBanner())
  const [source, setSource] = useState<'server' | 'cache' | 'seed'>('seed')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'art' | null>(null)
  const [tokenInput, setTokenInput] = useState(() => getAdminToken())
  const logoInputRef = useRef<HTMLInputElement>(null)
  const artInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void loadSiteBannerWithSource().then((r) => {
      if (cancelled) return
      setConfig(r.config)
      setSource(r.source)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const patch = (patch: Partial<SiteBannerConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const onSave = async () => {
    const token = tokenInput.trim() || getAdminToken()
    if (!token) {
      onToast('Nhập FEED_ADMIN_TOKEN rồi Save (R2)')
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
    const token = tokenInput.trim() || getAdminToken()
    if (!token) {
      onToast('Nhập FEED_ADMIN_TOKEN trước khi upload')
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

  return (
    <div className="admin-feed admin-banner-page">
      <div className="admin-ai-banner glass" style={{ marginBottom: 12 }}>
        <strong>Event Banner · SCEX ribbon</strong>
        <span>
          Chỉnh text + ảnh cho ribbon trên map/SCEX. Source:{' '}
          <strong>{source}</strong>
          {dirty ? ' · unsaved' : ''}. JSON R2{' '}
          <code>site/banner/v1.json</code> · ảnh{' '}
          <code>scex-banner/scex-logo.*</code>,{' '}
          <code>scex-banner/x-banner.*</code>. Nếu chưa upload ảnh, fallback
          file trong <code>public/scex-banner/</code>.
        </span>
        <label className="admin-token-row">
          Token
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="FEED_ADMIN_TOKEN"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="admin-banner-toolbar">
        <button
          type="button"
          className="btn btn--primary"
          disabled={saving}
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
      </div>

      <div className="admin-banner-grid">
        <div className="admin-banner-form glass">
          <h3>Nội dung</h3>
          <label className="admin-banner-field admin-banner-field--check">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
            Hiển thị banner
          </label>
          <label className="admin-banner-field">
            Link đích (href)
            <input
              type="url"
              value={config.href}
              onChange={(e) => patch({ href: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="admin-banner-field">
            Eyebrow
            <input
              type="text"
              value={config.eyebrow}
              onChange={(e) => patch({ eyebrow: e.target.value })}
            />
          </label>
          <label className="admin-banner-field">
            Title
            <input
              type="text"
              value={config.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label className="admin-banner-field">
            Subtitle
            <input
              type="text"
              value={config.subtitle}
              onChange={(e) => patch({ subtitle: e.target.value })}
            />
          </label>
          <label className="admin-banner-field">
            Pill (badge phải)
            <input
              type="text"
              value={config.pill}
              onChange={(e) => patch({ pill: e.target.value })}
            />
          </label>
          <label className="admin-banner-field">
            CTA
            <input
              type="text"
              value={config.cta}
              onChange={(e) => patch({ cta: e.target.value })}
            />
          </label>
          <label className="admin-banner-field">
            aria-label (accessibility)
            <input
              type="text"
              value={config.ariaLabel || ''}
              onChange={(e) => patch({ ariaLabel: e.target.value })}
            />
          </label>

          <h3>Ảnh (R2)</h3>
          <div className="admin-banner-upload">
            <div className="admin-banner-upload__thumb">
              <img src={resolveBannerLogo(config)} alt="Logo preview" />
            </div>
            <div className="admin-banner-upload__actions">
              <p>
                Logo ·{' '}
                {config.logoUrl ? (
                  <code>{config.logoUrl.slice(0, 48)}…</code>
                ) : (
                  'local fallback'
                )}
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
                  className="btn btn--ghost"
                  onClick={() => patch({ logoUrl: '' })}
                >
                  Dùng local fallback
                </button>
              ) : null}
            </div>
          </div>

          <div className="admin-banner-upload">
            <div className="admin-banner-upload__thumb admin-banner-upload__thumb--wide">
              <img src={resolveBannerArt(config)} alt="Art preview" />
            </div>
            <div className="admin-banner-upload__actions">
              <p>
                Art / background ·{' '}
                {config.artUrl ? (
                  <code>{config.artUrl.slice(0, 48)}…</code>
                ) : (
                  'local fallback'
                )}
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
                  className="btn btn--ghost"
                  onClick={() => patch({ artUrl: '' })}
                >
                  Dùng local fallback
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="admin-banner-preview glass">
          <h3>Preview</h3>
          <div className="admin-banner-preview__frame">
            <SiteBannerRibbon config={config} />
          </div>
        </div>
      </div>
    </div>
  )
}
