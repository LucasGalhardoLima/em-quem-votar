import type { Route } from "./+types/votacao.$id";
import { useLoaderData, Link, Await } from "react-router";
import { BillService } from "~/services/bill.server";
import { db } from "~/utils/db.server";
import { ExternalLink, Search, User } from "lucide-react";
import { useState, Suspense } from "react";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { VoteDetailsSkeleton } from "~/components/SkeletonLoader";

/** Corta no último espaço antes do limite: cortar no meio da palavra ("o
 *  placar ofici") aparece assim mesmo no card e no resultado de busca. */
function truncate(text: string, max = 200) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function meta({ data }: Route.MetaArgs) {
  const head = data?.head;
  if (!head) {
    return [
      { title: "Votação não encontrada | Em Quem Votar?" },
      { name: "robots", content: "noindex" },
    ];
  }

  const title = head.simplifiedTitle || head.title;
  const casa = head.sourceType === "senado" ? "Senado" : "Câmara";
  const pageTitle = `${title} — votação nominal na ${casa} | Em Quem Votar?`;
  // A descrição sai do resumo já publicado. Sem resumo, descrevemos o que a
  // página é — nunca inventamos um teor para a proposta.
  const description = truncate(
    head.simplifiedDescription ||
      head.description ||
      `Como cada parlamentar votou nesta votação nominal na ${casa}, com link para a fonte oficial.`
  );

  return [
    { title: pageTitle },
    { name: "description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: "Em Quem Votar?" },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:title", content: pageTitle },
    { property: "og:description", content: description },
    // Sem og:image: não existe imagem para uma votação, e apontar para um
    // arquivo inexistente daria um card quebrado. `summary` é o formato
    // correto para um card sem imagem grande.
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: pageTitle },
    { name: "twitter:description", content: description },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.id) {
    throw new Response("ID inválido", { status: 400 });
  }

  /*
    `meta()` roda ANTES de qualquer promise deferida resolver — por isso não
    conseguia ler `bill` e as 8 páginas de votação saíam com o mesmo <title>.
    A saída é uma deferição parcial: os campos que o <head> precisa vêm
    resolvidos numa consulta por chave primária (barata, sem os 3.012 votos),
    e a lista de votos continua streamando.

    shortcut: os campos do cabeçalho são lidos duas vezes (aqui e dentro de
    BillService.getById) — upgrade: um BillService.getHead(id) devolveria só
    isto e o getById passaria a recebê-lo, mas bill.server.ts é de outro dono
    nesta rodada.
  */
  const head = await db.bill.findFirst({
    where: { id: params.id, status: "approved" },
    select: {
      title: true,
      simplifiedTitle: true,
      description: true,
      simplifiedDescription: true,
      sourceType: true,
    },
  });

  if (!head) return { head: null, bill: null };

  return { head, bill: BillService.getById(params.id) };
}

type BillData = NonNullable<Awaited<ReturnType<typeof BillService.getById>>>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function VotacaoRoute() {
  const { head, bill } = useLoaderData<typeof loader>();

  if (!head || !bill) return <VoteNotFound />;

  return (
    <Suspense fallback={<VoteDetailsSkeleton />}>
      {/*
        Sem errorElement, uma rejeição depois do shell enviado sobe até o
        ErrorBoundary do root e troca a página inteira — o leitor perde o
        cabeçalho e a trilha de navegação por causa de uma consulta que falhou.
      */}
      <Await resolve={bill} errorElement={<VoteLoadError />}>
        {(resolvedBill) => {
          if (!resolvedBill) return <VoteNotFound />;
          return <VoteDetailsContent bill={resolvedBill} />;
        }}
      </Await>
    </Suspense>
  );
}

function VoteNotFound() {
  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="py-16">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base font-bold text-slate-600">
            Votação não encontrada
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] text-slate-500">
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
}

function VoteLoadError() {
  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="py-16">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base font-bold text-slate-600">
            Não foi possível carregar os votos
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-slate-500">
            A lista de votos desta votação falhou ao carregar. Nada aqui foi
            estimado — recarregue a página para tentar de novo.
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
}

function VoteDetailsContent({ bill }: { bill: BillData }) {
  const [filter, setFilter] = useState("");

  const filterText = filter.trim().toLowerCase();
  const isFiltering = filterText.length > 0;
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
    <main id={MAIN_CONTENT_ID} className="flex-1">
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
          <span className="flex-none text-slate-500" aria-hidden="true">
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
          <span className="text-slate-500" aria-hidden="true">
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
              {/* Ver `SourceCite`: o ícone de nova aba só comunica a quem
                  enxerga. */}
              <span className="sr-only">(abre em nova aba)</span>
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
            <h2 className="text-[12px] font-bold tracking-[0.06em] text-slate-500 uppercase">
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
                <h2 className="text-[12px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                  Votar Sim significa
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
                  {bill.voteSimDetails}
                </p>
              </section>
            )}
            {bill.voteNaoDetails && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-[12px] font-bold tracking-[0.06em] text-slate-500 uppercase">
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
              <p className="mt-0.5 text-[12px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Filtrar por nome ou partido…"
            aria-label="Filtrar votos por nome ou partido"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 outline-none placeholder:text-slate-500 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10"
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
                isFiltering={isFiltering}
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
                isFiltering={isFiltering}
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
                <h3 className="text-[12px] font-bold tracking-[0.06em] text-slate-500 uppercase">
                  Abstenção / Obstrução
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidateOther.map((v) => (
                    <Link
                      key={v.candidateId}
                      to={`/candidato/${v.candidateId}`}
                      prefetch="intent"
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition-colors hover:border-indigo-300"
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
            {/*
              Estes nomes NÃO são links, e isso é deliberado.

              Eles vêm da tabela legada `Politician`, que não tem página
              própria: /politico/:id redireciona para /candidatos descartando o
              id. Enquanto isso, cada linha aqui era um link — 3.012 deles nas 8
              votações publicadas — e quem clicava no nome de um deputado para
              ver como ele vota caía numa lista de 211 candidaturas.

              A alternativa seria casar `Politician` com `Candidate`, mas as
              duas tabelas não compartilham chave alguma (nem CPF, nem tseId):
              o casamento só poderia ser por nome, e errar isso significa
              atribuir o voto de uma pessoa real ao perfil de outra. Preferimos
              não prometer uma página que não existe.
            */}
            <p className="text-[12.5px] leading-relaxed text-slate-500">
              A plataforma cobre as candidaturas de 2026 e ainda não mantém
              página individual de parlamentar; por isso os nomes abaixo
              aparecem sem link. O voto de cada um está registrado na fonte
              oficial citada acima.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <VoteColumn
                title="Sim"
                isFiltering={isFiltering}
                entries={legacySim.map((v) => ({
                  id: v.id,
                  name: v.politician.name,
                  subtitle: `${v.politician.party} · ${v.politician.state}`,
                  photoUrl: v.politician.photoUrl,
                }))}
              />
              <VoteColumn
                title="Não"
                isFiltering={isFiltering}
                entries={legacyNao.map((v) => ({
                  id: v.id,
                  name: v.politician.name,
                  subtitle: `${v.politician.party} · ${v.politician.state}`,
                  photoUrl: v.politician.photoUrl,
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
  /** Ausente quando não há página para essa pessoa — a linha vira texto. */
  linkTo?: string;
}

function VoteColumn({
  title,
  entries,
  isFiltering,
}: {
  title: string;
  entries: VoteColumnEntry[];
  isFiltering: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {/* Chip neutro: o rótulo do voto não recebe cor de aprovação/reprovação. */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
          {title}
        </span>
        <span className="text-[12px] text-slate-500 tabular-nums">
          {entries.length}{" "}
          {entries.length === 1 ? "parlamentar" : "parlamentares"}
        </span>
      </div>

      {entries.length === 0 ? (
        // Coluna vazia com o filtro em branco significa votação unânime nesse
        // lado, não "o filtro não achou ninguém". Dizer a segunda coisa manda
        // o leitor procurar um filtro que ele não digitou.
        <p className="pt-4 text-[13px] text-slate-500">
          {isFiltering
            ? "Nenhum voto correspondente ao filtro."
            : `Nenhum parlamentar votou "${title}" nesta votação.`}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {entries.map((entry) => {
            const inner = (
              <>
                <span className="flex size-9 flex-none items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  {entry.photoUrl ? (
                    <img
                      src={entry.photoUrl}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <User className="size-4 text-slate-500" aria-hidden="true" />
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
              </>
            );

            return (
              <li key={entry.id}>
                {entry.linkTo ? (
                  <Link
                    to={entry.linkTo}
                    prefetch="intent"
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50"
                  >
                    {inner}
                  </Link>
                ) : (
                  // Mesmo peso visual de quem tem página: a diferença é a
                  // existência do destino, não a importância da pessoa.
                  <div className="flex items-center gap-3 rounded-xl p-2">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
