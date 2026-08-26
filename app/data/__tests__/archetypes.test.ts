import { describe, it, expect } from "vitest";
import {
  ARCHETYPES,
  calculateArchetype,
  calculateCompassPosition,
  calculateMatchStrength,
  getDominantCategories,
  slugifyCategory,
} from "../archetypes";

/**
 * O vetor de respostas é indexado por SLUG DE TÓPICO; o mapa de eixos é
 * indexado por CATEGORIA. Por isso todo teste precisa fornecer as duas
 * coisas — foi exatamente a ponte que faltava e que fazia a bússola
 * devolver {0,0} para qualquer entrada.
 */
const CATEGORIES = {
  privatizacao: "Economia e Fiscal",
  "reforma-tributaria": "Economia e Fiscal",
  "bolsa-familia-programas-sociais": "Economia e Fiscal",
  "armamento-civil": "Segurança Pública",
  policiamento: "Segurança Pública",
  "direitos-lgbtqia": "Direitos e Costumes",
  aborto: "Direitos e Costumes",
  "desmatamento-amazonia": "Meio Ambiente e Agro",
  "sistema-eleitoral": "Democracia e Institucional",
};

describe("slugifyCategory", () => {
  it("normaliza acento e espaço para a chave do mapa de eixos", () => {
    expect(slugifyCategory("Economia e Fiscal")).toBe("economia-e-fiscal");
    expect(slugifyCategory("Segurança Pública")).toBe("seguranca-publica");
    expect(slugifyCategory("Meio Ambiente e Agro")).toBe("meio-ambiente-e-agro");
    expect(slugifyCategory("Direitos e Costumes")).toBe("direitos-e-costumes");
    expect(slugifyCategory("Democracia e Institucional")).toBe(
      "democracia-e-institucional",
    );
  });
});

describe("calculateCompassPosition", () => {
  it("sem o mapa de categorias, não consegue posicionar ninguém", () => {
    const pos = calculateCompassPosition({ privatizacao: 5 });
    expect(pos).toEqual({ economic: 0, social: 0 });
  });

  it("respostas econômicas altas empurram o eixo econômico para a direita", () => {
    const pos = calculateCompassPosition(
      { privatizacao: 5, "reforma-tributaria": 5 },
      CATEGORIES,
    );
    expect(pos.economic).toBeGreaterThan(0.9);
    expect(pos.social).toBe(0);
  });

  it("respostas econômicas baixas empurram para a esquerda", () => {
    const pos = calculateCompassPosition(
      { privatizacao: 1, "bolsa-familia-programas-sociais": 1 },
      CATEGORIES,
    );
    expect(pos.economic).toBeLessThan(-0.9);
  });

  it("neutro (3) fica no centro do eixo", () => {
    const pos = calculateCompassPosition(
      { privatizacao: 3, "direitos-lgbtqia": 3 },
      CATEGORIES,
    );
    expect(pos.economic).toBeCloseTo(0);
    expect(pos.social).toBeCloseTo(0);
  });

  it("tópico sem categoria conhecida é ignorado, não conta como centro", () => {
    const comRuido = calculateCompassPosition(
      { privatizacao: 5, "topico-desconhecido": 1 },
      CATEGORIES,
    );
    const semRuido = calculateCompassPosition({ privatizacao: 5 }, CATEGORIES);
    expect(comRuido).toEqual(semRuido);
  });
});

describe("calculateArchetype", () => {
  it("identifica o Liberal (econômico à direita, social positivo)", () => {
    const result = calculateArchetype(
      {
        privatizacao: 5,
        "reforma-tributaria": 5,
        "direitos-lgbtqia": 4,
      },
      CATEGORIES,
    );
    expect(["liberal", "fiscal"]).toContain(result.id);
  });

  it("identifica o Estatista (econômico à esquerda)", () => {
    const result = calculateArchetype(
      {
        privatizacao: 1,
        "reforma-tributaria": 1,
        "bolsa-familia-programas-sociais": 1,
      },
      CATEGORIES,
    );
    expect(["estatista", "progressista"]).toContain(result.id);
  });

  it("identifica o Progressista (social positivo, econômico à esquerda)", () => {
    const result = calculateArchetype(
      {
        privatizacao: 2,
        "direitos-lgbtqia": 5,
        aborto: 5,
        "desmatamento-amazonia": 1,
      },
      CATEGORIES,
    );
    expect(result.id).toBe("progressista");
  });

  it("identifica o Conservador (social negativo, econômico à direita)", () => {
    const result = calculateArchetype(
      {
        privatizacao: 4,
        "direitos-lgbtqia": 1,
        aborto: 1,
        "armamento-civil": 1,
      },
      CATEGORIES,
    );
    expect(result.id).toBe("conservador");
  });

  it("vetor vazio cai no centro — Pragmático", () => {
    const result = calculateArchetype({}, CATEGORIES);
    expect(result.id).toBe("pragmatico");
    expect(ARCHETYPES.map((a) => a.id)).toContain(result.id);
  });

  it("sempre devolve um arquétipo válido, com nome e emoji", () => {
    const result = calculateArchetype({ privatizacao: 4 }, CATEGORIES);
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("emoji");
    expect(ARCHETYPES).toContainEqual(result);
  });
});

describe("calculateMatchStrength", () => {
  it("classifica por faixa", () => {
    expect(calculateMatchStrength(90)).toBe("strong");
    expect(calculateMatchStrength(75)).toBe("strong");
    expect(calculateMatchStrength(74)).toBe("moderate");
    expect(calculateMatchStrength(50)).toBe("moderate");
    expect(calculateMatchStrength(49)).toBe("weak");
    expect(calculateMatchStrength(0)).toBe("weak");
  });
});

describe("getDominantCategories", () => {
  it("devolve as 3 categorias com maior score do político", () => {
    const result = getDominantCategories([
      { subject: "Economia", user: 5, politician: 90 },
      { subject: "Segurança", user: 3, politician: 80 },
      { subject: "Saúde", user: 4, politician: 70 },
      { subject: "Educação", user: 2, politician: 60 },
    ]);
    expect(result).toEqual(["Economia", "Segurança", "Saúde"]);
  });

  it("descarta categorias com score zero", () => {
    const result = getDominantCategories([
      { subject: "Economia", user: 5, politician: 90 },
      { subject: "Segurança", user: 3, politician: 0 },
    ]);
    expect(result).toEqual(["Economia"]);
  });

  it("devolve vazio quando todos os scores são zero", () => {
    expect(
      getDominantCategories([
        { subject: "Economia", user: 5, politician: 0 },
        { subject: "Segurança", user: 3, politician: 0 },
      ]),
    ).toEqual([]);
  });
});
