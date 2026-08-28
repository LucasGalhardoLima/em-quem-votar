import type { Route } from "./+types/votacoes._index";
import { useEffect, useRef } from "react";
import { useLoaderData, Link, Form, useSubmit, useSearchParams } from "react-router";
import { BillService } from "~/services/bill.server";
import { pageMeta } from "~/root";
import { Search } from "lucide-react";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { cn } from "~/lib/utils";

export function meta() {
  // A descrição é a mesma frase que a página exibe sob o <h1>: quem chega pelo
  // card compartilhado lê exatamente o que vai encontrar, e a promessa não
  // existe em duas versões que podem divergir.
  return pageMeta({
    title: "Votações | Em Quem Votar?",
    description:
      "Pesquise as votações nominais da Câmara e do Senado e veja como cada parlamentar se posicionou — sem rótulo de certo ou errado.",
    type: "website",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const source = url.searchParams.get("source") || "";

  const bills = await BillService.listApproved({
    query: q || undefined,
    source: source || undefined,
  });

  return { bills, q, source };
}

const SOURCE_TABS = [
  { value: "", label: "Todas" },
  { value: "camara", label: "Câmara" },
  { value: "senado", label: "Senado" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  camara: "Câmara",
  senado: "Senado",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function VotacoesIndex() {
  const { bills, q, source } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  // Sem espera, cada tecla vira uma navegação e um `contains` no Postgres:
  // "orçamento" são nove buscas de texto para uma intenção só.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  function cancelPendingSearch() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }

  function handleSourceChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("source", value);
    } else {
      params.delete("source");
    }
    setSearchParams(params, { replace: true });
  }

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="pt-9 pb-3">
        <h1 className="font-heading text-[28px] font-bold tracking-[-0.02em] text-slate-800 sm:text-[34px]">
          Votações
        </h1>
        <p className="mt-1.5 text-[14.5px] text-pretty text-slate-500">
          Pesquise as votações nominais da Câmara e do Senado e veja como cada
          parlamentar se posicionou — sem rótulo de certo ou errado.
        </p>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <Form
            method="get"
            className="relative flex-1"
            onChange={(e) => {
              // `currentTarget` é zerado quando o handler retorna: guarda agora.
              const form = e.currentTarget;
              cancelPendingSearch();
              searchTimer.current = setTimeout(
                () => submit(form, { replace: true }),
                300,
              );
            }}
            onSubmit={cancelPendingSearch}
          >
            <input type="hidden" name="source" value={source} />
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar votação por título ou tema…"
              aria-label="Buscar votações"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10"
            />
          </Form>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar por casa legislativa"
          >
            {SOURCE_TABS.map((tab) => {
              const active = source === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSourceChange(tab.value)}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-[12.5px] transition-colors",
                    active
                      ? "border-slate-800 bg-slate-800 font-semibold text-white"
                      : "border-slate-200 bg-white font-medium text-slate-500 hover:border-slate-300",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </Container>

      <Container className="pt-5 pb-10">
        {bills.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-base font-bold text-slate-600">
              Nenhuma votação encontrada
            </p>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] text-slate-500">
              Tente outro termo ou remova o filtro de casa legislativa.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bills.map((bill) => (
              <Link
                key={bill.id}
                to={`/votacao/${bill.id}`}
                prefetch="intent"
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300"
              >
                {/*
                  A listagem não carrega sourceUrl (não faz parte do select de
                  BillService.listApproved), então a origem aparece aqui como
                  texto simples. O link para a fonte oficial fica na página da
                  votação, onde sourceUrl está disponível.
                */}
                <span className="text-[11px] font-bold tracking-[0.06em] text-indigo-600 uppercase">
                  {SOURCE_LABELS[bill.sourceType] ?? bill.sourceType}
                </span>
                <span className="text-[15px] leading-snug font-bold text-pretty text-slate-800">
                  {bill.simplifiedTitle || bill.title}
                </span>
                <time
                  dateTime={bill.voteDate}
                  className="mt-auto pt-2 text-[12px] text-slate-500"
                >
                  {dateFormatter.format(new Date(bill.voteDate))}
                </time>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
