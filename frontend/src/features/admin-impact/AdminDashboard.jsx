import { useState, useEffect } from 'react';
import { EmptyState, LoadingState } from '../../components/ui';
import { fetchStats } from './api';
import Page from './components/Page';
import StatCard from './components/StatCard';
import StatusBreakdown from './components/StatusBreakdown';

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
  return (
    <Page title="Admin" subtitle={subtitle}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total users" value={stats.total_users} subtitle="All registered users" />
        <StatCard title="Pending NGOs" value={stats.ngos_pending} subtitle="Awaiting admin review" highlight />
        <StatCard title="Pending donors" value={stats.providers_pending} subtitle="Awaiting admin review" highlight />
        <StatCard title="Completed listings" value={byStatus.completed || 0} subtitle="Collected by an NGO" />
      </div>

      <StatusBreakdown byStatus={byStatus} className="mt-3" />
    </Page>
  );
}
