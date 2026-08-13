import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
  /** Change this when the texture URL/handle changes so a past error can retry. */
  resetKey?: string
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

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: false })
    }
  }

  render() {
    if (this.state.error) return this.props.fallback
    return this.props.children
  }
}
