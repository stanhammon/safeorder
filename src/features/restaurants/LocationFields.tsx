import { Button, Field, Input } from '@/components/ui'
import type { LocationInput } from '@/lib/bundle'
import { getPosition } from '@/lib/geo'
import { useState } from 'react'

/** Address + "use my current location" + optional map link and notes. */
export function LocationFields({
  value,
  onChange,
  showLabel,
}: {
  value: LocationInput
  onChange: (v: LocationInput) => void
  showLabel: boolean
}) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const set = (patch: Partial<LocationInput>) => onChange({ ...value, ...patch })
  const hasCoords = value.lat != null && value.lng != null

  async function useHere() {
    setLocating(true)
    setGeoError(null)
    try {
      const c = await getPosition()
      set({ lat: c.lat, lng: c.lng })
    } catch (e) {
      setGeoError((e as Error).message)
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="space-y-4">
      {showLabel && (
        <Field label="Location name" hint="To tell this branch apart, e.g. Downtown or Airport T2.">
          <Input value={value.label ?? ''} maxLength={60} onChange={(e) => set({ label: e.target.value })} />
        </Field>
      )}
      <div className="space-y-2">
        <span className="text-sm font-medium">Where it is</span>
        {hasCoords ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span>📍 Location saved, so it can show up under Nearby</span>
            <button type="button" className="text-accent" onClick={() => set({ lat: null, lng: null })}>
              Clear
            </button>
          </div>
        ) : (
          <Button type="button" variant="secondary" className="w-full" onClick={useHere} disabled={locating}>
            {locating ? 'Finding you…' : '📍 I’m here: use my current location'}
          </Button>
        )}
        {geoError && <p className="text-sm text-danger">{geoError}</p>}
      </div>
      <Field label="Address (optional)">
        <Input
          value={value.address ?? ''}
          maxLength={200}
          autoComplete="street-address"
          onChange={(e) => set({ address: e.target.value })}
        />
      </Field>
      <Field label="Map link (optional)" hint="Paste a Google or Apple Maps link.">
        <Input
          type="url"
          inputMode="url"
          value={value.map_url ?? ''}
          onChange={(e) => set({ map_url: e.target.value })}
        />
      </Field>
      {showLabel && (
        <Field label="Notes for this location (optional)">
          <Input
            value={value.notes ?? ''}
            maxLength={300}
            placeholder="e.g. This one has a dedicated fryer"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
      )}
    </div>
  )
}
