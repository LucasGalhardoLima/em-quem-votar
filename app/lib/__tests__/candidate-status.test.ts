import { describe, it, expect } from "vitest";
import {
  aptoFromDivulga,
  REGISTRATION_STATUSES,
  RUNNING_STATUSES,
  STATUS_BADGE_CLASS,
  STATUS_PRESENTATION,
  statusDescription,
  statusFromTseLabel,
  statusLabel,
  statusTone,
  TSE_DENIAL_WORDINGS,
  tseStatusWrite,
  type RegistrationStatus,
} from "../candidate-status";

describe("STATUS_PRESENTATION", () => {
  it("toda situação de registro tem apresentação — nenhuma chave faltando", () => {
    for (const status of REGISTRATION_STATUSES) {
      const presentation = STATUS_PRESENTATION[status];
      expect(presentation, `faltou apresentação para ${status}`).toBeDefined();
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.description.length).toBeGreaterThan(0);
      expect(["neutral", "attention"]).toContain(presentation.tone);
    }
  });

  it("não há apresentação órfã para uma situação que não existe no enum", () => {
    expect(Object.keys(STATUS_PRESENTATION).sort()).toEqual(
      [...REGISTRATION_STATUSES].sort(),
    );
  });

  it("toda tonalidade usada tem classe de badge", () => {
    for (const status of REGISTRATION_STATUSES) {
      expect(STATUS_BADGE_CLASS[statusTone(status)]).toBeTruthy();
    }
  });
});

describe("statusLabel", () => {
  it("prefere o texto do próprio TSE ao rótulo do enum", () => {
    // Princípio editorial: a plataforma nunca reescreve a situação. Se o
    // TSE diz "Deferido com recurso", é isso que aparece — não "Deferido".
    expect(statusLabel("APPROVED", "Deferido com recurso")).toBe(
      "Deferido com recurso",
    );
    expect(statusLabel("APPROVED", "Deferido com recurso")).not.toBe(
      STATUS_PRESENTATION.APPROVED.label,
    );
  });

  it("usa o texto do TSE mesmo quando ele contradiz o enum", () => {
    // O enum serve só para filtro e ordenação; a exibição é a do TSE.
    expect(statusLabel("REGISTERED", "Aguardando julgamento")).toBe(
      "Aguardando julgamento",
    );
  });

  it("cai no rótulo do enum quando o TSE não forneceu texto", () => {
    expect(statusLabel("APPROVED", null)).toBe("Deferido");
    expect(statusLabel("APPROVED", undefined)).toBe("Deferido");
    expect(statusLabel("APPROVED")).toBe("Deferido");
  });

  it("cai no rótulo do enum quando o texto do TSE é vazio ou só espaços", () => {
    // Campo em branco vindo da importação não pode virar badge vazio.
    expect(statusLabel("SUB_JUDICE", "")).toBe("Sub judice");
    expect(statusLabel("SUB_JUDICE", "   ")).toBe("Sub judice");
    expect(statusLabel("SUB_JUDICE", "\n\t ")).toBe("Sub judice");
  });

  it("apara espaços em volta do texto do TSE", () => {
    expect(statusLabel("REJECTED", "  Indeferido com recurso  ")).toBe(
      "Indeferido com recurso",
    );
  });

  it("devolve um rótulo não vazio para toda situação, sem texto do TSE", () => {
    for (const status of REGISTRATION_STATUSES) {
      expect(statusLabel(status, null).length).toBeGreaterThan(0);
    }
  });
});

describe("statusTone", () => {
  it("marca como 'attention' as situações que não são definitivas ou negam o registro", () => {
    expect(statusTone("SUB_JUDICE")).toBe("attention");
    expect(statusTone("REJECTED")).toBe("attention");
    expect(statusTone("CANCELLED")).toBe("attention");
  });

  it("as demais situações são neutras — sem cor partidária nem juízo de valor", () => {
    expect(statusTone("PRE_CANDIDATE")).toBe("neutral");
    expect(statusTone("REGISTERED")).toBe("neutral");
    expect(statusTone("PENDING_JUDGMENT")).toBe("neutral");
    expect(statusTone("APPROVED")).toBe("neutral");
    expect(statusTone("WITHDRAWN")).toBe("neutral");
  });

  it("só existem duas tonalidades", () => {
    const tones = new Set(REGISTRATION_STATUSES.map((s) => statusTone(s)));
    expect([...tones].sort()).toEqual(["attention", "neutral"]);
  });
});

describe("statusDescription", () => {
  it("devolve a definição da Justiça Eleitoral de cada situação", () => {
    expect(statusDescription("APPROVED")).toBe(
      "Registro de candidatura aprovado pelo TSE.",
    );
    expect(statusDescription("SUB_JUDICE")).toContain(
      "os votos são contabilizados até decisão final",
    );
  });

  it("toda situação tem descrição não vazia", () => {
    for (const status of REGISTRATION_STATUSES) {
      expect(statusDescription(status).length).toBeGreaterThan(0);
    }
  });
});

describe("RUNNING_STATUSES", () => {
  it("contém exatamente as situações ainda na disputa", () => {
    expect(RUNNING_STATUSES).toEqual([
      "REGISTERED",
      "PENDING_JUDGMENT",
      "SUB_JUDICE",
      "APPROVED",
    ]);
  });

  it("exclui quem não está (ou ainda não entrou) na disputa", () => {
    // Pré-candidatura não protocolou registro; renúncia, indeferimento e
    // cassação tiraram a candidatura da urna. Nenhuma entra na contagem
    // exibida na home.
    const foraDaDisputa: RegistrationStatus[] = [
      "PRE_CANDIDATE",
      "WITHDRAWN",
      "REJECTED",
      "CANCELLED",
    ];
    for (const status of foraDaDisputa) {
      expect(RUNNING_STATUSES).not.toContain(status);
    }
  });

  it("sub judice continua na disputa — os votos são contabilizados", () => {
    expect(RUNNING_STATUSES).toContain("SUB_JUDICE");
  });

  it("toda entrada é uma situação válida do enum, sem repetições", () => {
    for (const status of RUNNING_STATUSES) {
      expect(REGISTRATION_STATUSES).toContain(status);
    }
    expect(new Set(RUNNING_STATUSES).size).toBe(RUNNING_STATUSES.length);
  });
});

describe("statusFromTseLabel", () => {
  // Redações realmente observadas no DivulgaCandContas em 26/08/2026, nas 211
  // candidaturas. Não são hipóteses: cada uma existia no ar naquele dia.
  const observadas: Array<[string, RegistrationStatus]> = [
    ["Aguardando julgamento", "PENDING_JUDGMENT"],
    ["Deferido", "APPROVED"],
    ["Deferido com recurso", "SUB_JUDICE"],
    ["Indeferido em prazo recursal ou com recurso", "SUB_JUDICE"],
    ["Renúncia", "WITHDRAWN"],
  ];

  it.each(observadas)("mapeia a redação do TSE %s", (label, esperado) => {
    expect(statusFromTseLabel(label)).toBe(esperado);
  });

  it("ignora acento, caixa, espaço extra e ponto final", () => {
    expect(statusFromTseLabel("  renuncia ")).toBe("WITHDRAWN");
    expect(statusFromTseLabel("DEFERIDO.")).toBe("APPROVED");
    expect(statusFromTseLabel("Deferido  com   recurso")).toBe("SUB_JUDICE");
  });

  it("devolve null quando não há redação — nunca inventa situação", () => {
    expect(statusFromTseLabel(null)).toBeNull();
    expect(statusFromTseLabel(undefined)).toBeNull();
    expect(statusFromTseLabel("")).toBeNull();
    expect(statusFromTseLabel("   ")).toBeNull();
  });

  it("devolve null para redação desconhecida, em vez de chutar", () => {
    // Quem chama trata isso como "não sei" e preserva o que está gravado.
    // Adivinhar aqui atribuiria a uma pessoa real uma situação jurídica
    // que ninguém afirmou.
    expect(statusFromTseLabel("Situação que o TSE ainda não inventou")).toBeNull();
  });

  it("toda redação mapeada aponta para uma situação válida do enum", () => {
    for (const [label] of observadas) {
      const status = statusFromTseLabel(label);
      expect(status).not.toBeNull();
      expect(REGISTRATION_STATUSES).toContain(status as RegistrationStatus);
    }
  });

  it("indeferimento com recurso não é indeferimento definitivo", () => {
    // A distinção importa: REJECTED sai da disputa, SUB_JUDICE continua nela
    // e os votos são contabilizados até a decisão final.
    expect(statusFromTseLabel("Indeferido")).toBe("REJECTED");
    expect(statusFromTseLabel("Indeferido em prazo recursal ou com recurso")).toBe("SUB_JUDICE");
    expect(RUNNING_STATUSES).toContain("SUB_JUDICE");
    expect(RUNNING_STATUSES).not.toContain("REJECTED");
  });

  it("a redação literal do TSE é o que o badge mostra, não o rótulo do enum", () => {
    // statusLabel prefere o texto do TSE — é a regra de neutralidade: a
    // plataforma exibe o que a Justiça Eleitoral escreveu, sem parafrasear.
    const label = "Indeferido em prazo recursal ou com recurso";
    const status = statusFromTseLabel(label) as RegistrationStatus;
    expect(statusLabel(status, label)).toBe(label);
    expect(statusLabel(status, null)).toBe(STATUS_PRESENTATION[status].label);
  });
});

describe("tseStatusWrite", () => {
  // A política de escrita da situação, que o sync e o cron compartilham.
  // O caso que ela existe para separar é o terceiro: redação PRESENTE mas
  // desconhecida. Antes, o sync avisava e mesmo assim gravava o fallback
  // PENDING_JUDGMENT — a candidatura ficava com rótulo honesto ("Cassado por
  // abuso de poder") e enum inventado ("Aguardando julgamento"), que o
  // StatusBadge lê no `title` e no `sr-only`. E ficava PRESA: no run seguinte
  // o diff não via diferença nenhuma.

  it("redação conhecida: grava a redação E o enum", () => {
    expect(tseStatusWrite("Deferido")).toEqual({
      kind: "mapped",
      label: "Deferido",
      status: "APPROVED",
    });
  });

  it("sem redação: não grava situação nenhuma", () => {
    // O valor guardado sobrevive — uma queda do TSE não rebaixa "Deferido"
    // para "aguardando julgamento".
    for (const vazio of [null, undefined, "", "   ", "\n\t "]) {
      expect(tseStatusWrite(vazio)).toEqual({ kind: "absent" });
    }
  });

  it("redação DESCONHECIDA: grava a redação, NÃO grava o enum", () => {
    const write = tseStatusWrite("Cassado por abuso de poder econômico");
    expect(write.kind).toBe("unmapped");
    // A palavra do TSE é gravada — é ela que o badge exibe, e é verdadeira.
    expect(write).toHaveProperty("label", "Cassado por abuso de poder econômico");
    // O enum NÃO vem junto: quem grava preserva o que já estava.
    expect(write).not.toHaveProperty("status");
  });

  it("apara espaços da redação antes de gravá-la", () => {
    expect(tseStatusWrite("  Renúncia  ")).toMatchObject({
      kind: "mapped",
      label: "Renúncia",
      status: "WITHDRAWN",
    });
  });

  it("concorda com statusFromTseLabel em toda redação conhecida", () => {
    for (const label of [
      "Aguardando julgamento",
      "Deferido",
      "Deferido com recurso",
      "Indeferido",
      "Indeferido em prazo recursal ou com recurso",
      "Renúncia",
      "Cassado",
    ]) {
      const write = tseStatusWrite(label);
      expect(write.kind, label).toBe("mapped");
      expect(write).toHaveProperty("status", statusFromTseLabel(label));
    }
  });
});

describe("aptoFromDivulga", () => {
  // A ARMADILHA, medida na fonte: das 13 candidaturas presidenciais lidas no
  // DivulgaCandContas em 27/08/2026, ONZE devolvem `candidatoApto: false` E
  // `isCandidatoInapto: false` ao mesmo tempo, porque estão "Aguardando
  // julgamento". As outras duas (Deferido) devolvem `candidatoApto: true`.
  const aguardandoJulgamento = {
    candidatoApto: false,
    isCandidatoInapto: false,
    situacao: "Aguardando julgamento",
  };

  it("NÃO trata candidatoApto:false como inapto", () => {
    // Ler o campo como booleano marcaria 11 pessoas reais como inaptas sem
    // que nenhuma decisão da Justiça Eleitoral existisse.
    expect(aptoFromDivulga(aguardandoJulgamento)).toBeNull();
    expect(aptoFromDivulga(aguardandoJulgamento)).not.toBe(false);
  });

  it("é tri-estado: apta, inapta e ainda não julgada são valores distintos", () => {
    expect(
      aptoFromDivulga({
        candidatoApto: true,
        isCandidatoInapto: false,
        situacao: "Deferido",
      }),
    ).toBe(true);
    expect(
      aptoFromDivulga({
        candidatoApto: false,
        isCandidatoInapto: true,
        situacao: "Indeferido",
      }),
    ).toBe(false);
    expect(aptoFromDivulga(aguardandoJulgamento)).toBeNull();
  });

  it("a flag do TSE decide quando a redação não a contradiz", () => {
    // `candidatoApto: true` e `isCandidatoInapto: true` são afirmações
    // explícitas da Justiça Eleitoral; sem redação que as negue, elas valem.
    expect(
      aptoFromDivulga({ candidatoApto: true, isCandidatoInapto: false, situacao: null }),
    ).toBe(true);
    expect(
      aptoFromDivulga({ candidatoApto: false, isCandidatoInapto: true, situacao: null }),
    ).toBe(false);
  });

  // MUDANÇA DE COMPORTAMENTO (27/08/2026). Antes, `candidatoApto: true`
  // retornava `true` ANTES de olhar a redação, e este teste afirmava que a
  // flag vencia "mesmo contra a redação". Ela não pode: o schema documenta
  // `tseApto: true` como "a Justiça Eleitoral deferiu o registro", e dizer
  // isso de um registro INDEFERIDO é afirmação falsa sobre uma pessoa real.
  describe("redação de indeferimento derruba a flag afirmativa", () => {
    it("o caso real: ESTÊVÃO (BA), apto=true com registro indeferido", () => {
      // VERIFICADO na ficha 50002536579 em 27/08/2026 — a única das 211 em
      // que as duas fontes se contradizem.
      const estevao = {
        candidatoApto: true,
        isCandidatoInapto: false,
        situacao: "Indeferido em prazo recursal ou com recurso",
      };
      expect(aptoFromDivulga(estevao)).not.toBe(true);
      // `null` e não `false`: ainda cabe recurso (SUB_JUDICE), então nem
      // "apta" nem "inapta" — o desfecho não existe ainda.
      expect(aptoFromDivulga(estevao)).toBeNull();
    });

    it("indeferimento definitivo com a flag afirmativa é inapto, não apto", () => {
      expect(
        aptoFromDivulga({
          candidatoApto: true,
          isCandidatoInapto: false,
          situacao: "Indeferido",
        }),
      ).toBe(false);
    });

    it("cassação e renúncia também derrubam a flag", () => {
      for (const situacao of ["Cassado", "Renúncia", "Falecido", "Cancelado"]) {
        expect(
          aptoFromDivulga({ candidatoApto: true, isCandidatoInapto: false, situacao }),
        ).toBe(false);
      }
    });

    it("mas a flag de INAPTIDÃO continua valendo antes de tudo", () => {
      // Nenhuma redação contradiz uma inaptidão declarada: o TSE afirmou.
      expect(
        aptoFromDivulga({
          candidatoApto: false,
          isCandidatoInapto: true,
          situacao: "Indeferido em prazo recursal ou com recurso",
        }),
      ).toBe(false);
    });

    it("'deferido com recurso' NÃO é redação de indeferimento", () => {
      // A regra derruba a flag só quando o TEXTO nega o registro. Aqui ele
      // não nega, então a flag afirmativa segue decidindo.
      expect(
        aptoFromDivulga({
          candidatoApto: true,
          isCandidatoInapto: false,
          situacao: "Deferido com recurso",
        }),
      ).toBe(true);
    });

    it("toda redação da lista de negativas existe no TSE_STATUS_MAP", () => {
      // Impede que uma redação removida do mapa sobreviva esquecida na lista.
      for (const wording of TSE_DENIAL_WORDINGS) {
        expect(statusFromTseLabel(wording), wording).not.toBeNull();
      }
    });
  });

  it("renúncia é inapta, não 'ainda não julgada'", () => {
    // Quem renunciou tem as MESMAS duas flags de quem aguarda julgamento.
    // Sem a leitura da situação, o retorno seria null — e a plataforma diria
    // "ainda não julgada" sobre uma candidatura que acabou.
    expect(
      aptoFromDivulga({
        candidatoApto: false,
        isCandidatoInapto: false,
        situacao: "Renúncia",
      }),
    ).toBe(false);
    expect(
      aptoFromDivulga({
        candidatoApto: false,
        isCandidatoInapto: false,
        situacao: "Cassado",
      }),
    ).toBe(false);
    expect(
      aptoFromDivulga({
        candidatoApto: false,
        isCandidatoInapto: false,
        situacao: "Indeferido",
      }),
    ).toBe(false);
  });

  it("deferido pela redação é apto mesmo se a flag vier calada", () => {
    expect(
      aptoFromDivulga({ candidatoApto: null, isCandidatoInapto: null, situacao: "Deferido" }),
    ).toBe(true);
  });

  it("sub judice não afirma desfecho: sem flag, fica não julgada", () => {
    // "Deferido com recurso" e "Indeferido em prazo recursal ou com recurso"
    // caem no mesmo enum — a redação não basta para dizer o desfecho.
    for (const situacao of [
      "Deferido com recurso",
      "Indeferido em prazo recursal ou com recurso",
      "Sub judice",
    ]) {
      expect(
        aptoFromDivulga({ candidatoApto: false, isCandidatoInapto: false, situacao }),
      ).toBeNull();
    }
  });

  it("redação desconhecida ou ausente não vira palpite", () => {
    expect(aptoFromDivulga({})).toBeNull();
    expect(
      aptoFromDivulga({ candidatoApto: null, isCandidatoInapto: null, situacao: null }),
    ).toBeNull();
    expect(
      aptoFromDivulga({
        candidatoApto: false,
        isCandidatoInapto: false,
        situacao: "Situação que o TSE ainda não inventou",
      }),
    ).toBeNull();
  });

  it("reproduz a distribuição real das 13 presidenciais em 27/08/2026", () => {
    const fichas = [
      // 11 "Aguardando julgamento" — apto=false, inapto=false
      ...Array.from({ length: 11 }, () => aguardandoJulgamento),
      // 2 "Deferido" — apto=true
      ...Array.from({ length: 2 }, () => ({
        candidatoApto: true,
        isCandidatoInapto: false,
        situacao: "Deferido",
      })),
    ];

    const resultados = fichas.map(aptoFromDivulga);
    expect(resultados.filter((r) => r === true)).toHaveLength(2);
    expect(resultados.filter((r) => r === null)).toHaveLength(11);
    // O número que importa: NENHUMA pessoa marcada como inapta sem decisão.
    expect(resultados.filter((r) => r === false)).toHaveLength(0);
  });

  it("ignora st_MOTIVO_FICHA_LIMPA — o campo não entra na assinatura", () => {
    // Ele vem `false` para todas as 13, inclusive quem está sob julgamento:
    // é o MOTIVO de um indeferimento, não um atestado. Passá-lo não muda nada.
    const comCampoExtra = {
      ...aguardandoJulgamento,
      st_MOTIVO_FICHA_LIMPA: false,
    } as Parameters<typeof aptoFromDivulga>[0];
    expect(aptoFromDivulga(comCampoExtra)).toBeNull();
  });
});
