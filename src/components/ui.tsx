import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:opacity-90',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-2',
  ghost: 'text-accent hover:bg-surface-2',
  danger: 'bg-surface text-danger border border-border hover:bg-danger-surface',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-base text-text placeholder:text-muted ${className}`}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-border bg-surface p-3 text-base text-text placeholder:text-muted ${className}`}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-sm text-muted">{hint}</span>}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>{children}</section>
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold">{children}</h2>
}

export function ErrorText({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-xl bg-danger-surface px-3 py-2 text-sm text-danger">
      {error}
    </p>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-muted" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label}
    </div>
  )
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </header>
  )
}

export function Avatar({ name, color, size = 'md' }: { name: string; color: string; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'size-7 text-xs' : 'size-10 text-base'
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dims}`}
      style={{ backgroundColor: color }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

const PROFILE_COLORS = [
  '#2f7d6d',
  '#3866b0',
  '#8a4fb5',
  '#b8456e',
  '#c0562b',
  '#9a7a12',
  '#4f7a2a',
  '#5b6470',
]

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color">
      {PROFILE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={`size-10 rounded-full ring-offset-2 ring-offset-surface ${value === c ? 'ring-2 ring-text' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-sm text-muted">
        A memory aid, not a safety guarantee. Always confirm with restaurant staff.
      </p>
    )
  }
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      <p>
        SafeOrder helps you <strong>remember</strong> what you ordered and how you modified it. It is a
        personal memory aid, <strong>not a safety guarantee</strong>.
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Restaurants change recipes, suppliers and staff. What was safe last time may not be today.</li>
        <li>The app never confirms that a dish is safe. It only reflects what you recorded.</li>
        <li>Always tell staff about your allergies and confirm your order every time.</li>
        <li>In a medical emergency, use your emergency medication and call emergency services.</li>
      </ul>
    </div>
  )
}
