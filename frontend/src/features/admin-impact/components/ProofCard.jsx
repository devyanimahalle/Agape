import { useState } from 'react';
import StarRating from './StarRating';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProofCard({ proof, onReview }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isPending = proof.review_status === 'pending';

  const handleReview = async (decision) => {
    if (decision === 'approved' && stars === 0) {
      return; // require a rating for approval
    }
    setSubmitting(true);
    try {
      await onReview(proof.id, decision, stars, comment);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">
            Proof #{proof.id}
          </span>
          <span className="text-gray-300">•</span>
          <span className="text-sm text-gray-400">
            {formatDate(proof.created_at)}
          </span>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
            STATUS_STYLES[proof.review_status] || STATUS_STYLES.pending
          }`}
        >
          {proof.review_status}
        </span>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Listing Info */}
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          {proof.listing.title}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Food Type
            </p>
            <p className="text-sm font-medium text-gray-700">
              {proof.listing.food_type}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Quantity
            </p>
            <p className="text-sm font-medium text-gray-700">
              {proof.listing.quantity} {proof.listing.unit}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Provider
            </p>
            <p className="text-sm font-medium text-gray-700">
              {proof.listing.provider_org_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              NGO
            </p>
            <p className="text-sm font-medium text-gray-700">
              {proof.ngo.org_name}
            </p>
          </div>
        </div>

        {/* Note */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
            Note
          </p>
          <p className="text-sm text-gray-700">{proof.note}</p>
        </div>

        {/* Review Section */}
        {isPending && (
          <div className="border-t border-gray-100 pt-4 mt-2">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Review this proof
            </p>

            {/* Star Rating */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">
                Rating (required for approval)
              </label>
              <StarRating value={stars} onChange={setStars} />
            </div>

            {/* Comment */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add a review comment..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => handleReview('approved')}
                disabled={submitting || stars === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                {submitting ? 'Submitting...' : '✓ Approve'}
              </button>
              <button
                onClick={() => handleReview('rejected')}
                disabled={submitting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
              >
                {submitting ? 'Submitting...' : '✗ Reject'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
