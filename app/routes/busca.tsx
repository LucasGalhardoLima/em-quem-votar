
import type { Route } from "./+types/busca";
import { Form, Link, useLoaderData, useNavigation, useSubmit, useFetcher, Await } from "react-router";
import { Suspense, useEffect, useRef, useState } from "react";
import { db } from "~/utils/db.server";
import { Search, Loader2, User, SlidersHorizontal, Check } from "lucide-react";
import { PoliticianCardSkeleton } from "~/components/SkeletonLoader";
import { useFilterStore } from "~/stores/filterStore";
import { Prisma } from "@prisma/client";
import { FilterSidebar } from "~/components/FilterSidebar";
import { Header } from "~/components/Header";
import { TagWithTooltip } from "~/components/TagWithTooltip";
import { ComparisonFloatingBar } from "~/components/ComparisonFloatingBar";
import { useComparisonStore } from "~/stores/comparisonStore";
import { NewsletterForm } from "~/components/NewsletterForm";

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

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const tagsParam = url.searchParams.get("tags");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const limit = 20;

  const where: Prisma.PoliticianWhereInput = {};

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { party: { contains: query, mode: "insensitive" } },
    ];
  }

  if (tagsParam) {
    const slugs = tagsParam.split(",");

    // AND LOGIC: Must have ALL selected tags
    where.AND = slugs.map(slug => ({
      tags: { some: { tag: { slug: slug } } }
    }));
  }

  // Data promise for results
  const resultsPromise = db.politician.findMany({
    where,
    skip: offset,
    take: limit + 1,
    select: {
      id: true,
      name: true,
      party: true,
      state: true,
      photoUrl: true,
      spending: true,
      attendanceRate: true,
      tags: {
        take: 3,
        select: {
          tag: {
            select: {
              name: true,
              slug: true,
              category: true
            }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  }).then(results => {
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    return { items, hasMore };
  });

  return {
    results: resultsPromise,
    query,
    tagsParam,
    offset
  };
}

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

  // Reset results when new deferred results arrive
  useEffect(() => {
    deferredResults.then(res => {
      setAllResults(res.items);
      setHasMore(res.hasMore);
    });
  }, [deferredResults]);

  // Update results when fetcher loads more
  useEffect(() => {
    if (fetcher.data?.results && fetcher.state === "idle") {
      const results = fetcher.data.results;
      if (results instanceof Promise) {
        results.then(res => {
          setAllResults(prev => [...prev, ...res.items]);
          setHasMore(res.hasMore);
        });
      } else {
        setAllResults(prev => [...prev, ...(results as any).items]);
        setHasMore((results as any).hasMore);
      }
    }
  }, [fetcher.data, fetcher.state]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && fetcher.state === "idle") {
          const url = new URL(window.location.href);
          url.searchParams.set("offset", String(allResults.length));
          fetcher.load(url.pathname + url.search);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, allResults.length, fetcher]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">

          {/* Mobile Filter Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 font-medium w-full justify-center"
            >
              <SlidersHorizontal size={18} />
              Filtros
            </button>
          </div>

          {/* Sidebar (Desktop) / Drawer (Mobile - simplified as hidden block for MVP) */}
          <div className={`md:block ${showMobileFilters ? 'block' : 'hidden'}`}>
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

            {/* Results Grid */}
            <div id="results" className="w-full space-y-4">
              <Suspense
                fallback={
                  <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 w-full">
                    {Array.from({ length: 6 }).map((_, i) => (
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
                          {Array.from({ length: 6 }).map((_, i) => (
                            <PoliticianCardSkeleton key={i} />
                          ))}
                        </div>
                      )
                    }

                    return (
                      <>
                        {resolvedResults.items.length > 0 ? (
                          <>
                            <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 w-full">
                              {allResults.map((politician) => (
                                <Link
                                  key={politician.id}
                                  to={`/politico/${politician.id}`}
                                  prefetch="intent"
                                  className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-start gap-4 group cursor-pointer h-full relative">

                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleId(politician.id);
                                    }}
                                    className="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:bg-gray-50 transition-colors group/btn"
                                    title="Comparar"
                                  >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isSelected(politician.id)
                                      ? "bg-blue-600 text-white shadow-sm"
                                      : "bg-white border-2 border-gray-200 group-hover:border-blue-400"
                                      }`}>
                                      {isSelected(politician.id) && <Check size={14} strokeWidth={3} />}
                                    </div>
                                  </button>

                                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-100">
                                    {politician.photoUrl ? (
                                      <img src={politician.photoUrl} alt={politician.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <User className="w-full h-full p-3 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate text-lg">{politician.name}</h3>
                                    <p className="text-sm text-gray-500 truncate mb-2">{politician.party} • {politician.state}</p>

                                    {politician.tags && politician.tags.length > 0 && (
                                      <div className="flex gap-1.5 flex-wrap">
                                        {politician.tags.slice(0, 3).map((pt: any) => (
                                          <TagWithTooltip key={pt.tag.id} tag={pt.tag} />
                                        ))}
                                      </div>
                                    )}

                                    <div className="mt-3 pt-2 border-t border-gray-50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                      <a
                                        href={`mailto:suporte@emquemvotar.app?subject=Correção: ${politician.name}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[10px] text-gray-300 hover:text-gray-500 hover:underline transition-colors"
                                      >
                                        Reportar erro
                                      </a>
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>

                            {/* Infinite scroll trigger */}
                            <div ref={observerTarget} className="h-20 flex items-center justify-center">
                              {fetcher.state === "loading" && (
                                <div className="flex items-center gap-2 text-gray-400">
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span>Carregando mais...</span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-20 px-4 bg-white rounded-2xl border border-gray-100 shadow-sm mx-auto max-w-lg mt-8">
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
                          </div>
                        )}
                      </>
                    );
                  }}
                </Await>
              </Suspense>
            </div>

            <div className="mt-12">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </main>
      <ComparisonFloatingBar />
    </div>
  );
}

