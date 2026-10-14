import { OutcomePicker } from '@/components/bits'
import { Button, Card, ErrorText, Textarea } from '@/components/ui'
import { useSetMealOutcome, type BundleIndex } from '@/lib/bundle'
import { useHouseholdContext, useMembers } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Meal, MealOutcome } from '@/lib/types'
import { useState } from 'react'

const WINDOW_MS = 48 * 3_600_000

/** SPEC §5.4: "How did it go?" for your meals logged in the last 48 hours without an outcome. */
export function OutcomeReminders({ index }: { index: BundleIndex }) {
  const { profile, householdId } = useHouseholdContext()
  const members = useMembers(householdId).data ?? []
  const [openId, setOpenId] = useState<string | null>(null)
  // Fixed when Home opens; the reminders don't need to tick over live.
  const [cutoff] = useState(() => Date.now() - WINDOW_MS)
  const pending = index.meals.filter(
    (m) =>
      m.outcome == null &&
      Date.parse(m.created_at) > cutoff &&
      (m.profile_id === profile.id || m.created_by === profile.id),
  )
  if (pending.length === 0) return null

  return (
    <section className="mb-6 space-y-2">
      <h2 className="text-base font-semibold">How did it go?</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {pending.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setOpenId(openId === m.id ? null : m.id)}
            aria-expanded={openId === m.id}
            className={`min-h-10 shrink-0 rounded-full border px-3 text-sm ${
              openId === m.id ? 'border-accent bg-surface-2' : 'border-border bg-surface'
            }`}
          >
            <span className="font-medium">{index.dishById.get(m.dish_id)?.name ?? 'Meal'}</span>
            <span className="text-muted"> · {whenLogged(m.created_at)}</span>
            {m.profile_id !== profile.id && (
              <span className="text-muted"> · {members.find((p) => p.id === m.profile_id)?.display_name ?? 'someone'}</span>
            )}
          </button>
        ))}
      </div>
      {openId && (
        <OutcomeForm key={openId} meal={pending.find((m) => m.id === openId)!} index={index} onDone={() => setOpenId(null)} />
      )}
    </section>
  )
}

function OutcomeForm({ meal, index, onDone }: { meal: Meal; index: BundleIndex; onDone: () => void }) {
  const save = useSetMealOutcome()
  const [outcome, setOutcome] = useState<MealOutcome | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const dish = index.dishById.get(meal.dish_id)
  const restaurant = dish ? index.restaurantById.get(dish.restaurant_id) : undefined

  return (
    <Card className="space-y-3">
      <p className="text-sm text-muted">
        {dish?.name} at {restaurant?.name}
      </p>
      <OutcomePicker value={outcome} onChange={setOutcome} />
      {outcome && outcome !== 'fine' && (
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What happened?" />
      )}
      <ErrorText error={error} />
      <Button requiresOnline
        className="w-full"
        disabled={!outcome || save.isPending}
        onClick={() =>
          save.mutate(
            { mealId: meal.id, outcome, notes: outcome === 'fine' ? '' : notes },
            { onSuccess: onDone, onError: (e) => setError(errorMessage(e)) },
          )
        }
      >
        Save
      </Button>
    </Card>
  )
}

/** "today 1:15 PM" / "yesterday 7:40 PM", so repeated dishes are distinguishable. */
function whenLogged(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return `today ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `yesterday ${time}`
  return d.toLocaleDateString(undefined, { weekday: 'short' }) + ` ${time}`
}
