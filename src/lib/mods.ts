import type { ModAction, ModDraft } from './types'

export const MOD_ACTIONS: { value: ModAction; label: string }[] = [
  { value: 'remove', label: 'Remove' },
  { value: 'substitute', label: 'Substitute' },
  { value: 'add', label: 'Add' },
  { value: 'on_the_side', label: 'On the side' },
  { value: 'ask_kitchen', label: 'Ask kitchen' },
  { value: 'other', label: 'Other' },
]

const LABELS = Object.fromEntries(MOD_ACTIONS.map((a) => [a.value, a.label])) as Record<ModAction, string>

/** "Substitute bun → gluten-free bun". The allergen is shown separately. */
export function describeMod(mod: ModDraft): { verb: string; text: string } {
  switch (mod.action) {
    case 'substitute':
      return { verb: 'Substitute', text: `${mod.item} → ${mod.replacement ?? '?'}` }
    case 'on_the_side':
      return { verb: 'On the side:', text: mod.item }
    case 'ask_kitchen':
      return { verb: 'Ask kitchen:', text: mod.item }
    case 'other':
      return { verb: '', text: mod.item }
    default:
      return { verb: LABELS[mod.action], text: mod.item }
  }
}

/** One-line summary for lists: "No cheese · Sub GF bun". */
export function summarizeMods(mods: ModDraft[]): string {
  if (mods.length === 0) return 'As served, no changes'
  return mods
    .map((m) => {
      switch (m.action) {
        case 'remove':
          return `No ${m.item}`
        case 'substitute':
          return `Sub ${m.replacement ?? '?'} for ${m.item}`
        case 'add':
          return `Add ${m.item}`
        case 'on_the_side':
          return `${m.item} on the side`
        case 'ask_kitchen':
          return `Ask: ${m.item}`
        default:
          return m.item
      }
    })
    .join(' · ')
}

function modKey(m: ModDraft) {
  return [
    m.action,
    m.item.trim().toLowerCase(),
    (m.replacement ?? '').trim().toLowerCase(),
    m.allergen_id ?? '',
    (m.note ?? '').trim(),
    (m.item_es ?? '').trim().toLowerCase(),
    (m.replacement_es ?? '').trim().toLowerCase(),
  ].join('|')
}

/** Same mods in the same order (ignores whitespace and case). */
export function sameMods(a: ModDraft[], b: ModDraft[]): boolean {
  return a.length === b.length && a.every((m, i) => modKey(m) === modKey(b[i]))
}

/** The person's most-used mods across all their saved orders, for quick-add chips. */
export function frequentMods(all: ModDraft[], limit = 6): ModDraft[] {
  const counts = new Map<string, { mod: ModDraft; n: number }>()
  for (const m of all) {
    const k = [m.action, m.item.trim().toLowerCase(), (m.replacement ?? '').trim().toLowerCase()].join('|')
    const entry = counts.get(k)
    if (entry) entry.n++
    else counts.set(k, { mod: { ...m, note: null }, n: 1 })
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((e) => e.mod)
}

/** Average taste rating over rated meals, or null when none are rated. */
export function averageRating(meals: { taste_rating: number | null }[]): { average: number; count: number } | null {
  const rated = meals.map((m) => m.taste_rating).filter((r): r is number => r != null)
  if (rated.length === 0) return null
  return { average: rated.reduce((a, b) => a + b, 0) / rated.length, count: rated.length }
}
