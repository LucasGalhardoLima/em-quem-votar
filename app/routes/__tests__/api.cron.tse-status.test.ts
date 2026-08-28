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

/** Resultado vazio: o suficiente para o caminho feliz não explodir. */
function emptyResult() {
  return { read: 0, changed: [], unmapped: [], failedUnits: [] };
}

function req(authorization?: string): Request {
  return new Request("https://exemplo.test/api/cron/tse-status", {
    headers: authorization ? { Authorization: authorization } : undefined,
  });
}

function run(request: Request) {
  return loader({ request } as Parameters<typeof loader>[0]);
}

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.CRON_SECRET;
  refresh.mockReset();
  refresh.mockResolvedValue(emptyResult());
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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
