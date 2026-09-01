import { redirect } from "react-router";

/**
 * Redirect legado do artigo que mudou de assunto.
 *
 * O texto original ("O Que Faz um Vereador?") descrevia cargos municipais,
 * que não estão na cédula de 2026. Reescrito para os cargos legislativos que
 * o eleitor de fato elege este ano, ele passou a viver em
 * /educacao/funcoes-legislativo — e esta rota existe só para não quebrar a
 * URL já indexada. Mesmo motivo de /artigos/:slug em `article.tsx`.
 */
export function loader() {
  return redirect("/educacao/funcoes-legislativo", 301);
}
