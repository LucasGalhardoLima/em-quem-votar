import { Badge } from "~/components/ui/badge";
import { ExternalLink, Banknote, Vote, Landmark } from "lucide-react";

interface SpendingGroup {
  type: string;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  source: string;
  sourceUrl: string | null;
}

interface SpendingSummaryProps {
  spending: SpendingGroup[];
  hasLegislativeRecord: boolean;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Banknote; description: string }
> = {
  CEAP: {
    label: "Cota Parlamentar (CEAP)",
    icon: Landmark,
    description: "Gastos com exercício da atividade parlamentar",
  },
  CAMPAIGN: {
    label: "Gastos de Campanha",
    icon: Vote,
    description: "Despesas declaradas ao TSE",
  },
  DECLARED_ASSETS: {
    label: "Bens Declarados",
    icon: Banknote,
    description: "Patrimônio declarado ao TSE",
  },
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

function formatPeriod(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  });
  return `${fmt.format(s)} — ${fmt.format(e)}`;
}

export function SpendingSummary({
  spending,
  hasLegislativeRecord,
}: SpendingSummaryProps) {
  if (spending.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <Banknote className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {hasLegislativeRecord
            ? "Dados de gastos ainda não disponíveis para este candidato."
            : "Sem dados de gastos públicos anteriores."}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {hasLegislativeRecord
            ? "Os dados serão adicionados conforme disponibilizados."
            : "Este candidato não exerceu cargo público com dados de gastos registrados."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {spending.map((group) => {
        const config = TYPE_CONFIG[group.type] ?? {
          label: group.type,
          icon: Banknote,
          description: "",
        };
        const Icon = config.icon;

        return (
          <div key={group.type} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 mt-0.5 p-2 rounded-md bg-muted">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-foreground">
                    {config.label}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {config.description}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {formatBRL(group.totalAmount)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground">
                {formatPeriod(group.periodStart, group.periodEnd)}
              </span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {group.source}
              </Badge>
              {group.sourceUrl && (
                <a
                  href={group.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-brand-primary hover:underline inline-flex items-center gap-0.5 ml-auto"
                >
                  Fonte <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
