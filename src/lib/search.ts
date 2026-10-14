import MiniSearch from 'minisearch'
import { useMemo } from 'react'
import type { BundleIndex } from './bundle'

interface Doc {
  id: string
  kind: 'restaurant' | 'dish'
  name: string
  /** Restaurant: cuisine. Dish: restaurant name. */
  context: string
  /** Dish only: modification items, so "gf bun" finds dishes. */
  mods: string
}

export interface SearchHit {
  kind: 'restaurant' | 'dish'
  id: string
}

export function useSearch(index: BundleIndex | undefined, includeArchived = false) {
  const engine = useMemo(() => {
    if (!index) return null
    const ms = new MiniSearch<Doc>({
      fields: ['name', 'context', 'mods'],
      storeFields: ['kind'],
      searchOptions: {
        prefix: true,
        fuzzy: (term) => (term.length >= 4 ? 1 : 0),
        boost: { name: 3, context: 1, mods: 0.5 },
        combineWith: 'AND',
      },
    })
    const docs: Doc[] = []
    for (const r of index.restaurants) {
      if (r.archived_at && !includeArchived) continue
      docs.push({ id: `r:${r.id}`, kind: 'restaurant', name: r.name, context: r.cuisine ?? '', mods: '' })
    }
    for (const d of index.dishes) {
      const r = index.restaurantById.get(d.restaurant_id)
      if (!r || ((d.archived_at || r.archived_at) && !includeArchived)) continue
      const mods = (index.ordersByDish.get(d.id) ?? [])
        .flatMap((o) => index.modsByOrder.get(o.id) ?? [])
        .map((m) => `${m.item} ${m.replacement ?? ''}`)
        .join(' ')
      docs.push({ id: `d:${d.id}`, kind: 'dish', name: d.name, context: r.name, mods })
    }
    ms.addAll(docs)
    return ms
  }, [index, includeArchived])

  return useMemo(
    () =>
      (query: string): SearchHit[] => {
        if (!engine || !query.trim()) return []
        return engine.search(query.trim()).map((r) => ({
          kind: r.kind as SearchHit['kind'],
          id: String(r.id).slice(2),
        }))
      },
    [engine],
  )
}
