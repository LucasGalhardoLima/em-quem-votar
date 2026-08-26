import { describe, it, expect } from "vitest";
import {
  REGISTRATION_STATUSES,
  RUNNING_STATUSES,
  STATUS_BADGE_CLASS,
  STATUS_PRESENTATION,
  statusDescription,
  statusLabel,
  statusTone,
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
