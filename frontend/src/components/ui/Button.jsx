const VARIANT = {
  primary: 'bg-primary text-ink hover:brightness-95', // yellow is a surface behind dark text, never text itself
  brand: 'bg-brand-bright text-ink hover:bg-brand', // dark text on orange; never white
  dark: 'bg-ink text-canvas hover:bg-toast',
  ghost: 'bg-transparent text-ink hover:underline',
}

export default function Button({ variant = 'dark', type = 'button', className = '', ...props }) {
  return (
    <button
      type={type}
      className={`press rounded-[6px] px-6 py-3 text-sm font-bold uppercase tracking-[1px] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${VARIANT[variant] ?? VARIANT.dark} ${className}`}
      {...props}
    />
  )
}
