/**
 * Vocabulário único para posições, respostas e concordância.
 *
 * Regra de neutralidade (research.md §6): a escala é sempre descrita em
 * relação à AFIRMAÇÃO do tema, nunca em relação a um campo político. Não
 * existe "posição certa" — só distância entre o que a pessoa respondeu e o
 * que está documentado.
 *
 * A escala no banco é Likert 1–5. O valor 0 é reservado para
 * "sem posição registrada" e NUNCA é tratado como neutro: temas sem
 * documento ficam fora do denominador do cálculo de compatibilidade.
 */

export const STANCE_UNKNOWN = 0;
export const STANCE_MIN = 1;
export const STANCE_MAX = 5;

/** Como a resposta da pessoa usuária é rotulada no quiz. */
export const USER_STANCE_LABELS: Record<number, string> = {
  1: "Discordo totalmente",
  2: "Discordo em parte",
  3: "Neutro / não sei",
  4: "Concordo em parte",
  5: "Concordo totalmente",
};

/** Como a posição documentada de um candidato é rotulada. */
export const CANDIDATE_STANCE_LABELS: Record<number, string> = {
  1: "Totalmente contrária",
  2: "Parcialmente contrária",
  3: "Neutra",
  4: "Parcialmente favorável",
  5: "Totalmente favorável",
};

export const NO_POSITION_LABEL = "Sem posição registrada";
export const SKIPPED_LABEL = "Você pulou este tema";
export const NO_QUIZ_LABEL = "Faça o quiz";

export function userStanceLabel(stance: number | null | undefined): string {
  if (stance == null || stance === STANCE_UNKNOWN) return SKIPPED_LABEL;
  return USER_STANCE_LABELS[stance] ?? SKIPPED_LABEL;
}

export function candidateStanceLabel(stance: number | null | undefined): string {
  if (stance == null || stance === STANCE_UNKNOWN) return NO_POSITION_LABEL;
  return CANDIDATE_STANCE_LABELS[stance] ?? NO_POSITION_LABEL;
}

export function hasPosition(stance: number | null | undefined): stance is number {
  return stance != null && stance >= STANCE_MIN && stance <= STANCE_MAX;
}

export type AgreementKind = "close" | "distant" | "not-comparable" | "no-quiz";

export interface Agreement {
  kind: AgreementKind;
  /** Distância absoluta na escala (0–4), ou null se incomparável. */
  distance: number | null;
  label: string;
}

/**
 * Um tema só é comparável quando existem AS DUAS pontas: posição
 * documentada e resposta da pessoa. "Próximo" é distância <= 1 na escala
 * de 5 pontos — o mesmo limiar usado no texto da metodologia.
 */
export function agreementFor(
  candidateStance: number | null | undefined,
  userStance: number | null | undefined,
  { hasQuiz = true }: { hasQuiz?: boolean } = {},
): Agreement {
  if (!hasQuiz) return { kind: "no-quiz", distance: null, label: "—" };
  if (!hasPosition(candidateStance) || !hasPosition(userStance)) {
    return { kind: "not-comparable", distance: null, label: "fora da conta" };
  }
  const distance = Math.abs(candidateStance - userStance);
  return distance <= 1
    ? { kind: "close", distance, label: "próximo" }
    : { kind: "distant", distance, label: "distante" };
}

/** Classes Tailwind do chip de concordância, por tipo. */
export const AGREEMENT_CHIP_CLASS: Record<AgreementKind, string> = {
  close: "border-green-600/25 bg-green-600/[0.07] text-green-700",
  distant: "border-red-600/20 bg-red-600/[0.06] text-red-700",
  "not-comparable": "border-slate-200 bg-slate-50 text-slate-400",
  "no-quiz": "border-slate-200 bg-slate-50 text-slate-400",
};

/** Peso que a pessoa atribui a cada eixo temático. */
export const IMPORTANCE_LEVELS = ["low", "medium", "high"] as const;
export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
};

export const IMPORTANCE_MULTIPLIERS: Record<ImportanceLevel, number> = {
  high: 1.5,
  medium: 1.0,
  low: 0.5,
};

export function getMultiplier(level: ImportanceLevel | undefined): number {
  return IMPORTANCE_MULTIPLIERS[level ?? "medium"];
}
