import { ExternalLink } from "lucide-react";

interface SpendingGroup {
  type: string;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  source: string;
  sourceUrl: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; description: string }> = {
  CEAP: {
    label: "Cota parlamentar (CEAP)",
    description: "Gastos com o exercício da atividade parlamentar",
  },
  CAMPAIGN: {
    label: "Gastos de campanha",
    description: "Despesas declaradas ao TSE durante a campanha",
  },
  DECLARED_ASSETS: {
    label: "Bens declarados",
    description: "Patrimônio declarado ao TSE no registro da candidatura",
  },
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatPeriod(start: string, end: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : new Intl.DateTimeFormat("pt-BR", {
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(d);
  };
  return start === end ? fmt(start) : `${fmt(start)} — ${fmt(end)}`;
}

/**
 * Valores declarados, sem adjetivo. A plataforma não classifica gasto em
 * "alto" ou "baixo": exibe o número, o período e a fonte, e deixa a leitura
 * para quem lê.
 */
export function SpendingSummary({
  spending,
  hasLegislativeRecord,
}: {
  spending: SpendingGroup[];
  hasLegislativeRecord: boolean;
}) {
  if (spending.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {spending.map((group) => {
        const config = TYPE_CONFIG[group.type] ?? {
          label: group.type,
          description: "Valor declarado",
        };
        return (
          <div
            key={group.type}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h3 className="text-[11px] font-bold tracking-[0.06em] text-slate-500 uppercase">
              {config.label}
            </h3>
            <p className="font-heading mt-2 text-[26px] font-bold text-slate-800">
              {BRL.format(group.totalAmount)}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
              {config.description}
            </p>
            <p className="mt-2 text-[11.5px] text-slate-400">
              Período: {formatPeriod(group.periodStart, group.periodEnd)}
            </p>
            {group.sourceUrl ? (
              <a
                href={group.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-indigo-600 hover:underline"
              >
                Fonte: {group.source}
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <p className="mt-1.5 text-[11.5px] text-slate-400">
                Fonte: {group.source}
              </p>
            )}
          </div>
        );
      })}
      {!hasLegislativeRecord && spending.some((s) => s.type === "CEAP") && (
        <p className="text-[12px] text-slate-400 sm:col-span-2 lg:col-span-3">
          A cota parlamentar se refere a mandato anterior — este candidato não
          exerce mandato legislativo no momento.
        </p>
      )}
    </div>
  );
}
