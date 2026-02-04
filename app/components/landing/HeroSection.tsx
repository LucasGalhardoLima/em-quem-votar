import { Link } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";

export function HeroSection() {
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
            Descubra quais políticos realmente representam seus valores.
            Baseado em <span className="font-semibold text-brand-text">votos reais</span>, não promessas.
          </p>
        </div>

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
            to="/busca"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-brand-text-alt hover:text-brand-primary border-2 border-transparent hover:border-brand-primary/20 hover:bg-brand-primary/5 transition-all"
          >
            Explorar políticos
          </Link>
        </div>

        {/* Trust indicator */}
        <p className="text-sm text-brand-text-alt/60 pt-8">
          Dados públicos da Câmara dos Deputados
        </p>
      </div>
    </section>
  );
}
