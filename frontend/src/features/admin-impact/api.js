import { api, USE_MOCKS as USE_MOCK } from '../../lib/api';

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

const MOCK_PROOFS = [
  { id: 1, listing_id: 10, ngo_id: 3, document_id: 5, note: 'Picked up 20kg rice', review_status: 'pending', created_at: '2024-03-15T10:00:00Z', listing: { id: 10, title: '20kg Basmati Rice', food_type: 'Grains', quantity: 20, unit: 'kg', provider_org_name: 'Fresh Kitchen' }, ngo: { id: 3, org_name: 'Feed the Hungry' } },
  { id: 2, listing_id: 11, ngo_id: 3, document_id: 6, note: 'Collected meals for shelter', review_status: 'pending', created_at: '2024-03-16T14:00:00Z', listing: { id: 11, title: '50 Meal Portions', food_type: 'Cooked Food', quantity: 50, unit: 'portions', provider_org_name: 'Fresh Kitchen' }, ngo: { id: 3, org_name: 'Feed the Hungry' } },
  { id: 3, listing_id: 12, ngo_id: 4, document_id: 7, note: 'Proof of pickup', review_status: 'approved', created_at: '2024-03-10T09:00:00Z', listing: { id: 12, title: '10kg Vegetables', food_type: 'Vegetables', quantity: 10, unit: 'kg', provider_org_name: 'City Caterers' }, ngo: { id: 4, org_name: 'Hope Foundation' } },
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

export async function fetchProofs(reviewStatus) {
  if (USE_MOCK) {
    if (reviewStatus) return MOCK_PROOFS.filter(p => p.review_status === reviewStatus);
    return MOCK_PROOFS;
  }
  return api('/admin/proofs', { params: { review: reviewStatus } });
}

export async function reviewProof(proofId, data) {
  if (USE_MOCK) return { ...MOCK_PROOFS.find(p => p.id === proofId), review_status: data.decision };
  return api(`/admin/proofs/${proofId}/review`, { method: 'POST', json: data });
}

export async function fetchImpact() {
  if (USE_MOCK) return MOCK_IMPACT;
  return api('/impact');
}
