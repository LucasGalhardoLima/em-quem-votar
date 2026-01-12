import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/article";
import { ARTICLES } from "~/data/articles";
import { ArrowLeft, BookOpen, Share2 } from "lucide-react";
import { clsx } from "clsx";

export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Artigo não encontrado" }];
  }

  const siteUrl = "https://emquemvotar.app"; // Mock URL for MVP
  const imageUrl = `${siteUrl}${data.image}`;
  const articleUrl = `${siteUrl}/artigos/${data.slug}`;

  return [
    { title: `${data.title} | Em Quem Votar` },
    { name: "description", content: data.excerpt },
    { name: "keywords", content: data.keywords.join(", ") },

    // Open Graph / Facebook
    { property: "og:type", content: "article" },
    { property: "og:url", content: articleUrl },
    { property: "og:title", content: data.title },
    { property: "og:description", content: data.excerpt },
    { property: "og:image", content: imageUrl },
    { property: "og:site_name", content: "Em Quem Votar" },

    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:url", content: articleUrl },
    { name: "twitter:title", content: data.title },
    { name: "twitter:description", content: data.excerpt },
    { name: "twitter:image", content: imageUrl },
  ];
}

export function loader({ params }: Route.LoaderArgs) {
  const article = ARTICLES.find((a) => a.slug === params.slug);
  if (!article) {
    throw new Response("Artigo não encontrado", { status: 404 });
  }
  return article;
}

import { Footer } from "~/components/Footer";

// ... existing meta ...

export default function ArticlePage() {
  const article = useLoaderData();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "image": [
      `https://emquemvotar.app${article.image}`
    ],
    "datePublished": article.datePublished,
    "author": [{
      "@type": "Person",
      "name": article.author,
      "url": "https://emquemvotar.app"
    }],
    "description": article.excerpt,
    "publisher": {
      "@type": "Organization",
      "name": "Em Quem Votar",
      "logo": {
        "@type": "ImageObject",
        "url": "https://emquemvotar.app/logo.png"
      }
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header / Nav */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center text-slate-600 hover:text-brand-primary transition-colors font-medium group"
          >
            <ArrowLeft className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            Voltar
          </Link>
          <div className="flex items-center gap-2 text-brand-primary font-bold">
            <BookOpen className="w-5 h-5" />
            <span className="hidden sm:inline">Em Quem Votar</span>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-3xl mx-auto px-4 py-12 md:py-20 w-full">

        {/* Article Header */}
        <div className="mb-12 space-y-6 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-primary-light text-brand-primary text-sm font-semibold tracking-wide uppercase">
            {article.category}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
            {article.title}
          </h1>
          <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto">
            {article.excerpt}
          </p>
        </div>

        {/* Content */}
        <article className="prose prose-lg prose-slate mx-auto prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-8 prose-a:text-brand-primary hover:prose-a:text-brand-text-alt prose-img:rounded-xl">
          <div dangerouslySetInnerHTML={{ __html: article.content }} />
        </article>

        {/* References */}
        <div className="mt-16 pt-8 border-t border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Referências & Leitura Adicional</h3>
          <ul className="space-y-2">
            {article.references.map((ref: any, idx: number) => (
              <li key={idx}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-slate-600 hover:text-brand-primary transition-colors text-sm group"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary mr-3 group-hover:scale-125 transition-transform" />
                  {ref.title}
                  <Share2 className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </li>
            ))}
          </ul>
        </div>

      </main>

      <Footer />
    </div>
  );
}
