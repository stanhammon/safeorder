import { BackLink } from '@/components/bits'
import { Button, Card, ErrorText, Field, Input, PageHeader, Spinner, Textarea } from '@/components/ui'
import { useBundle, useCreateDish, useDeleteDish, useUpdateDish } from '@/lib/bundle'
import { useAllergens, useHiddenAllergenIds, useHouseholdContext } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'

/** /restaurants/:restaurantId/dishes/new and /dishes/:dishId/edit */
export function DishFormPage() {
  const { restaurantId, dishId } = useParams()
  const { index, isPending } = useBundle()
  if (isPending || !index) return <Spinner />

  if (dishId) {
    const dish = index.dishById.get(dishId)
    if (!dish) return <PageHeader title="Dish not found" />
    return (
      <DishForm
        restaurantId={dish.restaurant_id}
        editing={{
          id: dish.id,
          name: dish.name,
          description: dish.description,
          archived: Boolean(dish.archived_at),
          allergenIds: [...(index.allergenIdsByDish.get(dish.id) ?? [])],
        }}
      />
    )
  }
  if (!restaurantId || !index.restaurantById.has(restaurantId)) return <PageHeader title="Restaurant not found" />
  return <DishForm restaurantId={restaurantId} />
}

interface Editing {
  id: string
  name: string
  description: string | null
  archived: boolean
  allergenIds: string[]
}

function DishForm({ restaurantId, editing }: { restaurantId: string; editing?: Editing }) {
  const navigate = useNavigate()
  const { index } = useBundle()
  const create = useCreateDish()
  const update = useUpdateDish()
  const remove = useDeleteDish()
  const restaurant = index?.restaurantById.get(restaurantId)

  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [allergenIds, setAllergenIds] = useState<string[]>(editing?.allergenIds ?? [])
  const [error, setError] = useState<string | null>(null)
  const busy = create.isPending || update.isPending

  // SPEC §9: duplicate active names at one restaurant are blocked; offer the existing dish.
  const duplicate = (index?.dishesByRestaurant.get(restaurantId) ?? []).find(
    (d) => !d.archived_at && d.id !== editing?.id && d.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (duplicate) return
    setError(null)
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { name: name.trim(), description: description.trim() || null },
          allergenIds,
        })
        navigate(`/dishes/${editing.id}`, { replace: true })
      } else {
        const id = await create.mutateAsync({ restaurantId, dish: { name, description, allergenIds } })
        navigate(`/dishes/${id}`, { replace: true })
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function onArchive() {
    if (!editing) return
    try {
      await update.mutateAsync({
        id: editing.id,
        patch: { archived_at: editing.archived ? null : new Date().toISOString() },
      })
      navigate(editing.archived ? `/dishes/${editing.id}` : `/restaurants/${restaurantId}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function onDelete() {
    if (!editing || !index) return
    const meals = index.mealsByDish.get(editing.id)?.length ?? 0
    const orders = index.ordersByDish.get(editing.id)?.length ?? 0
    if (!confirm(`Permanently delete ${editing.name}? This deletes ${orders} saved order(s) and ${meals} meal log(s). This can’t be undone.`)) return
    try {
      await remove.mutateAsync(editing.id)
      navigate(`/restaurants/${restaurantId}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <BackLink to={editing ? `/dishes/${editing.id}` : `/restaurants/${restaurantId}`}>
        {editing ? editing.name : (restaurant?.name ?? 'Back')}
      </BackLink>
      <PageHeader title={editing ? 'Edit dish' : 'Add a dish'} subtitle={restaurant?.name} />

      <Card className="space-y-4">
        <Field label="Dish name">
          <Input value={name} required maxLength={120} autoFocus={!editing} onChange={(e) => setName(e.target.value)} />
        </Field>
        {duplicate && (
          <p className="text-sm text-danger">
            {restaurant?.name} already has “{duplicate.name}”.{' '}
            <button type="button" className="text-accent underline" onClick={() => navigate(`/dishes/${duplicate.id}`)}>
              Open it
            </button>
          </p>
        )}
        <Field label="Description (optional)">
          <Textarea
            rows={2}
            value={description}
            placeholder="e.g. Off-menu, or what comes on it"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="font-semibold">Contains (as normally served)</h2>
          <p className="text-sm text-muted">
            Optional, but it lets the app warn you when an allergy isn’t covered by your changes.
          </p>
        </div>
        <AllergenTagPicker value={allergenIds} onChange={setAllergenIds} />
      </Card>

      <ErrorText error={error} />
      <Button type="submit" className="w-full" disabled={busy || !name.trim() || Boolean(duplicate)}>
        {editing ? 'Save changes' : 'Add dish'}
      </Button>

      {editing && (
        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <Button type="button" variant="secondary" onClick={onArchive} disabled={busy}>
            {editing.archived ? 'Restore dish' : 'Archive (no longer on the menu)'}
          </Button>
          <Button type="button" variant="danger" onClick={onDelete} disabled={remove.isPending}>
            Delete permanently
          </Button>
        </div>
      )}
    </form>
  )
}

function AllergenTagPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { householdId } = useHouseholdContext()
  const allergens = useAllergens(householdId).data ?? []
  const hidden = useHiddenAllergenIds(householdId).data
  const selected = new Set(value)
  const visible = allergens.filter((a) => !hidden?.has(a.id) || selected.has(a.id))

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((a) => {
        const on = selected.has(a.id)
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((id) => id !== a.id) : [...value, a.id])}
            className={`min-h-10 rounded-full border px-3 text-sm ${
              on ? 'border-danger bg-danger-surface font-medium text-danger' : 'border-border bg-surface'
            }`}
          >
            {on ? '✓ ' : ''}
            {a.name}
          </button>
        )
      })}
    </div>
  )
}
