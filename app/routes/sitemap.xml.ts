import type { Route } from "./+types/sitemap.xml";
import { CandidateService } from "~/services/candidate.server";
import { ArticleService } from "~/services/article.server";

export async function loader({ request }: Route.LoaderArgs) {
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
      <lastmod>${c.updatedAt.toISOString()}</lastmod>
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
