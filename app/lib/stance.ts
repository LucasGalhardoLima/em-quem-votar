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

/**
 * Existe posição (ou resposta) utilizável neste ponto?
 *
 * A checagem é por TIPO antes de ser por faixa, e isso não é preciosismo. Os
 * dois lados que passam por aqui vêm de fora do TypeScript: as respostas do
 * quiz voltam do localStorage do navegador (metodologia §5) e as posições vêm
 * do banco por JSON. Operador relacional COAGE o outro lado — `true >= 1`,
 * `"5" <= 5` e `[3] >= 1` são todos verdadeiros —, então um resto de
 * serialização atravessava a faixa 1–5, virava `Math.abs(5 - true)` e saía na
 * tela como discordância documentada de uma pessoa real. `Number.isInteger`
 * fecha a porta de uma vez: rejeita não-número, NaN, Infinity e fracionário
 * (a escala no banco é `Int`), é a mesma disciplina que `match.ts` já aplica
 * antes de publicar um percentual.
 *
 * O 0 continua fora, e por outro motivo: ele significa "sem posição
 * registrada" e NUNCA é o ponto médio da escala.
 */
export function hasPosition(stance: number | null | undefined): stance is number {
  return (
    typeof stance === "number" &&
    Number.isInteger(stance) &&
    stance >= STANCE_MIN &&
    stance <= STANCE_MAX
  );
}

/**
 * Distância máxima (na escala) ainda considerada "próximo".
 *
 * Mora aqui, no vocabulário de domínio, porque DUAS respostas dependem dela e
 * a pessoa vê as duas na mesma sessão: o chip "próximo"/"distante" de
 * `agreementFor()`, na ficha da candidatura, e o `agreeCount` de `match.ts`
 * ("concordância em X de Y temas"), no resultado do quiz. Enquanto o limiar era
 * a constante `CLOSE_THRESHOLD` lá e um literal `1` aqui, mudar um sem o outro
 * fazia a contagem e os chips discordarem sobre o MESMO par de respostas — uma
 * divergência que nada no código acusaria e que só a pessoa lendo a tela veria.
 *
 * A direção da unificação segue a das dependências: `match.ts` importa deste
 * módulo e nunca o contrário, então o limiar desce para cá e sobe de volta como
 * reexport, sem ciclo.
 */
export const CLOSE_THRESHOLD = 1;

export type AgreementKind = "close" | "distant" | "not-comparable" | "no-quiz";

export interface Agreement {
  kind: AgreementKind;
  /** Distância absoluta na escala (0–4), ou null se incomparável. */
  distance: number | null;
  label: string;
}

/**
 * Um tema só é comparável quando existem AS DUAS pontas: posição
 * documentada e resposta da pessoa. "Próximo" é distância <= CLOSE_THRESHOLD
 * na escala de 5 pontos — o mesmo limiar do texto da metodologia e o mesmo que
 * `match.ts` usa para contar `agreeCount`.
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
  return distance <= CLOSE_THRESHOLD
    ? { kind: "close", distance, label: "próximo" }
    : { kind: "distant", distance, label: "distante" };
}

/**
 * Classes Tailwind do chip de concordância, por tipo.
 *
 * Nenhum matiz de valência, e isso é regra de produto e não gosto. O par
 * verde/vermelho que morava aqui dizia, na ficha de uma pessoa real, que
 * concordar com quem lê é bom e discordar é ruim — o mesmo julgamento que a
 * neutralidade já proíbe nos chips de `Sim`/`Não` de votação, só que aplicado
 * à pessoa em vez de ao voto. E o canal de cor nem entregava o que
 * justificaria a quebra: verde contra vermelho é exatamente o par que
 * deuteranopia e protanopia colapsam, então quem mais dependeria da cor lia
 * dois chips iguais. O `indigo-600` está fora pelo mesmo motivo por outro
 * caminho: é o acento de destaque do site (o `isTop` do resultado), logo lê
 * como "melhor".
 *
 * A distinção sai do matiz e vai para o preenchimento. `close` e `distant`
 * têm a MESMA borda e o MESMO texto `slate-800` — mesmo quadro, mesma ênfase
 * tipográfica, nenhum dos dois em posição de destaque — e se separam só por o
 * chip ser tingido ou vazado sobre o cartão branco. Diferença de ênfase existe
 * apenas contra o terceiro degrau, o da ausência, e essa é legítima: fala de
 * dado que não temos, não de mérito de quem está na ficha. O significado
 * continua escrito no rótulo; o visual só não o contradiz.
 *
 * Contraste medido sobre o fundo real de cada chip: slate-800 sobre slate-200
 * dá 11,9:1, slate-800 sobre branco dá 14,6:1 e slate-500 sobre slate-50 dá
 * 4,55:1 — os três passam o AA de 4,5:1.
 */
export const AGREEMENT_CHIP_CLASS: Record<AgreementKind, string> = {
  close: "border-slate-400 bg-slate-200 text-slate-800",
  distant: "border-slate-400 bg-white text-slate-800",
  // `slate-500` e não `slate-400`: sobre `slate-50` o 400 dá 2,51:1 e reprova
  // o AA. São os dois chips de AUSÊNCIA, e eles aparecem 16 vezes na ficha de
  // uma candidatura pouco documentada — a maior concentração de texto ilegível
  // que restava no site, justamente no texto que a metodologia trata como o
  // mais importante: o que diz que não sabemos.
  "not-comparable": "border-slate-200 bg-slate-50 text-slate-500",
  "no-quiz": "border-slate-200 bg-slate-50 text-slate-500",
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

/**
 * Peso do eixo, com "médio" como padrão.
 *
 * A validação é deliberadamente mais larga que o tipo. O peso chega do
 * `quizStore` persistido em localStorage, e localStorage devolve o que
 * escreveram nele — versão antiga do store, edição manual, dado truncado. O
 * TypeScript garante o formato em tempo de compilação e nada em tempo de
 * execução, então um `"HIGH"` atravessa o tipo, sai daqui como `undefined` e
 * contamina o cálculo inteiro: a soma vira NaN e a pessoa lê "NaN%" com a
 * barra cheia. Checar a chave contra o mapa custa uma linha e fecha a porta
 * para qualquer valor, não só para `null`/`undefined`.
 */
export function getMultiplier(level: ImportanceLevel | undefined): number {
  const multiplier = level == null ? undefined : IMPORTANCE_MULTIPLIERS[level];
  return multiplier ?? IMPORTANCE_MULTIPLIERS.medium;
}
