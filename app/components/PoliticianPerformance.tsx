import { TrendingUp, DollarSign, Calendar } from "lucide-react";

interface Politician {
    spending: number | null;
    attendanceRate: number | null;
}

interface PoliticianPerformanceProps {
    politician: Politician;
}

export function PoliticianPerformance({ politician }: PoliticianPerformanceProps) {
    return (
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-brand-primary" />
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
                        <span className={`font-bold ${Number(politician.spending || 0) > 20000 ? 'text-brand-alert' : 'text-brand-success'}`}>
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
                                className={`h-full rounded-full transition-all duration-500 ${Number(politician.spending || 0) > 20000 ? 'bg-brand-alert' : 'bg-brand-success'}`}
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
                        <span className={`font-bold ${Number(politician.attendanceRate || 0) < 80 ? 'text-brand-alert' : 'text-brand-success'}`}>
                            {Number(politician.attendanceRate || 0)}%
                        </span>
                    </div>

                    <div className="relative pt-2 pb-2">
                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden w-full">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${Number(politician.attendanceRate || 0) < 80 ? 'bg-brand-alert' : 'bg-brand-success'}`}
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
    );
}
