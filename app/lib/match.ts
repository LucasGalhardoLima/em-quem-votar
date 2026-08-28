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

/**
 * Mínimo de temas comparáveis para que um percentual seja publicado.
 *
 * POR QUE ISTO EXISTE
 *
 * A cobertura documental é desigual e a desigualdade é do documento, não
 * nossa: em 27/08/2026 as 13 candidaturas presidenciais iam de 1 a 14 temas
 * registrados — a proposta protocolada da DC é um template que repete a
 * mesma frase em 30 subseções, enquanto a do PCB traz 21 pontos concretos.
 *
 * Sem piso, uma candidatura com UM tema documentado que casasse com a
 * resposta da pessoa exibiria 100% e ocuparia o primeiro lugar do pódio
 * sobre outra com catorze temas e 90%. O rótulo embaixo dizia a verdade
 * ("1 de 1 temas comparáveis"), mas quem fala alto é a barra e a posição.
 *
 * A saída não é ordenar diferente — é não publicar um número que o dado não
 * sustenta, exatamente como `matchPercentage` já é `null` (nunca `0`) quando
 * nada é comparável. Percentual vindo de um único tema é ruído com aparência
 * de precisão, e este projeto prefere dizer "não sei" a arredondar.
 *
 * O valor é deliberadamente baixo: serve contra o caso degenerado de um ou
 * dois temas, não para esconder candidatura. Mexer aqui muda o que o site
 * publica — atualize a metodologia §3 junto.
 */
export const MIN_COMPARABLE_TOPICS = 3;

/**
 * Distância quadrática esperada entre duas respostas Likert independentes.
 *
 * Var(uniforme{1..5}) = 2, e a diferença entre duas respostas independentes
 * tem variância 2 + 2 = 4. Normalizado por MAX_SQUARED_DIFF, 4/16 dá 75% —
 * o "não sei nada sobre esta candidatura". É o ponto de partida do qual cada
 * tema documentado afasta o percentual, com base em evidência.
 */
export const PRIOR_SQUARED_DIFF = 4;

/**
 * Temas virtuais somados à conta, no valor do prior. É o que impede o
 * algoritmo de PUNIR quem documenta mais.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * A fórmula é uma média de distâncias quadráticas. Média de amostra pequena
 * tem variância grande, e ranking premia extremos — logo o pódio era ocupado
 * por quem tinha MENOS posições registradas, o oposto do que a plataforma
 * existe para fazer.
 *
 * Medido em 27/08/2026 com o banco real, mantendo as notas de uma candidatura
 * e as 12 concorrentes fixas, variando só quantas das posições dela estavam
 * visíveis (20 mil eleitores sintéticos por ponto):
 *
 *   temas visíveis   3      5      8     11     13
 *   1º lugar (k=0) 16,6%  10,7%   4,8%   4,3%   2,2%   ← documentar PUNIA
 *   1º lugar (k=3) 10,7%   8,0%   6,9%   5,9%   4,8%   ← praticamente plano
 *
 * A média dela não se movia em nenhum dos casos (~72%): a compatibilidade
 * real era a mesma, só a variância mudava.
 *
 * POR QUE 3, E NÃO MAIS
 *
 * O prior comprime a escala nos dois extremos, e quanto maior o k, mais.
 * Medido:
 *
 *   k   penalidade por documentar   amplitude com 3 temas   teto com 13
 *   0            7,5x                    100 pts               100%
 *   3            2,2x                     50 pts                95%
 *   5            2,0x                     37 pts                93%
 *
 * k=5 quase não corrige mais que k=3 e custa 13 pontos de amplitude a mais
 * justamente onde o piso permite entrar. k=3 também tem a coerência de pesar
 * exatamente o mínimo de evidência que já exigimos em MIN_COMPARABLE_TOPICS.
 *
 * CONSEQUÊNCIA VISÍVEL, e ela é intencional: a escala aperta quando há pouca
 * evidência. Com 3 temas o percentual vive entre 38% e 88%; com 24, entre 15%
 * e 96%. Ninguém chega a 100%, porque 100% afirmaria uma certeza que nenhuma
 * amostra sustenta — a mesma disciplina que faz `matchPercentage` ser `null`
 * em vez de `0`.
 */
export const SHRINKAGE_TOPICS = 3;

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
  /**
   * 0..100. `null` em dois casos distintos, que a interface precisa
   * diferenciar: nenhum tema comparável, ou base documental abaixo de
   * `MIN_COMPARABLE_TOPICS`. Use `insufficientBase` para saber qual.
   */
  matchPercentage: number | null;
  /**
   * `true` quando existe alguma comparação, mas poucas demais para publicar
   * percentual. Distingue "esta candidatura não tem posição registrada em
   * nenhum tema que você respondeu" de "tem, mas só uma ou duas" — a
   * primeira é ausência, a segunda é base fraca, e dizer "sem dados" para as
   * duas apaga informação verdadeira.
   */
  insufficientBase: boolean;
  /** Temas em que havia resposta E posição documentada. */
  comparableCount: number;
  /** Dos comparáveis, quantos ficaram a distância <= 1. */
  agreeCount: number;
  comparisons: TopicComparison[];
  categoryScores: CategoryScore[];
}

export type UserVector = Record<string, number>;
export type AxisWeights = Record<string, ImportanceLevel>;

/**
 * Converte soma ponderada em percentual, ou `null` quando não há o que comparar.
 *
 * A guarda testa `Number.isFinite`, não `<= 0`, porque `NaN <= 0` é `false` —
 * um NaN passaria direto e sairia como "NaN%" na tela. Esta é a última função
 * antes do número que a pessoa lê; melhor devolver "sem dados suficientes",
 * que é verdade, do que um percentual quebrado.
 */
function percentFrom(weightedSum: number, totalWeight: number): number | null {
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return null;
  if (!Number.isFinite(weightedSum)) return null;

  // Os temas virtuais entram nos DOIS lados da fração. Amostra grande os
  // dilui; amostra pequena é puxada para o prior. Ver SHRINKAGE_TOPICS.
  const numerador = weightedSum + SHRINKAGE_TOPICS * PRIOR_SQUARED_DIFF;
  const denominador = totalWeight + SHRINKAGE_TOPICS;

  const raw = (1 - numerador / (denominador * MAX_SQUARED_DIFF)) * 100;
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

  // O piso é três temas — ou metade do que a pessoa respondeu, quando ela
  // respondeu menos de seis. O que importa não é a contagem absoluta e sim a
  // fatia do que ELA perguntou que conseguimos responder: 1 tema de 20
  // respondidos é ruído (5%), mas 2 de 3 é cobertura de dois terços e merece
  // percentual. Um piso fixo puniria justamente quem respondeu pouco.
  const answered = answeredCount(userVector);
  const floor = Math.min(MIN_COMPARABLE_TOPICS, Math.ceil(answered / 2));
  const insufficientBase = comparableCount > 0 && comparableCount < floor;

  return {
    candidate,
    matchPercentage: insufficientBase
      ? null
      : percentFrom(weightedSum, totalWeight),
    insufficientBase,
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
