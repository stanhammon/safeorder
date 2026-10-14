import { createContext, useContext } from 'react'

/** Selected person for "safe for person X" (SPEC §6.3); 'everyone' shows all. */
export type PersonSelection = string | 'everyone'

export interface PersonFilterState {
  selected: PersonSelection
  setSelected: (p: PersonSelection) => void
}

export const PersonFilterContext = createContext<PersonFilterState | null>(null)

export function usePersonFilter() {
  const ctx = useContext(PersonFilterContext)
  if (!ctx) throw new Error('usePersonFilter must be used inside PersonFilterProvider')
  return ctx
}
