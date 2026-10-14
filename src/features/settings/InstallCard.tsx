import { Button, Card, SectionTitle } from '@/components/ui'
import { useInstall } from '@/lib/install'

/** "Add to home screen" help: a button where the browser supports it, steps on iPhone. */
export function InstallCard({ compact = false, onDismiss }: { compact?: boolean; onDismiss?: () => void }) {
  const { installed, canPrompt, ios, prompt } = useInstall()
  if (installed) return null
  if (!canPrompt && !ios && compact) return null

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <SectionTitle>Install SafeOrder</SectionTitle>
        {onDismiss && (
          <button type="button" aria-label="Dismiss" className="-mt-1 min-h-10 px-2 text-muted" onClick={onDismiss}>
            ✕
          </button>
        )}
      </div>
      <p className="text-sm text-muted">
        Add it to your home screen to open it like an app, full screen, and use your saved orders without a
        connection.
      </p>
      {canPrompt ? (
        <Button onClick={prompt}>Install app</Button>
      ) : ios ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            In Safari, tap the <strong>Share</strong> button (the square with an arrow).
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
        </ol>
      ) : (
        <p className="text-sm">
          In your browser’s menu, look for <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </p>
      )}
    </Card>
  )
}
