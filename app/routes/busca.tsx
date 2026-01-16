
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

// Helper to identify tags from search parts
const KNOWN_TAG_MAP: Record<string, string> = {
  "novato": "novato",
  "veterano": "veterano",
  "baixo custo": "baixo-custo",
  "alto custo": "gastao",
  "gastador": "gastao",
  "reformista": "reformista-economico",
  "ruralista": "ruralista",
  "ambientalista": "ambientalista",
  "rigoroso": "rigoroso",
  "garantista": "garantista",
  "conservador": "conservador-costumes",
  "progressista": "progressista-costumes",
  "assíduo": "assiduo",
  "assiduo": "assiduo",
  "ausente": "ausente"
};

const STATE_NAME_MAP: Record<string, string> = {
  "acre": "AC", "alagoas": "AL", "mapa": "AP", "amapa": "AP", "amazonas": "AM",
  "bahia": "BA", "ceara": "CE", "ceará": "CE", "distrito federal": "DF",
  "espirito santo": "ES", "espírito santo": "ES", "goias": "GO", "goiás": "GO",
  "maranhao": "MA", "maranhão": "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", "minas": "MG", "para": "PA", "pará": "PA", "paraiba": "PB",
  "paraíba": "PB", "parana": "PR", "paraná": "PR", "pernambuco": "PE", "piaui": "PI",
  "piauí": "PI", "rio de janeiro": "RJ", "rio": "RJ", "rio grande do norte": "RN",
  "rio grande do sul": "RS", "rondonia": "RO", "rondônia": "RO", "roraima": "RR",
  "santa catarina": "SC", "sao paulo": "SP", "são paulo": "SP", "sergipe": "SE",
  "tocantins": "TO"
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  let query = url.searchParams.get("q");
  const tagsParam = url.searchParams.get("tags");

  // Standard Params
  let stateParam = url.searchParams.get("uf")?.split(",").filter(Boolean) || [];
  let partyParam = url.searchParams.get("partido")?.split(",").filter(Boolean) || [];
  let tagsList = tagsParam?.split(",").filter(Boolean) || [];

  const offset = parseInt(url.searchParams.get("offset") || "0");
  const limit = 20;

  // Fetch available filters early for Parser Intelligence
  const filters = await PoliticianService.getFilters();
  const validParties = new Set(filters.parties.map(p => p.toUpperCase()));
  const validUFs = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ]);

  // Complex Search Parser (The "Hacker Mode")
  if (query && query.includes(";")) {
    const parts = query.split(";").map(p => p.trim()).filter(Boolean);
    let newQueryParts: string[] = [];

    for (const part of parts) {
      const lower = part.toLowerCase();
      const upper = part.toUpperCase();

      // 1. Check for explicit prefixes (Highest Priority)
      if (lower.startsWith("uf:") || lower.startsWith("estado:")) {
        const val = upper.split(":")[1]?.trim();
        if (val && validUFs.has(val)) {
          stateParam.push(val);
        } else {
          // Try to map name to code if prefix used with name (e.g. uf: São Paulo)
          const nameVal = lower.split(":")[1]?.trim();
          if (nameVal && STATE_NAME_MAP[nameVal]) {
            stateParam.push(STATE_NAME_MAP[nameVal]);
          }
        }
        continue;
      }
      if (lower.startsWith("partido:")) {
        const val = upper.split(":")[1]?.trim();
        if (val && validParties.has(val)) partyParam.push(val);
        continue;
      }
      if (lower.startsWith("perfil:") || lower.startsWith("tag:")) {
        const val = lower.split(":")[1]?.trim();
        if (val && KNOWN_TAG_MAP[val]) {
          tagsList.push(KNOWN_TAG_MAP[val]);
        } else if (val) {
          tagsList.push(val);
        }
        continue;
      }

      // 2. Heuristics (Natural Search)

      // A. Check for States (Code or Full Name)
      if (upper.length === 2 && validUFs.has(upper)) {
        stateParam.push(upper);
      }
      else if (STATE_NAME_MAP[lower]) {
        stateParam.push(STATE_NAME_MAP[lower]);
      }

      // B. Check for Parties
      else if (validParties.has(upper)) {
        partyParam.push(upper);
      }

      // C. Check for Tags
      else if (KNOWN_TAG_MAP[lower]) {
        tagsList.push(KNOWN_TAG_MAP[lower]);
      }

      // D. Fallback -> General Text Query
      else {
        newQueryParts.push(part);
      }
    }
    // Update query to ONLY contain the parts that weren't parsed into structured filters
    query = newQueryParts.join(" ") || null;
  }

  const resultsPromise = PoliticianService.list({
    query,
    tags: tagsList.length > 0 ? tagsList : null,
    state: stateParam.length > 0 ? stateParam : null,
    party: partyParam.length > 0 ? partyParam : null,
    offset,
    limit
  });

  return {
    results: resultsPromise,
    filters: Promise.resolve(filters), // We already awaited it, but keeping deferred structure if needed?
    // Actually, loader return must match what's expected.
    // Since I awaited it, I can return it normally.
    query,
    tagsParam: tagsList.join(","),
    stateParam,
    partyParam,
    offset
  };
}


// ... inside Busca component ...

import { Breadcrumbs } from "~/components/Breadcrumbs";

// ...

export default function Busca() {
  const { results: deferredResults, filters: deferredFilters, query, tagsParam, stateParam, partyParam } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const fetcher = useFetcher<typeof loader>();
  const [allResults, setAllResults] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  // Guard to prevent duplicate fetches for the same offset
  const lastFetchedOffset = useRef<number>(-1);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { setTags } = useFilterStore();
  const { toggleId, isSelected } = useComparisonStore();

  useEffect(() => {
    // Reset guard when filters change
    lastFetchedOffset.current = -1;
    if (tagsParam) {
      setTags(tagsParam.split(","));
    } else {
      setTags([]);
    }
  }, [tagsParam, setTags, query, stateParam, partyParam]);

  // 1. Sync initial results
  useEffect(() => {
    Promise.resolve(deferredResults).then(data => {
      setAllResults(data.items);
      setHasMore(data.hasMore);
      // Reset guard on initial load
      lastFetchedOffset.current = -1;
    });
  }, [deferredResults]);

  // 2. Handle fetcher updates (Infinite Scroll)
  useEffect(() => {
    if (fetcher.data?.results && fetcher.state === "idle") {
      Promise.resolve(fetcher.data.results).then((data: any) => {
        // Only append if we actually got items
        if (data.items.length > 0) {
          setAllResults(prev => [...prev, ...data.items]);
        }
        setHasMore(data.hasMore);
      });
    }
  }, [fetcher.data, fetcher.state]);

  // 3. Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const offset = allResults.length;
        if (
          entries[0].isIntersecting &&
          hasMore &&
          fetcher.state === "idle" &&
          offset > lastFetchedOffset.current // Guard: Ensure we haven't already fetched this offset
        ) {
          lastFetchedOffset.current = offset; // Mark as fetched
          const params = new URLSearchParams();
          if (query) params.set("q", query);
          if (tagsParam) params.set("tags", tagsParam);
          if (stateParam?.length) params.set("uf", stateParam.join(","));
          if (partyParam?.length) params.set("partido", partyParam.join(","));
          params.set("offset", String(offset));

          fetcher.load(`/busca?${params.toString()}`);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, fetcher.state, query, tagsParam, allResults.length, stateParam, partyParam]);

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
      <Header breadcrumbItems={[{ label: "Buscar Políticos", active: true }]} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">

          {/* Mobile Filter Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setShowMobileFilters(true)}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm text-gray-700 font-bold w-full justify-center active:scale-[0.98] transition-transform text-lg"
            >
              <SlidersHorizontal size={20} />
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
            <Form
              method="get"
              action="/busca"
              className="w-full relative group"
              onSubmit={(e) => {
                // Prevent default submission to handle it via debounce/controlled input logic if needed, 
                // but standard Enter key works fine. 
                // Actually, let standard submit happen on Enter.
              }}
            >
              <input type="hidden" name="tags" value={tagsParam || ""} />
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-primary transition-colors">
                <Search className="w-5 h-5 md:w-5 md:h-5" />
              </div>
              <input
                type="text"
                name="q"
                defaultValue={query || ""}
                placeholder="Busque por nome, partido..."
                className="w-full pl-12 pr-4 py-4 md:py-3 bg-white border border-gray-200 rounded-2xl md:rounded-xl shadow-sm text-base md:text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                onChange={(e) => {
                  const form = e.currentTarget.form;
                  if (form) {
                    // Debounce logic
                    const timeoutId = setTimeout(() => {
                      submit(form, { replace: true });
                    }, 500);
                    // Store timeout ID on the input element to clear it? 
                    // React way: use a ref for the timeout
                    (e.target as any)._timeoutId = timeoutId;
                  }
                }}
                onInput={(e) => {
                  const target = e.target as any;
                  if (target._timeoutId) clearTimeout(target._timeoutId);
                }}
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
                            <button
                              onClick={() => {
                                setTags([]);
                                // Submit empty params to clear everything
                                const params = new URLSearchParams();
                                submit(params, { action: "/busca", replace: false });
                              }}
                              className="w-full py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold transition-colors"
                            >
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
