import { useEffect, useMemo, useRef } from "react";
import {
  Link,
  redirect,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
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

/**
 * A ORDEM É FIXA para toda candidatura, e isso é regra de neutralidade, não
 * gosto: reordenar as abas conforme o que cada ficha tem daria a duas pessoas
 * reais duas páginas de formato diferente, e a ordem viraria um comentário
 * sobre quem está mais bem documentado. O que varia é só qual delas ABRE — ver
 * `firstTabWithContent`.
 */
const TABS = [
  { key: "posicoes", label: "Posições" },
  { key: "votacoes", label: "Votações" },
  { key: "gastos", label: "Gastos e bens" },
  { key: "historico", label: "Histórico eleitoral" },
  { key: "proposta", label: "Proposta de governo" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Qual aba abre por padrão: a primeira, na ordem fixa acima, que tenha algo
 * para mostrar.
 *
 * Antes era sempre "Posições", e para 210 das 211 candidaturas essa aba não
 * tem uma única posição aprovada — a ficha abria vazia enquanto a proposta de
 * governo protocolada no TSE (206 candidaturas a têm), os bens declarados e o
 * histórico eleitoral ficavam atrás de um clique que ninguém tinha motivo para
 * dar. Um estado vazio como primeira tela é honesto e inútil ao mesmo tempo.
 *
 * A regra é a mesma para todo mundo e não mexe na ordem nem no peso visual das
 * abas; se nenhuma tiver conteúdo, cai em "posicoes", que é onde a explicação
 * de por que não há nada está escrita.
 */
function firstTabWithContent(hasContent: Record<TabKey, boolean>): TabKey {
  return TABS.find((tab) => hasContent[tab.key])?.key ?? "posicoes";
}

export function meta({ data }: Route.MetaArgs) {
  const candidate = data?.candidate;
  if (!candidate)
    return [{ title: "Candidato não encontrado | Em Quem Votar?" }];
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

/**
 * Trocar de aba não recarrega nada.
 *
 * A aba viaja em `?aba=`, e no React Router qualquer mudança de query é uma
 * navegação: cada clique de aba revalidava o loader inteiro — a candidatura,
 * os gastos, os bens e os 20 temas — para, no fim, trocar um `display:none`.
 * Com os cinco painéis já montados no HTML servido, o dado da aba de destino
 * está na tela antes do clique; a ida ao banco não muda um pixel.
 *
 * O corte é só para navegação dentro da MESMA ficha e sem formulário no meio:
 * mudar de candidatura ou revalidar depois de uma submissão continua caindo no
 * comportamento padrão.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
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
  /** A tira de abas rola na horizontal; ver `useEffect` da aba ativa abaixo. */
  const tabStripRef = useRef<HTMLDivElement | null>(null);

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

  /**
   * O que cada aba tem, de fato, para mostrar.
   *
   * Sai inteiro do `loaderData` — nada aqui depende do localStorage —, então o
   * SSR e a hidratação escolhem a MESMA aba. Se isto dependesse do quiz, a
   * primeira pintura abriria numa aba e a hidratação em outra.
   *
   * `votacoes` é `votes.length > 0` e não `hasLegislativeRecord`: o `VoteList`
   * com lista vazia já é um estado vazio, mesmo quando o vínculo legislativo
   * existe (`VoteRecord` tem 0 linhas no banco inteiro hoje).
   */
  const tabHasContent = useMemo<Record<TabKey, boolean>>(
    () => ({
      posicoes: documentedPositions.length > 0,
      votacoes: candidate.votes.length > 0,
      gastos: spendingDetails.length > 0,
      historico: candidate.electionHistory.length > 0,
      proposta: Boolean(candidate.governmentPlanUrl),
    }),
    [
      documentedPositions.length,
      candidate.votes.length,
      candidate.electionHistory.length,
      candidate.governmentPlanUrl,
      spendingDetails.length,
    ],
  );

  const defaultTab = firstTabWithContent(tabHasContent);
  const tabParam = searchParams.get("aba");
  const activeTab: TabKey = TABS.some((t) => t.key === tabParam)
    ? (tabParam as TabKey)
    : defaultTab;

  /**
   * Traz a aba ativa para dentro da faixa visível da tira.
   *
   * A tira é `overflow-x-auto` e a aba ativa NÃO é sempre a primeira: a ficha
   * abre na primeira aba COM conteúdo, que nesta base é a quarta em muitas
   * candidaturas (quem não tem posição, voto nem gasto abre em "Histórico
   * eleitoral"). Medido a 390px numa ficha assim: a tira mostra 320px de 715,
   * nasce em `scrollLeft: 0`, e a aba ativa ocupa de 407 a 559 — inteiramente
   * fora da vista. A tela abria exibindo duas abas marcadas "nada a exibir",
   * nenhuma delas selecionada, e embaixo um painel que não pertencia a
   * nenhuma aba visível. O marcador de aba vazia existe para poupar cliques
   * às cegas; fora da vista ele produzia exatamente isso.
   *
   * `scrollLeft` na tira, e não `scrollIntoView` no botão: o segundo sobe pela
   * cadeia de ancestrais roláveis e pode mexer na rolagem do documento. Esta
   * página trabalha para não dar solavanco vertical (`preventScrollReset` no
   * `selectTab`, `scrollbar-gutter` no `app.css`); um efeito de montagem que
   * rolasse a página desfaria isso. Atribuir `scrollLeft` só move a tira.
   *
   * Sem `behavior: "smooth"` de propósito: é um ajuste de montagem, não uma
   * animação, e a preferência de movimento reduzido não precisa ser consultada
   * para algo que já é instantâneo.
   */
  useEffect(() => {
    let cancelado = false;

    const alinhar = () => {
      if (cancelado) return;
      const strip = tabStripRef.current;
      const tab = tabRefs.current[activeTab];
      if (!strip || !tab) return;
      const faixa = strip.getBoundingClientRect();
      const alvo = tab.getBoundingClientRect();
      // Posição do alvo no espaço de ROLAGEM da tira, não na viewport.
      // `clientWidth`/`clientLeft`, e não a largura do bounding rect: numa
      // plataforma de barras clássicas a tira ganha uma barra vertical de 15px
      // (a horizontal come 16px de altura, sobram 43px para abas de 44px), e o
      // rect a inclui. Medindo pelo rect, a aba parava debaixo da barra.
      const alvoEsq =
        alvo.left - faixa.left - strip.clientLeft + strip.scrollLeft;
      const alvoDir = alvoEsq + alvo.width;
      if (alvoDir > strip.scrollLeft + strip.clientWidth) {
        strip.scrollLeft = alvoDir - strip.clientWidth;
      } else if (alvoEsq < strip.scrollLeft) {
        strip.scrollLeft = alvoEsq;
      }
    };

    alinhar();
    // De novo quando as fontes chegarem: Inter e Outfit carregam DEPOIS da
    // montagem e alargam cada aba. Alinhando só na montagem, a conta usava as
    // larguras da fonte de fallback e a aba ativa terminava 8px debaixo da
    // borda direita (medido a 390px: `scrollLeft` 211 onde o correto é 219).
    document.fonts?.ready.then(alinhar);

    return () => {
      cancelado = true;
    };
  }, [activeTab]);

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

  /**
   * A aba escolhida vai para a URL (`?aba=gastos`), então ela é linkável e
   * compartilhável. O `?aba=` some quando a aba é a padrão DESTA candidatura —
   * assim cada ficha tem uma URL canônica só, em vez de duas que servem a
   * mesma tela.
   *
   * `replace` e não `push`, de propósito: as abas usam ativação automática
   * (o painel acompanha a seta do teclado, como manda o padrão WAI-ARIA), e com
   * `push` uma varredura de Home→End enfileiraria cinco entradas no histórico —
   * o botão Voltar passaria a desfazer teclas em vez de voltar para
   * `/candidatos`. Compartilhar a aba continua funcionando; desfazer a troca de
   * aba com o Voltar, não.
   */
  function selectTab(key: TabKey) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        key === defaultTab ? p.delete("aba") : p.set("aba", key);
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

  /**
   * O QUE A FICHA DO TSE DECLARA — três estados, não dois.
   *
   * Estes dois números são a única coisa que separa "a ficha do TSE não traz
   * bem algum" de "não sabemos o que a ficha traz". `null` é não sabemos (a
   * ficha nunca foi lida, ou respondeu sem a chave); `0` é a ficha dizendo,
   * explicitamente, que não há nada; `N > 0` é a ficha listando N.
   *
   * São CONTAGENS e não booleanos porque uma ficha pode listar N bens e ainda
   * assim não render linha alguma aqui — item sem data não é gravado, para
   * não inventar quando o patrimônio foi declarado. Com um booleano, esse
   * caso voltaria a cair na afirmação "não lista bem algum", que seria falsa.
   * Ver `bensDeclarados` em `~/lib/tse-divulga`.
   */
  const bensNaFicha = candidate.tseAssetsDeclared;
  const anterioresNaFicha = candidate.tsePriorElectionsDeclared;

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container>
        {/* `flex-wrap`: nome próprio longo num `flex` sem quebra empurra a
            linha para além do container em telas estreitas — e estouro
            horizontal do documento reprova o SC 1.4.10. */}
        <nav className="flex flex-wrap items-center text-xs text-slate-500">
          <Link
            to="/candidatos"
            className="focus-ring inline-flex min-h-11 items-center rounded-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            ← Candidatos
          </Link>
          <span className="mx-1.5">/</span>
          <span className="font-semibold text-slate-600">
            {candidate.displayName}
          </span>
        </nav>

        <header className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-6 sm:px-7 lg:flex-row lg:items-center lg:gap-6">
          <CandidateAvatar
            name={candidate.displayName}
            photoUrl={candidate.photoUrl}
            size="lg"
          />

          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold tracking-[-0.02em] text-slate-800 sm:text-3xl">
              {candidate.displayName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {candidate.party}
              {candidate.number != null ? ` · nº ${candidate.number}` : ""}
              {candidate.coalition ? ` · ${candidate.coalition}` : ""}
            </p>
            {candidate.viceName && (
              <p className="mt-0.5 text-sm text-slate-500">
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
                  className="inline-flex w-fit items-center rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
                >
                  Dado de imprensa — aguardando TSE
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-2 lg:justify-items-end">
            {match && match.matchPercentage !== null ? (
              <div className="lg:text-right">
                {/*
                  `text-2xl` semibold, e não 40px bold. Este número é calculado
                  no navegador de quem lê, a partir das respostas que a pessoa
                  deu ao quiz — ele descreve a leitora, não a candidatura. A
                  40px ele era o maior elemento tipográfico da ficha e vencia o
                  h1 com o nome de quem está sendo pesquisado (`text-2xl`,
                  `text-3xl` no sm), o que inverte o assunto da página e, antes
                  disso, é a mesma quebra de neutralidade que já tirou o
                  verde/vermelho dos chips: dar destaque de página a um
                  veredito sobre uma pessoa real.

                  O conserto não infla o h1. O número desce para o degrau que o
                  próprio h1 usa no mobile e perde um grau de peso, de `bold`
                  para `semibold`. Assim o nome lidera em todo breakpoint: por
                  tamanho no `sm` para cima, por peso e por ordem de leitura
                  abaixo dele. O `indigo-600` fica (6,46:1 sobre o branco); o
                  que estava errado era a massa, não a cor.

                  A migração para a escala nomeada preserva os dois degraus —
                  24px e 30px são `text-2xl` e `text-3xl`, degraus distintos —,
                  então o empate continua sendo só no mobile e continua
                  resolvido por peso. Se algum dia o h1 e este número caírem no
                  MESMO degrau em todo breakpoint, o desempate tem que voltar
                  a sair do peso e do tom, nunca de inflar o percentual.
                */}
                <p className="font-heading text-2xl leading-none font-semibold text-indigo-600">
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
                  className="focus-ring rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
                >
                  Fazer o quiz <span aria-hidden="true">→</span>
                </Link>
                <p className="text-xs text-slate-500">
                  para ver sua compatibilidade
                </p>
              </>
            )}

            <button
              type="button"
              onClick={handleCompare}
              aria-pressed={inComparison}
              className={cn(
                "focus-ring flex min-h-11 items-center justify-center rounded-xl border px-[18px] py-2.5 text-center text-xs font-semibold transition-colors",
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

          O `aria-controls` só passou a valer agora. Antes só o painel ativo
          existia no DOM, e as outras quatro abas apontavam para ids
          inexistentes — `aria-controls` é um IDREF, e um IDREF que não resolve
          não cria relação nenhuma para a tecnologia assistiva. Os cinco painéis
          passaram a ficar sempre montados, alternando `hidden`/`inert`, pelo
          mesmo raciocínio (e com o mesmo cuidado com o preflight) já comentado
          em `MOBILE_NAV_ID`, no SiteHeader.
        */}
        {/*
          `relative` não é decoração: sem ele a tira ROLA mas não RECORTA.

          O marcador de aba vazia inclui um `<span class="sr-only">`, e
          `sr-only` é `position: absolute`. Uma caixa absoluta só é recortada
          por um ancestral com `overflow` diferente de `visible` quando esse
          ancestral está entre ela e seu bloco contentor. Com a tira estática,
          o bloco contentor do span era o bloco inicial — a tira ficava de
          fora da conta, o span escapava do recorte e entrava na largura
          rolável do DOCUMENTO.

          Medido a 390px numa ficha cuja 4ª aba está vazia: `body.scrollWidth`
          375, `html.scrollWidth` 404 — 29px de rolagem horizontal na página
          inteira, vindos de um elemento que existe só para leitor de tela e
          que ninguém enxerga. É reprovação do SC 1.4.10 (Reflow) causada pelo
          próprio recurso de acessibilidade. Acontecia em 3 das 8 fichas
          medidas: só quando uma aba vazia cai longe o bastante à direita.

          `relative` sem deslocamento não muda pixel nenhum na tela — o span
          continua na posição estática que teria no fluxo, agora dentro do
          recorte da tira.
        */}
        <div
          ref={tabStripRef}
          className="relative mt-4 flex gap-1 overflow-x-auto border-b border-slate-200"
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
                  "-mb-px inline-flex min-h-11 flex-none items-center border-b-2 px-4 py-2.5 text-sm transition-colors",
                  // `focus-ring` (a utilitária de `app.css`), e não um anel
                  // próprio: a aba ativa é a única tabulável do roving
                  // tabindex, então quem chega de teclado pousa aqui e precisa
                  // ver onde pousou antes de usar as setas. O sinal era o anel
                  // default do navegador, que some contra a borda inferior
                  // indigo da aba ativa.
                  "focus-ring",
                  active
                    ? "border-indigo-600 font-bold text-indigo-600"
                    : "border-transparent font-medium text-slate-500 hover:text-slate-800",
                )}
              >
                {tab.label}
                {/*
                  Marcador de aba vazia. Sem ele, a única forma de descobrir
                  que "Votações" não tem nada é clicar — e numa ficha em que
                  três ou quatro abas estão vazias isso são três ou quatro
                  cliques para chegar à única que tem conteúdo.

                  Um travessão, e não um "0": zero é um número medido, e "0"
                  ao lado de "Votações" se leria como "esta pessoa votou zero
                  vezes", que é exatamente a afirmação falsa que o texto do
                  painel existe para evitar. O travessão é o mesmo glifo que
                  `agreementFor` já usa para ausência, e o rótulo real vai no
                  `sr-only` — quem usa leitor de tela ouve a razão, não o
                  símbolo.
                */}
                {!tabHasContent[tab.key] && (
                  <>
                    <span
                      aria-hidden="true"
                      className="ml-1.5 font-normal text-slate-500"
                    >
                      —
                    </span>
                    <span className="sr-only">, nada a exibir</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <TabPanel tab="posicoes" active={activeTab === "posicoes"}>
          <SectionHeading>
            {hasQuiz ? "Compatibilidade por tema" : "Posições por tema"}
          </SectionHeading>
          <PositionsByTopic
            rows={rows}
            answers={quizReady ? answers : {}}
            hasQuiz={hasQuiz}
          />
        </TabPanel>

        <TabPanel tab="votacoes" active={activeTab === "votacoes"}>
          <SectionHeading>Votações nominais</SectionHeading>
          {candidate.hasLegislativeRecord || candidate.votes.length > 0 ? (
            <VoteList votes={candidate.votes} />
          ) : (
            /*
              Este texto já afirmou "não exerce nem exerceu mandato", e isso
              era falso para pelo menos uma candidatura: a base da Câmara lista
              LULA como deputado federal por SP na 48ª legislatura (id 139289,
              CPF conferido contra o TSE em 27/08/2026).

              A versão seguinte consertou o mandato mas errou a CAUSA: dizia
              que "não há votação nominal nas bases de dados abertas da Câmara
              e do Senado". Também é falso, e por um motivo que muda o texto
              inteiro — as listas nominais ESTÃO no banco e a plataforma as
              publica em `/votacoes` e `/votacao/:id`, com o voto de cada
              parlamentar. O que não existe é o vínculo entre uma candidatura
              de 2026 e esses votos.

              A distinção é a mesma de `tseAssetsDeclared` no schema ("a ficha
              nunca foi lida" ≠ "a ficha respondeu com a lista vazia"), e cai
              do mesmo lado: ausência de vínculo não é ausência de voto, e a
              segunda leitura é uma afirmação falsa sobre uma pessoa real.

              Este é o caminho de quem não tem nem o `CandidateLegislativeLink`
              (210 das 211 candidaturas). Quem tem o vínculo e nenhum voto cai
              no estado vazio do próprio `VoteList`, que diz a mesma coisa com
              outras palavras — as duas telas não podem se contradizer.
            */
            <EmptyPanel
              title="Sem voto nominal associado a esta candidatura"
              body={`A plataforma publica votações da Câmara e do Senado com o voto nominal de cada parlamentar, mas nenhum deles está atribuído a ${candidate.displayName}: o vínculo entre esta candidatura e um parlamentar dessas casas ainda não foi importado para o nosso registro. O que falta aqui é o vínculo, não o voto — esta ausência não afirma que a pessoa não votou, nem que não exerceu mandato.`}
              action={
                <Link
                  to="/votacoes"
                  prefetch="intent"
                  className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Ver as votações publicadas
                </Link>
              }
            />
          )}
        </TabPanel>

        <TabPanel tab="gastos" active={activeTab === "gastos"}>
          <SectionHeading>Gastos e bens declarados</SectionHeading>
          {spendingDetails.length > 0 ? (
            /*
              `grid-cols-[minmax(0,1fr)]`, e não `grid` seco. Sem essa faixa a
              ficha rolava na horizontal em 390px — `scrollWidth` 489 contra
              `clientWidth` 390 —, o que reprova o WCAG 2.1 SC 1.4.10.

              A faixa implícita de um `grid` é `auto`, e faixa `auto` se
              dimensiona pela contribuição mínima dos itens, não pela largura
              disponível: um filho com mínimo grande estica a faixa PARA FORA do
              container e leva o documento junto. O filho aqui é o
              `SpendingChart`, cujo `truncate` traz `white-space: nowrap` e faz
              a categoria mais longa do TSE (346px medidos) virar um mínimo
              inquebrável de 428px na linha e 469px no cartão.

              O conserto fica no container e não no cartão de propósito: assim
              vale para os três filhos deste painel e para qualquer que venha
              depois, em vez de cada um ter que lembrar de se defender.
              `min-w-0` no span do `truncate` NÃO resolve — testado, o
              `scrollWidth` seguiu em 489 —, porque lá ele só afeta o
              encolhimento do item flex, não a contribuição que sobe pela
              árvore.

              Medido em Chrome headless a 390×844, ficha com bens declarados:
              489 → 390.
            */
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
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
          ) : (
            <EmptyPanel {...bensVazio(candidate.displayName, bensNaFicha)} />
          )}
        </TabPanel>

        <TabPanel tab="historico" active={activeTab === "historico"}>
          <SectionHeading>Candidaturas anteriores</SectionHeading>
          {candidate.electionHistory.length > 0 ? (
            <>
              <ElectionHistory elections={candidate.electionHistory} />
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Candidaturas anteriores registradas no DivulgaCandContas, com o
                cargo e o resultado na redação do próprio TSE. A lista cobre o
                que a Justiça Eleitoral publica; mandatos exercidos sem disputa
                eleitoral não aparecem aqui.
              </p>
            </>
          ) : (
            <EmptyPanel
              {...historicoVazio(candidate.displayName, anterioresNaFicha)}
            />
          )}
        </TabPanel>

        <TabPanel tab="proposta" active={activeTab === "proposta"}>
          <SectionHeading>Proposta de governo</SectionHeading>
          {candidate.governmentPlanUrl ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-6">
              <p className="max-w-prose text-base leading-relaxed text-slate-600">
                A proposta de governo é o documento que a coligação protocolou
                no TSE junto com o registro da candidatura. É a fonte primária
                das posições exibidas nesta página.
              </p>
              <a
                href={candidate.governmentPlanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
              >
                Abrir a proposta no TSE
                <ExternalLink className="size-4" aria-hidden="true" />
                {/* Ver `SourceCite`: o ícone de nova aba só comunica a quem
                    enxerga. Vale para os três links externos desta página. */}
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </div>
          ) : (
            <EmptyPanel
              title="Documento ainda não vinculado"
              body="A proposta de governo protocolada no TSE ainda não foi anexada a este perfil. Assim que o link oficial for sincronizado, ele aparece aqui."
            />
          )}
          {/* `break-words` no parágrafo abaixo: uma URL é um token só, sem
              espaço onde quebrar. O campo é livre — basta uma com caminho
              comprido para estourar a largura do documento em 390px, o que
              reprova o SC 1.4.10. */}
          {candidate.officialSiteUrl && (
            <p className="mt-3 text-sm break-words text-slate-500">
              Site oficial da campanha:{" "}
              <a
                href={candidate.officialSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring rounded-sm font-semibold text-indigo-600 hover:underline"
              >
                {candidate.officialSiteUrl.replace(/^https?:\/\//, "")}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </p>
          )}
        </TabPanel>

        {candidate.sourceUrl && (
          <p className="pb-10 text-xs text-slate-500">
            Registro da candidatura:{" "}
            <a
              href={candidate.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-sm font-semibold text-indigo-600 hover:underline"
            >
              {/* O rótulo tem que dizer para onde o link vai de verdade:
                  quando o dado ainda é de imprensa, ele NÃO aponta para o
                  TSE, e chamar de "consultar no TSE" seria falso. */}
              {candidate.dataSource === "tse"
                ? "consultar no TSE"
                : "ver a fonte deste registro"}
              <span className="sr-only"> (abre em nova aba)</span>
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

/**
 * O painel de bens vazio, em três redações — uma por estado de
 * `tseAssetsDeclared`. Elas moram aqui, fora do JSX, porque o que muda entre
 * os três casos é o TAMANHO DA AFIRMAÇÃO, e isso se lê melhor em prosa
 * contínua do que espalhado em ternários.
 *
 * O painel se chama "Gastos e bens", mas a afirmação forte só pode falar de
 * BENS: a plataforma não tem fonte de gasto de campanha nenhuma — o único
 * escritor de `SpendingRecord` é o `applyDivulgaDetails`, que grava
 * exclusivamente bens declarados. Dizer "não há gasto" a partir de um painel
 * vazio seria afirmar sobre uma pessoa real algo que nunca foi medido, então
 * as duas redações fortes dizem explicitamente que sobre gastos não há fonte.
 */
function bensVazio(
  nome: string,
  declarados: number | null,
): { title: string; body: string } {
  if (declarados === null) {
    // Não sabemos: a ficha nunca foi lida, ou respondeu sem a chave `bens`.
    // As duas chegam aqui como a mesma ausência, e nenhuma autoriza uma
    // afirmação sobre o conteúdo do documento oficial.
    return {
      title: "Nada a exibir em bens e gastos",
      body: `Não há bem declarado nem gasto de campanha de ${nome} para exibir nesta página. Isso é o que a plataforma tem — não é uma afirmação sobre o que a ficha do TSE traz: o dado guardado aqui não distingue uma ficha que não declara bem algum de uma leitura que não trouxe essa lista. Nada aqui é estimado.`,
    };
  }

  if (declarados === 0) {
    // A ficha respondeu `bens: []` — a lista veio, e veio vazia. É o único
    // caso em que o documento oficial sustenta a afirmação forte.
    return {
      title: "A ficha do TSE não lista bem algum",
      body: `A ficha de ${nome} no DivulgaCandContas foi lida e traz a declaração de bens vazia: o TSE não lista nenhum bem. Isso é sobre bens, e só sobre bens — a plataforma não tem fonte de gasto de campanha, então a ausência de gastos aqui não diz nada sobre os gastos desta candidatura. Nada aqui é estimado.`,
    };
  }

  // A ficha lista, e nada chegou à tela. É por este caso que a coluna é uma
  // contagem e não um booleano: com um booleano, "a lista veio" recairia na
  // redação acima e a página afirmaria "não lista bem algum" sobre alguém
  // cuja ficha lista.
  return {
    title: "Bens declarados que não puderam ser exibidos",
    body: `A ficha de ${nome} no DivulgaCandContas lista ${declarados} ${declarados === 1 ? "bem" : "bens"}, e nenhum deles aparece nesta página. Um item que chega sem descrição, sem valor ou sem a data da declaração é descartado na leitura, em vez de exibido pela metade ou com uma data inventada. Sobre gasto de campanha a plataforma não tem fonte alguma. Nada aqui é estimado.`,
  };
}

/**
 * O painel de histórico vazio, nos mesmos três estados — aqui guiados por
 * `tsePriorElectionsDeclared`, que já vem sem a própria candidatura de 2026
 * (o TSE a devolve dentro de `eleicoesAnteriores`; ver `parseDivulgaDetail`).
 * Sem esse desconto, quem não tem antecedente nenhum cairia na terceira
 * redação, dizendo que a ficha lista uma candidatura anterior.
 */
function historicoVazio(
  nome: string,
  declaradas: number | null,
): { title: string; body: string } {
  if (declaradas === null) {
    return {
      title: "Nenhuma candidatura anterior para exibir",
      body: `Não há candidatura anterior de ${nome} para exibir nesta página. A plataforma não afirma que a Justiça Eleitoral não registre nenhuma: o dado guardado aqui não distingue uma ficha que não traz candidatura anterior de uma leitura que não chegou a trazer essa lista.`,
    };
  }

  if (declaradas === 0) {
    return {
      title: "O TSE não registra candidatura anterior",
      body: `A ficha de ${nome} no DivulgaCandContas foi lida e não registra nenhuma candidatura anterior à de 2026. A lista cobre o que a Justiça Eleitoral publica na ficha da candidatura; mandatos exercidos sem disputa eleitoral não aparecem nela.`,
    };
  }

  return {
    title: "Candidaturas anteriores que não puderam ser exibidas",
    body: `A ficha de ${nome} no DivulgaCandContas lista ${declaradas} ${declaradas === 1 ? "candidatura anterior" : "candidaturas anteriores"}, e nenhuma aparece nesta página. Linhas que chegam sem identificador, ano, cargo ou resultado são descartadas na leitura, em vez de exibidas pela metade.`,
  };
}

/**
 * Um painel de aba. Os CINCO ficam sempre montados; o que muda é
 * `hidden`/`inert`.
 *
 * Duas coisas se consertam de uma vez com isso.
 *
 * 1. `aria-controls`. Ele é um IDREF, e enquanto só o painel ativo existia no
 *    DOM as outras quatro abas apontavam para ids inexistentes — atributo
 *    inválido, relação nenhuma para a tecnologia assistiva. Mesmo raciocínio e
 *    mesma solução do menu mobile (ver `MOBILE_NAV_ID` em `SiteHeader.tsx`),
 *    inclusive a dependência: `hidden` só vence uma utilitária de `display`
 *    porque o preflight do Tailwind v4 o declara com `!important`.
 *
 * 2. O conteúdo que só existia depois do JS. Quatro quintos da ficha — gastos,
 *    bens, histórico e a proposta de governo protocolada no TSE — não iam no
 *    HTML servido: buscador não indexava, Ctrl-F não achava, e a única aba com
 *    conteúdo de 210 das 211 candidaturas ficava invisível para quem lê o
 *    documento e não o executa.
 *
 * `inert` além de `hidden` porque `display:none` já tira do foco em todo
 * navegador atual, mas é uma linha de CSS de distância de ser sobrescrito,
 * enquanto `inert` é do DOM. O `tabIndex` acompanha: o painel é tabulável
 * porque pode rolar, e um container rolável precisa ser alcançável por teclado
 * — mas só o painel visível, senão a tabulação atravessa quatro paradas
 * invisíveis.
 */
function TabPanel({
  tab,
  active,
  children,
}: {
  tab: TabKey;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`painel-${tab}`}
      aria-labelledby={`aba-${tab}`}
      hidden={!active}
      inert={!active}
      /* Sem anel, quem tabula da aba para o painel pousa num bloco sem
         aparência de controle e não sabe que o Page Down agora rola ali. */
      tabIndex={active ? 0 : -1}
      className="focus-ring py-5"
    >
      {children}
    </div>
  );
}

/**
 * O cabeçalho de seção da ficha.
 *
 * Era `text-xs` em caixa alta — 12px, MENOR que o corpo de texto que ele
 * rotula, na página mais importante do site. Um h2 menor que o parágrafo
 * inverte a hierarquia que o próprio elemento anuncia, e a caixa alta ainda
 * vinha escrita no markup ("POSIÇÕES POR TEMA"), o que muda o texto que o
 * leitor de tela recebe. Agora a escala é monótona de verdade — h1 24/30px,
 * h2 18px, h3 de cartão 14px, rótulos 12px — e a caixa alta que sobrou é só
 * CSS, nos rótulos.
 *
 * A hierarquia de tom continua valendo por dentro: h2 `slate-800` (13,97:1
 * sobre o `slate-50` do corpo), tema `slate-600`, rótulo de coluna
 * `slate-500`.
 */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading mb-3 text-lg font-bold text-slate-800">
      {children}
    </h2>
  );
}

function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  /** Para onde ir quando esta aba não tem nada — opcional. */
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="text-base font-bold text-slate-600">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
        {body}
      </p>
      {action}
    </div>
  );
}
