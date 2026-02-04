import { Link } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 md:py-32 px-4 bg-brand-text relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-primary rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-secondary rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="font-heading text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
          Pronto para votar
          <span className="block text-brand-secondary">com consciência?</span>
        </h2>
        <p className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Em menos de 5 minutos, descubra quais políticos realmente representam seus valores.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/quiz"
            prefetch="intent"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-white text-brand-text px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <Sparkles className="w-5 h-5 text-brand-primary group-hover:rotate-12 transition-transform" />
            Começar o Quiz
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/busca"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-semibold text-white/80 hover:text-white border-2 border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
          >
            Explorar deputados
          </Link>
        </div>

        <p className="text-white/40 text-sm mt-12">
          Sem cadastro. Sem rastreamento. 100% gratuito.
        </p>
      </div>
    </section>
  );
}
