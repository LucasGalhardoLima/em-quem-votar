import type { Route } from "./+types/candidato.$id";
import { useLoaderData, redirect } from "react-router";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { CandidateProfile } from "~/components/candidate/CandidateProfile";
import { CandidateService } from "~/services/candidate.server";
import { SpendingService } from "~/services/spending.server";

export function meta({ data }: Route.MetaArgs) {
  const candidate = data?.candidate;
  if (!candidate) {
    return [{ title: "Candidato não encontrado | Em Quem Votar?" }];
  }
  return [
    {
      title: `${candidate.displayName} (${candidate.party}) | Em Quem Votar?`,
    },
    {
      name: "description",
      content: `Veja as posições políticas, gastos e histórico de ${candidate.displayName} (${candidate.party}) para as eleições 2026.`,
    },
  ];
}

export function headers() {
  return {
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
  };
}

export async function loader({ params }: Route.LoaderArgs) {
  const candidate = await CandidateService.getById(params.id);

  if (!candidate) {
    throw redirect("/candidatos");
  }

  const spendingDetails = await SpendingService.getByCandidate(params.id);

  return { candidate, spendingDetails };
}

export default function CandidatoPage() {
  const { candidate, spendingDetails } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-background">
      <Header
        breadcrumbItems={[
          { label: "Candidatos", href: "/candidatos" },
          { label: candidate.displayName, active: true },
        ]}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <CandidateProfile
          candidate={candidate}
          spendingDetails={spendingDetails}
        />
      </main>

      <Footer />
    </div>
  );
}
