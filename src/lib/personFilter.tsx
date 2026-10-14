import { useState, type ReactNode } from 'react'
import { PersonFilterContext, type PersonSelection } from './personFilterContext'

const STORAGE_KEY = 'safeorder.personFilter'

function readStored(): PersonSelection | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** `validIds` guards against a remembered person who is no longer shared with. */
export function PersonFilterProvider({
  defaultPerson,
  validIds,
  children,
}: {
  defaultPerson: string
  validIds: string[] | undefined
  children: ReactNode
}) {
  const [stored, setStored] = useState<PersonSelection>(() => readStored() ?? defaultPerson)
  const selected =
    stored === 'everyone' || !validIds || validIds.includes(stored) ? stored : defaultPerson

  function setSelected(p: PersonSelection) {
    setStored(p)
    try {
      localStorage.setItem(STORAGE_KEY, p)
    } catch {
      // Private mode etc.: the choice just won't be remembered.
    }
  }

  return <PersonFilterContext.Provider value={{ selected, setSelected }}>{children}</PersonFilterContext.Provider>
}
