// App shell: Layout + ErrorBoundary + role-gated routes. Feature pages come from src/features/*.
import { Routes, Route, Link } from 'react-router-dom'
import { NgoBoardPage, NgoReservationsPage } from './features/ngo-reservations'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'

function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-5xl">Agape</h1>
      <p className="mt-2 text-muted">Food rescue, connected.</p>
      <Link
        to="/ngo"
        className="mt-6 inline-block rounded-card border border-line bg-primary px-5 py-2 font-bold uppercase tracking-[1px]"
      >
        NGO food board
      </Link>
    </main>
  )
}

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
          <Route path="/" element={<Home />} />
          <Route path="/ngo" element={ngoOnly(<NgoBoardPage />)} />
          <Route path="/ngo/reservations" element={ngoOnly(<NgoReservationsPage />)} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
