import { useEffect, useRef, useState } from 'react'

export const DRAFT_PREFIX = 'safeorder.draft.'

/**
 * Form state that survives a reload or lost connection (SPEC §6.4 draft
 * protection). Saved to localStorage on every change; call `clear()` after a
 * successful save. `restored` is true when an old draft was loaded.
 */
export function useDraft<T>(key: string, initial: () => T) {
  const storageKey = DRAFT_PREFIX + key
  // Read storage once, for both the value and whether it was a restored draft.
  const [loaded] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return { value: JSON.parse(saved) as T, restored: true }
    } catch {
      // Unreadable draft: start fresh.
    }
    return { value: initial(), restored: false }
  })
  const [restored, setRestored] = useState(loaded.restored)
  const [value, setValueState] = useState<T>(loaded.value)
  const cleared = useRef(false)
  // Only save once the person changes something; just opening a form isn't a draft.
  const dirty = useRef(loaded.restored)

  function setValue(next: T | ((prev: T) => T)) {
    dirty.current = true
    setValueState(next)
  }

  useEffect(() => {
    if (cleared.current || !dirty.current) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // Storage full or blocked: the form still works, just without a draft.
    }
  }, [storageKey, value])

  function clear() {
    cleared.current = true
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // Nothing to remove.
    }
  }

  function discard() {
    clear()
    cleared.current = false
    dirty.current = false
    setRestored(false)
    setValueState(initial())
  }

  return { value, setValue, restored, clear, discard }
}
