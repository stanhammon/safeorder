import { CARD_TEXT, readCardLang, storeCardLang, type CardLang } from '@/lib/cardText'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

const MAX_FONT_PX = 40
const MIN_FONT_PX = 22 // SPEC §9: shrink to 22 px, then scroll.
const TIP_KEY = 'safeorder.brightnessTipShown'

/**
 * Full-screen, high-contrast card for restaurant staff (SPEC §6.3).
 * Children size text in `em` so the auto-fit can scale everything together.
 */
export function CardShell({
  theme,
  fallback,
  extraControls,
  footer,
  children,
}: {
  theme: 'light' | 'dark'
  /** Where Done goes when there's no history to go back to. */
  fallback: string
  extraControls?: ReactNode
  /** Small text under the card, for the person rather than staff. */
  footer?: ReactNode
  children: (lang: CardLang) => ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [lang, setLang] = useState<CardLang>(readCardLang)
  const [showTip] = useState(() => {
    try {
      if (localStorage.getItem(TIP_KEY)) return false
      localStorage.setItem(TIP_KEY, '1')
      return true
    } catch {
      return false
    }
  })
  const boxRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const t = CARD_TEXT[lang]

  useWakeLock()
  useFitText(boxRef, contentRef, lang)

  function toggleLang() {
    const next = lang === 'en' ? 'es' : 'en'
    setLang(next)
    storeCardLang(next)
  }

  function done() {
    // A direct link has no history entry to go back to.
    if (location.key === 'default') navigate(fallback, { replace: true })
    else navigate(-1)
  }

  const colors = theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'
  const pill =
    theme === 'dark'
      ? 'border-white/40 bg-white/10 text-white'
      : 'border-black/30 bg-black/5 text-black'

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${colors}`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      lang={lang}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <button type="button" onClick={done} className={`min-h-11 rounded-full border px-4 font-semibold ${pill}`}>
          {t.done}
        </button>
        <div className="flex items-center gap-2">
          {extraControls}
          <button
            type="button"
            onClick={toggleLang}
            aria-label={t.switchLabel}
            title={t.switchLabel}
            className={`min-h-9 rounded-full border px-3 text-sm font-medium ${pill}`}
          >
            {t.switchTo}
          </button>
        </div>
      </div>

      <div ref={boxRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div ref={contentRef} className="leading-snug font-medium" style={{ fontSize: MAX_FONT_PX }}>
          {children(lang)}
        </div>
      </div>

      {(footer || showTip) && (
        <div className="space-y-1 px-6 pb-3 text-center text-xs opacity-70">
          {showTip && <p>Tip: turn your screen brightness up so staff can read this easily.</p>}
          {footer}
        </div>
      )}
    </div>
  )
}

/** Keep the screen on while the card is open, where the browser supports it. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    async function acquire() {
      try {
        if (!cancelled && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen')
        }
      } catch {
        // Low battery or unsupported: the card still works.
      }
    }
    // The lock drops when the tab is hidden; take it again on return.
    const onVisible = () => document.visibilityState === 'visible' && acquire()
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}

/** Largest font size (MAX→MIN) at which the content fits; scroll below MIN. */
function useFitText(
  boxRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  lang: CardLang,
) {
  useLayoutEffect(() => {
    const box = boxRef.current
    const content = contentRef.current
    if (!box || !content) return
    function fit() {
      let size = MAX_FONT_PX
      content!.style.fontSize = `${size}px`
      while (size > MIN_FONT_PX && box!.scrollHeight > box!.clientHeight) {
        size -= 2
        content!.style.fontSize = `${size}px`
      }
    }
    fit()
    // Refit on rotation/resize and when the content changes (e.g. preferences shown).
    // fit() is deterministic, so its own size change settles after one pass.
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    observer.observe(content)
    return () => observer.disconnect()
  }, [boxRef, contentRef, lang])
}
