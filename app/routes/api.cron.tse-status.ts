/**
 * Cron horário: reconfere a situação das candidaturas no DivulgaCandContas.
 *
 * POR QUE DE HORA EM HORA, E SEPARADO DO SYNC COMPLETO
 *
 * O próprio site do TSE anuncia que "a atualização dos dados referentes às
 * candidaturas ocorre a cada 60 min". Durante o julgamento dos registros a
 * situação de uma candidatura muda várias vezes ao dia — e é o dado mais
 * sensível que a plataforma exibe, porque diz respeito à condição jurídica de
 * uma pessoa real. O sync completo (identidade, coligação, chapa, fotos)
 * acompanha o pacote de dados abertos e é pesado; a situação não precisa
 * esperar por ele.
 *
 * CUSTO: 28 requisições HTTP ao TSE e um punhado de updates. Nenhuma chamada
 * a modelo de linguagem — o classificador com OpenAI pertence ao pipeline de
 * votações e não é tocado aqui.
 *
 * AUTENTICAÇÃO: com a variável `CRON_SECRET` definida no projeto, o Vercel
 * Cron passa a mandar `Authorization: Bearer <valor>` em cada disparo. Definir
 * a variável é passo manual no painel — sem ela o cron chama sem header.
 * Isto é um endpoint de ESCRITA num site público, então sem segredo válido
 * ele recusa — e, em produção, recusa também se o segredo não estiver
 * configurado (falha fechado, como o /admin).
 */
import type { LoaderFunctionArgs } from "react-router";
import { refreshCandidateStatuses } from "~/services/tse-status.server";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function unauthorized() {
  return Response.json({ error: "Não autorizado." }, { status: 401, headers: NO_STORE });
}

function authorize(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Sem segredo em produção, qualquer um dispararia escrita no banco.
      return Response.json(
        { error: "CRON_SECRET não configurada no servidor." },
        { status: 503, headers: NO_STORE },
      );
    }
    console.warn(
      "[cron] CRON_SECRET não definida — rota liberada apenas porque isto não é produção.",
    );
    return null;
  }

  const header = request.headers.get("Authorization");
  return header === `Bearer ${secret}` ? null : unauthorized();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const result = await refreshCandidateStatuses();

    // Log estruturado: é por aqui que se audita o cron sem abrir o banco.
    for (const c of result.changed) {
      console.log(`[cron/tse-status] ${c.tseId}: ${c.from ?? "—"} → ${c.to}`);
    }
    for (const u of result.unmapped) {
      console.error(
        `[cron/tse-status] redação desconhecida do TSE para ${u.tseId}: ` +
          `${JSON.stringify(u.label)}. Situação mantida como está — ` +
          "adicione a redação em TSE_STATUS_MAP (app/lib/candidate-status.ts).",
      );
    }
    for (const f of result.failedUnits) {
      console.error(
        `[cron/tse-status] ${f.unit} sem resposta (${f.error}). ` +
          "Situação preservada, não sobrescrita.",
      );
    }

    return Response.json(
      {
        ok: true,
        read: result.read,
        changed: result.changed.length,
        unmapped: result.unmapped.length,
        failedUnits: result.failedUnits.map(f => f.unit),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    // Um erro aqui não corrompe nada — `refreshCandidateStatuses` só grava o
    // que o TSE afirmou. Mas precisa aparecer no log do Vercel, senão o cron
    // falha em silêncio e a defasagem cresce sem ninguém ver.
    console.error("[cron/tse-status] falhou:", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: NO_STORE },
    );
  }
}
