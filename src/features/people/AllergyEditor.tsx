import { Button, ErrorText, Input, Spinner } from '@/components/ui'
import {
  useAllergens,
  useCreateAllergen,
  useHiddenAllergenIds,
  usePersonAllergens,
  useSetPersonAllergen,
} from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { AllergenKind, PersonAllergen } from '@/lib/types'
import { useState, type FormEvent } from 'react'

const OPTIONS: { value: AllergenKind | null; label: string }[] = [
  { value: null, label: 'No' },
  { value: 'allergy', label: 'Allergy' },
  { value: 'preference', label: 'Preference' },
]

export function AllergyEditor({ householdId, profileId }: { householdId: string; profileId: string }) {
  const allergens = useAllergens(householdId)
  const hidden = useHiddenAllergenIds(householdId)
  const personAllergens = usePersonAllergens(householdId)
  const setAllergen = useSetPersonAllergen(householdId)
  const createAllergen = useCreateAllergen(householdId)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (allergens.isPending || hidden.isPending || personAllergens.isPending) return <Spinner />
  if (allergens.error || personAllergens.error) {
    return <ErrorText error={errorMessage(allergens.error ?? personAllergens.error)} />
  }

  const mine = new Map<string, PersonAllergen>(
    personAllergens.data.filter((pa) => pa.profile_id === profileId).map((pa) => [pa.allergen_id, pa]),
  )
  // Hidden presets stay visible for anyone who already has them set.
  const visible = allergens.data.filter((a) => !hidden.data?.has(a.id) || mine.has(a.id))

  function set(allergenId: string, kind: AllergenKind | null, notes?: string | null) {
    setError(null)
    setAllergen.mutate(
      { profileId, allergenId, kind, notes },
      { onError: (e) => setError(errorMessage(e)) },
    )
  }

  function addCustom(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const existing = allergens.data?.find((a) => a.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!mine.has(existing.id)) set(existing.id, 'allergy')
      setNewName('')
      return
    }
    setError(null)
    createAllergen.mutate(name, {
      onSuccess: (allergen) => {
        set(allergen.id, 'allergy')
        setNewName('')
      },
      onError: (err) => setError(errorMessage(err)),
    })
  }

  return (
    <div className="space-y-4">
      <ErrorText error={error} />
      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {visible.map((a) => {
          const current = mine.get(a.id)
          return (
            <li key={a.id} className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {a.name}
                  {!a.is_preset && <span className="ml-2 text-xs font-normal text-muted">custom</span>}
                </span>
                <div
                  className="flex shrink-0 rounded-lg border border-border bg-surface-2 p-0.5"
                  role="radiogroup"
                  aria-label={`${a.name}`}
                >
                  {OPTIONS.map((o) => {
                    const selected = (current?.kind ?? null) === o.value
                    return (
                      <button
                        key={o.label}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => !selected && set(a.id, o.value)}
                        className={`min-h-9 rounded-md px-2.5 text-sm ${
                          selected
                            ? o.value === 'allergy'
                              ? 'bg-danger text-white'
                              : o.value === 'preference'
                                ? 'bg-accent text-accent-contrast'
                                : 'bg-surface text-text shadow-sm'
                            : 'text-muted'
                        }`}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {current && (
                <Input
                  key={`${a.id}-${current.notes ?? ''}`}
                  defaultValue={current.notes ?? ''}
                  placeholder="Notes, e.g. cross-contact matters, trace amounts OK"
                  maxLength={300}
                  className="min-h-10 text-sm"
                  onBlur={(e) => {
                    const notes = e.target.value.trim() || null
                    if (notes !== current.notes) set(a.id, current.kind, notes)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>

      <form onSubmit={addCustom} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add another, e.g. Garlic"
          maxLength={40}
          aria-label="Custom allergen name"
        />
        <Button type="submit" variant="secondary" disabled={!newName.trim() || createAllergen.isPending}>
          Add
        </Button>
      </form>
    </div>
  )
}
