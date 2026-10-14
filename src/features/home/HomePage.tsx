import { Badge, EmptyState, PersonChips } from '@/components/bits'
import { Card, Disclaimer, ErrorText, Input, PageHeader, SectionTitle, Spinner } from '@/components/ui'
import { useBundle, type BundleIndex } from '@/lib/bundle'
import { formatDate } from '@/lib/format'
import { distanceMeters, formatDistance, usePosition, type Coords } from '@/lib/geo'
import { summarizeMods } from '@/lib/mods'
import { usePersonFilter, type PersonSelection } from '@/lib/personFilterContext'
import { useHouseholdContext, useMembers } from '@/lib/queries'
import { safetyRank } from '@/lib/safety'
import { useSearch } from '@/lib/search'
import { errorMessage } from '@/lib/supabase'
import type { Restaurant } from '@/lib/types'
import { useState } from 'react'
import { Link } from 'react-router'
import { OrderBadges } from '../orders/OrderBadges'
import { useSafety } from '../orders/useSafety'
import { InstallCard } from '../settings/InstallCard'
import { OutcomeReminders } from './OutcomeReminders'

const NEARBY_METERS = 2000

export function HomePage() {
  const { profile, householdId } = useHouseholdContext()
  const members = useMembers(householdId).data ?? []
  const { selected, setSelected } = usePersonFilter()
  const { index, isPending, error } = useBundle()
  const position = usePosition()
  const [query, setQuery] = useState('')

  return (
    <>
      <PageHeader title={`Hi, ${profile.display_name}`} />
      <div className="sticky top-0 z-10 -mx-4 space-y-3 bg-bg/95 px-4 pt-1 pb-3 backdrop-blur">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search restaurants, dishes or changes"
          aria-label="Search"
        />
        <PersonChips members={members} selected={selected} onSelect={setSelected} allowEveryone meId={profile.id} />
      </div>

      {isPending ? (
        <Spinner />
      ) : error || !index ? (
        <ErrorText error={errorMessage(error)} />
      ) : query.trim() ? (
        <SearchResults index={index} query={query} selected={selected} />
      ) : index.restaurants.length === 0 ? (
        <EmptyState title="No restaurants yet">
          <p>Add the places you eat, then save how you order there.</p>
          <Link
            to="/restaurants/new"
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 font-medium text-accent-contrast"
          >
            Add your first restaurant
          </Link>
        </EmptyState>
      ) : (
        <>
          <HomeInstallPrompt />
          <OutcomeReminders index={index} />
          <Browse index={index} selected={selected} position={position} />
        </>
      )}

      <div className="mt-8">
        <Disclaimer compact />
      </div>
    </>
  )
}

function countOrders(index: BundleIndex, restaurantId: string, selected: PersonSelection): number {
  return (index.dishesByRestaurant.get(restaurantId) ?? []).filter(
    (d) =>
      !d.archived_at &&
      (selected === 'everyone'
        ? (index.ordersByDish.get(d.id)?.length ?? 0) > 0
        : index.orderByDishPerson.has(`${d.id}:${selected}`)),
  ).length
}

function nearestDistance(index: BundleIndex, r: Restaurant, coords: Coords): number | null {
  let best: number | null = null
  for (const l of index.locationsByRestaurant.get(r.id) ?? []) {
    if (l.archived_at || l.lat == null || l.lng == null) continue
    const d = distanceMeters(coords, { lat: l.lat, lng: l.lng })
    if (best == null || d < best) best = d
  }
  return best
}

function Browse({
  index,
  selected,
  position,
}: {
  index: BundleIndex
  selected: PersonSelection
  position: ReturnType<typeof usePosition>
}) {
  const active = index.restaurants.filter((r) => !r.archived_at)
  const nearby = position.coords
    ? active
        .map((r) => ({ r, d: nearestDistance(index, r, position.coords!) }))
        .filter((x): x is { r: Restaurant; d: number } => x.d != null && x.d <= NEARBY_METERS)
        .sort((a, b) => a.d - b.d)
    : []
  const recent = active
    .filter((r) => index.lastMealByRestaurant.has(r.id))
    .sort((a, b) => index.lastMealByRestaurant.get(b.id)!.localeCompare(index.lastMealByRestaurant.get(a.id)!))
    .slice(0, 10)
  const neverVisited = active.filter((r) => !index.lastMealByRestaurant.has(r.id))

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Nearby</SectionTitle>
        <NearbyStatus position={position} />
        {position.status === 'ready' &&
          (nearby.length ? (
            <RestaurantList
              rows={nearby.map(({ r, d }) => ({ r, detail: formatDistance(d) }))}
              index={index}
              selected={selected}
            />
          ) : (
            <p className="text-sm text-muted">No saved restaurants within about a mile.</p>
          ))}
      </section>

      {recent.length > 0 && (
        <section>
          <SectionTitle>Recent</SectionTitle>
          <RestaurantList
            rows={recent.map((r) => ({ r, detail: `Last visit ${formatDate(index.lastMealByRestaurant.get(r.id)!)}` }))}
            index={index}
            selected={selected}
          />
        </section>
      )}

      {neverVisited.length > 0 && (
        <section>
          <SectionTitle>{recent.length ? 'Other restaurants' : 'Your restaurants'}</SectionTitle>
          <RestaurantList rows={neverVisited.map((r) => ({ r }))} index={index} selected={selected} />
        </section>
      )}

      <Link
        to="/restaurants/new"
        className="flex min-h-12 items-center justify-center rounded-xl border border-dashed border-border font-medium text-accent"
      >
        + Add a restaurant
      </Link>
    </div>
  )
}

function RestaurantList({
  rows,
  index,
  selected,
}: {
  rows: { r: Restaurant; detail?: string }[]
  index: BundleIndex
  selected: PersonSelection
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {rows.map(({ r, detail }) => {
        const n = countOrders(index, r.id, selected)
        // Cuisine first, then the list's own detail (distance, last visit).
        const line = [r.cuisine, detail].filter(Boolean).join(' · ')
        return (
          <li key={r.id}>
            <Link to={`/restaurants/${r.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{r.name}</span>
                {line && <span className="block text-sm text-muted">{line}</span>}
              </span>
              {n > 0 && <Badge tone="accent">{n} saved</Badge>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function SearchResults({ index, query, selected }: { index: BundleIndex; query: string; selected: PersonSelection }) {
  const search = useSearch(index)
  const getSafety = useSafety(index)
  const hits = search(query)
  const restaurants = hits
    .filter((h) => h.kind === 'restaurant')
    .map((h) => index.restaurantById.get(h.id))
    .filter((r): r is Restaurant => Boolean(r))
  const dishes = hits.filter((h) => h.kind === 'dish').map((h) => index.dishById.get(h.id)!).filter(Boolean)

  // "Safe for person X": dishes with that person's saved order come first.
  const orderFor = (dishId: string) =>
    selected === 'everyone' ? index.ordersByDish.get(dishId)?.[0] : index.orderByDishPerson.get(`${dishId}:${selected}`)
  // Then SPEC §7.6 order among those: fresh, stale, uncovered, reaction-flagged.
  const rank = (dishId: string) => {
    const o = orderFor(dishId)
    return o ? safetyRank(getSafety(o)) : 10
  }
  dishes.sort((a, b) => rank(a.id) - rank(b.id))

  if (!restaurants.length && !dishes.length) {
    return (
      <EmptyState title={`Nothing matches “${query.trim()}”`}>
        <Link to="/restaurants/new" className="text-accent">
          Add a restaurant
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      {restaurants.length > 0 && (
        <section>
          <SectionTitle>Restaurants</SectionTitle>
          <RestaurantList rows={restaurants.map((r) => ({ r }))} index={index} selected={selected} />
        </section>
      )}
      {dishes.length > 0 && (
        <section>
          <SectionTitle>Dishes</SectionTitle>
          <ul className="space-y-2">
            {dishes.map((d) => {
              const order = orderFor(d.id)
              return (
                <li key={d.id}>
                  <Card className="p-0">
                    <Link to={`/dishes/${d.id}`} className="block px-4 py-3">
                      <span className="block font-medium">{d.name}</span>
                      <span className="block text-sm text-muted">{index.restaurantById.get(d.restaurant_id)?.name}</span>
                      <span className="mt-1 block text-sm">
                        {order ? summarizeMods(index.modsByOrder.get(order.id) ?? []) : <span className="text-muted">No saved order</span>}
                      </span>
                      {order && (
                        <span className="mt-1 block">
                          <OrderBadges safety={getSafety(order)} />
                        </span>
                      )}
                    </Link>
                  </Card>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

/** The near-me button stays available in every state except while locating. */
function NearbyStatus({ position }: { position: ReturnType<typeof usePosition> }) {
  const { status, request } = position
  if (status === 'unsupported') return <p className="text-sm text-muted">This browser can’t share your location.</p>
  if (status === 'locating') return <p className="text-sm text-muted">Finding you…</p>
  if (status === 'ready') {
    return (
      <button type="button" className="mb-2 min-h-10 text-sm text-accent" onClick={request}>
        ↻ Refresh location
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {status === 'denied' && !window.isSecureContext && (
        <p className="text-sm text-muted">
          Browsers only share location with secure (https) sites. It works at localhost on this computer, and will
          work on your phone once the app is hosted online.
        </p>
      )}
      {status === 'denied' && window.isSecureContext && (
        <p className="text-sm text-muted">
          Location is blocked for this site. To allow it, tap the icon at the left of the address bar, set
          Location to <strong>Allow</strong>, then try again.
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-muted">Couldn’t find your location. Check that location is on for this device.</p>
      )}
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-accent"
        onClick={request}
      >
        📍 {status === 'idle' ? 'Show restaurants near me' : 'Try again'}
      </button>
    </div>
  )
}

const INSTALL_DISMISSED_KEY = 'safeorder.installDismissed'

/** One-time, dismissible install suggestion on Home; it stays available in Settings. */
function HomeInstallPrompt() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'
    } catch {
      return false
    }
  })
  if (dismissed) return null
  return (
    <div className="mb-6">
      <InstallCard
        compact
        onDismiss={() => {
          setDismissed(true)
          try {
            localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
          } catch {
            // Not remembered; it'll show again next time.
          }
        }}
      />
    </div>
  )
}
