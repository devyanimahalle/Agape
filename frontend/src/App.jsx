// App shell: Layout + ErrorBoundary + role-gated routes. Feature pages come from src/features/*.
import { Routes, Route, Link } from 'react-router-dom'
import { NgoBoardPage, NgoReservationsPage } from './features/ngo-reservations'
import { AdminDashboard, AdminProofs, AdminUsers, ImpactPage } from './features/admin-impact'
import { ProviderListingsPage } from './features/provider-listings'
import { ProviderVerificationPage, NgoOnboardingPage, AdminVerificationsPage } from './features/verification'
import Layout from './components/Layout'
import Page from './components/Page'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import VerificationGate from './components/VerificationGate'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import RoleSelectPage from './pages/RoleSelectPage'
import PublicOnly from './components/PublicOnly'
import CursorDot from './components/CursorDot'
import AccountPage from './pages/AccountPage'

function NotFound() {
  return (
    <Page title="Not found" subtitle="That page does not exist." width="max-w-3xl">
      <Link to="/" className="press inline-block rounded-[6px] bg-ink px-6 py-3 text-sm font-bold uppercase tracking-[1px] text-canvas hover:bg-toast">Back home</Link>
    </Page>
  )
}

const adminOnly = (el) => <ProtectedRoute roles={['admin']}>{el}</ProtectedRoute>
const ngoOnly = (el) => <ProtectedRoute roles={['ngo']}>{el}</ProtectedRoute>
const verifiedNgo = (el) => ngoOnly(<VerificationGate role="ngo">{el}</VerificationGate>)

export default function App() {
  return (
    <ErrorBoundary>
      <CursorDot />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<PublicOnly><HomePage /></PublicOnly>} />
          <Route path="/select-role" element={<PublicOnly><RoleSelectPage /></PublicOnly>} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/provider" element={<ProtectedRoute roles={['provider']}><ProviderVerificationPage /></ProtectedRoute>} />
          <Route path="/provider/listings" element={<ProtectedRoute roles={['provider']}><VerificationGate role="provider"><ProviderListingsPage /></VerificationGate></ProtectedRoute>} />
          <Route path="/admin" element={adminOnly(<AdminDashboard />)} />
          <Route path="/admin/proofs" element={adminOnly(<AdminProofs />)} />
          <Route path="/admin/users" element={adminOnly(<AdminUsers />)} />
          <Route path="/admin/verifications" element={adminOnly(<AdminVerificationsPage />)} />
          <Route path="/impact" element={<ImpactPage />} />
          <Route path="/ngo" element={verifiedNgo(<NgoBoardPage />)} />
          <Route path="/ngo/reservations" element={verifiedNgo(<NgoReservationsPage />)} />
          <Route path="/ngo/onboarding" element={ngoOnly(<NgoOnboardingPage />)} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
