import {
  Avatar,
  Button,
  Card,
  ColorPicker,
  Disclaimer,
  ErrorText,
  Field,
  Input,
  PageHeader,
  SectionTitle,
  Spinner,
} from '@/components/ui'
import { useAuth } from '@/lib/authContext'
import {
  useAllergens,
  useCreateInvite,
  useDeleteAllergen,
  useHiddenAllergenIds,
  useHousehold,
  useHouseholdContext,
  useInvites,
  useLeaveHousehold,
  useMembers,
  useRemoveMember,
  useRenameAllergen,
  useRevokeInvite,
  useSetAllergenHidden,
  useTransferOwnership,
  useUpdateHousehold,
  useUpdateMyProfile,
} from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Household, Profile } from '@/lib/types'
import { useState, type FormEvent } from 'react'

export function SettingsPage() {
  const { profile, householdId } = useHouseholdContext()
  const household = useHousehold(householdId)

  if (household.isPending) return <Spinner />
  if (household.error) return <ErrorText error={errorMessage(household.error)} />

  const isOwner = household.data.owner_id === profile.id

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <AccountSection profile={profile} />
        <HouseholdSection household={household.data} isOwner={isOwner} />
        <MembersSection household={household.data} me={profile} isOwner={isOwner} />
        <InvitesSection householdId={householdId} />
        <AllergenSection householdId={householdId} />
        <Card className="space-y-3">
          <SectionTitle>About</SectionTitle>
          <Disclaimer />
          <p className="text-sm text-muted">SafeOrder v{__APP_VERSION__}</p>
        </Card>
      </div>
    </>
  )
}

function AccountSection({ profile }: { profile: Profile }) {
  const { session, signOut } = useAuth()
  const update = useUpdateMyProfile()
  const [name, setName] = useState(profile.display_name)
  const [error, setError] = useState<string | null>(null)

  function save(patch: Parameters<typeof update.mutate>[0]) {
    setError(null)
    update.mutate(patch, { onError: (e) => setError(errorMessage(e)) })
  }

  return (
    <Card className="space-y-4">
      <SectionTitle>Your account</SectionTitle>
      <p className="text-sm text-muted">Signed in as {session?.user.email}</p>
      <Field label="Display name">
        <Input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== profile.display_name && save({ display_name: name.trim() })}
        />
      </Field>
      <div className="space-y-2">
        <span className="text-sm font-medium">Color</span>
        <ColorPicker value={profile.color} onChange={(color) => save({ color })} />
      </div>
      <Field label="Server card style" hint="How the full-screen card for restaurant staff looks.">
        <select
          className="min-h-12 w-full rounded-xl border border-border bg-surface px-3"
          value={profile.server_card_theme}
          onChange={(e) => save({ server_card_theme: e.target.value as Profile['server_card_theme'] })}
        >
          <option value="light">Black on white</option>
          <option value="dark">White on black</option>
        </select>
      </Field>
      <ErrorText error={error} />
      <Button variant="secondary" onClick={signOut}>
        Sign out
      </Button>
    </Card>
  )
}

function HouseholdSection({ household, isOwner }: { household: Household; isOwner: boolean }) {
  const update = useUpdateHousehold(household.id)
  const [months, setMonths] = useState(String(Math.round(household.stale_after_days / 30)))
  const [error, setError] = useState<string | null>(null)

  function save(patch: Parameters<typeof update.mutate>[0]) {
    setError(null)
    update.mutate(patch, { onError: (e) => setError(errorMessage(e)) })
  }

  return (
    <Card className="space-y-4">
      <SectionTitle>Preferences</SectionTitle>
      {!isOwner && (
        <p className="text-sm text-muted">
          These apply to everyone you share with. Only the owner of the shared list can change them.
        </p>
      )}
      <Field
        label="Ask to re-confirm orders after (months)"
        hint="A saved order not confirmed within this time shows “Re-confirm with staff”."
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={24}
          value={months}
          disabled={!isOwner}
          onChange={(e) => setMonths(e.target.value)}
          onBlur={() => {
            const m = Math.min(24, Math.max(1, Math.round(Number(months) || 6)))
            setMonths(String(m))
            if (m * 30 !== household.stale_after_days) save({ stale_after_days: m * 30 })
          }}
        />
      </Field>
      <Field label="Default currency">
        <select
          className="min-h-12 w-full rounded-xl border border-border bg-surface px-3 disabled:opacity-60"
          value={household.default_currency}
          disabled={!isOwner}
          onChange={(e) => save({ default_currency: e.target.value })}
        >
          {['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'JPY', 'MXN'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <ErrorText error={error} />
    </Card>
  )
}

function MembersSection({ household, me, isOwner }: { household: Household; me: Profile; isOwner: boolean }) {
  const members = useMembers(household.id)
  const remove = useRemoveMember()
  const transfer = useTransferOwnership()
  const leave = useLeaveHousehold()
  const [error, setError] = useState<string | null>(null)
  const onError = (e: unknown) => setError(errorMessage(e))

  if (members.isPending) return <Spinner />
  if ((members.data?.length ?? 0) <= 1) return null

  return (
    <Card className="space-y-3">
      <SectionTitle>Shared with</SectionTitle>
      <p className="text-sm text-muted">
        Everyone here sees the same restaurants and dishes. Each person keeps their own allergies and orders.
      </p>
      <ul className="space-y-3">
        {members.data?.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3">
            <Avatar name={m.display_name} color={m.color} size="sm" />
            <span className="flex-1">
              {m.display_name}
              {m.id === household.owner_id && <span className="ml-2 text-sm text-muted">owner</span>}
              {m.id === me.id && <span className="ml-2 text-sm text-muted">you</span>}
            </span>
            {isOwner && m.id !== me.id && (
              <span className="flex gap-2">
                <Button
                  variant="ghost"
                  className="min-h-9 px-2 text-sm"
                  onClick={() =>
                    confirm(`Make ${m.display_name} the owner of your shared list? Only they will be able to change shared preferences.`) &&
                    transfer.mutate(m.id, { onError })
                  }
                >
                  Make owner
                </Button>
                <Button
                  variant="danger"
                  className="min-h-9 px-2 text-sm"
                  onClick={() =>
                    confirm(
                      `Stop sharing with ${m.display_name}? They lose access immediately. Their saved orders and meals stay.`,
                    ) && remove.mutate(m.id, { onError })
                  }
                >
                  Stop sharing
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <ErrorText error={error} />
      {!isOwner && (
        <Button
          variant="danger"
          onClick={() =>
            confirm('Stop sharing? You will lose access to the shared restaurants and orders.') &&
            leave.mutate(undefined, { onError })
          }
        >
          Leave shared list
        </Button>
      )}
    </Card>
  )
}

function InvitesSection({ householdId }: { householdId: string }) {
  const invites = useInvites(householdId)
  const create = useCreateInvite(householdId)
  const revoke = useRevokeInvite(householdId)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function share(inviteEmail: string) {
    const url = `${window.location.origin}/login?email=${encodeURIComponent(inviteEmail)}`
    const text = `I’m sharing my restaurant orders with you on SafeOrder. Sign in with ${inviteEmail} here: ${url}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SafeOrder invite', text })
        return
      } catch {
        // Cancelled or unsupported: fall back to copying.
      }
    }
    await navigator.clipboard.writeText(text)
    setCopied(inviteEmail)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const target = email.trim()
    create.mutate(target, {
      onSuccess: () => {
        setEmail('')
        share(target)
      },
      onError: (err) => setError(errorMessage(err)),
    })
  }

  return (
    <Card className="space-y-4">
      <SectionTitle>Share with someone</SectionTitle>
      <p className="text-sm text-muted">
        Share your restaurants and dishes with a partner or family member. Each of you keeps your own
        allergies and orders. Add their email, then send them the message. When they sign in with that
        email, they’ll be asked to join you. Invites expire after 7 days.
      </p>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="partner@example.com"
          aria-label="Email to invite"
        />
        <Button type="submit" disabled={create.isPending || !email.trim()}>
          Invite
        </Button>
      </form>
      <ErrorText error={error} />
      {invites.data && invites.data.length > 0 && (
        <ul className="divide-y divide-border">
          {invites.data.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate">
                {inv.email}
                <span className="block text-xs text-muted">
                  Expires {new Date(inv.expires_at).toLocaleDateString()}
                </span>
              </span>
              <Button variant="ghost" className="min-h-9 px-2 text-sm" onClick={() => share(inv.email)}>
                {copied === inv.email ? 'Copied' : 'Send again'}
              </Button>
              <Button
                variant="danger"
                className="min-h-9 px-2 text-sm"
                onClick={() => revoke.mutate(inv.id, { onError: (e) => setError(errorMessage(e)) })}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function AllergenSection({ householdId }: { householdId: string }) {
  const allergens = useAllergens(householdId)
  const hidden = useHiddenAllergenIds(householdId)
  const setHidden = useSetAllergenHidden(householdId)
  const rename = useRenameAllergen(householdId)
  const remove = useDeleteAllergen(householdId)
  const [error, setError] = useState<string | null>(null)
  const onError = (e: unknown) => setError(errorMessage(e))

  if (allergens.isPending || hidden.isPending) return <Spinner />
  const presets = allergens.data?.filter((a) => a.is_preset) ?? []
  const custom = allergens.data?.filter((a) => !a.is_preset) ?? []

  return (
    <Card className="space-y-4">
      <SectionTitle>Allergen list</SectionTitle>
      <ErrorText error={error} />
      <div>
        <h3 className="mb-2 text-sm font-medium">Standard allergens</h3>
        <p className="mb-2 text-sm text-muted">Untick any you never need, to shorten the lists.</p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {presets.map((a) => (
            <li key={a.id}>
              <label className="flex min-h-10 items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--accent)]"
                  checked={!hidden.data?.has(a.id)}
                  onChange={(e) => setHidden.mutate({ allergenId: a.id, hidden: !e.target.checked }, { onError })}
                />
                {a.name}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium">Custom allergens</h3>
        {custom.length === 0 ? (
          <p className="text-sm text-muted">None yet. Add them from anyone’s allergy profile.</p>
        ) : (
          <ul className="space-y-2">
            {custom.map((a) => (
              <li key={a.id} className="flex gap-2">
                <Input
                  key={a.name}
                  defaultValue={a.name}
                  maxLength={40}
                  aria-label={`Rename ${a.name}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== a.name) rename.mutate({ id: a.id, name: v }, { onError })
                  }}
                />
                <Button
                  variant="danger"
                  onClick={() => confirm(`Delete “${a.name}”?`) && remove.mutate(a.id, { onError })}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
