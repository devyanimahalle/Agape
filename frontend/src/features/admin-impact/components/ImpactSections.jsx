import { Badge, Card } from '../../../components/ui';

const CATEGORY_LABEL = { restaurant: 'Restaurants', caterer: 'Caterers', general: 'Home kitchens and others', other: 'Other donors' };
const KIND_LABEL = { restaurant: 'Restaurant', caterer: 'Caterer', general: 'Home kitchen', other: 'Donor' };
const PROOF = {
  none: { tone: 'neutral', label: 'No proof of donation yet' },
  pending: { tone: 'warn', label: 'Proof of donation awaiting review' },
  approved: { tone: 'ok', label: 'Proof of donation approved' },
  rejected: { tone: 'bad', label: 'Proof of donation not approved' },
};

// Label, whether the figure is an estimate, for each summary field the API returns per role.
const SUMMARY = {
  provider: [
    ['listings_total', 'Listings posted'], ['listings_open', 'Open now'], ['pickups_completed', 'Pickups collected'],
    ['meals_donated', 'Meals donated', true], ['kg_donated', 'Kilograms donated', true],
    ['proofs_approved', 'Proofs of donation approved'], ['proofs_awaiting', 'Proofs awaiting review'],
  ],
  ngo: [
    ['reservations_open', 'Reserved, to collect'], ['pickups_completed', 'Pickups collected'],
    ['meals_collected', 'Meals collected', true], ['kg_collected', 'Kilograms collected', true],
    ['proofs_needed', 'Proof of donation needed'], ['proofs_awaiting', 'Proofs awaiting review'], ['proofs_approved', 'Proofs of donation approved'],
  ],
  admin: [
    ['users_total', 'Accounts'], ['verified_donors', 'Verified donors'], ['verified_ngos', 'Verified NGOs'],
    ['verifications_open', 'Open verification requests'], ['proofs_awaiting_review', 'Proofs awaiting review'], ['pickups_completed', 'Pickups collected'],
  ],
};
const ROLE_TITLE = { provider: 'Your impact as a donor', ngo: 'Your impact as an NGO', admin: 'The platform at a glance' };

const fmtNumber = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

function Tile({ label, children }) {
  return (
    <div className="rounded-[6px] bg-canvas px-4 py-3">
      <dt className="text-xs uppercase tracking-[1px] text-muted">{label}</dt>
      <dd className="mt-1 font-display text-3xl leading-none">{children}</dd>
    </div>
  );
}

// Recent collected pickups. Public lists carry no organisation names; signed-in lists name the donor and the NGO.
export function RecentPickups({ items, title = 'Recent collected pickups', empty = 'No pickups have been collected yet.', note, label }) {
  return (
    <Card as="section" aria-label={label ?? title} className="p-7 md:p-9">
      <h2 className="text-3xl md:text-4xl">{title}</h2>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
      {items.length === 0 ? (
        <p className="mt-5 text-muted">{empty}</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {items.map((r) => {
            const proof = PROOF[r.proof_status] ?? PROOF.none;
            const who = r.donor || r.ngo ? [r.donor && `from ${r.donor}`, r.ngo && `collected by ${r.ngo}`].filter(Boolean).join(' · ') : KIND_LABEL[r.donor_category] ?? 'Donor';
            return (
              <li key={r.id} className="rounded-[6px] bg-canvas px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-xs text-muted">{fmtDate(r.completed_at)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {fmtNumber(r.quantity)} {r.unit} · ≈ {fmtNumber(r.est_meals)} meals <span className="text-xs">(estimate)</span> · {who}
                </p>
                <p className="mt-2"><Badge tone={proof.tone}>{proof.label}</Badge></p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// Collected food split by what kind of donor it came from.
export function CategoryBreakdown({ data }) {
  const totalMeals = data.reduce((n, c) => n + c.meals, 0);
  return (
    <Card as="section" aria-label="Collected food by donor type" className="p-7 md:p-9">
      <h2 className="text-3xl md:text-4xl">By donor type</h2>
      <p className="mt-2 text-xs text-muted">Collected pickups only. Meals are estimates.</p>
      {data.length === 0 ? (
        <p className="mt-5 text-muted">Nothing has been collected yet.</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {data.map((c) => (
            <li key={c.category} className="rounded-[6px] bg-canvas px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                <span className="font-display text-2xl">{fmtNumber(c.meals)}</span>
              </div>
              <div className="mt-2 h-3 w-full rounded-[3px] bg-panel">
                <div className="h-full rounded-[3px] bg-brand-bright" style={{ width: `${Math.max(totalMeals ? (c.meals / totalMeals) * 100 : 0, 2)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {c.listings} {c.listings === 1 ? 'pickup' : 'pickups'} · ≈ {fmtNumber(c.meals)} meals (estimate) · ≈ {fmtNumber(c.kg)} kg (estimate)
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// The signed-in account's own figures and history, from the same records as the public numbers.
export function MyImpact({ mine }) {
  const rows = SUMMARY[mine.role] ?? [];
  return (
    <section aria-label="Your impact" className="space-y-3">
      <Card className="p-7 md:p-9">
        <h2 className="text-3xl md:text-4xl">{ROLE_TITLE[mine.role] ?? 'Your impact'}</h2>
        <p className="mt-2 text-xs text-muted">Taken from your own listings, pickups and proofs. Meals and kilograms are estimates.</p>
        <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map(([key, label, estimate]) => (
            <Tile key={key} label={estimate ? `${label} (est.)` : label}>{fmtNumber(mine.summary[key] ?? 0)}</Tile>
          ))}
        </dl>
      </Card>
      <RecentPickups
        items={mine.recent}
        title={mine.role === 'admin' ? 'Latest collected pickups' : 'Your recent pickups'}
        label="Your recent pickups"
        empty={mine.role === 'admin' ? 'No pickups have been collected yet.' : 'You have no collected pickups yet. They appear here as soon as a pickup is confirmed.'}
      />
    </section>
  );
}

