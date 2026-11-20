export default function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-card bg-panel p-8 text-center">
      <h3 className="text-2xl md:text-3xl">{title}</h3>
      {children && <p className="mt-2 text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
