import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { Check, X, Minus, ArrowLeft, DollarSign, Calendar } from "lucide-react";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { TAG_DEFINITIONS } from "~/data/tag-definitions";
import { PoliticianService } from "~/services/politician.server";
import { BillService } from "~/services/bill.server";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const idsParam = url.searchParams.get("ids");

    if (!idsParam) {
        return { politicians: [], featuredBills: [] };
    }

    const ids = idsParam.split(",").filter(Boolean);

    const politicians = await PoliticianService.listForComparison(ids);

    // Identify common important votes to compare
    const billsOfInterest = [
        TAG_DEFINITIONS["reformista-economico"].sourceBillId,
        TAG_DEFINITIONS["ruralista"].sourceBillId,
        TAG_DEFINITIONS["rigoroso"]?.sourceBillId, // Using optional chaining just in case, but intended is rigoroso
        TAG_DEFINITIONS["conservador-costumes"].sourceBillId,
    ].filter(id => id && id !== "metrics" && id !== "demographics") as string[];

    // Fetch bill details
    const featuredBills = await BillService.listFeatured(billsOfInterest);

    return { politicians, featuredBills };
}

export default function Comparar() {
    const { politicians, featuredBills } = useLoaderData<typeof loader>();

    if (!politicians || politicians.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
                <Header breadcrumbItems={[{ label: "Comparação", active: true }]} />
                <div className="p-8 text-center mt-8">
                    <p className="text-gray-500 mb-4">Nenhum político selecionado.</p>
                    <Link to="/busca" className="text-brand-primary hover:underline">Voltar para busca</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <Header breadcrumbItems={[
                { label: "Busca", href: "/busca" },
                { label: "Comparação", active: true }
            ]} />

            <main className="max-w-7xl mx-auto px-4 py-8">

                <div className="overflow-x-auto pb-6">
                    <div className="min-w-[800px] bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-4 md:p-6 w-32 md:w-48 text-slate-400 font-medium uppercase text-xs tracking-wider sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] md:shadow-none"></th>
                                    {politicians.map(p => (
                                        <th key={p.id} className="p-4 md:p-6 min-w-[160px] md:min-h-[200px] align-top">
                                            <div className="flex flex-col items-center text-center gap-3">
                                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                                                    {p.photoUrl && <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 text-base md:text-lg leading-tight">{p.name}</h3>
                                                    <p className="text-xs md:text-sm text-slate-500">{p.party} • {p.state}</p>
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {/* Spending Row */}
                                <tr>
                                    <th className="p-4 md:p-6 bg-gray-50/95 md:bg-gray-50/50 align-top sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] md:shadow-none backdrop-blur-sm md:backdrop-filter-none">
                                        <span className="flex items-center gap-2 font-semibold text-gray-700 text-sm md:text-base">
                                            <DollarSign size={16} className="text-gray-400 shrink-0" />
                                            Gasto
                                        </span>
                                        <p className="text-[10px] md:text-xs text-gray-400 font-normal mt-1">Mensal (Cota)</p>
                                    </th>
                                    {politicians.map(p => {
                                        const spending = Number(p.spending || 0);
                                        const isHigh = spending > 20000;
                                        return (
                                            <td key={p.id} className="p-6 align-top">
                                                <div className="text-center">
                                                    <span className={`font-bold text-lg block mb-2 ${isHigh ? 'text-brand-alert' : 'text-brand-success'}`}>
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(spending)}
                                                    </span>

                                                    {/* Mini Bar */}
                                                    <div className="h-2 bg-gray-100 rounded-full w-full max-w-[120px] mx-auto overflow-hidden relative">
                                                        <div className="absolute top-0 bottom-0 left-[33%] w-px bg-gray-300 z-10" title="Média (20k)"></div>
                                                        <div
                                                            className={`h-full rounded-full ${isHigh ? 'bg-brand-alert' : 'bg-brand-success'}`}
                                                            style={{ width: `${Math.min((spending / 60000) * 100, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Attendance Row */}
                                <tr>
                                    <th className="p-4 md:p-6 bg-gray-50/95 md:bg-gray-50/50 align-top sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] md:shadow-none backdrop-blur-sm md:backdrop-filter-none">
                                        <span className="flex items-center gap-2 font-semibold text-gray-700 text-sm md:text-base">
                                            <Calendar size={16} className="text-gray-400 shrink-0" />
                                            Assiduidade
                                        </span>
                                        <p className="text-[10px] md:text-xs text-gray-400 font-normal mt-1">Plenário</p>
                                    </th>
                                    {politicians.map(p => {
                                        const attendance = Number(p.attendanceRate || 0);
                                        const isLow = attendance < 80;
                                        return (
                                            <td key={p.id} className="p-6 align-top">
                                                <div className="text-center">
                                                    <span className={`font-bold text-lg block mb-2 ${isLow ? 'text-brand-alert' : 'text-brand-success'}`}>
                                                        {attendance}%
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>

                                {/* Votes Header */}
                                <tr className="bg-slate-50 border-t-2 border-slate-100">
                                    <th colSpan={politicians.length + 1} className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        Como votaram
                                    </th>
                                </tr>

                                {/* Vote Rows */}
                                {featuredBills && featuredBills.length > 0 && featuredBills.map(bill => (
                                    <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                                        <th className="p-6 align-middle text-sm font-medium text-gray-700 max-w-[200px]">
                                            {bill.title.split("(")[0]}
                                            <span className="block text-xs text-gray-400 font-normal mt-0.5">
                                                {new Date(bill.voteDate).getFullYear()}
                                            </span>
                                        </th>
                                        {politicians.map(p => {
                                            const voteLog = p.votes.find((v: any) => v.billId === bill.id);
                                            const voteType = voteLog?.voteType.toUpperCase() || "AUSENTE";

                                            let badgeColor = "bg-gray-100 text-gray-500";
                                            let Icon = Minus;

                                            if (voteType === "SIM") {
                                                badgeColor = "bg-brand-success/10 text-brand-success";
                                                Icon = Check;
                                            } else if (voteType === "NÃO") {
                                                badgeColor = "bg-brand-alert/10 text-brand-alert";
                                                Icon = X;
                                            }

                                            return (
                                                <td key={p.id} className="p-6 align-middle text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${badgeColor}`}>
                                                        <Icon size={14} />
                                                        {voteType}
                                                    </span>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}

                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
