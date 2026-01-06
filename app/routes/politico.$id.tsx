import { useLoaderData, Link, useNavigation, Await } from "react-router";
import { Suspense } from "react";
import { db } from "~/utils/db.server";
import type { Route } from "./+types/politico.$id";
import { ArrowLeft, Check, X, Minus, MapPin, Building2, TrendingDown, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { ProfileHeaderSkeleton, VoteHistorySkeleton } from "~/components/SkeletonLoader";
import { TagWithTooltip } from "~/components/TagWithTooltip";
import { Header } from "~/components/Header";

export async function loader({ params }: Route.LoaderArgs) {
  // Fetch basic politician info as fast as possible
  // Ensure we await the data for SEO (meta tags need it)
  const politician = await db.politician.findUnique({
    where: { id: params.id },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
      votes: {
        take: 20,
        include: {
          bill: true,
        },
        orderBy: {
          bill: {
            voteDate: "desc",
          },
        },
      },
    },
  });

  if (!politician) {
    return { politician: null };
  }

  return {
    politician: {
      ...politician,
      spending: politician.spending ? Number(politician.spending.toString()) : 0,
      attendanceRate: politician.attendanceRate ? Number(politician.attendanceRate.toString()) : 0,
      votes: politician.votes.map(v => ({
        ...v,
        bill: {
          ...v.bill,
          voteDate: v.bill.voteDate.toISOString()
        }
      }))
    }
  };
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
    { property: "og:image", content: `/resources/og/${data.politician.id}` },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

// ... existing code


export default function PoliticianProfile() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const { politician } = data;

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
                    <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
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
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                    Desempenho & Métricas
                </h2>
                
                <div className="grid md:grid-cols-2 gap-12">
                    {/* Spending Metrics */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-gray-400" />
                                Gasto Mensal (Cota)
                            </h3>
                            <span className={`font-bold ${Number(politician.spending || 0) > 20000 ? 'text-red-600' : 'text-green-600'}`}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(politician.spending || 0))}
                            </span>
                        </div>
                        
                        <div className="relative pt-2 pb-2">
                            {/* Bar Container */}
                            <div className="h-4 bg-gray-100 rounded-full overflow-hidden w-full relative">
                                {/* Simulated Average Marker (20k) */}
                                <div 
                                    className="absolute top-0 bottom-0 border-r-2 border-dashed border-gray-400 z-10 w-[33%]" // 20k/60k = 33%
                                    title="Média Parlamentar (R$ 20k)"
                                ></div>

                                {/* Actual Spending Bar */}
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${Number(politician.spending || 0) > 20000 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${Math.min((Number(politician.spending || 0) / 60000) * 100, 100)}%` }}
                                ></div>
                            </div>
                            
                            {/* Legend */}
                            <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                                <span>R$ 0</span>
                                <span className="text-gray-500 relative -left-8">Média: R$ 20k</span>
                                <span>R$ 60k+</span>
                            </div>
                        </div>
                        
                        <p className="text-sm text-gray-500">
                            {Number(politician.spending || 0) > 20000 
                                ? "Este parlamentar gasta acima da média mensal da câmara." 
                                : "Este parlamentar mantém seus gastos abaixo da média."}
                        </p>
                    </div>

                    {/* Attendance Metrics */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                Presença em Plenário
                            </h3>
                            <span className={`font-bold ${Number(politician.attendanceRate || 0) < 80 ? 'text-red-600' : 'text-green-600'}`}>
                                {Number(politician.attendanceRate || 0)}%
                            </span>
                        </div>

                        <div className="relative pt-2 pb-2">
                            <div className="h-4 bg-gray-100 rounded-full overflow-hidden w-full">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${Number(politician.attendanceRate || 0) < 80 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${Number(politician.attendanceRate || 0)}%` }}
                                ></div>
                            </div>
                            
                           <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                                <span>0%</span>
                                <span className="text-gray-500">Meta: 100%</span>
                            </div>
                        </div>

                         <p className="text-sm text-gray-500">
                            {Number(politician.attendanceRate || 0) < 80 
                                ? "Frequência baixa. O parlamentar tem faltado a sessões importantes." 
                                : "Ótima assiduidade. O parlamentar está presente na maioria das sessões."}
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Histórico de Votações
                <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{politician.votes?.length || 0}</span>
            </h2>

            <div className="grid gap-4">
                {!politician.votes || politician.votes.length === 0 ? (
                <p className="text-gray-500 italic">Nenhuma votação registrada para este parlamentar.</p>
                ) : (
                politician.votes.map((vote: any) => (
                    <div key={vote.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <div className="flex-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block">
                        {new Date(vote.bill.voteDate).toLocaleDateString("pt-BR", { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">
                        {vote.bill.title}
                        </h3>
                        {vote.bill.description && (
                            <p className="text-gray-600 text-sm line-clamp-2">{vote.bill.description}</p>
                        )}
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
                        vote.voteType.toUpperCase() === "SIM" 
                            ? "bg-green-100 text-green-700" 
                            : vote.voteType.toUpperCase() === "NÃO"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                        {vote.voteType.toUpperCase() === "SIM" && <Check size={18} />}
                        {vote.voteType.toUpperCase() === "NÃO" && <X size={18} />}
                        {vote.voteType.toUpperCase() !== "SIM" && vote.voteType.toUpperCase() !== "NÃO" && <Minus size={18} />}
                        {vote.voteType}
                        </div>
                    </div>
                    </div>
                ))
                )}
            </div>
            </section>
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
