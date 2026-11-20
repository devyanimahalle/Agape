import { useState, useEffect } from 'react';
import { fetchStats } from './api';
import StatCard from './components/StatCard';

const STATUS_COLORS = {
  listed: 'bg-blue-500',
  reserved: 'bg-yellow-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
  expired: 'bg-gray-400',
};

const STATUS_LABELS = {
  listed: 'Listed',
  reserved: 'Reserved',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStats()
      .then((data) => {
        if (!cancelled) setStats(data);
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
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-2">
            Failed to load dashboard
          </p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">No data available.</p>
      </div>
    );
  }

  const totalListings = Object.values(stats.listings_by_status).reduce(
    (sum, v) => sum + v,
    0
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Overview of platform activity and pending actions
        </p>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard
          title="Total Users"
          value={stats.total_users}
          icon="👥"
          color="blue"
          subtitle="All registered users"
        />
        <StatCard
          title="Pending NGOs"
          value={stats.ngos_pending}
          icon="🏢"
          color="yellow"
          subtitle="Awaiting verification"
        />
        <StatCard
          title="Pending Providers"
          value={stats.providers_pending}
          icon="🏪"
          color="yellow"
          subtitle="Awaiting verification"
        />
        <StatCard
          title="Completed Listings"
          value={stats.listings_by_status.completed || 0}
          icon="✅"
          color="green"
          subtitle="Successfully redistributed"
        />
      </div>

      {/* Listings by Status */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">
            Listings by Status
          </h2>
          <span className="text-sm text-gray-400">
            Total: {totalListings}
          </span>
        </div>

        {/* Stacked horizontal bar */}
        <div className="w-full h-8 rounded-full overflow-hidden flex bg-gray-100 mb-4">
          {Object.entries(stats.listings_by_status).map(([status, count]) => {
            const pct = totalListings > 0 ? (count / totalListings) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={status}
                className={`${STATUS_COLORS[status] || 'bg-gray-300'} h-full transition-all duration-500 flex items-center justify-center`}
                style={{ width: `${pct}%` }}
                title={`${STATUS_LABELS[status] || status}: ${count}`}
              >
                {pct > 10 && (
                  <span className="text-xs text-white font-semibold">
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {Object.entries(stats.listings_by_status).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${STATUS_COLORS[status] || 'bg-gray-300'}`}
              />
              <span className="text-sm text-gray-600">
                {STATUS_LABELS[status] || status}:{' '}
                <span className="font-semibold">{count}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
