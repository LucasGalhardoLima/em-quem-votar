import { useMemo, useRef } from "react";
import { Link, redirect, useSearchParams } from "react-router";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Route } from "./+types/candidato.$id";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { CandidateAvatar } from "~/components/candidate/CandidateAvatar";
import { StatusBadge } from "~/components/candidate/StatusBadge";
import {
  PositionsByTopic,
  type TopicRow,
} from "~/components/candidate/PositionsByTopic";
import { VoteList } from "~/components/candidate/VoteList";
import { SpendingSummary } from "~/components/candidate/SpendingSummary";
import { SpendingChart } from "~/components/candidate/SpendingChart";
import { DeclaredAssets } from "~/components/candidate/DeclaredAssets";
import { ElectionHistory } from "~/components/candidate/ElectionHistory";
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
  { key: "historico", label: "Histórico eleitoral" },
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
  const title = `${candidate.displayName} (${candidate.party}) — ${disputa} 2026 | Em Quem Votar?`;
  const description = `Posições documentadas, votações, gastos e situação de registro de ${candidate.displayName} (${candidate.party}${numberPart}), candidatura a ${disputa} em 2026. Toda afirmação com fonte.`;

  /*
    O card de compartilhamento. A rota /resources/og/:id já rasterizava um PNG
    por candidatura com satori + resvg, mas nenhuma página apontava para ela —
    era código morto, e todo link colado no WhatsApp saía sem card.

    As URLs de og:image e og:url PRECISAM ser absolutas (a especificação do
    Open Graph exige, e os crawlers do WhatsApp/Facebook não resolvem caminho
    relativo). Por isso `origin` sai do request no loader: não há SITE_URL
    configurada neste projeto, e chutar o domínio quebraria em preview.
  */
  const origin = data?.origin ?? "";
  const ogImage = origin ? `${origin}/resources/og/${candidate.id}` : undefined;

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index,follow" },
    { property: "og:type", content: "profile" },
    { property: "og:site_name", content: "Em Quem Votar?" },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(origin
      ? [{ property: "og:url", content: `${origin}/candidato/${candidate.id}` }]
      : []),
    ...(ogImage
      ? [
          { property: "og:image", content: ogImage },
          { property: "og:image:width", content: "1200" },
          { property: "og:image:height", content: "630" },
          {
            property: "og:image:alt",
            content: `${candidate.displayName} (${candidate.party}) — ${disputa} 2026`,
          },
        ]
      : []),
    {
      name: "twitter:card",
      content: ogImage ? "summary_large_image" : "summary",
    },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(ogImage ? [{ name: "twitter:image", content: ogImage }] : []),
  ];
}

export function headers() {
  return { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const candidate = await CandidateService.getById(params.id);
  if (!candidate) throw redirect("/candidatos");

  const [spendingDetails, declaredAssets, topics] = await Promise.all([
    SpendingService.getByCandidate(params.id),
    SpendingService.getDeclaredAssets(params.id),
    db.politicalTopic.findMany({
      select: { slug: true, name: true, category: true },
      orderBy: { order: "asc" },
    }),
  ]);

  // Origem absoluta para as tags Open Graph — ver o comentário em meta().
  const origin = new URL(request.url).origin;

  return { candidate, spendingDetails, declaredAssets, topics, origin };
}

export default function CandidatoPage({ loaderData }: Route.ComponentProps) {
  const { candidate, spendingDetails, declaredAssets, topics } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();

  const quizReady = useQuizHydration();
  const comparisonReady = useComparisonHydration();
  const answers = useQuizStore((s) => s.answers);
  const weights = useQuizStore((s) => s.weights);
  const selectedIds = useComparisonStore((s) => s.selectedIds);
  const toggleId = useComparisonStore((s) => s.toggleId);

  /** Roving tabindex: precisamos mover o foco para a aba escolhida por seta. */
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});

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

  /**
   * As posições que realmente contam como posição.
   *
   * `CandidateService.getById` traz toda linha aprovada, e `stance = 0` é
   * "sem posição registrada" — não é neutro, é ausência (ver `lib/stance.ts`).
   * O resto da página já sabia disso e filtrava `> 0` em três lugares; só o
   * `positionCount` entregue ao `matchCandidate` contava a linha vazia como
   * documentada, inflando a base declarada desta candidatura acima do que a
   * própria página exibe logo abaixo ("N de M temas com posição") e acima do
   * que `list()`/`findAllForMatch()` contam no servidor, onde o filtro
   * `APPROVED_AND_DOCUMENTED` já existe. Uma lista só é honesta se as duas
   * telas contarem a mesma coisa.
   */
  const documentedPositions = useMemo(
    () => candidate.positions.filter((p) => p.stance > 0),
    [candidate.positions],
  );

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
        documentedPositions.map((p) => [p.topicSlug, p.stance]),
      ),
      positionCategories: Object.fromEntries(
        topics.map((t) => [t.slug, t.category]),
      ),
      positionCount: documentedPositions.length,
    };
    return matchCandidate(
      asMatch,
      answers,
      weights,
      Object.fromEntries(topics.map((t) => [t.slug, t.category])),
    );
  }, [hasQuiz, candidate, documentedPositions, topics, answers, weights]);

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

  /**
   * Navegação por setas entre as abas (WAI-ARIA Tabs, ativação automática:
   * o painel acompanha o foco). Home/End vão para a primeira e a última.
   */
  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const last = TABS.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;

    event.preventDefault();
    const key = TABS[next].key;
    selectTab(key);
    tabRefs.current[key]?.focus();
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

  const documentedCount = documentedPositions.length;

  /**
   * A ficha do TSE já foi lida para esta candidatura?
   *
   * Distinguir "não sincronizado" de "o documento não traz nada" importa: dizer
   * "ainda não importamos" para quem declarou zero bem é tão errado quanto o
   * contrário. O número do processo é a evidência disponível — ele só é
   * gravado quando a ficha respondeu, e é a ÚLTIMA escrita da etapa (ver a
   * ordem em `applyDivulgaDetails`), então ele estar preenchido implica que os
   * bens e o histórico daquela ficha já entraram.
   *
   * shortcut: a leitura da ficha é inferida de `tseProcessNumber`, não
   * registrada — upgrade: uma coluna `tseFichaSyncedAt` diria a data exata em
   * que a ficha foi lida, o que a inferência não sabe.
   */
  const fichaLida = candidate.tseProcessNumber !== null;

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container>
        <nav className="py-3 text-[12.5px] text-slate-500">
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
            ) : match?.insufficientBase ? (
              <p className="max-w-[240px] text-xs text-slate-500 lg:text-right">
                Base documental insuficiente: só {match.comparableCount} tema
                {match.comparableCount === 1 ? "" : "s"} que você respondeu tem
                posição registrada nesta candidatura. Poucos para calcular
                compatibilidade sem sugerir precisão que o dado não sustenta.
              </p>
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
                <p className="text-[11.5px] text-slate-500">
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

        {/*
          Abas com a associação ARIA completa: cada `tab` aponta para o painel
          via aria-controls, o painel aponta de volta via aria-labelledby, e o
          tabindex é roving (só a aba ativa é tabulável) com navegação por
          setas. Sem isso, um leitor de tela anuncia cinco botões soltos e o
          conteúdo trocado embaixo não é anunciado como pertencente a nenhum
          deles — e a tabulação atravessa as cinco abas antes de chegar ao
          conteúdo.
        */}
        <div
          className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200"
          role="tablist"
          aria-label="Seções do perfil"
        >
          {TABS.map((tab, index) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[tab.key] = el;
                }}
                type="button"
                role="tab"
                id={`aba-${tab.key}`}
                aria-controls={`painel-${tab.key}`}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => selectTab(tab.key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
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

        <div
          className="py-5"
          role="tabpanel"
          id={`painel-${activeTab}`}
          aria-labelledby={`aba-${activeTab}`}
          tabIndex={0}
        >
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
              <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
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
                // Esta cópia já afirmou "não exerce nem exerceu mandato", e
                // isso era falso para pelo menos uma candidatura: a própria
                // base da Câmara lista LULA como deputado federal por SP na
                // 48ª legislatura (id 139289, CPF conferido contra o TSE em
                // 27/08/2026). A ausência de voto ali é de DADO, não de
                // mandato — a Câmara só publica voto nominal a partir de 2001,
                // e os arquivos de 1988 a 2000 devolvem 404.
                //
                // Enquanto não distinguirmos as três situações reais (nunca
                // teve mandato federal / teve fora do período coberto / tem e
                // ainda não sincronizamos), o texto afirma só o que
                // sustentamos: o que falta é a votação, não o mandato.
                <EmptyPanel
                  title="Sem votação nominal para exibir"
                  body={`Não há votação nominal de ${candidate.displayName} nas bases de dados abertas da Câmara e do Senado. Isso pode significar que a pessoa não exerceu mandato federal — ou que exerceu antes do período que essas bases cobrem, já que a Câmara só publica voto nominal a partir de 2001. A plataforma não afirma qual dos dois é o caso sem ter o dado para sustentar.`}
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
                    hasLegislativeLink={candidate.hasLegislativeRecord}
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
                  <DeclaredAssets assets={declaredAssets} />
                </div>
              ) : fichaLida ? (
                <EmptyPanel
                  title="Nenhum bem declarado na ficha do TSE"
                  body={`A ficha de registro de ${candidate.displayName} no DivulgaCandContas foi lida e não lista bem algum. A ausência aqui é a do documento oficial — não uma estimativa nossa, nem dado que faltou importar.`}
                />
              ) : (
                <EmptyPanel
                  title="Ainda sem dados financeiros sincronizados"
                  body="Bens declarados e gastos de campanha vêm do TSE (DivulgaCandContas) e ainda não foram importados para este ambiente. Nada aqui é estimado."
                />
              )}
            </>
          )}

          {activeTab === "historico" && (
            <>
              <h2 className="mb-3 text-[11px] font-bold tracking-[0.06em] text-slate-500">
                CANDIDATURAS ANTERIORES
              </h2>
              {candidate.electionHistory.length > 0 ? (
                <>
                  <ElectionHistory elections={candidate.electionHistory} />
                  <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
                    Candidaturas anteriores registradas no DivulgaCandContas, com
                    o cargo e o resultado na redação do próprio TSE. A lista cobre
                    o que a Justiça Eleitoral publica; mandatos exercidos sem
                    disputa eleitoral não aparecem aqui.
                  </p>
                </>
              ) : fichaLida ? (
                <EmptyPanel
                  title="Sem candidatura anterior no TSE"
                  body={`A ficha de ${candidate.displayName} no DivulgaCandContas não registra candidatura anterior a 2026. A ausência é a do registro oficial — não é falta de informação sobre a pessoa.`}
                />
              ) : (
                <EmptyPanel
                  title="Histórico ainda não sincronizado"
                  body="As candidaturas anteriores vêm da ficha do TSE (DivulgaCandContas) e ainda não foram importadas para este ambiente."
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
          <p className="pb-10 text-[12px] text-slate-500">
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
            {/* O nº do processo (RCand) é o que permite conferir a decisão da
                Justiça Eleitoral na fonte, em vez de acreditar no badge. */}
            {candidate.tseProcessNumber && (
              <> · processo nº {candidate.tseProcessNumber}</>
            )}
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
      <p className="mx-auto mt-2 max-w-lg text-[13.5px] leading-relaxed text-slate-500">
        {body}
      </p>
    </div>
  );
}
