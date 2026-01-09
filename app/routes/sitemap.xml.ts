import { ARTICLES } from "~/data/articles";
import type { Route } from "./+types/sitemap.xml";
import { PoliticianService } from "~/services/politician.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const politicians = await PoliticianService.listAllIds();

  const staticRoutes = [
    "",
    "/busca",
    "/quiz",
  ];

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticRoutes.map((route) => `
    <url>
      <loc>${baseUrl}${route}</loc>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>
  `).join("")}
  
  ${ARTICLES.map((article) => `
    <url>
      <loc>${baseUrl}/educacao/${article.slug}</loc>
      <changefreq>monthly</changefreq>
      <priority>0.7</priority>
    </url>
  `).join("")}

  ${politicians.map((politician) => `
    <url>
      <loc>${baseUrl}/politico/${politician.id}</loc>
      <lastmod>${politician.updatedAt.toISOString()}</lastmod>
      <changefreq>daily</changefreq>
      <priority>1.0</priority>
    </url>
  `).join("")}
</urlset>`;

  return new Response(content, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
      "xml-version": "1.0",
      "encoding": "UTF-8"
    },
  });
}
