/**
 * Cálculo de compatibilidade — puro e isomórfico.
 *
 * Roda no navegador de propósito: as respostas do quiz nunca precisam sair
 * do aparelho. O servidor entrega apenas as posições documentadas dos
 * candidatos (dado público) e a conta acontece no cliente.
 *
 * Regra central (metodologia §3): um tema só entra na conta quando existem
 * as DUAS pontas — resposta da pessoa e posição documentada. Tema sem
 * documento fica fora do numerador E do denominador. É por isso que o
 * número de temas comparáveis varia de candidato para candidato, e é por
 * isso que a interface sempre exibe "X de Y temas".
 */

import { getMultiplier, hasPosition, type ImportanceLevel } from "./stance";

/** Maior diferença quadrática possível na escala Likert: (5-1)² = 16. */
export const MAX_SQUARED_DIFF = 16;

/** Distância máxima (na escala) ainda considerada "próximo". */
export const CLOSE_THRESHOLD = 1;

export interface MatchCandidate {
  id: string;
  name: string;
  displayName: string;
  party: string;
  photoUrl: string | null;
  coalition: string | null;
  registrationStatus: string;
  tseStatusLabel: string | null;
  number: number | null;
  /** topicSlug → stance 1..5, apenas posições aprovadas. */
  positions: Record<string, number>;
  /** topicSlug → categoria temática. */
  positionCategories: Record<string, string>;
  positionCount: number;
}

export interface TopicComparison {
  topicSlug: string;
  topicCategory: string;
  userStance: number;
  candidateStance: number | null;
  /** Distância absoluta 0..4, ou null quando incomparável. */
  distance: number | null;
  comparable: boolean;
  close: boolean;
}

export interface CategoryScore {
  category: string;
  /** 0..100, ou null se nenhum tema da categoria era comparável. */
  score: number | null;
  comparable: number;
}

export interface MatchResult {
  candidate: MatchCandidate;
  /** 0..100, ou null quando não houve nenhum tema comparável. */
  matchPercentage: number | null;
  /** Temas em que havia resposta E posição documentada. */
  comparableCount: number;
  /** Dos comparáveis, quantos ficaram a distância <= 1. */
  agreeCount: number;
  comparisons: TopicComparison[];
  categoryScores: CategoryScore[];
}

export type UserVector = Record<string, number>;
export type AxisWeights = Record<string, ImportanceLevel>;

function percentFrom(weightedSum: number, totalWeight: number): number | null {
  if (totalWeight <= 0) return null;
  const raw = (1 - weightedSum / (totalWeight * MAX_SQUARED_DIFF)) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Compara um candidato com o vetor de respostas.
 * `topicCategories` cobre temas que o candidato não respondeu, para que a
 * ponderação por eixo funcione mesmo quando falta posição.
 */
export function matchCandidate(
  candidate: MatchCandidate,
  userVector: UserVector,
  axisWeights: AxisWeights = {},
  topicCategories: Record<string, string> = {},
): MatchResult {
  let weightedSum = 0;
  let totalWeight = 0;
  let agreeCount = 0;
  let comparableCount = 0;

  const perCategory = new Map<
    string,
    { weightedSum: number; totalWeight: number; comparable: number }
  >();

  const comparisons: TopicComparison[] = [];

  for (const [topicSlug, userStanceRaw] of Object.entries(userVector)) {
    if (!hasPosition(userStanceRaw)) continue;
    const userStance = userStanceRaw;

    const category =
      candidate.positionCategories[topicSlug] ??
      topicCategories[topicSlug] ??
      "Outros";

    const candidateStanceRaw = candidate.positions[topicSlug];
    const comparable = hasPosition(candidateStanceRaw);
    const candidateStance = comparable ? candidateStanceRaw : null;
    const distance =
      candidateStance === null ? null : Math.abs(userStance - candidateStance);
    const close = distance !== null && distance <= CLOSE_THRESHOLD;

    comparisons.push({
      topicSlug,
      topicCategory: category,
      userStance,
      candidateStance,
      distance,
      comparable,
      close,
    });

    // Tema sem posição documentada fica FORA da conta — não penaliza nem
    // beneficia. É a diferença entre "discorda" e "não se sabe".
    if (!comparable || distance === null) continue;

    const weight = getMultiplier(axisWeights[category]);
    const squared = distance * distance;

    weightedSum += weight * squared;
    totalWeight += weight;
    comparableCount += 1;
    if (close) agreeCount += 1;

    const bucket =
      perCategory.get(category) ??
      { weightedSum: 0, totalWeight: 0, comparable: 0 };
    bucket.weightedSum += weight * squared;
    bucket.totalWeight += weight;
    bucket.comparable += 1;
    perCategory.set(category, bucket);
  }

  const categoryScores: CategoryScore[] = [...perCategory.entries()]
    .map(([category, b]) => ({
      category,
      score: percentFrom(b.weightedSum, b.totalWeight),
      comparable: b.comparable,
    }))
    .sort((a, b) => a.category.localeCompare(b.category, "pt-BR"));

  return {
    candidate,
    matchPercentage: percentFrom(weightedSum, totalWeight),
    comparableCount,
    agreeCount,
    comparisons,
    categoryScores,
  };
}

/**
 * Ordena por compatibilidade decrescente. Empates saem em ordem alfabética
 * — nunca por partido, tamanho de bancada ou intenção de voto. Candidatos
 * sem nenhum tema comparável vão para o fim, com percentual nulo, em vez de
 * aparecerem como 0%.
 */
export function calculateMatches(
  candidates: MatchCandidate[],
  userVector: UserVector,
  axisWeights: AxisWeights = {},
  topicCategories: Record<string, string> = {},
): MatchResult[] {
  return candidates
    .map((c) => matchCandidate(c, userVector, axisWeights, topicCategories))
    .sort((a, b) => {
      const ap = a.matchPercentage;
      const bp = b.matchPercentage;
      if (ap === null && bp === null)
        return a.candidate.displayName.localeCompare(
          b.candidate.displayName,
          "pt-BR",
        );
      if (ap === null) return 1;
      if (bp === null) return -1;
      if (bp !== ap) return bp - ap;
      return a.candidate.displayName.localeCompare(
        b.candidate.displayName,
        "pt-BR",
      );
    });
}

export function answeredCount(userVector: UserVector): number {
  return Object.values(userVector).filter(hasPosition).length;
}
