import { Link } from 'react-router-dom'
import { Badge, Card } from '../components/ui'

const btn = 'press rounded-[6px] px-6 py-3 text-sm font-bold uppercase tracking-[1px]'

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
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-12 md:px-10 md:pb-24 md:pt-20">
          <h1 className="agape-rise -ml-1 font-display text-[clamp(5.5rem,31vw,21rem)] uppercase leading-[0.8] tracking-[-0.01em] md:-ml-3">AGAPE</h1>
          <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-[1fr_1.1fr] md:items-end md:gap-16">
            <p
              className="agape-rise self-start justify-self-start rounded-[6px] bg-ink px-4 py-2 text-xl font-bold text-canvas md:text-2xl"
              style={{ '--d': '150ms' }}
            >
              Every MEAL Matters
            </p>
            <div className="agape-rise" style={{ '--d': '300ms' }}>
              <p className="max-w-xl text-lg leading-relaxed">
                Surplus food, collected in time. Agape connects food donors with admin-verified NGOs so good food gets collected before its window ends.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/ngo" className={`${btn} bg-ink text-canvas hover:bg-toast`}>Find food near you</Link>
                <Link to="/login" className={`${btn} bg-canvas text-ink hover:bg-panel`}>Sign in</Link>
                <a href="#how" className={`${btn} underline underline-offset-4`}>How it works</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-4 px-5 py-20 md:px-10 md:py-32">
        <div className="grid gap-10 md:grid-cols-[1fr_1.6fr] md:gap-16">
          <h2 className="reveal text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.92] md:sticky md:top-8 md:self-start">How it works</h2>
          <ol className="grid gap-3">
            {STEPS.map(([n, title, text]) => (
              <li key={n} className="reveal">
                <Card className="p-7 md:p-9">
                  <h3 className="text-2xl md:text-3xl">{title}</h3>
                  <p className="mt-3 max-w-lg leading-relaxed text-muted">{text}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="trust" className="on-ink bg-ink text-canvas">
        <div className="mx-auto max-w-6xl px-5 py-20 md:px-10 md:py-32">
          <h2 id="trust" className="reveal max-w-3xl text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.92]">What we check, and what we don&apos;t claim</h2>
          <dl className="mt-12 grid gap-x-16 gap-y-10 md:mt-16 md:grid-cols-2">
            {TRUST.map(([t, d]) => (
              <div key={t} className="reveal">
                <dt className="text-xl font-bold text-brand-bright md:text-2xl">{t}</dt>
                <dd className="mt-2 max-w-md leading-relaxed text-on-ink">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="roles" className="mx-auto max-w-6xl px-5 py-20 md:px-10 md:py-32">
        <h2 id="roles" className="reveal text-[clamp(2.75rem,6vw,4.75rem)] leading-[0.92]">Who it is for</h2>
        <div className="mt-10 grid gap-3 md:mt-14 md:grid-cols-[1.35fr_1fr_1fr]">
          {ROLES.map((r) => (
            <Card key={r.key} as="article" className={`reveal flex flex-col p-7 md:p-9 ${r.to ? '!bg-brand-bright' : ''}`}>
              <h3 className="text-4xl md:text-5xl">{r.name}</h3>
              <p className={`mt-4 leading-relaxed ${r.to ? 'text-ink' : 'text-muted'}`}>{r.blurb}</p>
              <div className="mt-auto pt-8">
                {r.to ? (
                  <Link to={r.to} className={`${btn} inline-block bg-ink text-canvas hover:bg-toast`}>{r.cta}</Link>
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
