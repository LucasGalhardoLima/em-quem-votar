import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { X } from "lucide-react";
import type { Route } from "./+types/comparar";
import { Container } from "~/components/layout";
import { CandidateAvatar } from "~/components/candidate/CandidateAvatar";
import { StatusBadge } from "~/components/candidate/StatusBadge";
import {
  MAX_COMPARISON,
  useComparisonHydration,
  useComparisonStore,
} from "~/stores/comparisonStore";
import { candidateStanceLabel, hasPosition } from "~/lib/stance";
import { CandidateService } from "~/services/candidate.server";
import { db } from "~/utils/db.server";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Comparar candidatos | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Compare lado a lado as posições documentadas de até três candidatos à Presidência em 2026, tema por tema, com a fonte de cada afirmação.",
    },
    { name: "robots", content: "index,follow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_COMPARISON);

  const [candidates, topics] = await Promise.all([
    ids.length > 0 ? CandidateService.listForComparison(ids) : [],
    db.politicalTopic.findMany({
      select: { slug: true, name: true, category: true },
      orderBy: { order: "asc" },
    }),
  ]);

  // Preserva a ordem pedida na URL, não a ordem que o banco devolveu.
  const ordered = ids
    .map((id) => candidates.find((c) => c.id === id))
    .filter((c): c is (typeof candidates)[number] => Boolean(c));

  // Comparar candidaturas de disputas diferentes não é errado, mas induz a
  // erro: um governador de SP e um da Bahia nunca aparecem na mesma cédula,
  // então "quem eu prefiro" é uma pergunta que ninguém vai responder na urna.
  // A tela avisa em vez de bloquear — o eleitor pode ter um motivo legítimo.
  const races = new Set(ordered.map(c => `${c.office}:${c.uf ?? ""}`));
  const mixedRaces = races.size > 1;

  return { candidates: ordered, topics, ids, mixedRaces };
}

export default function Comparar({ loaderData }: Route.ComponentProps) {
  const { candidates, topics, ids, mixedRaces } = loaderData;
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const hydrated = useComparisonHydration();
  const storedIds = useComparisonStore((s) => s.selectedIds);
  const setIds = useComparisonStore((s) => s.setIds);

  // A URL é a fonte compartilhável; o store acompanha para que o botão de
  // comparação apareça correto nas outras telas.
  useEffect(() => {
    if (!hydrated) return;
    if (ids.length > 0 && ids.join(",") !== storedIds.join(",")) setIds(ids);
  }, [hydrated, ids, storedIds, setIds]);

  // Sem ids na URL mas com seleção guardada: recupera a seleção do aparelho.
  useEffect(() => {
    if (!hydrated || ids.length > 0 || storedIds.length === 0) return;
    navigate(`/comparar?ids=${storedIds.join(",")}`, { replace: true });
  }, [hydrated, ids.length, storedIds, navigate]);

  function remove(id: string) {
    const next = ids.filter((i) => i !== id);
    setIds(next);
    setSearchParams(
      next.length > 0 ? { ids: next.join(",") } : {},
      { replace: true },
    );
  }

  const cols = `200px repeat(${candidates.length}, minmax(180px, 1fr))`;

  return (
    <main className="flex-1">
      <Container className="flex flex-col gap-3 pt-8 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-[26px] font-bold tracking-[-0.02em] text-slate-800 sm:text-[30px]">
            Comparar candidatos
          </h1>
          <p className="mt-1.5 text-[13.5px] text-pretty text-slate-500">
            Até {MAX_COMPARISON} lado a lado · “sem posição registrada” quando
            não existe documento sobre o tema
          </p>
        </div>
        <Link
          to="/candidatos"
          className="flex-none text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700"
        >
          + Trocar candidatos
        </Link>
      </Container>

      {mixedRaces && (
        <Container className="pt-1 pb-2">
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900"
          >
            Estas candidaturas concorrem a disputas diferentes e não aparecem na
            mesma cédula. A comparação continua válida tema a tema, mas nenhuma
            urna vai pedir que você escolha entre elas.
          </p>
        </Container>
      )}

      {candidates.length === 0 ? (
        <Container className="pt-6 pb-12">
          <div className="grid justify-items-center gap-3.5 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-base font-bold text-slate-600">
              Nenhum candidato selecionado
            </p>
            <p className="text-[13.5px] text-slate-400">
              Escolha até {MAX_COMPARISON} na lista de candidatos, pelo botão +.
            </p>
            <Link
              to="/candidatos"
              className="rounded-xl bg-slate-800 px-6 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-slate-900"
            >
              Escolher candidatos →
            </Link>
          </div>
        </Container>
      ) : (
        <>
          <Container className="pt-4 pb-2">
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[640px] gap-2.5">
                <div className="grid gap-2.5" style={{ gridTemplateColumns: cols }}>
                  <div />
                  {candidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="relative rounded-2xl border border-slate-200 bg-white p-3.5 text-center"
                    >
                      <button
                        type="button"
                        onClick={() => remove(candidate.id)}
                        aria-label={`Remover ${candidate.displayName} da comparação`}
                        className="absolute top-2 right-2.5 text-slate-400 transition-colors hover:text-red-700"
                      >
                        <X className="size-3.5" />
                      </button>
                      <CandidateAvatar
                        name={candidate.displayName}
                        photoUrl={candidate.photoUrl}
                        size="sm"
                        className="mx-auto"
                      />
                      <Link
                        to={`/candidato/${candidate.id}`}
                        prefetch="intent"
                        className="mt-2 block text-[14.5px] font-bold text-slate-800 hover:text-indigo-600"
                      >
                        {candidate.displayName}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {candidate.party}
                        {candidate.number != null
                          ? ` · nº ${candidate.number}`
                          : ""}
                      </p>
                      <div className="mt-2 flex justify-center">
                        <StatusBadge
                          status={candidate.registrationStatus}
                          tseStatusLabel={candidate.tseStatusLabel}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {topics.map((topic) => (
                  <div
                    key={topic.slug}
                    className="grid gap-2.5"
                    style={{ gridTemplateColumns: cols }}
                  >
                    <div className="flex items-center text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
                      {topic.name}
                    </div>
                    {candidates.map((candidate) => {
                      const position = candidate.positions[topic.slug];
                      const documented =
                        position && hasPosition(position.stance);
                      return (
                        <div
                          key={`${candidate.id}-${topic.slug}`}
                          className={cn(
                            "flex flex-col justify-center gap-1 rounded-xl px-3.5 py-3 text-[13px] leading-snug",
                            documented
                              ? "border border-slate-200 bg-white text-slate-600"
                              : "border border-dashed border-slate-300 bg-slate-50 text-slate-400",
                          )}
                        >
                          <span
                            className={cn(
                              documented && "font-semibold text-slate-800",
                            )}
                          >
                            {candidateStanceLabel(position?.stance ?? null)}
                          </span>
                          {documented && position?.description && (
                            <span className="line-clamp-3 text-[12px] text-slate-500">
                              {position.description}
                            </span>
                          )}
                          {documented && position?.sourceUrl && (
                            <a
                              href={position.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium text-indigo-600 hover:underline"
                            >
                              {position.sourceDocument ?? "Ver fonte"}
                              {position.sourcePage
                                ? `, p. ${position.sourcePage}`
                                : ""}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Container>

          <Container className="pt-3 pb-10">
            <p className="text-[12px] leading-relaxed text-slate-400">
              Cada célula preenchida cita documento, página e link (TSE, Câmara,
              Senado). Células “sem posição registrada” nunca são completadas por
              inferência — a ausência de documento é exibida como ausência.
            </p>
          </Container>
        </>
      )}
    </main>
  );
}
