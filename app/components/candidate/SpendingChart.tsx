interface CategoryBreakdown {
  category: string;
  amount: number;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const TYPE_LABELS: Record<string, string> = {
  CEAP: "Cota parlamentar por categoria",
  CAMPAIGN: "Gastos de campanha por categoria",
  DECLARED_ASSETS: "Bens declarados por categoria",
};

/**
 * Barras horizontais proporcionais. Uma cor só — a comparação relevante é
 * entre categorias do mesmo candidato, e cores distintas sugeririam uma
 * hierarquia de importância que o dado não tem.
 */
export function SpendingChart({
  categories,
  label,
}: {
  categories: CategoryBreakdown[];
  label?: string;
}) {
  if (categories.length === 0) return null;

  const max = Math.max(...categories.map((c) => c.amount));
  const heading = label ? (TYPE_LABELS[label] ?? label) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {heading && (
        <h3 className="mb-3 text-[11px] font-bold tracking-[0.06em] text-slate-500 uppercase">
          {heading}
        </h3>
      )}
      <div className="space-y-2.5">
        {categories.map((item) => (
          <div key={item.category}>
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="truncate text-slate-600">{item.category}</span>
              <span className="flex-none font-semibold text-slate-800">
                {BRL.format(item.amount)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{ width: `${max > 0 ? (item.amount / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
