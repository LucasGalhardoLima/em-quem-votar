import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { toast } from "sonner";
import type { Route } from "./+types/candidatos";
import { Container } from "~/components/layout";
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
    { title: titulo },
    {
      name: "description",
      content: nome
        ? `Candidaturas à Presidência e ao governo de ${nome} em 2026, com partido, número, chapa e situação de registro conforme o TSE. Peso visual igual para todas.`
        : "Candidaturas à Presidência da República e aos governos estaduais em 2026, com partido, número, chapa e situação de registro conforme o TSE. Peso visual igual para todas.",
    },
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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function Candidatos({ loaderData }: Route.ComponentProps) {
  const { items, total, statusCounts, initialQuery, initialStatus, uf, office } =
    loaderData;
  const [, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  const ufNome = ufName(uf);

  const hydrated = useComparisonHydration();
  const selectedIds = useComparisonStore((s) => s.selectedIds);
  const toggleId = useComparisonStore((s) => s.toggleId);

  const chips = useMemo(() => {
    const present = REGISTRATION_STATUSES.filter((s) =>
      statusCounts.some((c) => c.status === s && c.count > 0),
    );
    return [
      { key: "todos", label: `Todos · ${total}`, title: "Todas as candidaturas registradas." },
      ...present.map((s) => ({
        key: s,
        label: `${STATUS_PRESENTATION[s].label} · ${
          statusCounts.find((c) => c.status === s)?.count ?? 0
        }`,
        title: statusDescription(s),
      })),
    ];
  }, [statusCounts, total]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return items.filter((c) => {
      if (statusFilter !== "todos" && c.registrationStatus !== statusFilter)
        return false;
      if (!q) return true;
      return (
        normalize(c.displayName).includes(q) ||
        normalize(c.name).includes(q) ||
        normalize(c.party).includes(q) ||
        String(c.number ?? "").includes(q)
      );
    });
  }, [items, query, statusFilter]);

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
    const p = new URLSearchParams();
    const nextUf = next.uf === undefined ? uf : next.uf;
    const nextCargo = next.cargo === undefined ? office : next.cargo;
    if (nextUf) p.set("uf", nextUf);
    if (nextCargo) p.set("cargo", nextCargo);
    if (query) p.set("q", query);
    setSearchParams(p, { preventScrollReset: true });
  }

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
    <main className="flex-1">
      <Container className="pt-9 pb-3">
        <h1 className="font-heading text-[28px] font-bold tracking-[-0.02em] text-slate-800 sm:text-[34px]">
          {ufNome ? `Candidatos 2026 — ${ufNome}` : "Candidatos 2026"}
        </h1>
        <p className="mt-1.5 text-[14.5px] text-pretty text-slate-500">
          {ufNome
            ? "Presidência e governo do estado — os dois votos que você dá nesta eleição."
            : "Presidência e governos estaduais."}{" "}
          Peso visual igual para todas as candidaturas · ordem sorteada a cada
          visita · situação de registro conforme o TSE
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
            <span className="flex-none">Seu estado</span>
            <select
              value={uf ?? ""}
              onChange={(e) => navigateScope({ uf: e.target.value || null })}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10"
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
                    "rounded-full border px-3.5 py-2 text-[12.5px] transition-colors",
                    active
                      ? "border-indigo-600 bg-indigo-600 font-semibold text-white"
                      : "border-slate-200 bg-white font-medium text-slate-500 hover:border-slate-300",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                syncUrl({ q: e.target.value });
              }}
              placeholder="Buscar por nome, partido ou número…"
              aria-label="Buscar candidatos"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10"
            />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
            {chips.map((chip) => {
              const active = statusFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  title={chip.title}
                  aria-pressed={active}
                  onClick={() => {
                    setStatusFilter(chip.key);
                    syncUrl({ situacao: chip.key });
                  }}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-[12.5px] transition-colors",
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
      </Container>

      <Container className="pt-5 pb-3">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-base font-bold text-slate-600">
              {total === 0
                ? "Nenhuma candidatura sincronizada ainda"
                : "Nenhum candidato encontrado"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] text-slate-400">
              {total === 0
                ? "Os dados do TSE ainda não foram importados para este ambiente. Rode npm run sync:tse para popular a lista."
                : "Tente outro nome, partido ou número — ou limpe os filtros."}
            </p>
            {total > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("todos");
                  setSearchParams({}, { replace: true });
                }}
                className="mt-4 rounded-xl bg-slate-800 px-6 py-3 text-[13.5px] font-semibold text-white hover:bg-slate-900"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((group) => (
              <section key={`${group.office}:${group.uf ?? ""}`}>
                <div className="mb-3 flex items-baseline gap-2 border-b border-slate-200 pb-2">
                  <h2 className="font-heading text-[17px] font-bold text-slate-800">
                    {group.label}
                  </h2>
                  <span className="text-[12.5px] text-slate-400">
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "candidatura" : "candidaturas"}
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
          </div>
        )}
      </Container>

      <Container className="flex flex-col gap-4 pt-2 pb-7 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] leading-relaxed text-slate-400">
          {attentionStatuses.length > 0
            ? attentionStatuses
                .map((s) => `${STATUS_PRESENTATION[s].label} — ${statusDescription(s)}`)
                .join(" ")
            : "A situação exibida em cada card é a do TSE, sem reescrita."}
        </p>
        {hydrated && selectedIds.length > 0 && (
          <Link
            to={`/comparar?ids=${selectedIds.join(",")}`}
            className="flex-none rounded-xl bg-slate-800 px-5 py-2.5 text-center text-[13px] font-semibold text-white transition-colors hover:bg-slate-900"
          >
            Comparar selecionados ({selectedIds.length}) →
          </Link>
        )}
      </Container>
    </main>
  );
}
