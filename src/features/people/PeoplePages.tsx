import { Avatar, Button, Card, ErrorText, PageHeader, SectionTitle, Spinner, Textarea } from '@/components/ui'
import {
  useAllergens,
  useHouseholdContext,
  useMembers,
  usePersonAllergens,
  useUpdateMyProfile,
} from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AllergyEditor } from './AllergyEditor'

export function PeoplePage() {
  const { householdId, profile } = useHouseholdContext()
  const members = useMembers(householdId)
  const allergens = useAllergens(householdId)
  const personAllergens = usePersonAllergens(householdId)

  const error = members.error ?? allergens.error ?? personAllergens.error
  if (error) return <ErrorText error={errorMessage(error)} />
  if (!members.data || !allergens.data || !personAllergens.data) return <Spinner />

  const names = new Map(allergens.data.map((a) => [a.id, a.name]))

  return (
    <>
      <PageHeader title="People" subtitle="You and anyone you share with, and what each person avoids." />
      <ul className="space-y-3">
        {members.data.map((m) => {
          const mine = personAllergens.data!.filter((pa) => pa.profile_id === m.id)
          const allergies = mine.filter((pa) => pa.kind === 'allergy').map((pa) => names.get(pa.allergen_id))
          const prefs = mine.filter((pa) => pa.kind === 'preference').map((pa) => names.get(pa.allergen_id))
          return (
            <li key={m.id}>
              <Link
                to={`/people/${m.id}`}
                className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-2"
              >
                <Avatar name={m.display_name} color={m.color} />
                <div className="min-w-0">
                  <div className="font-semibold">
                    {m.display_name}
                    {m.id === profile.id && <span className="ml-2 text-sm font-normal text-muted">you</span>}
                  </div>
                  <p className="text-sm">
                    {allergies.length ? (
                      <>
                        <span className="text-danger">Allergies:</span> {allergies.join(', ')}
                      </>
                    ) : (
                      <span className="text-muted">No allergies recorded</span>
                    )}
                  </p>
                  {prefs.length > 0 && <p className="text-sm text-muted">Preferences: {prefs.join(', ')}</p>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">
        To add someone, share with them from <Link to="/settings" className="text-accent">Settings</Link>.
      </p>
    </>
  )
}

export function PersonPage() {
  const { personId } = useParams()
  const { householdId, profile } = useHouseholdContext()
  const members = useMembers(householdId)

  if (members.isPending) return <Spinner />
  if (members.error) return <ErrorText error={errorMessage(members.error)} />

  const person = members.data.find((m) => m.id === personId)
  if (!person) {
    return (
      <>
        <PageHeader title="Not found" subtitle="You don’t share with this person." />
        <Link to="/people" className="text-accent">
          Back to people
        </Link>
      </>
    )
  }
  const isMe = person.id === profile.id

  return (
    <>
      <Link to="/people" className="mb-3 inline-block text-sm text-accent">
        ← People
      </Link>
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={person.display_name} color={person.color} />
        <h1 className="text-2xl font-semibold tracking-tight">{person.display_name}</h1>
      </div>

      <Link
        to={`/people/${person.id}/card`}
        className="mb-6 flex min-h-14 items-center justify-center rounded-xl bg-text px-4 text-lg font-semibold text-bg"
      >
        Show allergy card
      </Link>

      <SectionTitle>Allergies & preferences</SectionTitle>
      <AllergyEditor householdId={householdId} profileId={person.id} />

      {isMe && <ChefMessage initial={person.chef_card_message ?? ''} initialEs={person.chef_card_message_es ?? ''} />}
    </>
  )
}

function ChefMessage({ initial, initialEs }: { initial: string; initialEs: string }) {
  const update = useUpdateMyProfile()
  const [value, setValue] = useState(initial)
  const [valueEs, setValueEs] = useState(initialEs)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unchanged = value === initial && valueEs === initialEs

  return (
    <Card className="mt-6 space-y-3">
      <SectionTitle>Message for the chef</SectionTitle>
      <p className="text-sm text-muted">Shown on your allergy card for restaurant staff.</p>
      <Textarea
        rows={3}
        maxLength={500}
        value={value}
        aria-label="Message in English"
        onChange={(e) => {
          setValue(e.target.value)
          setSaved(false)
        }}
        placeholder="e.g. Even a small amount can make me very ill. Please use clean utensils and surfaces."
      />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">In Spanish (optional)</span>
        <Textarea
          rows={3}
          maxLength={500}
          value={valueEs}
          lang="es"
          onChange={(e) => {
            setValueEs(e.target.value)
            setSaved(false)
          }}
          placeholder="e.g. Incluso una pequeña cantidad me puede enfermar gravemente. Por favor, use utensilios y superficies limpios."
        />
        <span className="block text-sm text-muted">
          Shown when the card is switched to Spanish. If left blank, the English message is shown.
        </span>
      </label>
      <ErrorText error={error} />
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={update.isPending || unchanged}
          onClick={() =>
            update.mutate(
              { chef_card_message: value.trim() || null, chef_card_message_es: valueEs.trim() || null },
              { onSuccess: () => setSaved(true), onError: (e) => setError(errorMessage(e)) },
            )
          }
        >
          Save message
        </Button>
        {saved && <span className="text-sm text-muted">Saved</span>}
      </div>
    </Card>
  )
}
