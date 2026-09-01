import type { Route } from "./+types/robots.txt";

/**
 * `robots.txt` é rota, e não arquivo em `public/`, por causa de uma linha: a
 * diretiva `Sitemap:` exige URL absoluta pelo próprio padrão do robots.txt.
 * Num arquivo estático isso vira um domínio escrito à mão — e foi o que
 * aconteceu: `public/robots.txt` apontou por meses para
 * `https://emquemvotar.app/sitemap.xml`, um domínio que não resolve, então a
 * única pista que o site dava aos buscadores sobre o próprio sitemap levava a
 * lugar nenhum. Ninguém relê robots.txt.
 *
 * Aqui a origem sai do request, igual `sitemap.xml.ts` e o `Layout` da raiz
 * fazem para a canonical. O endereço passa a acompanhar o site sozinho — o
 * subdomínio da Vercel hoje, o domínio próprio quando existir.
 *
 * Sem cota de taxa, ao contrário do sitemap e da imagem OG: a resposta é
 * texto constante, não toca o banco e não rasteriza nada.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const content = `User-agent: *
Allow: /
Disallow: /api/
Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
