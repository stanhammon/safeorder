import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from './authContext'
import { DRAFT_PREFIX } from './draft'
import { persister } from './persist'
import { authStorageKey, supabase } from './supabase'

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

/**
 * The session saved on this device, used only while offline: getSession()
 * returns null when an expired token can't be refreshed without a connection.
 */
function offlineSession(): Session | null {
  if (navigator.onLine) return null
  try {
    const saved = JSON.parse(localStorage.getItem(authStorageKey) ?? 'null') as Session | null
    return saved?.user?.id ? saved : null
  } catch {
    return null
  }
}

function clearDrafts() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(DRAFT_PREFIX)) localStorage.removeItem(key)
  } catch {
    // Storage unavailable: nothing to clear.
  }
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
        setSession(data.session ?? offlineSession())
        setLoading(false)
      })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Offline, an expired token can't be refreshed; keep the saved session
      // rather than treating that as signing out (SPEC §6.4).
      if (!next && event !== 'SIGNED_OUT' && !navigator.onLine) return
      setSession(next)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    // Shared phones: drop every cached household row and draft on sign-out (SPEC §9).
    queryClient.clear()
    await persister.removeClient()
    clearDrafts()
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, authError, clearAuthError: () => setAuthError(null), signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}
