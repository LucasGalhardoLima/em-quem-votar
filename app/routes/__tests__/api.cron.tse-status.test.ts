import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/cron/tse-status` é um endpoint de ESCRITA num site público: quem
 * conseguir dispará-lo faz o servidor bater 28 vezes no TSE e reescrever a
 * situação de candidaturas reais. A guarda toda mora em `authorize()`, antes
 * de qualquer efeito — e é exatamente por isso que ela precisa de teste: um
 * refactor que mova o `authorize` para depois do `refresh`, ou que troque o
 * 503 de produção por um "libera e avisa", não quebraria nenhuma outra suíte.
 *
 * O mock de `refreshCandidateStatuses` não é conveniência: sem ele o teste
 * abriria conexão com o Supabase e faria 28 requisições ao DivulgaCandContas.
 */
vi.mock("~/services/tse-status.server", () => ({
  refreshCandidateStatuses: vi.fn(),
}));

import { loader } from "../api.cron.tse-status";
import { refreshCandidateStatuses } from "~/services/tse-status.server";

const refresh = vi.mocked(refreshCandidateStatuses);

/**
 * Execução saudável: o suficiente para os testes de autorização e de cota não
 * explodirem, sem escrever nada.
 *
 * `read: 211` NÃO é enfeite. Este resultado já foi `read: 0` com
 * `failedUnits: []`, e hoje esse par exato é a ANOMALIA que a rota denuncia com
 * 500 (ver o teste no fim do arquivo). Um padrão anômalo aqui faria todo teste
 * de auth/cota afirmar 200 sobre um cenário que tem de ser 500 — ou, pior,
 * passar a exigir 500 e travar o defeito no lugar do comportamento.
 */
function resultadoSaudavel() {
  return { read: 211, changed: [], unmapped: [], failedUnits: [] };
}

/**
 * ORIGEM NOVA A CADA PEDIDO, POR PADRÃO. A cota da rota é contada num `Map`
 * de módulo, sem função de reset exportada (limitação declarada no cabeçalho
 * de `rate-limit.server.ts`). Se todos os testes saíssem do mesmo IP, um
 * herdaria a contagem do outro e a suíte começaria a falhar por ordem de
 * execução. Quem está testando a cota passa o IP de propósito.
 */
let ips = 0;
const novoIp = () => `198.51.100.${(ips += 1)}`;

function req(authorization?: string, ip: string = novoIp()): Request {
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  if (authorization) headers.Authorization = authorization;
  return new Request("https://exemplo.test/api/cron/tse-status", { headers });
}

function run(request: Request) {
  return loader({ request } as Parameters<typeof loader>[0]);
}

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.CRON_SECRET;
  refresh.mockReset();
  refresh.mockResolvedValue(resultadoSaudavel());
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  // Um teste da cota adianta o relógio; sem isto o próximo herdaria o relógio
  // falso e o `Date.now()` que a cota lê ficaria congelado.
  vi.useRealTimers();
});

describe("autorização de /api/cron/tse-status", () => {
  it("sem CRON_SECRET em produção, falha fechado com 503 e não escreve nada", async () => {
    // Falha fechado como o /admin: sem segredo configurado, qualquer pessoa
    // com a URL dispararia escrita no banco.
    vi.stubEnv("NODE_ENV", "production");

    const res = await run(req());

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "CRON_SECRET não configurada no servidor.",
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sem CRON_SECRET fora de produção, libera e avisa no log", async () => {
    // Concessão deliberada para o desenvolvimento local, onde a variável não
    // existe. Se este teste começar a falhar em produção o 503 acima é quem
    // manda — os dois juntos travam o par de comportamentos.
    const res = await run(req());

    expect(res.status).toBe(200);
    expect(console.warn).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("com CRON_SECRET e sem credencial, recusa com 401", async () => {
    process.env.CRON_SECRET = "segredo-do-cron";

    const res = await run(req());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Não autorizado." });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("com credencial incorreta, recusa com 401", async () => {
    process.env.CRON_SECRET = "segredo-do-cron";

    // Um prefixo correto tem que recusar igual a um valor sem relação: a
    // comparação é `safeEqual`, em tempo constante, justamente para não
    // devolver o segredo byte a byte pelo tempo de resposta.
    for (const header of [
      "Bearer segredo-do-cro",
      "Bearer segredo-do-cron-a-mais",
      "Bearer outra-coisa",
      "segredo-do-cron",
      "Basic c2VncmVkbw==",
    ]) {
      const res = await run(req(header));
      expect(res.status).toBe(401);
    }

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("cota de /api/cron/tse-status", () => {
  // Espelha a constante privada da rota. Se alguém mexer nela lá, este teste
  // falha — e é essa a intenção: o número é contrato com o cron de verdade.
  const QUOTA_LIMIT = 20;
  const UM_DIA = 24 * 60 * 60 * 1000;

  it("o disparo diário legítimo nunca é barrado", async () => {
    // O REQUISITO QUE MAIS IMPORTA AQUI. Barrar o cron real não daria erro
    // visível em lugar nenhum: viraria situação de candidatura envelhecendo
    // em silêncio. Uma semana de disparos, do mesmo IP, na cadência do
    // `vercel.json` (`0 15 * * *`).
    vi.useFakeTimers();
    process.env.CRON_SECRET = "segredo-do-cron";
    const ip = novoIp();

    for (let dia = 0; dia < 7; dia += 1) {
      const res = await run(req("Bearer segredo-do-cron", ip));
      expect(res.status).toBe(200);
      vi.advanceTimersByTime(UM_DIA);
    }

    expect(refresh).toHaveBeenCalledTimes(7);
  });

  it("palpite errado gasta cota: passado o limite vem 429, não 401", async () => {
    // A ORDEM É O TESTE. Se a cota fosse conferida depois do `authorize`, todo
    // palpite errado sairia no 401 sem incrementar contador nenhum e a
    // adivinhação do bearer seria de graça — a cota não protegeria nada.
    process.env.CRON_SECRET = "segredo-do-cron";
    const ip = novoIp();

    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      const res = await run(req("Bearer chute-errado", ip));
      expect(res.status).toBe(401);
    }

    const res = await run(req("Bearer chute-errado", ip));
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ error: "Muitas requisições." });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a cota é por origem: um IP saturado não barra o cron de outro", async () => {
    process.env.CRON_SECRET = "segredo-do-cron";
    const saturado = novoIp();

    for (let i = 1; i <= QUOTA_LIMIT; i += 1) {
      await run(req("Bearer chute-errado", saturado));
    }
    expect((await run(req("Bearer chute-errado", saturado))).status).toBe(429);

    // Se os contadores se misturassem, um robô qualquer desligaria o cron.
    const res = await run(req("Bearer segredo-do-cron", novoIp()));
    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("a cota não muda o fail-open de desenvolvimento nem o 503 de produção", async () => {
    // Os dois comportamentos são deliberados e vêm do `authorize`. A cota é
    // anterior a ele, então precisa deixar os dois intactos para quem não a
    // estourou.
    const semSegredo = await run(req());
    expect(semSegredo.status).toBe(200);
    expect(console.warn).toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "production");
    const emProducao = await run(req());
    expect(emProducao.status).toBe(503);
  });
});

describe("execução de /api/cron/tse-status", () => {
  it("com a credencial correta, roda o refresh uma vez e resume o resultado", async () => {
    process.env.CRON_SECRET = "segredo-do-cron";
    refresh.mockResolvedValue({
      read: 211,
      changed: [{ tseId: "280000123456", from: "Aguardando julgamento", to: "Deferido" }],
      unmapped: [{ tseId: "280000999999", label: "Redação inédita" }],
      failedUnits: [{ unit: "SP", error: "timeout" }],
    });

    const res = await run(req("Bearer segredo-do-cron"));

    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    // O corpo é contagem, não a lista: é o que o painel do Vercel mostra.
    await expect(res.json()).resolves.toEqual({
      ok: true,
      read: 211,
      changed: 1,
      unmapped: 1,
      failedUnits: ["SP"],
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("erro no refresh vira 500 com a mensagem, e aparece no log", async () => {
    // Sem o log, o cron falharia em silêncio e a defasagem da situação
    // cresceria sem ninguém ver — a rota é o caminho reserva.
    process.env.CRON_SECRET = "segredo-do-cron";
    refresh.mockRejectedValue(new Error("TSE fora do ar"));

    const res = await run(req("Bearer segredo-do-cron"));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "TSE fora do ar" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(console.error).toHaveBeenCalled();
  });
});

/**
 * O MODO DE FALHA QUE MAIS IMPORTA NUMA ELEIÇÃO: o cron parece saudável e não
 * está. Se o TSE renomear a chave `candidatos` da listagem, as 28 unidades
 * respondem 200, `fetchDivulgaStatuses` devolve zero situações e — porque
 * ninguém lançou — zero unidades falhas. O laço de aviso por unidade, que é
 * como esta rota denuncia problema, fica sem nada para percorrer.
 *
 * O módulo `~/lib/tse-divulga` está certo em não afirmar nada: o valor gravado
 * sobrevive. Quem tem de gritar é a rota. Sem estes dois testes, um refactor
 * que "simplificasse" o guarda devolveria 200 `ok: true` sobre uma execução
 * que não conferiu ninguém, e a situação de 211 candidaturas congelaria em
 * silêncio com o site no ar afirmando o que estava velho.
 */
describe("anomalia de formato em /api/cron/tse-status", () => {
  it("zero situações lidas E nenhuma falha: 500, ok:false e a causa nomeada no corpo", async () => {
    process.env.CRON_SECRET = "segredo-do-cron";
    refresh.mockResolvedValue({ read: 0, changed: [], unmapped: [], failedUnits: [] });

    const res = await run(req("Bearer segredo-do-cron"));

    // 5xx é o que faz a anomalia aparecer como erro no painel do Vercel; o 200
    // é justamente a aparência de saúde que este guarda existe para desfazer.
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = await res.json();
    expect(body.ok).toBe(false);
    // As contagens do caminho normal continuam ali — o corpo é o mesmo esquema
    // de sempre, com um campo a mais.
    expect(body.read).toBe(0);
    expect(body.changed).toBe(0);
    expect(body.failedUnits).toEqual([]);
    // O campo tem de dizer o que houve para quem lê o log às 3h da manhã.
    expect(typeof body.anomaly).toBe("string");
    expect(body.anomaly).toContain("tse-divulga");
    expect(console.error).toHaveBeenCalled();
  });

  it("zero situações lidas COM falhas NÃO é anomalia: o aviso por unidade já cobre", async () => {
    // O VIZINHO. Aqui o silêncio tem explicação — as unidades não responderam,
    // cada uma sai nomeada no log e em `failedUnits`, e nada foi sobrescrito.
    // Chamar isto de anomalia de formato mandaria o operador caçar uma mudança
    // de esquema que não houve; a indisponibilidade quem denuncia com código de
    // saída é o sync completo (DIVULGA_OUTAGE_RATIO), não esta rota.
    process.env.CRON_SECRET = "segredo-do-cron";
    const unidades = ["BR", "SP", "RJ", "MG"];
    refresh.mockResolvedValue({
      read: 0,
      changed: [],
      unmapped: [],
      failedUnits: unidades.map(unit => ({ unit, error: "timeout" })),
    });

    const res = await run(req("Bearer segredo-do-cron"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      read: 0,
      changed: 0,
      unmapped: 0,
      failedUnits: unidades,
    });
  });
});
