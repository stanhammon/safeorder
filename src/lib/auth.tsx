import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from './authContext'
import { supabase } from './supabase'

/**
 * Finish a sign-in link redirect. Supabase sends people back with either
 * ?code=… (PKCE) or ?error_description=… (in the query or the hash). We handle
 * it ourselves instead of detectSessionInUrl so failures reach the login screen.
 * Module-level so StrictMode's double effect doesn't spend the code twice.
 */
let redirectResult: Promise<string | null> | null = null

function completeRedirect(): Promise<string | null> {
  redirectResult ??= (async () => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    const code = url.searchParams.get('code')
    const reported = url.searchParams.get('error_description') ?? hash.get('error_description')

    if (!code && !reported) return null

    for (const key of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(key)
    window.history.replaceState(null, '', url.pathname + url.search)

    if (reported) return reported
    const { error } = await supabase.auth.exchangeCodeForSession(code!)
    if (!error) return null
    console.error('Sign-in link exchange failed', error)
    if (/code verifier/i.test(error.message)) {
      return 'This sign-in link was opened in a different browser from the one you requested it in. Open the link in the same browser, or request a new one here.'
    }
    return `Sign-in link didn’t work: ${error.message}`
  })()
  return redirectResult
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    completeRedirect()
      .then((error) => {
        if (active) setAuthError(error)
        return supabase.auth.getSession()
      })
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    // Shared phones: drop every cached household row on sign-out (SPEC §9).
    queryClient.clear()
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, authError, clearAuthError: () => setAuthError(null), signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}
