import type { Route } from "./+types/sitemap.xml";
import { CandidateService } from "~/services/candidate.server";
import { ArticleService } from "~/services/article.server";
import { checkQuota } from "~/utils/rate-limit.server";

/**
 * Cota por origem — 20 gerações por minuto.
 *
 * POR QUE ESTE NÚMERO. Cada geração custa duas consultas ao Postgres
 * (`listAllIds` + `ArticleService.list()`), que saem do mesmo pool das
 * páginas que gente de verdade está lendo. O consumidor legítimo é robô de
 * busca, que busca o sitemap algumas vezes por dia, e a resposta sai com
 * `max-age=3600` — uma repetição dentro da hora é servida pelo CDN e nem
 * chega aqui. Ou seja: 20/min é ordens de grandeza acima de qualquer padrão
 * legítimo. O que ele limita é o laço com query string variável, que fura o
 * cache do CDN e transforma uma URL pública em duas consultas por pedido.
 *
 * É mais folgado que o da imagem OG porque duas consultas indexadas custam
 * muito menos que rasterizar um PNG.
 */
const QUOTA_BUCKET = "sitemap";
const QUOTA_LIMIT = 20;
const QUOTA_WINDOW_MS = 60 * 1000;

export async function loader({ request }: Route.LoaderArgs) {
  // O loader do root não roda em resource route (React Router despacha por
  // `handleResourceRequest`, só a folha). Mesma leitura de origem que ele faz.
  const ip = request.headers.get("x-forwarded-for") || "local";
  if (!checkQuota(QUOTA_BUCKET, ip, QUOTA_LIMIT, QUOTA_WINDOW_MS)) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const [candidates, articles] = await Promise.all([
    CandidateService.listAllIds(),
    ArticleService.list(),
  ]);

  const staticRoutes = [
    { path: "", priority: "1.0", changefreq: "daily" },
    { path: "/candidatos", priority: "0.9", changefreq: "daily" },
    { path: "/quiz", priority: "0.8", changefreq: "weekly" },
    { path: "/votacoes", priority: "0.7", changefreq: "daily" },
    { path: "/comparar", priority: "0.6", changefreq: "weekly" },
    { path: "/educacao", priority: "0.6", changefreq: "monthly" },
    { path: "/sobre", priority: "0.4", changefreq: "monthly" },
    { path: "/faq", priority: "0.4", changefreq: "monthly" },
    { path: "/metodologia", priority: "0.5", changefreq: "monthly" },
    { path: "/privacidade", priority: "0.3", changefreq: "yearly" },
    { path: "/termos", priority: "0.3", changefreq: "yearly" },
  ];

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticRoutes
    .map(
      (route) => `
    <url>
      <loc>${baseUrl}${route.path}</loc>
      <changefreq>${route.changefreq}</changefreq>
      <priority>${route.priority}</priority>
    </url>`
    )
    .join("")}
  ${candidates
    .map(
      (c) => `
    <url>
      <loc>${baseUrl}/candidato/${c.id}</loc>
      <lastmod>${c.updatedAt}</lastmod>
      <changefreq>daily</changefreq>
      <priority>0.9</priority>
    </url>`
    )
    .join("")}
  ${articles
    .map(
      (article) => `
    <url>
      <loc>${baseUrl}/${article.slug}</loc>
      <changefreq>monthly</changefreq>
      <priority>0.6</priority>
    </url>`
    )
    .join("")}
</urlset>`;

  return new Response(content, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
