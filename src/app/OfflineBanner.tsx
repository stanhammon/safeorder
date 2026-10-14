import { useBundle } from '@/lib/bundle'
import { useOnline } from '@/lib/online'

/** SPEC §6.4: say we're offline and how old the saved data is. */
export function OfflineBanner() {
  const online = useOnline()
  const { dataUpdatedAt } = useBundle()
  if (online) return null
  const when = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
  return (
    <div role="status" className="sticky top-0 z-30 bg-warn-surface px-4 py-2 text-center text-sm text-warn">
      <strong>Offline:</strong> showing saved data{when ? ` from ${when}` : ''}. Changes need a connection.
    </div>
  )
}
