import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { db } from "~/utils/db.server";
import { Check, X, Minus, ArrowLeft, DollarSign, Calendar } from "lucide-react";
import { Header } from "~/components/Header";
import { TAG_DEFINITIONS } from "~/data/tag-definitions";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  
  if (!idsParam) {
    return { politicians: [], featuredBills: [] };
  }

  const ids = idsParam.split(",").filter(Boolean);

  const rawPoliticians = await db.politician.findMany({
    where: { id: { in: ids } },
    include: {
      votes: {
        include: { bill: true }
      }
    }
  });

  // Identify common important votes to compare
  const billsOfInterest = [
    TAG_DEFINITIONS["reformista-economico"].sourceBillId,
    TAG_DEFINITIONS["ruralista"].sourceBillId,
    TAG_DEFINITIONS["linha-dura"].sourceBillId,
    TAG_DEFINITIONS["conservador-costumes"].sourceBillId,
  ].filter(id => id !== "metrics" && id !== "demographics");

  // Fetch bill details
  const rawFeaturedBills = await db.bill.findMany({
    where: { id: { in: billsOfInterest } }
  });

  // SERIALIZATION SAFETY: Convert Decimals to Numbers and Dates to Strings
  const politicians = rawPoliticians.map(p => ({
    ...p,
    spending: p.spending ? Number(p.spending) : 0,
    attendanceRate: p.attendanceRate ? Number(p.attendanceRate) : 0,
    votes: p.votes.map(v => ({
      ...v,
      bill: {
        ...v.bill,
        voteDate: v.bill.voteDate.toISOString()
      }
    }))
  }));

  const featuredBills = rawFeaturedBills.map(b => ({
    ...b,
    voteDate: b.voteDate.toISOString()
  }));

  return { politicians, featuredBills };
}

export default function Comparar() {
  const { politicians, featuredBills } = useLoaderData<typeof loader>();

  if (!politicians || politicians.length === 0) {
     return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            <Header />
            <div className="p-8 text-center mt-8">
                <p className="text-gray-500 mb-4">Nenhum político selecionado.</p>
                <Link to="/busca" className="text-blue-600 hover:underline">Voltar para busca</Link>
            </div>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-4">
            <Link to="/busca" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Comparação</h1>
        </div>

        <div className="overflow-x-auto pb-6">
            <div className="min-w-[800px] bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="p-6 w-48 text-gray-400 font-medium uppercase text-xs tracking-wider"></th>
                            {politicians.map(p => (
                                <th key={p.id} className="p-6 min-w-[200px] align-top">
                                    <div className="flex flex-col items-center text-center gap-3">
                                        <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden border-2 border-white shadow-sm">
                                            {p.photoUrl && <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight">{p.name}</h3>
                                            <p className="text-sm text-gray-500">{p.party} • {p.state}</p>
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {/* Spending Row */}
                        <tr>
                            <th className="p-6 bg-gray-50/50 align-top">
                                <span className="flex items-center gap-2 font-semibold text-gray-700">
                                    <DollarSign size={16} className="text-gray-400" />
                                    Gasto Mensal
                                </span>
                                <p className="text-xs text-gray-400 font-normal mt-1">Cota Parlamentar</p>
                            </th>
                            {politicians.map(p => {
                                const spending = Number(p.spending || 0);
                                const isHigh = spending > 20000;
                                return (
                                    <td key={p.id} className="p-6 align-top">
                                        <div className="text-center">
                                            <span className={`font-bold text-lg block mb-2 ${isHigh ? 'text-red-600' : 'text-green-600'}`}>
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(spending)}
                                            </span>
                                            
                                            {/* Mini Bar */}
                                            <div className="h-2 bg-gray-100 rounded-full w-full max-w-[120px] mx-auto overflow-hidden relative">
                                                <div className="absolute top-0 bottom-0 left-[33%] w-px bg-gray-300 z-10" title="Média (20k)"></div>
                                                <div 
                                                    className={`h-full rounded-full ${isHigh ? 'bg-red-500' : 'bg-green-500'}`} 
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
                            <th className="p-6 bg-gray-50/50 align-top">
                                <span className="flex items-center gap-2 font-semibold text-gray-700">
                                    <Calendar size={16} className="text-gray-400" />
                                    Assiduidade
                                </span>
                                <p className="text-xs text-gray-400 font-normal mt-1">Presença em Plenário</p>
                            </th>
                            {politicians.map(p => {
                                const attendance = Number(p.attendanceRate || 0);
                                const isLow = attendance < 80;
                                return (
                                    <td key={p.id} className="p-6 align-top">
                                        <div className="text-center">
                                            <span className={`font-bold text-lg block mb-2 ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                                                {attendance}%
                                            </span>
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>

                        {/* Votes Header */}
                        <tr className="bg-gray-50 border-t-2 border-gray-100">
                             <th colSpan={politicians.length + 1} className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                                Como votaram
                             </th>
                        </tr>

                        {/* Vote Rows */}
                        {featuredBills && featuredBills.length > 0 && featuredBills.map(bill => (
                            <tr key={bill.id} className="hover:bg-gray-50/30 transition-colors">
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
                                        badgeColor = "bg-green-100 text-green-700";
                                        Icon = Check;
                                    } else if (voteType === "NÃO") {
                                        badgeColor = "bg-red-100 text-red-700";
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
    </div>
  );
}
