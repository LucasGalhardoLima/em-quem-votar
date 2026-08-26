import { Container } from "~/components/layout";
import { cn } from "~/lib/utils";

/** Barra cinza usada dentro dos esqueletos. */
function Bar({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-slate-200", className)} />;
}

/**
 * Esqueleto da página de detalhe de uma votação (`/votacao/:id`).
 * Espelha a estrutura real da página: trilha, título, cartão de descrição,
 * placar neutro, filtro e as duas colunas de votos.
 */
export function VoteDetailsSkeleton() {
  return (
    <main className="flex-1 animate-pulse" aria-hidden="true">
      <Container className="pt-9 pb-3">
        <Bar className="h-3 w-48" />
        <Bar className="mt-4 h-8 w-3/4" />
        <Bar className="mt-3 h-3 w-56" />
      </Container>

      <Container className="flex flex-col gap-4 pt-5 pb-12">
        {/* Descrição */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <Bar className="h-3 w-32" />
          <div className="mt-3 space-y-2">
            <Bar className="h-3.5 w-full" />
            <Bar className="h-3.5 w-full" />
            <Bar className="h-3.5 w-2/3" />
          </div>
        </div>

        {/* Placar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <Bar className="mx-auto h-6 w-10" />
              <Bar className="mx-auto mt-2 h-3 w-16" />
            </div>
          ))}
        </div>

        {/* Filtro */}
        <div className="h-12 w-full rounded-xl border border-slate-200 bg-white" />

        {/* Colunas de votos */}
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, col) => (
            <div
              key={col}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <Bar className="h-5 w-14 rounded-full" />
                <Bar className="h-3 w-24" />
              </div>
              <div className="mt-3 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Bar className="size-9 flex-none rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Bar className="h-3.5 w-2/3" />
                      <Bar className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </main>
  );
}
