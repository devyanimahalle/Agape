export default function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-panel p-8 text-center">
      <h3 className="text-2xl">{title}</h3>
      {children && <p className="mt-2 text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
