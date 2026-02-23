import { cn } from "~/lib/utils";

interface CategoryBreakdown {
  category: string;
  amount: number;
}

interface SpendingChartProps {
  categories: CategoryBreakdown[];
  label?: string;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function SpendingChart({ categories, label }: SpendingChartProps) {
  if (categories.length === 0) return null;

  const maxAmount = Math.max(...categories.map((c) => c.amount));

  return (
    <div className="rounded-lg border bg-card p-4">
      {label && (
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {label}
        </h4>
      )}
      <div className="space-y-2.5">
        {categories.map((cat) => {
          const percentage = maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0;

          return (
            <div key={cat.category}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs text-foreground truncate">
                  {cat.category}
                </span>
                <span
                  className="text-xs text-muted-foreground tabular-nums shrink-0"
                  title={formatBRL(cat.amount)}
                >
                  {formatCompact(cat.amount)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full bg-foreground/25 transition-all duration-500"
                  )}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
