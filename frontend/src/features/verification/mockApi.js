// Demo-mode verification API. It reads and writes the shared demo store (lib/mockAdmin.js), so a donor or NGO that
// submits here shows up in the admin queue and in the overview's pending counts, and an admin decision there changes
// what the donor or NGO sees here. Dev/demo use only.
import { decideMockRequest, latestMockRequest, listMockRequests, submitMockRequest } from '../../lib/mockAdmin'

const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120))
const err = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail })

const DONOR = { userId: 'mock-provider', email: 'demo-donor@agape.demo', name: 'Demo Donor' }
const NGO = { userId: 'mock-ngo', email: 'demo-ngo@agape.demo', name: 'Demo NGO' }

// ── Provider ──────────────────────────────────────────────────────────────────
export function getProviderVerification() {
  const r = latestMockRequest(DONOR.userId, 'provider')
  if (!r) return wait({ status: 'not_submitted', rejection_reason: null })
  return wait({
    status: r.status, rejection_reason: r.rejection_reason, entity_name: r.entity_name,
    masked_pan: r.pan_masked, masked_aadhaar: r.aadhaar_masked, fssai_number: r.fssai_number,
  })
}

export function submitProviderVerification({ entity_name, pan, aadhaar, fssai_number }) {
  if (!pan || !aadhaar || !fssai_number) return Promise.reject(err(422, 'VALIDATION_ERROR', 'PAN, Aadhaar and FSSAI number are required'))
  const { error } = submitMockRequest({
    ...DONOR, type: 'provider', org_name: entity_name, entity_name,
    pan_masked: 'XXXXX' + pan.slice(-5), aadhaar_masked: 'XXXX-XXXX-' + aadhaar.slice(-4), fssai_number,
  })
  if (error) return Promise.reject(err(error.status, error.code, error.detail))
  return getProviderVerification()
}

// ── NGO ───────────────────────────────────────────────────────────────────────
export function getNgoVerification() {
  const r = latestMockRequest(NGO.userId, 'ngo')
  if (!r) return wait({ status: 'not_submitted', rejection_reason: null, org_name: 'Demo Helping Hands Trust', reg_number: null })
  return wait({ status: r.status, rejection_reason: r.rejection_reason, org_name: r.org_name, reg_number: r.reg_number })
}

export function submitNgoOnboarding({ reg_number }) {
  if (!reg_number) return Promise.reject(err(422, 'VALIDATION_ERROR', 'Registration number is required'))
  const { error } = submitMockRequest({ ...NGO, type: 'ngo', org_name: 'Demo Helping Hands Trust', reg_number })
  if (error) return Promise.reject(err(error.status, error.code, error.detail))
  return getNgoVerification()
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const listVerifications = ({ status, type } = {}) => wait(listMockRequests({ status, type }))

export function decideVerification(id, { decision, rejection_reason }) {
  const { error, request } = decideMockRequest(id, decision === 'approve' ? 'approved' : 'rejected', rejection_reason)
  if (error) return Promise.reject(err(error.status, error.code, error.detail))
  return wait(request)
}
