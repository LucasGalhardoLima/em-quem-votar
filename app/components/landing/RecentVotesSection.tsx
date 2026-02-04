import { Link } from "react-router";
import { FileText, Calendar, ArrowRight, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface Bill {
    id: string;
    title: string;
    description: string | null;
    voteDate: Date;
}

interface RecentVotesSectionProps {
    bills: Bill[];
}

const getStatus = (desc: string | null, title: string) => {
    const text = (desc || "") + (title || "");
    const lower = text.toLowerCase();

    if (lower.includes("aprovad")) return { label: "Aprovada", color: "text-green-600 bg-green-50", icon: CheckCircle2 };
    if (lower.includes("rejeitad")) return { label: "Rejeitada", color: "text-red-600 bg-red-50", icon: XCircle };
    if (lower.includes("arquivad")) return { label: "Arquivada", color: "text-gray-600 bg-gray-50", icon: AlertCircle };

    return { label: "Concluída", color: "text-blue-600 bg-blue-50", icon: FileText };
};

export function RecentVotesSection({ bills }: RecentVotesSectionProps) {
    return (
        <section className="py-16 md:py-24 px-4 bg-white">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <p className="text-brand-primary font-semibold text-sm uppercase tracking-wider mb-4">
                        Transparência
                    </p>
                    <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        Votações Recentes
                    </h2>
                    <p className="text-gray-600 text-lg max-w-2xl mx-auto">
                        Acompanhe as decisões mais importantes da Câmara dos Deputados.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {bills.map((bill) => {
                        const status = getStatus(bill.description, bill.title);
                        const StatusIcon = status.icon;

                        return (
                            <Link
                                key={bill.id}
                                to={`/votacao/${bill.id}`}
                                className="group bg-gray-50 hover:bg-white rounded-2xl p-6 border border-gray-100 hover:border-brand-primary/30 hover:shadow-lg transition-all"
                            >
                                <div className="flex gap-4">
                                    {/* Icon */}
                                    <div className="shrink-0">
                                        <div className="w-12 h-12 rounded-xl bg-white group-hover:bg-brand-primary-light flex items-center justify-center border border-gray-100 group-hover:border-brand-primary/20 transition-colors">
                                            <FileText className="w-5 h-5 text-gray-400 group-hover:text-brand-primary" />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <h3 className="font-bold text-gray-900 group-hover:text-brand-primary transition-colors line-clamp-2 leading-tight">
                                                {bill.title}
                                            </h3>
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${status.color}`}>
                                                <StatusIcon size={12} />
                                                {status.label}
                                            </span>
                                        </div>

                                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                                            {bill.description || "Sem descrição disponível."}
                                        </p>

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <Calendar size={12} />
                                                {format(new Date(bill.voteDate), "dd/MM/yyyy")}
                                            </span>
                                            <span className="text-sm text-brand-primary font-semibold flex items-center gap-1">
                                                Ver detalhes
                                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* CTA */}
                <div className="text-center">
                    <Link
                        to="/votacoes"
                        className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold px-8 py-4 rounded-xl transition-colors shadow-lg hover:shadow-xl"
                    >
                        Ver Todas as Votações
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </div>
        </section>
    );
}
