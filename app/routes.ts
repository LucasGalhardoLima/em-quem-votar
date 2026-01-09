import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("artigos/:slug", "routes/article.tsx"),
  route("politico/:id", "routes/politico.$id.tsx"),
  route("votacao/:id", "routes/votacao.$id.tsx"),
  route("educacao/como-escolher", "routes/educacao.como-escolher.mdx"),
  route("educacao/importancia-do-voto", "routes/educacao.importancia-voto.mdx"),
  route("educacao/funcoes-vereador", "routes/educacao.funcoes-vereador.mdx"),
  route("educacao/espectro-politico", "routes/educacao.espectro-politico.mdx"),
  route("educacao/mito-voto-nulo", "routes/educacao.mito-voto-nulo.mdx"),
  route("educacao/centrao", "routes/educacao.centrao.mdx"),
  route("busca", "routes/busca.tsx"),
  route("resultado", "routes/resultado.tsx"),
  route("comparar", "routes/comparar.tsx"),
  route("quiz", "routes/quiz.tsx"),
  route("api/newsletter", "routes/api.newsletter.ts"),
  route("metodologia", "routes/metodologia.tsx"),
  route("sitemap.xml", "routes/sitemap.xml.ts"),
  route("sobre", "routes/sobre.mdx"),
  route("faq", "routes/faq.mdx"),
  route("resources/og/:id", "routes/resources.og.$id.tsx")
] satisfies RouteConfig;
