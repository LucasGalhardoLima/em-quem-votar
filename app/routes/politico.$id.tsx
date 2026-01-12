import { useLoaderData, Link, useNavigation, Await } from "react-router";
import { Suspense, useEffect } from "react";
import type { Route } from "./+types/politico.$id";
import { ArrowLeft, Check, X, Minus, MapPin, Building2, TrendingUp, DollarSign, Calendar, Share2, Mail } from "lucide-react";
import { ProfileHeaderSkeleton, VoteHistorySkeleton } from "~/components/SkeletonLoader";
import { TagWithTooltip } from "~/components/TagWithTooltip";
import { Header } from "~/components/Header";
import { Breadcrumbs } from "~/components/Breadcrumbs";
import { toast } from "sonner";
import { PoliticianPerformance } from "~/components/PoliticianPerformance";
import { PoliticianVoteHistory } from "~/components/PoliticianVoteHistory";
import { PoliticianService } from "~/services/politician.server";

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.id) {
    throw new Response("ID inválido", { status: 400 });
  }

  const politician = await PoliticianService.getById(params.id);

  if (!politician) {
    return { politician: null };
  }

  return { politician };
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return {
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
  };
}



// ... existing code

export function meta({ data }: Route.MetaArgs) {
  if (!data || !data.politician) {
    return [{ title: "Político não encontrado | Em Quem Votar" }];
  }
  return [
    { title: `Perfil de ${data.politician.name} | Em Quem Votar` },
    { name: "description", content: `Confira o histórico de votações e posicionamentos de ${data.politician.name}.` },
    { property: "og:image", content: `/ resources / og / ${data.politician.id} ` },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

// ... existing code


export default function PoliticianProfile() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const { politician } = data;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado para a área de transferência!");
  };

  if (!politician) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <Header />
        <div className="p-8 text-center text-gray-500 max-w-4xl mx-auto mt-8 bg-white rounded-3xl shadow-sm border border-gray-100">Político não encontrado</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Breadcrumbs */}
        <div className="flex justify-between items-center">
          <Breadcrumbs items={[
            { label: "Políticos", href: "/busca" },
            { label: politician.name }
          ]} />

          <button
            onClick={handleShare}
            className="p-2 text-gray-400 hover:text-white hover:bg-brand-tertiary rounded-full transition-colors"
            title="Compartilhar Perfil"
          >
            <Share2 size={20} />
          </button>
        </div>

        <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-8">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-gray-50 shadow-inner flex-shrink-0 bg-gray-200">
            {politician.photoUrl ? (
              <img src={politician.photoUrl} alt={politician.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">?</div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">{politician.name}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-gray-600">
                <span className="flex items-center gap-1.5 bg-brand-primary-light text-brand-primary px-3 py-1 rounded-full text-sm font-semibold">
                  <Building2 size={14} />
                  {politician.party}
                </span>
                <span className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                  <MapPin size={14} />
                  {politician.state}
                </span>
              </div>
            </div>

            {politician.tags && politician.tags.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-2">Posicionamentos Identificados</h3>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {politician.tags.map((pt: any) => (
                    <TagWithTooltip key={pt.tag.id} tag={pt.tag} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Performance Section */}
        <PoliticianPerformance politician={politician} />

        <PoliticianVoteHistory votes={politician.votes} />
        <div className="text-center pt-8 border-t border-gray-100 mt-12">
          <a
            href={`mailto:suporte@emquemvotar.app?subject=Correção Perfil: ${politician.name}`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center gap-1"
          >
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
            Encontrou algum erro neste perfil? Clique aqui para reportar.
          </a>
        </div>
      </main>
    </div>
  );
}
