import { Card } from '../../../components/ui';

function Bar({ label, value, pct, cls }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-muted">{label}</span>
      <div className="h-4 flex-1 rounded-[3px] bg-canvas">
        <div className={`h-full rounded-[3px] ${cls}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-sm font-semibold">{value.toLocaleString()}</span>
    </div>
  );
}

const formatMonth = (monthStr) => {
  const [year, month] = monthStr.split('-');
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
};

// Paired bars per month: ink = estimated meals, orange = kg. Values are printed beside each bar (not colour-only).
export default function MonthChart({ data = [] }) {
  if (!data.length) {
    return <p className="text-muted">No monthly data available.</p>;
  }

  const maxMeals = Math.max(...data.map((d) => d.meals), 1);
  const maxKg = Math.max(...data.map((d) => d.kg), 1);

  return (
    <Card as="section" aria-label="Monthly impact trend" className="p-7 md:p-9">
      <h2 className="text-3xl md:text-4xl">Monthly trend</h2>
      <p className="mt-2 text-xs text-muted">Estimates, based on 0.4 kg per meal.</p>

      <div className="mt-5 flex flex-wrap gap-5 text-xs font-semibold uppercase tracking-[1px]">
        <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-[3px] bg-ink" />Estimated meals</span>
        <span className="flex items-center gap-2"><span className="h-3 w-5 rounded-[3px] bg-brand-bright" />Kilograms</span>
      </div>

      <div className="mt-6 space-y-6">
        {data.map((item) => (
          <div key={item.month}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[1px]">{formatMonth(item.month)}</p>
            <div className="space-y-1.5">
              <Bar label="Meals (est.)" value={item.meals} pct={(item.meals / maxMeals) * 100} cls="bg-ink" />
              <Bar label="Kg" value={item.kg} pct={(item.kg / maxKg) * 100} cls="bg-brand-bright" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
