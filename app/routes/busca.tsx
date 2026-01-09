
import type { Route } from "./+types/busca";
import { Form, Link, useLoaderData, useNavigation, useSubmit, useFetcher, Await } from "react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { Search, Loader2, User, SlidersHorizontal, Check } from "lucide-react";
import { toast } from "sonner";
import { PoliticianCardSkeleton } from "~/components/SkeletonLoader";
import { useFilterStore } from "~/stores/filterStore";
import { FilterSidebar } from "~/components/FilterSidebar";
import { Header } from "~/components/Header";
import { TagWithTooltip } from "~/components/TagWithTooltip";
import { ComparisonFloatingBar } from "~/components/ComparisonFloatingBar";
import { useComparisonStore } from "~/stores/comparisonStore";
import { NewsletterForm } from "~/components/NewsletterForm";
import { AnimatePresence, motion } from "framer-motion";
import { MobileFilterDrawer } from "~/components/MobileFilterDrawer";
import { ActiveFilters } from "~/components/ActiveFilters";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Busca de Políticos | Em Quem Votar" },
    { name: "description", content: "Filtre e encontre parlamentares com base em seus votos e posicionamentos." },
  ];
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return {
    "Cache-Control": "public, max-age=60, s-maxage=60",
  };
}

// ... (imports)
import { PoliticianService } from "~/services/politician.server";
import { PoliticianCard } from "~/components/PoliticianCard";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const tagsParam = url.searchParams.get("tags");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const limit = 20;

  const resultsPromise = PoliticianService.list({
    query,
    tags: tagsParam ? tagsParam.split(",") : null,
    offset,
    limit
  });

  return {
    results: resultsPromise,
    query,
    tagsParam,
    offset
  };
}


// ... inside Busca component ...

export default function Busca() {
  const { results: deferredResults, query, tagsParam } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const fetcher = useFetcher<typeof loader>();
  const [allResults, setAllResults] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { setTags } = useFilterStore();
  const { toggleId, isSelected } = useComparisonStore();

  useEffect(() => {
    if (tagsParam) {
      setTags(tagsParam.split(","));
    } else {
      setTags([]);
    }
  }, [tagsParam, setTags]);

  // 1. Sync initial results
  useEffect(() => {
    Promise.resolve(deferredResults).then(data => {
      setAllResults(data.items);
      setHasMore(data.hasMore);
    });
  }, [deferredResults]);

  // 2. Handle fetcher updates (Infinite Scroll)
  useEffect(() => {
    if (fetcher.data?.results && fetcher.state === "idle") {
      Promise.resolve(fetcher.data.results).then((data: any) => {
        setAllResults(prev => [...prev, ...data.items]);
        setHasMore(data.hasMore);
      });
    }
  }, [fetcher.data, fetcher.state]);

  // 3. Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && fetcher.state === "idle") {
          const params = new URLSearchParams();
          if (query) params.set("q", query);
          if (tagsParam) params.set("tags", tagsParam);
          params.set("offset", String(allResults.length));

          fetcher.load(`/busca?${params.toString()}`);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, fetcher.state, query, tagsParam, allResults.length]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">

          {/* Mobile Filter Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setShowMobileFilters(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 font-medium w-full justify-center active:scale-[0.98] transition-transform"
            >
              <SlidersHorizontal size={18} />
              Filtros
            </button>
            <MobileFilterDrawer
              isOpen={showMobileFilters}
              onClose={() => setShowMobileFilters(false)}
              query={query}
            />
          </div>

          {/* Sidebar (Desktop) */}
          <div className="hidden md:block">
            <FilterSidebar query={query} />
          </div>

          <div className="flex-1 space-y-6">
            {/* Search Bar */}
            <Form method="get" action="/busca" className="w-full relative group" onChange={(e) => submit(e.currentTarget, { replace: true })}>
              <input type="hidden" name="tags" value={tagsParam || ""} />
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                name="q"
                defaultValue={query || ""}
                placeholder="Busque por nome, partido..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </Form>

            {/* Active Filters Display */}
            <ActiveFilters query={query} />

            {/* Results Grid */}
            <div id="results" className="w-full space-y-4">
              <Suspense
                fallback={
                  <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 w-full">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <PoliticianCardSkeleton key={i} />
                    ))}
                  </div>
                }
              >
                <Await resolve={deferredResults}>
                  {(resolvedResults: any) => {
                    const isLoading = useNavigation().state === "loading";

                    if (isLoading) {
                      return (
                        <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 w-full">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <PoliticianCardSkeleton key={i} />
                          ))}
                        </div>
                      )
                    }

                    return (
                      <>
                        {resolvedResults.items.length > 0 ? (
                          <>
                            <motion.div
                              variants={container}
                              initial="hidden"
                              animate="show"
                              className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 w-full"
                            >
                              {allResults.map((politician) => (
                                <PoliticianCard
                                  key={politician.id}
                                  politician={politician}
                                  variants={item}
                                />
                              ))}
                            </motion.div>

                            {/* Infinite scroll trigger */}
                            <div ref={observerTarget} className="h-20 flex items-center justify-center">
                              {
                                fetcher.state === "loading" && (
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Carregando mais...</span>
                                  </div>
                                )
                              }
                            </div>
                          </>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-20 px-4 bg-white rounded-2xl border border-gray-100 shadow-sm mx-auto max-w-lg mt-8"
                          >
                            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                              <User className="w-10 h-10 text-blue-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Nenhum político encontrado</h3>
                            <p className="text-gray-500 mb-6 leading-relaxed">
                              Não encontramos nenhum parlamentar que corresponda a <strong>todos</strong> os filtros selecionados simultaneamente.
                            </p>
                            <div className="bg-yellow-50 text-yellow-800 text-sm p-4 rounded-xl text-left mb-6">
                              <strong>Dica:</strong> Tente remover alguns filtros. Por exemplo, é raro encontrar alguém que seja "Comunista" e "Ruralista" ao mesmo tempo.
                            </div>
                            <button onClick={() => { setTags([]); submit(null, { action: "/busca" }); }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">
                              Limpar todos os filtros
                            </button>
                          </motion.div>
                        )}
                      </>
                    );
                  }}
                </Await>
              </Suspense>
            </div>

          </div>
        </div>
      </main>
      <ComparisonFloatingBar />
    </div>
  );
}
