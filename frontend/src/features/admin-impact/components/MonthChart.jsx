export default function MonthChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="text-center text-gray-400 py-8">
        No monthly data available.
      </div>
    );
  }

  const maxMeals = Math.max(...data.map((d) => d.meals), 1);
  const maxKg = Math.max(...data.map((d) => d.kg), 1);

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">
        Monthly Impact Trend
      </h3>
      <p className="text-xs text-amber-600 font-medium mb-6">
        ⚠️ Estimates (0.4 kg per meal)
      </p>

      <div className="flex items-center gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded bg-green-500" />
          <span className="text-gray-600">Meals</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 rounded bg-blue-500" />
          <span className="text-gray-600">Kilograms</span>
        </div>
      </div>

      <div className="space-y-5">
        {data.map((item) => (
          <div key={item.month}>
            <p className="text-sm font-medium text-gray-700 mb-2">
              {formatMonth(item.month)}
            </p>

            {/* Meals bar */}
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-xs text-gray-500 w-12 text-right">
                Meals
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="bg-green-500 h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                  style={{
                    width: `${Math.max((item.meals / maxMeals) * 100, 8)}%`,
                  }}
                >
                  <span className="text-xs text-white font-semibold">
                    {item.meals.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Kg bar */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-12 text-right">kg</span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                  style={{
                    width: `${Math.max((item.kg / maxKg) * 100, 8)}%`,
                  }}
                >
                  <span className="text-xs text-white font-semibold">
                    {item.kg.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
