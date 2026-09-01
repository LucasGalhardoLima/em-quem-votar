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
  hasLegislativeLink,
}: {
  spending: SpendingGroup[];
  /**
   * Existe, no NOSSO banco, a linha `CandidateLegislativeLink` que amarra esta
   * candidatura a um id da Câmara ou do Senado. É um fato sobre a nossa
   * importação, não sobre a vida da pessoa — hoje há 1 vínculo para 211
   * candidaturas.
   */
  hasLegislativeLink: boolean;
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
            <h3 className="text-sm font-bold tracking-wider text-slate-600 uppercase">
              {config.label}
            </h3>
            {/* `tabular-nums` porque estes cards ficam lado a lado num grid:
                sem largura fixa de dígito, "R$ 1.118,00" e "R$ 44.907,31"
                desalinham as colunas vizinhas. Mesma escolha de
                `DeclaredAssets`, que também mostra valor em reais. */}
            <p className="font-heading mt-2 text-3xl font-bold text-slate-800 tabular-nums">
              {BRL.format(group.totalAmount)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {config.description}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Período: {formatPeriod(group.periodStart, group.periodEnd)}
            </p>
            {group.sourceUrl ? (
              <a
                href={group.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                /* Ver `ElectionHistory`/`SourceCite`: alvo de 44px por
                   pseudo-elemento e o anel de foco padrao. */
                className="focus-ring relative mt-1.5 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-indigo-600 hover:underline before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-['']"
              >
                Fonte: {group.source}
                <ExternalLink className="size-3" aria-hidden="true" />
                {/* Ver `SourceCite`: o ícone de nova aba só comunica a quem
                    enxerga.

                    O rótulo do grupo entra no nome acessível porque estes
                    cartões vêm em série e dois grupos podem citar a MESMA
                    fonte: quem tabula ouviria "Fonte: TSE — DivulgaCandContas"
                    duas vezes, para dois destinos diferentes. Visualmente o
                    cartão já desambigua; para quem navega por lista de links,
                    não. */}
                <span className="sr-only">
                  {" "}
                  de {config.label} (abre em nova aba)
                </span>
              </a>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">
                Fonte: {group.source}
              </p>
            )}
          </div>
        );
      })}
      {/*
        Esta nota já afirmava "este candidato não exerce mandato legislativo no
        momento", derivando isso de `hasLegislativeRecord` — que é só
        `candidate.legislativeLink !== null`, uma linha que falta no NOSSO
        banco (1 vínculo para 211 candidaturas). É a mesma classe de erro da
        aba de votações, corrigida no mesmo dia: a ausência era de importação,
        não de mandato, e o texto virava afirmação falsa sobre uma pessoa real.

        O que sustentamos é apenas isto: a cota apareceu, e não sabemos a que
        mandato ligá-la porque o vínculo legislativo não foi importado.
      */}
      {!hasLegislativeLink && spending.some((s) => s.type === "CEAP") && (
        <p className="text-xs leading-relaxed text-slate-500 sm:col-span-2 lg:col-span-3">
          A cota parlamentar (CEAP) só é paga a quem exerce mandato na Câmara ou
          no Senado, mas esta candidatura ainda não tem o vínculo com a casa
          legislativa importado para o nosso registro — por isso a plataforma
          não afirma aqui a qual mandato, ou a qual período de mandato, estes
          gastos correspondem.
        </p>
      )}
    </div>
  );
}
