import type { Route } from "./+types/votacao.$id";
import {
  useLoaderData,
  Link,
  Await,
  isRouteErrorResponse,
} from "react-router";
import { BillService } from "~/services/bill.server";
import { ExternalLink, Search, User } from "lucide-react";
import { useDeferredValue, useMemo, useState, Suspense } from "react";
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
      `Como cada parlamentar votou nesta votação nominal na ${casa}, com link para a fonte oficial.`,
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
    resolvidos numa consulta por chave primária (barata, sem os ~450 votos
    nominais da votação), e a lista de votos continua streamando.
  */
  const head = await BillService.getHead(params.id);

  /*
    404, e não um estado vazio dentro de um 200.

    A tela certa já existia — "Votação não encontrada" —, mas a resposta saía
    com status 200: para o Google, `/votacao/qualquer-coisa` era uma página
    válida, e havia infinitas delas. É o mesmo defeito visto do outro lado por
    quem monitora o site: nenhum 404 aparece no log porque nenhum é emitido.
    O corpo continua o mesmo, renderizado pelo `ErrorBoundary` abaixo; muda o
    cabeçalho HTTP, que é o que máquina lê.
  */
  if (!head) {
    throw new Response("Votação não encontrada", { status: 404 });
  }

  return { head, bill: BillService.getById(params.id) };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <VotePanel title="Votação não encontrada">
        O endereço pode estar incorreto ou a votação ainda não foi publicada.
      </VotePanel>
    );
  }

  if (isRouteErrorResponse(error) && error.status === 400) {
    return (
      <VotePanel title="Endereço inválido">
        Falta o identificador da votação no endereço.
      </VotePanel>
    );
  }

  return (
    <VotePanel title="Não foi possível abrir esta votação">
      Algo falhou ao carregar a página. Nada aqui foi estimado — recarregue
      para tentar de novo.
    </VotePanel>
  );
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
      {/*
        Sem errorElement, uma rejeição depois do shell enviado sobe até o
        ErrorBoundary do root e troca a página inteira — o leitor perde o
        cabeçalho e a trilha de navegação por causa de uma consulta que falhou.
      */}
      <Await
        resolve={bill}
        errorElement={
          <VotePanel title="Não foi possível carregar os votos">
            A lista de votos desta votação falhou ao carregar. Nada aqui foi
            estimado — recarregue a página para tentar de novo.
          </VotePanel>
        }
      >
        {(resolvedBill) =>
          resolvedBill ? (
            <VoteDetailsContent bill={resolvedBill} />
          ) : (
            // `getHead` já achou a votação com o mesmo recorte de `getById`,
            // então só uma despublicação entre as duas consultas chega aqui.
            <VotePanel title="Votação não encontrada">
              O endereço pode estar incorreto ou a votação ainda não foi
              publicada.
            </VotePanel>
          )
        }
      </Await>
    </Suspense>
  );
}

/**
 * A tela inteira quando não há votação para mostrar — não encontrada, endereço
 * inválido ou falha ao carregar. Eram três blocos com a mesma marcação e três
 * cópias do mesmo botão; aqui muda só o texto, que é a única coisa que de fato
 * mudava entre eles.
 */
function VotePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="py-16">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base font-bold text-slate-600">{title}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            {children}
          </p>
          <Link
            to="/votacoes"
            className="focus-ring mt-4 inline-block rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
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

  /*
    POR QUE `useDeferredValue` E NÃO OS 300ms DE `/votacoes`

    O índice espera 300ms porque cada tecla lá vira uma navegação e um
    `contains` no Postgres — atrasar economiza viagens de rede. Aqui a filtragem
    é local, sobre os votos nominais já carregados (447 na maior votação
    publicada), e o custo não é a busca: é reconstruir a árvore das colunas a
    cada tecla. Um `setTimeout` não resolveria isso — o campo é controlado, e
    `setFilter` re-renderiza o componente inteiro na mesma tecla, atraso ou não.

    O que corta o trabalho é o par abaixo: o valor deferido só muda numa
    passada de baixa prioridade (o campo responde na hora, a lista alcança
    depois e a renderização é interrompível) e o `useMemo` amarra as listas a
    ele, então a re-renderização urgente do campo não refaz varredura nenhuma.
  */
  const deferredFilter = useDeferredValue(filter);
  const filterText = deferredFilter.trim().toLowerCase();
  const isFiltering = filterText.length > 0;
  const title = bill.simplifiedTitle || bill.title;
  const sourceLabel = bill.sourceType === "senado" ? "Senado" : "Câmara";

  const { candidateSim, candidateNao, candidateOther, legacySim, legacyNao } =
    useMemo(() => {
      const matchesCandidate = (v: {
        candidateName: string;
        candidateParty: string;
      }) =>
        !filterText ||
        v.candidateName.toLowerCase().includes(filterText) ||
        v.candidateParty.toLowerCase().includes(filterText);

      const matchesPolitician = (v: {
        politician: { name: string; party: string };
      }) =>
        !filterText ||
        v.politician.name.toLowerCase().includes(filterText) ||
        v.politician.party.toLowerCase().includes(filterText);

      return {
        // Candidate votes (new system)
        candidateSim: bill.candidateVotes.filter(
          (v) => v.voteType === "SIM" && matchesCandidate(v),
        ),
        candidateNao: bill.candidateVotes.filter(
          (v) => v.voteType === "NÃO" && matchesCandidate(v),
        ),
        candidateOther: bill.candidateVotes.filter(
          (v) =>
            v.voteType !== "SIM" && v.voteType !== "NÃO" && matchesCandidate(v),
        ),
        // Legacy votes (old politician system)
        legacySim: bill.legacyVotes.filter(
          (v) => v.voteType === "SIM" && matchesPolitician(v),
        ),
        legacyNao: bill.legacyVotes.filter(
          (v) => v.voteType === "NÃO" && matchesPolitician(v),
        ),
      };
    }, [bill.candidateVotes, bill.legacyVotes, filterText]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="pt-9 pb-3">
        <nav
          className="flex items-center gap-2 text-xs"
          aria-label="Trilha de navegação"
        >
          <Link
            to="/votacoes"
            className="focus-ring flex-none rounded-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            ← Votações
          </Link>
          <span className="flex-none text-slate-500" aria-hidden="true">
            /
          </span>
          <span className="truncate text-slate-500">{title}</span>
        </nav>

        <h1 className="mt-3 font-heading text-3xl font-bold tracking-[-0.02em] text-pretty text-slate-800 sm:text-4xl">
          {title}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
              className="focus-ring inline-flex items-center gap-1 rounded-sm font-semibold text-indigo-600 hover:text-indigo-700"
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
            <h2 className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
              Sobre a votação
            </h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate-600">
              {bill.simplifiedDescription || bill.description}
            </p>
          </section>
        )}

        {/* O que cada voto significa — descrição factual, sem juízo de valor */}
        {(bill.voteSimDetails || bill.voteNaoDetails) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {bill.voteSimDetails && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
                  Votar Sim significa
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {bill.voteSimDetails}
                </p>
              </section>
            )}
            {bill.voteNaoDetails && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
                  Votar Não significa
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
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
        <section aria-labelledby="placar">
          <h2 id="placar" className="sr-only">
            Placar da votação
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Sim", count: bill.summary.sim },
              { label: "Não", count: bill.summary.nao },
              { label: "Abstenção", count: bill.summary.abstencao },
              { label: "Obstrução", count: bill.summary.obstrucao },
              /*
                `outros` é todo tipo de voto fora dos quatro acima, com o
                rótulo literal da fonte. O serviço já o calculava e a página
                não o exibia: `ARTIGO 17` aparece em 5 das 8 votações
                publicadas, e esses votos entravam no total e sumiam do
                placar — a soma dos quatro cartões não fechava com a lista
                nominal logo abaixo, e nada na tela dizia por quê.
              */
              ...bill.summary.outros,
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-center"
              >
                <p className="text-2xl font-bold text-slate-800 tabular-nums">
                  {item.count}
                </p>
                <p className="mt-0.5 text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          {/* O total existe para o leitor poder conferir a soma — é a mesma
              razão de `outros` estar acima. */}
          <p className="mt-2 text-xs text-slate-500 tabular-nums">
            {bill.summary.total}{" "}
            {bill.summary.total === 1
              ? "voto registrado nesta votação"
              : "votos registrados nesta votação"}
            .
          </p>
        </section>

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
            // O que se digita aqui é sobrenome de parlamentar e sigla de
            // partido — exatamente o que o teclado do celular "corrige".
            // "Boulos" vira "Bolos" e "PSOL" vira "Sol": a lista esvazia e a
            // pessoa conclui que ninguém com aquele nome votou.
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            // Mesmo conserto do `INPUT` de /admin: o outline cancelado mais um
            // anel a 10% de alfa é foco invisível, e a borda de foco em
            // indigo-300 rende 1,99:1 — abaixo dos 3:1 do SC 1.4.11. O anel vem
            // da utilitária `.focus-ring`.
            className="focus-ring w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-500"
          />
        </div>

        {/*
          Ausência declarada, não seção que some.

          `VoteRecord` — a tabela que liga candidatura a voto nominal — está
          vazia no banco inteiro (0 linhas em 31/08/2026) e nenhum script do
          repositório escreve nela. O resultado é que este bloco nunca
          renderizava em página nenhuma: o leitor via os votos dos deputados e
          não tinha como saber se as candidaturas foram checadas e não votaram,
          ou se ninguém checou. Silêncio e ausência se parecem na tela, e a
          diferença entre os dois é justamente o que esta plataforma promete
          não borrar.
        */}
        {bill.candidateVotes.length === 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
              Votos das candidaturas de 2026
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Nenhum voto de candidatura de 2026 está associado a esta votação
              no nosso banco. O vínculo entre as candidaturas e as listas
              nominais ainda não foi feito — a ausência aqui é de dado, e não
              prova de que nenhuma delas votou.
            </p>
          </section>
        )}

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
                <h3 className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
                  Abstenção / Obstrução
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidateOther.map((v) => (
                    <Link
                      key={v.candidateId}
                      to={`/candidato/${v.candidateId}`}
                      prefetch="intent"
                      // Mesmo `min-h-11` das abas de casa legislativa em
                      // `/votacoes`: eram ~26px, e são links de verdade para a
                      // ficha da pessoa. Crescer a caixa, e não estender a área
                      // por pseudo-elemento — aqui as pílulas se enfileiram com
                      // `gap-2`, e áreas estendidas se sobreporiam entre
                      // vizinhas, roubando o clique uma da outra.
                      className="focus-ring inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-300"
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
            <p className="text-xs leading-relaxed text-slate-500">
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
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {title}
        </span>
        <span className="text-xs text-slate-500 tabular-nums">
          {entries.length}{" "}
          {entries.length === 1 ? "parlamentar" : "parlamentares"}
        </span>
      </div>

      {entries.length === 0 ? (
        // Coluna vazia com o filtro em branco significa votação unânime nesse
        // lado, não "o filtro não achou ninguém". Dizer a segunda coisa manda
        // o leitor procurar um filtro que ele não digitou.
        <p className="pt-4 text-sm text-slate-500">
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
                    <User
                      className="size-4 text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {entry.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
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
                    className="focus-ring flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50"
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
