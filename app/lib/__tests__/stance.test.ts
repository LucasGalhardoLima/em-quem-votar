import { describe, it, expect } from "vitest";
import {
  AGREEMENT_CHIP_CLASS,
  CANDIDATE_STANCE_LABELS,
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
