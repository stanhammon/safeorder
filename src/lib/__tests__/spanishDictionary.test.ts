import { describe, expect, it } from 'vitest'
import { translateItem } from '../spanishDictionary'

describe('translateItem', () => {
  it('translates known words regardless of case, articles and punctuation', () => {
    expect(translateItem('Cheese')).toBe('queso')
    expect(translateItem('  the sour cream. ')).toBe('crema agria')
    expect(translateItem('soy sauce')).toBe('salsa de soya (soja)')
  })

  it('keeps "the fryer" as a phrase', () => {
    expect(translateItem('the fryer')).toBe('la freidora')
  })

  it('handles simple English plurals of known words', () => {
    expect(translateItem('buns')).toBe('panes')
    expect(translateItem('eggs')).toBe('huevos')
  })

  it('builds gluten-free / dairy-free / extra phrases from known words', () => {
    expect(translateItem('gluten-free bun')).toBe('pan sin gluten')
    expect(translateItem('Gluten free pasta')).toBe('pasta sin gluten')
    expect(translateItem('dairy-free cheese')).toBe('queso sin lácteos')
    expect(translateItem('extra pickles')).toBe('pepinillos extra')
  })

  it('returns null instead of guessing', () => {
    expect(translateItem('crispy shallots')).toBeNull()
    expect(translateItem('gluten-free focaccia')).toBeNull()
    expect(translateItem('')).toBeNull()
  })
})
