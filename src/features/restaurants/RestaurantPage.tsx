import { AverageRating, BackLink, Badge, EmptyState, PersonChips } from '@/components/bits'
import { Avatar, Button, Card, ErrorText, PageHeader, SectionTitle, Spinner } from '@/components/ui'
import { useAddLocation, useBundle, useUpdateLocation, type BundleIndex, type LocationInput } from '@/lib/bundle'
import { distanceMeters, formatDistance, mapLink, usePosition } from '@/lib/geo'
import { averageRating, summarizeMods } from '@/lib/mods'
import { safetyRank } from '@/lib/safety'
import { usePersonFilter } from '@/lib/personFilterContext'
import { useHouseholdContext, useMembers } from '@/lib/queries'
import { errorMessage } from '@/lib/supabase'
import type { Dish, Location, Profile } from '@/lib/types'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { OrderBadges } from '../orders/OrderBadges'
import { useSafety } from '../orders/useSafety'
import { LocationFields } from './LocationFields'

export function RestaurantPage() {
  const { restaurantId } = useParams()
  const { index, isPending, error } = useBundle()
  const { householdId, profile } = useHouseholdContext()
  const members = useMembers(householdId).data ?? []
  const { selected, setSelected } = usePersonFilter()
  const [showArchived, setShowArchived] = useState(false)
  const [showOthers, setShowOthers] = useState(false)
  const getSafety = useSafety(index)

  if (isPending) return <Spinner />
  if (error || !index) return <ErrorText error={errorMessage(error)} />
  const restaurant = restaurantId ? index.restaurantById.get(restaurantId) : undefined
  if (!restaurant) {
    return (
      <>
        <BackLink to="/">Home</BackLink>
        <PageHeader title="Restaurant not found" />
      </>
    )
  }

  const locations = (index.locationsByRestaurant.get(restaurant.id) ?? []).filter((l) => !l.archived_at)
  const allDishes = index.dishesByRestaurant.get(restaurant.id) ?? []
  const dishes = allDishes.filter((d) => showArchived || !d.archived_at)
  const archivedCount = allDishes.filter((d) => d.archived_at).length
  const hasOrderFor = (d: Dish) =>
    selected === 'everyone'
      ? (index.ordersByDish.get(d.id)?.length ?? 0) > 0
      : index.orderByDishPerson.has(`${d.id}:${selected}`)
  // SPEC §7.6: fresh orders first, then stale, then uncovered, then reaction-flagged.
  const rankDish = (d: Dish) =>
    Math.min(
      ...(selected === 'everyone'
        ? (index.ordersByDish.get(d.id) ?? [])
        : [index.orderByDishPerson.get(`${d.id}:${selected}`)!]
      ).map((o) => safetyRank(getSafety(o))),
    )
  const yours = dishes.filter(hasOrderFor).sort((a, b) => rankDish(a) - rankDish(b) || a.name.localeCompare(b.name))
  const others = dishes.filter((d) => !hasOrderFor(d))
  const whose = selected === 'everyone' ? 'Saved orders' : selected === profile.id ? 'Your orders here' : `${members.find((m) => m.id === selected)?.display_name ?? 'Their'}’s orders here`

  return (
    <>
      <BackLink to="/">Home</BackLink>
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{restaurant.name}</h1>
          <Link to={`/restaurants/${restaurant.id}/edit`} className="min-h-10 shrink-0 pt-1 text-sm text-accent">
            Edit
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-muted">
          {restaurant.cuisine && <span>{restaurant.cuisine}</span>}
          {restaurant.is_chain && <Badge>Chain</Badge>}
          {restaurant.archived_at && <Badge tone="warn">Archived</Badge>}
        </div>
        {!restaurant.is_chain && <SingleLocation location={locations[0]} restaurantName={restaurant.name} />}
        {restaurant.notes && <p className="mt-2">{restaurant.notes}</p>}
      </div>

      {restaurant.is_chain && <ChainLocations restaurantId={restaurant.id} restaurantName={restaurant.name} index={index} />}

      <div className="mb-4">
        <PersonChips members={members} selected={selected} onSelect={setSelected} allowEveryone meId={profile.id} />
      </div>

      <section className="mb-6">
        <SectionTitle>{whose}</SectionTitle>
        {yours.length === 0 ? (
          <EmptyState title="No saved orders yet">
            Add a dish below, or log a meal here, and it’ll be saved for next time.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {yours.map((d) => (
              <DishRow key={d.id} dish={d} index={index} selected={selected} members={members} />
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section className="mb-6">
          <button
            type="button"
            className="mb-3 flex min-h-10 w-full items-center justify-between font-semibold"
            onClick={() => setShowOthers(!showOthers)}
            aria-expanded={showOthers}
          >
            Other dishes ({others.length})<span className="text-muted">{showOthers ? '▲' : '▼'}</span>
          </button>
          {showOthers && (
            <ul className="space-y-2">
              {others.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/dishes/${d.id}`}
                    className="flex min-h-12 items-center justify-between rounded-xl border border-border bg-surface px-4"
                  >
                    {d.name}
                    <span className="flex shrink-0 items-center gap-2">
                      {d.archived_at && <Badge tone="warn">Archived</Badge>}
                      <AverageRating rating={averageRating(index.mealsByDish.get(d.id) ?? [])} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {archivedCount > 0 && (
        <button type="button" className="mb-6 text-sm text-accent" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Hide' : 'Show'} {archivedCount} archived dish{archivedCount > 1 ? 'es' : ''}
        </button>
      )}

      <div className="flex gap-3">
        <Link
          to={`/restaurants/${restaurant.id}/dishes/new`}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-accent px-4 font-medium text-accent-contrast"
        >
          + Add dish
        </Link>
        <Link
          to={`/log?restaurant=${restaurant.id}`}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-surface px-4 font-medium"
        >
          Log a meal
        </Link>
      </div>
    </>
  )
}

function DishRow({
  dish,
  index,
  selected,
  members,
}: {
  dish: Dish
  index: BundleIndex
  selected: string
  members: Profile[]
}) {
  const navigate = useNavigate()
  const getSafety = useSafety(index)
  const orders =
    selected === 'everyone'
      ? (index.ordersByDish.get(dish.id) ?? [])
      : [index.orderByDishPerson.get(`${dish.id}:${selected}`)!]
  const byId = new Map(members.map((m) => [m.id, m]))

  return (
    <li className="rounded-2xl border border-border bg-surface">
      <Link to={`/dishes/${dish.id}`} className="block p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{dish.name}</span>
          <span className="flex shrink-0 items-center gap-2">
            {dish.archived_at && <Badge tone="warn">Archived</Badge>}
            <AverageRating rating={averageRating(index.mealsByDish.get(dish.id) ?? [])} />
          </span>
        </div>
        <ul className="mt-1 space-y-1">
          {orders.map((o) => {
            const person = byId.get(o.profile_id)
            return (
              <li key={o.id} className="flex items-start gap-2 text-sm text-muted">
                {selected === 'everyone' && person && <Avatar name={person.display_name} color={person.color} size="sm" />}
                <span className="space-y-1 pt-1">
                  <span className="block">{summarizeMods(index.modsByOrder.get(o.id) ?? [])}</span>
                  <OrderBadges safety={getSafety(o)} />
                </span>
              </li>
            )
          })}
        </ul>
      </Link>
      {selected !== 'everyone' && (
        <div className="flex gap-4 border-t border-border px-4 py-2">
          <button
            type="button"
            className="min-h-10 text-sm font-semibold text-accent"
            onClick={() => navigate(`/dishes/${dish.id}/card/${selected}`)}
          >
            Show server
          </button>
          <button
            type="button"
            className="min-h-10 text-sm font-medium text-accent"
            onClick={() => navigate(`/log?dish=${dish.id}&person=${selected}`)}
          >
            Log this meal
          </button>
        </div>
      )}
    </li>
  )
}

function ChainLocations({
  restaurantId,
  restaurantName,
  index,
}: {
  restaurantId: string
  restaurantName: string
  index: BundleIndex
}) {
  const { coords } = usePosition()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<LocationInput>({})
  const [error, setError] = useState<string | null>(null)
  const add = useAddLocation()
  const update = useUpdateLocation()
  const locations = (index.locationsByRestaurant.get(restaurantId) ?? []).filter((l) => !l.archived_at)

  const withDistance = locations
    .map((l) => ({
      l,
      d: coords && l.lat != null && l.lng != null ? distanceMeters(coords, { lat: l.lat, lng: l.lng }) : null,
    }))
    .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity))

  async function onAdd() {
    setError(null)
    try {
      await add.mutateAsync({ restaurantId, location: draft })
      setDraft({})
      setAdding(false)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Card className="mb-5 space-y-3">
      <SectionTitle>Locations</SectionTitle>
      <ul className="space-y-2">
        {withDistance.map(({ l, d }) => (
          <LocationRow
            key={l.id}
            location={l}
            restaurantName={restaurantName}
            distance={d}
            onArchive={() =>
              confirm(`Archive ${l.label || l.address || 'this location'}?`) &&
              update.mutate({ id: l.id, patch: { archived_at: new Date().toISOString() } })
            }
          />
        ))}
      </ul>
      {adding ? (
        <div className="space-y-3 border-t border-border pt-3">
          <LocationFields value={draft} onChange={setDraft} showLabel />
          <ErrorText error={error} />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={onAdd} disabled={add.isPending}>
              Save location
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setAdding(true)}>
          + Add location
        </Button>
      )}
    </Card>
  )
}

function LocationRow({
  location: l,
  restaurantName,
  distance,
  onArchive,
}: {
  location: Location
  restaurantName: string
  distance: number | null
  onArchive: () => void
}) {
  return (
    <li className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="font-medium">{l.label || l.address || 'Unnamed location'}</div>
        <div className="text-sm text-muted">
          {[l.label && l.address, distance != null && formatDistance(distance)].filter(Boolean).join(' · ')}
        </div>
        {l.notes && <div className="text-sm">{l.notes}</div>}
        <MapButton location={l} restaurantName={restaurantName} compact />
      </div>
      <button type="button" className="min-h-10 shrink-0 text-sm text-muted" onClick={onArchive}>
        Archive
      </button>
    </li>
  )
}

/** Address and map button under the name of a single-location restaurant. */
function SingleLocation({ location, restaurantName }: { location: Location | undefined; restaurantName: string }) {
  if (!location) return null
  const link = mapLink(location, restaurantName)
  if (!location.address && !link) return null
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
      <span className="min-w-0">{location.address ?? <span className="text-muted">No address saved</span>}</span>
      <MapButton location={location} restaurantName={restaurantName} />
    </div>
  )
}

function MapButton({
  location,
  restaurantName,
  compact = false,
}: {
  location: Location
  restaurantName: string
  compact?: boolean
}) {
  const link = mapLink(location, restaurantName)
  if (!link) return null
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className={
        compact
          ? 'inline-flex min-h-10 items-center text-sm font-medium text-accent'
          : 'inline-flex min-h-10 shrink-0 items-center rounded-xl border border-border bg-surface px-3 text-sm font-medium text-accent'
      }
    >
      📍 Show on map
    </a>
  )
}
