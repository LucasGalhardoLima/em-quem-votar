import { Users, Gavel, FileText, TrendingUp } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: "513",
    label: "Deputados federais",
    sublabel: "com dados completos",
  },
  {
    icon: Gavel,
    value: "500+",
    label: "Votações analisadas",
    sublabel: "em temas cruciais",
  },
  {
    icon: FileText,
    value: "50+",
    label: "Posicionamentos",
    sublabel: "mapeados por político",
  },
  {
    icon: TrendingUp,
    value: "100%",
    label: "Dados públicos",
    sublabel: "da Câmara dos Deputados",
  },
];

export function SocialProof() {
  return (
    <section className="py-24 md:py-32 px-4 bg-gray-50 border-y border-brand-structure">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-brand-text">
            Transparência em números
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-brand-structure shadow-sm flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-8 h-8 text-brand-primary" />
              </div>
              <div className="font-heading text-4xl md:text-5xl font-bold text-brand-text mb-2">
                {stat.value}
              </div>
              <div className="text-brand-text font-semibold">
                {stat.label}
              </div>
              <div className="text-brand-text-alt text-sm">
                {stat.sublabel}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
