
import { Header } from "~/components/Header";
import { Scale, DollarSign, Calendar, Tag, ShieldCheck, Database } from "lucide-react";

export function meta() {
  return [
    { title: "Metodologia | Em Quem Votar" },
    { name: "description", content: "Entenda como calculamos os gastos, assiduidade e as tags dos parlamentares." },
  ];
}

export default function Methodology() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-16">
        {/* Hero Section */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900">
            Nossa <span className="text-blue-600">Metodologia</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Transparência é a base da nossa plataforma. Entenda os critérios técnicos por trás de cada índice e classificação.
          </p>
        </section>

        {/* Core Pillars */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
              <DollarSign className="text-blue-600 w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Gasto Mensal (Cota)</h2>
            <p className="text-gray-600 leading-relaxed">
              Calculamos a média mensal de despesas da Cota para Exercício da Atividade Parlamentar (CEAP) no ano corrente.
            </p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                <strong>Baixo Custo:</strong> Gastos até 20% abaixo da média global.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                <strong>Gastão:</strong> Gastos 20% acima da média global.
              </li>
            </ul>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
              <Calendar className="text-purple-600 w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Assiduidade</h2>
            <p className="text-gray-600 leading-relaxed">
              Mapeamos a presença do parlamentar em sessões deliberativas. Consideramos "Falta" quando não há registro de presença ou justificativa oficial.
            </p>
            <p className="text-sm text-gray-500 italic">
              * Atualmente em fase de atualização diária via API da Câmara.
            </p>
          </div>
        </div>

        {/* Tags Section */}
        <section className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100 space-y-8">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-yellow-100 rounded-2xl flex items-center justify-center shrink-0">
                <Tag className="text-yellow-600 w-6 h-6" />
             </div>
             <h2 className="text-3xl font-bold text-gray-900">Como as Tags são geradas?</h2>
          </div>
          
          <div className="space-y-6 text-gray-600 leading-relaxed">
            <p>
              As tags não são opiniões editoriais. Elas são atribuídas automaticamente com base no histórico de votações nominais em pautas decisivas.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <h3 className="font-bold text-gray-900">Mapeamento de Votos</h3>
                    <p className="text-sm">
                        Cada projeto de lei relevante (ex: Reforma Tributária) possui um "voto-chave". 
                        Se o parlamentar votou "Sim", ele recebe a tag correspondente àquele posicionamento.
                    </p>
                </div>
                <div className="space-y-2">
                    <h3 className="font-bold text-gray-900">Atualização Automática</h3>
                    <p className="text-sm">
                        Nossos robôs analisam diariamente novas votações. Se o comportamento de um parlamentar muda consistentemente, as tags são reavaliadas.
                    </p>
                </div>
            </div>
          </div>
        </section>

        {/* Data Sources */}
        <section className="bg-gray-900 text-white p-8 md:p-12 rounded-3xl shadow-xl space-y-8">
            <div className="flex items-center gap-4">
                <Database className="text-blue-400 w-8 h-8" />
                <h2 className="text-3xl font-bold">Fontes de Dados</h2>
            </div>
            <p className="text-gray-400 leading-relaxed">
                Consumimos exclusivamente dados oficiais de canais públicos:
            </p>
            <div className="flex flex-wrap gap-4">
                <a href="https://dadosabertos.camara.leg.br/" target="_blank" rel="noreferrer" className="bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl border border-gray-700 transition-colors">
                    Portal de Dados Abertos - Câmara dos Deputados
                </a>
            </div>
            <div className="pt-8 border-t border-gray-800 flex items-start gap-4 text-sm text-gray-400 italic">
                <ShieldCheck className="shrink-0 w-5 h-5 text-green-500" />
                <p>
                    O "Em Quem Votar" é um projeto independente e não possui vínculo com órgãos governamentais ou partidos políticos. 
                    Nossa missão é puramente informativa.
                </p>
            </div>
        </section>

        {/* Contact/Support */}
        <div className="text-center pt-12">
            <p className="text-gray-500 mb-4">Dúvidas ou sugestões sobre nossos critérios?</p>
            <a href="mailto:contato@emquemvotar.app" className="text-blue-600 font-bold hover:underline">
                Fale com nossa equipe técnica
            </a>
        </div>
      </main>
    </div>
  );
}
