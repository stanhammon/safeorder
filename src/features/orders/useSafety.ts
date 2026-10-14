import type { BundleIndex } from '@/lib/bundle'
import { useHousehold, useHouseholdContext, usePersonAllergens } from '@/lib/queries'
import { coverage, isStale, type OrderSafety } from '@/lib/safety'
import type { PersonAllergen, SafeOrder } from '@/lib/types'
import { useCallback, useMemo } from 'react'

const NONE: PersonAllergen[] = []
const DEFAULT_STALE_DAYS = 180

/** Returns a function that works out a saved order's stale/coverage/flag state. */
export function useSafety(index: BundleIndex | undefined) {
  const { householdId } = useHouseholdContext()
  const staleDays = useHousehold(householdId).data?.stale_after_days ?? DEFAULT_STALE_DAYS
  const personAllergens = usePersonAllergens(householdId).data ?? NONE

  const byPerson = useMemo(() => {
    const map = new Map<string, PersonAllergen[]>()
    for (const pa of personAllergens) map.set(pa.profile_id, [...(map.get(pa.profile_id) ?? []), pa])
    return map
  }, [personAllergens])

  return useCallback(
    (order: SafeOrder): OrderSafety => ({
      stale: isStale(order, staleDays),
      coverage: coverage(
        index?.allergenIdsByDish.get(order.dish_id) ?? new Set(),
        byPerson.get(order.profile_id) ?? NONE,
        index?.modsByOrder.get(order.id) ?? [],
      ),
      flag: order.reaction_flag,
    }),
    [index, staleDays, byPerson],
  )
}
