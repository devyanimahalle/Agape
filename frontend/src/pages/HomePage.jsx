import { Link } from 'react-router-dom'
import { Badge, Card } from '../components/ui'

const STEPS = [
  ['1', 'Donors list surplus food', 'Restaurants, caterers and other donors post what is available, how much, and the collection window.'],
  ['2', 'Verified NGOs reserve', 'NGOs approved by an admin see nearby listings and reserve what they can collect in time.'],
  ['3', 'Pickup is confirmed', 'The NGO uploads proof of collection and can rate the donor. Meal impact is shown as an estimate.'],
]

const TRUST = [
  ['Admin-verified NGOs', 'An admin reviews every NGO before it can reserve food.'],
  ['FSSAI number check', 'FSSAI numbers get a format check plus admin review. This is not an official FSSAI verification.'],
  ['Documents stored privately', 'Uploaded documents are kept private and are not shown on public pages.'],
  ['Estimated meal impact', 'Meal figures are estimates based on quantity. They are not measured outcomes.'],
]

const ROLES = [
  { key: 'ngo', name: 'NGO', blurb: 'Browse nearby surplus food on a list or map, reserve it, then confirm pickup.', to: '/ngo', cta: 'Open food board' },
  { key: 'provider', name: 'Donor', blurb: 'List surplus food and see when an NGO has reserved it.', status: 'In development' },
  { key: 'admin', name: 'Admin', blurb: 'Review NGO registrations and FSSAI details before NGOs can reserve food.', status: 'In development' },
]

export default function HomePage() {
  return (
    <main>
      <section className="bg-brand-bright text-ink">
        <div className="mx-auto max-w-5xl px-8 py-16 md:py-24">
          <h1 className="agape-rise font-display text-[5.5rem] uppercase leading-[0.9] md:text-[11rem]">AGAPE</h1>
          <p
            className="agape-rise mt-6 inline-block rounded-card bg-ink px-4 py-2 text-xl font-bold text-canvas md:text-2xl"
            style={{ '--d': '150ms' }}
          >
            Agape : Every Meal Matters
          </p>
          <p className="agape-rise mt-6 max-w-2xl text-lg" style={{ '--d': '300ms' }}>
            Surplus food, collected in time. Agape connects food donors with admin-verified NGOs so good food gets collected before its window ends.
          </p>
          <div className="agape-rise mt-8 flex flex-wrap gap-3" style={{ '--d': '450ms' }}>
            <Link to="/ngo" className="rounded-card border border-ink bg-primary px-5 py-2 text-sm font-bold uppercase tracking-[1px] text-ink">
              Find food near you
            </Link>
            <Link to="/login" className="rounded-card border border-ink bg-ink px-5 py-2 text-sm font-bold uppercase tracking-[1px] text-canvas">
              Sign in
            </Link>
            <a href="#how" className="rounded-card border border-ink px-5 py-2 text-sm font-bold uppercase tracking-[1px] text-ink">
              How it works
            </a>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-8 py-12">
        <h2 className="text-3xl">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(([n, title, text]) => (
            <li key={n}>
              <Card className="h-full">
                <Badge tone="highlight">Step {n}</Badge>
                <h3 className="mt-3 text-xl">{title}</h3>
                <p className="mt-2 text-muted">{text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="trust" className="mx-auto max-w-5xl px-8 pb-12">
        <h2 id="trust" className="text-3xl">What we check, and what we don&apos;t claim</h2>
        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          {TRUST.map(([t, d]) => (
            <Card key={t}>
              <dt className="font-bold">{t}</dt>
              <dd className="mt-1 text-muted">{d}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <section aria-labelledby="roles" className="mx-auto max-w-5xl px-8 pb-16">
        <h2 id="roles" className="text-3xl">Who it is for</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <Card key={r.key} as="article">
              <h3 className="text-xl">{r.name}</h3>
              <p className="mt-2 text-muted">{r.blurb}</p>
              <div className="mt-4">
                {r.to ? (
                  <Link to={r.to} className="inline-block rounded-card border border-line bg-primary px-4 py-2 text-sm font-bold uppercase tracking-[1px] text-ink">
                    {r.cta}
                  </Link>
                ) : (
                  <Badge tone="warn">{r.status}</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
