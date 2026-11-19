import PageHeader from './PageHeader'

// The one page frame: orange title band, then content on cream. Every routed screen, including the
// sign-in, not-available, not-found and error screens, uses it so no heading floats on bare canvas.
// `compact` shortens the band and the content padding for screens that should fit above the fold.
export default function Page({ title, subtitle, width = 'max-w-6xl', compact = false, className = '', children }) {
  return (
    <main>
      <PageHeader title={title} compact={compact}>{subtitle}</PageHeader>
      <div className={`mx-auto ${width} px-5 ${compact ? 'py-6 md:px-10 md:py-8' : 'py-12 md:px-10 md:py-20'} ${className}`}>{children}</div>
    </main>
  )
}
