import { describeMod } from '@/lib/mods'
import type { ModDraft } from '@/lib/types'

/** Mods as readable sentences: "Remove cheese (Milk)". */
export function ModList({ mods, allergenName }: { mods: ModDraft[]; allergenName: Map<string, string> }) {
  if (mods.length === 0) {
    return <p className="text-muted">As served, no changes.</p>
  }
  return (
    <ol className="space-y-2">
      {mods.map((m, i) => {
        const { verb, text } = describeMod(m)
        const allergen = m.allergen_id ? (allergenName.get(m.allergen_id) ?? m.allergen_name) : m.allergen_name
        return (
          <li key={i} className="rounded-xl bg-surface-2 px-3 py-2">
            <span>
              {verb && <strong>{verb} </strong>}
              {text}
            </span>
            {allergen && <span className="text-sm text-muted"> ({allergen})</span>}
            {m.note && <span className="block text-sm text-muted">{m.note}</span>}
          </li>
        )
      })}
    </ol>
  )
}
