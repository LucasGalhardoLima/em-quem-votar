import type { Route } from "./+types/votacoes._index";
import { useEffect, useRef } from "react";
import {
  useLoaderData,
  Link,
  Form,
  useSubmit,
  useSearchParams,
} from "react-router";
import { BillService } from "~/services/bill.server";
import { pageMeta } from "~/root";
import { Search } from "lucide-react";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { cn } from "~/lib/utils";

/**
 * A frase que a página exibe sob o <h1> e a que vai para o <meta> são a mesma
 * — quem chega pelo card compartilhado lê exatamente o que vai encontrar, e a
 * promessa não existe em duas versões que podem divergir.
 *
 * Ela não diz mais "da Câmara e do Senado". O acervo publicado hoje é inteiro
 * da Câmara (8 votações aprovadas, 0 do Senado, medido em 31/08/2026), e um
 * subtítulo que anuncia as duas casas afirma uma cobertura que o dado não
 * sustenta. Quem quiser saber o que existe de cada casa clica na aba: quando
 * o filtro do Senado devolve zero, o estado vazio diz isso com todas as
 * letras, que é onde a informação é verdadeira por construção.
 */
const PAGE_SUBTITLE =
  "Pesquise as votações nominais publicadas aqui e veja, uma a uma, como cada parlamentar votou — sem rótulo de certo ou errado.";

export function meta() {
  return pageMeta({
    title: "Votações | Em Quem Votar?",
    description: PAGE_SUBTITLE,
    type: "website",
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const source = url.searchParams.get("source") || "";

  const { bills, total } = await BillService.listApproved({
    query: q || undefined,
    source: source || undefined,
  });

  return { bills, total, q, source };
}

const SOURCE_TABS = [
  { value: "", label: "Todas" },
  { value: "camara", label: "Câmara" },
  { value: "senado", label: "Senado" },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  camara: "Câmara",
  senado: "Senado",
};

/** Mesmos rótulos com a preposição contraída, para caber numa frase. */
const SOURCE_OF: Record<string, string> = {
  camara: "da Câmara",
  senado: "do Senado",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function VotacoesIndex() {
  const { bills, total, q, source } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();

  // Sem espera, cada tecla vira uma navegação e um `contains` no Postgres:
  // "orçamento" são nove buscas de texto para uma intenção só.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O termo digitado só chega à URL 300ms depois da última tecla; quem troca
  // de casa legislativa dentro dessa janela precisa que a troca leve o que
  // está no campo, não o que a URL ainda mostra.
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  function handleSourceChange(value: string) {
    // Cancela antes de navegar: o submit pendente carregaria o `source`
    // antigo no input escondido e desfaria a troca 300ms depois.
    cancelPendingSearch();
    const params = new URLSearchParams(searchParams);
    const pendingQuery = searchInputRef.current?.value ?? "";
    if (pendingQuery) {
      params.set("q", pendingQuery);
    } else {
      params.delete("q");
    }
    if (value) {
      params.set("source", value);
    } else {
      params.delete("source");
    }
    setSearchParams(params, { replace: true });
  }

  /**
   * O filtro do Senado devolve zero — não por acidente, mas porque as 8
   * votações publicadas são todas da Câmara. Sem uma saída, a pessoa fica
   * numa tela vazia com o campo de busca ainda preenchido e a aba ainda
   * marcada, e o único caminho de volta é adivinhar qual dos dois desfazer.
   *
   * O `value` do input precisa ser zerado à mão: ele é não controlado
   * (`defaultValue`), então limpar a URL não o esvazia — a tela voltaria com
   * a lista completa e o termo antigo ainda escrito no campo.
   */
  function clearFilters() {
    cancelPendingSearch();
    if (searchInputRef.current) searchInputRef.current.value = "";
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  const hasFilter = Boolean(q || source);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="pt-9 pb-3">
        <h1 className="font-heading text-3xl font-bold tracking-[-0.02em] text-slate-800 sm:text-4xl">
          Votações
        </h1>
        <p className="mt-1.5 text-base text-pretty text-slate-500">
          {PAGE_SUBTITLE}
        </p>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <Form
            method="get"
            className="relative flex-1"
            onChange={(e) => {
              // `currentTarget` é zerado quando o handler retorna: guarda agora.
              const form = e.currentTarget;
              cancelPendingSearch();
              searchTimer.current = setTimeout(
                () => submit(form, { replace: true }),
                300,
              );
            }}
            onSubmit={cancelPendingSearch}
          >
            <input type="hidden" name="source" value={source} />
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar votação por título ou tema…"
              aria-label="Buscar votações"
              // Mesmo conserto do `INPUT` de /admin: o outline cancelado, mais
              // um anel a 10% de alfa, deixava o foco praticamente invisível —
              // e a borda de foco em indigo-300 rende 1,99:1, abaixo dos 3:1 do
              // SC 1.4.11. O anel vem da utilitária `.focus-ring`.
              className="focus-ring w-full rounded-xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm text-slate-800 placeholder:text-slate-500"
            />
          </Form>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar por casa legislativa"
          >
            {SOURCE_TABS.map((tab) => {
              const active = source === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSourceChange(tab.value)}
                  // `min-h-11` no lugar do `py-2`: a pílula media ~37px de
                  // altura, abaixo dos 44 do SC 2.5.5. Como o alvo é a própria
                  // pílula, crescer a caixa é mais honesto que estender a área
                  // de clique por pseudo-elemento (o truque de `CompareToggle`,
                  // que existe lá para não engordar um círculo de 26px dentro
                  // do card). De quebra passa a acompanhar a altura do campo de
                  // busca ao lado, que já tinha 46px.
                  className={cn(
                    "focus-ring inline-flex min-h-11 items-center rounded-full border px-4 text-xs transition-colors",
                    active
                      ? "border-slate-800 bg-slate-800 font-semibold text-white"
                      : "border-slate-200 bg-white font-medium text-slate-500 hover:border-slate-300",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </Container>

      <Container className="pt-5 pb-10">
        {bills.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-base font-bold text-slate-600">
              {hasFilter
                ? "Nenhuma votação encontrada"
                : "Nenhuma votação publicada até agora"}
            </p>
            {/*
              Três frases diferentes porque são três fatos diferentes, e trocar
              um pelo outro faz a tela afirmar algo falso. Sem filtro nenhum, o
              acervo é que está vazio — mandar "tente outro termo" ali manda a
              pessoa procurar um termo que ela não digitou. Com a casa
              escolhida e nada digitado, o que a página sabe é que aquela casa
              não tem votação publicada AQUI — não que a casa não votou.
            */}
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
              {q && source
                ? `Nada corresponde a “${q}” entre as votações ${SOURCE_OF[source]} publicadas aqui.`
                : q
                  ? `Nada corresponde a “${q}” entre as votações publicadas aqui.`
                  : source
                    ? `Nenhuma votação ${SOURCE_OF[source]} foi publicada aqui até agora. Isso é o que a plataforma ainda não tem, não o que a casa deixou de votar.`
                    : "As votações aparecem aqui conforme a revisão de cada uma é concluída."}
            </p>
            {hasFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/*
              O acervo diz o seu tamanho. A consulta traz no máximo `limit`
              votações e a lista não tinha como avisar quando havia mais: as
              antigas simplesmente não apareciam. Aqui o número da fatia e o
              total convivem, e o total acompanha o filtro — com um termo
              digitado ele é o total daquele termo.
            */}
            <p className="mb-4 text-sm text-slate-500 tabular-nums">
              {total > bills.length
                ? `Mostrando as ${bills.length} votações mais recentes de ${total}. Use a busca ou o filtro de casa para chegar às demais.`
                : `${total} ${total === 1 ? "votação" : "votações"}.`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bills.map((bill) => (
                <article
                  key={bill.id}
                  // O anel desenha o cartão inteiro — mesmo padrão de
                  // CandidateCard.tsx. Quem tabula uma grade tem o cartão como
                  // alvo mental, e o elemento que recebe foco é o <Link>
                  // esticado pelo `after:inset-0`, daí `has-[a:focus-visible]`.
                  // Saiu daqui a borda de foco em indigo-300: era a mesma
                  // borda do `hover:` (foco de teclado indistinguível de mouse)
                  // e rendia 1,99:1, abaixo dos 3:1 do SC 1.4.11.
                  className="group relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-indigo-600"
                >
                  {/*
                  A casa aparece como texto, não como link para a fonte oficial
                  — e `bill.sourceUrl` VEM no select de `listApproved`, ao
                  contrário do que esta nota dizia antes. A escolha é outra: o
                  cartão inteiro já é um alvo só, esticado pelo `after:inset-0`
                  do título; um segundo link aqui dentro precisaria de `z-10`
                  para escapar dele e daria a cada cartão um destino externo
                  disputando o clique com o interno. A fonte oficial fica na
                  página da votação, onde é a única saída externa da tela.

                  O que o cartão NÃO diz — resultado e tema — não cabe aqui
                  por falta de dado, não por falta de espaço: `Bill` não tem
                  campo de resultado, e o tema só existe como
                  `suggestedCategory`, saída do classificador de IA que o
                  `approve` do admin nunca revisa. Publicar rótulo de máquina
                  como fato é o oposto do que esta plataforma promete.

                  O placar, esse sim, passou a caber: `listApproved` agrega os
                  dois modelos de voto de uma vez para a página inteira.
                */}
                  <span className="text-xs font-bold tracking-[0.06em] text-indigo-600 uppercase">
                    {SOURCE_LABELS[bill.sourceType] ?? bill.sourceType}
                  </span>
                  {/* Só o título dentro do link — ver a nota em CandidateCard.tsx.
                    Com o cartão inteiro dentro do <Link>, o nome acessível
                    virava "CÂMARA <título> <data>" numa tacada só. */}
                  <h2 className="text-base leading-snug font-bold text-pretty text-slate-800">
                    <Link
                      to={`/votacao/${bill.id}`}
                      prefetch="intent"
                      // O card já reagia ao foco só trocando a cor da borda —
                      // 1px de mudança de matiz não é indicador de foco. O anel
                      // agora é o do card (acima), e a área clicável continua
                      // sendo o card inteiro pelo `after`. Sem o
                      // `focus-visible:outline-none` o navegador desenharia um
                      // segundo anel, apertado no título.
                      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                    >
                      {bill.simplifiedTitle || bill.title}
                    </Link>
                  </h2>
                  {/*
                    Placar em texto corrido e em cinza, sem chip colorido e sem
                    barra proporcional: colorir ou dimensionar um voto é emitir
                    juízo sobre quem o deu, e é o que a regra de neutralidade do
                    projeto proíbe. `total` vem primeiro porque é o número que
                    sempre fecha — `sim` e `nao` são recortes dele, nunca a
                    soma (há votações com `ARTIGO 17` e abstenção no meio).
                  */}
                  <p className="mt-auto pt-2 text-xs text-slate-500">
                    {bill.summary ? (
                      <>
                        {bill.summary.total}{" "}
                        {bill.summary.total === 1 ? "voto" : "votos"} ·{" "}
                        {bill.summary.sim} Sim · {bill.summary.nao} Não{" "}
                        <span aria-hidden="true">·</span>{" "}
                      </>
                    ) : null}
                    <time dateTime={bill.voteDate}>
                      {dateFormatter.format(new Date(bill.voteDate))}
                    </time>
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </Container>
    </main>
  );
}
