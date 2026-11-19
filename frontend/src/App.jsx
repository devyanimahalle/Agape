// App shell. Feature pages are routed here.
import { Routes, Route, Link } from 'react-router-dom'
import { NgoBoardPage, NgoReservationsPage } from './features/ngo-reservations'

function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-5xl">Agape</h1>
      <p className="mt-2 text-muted">Food rescue, connected.</p>
      <Link to="/ngo" className="mt-6 inline-block underline">NGO board</Link>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ngo" element={<NgoBoardPage />} />
      <Route path="/ngo/reservations" element={<NgoReservationsPage />} />
    </Routes>
  )
}
