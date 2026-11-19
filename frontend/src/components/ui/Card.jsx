// Surfaces separate by tone (white on cream), not by outline.
export default function Card({ as: Tag = 'div', className = '', ...props }) {
  // An <article> stands for one item (a listing, a request, a role) and lifts slightly on hover.
  return <Tag className={`rounded-card bg-panel p-6 ${Tag === 'article' ? 'card-lift' : ''} ${className}`} {...props} />
}
