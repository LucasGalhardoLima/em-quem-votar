import { describe, it, expect } from "vitest";
import {
  ELECTION_DATES,
  TOTAL_PRESIDENTIAL_CANDIDACIES,
  countdownCopy,
  currentPhase,
  daysUntil,
  formatElectionDay,
} from "../election";

/**
 * Todos os testes passam `from`/`now` explícitos. Nada aqui pode depender do
 * relógio real: um contador eleitoral que muda de resultado conforme o dia
 * em que a suíte roda não prova coisa alguma.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const { firstRound, secondRound, campaignStart, freeAirtimeStart } =
  ELECTION_DATES;

/** Instante deslocado em milissegundos a partir de uma data do calendário. */
function at(date: Date, offsetMs: number): Date {
  return new Date(date.getTime() + offsetMs);
}

describe("ELECTION_DATES", () => {
  it("as datas do calendário do TSE estão em ordem cronológica", () => {
    expect(ELECTION_DATES.registrationDeadline.getTime()).toBeLessThan(
      campaignStart.getTime(),
    );
    expect(campaignStart.getTime()).toBeLessThan(freeAirtimeStart.getTime());
    expect(freeAirtimeStart.getTime()).toBeLessThan(firstRound.getTime());
    expect(firstRound.getTime()).toBeLessThan(secondRound.getTime());
  });

  it("os dois turnos caem em domingo, no horário de Brasília", () => {
    expect(formatElectionDay(firstRound)).toBe("domingo, 4 de outubro");
    expect(formatElectionDay(secondRound)).toBe("domingo, 25 de outubro");
  });

  it("o total de candidaturas presidenciais é o número oficializado", () => {
    expect(TOTAL_PRESIDENTIAL_CANDIDACIES).toBe(13);
  });
});

describe("daysUntil", () => {
  it("conta dias inteiros até a data-alvo", () => {
    expect(daysUntil(firstRound, new Date("2026-10-01T12:00:00.000Z"))).toBe(3);
    expect(daysUntil(firstRound, new Date("2026-09-04T12:00:00.000Z"))).toBe(30);
    expect(daysUntil(secondRound, new Date("2026-10-10T12:00:00.000Z"))).toBe(15);
  });

  it("é o mesmo número em qualquer hora do dia — conta dias, não horas", () => {
    // Da meia-noite às 23h59 do MESMO dia civil de Brasília, o número não
    // se move. Os instantes são escritos no fuso local justamente porque é
    // ele que define a virada.
    expect(daysUntil(firstRound, new Date("2026-10-03T00:00:00-03:00"))).toBe(1);
    expect(daysUntil(firstRound, new Date("2026-10-03T12:00:00-03:00"))).toBe(1);
    expect(daysUntil(firstRound, new Date("2026-10-03T23:59:00-03:00"))).toBe(1);
  });

  it("no próprio dia da eleição devolve 0", () => {
    // Instantes escritos no fuso de Brasília de propósito: 2026-10-04T00:00Z
    // ainda é 3/10 às 21h em Brasília, e portanto véspera.
    expect(daysUntil(firstRound, new Date("2026-10-04T00:00:00-03:00"))).toBe(0);
    expect(daysUntil(firstRound, firstRound)).toBe(0);
    expect(daysUntil(firstRound, new Date("2026-10-04T23:59:59-03:00"))).toBe(0);
  });

  it("a virada do dia é a de Brasília, não a do UTC", () => {
    // 21h de 3/10 em Brasília = 00:00Z de 4/10. Ainda é véspera.
    expect(daysUntil(firstRound, new Date("2026-10-04T00:00:00.000Z"))).toBe(1);
    // 00:30 de 4/10 em Brasília = 03:30Z. Agora sim é o dia.
    expect(daysUntil(firstRound, new Date("2026-10-04T03:30:00.000Z"))).toBe(0);
  });

  it("nunca devolve negativo para uma data já vencida", () => {
    expect(daysUntil(firstRound, new Date("2026-10-05T12:00:00.000Z"))).toBe(0);
    expect(daysUntil(firstRound, new Date("2026-12-31T12:00:00.000Z"))).toBe(0);
    expect(daysUntil(secondRound, new Date("2027-03-01T12:00:00.000Z"))).toBe(0);
  });

  it("um dia inteiro antes da meia-noite de Brasília ainda é 1 dia", () => {
    // 20h de 3/10 em Brasília: ainda falta 1 dia para o 1º turno.
    expect(daysUntil(firstRound, new Date("2026-10-03T20:00:00-03:00"))).toBe(1);
  });

  it("não erra por um dia na virada de fuso (23h de Brasília ainda é véspera)", () => {
    // Regressão: `daysUntil` recortava o início do dia com `getUTC*`, mas o
    // calendário eleitoral é fixado no horário de Brasília (UTC-3). Entre
    // 21h e 24h de Brasília o instante já pertence ao dia seguinte em UTC, e
    // o contador pulava um dia adiante — às 23h de 3/10 a barra da home
    // diria "é hoje" para uma eleição que ainda estava a um dia.
    expect(daysUntil(firstRound, new Date("2026-10-03T23:00:00-03:00"))).toBe(1);
    expect(daysUntil(firstRound, new Date("2026-10-03T21:00:00-03:00"))).toBe(1);
  });
});

describe("currentPhase", () => {
  it("antes do início da propaganda é pré-campanha", () => {
    expect(currentPhase(new Date("2026-07-01T12:00:00.000Z"))).toBe("pre-campaign");
    expect(currentPhase(at(campaignStart, -1))).toBe("pre-campaign");
  });

  it("a campanha começa exatamente no instante de campaignStart", () => {
    expect(currentPhase(campaignStart)).toBe("campaign");
    expect(currentPhase(at(freeAirtimeStart, -1))).toBe("campaign");
  });

  it("o horário eleitoral gratuito começa exatamente em freeAirtimeStart", () => {
    expect(currentPhase(freeAirtimeStart)).toBe("free-airtime");
    expect(currentPhase(at(firstRound, -1))).toBe("free-airtime");
  });

  it("o dia do 1º turno dura 24h a partir do horário de abertura", () => {
    expect(currentPhase(firstRound)).toBe("first-round");
    expect(currentPhase(at(firstRound, DAY_MS - 1))).toBe("first-round");
  });

  it("passadas as 24h do 1º turno entra a janela de segundo turno", () => {
    expect(currentPhase(at(firstRound, DAY_MS))).toBe("runoff");
    expect(currentPhase(secondRound)).toBe("runoff");
    expect(currentPhase(at(secondRound, DAY_MS - 1))).toBe("runoff");
  });

  it("passadas as 24h do 2º turno a eleição está concluída", () => {
    expect(currentPhase(at(secondRound, DAY_MS))).toBe("concluded");
    expect(currentPhase(new Date("2026-12-01T12:00:00.000Z"))).toBe("concluded");
  });
});

describe("countdownCopy", () => {
  it("na pré-campanha aponta para o 1º turno", () => {
    const copy = countdownCopy(new Date("2026-07-01T12:00:00.000Z"));
    expect(copy).toEqual({
      days: 95,
      label: "1º turno",
      dateLabel: "domingo, 4 de outubro",
    });
  });

  it("durante a campanha continua apontando para o 1º turno", () => {
    const copy = countdownCopy(new Date("2026-08-20T12:00:00.000Z"));
    expect(copy.label).toBe("1º turno");
    expect(copy.dateLabel).toBe("domingo, 4 de outubro");
    expect(copy.days).toBe(45);
  });

  it("no dia do 1º turno o contador chega a zero sem trocar de alvo", () => {
    const copy = countdownCopy(firstRound);
    expect(copy.label).toBe("1º turno");
    expect(copy.days).toBe(0);
  });

  it("na janela de segundo turno o alvo passa a ser o 2º turno", () => {
    // A home nunca pode exibir contagem para uma data já vencida.
    const copy = countdownCopy(new Date("2026-10-10T12:00:00.000Z"));
    expect(copy).toEqual({
      days: 15,
      label: "2º turno",
      dateLabel: "domingo, 25 de outubro",
    });
  });

  it("a troca de alvo acontece no instante em que a fase vira runoff", () => {
    expect(countdownCopy(at(firstRound, DAY_MS - 1)).label).toBe("1º turno");
    expect(countdownCopy(at(firstRound, DAY_MS)).label).toBe("2º turno");
  });

  it("no dia do 2º turno o contador chega a zero", () => {
    const copy = countdownCopy(secondRound);
    expect(copy.label).toBe("2º turno");
    expect(copy.days).toBe(0);
  });

  it("depois de concluída, nunca devolve dias negativos", () => {
    const copy = countdownCopy(new Date("2026-12-01T12:00:00.000Z"));
    expect(copy.days).toBe(0);
    expect(copy.days).toBeGreaterThanOrEqual(0);
  });
});

describe("formatElectionDay", () => {
  it("remove o sufixo '-feira' do nome do dia", () => {
    // O pt-BR do Intl devolve "sexta-feira"; a barra usa a forma curta.
    expect(formatElectionDay(freeAirtimeStart)).toBe("sexta, 28 de agosto");
    expect(formatElectionDay(new Date("2026-10-06T15:00:00.000Z"))).toBe(
      "terça, 6 de outubro",
    );
  });

  it("domingo e sábado não têm '-feira' e passam intactos", () => {
    expect(formatElectionDay(firstRound)).toBe("domingo, 4 de outubro");
    expect(formatElectionDay(new Date("2026-10-03T15:00:00.000Z"))).toBe(
      "sábado, 3 de outubro",
    );
  });

  it("formata no fuso de Brasília, não no fuso de quem roda o código", () => {
    // 4/10 às 23h em Brasília = 5/10 às 02h em UTC. O rótulo tem de dizer 4.
    expect(formatElectionDay(new Date("2026-10-05T02:00:00.000Z"))).toBe(
      "domingo, 4 de outubro",
    );
  });
});
