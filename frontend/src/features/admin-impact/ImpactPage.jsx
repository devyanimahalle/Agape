import { useState, useEffect } from 'react';
import { fetchImpact } from './api';
import StatCard from './components/StatCard';
import MonthChart from './components/MonthChart';

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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading impact data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">
            Failed to load impact data
          </p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!impact) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">No impact data available.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
          🌍 SharePlate Impact
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">
          Making a difference, one meal at a time
        </p>
        <div className="mt-4 inline-block bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          <p className="text-sm text-amber-700 font-medium">
            ⚠️ All figures are estimates based on 0.4 kg per meal
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        <StatCard
          title="Meals Redistributed"
          value={impact.meals_redistributed}
          icon="🍽️"
          color="green"
          subtitle="Estimated total meals shared"
        />
        <StatCard
          title="Kilograms Saved"
          value={`${impact.kg_saved.toLocaleString()} kg`}
          icon="⚖️"
          color="blue"
          subtitle="Food diverted from waste"
        />
        <StatCard
          title="Listings Completed"
          value={impact.listings_completed}
          icon="✅"
          color="purple"
          subtitle="Successfully fulfilled listings"
        />
        <StatCard
          title="Active NGOs"
          value={impact.active_ngos}
          icon="🏢"
          color="teal"
          subtitle="NGOs collecting food"
        />
        <StatCard
          title="Active Providers"
          value={impact.active_providers}
          icon="🏪"
          color="orange"
          subtitle="Restaurants & businesses donating"
        />
      </div>

      {/* Monthly Chart */}
      <MonthChart data={impact.by_month} />
    </div>
  );
}
