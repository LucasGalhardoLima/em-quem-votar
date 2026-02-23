import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import {
  Scale,
  Database,
  ShieldCheck,
  Ruler,
  Layers,
  Weight,
  Eye,
  FileSearch,
} from "lucide-react";

export function meta() {
  return [
    { title: "Metodologia | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Entenda como calculamos a compatibilidade entre eleitor e candidato usando distância Euclidiana, escala Likert e fontes verificáveis.",
    },
  ];
}

export default function Methodology() {
  return (
    <div className="min-h-screen bg-background">
      <Header breadcrumbItems={[{ label: "Metodologia", active: true }]} />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-10">
        {/* Header */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-muted rounded-xl">
            <Scale className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Nossa Metodologia
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Transparência é a base da nossa plataforma. Entenda os critérios
            técnicos por trás de cada índice e classificação.
          </p>
        </section>

        {/* Likert Scale */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted shrink-0">
              <Ruler className="w-4 h-4 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Escala Likert de 5 Pontos
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cada posição política é mapeada em uma escala de 5 pontos que captura
            a intensidade do posicionamento:
          </p>
          <div className="grid grid-cols-5 gap-2">
            {[
              { value: 1, label: "Discorda Totalmente" },
              { value: 2, label: "Discorda" },
              { value: 3, label: "Neutro" },
              { value: 4, label: "Concorda" },
              { value: 5, label: "Concorda Totalmente" },
            ].map((item) => (
              <div
                key={item.value}
                className="rounded-md border bg-muted/30 p-2.5 text-center"
              >
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {item.value}
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            O quiz do eleitor e as posições dos candidatos utilizam a mesma escala,
            permitindo comparação direta.
          </p>
        </section>

        {/* Euclidean Distance */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted shrink-0">
              <Layers className="w-4 h-4 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Algoritmo de Distância Euclidiana
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para calcular a compatibilidade entre eleitor e candidato, utilizamos
            a distância Euclidiana ponderada. Este método mede a "distância" entre
            os vetores de posições políticas:
          </p>
          <div className="rounded-md border bg-muted/30 p-4">
            <p className="text-xs font-mono text-foreground/80 text-center">
              distância = |posição_eleitor - posição_candidato| / distância_máxima
            </p>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Por que Euclidiana?</strong>{" "}
              A distância Euclidiana produz resultados mais intuitivos do que
              alternativas como similaridade por cosseno, especialmente quando
              muitas posições estão próximas do centro — situação comum na
              política brasileira.
            </p>
            <p>
              <strong className="text-foreground">Posições ausentes:</strong>{" "}
              Quando um candidato não tem posição mapeada em um tema, aplicamos
              uma penalidade de incerteza (0.4 na escala de 0 a 1). O candidato
              não recebe crédito total por parecer "neutro" — mas também não é
              penalizado ao máximo. Cada resultado mostra a completude dos dados
              (ex: "Baseado em 15 de 20 perguntas").
            </p>
          </div>
        </section>

        {/* Importance Weighting */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted shrink-0">
              <Weight className="w-4 h-4 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Ponderação por Importância
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O quiz permite que o eleitor indique quais eixos temáticos são mais
            importantes para sua decisão. Cada eixo recebe um multiplicador:
          </p>
          <div className="grid sm:grid-cols-3 gap-2">
            {[
              { label: "Muito importante", weight: "1.5x" },
              { label: "Importante", weight: "1.0x" },
              { label: "Pouco importante", weight: "0.5x" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-md border bg-muted/30 p-3 text-center"
              >
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {item.weight}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Os 5 eixos temáticos são: Economia e Fiscal, Segurança Pública,
            Meio Ambiente e Agro, Direitos e Costumes, Democracia e Institucional.
          </p>
        </section>

        {/* Source Hierarchy */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted shrink-0">
              <FileSearch className="w-4 h-4 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Hierarquia de Fontes
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            As posições dos candidatos são mapeadas a partir de múltiplas fontes,
            priorizadas por confiabilidade:
          </p>
          <div className="space-y-1.5">
            {[
              {
                priority: 1,
                source: "Registro de votação",
                description: "Votos nominais em projetos de lei — maior confiabilidade",
              },
              {
                priority: 2,
                source: "Programa de governo",
                description: "Documento oficial registrado no TSE",
              },
              {
                priority: 3,
                source: "Declaração pública",
                description: "Posicionamentos em entrevistas, debates e redes sociais",
              },
              {
                priority: 4,
                source: "Entrevista",
                description: "Declarações em veículos de imprensa",
              },
              {
                priority: 5,
                source: "Análise editorial",
                description: "Classificação baseada em análise de padrões — menor confiabilidade",
              },
            ].map((item) => (
              <div
                key={item.priority}
                className="flex items-start gap-3 rounded-md border bg-muted/30 p-3"
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground tabular-nums">
                  {item.priority}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {item.source}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Cada posição na plataforma inclui a fonte e a data, permitindo que o
            eleitor avalie a confiabilidade por conta própria.
          </p>
        </section>

        {/* Bias Mitigation */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted shrink-0">
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Mitigação de Viés
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Adotamos princípios rigorosos para evitar viés na apresentação dos
            dados:
          </p>
          <div className="space-y-2">
            {[
              {
                title: "Sem cores indicativas",
                description:
                  "Posições não usam verde/vermelho para concordar/discordar. A visualização é neutra para todas as posições.",
              },
              {
                title: "Ordem aleatória",
                description:
                  "A ordem padrão dos candidatos é aleatorizada, não alfabética — evitando favorecimento por nome.",
              },
              {
                title: "Atribuição de fonte obrigatória",
                description:
                  "Toda posição exibida inclui a fonte verificável e a data da informação.",
              },
              {
                title: "Perguntas neutras",
                description:
                  "As perguntas do quiz apresentam ambos os lados igualmente, sem linguagem direcionada.",
              },
              {
                title: "Peso visual igual",
                description:
                  "Todas as posições na escala recebem o mesmo peso visual, sem destaque para extremos.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-foreground">
                  {item.title}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Data Sources */}
        <section className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted shrink-0">
              <Database className="w-4 h-4 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Fontes de Dados
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Consumimos exclusivamente dados oficiais de canais públicos:
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: "Portal de Dados Abertos — Câmara dos Deputados",
                url: "https://dadosabertos.camara.leg.br/",
              },
              {
                label: "Portal de Dados Abertos — Senado Federal",
                url: "https://www12.senado.leg.br/dados-abertos",
              },
              {
                label: "Tribunal Superior Eleitoral (TSE)",
                url: "https://dadosabertos.tse.jus.br/",
              },
            ].map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs rounded-md border bg-muted/30 px-3 py-2 text-foreground/80 hover:bg-muted transition-colors"
              >
                {source.label}
              </a>
            ))}
          </div>
          <div className="flex items-start gap-3 pt-3 border-t border-border/50">
            <ShieldCheck className="shrink-0 w-4 h-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground italic">
              O "Em Quem Votar?" é um projeto independente e não possui vínculo
              com órgãos governamentais ou partidos políticos. Nossa missão é
              puramente informativa.
            </p>
          </div>
        </section>

        {/* Contact */}
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground mb-2">
            Dúvidas ou sugestões sobre nossos critérios?
          </p>
          <a
            href="mailto:contato@emquemvotar.app"
            className="text-xs font-medium text-foreground hover:underline"
          >
            Fale com nossa equipe técnica
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
