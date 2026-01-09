import { Check, X, Minus, AlertTriangle } from "lucide-react";

interface Vote {
    id: string;
    voteType: string;
    isRebel?: boolean;
    partyMajorityPosition?: string;
    bill: {
        title: string;
        description: string | null;
        voteDate: string;
    };
}

interface PoliticianVoteHistoryProps {
    votes: Vote[] | undefined;
}

export function PoliticianVoteHistory({ votes }: PoliticianVoteHistoryProps) {
    return (
        <section className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Histórico de Votações
                <span className="text-sm font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{votes?.length || 0}</span>
            </h2>

            <div className="grid gap-4">
                {!votes || votes.length === 0 ? (
                    <p className="text-gray-500 italic">Nenhuma votação registrada para este parlamentar.</p>
                ) : (
                    votes.map((vote) => (
                        <div key={vote.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden">
                            {/* Rebel Badge */}
                            {vote.isRebel && (
                                <div className="absolute top-0 left-0 bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg shadow-sm flex items-center gap-1 z-10" title={`Maioria do partido votou ${vote.partyMajorityPosition}`}>
                                    <AlertTriangle size={10} />
                                    DIVERGENTE
                                </div>
                            )}

                            <div className="flex-1 pt-2 md:pt-0">
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

                            <div className="flex-shrink-0 flex items-center gap-3 mt-4 md:mt-0">
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${vote.voteType.toUpperCase() === "SIM"
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
    );
}
