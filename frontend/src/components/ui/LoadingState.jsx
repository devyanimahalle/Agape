export default function LoadingState({ label = 'Loading…' }) {
  return (
    <p role="status" className="rounded-card bg-panel p-8 text-center text-muted">
      {label}
    </p>
  )
}
