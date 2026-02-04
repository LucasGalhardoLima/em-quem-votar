import { Check, Vote, BarChart3, Brain } from "lucide-react";

const steps = [
  {
    icon: Brain,
    title: "Responda ao quiz",
    description: "Questões simples sobre temas que importam para você.",
  },
  {
    icon: BarChart3,
    title: "Veja os dados reais",
    description: "Comparamos suas respostas com votos reais dos deputados.",
  },
  {
    icon: Vote,
    title: "Vote com confiança",
    description: "Descubra quem realmente representa seus valores.",
  },
];

export function SolutionSection() {
  return (
    <section className="py-24 md:py-32 px-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-brand-primary font-semibold text-sm uppercase tracking-wider mb-4">
            A solução
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-brand-text leading-tight">
            Seu voto, baseado em
            <span className="block text-brand-primary">fatos.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-brand-structure" />
              )}

              <div className="text-center">
                <div className="w-24 h-24 rounded-2xl bg-white border border-brand-structure shadow-sm flex items-center justify-center mx-auto mb-6 relative">
                  <step.icon className="w-10 h-10 text-brand-primary" />
                  <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-brand-primary text-white text-sm font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                </div>
                <h3 className="font-heading text-xl font-bold text-brand-text mb-3">
                  {step.title}
                </h3>
                <p className="text-brand-text-alt leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
