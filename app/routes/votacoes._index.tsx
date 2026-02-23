import type { Route } from "./+types/votacoes._index";
import { useLoaderData, Link, Form, useSubmit, useSearchParams } from "react-router";
import { BillService } from "~/services/bill.server";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { Search, FileText, Calendar, ArrowRight } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Votações | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Explore o histórico de votações da Câmara dos Deputados e do Senado Federal.",
    },
  ];
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

export default function VotacoesIndex() {
  const { bills, q, source } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

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
    <div className="min-h-screen bg-background flex flex-col">
      <Header breadcrumbItems={[{ label: "Votações", active: true }]} />

      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-8">
        {/* Page Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Votações
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Pesquise e entenda como os parlamentares se posicionaram nas pautas
            mais importantes do país.
          </p>
        </div>

        {/* Search + Filters */}
        <div className="space-y-4 mb-8">
          <Form
            method="get"
            className="relative"
            onChange={(e) => submit(e.currentTarget, { replace: true })}
          >
            <input type="hidden" name="source" value={source} />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar votação..."
              className="block w-full pl-10 pr-3 py-2.5 border border-border rounded-lg bg-card text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all"
            />
          </Form>

          {/* Source tabs */}
          <div className="flex gap-1.5">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleSourceChange(tab.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  source === tab.value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {bills.length === 0 ? (
            <div className="text-center py-16 rounded-lg border bg-card">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground">
                Nenhuma votação encontrada
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Tente buscar por outros termos.
              </p>
            </div>
          ) : (
            bills.map((bill) => (
              <Link
                key={bill.id}
                to={`/votacao/${bill.id}`}
                className="group block rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5 p-2 rounded-md bg-muted">
                    <FileText className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-medium text-foreground group-hover:text-foreground/80 line-clamp-2">
                      {bill.simplifiedTitle || bill.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(bill.voteDate).toLocaleDateString("pt-BR")}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        {SOURCE_LABELS[bill.sourceType] ?? bill.sourceType}
                      </Badge>
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-1 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
