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

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default function ContentHub() {
  const { articles } = useLoaderData<typeof loader>();

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <Container className="pt-9 pb-3">
        <h1 className="font-heading text-[28px] font-bold tracking-[-0.02em] text-slate-800 sm:text-[34px]">
          Educação Política
        </h1>
        <p className="mt-1.5 text-[14.5px] text-pretty text-slate-500">
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
            <p className="mx-auto mt-2 max-w-md text-[13.5px] text-slate-500">
              Novos textos são publicados conforme a campanha avança.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link
                key={article.slug}
                to={`/${article.slug}`}
                prefetch="intent"
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-indigo-300"
              >
                <span className="text-[12px] font-bold tracking-[0.06em] text-indigo-600 uppercase">
                  {article.category}
                </span>
                <span className="text-[15px] leading-snug font-bold text-pretty text-slate-800">
                  {article.title}
                </span>
                <span className="line-clamp-3 text-[13px] leading-relaxed text-slate-500">
                  {article.excerpt}
                </span>
                <span className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-[12px] text-slate-500">
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
              </Link>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
