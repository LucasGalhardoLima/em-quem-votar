import { Search, Gavel, BookOpen, Users, TrendingUp, Shield } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Busca inteligente",
    description: "Encontre políticos por nome, partido, estado ou posicionamento.",
  },
  {
    icon: Gavel,
    title: "Votações reais",
    description: "Veja como cada deputado votou nas propostas mais importantes.",
  },
  {
    icon: Users,
    title: "Compare candidatos",
    description: "Coloque políticos lado a lado e veja as diferenças.",
  },
  {
    icon: TrendingUp,
    title: "Match de afinidade",
    description: "Descubra sua compatibilidade com cada político.",
  },
  {
    icon: BookOpen,
    title: "Conteúdo educativo",
    description: "Aprenda sobre política de forma simples e direta.",
  },
  {
    icon: Shield,
    title: "Dados confiáveis",
    description: "Informações extraídas diretamente de fontes oficiais.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-24 md:py-32 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-brand-primary font-semibold text-sm uppercase tracking-wider mb-4">
            Recursos
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-brand-text leading-tight max-w-3xl mx-auto">
            Tudo que você precisa para
            <span className="text-brand-primary"> decidir bem.</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl border border-brand-structure hover:border-brand-primary/30 hover:shadow-lg hover:shadow-brand-primary/5 hover:-translate-y-1 transition-all bg-white"
            >
              <div className="w-14 h-14 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-6 group-hover:bg-brand-primary group-hover:scale-110 transition-all">
                <feature.icon className="w-7 h-7 text-brand-primary group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-heading text-lg font-bold text-brand-text mb-2">
                {feature.title}
              </h3>
              <p className="text-brand-text-alt text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
