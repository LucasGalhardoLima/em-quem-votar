import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DivulgaAsset, DivulgaDetail } from "~/lib/tse-divulga";
import {
  DIVULGA_SOURCE,
  applyDivulgaDetails,
  type DetailTarget,
} from "../tse-detail.server";

/**
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * `applyDivulgaDetails` é o único ponto do sistema que APAGA linhas: ele
 * regrava, em bloco, a declaração de bens de uma pessoa real a partir da
 * resposta de um serviço público de terceiro. O arquivo original documenta
 * "cinco recusas deliberadas" em prosa — e prosa não falha em CI. Cada recusa
 * está travada abaixo como asserção.
 *
 * A mais cara é a segunda: `bens: null` (a ficha respondeu SEM a chave) e
 * `bens: []` (declaração vazia legítima) têm de continuar tendo efeitos
 * OPOSTOS. Colapsar as duas — a simplificação que qualquer pessoa faria
 * olhando só os tipos — armaria o `deleteMany` contra o patrimônio declarado
 * de 211 candidaturas a partir de uma resposta incompleta do TSE.
 *
 * O Prisma entra por parâmetro (o serviço não importa `~/utils/db.server`),
 * então o dublê aqui é um objeto: nenhum teste encosta no banco.
 */

// ============================================================
// Dublê do Prisma: registra a ORDEM e os ARGUMENTOS de cada chamada
// ============================================================

interface Guardado {
  candidates?: Array<{
    id: string;
    tseApto: boolean | null;
    tseProcessNumber: string | null;
    /** Opcionais: a maioria dos testes não fala das contagens. */
    tseAssetsDeclared?: number | null;
    tsePriorElectionsDeclared?: number | null;
  }>;
  assets?: Array<{
    candidateId: string;
    amount: number;
    category: string | null;
    description: string | null;
    periodEnd: Date;
  }>;
  history?: Array<{
    id: string;
    candidateId: string;
    tsePriorId: string;
    year: number;
    office: string;
    ue: string | null;
    party: string | null;
    resultLabel: string;
    sourceUrl: string | null;
  }>;
}

/**
 * Os construtores de escrita devolvem um marcador SÍNCRONO (`{ op, args }`),
 * como as `PrismaPromise` que o `$transaction` recebe. É isso que permite
 * afirmar a ordem DENTRO da transação — que é onde a garantia
 * "apaga e recria no mesmo passo" realmente vive.
 */
function prismaFalso(guardado: Guardado = {}) {
  const log: Array<{ op: string; args: any }> = [];

  const finder = (op: string, rows: unknown[]) =>
    vi.fn((args: unknown) => {
      log.push({ op, args });
      return rows;
    });

  const writer = (op: string) =>
    vi.fn((args: unknown) => {
      log.push({ op, args });
      return { op, args };
    });

  const prisma = {
    candidate: {
      findMany: finder("candidate.findMany", guardado.candidates ?? []),
      update: writer("candidate.update"),
    },
    spendingRecord: {
      findMany: finder("spendingRecord.findMany", guardado.assets ?? []),
      deleteMany: writer("spendingRecord.deleteMany"),
      createMany: writer("spendingRecord.createMany"),
    },
    candidateElectionHistory: {
      findMany: finder("candidateElectionHistory.findMany", guardado.history ?? []),
      createMany: writer("candidateElectionHistory.createMany"),
      update: writer("candidateElectionHistory.update"),
      deleteMany: writer("candidateElectionHistory.deleteMany"),
    },
    $transaction: vi.fn((ops: Array<{ op: string }>) => {
      log.push({ op: "$transaction", args: ops.map(o => o.op) });
      return ops;
    }),
  };

  return {
    prisma: prisma as unknown as PrismaClient,
    espiao: prisma,
    log,
    /** Os nomes das operações, na ordem em que o serviço as montou. */
    ops: () => log.map(entry => entry.op),
    /** Argumentos de todas as chamadas de uma operação. */
    args: (op: string) => log.filter(entry => entry.op === op).map(entry => entry.args),
  };
}

// ============================================================
// Fixtures
// ============================================================

function alvo(over: Partial<DetailTarget> = {}): DetailTarget {
  return { id: "c1", tseId: "t1", sgUe: "BR", label: "FULANA DE TAL", ...over };
}

function ficha(over: Partial<DivulgaDetail> = {}): DivulgaDetail {
  return {
    tseId: "t1",
    situacao: null,
    candidatoApto: null,
    isCandidatoInapto: null,
    numeroProcesso: null,
    totalDeBens: null,
    atualizadoEm: null,
    bens: null,
    // Como `parseDivulgaDetail` devolve para uma ficha sem a chave: não
    // sabemos quantos bens ela declara. Quem testa contagem passa o número.
    bensDeclarados: null,
    eleicoesAnteriores: [],
    eleicoesAnterioresDeclaradas: null,
    processosCassacao: 0,
    processosDesconstituicao: 0,
    ...over,
  };
}

function bem(over: Partial<DivulgaAsset> = {}): DivulgaAsset {
  return {
    ordem: 1,
    descricao: "APARTAMENTO",
    tipo: "Apartamento",
    valor: 250000,
    atualizadoEm: "2026-08-15",
    ...over,
  };
}

function fichas(...pares: Array<[string, DivulgaDetail]>): Map<string, DivulgaDetail> {
  return new Map(pares);
}

const DIA = new Date("2026-08-15T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// RECUSA 1 — ficha que não respondeu não escreve NADA
// ============================================================

describe("recusa 1: ficha sem resposta não escreve nada", () => {
  it("nenhuma ficha respondeu: nem sequer uma consulta é feita", async () => {
    // A saída antecipada não é otimização: é o que garante que uma queda
    // total do TSE não chega perto de uma instrução de escrita.
    const { prisma, ops } = prismaFalso();
    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo(), alvo({ id: "c2", tseId: "t2" })],
      fichas(),
    );

    expect(ops()).toEqual([]);
    expect(resultado.skipped).toBe(2);
    expect(resultado.applied).toBe(0);
  });

  it("a candidatura sem ficha não aparece em NENHUMA escrita", async () => {
    // Nem aptidão, nem bens, nem histórico. "O TSE não respondeu" não pode
    // virar "esta pessoa não declarou bens" nem "candidatura inapta".
    const { prisma, args, espiao } = prismaFalso({
      candidates: [
        { id: "c1", tseApto: null, tseProcessNumber: null },
        { id: "c2", tseApto: true, tseProcessNumber: "0600999-11" },
      ],
      assets: [
        { candidateId: "c2", amount: 1000, category: "Casa", description: "CASA", periodEnd: DIA },
      ],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo(), alvo({ id: "c2", tseId: "t2", label: "QUEM NÃO RESPONDEU" })],
      fichas(["t1", ficha({ situacao: "Deferido", candidatoApto: true })]),
    );

    // Todas as consultas e escritas se restringem a c1.
    const tocados = JSON.stringify(args("candidate.findMany"))
      + JSON.stringify(args("spendingRecord.findMany"))
      + JSON.stringify(args("candidate.update"))
      + JSON.stringify(args("spendingRecord.deleteMany"));
    expect(tocados).toContain("c1");
    expect(tocados).not.toContain("c2");

    expect(espiao.spendingRecord.deleteMany).not.toHaveBeenCalled();
    expect(resultado.skipped).toBe(1);
    expect(resultado.applied).toBe(1);
  });

  it("a ficha que respondeu na mesma execução é gravada normalmente", async () => {
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo(), alvo({ id: "c2", tseId: "t2" })],
      fichas(["t1", ficha({ situacao: "Deferido", candidatoApto: true })]),
    );

    expect(args("candidate.update")).toEqual([{ where: { id: "c1" }, data: { tseApto: true } }]);
  });
});

// ============================================================
// RECUSA 2 — `bens` AUSENTE ≠ `bens` VAZIO  (a mais importante)
// ============================================================

describe("recusa 2: `bens: null` (ausente) e `bens: []` (vazio) têm efeitos OPOSTOS", () => {
  /**
   * NÃO APAGUE ESTE BLOCO, e não "simplifique" `bens` para sempre ser um
   * array. `null` significa que a ficha respondeu SEM a chave `bens`; `[]`
   * significa que a pessoa declarou zero bens — e em 27/08/2026, 38 das 211
   * fichas declaram `[]` de verdade, então não dá para distinguir depois.
   *
   * O que a distinção arma é o `deleteMany` abaixo. Tratar ausência como
   * declaração vazia apagaria o patrimônio declarado de uma pessoa real por
   * causa de uma resposta incompleta do TSE — e o run seguinte não teria como
   * restaurá-lo, porque a fonte é a mesma ficha incompleta.
   */

  it("na mesma execução: o ausente NÃO é apagado, o vazio É", async () => {
    const { prisma, args, espiao } = prismaFalso({
      candidates: [
        { id: "ausente", tseApto: null, tseProcessNumber: null },
        { id: "vazio", tseApto: null, tseProcessNumber: null },
      ],
      assets: [
        { candidateId: "ausente", amount: 500, category: "Casa", description: "CASA", periodEnd: DIA },
        { candidateId: "vazio", amount: 900, category: "Carro", description: "CARRO", periodEnd: DIA },
      ],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [
        alvo({ id: "ausente", tseId: "t-ausente", label: "FICHA INCOMPLETA" }),
        alvo({ id: "vazio", tseId: "t-vazio", label: "DECLAROU ZERO BENS" }),
      ],
      fichas(
        ["t-ausente", ficha({ bens: null })],
        ["t-vazio", ficha({ bens: [] })],
      ),
    );

    // Um único deleteMany, e ele alcança SÓ quem declarou lista vazia.
    expect(espiao.spendingRecord.deleteMany).toHaveBeenCalledTimes(1);
    expect(args("spendingRecord.deleteMany")[0].where.candidateId).toEqual({ in: ["vazio"] });
    expect(args("spendingRecord.deleteMany")[0].where.candidateId.in).not.toContain("ausente");

    // E os contadores contam a diferença, em vez de somar tudo num número só.
    expect(resultado.assetsAbsent).toBe(1);
    expect(resultado.assetsDeleted).toBe(1);
    expect(resultado.assetsCleared).toEqual([
      { tseId: "t-vazio", label: "DECLAROU ZERO BENS", removidos: 1 },
    ]);
  });

  it("`bens: null` com patrimônio guardado: nenhuma escrita, e o run diz 'ausente'", async () => {
    const { prisma, ops } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
      assets: [
        { candidateId: "c1", amount: 1, category: "A", description: "B", periodEnd: DIA },
        { candidateId: "c1", amount: 2, category: "C", description: "D", periodEnd: DIA },
      ],
    });

    const resultado = await applyDivulgaDetails(prisma, [alvo()], fichas(["t1", ficha({ bens: null })]));

    // Só as três leituras iniciais. Nenhuma escrita, nenhuma transação.
    expect(ops().filter(op => !op.endsWith("findMany"))).toEqual([]);
    expect(resultado.assetsAbsent).toBe(1);
    expect(resultado.assetsDeleted).toBe(0);
    expect(resultado.assetsCleared).toEqual([]);
  });

  it("`bens: []` legítimo zera o patrimônio e DENUNCIA a zeragem no relatório", async () => {
    // A operação mais destrutiva do sync. Ela é permitida — o TSE aceita
    // declaração sem bens —, mas não pode passar calada: sem `assetsCleared`
    // uma destruição sairia do relatório idêntica a um run sem novidade,
    // porque `assetsWritten` conta o que entra e aqui não entra nada.
    const { prisma, args, espiao } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
      assets: [
        { candidateId: "c1", amount: 1, category: "A", description: "B", periodEnd: DIA },
        { candidateId: "c1", amount: 2, category: "C", description: "D", periodEnd: DIA },
      ],
    });

    const resultado = await applyDivulgaDetails(prisma, [alvo()], fichas(["t1", ficha({ bens: [] })]));

    expect(espiao.spendingRecord.deleteMany).toHaveBeenCalledTimes(1);
    expect(espiao.spendingRecord.createMany).not.toHaveBeenCalled(); // não há o que criar
    expect(args("$transaction")[0]).toEqual(["spendingRecord.deleteMany"]);
    expect(resultado.assetsDeleted).toBe(2);
    expect(resultado.assetsWritten).toBe(0);
    expect(resultado.assetsCleared).toEqual([
      { tseId: "t1", label: "FULANA DE TAL", removidos: 2 },
    ]);
  });

  it("`bens: []` sem nada guardado não escreve nada — não há o que apagar", async () => {
    const { prisma, espiao, ops } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    const resultado = await applyDivulgaDetails(prisma, [alvo()], fichas(["t1", ficha({ bens: [] })]));

    expect(espiao.spendingRecord.deleteMany).not.toHaveBeenCalled();
    expect(ops().filter(op => !op.endsWith("findMany"))).toEqual([]);
    expect(resultado.assetsCleared).toEqual([]);
  });

  it("o deleteMany só alcança o que o próprio sync gravou", async () => {
    // `type` e `source` no filtro: um bem lançado à mão no /admin, ou vindo de
    // outra fonte, não é do sync — e uma regravação da ficha do TSE não pode
    // apagá-lo. A mesma restrição existe na leitura, senão toda execução veria
    // diferença na assinatura e regravaria por nada.
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
      assets: [{ candidateId: "c1", amount: 1, category: "A", description: "B", periodEnd: DIA }],
    });

    await applyDivulgaDetails(prisma, [alvo()], fichas(["t1", ficha({ bens: [] })]));

    expect(args("spendingRecord.deleteMany")[0].where).toEqual({
      candidateId: { in: ["c1"] },
      type: "DECLARED_ASSETS",
      source: DIVULGA_SOURCE,
    });
    expect(args("spendingRecord.findMany")[0].where).toMatchObject({
      type: "DECLARED_ASSETS",
      source: DIVULGA_SOURCE,
    });
  });
});

// ============================================================
// RECUSA 3 — `tseProcessNumber` só é gravado quando presente
// ============================================================

describe("recusa 3: `tseProcessNumber` só é gravado quando a ficha o traz", () => {
  it("ficha sem número: a chave está AUSENTE do update", async () => {
    // Ausência de um campo numa resposta não é ordem de apagar. A chave tem
    // de sumir do objeto — não vir como `undefined` por acidente.
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: "0600123-45" }],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas(["t1", ficha({ situacao: "Deferido", candidatoApto: true, numeroProcesso: null })]),
    );

    const data = args("candidate.update")[0].data;
    expect(Object.keys(data)).toEqual(["tseApto"]);
    expect(Object.keys(data)).not.toContain("tseProcessNumber");
    expect(resultado.processNumbers).toBe(0);
  });

  it("ficha com número: a chave é gravada com o valor literal", async () => {
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas(["t1", ficha({ numeroProcesso: "0600123-45.2026.6.00.0000" })]),
    );

    expect(args("candidate.update")[0].data).toEqual({
      tseApto: null,
      tseProcessNumber: "0600123-45.2026.6.00.0000",
    });
    expect(resultado.processNumbers).toBe(1);
  });

  it("ficha sem número não apaga o número já conferido: nenhum update é enviado", async () => {
    const { prisma, espiao } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: "0600123-45" }],
    });

    const resultado = await applyDivulgaDetails(prisma, [alvo()], fichas(["t1", ficha()]));

    expect(espiao.candidate.update).not.toHaveBeenCalled();
    expect(resultado.candidatesUpdated).toBe(0);
  });
});

// ============================================================
// CONTAGEM DO QUE A FICHA DECLARA — e por que não é um booleano
// ============================================================

describe("contagem do que a ficha declara", () => {
  /**
   * `tseAssetsDeclared` / `tsePriorElectionsDeclared` existem para que a
   * distinção AUSENTE ≠ VAZIO chegue à página: no banco, "a ficha não trouxe
   * a lista" e "a ficha trouxe a lista vazia" davam as duas o mesmo nada, e a
   * redação tinha de recuar para algo mais fraco do que a evidência sustenta.
   *
   * São CONTAGENS, não booleanos, e o teste que trava isso é o dos bens sem
   * data: um booleano diria "a lista veio" e a página voltaria a afirmar,
   * sobre uma pessoa real, que o TSE não lista bem algum.
   */

  it("`bens: []` grava contagem 0 — a afirmação de que o TSE não lista nada", async () => {
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas(["t1", ficha({ bens: [], bensDeclarados: 0 })]),
    );

    expect(args("candidate.update")[0].data.tseAssetsDeclared).toBe(0);
  });

  it("`bens` ausente deixa a chave FORA do update — ausência não sobrescreve", async () => {
    // Mesma regra do `tseProcessNumber` (recusa 3): gravar `null` aqui
    // apagaria uma contagem já conferida e devolveria a página ao estado em
    // que ela não pode afirmar nada sobre o conteúdo da ficha.
    const { prisma, args } = prismaFalso({
      candidates: [
        { id: "c1", tseApto: null, tseProcessNumber: null, tseAssetsDeclared: 4 },
      ],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo()],
      // `candidatoApto: true` só para forçar um update em que a chave da
      // contagem PODERIA aparecer — e não aparece.
      fichas(["t1", ficha({ candidatoApto: true, bens: null, bensDeclarados: null })]),
    );

    const data = args("candidate.update")[0].data;
    expect(Object.keys(data)).toEqual(["tseApto"]);
    expect(Object.keys(data)).not.toContain("tseAssetsDeclared");
  });

  it("ficha com 2 bens SEM DATA grava contagem 2 e zero linha — o motivo de não ser booleano", async () => {
    // ESTE é o caso que quebra o booleano. A ficha lista dois bens, os dois
    // sem data em nenhum dos dois níveis, então nenhuma linha de patrimônio é
    // gravada. Um sinal booleano ("a lista veio") faria a página cair na
    // redação forte e afirmar "o TSE não lista bem algum" sobre alguém cuja
    // ficha lista dois. Com a contagem, a página tem um terceiro caso: a
    // ficha lista 2, e nenhum pôde ser exibido.
    const { prisma, args, espiao } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({
          atualizadoEm: null,
          bens: [
            bem({ descricao: "CASA SEM DATA", atualizadoEm: null }),
            bem({ descricao: "CARRO SEM DATA", atualizadoEm: null }),
          ],
          bensDeclarados: 2,
        }),
      ]),
    );

    expect(espiao.spendingRecord.createMany).not.toHaveBeenCalled();
    expect(resultado.assetsWritten).toBe(0);
    expect(resultado.assetsSkippedNoDate).toHaveLength(2);
    expect(args("candidate.update")[0].data.tseAssetsDeclared).toBe(2);
  });

  it("execução em que SÓ a contagem mudou ainda produz update", async () => {
    // Sem `assetsCountDiffers`/`priorCountDiffers` na guarda, uma retificação
    // que só muda o número — mesma aptidão, mesmo processo, e nenhum bem
    // gravável — não escreveria nada, e a página seguiria exibindo a contagem
    // velha como se fosse a da ficha de hoje.
    const { prisma, args } = prismaFalso({
      candidates: [
        {
          id: "c1",
          tseApto: true,
          tseProcessNumber: "0600123-45",
          tseAssetsDeclared: 3,
          tsePriorElectionsDeclared: 1,
        },
      ],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({
          candidatoApto: true,
          numeroProcesso: "0600123-45",
          bens: [],
          bensDeclarados: 0,
          eleicoesAnteriores: [],
          eleicoesAnterioresDeclaradas: 1,
        }),
      ]),
    );

    expect(resultado.candidatesUpdated).toBe(1);
    expect(args("candidate.update")[0].data).toEqual({
      tseApto: true,
      tseProcessNumber: "0600123-45",
      tseAssetsDeclared: 0,
      tsePriorElectionsDeclared: 1,
    });
  });

  it("contagem idêntica não gera update — o que não mudou não é reescrito", async () => {
    const { prisma, espiao } = prismaFalso({
      candidates: [
        {
          id: "c1",
          tseApto: true,
          tseProcessNumber: "0600123-45",
          tseAssetsDeclared: 0,
          tsePriorElectionsDeclared: 2,
        },
      ],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({
          candidatoApto: true,
          numeroProcesso: "0600123-45",
          bens: [],
          bensDeclarados: 0,
          eleicoesAnterioresDeclaradas: 2,
        }),
      ]),
    );

    expect(espiao.candidate.update).not.toHaveBeenCalled();
    expect(resultado.candidatesUpdated).toBe(0);
  });

  it("`eleicoesAnteriores` só com a própria candidatura grava 0", async () => {
    // O desconto é do parser (`parseDivulgaDetail` remove a linha cujo id é o
    // da própria candidatura, e a contagem sai já sem ela). O que este teste
    // trava é o lado da ESCRITA: `0` chega ao banco como afirmação — "o TSE
    // não registra candidatura anterior" —, não como ausência.
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({ eleicoesAnteriores: [], eleicoesAnterioresDeclaradas: 0 }),
      ]),
    );

    expect(args("candidate.update")[0].data.tsePriorElectionsDeclared).toBe(0);
  });

  it("histórico ausente deixa a chave FORA do update", async () => {
    const { prisma, args } = prismaFalso({
      candidates: [
        {
          id: "c1",
          tseApto: null,
          tseProcessNumber: null,
          tsePriorElectionsDeclared: 7,
        },
      ],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({ candidatoApto: true, eleicoesAnterioresDeclaradas: null }),
      ]),
    );

    expect(Object.keys(args("candidate.update")[0].data)).toEqual(["tseApto"]);
  });

  it("as duas contagens são lidas do banco para poder comparar", async () => {
    // Sem as colunas no `select`, `stored.tseAssetsDeclared` seria sempre
    // `undefined` e TODA execução veria diferença: 211 updates por run, e o
    // relatório mentindo sobre o que mudou.
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    await applyDivulgaDetails(prisma, [alvo()], fichas(["t1", ficha()]));

    expect(args("candidate.findMany")[0].select).toMatchObject({
      tseAssetsDeclared: true,
      tsePriorElectionsDeclared: true,
    });
  });
});

// ============================================================
// ORDEM DE ESCRITA
// ============================================================

describe("ordem de escrita", () => {
  it("apaga e recria os bens na MESMA transação, o deleteMany primeiro", async () => {
    // Fora de uma transação, ou na ordem inversa, existiria um instante em que
    // a candidatura aparece sem os bens que declarou — ou com eles duplicados.
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
      assets: [{ candidateId: "c1", amount: 1, category: "A", description: "B", periodEnd: DIA }],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas(["t1", ficha({ bens: [bem({ descricao: "CASA NOVA", valor: 300000 })] })]),
    );

    expect(args("$transaction")[0]).toEqual([
      "spendingRecord.deleteMany",
      "spendingRecord.createMany",
    ]);
  });

  it("bens e histórico são gravados ANTES de `candidate.update`", async () => {
    // É no `candidate.update` que vão as CONTAGENS, e é delas que a página
    // tira o direito de afirmar "a ficha do TSE não lista bem algum".
    // Escrevendo-as por último, uma interrupção no meio da etapa deixa a
    // contagem ausente e a página cai na redação fraca — a leitura verdadeira.
    // Na ordem inversa ela afirmaria que o TSE não lista patrimônio algum
    // sobre alguém cujos bens não chegaram a ser gravados.
    const { prisma, ops } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({
          numeroProcesso: "0600123-45",
          bens: [bem()],
          eleicoesAnteriores: [
            {
              tsePriorId: "p1",
              year: 2018,
              office: "Deputado Federal",
              ue: "SP",
              party: "PARTIDO",
              resultLabel: "Eleito por QP",
              sourceUrl: null,
            },
          ],
        }),
      ]),
    );

    const ordem = ops();
    const bens = ordem.indexOf("spendingRecord.createMany");
    const historico = ordem.indexOf("candidateElectionHistory.createMany");
    const candidato = ordem.indexOf("candidate.update");
    expect(bens).toBeGreaterThan(-1);
    expect(historico).toBeGreaterThan(-1);
    expect(candidato).toBeGreaterThan(-1);
    expect(bens).toBeLessThan(candidato);
    expect(historico).toBeLessThan(candidato);
  });
});

// ============================================================
// RECUSA 5 — o que não mudou não é reescrito
// ============================================================

describe("recusa 5: o que não mudou não é reescrito", () => {
  it("bens idênticos em ordem diferente não contam como mudança", async () => {
    // Além de barato, é o que preserva o `createdAt` das linhas — a data em
    // que a plataforma passou a afirmar aquilo. A ordem em que o TSE devolve
    // não é informação.
    const { prisma, espiao } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
      assets: [
        { candidateId: "c1", amount: 250000, category: "Apartamento", description: "APARTAMENTO", periodEnd: DIA },
        { candidateId: "c1", amount: 90000, category: "Automóvel", description: "CARRO", periodEnd: DIA },
      ],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({
          bens: [
            bem({ descricao: "CARRO", tipo: "Automóvel", valor: 90000 }),
            bem({ descricao: "APARTAMENTO", tipo: "Apartamento", valor: 250000 }),
          ],
        }),
      ]),
    );

    expect(espiao.spendingRecord.deleteMany).not.toHaveBeenCalled();
    expect(espiao.spendingRecord.createMany).not.toHaveBeenCalled();
    expect(resultado.assetsRead).toBe(2);
    expect(resultado.assetsWritten).toBe(0);
  });

  it("histórico idêntico não gera update; o novo é criado com skipDuplicates", async () => {
    // O histórico é create/update por `(candidateId, tsePriorId)` — nunca
    // destrutivo. `skipDuplicates` porque o lote é montado a partir de uma
    // leitura anterior: duas execuções concorrentes fariam a segunda abortar
    // o lote inteiro num P2002.
    const { prisma, args, espiao } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
      history: [
        {
          id: "h1",
          candidateId: "c1",
          tsePriorId: "igual",
          year: 2018,
          office: "Senador",
          ue: "SP",
          party: "PARTIDO",
          resultLabel: "Eleito",
          sourceUrl: null,
        },
      ],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({
          eleicoesAnteriores: [
            { tsePriorId: "igual", year: 2018, office: "Senador", ue: "SP", party: "PARTIDO", resultLabel: "Eleito", sourceUrl: null },
            { tsePriorId: "nova", year: 2014, office: "Vice-prefeito", ue: "71072", party: null, resultLabel: "Não eleito", sourceUrl: null },
          ],
        }),
      ]),
    );

    expect(espiao.candidateElectionHistory.update).not.toHaveBeenCalled();
    expect(espiao.candidateElectionHistory.deleteMany).not.toHaveBeenCalled();
    expect(args("candidateElectionHistory.createMany")[0]).toEqual({
      data: [
        {
          candidateId: "c1",
          tsePriorId: "nova",
          year: 2014,
          office: "Vice-prefeito",
          ue: "71072",
          party: null,
          resultLabel: "Não eleito",
          sourceUrl: null,
        },
      ],
      skipDuplicates: true,
    });
    expect(resultado.historyCreated).toBe(1);
    expect(resultado.historyUpdated).toBe(0);
  });
});

// ============================================================
// RECUSA 4 — nada é parafraseado, nada é inventado
// ============================================================

describe("recusa 4: nada é parafraseado, e nenhuma data é inventada", () => {
  it("a descrição do bem vai literal para o banco, com a fonte e a ficha", async () => {
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo({ sgUe: "SP" })],
      fichas([
        "t1",
        ficha({
          bens: [bem({ descricao: "50% DO APARTAMENTO EM SÃO BERNARDO DO CAMPO", valor: 250000.5 })],
        }),
      ]),
    );

    expect(args("spendingRecord.createMany")[0].data).toEqual([
      {
        candidateId: "c1",
        type: "DECLARED_ASSETS",
        amount: 250000.5,
        periodStart: DIA,
        periodEnd: DIA,
        category: "Apartamento",
        description: "50% DO APARTAMENTO EM SÃO BERNARDO DO CAMPO",
        source: DIVULGA_SOURCE,
        sourceUrl: expect.stringContaining("/SUDESTE/SP/"),
      },
    ]);
  });

  it("bem sem data em nenhum dos dois níveis não é gravado com data inventada", async () => {
    // `periodStart`/`periodEnd` são obrigatórios. Carimbar "hoje" inventaria
    // quando o patrimônio foi declarado — o bem sai do lote e vai para o
    // relatório, para conferência humana.
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({
          atualizadoEm: null,
          bens: [
            bem({ descricao: "SEM DATA", atualizadoEm: null }),
            bem({ descricao: "COM DATA", atualizadoEm: "2026-08-15" }),
          ],
        }),
      ]),
    );

    expect(args("spendingRecord.createMany")[0].data).toHaveLength(1);
    expect(args("spendingRecord.createMany")[0].data[0].description).toBe("COM DATA");
    expect(resultado.assetsSkippedNoDate).toEqual([
      { tseId: "t1", label: "FULANA DE TAL", descricao: "SEM DATA" },
    ]);
  });

  it("`candidatoApto: false` com `isCandidatoInapto: false` grava null, não false", async () => {
    // A armadilha documentada em `aptoFromDivulga`: em 27/08/2026, 11 das 13
    // presidenciais devolvem `false` nos DOIS campos por estarem aguardando
    // julgamento. Gravar `false` marcaria 11 pessoas reais como inaptas sem
    // que nenhuma decisão existisse. Este teste vigia o lado da ESCRITA.
    const { prisma, args } = prismaFalso({
      candidates: [{ id: "c1", tseApto: true, tseProcessNumber: null }],
    });

    await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas([
        "t1",
        ficha({
          situacao: "Aguardando julgamento",
          candidatoApto: false,
          isCandidatoInapto: false,
        }),
      ]),
    );

    const data = args("candidate.update")[0].data;
    expect(data.tseApto).toBeNull();
    expect(data.tseApto).not.toBe(false);
  });

  it("processos de cassação vão para o relatório em vez de sumirem em silêncio", async () => {
    // Não há modelo para isso no schema (nenhuma das 211 fichas tinha um em
    // 27/08/2026). A contagem existe para que a PRIMEIRA ocorrência real seja
    // vista por uma pessoa.
    const { prisma } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas(["t1", ficha({ processosCassacao: 2, processosDesconstituicao: 1 })]),
    );

    expect(resultado.withProceedings).toEqual([
      { tseId: "t1", label: "FULANA DE TAL", cassacao: 2, desconstituicao: 1 },
    ]);
  });
});

// ============================================================
// dry-run
// ============================================================

describe("dry-run", () => {
  it("conta tudo o que faria e não executa nenhuma escrita", async () => {
    // `npm run sync:tse -- --dry-run` promete mostrar o diff sem escrever
    // nada. Se a promessa falhar, ela falha no run em que alguém queria
    // justamente CONFERIR antes de deixar o sync mexer no banco.
    const { prisma, ops } = prismaFalso({
      candidates: [{ id: "c1", tseApto: null, tseProcessNumber: null }],
      assets: [{ candidateId: "c1", amount: 1, category: "A", description: "B", periodEnd: DIA }],
    });

    const resultado = await applyDivulgaDetails(
      prisma,
      [alvo()],
      fichas(["t1", ficha({ numeroProcesso: "0600123-45", bens: [bem()] })]),
      { dryRun: true },
    );

    expect(ops().filter(op => !op.endsWith("findMany"))).toEqual([]);
    expect(resultado.assetsWritten).toBe(1);
    expect(resultado.assetsDeleted).toBe(1);
    expect(resultado.candidatesUpdated).toBe(1);
  });
});
