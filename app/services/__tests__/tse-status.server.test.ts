import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * `app/lib/tse-divulga.ts` é o lado que LÊ o TSE, e já tem teste. Este é o
 * lado que ESCREVE no banco — o único ponto do sistema onde uma resposta ruim
 * do TSE pode virar uma afirmação publicada sobre uma pessoa real.
 *
 * A regra que o CLAUDE.md registra em letras maiúsculas, e que estes testes
 * travam, é:
 *
 *   "Never let an API failure rewrite a situation. When a unit does not
 *    answer, the sync omits `tseStatusLabel`/`tseStatusDetail`/
 *    `registrationStatus` from the update and warns once per unit — the
 *    stored value survives."
 *
 * A garantia não vive no valor de retorno: vive em QUAIS CHAVES o objeto
 * entregue ao `prisma.candidate.update()` contém. Por isso quase todo teste
 * daqui espia `db.candidate.update.mock.calls` em vez do resultado da função.
 *
 * Nenhum teste encosta no banco: `~/utils/db.server` é substituído inteiro.
 */

// ============================================================
// Dublês: o cliente Prisma e a leitura do TSE
// ============================================================

/**
 * `vi.hoisted` porque a fábrica do `vi.mock` sobe para o topo do arquivo e não
 * enxergaria um `const` declarado depois dela.
 *
 * Os métodos destrutivos (`create`, `delete`, `deleteMany`, `updateMany`)
 * estão aqui de propósito, mesmo sem uso: o contrato do cron é "re-lê apenas
 * a situação — nunca cria, apaga nem toca em outro campo", e sem eles no dublê
 * uma chamada nova passaria despercebida (ou explodiria por outro motivo,
 * confundindo o diagnóstico).
 */
const { db, fetchDivulgaStatuses } = vi.hoisted(() => ({
  db: {
    candidate: {
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  fetchDivulgaStatuses: vi.fn(),
}));

vi.mock("~/utils/db.server", () => ({ db }));
vi.mock("~/lib/tse-divulga", async importOriginal => ({
  ...(await importOriginal<typeof import("~/lib/tse-divulga")>()),
  fetchDivulgaStatuses,
}));

import { refreshCandidateStatuses } from "../tse-status.server";

// ============================================================
// Utilidades
// ============================================================

type Guardada = { tseId: string; tseStatusLabel: string | null };

/** O que o banco já tem gravado sobre as candidaturas. */
function guardadas(...rows: Guardada[]) {
  db.candidate.findMany.mockResolvedValue(rows);
}

/** O que o TSE devolveu nesta execução. */
function tseRespondeu(
  byTseId: Record<string, string>,
  failedUnits: Array<{ unit: string; error: string }> = [],
) {
  fetchDivulgaStatuses.mockResolvedValue({
    byTseId: new Map(Object.entries(byTseId)),
    failedUnits,
  });
}

/** Os updates enviados ao Prisma, achatados em `{ tseId, data }`. */
function updates(): Array<{ tseId: string; data: Record<string, unknown> }> {
  return db.candidate.update.mock.calls.map(([arg]) => ({
    tseId: (arg as { where: { tseId: string } }).where.tseId,
    data: (arg as { data: Record<string, unknown> }).data,
  }));
}

/**
 * A união das chaves gravadas para uma candidatura nesta execução. Vazia
 * quando nenhum update a mencionou — que é o caso quando o TSE não respondeu.
 */
function chavesGravadas(tseId: string): string[] {
  const keys = new Set<string>();
  for (const u of updates()) {
    if (u.tseId === tseId) Object.keys(u.data).forEach(k => keys.add(k));
  }
  return [...keys].sort();
}

/** As três chaves que uma falha do TSE jamais pode reescrever. */
const CHAVES_DE_SITUACAO = ["tseStatusLabel", "tseStatusDetail", "registrationStatus"];

beforeEach(() => {
  vi.clearAllMocks();
  db.candidate.findMany.mockResolvedValue([]);
  db.$transaction.mockResolvedValue([]);
  tseRespondeu({});
});

afterEach(() => {
  // Fora do `try` de cada teste: um teste que falhe no meio não pode deixar o
  // `fetch` dublado nem o relógio congelado para os seguintes.
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ============================================================
// 1. A GARANTIA — falha de API nunca reescreve uma situação
// ============================================================

describe("refreshCandidateStatuses — falha do TSE NUNCA reescreve a situação", () => {
  /**
   * NÃO APAGUE ESTE BLOCO, e não o troque por um teste de valor de retorno.
   * Ele é a única coisa que acusa se alguém "simplificar" este serviço e
   * passar a mandar um fallback quando a unidade eleitoral não responde.
   *
   * O que está em jogo: 140 candidaturas ainda "Aguardando julgamento" e as
   * demais já julgadas. Gravar `PENDING_JUDGMENT` numa queda do TSE faria a
   * plataforma afirmar que uma pessoa cujo registro a Justiça Eleitoral já
   * deferiu (ou indeferiu, ou que renunciou) segue sob julgamento — uma
   * afirmação falsa sobre uma pessoa real, publicada em ano eleitoral.
   */

  it("TSE inteiro fora do ar: nenhum update é enviado, o valor guardado sobrevive", async () => {
    guardadas(
      { tseId: "280000605409", tseStatusLabel: "Deferido" },
      { tseId: "280000612345", tseStatusLabel: "Renúncia" },
    );
    tseRespondeu({}, [
      { unit: "BR", error: "HTTP 503" },
      { unit: "SP", error: "socket hang up" },
    ]);

    const resultado = await refreshCandidateStatuses();

    // Nenhuma escrita. Nem update, nem transação.
    expect(db.candidate.update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();

    // E, dito na forma exata do contrato: as três chaves de situação não
    // foram gravadas para ninguém.
    for (const tseId of ["280000605409", "280000612345"]) {
      expect(chavesGravadas(tseId)).toEqual([]);
    }

    expect(resultado.changed).toEqual([]);
    expect(resultado.read).toBe(0);
    // A falha é DENUNCIADA — é ela que vira o aviso, uma vez por unidade.
    expect(resultado.failedUnits).toEqual([
      { unit: "BR", error: "HTTP 503" },
      { unit: "SP", error: "socket hang up" },
    ]);
  });

  it("queda parcial: quem respondeu é gravado, quem não respondeu não é tocado", async () => {
    // O cenário realista — o TSE raramente cai inteiro. A candidatura da
    // unidade que caiu não pode aparecer em NENHUM update, com nenhuma das
    // três chaves.
    guardadas(
      { tseId: "presidencial", tseStatusLabel: "Aguardando julgamento" },
      { tseId: "governador-sp", tseStatusLabel: "Deferido" },
    );
    tseRespondeu({ presidencial: "Deferido" }, [{ unit: "SP", error: "HTTP 500" }]);

    await refreshCandidateStatuses();

    expect(updates().map(u => u.tseId)).toEqual(["presidencial"]);
    expect(chavesGravadas("governador-sp")).toEqual([]);
    for (const chave of CHAVES_DE_SITUACAO) {
      expect(chavesGravadas("governador-sp")).not.toContain(chave);
    }
  });

  it("jamais fabrica 'Aguardando julgamento' / PENDING_JUDGMENT numa queda", async () => {
    // O fallback exato que o CLAUDE.md proíbe. Se essa redação ou esse enum
    // aparecerem num update com o TSE fora do ar, eles foram inventados aqui.
    guardadas({ tseId: "1", tseStatusLabel: "Deferido" });
    tseRespondeu({}, [{ unit: "BR", error: "ECONNREFUSED" }]);

    await refreshCandidateStatuses();

    const gravados = updates().map(u => u.data);
    expect(gravados).toEqual([]);
    expect(JSON.stringify(gravados)).not.toContain("PENDING_JUDGMENT");
    expect(JSON.stringify(gravados)).not.toContain("Aguardando julgamento");
  });

  it("candidatura fora do recorte do TSE não é rebaixada por ausência", async () => {
    // Sem `failedUnits`: a unidade respondeu, mas não trouxe esta
    // candidatura. Ausência numa resposta boa também não é informação —
    // continua sem nada a gravar.
    guardadas({ tseId: "sumiu-da-lista", tseStatusLabel: "Deferido" });
    tseRespondeu({ outra: "Deferido" });

    await refreshCandidateStatuses();

    expect(chavesGravadas("sumiu-da-lista")).toEqual([]);
  });

  it("situação vazia vinda da API não apaga a que está gravada", async () => {
    // `tseStatusWrite()` classifica isso como `absent`. Gravar `""` deixaria o
    // badge sem a palavra da Justiça Eleitoral.
    guardadas({ tseId: "1", tseStatusLabel: "Deferido" });
    tseRespondeu({ "1": "   " });

    await refreshCandidateStatuses();

    expect(db.candidate.update).not.toHaveBeenCalled();
  });

  it("ponta a ponta com o módulo real: rede caída não produz update nenhum", async () => {
    // Os testes acima dublam `fetchDivulgaStatuses`. Este usa o módulo de
    // verdade com o `fetch` derrubado, e é o único que prova que as duas
    // metades compõem: a leitura sai de mãos vazias E a escrita respeita isso.
    const real = await vi.importActual<typeof import("~/lib/tse-divulga")>(
      "~/lib/tse-divulga",
    );
    fetchDivulgaStatuses.mockImplementation(real.fetchDivulgaStatuses);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ENETDOWN"))),
    );
    guardadas({ tseId: "1", tseStatusLabel: "Deferido" });

    // Relógio falso: o módulo real faz 2s + 4s de backoff por unidade.
    vi.useFakeTimers();
    const promessa = refreshCandidateStatuses();
    const drenagem = vi.runAllTimersAsync();
    const resultado = await promessa;
    await drenagem;
    vi.useRealTimers();
    vi.unstubAllGlobals();

    expect(db.candidate.update).not.toHaveBeenCalled();
    expect(resultado.read).toBe(0);
    expect(resultado.failedUnits).toHaveLength(28); // BR + 27 UFs
  });
});

// ============================================================
// 2. Caminho feliz — situação nova é gravada
// ============================================================

describe("refreshCandidateStatuses — caminho feliz", () => {
  it("situação nova grava a redação literal do TSE e o enum correspondente", async () => {
    guardadas({ tseId: "280000605409", tseStatusLabel: "Aguardando julgamento" });
    tseRespondeu({ "280000605409": "Deferido" });

    const resultado = await refreshCandidateStatuses();

    expect(db.candidate.update).toHaveBeenCalledTimes(1);
    const [arg] = db.candidate.update.mock.calls[0];
    expect((arg as { where: unknown }).where).toEqual({ tseId: "280000605409" });
    expect((arg as { data: Record<string, unknown> }).data).toMatchObject({
      tseStatusLabel: "Deferido",
      registrationStatus: "APPROVED",
    });
    expect((arg as { data: { lastSyncedAt: unknown } }).data.lastSyncedAt).toBeInstanceOf(
      Date,
    );

    expect(resultado.read).toBe(1);
    expect(resultado.changed).toEqual([
      { tseId: "280000605409", from: "Aguardando julgamento", to: "Deferido" },
    ]);
    expect(resultado.unmapped).toEqual([]);
  });

  it("grava a redação como o TSE a escreveu, sem parafrasear", async () => {
    // O badge exibe `tseStatusLabel`. Traduzir "Indeferido em prazo recursal
    // ou com recurso" para "Indeferido" mudaria o que a plataforma afirma
    // sobre o desfecho de um registro que ainda comporta recurso.
    guardadas({ tseId: "1", tseStatusLabel: "Deferido" });
    tseRespondeu({ "1": "Indeferido em prazo recursal ou com recurso" });

    await refreshCandidateStatuses();

    expect(updates()[0].data).toMatchObject({
      tseStatusLabel: "Indeferido em prazo recursal ou com recurso",
      registrationStatus: "SUB_JUDICE",
    });
  });

  it("não toca em nenhum campo além da situação — é o contrato do cron", async () => {
    // "re-lê apenas a situação — nunca cria, apaga nem toca em outro campo."
    // Um campo a mais aqui faria o cron das 12:00 sobrescrever dado editado
    // no /admin.
    guardadas({ tseId: "1", tseStatusLabel: null });
    tseRespondeu({ "1": "Deferido" });

    await refreshCandidateStatuses();

    expect(Object.keys(updates()[0].data).sort()).toEqual([
      "lastSyncedAt",
      "registrationStatus",
      "tseStatusLabel",
    ]);
    expect(db.candidate.create).not.toHaveBeenCalled();
    expect(db.candidate.delete).not.toHaveBeenCalled();
    expect(db.candidate.deleteMany).not.toHaveBeenCalled();
    expect(db.candidate.updateMany).not.toHaveBeenCalled();
  });

  it("lê apenas candidaturas com tseId — quem não tem não é comparável", async () => {
    await refreshCandidateStatuses();
    expect(db.candidate.findMany).toHaveBeenCalledWith({
      where: { tseId: { not: null } },
      select: { tseId: true, tseStatusLabel: true },
    });
  });

  it("agrupa os updates em transações de no máximo 500", async () => {
    // O banco é remoto e o que custa é o NÚMERO de idas e voltas. 600
    // mudanças têm de virar 2 transações, não 600.
    const muitas = Array.from({ length: 600 }, (_, i) => ({
      tseId: `c${i}`,
      tseStatusLabel: "Aguardando julgamento",
    }));
    guardadas(...muitas);
    tseRespondeu(Object.fromEntries(muitas.map(c => [c.tseId, "Deferido"])));

    await refreshCandidateStatuses();

    expect(db.candidate.update).toHaveBeenCalledTimes(600);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(db.$transaction.mock.calls[0][0]).toHaveLength(500);
    expect(db.$transaction.mock.calls[1][0]).toHaveLength(100);
  });
});

// ============================================================
// 3. Situação idêntica — não é mudança
// ============================================================

describe("refreshCandidateStatuses — situação idêntica", () => {
  it("redação igual à guardada não gera update nem entra em `changed`", async () => {
    // Reescrever o que não mudou custaria uma transação por execução e ainda
    // mexeria em `lastSyncedAt` sem novidade nenhuma.
    guardadas({ tseId: "1", tseStatusLabel: "Deferido" });
    tseRespondeu({ "1": "Deferido" });

    const resultado = await refreshCandidateStatuses();

    expect(db.candidate.update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(resultado.changed).toEqual([]);
    expect(resultado.read).toBe(1); // lida, mas não mudada
  });

  it("nada a gravar não abre transação alguma", async () => {
    guardadas({ tseId: "1", tseStatusLabel: "Deferido" }, { tseId: "2", tseStatusLabel: "Renúncia" });
    tseRespondeu({ "1": "Deferido", "2": "Renúncia" });

    await refreshCandidateStatuses();

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("uma única letra diferente já é mudança — a comparação é literal", async () => {
    guardadas({ tseId: "1", tseStatusLabel: "Deferido" });
    tseRespondeu({ "1": "Deferido com recurso" });

    const resultado = await refreshCandidateStatuses();

    expect(resultado.changed).toEqual([
      { tseId: "1", from: "Deferido", to: "Deferido com recurso" },
    ]);
    expect(updates()[0].data).toMatchObject({ registrationStatus: "SUB_JUDICE" });
  });
});

// ============================================================
// 4. Redação desconhecida — não vira enum inventado
// ============================================================

describe("refreshCandidateStatuses — redação que o TSE inventou", () => {
  /**
   * NÃO APAGUE. Uma redação nova do TSE é o caso caro: gravar um enum de
   * palpite faz a candidatura afirmar uma situação jurídica que ninguém
   * proferiu — e o palpite fica PRESO, porque na execução seguinte o rótulo é
   * igual e o serviço pula. Ver `tseStatusWrite()` em
   * `~/lib/candidate-status`.
   */

  it("grava a redação, mas NÃO grava `registrationStatus`", async () => {
    guardadas({ tseId: "1", tseStatusLabel: "Deferido" });
    tseRespondeu({ "1": "Suspenso por decisão liminar" });

    const resultado = await refreshCandidateStatuses();

    const data = updates()[0].data;
    expect(data).toHaveProperty("tseStatusLabel", "Suspenso por decisão liminar");
    // A chave tem de estar AUSENTE, não `undefined`: o Prisma ignora
    // `undefined`, mas quem lê este teste precisa ver a ausência.
    expect(Object.keys(data)).not.toContain("registrationStatus");
    expect(Object.keys(data).sort()).toEqual(["lastSyncedAt", "tseStatusLabel"]);

    // E o enum guardado sobrevive, porque simplesmente não foi escrito.
    expect(resultado.unmapped).toEqual([
      { tseId: "1", label: "Suspenso por decisão liminar" },
    ]);
  });

  it("o aviso volta em TODA execução, mesmo com a redação já gravada", async () => {
    // Reportar só quando o rótulo muda faria a anomalia aparecer uma vez e
    // sumir — com o enum errado congelado no banco e ninguém mais avisado.
    guardadas({ tseId: "1", tseStatusLabel: "Suspenso por decisão liminar" });
    tseRespondeu({ "1": "Suspenso por decisão liminar" });

    const resultado = await refreshCandidateStatuses();

    expect(db.candidate.update).not.toHaveBeenCalled(); // nada mudou
    expect(resultado.unmapped).toEqual([
      { tseId: "1", label: "Suspenso por decisão liminar" },
    ]); // mas o aviso continua saindo
    expect(resultado.changed).toEqual([]);
  });

  it("uma redação desconhecida não contamina as conhecidas na mesma execução", async () => {
    guardadas(
      { tseId: "conhecida", tseStatusLabel: null },
      { tseId: "estranha", tseStatusLabel: null },
    );
    tseRespondeu({ conhecida: "Renúncia", estranha: "Aguardando parecer do MP" });

    const resultado = await refreshCandidateStatuses();

    const porId = Object.fromEntries(updates().map(u => [u.tseId, u.data]));
    expect(porId["conhecida"]).toMatchObject({ registrationStatus: "WITHDRAWN" });
    expect(Object.keys(porId["estranha"])).not.toContain("registrationStatus");
    expect(resultado.unmapped.map(u => u.tseId)).toEqual(["estranha"]);
  });
});
