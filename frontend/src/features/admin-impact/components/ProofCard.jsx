import { useState } from 'react';
import { Button, Card, StatusPill } from '../../../components/ui';
import DocumentModal from '../../../components/DocumentModal';
import StarRating from './StarRating';
import { fetchDocumentUrl } from '../api';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Backend review statuses -> shared StatusPill keys.
const PILL = { approved: 'verified', rejected: 'rejected', pending: 'pending' };

function Field({ label, children }) {
  return (
    <div className="rounded-[6px] bg-canvas px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold">{children}</dd>
    </div>
  );
}

export default function ProofCard({ proof, onReview }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewing, setViewing] = useState(false);

  const isPending = proof.review_status === 'pending';

  const handleReview = async (decision) => {
    if (decision === 'approved' && stars === 0) return; // a rating is required for approval
    setSubmitting(true);
    try {
      await onReview(proof.id, decision, stars, comment);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card as="article" className="p-7 md:p-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[1px] text-muted">
          Proof of donation #{proof.id} · {formatDate(proof.created_at)}
        </p>
        <StatusPill status={PILL[proof.review_status] ?? 'pending'} />
      </div>

      <h2 className="mt-3 text-3xl md:text-4xl">{proof.listing.title}</h2>

      <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Food type">{proof.listing.food_type}</Field>
        <Field label="Quantity">{proof.listing.quantity} {proof.listing.unit}</Field>
        <Field label="Donor">{proof.listing.provider_org_name}</Field>
        <Field label="NGO">{proof.ngo.org_name}</Field>
      </dl>

      <div className="mt-2 rounded-[6px] bg-canvas px-4 py-3">
        <p className="text-xs text-muted">Distribution note</p>
        <p className="mt-0.5">{proof.note || 'No note added.'}</p>
      </div>

      <div className="mt-4">
        <Button variant="dark" onClick={() => setViewing(true)}>View proof of donation</Button>
      </div>
      <DocumentModal
        docId={viewing ? proof.document_id : null}
        fetchUrl={fetchDocumentUrl}
        title="Proof of donation"
        frameTitle="Proof of donation file"
        filename={`proof-of-donation-${proof.id}`}
        onClose={() => setViewing(false)}
      />

      {isPending && (
        <div className="mt-6 border-t border-line pt-6">
          <h3 className="text-2xl">Review this proof of donation</h3>

          <div className="mt-4">
            <p className="text-xs font-semibold">Rating (required for approval)</p>
            <div className="mt-1.5"><StarRating value={stars} onChange={setStars} /></div>
          </div>

          <label className="mt-4 block text-xs font-semibold">
            Comment (optional)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Add a review comment"
              className="mt-1.5 w-full resize-none rounded-[6px] bg-canvas px-4 py-3 text-sm font-normal focus:bg-panel"
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="brand" onClick={() => handleReview('approved')} disabled={submitting || stars === 0}>
              {submitting ? 'Submitting…' : 'Approve'}
            </Button>
            <Button variant="dark" onClick={() => handleReview('rejected')} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Reject'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
