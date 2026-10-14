import { describe, expect, it } from 'vitest'
import { allergenLabel, modInstruction } from '../cardText'
import { coverage, isStale, safetyRank } from '../safety'
import type { ModDraft, PersonAllergen } from '../types'

const pa = (allergen_id: string, kind: PersonAllergen['kind']): PersonAllergen => ({
  profile_id: 'p',
  allergen_id,
  household_id: 'h',
  kind,
  notes: null,
})

describe('coverage', () => {
  const allergies = [pa('milk', 'allergy'), pa('peanut', 'allergy'), pa('garlic', 'preference')]

  it('is never "addressed" when the dish has no tags', () => {
    expect(coverage(new Set(), allergies, []).status).toBe('not_recorded')
  })

  it('flags a tagged allergy with no change linked to it', () => {
    const c = coverage(new Set(['milk', 'wheat']), allergies, [])
    expect(c.status).toBe('uncovered')
    expect(c.uncoveredAllergies).toEqual(['milk'])
  })

  it('counts linked changes, including ask-kitchen questions', () => {
    const mods: ModDraft[] = [
      { action: 'remove', item: 'cheese', allergen_id: 'milk' },
      { action: 'ask_kitchen', item: 'Peanut oil in the fryer?', allergen_id: 'peanut' },
    ]
    const c = coverage(new Set(['milk', 'peanut', 'garlic']), allergies, mods)
    expect(c.status).toBe('addressed')
    expect(c.uncoveredPreferences).toEqual(['garlic'])
  })

  it('ignores allergens the person does not have', () => {
    expect(coverage(new Set(['wheat']), allergies, []).status).toBe('addressed')
  })
})

describe('isStale', () => {
  const now = Date.parse('2026-10-15T12:00:00Z')
  it('uses the last confirmation, else the creation date', () => {
    expect(isStale({ last_verified_at: '2026-06-01T00:00:00Z', created_at: '2020-01-01T00:00:00Z' }, 180, now)).toBe(false)
    expect(isStale({ last_verified_at: null, created_at: '2026-01-01T00:00:00Z' }, 180, now)).toBe(true)
  })
})

describe('safetyRank', () => {
  const base = { stale: false, flag: null, coverage: coverage(new Set(), [], []) }
  it('puts flagged last and fresh first', () => {
    const uncovered = coverage(new Set(['milk']), [pa('milk', 'allergy')], [])
    const ranks = [
      safetyRank({ ...base, flag: 'mild' }),
      safetyRank({ ...base, coverage: uncovered }),
      safetyRank({ ...base, stale: true }),
      safetyRank(base),
    ]
    expect(ranks).toEqual([3, 2, 1, 0])
  })
})

describe('card text', () => {
  it('translates preset allergens, and custom ones only when given a Spanish name', () => {
    expect(allergenLabel({ name: 'Milk', name_es: null, is_preset: true }, 'es')).toEqual({ text: 'Leche y lácteos', translated: true })
    expect(allergenLabel({ name: 'Garlic', name_es: null, is_preset: false }, 'es')).toEqual({ text: 'Garlic', translated: false })
    expect(allergenLabel({ name: 'Garlic', name_es: 'Ajo', is_preset: false }, 'es').text).toBe('Ajo')
  })

  it('writes changes as instructions in both languages', () => {
    const sub: ModDraft = { action: 'substitute', item: 'bun', replacement: 'lettuce wrap' }
    expect(modInstruction(sub, 'en')).toBe('Replace bun with lettuce wrap')
    expect(modInstruction(sub, 'es')).toBe('Cambiar bun por lettuce wrap')
    expect(modInstruction({ action: 'remove', item: 'queso' }, 'es')).toBe('Sin queso')
    expect(modInstruction({ action: 'on_the_side', item: 'dressing' }, 'en')).toBe('dressing on the side')
  })
})
