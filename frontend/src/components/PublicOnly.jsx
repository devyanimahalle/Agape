import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homeForRole } from '../lib/routes'
import { LoadingState } from './ui'

// Public pages (the landing page, role selector) are for signed-out visitors only. Signed-in users are sent to the
// home of their role; they can reach these pages again only after signing out.
export default function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <main><LoadingState label="Checking your session…" /></main>
  if (user) return <Navigate to={homeForRole(user.role)} replace />
  return children
}
