import { Link } from 'react-router-dom'
import { Badge, Card } from '../components/ui'

const COPY = {
  provider: {
    title: 'Donor home',
    planned: [
      'List surplus food with quantity and a collection window.',
      'See when a verified NGO has reserved it.',
      'Meal impact is shown as an estimate.',
    ],
  },
  admin: {
    title: 'Admin home',
    planned: [
      'Review NGO registrations before they can reserve food.',
      'Check FSSAI number format and review details manually (a format check plus admin review).',
      'Documents are stored privately.',
    ],
  },
}

// Landing screen for roles whose full workflow is not built in this frontend yet.
export default function RoleHomePage({ role }) {
  const c = COPY[role]
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-4xl">{c.title}</h1>
      <Card className="mt-6">
        <Badge tone="warn">In development</Badge>
        <p className="mt-3">You are signed in. This area is not ready yet. What is planned:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
          {c.planned.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <div className="mt-5 flex gap-4">
          <Link to="/account" className="underline">View account</Link>
          <Link to="/" className="underline">Back to home</Link>
        </div>
      </Card>
    </main>
  )
}
