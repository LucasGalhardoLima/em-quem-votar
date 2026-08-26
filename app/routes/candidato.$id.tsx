import { useMemo } from "react";
import { Link, redirect, useSearchParams } from "react-router";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Route } from "./+types/candidato.$id";
import { Container } from "~/components/layout";
import { CandidateAvatar } from "~/components/candidate/CandidateAvatar";
import { StatusBadge } from "~/components/candidate/StatusBadge";
import {
  PositionsByTopic,
  type TopicRow,
} from "~/components/candidate/PositionsByTopic";
import { VoteList } from "~/components/candidate/VoteList";
import { SpendingSummary } from "~/components/candidate/SpendingSummary";
import { SpendingChart } from "~/components/candidate/SpendingChart";
import { useQuizHydration, useQuizStore } from "~/stores/quizStore";
import {
  MAX_COMPARISON,
  useComparisonHydration,
  useComparisonStore,
} from "~/stores/comparisonStore";
import { matchCandidate, type MatchCandidate } from "~/lib/match";
import { isOffice, raceLabel } from "~/lib/office";
import { CandidateService } from "~/services/candidate.server";
import { SpendingService } from "~/services/spending.server";
import { db } from "~/utils/db.server";
import { cn } from "~/lib/utils";

const TABS = [
  { key: "posicoes", label: "Posições" },
  { key: "votacoes", label: "Votações" },
  { key: "gastos", label: "Gastos e bens" },
  { key: "proposta", label: "Proposta de governo" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function meta({ data }: Route.MetaArgs) {
  const candidate = data?.candidate;
  if (!candidate) return [{ title: "Candidato não encontrado | Em Quem Votar?" }];
  const numberPart = candidate.number != null ? `, nº ${candidate.number}` : "";
  // A disputa vem do registro, nunca fixa. Escrever "Presidência" na página de
  // um candidato a governador atribuiria a uma pessoa real um cargo que ela
  // não disputa — é afirmação falsa, não imprecisão de texto.
  const office = isOffice(candidate.electionType)
    ? candidate.electionType
    : "presidential";
  const disputa = raceLabel(office, candidate.uf ?? null);
  return [
    {
      title: `${candidate.displayName} (${candidate.party}) — ${disputa} 2026 | Em Quem Votar?`,
    },
    {
      name: "description",
      content: `Posições documentadas, votações, gastos e situação de registro de ${candidate.displayName} (${candidate.party}${numberPart}), candidatura a ${disputa} em 2026. Toda afirmação com fonte.`,
    },
    { name: "robots", content: "index,follow" },
  ];
}

export function headers() {
  return { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
}

export async function loader({ params }: Route.LoaderArgs) {
  const candidate = await CandidateService.getById(params.id);
  if (!candidate) throw redirect("/candidatos");

  const [spendingDetails, topics] = await Promise.all([
    SpendingService.getByCandidate(params.id),
    db.politicalTopic.findMany({
      select: { slug: true, name: true, category: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return { candidate, spendingDetails, topics };
}

export default function CandidatoPage({ loaderData }: Route.ComponentProps) {
  const { candidate, spendingDetails, topics } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const quizReady = useQuizHydration();
  const comparisonReady = useComparisonHydration();
  const answers = useQuizStore((s) => s.answers);
  const weights = useQuizStore((s) => s.weights);
  const selectedIds = useComparisonStore((s) => s.selectedIds);
  const toggleId = useComparisonStore((s) => s.toggleId);

  const tabParam = searchParams.get("aba");
  const activeTab: TabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : "posicoes";

  const hasQuiz = quizReady && Object.keys(answers).length > 0;
  const inComparison = comparisonReady && selectedIds.includes(candidate.id);

  /** Todos os temas, com ou sem posição documentada. */
  const rows: TopicRow[] = useMemo(() => {
    const byslug = new Map(candidate.positions.map((p) => [p.topicSlug, p]));
    return topics.map((topic) => {
      const p = byslug.get(topic.slug);
      return {
        topicSlug: topic.slug,
        topicName: topic.name,
        topicCategory: topic.category,
        stance: p && p.stance > 0 ? p.stance : null,
        description: p?.description ?? null,
        sourceType: p?.sourceType ?? null,
        sourceUrl: p?.sourceUrl ?? null,
        sourceDocument: p?.sourceDocument ?? null,
        sourcePage: p?.sourcePage ?? null,
        sourceQuote: p?.sourceQuote ?? null,
        sourceDate: p?.sourceDate ?? null,
      };
    });
  }, [candidate.positions, topics]);

  const match = useMemo(() => {
    if (!hasQuiz) return null;
    const asMatch: MatchCandidate = {
      id: candidate.id,
      name: candidate.name,
      displayName: candidate.displayName,
      party: candidate.party,
      photoUrl: candidate.photoUrl,
      coalition: candidate.coalition,
      registrationStatus: candidate.registrationStatus,
      tseStatusLabel: candidate.tseStatusLabel,
      number: candidate.number,
      positions: Object.fromEntries(
        candidate.positions
          .filter((p) => p.stance > 0)
          .map((p) => [p.topicSlug, p.stance]),
      ),
      positionCategories: Object.fromEntries(
        topics.map((t) => [t.slug, t.category]),
      ),
      positionCount: candidate.positions.length,
    };
    return matchCandidate(
      asMatch,
      answers,
      weights,
      Object.fromEntries(topics.map((t) => [t.slug, t.category])),
    );
  }, [hasQuiz, candidate, topics, answers, weights]);

  function selectTab(key: TabKey) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        key === "posicoes" ? p.delete("aba") : p.set("aba", key);
        return p;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  function handleCompare() {
    const result = toggleId(candidate.id);
    if (result === "limit") {
      toast.warning(`Máximo de ${MAX_COMPARISON} — remova um para trocar`);
    } else if (result === "added") {
      toast.success("Adicionado à comparação");
    } else {
      toast("Removido da comparação");
    }
  }

  const documentedCount = candidate.positions.filter((p) => p.stance > 0).length;

  return (
    <main className="flex-1">
      <Container>
        <nav className="py-3 text-[12.5px] text-slate-400">
          <Link
            to="/candidatos"
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            ← Candidatos
          </Link>
          <span className="mx-1.5">/</span>
          <span className="font-semibold text-slate-600">
            {candidate.displayName}
          </span>
        </nav>

        <header className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-6 sm:px-7 lg:flex-row lg:items-center lg:gap-[22px]">
          <CandidateAvatar
            name={candidate.displayName}
            photoUrl={candidate.photoUrl}
            size="lg"
          />

          <div className="flex-1">
            <h1 className="font-heading text-[24px] font-bold tracking-[-0.02em] text-slate-800 sm:text-[30px]">
              {candidate.displayName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {candidate.party}
              {candidate.number != null ? ` · nº ${candidate.number}` : ""}
              {candidate.coalition ? ` · ${candidate.coalition}` : ""}
            </p>
            {candidate.viceName && (
              <p className="mt-0.5 text-[13px] text-slate-500">
                Vice: {candidate.viceName}
                {candidate.viceParty ? ` (${candidate.viceParty})` : ""}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <StatusBadge
                status={candidate.registrationStatus}
                tseStatusLabel={candidate.tseStatusLabel}
              />
              {candidate.dataSource === "press" && (
                <span
                  title="Registro apurado em fonte jornalística enquanto a sincronização com o TSE não roda neste ambiente."
                  className="inline-flex w-fit items-center rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                >
                  Dado de imprensa — aguardando TSE
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-2 lg:justify-items-end">
            {match && match.matchPercentage !== null ? (
              <div className="lg:text-right">
                <p className="font-heading text-[40px] leading-none font-bold text-indigo-600">
                  {match.matchPercentage}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  compatibilidade em {match.comparableCount} tema
                  {match.comparableCount === 1 ? "" : "s"} comparáve
                  {match.comparableCount === 1 ? "l" : "is"}
                </p>
              </div>
            ) : match ? (
              <p className="max-w-[220px] text-xs text-slate-500 lg:text-right">
                Nenhum tema comparável: não há posição documentada nos temas que
                você respondeu.
              </p>
            ) : (
              <>
                <Link
                  to="/quiz"
                  className="rounded-xl bg-slate-800 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-slate-900"
                >
                  Fazer o quiz →
                </Link>
                <p className="text-[11.5px] text-slate-400">
                  para ver sua compatibilidade
                </p>
              </>
            )}

            <button
              type="button"
              onClick={handleCompare}
              aria-pressed={inComparison}
              className={cn(
                "rounded-xl border px-[18px] py-2.5 text-center text-[12.5px] font-semibold transition-colors",
                inComparison
                  ? "border-indigo-600 bg-indigo-600/[0.06] text-indigo-600"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {inComparison
                ? "✓ Na comparação — remover"
                : "+ Adicionar à comparação"}
            </button>
          </div>
        </header>

        <div
          className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200"
          role="tablist"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(tab.key)}
                className={cn(
                  "-mb-px flex-none border-b-2 px-4 py-2.5 text-[13.5px] transition-colors",
                  active
                    ? "border-indigo-600 font-bold text-indigo-600"
                    : "border-transparent font-medium text-slate-500 hover:text-slate-800",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="py-5" role="tabpanel">
          {activeTab === "posicoes" && (
            <>
              <h2 className="mb-3 text-[11px] font-bold tracking-[0.06em] text-slate-500">
                {hasQuiz ? "COMPATIBILIDADE POR TEMA" : "POSIÇÕES POR TEMA"}
              </h2>
              <PositionsByTopic
                rows={rows}
                answers={quizReady ? answers : {}}
                hasQuiz={hasQuiz}
              />
              <p className="mt-4 text-[12px] leading-relaxed text-slate-400">
                {documentedCount} de {topics.length} temas com posição
                documentada. Cada posição cita documento, página e link — quando
                não há documento, a plataforma diz que não há, em vez de inferir.{" "}
                <Link
                  to="/metodologia"
                  className="font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Ver metodologia
                </Link>
              </p>
            </>
          )}

          {activeTab === "votacoes" && (
            <>
              <h2 className="mb-3 text-[11px] font-bold tracking-[0.06em] text-slate-500">
                VOTAÇÕES NOMINAIS
              </h2>
              {candidate.hasLegislativeRecord || candidate.votes.length > 0 ? (
                <VoteList votes={candidate.votes} />
              ) : (
                <EmptyPanel
                  title="Sem histórico legislativo"
                  body={`${candidate.displayName} não exerce nem exerceu mandato na Câmara ou no Senado no período coberto pelas bases de dados abertas. Por isso não há votação nominal para exibir — a ausência aqui não é falta de informação sobre a pessoa, é ausência de mandato.`}
                />
              )}
            </>
          )}

          {activeTab === "gastos" && (
            <>
              <h2 className="mb-3 text-[11px] font-bold tracking-[0.06em] text-slate-500">
                GASTOS E BENS DECLARADOS
              </h2>
              {spendingDetails.length > 0 ? (
                <div className="grid gap-3">
                  <SpendingSummary
                    spending={spendingDetails}
                    hasLegislativeRecord={candidate.hasLegislativeRecord}
                  />
                  {spendingDetails.map((group) =>
                    group.categories.length > 0 ? (
                      <SpendingChart
                        key={group.type}
                        categories={group.categories}
                        label={group.type}
                      />
                    ) : null,
                  )}
                </div>
              ) : (
                <EmptyPanel
                  title="Ainda sem dados financeiros sincronizados"
                  body="Bens declarados e gastos de campanha vêm do TSE (DivulgaCandContas) e ainda não foram importados para este ambiente. Nada aqui é estimado."
                />
              )}
            </>
          )}

          {activeTab === "proposta" && (
            <>
              <h2 className="mb-3 text-[11px] font-bold tracking-[0.06em] text-slate-500">
                PROPOSTA DE GOVERNO
              </h2>
              {candidate.governmentPlanUrl ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6">
                  <p className="text-[14.5px] leading-relaxed text-slate-600">
                    A proposta de governo é o documento que a coligação
                    protocolou no TSE junto com o registro da candidatura. É a
                    fonte primária das posições exibidas nesta página.
                  </p>
                  <a
                    href={candidate.governmentPlanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-slate-900"
                  >
                    Abrir a proposta no TSE
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              ) : (
                <EmptyPanel
                  title="Documento ainda não vinculado"
                  body="A proposta de governo protocolada no TSE ainda não foi anexada a este perfil. Assim que o link oficial for sincronizado, ele aparece aqui."
                />
              )}
              {candidate.officialSiteUrl && (
                <p className="mt-3 text-[12.5px] text-slate-500">
                  Site oficial da campanha:{" "}
                  <a
                    href={candidate.officialSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    {candidate.officialSiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                </p>
              )}
            </>
          )}
        </div>

        {candidate.sourceUrl && (
          <p className="pb-10 text-[12px] text-slate-400">
            Registro da candidatura:{" "}
            <a
              href={candidate.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-indigo-600 hover:underline"
            >
              {/* O rótulo tem que dizer para onde o link vai de verdade:
                  quando o dado ainda é de imprensa, ele NÃO aponta para o
                  TSE, e chamar de "consultar no TSE" seria falso. */}
              {candidate.dataSource === "tse"
                ? "consultar no TSE"
                : "ver a fonte deste registro"}
            </a>
            {candidate.lastSyncedAt && (
              <>
                {" "}
                · última sincronização em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }).format(new Date(candidate.lastSyncedAt))}
              </>
            )}
          </p>
        )}
      </Container>
    </main>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-[15px] font-bold text-slate-600">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-relaxed text-slate-400">
        {body}
      </p>
    </div>
  );
}
