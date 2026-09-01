import { useLoaderData, Link } from "react-router";
import { ArticleService } from "~/services/article.server";
import { pageMeta } from "~/root";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";

export function meta() {
  // Mesma frase que a página exibe sob o <h1> — ver a nota em votacoes._index.
  return pageMeta({
    title: "Educação Política | Em Quem Votar?",
    description:
      "Textos curtos e sem lado sobre como o voto funciona, para você entender a eleição antes de escolher.",
    type: "website",
  });
}

export async function loader() {
  const articles = await ArticleService.list();
  return { articles };
}

/**
 * `timeZone: "UTC"` não é detalhe. A data vem do frontmatter como `2026-08-28`,
 * e `new Date("2026-08-28")` é meia-noite UTC — sem fuso explícito o
 * formatador usa o do aparelho e, em Brasília (UTC−3), imprime "27 de agosto"
 * ao lado de um `<time dateTime="2026-08-28">` e de um cabeçalho de artigo que
 * dizem 28. Fixado em UTC, o cartão mostra exatamente a data escrita no
 * arquivo, em qualquer fuso. Mesma escolha do formatador de `home.tsx`.
 */
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function ContentHub() {
  const { articles } = useLoaderData<typeof loader>();

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="pt-9 pb-3">
        <h1 className="font-heading text-3xl font-bold tracking-[-0.02em] text-slate-800 sm:text-4xl">
          Educação Política
        </h1>
        <p className="mt-1.5 text-base text-pretty text-slate-500">
          Textos curtos e sem lado sobre como o voto funciona, para você
          entender a eleição antes de escolher.
        </p>
      </Container>

      <Container className="pt-5 pb-12">
        {articles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-base font-bold text-slate-600">
              Nenhum artigo disponível no momento
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Novos textos são publicados conforme a campanha avança.
            </p>
            {/* Um estado vazio sem link é um beco: a pessoa chegou aqui pelo
                menu e a única saída seria o botão de voltar. As candidaturas
                são o que ela veio entender, então é para lá que a página
                aponta enquanto não há texto. */}
            <Link
              to="/candidatos"
              prefetch="intent"
              className="focus-ring mt-5 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              Ver as candidaturas
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <article
                key={article.slug}
                // O anel desenha o cartão inteiro — mesmo padrão de
                // CandidateCard.tsx. Quem tabula uma grade tem o cartão como
                // alvo mental, e o elemento que recebe foco é o <Link>
                // esticado pelo `after:inset-0`, daí `has-[a:focus-visible]`.
                // Saiu daqui a borda de foco em indigo-300: era a mesma
                // borda do `hover:` (foco de teclado indistinguível de mouse)
                // e rendia 1,99:1, abaixo dos 3:1 do SC 1.4.11.
                className="group relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-indigo-600"
              >
                <span className="text-xs font-bold tracking-[0.06em] text-indigo-600 uppercase">
                  {article.category}
                </span>
                {/* Só o título dentro do link — ver a nota em CandidateCard.tsx.
                    Embrulhar o cartão inteiro dava ao link um nome acessível de
                    quatro campos concatenados, e a lista de links é o atalho
                    principal de quem não enxerga. */}
                <h2 className="text-base leading-snug font-bold text-pretty text-slate-800">
                  <Link
                    to={`/${article.slug}`}
                    prefetch="intent"
                    // O anel deste link é o do cartão (acima); sem isto o
                    // navegador desenharia um segundo, apertado no título.
                    className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                  >
                    {article.title}
                  </Link>
                </h2>
                <span className="line-clamp-3 text-sm leading-relaxed text-slate-500">
                  {article.excerpt}
                </span>
                <span className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-500">
                  <time dateTime={article.date}>
                    {dateFormatter.format(new Date(article.date))}
                  </time>
                  {article.readTime && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{article.readTime} de leitura</span>
                    </>
                  )}
                </span>
              </article>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
