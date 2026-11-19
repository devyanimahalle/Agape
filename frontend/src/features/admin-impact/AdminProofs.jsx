import { useState, useEffect, useCallback } from 'react';
import { Button, EmptyState, LoadingState } from '../../components/ui';
import { fetchProofs, reviewProof } from './api';
import Page from './components/Page';
import ProofCard from './components/ProofCard';
import Toast from './components/Toast';

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
      showToast(`Proof #${proofId} ${decision} successfully.`, decision === 'approved' ? 'success' : 'info');
      await loadProofs(activeFilter);
    } catch (err) {
      showToast(`Failed to review proof: ${err.message}`, 'error');
    }
  };

  return (
    <Page title="Proof review" subtitle="Review pickup proofs submitted by NGOs.">
      <Toast toast={toast} />

      <div role="group" aria-label="Filter by review status" className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={activeFilter === f.value ? 'brand' : 'dark'}
            aria-pressed={activeFilter === f.value}
            onClick={() => setActiveFilter(f.value)}
            className="!px-4 !py-2"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading && <LoadingState label="Loading proofs…" />}

      {!loading && error && (
        <EmptyState
          title="Failed to load proofs"
          action={<Button variant="dark" onClick={() => loadProofs(activeFilter)}>Try again</Button>}
        >
          {error}
        </EmptyState>
      )}

      {!loading && !error && proofs.length === 0 && (
        <EmptyState title="No proofs found">
          {activeFilter ? `No ${activeFilter} proofs at the moment.` : 'No proofs have been submitted yet.'}
        </EmptyState>
      )}

      {!loading && !error && proofs.length > 0 && (
        <div className="grid gap-3">
          {proofs.map((proof) => (
            <ProofCard key={proof.id} proof={proof} onReview={handleReview} />
          ))}
        </div>
      )}
    </Page>
  );
}
