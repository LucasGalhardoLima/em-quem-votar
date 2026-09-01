import { describe, it, expect } from "vitest";
import {
  AGREEMENT_CHIP_CLASS,
  CANDIDATE_STANCE_LABELS,
  CLOSE_THRESHOLD,
  IMPORTANCE_LABELS,
  IMPORTANCE_LEVELS,
  IMPORTANCE_MULTIPLIERS,
  NO_POSITION_LABEL,
  NO_QUIZ_LABEL,
  SKIPPED_LABEL,
  STANCE_MAX,
  STANCE_MIN,
  STANCE_UNKNOWN,
  USER_STANCE_LABELS,
  agreementFor,
  candidateStanceLabel,
  getMultiplier,
  hasPosition,
  userStanceLabel,
} from "../stance";

describe("constantes da escala", () => {
  it("a escala documentada é Likert 1–5 e 0 é reservado para 'sem posição'", () => {
    expect(STANCE_UNKNOWN).toBe(0);
    expect(STANCE_MIN).toBe(1);
    expect(STANCE_MAX).toBe(5);
  });

  it("cada ponto da escala tem rótulo para pessoa e para candidatura", () => {
    for (let stance = STANCE_MIN; stance <= STANCE_MAX; stance += 1) {
      expect(USER_STANCE_LABELS[stance]).toBeTruthy();
      expect(CANDIDATE_STANCE_LABELS[stance]).toBeTruthy();
    }
  });

  it("o vocabulário da candidatura descreve a AFIRMAÇÃO, não um campo político", () => {
    // Neutralidade (research.md §6): nada de "esquerda"/"direita"/"certo".
    expect(CANDIDATE_STANCE_LABELS[1]).toBe("Totalmente contrária");
    expect(CANDIDATE_STANCE_LABELS[3]).toBe("Neutra");
    expect(CANDIDATE_STANCE_LABELS[5]).toBe("Totalmente favorável");
  });
});

describe("userStanceLabel", () => {
  it("rotula cada ponto respondido", () => {
    expect(userStanceLabel(1)).toBe("Discordo totalmente");
    expect(userStanceLabel(2)).toBe("Discordo em parte");
    expect(userStanceLabel(3)).toBe("Neutro / não sei");
    expect(userStanceLabel(4)).toBe("Concordo em parte");
    expect(userStanceLabel(5)).toBe("Concordo totalmente");
  });

  it("undefined vira o rótulo de tema pulado", () => {
    expect(userStanceLabel(undefined)).toBe(SKIPPED_LABEL);
    expect(userStanceLabel(undefined)).toBe("Você pulou este tema");
  });

  it("null e 0 também são 'pulou', nunca 'neutro'", () => {
    // Confundir "pulei" com "sou neutro" distorceria a compatibilidade.
    expect(userStanceLabel(null)).toBe(SKIPPED_LABEL);
    expect(userStanceLabel(0)).toBe(SKIPPED_LABEL);
    expect(userStanceLabel(0)).not.toBe(USER_STANCE_LABELS[3]);
  });

  it("valor fora da escala cai no rótulo de pulado", () => {
    expect(userStanceLabel(6)).toBe(SKIPPED_LABEL);
    expect(userStanceLabel(-1)).toBe(SKIPPED_LABEL);
  });
});

describe("candidateStanceLabel", () => {
  it("rotula cada ponto documentado", () => {
    expect(candidateStanceLabel(1)).toBe("Totalmente contrária");
    expect(candidateStanceLabel(2)).toBe("Parcialmente contrária");
    expect(candidateStanceLabel(3)).toBe("Neutra");
    expect(candidateStanceLabel(4)).toBe("Parcialmente favorável");
    expect(candidateStanceLabel(5)).toBe("Totalmente favorável");
  });

  it("0 é 'Sem posição registrada' — jamais 'Neutra'", () => {
    // O 0 significa ausência de documento; tratá-lo como neutro inventaria
    // uma posição que a candidatura nunca expressou.
    expect(candidateStanceLabel(0)).toBe("Sem posição registrada");
    expect(candidateStanceLabel(0)).toBe(NO_POSITION_LABEL);
    expect(candidateStanceLabel(0)).not.toBe(CANDIDATE_STANCE_LABELS[3]);
  });

  it("null, undefined e valores fora da escala também caem em 'Sem posição registrada'", () => {
    expect(candidateStanceLabel(null)).toBe(NO_POSITION_LABEL);
    expect(candidateStanceLabel(undefined)).toBe(NO_POSITION_LABEL);
    expect(candidateStanceLabel(6)).toBe(NO_POSITION_LABEL);
    expect(candidateStanceLabel(-1)).toBe(NO_POSITION_LABEL);
  });
});

describe("hasPosition", () => {
  it("aceita todo ponto da escala 1–5", () => {
    expect(hasPosition(1)).toBe(true);
    expect(hasPosition(2)).toBe(true);
    expect(hasPosition(3)).toBe(true);
    expect(hasPosition(4)).toBe(true);
    expect(hasPosition(5)).toBe(true);
  });

  it("rejeita 0, null e undefined", () => {
    expect(hasPosition(0)).toBe(false);
    expect(hasPosition(null)).toBe(false);
    expect(hasPosition(undefined)).toBe(false);
  });

  it("rejeita valores fora da escala (6 e -1)", () => {
    expect(hasPosition(6)).toBe(false);
    expect(hasPosition(-1)).toBe(false);
  });
});

/**
 * REGRESSÃO — `hasPosition` é a fronteira entre o localStorage e o cálculo.
 *
 * As respostas do quiz são persistidas no navegador de quem responde
 * (metodologia §5) e voltam como estiverem lá: versão antiga do store, edição
 * manual, JSON truncado, extensão de navegador. O TypeScript garante o formato
 * em tempo de compilação e nada em tempo de execução.
 *
 * A checagem `>= 1 && <= 5` é feita com operadores relacionais, que COAGEM o
 * outro lado: `true >= 1` é verdadeiro, `"5" <= 5` é verdadeiro, `[3] >= 1`
 * também. Um `true` guardado no lugar de uma resposta passava por "posição
 * documentada", virava distância `Math.abs(5 - true)` = 4 e saía na tela como
 * discordância máxima — uma afirmação sobre uma pessoa real tirada de lixo de
 * serialização.
 */
describe("hasPosition — exige número de verdade, não coerção", () => {
  it("rejeita booleanos, que coagem para 0 e 1", () => {
    expect(hasPosition(true as never)).toBe(false);
    expect(hasPosition(false as never)).toBe(false);
  });

  it('rejeita strings numéricas ("5", "3")', () => {
    expect(hasPosition("5" as never)).toBe(false);
    expect(hasPosition("3" as never)).toBe(false);
  });

  it("rejeita arrays de um elemento, que coagem pelo toString", () => {
    expect(hasPosition([3] as never)).toBe(false);
    expect(hasPosition([] as never)).toBe(false);
  });

  it("rejeita não-inteiros — a escala do banco é Int, não contínua", () => {
    expect(hasPosition(3.5)).toBe(false);
    expect(hasPosition(1.0000001)).toBe(false);
  });

  it("rejeita NaN e Infinity", () => {
    expect(hasPosition(Number.NaN)).toBe(false);
    expect(hasPosition(Number.POSITIVE_INFINITY)).toBe(false);
    expect(hasPosition(Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it("continua aceitando os cinco inteiros da escala, e só eles", () => {
    // Contraprova: endurecer não pode ter fechado a porta para o dado bom.
    for (let stance = STANCE_MIN; stance <= STANCE_MAX; stance += 1) {
      expect(hasPosition(stance)).toBe(true);
    }
  });

  it("0 continua sendo 'sem posição registrada', jamais neutro", () => {
    // A semântica do 0 não muda com o endurecimento: ele é ausência de
    // documento, não o ponto médio da escala.
    expect(hasPosition(STANCE_UNKNOWN)).toBe(false);
    expect(hasPosition(0)).toBe(false);
  });
});

describe("agreementFor", () => {
  it("sem quiz respondido devolve 'no-quiz', mesmo com posição documentada", () => {
    // A plataforma não pode insinuar concordância antes de a pessoa
    // responder — o chip fica em branco ("—").
    expect(agreementFor(5, 5, { hasQuiz: false })).toEqual({
      kind: "no-quiz",
      distance: null,
      label: "—",
    });
  });

  it("'no-quiz' tem precedência sobre a falta de posição documentada", () => {
    expect(agreementFor(0, undefined, { hasQuiz: false }).kind).toBe("no-quiz");
  });

  it("hasQuiz assume true quando não informado", () => {
    expect(agreementFor(3, 3).kind).toBe("close");
    expect(agreementFor(3, 3, {}).kind).toBe("close");
  });

  it("sem posição documentada o tema fica 'fora da conta'", () => {
    expect(agreementFor(0, 5)).toEqual({
      kind: "not-comparable",
      distance: null,
      label: "fora da conta",
    });
    expect(agreementFor(null, 5).kind).toBe("not-comparable");
    expect(agreementFor(undefined, 5).kind).toBe("not-comparable");
  });

  it("sem resposta da pessoa o tema também fica 'fora da conta'", () => {
    expect(agreementFor(5, undefined).kind).toBe("not-comparable");
    expect(agreementFor(5, null).kind).toBe("not-comparable");
    expect(agreementFor(5, 0).kind).toBe("not-comparable");
  });

  it("faltando as duas pontas continua incomparável", () => {
    expect(agreementFor(0, 0).kind).toBe("not-comparable");
  });

  it("distância 0 é 'próximo'", () => {
    expect(agreementFor(4, 4)).toEqual({
      kind: "close",
      distance: 0,
      label: "próximo",
    });
  });

  it("a fronteira de 'próximo' é exatamente distância <= 1", () => {
    expect(agreementFor(3, 4)).toEqual({
      kind: "close",
      distance: 1,
      label: "próximo",
    });
    expect(agreementFor(3, 5)).toEqual({
      kind: "distant",
      distance: 2,
      label: "distante",
    });
  });

  it("a fronteira sai de CLOSE_THRESHOLD, não de um literal solto", () => {
    // O mesmo limiar decide o chip que a pessoa vê aqui e o `agreeCount`
    // ("concordância em X de Y temas") em `match.ts`. Enquanto ele era um `1`
    // digitado nos dois lugares, mexer em um deixava a tela e a contagem
    // discordando sobre o MESMO par de respostas. Este teste morre se
    // `agreementFor` voltar a carregar o número por conta própria.
    expect(Number.isInteger(CLOSE_THRESHOLD)).toBe(true);
    expect(CLOSE_THRESHOLD).toBeGreaterThan(0);
    for (let stance = STANCE_MIN; stance + CLOSE_THRESHOLD <= STANCE_MAX; stance += 1) {
      expect(agreementFor(stance, stance + CLOSE_THRESHOLD).kind).toBe("close");
    }
    for (let stance = STANCE_MIN; stance + CLOSE_THRESHOLD + 1 <= STANCE_MAX; stance += 1) {
      expect(agreementFor(stance, stance + CLOSE_THRESHOLD + 1).kind).toBe(
        "distant",
      );
    }
  });

  it("distância máxima (1 contra 5) é 4 e é 'distante'", () => {
    expect(agreementFor(1, 5)).toEqual({
      kind: "distant",
      distance: 4,
      label: "distante",
    });
  });

  it("a distância é absoluta — inverter as pontas não muda nada", () => {
    expect(agreementFor(5, 1)).toEqual(agreementFor(1, 5));
    expect(agreementFor(4, 3)).toEqual(agreementFor(3, 4));
  });

  it("todo tipo de concordância tem classe de chip", () => {
    const kinds = ["close", "distant", "not-comparable", "no-quiz"] as const;
    for (const kind of kinds) {
      expect(AGREEMENT_CHIP_CLASS[kind]).toBeTruthy();
    }
  });

  // O chip vivia em verde/vermelho: a cor afirmava, na ficha de uma pessoa
  // real, que concordar com quem lê é bom e discordar é ruim. `indigo` entra
  // na mesma lista por ser o acento de destaque do site. Um teste porque a
  // regressão aqui é uma linha de Tailwind que passa por qualquer revisão.
  it("nenhum chip codifica bom/ruim por matiz", () => {
    for (const classes of Object.values(AGREEMENT_CHIP_CLASS)) {
      expect(classes).not.toMatch(
        /\b(?:border|bg|text|ring|outline)-(?:green|red|rose|orange|amber|yellow|emerald|lime|teal|indigo|violet|purple|fuchsia|pink)-/,
      );
    }
  });

  // Achatar os quatro no mesmo chip apagaria a diferença entre "próximo",
  // "distante" e "fora da conta" — os dois de AUSÊNCIA são o mesmo estado e
  // compartilham o chip de propósito.
  it("comparável e ausente continuam distinguíveis sem matiz", () => {
    expect(AGREEMENT_CHIP_CLASS.close).not.toBe(AGREEMENT_CHIP_CLASS.distant);
    expect(AGREEMENT_CHIP_CLASS.close).not.toBe(
      AGREEMENT_CHIP_CLASS["not-comparable"],
    );
    expect(AGREEMENT_CHIP_CLASS.distant).not.toBe(
      AGREEMENT_CHIP_CLASS["not-comparable"],
    );
    expect(AGREEMENT_CHIP_CLASS["not-comparable"]).toBe(
      AGREEMENT_CHIP_CLASS["no-quiz"],
    );
  });

  // `close` e `distant` se separam só pelo preenchimento: borda ou texto
  // diferente entre os dois colocaria um em posição de destaque sobre o outro,
  // que é a mesma hierarquia entre concordar e discordar que saiu daqui.
  it("próximo e distante só diferem no preenchimento", () => {
    const token = (classes: string, prefix: string) =>
      classes.split(" ").find((c) => c.startsWith(prefix));
    expect(token(AGREEMENT_CHIP_CLASS.close, "text-")).toBe("text-slate-800");
    expect(token(AGREEMENT_CHIP_CLASS.distant, "text-")).toBe(
      token(AGREEMENT_CHIP_CLASS.close, "text-"),
    );
    expect(token(AGREEMENT_CHIP_CLASS.distant, "border-")).toBe(
      token(AGREEMENT_CHIP_CLASS.close, "border-"),
    );
    expect(token(AGREEMENT_CHIP_CLASS.distant, "bg-")).not.toBe(
      token(AGREEMENT_CHIP_CLASS.close, "bg-"),
    );
  });
});

describe("getMultiplier", () => {
  it("aplica os multiplicadores documentados", () => {
    expect(getMultiplier("high")).toBe(1.5);
    expect(getMultiplier("medium")).toBe(1.0);
    expect(getMultiplier("low")).toBe(0.5);
  });

  it("undefined assume 'medium' (1.0) — não zera nem ignora o eixo", () => {
    // Peso 0 apagaria o eixo do denominador; o padrão tem de ser neutro.
    expect(getMultiplier(undefined)).toBe(1.0);
    expect(getMultiplier(undefined)).toBe(IMPORTANCE_MULTIPLIERS.medium);
  });

  it("os pesos são estritamente crescentes de low para high", () => {
    expect(getMultiplier("low")).toBeLessThan(getMultiplier("medium"));
    expect(getMultiplier("medium")).toBeLessThan(getMultiplier("high"));
  });

  it("valor corrompido no localStorage cai em 'medium', nunca em undefined", () => {
    // O peso vem do quizStore persistido; localStorage devolve o que
    // escreveram nele. Estes valores atravessam o tipo em tempo de execução e
    // antes saíam como undefined, contaminando a soma até virar "NaN%".
    const corrompidos = ["HIGH", "Alta", "", "1.5", "null"];
    for (const valor of corrompidos) {
      const peso = getMultiplier(valor as never);
      expect(Number.isFinite(peso)).toBe(true);
      expect(peso).toBe(IMPORTANCE_MULTIPLIERS.medium);
    }
  });
});

describe("níveis de importância", () => {
  it("todo nível tem rótulo e multiplicador", () => {
    for (const level of IMPORTANCE_LEVELS) {
      expect(IMPORTANCE_LABELS[level]).toBeTruthy();
      expect(typeof IMPORTANCE_MULTIPLIERS[level]).toBe("number");
    }
  });

  it("os níveis são exatamente low, medium e high", () => {
    expect([...IMPORTANCE_LEVELS]).toEqual(["low", "medium", "high"]);
  });
});

describe("rótulos de ausência", () => {
  it("são textos distintos — 'sem posição', 'pulou' e 'faça o quiz' significam coisas diferentes", () => {
    expect(new Set([NO_POSITION_LABEL, SKIPPED_LABEL, NO_QUIZ_LABEL]).size).toBe(3);
  });
});
