/** Shown when a form reopens with unsaved changes from a draft. */
export function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
      <span>Restored your unsaved changes.</span>
      <button type="button" className="min-h-10 font-medium text-accent" onClick={onDiscard}>
        Start over
      </button>
    </div>
  )
}
