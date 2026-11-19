export default function Card({ as: Tag = 'div', className = '', ...props }) {
  return <Tag className={`rounded-card border border-line bg-panel p-5 ${className}`} {...props} />
}
