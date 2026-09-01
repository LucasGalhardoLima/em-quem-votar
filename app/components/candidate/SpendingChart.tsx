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
      {/* Mesmo degrau dos outros títulos de cartão da ficha: `text-sm` (os
          itens abaixo são `text-xs`, então o cabeçalho volta a ser maior que o
          que ele encabeça), `slate-600` (7,58:1 sobre o branco, contra os
          4,76:1 do `slate-500`, que passava o AA raspando) e `tracking-wider`,
          que é o degrau da escala — o `tracking-[0.06em]` arbitrário era largo
          demais para 14px. */}
      {heading && (
        <h3 className="mb-3 text-sm font-bold tracking-wider text-slate-600 uppercase">
          {heading}
        </h3>
      )}
      <div className="space-y-2.5">
        {categories.map((item) => (
          <div key={item.category}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              {/* CUIDADO ao mover este cartão: `truncate` traz
                  `white-space: nowrap`, e a categoria mais longa que o TSE
                  devolve ("Veículo automotor terrestre: caminhão, automóvel,
                  moto, etc.") mede 346px inquebráveis. Esse mínimo sobe pela
                  árvore e estoura qualquer faixa de grid dimensionada por
                  `auto`. Quem segura é o `minmax(0,1fr)` do painel de gastos,
                  em `candidato.$id.tsx` — não o `overflow: hidden` daqui, que
                  só zera o encolhimento do item flex. */}
              <span className="truncate text-slate-600">{item.category}</span>
              {/* Ver `SpendingSummary`: valores empilhados numa coluna. */}
              <span className="flex-none font-semibold text-slate-800 tabular-nums">
                {BRL.format(item.amount)}
              </span>
            </div>
            {/* Decorativa: a proporcao que a barra desenha ja esta escrita
                acima, em categoria + valor. Sem isto o leitor de tela anuncia
                uma caixa vazia por categoria. */}
            <div
              aria-hidden="true"
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
            >
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
