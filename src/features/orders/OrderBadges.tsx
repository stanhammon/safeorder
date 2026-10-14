import { Badge } from '@/components/bits'
import type { OrderSafety } from '@/lib/safety'

/** Compact safety badges for list rows. Color always comes with words (SPEC §6.1). */
export function OrderBadges({ safety }: { safety: OrderSafety }) {
  const badges = []
  if (safety.flag === 'bad') badges.push(<Badge key="flag" tone="danger">Bad reaction</Badge>)
  if (safety.flag === 'mild') badges.push(<Badge key="flag" tone="warn">Mild reaction</Badge>)
  if (safety.coverage.status === 'uncovered') badges.push(<Badge key="cov" tone="danger">Allergy not covered</Badge>)
  if (safety.stale) badges.push(<Badge key="stale" tone="warn">Re-confirm with staff</Badge>)
  if (badges.length === 0) return null
  return <span className="inline-flex flex-wrap gap-1">{badges}</span>
}
