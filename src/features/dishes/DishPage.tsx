import { BackLink, EmptyState, OutcomeBadge, StarRating } from '@/components/bits'
import { Avatar, Disclaimer, ErrorText, PageHeader, SectionTitle, Spinner } from '@/components/ui'
import { useBundle, useDeleteMeal, type BundleIndex } from '@/lib/bundle'
import { formatDate, formatMoney } from '@/lib/format'
import { usePersonFilter } from '@/lib/personFilterContext'
import { useAllergens, useHouseholdContext, useMembers } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Dish, Meal, Profile } from '@/lib/types'
import { Link, useParams } from 'react-router'
import { ModList } from '../orders/ModList'

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

  return (
    <>
      <section className="mb-6 space-y-3">
        <SectionTitle>{whose}</SectionTitle>
        {order?.reaction_flag && (
          <p
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              order.reaction_flag === 'bad' ? 'bg-danger-surface text-danger' : 'bg-warn-surface text-warn'
            }`}
          >
            {order.reaction_flag === 'bad' ? 'Bad reaction' : 'Mild reaction'} logged
            {order.reaction_flag_set_at ? ` on ${formatDate(order.reaction_flag_set_at)}` : ''}. Check with staff before
            ordering this again.
          </p>
        )}
        {order ? (
          <>
            <ModList mods={mods} allergenName={allergenName} />
            {order.note && <p className="text-sm">{order.note}</p>}
            {order.last_verified_at && (
              <p className="text-sm text-muted">Last eaten without problems {formatDate(order.last_verified_at)}</p>
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
      {meal.outcome_notes && <p className="mt-2 text-sm">{meal.outcome_notes}</p>}
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
