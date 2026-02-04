import { MessageSquareX, Puzzle, Clock } from "lucide-react";

const problems = [
  {
    title: "Promessas vazias",
    description: "Candidatos dizem o que você quer ouvir, mas votam diferente.",
    icon: MessageSquareX,
  },
  {
    title: "Informação fragmentada",
    description: "Dados espalhados em sites confusos e difíceis de interpretar.",
    icon: Puzzle,
  },
  {
    title: "Falta de tempo",
    description: "Pesquisar cada candidato leva horas que você não tem.",
    icon: Clock,
  },
];

export function ProblemSection() {
  return (
    <section className="py-24 md:py-32 px-4 bg-brand-text">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-brand-secondary font-semibold text-sm uppercase tracking-wider mb-4">
            O problema
          </p>
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-white leading-tight">
            Votar no escuro é um risco
            <span className="block text-white/60">que o Brasil não pode correr.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={index}
                className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-alert/20 flex items-center justify-center mb-6">
                  <Icon className="w-6 h-6 text-brand-alert" />
                </div>
                <h3 className="font-heading text-xl font-bold text-white mb-3">
                  {problem.title}
                </h3>
                <p className="text-white/60 leading-relaxed">
                  {problem.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
