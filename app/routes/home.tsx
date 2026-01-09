
import type { Route } from "./+types/home";
import { Search, ChevronDown, BookOpen, User, Gavel, Loader2, Sparkles, Mail } from "lucide-react";
import { Form, Link, useLoaderData, useNavigation, useFetcher, Await } from "react-router";
import { Suspense } from "react";
import { clsx } from "clsx";
import { ARTICLES } from "~/data/articles";
import { FEATURED_FILTERS } from "~/data/filters";
import { useEffect, useRef, useState } from "react";
import { PoliticianCardSkeleton, FeaturedVoteSkeleton } from "~/components/SkeletonLoader";
import { useFilterStore } from "~/stores/filterStore";

import { PoliticianService } from "~/services/politician.server";
import { BillService } from "~/services/bill.server";

import { NewsletterForm } from "~/components/NewsletterForm";

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

  // Fetch featured votes immediately as they are fast and needed for the home page layout
  // Only fetch them on the first load (to keep it fast)
  const featuredVotesPromise = (!query && !tagsParam) ? BillService.listFeatured([
    "2196833-326", // Reforma Tributária
    "345311-270",  // Marco Temporal
    "2357053-47",  // Arcabouço Fiscal
    "2423268-40",  // Prisão Chiquinho Brazão
    "2194899-103", // PEC da Transição
    "2310837-8",   // PL Fake News
    "2270789-73"   // Eletrobras
  ]) : Promise.resolve([]);

  // Data promise for results
  const resultsPromise = (query || tagsParam) ? PoliticianService.list({
    query,
    tags: tagsParam ? tagsParam.split(",") : null,
    offset,
    limit
  }) : Promise.resolve({ items: [], hasMore: false });

  return {
    results: resultsPromise,
    featuredVotes: featuredVotesPromise,
    query,
    tagsParam,
    offset
  };
}



export default function Home() {
  const { featuredVotes: deferredVotes } = useLoaderData<typeof loader>();
  const { selectedTags, setTags } = useFilterStore();

  useEffect(() => {
    setTags([]);
  }, [setTags]);

  const handleScrollToContent = () => {
    document.getElementById("content")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col justify-center items-center px-4 relative pt-20 pb-10">
        <div className="w-full max-w-7xl flex flex-col items-center text-center space-y-8 animate-fade-in-up">



          <div className="space-y-6 max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 leading-tight">
              Em quem <span className="text-blue-600">votar?</span>
            </h1>
            <p className="text-xl text-gray-600 font-medium leading-relaxed">
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
                placeholder="Busque por nome, partido ou estado..."
                className="w-full pl-14 pr-6 py-5 bg-white border border-gray-200 rounded-2xl shadow-lg shadow-blue-900/5 text-lg placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all hover:shadow-xl hover:-translate-y-0.5"
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
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                    )}
                  >
                    {filter.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
              <div className="h-px bg-gray-200 w-full"></div>
              <span className="shrink-0 px-2">ou se preferir</span>
              <div className="h-px bg-gray-200 w-full"></div>
            </div>

            <Link
              to="/quiz"
              prefetch="intent"
              className="group w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-black hover:shadow-xl hover:-translate-y-0.5 transition-all text-center"
            >
              <Sparkles className="text-yellow-400 group-hover:rotate-12 transition-transform" />
              Fazer Quiz de Afinidade
            </Link>
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
      <section className="py-24 px-4 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
              <Gavel className="w-8 h-8 text-blue-600" />
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
                {(resolvedVotes: any[]) => (
                  <>
                    {resolvedVotes.map((vote) => (
                      <Link
                        key={vote.id}
                        to={`/votacao/${vote.id}`}
                        prefetch="intent"
                        className="group bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 cursor-pointer flex flex-col min-h-[260px] h-full"
                      >
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="inline-block px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold tracking-wide uppercase">
                              Votação Nominal
                            </span>
                            <span className="text-xs text-gray-400 font-medium">
                              {new Date(vote.voteDate).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                            {vote.title}
                          </h3>
                          {vote.description && (
                            <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                              {vote.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center text-blue-600 font-medium group/link mt-4">
                          Ver votos
                          <svg className="w-4 h-4 ml-2 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </Await>
            </Suspense>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-24 px-4 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
              <Mail className="w-8 h-8 text-blue-600" />
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
      <section id="content" className="py-24 px-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
              <BookOpen className="w-8 h-8 text-blue-600" />
              Conteúdo Educacional
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Informação é poder. Prepare-se para exercer sua cidadania com consciência.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {ARTICLES.map((article) => (
              <Link
                to={`/educacao/${article.slug}`}
                key={article.slug}
                prefetch="intent"
                className="group bg-gray-50 rounded-2xl p-8 hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 cursor-pointer flex flex-col"
              >
                <div className="flex-grow">
                  <span className="inline-block px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold tracking-wide uppercase mb-4">
                    {article.category}
                  </span>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-6 line-clamp-3">
                    {article.excerpt}
                  </p>
                </div>
                <div className="flex items-center text-blue-600 font-medium group/link">
                  Ler artigo
                  <svg className="w-4 h-4 ml-2 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="text-center mt-24 text-gray-400 text-sm">
          &copy; 2026 Em Quem Votar. MVP Project.
        </div>
      </section>
    </div>
  );
}
