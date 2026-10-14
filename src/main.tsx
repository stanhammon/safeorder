import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { SetupNeeded } from './app/SetupNeeded'
import './index.css'
import { AuthProvider } from './lib/auth'
import { CACHE_MAX_AGE_MS, persister } from './lib/persist'
import { isSupabaseConfigured } from './lib/supabase'

const queryClient = new QueryClient({
  defaultOptions: {
    // Keep data around as long as the offline cache does.
    queries: { staleTime: 30_000, retry: 1, gcTime: CACHE_MAX_AGE_MS },
    // Writes fail fast offline with a clear message instead of queueing
    // silently (SPEC §6.4: no offline writes in v1).
    mutations: { networkMode: 'always' },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSupabaseConfigured ? (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS, buster: __APP_VERSION__ }}
      >
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PersistQueryClientProvider>
    ) : (
      <SetupNeeded />
    )}
  </StrictMode>,
)
