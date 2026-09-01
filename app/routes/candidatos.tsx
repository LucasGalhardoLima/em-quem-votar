import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Route } from "./+types/candidatos";
import { pageMeta } from "~/root";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { CandidateCard } from "~/components/candidate/CandidateCard";
import {
  MAX_COMPARISON,
  useComparisonHydration,
  useComparisonStore,
} from "~/stores/comparisonStore";
import {
  REGISTRATION_STATUSES,
  STATUS_PRESENTATION,
  statusDescription,
  type RegistrationStatus,
} from "~/lib/candidate-status";
import {
  OFFICE_PRESENTATION,
  UFS,
  parseOffice,
  parseUf,
  raceLabel,
  ufName,
  type Office,
} from "~/lib/office";
import { CandidateService } from "~/services/candidate.server";
import { cn } from "~/lib/utils";

export function meta({ data }: Route.MetaArgs) {
  const nome = ufName(data?.uf ?? null);
  const titulo = nome
    ? `Candidatos 2026 em ${nome} | Em Quem Votar?`
    : "Candidatos 2026 | Em Quem Votar?";
  return [
    ...pageMeta({
      title: titulo,
      description: nome
        ? `Candidaturas à Presidência e ao governo de ${nome} em 2026, com partido, número, chapa e situação de registro conforme o TSE. Peso visual igual para todas.`
        : "Candidaturas à Presidência da República e aos governos estaduais em 2026, com partido, número, chapa e situação de registro conforme o TSE. Peso visual igual para todas.",
      type: "website",
    }),
    { name: "robots", content: "index,follow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const initialQuery = url.searchParams.get("q") ?? "";
  const initialStatus = url.searchParams.get("situacao") ?? "todos";

  // Cargo e UF filtram no servidor, não no cliente: com 27 estados na base, o
  // recorte por estado é o que mantém a carga pequena — e o sorteio da ordem
  // só é honesto se embaralhar o conjunto que a pessoa vai realmente ver.
  const uf = parseUf(url.searchParams.get("uf"));
  const office = parseOffice(url.searchParams.get("cargo"));

  // Ordem sorteada a cada visita: nenhuma candidatura ocupa sempre o topo.
  const shuffleSeed = Math.floor(Math.random() * 2 ** 31);

  const [{ items, total }, statusCounts] = await Promise.all([
    CandidateService.list({ limit: 300, shuffleSeed, uf, office }),
    CandidateService.countByStatus(office, uf),
  ]);

  return {
    items,
    total,
    statusCounts,
    initialQuery,
    initialStatus,
    uf,
    office,
  };
}

/**
 * Chip de filtro — o mesmo desenho para cargo e para situação.
 *
 * `min-h-11` porque a altura vinha só do texto mais o respiro — com `text-xs`
 * são 16px de entrelinha e 16px de `py-2`, uma pílula de 32px, bem abaixo dos
 * 44px que esta tela adota como alvo de toque. São os controles
 * que o eleitor usa antes de qualquer outra coisa na listagem, e eles vivem
 * lado a lado numa faixa que rola no celular — errar o chip vizinho é o modo
 * de falha comum aqui. Como o chip já é `inline-flex` centrado, a altura
 * mínima cresce só a área de toque, sem mexer no tamanho do texto.
 */
const CHIP =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-2 text-xs transition-colors";

/** Alvo do `aria-controls` do botão que abre a bandeja de filtros. */
const FILTER_TRAY_ID = "filtros-listagem";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Quantas candidaturas entram no primeiro lote, e quantas cada clique em
 * "mostrar mais" acrescenta.
 *
 * Por que existe um lote: a listagem carrega até 300 candidaturas e as 211 de
 * hoje já rendiam um documento de 16.315px no desktop e 49.662px no celular —
 * ~59 telas de rolagem para ver a lista inteira, com todas as imagens e nós
 * no DOM inicial. 24 preenche seis linhas na grade de 4 colunas e uma tela e
 * meia no celular: o bastante para a lista parecer uma lista, longe do ponto
 * em que rolar deixa de ser navegar.
 *
 * Um lote e um contador, não virtualização: a lista é curta o suficiente para
 * que a dependência não se pague, e a rolagem por âncora e o Ctrl+F do
 * navegador continuam funcionando no que está exibido.
 */
const BATCH_SIZE = 24;

/**
 * Altura do cabeçalho fixo do site, medida em tempo de execução.
 *
 * A barra de filtros gruda logo ABAIXO do `<header sticky top-0 z-40>` que
 * vive em `SiteHeader`. Cravar o número aqui acoplaria esta tela à altura de
 * um componente de outro arquivo — alguns pixels a mais e a barra some sob o
 * cabeçalho, alguns a menos e sobra uma fresta por onde os cartões passam
 * rolando. O observer mantém os dois alinhados sem que nenhum precise
 * conhecer o outro, inclusive quando o menu mobile abre e o cabeçalho cresce.
 *
 * Zero até a hidratação: no SSR não há layout para medir, e `top: 0` só
 * significa que a barra ainda não gruda — nunca que ela sai do lugar.
 */
function useStickyOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setOffset(header.getBoundingClientRect().height);
    measure();

    // A medida inicial já basta para a barra grudar no lugar certo; o
    // observer só cobre o cabeçalho MUDANDO de altura (menu mobile abrindo).
    // A guarda existe porque o jsdom não implementa `ResizeObserver`: sem
    // ela, o primeiro teste que renderizar esta tela junto do `<header>`
    // quebra num construtor indefinido, e não no que estiver testando.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return offset;
}

export default function Candidatos({ loaderData }: Route.ComponentProps) {
  const { items, total, statusCounts, initialQuery, initialStatus, uf, office } =
    loaderData;
  const [, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  // Bandeja de filtros: recolhida no celular, sempre aberta a partir de `lg`
  // (o botão que a controla é `lg:hidden`). É classe e não o atributo
  // `hidden` de propósito — o preflight do Tailwind declara `[hidden]` com
  // `!important`, e ele venceria o `lg:flex` que a mantém aberta no desktop.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const stickyTop = useStickyOffset();

  // Mesma espera de votacoes._index. A filtragem em si já é imediata (lê o
  // estado `query`, não a URL); o que sobrava por tecla era uma escrita na
  // URL e a atualização de roteador que vem junto — "orçamento" são nove numa
  // tela que carrega até 300 candidaturas.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  function cancelPendingSearch() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }

  const ufNome = ufName(uf);

  const hydrated = useComparisonHydration();
  const selectedIds = useComparisonStore((s) => s.selectedIds);
  const toggleId = useComparisonStore((s) => s.toggleId);

  // A busca é do cliente; o recorte de cargo/UF é do servidor. Os chips
  // contam sobre o conjunto já filtrado pela busca — um contador que conta
  // candidaturas invisíveis é pior que contador nenhum.
  const searching = query.trim().length > 0;

  const searched = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter(
      (c) =>
        normalize(c.displayName).includes(q) ||
        normalize(c.name).includes(q) ||
        normalize(c.party).includes(q) ||
        String(c.number ?? "").includes(q),
    );
  }, [items, query]);

  const chips = useMemo(() => {
    // Sem busca, os números vêm do servidor: ele conta o escopo inteiro,
    // inclusive o que ficou além do limite de itens carregados.
    const countFor = (s: RegistrationStatus) =>
      searching
        ? searched.filter((c) => c.registrationStatus === s).length
        : (statusCounts.find((c) => c.status === s)?.count ?? 0);

    // O chip ativo continua visível mesmo zerado pela busca — sumir com ele
    // deixaria a pessoa sem lista e sem o filtro que a esvaziou.
    const present = REGISTRATION_STATUSES.filter(
      (s) => countFor(s) > 0 || statusFilter === s,
    );

    return [
      {
        key: "todos",
        label: `Todos · ${searching ? searched.length : total}`,
        title: searching
          ? "Todas as candidaturas que atendem à busca."
          : "Todas as candidaturas registradas.",
      },
      ...present.map((s) => ({
        key: s,
        label: `${STATUS_PRESENTATION[s].label} · ${countFor(s)}`,
        title: statusDescription(s),
      })),
    ];
  }, [searched, searching, statusCounts, statusFilter, total]);

  const visible = useMemo(
    () =>
      statusFilter === "todos"
        ? searched
        : searched.filter((c) => c.registrationStatus === statusFilter),
    [searched, statusFilter],
  );

  /**
   * Agrupa por disputa. Uma grade única misturando Presidente e Governador
   * sugeriria que se escolhe UM entre todos — mas são votos separados, e o
   * eleitor dá os dois. A ordem das seções é a da cédula.
   */
  const groups = useMemo(() => {
    const byRace = new Map<
      string,
      { office: Office; uf: string | null; label: string; items: typeof visible }
    >();
    for (const c of visible) {
      const key = `${c.office}:${c.uf ?? ""}`;
      const bucket = byRace.get(key);
      if (bucket) {
        bucket.items.push(c);
      } else {
        byRace.set(key, {
          office: c.office,
          uf: c.uf,
          label: raceLabel(c.office, c.uf),
          items: [c],
        });
      }
    }
    return [...byRace.values()].sort((a, b) => {
      if (a.office !== b.office) return a.office === "presidential" ? -1 : 1;
      return (a.uf ?? "").localeCompare(b.uf ?? "");
    });
  }, [visible]);

  /**
   * Lote exibido. Sempre um PREFIXO do conjunto filtrado — nunca reordena e
   * nunca repete, senão a ordem sorteada pelo servidor (`shuffleSeed`, uma
   * por requisição) deixaria de valer no meio da lista e alguém apareceria
   * duas vezes.
   *
   * O reset ao trocar de filtro é feito durante a renderização, e não num
   * efeito, porque um efeito só corre DEPOIS da pintura: quem tivesse
   * expandido a lista veria o lote grande piscar com os resultados novos
   * antes de encolher.
   */
  const [shown, setShown] = useState(BATCH_SIZE);
  const [shownFor, setShownFor] = useState(visible);
  if (shownFor !== visible) {
    setShownFor(visible);
    setShown(BATCH_SIZE);
  }

  const shownGroups = useMemo(() => {
    let budget = shown;
    const out: {
      key: string;
      label: string;
      items: typeof visible;
      total: number;
    }[] = [];
    for (const group of groups) {
      if (budget <= 0) break;
      out.push({
        key: `${group.office}:${group.uf ?? ""}`,
        label: group.label,
        items:
          group.items.length <= budget ? group.items : group.items.slice(0, budget),
        total: group.items.length,
      });
      budget -= group.items.length;
    }
    return out;
  }, [groups, shown]);

  const remaining = Math.max(0, visible.length - shown);

  const attentionStatuses = useMemo(
    () =>
      REGISTRATION_STATUSES.filter(
        (s) =>
          STATUS_PRESENTATION[s].tone === "attention" &&
          statusCounts.some((c) => c.status === s && c.count > 0),
      ),
    [statusCounts],
  );

  function syncUrl(next: { q?: string; situacao?: string }) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        const q = next.q ?? query;
        const s = next.situacao ?? statusFilter;
        q ? p.set("q", q) : p.delete("q");
        s !== "todos" ? p.set("situacao", s) : p.delete("situacao");
        return p;
      },
      { replace: true, preventScrollReset: true },
    );
  }

  /**
   * Cargo e UF recarregam o loader (navegação de verdade, sem `replace`), ao
   * contrário de busca e situação, que filtram o que já está na mão. São
   * recortes do servidor: mudar de estado é buscar outro conjunto.
   */
  function navigateScope(next: { uf?: string | null; cargo?: string | null }) {
    // O timer pendente escreveria `situacao` a partir de um closure velho e
    // desfaria esta navegação 300ms depois.
    cancelPendingSearch();
    const p = new URLSearchParams();
    const nextUf = next.uf === undefined ? uf : next.uf;
    const nextCargo = next.cargo === undefined ? office : next.cargo;
    if (nextUf) p.set("uf", nextUf);
    if (nextCargo) p.set("cargo", nextCargo);
    if (query) p.set("q", query);
    setSearchParams(p, { preventScrollReset: true });
  }

  /** Volta a listagem ao estado inicial, inclusive os recortes do servidor. */
  function clearFilters() {
    cancelPendingSearch();
    setQuery("");
    setStatusFilter("todos");
    setSearchParams({}, { replace: true, preventScrollReset: true });
  }

  // Busca fica de fora: ela tem campo próprio, sempre visível. A contagem
  // aqui é a do botão que abre a bandeja, e só conta o que está dentro dela.
  const trayFilterCount = [uf !== null, office !== null, statusFilter !== "todos"]
    .filter(Boolean).length;
  const hasActiveFilters = trayFilterCount > 0 || searching;

  const countLabel =
    visible.length === 1 ? "1 candidatura" : `${visible.length} candidaturas`;

  /**
   * Anúncio da contagem para leitor de tela.
   *
   * A contagem visível muda a cada tecla; o anúncio espera a digitação parar.
   * Sem a espera, "maria" viraria cinco falas em cima da própria digitação e
   * nenhuma delas seria a resposta. Os 400ms cobrem também os chips: clicar
   * três seguidos anuncia o resultado dos três, não de cada um.
   */
  const resultsMessage = searching
    ? visible.length === 0
      ? `Nenhuma candidatura encontrada para ${query.trim()}.`
      : `${countLabel} para ${query.trim()}.`
    : `${countLabel}.`;
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(resultsMessage), 400);
    return () => clearTimeout(timer);
  }, [resultsMessage]);

  function handleToggle(id: string, name: string) {
    const result = toggleId(id);
    if (result === "limit") {
      toast.warning(`Máximo de ${MAX_COMPARISON} — remova um para trocar`);
    } else if (result === "added") {
      toast.success(
        `${name} adicionado à comparação (${selectedIds.length + 1} de ${MAX_COMPARISON})`,
      );
    } else {
      toast(`${name} removido da comparação`);
    }
  }

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="pt-9 pb-4">
        <h1 className="font-heading text-3xl font-bold tracking-[-0.02em] text-slate-800 sm:text-4xl">
          {ufNome ? `Candidatos 2026 — ${ufNome}` : "Candidatos 2026"}
        </h1>
        <p className="mt-1.5 text-base text-pretty text-slate-500">
          {ufNome
            ? "Presidência e governo do estado — os dois votos que você dá nesta eleição."
            : "Presidência e governos estaduais."}{" "}
          Peso visual igual para todas as candidaturas · ordem sorteada a cada
          visita · situação de registro conforme o TSE
        </p>
      </Container>

      {/*
        Barra de filtros grudada no topo, abaixo do cabeçalho.

        Antes daqui saíam quatro blocos empilhados — estado, cargo, busca,
        situação — que ocupavam ~640px de altura no celular antes do primeiro
        cartão, e que sumiam para sempre assim que a pessoa começava a rolar.
        Com filtros no alto e resultado embaixo, voltar a refinar custava a
        rolagem inteira de volta; era o caso clássico que o padrão de bandeja
        móvel (NN/g, Baymard) existe para resolver: filtro e resultado
        precisam continuar ao alcance um do outro.

        Aqui a barra fica com o que é usado a cada consulta — o campo de
        busca, a contagem e o "limpar" — e o resto vira bandeja recolhível. A
        contagem mora ao lado do controle de propósito: é a resposta ao que a
        pessoa acabou de fazer, e ela precisa vê-la sem sair do lugar.

        A partir de `lg` nada disso é necessário: a barra volta a ser estática
        e a bandeja fica sempre aberta.
      */}
      <div
        style={{ top: stickyTop }}
        className="sticky z-30 border-b border-slate-200 bg-slate-50 lg:static lg:z-auto lg:border-b-0"
      >
        <Container className="py-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuery(value);
                  cancelPendingSearch();
                  searchTimer.current = setTimeout(
                    () => syncUrl({ q: value }),
                    300,
                  );
                }}
                placeholder="Buscar por nome, partido ou número…"
                aria-label="Buscar candidatos"
                className="focus-ring min-h-11 w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls={FILTER_TRAY_ID}
              className={cn(
                CHIP,
                "flex-none gap-1.5 px-4 lg:hidden",
                trayFilterCount > 0
                  ? "border-slate-800 bg-slate-800 font-semibold text-white"
                  : "border-slate-200 bg-white font-medium text-slate-500 hover:border-slate-300",
              )}
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filtros
              {trayFilterCount > 0 && ` (${trayFilterCount})`}
            </button>
          </div>

          <div
            id={FILTER_TRAY_ID}
            className={cn(
              "flex-col gap-3 pt-3 lg:flex lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4",
              filtersOpen ? "flex" : "hidden",
            )}
          >
            <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600">
              <span className="flex-none">Seu estado</span>
              <select
                value={uf ?? ""}
                onChange={(e) => navigateScope({ uf: e.target.value || null })}
                className="focus-ring min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 lg:flex-none"
              >
                <option value="">Todos os estados</option>
                {UFS.map((u) => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </label>

            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar por cargo"
            >
              {([null, "presidential", "governor"] as const).map((key) => {
                const active = office === key;
                const label =
                  key === null
                    ? "Todos os cargos"
                    : OFFICE_PRESENTATION[key].ballotLabel;
                return (
                  <button
                    key={key ?? "todos"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => navigateScope({ cargo: key })}
                    className={cn(
                      CHIP,
                      active
                        ? "border-slate-800 bg-slate-800 font-semibold text-white"
                        : "border-slate-200 bg-white font-medium text-slate-500 hover:border-slate-300",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Filtrar por situação"
            >
              {chips.map((chip) => {
                const active = statusFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    title={chip.title}
                    aria-pressed={active}
                    onClick={() => {
                      // Cancela antes: `syncUrl` já lê o `query` corrente do
                      // closure, mas o timer pendente traz o `statusFilter`
                      // velho e reverteria este clique.
                      cancelPendingSearch();
                      setStatusFilter(chip.key);
                      syncUrl({ situacao: chip.key });
                    }}
                    className={cn(
                      CHIP,
                      active
                        ? "border-slate-800 bg-slate-800 font-semibold text-white"
                        : "border-slate-200 bg-white font-medium text-slate-500 hover:border-slate-300",
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            {/* `min-w-0 break-words`: o termo buscado entra aqui verbatim, e
                uma palavra colada sem espaço não tem ponto de quebra. */}
            <p className="min-w-0 text-xs break-words text-slate-500">
              <span className="font-semibold text-slate-600">{countLabel}</span>
              {searching ? ` para “${query.trim()}”` : ""}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                // `min-h-11` pelo alvo de toque que esta tela adota, e `-my-2`
                // para que os 44px não engordem a linha da contagem.
                className="focus-ring -my-2 inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </Container>
      </div>

      {/*
        Fora da barra grudada: uma live region dentro de um elemento
        `position: sticky` continua funcionando, mas a barra é reposicionada a
        cada rolagem e não é lugar para um nó que só existe para ser lido.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Container className="pt-5 pb-3">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
            <p className="text-base font-bold text-pretty break-words text-slate-600">
              {total === 0
                ? "Nenhuma candidatura sincronizada ainda"
                : searching
                  ? `Nenhuma candidatura encontrada para “${query.trim()}”`
                  : "Nenhuma candidatura nesta situação"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {total === 0
                ? "Os dados do TSE ainda não foram importados para este ambiente. Rode npm run sync:tse para popular a lista."
                : searching
                  ? "A busca cobre nome, partido e número. Tente outro termo ou limpe os filtros."
                  : "Nenhuma candidatura do recorte atual está nessa situação de registro."}
            </p>
            {total > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="focus-ring mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-900"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {shownGroups.map((group) => (
              <section key={group.key}>
                {/*
                  `flex-wrap` e `min-w-0`: "Governador — Rio Grande do Norte"
                  mais a contagem não cabem nos 350px úteis de uma tela de
                  390px, e sem a quebra o título partia no meio. Agora a
                  contagem desce uma linha e o nome da disputa fica inteiro.
                */}
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2 border-b border-slate-200 pb-2">
                  <h2 className="min-w-0 font-heading text-lg font-bold text-slate-800">
                    {group.label}
                  </h2>
                  {/*
                    Enquanto o lote não cobre a disputa inteira, o cabeçalho
                    diz os dois números. Anunciar só "13 candidaturas" sobre
                    oito cartões faria a seção parecer incompleta por defeito
                    de dado, e não por escolha de exibição.
                  */}
                  <span className="text-xs text-slate-500">
                    {group.items.length < group.total
                      ? `${group.items.length} de ${group.total} candidaturas`
                      : `${group.total} ${group.total === 1 ? "candidatura" : "candidaturas"}`}
                  </span>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.items.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      selected={hydrated && selectedIds.includes(candidate.id)}
                      onToggleCompare={() =>
                        handleToggle(candidate.id, candidate.displayName)
                      }
                    />
                  ))}
                </div>
              </section>
            ))}

            {remaining > 0 && (
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + BATCH_SIZE)}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  {remaining <= BATCH_SIZE
                    ? remaining === 1
                      ? "Mostrar a última candidatura"
                      : `Mostrar as ${remaining} restantes`
                    : `Mostrar mais ${BATCH_SIZE} de ${remaining} restantes`}
                </button>
                <p className="text-xs text-slate-500">
                  {visible.length - remaining} de {visible.length} exibidas
                </p>
              </div>
            )}
          </div>
        )}
      </Container>

      <Container className="flex flex-col gap-4 pt-2 pb-7 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-500">
          {attentionStatuses.length > 0
            ? attentionStatuses
                .map((s) => `${STATUS_PRESENTATION[s].label} — ${statusDescription(s)}`)
                .join(" ")
            : "A situação exibida em cada card é a do TSE, sem reescrita."}
        </p>
        {hydrated && selectedIds.length > 0 && (
          <Link
            to={`/comparar?ids=${selectedIds.join(",")}`}
            className="focus-ring inline-flex min-h-11 flex-none items-center justify-center rounded-xl bg-slate-800 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-900"
          >
            Comparar selecionados ({selectedIds.length}) <span aria-hidden="true">→</span>
          </Link>
        )}
      </Container>
    </main>
  );
}
