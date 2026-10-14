import { Button, Card, ErrorText, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/authContext'
import { errorMessage, supabase } from '@/lib/supabase'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router'

const RESEND_SECONDS = 60

export function LoginPage() {
  const { session, authError, clearAuthError } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [localError, setError] = useState<string | null>(null)
  const error = localError ?? authError

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (session) return <Navigate to="/" replace />

  async function sendLink(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    clearAuthError()
    const target = email.trim()
    const { error } = await supabase.auth.signInWithOtp({
      email: target,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    setSentTo(target)
    setCooldown(RESEND_SECONDS)
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (!sentTo) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(errorMessage(error))
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">SafeOrder</h1>
        <p className="mt-2 text-muted">Remember what you can order, and exactly how to order it.</p>
      </div>

      <Card className="space-y-4">
        {!sentTo ? (
          <form onSubmit={sendLink} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <ErrorText error={error} />
            <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
            <p className="text-sm text-muted">No password needed. New here? This creates your account.</p>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold">Check your email</h2>
              <p className="mt-1 text-muted">
                We sent a sign-in link to <strong className="text-text">{sentTo}</strong>. Open it on this
                device, or type the 6-digit code from the email below.
              </p>
            </div>
            <form onSubmit={verifyCode} className="space-y-3">
              <Field label="Code from email">
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                />
              </Field>
              <ErrorText error={error} />
              <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
                {busy ? 'Checking…' : 'Sign in with code'}
              </Button>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" className="text-accent" onClick={() => setSentTo(null)}>
                Use a different email
              </button>
              <button
                type="button"
                className="text-accent disabled:text-muted"
                disabled={cooldown > 0 || busy}
                onClick={() => sendLink()}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
              </button>
            </div>
            <p className="text-sm text-muted">Didn’t get it? Check your spam folder.</p>
          </div>
        )}
      </Card>
    </main>
  )
}
