import { BackLink, EmptyState, OutcomeBadge, StarRating } from '@/components/bits'
import { Avatar, Button, Disclaimer, ErrorText, PageHeader, SectionTitle, Spinner, Textarea } from '@/components/ui'
import { useBundle, useClearReactionFlag, useConfirmWithStaff, useDeleteMeal, type BundleIndex } from '@/lib/bundle'
import { formatDate, formatMoney } from '@/lib/format'
import { usePersonFilter } from '@/lib/personFilterContext'
import { useAllergens, useHouseholdContext, useMembers } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Coverage } from '@/lib/safety'
import type { Dish, Meal, Profile, SafeOrder } from '@/lib/types'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ModList } from '../orders/ModList'
import { useSafety } from '../orders/useSafety'

export function DishPage() {
  const { dishId } = useParams()
  const { index, isPending, error } = useBundle()
  const { householdId, profile } = useHouseholdContext()
  const members = useMembers(householdId).data ?? []
  const allergens = useAllergens(householdId).data ?? []
  const { selected, setSelected } = usePersonFilter()

  if (isPending) return <Spinner />
  if (error || !index) return <ErrorText error={errorMessage(error)} />
  const dish = dishId ? index.dishById.get(dishId) : undefined
  if (!dish) {
    return (
      <>
        <BackLink to="/">Home</BackLink>
        <PageHeader title="Dish not found" />
      </>
    )
  }
  const restaurant = index.restaurantById.get(dish.restaurant_id)!
  const allergenName = new Map(allergens.map((a) => [a.id, a.name]))
  const contains = [...(index.allergenIdsByDish.get(dish.id) ?? [])].map((id) => allergenName.get(id)).filter(Boolean)
  const meals = index.mealsByDish.get(dish.id) ?? []
  const lastPriced = meals.find((m) => m.price_cents != null)

  // Tabs: everyone with an order here, plus the selected person and me.
  const withOrders = new Set((index.ordersByDish.get(dish.id) ?? []).map((o) => o.profile_id))
  const tabPeople = members.filter((m) => withOrders.has(m.id) || m.id === profile.id)
  const activeId = selected !== 'everyone' && members.some((m) => m.id === selected) ? selected : profile.id
  const active = members.find((m) => m.id === activeId)
  const locationNotes = restaurant.is_chain
    ? (index.locationsByRestaurant.get(restaurant.id) ?? []).filter((l) => l.notes && !l.archived_at)
    : []

  return (
    <>
      <BackLink to={`/restaurants/${restaurant.id}`}>{restaurant.name}</BackLink>
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{dish.name}</h1>
          <Link to={`/dishes/${dish.id}/edit`} className="min-h-10 shrink-0 pt-1 text-sm text-accent">
            Edit
          </Link>
        </div>
        {dish.archived_at && (
          <p className="mt-2 rounded-xl bg-warn-surface px-3 py-2 text-sm text-warn">
            Archived: may no longer be on the menu.
          </p>
        )}
        {dish.description && <p className="mt-2 text-muted">{dish.description}</p>}
        <p className="mt-2 text-sm">
          {contains.length ? (
            <>
              <span className="font-medium">Contains:</span> {contains.join(', ')}
            </>
          ) : (
            <span className="text-muted">Allergens not recorded</span>
          )}
          {lastPriced && (
            <span className="text-muted"> · Last paid {formatMoney(lastPriced.price_cents!, lastPriced.currency)}</span>
          )}
        </p>
      </div>

      {locationNotes.length > 0 && (
        <details className="mb-4 rounded-xl border border-border bg-surface px-4 py-2">
          <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium">Location notes</summary>
          <ul className="space-y-1 pb-2 text-sm">
            {locationNotes.map((l) => (
              <li key={l.id}>
                <strong>{l.label || l.address || 'Location'}:</strong> {l.notes}
              </li>
            ))}
          </ul>
        </details>
      )}

      {tabPeople.length > 1 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4" role="tablist">
          {tabPeople.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={m.id === activeId}
              onClick={() => setSelected(m.id)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${
                m.id === activeId ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-surface'
              }`}
            >
              <Avatar name={m.display_name} color={m.color} size="sm" />
              {m.id === profile.id ? 'Me' : m.display_name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <PersonOrder dish={dish} person={active} isMe={active.id === profile.id} index={index} allergenName={allergenName} />
      )}

      <div className="mt-8">
        <Disclaimer compact />
      </div>
    </>
  )
}

function PersonOrder({
  dish,
  person,
  isMe,
  index,
  allergenName,
}: {
  dish: Dish
  person: Profile
  isMe: boolean
  index: BundleIndex
  allergenName: Map<string, string>
}) {
  const order = index.orderByDishPerson.get(`${dish.id}:${person.id}`)
  const mods = order ? (index.modsByOrder.get(order.id) ?? []) : []
  const meals = (index.mealsByDish.get(dish.id) ?? []).filter((m) => m.profile_id === person.id)
  const whose = isMe ? 'Your order' : `${person.display_name}’s order`
  const getSafety = useSafety(index)
  const safety = order ? getSafety(order) : null

  return (
    <>
      <section className="mb-6 space-y-3">
        <SectionTitle>{whose}</SectionTitle>
        {order && safety && (
          <>
            {order.reaction_flag && <ReactionBanner order={order} />}
            <CoveragePanel dish={dish} coverage={safety.coverage} allergenName={allergenName} name={isMe ? 'your' : `${person.display_name}’s`} />
            {safety.stale && <StaleBanner order={order} />}
          </>
        )}
        {order ? (
          <>
            <Link
              to={`/dishes/${dish.id}/card/${person.id}`}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-text px-4 text-lg font-semibold text-bg"
            >
              Show server
            </Link>
            <ModList mods={mods} allergenName={allergenName} />
            {order.note && <p className="text-sm">{order.note}</p>}
            {order.last_verified_at && !safety?.stale && (
              <p className="text-sm text-muted">Last confirmed {formatDate(order.last_verified_at)}</p>
            )}
          </>
        ) : (
          <EmptyState title={`No saved order for ${isMe ? 'you' : person.display_name} yet`} />
        )}
        <div className="flex gap-3">
          <Link
            to={`/log?dish=${dish.id}&person=${person.id}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-accent px-4 font-medium text-accent-contrast"
          >
            Log meal
          </Link>
          <Link
            to={`/dishes/${dish.id}/order/${person.id}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-surface px-4 font-medium"
          >
            {order ? 'Edit order' : 'Save an order'}
          </Link>
        </div>
      </section>

      <section>
        <SectionTitle>History</SectionTitle>
        {meals.length === 0 ? (
          <p className="text-sm text-muted">No meals logged yet.</p>
        ) : (
          <ul className="space-y-3">
            {meals.map((m) => (
              <MealRow key={m.id} meal={m} index={index} allergenName={allergenName} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function MealRow({ meal, index, allergenName }: { meal: Meal; index: BundleIndex; allergenName: Map<string, string> }) {
  const remove = useDeleteMeal()
  const location = meal.location_id ? index.locations.find((l) => l.id === meal.location_id) : undefined
  const restaurant = index.restaurantById.get(index.dishById.get(meal.dish_id)?.restaurant_id ?? '')

  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{formatDate(meal.eaten_on)}</span>
        <OutcomeBadge outcome={meal.outcome} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
        <StarRating value={meal.taste_rating} />
        {meal.price_cents != null && <span>{formatMoney(meal.price_cents, meal.currency)}</span>}
        {restaurant?.is_chain && location && <span>{location.label || location.address}</span>}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-accent">Changes made ({meal.mods_snapshot.length})</summary>
        <div className="mt-2">
          <ModList mods={meal.mods_snapshot} allergenName={allergenName} />
        </div>
      </details>
      {meal.outcome_notes && <p className="mt-2 text-sm whitespace-pre-line">{meal.outcome_notes}</p>}
      {meal.notes && <p className="mt-2 text-sm">{meal.notes}</p>}
      <div className="mt-2 text-right">
        <button
          type="button"
          className="min-h-10 text-sm text-muted"
          disabled={remove.isPending}
          onClick={() => confirm('Delete this meal log?') && remove.mutate(meal.id)}
        >
          Delete
        </button>
      </div>
    </li>
  )
}

/** SPEC §5.3: never green. The best state is "all tagged allergens addressed". */
function CoveragePanel({
  dish,
  coverage,
  allergenName,
  name,
}: {
  dish: Dish
  coverage: Coverage
  allergenName: Map<string, string>
  name: string
}) {
  const names = (ids: string[]) => ids.map((id) => allergenName.get(id) ?? '?').join(', ')
  if (coverage.status === 'not_recorded') {
    return (
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
        Allergens not recorded for this dish, so the app can’t check it.{' '}
        <Link to={`/dishes/${dish.id}/edit`} className="text-accent">
          Tag allergens
        </Link>
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {coverage.uncoveredAllergies.map((id) => (
        <p key={id} role="alert" className="rounded-xl bg-danger-surface px-3 py-2 text-sm font-medium text-danger">
          ⚠ Contains {allergenName.get(id) ?? 'an allergen'}: no change addresses it.
        </p>
      ))}
      {coverage.uncoveredPreferences.length > 0 && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
          Also contains {names(coverage.uncoveredPreferences)} ({name} preference).
        </p>
      )}
      {coverage.status === 'addressed' && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
          {coverage.relevantAllergies.length
            ? `All tagged allergens addressed (${names(coverage.relevantAllergies)}).`
            : `None of ${name} allergies are tagged on this dish.`}{' '}
          <span className="text-muted">Based only on what you recorded. Confirm with staff.</span>
        </p>
      )}
    </div>
  )
}

function StaleBanner({ order }: { order: SafeOrder }) {
  const confirmIt = useConfirmWithStaff()
  const since = order.last_verified_at ?? order.created_at
  return (
    <div className="space-y-2 rounded-xl bg-warn-surface px-3 py-2 text-sm text-warn">
      <p className="font-medium">
        Re-confirm with staff: {order.last_verified_at ? 'last confirmed' : 'saved'} {formatDate(since)}. Recipes change.
      </p>
      <button
        type="button"
        className="min-h-10 font-semibold underline"
        disabled={confirmIt.isPending}
        onClick={() => confirmIt.mutate(order.id)}
      >
        ✓ Confirmed with staff today
      </button>
    </div>
  )
}

function ReactionBanner({ order }: { order: SafeOrder }) {
  const clear = useClearReactionFlag()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bad = order.reaction_flag === 'bad'

  return (
    <div className={`space-y-2 rounded-xl px-3 py-2 text-sm ${bad ? 'bg-danger-surface text-danger' : 'bg-warn-surface text-warn'}`} role="alert">
      <p className="font-medium">
        {bad ? 'Bad reaction' : 'Mild reaction'} logged
        {order.reaction_flag_set_at ? ` on ${formatDate(order.reaction_flag_set_at)}` : ''}. Check with staff before
        ordering this again.
      </p>
      {open ? (
        <div className="space-y-2 text-text">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why it’s OK now, e.g. turned out to be something else"
          />
          <ErrorText error={error} />
          <div className="flex gap-2">
            <Button variant="secondary" className="min-h-10" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="min-h-10 flex-1"
              disabled={clear.isPending}
              onClick={() =>
                clear.mutate(
                  { orderId: order.id, note },
                  { onSuccess: () => setOpen(false), onError: (e) => setError(errorMessage(e)) },
                )
              }
            >
              Clear reaction flag
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" className="min-h-10 font-semibold underline" onClick={() => setOpen(true)}>
          Clear reaction flag…
        </button>
      )}
    </div>
  )
}
