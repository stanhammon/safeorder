import { Card, Disclaimer, PageHeader } from '@/components/ui'
import { useHouseholdContext, useHousehold } from '@/lib/queries'
import { Link } from 'react-router'

export function HomePage() {
  const { profile, householdId } = useHouseholdContext()
  const household = useHousehold(householdId)

  return (
    <>
      <PageHeader title={`Hi, ${profile.display_name}`} subtitle={household.data?.name} />
      <Card className="space-y-2">
        <h2 className="font-semibold">Restaurants are coming next</h2>
        <p className="text-muted">
          Searching restaurants, saving your safe orders and logging meals arrive in the next milestone.
          For now, set up your household and allergy profiles.
        </p>
        <div className="flex gap-4 pt-1 text-sm">
          <Link to="/people" className="text-accent">
            Allergy profiles →
          </Link>
          <Link to="/settings" className="text-accent">
            Invite household →
          </Link>
        </div>
      </Card>
      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </>
  )
}

export function LogPage() {
  return (
    <>
      <PageHeader title="Log a meal" />
      <Card>
        <p className="text-muted">Meal logging arrives with restaurants and dishes in the next milestone.</p>
      </Card>
    </>
  )
}

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <PageHeader title="Page not found" />
      <Link to="/" className="text-accent">
        Go home
      </Link>
    </main>
  )
}
