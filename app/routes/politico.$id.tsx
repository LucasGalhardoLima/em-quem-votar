import { redirect } from "react-router";

/**
 * Redirect legado, mantido só para URLs antigas que circulam fora do site.
 *
 * O id é descartado de propósito: `Politician` (tabela legada) e `Candidate`
 * não compartilham chave nenhuma — nem CPF, nem tseId — então não há como
 * levar o leitor à página certa a partir deste id. Casar por nome atribuiria
 * o histórico de uma pessoa real ao perfil de outra, e a plataforma não faz
 * esse tipo de inferência.
 *
 * Nada dentro do site aponta mais para cá: /votacao/:id renderizava 3.012
 * links para esta rota e passou a mostrar os nomes dos deputados como texto,
 * exatamente porque este destino não existe. Se um dia houver página de
 * parlamentar, é aqui que o mapeamento entra.
 */
export function loader() {
  return redirect(`/candidatos`, 301);
}
