import { PageHeader } from '@/components/ui'
import { Link } from 'react-router'

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
