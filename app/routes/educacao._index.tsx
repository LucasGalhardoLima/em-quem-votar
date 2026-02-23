import { useLoaderData, Link } from "react-router";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { Badge } from "~/components/ui/badge";
import { BookOpen, Calendar, Clock, ArrowRight } from "lucide-react";
import { ArticleService } from "~/services/article.server";

export function meta() {
  return [
    { title: "Educação Política | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Entenda o cenário político com nossos guias e artigos educativos.",
    },
  ];
}

export async function loader() {
  const articles = await ArticleService.list();
  return { articles };
}

export default function ContentHub() {
  const { articles } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        breadcrumbItems={[{ label: "Educação Política", active: true }]}
      />

      <main className="flex-grow">
        {/* Header */}
        <section className="border-b bg-card py-12 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
            <div className="inline-flex items-center justify-center p-3 bg-muted rounded-xl">
              <BookOpen className="w-6 h-6 text-muted-foreground" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Educação Política
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Informação isenta e didática para você entender o cenário político
              e votar com consciência.
            </p>
          </div>
        </section>

        {/* Articles Grid */}
        <section className="max-w-4xl mx-auto px-4 py-8">
          {articles.length === 0 ? (
            <div className="text-center py-16 rounded-lg border bg-card">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum artigo disponível no momento.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  to={`/${article.slug}`}
                  className="group rounded-lg border bg-card p-5 hover:border-foreground/20 transition-colors flex flex-col h-full"
                >
                  <div className="flex-grow space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-md bg-muted">
                        <BookOpen className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        {article.category}
                      </Badge>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground group-hover:text-foreground/80 transition-colors leading-snug mb-1.5">
                        {article.title}
                      </h2>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {article.excerpt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(article.date).toLocaleDateString("pt-BR")}
                      </span>
                      {article.readTime && (
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {article.readTime}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
