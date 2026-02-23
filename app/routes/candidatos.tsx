import type { Route } from "./+types/candidatos";
import { Suspense } from "react";
import { Await, useLoaderData, useSearchParams, useNavigate, Form } from "react-router";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { CandidateCard } from "~/components/candidate/CandidateCard";
import { SkeletonCandidateGrid } from "~/components/candidate/SkeletonCandidateCard";
import { ComparisonFloatingBar } from "~/components/ComparisonFloatingBar";
import { useComparisonStore } from "~/stores/comparisonStore";
import { CandidateService } from "~/services/candidate.server";
import { Users, Search, X, Plus, Check } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Candidatos à Presidência | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Explore todos os candidatos à presidência do Brasil em 2026. Compare posições, gastos e histórico legislativo.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || undefined;
  const partyParam = url.searchParams.get("party");
  const party = partyParam ? partyParam.split(",").filter(Boolean) : undefined;
  const topic = url.searchParams.get("topic") || undefined;
  const stance = url.searchParams.get("stance") || undefined;

  const candidatesPromise = CandidateService.list({
    query,
    party,
    topic,
    stance,
    limit: 50,
    offset: 0,
  });

  const filters = await CandidateService.getFilters();

  return {
    candidates: candidatesPromise,
    filters,
    query: query ?? "",
    activeParties: party ?? [],
    activeTopic: topic ?? "",
    activeStance: stance ?? "",
  };
}

function CandidateListContent({
  data,
}: {
  data: { items: Parameters<typeof CandidateCard>[0][]; total: number };
}) {
  const { toggleId, isSelected } = useComparisonStore();

  if (data.items.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Nenhum candidato encontrado
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Candidatos serão listados após registro no TSE.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        {data.total} candidato{data.total !== 1 ? "s" : ""}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.items.map((candidate) => (
          <div key={candidate.id} className="relative">
            <CandidateCard {...candidate} />
            {/* Compare toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleId(candidate.id);
              }}
              className={cn(
                "absolute top-3 right-3 w-7 h-7 rounded-full border flex items-center justify-center transition-all z-10",
                isSelected(candidate.id)
                  ? "bg-brand-primary border-brand-primary text-white"
                  : "bg-background border-border text-muted-foreground hover:border-brand-primary/50"
              )}
              title={
                isSelected(candidate.id)
                  ? "Remover da comparação"
                  : "Adicionar para comparar"
              }
            >
              {isSelected(candidate.id) ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Candidatos() {
  const {
    candidates,
    filters,
    query,
    activeParties,
    activeTopic,
    activeStance,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params, { preventScrollReset: true });
  };

  const toggleParty = (party: string) => {
    const current = activeParties.includes(party)
      ? activeParties.filter((p) => p !== party)
      : [...activeParties, party];
    updateParam("party", current.length > 0 ? current.join(",") : null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header breadcrumbItems={[{ label: "Candidatos", active: true }]} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Candidatos à Presidência 2026
          </h1>
          <p className="text-muted-foreground mt-1">
            Posições políticas baseadas em dados públicos, sem viés partidário
          </p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar candidato por nome ou partido..."
              defaultValue={query}
              onChange={(e) => {
                const val = e.target.value;
                updateParam("q", val || null);
              }}
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
            {query && (
              <button
                type="button"
                onClick={() => updateParam("q", null)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Party filter chips */}
          {filters.parties.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.parties.map((party) => (
                <button
                  key={party}
                  type="button"
                  onClick={() => toggleParty(party)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    activeParties.includes(party)
                      ? "bg-brand-primary text-white border-brand-primary"
                      : "bg-card text-muted-foreground border-border hover:border-brand-primary/30"
                  )}
                >
                  {party}
                </button>
              ))}
            </div>
          )}
        </div>

        <Suspense fallback={<SkeletonCandidateGrid count={6} />}>
          <Await resolve={candidates}>
            {(data) => <CandidateListContent data={data} />}
          </Await>
        </Suspense>
      </main>

      <ComparisonFloatingBar />
      <Footer />
    </div>
  );
}
