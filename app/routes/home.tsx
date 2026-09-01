import { Form, Link } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Route } from "./+types/home";
import { pageMeta } from "~/root";
import {
  Container,
  CountdownBanner,
  MAIN_CONTENT_ID,
} from "~/components/layout";
import { countdownCopy } from "~/lib/election";
import { UFS } from "~/lib/office";
import { db } from "~/utils/db.server";
import { ArticleService } from "~/services/article.server";

export function meta({ data }: Route.MetaArgs) {
  const total = data?.stats.candidates;
  return [
    ...pageMeta({
      title: "Em Quem Votar? | Vote com consciência",
      description: total
        ? `As ${total} candidaturas à Presidência e aos governos estaduais em 2026: plano de governo protocolado, bens declarados e situação no TSE, mais as votações nominais da Câmara. Peso igual para todas, fonte em toda afirmação.`
        : "Candidaturas à Presidência e aos governos estaduais em 2026: plano de governo protocolado, bens declarados e situação no TSE, mais as votações nominais da Câmara. Peso igual para todas, fonte em toda afirmação.",
      type: "website",
    }),
    { name: "robots", content: "index,follow" },
  ];
}

/**
 * A home descreve o produto inteiro, não a disputa presidencial.
 *
 * Ela dizia "13 candidaturas à Presidência" no selo, no subtítulo e no CTA
 * secundário, e apontava para `/candidatos?cargo=presidential` para que o
 * número batesse com o destino. O número batia; a promessa, não. O banco tem
 * 211 candidaturas — 13 presidenciais e 198 aos governos dos 27 estados — e o
 * eleitor que chegava aqui procurando o governador do estado dele não recebia
 * sinal nenhum de que a plataforma o cobre. 198 das 211 ficavam invisíveis na
 * porta de entrada.
 *
 * O recorte foi então na direção oposta: contar TUDO e mandar para a listagem
 * inteira. A invariante antiga continua valendo — o número exibido é o do
 * conjunto que o destino exibe — só que agora no escopo certo. Se alguém
 * reintroduzir um filtro no destino, o número tem de vir junto.
 *
 * A contagem NÃO filtra por situação. `/candidatos` mostra toda candidatura
 * registrada, com o badge de situação de cada uma; contar só as que estão na
 * disputa faria o número encolher abaixo do que a página lista no dia em que
 * um registro for indeferido — a mesma promessa quebrada, só que mais difícil
 * de perceber.
 */
const CANDIDATES_HREF = "/candidatos";

/**
 * Os números do acervo saem do banco a cada visita, não de constantes.
 *
 * O subtítulo antigo prometia "posições reais, votações nominais e gastos
 * declarados ao TSE", e duas dessas três palavras não descreviam o acervo.
 * Medido em 31/08/2026:
 *
 *   POSIÇÕES — 122 linhas, 8 aprovadas, todas de UMA candidatura. 210 das 211
 *   não têm nenhuma posição publicável.
 *   GASTOS — nenhuma despesa de campanha. As 1.483 linhas de `SpendingRecord`
 *   são todas `DECLARED_ASSETS`: bens declarados no pedido de registro, que é
 *   outra coisa.
 *   VOTAÇÕES — estas têm lastro: 22.524 linhas em `VoteLog`, 3.049 nas oito
 *   matérias publicadas. (`VoteRecord` está zerado, mas é o modelo legado e
 *   não alimenta tela nenhuma.) O que NÃO existe é o vínculo entre voto e
 *   candidatura de 2026 — daí a frase falar em votações da Câmara, e não em
 *   comparar candidatos por elas.
 *
 * A credibilidade é o ativo declarado do produto; a porta de entrada era o
 * lugar onde ela estava sendo gasta.
 *
 * Contar em tempo de execução é o que impede a copy de voltar a divergir: o
 * dia em que a extração de posições avançar, a frase sobe sozinha; o dia em
 * que uma fonte cair, ela desce. Uma constante escrita à mão vira mentira sem
 * que ninguém edite nada.
 */
export async function loader({}: Route.LoaderArgs) {
  const [
    candidates,
    governors,
    governorUfs,
    withPlan,
    withAssets,
    withPositions,
    recentBills,
    articles,
  ] = await Promise.all([
    db.candidate.count(),
    db.candidate.count({ where: { electionType: "governor" } }),
    db.candidate.findMany({
      where: { electionType: "governor", uf: { not: null } },
      select: { uf: true },
      distinct: ["uf"],
    }),
    db.candidate.count({ where: { governmentPlanUrl: { not: null } } }),
    db.candidate.count({
      where: { spendingRecords: { some: { type: "DECLARED_ASSETS" } } },
    }),
    db.candidate.count({
      where: { positions: { some: { approvedAt: { not: null } } } },
    }),
    db.bill.findMany({
      where: { status: "approved" },
      orderBy: { voteDate: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        simplifiedTitle: true,
        simplifiedDescription: true,
        voteDate: true,
        sourceType: true,
      },
    }),
    ArticleService.list(),
  ]);

  return {
    stats: {
      candidates,
      governors,
      ufs: governorUfs.length,
      withPlan,
      withAssets,
      withPositions,
    },
    countdown: countdownCopy(),
    recentBills: recentBills.map((b) => ({
      ...b,
      voteDate: b.voteDate.toISOString(),
    })),
    articles: articles.slice(0, 3),
  };
}

/** Concordância de número para os rótulos contados no banco. */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

const STEPS = [
  {
    title: "Responda ao quiz",
    body: "Uma pergunta por tema, com o peso que você define para cada eixo.",
  },
  {
    title: "Compare com o que está documentado",
    body: "Um tema só entra na conta quando os dois lados têm posição registrada. Sem documento, ele fica de fora — do numerador e do denominador.",
  },
  {
    title: "Verifique cada fonte",
    body: "Documento, página e trecho em toda afirmação exibida.",
  },
];

const TRUST = [
  { strong: "Sem cadastro", rest: "— respostas ficam no aparelho" },
  { strong: "Peso igual", rest: "para todas as candidaturas" },
  {
    strong: "Só fontes oficiais",
    rest: "— com a data da última atualização",
  },
];

/**
 * Alvo de toque dos links "ver tudo" dos cabeçalhos de seção.
 *
 * Mediam 70×16px — abaixo dos 24×24 do SC 2.5.8 e muito abaixo dos 44px que o
 * resto do site adota. Não caem na exceção de "alvo embutido em bloco de
 * texto": são links autônomos, alinhados à direita do cabeçalho. O recuo
 * negativo devolve o alinhamento ótico que o `px-2` tira, então a área cresce
 * sem que nada se mexa na tela. Mesmo padrão de `quiz.tsx`.
 */
const SECTION_LINK =
  "focus-ring -mx-2 inline-flex min-h-11 flex-none items-center gap-1 rounded-xl px-2 text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700";

/** Cartão de votação e de artigo compartilham a moldura e o anel de foco. */
const CARD =
  "group relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-indigo-600";

export default function Home({ loaderData }: Route.ComponentProps) {
  const { stats, countdown, recentBills, articles } = loaderData;

  const ledger = [
    {
      value: stats.candidates,
      label: plural(stats.candidates, "candidatura", "candidaturas"),
      note: `Presidência e ${stats.ufs} governos estaduais, com a situação do registro conforme o TSE.`,
    },
    {
      value: stats.withPlan,
      label: plural(
        stats.withPlan,
        "plano de governo",
        "planos de governo",
      ),
      note: "Protocolados no pedido de registro de candidatura.",
    },
    {
      value: stats.withAssets,
      label: plural(
        stats.withAssets,
        "declaração de bens",
        "declarações de bens",
      ),
      note: "Entregues ao TSE junto do pedido de registro.",
    },
    {
      value: stats.withPositions,
      label: plural(
        stats.withPositions,
        "candidatura com posições",
        "candidaturas com posições",
      ),
      note: "Posições por tema extraídas de documento, com página e trecho citados.",
    },
  ];

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <CountdownBanner {...countdown} />

      {/* Sem `px-*` aqui: o herói é o primeiro bloco da página e era o único a
          furar a régua do Container (24px no mobile contra os 20px de todo o
          resto do site). Alinhado, a borda esquerda do texto continua a mesma
          da rolagem inteira.

          O respiro do topo e os vãos internos são menores no celular do que no
          desktop porque a altura aqui custa o CTA: com `pt-14`, `gap-7` e um
          subtítulo de cinco linhas, "Fazer o Quiz" nascia fora da tela num
          iPhone SE. Nada foi removido — o herói só parou de gastar 70px para
          dizer a mesma coisa. */}
      <Container className="flex flex-col items-center gap-5 pt-8 pb-10 text-center sm:gap-7 sm:pt-16 sm:pb-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-600/10 bg-indigo-600/[0.05] px-4 py-2 text-sm font-medium text-indigo-600">
          <span className="size-2 rounded-full bg-indigo-600" aria-hidden="true" />
          Eleições 2026 · {stats.candidates} candidaturas
        </span>

        <div className="grid gap-4 sm:gap-5">
          <h1 className="font-heading text-[clamp(2.5rem,8vw,5.5rem)] leading-[1.08] font-bold tracking-[-0.02em] text-balance text-slate-800">
            Vote com
            <span className="block text-indigo-600">consciência.</span>
          </h1>
          {/* A frase lista o que existe, sem verbo que junte as duas metades.
              As votações nominais têm lastro — 22.524 votos de parlamentares,
              3.049 nas oito matérias publicadas — mas nenhuma delas está ligada
              a uma candidatura de 2026. "Compare os candidatos com base em
              votações nominais", como estava aqui, afirmava exatamente o
              vínculo que não existe. */}
          <p className="mx-auto max-w-[640px] text-lg leading-relaxed text-pretty text-slate-600 sm:text-xl">
            Presidência e os {stats.ufs} governos estaduais:{" "}
            <strong className="font-semibold text-slate-800">
              plano de governo protocolado
            </strong>
            , bens declarados, situação no TSE e as votações nominais da
            Câmara.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
          <Link
            to="/quiz"
            prefetch="intent"
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-8 py-3.5 text-lg font-bold text-white shadow-lg shadow-slate-800/10 transition-colors hover:bg-slate-900"
          >
            <Sparkles className="size-[18px]" aria-hidden="true" />
            Fazer o Quiz
            <ArrowRight className="size-[18px]" aria-hidden="true" />
          </Link>
          <Link
            to={CANDIDATES_HREF}
            prefetch="intent"
            className="focus-ring inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-600 transition-colors hover:border-slate-300"
          >
            {/* Rótulo curto de propósito: "Ver as 13 candidaturas à
                Presidência" tinha 33 caracteres, quebrava em duas linhas e
                deixava o botão secundário fisicamente maior que o primário. */}
            Ver as {stats.candidates} candidaturas
          </Link>
        </div>

        <ul className="flex flex-col items-center gap-2 text-sm text-slate-500 sm:flex-row sm:gap-6">
          {TRUST.map((t) => (
            <li key={t.strong}>
              <strong className="font-semibold text-slate-800">{t.strong}</strong>{" "}
              {t.rest}
            </li>
          ))}
        </ul>
      </Container>

      {/* Recorte por estado na porta de entrada.

          198 das 211 candidaturas são estaduais, e o filtro por UF já existe em
          `/candidatos` — o que faltava era o caminho até ele. É um `<form
          method="get">`: a pessoa escolhe, o estado vai na querystring e a
          listagem abre recortada. Sem geolocalização, sem armazenar nada e sem
          pedir dado nenhum — o que a plataforma sabe é o que a pessoa acabou de
          digitar na frente dela.

          Sem `cargo` junto: `?uf=XX` devolve os governos daquele estado MAIS as
          candidaturas presidenciais (ver `scopeWhere` em candidate.server.ts),
          que é a cédula que o eleitor tem em mãos. */}
      <Container className="pb-14">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:flex-row md:items-center md:justify-between md:gap-6">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-[-0.02em] text-slate-800">
              Quem disputa o governo do seu estado
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {stats.governors} candidaturas em {stats.ufs} estados. A listagem
              abre com a disputa do seu estado e a presidencial juntas.
            </p>
          </div>
          <Form
            method="get"
            action={CANDIDATES_HREF}
            className="flex flex-none gap-2"
          >
            <label htmlFor="uf-home" className="sr-only">
              Escolha o estado
            </label>
            {/* 16px no celular, não `text-sm`: o Safari do iOS dá zoom em
                qualquer controle de formulário com fonte abaixo de 16px assim
                que ele recebe foco, e a página FICA ampliada depois — o
                eleitor escolhe o estado e cai numa home cortada. A partir de
                `md` volta a 14px, que é a régua dos controles do site. */}
            <select
              id="uf-home"
              name="uf"
              defaultValue=""
              className="focus-ring min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 md:flex-none md:text-sm"
            >
              <option value="">Escolha o estado</option>
              {UFS.map((u) => (
                <option key={u.sigla} value={u.sigla}>
                  {u.nome}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="focus-ring inline-flex min-h-11 flex-none items-center justify-center rounded-xl bg-slate-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
            >
              Ver
            </button>
          </Form>
        </div>
      </Container>

      <Container className="grid gap-4 pb-14 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="flex items-start gap-3.5 rounded-2xl border border-slate-200 bg-white p-5"
          >
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-indigo-600/[0.08] text-sm font-bold text-indigo-600">
              {i + 1}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-800">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {step.body}
              </p>
            </div>
          </div>
        ))}
      </Container>

      {/* O acervo, em números, antes de qualquer promessa sobre ele.

          O título diz "por candidatura" porque a unidade destes quatro números
          é a candidatura. As votações são matérias, unidade diferente, e vivem
          na seção delas — juntar as duas coisas numa grade só faria parecer
          que 8 votações cobrem 211 candidaturas. */}
      <Container className="pb-14">
        <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] text-slate-800">
          O que está publicado por candidatura
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Contado no banco a cada visita — é o acervo de hoje, não uma meta.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ledger.map((item) => (
            <li
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="font-heading text-3xl font-bold tracking-[-0.02em] tabular-nums text-slate-800">
                {item.value.toLocaleString("pt-BR")}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {item.label}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {item.note}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-slate-600">
          As posições por tema são o que o quiz compara, e a extração está no
          começo: enquanto ela avança, a maior parte das candidaturas aparece
          como{" "}
          <strong className="font-semibold text-slate-800">
            “sem posição registrada”
          </strong>{" "}
          em vez de receber um percentual inferido. A lacuna fica visível de
          propósito.
        </p>
      </Container>

      {recentBills.length > 0 && (
        <Container className="pb-14">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] text-slate-800">
                Votações recentes
              </h2>
              {/* Não diz mais "como o Congresso votou nos temas em disputa na
                  eleição", e a correção é dupla. As oito matérias publicadas
                  são todas da Câmara — o mesmo motivo pelo qual
                  `votacoes._index.tsx` parou de anunciar as duas casas. E os
                  3.049 votos nominais delas são de parlamentares: nenhum está
                  ligado a uma candidatura de 2026. "Os temas em disputa na
                  eleição" sugeria a segunda coisa, que a página de destino não
                  entrega. */}
              <p className="mt-1 text-sm text-slate-500">
                Como cada parlamentar votou, nome por nome, nas matérias
                publicadas aqui — votos da Câmara, ainda sem vínculo com as
                candidaturas de 2026.
              </p>
            </div>
            <Link to="/votacoes" className={SECTION_LINK}>
              {/* A seta continua decorativa — o leitor de tela anunciava "Ver
                  todas seta para a direita", mesmo tratamento dos glifos do
                  comparativo em ee3b4d2 — mas deixou de ser o glifo "→", que é
                  desenhado pela fonte do texto e assentava fora da linha de
                  base ao lado de um `font-semibold`. O ícone do mesmo conjunto
                  do CTA principal alinha sozinho e acompanha o peso. */}
              Ver todas <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {recentBills.map((bill) => (
              // O anel desenha o cartão inteiro — mesmo padrão de
              // CandidateCard.tsx. O elemento que recebe foco é o <Link>
              // esticado pelo `after:inset-0`, daí `has-[a:focus-visible]`.
              // Saiu daqui a borda de foco em indigo-300: era a mesma
              // borda do `hover:` e rendia 1,99:1, abaixo dos 3:1 do
              // SC 1.4.11.
              <article key={bill.id} className={CARD}>
                <span className="text-xs font-bold tracking-[0.06em] text-indigo-600 uppercase">
                  {bill.sourceType === "senado" ? "Senado" : "Câmara"}
                </span>
                {/* Só o título dentro do link: o nome acessível do link é o
                    texto que ele embrulha, e embrulhar o cartão inteiro fazia
                    o leitor de tela anunciar "CÂMARA <título> <resumo> <data>"
                    de uma vez. O `after:inset-0` mantém o cartão todo
                    clicável — mesmo padrão de CandidateCard.tsx. */}
                <h3 className="text-base leading-snug font-bold text-pretty text-slate-800">
                  <Link
                    to={`/votacao/${bill.id}`}
                    prefetch="intent"
                    // O anel deste link é o do cartão (acima); sem isto o
                    // navegador desenharia um segundo, apertado no título.
                    className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                  >
                    {bill.simplifiedTitle || bill.title}
                  </Link>
                </h3>
                {bill.simplifiedDescription && (
                  <span className="line-clamp-3 text-sm leading-relaxed text-slate-500">
                    {bill.simplifiedDescription}
                  </span>
                )}
                <time
                  dateTime={bill.voteDate}
                  className="mt-auto pt-2 text-xs text-slate-500"
                >
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(bill.voteDate))}
                </time>
              </article>
            ))}
          </div>
        </Container>
      )}

      {articles.length > 0 && (
        <Container className="pb-16">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-[-0.02em] text-slate-800">
                Para entender a eleição
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Textos curtos e sem lado sobre como o voto funciona.
              </p>
            </div>
            <Link to="/educacao" className={SECTION_LINK}>
              Ver todos <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {articles.map((article) => (
              <article key={article.slug} className={CARD}>
                <span className="text-xs font-bold tracking-[0.06em] text-indigo-600 uppercase">
                  {article.category}
                </span>
                <h3 className="text-base leading-snug font-bold text-pretty text-slate-800">
                  <Link
                    to={`/${article.slug}`}
                    prefetch="intent"
                    className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                  >
                    {article.title}
                  </Link>
                </h3>
                <span className="line-clamp-3 text-sm leading-relaxed text-slate-500">
                  {article.excerpt}
                </span>
              </article>
            ))}
          </div>
        </Container>
      )}
    </main>
  );
}
