// Orange title band shared by role-landing and account screens. Dark ink on orange only.
export default function PageHeader({ title, children }) {
  return (
    <header className="bg-brand-bright text-ink">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-12 md:px-10 md:pb-14 md:pt-20">
        <h1 className="agape-rise text-[clamp(3.5rem,11vw,8rem)] leading-[0.88]">{title}</h1>
        {children && (
          <div className="agape-rise mt-5 max-w-2xl text-base md:text-lg" style={{ '--d': '120ms' }}>{children}</div>
        )}
      </div>
    </header>
  )
}
