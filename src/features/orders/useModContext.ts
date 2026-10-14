import type { BundleIndex } from '@/lib/bundle'
import { frequentMods } from '@/lib/mods'
import { useAllergens, useHiddenAllergenIds, useHouseholdContext, usePersonAllergens } from '@/lib/queries'
import type { Allergen, PersonAllergen } from '@/lib/types'
import { useMemo } from 'react'

const NO_ALLERGENS: Allergen[] = []
const NO_PERSON_ALLERGENS: PersonAllergen[] = []

/** Everything the ModEditor needs for one eater. */
export function useModContext(index: BundleIndex | undefined, personId: string) {
  const { householdId } = useHouseholdContext()
  const allergens = useAllergens(householdId).data ?? NO_ALLERGENS
  const hidden = useHiddenAllergenIds(householdId).data
  const personAllergens = usePersonAllergens(householdId).data ?? NO_PERSON_ALLERGENS

  return useMemo(() => {
    const mine = personAllergens.filter((pa) => pa.profile_id === personId)
    const personAllergenIds = new Set(mine.filter((pa) => pa.kind === 'allergy').map((pa) => pa.allergen_id))
    const all = index?.modifications ?? []
    const itemSuggestions = [
      ...new Set(all.flatMap((m) => [m.item, m.replacement ?? '']).map((s) => s.trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b))
    const personOrderIds = new Set(
      (index?.safe_orders ?? []).filter((o) => o.profile_id === personId).map((o) => o.id),
    )
    return {
      allergens: allergens.filter((a) => !hidden?.has(a.id) || personAllergenIds.has(a.id)),
      allergenName: new Map(allergens.map((a) => [a.id, a.name])),
      personAllergenIds,
      itemSuggestions,
      quickAdd: frequentMods(all.filter((m) => personOrderIds.has(m.safe_order_id))),
    }
  }, [allergens, hidden, personAllergens, personId, index])
}
