import { describe, it, expect } from "vitest";
import {
  OFFICES,
  OFFICE_PRESENTATION,
  UFS,
  isOffice,
  isUf,
  parseOffice,
  parseUf,
  raceLabel,
  requiresUf,
  ufName,
} from "../office";

describe("OFFICE_PRESENTATION", () => {
  it("todo cargo tem apresentação completa", () => {
    for (const office of OFFICES) {
      const p = OFFICE_PRESENTATION[office];
      expect(p, `faltou apresentação para ${office}`).toBeDefined();
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.labelPlural.length).toBeGreaterThan(0);
      expect(p.ballotLabel.length).toBeGreaterThan(0);
      expect(p.runningMateLabel.length).toBeGreaterThan(0);
      expect(["national", "state"]).toContain(p.scope);
    }
  });

  it("não há apresentação órfã", () => {
    expect(Object.keys(OFFICE_PRESENTATION).sort()).toEqual([...OFFICES].sort());
  });

  it("cobre exatamente os dois cargos que a lei obriga a arquivar proposta", () => {
    // Lei 9.504/97 art. 11 §1º IX. Se alguém acrescentar senador ou deputado
    // aqui, este teste falha de propósito: para esses cargos não existe
    // documento a citar, e a plataforma não infere posição.
    expect([...OFFICES].sort()).toEqual(["governor", "presidential"]);
  });
});

describe("UFS", () => {
  it("traz as 27 unidades federativas", () => {
    expect(UFS).toHaveLength(27);
  });

  it("não repete sigla", () => {
    const siglas = UFS.map(u => u.sigla);
    expect(new Set(siglas).size).toBe(siglas.length);
  });

  it("está em ordem alfabética por sigla — qualquer outra embutiria juízo", () => {
    const siglas = UFS.map(u => u.sigla);
    expect(siglas).toEqual([...siglas].sort());
  });

  it("toda sigla tem duas letras maiúsculas e um nome por extenso", () => {
    for (const uf of UFS) {
      expect(uf.sigla).toMatch(/^[A-Z]{2}$/);
      expect(uf.nome.length).toBeGreaterThan(2);
    }
  });
});

describe("isUf / ufName", () => {
  it("reconhece uma UF real", () => {
    expect(isUf("SP")).toBe(true);
    expect(ufName("SP")).toBe("São Paulo");
  });

  it("rejeita sigla que não é UF, incluindo BR", () => {
    // BR aparece no CSV do TSE como âmbito nacional, mas não é uma UF: se
    // passasse, um "Governador do BR" entraria na listagem.
    expect(isUf("BR")).toBe(false);
    expect(isUf("XX")).toBe(false);
    expect(ufName("BR")).toBeNull();
  });

  it("devolve null para entrada vazia", () => {
    expect(ufName(null)).toBeNull();
    expect(ufName(undefined)).toBeNull();
    expect(ufName("")).toBeNull();
  });
});

describe("parseUf", () => {
  it("aceita minúsculas e espaços, porque vêm de URL", () => {
    expect(parseUf("sp")).toBe("SP");
    expect(parseUf("  rj ")).toBe("RJ");
  });

  it("valor inválido vira null — sem filtro, nunca erro", () => {
    // Um parâmetro corrompido não pode virar lista vazia: isso faria o
    // eleitor concluir que não há candidatura no estado dele.
    expect(parseUf("ZZ")).toBeNull();
    expect(parseUf("São Paulo")).toBeNull();
    expect(parseUf(null)).toBeNull();
  });
});

describe("parseOffice", () => {
  it("aceita os cargos cobertos, em qualquer caixa", () => {
    expect(parseOffice("governor")).toBe("governor");
    expect(parseOffice("PRESIDENTIAL")).toBe("presidential");
  });

  it("rejeita cargo fora do escopo", () => {
    expect(parseOffice("senator")).toBeNull();
    expect(parseOffice("deputy")).toBeNull();
    expect(parseOffice("")).toBeNull();
  });
});

describe("isOffice", () => {
  it("não aceita valor não-string", () => {
    expect(isOffice(3)).toBe(false);
    expect(isOffice(null)).toBe(false);
    expect(isOffice(undefined)).toBe(false);
  });
});

describe("raceLabel", () => {
  it("governador leva o nome do estado por extenso", () => {
    expect(raceLabel("governor", "MG")).toBe("Governador — Minas Gerais");
  });

  it("presidente NUNCA leva UF, mesmo se alguma for passada", () => {
    // "Presidente — SP" sugeriria uma eleição presidencial estadual.
    expect(raceLabel("presidential", "SP")).toBe("Presidente");
    expect(raceLabel("presidential", null)).toBe("Presidente");
  });

  it("governador sem UF válida cai no rótulo genérico, sem inventar estado", () => {
    expect(raceLabel("governor", null)).toBe("Governador");
    expect(raceLabel("governor", "ZZ")).toBe("Governador");
  });
});

describe("requiresUf", () => {
  it("só o cargo estadual exige UF", () => {
    expect(requiresUf("governor")).toBe(true);
    expect(requiresUf("presidential")).toBe(false);
  });
});
