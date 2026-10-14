import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUserId } from './authContext'
import { supabase } from './supabase'
import type {
  Allergen,
  AllergenKind,
  Household,
  HouseholdInvite,
  MyInvite,
  PersonAllergen,
  Profile,
} from './types'

export const keys = {
  profile: (userId: string) => ['profile', userId] as const,
  household: (id: string) => ['household', id] as const,
  members: (householdId: string) => ['members', householdId] as const,
  allergens: (householdId: string) => ['allergens', householdId] as const,
  hiddenAllergens: (householdId: string) => ['hidden-allergens', householdId] as const,
  personAllergens: (householdId: string) => ['person-allergens', householdId] as const,
  invites: (householdId: string) => ['invites', householdId] as const,
  myInvites: (userId: string) => ['my-invites', userId] as const,
}

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw error
  return data as T
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useMyProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: keys.profile(userId),
    queryFn: () => unwrap<Profile>(supabase.from('profiles').select('*').eq('id', userId).single()),
  })
}

/** Profile + household for screens below the onboarding gate. */
export function useHouseholdContext() {
  const profile = useMyProfile().data
  if (!profile?.household_id) throw new Error('useHouseholdContext called before onboarding finished')
  return { profile, householdId: profile.household_id }
}

export function useHousehold(householdId: string) {
  return useQuery({
    queryKey: keys.household(householdId),
    queryFn: () =>
      unwrap<Household>(supabase.from('households').select('*').eq('id', householdId).single()),
  })
}

export function useMembers(householdId: string) {
  return useQuery({
    queryKey: keys.members(householdId),
    queryFn: () =>
      unwrap<Profile[]>(
        supabase.from('profiles').select('*').eq('household_id', householdId).order('display_name'),
      ),
  })
}

export function useAllergens(householdId: string) {
  return useQuery({
    queryKey: keys.allergens(householdId),
    queryFn: () =>
      unwrap<Allergen[]>(
        supabase.from('allergens').select('*').order('sort_order').order('name'),
      ),
  })
}

export function useHiddenAllergenIds(householdId: string) {
  return useQuery({
    queryKey: keys.hiddenAllergens(householdId),
    queryFn: async () => {
      const rows = await unwrap<{ allergen_id: string }[]>(
        supabase.from('household_hidden_allergens').select('allergen_id').eq('household_id', householdId),
      )
      return new Set(rows.map((r) => r.allergen_id))
    },
  })
}

export function usePersonAllergens(householdId: string) {
  return useQuery({
    queryKey: keys.personAllergens(householdId),
    queryFn: () =>
      unwrap<PersonAllergen[]>(
        supabase.from('person_allergens').select('*').eq('household_id', householdId),
      ),
  })
}

export function useInvites(householdId: string) {
  return useQuery({
    queryKey: keys.invites(householdId),
    queryFn: () =>
      unwrap<HouseholdInvite[]>(
        supabase
          .from('household_invites')
          .select('*')
          .eq('household_id', householdId)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      ),
  })
}

export function useMyInvites() {
  const userId = useUserId()
  return useQuery({
    queryKey: keys.myInvites(userId),
    queryFn: () => unwrap<MyInvite[]>(supabase.rpc('get_my_invites')),
  })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export function useUpdateMyProfile() {
  const userId = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<Profile, 'display_name' | 'color' | 'chef_card_message' | 'chef_card_message_es' | 'server_card_theme' | 'disclaimer_ack_at'>>) =>
      unwrap(supabase.from('profiles').update(patch).eq('id', userId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.profile(userId) })
      qc.invalidateQueries({ queryKey: ['members'] })
    },
  })
}

export function useUpdateHousehold(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<Household, 'name' | 'stale_after_days' | 'default_currency'>>) =>
      unwrap(supabase.from('households').update(patch).eq('id', householdId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.household(householdId) }),
  })
}

/** Household membership changes ripple everywhere, so refetch everything. */
function useMembershipMutation<TArgs>(fn: (args: TArgs) => PromiseLike<{ data: unknown; error: unknown }>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => unwrap(fn(args)),
    onSuccess: () => qc.invalidateQueries(),
  })
}

export const useCreateHousehold = () =>
  useMembershipMutation((name: string) => supabase.rpc('create_household', { p_name: name }))
export const useAcceptInvite = () =>
  useMembershipMutation((inviteId: string) => supabase.rpc('accept_invite', { p_invite_id: inviteId }))
export const useLeaveHousehold = () => useMembershipMutation(() => supabase.rpc('leave_household'))
export const useRemoveMember = () =>
  useMembershipMutation((profileId: string) => supabase.rpc('remove_member', { p_profile_id: profileId }))
export const useTransferOwnership = () =>
  useMembershipMutation((profileId: string) =>
    supabase.rpc('transfer_ownership', { p_profile_id: profileId }),
  )

export function useCreateInvite(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) =>
      unwrap(
        supabase.from('household_invites').insert({ household_id: householdId, email: email.trim() }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites(householdId) }),
  })
}

export function useRevokeInvite(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) =>
      unwrap(
        supabase
          .from('household_invites')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', inviteId),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites(householdId) }),
  })
}

export function useSetPersonAllergen(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      profileId: string
      allergenId: string
      kind: AllergenKind | null
      notes?: string | null
    }) => {
      if (args.kind === null) {
        return unwrap(
          supabase
            .from('person_allergens')
            .delete()
            .eq('profile_id', args.profileId)
            .eq('allergen_id', args.allergenId),
        )
      }
      const row: Record<string, unknown> = {
        profile_id: args.profileId,
        allergen_id: args.allergenId,
        household_id: householdId,
        kind: args.kind,
      }
      if (args.notes !== undefined) row.notes = args.notes
      return unwrap(supabase.from('person_allergens').upsert(row))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.personAllergens(householdId) }),
  })
}

export function useCreateAllergen(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      unwrap<Allergen>(
        supabase
          .from('allergens')
          .insert({ household_id: householdId, name: name.trim() })
          .select()
          .single(),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.allergens(householdId) }),
  })
}

export function useRenameAllergen(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; name?: string; name_es?: string | null }) =>
      unwrap(
        supabase
          .from('allergens')
          .update({
            ...(args.name !== undefined && { name: args.name.trim() }),
            ...(args.name_es !== undefined && { name_es: args.name_es?.trim() || null }),
          })
          .eq('id', args.id),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.allergens(householdId) }),
  })
}

export function useDeleteAllergen(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => unwrap(supabase.from('allergens').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.allergens(householdId) }),
  })
}

export function useSetAllergenHidden(householdId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { allergenId: string; hidden: boolean }) =>
      args.hidden
        ? unwrap(
            supabase
              .from('household_hidden_allergens')
              .insert({ household_id: householdId, allergen_id: args.allergenId }),
          )
        : unwrap(
            supabase
              .from('household_hidden_allergens')
              .delete()
              .eq('household_id', householdId)
              .eq('allergen_id', args.allergenId),
          ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.hiddenAllergens(householdId) }),
  })
}
