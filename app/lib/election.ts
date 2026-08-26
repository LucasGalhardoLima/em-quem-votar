/**
 * Datas e vocabulário oficiais do calendário eleitoral de 2026.
 *
 * Fonte: TSE — Calendário Eleitoral (Resolução TSE nº 23.736/2024) e
 * Agência Senado, "Eleições 2026: veja os números das candidaturas
 * oficializadas" (17/08/2026).
 *
 * Todas as datas são fixadas em horário de Brasília (UTC-3).
 */

export const ELECTION_DATES = {
  /** Encerramento do prazo de registro de candidaturas no TSE. */
  registrationDeadline: new Date("2026-08-15T22:00:00.000Z"),
  /** Início oficial da propaganda eleitoral. */
  campaignStart: new Date("2026-08-16T03:00:00.000Z"),
  /** Início do horário eleitoral gratuito em rádio e TV. */
  freeAirtimeStart: new Date("2026-08-28T03:00:00.000Z"),
  /** Primeiro turno. */
  firstRound: new Date("2026-10-04T11:00:00.000Z"),
  /** Segundo turno, se houver. */
  secondRound: new Date("2026-10-25T11:00:00.000Z"),
} as const;

export const TOTAL_PRESIDENTIAL_CANDIDACIES = 13;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-04" no fuso de Brasília, independente do fuso do servidor. */
const BRASILIA_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Início do dia civil em Brasília, normalizado para um instante UTC.
 *
 * Truncar com getUTCDate() erraria por um dia entre 21h e 23h59 de Brasília,
 * quando o instante já pertence ao dia seguinte em UTC: às 23h de 3 de
 * outubro a home anunciaria "é hoje" para uma eleição que ainda está a um
 * dia. São três horas por dia, e a última delas cai exatamente na véspera
 * do primeiro turno.
 */
function startOfDayInBrasilia(date: Date): number {
  const [year, month, day] = BRASILIA_YMD.format(date).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Dias inteiros restantes até `target`, nunca negativo. */
export function daysUntil(target: Date, from: Date = new Date()): number {
  return Math.max(
    0,
    Math.round(
      (startOfDayInBrasilia(target) - startOfDayInBrasilia(from)) / DAY_MS,
    ),
  );
}

export type ElectionPhase =
  | "pre-campaign"
  | "campaign"
  | "free-airtime"
  | "first-round"
  | "runoff"
  | "concluded";

export function currentPhase(now: Date = new Date()): ElectionPhase {
  const t = now.getTime();
  if (t < ELECTION_DATES.campaignStart.getTime()) return "pre-campaign";
  if (t < ELECTION_DATES.freeAirtimeStart.getTime()) return "campaign";
  if (t < ELECTION_DATES.firstRound.getTime()) return "free-airtime";
  if (t < ELECTION_DATES.firstRound.getTime() + DAY_MS) return "first-round";
  if (t < ELECTION_DATES.secondRound.getTime() + DAY_MS) return "runoff";
  return "concluded";
}

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

/** "domingo, 4 de outubro" */
export function formatElectionDay(date: Date): string {
  return DATE_FMT.format(date).replace(/-feira/, "");
}

/**
 * Texto do contador da barra superior. Muda de alvo conforme a fase, para
 * que a home nunca exiba uma contagem para uma data já vencida.
 */
export function countdownCopy(now: Date = new Date()): {
  days: number;
  label: string;
  dateLabel: string;
} {
  const phase = currentPhase(now);
  const target =
    phase === "runoff" ? ELECTION_DATES.secondRound : ELECTION_DATES.firstRound;
  const label = phase === "runoff" ? "2º turno" : "1º turno";
  return {
    days: daysUntil(target, now),
    label,
    dateLabel: formatElectionDay(target),
  };
}
