import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

interface State {
  error: boolean
}

/** Catches failed texture loads so one bad avatar doesn't blank the map. */
export class TextureErrorBoundary extends Component<Props, State> {
  state: State = { error: false }

  static getDerivedStateFromError() {
    return { error: true }
  }

  render() {
    if (this.state.error) return this.props.fallback
    return this.props.children
  }
}
