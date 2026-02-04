export interface Archetype {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tagPatterns: string[];
  gradient: [string, string];
}

export const ARCHETYPES: Archetype[] = [
  {
    id: "fiscal",
    name: "O Fiscal",
    emoji: "🎯",
    description: "Você prioriza transparência, economia de recursos públicos e responsabilidade fiscal. Busca políticos que gastem menos e entreguem mais.",
    tagPatterns: ["baixo-custo", "oposicao-governo", "oposicao-rigoroso", "assiduo"],
    gradient: ["#0f766e", "#14b8a6"] // Teal
  },
  {
    id: "progressista",
    name: "O Progressista",
    emoji: "🌱",
    description: "Você valoriza avanços sociais, proteção ambiental e direitos individuais. Busca mudanças que ampliem liberdades e protejam minorias.",
    tagPatterns: ["progressista-costumes", "ambientalista", "garantista", "estatista"],
    gradient: ["#059669", "#34d399"] // Emerald
  },
  {
    id: "pragmatico",
    name: "O Pragmático",
    emoji: "⚖️",
    description: "Você busca equilíbrio e soluções práticas. Não se prende a ideologias rígidas, preferindo avaliar cada pauta pelo seu mérito individual.",
    tagPatterns: ["governista-flexivel", "reformista-economico", "assiduo"],
    gradient: ["#4f46e5", "#818cf8"] // Indigo
  },
  {
    id: "conservador",
    name: "O Conservador",
    emoji: "🛡️",
    description: "Você valoriza tradições, segurança pública rigorosa e valores familiares. Busca estabilidade e cautela nas mudanças sociais.",
    tagPatterns: ["conservador-costumes", "rigoroso", "ruralista", "oposicao-governo"],
    gradient: ["#be185d", "#f472b6"] // Pink
  },
  {
    id: "liberal",
    name: "O Liberal",
    emoji: "🚀",
    description: "Você defende menos intervenção do Estado na economia e mais liberdade individual. Acredita no livre mercado e na iniciativa privada.",
    tagPatterns: ["liberal", "liberdade-digital", "reformista-economico", "baixo-custo"],
    gradient: ["#7c3aed", "#a78bfa"] // Violet
  },
  {
    id: "estatista",
    name: "O Estatista",
    emoji: "🏛️",
    description: "Você acredita no papel do Estado como promotor do bem-estar social. Defende serviços públicos fortes e regulação de setores estratégicos.",
    tagPatterns: ["estatista", "regulacao-digital", "base-governo", "progressista-costumes"],
    gradient: ["#dc2626", "#f87171"] // Red
  }
];

/**
 * Determines the user's archetype based on their quiz scores.
 * Returns the archetype with the highest match score.
 */
export function calculateArchetype(userScores: Record<string, number>): Archetype {
  let bestMatch: Archetype = ARCHETYPES[2]; // Default to Pragmático
  let bestScore = -Infinity;

  for (const archetype of ARCHETYPES) {
    let score = 0;
    for (const tag of archetype.tagPatterns) {
      if (userScores[tag]) {
        score += userScores[tag];
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = archetype;
    }
  }

  return bestMatch;
}

/**
 * Determines match strength based on the percentage difference
 * from average match.
 */
export function calculateMatchStrength(percentage: number): "strong" | "moderate" | "weak" {
  if (percentage >= 75) return "strong";
  if (percentage >= 50) return "moderate";
  return "weak";
}

/**
 * Extracts the dominant categories from user scores.
 */
export function getDominantCategories(
  categoryScores: { subject: string; user: number; politician: number }[]
): string[] {
  return categoryScores
    .filter(c => c.politician > 0)
    .sort((a, b) => b.politician - a.politician)
    .slice(0, 3)
    .map(c => c.subject);
}
