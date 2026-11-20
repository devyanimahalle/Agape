import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section role="alert" className="mx-auto max-w-xl p-8">
        <h2 className="text-3xl">Something went wrong</h2>
        <p className="mt-2 text-muted">This page hit an unexpected error. Your data is unchanged.</p>
        <button
          className="mt-4 rounded-card border border-line bg-ink px-5 py-2 font-bold uppercase tracking-[1px] text-panel"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </section>
    )
  }
}
