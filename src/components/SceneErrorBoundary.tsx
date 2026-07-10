import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  error: string | null
}

/** Prevent a WebGL crash from blanking the whole app. */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg }
  }

  componentDidCatch(err: unknown) {
    console.error('[SceneErrorBoundary]', err)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: '#05060a',
            color: '#e2e8f0',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Map failed to render</h2>
            <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 13, maxWidth: 420 }}>
              {this.state.error}
            </p>
            <button
              type="button"
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(125,211,252,0.15)',
                color: '#e0f2fe',
                cursor: 'pointer',
              }}
              onClick={() => {
                this.setState({ error: null })
                this.props.onReset?.()
                window.location.reload()
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
