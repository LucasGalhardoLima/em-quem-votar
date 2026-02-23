import { CandidateService } from "./candidate.server";
import {
  calculateArchetype,
  calculateCompassPosition,
  calculateMatchStrength,
  getCategoryName,
  type Archetype,
} from "~/data/archetypes";
import type { ImportanceLevel } from "~/components/quiz/ImportanceWeighting";

// ============================================================
// Types
// ============================================================

export interface MatchedPosition {
  topicName: string;
  userStance: number;
  candidateStance: number;
  agreement: boolean;
}

export interface CategoryScore {
  category: string;
  score: number;
}

export interface CandidateMatchResult {
  candidate: {
    id: string;
    name: string;
    displayName: string;
    party: string;
    photoUrl: string | null;
    coalition: string | null;
    registrationStatus: string;
    positionCount: number;
    tags: { name: string; slug: string; category: string }[];
  };
  matchPercentage: number;
  matchedPositions: MatchedPosition[];
  categoryScores: CategoryScore[];
}

export interface MatchMetadata {
  archetype: Archetype;
  matchStrength: "strong" | "moderate" | "weak";
  dominantCategories: string[];
  totalCandidatesEvaluated: number;
}

// ============================================================
// Constants
// ============================================================

/** Penalty applied per missing position (uncertainty discount) */
const UNCERTAINTY_PENALTY = 0.4;

/** Maximum possible squared difference per topic on the Likert scale: (5-1)^2 = 16 */
const MAX_SQUARED_DIFF = 16;

// ============================================================
// Importance weight multipliers
// ============================================================

const IMPORTANCE_MULTIPLIERS: Record<ImportanceLevel, number> = {
  high: 1.5,
  medium: 1.0,
  low: 0.5,
};

// ============================================================
// Cache
// ============================================================

let cachedCandidates: Awaited<
  ReturnType<typeof CandidateService.findAllForMatch>
> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

// ============================================================
// Service
// ============================================================

export const MatchService = {
  /**
   * Calculate candidate matches using Euclidean distance in topic-stance space.
   *
   * @param userVector - Record<topicSlug, stanceValue (1-5)>
   * @param axisWeights - Optional per-axis importance weights
   */
  async calculate(
    userVector: Record<string, number>,
    axisWeights?: Record<string, ImportanceLevel>
  ): Promise<{
    topCandidates: CandidateMatchResult[];
    archetype: Archetype;
    metadata: MatchMetadata;
  }> {
    // Fetch candidates with cache
    const now = Date.now();
    let candidates;

    if (cachedCandidates && now - cacheTimestamp < CACHE_TTL) {
      candidates = cachedCandidates;
    } else {
      candidates = await CandidateService.findAllForMatch();
      cachedCandidates = candidates;
      cacheTimestamp = now;
    }

    const userTopicSlugs = Object.keys(userVector);
    const totalTopics = userTopicSlugs.length;

    if (totalTopics === 0) {
      const archetype = calculateArchetype({});
      return {
        topCandidates: [],
        archetype,
        metadata: {
          archetype,
          matchStrength: "weak",
          dominantCategories: [],
          totalCandidatesEvaluated: candidates.length,
        },
      };
    }

    // Build category lookup from candidate data
    const topicCategoryMap: Record<string, string> = {};
    for (const c of candidates) {
      if (c.positionCategories) {
        for (const [slug, cat] of Object.entries(c.positionCategories)) {
          topicCategoryMap[slug] = cat;
        }
      }
    }

    // Calculate matches per candidate
    const results: CandidateMatchResult[] = candidates.map((candidate) => {
      let weightedSquaredDistanceSum = 0;
      let totalWeight = 0;
      const matchedPositions: MatchedPosition[] = [];
      const categoryAccum: Record<string, { sum: number; count: number }> = {};

      for (const topicSlug of userTopicSlugs) {
        const userStance = userVector[topicSlug];
        const candidateStance = candidate.positions[topicSlug];
        const category =
          topicCategoryMap[topicSlug] ||
          candidate.positionCategories?.[topicSlug] ||
          "Geral";

        // Determine importance weight for this topic's category
        const importanceLevel = axisWeights?.[category] ?? "medium";
        const weight = IMPORTANCE_MULTIPLIERS[importanceLevel];

        if (candidateStance && candidateStance > 0) {
          // Both have positions: compute squared difference
          const diff = userStance - candidateStance;
          const squaredDiff = diff * diff;
          weightedSquaredDistanceSum += squaredDiff * weight;

          const agreement = Math.abs(diff) <= 1;
          matchedPositions.push({
            topicName: topicSlug, // Will be resolved with proper names
            userStance,
            candidateStance,
            agreement,
          });

          // Category accumulation for per-axis scoring
          if (!categoryAccum[category]) {
            categoryAccum[category] = { sum: 0, count: 0 };
          }
          const topicScore = 1 - squaredDiff / MAX_SQUARED_DIFF;
          categoryAccum[category].sum += topicScore;
          categoryAccum[category].count += 1;
        } else {
          // Missing position: apply uncertainty penalty
          weightedSquaredDistanceSum +=
            MAX_SQUARED_DIFF * UNCERTAINTY_PENALTY * weight;
        }

        totalWeight += weight;
      }

      // Normalize: convert weighted distance sum to 0-100 percentage
      // maxPossibleDistance = totalWeight * MAX_SQUARED_DIFF
      const maxPossible = totalWeight * MAX_SQUARED_DIFF;
      const normalizedDistance =
        maxPossible > 0 ? weightedSquaredDistanceSum / maxPossible : 1;
      const matchPercentage = Math.round((1 - normalizedDistance) * 100);

      // Category scores as percentages
      const categoryScores: CategoryScore[] = Object.entries(categoryAccum)
        .map(([category, { sum, count }]) => ({
          category: getCategoryName(category) || category,
          score: count > 0 ? (sum / count) * 100 : 0,
        }))
        .sort((a, b) => b.score - a.score);

      return {
        candidate: {
          id: candidate.id,
          name: candidate.name,
          displayName: candidate.displayName,
          party: candidate.party,
          photoUrl: candidate.photoUrl,
          coalition: candidate.coalition,
          registrationStatus: candidate.registrationStatus,
          positionCount: candidate.positionCount,
          tags: candidate.tags,
        },
        matchPercentage: Math.max(0, Math.min(100, matchPercentage)),
        matchedPositions,
        categoryScores,
      };
    });

    // Sort by match percentage descending
    results.sort((a, b) => b.matchPercentage - a.matchPercentage);
    const topCandidates = results.slice(0, 10);

    // Calculate user archetype from compass position
    // Convert userVector to category-level scores for the compass
    const categoryLevelScores: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    for (const [slug, stance] of Object.entries(userVector)) {
      const cat = topicCategoryMap[slug];
      if (cat) {
        const catSlug = cat
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        if (!categoryLevelScores[catSlug]) {
          categoryLevelScores[catSlug] = 0;
          categoryCounts[catSlug] = 0;
        }
        categoryLevelScores[catSlug] += stance;
        categoryCounts[catSlug] += 1;
      }
    }

    // Average per category to feed into compass
    const compassInput: Record<string, number> = {};
    for (const [catSlug, sum] of Object.entries(categoryLevelScores)) {
      compassInput[catSlug] = sum / categoryCounts[catSlug];
    }

    const archetype = calculateArchetype(compassInput);
    const topMatch = topCandidates[0];
    const matchStrength = topMatch
      ? calculateMatchStrength(topMatch.matchPercentage)
      : "weak";
    const dominantCategories = topMatch
      ? topMatch.categoryScores.slice(0, 3).map((cs) => cs.category)
      : [];

    return {
      topCandidates,
      archetype,
      metadata: {
        archetype,
        matchStrength,
        dominantCategories,
        totalCandidatesEvaluated: candidates.length,
      },
    };
  },
};
