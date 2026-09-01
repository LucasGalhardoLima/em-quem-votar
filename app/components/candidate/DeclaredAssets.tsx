interface DeclaredAsset {
  id: string;
  amount: number;
  /** Tipo do bem na taxonomia do TSE ("Apartamento", "Terreno"). */
  category: string | null;
  /** Descrição literal escrita por quem declarou. Nunca reescrita. */
  description: string | null;
  /** `YYYY-MM-DD` da declaração ao TSE. */
  declaredAt: string;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string | null {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : DATE.format(date);
}

/**
 * Cada bem como o próprio candidato o declarou ao TSE — descrição literal,
 * tipo, valor e data. Sem adjetivo e sem ranking entre candidaturas: a
 * plataforma não diz se um patrimônio é "alto", só mostra o que foi declarado
 * e de onde veio.
 *
 * A descrição existe porque o tipo sozinho não identifica o item: "Apartamento"
 * não distingue "50% DO APARTAMENTO EM SÃO BERNARDO DO CAMPO" de outro.
 * Quando o TSE não trouxe descrição, aparece a ausência, não um texto nosso.
 */
export function DeclaredAssets({ assets }: { assets: DeclaredAsset[] }) {
  if (assets.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {/* `text-sm`, e não `text-xs`: os itens da lista abaixo são `text-sm`, e
          um cabeçalho menor que o texto que ele encabeça inverte a hierarquia
          que o próprio elemento anuncia. `slate-600` dá 7,58:1 sobre o branco
          — o `slate-500` anterior passava o AA raspando, em 4,76:1. Mesmo
          degrau dos outros títulos de cartão da ficha. */}
      <h3 className="mb-3 text-sm font-bold tracking-wider text-slate-600 uppercase">
        Bens declarados, item a item
      </h3>
      <ul className="divide-y divide-slate-100">
        {assets.map((asset) => {
          const declaredAt = formatDate(asset.declaredAt);
          return (
            <li
              key={asset.id}
              className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm leading-snug text-slate-700">
                  {asset.description ?? (
                    <span className="text-slate-500">
                      Sem descrição no registro do TSE
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {asset.category ?? "Tipo não informado"}
                  {declaredAt ? ` · declarado em ${declaredAt}` : ""}
                </p>
              </div>
              <p className="flex-none text-sm font-semibold text-slate-800 tabular-nums">
                {BRL.format(asset.amount)}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Valores conforme a declaração de bens entregue ao TSE no registro da
        candidatura. A descrição de cada item é a do próprio declarante.
      </p>
    </div>
  );
}
