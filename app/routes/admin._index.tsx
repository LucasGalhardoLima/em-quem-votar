import { useLoaderData, Link, Form, useNavigation } from "react-router";
import { db } from "~/utils/db.server";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { Shield, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export function meta() {
    return [
        { title: "Admin: Votações | Em Quem Votar" },
    ];
}

export async function loader() {
    const [pendingBills, approvedBills, rejectedBills] = await Promise.all([
        db.bill.findMany({
            where: { status: "pending" },
            orderBy: { voteDate: "desc" },
            take: 50,
        }),
        db.bill.findMany({
            where: { status: "approved" },
            orderBy: { voteDate: "desc" },
            take: 20,
        }),
        db.bill.findMany({
            where: { status: "rejected" },
            orderBy: { voteDate: "desc" },
            take: 10,
        }),
    ]);

    const allTags = await db.tag.findMany({
        orderBy: { category: "asc" },
    });

    return { pendingBills, approvedBills, rejectedBills, allTags };
}

export default function AdminIndex() {
    const { pendingBills, approvedBills, rejectedBills, allTags } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Header breadcrumbItems={[{ label: "Admin", href: "/admin" }, { label: "Votações", active: true }]} />

            <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-primary/10 rounded-xl">
                            <Shield className="w-6 h-6 text-brand-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Dashboard Admin</h1>
                            <p className="text-gray-600">Gerencie votações e classificações</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-amber-700 mb-1">
                            <Clock size={18} />
                            <span className="font-semibold">Pendentes</span>
                        </div>
                        <p className="text-3xl font-bold text-amber-800">{pendingBills.length}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-green-700 mb-1">
                            <CheckCircle2 size={18} />
                            <span className="font-semibold">Aprovadas</span>
                        </div>
                        <p className="text-3xl font-bold text-green-800">{approvedBills.length}</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 text-red-700 mb-1">
                            <XCircle size={18} />
                            <span className="font-semibold">Rejeitadas</span>
                        </div>
                        <p className="text-3xl font-bold text-red-800">{rejectedBills.length}</p>
                    </div>
                </div>

                {/* Pending Bills */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <AlertCircle className="text-amber-500" size={20} />
                        Votações Pendentes de Aprovação
                    </h2>

                    {pendingBills.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <p className="text-gray-600">Nenhuma votação pendente!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingBills.map((bill) => (
                                <Link
                                    key={bill.id}
                                    to={`/admin/votacao/${bill.id}`}
                                    className="group flex items-center justify-between bg-white hover:bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-primary/30 p-4 transition-all"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                                                Pendente
                                            </span>
                                            {bill.aiConfidence && (
                                                <span className="text-xs text-gray-500">
                                                    IA: {bill.aiConfidence.toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-semibold text-gray-900 group-hover:text-brand-primary truncate">
                                            {bill.title}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {format(new Date(bill.voteDate), "dd/MM/yyyy")}
                                            {bill.suggestedTagSim && (
                                                <span className="ml-2">
                                                    • SIM: <code className="bg-gray-100 px-1 rounded">{bill.suggestedTagSim}</code>
                                                    • NÃO: <code className="bg-gray-100 px-1 rounded">{bill.suggestedTagNao}</code>
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-primary" />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Approved Bills */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <CheckCircle2 className="text-green-500" size={20} />
                        Votações Aprovadas Recentes
                    </h2>

                    <div className="space-y-2">
                        {approvedBills.slice(0, 5).map((bill) => (
                            <Link
                                key={bill.id}
                                to={`/admin/votacao/${bill.id}`}
                                className="flex items-center justify-between bg-white hover:bg-gray-50 rounded-lg border border-gray-100 p-3 transition-all"
                            >
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-gray-900 truncate text-sm">
                                        {bill.title}
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        {format(new Date(bill.voteDate), "dd/MM/yyyy")}
                                    </p>
                                </div>
                                <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full">
                                    Aprovada
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
