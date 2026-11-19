import { Link } from 'react-router-dom'
import { Badge, Card } from '../components/ui'
import PageHeader from '../components/PageHeader'

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
    <main>
      <PageHeader title={c.title}>You are signed in. This area is not ready yet.</PageHeader>
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-20">
        <Card className="max-w-3xl p-7 md:p-10">
          <Badge tone="warn">In development</Badge>
          <p className="mt-5 text-lg">What is planned:</p>
          <ul className="mt-4 space-y-3 leading-relaxed text-muted">
            {c.planned.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/account" className="press rounded-[6px] bg-ink px-6 py-3 text-sm font-bold uppercase tracking-[1px] text-canvas hover:bg-toast">View account</Link>
            <Link to="/" className="press px-3 py-3 text-sm font-bold uppercase tracking-[1px] underline underline-offset-4">Back to home</Link>
          </div>
        </Card>
      </div>
    </main>
  )
}
