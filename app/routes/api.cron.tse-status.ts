/**
 * Cron diário: reconfere a situação das candidaturas no DivulgaCandContas.
 *
 * QUEM É A FONTE PRINCIPAL — E POR QUE ESTA ROTA NÃO É
 *
 * A cobertura real da situação vem do sync completo em
 * `.github/workflows/sync-tse-2026.yml`, que roda 4×/dia e também grava
 * `tseStatusLabel`/`registrationStatus` — cerca de 6h de defasagem, contra as
 * 24h que o SC-104 exige. Esta rota é o *segundo caminho*: existe para que a
 * situação continue sendo atualizada se o workflow do Actions se auto-desativar
 * por inatividade, o que já aconteceu com quatro workflows deste repo.
 *
 * shortcut: 1×/dia em vez de 1×/hora — o plano Hobby do Vercel recusa na
 * implantação qualquer expressão mais frequente que diária ("Hobby accounts are
 * limited to daily cron jobs"), e a precisão lá é ±59min. O desenho original
 * era `0 * * * *`, espelhando os 60min que o próprio TSE anuncia; durante o
 * julgamento dos registros a situação muda várias vezes ao dia, então a
 * cadência horária não era capricho. upgrade: assinar o plano Pro (intervalo
 * mínimo de 1min) e devolver `0 * * * *` ao vercel.json — nenhuma mudança de
 * código é necessária, só a expressão.
 *
 * CUSTO: 28 requisições HTTP ao TSE e um punhado de updates. Nenhuma chamada
 * a modelo de linguagem — o classificador com OpenAI pertence ao pipeline de
 * votações e não é tocado aqui.
 *
 * AUTENTICAÇÃO: com a variável `CRON_SECRET` definida no projeto, o Vercel
 * Cron passa a mandar `Authorization: Bearer <valor>` em cada disparo. Criar a
 * variável é passo manual no painel — sem ela o cron chama sem header.
 * Isto é um endpoint de ESCRITA num site público, então sem segredo válido
 * ele recusa — e, em produção, recusa também se o segredo não estiver
 * configurado (falha fechado, como o /admin).
 */
import type { LoaderFunctionArgs } from "react-router";
import { refreshCandidateStatuses } from "~/services/tse-status.server";
import { safeEqual } from "~/utils/admin-auth.server";
import { checkQuota } from "~/utils/rate-limit.server";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function unauthorized() {
  return Response.json({ error: "Não autorizado." }, { status: 401, headers: NO_STORE });
}

/**
 * Cota por origem — 20 disparos por hora.
 *
 * POR QUE ESTE NÚMERO. O agendamento é diário (`vercel.json`, `0 15 * * *`,
 * com a precisão de ±59min do plano Hobby), e o sync completo do GitHub
 * Actions não passa por aqui: o caminho legítimo gasta **1** das 20 vagas da
 * hora em que dispara. As outras 19 existem para o que também é legítimo e
 * não está no calendário — uma repetição do Vercel depois de erro e o `curl`
 * manual de quem está depurando. Barrar o cron de verdade não daria erro
 * visível em lugar nenhum: viraria situação de candidatura envelhecendo em
 * silêncio, que é justamente o que esta rota existe para evitar. Por isso a
 * folga é de ~480× o volume diário real, e não de 2×.
 */
const QUOTA_BUCKET = "cron-tse-status";
const QUOTA_LIMIT = 20;
const QUOTA_WINDOW_MS = 60 * 60 * 1000;

/**
 * A cota vem ANTES da conferência do segredo, de propósito.
 *
 * Depois de `authorize()` ela não protegeria nada: cada palpite de bearer
 * errado sairia no 401 sem nunca incrementar contador, e a adivinhação
 * continuaria de graça. Contando antes, o palpite paga — que é o único
 * objetivo desta cota, já que o caminho autorizado usa 1 vaga por dia.
 *
 * Nada aqui muda o 503 nem o 401 que já existiam: quem não estoura a cota
 * cai exatamente no mesmo `authorize()` de antes.
 */
function throttle(request: Request): Response | null {
  // Mesma leitura de origem do loader do root: atrás da borda da Vercel o
  // `x-forwarded-for` é reescrito por ela; fora desse proxy, `local`.
  const ip = request.headers.get("x-forwarded-for") || "local";
  if (checkQuota(QUOTA_BUCKET, ip, QUOTA_LIMIT, QUOTA_WINDOW_MS)) return null;

  return Response.json(
    { error: "Muitas requisições." },
    { status: 429, headers: NO_STORE },
  );
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

  // `===` sai no primeiro byte diferente e vaza o prefixo correto pelo
  // tempo de resposta. `safeEqual` compara em tempo constante — é a mesma
  // função que o login do /admin usa para conferir a senha.
  const header = request.headers.get("Authorization") ?? "";
  return safeEqual(header, `Bearer ${secret}`) ? null : unauthorized();
}

export async function loader({ request }: LoaderFunctionArgs) {
  const throttled = throttle(request);
  if (throttled) return throttled;

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

    // PONTO CEGO — NÃO REMOVA ACHANDO QUE É PARANOIA.
    //
    // O cenário: o TSE renomeia a chave `candidatos` no corpo da listagem (ou
    // muda a forma da resposta de qualquer jeito que não seja erro de
    // transporte). As 28 unidades respondem **HTTP 200**, `fetchDivulgaStatuses`
    // não acha a lista e devolve zero situações — e, como ninguém lançou, devolve
    // também ZERO unidades falhas. O laço de `failedUnits` acima, que é como este
    // caminho avisa, não tem nada para percorrer.
    //
    // O módulo está CERTO em não afirmar nada (o valor gravado sobrevive, como
    // manda o CLAUDE.md). Quem tem de gritar é este chamador: sem este guarda a
    // rota responde 200 `ok: true`, a situação das 211 candidaturas congela e o
    // site segue no ar afirmando situações velhas sobre pessoas reais, com
    // aparência de saúde.
    //
    // O critério é um estado logicamente impossível, não uma heurística: se as 28
    // unidades responderam bem numa eleição com 211 candidaturas, alguma situação
    // tinha de vir. Zero leituras sem nenhuma falha só acontece se o formato
    // mudou. (Zero leituras COM falhas é outra coisa — o laço de `failedUnits`
    // acima já nomeia cada unidade, e ali o silêncio tem explicação.)
    //
    // ISTO É ALARME, NÃO FALLBACK: `refreshCandidateStatuses` não gravou nada
    // (sem rótulo lido não há update), e este bloco também não grava.
    const anomaly =
      result.read === 0 && result.failedUnits.length === 0
        ? "As 28 unidades do DivulgaCandContas responderam sem erro e ainda " +
          "assim ZERO situações foram lidas. Isso é impossível com 211 " +
          "candidaturas — o formato da resposta do TSE provavelmente mudou (a " +
          "chave `candidatos` da listagem, em app/lib/tse-divulga.ts). Nada foi " +
          "sobrescrito, mas nenhuma situação foi conferida."
        : null;

    if (anomaly) console.error(`[cron/tse-status] ${anomaly}`);

    return Response.json(
      {
        ok: anomaly === null,
        read: result.read,
        changed: result.changed.length,
        unmapped: result.unmapped.length,
        failedUnits: result.failedUnits.map(f => f.unit),
        // Só no caso anômalo: o corpo do caminho normal fica idêntico ao que
        // sempre foi, para não quebrar quem já lê estes logs.
        ...(anomaly ? { anomaly } : {}),
      },
      // 5xx e não 200: é assim que a anomalia aparece como erro no painel do
      // Vercel. Mesmo código do `catch` abaixo de propósito — as duas situações
      // significam a mesma coisa para quem monitora ("o cron não fez o trabalho").
      { status: anomaly ? 500 : 200, headers: NO_STORE },
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
