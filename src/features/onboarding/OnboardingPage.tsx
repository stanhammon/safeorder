import {
  Button,
  Card,
  ColorPicker,
  Disclaimer,
  ErrorText,
  Field,
  Input,
  PageHeader,
  Spinner,
} from '@/components/ui'
import { useAuth } from '@/lib/authContext'
import { AllergyEditor } from '@/features/people/AllergyEditor'
import {
  useAcceptInvite,
  useCreateHousehold,
  useMyInvites,
  useMyProfile,
  useUpdateMyProfile,
} from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router'

type Step = 'profile' | 'allergies' | 'location' | 'disclaimer'
const STEPS: Step[] = ['profile', 'allergies', 'location', 'disclaimer']

export function OnboardingPage() {
  const profile = useMyProfile()
  const [step, setStep] = useState<Step>('profile')

  if (profile.isPending) return <Spinner />
  if (profile.error) return <ErrorText error={errorMessage(profile.error)} />

  const p = profile.data
  if (p.household_id && p.disclaimer_ack_at) return <Navigate to="/" replace />

  const next = () => setStep(STEPS[STEPS.indexOf(step) + 1])
  const back = () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)])

  return (
    <Shell>
      {!p.household_id ? (
        <HouseholdStep profile={p} />
      ) : (
        <>
          <p className="mb-2 text-sm text-muted">
            Step {STEPS.indexOf(step) + 1} of {STEPS.length}
          </p>
          {step === 'profile' && <ProfileStep profile={p} onNext={next} />}
          {step === 'allergies' && (
            <AllergiesStep householdId={p.household_id} profileId={p.id} onNext={next} onBack={back} />
          )}
          {step === 'location' && <LocationStep onNext={next} onBack={back} />}
          {step === 'disclaimer' && <DisclaimerStep onBack={back} />}
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pt-8 pb-12">
      {children}
      <button type="button" onClick={signOut} className="mt-10 block text-sm text-muted underline">
        Sign out
      </button>
    </main>
  )
}

function HouseholdStep({ profile }: { profile: Profile }) {
  const invites = useMyInvites()
  const accept = useAcceptInvite()
  const create = useCreateHousehold()
  const [error, setError] = useState<string | null>(null)

  // The shared group behind the scenes is named after its creator; people never see it.
  function onCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    create.mutate(profile.display_name, { onError: (err) => setError(errorMessage(err)) })
  }

  return (
    <>
      <PageHeader
        title="Welcome"
        subtitle="Keep track of what you can order at restaurants, and exactly how to order it."
      />
      <ErrorText error={error} />

      {invites.isPending ? (
        <Spinner label="Checking for invites…" />
      ) : (
        invites.data &&
        invites.data.length > 0 && (
          <Card className="mb-4 space-y-3">
            <h2 className="font-semibold">You’ve been invited</h2>
            {invites.data.map((inv) => (
              <div key={inv.invite_id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{inv.invited_by_name}</div>
                  <div className="text-sm text-muted">wants to share their restaurants and orders with you</div>
                </div>
                <Button
                  disabled={accept.isPending}
                  onClick={() => {
                    setError(null)
                    accept.mutate(inv.invite_id, { onError: (err) => setError(errorMessage(err)) })
                  }}
                >
                  Join
                </Button>
              </div>
            ))}
          </Card>
        )
      )}

      <Card>
        <form onSubmit={onCreate} className="space-y-4">
          <Button
            type="submit"
            variant={invites.data?.length ? 'secondary' : 'primary'}
            className="w-full"
            disabled={create.isPending}
          >
            {invites.data?.length ? 'Start on my own instead' : 'Get started'}
          </Button>
          <p className="text-sm text-muted">
            Expecting someone to share with you? Ask them to add <strong>this email address</strong> under
            Settings → Share with someone, then reload this page.
          </p>
        </form>
      </Card>
    </>
  )
}

function ProfileStep({ profile, onNext }: { profile: Profile; onNext: () => void }) {
  const update = useUpdateMyProfile()
  const [name, setName] = useState(profile.display_name)
  const [color, setColor] = useState(profile.color)
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    update.mutate(
      { display_name: name.trim(), color },
      { onSuccess: onNext, onError: (err) => setError(errorMessage(err)) },
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <PageHeader title="About you" subtitle="This is how housemates see you." />
      <Field label="Your name">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
      </Field>
      <div className="space-y-2">
        <span className="text-sm font-medium">Color</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <ErrorText error={error} />
      <Button type="submit" className="w-full" disabled={update.isPending || !name.trim()}>
        Continue
      </Button>
    </form>
  )
}

function AllergiesStep(props: { householdId: string; profileId: string; onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Your allergies"
        subtitle="Mark each as an allergy or a preference. Add anything that isn’t listed. You can change these later."
      />
      <AllergyEditor householdId={props.householdId} profileId={props.profileId} />
      <StepNav onBack={props.onBack} onNext={props.onNext} />
    </div>
  )
}

function LocationStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [status, setStatus] = useState<'idle' | 'asking' | 'granted' | 'denied' | 'unsupported'>(
    'geolocation' in navigator ? 'idle' : 'unsupported',
  )

  function ask() {
    setStatus('asking')
    navigator.geolocation.getCurrentPosition(
      () => setStatus('granted'),
      () => setStatus('denied'),
      { timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nearby restaurants"
        subtitle="With location on, SafeOrder can sort restaurants by distance so the one you’re in comes first. Your location is only used on this device, never tracked in the background."
      />
      <Card className="space-y-3">
        {status === 'idle' && <Button onClick={ask}>Allow location</Button>}
        {status === 'asking' && <p className="text-muted">Waiting for your browser…</p>}
        {status === 'granted' && <p>Location is on.</p>}
        {status === 'denied' && (
          <p className="text-muted">
            Location is off. That’s fine: you can turn it on later in your browser settings.
          </p>
        )}
        {status === 'unsupported' && <p className="text-muted">This browser doesn’t support location.</p>}
      </Card>
      <StepNav onBack={onBack} onNext={onNext} nextLabel={status === 'granted' ? 'Continue' : 'Skip for now'} />
    </div>
  )
}

function DisclaimerStep({ onBack }: { onBack: () => void }) {
  const update = useUpdateMyProfile()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <PageHeader title="Before you start" />
      <Card>
        <Disclaimer />
      </Card>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[var(--accent)]"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>I understand SafeOrder is a memory aid and I’ll always confirm with staff.</span>
      </label>
      <ErrorText error={error} />
      <StepNav
        onBack={onBack}
        nextLabel="Finish"
        nextDisabled={!checked || update.isPending}
        onNext={() =>
          update.mutate(
            { disclaimer_ack_at: new Date().toISOString() },
            { onSuccess: () => navigate('/', { replace: true }), onError: (e) => setError(errorMessage(e)) },
          )
        }
      />
    </div>
  )
}

function StepNav(props: { onBack: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div className="flex gap-3">
      <Button variant="secondary" onClick={props.onBack}>
        Back
      </Button>
      <Button className="flex-1" onClick={props.onNext} disabled={props.nextDisabled}>
        {props.nextLabel ?? 'Continue'}
      </Button>
    </div>
  )
}
