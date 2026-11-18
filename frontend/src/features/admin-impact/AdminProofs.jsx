import { useState, useEffect, useCallback } from 'react';
import { fetchProofs, reviewProof } from './api';
import ProofCard from './components/ProofCard';

const FILTERS = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function AdminProofs() {
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [toast, setToast] = useState(null);

  const loadProofs = useCallback(async (filter) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProofs(filter);
      setProofs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProofs(activeFilter);
  }, [activeFilter, loadProofs]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleReview = async (proofId, decision, stars, comment) => {
    try {
      await reviewProof(proofId, {
        decision,
        stars: decision === 'approved' ? stars : null,
        comment: comment || null,
      });
      showToast(
        `Proof #${proofId} ${decision} successfully!`,
        decision === 'approved' ? 'success' : 'info'
      );
      await loadProofs(activeFilter);
    } catch (err) {
      showToast(`Failed to review proof: ${err.message}`, 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-green-600'
              : toast.type === 'error'
                ? 'bg-red-600'
                : 'bg-blue-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Proof Review</h1>
        <p className="text-gray-500 mt-1">
          Review pickup proofs submitted by NGOs
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setActiveFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === f.value
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading proofs...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-semibold mb-2">
            Failed to load proofs
          </p>
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => loadProofs(activeFilter)}
            className="mt-3 text-sm text-red-600 underline hover:text-red-800"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && proofs.length === 0 && (
        <div className="bg-gray-50 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 font-medium">No proofs found</p>
          <p className="text-sm text-gray-400 mt-1">
            {activeFilter
              ? `No ${activeFilter} proofs at the moment.`
              : 'No proofs have been submitted yet.'}
          </p>
        </div>
      )}

      {/* Proof Cards */}
      {!loading && !error && proofs.length > 0 && (
        <div className="space-y-5">
          {proofs.map((proof) => (
            <ProofCard key={proof.id} proof={proof} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  );
}
