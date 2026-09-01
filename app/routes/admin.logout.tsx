/**
 * Encerrar a sessão do painel.
 *
 * A sessão dura 8 horas e é um token sem estado no servidor: sem esta rota,
 * a única forma de revogá-la era trocar `ADMIN_PASSWORD` (o que derruba a
 * chave scrypt e, com ela, todas as sessões abertas). Numa máquina
 * compartilhada isso é caro demais para o gesto "sair daqui agora".
 *
 * POR QUE SÓ POST. Sair é uma escrita: apaga o cookie. Um logout em GET é
 * disparável por qualquer página de terceiro com um `<img src="/admin/logout">`
 * — e `SameSite=Lax` não ajuda, porque ele libera justamente a navegação GET
 * de topo. Aqui o `action` só é alcançado por métodos não-GET (o React Router
 * despacha GET para o `loader`), então o único caminho é o `<Form method="post">`
 * do painel.
 *
 * POR QUE `requireAdmin` NO ACTION — sim, faz sentido exigir sessão válida
 * para destruir sessão, e não é cerimônia. Apagar cookie NÃO depende de o
 * pedido trazer o cookie: um `Set-Cookie` com `Max-Age=0` derruba a sessão da
 * vítima mesmo vindo de um pedido forjado que não mandou cookie nenhum. Como
 * `SameSite=Lax` impede o POST de outro site de carregar `eqv_admin`, o
 * `requireAdmin` transforma esse POST forjado num redirect para o login — uma
 * resposta *sem* `Set-Cookie`, que portanto não desloga ninguém. É o que
 * impede uma página hostil de expulsar o editor no meio de uma aprovação.
 * Também é a regra do CLAUDE.md: rota de /admin guarda loader E action.
 *
 * POR QUE O LOADER NÃO CHAMA `requireAdmin`. Ele não lê nada e não renderiza
 * nada — só devolve quem digitou o endereço para `/admin`, que é guardado
 * pelo próprio `requireAdmin`. Guardar aqui só trocaria esse destino por
 * `/admin/login?next=/admin/logout`, pior para quem chegou com a sessão já
 * vencida. Não há o que vazar num redirect fixo.
 */
import { redirect } from "react-router";

import type { Route } from "./+types/admin.logout";
import {
  LOGIN_PATH,
  destroyAdminSessionCookie,
  requireAdmin,
} from "~/utils/admin-auth.server";

/** Ninguém "visita" esta rota: quem chegar por GET volta para o painel. */
export function loader() {
  return redirect("/admin", { headers: { "Cache-Control": "no-store" } });
}

export function action({ request }: Route.ActionArgs) {
  requireAdmin(request);

  return redirect(LOGIN_PATH, {
    headers: {
      "Set-Cookie": destroyAdminSessionCookie(request),
      "Cache-Control": "no-store",
    },
  });
}
