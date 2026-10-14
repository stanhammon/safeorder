import { BackLink } from '@/components/bits'
import { Button, Card, ErrorText, PageHeader, Spinner, Textarea } from '@/components/ui'
import { useBundle, useSaveSafeOrder, type BundleIndex } from '@/lib/bundle'
import { useHouseholdContext, useMembers } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Dish, ModDraft, Profile } from '@/lib/types'
import { DraftNotice } from '@/components/DraftNotice'
import { useDraft } from '@/lib/draft'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ModEditor } from '../orders/ModEditor'
import { useModContext } from '../orders/useModContext'

/** /dishes/:dishId/order/:personId */
export function SafeOrderEditPage() {
  const { dishId, personId } = useParams()
  const { index, isPending } = useBundle()
  const { householdId } = useHouseholdContext()
  const members = useMembers(householdId)

  if (isPending || members.isPending || !index) return <Spinner />
  const dish = dishId ? index.dishById.get(dishId) : undefined
  const person = members.data?.find((m) => m.id === personId)
  if (!dish || !person) return <PageHeader title="Not found" />
  return <Editor dish={dish} person={person} index={index} />
}

function Editor({ dish, person, index }: { dish: Dish; person: Profile; index: BundleIndex }) {
  const navigate = useNavigate()
  const { profile } = useHouseholdContext()
  const save = useSaveSafeOrder()
  const ctx = useModContext(index, person.id)
  const existing = index.orderByDishPerson.get(`${dish.id}:${person.id}`)
  const draft = useDraft(`order:${dish.id}:${person.id}`, () => ({
    mods: (existing ? (index.modsByOrder.get(existing.id) ?? []) : []).map((m): ModDraft => ({ ...m })),
    note: existing?.note ?? '',
  }))
  const { mods, note } = draft.value
  const setMods = (v: ModDraft[]) => draft.setValue((d) => ({ ...d, mods: v }))
  const setNote = (v: string) => draft.setValue((d) => ({ ...d, note: v }))
  const [error, setError] = useState<string | null>(null)
  const restaurant = index.restaurantById.get(dish.restaurant_id)

  async function onSave() {
    setError(null)
    if (mods.some((m) => m.action === 'substitute' && m.item.trim() && !m.replacement?.trim())) {
      return setError('Each substitution needs something to replace it with.')
    }
    try {
      await save.mutateAsync({ dishId: dish.id, profileId: person.id, note, mods })
      draft.clear()
      navigate(`/dishes/${dish.id}`, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="space-y-5">
      <BackLink to={`/dishes/${dish.id}`}>{dish.name}</BackLink>
      <PageHeader
        title={person.id === profile.id ? 'Your order' : `${person.display_name}’s order`}
        subtitle={`${dish.name} at ${restaurant?.name ?? ''}`}
      />
      {draft.restored && <DraftNotice onDiscard={draft.discard} />}
      <ModEditor
        mods={mods}
        onChange={setMods}
        allergens={ctx.allergens}
        personAllergenIds={ctx.personAllergenIds}
        itemSuggestions={ctx.itemSuggestions}
        quickAdd={ctx.quickAdd}
      />
      <Card>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Note (optional)</span>
          <Textarea
            rows={2}
            value={note}
            placeholder="e.g. Ask for Maria, she knows the kitchen"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </Card>
      <ErrorText error={error} />
      <Button requiresOnline className="w-full" onClick={onSave} disabled={save.isPending}>
        Save order
      </Button>
    </div>
  )
}
