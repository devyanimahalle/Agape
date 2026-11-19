import PageHeader from './PageHeader'

// The one page frame: orange title band, then content on cream. Every routed screen, including the
// sign-in, not-available, not-found and error screens, uses it so no heading floats on bare canvas.
export default function Page({ title, subtitle, width = 'max-w-6xl', className = '', children }) {
  return (
    <main>
      <PageHeader title={title}>{subtitle}</PageHeader>
      <div className={`mx-auto ${width} px-5 py-12 md:px-10 md:py-20 ${className}`}>{children}</div>
    </main>
  )
}
