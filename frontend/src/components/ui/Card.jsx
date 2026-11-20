// Surfaces separate by tone (white on cream), not by outline.
export default function Card({ as: Tag = 'div', className = '', ...props }) {
  return <Tag className={`rounded-card bg-panel p-6 ${className}`} {...props} />
}
