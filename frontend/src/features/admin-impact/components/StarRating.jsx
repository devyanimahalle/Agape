import { useState } from 'react';

// Rating stars as real buttons: ink on an orange chip when filled, muted on cream when empty. The number is also printed.
export default function StarRating({ value = 0, onChange, readonly = false, max = 5 }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div className="inline-flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const filled = n <= shown;
        const cls = `h-9 w-9 rounded-[6px] text-lg leading-none ${filled ? 'bg-brand-bright text-ink' : 'bg-canvas text-muted'}`;
        const label = `${n} star${n > 1 ? 's' : ''}`;
        return readonly ? (
          <span key={n} role="img" aria-label={label} className={`${cls} inline-flex items-center justify-center`}>
            {filled ? '★' : '☆'}
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-label={label}
            aria-pressed={n === value}
            className={`press ${cls}`}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
          >
            {filled ? '★' : '☆'}
          </button>
        );
      })}
      {value > 0 && <span className="ml-2 text-sm text-muted">({value})</span>}
    </div>
  );
}
