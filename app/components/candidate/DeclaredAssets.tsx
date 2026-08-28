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
      <h3 className="mb-3 text-[12px] font-bold tracking-[0.06em] text-slate-500 uppercase">
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
                <p className="text-[13.5px] leading-snug text-slate-700">
                  {asset.description ?? (
                    <span className="text-slate-500">
                      Sem descrição no registro do TSE
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {asset.category ?? "Tipo não informado"}
                  {declaredAt ? ` · declarado em ${declaredAt}` : ""}
                </p>
              </div>
              <p className="flex-none text-[13.5px] font-semibold text-slate-800 tabular-nums">
                {BRL.format(asset.amount)}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
        Valores conforme a declaração de bens entregue ao TSE no registro da
        candidatura. A descrição de cada item é a do próprio declarante.
      </p>
    </div>
  );
}
