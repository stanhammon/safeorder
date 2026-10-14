import { describe, expect, it } from 'vitest'
import { parseMoney } from '../format'
import { distanceMeters, mapLink } from '../geo'
import { averageRating, frequentMods, sameMods, summarizeMods } from '../mods'
import type { ModDraft } from '../types'

const noCheese: ModDraft = { action: 'remove', item: 'cheese', allergen_id: 'milk' }
const gfBun: ModDraft = { action: 'substitute', item: 'bun', replacement: 'gluten-free bun', allergen_id: 'wheat' }

describe('summarizeMods', () => {
  it('reads like an order', () => {
    expect(summarizeMods([noCheese, gfBun])).toBe('No cheese · Sub gluten-free bun for bun')
  })
  it('says when nothing changes', () => {
    expect(summarizeMods([])).toBe('As served, no changes')
  })
})

describe('sameMods', () => {
  it('ignores case and whitespace', () => {
    expect(sameMods([noCheese], [{ ...noCheese, item: '  Cheese ' }])).toBe(true)
  })
  it('notices order, content and allergen changes', () => {
    expect(sameMods([noCheese, gfBun], [gfBun, noCheese])).toBe(false)
    expect(sameMods([noCheese], [{ ...noCheese, item: 'butter' }])).toBe(false)
    expect(sameMods([noCheese], [{ ...noCheese, allergen_id: null }])).toBe(false)
    expect(sameMods([noCheese], [])).toBe(false)
  })
})

describe('frequentMods', () => {
  it('ranks by use and dedupes', () => {
    const top = frequentMods([gfBun, noCheese, { ...noCheese, item: 'Cheese' }, gfBun, gfBun])
    expect(top.map((m) => m.item)).toEqual(['bun', 'cheese'])
  })
})

describe('parseMoney', () => {
  it('parses prices', () => {
    expect(parseMoney('12.50')).toBe(1250)
    expect(parseMoney('$9')).toBe(900)
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('1.2.3')).toBeNaN()
  })
})

describe('distanceMeters', () => {
  it('is about right', () => {
    // Statue of Liberty to Empire State Building: about 8.3 km.
    const d = distanceMeters({ lat: 40.6892, lng: -74.0445 }, { lat: 40.7484, lng: -73.9857 })
    expect(d).toBeGreaterThan(8000)
    expect(d).toBeLessThan(8600)
  })
})

describe('averageRating', () => {
  it('averages rated meals only', () => {
    expect(averageRating([{ taste_rating: 5 }, { taste_rating: null }, { taste_rating: 4 }])).toEqual({ average: 4.5, count: 2 })
    expect(averageRating([{ taste_rating: null }])).toBeNull()
  })
})

describe('mapLink', () => {
  const base = { map_url: null, address: null, lat: null, lng: null }
  it('prefers a pasted link, then coordinates, then the address', () => {
    expect(mapLink({ ...base, map_url: 'https://maps.app.goo.gl/x', lat: 1, lng: 2 }, 'Cafe')).toBe('https://maps.app.goo.gl/x')
    expect(mapLink({ ...base, lat: 40.5, lng: -74.25, address: '1 Main St' }, 'Cafe')).toBe(
      'https://www.google.com/maps/search/?api=1&query=40.5%2C-74.25',
    )
    expect(mapLink({ ...base, address: '1 Main St' }, 'Cafe')).toContain('query=Cafe%2C%201%20Main%20St')
    expect(mapLink(base, 'Cafe')).toBeNull()
  })
})
