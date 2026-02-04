import { PoliticianService } from "./politician.server";
import { TAG_DEFINITIONS } from "~/data/tag-definitions";
import {
    calculateArchetype,
    calculateMatchStrength,
    getDominantCategories,
    type Archetype
} from "~/data/archetypes";

export interface TagMatchInfo {
    slug: string;
    name: string;
    score: number;
    reasonText: string;
}

export interface MatchResult {
    politician: {
        id: string;
        name: string;
        party: string;
        photoUrl: string | null;
    };
    score: number;
    percentage: number;
    matchedTags: TagMatchInfo[];
    categoryScores: { subject: string; user: number; politician: number; fullMark: number }[];
}

export interface PartyResult {
    party: string;
    score: number;
    percentage: number;
    count: number;
}

export interface MatchMetadata {
    archetype: Archetype;
    dominantCategories: string[];
    matchStrength: "strong" | "moderate" | "weak";
}

// Cache simples em memória para otimizar performance
let cachedPoliticians: Awaited<ReturnType<typeof PoliticianService.findAllForMatch>> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const MatchService = {
    async calculate(userScores: Record<string, number>): Promise<{
        topPoliticians: MatchResult[],
        topParties: PartyResult[],
        userScores: Record<string, number>,
        metadata: MatchMetadata
    }> {
        // Usar cache se disponível e válido
        const now = Date.now();
        let politicians;
        
        if (cachedPoliticians && (now - cacheTimestamp) < CACHE_TTL) {
            console.log('[MatchService] Using cached politicians data');
            politicians = cachedPoliticians;
        } else {
            console.log('[MatchService] Fetching fresh politicians data from database');
            politicians = await PoliticianService.findAllForMatch();
            cachedPoliticians = politicians;
            cacheTimestamp = now;
        }

        // Helper to get category for a slug
        const tagCategoryMap: Record<string, string> = {};
        politicians.forEach(p => p.tags.forEach(pt => {
            tagCategoryMap[pt.tag.slug] = pt.tag.category;
        }));

        const userCategoryScores: Record<string, number> = {};

        // Calculate user max scores per category
        Object.entries(userScores).forEach(([slug, score]) => {
            const cat = tagCategoryMap[slug] || "Geral";
            if (!userCategoryScores[cat]) userCategoryScores[cat] = 0;
            userCategoryScores[cat] += Math.abs(score);
        });

        // Calculate Matches
        const politicianMatches: MatchResult[] = politicians.map(politician => {
            let totalPossibleScore = 0;
            let earnedScore = 0;
            const matchedTags: TagMatchInfo[] = [];
            const polCategoryScores: Record<string, number> = {};

            // Reset pol category scores
            Object.keys(userCategoryScores).forEach(cat => polCategoryScores[cat] = 0);

            Object.entries(userScores).forEach(([tagSlug, weight]) => {
                totalPossibleScore += Math.abs(weight);
                const cat = tagCategoryMap[tagSlug] || "Geral";

                const politicianTag = politician.tags.find(t => t.tag.slug === tagSlug);

                if (politicianTag) {
                    earnedScore += weight;
                    if (!polCategoryScores[cat]) polCategoryScores[cat] = 0;
                    polCategoryScores[cat] += weight;

                    const def = TAG_DEFINITIONS[tagSlug];
                    matchedTags.push({
                        slug: tagSlug,
                        name: politicianTag.tag.name,
                        score: weight,
                        reasonText: def ? def.reasonText : `Vocês convergem em ${politicianTag.tag.name}`
                    });
                }
            });

            matchedTags.sort((a, b) => b.score - a.score);

            const percentage = totalPossibleScore > 0
                ? Math.max(0, Math.min(100, (earnedScore / totalPossibleScore) * 100))
                : 0;

            // Prepare Radar Data
            const categoryData = Object.keys(userCategoryScores).map(cat => ({
                subject: cat,
                user: 100,
                politician: userCategoryScores[cat] > 0
                    ? Math.max(0, (polCategoryScores[cat] / userCategoryScores[cat]) * 100)
                    : 0,
                fullMark: 100
            }));

            return {
                politician: {
                    id: politician.id,
                    name: politician.name,
                    party: politician.party,
                    photoUrl: politician.photoUrl,
                },
                score: earnedScore,
                percentage: Math.round(percentage),
                matchedTags,
                categoryScores: categoryData
            };
        });

        const topPoliticians = politicianMatches
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 6);

        // Calculate Party Averages
        const partyMap: Record<string, { totalPercentage: number; count: number }> = {};
        politicianMatches.forEach(match => {
            if (!partyMap[match.politician.party]) {
                partyMap[match.politician.party] = { totalPercentage: 0, count: 0 };
            }
            partyMap[match.politician.party].totalPercentage += match.percentage;
            partyMap[match.politician.party].count += 1;
        });

        const topParties: PartyResult[] = Object.entries(partyMap)
            .map(([party, data]) => ({
                party,
                score: 0,
                percentage: Math.round(data.totalPercentage / data.count),
                count: data.count
            }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5);

        // Calculate metadata for the result page
        const archetype = calculateArchetype(userScores);
        const topMatch = topPoliticians[0];
        const matchStrength = topMatch ? calculateMatchStrength(topMatch.percentage) : "weak";
        const dominantCategories = topMatch ? getDominantCategories(topMatch.categoryScores) : [];

        const metadata: MatchMetadata = {
            archetype,
            dominantCategories,
            matchStrength
        };

        return { topPoliticians, topParties, userScores, metadata };
    }
};
