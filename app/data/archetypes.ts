export interface Archetype {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tagPatterns: string[];
  gradient: [string, string];
  compass: { economic: number; social: number }; // -1 to 1 range
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "liberal",
    name: "O Liberal",
    emoji: "🚀",
    description:
      "Você defende um Estado enxuto, menos impostos e liberdade econômica. Na presidência, busca um líder que reduza a máquina pública e estimule o empreendedorismo.",
    tagPatterns: ["economia-e-fiscal", "democracia-e-institucional"],
    gradient: ["#7c3aed", "#a78bfa"], // Violet
    compass: { economic: 0.7, social: 0.3 },
  },
  {
    id: "estatista",
    name: "O Estatista",
    emoji: "🏛️",
    description:
      "Você acredita que o Estado deve liderar o desenvolvimento, com empresas públicas fortes e investimento social. Na presidência, busca quem amplie serviços públicos e proteja setores estratégicos.",
    tagPatterns: ["economia-e-fiscal", "meio-ambiente-e-agro"],
    gradient: ["#dc2626", "#f87171"], // Red
    compass: { economic: -0.7, social: -0.2 },
  },
  {
    id: "conservador",
    name: "O Conservador",
    emoji: "🛡️",
    description:
      "Você valoriza tradições, segurança firme e valores familiares. Na presidência, busca um líder que priorize ordem, combata a criminalidade e preserve costumes.",
    tagPatterns: ["seguranca-publica", "direitos-e-costumes"],
    gradient: ["#be185d", "#f472b6"], // Pink
    compass: { economic: 0.4, social: -0.7 },
  },
  {
    id: "progressista",
    name: "O Progressista",
    emoji: "🌱",
    description:
      "Você defende avanços sociais, direitos individuais e proteção ambiental. Na presidência, busca quem amplie liberdades, combata desigualdades e proteja minorias.",
    tagPatterns: ["direitos-e-costumes", "meio-ambiente-e-agro"],
    gradient: ["#059669", "#34d399"], // Emerald
    compass: { economic: -0.4, social: 0.7 },
  },
  {
    id: "pragmatico",
    name: "O Pragmático",
    emoji: "⚖️",
    description:
      "Você não se prende a ideologias e avalia cada proposta pelo mérito. Na presidência, busca equilíbrio, diálogo e soluções práticas para os problemas do país.",
    tagPatterns: ["economia-e-fiscal", "democracia-e-institucional"],
    gradient: ["#4f46e5", "#818cf8"], // Indigo
    compass: { economic: 0, social: 0 },
  },
  {
    id: "fiscal",
    name: "O Fiscal",
    emoji: "🎯",
    description:
      "Você prioriza responsabilidade fiscal, transparência e eficiência dos gastos públicos. Na presidência, busca um líder que controle o orçamento e combata o desperdício.",
    tagPatterns: ["economia-e-fiscal"],
    gradient: ["#0f766e", "#14b8a6"], // Teal
    compass: { economic: 0.6, social: 0 },
  },
];

/**
 * As 5 categorias temáticas presidenciais e como cada uma
 * contribui para os eixos do compasso político.
 */
interface AxisMapping {
  axis: "economic" | "social";
  direction: 1 | -1;
  weight: number;
}

const CATEGORY_AXIS_MAP: Record<string, AxisMapping[]> = {
  "economia-e-fiscal": [
    { axis: "economic", direction: 1, weight: 1.0 },
  ],
  "direitos-e-costumes": [
    { axis: "social", direction: 1, weight: 1.0 },
  ],
  "seguranca-publica": [
    { axis: "social", direction: -1, weight: 0.8 },
  ],
  "meio-ambiente-e-agro": [
    { axis: "economic", direction: -1, weight: 0.5 },
    { axis: "social", direction: 1, weight: 0.5 },
  ],
  "democracia-e-institucional": [
    { axis: "social", direction: 1, weight: 0.7 },
  ],
};

/** Todas as categorias temáticas presidenciais */
export const THEMATIC_CATEGORIES = [
  "Economia e Fiscal",
  "Segurança Pública",
  "Meio Ambiente e Agro",
  "Direitos e Costumes",
  "Democracia e Institucional",
] as const;

export type ThematicCategory = (typeof THEMATIC_CATEGORIES)[number];

/** Mapa de slug para nome legível */
const CATEGORY_SLUG_TO_NAME: Record<string, ThematicCategory> = {
  "economia-e-fiscal": "Economia e Fiscal",
  "seguranca-publica": "Segurança Pública",
  "meio-ambiente-e-agro": "Meio Ambiente e Agro",
  "direitos-e-costumes": "Direitos e Costumes",
  "democracia-e-institucional": "Democracia e Institucional",
};

/**
 * Normaliza uma pontuação Likert (1-5) para o intervalo -1..+1.
 * 1 → -1, 3 → 0, 5 → +1
 */
function normalizeLikert(score: number): number {
  return (score - 3) / 2;
}

/**
 * Calcula a posição do usuário no compasso político 2D
 * a partir das pontuações por tópico (slug → 1-5).
 */
export function calculateCompassPosition(
  userVector: Record<string, number>
): { economic: number; social: number } {
  let economicSum = 0;
  let economicWeight = 0;
  let socialSum = 0;
  let socialWeight = 0;

  for (const [slug, rawScore] of Object.entries(userVector)) {
    const mappings = CATEGORY_AXIS_MAP[slug];
    if (!mappings) continue;

    const normalized = normalizeLikert(rawScore);

    for (const mapping of mappings) {
      const contribution = normalized * mapping.direction * mapping.weight;

      if (mapping.axis === "economic") {
        economicSum += contribution;
        economicWeight += mapping.weight;
      } else {
        socialSum += contribution;
        socialWeight += mapping.weight;
      }
    }
  }

  return {
    economic: economicWeight > 0 ? economicSum / economicWeight : 0,
    social: socialWeight > 0 ? socialSum / socialWeight : 0,
  };
}

/**
 * Distância euclidiana entre dois pontos no compasso político.
 */
function euclideanDistance(
  a: { economic: number; social: number },
  b: { economic: number; social: number }
): number {
  return Math.sqrt(
    (a.economic - b.economic) ** 2 + (a.social - b.social) ** 2
  );
}

/**
 * Determina o arquétipo do usuário com base nas suas pontuações
 * por tópico (escala Likert 1-5).
 *
 * Calcula a posição no compasso político e encontra o arquétipo
 * mais próximo pela distância euclidiana.
 */
export function calculateArchetype(
  userVector: Record<string, number>
): Archetype {
  const userPosition = calculateCompassPosition(userVector);

  let bestMatch: Archetype = ARCHETYPES[4]; // Default: Pragmático (centro)
  let bestDistance = Infinity;

  for (const archetype of ARCHETYPES) {
    const distance = euclideanDistance(userPosition, archetype.compass);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = archetype;
    }
  }

  return bestMatch;
}

/**
 * Determina a força da compatibilidade baseado na porcentagem.
 */
export function calculateMatchStrength(
  percentage: number
): "strong" | "moderate" | "weak" {
  if (percentage >= 75) return "strong";
  if (percentage >= 50) return "moderate";
  return "weak";
}

/**
 * Extrai as categorias temáticas dominantes a partir dos scores por categoria.
 */
export function getDominantCategories(
  categoryScores: {
    subject: string;
    user: number;
    politician: number;
  }[]
): string[] {
  return categoryScores
    .filter((c) => c.politician > 0)
    .sort((a, b) => b.politician - a.politician)
    .slice(0, 3)
    .map((c) => c.subject);
}

/**
 * Converte um slug de categoria para o nome legível em pt-BR.
 */
export function getCategoryName(slug: string): string {
  return CATEGORY_SLUG_TO_NAME[slug] ?? slug;
}
