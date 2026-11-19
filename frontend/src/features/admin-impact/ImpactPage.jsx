import { useState, useEffect } from 'react';
import { EmptyState, LoadingState } from '../../components/ui';
import { fetchImpact } from './api';
import Page from './components/Page';
import StatCard from './components/StatCard';
import MonthChart from './components/MonthChart';

const TITLE = 'Impact';
const NOTE = 'All figures are estimates, based on 0.4 kg per meal. They are not measured outcomes.';

export default function ImpactPage() {
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchImpact()
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Meals redistributed (est.)" value={impact.meals_redistributed} subtitle="Estimated total meals shared" highlight />
        <StatCard title="Kilograms saved (est.)" value={`${impact.kg_saved.toLocaleString()} kg`} subtitle="Food diverted from waste" />
        <StatCard title="Listings completed" value={impact.listings_completed} subtitle="Collected by an NGO" />
        <StatCard title="Active NGOs" value={impact.active_ngos} subtitle="NGOs collecting food" />
        <StatCard title="Active donors" value={impact.active_providers} subtitle="Restaurants and businesses donating" />
      </div>

      <div className="mt-3">
        <MonthChart data={impact.by_month} />
      </div>
    </Page>
  );
}
