
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
  let query = url.searchParams.get("q");
  const tagsParam = url.searchParams.get("tags");

  // Standard Params
  let stateParam = url.searchParams.get("uf")?.split(",").filter(Boolean) || [];
  let partyParam = url.searchParams.get("partido")?.split(",").filter(Boolean) || [];

  const offset = parseInt(url.searchParams.get("offset") || "0");
  const limit = 20;

  // Complex Search Parser (The "Hacker Mode")
  // If 'q' contains ';', we attempt to parse it into structured filters
  if (query && query.includes(";")) {
    const parts = query.split(";").map(p => p.trim()).filter(Boolean);
    let newQuery = "";

    // We allow the user to type "SP" or "PL" and try to guess.
    // Ideally we match against actual lists, but for now heuristics:
    for (const part of parts) {
      const upper = part.toUpperCase();
      // State Heuristic: 2 chars
      if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
        stateParam.push(upper);
      }
      // Party Heuristic: 2-6 chars, mostly letters? Or we just treat as generic query if unknown?
      // Let's assume if it looks like a party (UPPERCASE) and isn't a state, it's a party preference.
      // But "ABC" could be part of a name.
      // For safety: if it matches a known party list it's better. 
      // We'll fetch filters anyway, let's look.
      // Actually, simplified: If it's not a state, treat as Party if short, otherwise text?
      // Let's simple-parse: If it's 2 chars -> State. Else -> Party if < 10 chars? 
      // Or just assume text search for name if not state.
      // User requirement: "novato; baixo custo; PL".
      // "novato" -> Tag. "baixo custo" -> Tag (mapped). "PL" -> Party.
      else {
        // Check if it's a known tag?
        // Complex. For now, let's handle "Parties" roughly or just add to Name Query if logic fails.
        // Let's prioritize Name/Party mixed search in 'query' field of list() service?
        // No, list() splits query vs party.

        // Heuristic: If < 6 chars and no spaces, try as Party.
        if (!part.includes(" ") && part.length < 8) {
          partyParam.push(upper);
        } else {
          // Check for tags? (We need to look up slugs? Too expensive here?)
          // User said "novato" -> Tag.
          // We will keep it as text query to be safe, unless we implement a full parser.
          // For MVP Phase 2, let's treat non-state parts as "Query" (Name/Party text search handles both).
          // Wait, user specifically said "PL" -> Party.
          // PoliticianService.list ORs name/party in 'query'. So adding "PL" to query works!
          // But "novato" is a tag.
          // Let's just append to newQuery.
          newQuery += (newQuery ? " " : "") + part;
        }
      }
    }
    query = newQuery || null; // If parsed everything into filters, query is empty
  }

  // Fetch available filters for Sidebar
  const filtersPromise = PoliticianService.getFilters();

  const resultsPromise = PoliticianService.list({
    query,
    tags: tagsParam ? tagsParam.split(",") : null,
    state: stateParam.length > 0 ? stateParam : null,
    party: partyParam.length > 0 ? partyParam : null,
    offset,
    limit
  });

  return {
    results: resultsPromise,
    filters: filtersPromise,
    query,
    tagsParam,
    stateParam,
    partyParam,
    offset
  };
}


// ... inside Busca component ...

export default function Busca() {
  const { results: deferredResults, filters: deferredFilters, query, tagsParam, stateParam, partyParam } = useLoaderData<typeof loader>();
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
            <Suspense fallback={<div className="w-64 bg-gray-100 h-screen animate-pulse rounded-xl" />}>
              <Await resolve={deferredFilters}>
                {(filters) => (
                  <FilterSidebar
                    query={query}
                    filters={filters}
                    activeStates={stateParam}
                    activeParties={partyParam}
                  />
                )}
              </Await>
            </Suspense>
          </div>

          <div className="flex-1 space-y-6">
            {/* Search Bar */}
            <Form method="get" action="/busca" className="w-full relative group" onChange={(e) => submit(e.currentTarget, { replace: true })}>
              <input type="hidden" name="tags" value={tagsParam || ""} />
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-primary transition-colors">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                name="q"
                defaultValue={query || ""}
                placeholder="Busque por nome, partido..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
              />
            </Form>

            {/* Active Filters Display */}
            <ActiveFilters query={query} tags={tagsParam ? tagsParam.split(',') : []} states={stateParam} parties={partyParam} />

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
                            <div className="bg-brand-primary-light w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                              <User className="w-10 h-10 text-brand-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Nenhum político encontrado</h3>
                            <p className="text-gray-500 mb-6 leading-relaxed">
                              Não encontramos nenhum parlamentar que corresponda a <strong>todos</strong> os filtros selecionados simultaneamente.
                            </p>
                            <div className="bg-yellow-50 text-yellow-800 text-sm p-4 rounded-xl text-left mb-6">
                              <strong>Dica:</strong> Tente remover alguns filtros. Por exemplo, é raro encontrar alguém que seja "Comunista" e "Ruralista" ao mesmo tempo.
                            </div>
                            <button onClick={() => { setTags([]); submit(null, { action: "/busca" }); }} className="w-full py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold transition-colors">
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
