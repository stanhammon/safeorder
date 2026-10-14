import type { ModDraft, PersonAllergen, SafeOrder } from './types'

const DAY_MS = 86_400_000

/** SPEC §5.2: not verified (or created) within the household's window. */
export function isStale(order: Pick<SafeOrder, 'last_verified_at' | 'created_at'>, staleAfterDays: number, now = Date.now()): boolean {
  const since = Date.parse(order.last_verified_at ?? order.created_at)
  return now - since > staleAfterDays * DAY_MS
}

export type CoverageStatus =
  /** The dish has no allergen tags, so nothing can be checked. Never shown as green. */
  | 'not_recorded'
  /** Tags exist and every one of the person's tagged allergies has a change linked to it. */
  | 'addressed'
  /** At least one of the person's allergies is in the dish with no change linked to it. */
  | 'uncovered'

export interface Coverage {
  status: CoverageStatus
  /** Allergy-kind allergens in the dish that no change addresses. */
  uncoveredAllergies: string[]
  /** Preference-kind allergens in the dish that no change addresses (softer notice). */
  uncoveredPreferences: string[]
  /** The person's allergies that are tagged on the dish, covered or not. */
  relevantAllergies: string[]
}

/**
 * SPEC §5.3. A change counts as covering an allergen when it's linked to it,
 * including "ask kitchen" changes (the card shows those as questions).
 */
export function coverage(dishAllergenIds: Set<string>, personAllergens: PersonAllergen[], mods: ModDraft[]): Coverage {
  const covered = new Set(mods.map((m) => m.allergen_id).filter((id): id is string => Boolean(id)))
  const inDish = personAllergens.filter((pa) => dishAllergenIds.has(pa.allergen_id))
  const allergies = inDish.filter((pa) => pa.kind === 'allergy').map((pa) => pa.allergen_id)
  const uncoveredAllergies = allergies.filter((id) => !covered.has(id))
  const uncoveredPreferences = inDish
    .filter((pa) => pa.kind === 'preference' && !covered.has(pa.allergen_id))
    .map((pa) => pa.allergen_id)
  return {
    status: dishAllergenIds.size === 0 ? 'not_recorded' : uncoveredAllergies.length ? 'uncovered' : 'addressed',
    uncoveredAllergies,
    uncoveredPreferences,
    relevantAllergies: allergies,
  }
}

export interface OrderSafety {
  stale: boolean
  coverage: Coverage
  flag: SafeOrder['reaction_flag']
}

/** SPEC §7.6 sort: fresh first, then stale, then uncovered allergies, then reaction-flagged last. */
export function safetyRank(s: OrderSafety): number {
  if (s.flag) return 3
  if (s.coverage.status === 'uncovered') return 2
  if (s.stale) return 1
  return 0
}
