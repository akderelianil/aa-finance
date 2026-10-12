import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './i18n'
import './index.css'
import App from './App'
import { initTheme } from './components/ThemeToggle'
import { Toaster } from './components/ui/toast'

initTheme()

// Local data: no retries on a failed read, no refetch on focus.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Toaster>
        <HashRouter>
          <App />
        </HashRouter>
      </Toaster>
    </QueryClientProvider>
  </StrictMode>,
)
