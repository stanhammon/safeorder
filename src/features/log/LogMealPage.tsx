import { OutcomePicker, PersonChips, StarRating } from '@/components/bits'
import { Button, Card, ErrorText, Field, Input, PageHeader, SectionTitle, Spinner, Textarea } from '@/components/ui'
import { cleanMods, useBundle, useClearReactionFlag, useCreateDish, useLogMeal, type BundleIndex } from '@/lib/bundle'
import { formatMoney, parseMoney, todayISO } from '@/lib/format'
import { distanceMeters, formatDistance, usePosition, type Coords } from '@/lib/geo'
import { sameMods, summarizeMods } from '@/lib/mods'
import { usePersonFilter } from '@/lib/personFilterContext'
import { useHousehold, useHouseholdContext, useMembers } from '@/lib/queries'
import { useSearch } from '@/lib/search'
import { errorMessage } from '@/lib/supabase'
import type { Dish, MealOutcome, ModDraft, Profile, Restaurant } from '@/lib/types'
import { useRef, useState, type ReactNode } from 'react'
import { DraftNotice } from '@/components/DraftNotice'
import { useDraft } from '@/lib/draft'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ModEditor } from '../orders/ModEditor'
import { useModContext } from '../orders/useModContext'

const NEAR_METERS = 300

/** /log?restaurant=&dish=&person= — any of them preselects that step. */
export function LogMealPage() {
  const [params, setParams] = useSearchParams()
  const { index, isPending, error } = useBundle()
  const { householdId, profile } = useHouseholdContext()
  const members = useMembers(householdId).data ?? []
  const { selected } = usePersonFilter()
  const { coords } = usePosition()

  if (isPending) return <Spinner />
  if (error || !index) return <ErrorText error={errorMessage(error)} />

  const dish = index.dishById.get(params.get('dish') ?? '')
  const restaurant = index.restaurantById.get(dish?.restaurant_id ?? params.get('restaurant') ?? '')
  const personParam = params.get('person')
  const personId =
    personParam && members.some((m) => m.id === personParam)
      ? personParam
      : selected !== 'everyone' && members.some((m) => m.id === selected)
        ? selected
        : profile.id
  const person = members.find((m) => m.id === personId) ?? profile

  function setParam(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Log a meal" />

      {!restaurant ? (
        <RestaurantPicker index={index} coords={coords} onPick={(id) => setParam({ restaurant: id, dish: null })} />
      ) : (
        <Chosen label="Restaurant" value={restaurant.name} onChange={() => setParam({ restaurant: null, dish: null })} />
      )}

      {restaurant && !dish && (
        <DishPicker
          restaurant={restaurant}
          index={index}
          personId={personId}
          onPick={(id) => setParam({ restaurant: restaurant.id, dish: id })}
        />
      )}
      {restaurant && dish && <Chosen label="Dish" value={dish.name} onChange={() => setParam({ dish: null })} />}

      {dish && restaurant && (
        <>
          {members.length > 1 && (
            <section>
              <SectionTitle>Who ate it?</SectionTitle>
              <PersonChips members={members} selected={personId} onSelect={(p) => setParam({ person: p })} meId={profile.id} />
            </section>
          )}
          {/* Keyed so the form resets to the right saved order when dish or person changes. */}
          <MealForm
            key={`${dish.id}:${person.id}`}
            dish={dish}
            restaurant={restaurant}
            person={person}
            isMe={person.id === profile.id}
            index={index}
            coords={coords}
          />
        </>
      )}
    </div>
  )
}

function Chosen({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted">{label}</div>
        <div className="truncate font-semibold">{value}</div>
      </div>
      <button type="button" className="min-h-10 shrink-0 text-sm text-accent" onClick={onChange}>
        Change
      </button>
    </div>
  )
}

function PickList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{children}</ul>
}

function PickItem({ onClick, title, detail }: { onClick: () => void; title: string; detail?: string }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="block min-h-14 w-full px-4 py-3 text-left hover:bg-surface-2">
        <span className="block font-medium">{title}</span>
        {detail && <span className="block text-sm text-muted">{detail}</span>}
      </button>
    </li>
  )
}

function RestaurantPicker({
  index,
  coords,
  onPick,
}: {
  index: BundleIndex
  coords: Coords | null
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const search = useSearch(index)
  const active = index.restaurants.filter((r) => !r.archived_at)

  let list: { r: Restaurant; detail?: string }[]
  if (query.trim()) {
    const ids = new Set<string>()
    for (const hit of search(query)) {
      ids.add(hit.kind === 'restaurant' ? hit.id : (index.dishById.get(hit.id)?.restaurant_id ?? ''))
    }
    list = [...ids].map((id) => index.restaurantById.get(id)).filter((r): r is Restaurant => Boolean(r)).map((r) => ({ r }))
  } else {
    list = active
      .map((r) => {
        const d = nearestDistance(index, r.id, coords)
        return { r, d, last: index.lastMealByRestaurant.get(r.id) ?? '' }
      })
      // Nearest first when we know where you are, then most recently visited.
      .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity) || b.last.localeCompare(a.last))
      .slice(0, 12)
      .map(({ r, d }) => ({ r, detail: d != null ? formatDistance(d) : undefined }))
  }

  return (
    <section className="space-y-3">
      <SectionTitle>Where did you eat?</SectionTitle>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search restaurants"
        aria-label="Search restaurants"
      />
      {list.length > 0 && (
        <PickList>
          {list.map(({ r, detail }) => (
            <PickItem
              key={r.id}
              onClick={() => onPick(r.id)}
              title={r.name}
              detail={[r.cuisine, detail].filter(Boolean).join(' · ') || undefined}
            />
          ))}
        </PickList>
      )}
      {query.trim() && list.length === 0 && <p className="text-sm text-muted">No restaurants match “{query}”.</p>}
      <Link to="/restaurants/new" className="inline-flex min-h-10 items-center text-sm font-medium text-accent">
        + Add a new restaurant
      </Link>
    </section>
  )
}

function nearestDistance(index: BundleIndex, restaurantId: string, coords: Coords | null): number | null {
  if (!coords) return null
  let best: number | null = null
  for (const l of index.locationsByRestaurant.get(restaurantId) ?? []) {
    if (l.archived_at || l.lat == null || l.lng == null) continue
    const d = distanceMeters(coords, { lat: l.lat, lng: l.lng })
    if (best == null || d < best) best = d
  }
  return best
}

function DishPicker({
  restaurant,
  index,
  personId,
  onPick,
}: {
  restaurant: Restaurant
  index: BundleIndex
  personId: string
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const create = useCreateDish()
  const q = query.trim().toLowerCase()
  const dishes = (index.dishesByRestaurant.get(restaurant.id) ?? [])
    .filter((d) => !d.archived_at && (!q || d.name.toLowerCase().includes(q)))
    .sort((a, b) => {
      const ao = index.orderByDishPerson.has(`${a.id}:${personId}`) ? 0 : 1
      const bo = index.orderByDishPerson.has(`${b.id}:${personId}`) ? 0 : 1
      return ao - bo || a.name.localeCompare(b.name)
    })
  const exact = dishes.some((d) => d.name.toLowerCase() === q)

  async function addDish() {
    setError(null)
    try {
      const id = await create.mutateAsync({ restaurantId: restaurant.id, dish: { name: query, allergenIds: [] } })
      onPick(id)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <section className="space-y-3">
      <SectionTitle>What did you have?</SectionTitle>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search or type a new dish"
        aria-label="Dish"
      />
      {dishes.length > 0 && (
        <PickList>
          {dishes.map((d) => {
            const order = index.orderByDishPerson.get(`${d.id}:${personId}`)
            return (
              <PickItem
                key={d.id}
                onClick={() => onPick(d.id)}
                title={d.name}
                detail={order ? summarizeMods(index.modsByOrder.get(order.id) ?? []) : undefined}
              />
            )
          })}
        </PickList>
      )}
      {q && !exact && (
        <Button requiresOnline type="button" variant="secondary" className="w-full" onClick={addDish} disabled={create.isPending}>
          + Add “{query.trim()}” as a new dish
        </Button>
      )}
      {!q && dishes.length === 0 && <p className="text-sm text-muted">No dishes saved here yet. Type one above.</p>}
      <ErrorText error={error} />
    </section>
  )
}

function MealForm({
  dish,
  restaurant,
  person,
  isMe,
  index,
  coords,
}: {
  dish: Dish
  restaurant: Restaurant
  person: Profile
  isMe: boolean
  index: BundleIndex
  coords: Coords | null
}) {
  const navigate = useNavigate()
  const { householdId } = useHouseholdContext()
  const household = useHousehold(householdId).data
  const logMeal = useLogMeal()
  const clearFlag = useClearReactionFlag()
  const ctx = useModContext(index, person.id)

  const order = index.orderByDishPerson.get(`${dish.id}:${person.id}`)
  const savedMods: ModDraft[] = order ? (index.modsByOrder.get(order.id) ?? []).map((m) => ({ ...m })) : []
  const locations = (index.locationsByRestaurant.get(restaurant.id) ?? []).filter((l) => !l.archived_at)

  // Kept as a draft so a dropped connection or reload doesn't lose the form (SPEC §6.4).
  const draft = useDraft(`log:${dish.id}:${person.id}`, () => ({
    mods: savedMods,
    rating: null as number | null,
    outcome: null as MealOutcome | null,
    outcomeNotes: '',
    price: '',
    notes: '',
    date: todayISO(),
    locationId: defaultLocation(index, restaurant.id, coords),
  }))
  const { mods, rating, outcome, outcomeNotes, price, notes, date, locationId } = draft.value
  const patch = (p: Partial<typeof draft.value>) => draft.setValue((v) => ({ ...v, ...p }))
  const setMods = (v: ModDraft[]) => patch({ mods: v })
  const setRating = (v: number | null) => patch({ rating: v })
  const setOutcome = (v: MealOutcome | null) => patch({ outcome: v })
  const setOutcomeNotes = (v: string) => patch({ outcomeNotes: v })
  const setPrice = (v: string) => patch({ price: v })
  const setNotes = (v: string) => patch({ notes: v })
  const setDate = (v: string) => patch({ date: v })
  const setLocationId = (v: string | null) => patch({ locationId: v })
  const [confirming, setConfirming] = useState(false)
  const [offerClear, setOfferClear] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const changed = Boolean(order) && !sameMods(cleanMods(mods), cleanMods(savedMods))
  const priceCents = parseMoney(price)

  function validate(): string | null {
    if (mods.some((m) => m.action === 'substitute' && m.item.trim() && !m.replacement?.trim())) {
      return 'Each substitution needs something to replace it with.'
    }
    if (Number.isNaN(priceCents)) return 'Price doesn’t look like a number.'
    if (date > todayISO()) return 'The date can’t be in the future.'
    return null
  }

  // A ref, not state: two taps in the same frame would both see stale state.
  const submitting = useRef(false)

  function onSave() {
    if (submitting.current) return
    const problem = validate()
    if (problem) return setError(problem)
    setError(null)
    if (changed) setConfirming(true)
    else submit(false)
  }

  async function submit(updateSafeOrder: boolean) {
    if (submitting.current) return
    submitting.current = true
    setConfirming(false)
    try {
      await logMeal.mutateAsync({
        meal: {
          dish_id: dish.id,
          profile_id: person.id,
          location_id: locationId,
          eaten_on: date,
          taste_rating: rating,
          outcome,
          outcome_notes: outcome && outcome !== 'fine' ? outcomeNotes.trim() || null : null,
          price_cents: priceCents,
          notes: notes.trim() || null,
          mods_snapshot: cleanMods(mods).map((m) => ({
            ...m,
            allergen_name: m.allergen_id ? (ctx.allergenName.get(m.allergen_id) ?? m.allergen_name ?? null) : null,
          })),
        },
        updateSafeOrder,
      })
      draft.clear()
      // SPEC §5.4: a fine meal doesn't clear a reaction flag by itself; ask.
      if (order?.reaction_flag && outcome === 'fine') setOfferClear(true)
      else navigate(`/dishes/${dish.id}`, { replace: true })
    } catch (e) {
      submitting.current = false
      setError(errorMessage(e))
    }
  }

  return (
    <>
      {draft.restored && <DraftNotice onDiscard={draft.discard} />}
      <section className="space-y-3">
        <div>
          <SectionTitle>{isMe ? 'Changes you asked for' : `Changes for ${person.display_name}`}</SectionTitle>
          <p className="-mt-2 text-sm text-muted">
            {order ? 'Filled in from the saved order. Adjust if this time was different.' : 'This becomes the saved order for next time.'}
          </p>
        </div>
        <ModEditor
          mods={mods}
          onChange={setMods}
          allergens={ctx.allergens}
          personAllergenIds={ctx.personAllergenIds}
          itemSuggestions={ctx.itemSuggestions}
          quickAdd={ctx.quickAdd}
        />
      </section>

      <Card className="space-y-5">
        <div className="space-y-2">
          <span className="text-sm font-medium">How did it go?</span>
          <OutcomePicker value={outcome} onChange={setOutcome} />
          {outcome && outcome !== 'fine' && (
            <Textarea
              rows={2}
              value={outcomeNotes}
              placeholder="What happened? e.g. symptoms, what you think caused it"
              onChange={(e) => setOutcomeNotes(e.target.value)}
            />
          )}
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium">Taste</span>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Price (${household?.default_currency ?? 'USD'})`}>
            <Input inputMode="decimal" value={price} placeholder="0.00" onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {restaurant.is_chain && locations.length > 0 && (
          <Field label="Location">
            <select
              className="min-h-12 w-full rounded-xl border border-border bg-surface px-3"
              value={locationId ?? ''}
              onChange={(e) => setLocationId(e.target.value || null)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label || l.address || 'Unnamed location'}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Notes (optional)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      <ErrorText error={error} />
      {priceCents != null && !Number.isNaN(priceCents) && price && (
        <p className="text-sm text-muted">Price: {formatMoney(priceCents, household?.default_currency ?? 'USD')}</p>
      )}
      <Button requiresOnline className="w-full" onClick={onSave} disabled={logMeal.isPending}>
        {logMeal.isPending ? 'Saving…' : 'Save meal'}
      </Button>

      {offerClear && order && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="clear-flag-title">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-5 shadow-xl">
            <h2 id="clear-flag-title" className="text-lg font-semibold">
              Last time there was a reaction. Clear the flag?
            </h2>
            <p className="text-muted">
              {dish.name} is flagged for a {order.reaction_flag === 'bad' ? 'bad' : 'mild'} reaction. Clear it now that
              this meal went fine?
            </p>
            <div className="flex flex-col gap-2">
              <Button requiresOnline
                disabled={clearFlag.isPending}
                onClick={() =>
                  clearFlag.mutate(
                    { orderId: order.id, note: `Ate it again on ${date} without problems.` },
                    { onSettled: () => navigate(`/dishes/${dish.id}`, { replace: true }) },
                  )
                }
              >
                Clear reaction flag
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/dishes/${dish.id}`, { replace: true })}>
                Keep the flag
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="update-order-title">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-5 shadow-xl">
            <h2 id="update-order-title" className="text-lg font-semibold">
              Update {isMe ? 'your' : `${person.display_name}’s`} saved order too?
            </h2>
            <p className="text-muted">
              This time’s changes differ from the saved order for {dish.name}. Use them from now on?
            </p>
            <div className="flex flex-col gap-2">
              <Button requiresOnline onClick={() => submit(true)}>Update saved order</Button>
              <Button requiresOnline variant="secondary" onClick={() => submit(false)}>
                Just this meal
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Nearest location within 300 m, else the one used last time, else the first. */
function defaultLocation(index: BundleIndex, restaurantId: string, coords: Coords | null): string | null {
  const locations = (index.locationsByRestaurant.get(restaurantId) ?? []).filter((l) => !l.archived_at)
  if (locations.length === 0) return null
  if (coords) {
    const near = locations
      .filter((l) => l.lat != null && l.lng != null)
      .map((l) => ({ l, d: distanceMeters(coords, { lat: l.lat!, lng: l.lng! }) }))
      .filter((x) => x.d <= NEAR_METERS)
      .sort((a, b) => a.d - b.d)[0]
    if (near) return near.l.id
  }
  const dishIds = new Set((index.dishesByRestaurant.get(restaurantId) ?? []).map((d) => d.id))
  const last = index.meals.find((m) => dishIds.has(m.dish_id) && m.location_id)
  if (last && locations.some((l) => l.id === last.location_id)) return last.location_id
  return locations[0].id
}
