export default function LoadingState({ label = 'Loading…' }) {
  return (
    <p role="status" className="p-8 text-center text-muted">
      {label}
    </p>
  )
}
