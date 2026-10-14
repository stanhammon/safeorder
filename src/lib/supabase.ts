import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// A placeholder client keeps imports working when env is missing; the app shows
// a setup screen instead of making requests (see main.tsx).
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-key', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    // Sign-in redirects are completed in auth.tsx so errors can be shown.
    detectSessionInUrl: false,
  },
})

/** Turn a Supabase/Postgres error into something worth showing a person. */
export function errorMessage(error: unknown): string {
  if (!error) return 'Something went wrong'
  if (typeof error === 'object' && error !== null) {
    const e = error as { code?: string; message?: string }
    if (e.code === '23503') return 'This is still in use elsewhere, so it can’t be removed.'
    if (e.code === '23505') return 'That already exists.'
    if (e.message) return e.message
  }
  return String(error)
}
