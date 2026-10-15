// Row types for the tables used so far. Replace with `supabase gen types` output
// once the project is linked (see README).

export type AllergenKind = 'allergy' | 'preference'

export interface Household {
  id: string
  name: string
  owner_id: string
  stale_after_days: number
  default_currency: string
}

export interface Profile {
  id: string
  household_id: string | null
  display_name: string
  color: string
  chef_card_message: string | null
  chef_card_message_es: string | null
  server_card_theme: 'light' | 'dark'
  disclaimer_ack_at: string | null
}

export interface Allergen {
  id: string
  household_id: string | null
  name: string
  is_preset: boolean
  sort_order: number
  /** Optional Spanish name for custom allergens (presets are translated in code). */
  name_es: string | null
}

export interface PersonAllergen {
  profile_id: string
  allergen_id: string
  household_id: string
  kind: AllergenKind
  notes: string | null
}

export interface HouseholdInvite {
  id: string
  household_id: string
  email: string
  invited_by: string
  expires_at: string
  created_at: string
}

export interface MyInvite {
  invite_id: string
  household_id: string
  household_name: string
  invited_by_name: string
  expires_at: string
}

export type ModAction = 'remove' | 'substitute' | 'add' | 'on_the_side' | 'ask_kitchen' | 'other'
export type MealOutcome = 'fine' | 'mild' | 'bad'

export interface Restaurant {
  id: string
  household_id: string
  name: string
  cuisine: string | null
  is_chain: boolean
  notes: string | null
  archived_at: string | null
  created_at: string
}

export interface Location {
  id: string
  household_id: string
  restaurant_id: string
  label: string | null
  address: string | null
  lat: number | null
  lng: number | null
  map_url: string | null
  notes: string | null
  archived_at: string | null
  created_at: string
}

export interface Dish {
  id: string
  household_id: string
  restaurant_id: string
  name: string
  description: string | null
  archived_at: string | null
  created_at: string
}

export interface DishAllergen {
  dish_id: string
  allergen_id: string
}

export interface SafeOrder {
  id: string
  dish_id: string
  profile_id: string
  note: string | null
  last_verified_at: string | null
  reaction_flag: 'mild' | 'bad' | null
  reaction_flag_set_at: string | null
  created_at: string
  updated_at: string
}

/** A modification as edited in the UI and stored in meal snapshots. */
export interface ModDraft {
  action: ModAction
  item: string
  replacement?: string | null
  allergen_id?: string | null
  /** Snapshot only: name at the time, so history survives allergen renames. */
  allergen_name?: string | null
  note?: string | null
  /** Optional Spanish wording for the card; blank uses the built-in dictionary. */
  item_es?: string | null
  replacement_es?: string | null
}

export interface Modification extends ModDraft {
  id: string
  safe_order_id: string
  position: number
}

export interface Meal {
  id: string
  dish_id: string
  profile_id: string
  location_id: string | null
  eaten_on: string
  taste_rating: number | null
  outcome: MealOutcome | null
  outcome_notes: string | null
  price_cents: number | null
  currency: string
  notes: string | null
  mods_snapshot: ModDraft[]
  created_at: string
  created_by: string | null
}

export interface Bundle {
  restaurants: Restaurant[]
  locations: Location[]
  dishes: Dish[]
  dish_allergens: DishAllergen[]
  safe_orders: SafeOrder[]
  modifications: Modification[]
  meals: Meal[]
}
