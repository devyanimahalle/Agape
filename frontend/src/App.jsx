// App shell: Layout + ErrorBoundary + role-gated routes. Feature pages come from src/features/*.
import { Routes, Route, Link } from 'react-router-dom'
import { NgoBoardPage, NgoReservationsPage } from './features/ngo-reservations'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './pages/HomePage'

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-5xl">Not found</h1>
      <Link to="/" className="mt-4 inline-block underline">Back home</Link>
    </main>
  )
}

const ngoOnly = (el) => <ProtectedRoute roles={['ngo']}>{el}</ProtectedRoute>

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/ngo" element={ngoOnly(<NgoBoardPage />)} />
          <Route path="/ngo/reservations" element={ngoOnly(<NgoReservationsPage />)} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
