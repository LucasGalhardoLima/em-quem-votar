import { describe, it, expect } from "vitest";
import {
  CLOSE_THRESHOLD,
  MAX_SQUARED_DIFF,
  MIN_COMPARABLE_TOPICS,
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
    // O tema sem posição não entra na conta. Com shrinkage o valor não é
    // 100 (dois temas não sustentam certeza), mas tem de ser IDÊNTICO ao de
    // uma candidatura que só documentou esses dois — é isso que "ficar fora
    // do denominador" significa.
    const soOsDois = matchCandidate(
      makeCandidate("Só os dois", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
      }),
      userVector,
      {},
      TOPIC_CATEGORIES,
    );
    expect(result.matchPercentage).toBe(soOsDois.matchPercentage);
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

    // O que importa é a ORDEM e a distinção, não o valor absoluto: excluir
    // o tema tem de ser melhor que lê-lo como neutro, e muito melhor que
    // lê-lo como discordância. É a diferença entre "não se sabe" e "discorda".
    expect(excluido!).toBeGreaterThan(comoNeutro!);
    expect(comoNeutro!).toBeGreaterThan(comoDiscordancia!);
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

  it("discordância documentada é distinta de ausência de dado", () => {
    const discordanciaTotal = percent(
      makeCandidate("Oposto", { "reforma-tributaria": 5 }),
      { "reforma-tributaria": 1 },
    );
    const semDados = percent(makeCandidate("Sem dados", {}), {
      "reforma-tributaria": 1,
    });

    // Discordar é um número; não ter posição registrada é null. Com o
    // shrinkage o número não é mais 0 — um único tema não sustenta a
    // afirmação "incompatível em tudo" —, mas continua abaixo do ponto de
    // "não sei nada" (75%), que é o que importa para o leitor.
    expect(semDados).toBeNull();
    expect(discordanciaTotal).not.toBeNull();
    expect(discordanciaTotal!).toBeLessThan(75);
  });
});

describe("matchCandidate — fórmula com shrinkage", () => {
  // pct = (1 − (Σw·d² + k·4) / ((Σw + k) · 16)) · 100, com k = SHRINKAGE_TOPICS.
  // Os k temas virtuais valem PRIOR_SQUARED_DIFF = 4, a distância quadrática
  // esperada entre duas respostas Likert independentes — 4/16 = 75%.
  const PRIOR_PCT = 75;

  it("concordância perfeita fica acima do prior, mas nunca em 100", () => {
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

    // 100% afirmaria certeza que três temas não sustentam.
    expect(result.matchPercentage).toBeGreaterThan(PRIOR_PCT);
    expect(result.matchPercentage).toBeLessThan(100);
    expect(result.comparableCount).toBe(3);
    expect(result.agreeCount).toBe(3);
  });

  it("discordância máxima fica abaixo do prior, mas nunca em 0", () => {
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

    expect(result.matchPercentage).toBeLessThan(PRIOR_PCT);
    expect(result.matchPercentage).toBeGreaterThan(0);
    expect(result.comparableCount).toBe(3);
    expect(result.agreeCount).toBe(0);
  });

  it("a escala abre conforme a base documental cresce", () => {
    // O teto sobe e o piso desce à medida que há mais evidência. É a razão
    // de ser do shrinkage: pouca documentação não autoriza um extremo.
    const tetos: number[] = [];
    const pisos: number[] = [];
    for (const n of [3, 8, 16]) {
      const slugs = Array.from({ length: n }, (_, i) => `tema-${i}`);
      const cats = Object.fromEntries(slugs.map((s) => [s, "Economia"]));
      const respostas = Object.fromEntries(slugs.map((s) => [s, 1]));
      tetos.push(
        matchCandidate(
          makeCandidate(`teto-${n}`, Object.fromEntries(slugs.map((s) => [s, 1]))),
          respostas, {}, cats,
        ).matchPercentage!,
      );
      pisos.push(
        matchCandidate(
          makeCandidate(`piso-${n}`, Object.fromEntries(slugs.map((s) => [s, 5]))),
          respostas, {}, cats,
        ).matchPercentage!,
      );
    }
    expect(tetos[0]).toBeLessThan(tetos[1]);
    expect(tetos[1]).toBeLessThan(tetos[2]);
    expect(pisos[0]).toBeGreaterThan(pisos[1]);
    expect(pisos[1]).toBeGreaterThan(pisos[2]);
  });

  it("distância 2 num único tema devolve exatamente o prior", () => {
    // Invariante elegante do desenho: a distância quadrática 4 é o próprio
    // valor do tema virtual, então a evidência não move o número.
    expect(
      percent(makeCandidate("d2", { "reforma-tributaria": 3 }), {
        "reforma-tributaria": 1,
      }),
    ).toBe(PRIOR_PCT);
  });

  it("o percentual é monotônico decrescente na distância", () => {
    const userVector = { "reforma-tributaria": 1 };
    const p = (stance: number) =>
      percent(makeCandidate(`d${stance}`, { "reforma-tributaria": stance }), userVector)!;

    expect(p(1)).toBeGreaterThan(p(2));
    expect(p(2)).toBeGreaterThan(p(3));
    expect(p(3)).toBeGreaterThan(p(4));
    expect(p(4)).toBeGreaterThan(p(5));
  });

  it("REGRESSÃO: documentar mais não derruba a compatibilidade", () => {
    // O defeito que o shrinkage corrige. Uma candidatura em concordância
    // perfeita não pode PERDER percentual por ter mais temas registrados —
    // antes disto, o pódio era ocupado por quem tinha menos documentação.
    const slugs = Array.from({ length: 12 }, (_, i) => `tema-${i}`);
    const cats = Object.fromEntries(slugs.map((s) => [s, "Economia"]));
    const respostas = Object.fromEntries(slugs.map((s) => [s, 4]));

    const com3 = matchCandidate(
      makeCandidate("três", Object.fromEntries(slugs.slice(0, 3).map((s) => [s, 4]))),
      respostas, {}, cats,
    ).matchPercentage!;
    const com12 = matchCandidate(
      makeCandidate("doze", Object.fromEntries(slugs.map((s) => [s, 4]))),
      respostas, {}, cats,
    ).matchPercentage!;

    expect(com12).toBeGreaterThan(com3);
  });

  it("a distância é absoluta — a ordem entre pessoa e candidatura não altera o resultado", () => {
    expect(percent(makeCandidate("a", { "reforma-tributaria": 5 }), { "reforma-tributaria": 2 })).toBe(
      percent(makeCandidate("b", { "reforma-tributaria": 2 }), { "reforma-tributaria": 5 }),
    );
  });
});

describe("matchCandidate — pesos por eixo temático", () => {
  // Um tema em concordância perfeita (Economia) e um em discordância
  // máxima (Saúde). Com pesos iguais o resultado fica no meio; qualquer
  // desequilíbrio de peso tem de mover o número. Os valores absolutos
  // dependem do shrinkage, então o que se afirma aqui é a DIREÇÃO.
  const userVector = { "reforma-tributaria": 5, "saude-publica": 5 };
  const candidate = () =>
    makeCandidate("Metade", { "reforma-tributaria": 5, "saude-publica": 1 });

  it("pesos iguais deixam o resultado entre os dois extremos", () => {
    const meio = percent(candidate(), userVector)!;
    const soAcordo = percent(
      makeCandidate("Só acordo", { "reforma-tributaria": 5 }),
      { "reforma-tributaria": 5 },
    )!;
    const soDesacordo = percent(
      makeCandidate("Só desacordo", { "saude-publica": 1 }),
      { "saude-publica": 5 },
    )!;
    expect(meio).toBeLessThan(soAcordo);
    expect(meio).toBeGreaterThan(soDesacordo);
  });

  it("dar peso alto ao eixo em que há acordo sobe o percentual", () => {
    const base = percent(candidate(), userVector)!;
    const acordoPesado = percent(candidate(), userVector, {
      Economia: "high",
      "Saúde": "low",
    })!;
    expect(acordoPesado).toBeGreaterThan(base);
  });

  it("dar peso alto ao eixo em que há desacordo derruba o percentual", () => {
    const base = percent(candidate(), userVector)!;
    const desacordoPesado = percent(candidate(), userVector, {
      Economia: "low",
      "Saúde": "high",
    })!;
    expect(desacordoPesado).toBeLessThan(base);
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
    // O que se afirma é a equivalência, não o valor: omitir o eixo tem de
    // dar exatamente o mesmo que declará-lo "medium".
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

    // Uma entrada por categoria com tema comparável, em colação pt-BR.
    // Os scores seguem o mesmo shrinkage do percentual geral, então o que
    // se afirma é a estrutura e a ORDEM entre eles: Água (distância 0) >
    // Saúde (distância 2) > Economia (distância 4).
    expect(categoryScores.map((c) => c.category)).toEqual([
      "Água",
      "Economia",
      "Saúde",
    ]);
    expect(categoryScores.map((c) => c.comparable)).toEqual([1, 1, 1]);

    const porCategoria = Object.fromEntries(
      categoryScores.map((c) => [c.category, c.score!]),
    );
    expect(porCategoria["Água"]).toBeGreaterThan(porCategoria["Saúde"]);
    expect(porCategoria["Saúde"]).toBeGreaterThan(porCategoria["Economia"]);
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

    // Economia tem DOIS temas em acordo e Saúde UM em desacordo. Se o geral
    // fosse a média das categorias, ele ficaria no meio das duas; como ele
    // pondera por TEMA, tem de pender para o lado que tem mais temas.
    const [economia, saude] = desbalanceado.categoryScores;
    expect(economia.category).toBe("Economia");
    expect(economia.comparable).toBe(2);
    expect(saude.category).toBe("Saúde");
    expect(saude.comparable).toBe(1);

    const mediaDasCategorias = (economia.score! + saude.score!) / 2;
    expect(desbalanceado.matchPercentage).toBeGreaterThan(mediaDasCategorias);
    expect(desbalanceado.matchPercentage).toBeLessThan(economia.score!);
    expect(desbalanceado.matchPercentage).toBeGreaterThan(saude.score!);
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

  it("peso corrompido no localStorage não produz NaN%", () => {
    // Regressão: os pesos são persistidos em localStorage e voltam como
    // vierem. Um "HIGH" (ou peso de uma versão antiga do store) saía de
    // getMultiplier como undefined, a soma virava NaN, e a guarda
    // `totalWeight <= 0` não pegava — porque NaN <= 0 é false. Resultado na
    // tela: "NaN%" com a barra de compatibilidade cheia.
    const pesosCorrompidos = {
      Economia: "HIGH",
      Saúde: "Alta",
      Água: "",
    } as unknown as AxisWeights;

    const result = matchCandidate(
      makeCandidate("Bem Documentado", {
        "reforma-tributaria": 5,
        "saude-publica": 2,
        saneamento: 4,
      }),
      { "reforma-tributaria": 4, "saude-publica": 2, saneamento: 4 },
      pesosCorrompidos,
      TOPIC_CATEGORIES,
    );

    expect(result.matchPercentage).not.toBeNull();
    expect(Number.isFinite(result.matchPercentage!)).toBe(true);
    expect(result.matchPercentage).toBeGreaterThanOrEqual(0);
    expect(result.matchPercentage).toBeLessThanOrEqual(100);
    for (const categoria of result.categoryScores) {
      expect(categoria.score === null || Number.isFinite(categoria.score)).toBe(true);
    }
  });
});

describe("matchCandidate — base documental mínima", () => {
  // Vinte temas respondidos, como quem faz o quiz inteiro.
  const vinteRespostas: UserVector = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`tema-${i}`, 5]),
  );
  const vinteCategorias = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`tema-${i}`, "Economia"]),
  );

  it("um único tema comparável não vira percentual — é o caso real da DC", () => {
    // A proposta protocolada da DC rendeu 1 tema de 20: o documento repete a
    // mesma frase em 30 subseções. Sem piso, um acerto nesse único tema daria
    // 100% e o primeiro lugar do pódio.
    const result = matchCandidate(
      makeCandidate("Template", { "tema-0": 5 }),
      vinteRespostas,
      {},
      vinteCategorias,
    );

    expect(result.comparableCount).toBe(1);
    expect(result.insufficientBase).toBe(true);
    expect(result.matchPercentage).toBeNull();
  });

  it("no piso o percentual volta a ser publicado", () => {
    const positions = Object.fromEntries(
      Array.from({ length: MIN_COMPARABLE_TOPICS }, (_, i) => [`tema-${i}`, 5]),
    );
    const result = matchCandidate(
      makeCandidate("No piso", positions),
      vinteRespostas,
      {},
      vinteCategorias,
    );

    expect(result.comparableCount).toBe(MIN_COMPARABLE_TOPICS);
    expect(result.insufficientBase).toBe(false);
    expect(result.matchPercentage).not.toBeNull();
  });

  it("quiz curto não é punido: 2 comparáveis de 3 respondidos publica", () => {
    // O piso acompanha o tamanho do quiz. Dois terços de cobertura é base,
    // ainda que a contagem absoluta seja menor que MIN_COMPARABLE_TOPICS.
    const result = matchCandidate(
      makeCandidate("Quiz curto", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
      }),
      { "reforma-tributaria": 5, privatizacoes: 5, "saude-publica": 5 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.comparableCount).toBe(2);
    expect(result.insufficientBase).toBe(false);
    expect(result.matchPercentage).not.toBeNull();
  });

  it("nenhum tema comparável é AUSÊNCIA, não base fraca", () => {
    // Os dois casos exibem "sem percentual", mas dizem coisas diferentes e a
    // interface precisa distingui-los.
    const result = matchCandidate(
      makeCandidate("Sem nada", {}),
      vinteRespostas,
      {},
      vinteCategorias,
    );

    expect(result.comparableCount).toBe(0);
    expect(result.insufficientBase).toBe(false);
    expect(result.matchPercentage).toBeNull();
  });

  it("base fraca não ultrapassa base sólida no pódio", () => {
    const results = calculateMatches(
      [
        // Casaria 100% — mas num tema só.
        makeCandidate("Base fraca", { "tema-0": 5 }),
        // Erra por 1 em quatro temas: percentual alto, base real.
        makeCandidate("Base sólida", {
          "tema-0": 4,
          "tema-1": 4,
          "tema-2": 4,
          "tema-3": 4,
        }),
      ],
      vinteRespostas,
      {},
      vinteCategorias,
    );

    expect(results[0].candidate.displayName).toBe("Base sólida");
    expect(results[0].matchPercentage).not.toBeNull();
    expect(results[1].candidate.displayName).toBe("Base fraca");
    expect(results[1].matchPercentage).toBeNull();
  });
});

describe("calculateMatches — ordenação", () => {
  const userVector = { "reforma-tributaria": 3 };

  it("ordena por compatibilidade decrescente", () => {
    const results = calculateMatches(
      [
        makeCandidate("Baixa", { "reforma-tributaria": 5 }), // distância 2
        makeCandidate("Alta", { "reforma-tributaria": 3 }), // distância 0
        makeCandidate("Média", { "reforma-tributaria": 4 }), // distância 1
      ],
      userVector,
      {},
      TOPIC_CATEGORIES,
    );

    const pcts = results.map((r) => r.matchPercentage!);
    expect(pcts[0]).toBeGreaterThan(pcts[1]);
    expect(pcts[1]).toBeGreaterThan(pcts[2]);
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
    // Empate de verdade: mesma resposta, mesma posição, mesmo número.
    expect(results[0].matchPercentage).toBe(results[1].matchPercentage);
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

    // A candidatura com discordância documentada vem PRIMEIRO, com número;
    // a sem dado vai para o fim com null. Discordar é informação, não ter
    // posição registrada não é — e a ordem tem de refletir isso.
    expect(results[0].candidate.displayName).toBe("Oposto Total");
    expect(results[0].matchPercentage).not.toBeNull();
    expect(results[1].matchPercentage).toBeNull();
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
