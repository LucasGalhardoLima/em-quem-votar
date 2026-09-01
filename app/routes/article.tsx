import { redirect } from "react-router";
import type { Route } from "./+types/article";

/**
 * Rota legada. Os artigos viviam em /artigos/:slug com o conteúdo duplicado
 * em app/data/articles.ts; hoje a fonte única é o MDX em /educacao/*.
 * Mantemos o redirecionamento 301 para não perder os links já publicados.
 */
const LEGACY_SLUGS: Record<string, string> = {
  "importancia-do-voto": "importancia-voto",
  "como-escolher": "como-escolher",
  // O texto sobre vereador virou /educacao/funcoes-legislativo quando foi
  // reescrito para os cargos de 2026. Aponta direto para o destino final,
  // para não encadear dois 301.
  "funcoes-vereador": "funcoes-legislativo",
  "espectro-politico": "espectro-politico",
  "mito-voto-nulo": "mito-voto-nulo",
  centrao: "centrao",
};

export async function loader({ params }: Route.LoaderArgs) {
  const target = LEGACY_SLUGS[params.slug ?? ""];
  throw redirect(target ? `/educacao/${target}` : "/educacao", 301);
}

export default function ArticleRedirect() {
  return null;
}
