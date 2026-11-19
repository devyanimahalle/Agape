// App shell: Layout + ErrorBoundary + role-gated routes. Feature pages come from src/features/*.
import { Routes, Route, Link } from 'react-router-dom'
import { NgoBoardPage, NgoReservationsPage } from './features/ngo-reservations'
import { AdminDashboard, AdminProofs, AdminUsers, ImpactPage } from './features/admin-impact'
import { ProviderVerificationPage, NgoOnboardingPage, AdminVerificationsPage } from './features/verification'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import AccountPage from './pages/AccountPage'

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-5xl">Not found</h1>
      <Link to="/" className="mt-4 inline-block underline">Back home</Link>
    </main>
  )
}

const adminOnly = (el) => <ProtectedRoute roles={['admin']}>{el}</ProtectedRoute>
const ngoOnly = (el) => <ProtectedRoute roles={['ngo']}>{el}</ProtectedRoute>

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="/provider" element={<ProtectedRoute roles={['provider']}><ProviderVerificationPage /></ProtectedRoute>} />
          <Route path="/admin" element={adminOnly(<AdminDashboard />)} />
          <Route path="/admin/proofs" element={adminOnly(<AdminProofs />)} />
          <Route path="/admin/users" element={adminOnly(<AdminUsers />)} />
          <Route path="/admin/verifications" element={adminOnly(<AdminVerificationsPage />)} />
          <Route path="/impact" element={<ImpactPage />} />
          <Route path="/ngo" element={ngoOnly(<NgoBoardPage />)} />
          <Route path="/ngo/reservations" element={ngoOnly(<NgoReservationsPage />)} />
          <Route path="/ngo/onboarding" element={ngoOnly(<NgoOnboardingPage />)} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
