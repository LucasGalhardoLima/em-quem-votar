import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { X } from "lucide-react";
import type { Route } from "./+types/comparar";
import { pageMeta } from "~/root";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { CandidateAvatar } from "~/components/candidate/CandidateAvatar";
import { SourceCite } from "~/components/candidate/SourceCite";
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
    ...pageMeta({
      title: "Comparar candidatos | Em Quem Votar?",
      description:
        "Compare lado a lado as posições documentadas de até três candidatos à Presidência em 2026, tema por tema, com a fonte de cada afirmação.",
      type: "website",
    }),
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

  // Largura natural mínima: coluna do tema (200px) + 180px por candidatura +
  // o respiro de 10px entre células. Abaixo disso a região rola na horizontal.
  // Os 20px extras da largura são devolvidos pela margem negativa abaixo.
  const minTableWidth = 200 + candidates.length * 180 + (candidates.length + 2) * 10;

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
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
            <p className="text-[13.5px] text-slate-500">
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
          <Container className="pt-1.5 pb-0">
            {/*
              Tabela de verdade, não grade de divs: cada célula é lida com o
              nome do tema (cabeçalho de linha) e o da candidatura (cabeçalho
              de coluna). Numa tela cujo propósito é comparar pessoas, ler as
              células em sequência linear é ler outra coisa.

              A região rolável recebe tabIndex para que o teclado consiga
              deslocá-la na horizontal sem depender de mouse.
            */}
            <div
              role="region"
              aria-label="Posições por tema, lado a lado"
              tabIndex={0}
              className="-mx-[10px] overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {/*
                `border-spacing` reproduz o antigo `gap-2.5` (10px) entre as
                células — mas afasta os mesmos 10px da borda da tabela, que o
                original não tinha. Quem devolve esses 10px é o `-mx` da
                região rolável (e o `pt` reduzido acima), e não uma margem
                negativa na tabela: essa criava 10px de rolagem fantasma.
              */}
              <table
                className="w-full table-fixed border-separate border-spacing-[10px]"
                style={{ minWidth: minTableWidth }}
              >
                <caption className="sr-only">
                  Comparação de posições documentadas: uma linha por tema, uma
                  coluna por candidatura.
                </caption>
                <colgroup>
                  <col style={{ width: 200 }} />
                  {candidates.map((candidate) => (
                    <col key={candidate.id} />
                  ))}
                </colgroup>
                {/*
                  Uma faixa só (`tbody`), não `thead` + `tbody`: com bordas
                  separadas o CSS aplica o espaçamento vertical DUAS vezes na
                  fronteira entre faixas, e os 10px do layout original viravam
                  20px sob os cartões. A associação de coluna vem do
                  `scope="col"`, não da faixa.
                */}
                <tbody>
                  <tr>
                    <td />
                    {candidates.map((candidate) => (
                      <th
                        key={candidate.id}
                        scope="col"
                        className="relative rounded-2xl border border-slate-200 bg-white p-3.5 text-center align-top font-normal"
                      >
                        <button
                          type="button"
                          onClick={() => remove(candidate.id)}
                          aria-label={`Remover ${candidate.displayName} da comparação`}
                          className="absolute top-0.5 right-1 rounded-full p-1.5 text-slate-500 transition-colors hover:text-red-700"
                        >
                          <X className="size-3.5" aria-hidden="true" />
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
                        <p className="text-xs font-normal text-slate-500">
                          {candidate.party}
                          {candidate.number != null
                            ? ` · nº ${candidate.number}`
                            : ""}
                        </p>
                        <span className="mt-2 flex justify-center">
                          <StatusBadge
                            status={candidate.registrationStatus}
                            tseStatusLabel={candidate.tseStatusLabel}
                          />
                        </span>
                      </th>
                    ))}
                  </tr>

                  {topics.map((topic) => (
                    <tr key={topic.slug}>
                      <th
                        scope="row"
                        className="text-left align-middle text-xs font-bold tracking-[0.06em] text-slate-500 uppercase"
                      >
                        {topic.name}
                      </th>
                      {candidates.map((candidate) => {
                        const position = candidate.positions[topic.slug];
                        const documented =
                          position && hasPosition(position.stance);
                        return (
                          <td
                            key={`${candidate.id}-${topic.slug}`}
                            className={cn(
                              "rounded-xl px-3.5 py-3 align-middle text-[13px] leading-snug",
                              documented
                                ? "border border-slate-200 bg-white text-slate-600"
                                : "border border-dashed border-slate-300 bg-slate-50 text-slate-500",
                            )}
                          >
                            <div className="flex flex-col gap-1">
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
                              {/*
                                Sempre pelo SourceCite: quando não há URL ele
                                ainda nomeia o documento. Uma posição
                                documentada não pode aparecer sem procedência
                                só porque o link está faltando.
                              */}
                              {documented && position && (
                                <SourceCite
                                  source={{
                                    sourceType: position.sourceType,
                                    sourceUrl: position.sourceUrl,
                                    sourceDocument: position.sourceDocument,
                                    sourcePage: position.sourcePage,
                                  }}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Container>

          <Container className="pt-3 pb-10">
            <p className="text-[12px] leading-relaxed text-slate-500">
              Cada célula preenchida nomeia o documento citado — com página e
              link quando o registro os tem (TSE, Câmara, Senado). Células “sem
              posição registrada” nunca são completadas por inferência — a
              ausência de documento é exibida como ausência.
            </p>
          </Container>
        </>
      )}
    </main>
  );
}
