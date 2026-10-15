import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useHouseholdContext } from './queries'
import { supabase } from './supabase'
import type {
  Bundle,
  Dish,
  Location,
  Meal,
  ModDraft,
  Modification,
  Restaurant,
  SafeOrder,
} from './types'

export const bundleKey = (householdId: string) => ['bundle', householdId] as const

/** Lookup tables over the bundle, rebuilt only when the data changes. */
export interface BundleIndex extends Bundle {
  restaurantById: Map<string, Restaurant>
  dishById: Map<string, Dish>
  locationsByRestaurant: Map<string, Location[]>
  dishesByRestaurant: Map<string, Dish[]>
  allergenIdsByDish: Map<string, Set<string>>
  /** key: `${dishId}:${profileId}` */
  orderByDishPerson: Map<string, SafeOrder>
  ordersByDish: Map<string, SafeOrder[]>
  modsByOrder: Map<string, Modification[]>
  /** Newest first. */
  mealsByDish: Map<string, Meal[]>
  /** Most recent meal date per restaurant (ISO date). */
  lastMealByRestaurant: Map<string, string>
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = map.get(k)
    if (list) list.push(row)
    else map.set(k, [row])
  }
  return map
}

function buildIndex(b: Bundle): BundleIndex {
  const dishById = new Map(b.dishes.map((d) => [d.id, d]))
  const allergenIdsByDish = new Map<string, Set<string>>()
  for (const da of b.dish_allergens) {
    const set = allergenIdsByDish.get(da.dish_id) ?? new Set<string>()
    set.add(da.allergen_id)
    allergenIdsByDish.set(da.dish_id, set)
  }
  const lastMealByRestaurant = new Map<string, string>()
  for (const m of b.meals) {
    const dish = dishById.get(m.dish_id)
    if (!dish) continue
    const prev = lastMealByRestaurant.get(dish.restaurant_id)
    if (!prev || m.eaten_on > prev) lastMealByRestaurant.set(dish.restaurant_id, m.eaten_on)
  }
  return {
    ...b,
    restaurantById: new Map(b.restaurants.map((r) => [r.id, r])),
    dishById,
    locationsByRestaurant: group(b.locations, (l) => l.restaurant_id),
    dishesByRestaurant: group(b.dishes, (d) => d.restaurant_id),
    allergenIdsByDish,
    orderByDishPerson: new Map(b.safe_orders.map((o) => [`${o.dish_id}:${o.profile_id}`, o])),
    ordersByDish: group(b.safe_orders, (o) => o.dish_id),
    modsByOrder: group(b.modifications, (m) => m.safe_order_id),
    mealsByDish: group(b.meals, (m) => m.dish_id),
    lastMealByRestaurant,
  }
}

export function useBundle() {
  const { householdId } = useHouseholdContext()
  const query = useQuery({
    queryKey: bundleKey(householdId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_household_bundle')
      if (error) throw error
      return data as Bundle
    },
  })
  const index = useMemo(() => (query.data ? buildIndex(query.data) : undefined), [query.data])
  return { ...query, index }
}

/** Any write that changes bundle data: run it, then refetch the bundle. */
export function useBundleMutation<TArgs, TResult = unknown>(
  fn: (args: TArgs) => PromiseLike<{ data: TResult | null; error: unknown }>,
) {
  const { householdId } = useHouseholdContext()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const { data, error } = await fn(args)
      if (error) throw error
      return data as TResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: bundleKey(householdId) }),
  })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface RestaurantInput {
  name: string
  cuisine?: string | null
  is_chain: boolean
  notes?: string | null
}

export interface LocationInput {
  label?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  map_url?: string | null
  notes?: string | null
}

export const useCreateRestaurant = () =>
  useBundleMutation((args: { restaurant: RestaurantInput; location: LocationInput }) =>
    supabase.rpc('create_restaurant', { p_restaurant: args.restaurant, p_location: args.location }),
  )

export const useUpdateRestaurant = () =>
  useBundleMutation((args: { id: string; patch: Partial<RestaurantInput> & { archived_at?: string | null } }) =>
    supabase.from('restaurants').update(args.patch).eq('id', args.id),
  )

export const useDeleteRestaurant = () =>
  useBundleMutation((id: string) => supabase.from('restaurants').delete().eq('id', id))

export function useAddLocation() {
  const { householdId } = useHouseholdContext()
  return useBundleMutation((args: { restaurantId: string; location: LocationInput }) =>
    supabase
      .from('locations')
      .insert({ ...args.location, restaurant_id: args.restaurantId, household_id: householdId }),
  )
}

export const useUpdateLocation = () =>
  useBundleMutation((args: { id: string; patch: LocationInput & { archived_at?: string | null } }) =>
    supabase.from('locations').update(args.patch).eq('id', args.id),
  )

export interface DishInput {
  name: string
  description?: string | null
  allergenIds: string[]
}

export function useCreateDish() {
  const { householdId } = useHouseholdContext()
  return useBundleMutation(async (args: { restaurantId: string; dish: DishInput }) => {
    const { data, error } = await supabase
      .from('dishes')
      .insert({
        household_id: householdId,
        restaurant_id: args.restaurantId,
        name: args.dish.name.trim(),
        description: args.dish.description?.trim() || null,
      })
      .select('id')
      .single()
    if (error) return { data: null, error }
    const id = (data as { id: string }).id
    if (args.dish.allergenIds.length) {
      const res = await supabase.from('dish_allergens').insert(
        args.dish.allergenIds.map((allergen_id) => ({ dish_id: id, allergen_id, household_id: householdId })),
      )
      if (res.error) return { data: null, error: res.error }
    }
    return { data: id, error: null }
  })
}

export function useUpdateDish() {
  const { householdId } = useHouseholdContext()
  return useBundleMutation(
    async (args: { id: string; patch: { name?: string; description?: string | null; archived_at?: string | null }; allergenIds?: string[] }) => {
      if (Object.keys(args.patch).length) {
        const res = await supabase.from('dishes').update(args.patch).eq('id', args.id)
        if (res.error) return res
      }
      if (args.allergenIds) {
        const del = await supabase.from('dish_allergens').delete().eq('dish_id', args.id)
        if (del.error) return del
        if (args.allergenIds.length) {
          const ins = await supabase.from('dish_allergens').insert(
            args.allergenIds.map((allergen_id) => ({ dish_id: args.id, allergen_id, household_id: householdId })),
          )
          if (ins.error) return ins
        }
      }
      return { data: null, error: null }
    },
  )
}

export const useDeleteDish = () =>
  useBundleMutation((id: string) => supabase.from('dishes').delete().eq('id', id))

/** Mods as sent to the database: drop empty rows, keep only stored fields. */
export function cleanMods(mods: ModDraft[]): ModDraft[] {
  return mods
    .filter((m) => m.item.trim())
    .map((m) => ({
      action: m.action,
      item: m.item.trim(),
      replacement: m.action === 'substitute' ? m.replacement?.trim() || null : null,
      allergen_id: m.allergen_id || null,
      allergen_name: m.allergen_name ?? null,
      note: m.note?.trim() || null,
      item_es: m.item_es?.trim() || null,
      replacement_es: m.action === 'substitute' ? m.replacement_es?.trim() || null : null,
    }))
}

export const useSaveSafeOrder = () =>
  useBundleMutation((args: { dishId: string; profileId: string; note: string; mods: ModDraft[] }) =>
    supabase.rpc('save_safe_order', {
      p_dish_id: args.dishId,
      p_profile_id: args.profileId,
      p_note: args.note,
      p_mods: cleanMods(args.mods),
    }),
  )

export interface MealInput {
  dish_id: string
  profile_id: string
  location_id: string | null
  eaten_on: string
  taste_rating: number | null
  outcome: Meal['outcome']
  outcome_notes: string | null
  price_cents: number | null
  notes: string | null
  mods_snapshot: ModDraft[]
}

export const useLogMeal = () =>
  useBundleMutation((args: { meal: MealInput; updateSafeOrder: boolean }) =>
    supabase.rpc('log_meal', { p_meal: args.meal, p_update_safe_order: args.updateSafeOrder }),
  )

export const useDeleteMeal = () =>
  useBundleMutation((id: string) => supabase.from('meals').delete().eq('id', id))

/** "Confirmed with staff today" (SPEC §5.2). */
export const useConfirmWithStaff = () =>
  useBundleMutation((orderId: string) =>
    supabase.from('safe_orders').update({ last_verified_at: new Date().toISOString() }).eq('id', orderId),
  )

export const useClearReactionFlag = () =>
  useBundleMutation((args: { orderId: string; note: string }) =>
    supabase.rpc('clear_reaction_flag', { p_safe_order_id: args.orderId, p_note: args.note }),
  )

export const useSetMealOutcome = () =>
  useBundleMutation((args: { mealId: string; outcome: Meal['outcome']; notes: string }) =>
    supabase.rpc('set_meal_outcome', { p_meal_id: args.mealId, p_outcome: args.outcome ?? '', p_outcome_notes: args.notes }),
  )
