import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { initOfflineSync } from './lib/offline'

const queryClient = new QueryClient()

// Global error handlers to persist uncaught errors for debugging
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev) => {
    try {
      const payload = {
        message: ev.message,
        filename: (ev as any).filename,
        lineno: (ev as any).lineno,
        colno: (ev as any).colno,
        stack: (ev.error && ev.error.stack) || undefined,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
        href: location.href,
      }
      console.error('Global error captured:', payload)
      localStorage.setItem('lastClientError', JSON.stringify(payload))
    } catch (e) {
      /* ignore */
    }
  })

  window.addEventListener('unhandledrejection', (ev) => {
    try {
      const payload = {
        reason: (ev as any).reason,
        time: new Date().toISOString(),
        userAgent: navigator.userAgent,
        href: location.href,
      }
      console.error('Unhandled promise rejection:', payload)
      localStorage.setItem('lastClientError', JSON.stringify(payload))
    } catch (e) {
      /* ignore */
    }
  })

  // Initialize offline queue syncing (will no-op in non-browser env)
  try {
    initOfflineSync()
  } catch (e) {
    console.warn('failed to initialize offline sync', e)
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
)