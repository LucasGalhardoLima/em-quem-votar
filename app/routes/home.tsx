import type { Route } from "./+types/home";
import { Search, ChevronDown, BookOpen, User, Gavel, Loader2, Sparkles, Mail, ArrowRight, Trophy, LogIn, LogOut } from "lucide-react";
import { redirect, Form, Link, useLoaderData, useNavigation, useFetcher, Await } from "react-router";
import { Footer } from "~/components/Footer";
import { Suspense, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { FEATURED_FILTERS } from "~/data/filters";
import { PoliticianCardSkeleton, FeaturedVoteSkeleton } from "~/components/SkeletonLoader";
import { useFilterStore } from "~/stores/filterStore";
import { PoliticianService } from "~/services/politician.server";
import { BillService } from "~/services/bill.server";
import { ArticleService } from "~/services/article.server";
import { MatchService } from "~/services/match.server";
import { NewsletterForm } from "~/components/NewsletterForm";
import { createSupabaseServerClient } from "~/utils/supabase.server";
import { db } from "~/utils/db.server";
import { LoginModal } from "~/components/LoginModal";
import { createBrowserClient } from "@supabase/ssr";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Em Quem Votar?" },
    { name: "description", content: "Encontre o candidato ideal para você." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const tagsParam = url.searchParams.get("tags");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const limit = 20;

  // 1. Start fetching content immediately (Non-blocking)
  const featuredVotesPromise = (!query && !tagsParam) ? BillService.listFeatured([
    "2196833-326", // Reforma Tributária
    "345311-270",  // Marco Temporal
    "2357053-47",  // Arcabouço Fiscal
    "2423268-40",  // Prisão Chiquinho Brazão
    "2194899-103", // PEC da Transição
    "2310837-8",   // PL Fake News
    "2270789-73"   // Eletrobras
  ]) : Promise.resolve([]);

  const articlesPromise = (!query && !tagsParam) ? ArticleService.list(6) : Promise.resolve([]);

  const resultsPromise = (query || tagsParam) ? PoliticianService.list({
    query,
    tags: tagsParam ? tagsParam.split(",") : null,
    offset,
    limit
  }) : Promise.resolve({ items: [], hasMore: false });

  // 2. Perform Auth Verification (Concurrent with above)
  const { supabase } = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  const session = user ? { user } : null;
  let topMatch = null;

  // 3. Fetch User-Specific Data if Logged In
  if (session?.user && !query && !tagsParam) {
    const profile = await db.userProfile.findUnique({
      where: { id: session.user.id },
      select: { quizAnswers: true }
    });

    if (!profile?.quizAnswers || Object.keys(profile.quizAnswers as object).length === 0) {
      return redirect("/quiz");
    }

    if (profile?.quizAnswers && Object.keys(profile.quizAnswers as object).length > 0) {
      const { topPoliticians } = await MatchService.calculate(profile.quizAnswers as Record<string, number>);
      if (topPoliticians.length > 0) {
        topMatch = topPoliticians[0];
      }
    }
  }

  return {
    results: resultsPromise,
    featuredVotes: featuredVotesPromise,
    articles: articlesPromise,
    query,
    tagsParam,
    offset,
    topMatch,
    session
  };
}

export default function Home() {
  const { featuredVotes: deferredVotes, articles: deferredArticles, topMatch, session } = useLoaderData<typeof loader>();
  const { selectedTags, setTags } = useFilterStore();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const supabase = createBrowserClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  useEffect(() => {
    setTags([]);
  }, [setTags]);

  const handleScrollToContent = () => {
    document.getElementById("content")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-brand-primary/20 selection:text-brand-primary overflow-x-hidden">
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />

      {/* Top Right Auth Section */}
      <div className="fixed top-4 right-4 z-50 animate-fade-in">
        {session ? (
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md pl-2 pr-2 py-1.5 rounded-full border border-gray-100 shadow-xl ring-1 ring-black/5 group transition-all">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white overflow-hidden shadow-sm">
                {session.user.user_metadata?.avatar_url ? (
                  <img src={session.user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={16} />
                )}
              </div>
              <span className="text-sm font-bold text-gray-700 hidden sm:block">
                {session.user.user_metadata?.full_name?.split(' ')[0] || "Usuário"}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsLoginOpen(true)}
            className="text-sm font-bold text-gray-500 hover:text-brand-primary transition-all active:scale-95 bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-sm border border-gray-100"
          >
            Entrar
          </button>
        )}
      </div>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center items-center px-4 relative pt-24 pb-12">
        <div className="w-full max-w-7xl flex flex-col items-center text-center space-y-6 md:space-y-8 animate-fade-in-up">

          <div className="space-y-4 md:space-y-6 max-w-3xl">
            <h1 className="text-4xl md:text-7xl font-bold tracking-tight text-gray-900 leading-tight">
              Em quem <span className="text-brand-primary">votar?</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 font-medium leading-relaxed px-4">
              Não vote no escuro. Descubra quais políticos realmente representam os seus valores com base em <span className="font-bold text-gray-900">fatos</span>, não discurso.
            </p>
          </div>

          <div className="w-full max-w-2xl space-y-6">
            <Form action="/busca" method="get" className="w-full relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Search className="w-6 h-6" />
              </div>
              <input
                type="text"
                name="q"
                placeholder="Busque por nome..."
                className="w-full pl-12 pr-6 py-4 md:py-5 bg-white border border-gray-200 rounded-2xl shadow-lg shadow-brand-primary/5 text-base md:text-lg placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary transition-all hover:shadow-xl hover:-translate-y-0.5"
              />
            </Form>

            <div className="flex flex-wrap justify-center gap-2">
              {FEATURED_FILTERS.map((filter) => {
                const isSelected = selectedTags.includes(filter.slug);
                return (
                  <Link
                    key={filter.slug}
                    to={`/busca?tags=${filter.slug}`}
                    className={clsx(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                      isSelected
                        ? "bg-brand-primary text-white border-brand-primary hover:bg-brand-primary/90"
                        : "bg-white text-brand-text border-gray-200 hover:bg-brand-tertiary hover:border-brand-primary/30 hover:text-white"
                    )}
                  >
                    {filter.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
              <div className="h-px bg-gray-200 flex-1"></div>
              <span className="shrink-0 px-2">ou se preferir</span>
              <div className="h-px bg-gray-200 flex-1"></div>
            </div>

            {topMatch ? (
              <Link
                to={`/resultado`}
                className="group w-full flex items-center justify-between gap-4 bg-white border-2 border-brand-secondary/20 p-4 rounded-3xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-left relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-brand-secondary/5 to-transparent"></div>

                <div className="flex items-center gap-4 z-10">
                  <div className="w-16 h-16 rounded-full border-2 border-brand-secondary shadow-sm overflow-hidden flex-shrink-0">
                    {topMatch.politician.photoUrl ? (
                      <img src={topMatch.politician.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 m-auto text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-brand-secondary uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Trophy size={12} />
                      Seu Match do Dia
                    </div>
                    <div className="font-bold text-gray-900 text-lg leading-tight">
                      {topMatch.politician.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {topMatch.percentage}% de compatibilidade
                    </div>
                  </div>
                </div>

                <div className="w-12 h-12 bg-brand-secondary text-white rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform z-10">
                  <ArrowRight size={24} />
                </div>
              </Link>
            ) : (
              <Link
                to="/quiz"
                prefetch="intent"
                className="group w-full flex items-center justify-center gap-3 bg-brand-text text-white py-4 rounded-xl md:rounded-2xl font-bold text-base md:text-lg shadow-lg hover:bg-black hover:shadow-xl hover:-translate-y-0.5 transition-all text-center"
              >
                <Sparkles className="text-brand-secondary group-hover:rotate-12 transition-transform" />
                Fazer Quiz de Afinidade
              </Link>
            )}

          </div>
        </div>

        <button
          onClick={handleScrollToContent}
          className="absolute bottom-8 cursor-pointer animate-bounce text-gray-400 hover:text-blue-600 transition-colors"
          aria-label="Rolar para conteúdo"
        >
          <ChevronDown className="w-8 h-8" />
        </button>
      </section>

      {/* Key Votes Section */}
      <section className="py-16 md:py-24 px-4 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-brand-text flex items-center justify-center gap-3">
              <Gavel className="w-8 h-8 text-brand-primary" />
              Votações Decisivas
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Acompanhe como cada deputado votou nas propostas mais importantes para o país.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Suspense
              fallback={
                Array.from({ length: 3 }).map((_, i) => (
                  <FeaturedVoteSkeleton key={i} />
                ))
              }
            >
              <Await resolve={deferredVotes}>
                {(resolvedVotes: any[]) => {
                  const votes = (resolvedVotes || []).slice(0, 3);
                  return (
                    <>
                      {votes.map((vote) => (
                        <Link
                          key={vote.id}
                          to={`/votacao/${vote.id}`}
                          prefetch="intent"
                          className="group bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 cursor-pointer flex flex-col min-h-[260px] h-full"
                        >
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-4">
                              <span className="inline-block px-3 py-1 rounded-lg bg-brand-primary-light text-brand-primary text-xs font-semibold tracking-wide uppercase">
                                Votação Nominal
                              </span>
                              <span className="text-xs text-gray-400 font-medium">
                                {new Date(vote.voteDate).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            <h3 className="text-xl font-bold text-brand-text mb-3 group-hover:text-brand-primary transition-colors">
                              {vote.title}
                            </h3>
                            {vote.description && (
                              <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                                {vote.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center text-brand-primary font-medium group/link mt-4">
                            Ver votos
                            <svg className="w-4 h-4 ml-2 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </>
                  );
                }}
              </Await>
            </Suspense>
          </div>

          {/* View All Votes Button */}
          <div className="flex justify-center pt-8">
            <Link
              to="/votacoes"
              className="flex items-center gap-2 px-8 py-4 bg-white border-2 border-brand-primary/20 text-brand-primary font-bold rounded-2xl hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all shadow-sm hover:shadow-md"
            >
              Ver todas as votações
              <Gavel className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 md:py-24 px-4 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-brand-text flex items-center justify-center gap-3">
              <Mail className="w-8 h-8 text-brand-primary" />
              Mantenha-se Informado
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Receba alertas sobre votações decisivas e novos recursos diretamente no seu e-mail.
            </p>
          </div>
          <NewsletterForm variant="minimal" />
        </div>
      </section>

      {/* Educational Content */}
      <section id="content" className="py-16 md:py-24 px-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-brand-text flex items-center justify-center gap-3">
              <BookOpen className="w-8 h-8 text-brand-primary" />
              Conteúdo Educacional
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Informação é poder. Prepare-se para exercer sua cidadania com consciência.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Suspense fallback={<div className="col-span-3 text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-primary" /></div>}>
              <Await resolve={deferredArticles}>
                {(articles) => (
                  <>
                    {articles.map((article: any) => (
                      <Link
                        to={`/${article.slug}`}
                        key={article.slug}
                        prefetch="intent"
                        className="group bg-white rounded-2xl p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-brand-primary/20 cursor-pointer flex flex-col h-full hover:-translate-y-1"
                      >
                        <div className="flex-grow space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="p-2 rounded-xl bg-brand-primary/5 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                              <BookOpen size={20} />
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-secondary/10 text-brand-secondary uppercase tracking-tight">
                              {article.category}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-brand-text mb-2 group-hover:text-brand-primary transition-colors line-clamp-2 leading-snug">
                              {article.title}
                            </h3>
                            <p className="text-gray-500 leading-relaxed line-clamp-2 text-xs">
                              {article.excerpt}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-6 text-brand-primary font-bold text-xs group/link">
                          <div className="flex items-center gap-2 text-gray-400 font-medium">
                            <span>{article.readTime}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            Ler artigo
                            <ArrowRight size={14} className="transform group-hover/link:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </Await>
            </Suspense>
          </div>

          {/* View All Articles Button */}
          <div className="flex justify-center pt-4">
            <Link
              to="/educacao"
              className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 hover:text-brand-primary hover:border-brand-primary/30 transition-all shadow-sm"
            >
              Ver toda a parte de educação
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

      </section>
      <Footer />
    </div>
  );
}
