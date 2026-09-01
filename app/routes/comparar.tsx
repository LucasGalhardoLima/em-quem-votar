import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Plus, X } from "lucide-react";
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

type CompareCandidate = Awaited<
  ReturnType<typeof CandidateService.listForComparison>
>[number];
type ComparePosition = CompareCandidate["positions"][string];

/**
 * Distância do topo em que a linha de candidaturas se fixa: a altura do
 * cabeçalho do site (`sticky top-0`) — 14px de respiro, 46px do botão "Fazer
 * o Quiz" e 1px de borda. Sem isto a linha fixa desliza para debaixo do
 * cabeçalho e some justamente quando passa a fazer falta.
 */
const STICKY_TOP = "top-[75px]";

/**
 * O conteúdo de uma célula: a posição documentada e sua procedência.
 *
 * Vive num componente só porque a mesma célula é desenhada duas vezes — na
 * tabela do desktop e na pilha por tema do telefone. Duas cópias do texto
 * seriam duas chances de uma delas passar a afirmar algo que a outra não
 * afirma sobre a mesma pessoa.
 */
function PositionCell({ position }: { position?: ComparePosition }) {
  const documented = position != null && hasPosition(position.stance);

  return (
    <div className="flex flex-col gap-1">
      <span
        className={cn(
          "text-sm leading-snug",
          documented ? "font-semibold text-slate-800" : "text-slate-500",
        )}
      >
        {candidateStanceLabel(position?.stance ?? null)}
      </span>
      {documented && position.description && (
        <span className="line-clamp-3 text-xs text-slate-500">
          {position.description}
        </span>
      )}
      {/*
        Sempre pelo SourceCite: quando não há URL ele ainda nomeia o
        documento. Uma posição documentada não pode aparecer sem procedência
        só porque o link está faltando.
      */}
      {documented && (
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
  );
}

export default function Comparar({ loaderData }: Route.ComponentProps) {
  const { candidates, topics, ids, mixedRaces } = loaderData;
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const hydrated = useComparisonHydration();
  const storedIds = useComparisonStore((s) => s.selectedIds);
  const setIds = useComparisonStore((s) => s.setIds);

  const [showEmptyTopics, setShowEmptyTopics] = useState(false);

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

  /*
    Um tema entra na comparação quando ao menos UMA das candidaturas tem
    posição documentada nele. Hoje isso quase nunca acontece: das 211
    candidaturas do banco, uma única tem posição aprovada, então a comparação
    típica sai com os 20 temas vazios — 60 células repetindo "Sem posição
    registrada", que é uma parede de nada.

    Por isso o padrão da tela é mostrar só os temas comparáveis, e a lacuna é
    dita em número e em palavras: o bloco de aviso abaixo (quando não há
    nenhum) e a caixa de seleção (quando há alguns) informam quantos temas
    ficaram de fora e abrem a lista inteira num clique. Isso não contraria a
    regra de que ausência tem de parecer ausência — nada é inferido nem
    maquiado. O que muda é que a ausência passa a ser CONTADA e explicada em
    uma linha, em vez de encenada em sessenta células idênticas.
  */
  const documentedSlugs = new Set(
    topics
      .filter((t) =>
        candidates.some((c) => hasPosition(c.positions[t.slug]?.stance)),
      )
      .map((t) => t.slug),
  );
  const visibleTopics = showEmptyTopics
    ? topics
    : topics.filter((t) => documentedSlugs.has(t.slug));
  const emptyTopicCount = topics.length - documentedSlugs.size;

  const addLabel =
    candidates.length < MAX_COMPARISON
      ? "Adicionar candidatura"
      : "Trocar candidatos";

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="flex flex-col gap-3.5 pt-8 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {/* Sem par responsivo: pelo mapa da escala (app.css) 26px e 30px caem
              os dois em `text-3xl`, então o `sm:` virava uma repetição do
              tamanho base. O degrau que existia (4px) morava dentro de um único
              degrau da escala — era ruído, não hierarquia. */}
          <h1 className="font-heading text-3xl font-bold tracking-[-0.02em] text-slate-800">
            Comparar candidatos
          </h1>
          <p className="mt-1.5 text-sm text-pretty text-slate-500">
            Até {MAX_COMPARISON} lado a lado · “sem posição registrada” quando
            não existe documento sobre o tema
          </p>
        </div>
        {/*
          Era um link de texto de 16px de altura no canto — abaixo do alvo
          mínimo de 24px do SC 2.5.8 e fraco demais para a ação que traz gente
          para dentro da tela. Vira botão de 44px, e o rótulo acompanha o
          estado: com menos de três selecionadas ele convida a somar, não a
          trocar.
        */}
        <Link
          to="/candidatos"
          className="focus-ring inline-flex min-h-11 flex-none items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors sm:self-end hover:border-slate-300 hover:bg-slate-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          {addLabel}
        </Link>
      </Container>

      {mixedRaces && (
        <Container className="pt-1 pb-2">
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"
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
            <p className="text-sm text-slate-500">
              Escolha até {MAX_COMPARISON} na lista de candidatos, pelo botão +.
            </p>
            <Link
              to="/candidatos"
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
            >
              Escolher candidatos <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Container>
      ) : (
        <>
          {/*
            O caso comum, não o de borda: nenhuma das candidaturas escolhidas
            tem posição publicável. O aviso vem ANTES da grade e diz o que a
            plataforma tem em vez do que não tem — o perfil individual carrega
            situação no TSE, patrimônio, gastos e o plano de governo
            protocolado.
          */}
          {documentedSlugs.size === 0 && (
            <Container className="pt-1 pb-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-bold text-slate-800">
                  Ainda não há posição registrada para nenhum destes temas
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty text-slate-600">
                  Não encontramos documento público — proposta de governo,
                  votação nominal ou declaração datada — sobre nenhum dos{" "}
                  {topics.length} temas para as candidaturas selecionadas. Isso
                  não é uma posição neutra: é falta de fonte, e ela aparece aqui
                  como falta. Nada é deduzido a partir de partido, coligação ou
                  de votações parecidas.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-slate-600">
                  O perfil de cada candidatura reúne o que já está documentado:
                  situação no TSE, patrimônio declarado, gastos de campanha,
                  histórico de eleições e o plano de governo protocolado, quando
                  existe.
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                  <span className="text-slate-500">Abrir o perfil de</span>
                  {candidates.map((candidate, i) => (
                    <span
                      key={candidate.id}
                      className="flex items-center gap-x-2.5"
                    >
                      <Link
                        to={`/candidato/${candidate.id}`}
                        prefetch="intent"
                        className="focus-ring inline-flex min-h-6 items-center rounded-md font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        {candidate.displayName}
                      </Link>
                      {/* Os nomes vêm do TSE em caixa alta e, lado a lado em
                          indigo, três deles leem como um nome só. O ponto
                          separa; é decorativo, então sai da leitura de tela.
                          Vem DEPOIS do nome para que a quebra de linha deixe
                          o ponto no fim da linha, e não órfão no começo da
                          seguinte. */}
                      {i < candidates.length - 1 && (
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                      )}
                    </span>
                  ))}
                </p>
                <p className="mt-1.5 text-sm">
                  <Link
                    to="/metodologia"
                    className="focus-ring inline-flex min-h-6 items-center rounded-md font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Como uma posição entra aqui
                  </Link>
                </p>
              </div>
            </Container>
          )}

          {emptyTopicCount > 0 && (
            <Container className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 pb-1">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={showEmptyTopics}
                  onChange={(e) => setShowEmptyTopics(e.target.checked)}
                  className="focus-ring size-4 accent-indigo-600"
                />
                Mostrar os {emptyTopicCount} temas sem posição registrada
              </label>
              {documentedSlugs.size > 0 && (
                <p className="text-sm text-slate-500">
                  {documentedSlugs.size} de {topics.length} temas têm posição
                  registrada para ao menos uma destas candidaturas.
                </p>
              )}
            </Container>
          )}

          {/*
            Duas montagens da mesma comparação, escolhidas por CSS e não por
            JavaScript: o HTML do servidor já vem com a certa para cada
            largura, sem salto depois da hidratação. Só uma existe por vez —
            `display: none` também a tira da árvore de acessibilidade, então
            nada é anunciado duas vezes.
          */}

          {/* ---------- Telefone: uma pilha por tema ---------- */}
          {/*
            A tabela lado a lado não cabe em 390px: a coluna de rótulos comia
            255px dos 355 úteis e sobrava menos de uma palavra por candidatura,
            com o nome cortado no meio. Aqui o eixo troca — um bloco por tema,
            as candidaturas nomeadas dentro dele — e a rolagem horizontal deixa
            de existir. A leitura continua sendo "neste tema, o que cada uma
            defende", que é a única pergunta que a tela responde.
          */}
          <Container className="pt-1.5 pb-0 md:hidden">
            <h2 className="sr-only">Candidaturas comparadas</h2>
            <ul className="grid gap-2.5">
              {candidates.map((candidate) => (
                <li
                  key={candidate.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5"
                >
                  <CandidateAvatar
                    name={candidate.displayName}
                    photoUrl={candidate.photoUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/candidato/${candidate.id}`}
                      prefetch="intent"
                      className="focus-ring block rounded-md text-base font-bold text-slate-800 hover:text-indigo-600"
                    >
                      {candidate.displayName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {candidate.party}
                      {candidate.number != null
                        ? ` · nº ${candidate.number}`
                        : ""}
                    </p>
                    <span className="mt-1.5 flex">
                      <StatusBadge
                        status={candidate.registrationStatus}
                        tseStatusLabel={candidate.tseStatusLabel}
                      />
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(candidate.id)}
                    aria-label={`Remover ${candidate.displayName} da comparação`}
                    className="focus-ring flex size-11 flex-none items-center justify-center rounded-full text-slate-500 transition-colors hover:text-red-700"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            {visibleTopics.length > 0 && (
              <div className="mt-2.5 grid gap-2.5">
                {visibleTopics.map((topic) => (
                  <section
                    key={topic.slug}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
                  >
                    <h2 className="text-sm font-semibold text-slate-700">
                      {topic.name}
                    </h2>
                    <dl className="mt-2 divide-y divide-slate-100">
                      {candidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          className="py-2.5 first:pt-0 last:pb-0"
                        >
                          <dt className="text-xs font-medium text-slate-500">
                            {candidate.displayName}
                          </dt>
                          <dd className="mt-0.5">
                            <PositionCell
                              position={candidate.positions[topic.slug]}
                            />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
            )}
          </Container>

          {/* ---------- Tablet e desktop: a tabela ---------- */}
          <Container className="hidden pt-1.5 pb-0 md:block">
            {/*
              Tabela de verdade, não grade de divs: cada célula é lida com o
              nome do tema (cabeçalho de linha) e o da candidatura (cabeçalho
              de coluna). Numa tela cujo propósito é comparar pessoas, ler as
              células em sequência linear é ler outra coisa.

              Sem largura mínima e sem região rolável: as colunas são
              proporcionais (`table-fixed` + `col` em %), então a tabela cabe em
              qualquer largura a partir de `md` e o texto quebra em vez de
              estourar. Isso não é só simplificação — um ancestral com
              `overflow-x` vira contêiner de rolagem nos DOIS eixos e desliga o
              `position: sticky` do cabeçalho abaixo.
            */}
            <table className="-mx-[10px] w-[calc(100%+20px)] table-fixed border-separate border-spacing-[10px]">
              <caption className="sr-only">
                Comparação de posições documentadas: uma coluna por candidatura,
                uma linha por tema exibido. A linha das candidaturas acompanha a
                rolagem.
              </caption>
              {/*
                A coluna de rótulos só existe quando há linha de tema para
                rotular. Sem esta guarda, a comparação sem nenhum tema visível
                reservava 22% da largura para uma coluna vazia e empurrava os
                três cartões para a direita, o que parece defeito de layout.
              */}
              <colgroup>
                {visibleTopics.length > 0 && <col className="w-[22%]" />}
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
                  {/*
                    A linha das candidaturas se fixa abaixo do cabeçalho do
                    site: são 20 temas, e a partir da quinta linha ninguém sabe
                    mais de quem é cada coluna. O `after` tapa os 10px de
                    `border-spacing` logo abaixo — sem ele o conteúdo da linha
                    seguinte aparece nessa faixa ao rolar. A célula do canto vai
                    junto, e opaca, senão os rótulos de tema sobem por trás
                    dela.
                  */}
                  {visibleTopics.length > 0 && (
                    <td
                      className={cn(
                        "sticky z-10 bg-slate-50",
                        "after:absolute after:inset-x-0 after:top-full after:h-2.5 after:bg-slate-50",
                        STICKY_TOP,
                      )}
                    />
                  )}
                  {candidates.map((candidate) => (
                    <th
                      key={candidate.id}
                      scope="col"
                      className={cn(
                        "sticky z-10 rounded-2xl border border-slate-200 bg-white p-3.5 text-center align-top font-normal",
                        "after:absolute after:inset-x-0 after:top-full after:mt-px after:h-2.5 after:bg-slate-50",
                        STICKY_TOP,
                      )}
                    >
                      {/*
                        44px de alvo, e não os 26px de antes: é o único
                        controle destrutivo da tela e ficava encostado no
                        canto do cartão, onde o polegar chega torto. O
                        quadrado é transparente — cresce a área de toque,
                        não o peso visual do X.
                      */}
                      <button
                        type="button"
                        onClick={() => remove(candidate.id)}
                        aria-label={`Remover ${candidate.displayName} da comparação`}
                        className="focus-ring absolute top-0 right-0 z-10 flex size-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-red-700"
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
                        className="focus-ring mt-2 block rounded-md text-base font-bold text-balance text-slate-800 hover:text-indigo-600"
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

                {visibleTopics.map((topic) => (
                  <tr key={topic.slug}>
                    {/*
                      Caixa alta saiu: os nomes já vêm capitalizados do banco
                      ("Demarcação de Terras Indígenas") e versalete numa coluna
                      estreita rouba justamente a pista de forma da palavra que
                      faz a varredura de 20 rótulos ser rápida. Um degrau de
                      corpo a mais (14px) e `slate-700` compensam a ênfase que o
                      negrito de caixa alta dava.
                    */}
                    <th
                      scope="row"
                      className="text-left align-middle text-sm font-semibold text-pretty text-slate-700"
                    >
                      {topic.name}
                    </th>
                    {candidates.map((candidate) => {
                      const position = candidate.positions[topic.slug];
                      const documented =
                        position != null && hasPosition(position.stance);
                      return (
                        <td
                          key={`${candidate.id}-${topic.slug}`}
                          className={cn(
                            "rounded-xl px-3.5 py-3 align-middle",
                            documented
                              ? "border border-slate-200 bg-white"
                              : "border border-dashed border-slate-300 bg-slate-50",
                          )}
                        >
                          <PositionCell position={position} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Container>

          <Container className="pt-3 pb-10">
            {/* Sem tema visível não há célula sobre a qual dizer isto — e o
                aviso acima já explicou a lacuna com mais precisão. */}
            {visibleTopics.length > 0 && (
              <p className="text-xs leading-relaxed text-slate-500">
                Cada célula preenchida nomeia o documento citado — com página e
                link quando o registro os tem (TSE, Câmara, Senado). Células
                “sem posição registrada” nunca são completadas por inferência —
                a ausência de documento é exibida como ausência.
              </p>
            )}
          </Container>
        </>
      )}
    </main>
  );
}
