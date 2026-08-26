import type { Route } from "./+types/votacao.$id";
import { useLoaderData, Link, Await } from "react-router";
import { BillService } from "~/services/bill.server";
import { ExternalLink, Search, User } from "lucide-react";
import { useState, Suspense } from "react";
import { Container } from "~/components/layout";
import { VoteDetailsSkeleton } from "~/components/SkeletonLoader";

export function meta() {
  return [
    { title: "Votação | Em Quem Votar?" },
    {
      name: "description",
      content: "Veja como cada parlamentar votou nesta votação nominal.",
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.id) {
    throw new Response("ID inválido", { status: 400 });
  }
  const billPromise = BillService.getById(params.id);
  return { bill: billPromise };
}

type BillData = NonNullable<Awaited<ReturnType<typeof BillService.getById>>>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function VotacaoRoute() {
  const { bill } = useLoaderData<typeof loader>();

  return (
    <Suspense fallback={<VoteDetailsSkeleton />}>
      <Await resolve={bill}>
        {(resolvedBill) => {
          if (!resolvedBill)
            return (
              <main className="flex-1">
                <Container className="py-16">
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                    <p className="text-base font-bold text-slate-600">
                      Votação não encontrada
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-[13.5px] text-slate-400">
                      O endereço pode estar incorreto ou a votação ainda não foi
                      publicada.
                    </p>
                    <Link
                      to="/votacoes"
                      className="mt-4 inline-block rounded-xl bg-slate-800 px-6 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-slate-900"
                    >
                      Ver todas as votações
                    </Link>
                  </div>
                </Container>
              </main>
            );
          return <VoteDetailsContent bill={resolvedBill} />;
        }}
      </Await>
    </Suspense>
  );
}

function VoteDetailsContent({ bill }: { bill: BillData }) {
  const [filter, setFilter] = useState("");

  const filterText = filter.toLowerCase();
  const title = bill.simplifiedTitle || bill.title;
  const sourceLabel = bill.sourceType === "senado" ? "Senado" : "Câmara";

  // Candidate votes (new system)
  const candidateSim = bill.candidateVotes.filter(
    (v) =>
      v.voteType === "SIM" &&
      (!filterText ||
        v.candidateName.toLowerCase().includes(filterText) ||
        v.candidateParty.toLowerCase().includes(filterText))
  );
  const candidateNao = bill.candidateVotes.filter(
    (v) =>
      v.voteType === "NÃO" &&
      (!filterText ||
        v.candidateName.toLowerCase().includes(filterText) ||
        v.candidateParty.toLowerCase().includes(filterText))
  );
  const candidateOther = bill.candidateVotes.filter(
    (v) =>
      v.voteType !== "SIM" &&
      v.voteType !== "NÃO" &&
      (!filterText ||
        v.candidateName.toLowerCase().includes(filterText) ||
        v.candidateParty.toLowerCase().includes(filterText))
  );

  // Legacy votes (old politician system)
  const legacySim = bill.legacyVotes.filter(
    (v) =>
      v.voteType === "SIM" &&
      (!filterText ||
        v.politician.name.toLowerCase().includes(filterText) ||
        v.politician.party.toLowerCase().includes(filterText))
  );
  const legacyNao = bill.legacyVotes.filter(
    (v) =>
      v.voteType === "NÃO" &&
      (!filterText ||
        v.politician.name.toLowerCase().includes(filterText) ||
        v.politician.party.toLowerCase().includes(filterText))
  );

  return (
    <main className="flex-1">
      <Container className="pt-9 pb-3">
        <nav
          className="flex items-center gap-2 text-[12.5px]"
          aria-label="Trilha de navegação"
        >
          <Link
            to="/votacoes"
            className="flex-none font-semibold text-indigo-600 hover:text-indigo-700"
          >
            ← Votações
          </Link>
          <span className="flex-none text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="truncate text-slate-500">{title}</span>
        </nav>

        <h1 className="mt-3 font-heading text-[28px] font-bold tracking-[-0.02em] text-pretty text-slate-800 sm:text-[34px]">
          {title}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
          <time dateTime={bill.voteDate}>
            {dateFormatter.format(new Date(bill.voteDate))}
          </time>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          {/*
            A origem sempre aparece. Quando não há sourceUrl registrado, o nome
            da casa legislativa fica como texto simples — nunca escondemos a
            procedência do dado.
          */}
          {bill.sourceUrl ? (
            <a
              href={bill.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Fonte oficial · {sourceLabel}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : (
            <span>Fonte: {sourceLabel}</span>
          )}
        </div>
      </Container>

      <Container className="flex flex-col gap-4 pt-5 pb-12">
        {/* Description */}
        {(bill.simplifiedDescription || bill.description) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-[11px] font-bold tracking-[0.06em] text-slate-500 uppercase">
              Sobre a votação
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-line text-slate-600">
              {bill.simplifiedDescription || bill.description}
            </p>
          </section>
        )}

        {/* O que cada voto significa — descrição factual, sem juízo de valor */}
        {(bill.voteSimDetails || bill.voteNaoDetails) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {bill.voteSimDetails && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-[11px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                  Votar Sim significa
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
                  {bill.voteSimDetails}
                </p>
              </section>
            )}
            {bill.voteNaoDetails && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-[11px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                  Votar Não significa
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
                  {bill.voteNaoDetails}
                </p>
              </section>
            )}
          </div>
        )}

        {/*
          Placar em tons neutros de propósito: Sim, Não, Abstenção e Obstrução
          são registros do voto, não acerto ou erro. Colorir Sim de verde e Não
          de vermelho embutiria um juízo de valor que a plataforma não emite.
        */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Sim", count: bill.summary.sim },
            { label: "Não", count: bill.summary.nao },
            { label: "Abstenção", count: bill.summary.abstencao },
            { label: "Obstrução", count: bill.summary.obstrucao },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-center"
            >
              <p className="text-[22px] font-bold text-slate-800 tabular-nums">
                {item.count}
              </p>
              <p className="mt-0.5 text-[11px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Filtrar por nome ou partido…"
            aria-label="Filtrar votos por nome ou partido"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10"
          />
        </div>

        {/* Candidate votes (new system) */}
        {bill.candidateVotes.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] text-slate-800">
              Votos dos candidatos
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <VoteColumn
                title="Sim"
                entries={candidateSim.map((v) => ({
                  id: v.candidateId,
                  name: v.candidateName,
                  subtitle: v.candidateParty,
                  photoUrl: v.candidatePhotoUrl,
                  linkTo: `/candidato/${v.candidateId}`,
                }))}
              />
              <VoteColumn
                title="Não"
                entries={candidateNao.map((v) => ({
                  id: v.candidateId,
                  name: v.candidateName,
                  subtitle: v.candidateParty,
                  photoUrl: v.candidatePhotoUrl,
                  linkTo: `/candidato/${v.candidateId}`,
                }))}
              />
            </div>
            {candidateOther.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="text-[11px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                  Abstenção / Obstrução
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidateOther.map((v) => (
                    <Link
                      key={v.candidateId}
                      to={`/candidato/${v.candidateId}`}
                      prefetch="intent"
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-300"
                    >
                      {v.candidateName} · {v.voteType}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Legacy votes (old politician system) */}
        {bill.legacyVotes.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] text-slate-800">
              Votos dos deputados
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <VoteColumn
                title="Sim"
                entries={legacySim.map((v) => ({
                  id: v.id,
                  name: v.politician.name,
                  subtitle: `${v.politician.party} · ${v.politician.state}`,
                  photoUrl: v.politician.photoUrl,
                  linkTo: `/politico/${v.politician.id}`,
                }))}
              />
              <VoteColumn
                title="Não"
                entries={legacyNao.map((v) => ({
                  id: v.id,
                  name: v.politician.name,
                  subtitle: `${v.politician.party} · ${v.politician.state}`,
                  photoUrl: v.politician.photoUrl,
                  linkTo: `/politico/${v.politician.id}`,
                }))}
              />
            </div>
          </section>
        )}
      </Container>
    </main>
  );
}

interface VoteColumnEntry {
  id: string;
  name: string;
  subtitle: string;
  photoUrl: string | null;
  linkTo: string;
}

function VoteColumn({
  title,
  entries,
}: {
  title: string;
  entries: VoteColumnEntry[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {/* Chip neutro: o rótulo do voto não recebe cor de aprovação/reprovação. */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {title}
        </span>
        <span className="text-[12px] text-slate-400 tabular-nums">
          {entries.length}{" "}
          {entries.length === 1 ? "parlamentar" : "parlamentares"}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="pt-4 text-[13px] text-slate-400">
          Nenhum voto correspondente ao filtro.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={entry.linkTo}
                prefetch="intent"
                className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50"
              >
                <span className="flex size-9 flex-none items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  {entry.photoUrl ? (
                    <img
                      src={entry.photoUrl}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <User className="size-4 text-slate-400" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-slate-800">
                    {entry.name}
                  </span>
                  <span className="block truncate text-[12px] text-slate-500">
                    {entry.subtitle}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
