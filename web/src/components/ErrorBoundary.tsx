import React from 'react'

type State = {
  hasError: boolean
  error?: Error | null
  errorInfo?: React.ErrorInfo | null
}

const persistError = (payload: Record<string, any>) => {
  try {
    localStorage.setItem('lastClientError', JSON.stringify(payload))
  } catch (e) {
    // ignore
  }
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const payload = {
      message: error?.message,
      stack: (error as any)?.stack,
      componentStack: errorInfo.componentStack,
      time: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      href: typeof location !== 'undefined' ? location.href : undefined,
    }
    console.error('Unhandled React error:', payload)
    persistError(payload)
    this.setState({ error, errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h2>Une erreur s'est produite — voir la console.</h2>
          {this.state.error && (
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
              {this.state.error.message}
              {'\n'}
              {(this.state.error as any).stack}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
