import { describe, it, expect } from "vitest";
import {
  ABSOLUTE_MIN_COMPARABLE_TOPICS,
  CLOSE_THRESHOLD,
  MAX_SQUARED_DIFF,
  MIN_COMPARABLE_TOPICS,
  PRIOR_SQUARED_DIFF,
  SHRINKAGE_TOPICS,
  answeredCount,
  calculateMatches,
  matchCandidate,
  type AxisWeights,
  type MatchCandidate,
  type UserVector,
} from "../match";
import {
  CLOSE_THRESHOLD as STANCE_CLOSE_THRESHOLD,
  IMPORTANCE_LEVELS,
  agreementFor,
} from "../stance";

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
    // Dois temas, e não um: o piso de base documental (ver
    // ABSOLUTE_MIN_COMPARABLE_TOPICS) não publica percentual tirado de uma
    // comparação só. O que este teste afirma é sobre o número vs. o null, não
    // sobre o tamanho da base.
    const respostas = { "reforma-tributaria": 1, privatizacoes: 1 };
    const discordanciaTotal = percent(
      makeCandidate("Oposto", { "reforma-tributaria": 5, privatizacoes: 5 }),
      respostas,
    );
    const semDados = percent(makeCandidate("Sem dados", {}), respostas);

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

  it("distância 2 em toda a base devolve exatamente o prior", () => {
    // Invariante elegante do desenho: a distância quadrática 4 é o próprio
    // valor do tema virtual, então a evidência não move o número — e por isso
    // o resultado independe de quantos temas comparáveis existem.
    expect(
      percent(makeCandidate("d2", { "reforma-tributaria": 3, privatizacoes: 3 }), {
        "reforma-tributaria": 1,
        privatizacoes: 1,
      }),
    ).toBe(PRIOR_PCT);
  });

  it("o percentual é monotônico decrescente na distância", () => {
    // Dois temas na mesma distância: a média quadrática é a mesma de um tema
    // só, mas a base agora alcança o piso e o percentual é publicado.
    const userVector = { "reforma-tributaria": 1, privatizacoes: 1 };
    const p = (stance: number) =>
      percent(
        makeCandidate(`d${stance}`, {
          "reforma-tributaria": stance,
          privatizacoes: stance,
        }),
        userVector,
      )!;

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
    // Com um tema só os dois lados dariam null e a igualdade seria vazia; com
    // dois, a comparação é entre percentuais de verdade.
    const a = percent(
      makeCandidate("a", { "reforma-tributaria": 5, privatizacoes: 5 }),
      { "reforma-tributaria": 2, privatizacoes: 2 },
    );
    const b = percent(
      makeCandidate("b", { "reforma-tributaria": 2, privatizacoes: 2 }),
      { "reforma-tributaria": 5, privatizacoes: 5 },
    );

    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });
});

/**
 * REGRESSÃO — o prior é medido em TEMAS, nunca em unidades de peso.
 *
 * O defeito: `SHRINKAGE_TOPICS` (unidade: tema) era somado direto a
 * `totalWeight` (unidade: peso, com multiplicadores 1,5 / 1,0 / 0,5). Somar as
 * duas grandezas fazia a FORÇA do prior depender do peso médio que a pessoa
 * atribuiu aos eixos: o k efetivo em temas era `k / pesoMédio`, ou seja 6 temas
 * virtuais para quem marcou tudo "Baixo" e 2 para quem marcou tudo "Alto".
 *
 * Consequência que estes testes travam: duas candidaturas em acordo perfeito
 * em 3 de 3 temas saíam com percentuais DIFERENTES — 83% se os temas
 * documentados caíssem num eixo marcado "Baixo", 88% em "Médio", 90% em
 * "Alto". O pódio passava a depender de qual eixo o documento cobre, e não de
 * quanto a candidatura concorda com a pessoa.
 *
 * O peso tem UMA função legítima: dizer quanto cada tema pesa em relação aos
 * outros. Ele não é evidência — dobrar a importância declarada não documenta
 * nenhum tema a mais, logo não pode comprar certeza.
 */
describe("matchCandidate — o peso do eixo não mexe na força do prior", () => {
  const TRES = ["reforma-tributaria", "privatizacoes", "saude-publica"];

  /** Aplica o mesmo nível de importância a todos os eixos do mapa. */
  const todosOsEixos = (level: (typeof IMPORTANCE_LEVELS)[number]): AxisWeights =>
    Object.fromEntries(
      Object.values(TOPIC_CATEGORIES).map((c) => [c, level]),
    ) as AxisWeights;

  it("acordo perfeito em 3 de 3 dá o MESMO percentual em qualquer nível de importância", () => {
    const userVector = Object.fromEntries(TRES.map((s) => [s, 5]));
    const candidate = () =>
      makeCandidate("Idêntico", Object.fromEntries(TRES.map((s) => [s, 5])));

    const porNivel = IMPORTANCE_LEVELS.map((level) =>
      percent(candidate(), userVector, todosOsEixos(level)),
    );

    // Antes: [83, 88, 90] — três números para a mesma concordância.
    expect(new Set(porNivel).size).toBe(1);
    expect(porNivel[0]).toBe(88);
  });

  it("discordância máxima em 3 de 3 dá o MESMO percentual em qualquer nível", () => {
    const userVector = Object.fromEntries(TRES.map((s) => [s, 5]));
    const candidate = () =>
      makeCandidate("Antípoda", Object.fromEntries(TRES.map((s) => [s, 1])));

    const porNivel = IMPORTANCE_LEVELS.map((level) =>
      percent(candidate(), userVector, todosOsEixos(level)),
    );

    // Antes: [50, 38, 30] — marcar tudo como "Baixo" AMACIAVA a discordância.
    expect(new Set(porNivel).size).toBe(1);
    expect(porNivel[0]).toBe(38);
  });

  it("multiplicar todos os pesos por uma constante não altera o resultado", () => {
    // A propriedade geral: o peso é relativo. Uma escala global é a mesma
    // ordenação de temas, logo tem de ser o mesmo número — inclusive num
    // perfil misto, com distâncias diferentes por eixo.
    const userVector = {
      "reforma-tributaria": 5, // Economia
      privatizacoes: 2, // Economia
      "saude-publica": 1, // Saúde
      saneamento: 4, // Água
    };
    const candidate = () =>
      makeCandidate("Misto", {
        "reforma-tributaria": 5, // d = 0
        privatizacoes: 5, // d = 3
        "saude-publica": 3, // d = 2
        saneamento: 3, // d = 1
      });

    const porNivel = IMPORTANCE_LEVELS.map((level) =>
      percent(candidate(), userVector, todosOsEixos(level)),
    );

    expect(new Set(porNivel).size).toBe(1);
  });

  it("o score de uma categoria não depende da importância dada àquela categoria", () => {
    // O mesmo defeito aparecia por categoria: como cada categoria tem um único
    // peso, `totalWeight + k` fazia "Saúde marcada Alto" e "Saúde marcada
    // Baixo" pontuarem diferente com EXATAMENTE a mesma distância documentada.
    const userVector = { "saude-publica": 5, saneamento: 5 };
    const candidate = () =>
      makeCandidate("Perfil", { "saude-publica": 2, saneamento: 4 });

    const scoreDeSaude = (level: (typeof IMPORTANCE_LEVELS)[number]) =>
      matchCandidate(candidate(), userVector, { Saúde: level }, TOPIC_CATEGORIES)
        .categoryScores.find((c) => c.category === "Saúde")!.score;

    const porNivel = IMPORTANCE_LEVELS.map(scoreDeSaude);
    expect(new Set(porNivel).size).toBe(1);
  });

  it("o peso continua reordenando temas ENTRE SI — o conserto não o neutraliza", () => {
    // Contraprova do teste acima: a correção não pode ter transformado o peso
    // em enfeite. Com acordo num eixo e desacordo no outro, mover a
    // importância de um para o outro TEM de mover o número.
    const userVector = { "reforma-tributaria": 5, "saude-publica": 5 };
    const candidate = () =>
      makeCandidate("Metade", { "reforma-tributaria": 5, "saude-publica": 1 });

    const acordoPesado = percent(candidate(), userVector, {
      Economia: "high",
      Saúde: "low",
    })!;
    const desacordoPesado = percent(candidate(), userVector, {
      Economia: "low",
      Saúde: "high",
    })!;

    expect(acordoPesado).toBeGreaterThan(desacordoPesado);
  });
});

/**
 * Os números que a metodologia §3 PUBLICA, reproduzidos pela própria função.
 *
 * A metodologia é o contrato público da plataforma: cada percentual citado no
 * texto tem de sair do código, não da memória de quem escreveu. Foi assim que
 * o texto passou a afirmar "com dezoito, o teto sobe para 95%" — 95% é o teto
 * de TREZE temas; dezoito dão 96%. O `n` foi trocado ao copiar da tabela.
 *
 * Fórmulas fechadas, com d² médio ponderado = 0 (acordo total) ou 16
 * (desacordo total), k = 3 temas virtuais valendo 4:
 *
 *   teto(n) = 100 − 75/(n+3)      piso(n) = 225/(n+3)
 */
describe("metodologia §3 — os percentuais publicados saem da função", () => {
  const tetoEPiso = (n: number) => {
    const slugs = Array.from({ length: n }, (_, i) => `tema-${i}`);
    const cats = Object.fromEntries(slugs.map((s) => [s, "Economia"]));
    const respostas = Object.fromEntries(slugs.map((s) => [s, 1]));
    const run = (stance: number) =>
      matchCandidate(
        makeCandidate(`n${n}-${stance}`, Object.fromEntries(slugs.map((s) => [s, stance]))),
        respostas,
        {},
        cats,
      ).matchPercentage;
    return { teto: run(1), piso: run(5) };
  };

  it.each([
    [2, 85, 45],
    [3, 88, 38],
    [13, 95, 14],
    [18, 96, 11],
    [24, 97, 8],
  ])("com %i temas o teto é %i%% e o piso %i%%", (n, teto, piso) => {
    expect(tetoEPiso(n)).toEqual({ teto, piso });
  });

  it("as fórmulas fechadas do texto batem com a função para todo n de 2 a 30", () => {
    // Começa em 2 porque é onde o percentual passa a ser publicável: um único
    // tema comparável não vira número (ABSOLUTE_MIN_COMPARABLE_TOPICS), e o
    // texto da metodologia diz isso no mesmo parágrafo em que publica as
    // fórmulas.
    for (let n = 2; n <= 30; n += 1) {
      const { teto, piso } = tetoEPiso(n);
      expect(teto).toBe(Math.round(100 - 75 / (n + SHRINKAGE_TOPICS)));
      expect(piso).toBe(Math.round(225 / (n + SHRINKAGE_TOPICS)));
    }
  });

  it("com n = 1 a fórmula existe, mas nada é publicado", () => {
    // A forma fechada continua definida em n=1 (teto 81, piso 56); o piso de
    // base documental é que não deixa publicar um número tirado de uma
    // comparação só. Duas regras diferentes, e o texto descreve as duas.
    expect(tetoEPiso(1)).toEqual({ teto: null, piso: null });
  });

  it("REGRESSÃO: meio-ponto exato arredonda para cima, não para baixo", () => {
    // Sete temas em desacordo total valem exatamente 22,5%. A conta escrita
    // como `(1 − 124/160) × 100` dá 22,499999999999996 em IEEE-754 e saía 22,
    // enquanto 87,5 — que cai redondo em binário — saía 88. O mesmo
    // meio-ponto arredondava para lados diferentes conforme o caminho
    // aritmético, e a diferença é um ponto no percentual que ordena o pódio.
    expect(tetoEPiso(7).piso).toBe(23);
    expect(tetoEPiso(3).teto).toBe(88); // 87,5 — a outra ponta da mesma regra
  });

  it("o prior publicado (75%) é PRIOR_SQUARED_DIFF sobre MAX_SQUARED_DIFF", () => {
    expect((1 - PRIOR_SQUARED_DIFF / MAX_SQUARED_DIFF) * 100).toBe(75);
  });

  it("teto e piso convergem para o prior quando há pouca evidência", () => {
    // Coerência do desenho: com n → 0 os dois extremos encostam em 75%. Medido
    // na menor base publicável (2) contra a seguinte (3).
    const { teto, piso } = tetoEPiso(ABSOLUTE_MIN_COMPARABLE_TOPICS);
    expect(teto).toBeLessThan(
      100 - 75 / (ABSOLUTE_MIN_COMPARABLE_TOPICS + 1 + SHRINKAGE_TOPICS),
    );
    expect(piso).toBeGreaterThan(
      225 / (ABSOLUTE_MIN_COMPARABLE_TOPICS + 1 + SHRINKAGE_TOPICS),
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
    // Dois temas de cada lado: um só não alcança o piso de base documental e
    // sairia null, tornando as comparações abaixo vazias.
    const soAcordo = percent(
      makeCandidate("Só acordo", { "reforma-tributaria": 5, privatizacoes: 5 }),
      { "reforma-tributaria": 5, privatizacoes: 5 },
    )!;
    const soDesacordo = percent(
      makeCandidate("Só desacordo", { "saude-publica": 1, saneamento: 1 }),
      { "saude-publica": 5, saneamento: 5 },
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

  it("resposta corrompida no localStorage não vira tema comparável", () => {
    // Mesma origem do teste acima, outro campo: as RESPOSTAS também voltam do
    // localStorage. `true`, `"5"` e `[3]` atravessavam a checagem de escala por
    // coerção (`true >= 1` é verdadeiro), viravam distância e saíam na tela
    // como posição documentada de uma pessoa real.
    const respostasCorrompidas = {
      "reforma-tributaria": true,
      privatizacoes: "5",
      "saude-publica": [3],
      saneamento: 5, // a única resposta legítima
    } as unknown as UserVector;

    const result = matchCandidate(
      makeCandidate("Bem Documentado", {
        "reforma-tributaria": 1,
        privatizacoes: 1,
        "saude-publica": 1,
        saneamento: 5,
      }),
      respostasCorrompidas,
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.comparableCount).toBe(1);
    expect(result.comparisons.map((c) => c.topicSlug)).toEqual(["saneamento"]);
    expect(answeredCount(respostasCorrompidas)).toBe(1);
  });

  it("posição corrompida no banco não vira posição documentada", () => {
    const result = matchCandidate(
      makeCandidate("Lixo de serialização", {
        "reforma-tributaria": true,
        privatizacoes: "5",
        "saude-publica": 3.5,
      } as unknown as Record<string, number>),
      {
        "reforma-tributaria": 5,
        privatizacoes: 5,
        "saude-publica": 5,
      },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.comparableCount).toBe(0);
    expect(result.matchPercentage).toBeNull();
    expect(result.comparisons.every((c) => c.comparable === false)).toBe(true);
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

/**
 * "Não há percentual" e "não há base" são perguntas DIFERENTES, e /resultado
 * consome as duas: a segunda decide o estado vazio, que afirma ao leitor que
 * nenhuma candidatura tem posição registrada com fonte — uma afirmação sobre
 * o banco, não uma frase de enfeite. A rota já perguntou a primeira no lugar
 * da segunda: com todas as candidaturas abaixo do piso, ela dizia que nenhuma
 * tinha posição quando todas tinham uma ou duas.
 *
 * Os testes abaixo fixam a diferença. Não é caso hipotético: import de
 * posições grava tudo pendente, então base esparsa é o estado inicial normal
 * de qualquer ambiente novo.
 */
describe("calculateMatches — base esparsa não é ausência de base", () => {
  const vinteRespostas: UserVector = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`tema-${i}`, 5]),
  );
  const vinteCategorias = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`tema-${i}`, "Economia"]),
  );

  it("todas abaixo do piso: nenhum percentual, mas há base comparável", () => {
    const results = calculateMatches(
      [
        makeCandidate("Um tema", { "tema-0": 5 }),
        makeCandidate("Dois temas", { "tema-0": 4, "tema-1": 5 }),
        makeCandidate("Outro tema", { "tema-3": 2 }),
      ],
      vinteRespostas,
      {},
      vinteCategorias,
    );

    // O teste que /resultado FAZIA — e que aqui daria "não há nada".
    expect(results.some((r) => r.matchPercentage !== null)).toBe(false);
    // O teste que ela precisa fazer: base existe, e é informação verdadeira.
    expect(results.some((r) => r.comparableCount > 0)).toBe(true);
    expect(results.every((r) => r.insufficientBase)).toBe(true);
  });

  it("ninguém com posição documentada: nem percentual nem base", () => {
    const results = calculateMatches(
      [makeCandidate("Vazia"), makeCandidate("Também vazia")],
      vinteRespostas,
      {},
      vinteCategorias,
    );

    expect(results.some((r) => r.matchPercentage !== null)).toBe(false);
    expect(results.some((r) => r.comparableCount > 0)).toBe(false);
    expect(results.every((r) => r.insufficientBase)).toBe(false);
  });
});

describe("calculateMatches — ordenação", () => {
  // Duas perguntas respondidas, e cada candidatura documentada nas duas: é a
  // menor base que ainda publica percentual (ABSOLUTE_MIN_COMPARABLE_TOPICS).
  // Com uma só, toda a lista sairia com null e os testes de ORDEM POR
  // PERCENTUAL não teriam percentual nenhum para ordenar.
  const userVector = { "reforma-tributaria": 3, privatizacoes: 3 };
  /** Candidatura com a mesma posição nos dois temas — distância uniforme. */
  const uniforme = (displayName: string, stance: number) =>
    makeCandidate(displayName, {
      "reforma-tributaria": stance,
      privatizacoes: stance,
    });

  it("ordena por compatibilidade decrescente", () => {
    const results = calculateMatches(
      [
        uniforme("Baixa", 5), // distância 2
        uniforme("Alta", 3), // distância 0
        uniforme("Média", 4), // distância 1
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
      [uniforme("Bruno", 3), uniforme("Álvaro", 3)],
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
    // Empate de verdade: mesma resposta, mesma posição, mesmo número — e um
    // número, não dois nulls empatados por acidente.
    expect(results[0].matchPercentage).not.toBeNull();
    expect(results[0].matchPercentage).toBe(results[1].matchPercentage);
  });

  it("candidaturas sem tema comparável vão para o FIM, independentemente do nome", () => {
    const results = calculateMatches(
      [makeCandidate("Ana Sem Dados", {}), uniforme("Zeca Com Dados", 5)],
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

  it("null vai para o fim mesmo perdendo para a pior compatibilidade possível", () => {
    const results = calculateMatches(
      [makeCandidate("Sem Dados", {}), uniforme("Oposto Total", 5)],
      { "reforma-tributaria": 1, privatizacoes: 1 },
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

/**
 * REGRESSÃO — o piso móvel nunca desce a UM tema.
 *
 * O piso era `min(MIN_COMPARABLE_TOPICS, ceil(respondidas/2))`, que dá 1 para
 * quem respondeu uma ou duas perguntas. Um único tema comparável publicava
 * percentual — 81% no caso de acordo perfeito (100 − 75/(1+3)) —, exatamente o
 * que o comentário de `MIN_COMPARABLE_TOPICS` declara inaceitável: percentual
 * vindo de um tema só é ruído com aparência de precisão. O código contradizia
 * a própria justificativa.
 *
 * A metade continua valendo (2 de 3 respondidas publica); ela só não pode
 * atravessar `ABSOLUTE_MIN_COMPARABLE_TOPICS`.
 */
describe("matchCandidate — o piso móvel nunca chega a um tema", () => {
  /**
   * Menor base comparável que ainda publica percentual para quem respondeu
   * `answered` perguntas — ou `null` quando nenhuma base possível publica.
   */
  const menorBasePublicavel = (answered: number): number | null => {
    const slugs = Array.from({ length: answered }, (_, i) => `tema-${i}`);
    const cats = Object.fromEntries(slugs.map((s) => [s, "Economia"]));
    const respostas = Object.fromEntries(slugs.map((s) => [s, 5]));
    for (let c = 1; c <= answered; c += 1) {
      const positions = Object.fromEntries(
        slugs.slice(0, c).map((s) => [s, 5]),
      );
      const { matchPercentage } = matchCandidate(
        makeCandidate(`n${answered}-c${c}`, positions),
        respostas,
        {},
        cats,
      );
      if (matchPercentage !== null) return c;
    }
    return null;
  };

  it("uma resposta e um tema comparável não publicam os 81% de antes", () => {
    const result = matchCandidate(
      makeCandidate("Único tema", { "reforma-tributaria": 5 }),
      { "reforma-tributaria": 5 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.comparableCount).toBe(1);
    // Antes: 81. Acordo perfeito num tema só, com cara de medida.
    expect(result.matchPercentage).toBeNull();
    expect(result.insufficientBase).toBe(true);
  });

  it("duas respostas e um tema comparável continuam sem percentual", () => {
    const result = matchCandidate(
      makeCandidate("Metade de dois", { "reforma-tributaria": 5 }),
      { "reforma-tributaria": 5, privatizacoes: 5 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.comparableCount).toBe(1);
    expect(result.matchPercentage).toBeNull();
    expect(result.insufficientBase).toBe(true);
  });

  it("dois de dois publica — o piso móvel não foi substituído por um fixo", () => {
    const result = matchCandidate(
      makeCandidate("Dois de dois", {
        "reforma-tributaria": 5,
        privatizacoes: 5,
      }),
      { "reforma-tributaria": 5, privatizacoes: 5 },
      {},
      TOPIC_CATEGORIES,
    );

    expect(result.comparableCount).toBe(2);
    expect(result.insufficientBase).toBe(false);
    expect(result.matchPercentage).not.toBeNull();
  });

  it.each([
    [1, null],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [20, 3],
  ])(
    "com %i perguntas respondidas o percentual só sai a partir de %s temas comparáveis",
    (answered, esperado) => {
      expect(menorBasePublicavel(answered)).toBe(esperado);
    },
  );

  it("o piso nunca fica abaixo de ABSOLUTE_MIN_COMPARABLE_TOPICS, para nenhum tamanho de quiz", () => {
    for (let answered = 1; answered <= 20; answered += 1) {
      const piso = menorBasePublicavel(answered);
      if (piso === null) continue;
      expect(piso).toBeGreaterThanOrEqual(ABSOLUTE_MIN_COMPARABLE_TOPICS);
      expect(piso).toBeLessThanOrEqual(MIN_COMPARABLE_TOPICS);
    }
  });

  it("quem respondeu UMA pergunta nunca vê percentual — nem no acordo perfeito", () => {
    // Consequência aceita e declarada na metodologia §3: com uma resposta não
    // existe segundo tema para comparar, então a tela diz "base insuficiente",
    // que é verdade, em vez de um número que não é.
    for (let stance = 1; stance <= 5; stance += 1) {
      const result = matchCandidate(
        makeCandidate(`stance-${stance}`, { "reforma-tributaria": stance }),
        { "reforma-tributaria": 3 },
        {},
        TOPIC_CATEGORIES,
      );
      expect(result.matchPercentage).toBeNull();
      expect(result.insufficientBase).toBe(true);
    }
  });
});

/**
 * REGRESSÃO — o chip da ficha e o `agreeCount` do resultado usam o MESMO
 * limiar, porque agora é a MESMA constante.
 *
 * `agreementFor()` (o chip "próximo"/"distante" em cada tema da ficha) carregava
 * um literal `1` enquanto `match.ts` tinha `CLOSE_THRESHOLD`. Dois números com
 * o mesmo dono e nenhum vínculo: mexer num deles fazia a página afirmar
 * "concordância em 3 de 5 temas" com quatro chips verdes ao lado — divergência
 * silenciosa, e visível para quem lê.
 */
describe("CLOSE_THRESHOLD — chip e agreeCount não podem divergir", () => {
  it("é uma constante só, importada dos dois lados", () => {
    expect(CLOSE_THRESHOLD).toBe(STANCE_CLOSE_THRESHOLD);
  });

  it("agreementFor e agreeCount concordam nos 25 pares da escala", () => {
    for (let userStance = 1; userStance <= 5; userStance += 1) {
      for (let candidateStance = 1; candidateStance <= 5; candidateStance += 1) {
        const chip = agreementFor(candidateStance, userStance);
        const { agreeCount, comparisons } = matchCandidate(
          makeCandidate(`par-${userStance}-${candidateStance}`, {
            "reforma-tributaria": candidateStance,
          }),
          { "reforma-tributaria": userStance },
          {},
          TOPIC_CATEGORIES,
        );

        expect(agreeCount).toBe(chip.kind === "close" ? 1 : 0);
        expect(comparisons[0]?.close).toBe(chip.kind === "close");
        expect(comparisons[0]?.distance).toBe(chip.distance);
      }
    }
  });
});

/**
 * A cauda sem percentual não é um bloco só.
 *
 * `insufficientBase` e "sem dados" saem os dois com `matchPercentage: null` e
 * se misturavam numa única ordem alfabética. São informações diferentes: "tem
 * posição registrada em um ou dois temas que você respondeu" é mais do que
 * "não tem posição registrada em nenhum". Agrupar o mais informativo primeiro
 * não cria pódio — nenhum dos dois grupos tem percentual —, só para de embaralhar
 * duas afirmações distintas.
 */
describe("calculateMatches — a cauda separa base fraca de ausência de base", () => {
  const vinteRespostas: UserVector = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`tema-${i}`, 5]),
  );
  const vinteCategorias = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`tema-${i}`, "Economia"]),
  );

  const ordenar = (candidates: MatchCandidate[]) =>
    calculateMatches(candidates, vinteRespostas, {}, vinteCategorias).map(
      (r) => r.candidate.displayName,
    );

  it("base fraca vem antes de 'sem dados', mesmo com nome no fim do alfabeto", () => {
    expect(
      ordenar([
        makeCandidate("Ana Sem Nada", {}),
        makeCandidate("Zilda Um Tema", { "tema-0": 5 }),
      ]),
    ).toEqual(["Zilda Um Tema", "Ana Sem Nada"]);
  });

  it("a ordem de entrada não muda o agrupamento", () => {
    expect(
      ordenar([
        makeCandidate("Zilda Um Tema", { "tema-0": 5 }),
        makeCandidate("Ana Sem Nada", {}),
      ]),
    ).toEqual(["Zilda Um Tema", "Ana Sem Nada"]);
  });

  it("dentro da base fraca a ordem é alfabética — mais temas não sobe ninguém", () => {
    // O agrupamento não pode virar ranking pela porta dos fundos: duas
    // candidaturas sem percentual não têm entre si nenhuma ordem defensável
    // além do alfabeto.
    expect(
      ordenar([
        makeCandidate("Zeca", { "tema-0": 5, "tema-1": 5 }),
        makeCandidate("Álvaro", { "tema-2": 1 }),
      ]),
    ).toEqual(["Álvaro", "Zeca"]);
  });

  it("a cauda não é ordenada por número de temas comparáveis, em nenhuma direção", () => {
    // Bia tem o dobro da base das outras duas e continua no meio, onde o
    // alfabeto a coloca. Ordenar a cauda por `comparableCount` — crescente ou
    // decrescente — seria publicar um ranking pelo número que a página
    // deliberadamente não transforma em percentual.
    expect(
      ordenar([
        makeCandidate("Célia", { "tema-2": 3 }),
        makeCandidate("Bia", { "tema-0": 5, "tema-1": 4 }),
        makeCandidate("Ana", { "tema-3": 1 }),
      ]),
    ).toEqual(["Ana", "Bia", "Célia"]);
  });

  it("dentro de 'sem dados' a ordem continua alfabética pt-BR", () => {
    expect(
      ordenar([
        makeCandidate("Beto", {}),
        makeCandidate("Ávila", {}),
        makeCandidate("Carlos", {}),
      ]),
    ).toEqual(["Ávila", "Beto", "Carlos"]);
  });

  it("agrupar não publica percentual para ninguém da cauda", () => {
    const results = calculateMatches(
      [
        makeCandidate("Um tema", { "tema-0": 5 }),
        makeCandidate("Nenhum tema", {}),
      ],
      vinteRespostas,
      {},
      vinteCategorias,
    );

    expect(results.map((r) => r.matchPercentage)).toEqual([null, null]);
    expect(results.map((r) => r.insufficientBase)).toEqual([true, false]);
  });

  it("a cauda inteira continua depois de quem tem percentual", () => {
    expect(
      ordenar([
        makeCandidate("Ana Sem Nada", {}),
        makeCandidate("Zilda Um Tema", { "tema-0": 5 }),
        makeCandidate("Yara Com Base", {
          "tema-0": 5,
          "tema-1": 5,
          "tema-2": 4,
        }),
      ]),
    ).toEqual(["Yara Com Base", "Zilda Um Tema", "Ana Sem Nada"]);
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
