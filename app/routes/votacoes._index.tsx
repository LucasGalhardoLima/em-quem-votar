import { useLoaderData, Link, Form, useSubmit } from "react-router";
import { db } from "~/utils/db.server";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { Search, FileText, Calendar, ArrowRight, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function meta() {
    return [
        { title: "Votações | Em Quem Votar" },
        { name: "description", content: "Explore o histórico de votações da Câmara dos Deputados." },
    ];
}

export async function loader({ request }: { request: Request }) {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";

    const bills = await db.bill.findMany({
        where: {
            status: "approved", // Apenas votações aprovadas pelo admin
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
            ]
        },
        orderBy: {
            voteDate: "desc"
        },
        take: 50 // Limit for now
    });

    return { bills, q };
}

export default function VotacoesIndex() {
    const { bills, q } = useLoaderData<typeof loader>();
    const submit = useSubmit();

    // Helper to guess status from description (since API doesn't give a clean status field yet)
    // This is a heuristic.
    const getStatus = (desc: string | null, title: string) => {
        const text = (desc || "") + (title || "");
        const lower = text.toLowerCase();

        if (lower.includes("aprovad")) return { label: "Aprovada", color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2 };
        if (lower.includes("rejeitad")) return { label: "Rejeitada", color: "text-red-600 bg-red-50 border-red-200", icon: XCircle };
        if (lower.includes("arquivad")) return { label: "Arquivada", color: "text-gray-600 bg-gray-50 border-gray-200", icon: AlertCircle };

        return { label: "Concluída", color: "text-blue-600 bg-blue-50 border-blue-200", icon: FileText };
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Header breadcrumbItems={[{ label: "Votações", active: true }]} />

            <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-12">

                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 mb-3">
                            Votações da Câmara
                        </h1>
                        <p className="text-gray-600 text-lg max-w-2xl">
                            Pesquise e entenda como os deputados se posicionaram nas pautas mais importantes do país.
                        </p>
                    </div>

                    {/* Search Bar */}
                    <Form method="get" className="w-full md:w-96 relative group" onChange={(e) => submit(e.currentTarget, { replace: true })}>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-brand-primary" />
                        </div>
                        <input
                            type="search"
                            name="q"
                            defaultValue={q}
                            placeholder="Buscar votação (ex: Reforma Tributária)"
                            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all shadow-sm"
                        />
                    </Form>
                </div>

                {/* Results List */}
                <div className="space-y-4">
                    {bills.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-900">Nenhuma votação encontrada</h3>
                            <p className="text-gray-500">Tente buscar por outros termos.</p>
                        </div>
                    ) : (
                        bills.map((bill) => {
                            const status = getStatus(bill.description, bill.title);
                            const StatusIcon = status.icon;

                            return (
                                <Link
                                    key={bill.id}
                                    to={`/votacao/${bill.id}`}
                                    className="group block bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-brand-primary/30 transition-all"
                                >
                                    <div className="flex flex-col md:flex-row gap-6">

                                        {/* Icon / Date */}
                                        <div className="shrink-0 flex md:flex-col items-center gap-3 md:w-32 text-gray-500">
                                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-brand-primary-light group-hover:text-brand-primary transition-colors">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div className="text-sm font-medium flex items-center gap-1.5">
                                                <Calendar size={14} />
                                                {format(new Date(bill.voteDate), "dd/MM/yyyy")}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-grow space-y-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <h2 className="text-xl font-bold text-gray-900 group-hover:text-brand-primary transition-colors line-clamp-2">
                                                    {bill.title}
                                                </h2>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 border ${status.color}`}>
                                                    <StatusIcon size={12} />
                                                    {status.label}
                                                </span>
                                            </div>

                                            <p className="text-gray-600 leading-relaxed line-clamp-2 text-sm">
                                                {bill.description || "Sem descrição disponível."}
                                            </p>

                                            <div className="flex items-center text-brand-primary font-bold text-sm pt-2">
                                                Ver Detalhes do Voto <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>

                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>

            </main>
            <Footer />
        </div>
    );
}
