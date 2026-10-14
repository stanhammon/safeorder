import { BackLink } from '@/components/bits'
import { Button, Card, ErrorText, Field, Input, PageHeader, Spinner, Textarea } from '@/components/ui'
import {
  useBundle,
  useCreateRestaurant,
  useDeleteRestaurant,
  useUpdateLocation,
  useUpdateRestaurant,
  type LocationInput,
  type RestaurantInput,
} from '@/lib/bundle'
import { errorMessage } from '@/lib/supabase'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LocationFields } from './LocationFields'

/** Add a restaurant (/restaurants/new) or edit one (/restaurants/:id/edit). */
export function RestaurantFormPage() {
  const { restaurantId } = useParams()
  const { index, isPending } = useBundle()
  if (isPending || !index) return <Spinner />

  if (!restaurantId) return <RestaurantForm />
  const restaurant = index.restaurantById.get(restaurantId)
  if (!restaurant) return <PageHeader title="Restaurant not found" />
  const locations = index.locationsByRestaurant.get(restaurant.id) ?? []
  return (
    <RestaurantForm
      editing={{
        id: restaurant.id,
        restaurant,
        // A non-chain's single location is edited inline.
        location: restaurant.is_chain ? undefined : locations[0],
        activeLocationCount: locations.filter((l) => !l.archived_at).length,
      }}
    />
  )
}

interface Editing {
  id: string
  restaurant: RestaurantInput & { archived_at: string | null }
  location?: LocationInput & { id: string }
  activeLocationCount: number
}

function RestaurantForm({ editing }: { editing?: Editing }) {
  const navigate = useNavigate()
  const { index } = useBundle()
  const create = useCreateRestaurant()
  const update = useUpdateRestaurant()
  const updateLocation = useUpdateLocation()
  const remove = useDeleteRestaurant()
  const cuisineListId = useId()

  const [form, setForm] = useState<RestaurantInput>({
    name: editing?.restaurant.name ?? '',
    cuisine: editing?.restaurant.cuisine ?? '',
    is_chain: editing?.restaurant.is_chain ?? false,
    notes: editing?.restaurant.notes ?? '',
  })
  const [location, setLocation] = useState<LocationInput>(editing?.location ?? {})
  const [error, setError] = useState<string | null>(null)
  const busy = create.isPending || update.isPending || updateLocation.isPending

  const cuisines = [...new Set((index?.restaurants ?? []).map((r) => r.cuisine?.trim()).filter(Boolean))] as string[]
  const similar = !editing && form.name.trim().length >= 3
    ? (index?.restaurants ?? []).filter((r) => r.name.toLowerCase().includes(form.name.trim().toLowerCase()))
    : []
  // SPEC §5.5: a chain can only become a non-chain with at most one location left.
  const cannotUnchain = Boolean(editing?.restaurant.is_chain && editing.activeLocationCount > 1)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const restaurant = {
      name: form.name.trim(),
      cuisine: form.cuisine?.trim() || null,
      is_chain: form.is_chain,
      notes: form.notes?.trim() || null,
    }
    try {
      if (!editing) {
        const id = await create.mutateAsync({ restaurant, location })
        navigate(`/restaurants/${id}`, { replace: true })
        return
      }
      await update.mutateAsync({ id: editing.id, patch: restaurant })
      if (editing.location) {
        const { id, ...rest } = { ...editing.location, ...location }
        await updateLocation.mutateAsync({
          id,
          patch: {
            label: rest.label?.trim() || null,
            address: rest.address?.trim() || null,
            lat: rest.lat ?? null,
            lng: rest.lng ?? null,
            map_url: rest.map_url?.trim() || null,
            notes: rest.notes?.trim() || null,
          },
        })
      }
      navigate(`/restaurants/${editing.id}`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function onArchive() {
    if (!editing) return
    const archived = Boolean(editing.restaurant.archived_at)
    try {
      await update.mutateAsync({ id: editing.id, patch: { archived_at: archived ? null : new Date().toISOString() } })
      navigate(archived ? `/restaurants/${editing.id}` : '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function onDelete() {
    if (!editing || !index) return
    const dishes = index.dishesByRestaurant.get(editing.id) ?? []
    const meals = dishes.reduce((n, d) => n + (index.mealsByDish.get(d.id)?.length ?? 0), 0)
    if (!confirm(`Permanently delete ${form.name}? This deletes ${dishes.length} dish(es) and ${meals} meal log(s). This can’t be undone.`)) return
    try {
      await remove.mutateAsync(editing.id)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <BackLink to={editing ? `/restaurants/${editing.id}` : '/'}>{editing ? form.name || 'Back' : 'Home'}</BackLink>
      <PageHeader title={editing ? 'Edit restaurant' : 'Add a restaurant'} />

      <Card className="space-y-4">
        <Field label="Name">
          <Input
            value={form.name}
            required
            maxLength={120}
            autoFocus={!editing}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        {similar.length > 0 && (
          <p className="text-sm text-muted">
            Already saved:{' '}
            {similar.slice(0, 3).map((r, i) => (
              <span key={r.id}>
                {i > 0 && ', '}
                <Link to={`/restaurants/${r.id}`} className="text-accent">
                  {r.name}
                </Link>
              </span>
            ))}
          </p>
        )}
        <Field label="Cuisine (optional)">
          <Input
            list={cuisineListId}
            value={form.cuisine ?? ''}
            maxLength={60}
            placeholder="e.g. Mexican"
            onChange={(e) => setForm({ ...form, cuisine: e.target.value })}
          />
          <datalist id={cuisineListId}>
            {cuisines.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[var(--accent)]"
            checked={form.is_chain}
            disabled={cannotUnchain}
            onChange={(e) => setForm({ ...form, is_chain: e.target.checked })}
          />
          <span>
            This is a chain (multiple locations)
            <span className="block text-sm text-muted">
              {cannotUnchain
                ? 'Archive all but one location before changing this.'
                : 'Your saved orders will apply at every location.'}
            </span>
          </span>
        </label>
        <Field label="Notes (optional)">
          <Textarea
            rows={2}
            value={form.notes ?? ''}
            placeholder="e.g. Staff are very allergy-aware"
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
      </Card>

      {(!editing || editing.location) && (
        <Card>
          <h2 className="mb-3 font-semibold">{form.is_chain ? 'First location' : 'Location'}</h2>
          <LocationFields value={location} onChange={setLocation} showLabel={form.is_chain} />
        </Card>
      )}

      <ErrorText error={error} />
      <Button type="submit" className="w-full" disabled={busy || !form.name.trim()}>
        {editing ? 'Save changes' : 'Add restaurant'}
      </Button>

      {editing && (
        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <Button type="button" variant="secondary" onClick={onArchive} disabled={busy}>
            {editing.restaurant.archived_at ? 'Restore restaurant' : 'Archive (closed or no longer go)'}
          </Button>
          <Button type="button" variant="danger" onClick={onDelete} disabled={remove.isPending}>
            Delete permanently
          </Button>
        </div>
      )}
    </form>
  )
}
