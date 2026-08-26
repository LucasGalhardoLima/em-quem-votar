import { describe, it, expect } from "vitest";
import {
  CLOSE_THRESHOLD,
  MAX_SQUARED_DIFF,
  answeredCount,
  calculateMatches,
  matchCandidate,
  type AxisWeights,
  type MatchCandidate,
  type UserVector,
} from "../match";

/**
 * Mapa tema → categoria compartilhado pelos testes. As categorias existem
 * com acento de propósito ("Água", "Saúde"): a ordenação por categoria e a
 * de empates entre candidatos precisam usar colação pt-BR, não ordem de
 * code point (em code point "Água" viria DEPOIS de "Economia").
 */
const TOPIC_CATEGORIES: Record<string, string> = {
  "reforma-tributaria": "Economia",
  privatizacoes: "Economia",
  "saude-publica": "Saúde",
  saneamento: "Água",
  "politica-cultural": "Cultura",
};

let seq = 0;

/**
 * Fábrica mínima de candidatura. Só `displayName` e `positions` importam
 * para o cálculo; o resto é ruído de apresentação e fica com valores fixos.
 *
 * `positionCategories` cobre apenas os temas em que a candidatura TEM
 * posição — é o que o servidor entrega na listagem de resultados. Temas sem
 * posição dependem do `topicCategories` passado à função, e é assim que os
 * testes exercitam esse fallback.
 */
function makeCandidate(
  displayName: string,
  positions: Record<string, number> = {},
  overrides: Partial<MatchCandidate> = {},
): MatchCandidate {
  seq += 1;
  return {
    id: `cand-${seq}`,
    name: displayName,
    displayName,
    party: "PARTIDO",
    photoUrl: null,
    coalition: null,
    registrationStatus: "APPROVED",
    tseStatusLabel: null,
    number: null,
    positions,
    positionCategories: Object.fromEntries(
      Object.keys(positions).map((slug) => [
        slug,
        TOPIC_CATEGORIES[slug] ?? "Outros",
      ]),
    ),
    positionCount: Object.keys(positions).length,
    ...overrides,
  };
}

/** Atalho: só o percentual de compatibilidade. */
function percent(
  candidate: MatchCandidate,
  userVector: UserVector,
  axisWeights: AxisWeights = {},
): number | null {
  return matchCandidate(candidate, userVector, axisWeights, TOPIC_CATEGORIES)
    .matchPercentage;
}

describe("constantes da metodologia", () => {
  it("MAX_SQUARED_DIFF é (5-1)² = 16, a maior distância quadrática da Likert", () => {
    expect(MAX_SQUARED_DIFF).toBe(16);
  });

  it("CLOSE_THRESHOLD é 1 — o mesmo limiar descrito no texto da metodologia", () => {
    expect(CLOSE_THRESHOLD).toBe(1);
  });
});

describe("matchCandidate — regra central: um tema só conta com as DUAS pontas", () => {
  it("posição 0 (sem posição registrada) fica fora do numerador E do denominador", () => {
    const userVector = {
      "reforma-tributaria": 5,
      privatizacoes: 5,
      "saude-publica": 5,
    };
    const candidate = makeCandidate("Sem Documento", {
      "reforma-tributaria": 5,
      privatizacoes: 5,
      "saude-publica": 0,
    });

    const result = matchCandidate(candidate, userVector, {}, TOPIC_CATEGORIES);

    expect(result.comparableCount).toBe(2);
    expect(result.matchPercentage).toBe(100);
  });

  it("excluir o tema sem posição dá um número DIFERENTE de penalizá-lo", () => {
    const userVector = {
      "reforma-tributaria": 5,
      privatizacoes: 5,
      "saude-publica": 5,
    };

    // Mesma candidatura, três tratamentos do terceiro tema.
    const excluido = percent(
      makeCandidate("Excluído", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
        "saude-publica": 0,
      }),
      userVector,
    );
    // Se 0 fosse lido como "neutro" (3): distância 2 → (1 - 4/48) * 100 = 92.
    const comoNeutro = percent(
      makeCandidate("Como neutro", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
        "saude-publica": 3,
      }),
      userVector,
    );
    // Se 0 fosse lido como discordância máxima: (1 - 16/48) * 100 = 67.
    const comoDiscordancia = percent(
      makeCandidate("Como discordância", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
        "saude-publica": 1,
      }),
      userVector,
    );

    expect(excluido).toBe(100);
    expect(comoNeutro).toBe(92);
    expect(comoDiscordancia).toBe(67);
    // A diferença entre "não se sabe" e "discorda" vale 33 pontos aqui.
    expect(excluido).not.toBe(comoNeutro);
    expect(excluido).not.toBe(comoDiscordancia);
  });

  it("tema ausente do mapa de posições equivale a posição 0", () => {
    const userVector = {
      "reforma-tributaria": 5,
      privatizacoes: 5,
      "saude-publica": 5,
    };
    const ausente = matchCandidate(
      makeCandidate("Ausente", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
      }),
      userVector,
      {},
      TOPIC_CATEGORIES,
    );
    const zerado = matchCandidate(
      makeCandidate("Zerado", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
        "saude-publica": 0,
      }),
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(ausente.matchPercentage).toBe(zerado.matchPercentage);
    expect(ausente.comparableCount).toBe(zerado.comparableCount);
  });

  it("posição fora da escala Likert (6, -1) não é comparável", () => {
    const userVector = { "reforma-tributaria": 3, privatizacoes: 3 };
    const result = matchCandidate(
      makeCandidate("Fora de escala", {
        "reforma-tributaria": 6,
        privatizacoes: -1,
      }),
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.comparableCount).toBe(0);
    expect(result.matchPercentage).toBeNull();
  });
});

describe("matchCandidate — 'sem dados' nunca vira 0%", () => {
  it("matchPercentage é null, e não 0, quando comparableCount é 0", () => {
    const result = matchCandidate(
      makeCandidate("Ainda Não Catalogado", {}),
      { "reforma-tributaria": 5 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.comparableCount).toBe(0);
    // Exibir 0% difamaria quem apenas ainda não teve as posições
    // catalogadas — é obrigatoriamente null.
    expect(result.matchPercentage).toBeNull();
    expect(result.matchPercentage).not.toBe(0);
  });

  it("0% de verdade (discordância máxima) é distinto de null", () => {
    const discordanciaTotal = percent(
      makeCandidate("Oposto", { "reforma-tributaria": 5 }),
      { "reforma-tributaria": 1 },
    );
    const semDados = percent(makeCandidate("Sem dados", {}), {
      "reforma-tributaria": 1,
    });

    expect(discordanciaTotal).toBe(0);
    expect(semDados).toBeNull();
  });
});

describe("matchCandidate — fórmula (1 - somaPonderada / (pesoTotal * 16)) * 100", () => {
  it("concordância perfeita em todos os temas devolve 100", () => {
    const result = matchCandidate(
      makeCandidate("Idêntico", {
        "reforma-tributaria": 5,
        "saude-publica": 1,
        saneamento: 3,
      }),
      { "reforma-tributaria": 5, "saude-publica": 1, saneamento: 3 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.matchPercentage).toBe(100);
    expect(result.comparableCount).toBe(3);
    expect(result.agreeCount).toBe(3);
  });

  it("discordância máxima (1 contra 5 em todos os temas) devolve 0", () => {
    const result = matchCandidate(
      makeCandidate("Antípoda", {
        "reforma-tributaria": 5,
        "saude-publica": 5,
        saneamento: 1,
      }),
      { "reforma-tributaria": 1, "saude-publica": 1, saneamento: 5 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.matchPercentage).toBe(0);
    expect(result.comparableCount).toBe(3);
    expect(result.agreeCount).toBe(0);
  });

  it("distâncias intermediárias seguem a fórmula quadrática", () => {
    const userVector = { "reforma-tributaria": 1 };

    // distância 1 → (1 - 1/16) * 100 = 93,75 → 94
    expect(percent(makeCandidate("d1", { "reforma-tributaria": 2 }), userVector)).toBe(94);
    // distância 2 → (1 - 4/16) * 100 = 75
    expect(percent(makeCandidate("d2", { "reforma-tributaria": 3 }), userVector)).toBe(75);
    // distância 3 → (1 - 9/16) * 100 = 43,75 → 44
    expect(percent(makeCandidate("d3", { "reforma-tributaria": 4 }), userVector)).toBe(44);
    // distância 4 → (1 - 16/16) * 100 = 0
    expect(percent(makeCandidate("d4", { "reforma-tributaria": 5 }), userVector)).toBe(0);
  });

  it("a distância é absoluta — a ordem entre pessoa e candidatura não altera o resultado", () => {
    expect(percent(makeCandidate("a", { "reforma-tributaria": 5 }), { "reforma-tributaria": 2 })).toBe(
      percent(makeCandidate("b", { "reforma-tributaria": 2 }), { "reforma-tributaria": 5 }),
    );
  });
});

describe("matchCandidate — pesos por eixo temático", () => {
  // Um tema em concordância perfeita (Economia) e um em discordância
  // máxima (Saúde). Com pesos iguais isso dá exatamente 50%; qualquer
  // desequilíbrio de peso tem de mover o número.
  const userVector = { "reforma-tributaria": 5, "saude-publica": 5 };
  const candidate = () =>
    makeCandidate("Metade", { "reforma-tributaria": 5, "saude-publica": 1 });

  it("pesos iguais → 50%", () => {
    expect(percent(candidate(), userVector)).toBe(50);
  });

  it("dar peso alto ao eixo em que há acordo sobe o percentual", () => {
    // (1 - (1,5*0 + 0,5*16) / ((1,5+0,5) * 16)) * 100 = 75
    expect(
      percent(candidate(), userVector, { Economia: "high", "Saúde": "low" }),
    ).toBe(75);
  });

  it("dar peso alto ao eixo em que há desacordo derruba o percentual", () => {
    // (1 - (0,5*0 + 1,5*16) / ((0,5+1,5) * 16)) * 100 = 25
    expect(
      percent(candidate(), userVector, { Economia: "low", "Saúde": "high" }),
    ).toBe(25);
  });

  it("mesmas respostas com pesos diferentes produzem percentuais diferentes", () => {
    const a = percent(candidate(), userVector, { Economia: "high", "Saúde": "low" });
    const b = percent(candidate(), userVector, { Economia: "low", "Saúde": "high" });
    expect(a).not.toBe(b);
  });

  it("eixo sem peso declarado assume 'medium'", () => {
    const semDeclarar = percent(candidate(), userVector, { Economia: "high" });
    const declarandoMedium = percent(candidate(), userVector, {
      Economia: "high",
      "Saúde": "medium",
    });
    // (1 - (1,5*0 + 1,0*16) / (2,5 * 16)) * 100 = 60
    expect(semDeclarar).toBe(60);
    expect(semDeclarar).toBe(declarandoMedium);
  });

  it("nenhum peso declarado equivale a todos 'medium'", () => {
    expect(percent(candidate(), userVector, {})).toBe(
      percent(candidate(), userVector, { Economia: "medium", "Saúde": "medium" }),
    );
  });
});

describe("matchCandidate — agreeCount", () => {
  it("conta os temas com distância <= 1 (CLOSE_THRESHOLD)", () => {
    // distâncias 0, 1 e 2 → só as duas primeiras são "próximas".
    const result = matchCandidate(
      makeCandidate("Meio-termo", {
        "reforma-tributaria": 3,
        privatizacoes: 4,
        "saude-publica": 5,
      }),
      { "reforma-tributaria": 3, privatizacoes: 3, "saude-publica": 3 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.agreeCount).toBe(2);
    expect(result.comparableCount).toBe(3);
  });

  it("agreeCount é independente de comparableCount — pode ser 0 com temas comparáveis", () => {
    // distâncias 2 e 3: nada é "próximo", mas os dois temas contam.
    const result = matchCandidate(
      makeCandidate("Distante", {
        "reforma-tributaria": 5,
        privatizacoes: 4,
      }),
      { "reforma-tributaria": 3, privatizacoes: 1 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.agreeCount).toBe(0);
    expect(result.comparableCount).toBe(2);
    expect(result.matchPercentage).not.toBeNull();
  });

  it("temas sem posição documentada não entram no agreeCount", () => {
    const result = matchCandidate(
      makeCandidate("Parcial", {
        "reforma-tributaria": 3,
        privatizacoes: 0,
      }),
      { "reforma-tributaria": 3, privatizacoes: 3 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.agreeCount).toBe(1);
    expect(result.comparableCount).toBe(1);
  });
});

describe("matchCandidate — categoryScores", () => {
  const userVector = {
    saneamento: 5,
    "reforma-tributaria": 1,
    "saude-publica": 1,
    "politica-cultural": 4,
  };
  const candidate = makeCandidate("Perfil Misto", {
    saneamento: 5, // Água, distância 0
    "reforma-tributaria": 5, // Economia, distância 4
    "saude-publica": 3, // Saúde, distância 2
    // Cultura: sem posição documentada
  });

  it("devolve um percentual por categoria com temas comparáveis", () => {
    const { categoryScores } = matchCandidate(
      candidate,
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(categoryScores).toEqual([
      { category: "Água", score: 100, comparable: 1 },
      { category: "Economia", score: 0, comparable: 1 },
      { category: "Saúde", score: 75, comparable: 1 },
    ]);
  });

  it("categoria sem nenhum tema comparável não aparece na lista", () => {
    const { categoryScores } = matchCandidate(
      candidate,
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(categoryScores.map((c) => c.category)).not.toContain("Cultura");
  });

  it("ordena por nome de categoria com colação pt-BR (acento não vai para o fim)", () => {
    const { categoryScores } = matchCandidate(
      candidate,
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    // Em ordem de code point "Água" (U+00C1) viria depois de "Saúde".
    expect(categoryScores.map((c) => c.category)).toEqual([
      "Água",
      "Economia",
      "Saúde",
    ]);
  });

  it("o percentual geral pondera todos os temas juntos, não a média das categorias", () => {
    // (1 - (0 + 16 + 4) / (3 * 16)) * 100 = 58,33 → 58
    // A média simples das categorias (100, 0, 75) daria 58,33 também, então
    // um caso com categorias de tamanhos diferentes é o que distingue:
    const desbalanceado = matchCandidate(
      makeCandidate("Desbalanceado", {
        "reforma-tributaria": 1, // Economia, distância 0
        privatizacoes: 1, // Economia, distância 0
        "saude-publica": 5, // Saúde, distância 4
      }),
      { "reforma-tributaria": 1, privatizacoes: 1, "saude-publica": 1 },
      {},
      TOPIC_CATEGORIES,
    );

    // Por tema: (1 - 16/48) * 100 = 66,67 → 67. A média das categorias
    // (100 e 0) seria 50 — o percentual geral NÃO é essa média.
    expect(desbalanceado.matchPercentage).toBe(67);
    expect(desbalanceado.categoryScores).toEqual([
      { category: "Economia", score: 100, comparable: 2 },
      { category: "Saúde", score: 0, comparable: 1 },
    ]);
  });
});

describe("matchCandidate — comparisons", () => {
  const userVector = {
    "reforma-tributaria": 5,
    "politica-cultural": 4,
  };
  const candidate = makeCandidate("Meia Documentação", {
    "reforma-tributaria": 4,
  });

  it("traz uma linha para CADA tema respondido, inclusive os incomparáveis", () => {
    const { comparisons } = matchCandidate(
      candidate,
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(comparisons).toHaveLength(2);
    expect(comparisons.map((c) => c.topicSlug)).toEqual([
      "reforma-tributaria",
      "politica-cultural",
    ]);
  });

  it("a linha incomparável carrega comparable:false e distance:null (para exibir 'sem posição registrada')", () => {
    const { comparisons } = matchCandidate(
      candidate,
      userVector,
      {},
      TOPIC_CATEGORIES,
    );
    const cultura = comparisons.find((c) => c.topicSlug === "politica-cultural");

    expect(cultura).toEqual({
      topicSlug: "politica-cultural",
      topicCategory: "Cultura",
      userStance: 4,
      candidateStance: null,
      distance: null,
      comparable: false,
      close: false,
    });
  });

  it("a linha comparável traz distância, comparable:true e close", () => {
    const { comparisons } = matchCandidate(
      candidate,
      userVector,
      {},
      TOPIC_CATEGORIES,
    );
    const economia = comparisons.find(
      (c) => c.topicSlug === "reforma-tributaria",
    );

    expect(economia).toEqual({
      topicSlug: "reforma-tributaria",
      topicCategory: "Economia",
      userStance: 5,
      candidateStance: 4,
      distance: 1,
      comparable: true,
      close: true,
    });
  });

  it("tema respondido sem categoria conhecida cai em 'Outros'", () => {
    const { comparisons } = matchCandidate(
      makeCandidate("Sem categoria", {}),
      { "tema-desconhecido": 3 },
      {},
      {},
    );

    expect(comparisons[0]?.topicCategory).toBe("Outros");
  });

  it("a categoria da própria candidatura tem precedência sobre o mapa geral", () => {
    const candidato = makeCandidate("Categoria própria", {
      "reforma-tributaria": 5,
    });
    candidato.positionCategories["reforma-tributaria"] = "Economia e Fiscal";

    const { comparisons } = matchCandidate(
      candidato,
      { "reforma-tributaria": 5 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(comparisons[0]?.topicCategory).toBe("Economia e Fiscal");
  });

  it("tema pulado pela pessoa (0) não gera linha", () => {
    const { comparisons } = matchCandidate(
      makeCandidate("Completo", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
      }),
      { "reforma-tributaria": 5, privatizacoes: 0 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(comparisons).toHaveLength(1);
    expect(comparisons[0]?.topicSlug).toBe("reforma-tributaria");
  });
});

describe("matchCandidate — casos-limite", () => {
  it("vetor de respostas vazio: percentual null e nenhuma comparação", () => {
    const result = matchCandidate(
      makeCandidate("Bem Documentado", {
        "reforma-tributaria": 5,
        "saude-publica": 2,
      }),
      {},
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.matchPercentage).toBeNull();
    expect(result.comparableCount).toBe(0);
    expect(result.agreeCount).toBe(0);
    expect(result.comparisons).toEqual([]);
    expect(result.categoryScores).toEqual([]);
  });

  it("vetor só com temas pulados equivale a vetor vazio", () => {
    const result = matchCandidate(
      makeCandidate("Bem Documentado", { "reforma-tributaria": 5 }),
      { "reforma-tributaria": 0, privatizacoes: 0 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.matchPercentage).toBeNull();
    expect(result.comparisons).toEqual([]);
  });

  it("temas que a pessoa NÃO respondeu são ignorados, mesmo com posição documentada", () => {
    const userVector = { "reforma-tributaria": 3 };
    const comExtras = matchCandidate(
      makeCandidate("Com extras", {
        "reforma-tributaria": 3,
        "saude-publica": 1,
        saneamento: 5,
      }),
      userVector,
      {},
      TOPIC_CATEGORIES,
    );
    const semExtras = matchCandidate(
      makeCandidate("Sem extras", { "reforma-tributaria": 3 }),
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(comExtras.comparableCount).toBe(1);
    expect(comExtras.comparisons).toHaveLength(1);
    expect(comExtras.matchPercentage).toBe(semExtras.matchPercentage);
    expect(comExtras.categoryScores).toEqual(semExtras.categoryScores);
  });

  it("devolve a própria candidatura junto do resultado", () => {
    const candidate = makeCandidate("Fulana", { "reforma-tributaria": 3 });
    const result = matchCandidate(candidate, { "reforma-tributaria": 3 });
    expect(result.candidate).toBe(candidate);
  });
});

describe("calculateMatches — ordenação", () => {
  const userVector = { "reforma-tributaria": 3 };

  it("ordena por compatibilidade decrescente", () => {
    const results = calculateMatches(
      [
        makeCandidate("Baixa", { "reforma-tributaria": 5 }), // 75
        makeCandidate("Alta", { "reforma-tributaria": 3 }), // 100
        makeCandidate("Média", { "reforma-tributaria": 4 }), // 94
      ],
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(results.map((r) => r.matchPercentage)).toEqual([100, 94, 75]);
    expect(results.map((r) => r.candidate.displayName)).toEqual([
      "Alta",
      "Média",
      "Baixa",
    ]);
  });

  it("empate é desfeito em ordem alfabética pt-BR — nunca por partido ou tamanho de bancada", () => {
    const results = calculateMatches(
      [
        makeCandidate("Bruno", { "reforma-tributaria": 3 }),
        makeCandidate("Álvaro", { "reforma-tributaria": 3 }),
      ],
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    // Em ordem de code point "Á" (U+00C1) viria depois de "B" (U+0042);
    // com colação pt-BR "Álvaro" vem antes.
    expect(results.map((r) => r.candidate.displayName)).toEqual([
      "Álvaro",
      "Bruno",
    ]);
    expect(results.map((r) => r.matchPercentage)).toEqual([100, 100]);
  });

  it("candidaturas sem tema comparável vão para o FIM, independentemente do nome", () => {
    const results = calculateMatches(
      [
        makeCandidate("Ana Sem Dados", {}),
        makeCandidate("Zeca Com Dados", { "reforma-tributaria": 5 }), // 75
      ],
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(results.map((r) => r.candidate.displayName)).toEqual([
      "Zeca Com Dados",
      "Ana Sem Dados",
    ]);
    expect(results[1]?.matchPercentage).toBeNull();
  });

  it("null vai para o fim mesmo perdendo para a pior compatibilidade possível (0%)", () => {
    const results = calculateMatches(
      [
        makeCandidate("Sem Dados", {}),
        makeCandidate("Oposto Total", { "reforma-tributaria": 5 }),
      ],
      { "reforma-tributaria": 1 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(results.map((r) => r.matchPercentage)).toEqual([0, null]);
  });

  it("entre candidaturas sem dados, a ordem é alfabética pt-BR", () => {
    const results = calculateMatches(
      [
        makeCandidate("Beto", {}),
        makeCandidate("Ávila", {}),
        makeCandidate("Carlos", {}),
      ],
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    expect(results.map((r) => r.candidate.displayName)).toEqual([
      "Ávila",
      "Beto",
      "Carlos",
    ]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(calculateMatches([], userVector, {}, TOPIC_CATEGORIES)).toEqual([]);
  });

  it("com vetor vazio todas as candidaturas ficam com percentual null, em ordem alfabética", () => {
    const results = calculateMatches(
      [
        makeCandidate("Bruno", { "reforma-tributaria": 3 }),
        makeCandidate("Álvaro", { "reforma-tributaria": 5 }),
      ],
      {},
      {},
      TOPIC_CATEGORIES,
    );

    expect(results.map((r) => r.matchPercentage)).toEqual([null, null]);
    expect(results.map((r) => r.candidate.displayName)).toEqual([
      "Álvaro",
      "Bruno",
    ]);
  });

  it("preserva um resultado por candidatura", () => {
    const candidates = [
      makeCandidate("A", { "reforma-tributaria": 3 }),
      makeCandidate("B", { "reforma-tributaria": 4 }),
      makeCandidate("C", {}),
    ];
    const results = calculateMatches(candidates, userVector, {}, TOPIC_CATEGORIES);

    expect(results).toHaveLength(3);
    expect(new Set(results.map((r) => r.candidate.id))).toEqual(
      new Set(candidates.map((c) => c.id)),
    );
  });
});

describe("answeredCount", () => {
  it("conta apenas respostas dentro da escala 1–5", () => {
    expect(
      answeredCount({
        a: 1,
        b: 3,
        c: 5,
      }),
    ).toBe(3);
  });

  it("ignora 0 (tema pulado) e valores fora da escala", () => {
    expect(
      answeredCount({
        pulado: 0,
        valido: 3,
        acimaDaEscala: 6,
        negativo: -1,
        outroValido: 1,
      }),
    ).toBe(2);
  });

  it("vetor vazio conta 0", () => {
    expect(answeredCount({})).toBe(0);
  });
});
