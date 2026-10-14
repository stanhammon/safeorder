import { ErrorText, Spinner } from '@/components/ui'
import { useAuth } from '@/lib/authContext'
import { PersonFilterProvider } from '@/lib/personFilter'
import { useMembers, useMyProfile } from '@/lib/queries'
import { useOnline } from '@/lib/online'
import { errorMessage } from '@/lib/supabase'
import { OfflineBanner } from './OfflineBanner'
import { Navigate, NavLink, Outlet } from 'react-router'

/** Requires a session; everything else (household, onboarding) is checked by the children. */
export function RequireSession() {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Main app: requires a household and a finished onboarding. */
export function AppLayout() {
  const profile = useMyProfile()
  const online = useOnline()

  // A fresh install that has never synced has nothing to show offline (SPEC §9).
  if (profile.isPending && !online) {
    return (
      <main className="mx-auto max-w-md space-y-3 p-6">
        <h1 className="text-xl font-semibold">You’re offline</h1>
        <p className="text-muted">
          This device hasn’t downloaded your data yet. Connect to the internet once, and after that your saved
          orders and cards work without a connection.
        </p>
      </main>
    )
  }
  if (profile.isPending) return <Spinner />
  if (profile.error) {
    return (
      <main className="mx-auto max-w-md p-4">
        <ErrorText error={errorMessage(profile.error)} />
      </main>
    )
  }
  if (!profile.data.household_id || !profile.data.disclaimer_ack_at) {
    return <Navigate to="/onboarding" replace />
  }

  return <Shell profileId={profile.data.id} householdId={profile.data.household_id} />
}

function Shell({ profileId, householdId }: { profileId: string; householdId: string }) {
  const members = useMembers(householdId).data
  return (
    <PersonFilterProvider defaultPerson={profileId} validIds={members?.map((m) => m.id)}>
      <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <OfflineBanner />
        <main className="mx-auto max-w-md px-4 pt-6 pb-8">
          <Outlet />
        </main>
        <TabBar />
      </div>
    </PersonFilterProvider>
  )
}

const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/log', label: 'Log', icon: PlusIcon, end: false },
  { to: '/people', label: 'People', icon: PeopleIcon, end: false },
  { to: '/settings', label: 'Settings', icon: GearIcon, end: false },
]

function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </svg>
  )
}
function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}
