import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Candidates (replaces busca + politico)
  route("candidatos", "routes/candidatos.tsx"),
  route("candidato/:id", "routes/candidato.$id.tsx"),
  route("comparar", "routes/comparar.tsx"),

  // Quiz & Results
  route("quiz", "routes/quiz.tsx"),
  route("resultado", "routes/resultado.tsx"),

  // Voting Records
  route("votacoes", "routes/votacoes._index.tsx"),
  route("votacao/:id", "routes/votacao.$id.tsx"),

  // Education & Static
  route("educacao", "routes/educacao._index.tsx"),
  route("educacao/como-escolher", "routes/educacao.como-escolher.mdx"),
  route("educacao/importancia-voto", "routes/educacao.importancia-voto.mdx"),
  route("educacao/funcoes-vereador", "routes/educacao.funcoes-vereador.mdx"),
  route("educacao/espectro-politico", "routes/educacao.espectro-politico.mdx"),
  route("educacao/mito-voto-nulo", "routes/educacao.mito-voto-nulo.mdx"),
  route("educacao/centrao", "routes/educacao.centrao.mdx"),
  route("educacao/panorama-governo", "routes/educacao.panorama-governo.mdx"),
  route("educacao/expectativa-ano-eleitoral", "routes/educacao.expectativa-ano-eleitoral.mdx"),
  route("educacao/politica-atual-resumo", "routes/educacao.politica-atual-resumo.mdx"),
  route("metodologia", "routes/metodologia.tsx"),
  route("sobre", "routes/sobre.mdx"),
  route("faq", "routes/faq.mdx"),

  // API
  route("api/newsletter", "routes/api.newsletter.ts"),

  // Admin
  route("admin", "routes/admin._index.tsx"),
  route("admin/candidato/:id", "routes/admin.candidato.$id.tsx"),
  route("admin/votacao/:id", "routes/admin.votacao.$id.tsx"),

  // Resources
  route("resources/og/:id", "routes/resources.og.$id.tsx"),
  route("sitemap.xml", "routes/sitemap.xml.ts"),

  // Legacy redirects (preserve old URLs)
  route("busca", "routes/busca.tsx"),
  route("politico/:id", "routes/politico.$id.tsx"),
  route("artigos/:slug", "routes/article.tsx"),
] satisfies RouteConfig;
