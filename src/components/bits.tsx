import type { PersonSelection } from '@/lib/personFilterContext'
import type { MealOutcome, Profile } from '@/lib/types'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from './ui'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-3 inline-flex min-h-10 items-center text-sm text-accent">
      ← {children}
    </Link>
  )
}

/** Row of person chips; with `allowEveryone` adds an "Everyone" chip. */
export function PersonChips({
  members,
  selected,
  onSelect,
  allowEveryone = false,
  meId,
}: {
  members: Profile[]
  selected: PersonSelection
  onSelect: (p: PersonSelection) => void
  allowEveryone?: boolean
  meId?: string
}) {
  // Nothing to choose between when it's just you.
  if (members.length <= 1) return null
  const ordered = [...members].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0))
  const chip = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm ${
      active ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-surface'
    }`
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Person">
      {ordered.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={selected === m.id}
          className={chip(selected === m.id)}
          onClick={() => onSelect(m.id)}
        >
          <Avatar name={m.display_name} color={m.color} size="sm" />
          {m.id === meId ? 'Me' : m.display_name}
        </button>
      ))}
      {allowEveryone && (
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'everyone'}
          className={chip(selected === 'everyone')}
          onClick={() => onSelect('everyone')}
        >
          Everyone
        </button>
      )}
    </div>
  )
}

type Tone = 'neutral' | 'warn' | 'danger' | 'accent'

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    neutral: 'bg-surface-2 text-muted',
    warn: 'bg-warn-surface text-warn',
    danger: 'bg-danger-surface text-danger',
    accent: 'bg-surface-2 text-accent',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function StarRating({
  value,
  onChange,
}: {
  value: number | null
  onChange?: (v: number | null) => void
}) {
  if (!onChange) {
    if (!value) return null
    return (
      <span aria-label={`${value} out of 5 stars`} className="text-warn">
        {'★'.repeat(value)}
        <span className="text-border">{'★'.repeat(5 - value)}</span>
      </span>
    )
  }
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Taste rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          // Tapping the current rating clears it.
          onClick={() => onChange(value === n ? null : n)}
          className={`size-11 text-2xl ${value && n <= value ? 'text-warn' : 'text-border'}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

const OUTCOMES: { value: MealOutcome; label: string; icon: string }[] = [
  { value: 'fine', label: 'Fine', icon: '✓' },
  { value: 'mild', label: 'Mild reaction', icon: '!' },
  { value: 'bad', label: 'Bad reaction', icon: '!!' },
]

export function OutcomeBadge({ outcome }: { outcome: MealOutcome | null }) {
  if (!outcome) return <Badge>Outcome not recorded</Badge>
  const o = OUTCOMES.find((x) => x.value === outcome)!
  return <Badge tone={outcome === 'fine' ? 'accent' : outcome === 'mild' ? 'warn' : 'danger'}>{o.label}</Badge>
}

export function OutcomePicker({
  value,
  onChange,
}: {
  value: MealOutcome | null
  onChange: (v: MealOutcome | null) => void
}) {
  const options: { value: MealOutcome | null; label: string }[] = [
    { value: null, label: 'Not yet' },
    ...OUTCOMES.map((o) => ({ value: o.value, label: o.label })),
  ]
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How did it go?">
      {options.map((o) => {
        const active = value === o.value
        const activeTone =
          o.value === 'bad'
            ? 'border-danger bg-danger-surface text-danger'
            : o.value === 'mild'
              ? 'border-warn bg-warn-surface text-warn'
              : 'border-accent bg-surface-2 text-accent'
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-12 rounded-xl border px-3 text-sm font-medium ${active ? activeTone : 'border-border bg-surface'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}

/** "★ 4.3 (6)": average taste rating with the number of rated meals. */
export function AverageRating({ rating }: { rating: { average: number; count: number } | null }) {
  if (!rating) return null
  const label = `Average ${rating.average.toFixed(1)} out of 5 stars from ${rating.count} rated meal${rating.count > 1 ? 's' : ''}`
  return (
    <span aria-label={label} title={label} className="inline-flex shrink-0 items-center gap-1 text-sm">
      <span className="text-warn">★</span>
      <span className="font-medium">{rating.average.toFixed(1)}</span>
      <span className="text-muted">({rating.count})</span>
    </span>
  )
}
