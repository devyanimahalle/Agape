// Demo-mode store for proofs of donation, shared by the NGO screens (which add proofs) and the admin screens (which
// review and open them), so a proof uploaded as an NGO is the proof an admin sees. Dev/demo use only.
const iso = (s) => new Date(s).toISOString()

let proofs = [
  { id: 1, listing_id: 10, ngo_id: 3, document_id: 5, note: 'Handed 20 kg of rice to a shelter; signed sheet attached', review_status: 'pending', created_at: iso('2024-03-15T10:00:00Z'), listing: { id: 10, title: '20kg Basmati Rice', food_type: 'Grains', quantity: 20, unit: 'kg', provider_org_name: 'Fresh Kitchen' }, ngo: { id: 3, org_name: 'Feed the Hungry' } },
  { id: 2, listing_id: 11, ngo_id: 3, document_id: 6, note: 'Meals served at the community kitchen', review_status: 'pending', created_at: iso('2024-03-16T14:00:00Z'), listing: { id: 11, title: '50 Meal Portions', food_type: 'Cooked Food', quantity: 50, unit: 'portions', provider_org_name: 'Fresh Kitchen' }, ngo: { id: 3, org_name: 'Feed the Hungry' } },
  { id: 3, listing_id: 12, ngo_id: 4, document_id: 7, note: 'Distribution receipt', review_status: 'approved', created_at: iso('2024-03-10T09:00:00Z'), listing: { id: 12, title: '10kg Vegetables', food_type: 'Vegetables', quantity: 10, unit: 'kg', provider_org_name: 'City Caterers' }, ngo: { id: 4, org_name: 'Hope Foundation' } },
]
const files = new Map() // document_id -> File, so the admin can open what the NGO uploaded
let nextProof = 100
let nextDoc = 500

export const listMockProofs = (review) => structuredClone(review ? proofs.filter((p) => p.review_status === review) : proofs)

export function addMockProof({ listing, providerOrg, ngoId, ngoOrg, note, file }) {
  const documentId = nextDoc++
  files.set(documentId, file)
  const proof = {
    id: nextProof++, listing_id: listing.id, ngo_id: ngoId, document_id: documentId, note: note || null,
    review_status: 'pending', created_at: new Date().toISOString(),
    listing: { id: listing.id, title: listing.title, food_type: listing.food_type, quantity: listing.quantity, unit: listing.unit, provider_org_name: providerOrg },
    ngo: { id: ngoId, org_name: ngoOrg },
  }
  proofs = [proof, ...proofs]
  return proof
}

export function reviewMockProof(id, decision) {
  const proof = proofs.find((p) => p.id === id)
  if (!proof) return null
  proof.review_status = decision
  return structuredClone(proof)
}

// { status: none | pending | approved | rejected, count } for one listing, like the backend's proof_status.
export function mockProofSummary(listingId) {
  const rows = proofs.filter((p) => p.listing_id === listingId)
  if (rows.length === 0) return { status: 'none', count: 0 }
  const reviews = rows.map((p) => p.review_status)
  return { status: reviews.includes('approved') ? 'approved' : reviews.includes('pending') ? 'pending' : 'rejected', count: rows.length }
}

// An account was deleted: proofs it uploaded, and proofs on its listings, go with it.
export function removeMockProofsFor(accountId, listingIdsOwned = []) {
  proofs = proofs.filter((x) => x.ngo_id !== accountId && !listingIdsOwned.includes(x.listing_id))
}

export function clearMockProofs() {
  proofs = []
  files.clear()
}

export const getMockFile = (documentId) => files.get(documentId) ?? null
