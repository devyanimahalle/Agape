import { api, USE_MOCKS as USE_MOCK } from '../../lib/api';
import { deleteMockUser, listMockUsers, mockPending, mockTotalUsers, resetMockAccounts, setMockUserActive } from '../../lib/mockAdmin';
import { listings } from '../../lib/mockListings';
import { mockImpact, mockMyImpact } from '../../lib/mockImpact';
import { listMockProofs, reviewMockProof } from '../../lib/mockProofs';

// Private documents (here: proof of donation files) open from a blob URL, see lib/documents.js.
export { fetchDocumentUrl } from '../../lib/documents';

// --- Mock Data ---
// Demo mode: listing counts come from the shared listings store, like the backend counts its listings table.
const countByStatus = () => Object.fromEntries(['listed', 'reserved', 'completed', 'cancelled', 'expired'].map((s) => [s, listings.filter((l) => l.status === s).length]));

export async function fetchStats() {
  if (USE_MOCK) return { total_users: mockTotalUsers(), ...mockPending(), listings_by_status: countByStatus() };
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
  if (USE_MOCK) return mockImpact();
  return api('/impact');
}

// The signed-in donor's, NGO's or admin's own history (the same records as the public figures).
export async function fetchMyImpact(role) {
  if (USE_MOCK) return mockMyImpact(role);
  return api('/impact/mine');
}
