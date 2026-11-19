const VARIANT = {
  primary: 'bg-primary text-ink hover:brightness-95', // yellow is a surface behind dark text, never text itself
  dark: 'bg-ink text-panel hover:bg-toast',
  ghost: 'bg-transparent text-ink hover:underline',
}

export default function Button({ variant = 'dark', type = 'button', className = '', ...props }) {
  return (
    <button
      type={type}
      className={`rounded-card border border-line px-5 py-2 text-sm font-bold uppercase tracking-[1px] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant] ?? VARIANT.dark} ${className}`}
      {...props}
    />
  )
}
