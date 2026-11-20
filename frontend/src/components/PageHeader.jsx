// Orange title band used by every routed screen (via components/Page). Dark ink on orange only.
// `compact` is the short variant for screens that must fit above the fold (the role selector): a smaller title,
// tighter padding and no minimum height.
export default function PageHeader({ title, compact = false, children }) {
  return (
    <header className={`bg-brand-bright text-ink ${compact ? '' : 'md:min-h-[21rem]'}`}>
      <div className={`mx-auto max-w-6xl px-5 md:px-10 ${compact ? 'pb-5 pt-7 md:pb-6 md:pt-8' : 'pb-10 pt-12 md:pb-14 md:pt-20'}`}>
        <h1 className={`agape-rise leading-[0.88] ${compact ? 'text-[clamp(2.5rem,5vw,3.5rem)]' : 'text-[clamp(3.5rem,11vw,8rem)]'}`}>{title}</h1>
        {children && (
          <div className={`agape-rise max-w-2xl ${compact ? 'mt-2 text-sm md:text-base' : 'mt-5 text-base md:text-lg'}`} style={{ '--d': '120ms' }}>{children}</div>
        )}
      </div>
    </header>
  )
}
