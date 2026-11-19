import { api, USE_MOCKS as USE_MOCK } from '../../lib/api';
import { deleteMockUser, listMockUsers, mockPending, mockTotalUsers, resetMockAccounts, setMockUserActive } from '../../lib/mockAdmin';
import { listMockProofs, reviewMockProof } from '../../lib/mockProofs';

// Private documents (here: proof of donation files) open from a blob URL, see lib/documents.js.
export { fetchDocumentUrl } from '../../lib/documents';

// --- Mock Data ---
// Listing figures for the demo overview (accounts and pending counts come from the shared demo store).
const MOCK_LISTINGS_BY_STATUS = { listed: 3, reserved: 2, completed: 5, cancelled: 1, expired: 1 };

const MOCK_IMPACT = {
  meals_redistributed: 1250,
  kg_saved: 500.0,
  listings_completed: 15,
  active_ngos: 3,
  active_providers: 4,
  by_month: [
    { month: '2024-01', meals: 200, kg: 80.0 },
    { month: '2024-02', meals: 350, kg: 140.0 },
    { month: '2024-03', meals: 700, kg: 280.0 },
  ]
};

export async function fetchStats() {
  if (USE_MOCK) return { total_users: mockTotalUsers(), ...mockPending(), listings_by_status: { ...MOCK_LISTINGS_BY_STATUS } };
  return api('/admin/stats');
}

export async function fetchUsers() {
  if (USE_MOCK) return listMockUsers();
  return api('/admin/users');
}

export async function patchUser(userId, data) {
  if (USE_MOCK) return setMockUserActive(userId, data.is_active);
  return api(`/admin/users/${userId}`, { method: 'PATCH', json: data });
}

export async function deleteUser(userId) {
  if (USE_MOCK) return deleteMockUser(userId);
  return api(`/admin/users/${userId}`, { method: 'DELETE' });
}

export async function resetAccounts() {
  if (USE_MOCK) return resetMockAccounts();
  return api('/admin/users/reset', { method: 'POST' });
}

export async function fetchProofs(reviewStatus) {
  if (USE_MOCK) return listMockProofs(reviewStatus); // includes proofs of donation uploaded as an NGO in this demo
  return api('/admin/proofs', { params: { review: reviewStatus } });
}

export async function reviewProof(proofId, data) {
  if (USE_MOCK) return reviewMockProof(proofId, data.decision);
  return api(`/admin/proofs/${proofId}/review`, { method: 'POST', json: data });
}

export async function fetchImpact() {
  if (USE_MOCK) return MOCK_IMPACT;
  return api('/impact');
}
