import { Card, StatusPill } from '../../../components/ui';

// Listing statuses in display order. Bars use ink/orange/tone steps; every segment is also labelled in the legend.
const STATUS_ORDER = ['listed', 'reserved', 'completed', 'cancelled', 'expired'];
const SEGMENT = {
  listed: 'bg-brand-bright',
  reserved: 'bg-brand-deep',
  completed: 'bg-ink',
  cancelled: 'bg-line',
  expired: 'bg-sage',
};

// All listings by status: a proportional bar plus a labelled legend with the counts. Shared by the admin overview
// and the Impact page, which read the same listing records.
export default function StatusBreakdown({ byStatus, ariaLabel = 'Listings by status', title = 'Listings by status', className = '' }) {
  const totalListings = Object.values(byStatus).reduce((sum, v) => sum + v, 0);
  const statuses = [...STATUS_ORDER.filter((s) => s in byStatus), ...Object.keys(byStatus).filter((s) => !STATUS_ORDER.includes(s))];

  return (
    <Card as="section" aria-label={ariaLabel} className={`p-7 md:p-9 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-3xl md:text-4xl">{title}</h2>
        <span className="text-xs uppercase tracking-[1px] text-muted">Total {totalListings}</span>
      </div>

      <div className="mt-6 flex h-6 w-full overflow-hidden rounded-[3px] bg-canvas">
        {statuses.map((status) => {
          const count = byStatus[status];
          const pct = totalListings > 0 ? (count / totalListings) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={status}
              className={`${SEGMENT[status] || 'bg-line'} h-full`}
              style={{ width: `${pct}%` }}
              title={`${status}: ${count}`}
            />
          );
        })}
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {statuses.map((status) => (
          <li key={status} className="flex items-center justify-between gap-3 rounded-[6px] bg-canvas px-4 py-3">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className={`h-3 w-3 rounded-[3px] ${SEGMENT[status] || 'bg-line'}`} />
              <StatusPill status={status} />
            </span>
            <span className="font-display text-2xl">{byStatus[status]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
