import type { Route } from "./+types/votacao.$id";
import { useLoaderData, Link, Await } from "react-router";
import { db } from "~/utils/db.server";
import { ArrowLeft, CheckCircle2, XCircle, Search } from "lucide-react";
import { useState, Suspense, useEffect } from "react";
import posthog from "posthog-js";
import { VoteDetailsSkeleton } from "~/components/SkeletonLoader";

export function meta({ data }: Route.MetaArgs) {
  // Safe access for meta when data is a promise or partial
  // We might not have data immediately available if deferred, but RR7 meta handles strict data
  // Use a generic title if data is pending/undefined
  if (!data || !("bill" in data)) {
     return [
        { title: "Votação | Em Quem Votar" },
        { name: "description", content: "Veja quem votou a favor e contra nesta votação importante." },
     ];
  }
  
  // Note: Meta function runs after loader resolves for SEO, so we might need to await the promise if it's passed as a promise?
  // Actually in RR7 with single fetch/loader, meta receives the Resolved data if it's critical? 
  // Let's keep it simple. If we return a promise, meta might receive the promise object.
  // For basic SEO, we'll try to use a static title first to avoid complications, or check if we can await it.
  
  return [
    { title: "Detalhes da Votação | Em Quem Votar" },
    { name: "description", content: "Veja quem votou a favor e contra nesta votação importante." },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const billPromise = db.bill.findUnique({
    where: { id: params.id },
    include: {
      voteLogs: {
        include: {
          politician: true,
        },
        orderBy: {
          politician: { name: "asc" },
        },
      },
    },
  }).then(bill => {
    if (!bill) return null;
    // Serialize dates to avoid hydration errors
    return {
      ...bill,
      voteDate: bill.voteDate.toISOString(),
      voteLogs: bill.voteLogs.map(log => ({
        ...log,
        politician: {
          ...log.politician,
          createdAt: log.politician.createdAt.toISOString(),
          updatedAt: log.politician.updatedAt.toISOString(),
        }
      }))
    };
  });

  return { bill: billPromise };
}

export default function VotacaoRoute() {
  const { bill } = useLoaderData<typeof loader>();

  return (
    <Suspense fallback={<VoteDetailsSkeleton />}>
      <Await resolve={bill}>
        {(resolvedBill) => {
          if (!resolvedBill) return <div className="p-8 text-center">Votação não encontrada</div>;
          return <VoteDetailsContent bill={resolvedBill} />;
        }}
      </Await>
    </Suspense>
  );
}

function VoteDetailsContent({ bill }: { bill: any }) {
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (bill) {
        posthog.capture('vote_viewed', { 
            id: bill.id, 
            title: bill.title 
        });
    }
  }, [bill]);

  const votesSim = bill.voteLogs.filter((v: any) => v.voteType === "SIM");
  const votesNao = bill.voteLogs.filter((v: any) => v.voteType === "NÃO");

  const filterVotes = (votes: any[]) => {
    if (!filter) return votes;
    return votes.filter(
      (v) =>
        v.politician.name.toLowerCase().includes(filter.toLowerCase()) ||
        v.politician.party.toLowerCase().includes(filter.toLowerCase())
    );
  };

  const filteredSim = filterVotes(votesSim);
  const filteredNao = filterVotes(votesNao);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link
            to="/"
            prefetch="intent"
            className="p-2 -ml-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex-1 min-w-0">
             <h1 className="text-lg font-bold truncate leading-tight">{bill.title}</h1>
             <p className="text-xs text-gray-500">{new Date(bill.voteDate).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        
        {/* Description Card */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Sobre a Votação</h2>
            <p className="text-gray-700 leading-relaxed text-lg">{bill.description}</p>
        </section>

        {/* Scoreboard */}
        <section className="grid md:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 text-green-700 rounded-full">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                        <span className="block text-green-800 font-bold text-lg">A Favor (Sim)</span>
                        <span className="text-sm text-green-600">Aprovação</span>
                        {bill.voteSimDetails && (
                            <p className="text-xs text-green-700 mt-2 font-medium bg-green-100/50 p-2 rounded-lg leading-snug">
                                {bill.voteSimDetails}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-4xl font-extrabold text-green-700">{votesSim.length}</div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-100 text-red-700 rounded-full">
                        <XCircle className="w-8 h-8" />
                    </div>
                    <div>
                        <span className="block text-red-800 font-bold text-lg">Contra (Não)</span>
                        <span className="text-sm text-red-600">Rejeição</span>
                        {bill.voteNaoDetails && (
                            <p className="text-xs text-red-700 mt-2 font-medium bg-red-100/50 p-2 rounded-lg leading-snug">
                                {bill.voteNaoDetails}
                            </p>
                        )}
                    </div>
                </div>
                <div className="text-4xl font-extrabold text-red-700">{votesNao.length}</div>
            </div>
        </section>

        {/* Search Filter */}
        <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Filtrar deputado ou partido..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
        </div>

        {/* Lists Columns */}
        <div className="grid md:grid-cols-2 gap-8">
            
            {/* Sim List */}
            <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-bold text-green-700 pb-2 border-b border-green-100">
                    <CheckCircle2 className="w-5 h-5" />
                    Votaram Sim ({filteredSim.length})
                </h3>
                <div className="grid gap-2">
                    {filteredSim.map((vote: any) => (
                        <Link 
                            key={vote.id} 
                            to={`/politico/${vote.politician.id}`}
                            className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all flex items-center gap-3 group"
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                {vote.politician.photoUrl && <img src={vote.politician.photoUrl} alt={vote.politician.name} className="w-full h-full object-cover" />}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 group-hover:text-blue-600">{vote.politician.name}</div>
                                <div className="text-xs text-gray-500">{vote.politician.party} • {vote.politician.state}</div>
                            </div>
                        </Link>
                    ))}
                    {filteredSim.length === 0 && <div className="text-gray-400 italic text-sm">Nenhum voto encontrado.</div>}
                </div>
            </div>

            {/* Nao List */}
            <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-bold text-red-700 pb-2 border-b border-red-100">
                    <XCircle className="w-5 h-5" />
                    Votaram Não ({filteredNao.length})
                </h3>
                <div className="grid gap-2">
                    {filteredNao.map((vote: any) => (
                        <Link 
                            key={vote.id} 
                            to={`/politico/${vote.politician.id}`}
                            className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all flex items-center gap-3 group"
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                                {vote.politician.photoUrl && <img src={vote.politician.photoUrl} alt={vote.politician.name} className="w-full h-full object-cover" />}
                            </div>
                            <div>
                                <div className="font-semibold text-gray-900 group-hover:text-blue-600">{vote.politician.name}</div>
                                <div className="text-xs text-gray-500">{vote.politician.party} • {vote.politician.state}</div>
                            </div>
                        </Link>
                    ))}
                    {filteredNao.length === 0 && <div className="text-gray-400 italic text-sm">Nenhum voto encontrado.</div>}
                </div>
            </div>

        </div>

      </main>
    </div>
  );
}
