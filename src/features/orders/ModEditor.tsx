import { Button, Input } from '@/components/ui'
import { MOD_ACTIONS } from '@/lib/mods'
import type { Allergen, ModAction, ModDraft } from '@/lib/types'
import { useId, useState } from 'react'

interface Props {
  mods: ModDraft[]
  onChange: (mods: ModDraft[]) => void
  allergens: Allergen[]
  /** The eater's own allergens, listed first in the picker. */
  personAllergenIds: Set<string>
  /** Autocomplete for the item field: items used anywhere in the household. */
  itemSuggestions: string[]
  quickAdd: ModDraft[]
}

const emptyMod = (): ModDraft => ({ action: 'remove', item: '', replacement: null, allergen_id: null, note: null })

export function ModEditor({ mods, onChange, allergens, personAllergenIds, itemSuggestions, quickAdd }: Props) {
  const listId = useId()
  const allergenName = new Map(allergens.map((a) => [a.id, a.name]))

  function update(i: number, patch: Partial<ModDraft>) {
    const next = mods.map((m, j) => (j === i ? { ...m, ...patch } : m))
    if (patch.allergen_id !== undefined) {
      next[i].allergen_name = patch.allergen_id ? (allergenName.get(patch.allergen_id) ?? null) : null
    }
    onChange(next)
  }

  function move(i: number, delta: number) {
    const j = i + delta
    if (j < 0 || j >= mods.length) return
    const next = [...mods]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  const mine = allergens.filter((a) => personAllergenIds.has(a.id))
  const others = allergens.filter((a) => !personAllergenIds.has(a.id))
  const unusedQuick = quickAdd.filter(
    (q) => !mods.some((m) => m.action === q.action && m.item.trim().toLowerCase() === q.item.trim().toLowerCase()),
  )

  return (
    <div className="space-y-3">
      <datalist id={listId}>
        {itemSuggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {mods.length === 0 && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
          No changes: ordered as it comes. Add a change below if you need one.
        </p>
      )}

      <ol className="space-y-3">
        {mods.map((m, i) => (
          <ModRow
            key={i}
            mod={m}
            index={i}
            count={mods.length}
            listId={listId}
            mine={mine}
            others={others}
            onUpdate={(patch) => update(i, patch)}
            onMove={(d) => move(i, d)}
            onRemove={() => onChange(mods.filter((_, j) => j !== i))}
          />
        ))}
      </ol>

      <Button type="button" variant="secondary" className="w-full" onClick={() => onChange([...mods, emptyMod()])}>
        + Add a change
      </Button>

      {unusedQuick.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Quick add</p>
          <div className="flex flex-wrap gap-2">
            {unusedQuick.map((q, i) => (
              <button
                key={i}
                type="button"
                className="min-h-9 rounded-full border border-border bg-surface px-3 text-sm"
                onClick={() => onChange([...mods, { ...q }])}
              >
                + {q.action === 'substitute' ? `${q.item} → ${q.replacement}` : `${MOD_ACTIONS.find((a) => a.value === q.action)?.label} ${q.item}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ModRow(props: {
  mod: ModDraft
  index: number
  count: number
  listId: string
  mine: Allergen[]
  others: Allergen[]
  onUpdate: (patch: Partial<ModDraft>) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const { mod, index, count, listId, mine, others, onUpdate, onMove, onRemove } = props
  const [showNote, setShowNote] = useState(Boolean(mod.note))
  const itemPlaceholder: Record<ModAction, string> = {
    remove: 'e.g. cheese',
    substitute: 'Swap out, e.g. bun',
    add: 'e.g. extra lettuce',
    on_the_side: 'e.g. dressing',
    ask_kitchen: 'e.g. Is the fryer shared?',
    other: 'Describe the change',
  }

  return (
    <li className="space-y-2 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <select
          aria-label="Change type"
          className="min-h-11 flex-1 rounded-xl border border-border bg-surface-2 px-2 font-medium"
          value={mod.action}
          onChange={(e) => onUpdate({ action: e.target.value as ModAction })}
        >
          {MOD_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          ↑
        </IconButton>
        <IconButton label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
          ↓
        </IconButton>
        <IconButton label="Delete change" onClick={onRemove}>
          ✕
        </IconButton>
      </div>

      <Input
        list={listId}
        aria-label="Item"
        value={mod.item}
        maxLength={200}
        placeholder={itemPlaceholder[mod.action]}
        onChange={(e) => onUpdate({ item: e.target.value })}
      />
      {mod.action === 'substitute' && (
        <Input
          list={listId}
          aria-label="Replace with"
          value={mod.replacement ?? ''}
          maxLength={200}
          placeholder="Replace with, e.g. gluten-free bun"
          onChange={(e) => onUpdate({ replacement: e.target.value })}
        />
      )}

      <select
        aria-label="Allergen this avoids"
        className="min-h-11 w-full rounded-xl border border-border bg-surface px-2 text-sm"
        value={mod.allergen_id ?? ''}
        onChange={(e) => onUpdate({ allergen_id: e.target.value || null })}
      >
        <option value="">Avoids allergen: (none)</option>
        {mine.length > 0 && (
          <optgroup label="Their allergies">
            {mine.map((a) => (
              <option key={a.id} value={a.id}>
                Avoids {a.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label={mine.length ? 'Other allergens' : 'Allergens'}>
          {others.map((a) => (
            <option key={a.id} value={a.id}>
              Avoids {a.name}
            </option>
          ))}
        </optgroup>
      </select>

      {showNote ? (
        <Input
          aria-label="Note"
          value={mod.note ?? ''}
          maxLength={300}
          placeholder="Note, e.g. they’re usually happy to do this"
          className="text-sm"
          onChange={(e) => onUpdate({ note: e.target.value })}
        />
      ) : (
        <button type="button" className="text-sm text-accent" onClick={() => setShowNote(true)}>
          + Add note
        </button>
      )}
    </li>
  )
}

function IconButton(props: { label: string; disabled?: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted disabled:opacity-30"
    >
      {props.children}
    </button>
  )
}
