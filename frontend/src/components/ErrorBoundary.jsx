import { Component } from 'react'
import Page from './Page'
import { Button } from './ui'

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
      <Page title="Something went wrong" subtitle="This page hit an unexpected error. Your data is unchanged." width="max-w-3xl">
        <div role="alert">
          <Button variant="dark" onClick={() => this.setState({ error: null })}>Try again</Button>
        </div>
      </Page>
    )
  }
}
