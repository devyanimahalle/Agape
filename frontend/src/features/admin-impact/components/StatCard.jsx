import { Card } from '../../../components/ui';

// One figure: DM Mono label, Anton numeral, muted note. No icons, no colour coding.
export default function StatCard({ title, value, subtitle, highlight = false }) {
  return (
    <Card as="article" className={`flex flex-col p-7 ${highlight ? '!bg-brand-bright' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-[1px]">{title}</p>
      <p className="mt-3 font-display text-6xl leading-none md:text-7xl">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subtitle && <p className={`mt-3 text-xs ${highlight ? 'text-ink' : 'text-muted'}`}>{subtitle}</p>}
    </Card>
  );
}
