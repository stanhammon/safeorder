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
  server_card_theme: 'light' | 'dark'
  disclaimer_ack_at: string | null
}

export interface Allergen {
  id: string
  household_id: string | null
  name: string
  is_preset: boolean
  sort_order: number
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
