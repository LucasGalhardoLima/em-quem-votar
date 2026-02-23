import { Link } from "react-router";
import { ArrowRight, Sparkles, Calendar } from "lucide-react";

function getElectionCountdown() {
  // Brazil 2026 presidential election: first round October 4, 2026
  const electionDate = new Date("2026-10-04T00:00:00-03:00");
  const now = new Date();
  const diff = electionDate.getTime() - now.getTime();
  const daysUntil = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  return daysUntil;
}

export function HeroSection() {
  const daysUntil = getElectionCountdown();

  return (
    <section className="min-h-[90vh] flex flex-col justify-center items-center px-4 relative">
      <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/5 border border-brand-primary/10 text-brand-primary text-sm font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
          </span>
          Eleições 2026
        </div>

        {/* Headline */}
        <div className="space-y-6">
          <h1 className="font-heading text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-brand-text leading-[1.1]">
            Vote com
            <span className="block text-brand-primary">consciência.</span>
          </h1>
          <p className="text-lg md:text-xl text-brand-text-alt max-w-2xl mx-auto leading-relaxed">
            Compare candidatos à presidência com base em{" "}
            <span className="font-semibold text-brand-text">
              posições reais
            </span>
            , votações e gastos públicos. Sem viés, sem propaganda.
          </p>
        </div>

        {/* Countdown */}
        {daysUntil > 0 && (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted/80 border border-border/50 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              <span className="font-bold text-foreground">{daysUntil}</span> dias
              para o 1.º turno
            </span>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          <Link
            to="/quiz"
            prefetch="intent"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-brand-text text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-text/10 hover:bg-black hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <Sparkles className="w-5 h-5 text-brand-secondary group-hover:rotate-12 transition-transform" />
            Fazer o Quiz
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/candidatos"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-brand-text-alt hover:text-brand-primary border-2 border-transparent hover:border-brand-primary/20 hover:bg-brand-primary/5 transition-all"
          >
            Explorar candidatos
          </Link>
        </div>

        {/* Trust indicator */}
        <p className="text-sm text-brand-text-alt/60 pt-8">
          Dados públicos da Câmara, Senado e TSE
        </p>
      </div>
    </section>
  );
}
