import { useState, useEffect } from 'react';
import { Card, EmptyState, LoadingState, StatusPill } from '../../components/ui';
import { fetchStats } from './api';
import Page from './components/Page';
import StatCard from './components/StatCard';

// Listing statuses in display order. Bars use ink/orange/tone steps; every segment is also labelled in the legend.
const STATUS_ORDER = ['listed', 'reserved', 'completed', 'cancelled', 'expired'];
const SEGMENT = {
  listed: 'bg-brand-bright',
  reserved: 'bg-brand-deep',
  completed: 'bg-ink',
  cancelled: 'bg-line',
  expired: 'bg-sage',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // The overview is read fresh every time the page opens, and again when the tab regains focus or becomes visible, so
  // decisions made on the verification queue (or in another tab) show up without a manual reload.
  useEffect(() => {
    let cancelled = false;
    const load = (initial) => {
      if (initial) {
        setLoading(true);
        setError(null);
      }
      fetchStats()
        .then((data) => {
          if (!cancelled) {
            setStats(data);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled && initial) setError(err.message);
        })
        .finally(() => {
          if (!cancelled && initial) setLoading(false);
        });
    };
    load(true);
    const refresh = () => { if (document.visibilityState !== 'hidden') load(false); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const subtitle = 'Overview of platform activity and pending actions.';

  if (loading) {
    return <Page title="Admin" subtitle={subtitle}><LoadingState label="Loading dashboard…" /></Page>;
  }
  if (error) {
    return (
      <Page title="Admin" subtitle={subtitle}>
        <EmptyState title="Failed to load dashboard">{error}</EmptyState>
      </Page>
    );
  }
  if (!stats) {
    return <Page title="Admin" subtitle={subtitle}><EmptyState title="No data available" /></Page>;
  }

  const byStatus = stats.listings_by_status;
  const totalListings = Object.values(byStatus).reduce((sum, v) => sum + v, 0);
  const statuses = [...STATUS_ORDER.filter((s) => s in byStatus), ...Object.keys(byStatus).filter((s) => !STATUS_ORDER.includes(s))];

  return (
    <Page title="Admin" subtitle={subtitle}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total users" value={stats.total_users} subtitle="All registered users" />
        <StatCard title="Pending NGOs" value={stats.ngos_pending} subtitle="Awaiting admin review" highlight />
        <StatCard title="Pending donors" value={stats.providers_pending} subtitle="Awaiting admin review" highlight />
        <StatCard title="Completed listings" value={byStatus.completed || 0} subtitle="Collected by an NGO" />
      </div>

      <Card as="section" aria-label="Listings by status" className="mt-3 p-7 md:p-9">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-3xl md:text-4xl">Listings by status</h2>
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
    </Page>
  );
}
