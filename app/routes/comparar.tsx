import { Suspense } from "react";
import { Await, Link, useLoaderData } from "react-router";
import type { Route } from "./+types/comparar";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { ComparisonTable } from "~/components/candidate/ComparisonTable";
import { CandidateService } from "~/services/candidate.server";
import { db } from "~/utils/db.server";
import { ArrowLeft, Loader2 } from "lucide-react";

export function meta() {
  return [
    { title: "Comparar Candidatos | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Compare candidatos à presidência lado a lado em temas como economia, segurança, meio ambiente e direitos.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");

  if (!idsParam) {
    return { candidates: null, topics: [], featuredBills: [] };
  }

  const ids = idsParam.split(",").filter(Boolean);

  const candidatesPromise = CandidateService.listForComparison(ids);

  const topics = await db.politicalTopic.findMany({
    select: { slug: true, name: true, category: true },
    orderBy: [{ category: "asc" }, { order: "asc" }],
  });

  return {
    candidates: candidatesPromise,
    topics,
    featuredBills: [],
  };
}

function ComparisonContent({
  data,
  topics,
}: {
  data: Awaited<ReturnType<typeof CandidateService.listForComparison>>;
  topics: { slug: string; name: string; category: string }[];
}) {
  if (data.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">
          Nenhum candidato selecionado.
        </p>
        <Link
          to="/candidatos"
          className="text-brand-primary hover:underline font-medium"
        >
          Voltar para candidatos
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <ComparisonTable candidates={data} topics={topics} />
    </div>
  );
}

export default function Comparar() {
  const { candidates, topics } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-background">
      <Header
        breadcrumbItems={[
          { label: "Candidatos", href: "/candidatos" },
          { label: "Comparação", active: true },
        ]}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Comparar Candidatos
          </h1>
          <p className="text-muted-foreground mt-1">
            Posições lado a lado em cada tema
          </p>
        </div>

        {candidates ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
              </div>
            }
          >
            <Await resolve={candidates}>
              {(data) => <ComparisonContent data={data} topics={topics} />}
            </Await>
          </Suspense>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">
              Nenhum candidato selecionado para comparação.
            </p>
            <Link
              to="/candidatos"
              className="text-brand-primary hover:underline font-medium"
            >
              Selecionar candidatos
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
