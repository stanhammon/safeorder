/** Today's date in the person's own timezone, as YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA')
}

/** "Oct 13, 2026" from a YYYY-MM-DD date (parsed as local, not UTC). */
export function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`
  }
}

/** "12.50" / "$12.5" → 1250; blank → null; nonsense → NaN. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? Math.round(value * 100) : NaN
}
