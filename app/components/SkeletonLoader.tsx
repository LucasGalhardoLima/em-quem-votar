import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { cn } from "~/lib/utils";

/** Barra cinza usada dentro dos esqueletos. */
function Bar({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-slate-200", className)} />;
}

/**
 * Esqueleto da página de detalhe de uma votação (`/votacao/:id`).
 *
 * Só desenha o que a página real SEMPRE desenha — trilha, título, placar e
 * filtro. A descrição e os blocos "votar Sim/Não significa" são condicionais
 * lá, então reservar espaço para eles trocava um salto de layout por outro.
 * O que cresce depois do filtro empurra apenas o que está abaixo.
 *
 * O bloco visual é `aria-hidden`: barras cinzas não são conteúdo. Mas o
 * documento não fica vazio para a tecnologia assistiva — o `role="status"`
 * abaixo diz que está carregando, e `aria-busy` marca a região.
 */
export function VoteDetailsSkeleton() {
  return (
    <main id={MAIN_CONTENT_ID} className="flex-1" aria-busy="true">
      <p role="status" className="sr-only">
        Carregando os detalhes da votação…
      </p>

      <div className="animate-pulse" aria-hidden="true">
        <Container className="pt-9 pb-3">
          <Bar className="h-3 w-48" />
          <Bar className="mt-4 h-8 w-3/4" />
          <Bar className="mt-3 h-3 w-56" />
        </Container>

        <Container className="flex flex-col gap-4 pt-5 pb-12">
          {/* Placar — as quatro caixas existem em toda votação. */}
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

          {/* Título da seção de votos + as duas colunas. */}
          <Bar className="h-6 w-56" />
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
      </div>
    </main>
  );
}
