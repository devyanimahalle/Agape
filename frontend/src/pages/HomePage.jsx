import { Link } from 'react-router-dom'
import { Card } from '../components/ui'

const btn = 'press rounded-[6px] px-6 py-3 text-sm font-bold uppercase tracking-[1px]'
// The two hero actions: the same large, solid size so both read clearly on the orange band.
const heroBtn = 'press inline-block whitespace-nowrap rounded-[6px] px-6 py-4 text-base font-bold uppercase tracking-[1px] sm:px-8'

const STAGES = [
  ['01', 'Listed', 'A verified donor posts surplus food with a collection window.'],
  ['02', 'Reserved', 'A verified NGO claims it before the window closes.'],
  ['03', 'Collected', 'The NGO confirms pickup with proof.'],
]

// Flat, token-only visual for the hero: the three stages of a pickup light up in turn while a window bar fills.
// Pure CSS motion (see .pickup-stage and .pickup-fill in styles/index.css), switched off by prefers-reduced-motion.
function PickupWindow() {
  return (
    <div
      role="img"
      aria-label="How a pickup works: a donor lists food, a verified NGO reserves it within the pickup window, then collects it."
      className="agape-rise rounded-card bg-ink p-5 text-canvas md:p-7"
      style={{ '--d': '200ms' }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[1px]">Pickup window</p>
        <span className="rounded-pill bg-brand-bright px-2.5 py-0.5 text-xs font-bold uppercase text-ink">Sample</span>
      </div>
      <ol className="mt-5 grid gap-2">
        {STAGES.map(([n, word, text], i) => (
          <li key={word} className="pickup-stage rounded-[6px] px-4 py-3" style={{ '--i': i }}>
            <div className="flex items-baseline gap-4">
              <span className="font-display text-xl">{n}</span>
              <span className="font-display text-3xl uppercase leading-none md:text-4xl">{word}</span>
            </div>
            <p className="mt-1.5 text-xs leading-snug">{text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-pill bg-toast">
          <div className="pickup-fill h-full w-full bg-brand-bright" />
        </div>
        <div className="mt-2 flex justify-between text-xs uppercase tracking-[1px]">
          <span>Window opens</span>
          <span>Window closes</span>
        </div>
      </div>
    </div>
  )
}

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
  { key: 'ngo', name: 'NGO', blurb: 'Browse nearby surplus food on a list or map, reserve it, then confirm pickup.' },
  { key: 'provider', name: 'Donor', blurb: 'Get verified as a restaurant, caterer or home kitchen so your surplus food can be listed.' },
  { key: 'admin', name: 'Admin', blurb: 'Review NGO registrations and FSSAI details before NGOs can reserve food.' },
]

export default function HomePage() {
  return (
    <main>
      <section className="bg-brand-bright text-ink">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:grid-cols-[1.15fr_1fr] md:gap-14 md:px-10 md:py-20">
          <div>
            <h1 className="agape-rise font-display text-[clamp(4.5rem,10vw,8rem)] uppercase leading-[0.85] tracking-[-0.01em]">AGAPE</h1>
            <p className="agape-rise mt-5 inline-block rounded-[6px] bg-ink px-3 py-1.5 text-base font-bold text-canvas md:text-lg" style={{ '--d': '100ms' }}>
              Every MEAL Matters
            </p>
            <p className="agape-rise mt-6 max-w-xl text-lg leading-relaxed" style={{ '--d': '220ms' }}>
              Verified restaurants, caterers, and home kitchens list extra meals. Verified NGOs claim and collect them within a live pickup window.
            </p>
            <div className="agape-rise mt-8 flex flex-nowrap gap-3" style={{ '--d': '340ms' }}>
              <Link to="/select-role" className={`${heroBtn} bg-ink text-canvas hover:bg-toast`}>Sign in</Link>
              <a href="#how" className={`${heroBtn} bg-canvas text-ink hover:bg-panel`}>How it works</a>
            </div>
          </div>

          <PickupWindow />
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
            <Card key={r.key} as="article" className={`reveal flex flex-col p-7 md:p-9 ${r.key === 'ngo' ? '!bg-brand-bright' : ''}`}>
              <h3 className="text-4xl md:text-5xl">{r.name}</h3>
              <p className={`mt-4 leading-relaxed ${r.key === 'ngo' ? 'text-ink' : 'text-muted'}`}>{r.blurb}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
