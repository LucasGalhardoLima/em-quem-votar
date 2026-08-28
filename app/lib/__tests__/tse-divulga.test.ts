import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CARGO_GOVERNADOR,
  CARGO_PRESIDENTE,
  DIVULGA_ELECTION_CODE,
  ELECTION_YEAR,
  UE_REGION,
  divulgaDetailUrl,
  divulgaUrl,
  fetchDivulgaDetail,
  fetchDivulgaDetails,
  fetchDivulgaStatuses,
  parseDivulgaDetail,
} from "../tse-divulga";

/**
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * Este módulo é a única fonte da **situação da candidatura** — o pacote de
 * dados abertos do TSE não a publica em 2026. O que ele devolve vira texto
 * exibido sobre pessoas reais durante uma eleição.
 *
 * A propriedade que estes testes travam, e que o CLAUDE.md registra como
 * inegociável, é: **uma falha de API nunca pode virar uma situação**. Se uma
 * unidade eleitoral não responde, o módulo tem de sair de mãos vazias e
 * denunciar a falha — nunca devolver um valor de conveniência. Devolver
 * "Aguardando julgamento" por causa de um 500 do TSE faria o site afirmar
 * algo falso sobre alguém que a Justiça Eleitoral já julgou.
 *
 * Nenhuma chamada de rede real acontece aqui: `fetch` é sempre substituído.
 * Bater no `divulgacandcontas.tse.jus.br` de dentro da suíte seria lento,
 * instável e mal-educado com um serviço público de terceiro.
 */

// ============================================================
// Utilidades de teste
// ============================================================

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;

/** Substitui o `fetch` global e devolve o espião, para contar chamadas. */
function stubFetch(handler: FetchHandler) {
  const spy = vi.fn((input: unknown, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A unidade eleitoral e o cargo pedidos, extraídos da URL de listagem. */
function unidadeDaUrl(url: string): { ue: string; cargo: string } | null {
  const match = url.match(/\/listar\/(\d{4})\/([A-Z]{2})\/(\d+)\/(\d+)\/candidatos$/);
  return match ? { ue: match[2], cargo: match[4] } : null;
}

/**
 * Executa algo que passa pelo backoff do módulo (2s + 4s por unidade que
 * falha) com o relógio falso, para o teste não gastar minutos de espera real.
 * `runAllTimersAsync` drena os timers conforme eles vão sendo criados.
 */
async function comRelogioFalso<T>(fn: () => Promise<T>): Promise<T> {
  vi.useFakeTimers();
  const promessa = fn();
  const drenagem = vi.runAllTimersAsync();
  try {
    return await promessa;
  } finally {
    await drenagem;
    vi.useRealTimers();
  }
}

/** As 28 unidades que o módulo consulta, na ordem em que ele as monta. */
const UNIDADES_ESPERADAS = [
  ["BR", CARGO_PRESIDENTE],
  ...Object.keys(UE_REGION)
    .filter((ue) => ue !== "BR")
    .map((uf) => [uf, CARGO_GOVERNADOR]),
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ============================================================
// 1. A GARANTIA — falha de API nunca vira situação
// ============================================================

describe("fetchDivulgaStatuses — falha de API NUNCA vira situação", () => {
  /**
   * NÃO APAGUE ESTE BLOCO. Ele não é cerimônia de cobertura: é a única coisa
   * que acusa se alguém "simplificar" o tratamento de erro e passar a devolver
   * um valor padrão quando o TSE não responde.
   *
   * O contrato é: unidade que falha NÃO contribui com nenhuma entrada em
   * `byTseId` e SAI nomeada em `failedUnits`. Quem escreve no banco lê
   * `failedUnits` para omitir `tseStatusLabel`/`tseStatusDetail`/
   * `registrationStatus` daquelas candidaturas — e o valor já gravado
   * sobrevive à queda.
   *
   * Se este arquivo passar a aceitar um fallback aqui, o site voltará a dizer
   * "aguardando julgamento" sobre pessoas cujo registro a Justiça Eleitoral já
   * deferiu, indeferiu, ou de quem já renunciou. É uma afirmação falsa sobre
   * uma pessoa real, publicada em ano eleitoral.
   */

  const modosDeFalha: Array<[string, FetchHandler]> = [
    ["erro de rede", () => Promise.reject(new TypeError("fetch failed"))],
    ["HTTP 500", () => new Response("erro interno", { status: 500 })],
    ["HTTP 404", () => new Response("não encontrado", { status: 404 })],
    ["HTTP 403 (bloqueio do Akamai)", () => new Response("forbidden", { status: 403 })],
    ["JSON malformado", () => new Response("<html>manutenção</html>", { status: 200 })],
    ["corpo vazio com HTTP 200", () => new Response("", { status: 200 })],
    [
      "timeout (o AbortController do próprio módulo)",
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          );
        }),
    ],
  ];

  it.each(modosDeFalha)(
    "%s: nenhuma situação inventada, e a unidade sai em failedUnits",
    async (_nome, handler) => {
      stubFetch(handler);

      const resultado = await comRelogioFalso(() => fetchDivulgaStatuses());

      // Zero situações. Nem uma, nem um fallback, nem um placeholder.
      expect(resultado.byTseId.size).toBe(0);
      expect([...resultado.byTseId.values()]).toEqual([]);
      // As 28 unidades reportadas como falha — é isso que faz o chamador
      // omitir os campos em vez de sobrescrevê-los.
      expect(resultado.failedUnits).toHaveLength(UNIDADES_ESPERADAS.length);
      expect(resultado.failedUnits.every((f) => f.error.length > 0)).toBe(true);
    },
  );

  it("não devolve nenhum canal alternativo por onde um fallback pudesse entrar", async () => {
    // Trava a forma do retorno: só `byTseId` e `failedUnits`. Se alguém
    // acrescentar um `default`/`assumed`/`fallback`, este teste quebra e
    // obriga a decisão a ser consciente.
    stubFetch(() => new Response("", { status: 200 }));
    const resultado = await fetchDivulgaStatuses();
    expect(Object.keys(resultado).sort()).toEqual(["byTseId", "failedUnits"]);
  });

  it("em particular, jamais fabrica 'Aguardando julgamento'", async () => {
    // O fallback exato que o CLAUDE.md proíbe: `PENDING_JUDGMENT` sai de
    // `statusFromTseLabel("Aguardando julgamento")`. Se essa redação aparecer
    // aqui com o TSE fora do ar, ela foi inventada por nós.
    stubFetch(() => Promise.reject(new Error("ECONNREFUSED")));
    const { byTseId } = await comRelogioFalso(() => fetchDivulgaStatuses());
    expect([...byTseId.values()]).not.toContain("Aguardando julgamento");
    expect(byTseId.size).toBe(0);
  });

  it("caso misto: o que respondeu continua valendo, o que caiu não apaga nada", async () => {
    // A queda parcial é o cenário realista — o TSE raramente cai inteiro.
    // BR responde; as 27 UFs caem. As situações presidenciais têm de
    // sobreviver intactas, e nenhuma UF pode entrar com valor inventado.
    stubFetch((url) => {
      const unidade = unidadeDaUrl(url);
      if (unidade?.ue === "BR") {
        return jsonResponse({
          candidatos: [
            { id: 280000000001, descricaoSituacao: "Deferido" },
            { id: 280000000002, descricaoSituacao: "Aguardando julgamento" },
          ],
        });
      }
      return new Response("indisponível", { status: 503 });
    });

    const { byTseId, failedUnits } = await comRelogioFalso(() => fetchDivulgaStatuses());

    expect(byTseId.get("280000000001")).toBe("Deferido");
    expect(byTseId.get("280000000002")).toBe("Aguardando julgamento");
    expect(byTseId.size).toBe(2);

    // As 27 UFs falharam, e são nomeadas uma a uma.
    expect(failedUnits).toHaveLength(27);
    expect(failedUnits.map((f) => f.unit)).not.toContain("BR");
    expect(failedUnits.map((f) => f.unit)).toContain("SP");
    expect(failedUnits.map((f) => f.unit)).toContain("AC");
  });

  it("caso misto invertido: BR cai e as UFs respondem", async () => {
    // O espelho do teste acima — a falha de UMA unidade não pode derrubar a
    // leitura das outras 27.
    stubFetch((url) => {
      const unidade = unidadeDaUrl(url);
      if (unidade?.ue === "BR") return Promise.reject(new Error("socket hang up"));
      return jsonResponse({
        candidatos: [{ id: `gov-${unidade?.ue}`, descricaoSituacao: "Deferido" }],
      });
    });

    const { byTseId, failedUnits } = await comRelogioFalso(() => fetchDivulgaStatuses());

    expect(byTseId.size).toBe(27);
    expect(byTseId.get("gov-SP")).toBe("Deferido");
    expect(failedUnits).toEqual([
      { unit: "BR", error: "socket hang up" },
    ]);
  });

  it("a mensagem de erro identifica a unidade e a causa, para o aviso do chamador", async () => {
    // O sync avisa uma vez por unidade; sem `unit` e `error` o operador não
    // teria como distinguir uma queda do TSE de um defeito nosso.
    stubFetch(() => new Response("", { status: 200 }));
    const { failedUnits } = await fetchDivulgaStatuses();
    const sp = failedUnits.find((f) => f.unit === "SP");
    expect(sp).toBeDefined();
    expect(sp?.error).toContain("Corpo vazio");
    expect(sp?.error).toContain("/SP/");
  });
});

// ============================================================
// 2. Política de retry — o que é retentado e o que não é
// ============================================================

describe("política de retry do fetchJson", () => {
  it("corpo vazio NÃO é retentado — a causa é a URL, não a rede", async () => {
    // Corpo vazio com HTTP 200 é a resposta do TSE a uma URL mal montada:
    // retentar custaria 2 requisições e 6s de backoff por ficha sem chance
    // nenhuma de mudar de resultado, e ainda atrasaria o aviso.
    const spy = stubFetch(() => new Response("", { status: 200 }));
    await fetchDivulgaStatuses();
    expect(spy).toHaveBeenCalledTimes(UNIDADES_ESPERADAS.length); // 28, não 84
  });

  it("erro de rede É retentado — três tentativas por unidade", async () => {
    const spy = stubFetch(() => Promise.reject(new Error("ETIMEDOUT")));
    await comRelogioFalso(() => fetchDivulgaStatuses());
    expect(spy).toHaveBeenCalledTimes(UNIDADES_ESPERADAS.length * 3);
  });

  it("uma falha transitória que se recupera na segunda tentativa vale como sucesso", async () => {
    // Sem retry, um blip de rede viraria falha e a situação daquela unidade
    // ficaria congelada até o próximo run.
    const vistas = new Set<string>();
    stubFetch((url) => {
      const unidade = unidadeDaUrl(url);
      if (unidade?.ue === "BR" && !vistas.has(url)) {
        vistas.add(url);
        return Promise.reject(new Error("ECONNRESET"));
      }
      return jsonResponse({
        candidatos: [{ id: `x-${unidade?.ue}`, descricaoSituacao: "Deferido" }],
      });
    });

    const { byTseId, failedUnits } = await comRelogioFalso(() => fetchDivulgaStatuses());
    expect(failedUnits).toEqual([]);
    expect(byTseId.get("x-BR")).toBe("Deferido");
  });
});

// ============================================================
// 3. divulgaUrl / divulgaDetailUrl / mapa de regiões
// ============================================================

describe("UE_REGION", () => {
  it("cobre as 28 unidades da eleição: BR + as 27 unidades federativas", () => {
    expect(Object.keys(UE_REGION)).toHaveLength(28);
    expect(UE_REGION.BR).toBe("BR");
    for (const uf of [
      "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
      "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC",
      "SE", "SP", "TO",
    ]) {
      expect(UE_REGION[uf], uf).toBeTruthy();
    }
  });

  it("os slugs de região são os do site do TSE: maiúsculos, sem acento e sem espaço", () => {
    // "Centro Oeste" vira `CENTROOESTE` porque é assim que o
    // DivulgaCandContas escreve na rota — não é convenção nossa.
    expect(UE_REGION.GO).toBe("CENTROOESTE");
    for (const [uf, regiao] of Object.entries(UE_REGION)) {
      expect(regiao, uf).toMatch(/^[A-Z]+$/);
    }
    expect(new Set(Object.values(UE_REGION))).toEqual(
      new Set(["BR", "NORTE", "NORDESTE", "CENTROOESTE", "SUDESTE", "SUL"]),
    );
  });
});

describe("divulgaUrl", () => {
  it("monta a ficha no formato região/UE/código/candidato/ano/UE", () => {
    expect(divulgaUrl("SP", "280001612345")).toBe(
      "https://divulgacandcontas.tse.jus.br/divulga/#/candidato/" +
        "SUDESTE/SP/20322002026/280001612345/2026/SP",
    );
  });

  it("monta uma ficha correta para cada uma das seis regiões", () => {
    const amostra: Array<[string, string]> = [
      ["BR", "BR"],
      ["AM", "NORTE"],
      ["BA", "NORDESTE"],
      ["MT", "CENTROOESTE"],
      ["RJ", "SUDESTE"],
      ["RS", "SUL"],
    ];
    for (const [ue, regiao] of amostra) {
      expect(divulgaUrl(ue, "999"), ue).toBe(
        `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/` +
          `${regiao}/${ue}/${DIVULGA_ELECTION_CODE}/999/${ELECTION_YEAR}/${ue}`,
      );
    }
  });

  it("normaliza a caixa da unidade eleitoral nas duas posições da rota", () => {
    expect(divulgaUrl("sp", "1")).toBe(divulgaUrl("SP", "1"));
    expect(divulgaUrl("Rj", "1")).toContain("/RJ/");
    expect(divulgaUrl("Rj", "1")).not.toContain("/Rj/");
  });

  it("devolve null sem unidade eleitoral — ausência é melhor que link quebrado", () => {
    expect(divulgaUrl(null, "1")).toBeNull();
    expect(divulgaUrl("", "1")).toBeNull();
  });

  it("devolve null para unidade desconhecida, em vez de montar uma URL que abre em erro", () => {
    // Sem região não há rota válida no DivulgaCandContas: a página abriria em
    // "ERRO AO CARREGAR A PÁGINA". A interface mostra ausência.
    expect(divulgaUrl("XX", "1")).toBeNull();
    expect(divulgaUrl("EUA", "1")).toBeNull();
    expect(divulgaUrl("  SP  ", "1")).toBeNull(); // não apara espaços
  });

  it("usa o código do DivulgaCandContas, não o CD_ELEICAO do CSV", () => {
    // Cravar 6257/6259 (os códigos do pacote de dados abertos) faz toda ficha
    // abrir em erro — o DivulgaCandContas usa um código único que cobre
    // presidente E governador.
    expect(DIVULGA_ELECTION_CODE).toBe("20322002026");
    expect(divulgaUrl("SP", "1")).not.toContain("6257");
    expect(divulgaUrl("SP", "1")).not.toContain("6259");
  });
});

describe("divulgaDetailUrl", () => {
  it("aponta para o endpoint REST /buscar, não para a página humana", () => {
    expect(divulgaDetailUrl("BR", "280000123")).toBe(
      "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/" +
        "2026/BR/20322002026/candidato/280000123",
    );
    expect(divulgaDetailUrl("BR", "1")).not.toContain("#/candidato");
  });

  it("normaliza a caixa da unidade eleitoral", () => {
    expect(divulgaDetailUrl("go", "1")).toContain("/GO/");
  });
});

// ============================================================
// 4. fetchDivulgaStatuses — caminho feliz e normalização
// ============================================================

describe("fetchDivulgaStatuses — caminho feliz", () => {
  it("faz 28 requisições: BR/presidente + 27 UFs/governador", async () => {
    const spy = stubFetch(() => jsonResponse({ candidatos: [] }));
    await fetchDivulgaStatuses();

    const pedidas = spy.mock.calls.map(([url]) => unidadeDaUrl(String(url)));
    expect(pedidas).toHaveLength(28);
    expect(pedidas.map((p) => [p?.ue, p?.cargo])).toEqual(UNIDADES_ESPERADAS);
    // BR é a única presidencial; as demais são todas de governador.
    expect(pedidas.filter((p) => p?.cargo === CARGO_PRESIDENTE)).toHaveLength(1);
    expect(pedidas.filter((p) => p?.cargo === CARGO_GOVERNADOR)).toHaveLength(27);
  });

  it("uma resposta bem formada vira o mapa SQ_CANDIDATO → redação do TSE", async () => {
    stubFetch((url) =>
      unidadeDaUrl(url)?.ue === "BR"
        ? jsonResponse({
            candidatos: [
              { id: "280000605409", descricaoSituacao: "Deferido" },
              { id: "280000612345", descricaoSituacao: "Aguardando julgamento" },
              { id: "280000699999", descricaoSituacao: "Renúncia" },
            ],
          })
        : jsonResponse({ candidatos: [] }),
    );

    const { byTseId, failedUnits } = await fetchDivulgaStatuses();
    expect(failedUnits).toEqual([]);
    expect(Object.fromEntries(byTseId)).toEqual({
      "280000605409": "Deferido",
      "280000612345": "Aguardando julgamento",
      "280000699999": "Renúncia",
    });
  });

  it("a redação é copiada literalmente — só os espaços das pontas saem", async () => {
    // Nenhuma tradução, nenhuma normalização de acento ou de caixa: o badge
    // exibe a palavra da Justiça Eleitoral como ela foi escrita.
    stubFetch((url) =>
      unidadeDaUrl(url)?.ue === "BR"
        ? jsonResponse({
            candidatos: [
              { id: "1", descricaoSituacao: "  Deferido com recurso  " },
              { id: "2", descricaoSituacao: "Indeferido em prazo recursal ou com recurso" },
            ],
          })
        : jsonResponse({ candidatos: [] }),
    );

    const { byTseId } = await fetchDivulgaStatuses();
    expect(byTseId.get("1")).toBe("Deferido com recurso");
    expect(byTseId.get("2")).toBe("Indeferido em prazo recursal ou com recurso");
  });

  it("aceita id numérico e o converte para string, sem perder a chave", async () => {
    stubFetch((url) =>
      unidadeDaUrl(url)?.ue === "BR"
        ? jsonResponse({ candidatos: [{ id: 280000605409, descricaoSituacao: "Deferido" }] })
        : jsonResponse({ candidatos: [] }),
    );
    const { byTseId } = await fetchDivulgaStatuses();
    expect(byTseId.get("280000605409")).toBe("Deferido");
  });

  it("descarta candidatura sem id ou sem situação, em vez de gravar meia verdade", async () => {
    stubFetch((url) =>
      unidadeDaUrl(url)?.ue === "BR"
        ? jsonResponse({
            candidatos: [
              { id: null, descricaoSituacao: "Deferido" },
              { descricaoSituacao: "Deferido" },
              { id: "sem-situacao" },
              { id: "situacao-vazia", descricaoSituacao: "   " },
              { id: "situacao-nao-texto", descricaoSituacao: 42 },
              { id: "ok", descricaoSituacao: "Deferido" },
            ],
          })
        : jsonResponse({ candidatos: [] }),
    );

    const { byTseId } = await fetchDivulgaStatuses();
    expect([...byTseId.keys()]).toEqual(["ok"]);
  });

  it("corpo sem a chave `candidatos` não é falha, mas também não vira situação", async () => {
    // Uma unidade sem candidaturas registradas responde legitimamente assim.
    // Não há erro a reportar — e também não há nada a gravar.
    stubFetch(() => jsonResponse({ mensagem: "sem candidatos" }));
    const { byTseId, failedUnits } = await fetchDivulgaStatuses();
    expect(byTseId.size).toBe(0);
    expect(failedUnits).toEqual([]);
  });

  it("`candidatos` que não é lista é ignorado sem lançar", async () => {
    stubFetch(() => jsonResponse({ candidatos: { id: "1", descricaoSituacao: "Deferido" } }));
    const { byTseId, failedUnits } = await fetchDivulgaStatuses();
    expect(byTseId.size).toBe(0);
    expect(failedUnits).toEqual([]);
  });

  it("identifica-se com User-Agent e pede JSON — o CDN do TSE recusa quem não manda UA", async () => {
    const spy = stubFetch(() => jsonResponse({ candidatos: [] }));
    await fetchDivulgaStatuses();
    const init = spy.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };
    expect(init.headers["User-Agent"]).toContain("em-quem-votar");
    expect(init.headers.Accept).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("a última leitura de um mesmo SQ_CANDIDATO prevalece, sem duplicar chave", async () => {
    stubFetch((url) =>
      unidadeDaUrl(url)?.ue === "BR"
        ? jsonResponse({
            candidatos: [
              { id: "1", descricaoSituacao: "Aguardando julgamento" },
              { id: "1", descricaoSituacao: "Deferido" },
            ],
          })
        : jsonResponse({ candidatos: [] }),
    );
    const { byTseId } = await fetchDivulgaStatuses();
    expect(byTseId.size).toBe(1);
    expect(byTseId.get("1")).toBe("Deferido");
  });
});

// ============================================================
// 5. parseDivulgaDetail — a ficha completa, sem interpretação
// ============================================================

describe("parseDivulgaDetail", () => {
  it("copia a situação literalmente, aparando só as pontas", () => {
    expect(parseDivulgaDetail("1", { descricaoSituacao: "  Deferido  " }).situacao).toBe(
      "Deferido",
    );
    expect(parseDivulgaDetail("1", { descricaoSituacao: "   " }).situacao).toBeNull();
    expect(parseDivulgaDetail("1", {}).situacao).toBeNull();
  });

  it("os dois campos de aptidão saem crus, sem virar booleano de aptidão", () => {
    // A leitura dos três estados é de `aptoFromDivulga`; aqui não se
    // interpreta. `candidatoApto: false` não significa "inapto" — em 27/08/2026
    // onze das treze presidenciais devolvem `false` nos dois campos por
    // estarem aguardando julgamento.
    const ficha = parseDivulgaDetail("1", {
      candidatoApto: false,
      isCandidatoInapto: false,
    });
    expect(ficha.candidatoApto).toBe(false);
    expect(ficha.isCandidatoInapto).toBe(false);

    // Qualquer coisa que não seja booleano vira null — nunca `false`.
    const semFlags = parseDivulgaDetail("1", { candidatoApto: "sim", isCandidatoInapto: 0 });
    expect(semFlags.candidatoApto).toBeNull();
    expect(semFlags.isCandidatoInapto).toBeNull();
  });

  it("AUSENTE ≠ VAZIO nos bens: sem a chave é null, com lista vazia é []", () => {
    // A distinção arma (ou desarma) um `deleteMany` do outro lado. Colapsar
    // as duas em `[]` faria uma resposta incompleta do TSE apagar a
    // declaração de bens de uma pessoa real — e em 27/08/2026 38 das 211
    // fichas declaram `bens: []` de verdade, então não dá para distinguir
    // depois.
    expect(parseDivulgaDetail("1", {}).bens).toBeNull();
    expect(parseDivulgaDetail("1", { bens: null }).bens).toBeNull();
    expect(parseDivulgaDetail("1", { bens: "nenhum" }).bens).toBeNull();
    expect(parseDivulgaDetail("1", { bens: [] }).bens).toEqual([]);
  });

  it("lê um bem declarado preservando a descrição do próprio candidato", () => {
    const ficha = parseDivulgaDetail("1", {
      bens: [
        {
          ordem: 1,
          descricao: "50% DO APARTAMENTO LOCALIZADO EM SÃO BERNARDO DO CAMPO",
          descricaoDeTipoDeBem: "Apartamento",
          valor: 250000.5,
          dataUltimaAtualizacao: "2026-08-15",
        },
      ],
    });
    expect(ficha.bens).toEqual([
      {
        ordem: 1,
        descricao: "50% DO APARTAMENTO LOCALIZADO EM SÃO BERNARDO DO CAMPO",
        tipo: "Apartamento",
        valor: 250000.5,
        atualizadoEm: "2026-08-15",
      },
    ]);
  });

  it("descarta bem sem descrição ou sem valor, e aceita valor com vírgula decimal", () => {
    const ficha = parseDivulgaDetail("1", {
      bens: [
        { descricao: "Sem valor" },
        { valor: 100 },
        { descricao: "Terreno", valor: "1500,75" },
      ],
    });
    expect(ficha.bens).toEqual([
      { ordem: null, descricao: "Terreno", tipo: null, valor: 1500.75, atualizadoEm: null },
    ]);
  });

  it("remove a própria candidatura de 2026 do histórico de eleições", () => {
    // O TSE devolve a candidatura atual dentro de `eleicoesAnteriores`
    // (mesmo id, "Concorrendo"). Guardá-la faria a página listar
    // "2026 · Presidente · Concorrendo" no histórico de quem disputa 2026.
    const ficha = parseDivulgaDetail("280000605409", {
      eleicoesAnteriores: [
        {
          id: "280000605409",
          nrAno: 2026,
          cargo: "Presidente",
          situacaoTotalizacao: "Concorrendo",
        },
        {
          id: "190000123456",
          nrAno: 2018,
          cargo: "Deputado Federal",
          sgUe: "SP",
          partido: "PARTIDO",
          situacaoTotalizacao: "Eleito por QP",
          txLink: "https://divulgacandcontas.tse.jus.br/…",
        },
      ],
    });

    expect(ficha.eleicoesAnteriores).toEqual([
      {
        tsePriorId: "190000123456",
        year: 2018,
        office: "Deputado Federal",
        ue: "SP",
        party: "PARTIDO",
        resultLabel: "Eleito por QP",
        sourceUrl: "https://divulgacandcontas.tse.jus.br/…",
      },
    ]);
  });

  it("descarta eleição anterior sem id, ano, cargo ou resultado", () => {
    // Sem esses quatro não há linha honesta a exibir; os opcionais (UE,
    // partido, link) podem faltar e a linha continua verdadeira.
    const ficha = parseDivulgaDetail("atual", {
      eleicoesAnteriores: [
        { nrAno: 2018, cargo: "Senador", situacaoTotalizacao: "Eleito" },
        { id: "a", cargo: "Senador", situacaoTotalizacao: "Eleito" },
        { id: "b", nrAno: 2018, situacaoTotalizacao: "Eleito" },
        { id: "c", nrAno: 2018, cargo: "Senador" },
        { id: "d", nrAno: 2014, cargo: "Vice-prefeito", situacaoTotalizacao: "Não eleito" },
      ],
    });
    expect(ficha.eleicoesAnteriores.map((e) => e.tsePriorId)).toEqual(["d"]);
    expect(ficha.eleicoesAnteriores[0]).toMatchObject({ ue: null, party: null, sourceUrl: null });
  });

  it("a UE de uma eleição anterior nem sempre é UF — cargo municipal traz o código do município", () => {
    const ficha = parseDivulgaDetail("atual", {
      eleicoesAnteriores: [
        {
          id: "z",
          nrAno: 2020,
          cargo: "Prefeito",
          sgUe: 71072,
          situacaoTotalizacao: "Eleito",
        },
      ],
    });
    expect(ficha.eleicoesAnteriores[0].ue).toBe("71072");
  });

  it("conta processos de cassação e desconstituição, e conta zero quando não há lista", () => {
    expect(parseDivulgaDetail("1", {}).processosCassacao).toBe(0);
    expect(parseDivulgaDetail("1", {}).processosDesconstituicao).toBe(0);
    const ficha = parseDivulgaDetail("1", {
      processosCassacao: [{}, {}],
      processosDesconstituicao: [{}],
    });
    expect(ficha.processosCassacao).toBe(2);
    expect(ficha.processosDesconstituicao).toBe(1);
  });

  it("uma ficha vazia, null ou indefinida não lança nem inventa nada", () => {
    for (const cru of [null, undefined, {}]) {
      const ficha = parseDivulgaDetail("280000605409", cru);
      expect(ficha).toEqual({
        tseId: "280000605409",
        situacao: null,
        candidatoApto: null,
        isCandidatoInapto: null,
        numeroProcesso: null,
        totalDeBens: null,
        atualizadoEm: null,
        bens: null,
        eleicoesAnteriores: [],
        processosCassacao: 0,
        processosDesconstituicao: 0,
      });
    }
  });

  it("o tseId do retorno é o pedido, não o que a ficha alega", () => {
    // A chave de idempotência é a nossa: o `id` de dentro do corpo não pode
    // reapontar a gravação para outra candidatura.
    expect(parseDivulgaDetail("pedido", { id: "outro" }).tseId).toBe("pedido");
  });
});

// ============================================================
// 6. fetchDivulgaDetail / fetchDivulgaDetails
// ============================================================

describe("fetchDivulgaDetail", () => {
  it("busca a ficha na UE da disputa e devolve o parse", async () => {
    const spy = stubFetch(() =>
      jsonResponse({ descricaoSituacao: "Deferido", numeroProcesso: "0600123-45", bens: [] }),
    );
    const ficha = await fetchDivulgaDetail("br", "280000605409");
    expect(spy.mock.calls[0][0]).toBe(divulgaDetailUrl("BR", "280000605409"));
    expect(ficha).toMatchObject({
      tseId: "280000605409",
      situacao: "Deferido",
      numeroProcesso: "0600123-45",
      bens: [],
    });
  });

  it("propaga o erro — quem chama decide o que fazer, o módulo não inventa ficha", async () => {
    stubFetch(() => new Response("", { status: 200 }));
    await expect(fetchDivulgaDetail("BR", "1")).rejects.toThrow("Corpo vazio");
  });
});

describe("fetchDivulgaDetails", () => {
  const alvos = [
    { tseId: "1", sgUe: "BR" },
    { tseId: "2", sgUe: "SP" },
    { tseId: "3", sgUe: "GO" },
  ];

  it("caminho feliz: cada alvo vira uma entrada e nada sai em `failed`", async () => {
    stubFetch((url) => {
      const id = url.split("/").pop();
      return jsonResponse({ descricaoSituacao: "Deferido", numeroProcesso: `p-${id}` });
    });

    const { byTseId, failed } = await fetchDivulgaDetails(alvos);
    expect(failed).toEqual([]);
    expect([...byTseId.keys()].sort()).toEqual(["1", "2", "3"]);
    expect(byTseId.get("2")?.numeroProcesso).toBe("p-2");
  });

  it("uma ficha que falha NÃO derruba as outras nem entra no mapa", async () => {
    // Mesma garantia da situação, agora para o patrimônio e a aptidão: quem
    // escreve omite os campos das candidaturas em `failed`, e o valor
    // guardado sobrevive. Uma indisponibilidade do TSE não pode virar
    // afirmação sobre os bens de uma pessoa real.
    stubFetch((url) =>
      url.endsWith("/2")
        ? new Response("", { status: 200 })
        : jsonResponse({ descricaoSituacao: "Deferido" }),
    );

    const { byTseId, failed } = await fetchDivulgaDetails(alvos);
    expect([...byTseId.keys()].sort()).toEqual(["1", "3"]);
    expect(byTseId.has("2")).toBe(false);
    expect(failed).toHaveLength(1);
    expect(failed[0].tseId).toBe("2");
    expect(failed[0].error).toContain("Corpo vazio");
  });

  it("informa o progresso uma vez por alvo, concluído ou falho", async () => {
    stubFetch((url) =>
      url.endsWith("/3")
        ? new Response("", { status: 200 })
        : jsonResponse({ descricaoSituacao: "Deferido" }),
    );

    const progresso: Array<[number, number]> = [];
    await fetchDivulgaDetails(alvos, {
      concurrency: 1,
      onProgress: (done, total) => progresso.push([done, total]),
    });
    expect(progresso).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("respeita o pool de concorrência e nunca desce abaixo de um trabalhador", async () => {
    let simultaneas = 0;
    let pico = 0;
    stubFetch(async () => {
      simultaneas += 1;
      pico = Math.max(pico, simultaneas);
      await Promise.resolve();
      simultaneas -= 1;
      return jsonResponse({ descricaoSituacao: "Deferido" });
    });

    const muitos = Array.from({ length: 12 }, (_, i) => ({
      tseId: String(i),
      sgUe: "BR",
    }));
    await fetchDivulgaDetails(muitos, { concurrency: 3 });
    expect(pico).toBeLessThanOrEqual(3);

    // `concurrency: 0` viraria um pool sem trabalhador nenhum — nada seria
    // buscado e a etapa passaria em silêncio. O módulo eleva para 1.
    const { byTseId } = await fetchDivulgaDetails(alvos, { concurrency: 0 });
    expect(byTseId.size).toBe(3);
  });

  it("lista de alvos vazia não faz requisição nenhuma", async () => {
    const spy = stubFetch(() => jsonResponse({}));
    const { byTseId, failed } = await fetchDivulgaDetails([]);
    expect(spy).not.toHaveBeenCalled();
    expect(byTseId.size).toBe(0);
    expect(failed).toEqual([]);
  });
});
