import { EmptyState, LoadingState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import useLiveData from '../../lib/useLiveData';
import { fetchImpact, fetchMyImpact } from './api';
import Page from './components/Page';
import StatCard from './components/StatCard';
import MonthChart from './components/MonthChart';
import StatusBreakdown from './components/StatusBreakdown';
import { CategoryBreakdown, MyImpact, RecentPickups } from './components/ImpactSections';

const TITLE = 'Impact';
const NOTE = 'All meal and kilogram figures are estimates, based on 0.4 kg per meal. They are not measured outcomes.';
const n = (v) => Number(v).toLocaleString();

// Public figures from the records (collected pickups, listings, verified accounts), plus the signed-in account's own
// history. Both re-read when the page opens and when the tab regains focus, so they match what the signed-in screens show.
export default function ImpactPage() {
  const { user } = useAuth();
  const role = user?.role ?? null;
  const { data: impact, loading, error } = useLiveData(fetchImpact, []);
  const { data: mine } = useLiveData(() => (role ? fetchMyImpact(role) : null), [role]);

  if (loading) {
    return <Page title={TITLE} subtitle={NOTE}><LoadingState label="Loading impact data…" /></Page>;
  }
  if (error) {
    return (
      <Page title={TITLE} subtitle={NOTE}>
        <EmptyState title="Failed to load impact data">{error}</EmptyState>
      </Page>
    );
  }
  if (!impact) {
    return <Page title={TITLE} subtitle={NOTE}><EmptyState title="No impact data available" /></Page>;
  }

  return (
    <Page title={TITLE} subtitle={NOTE}>
      {role && mine && mine.role === role && (
        <div className="mb-3"><MyImpact mine={mine} /></div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Meals redistributed (est.)" value={impact.meals_redistributed} subtitle="Estimated meals in collected pickups" highlight />
        <StatCard title="Kilograms saved (est.)" value={`${Number(impact.kg_saved).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`} subtitle="Estimated food diverted from waste" />
        <StatCard title="Pickups collected" value={impact.listings_completed} subtitle="Confirmed by an NGO" />
        <StatCard
          title="Meals with approved proof (est.)"
          value={impact.meals_confirmed}
          subtitle={`${n(impact.listings_confirmed)} of ${n(impact.listings_completed)} pickups have an admin-approved proof of donation`}
        />
        <StatCard title="Verified donors" value={impact.verified_donors} subtitle={`${n(impact.active_providers)} have had food collected`} />
        <StatCard title="Verified NGOs" value={impact.verified_ngos} subtitle={`${n(impact.active_ngos)} have collected food`} />
      </div>

      <div className="mt-3">
        <MonthChart data={impact.by_month} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <StatusBreakdown byStatus={impact.by_status} ariaLabel="All listings by status" title="All listings" className="lg:col-span-2" />
        <CategoryBreakdown data={impact.by_category} />
        <RecentPickups
          items={impact.recent}
          note={role ? undefined : 'Organisation names are shown to signed-in users only.'}
          label="Recent collected pickups"
        />
      </div>
    </Page>
  );
}
