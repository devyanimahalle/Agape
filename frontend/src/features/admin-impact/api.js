import { api, USE_MOCKS as USE_MOCK } from '../../lib/api';
import { listMockProofs, reviewMockProof } from '../../lib/mockProofs';

// Private documents (here: proof of donation files) open from a blob URL, see lib/documents.js.
export { fetchDocumentUrl } from '../../lib/documents';

// --- Mock Data ---
const MOCK_STATS = {
  total_users: 7,
  ngos_pending: 1,
  providers_pending: 1,
  listings_by_status: { listed: 3, reserved: 2, completed: 5, cancelled: 1, expired: 1 }
};

const MOCK_USERS = [
  { id: 1, email: 'admin@shareplate.demo', role: 'admin', name: 'Admin User', phone: '9999999999', is_active: true, created_at: '2024-01-01T00:00:00Z', profile: null },
  { id: 2, email: 'restaurant@shareplate.demo', role: 'provider', name: 'Fresh Kitchen', phone: '9999999998', is_active: true, created_at: '2024-01-02T00:00:00Z', profile: { org_name: 'Fresh Kitchen', category: 'restaurant', verification_status: 'approved', rating_avg: 4.5, rating_count: 2 } },
  { id: 3, email: 'ngo1@shareplate.demo', role: 'ngo', name: 'Feed the Hungry', phone: '9999999997', is_active: true, created_at: '2024-01-03T00:00:00Z', profile: { org_name: 'Feed the Hungry', status: 'approved', rating_avg: 4.0, rating_count: 1 } },
  { id: 4, email: 'ngo3@shareplate.demo', role: 'ngo', name: 'New NGO', phone: '9999999996', is_active: true, created_at: '2024-02-01T00:00:00Z', profile: { org_name: 'New NGO', status: 'pending', rating_avg: null, rating_count: 0 } },
];

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
  if (USE_MOCK) return MOCK_STATS;
  return api('/admin/stats');
}

export async function fetchUsers() {
  if (USE_MOCK) return MOCK_USERS;
  return api('/admin/users');
}

export async function patchUser(userId, data) {
  if (USE_MOCK) return { ...MOCK_USERS.find(u => u.id === userId), ...data };
  return api(`/admin/users/${userId}`, { method: 'PATCH', json: data });
}

export async function deleteUser(userId) {
  if (USE_MOCK) return { deleted: 1 };
  return api(`/admin/users/${userId}`, { method: 'DELETE' });
}

export async function resetAccounts() {
  if (USE_MOCK) return { deleted: MOCK_USERS.filter((u) => u.role !== 'admin').length };
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
