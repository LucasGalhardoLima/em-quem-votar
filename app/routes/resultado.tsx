import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/resultado";
import { PoliticianService } from "~/services/politician.server";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { ArrowRight, Trophy, Users, AlertCircle, Share2, CheckCircle } from "lucide-react";
import { MatchRadarChart } from "~/components/MatchRadarChart";
import { TAG_DEFINITIONS } from "~/data/tag-definitions";

export function meta() {
    return [{ title: "Seu Resultado Político | Em Quem Votar" }];
}

interface TagMatchInfo {
    slug: string;
    name: string;
    score: number;
    reasonText: string;
}

interface MatchResult {
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

interface PartyResult {
    party: string;
    score: number;
    percentage: number;
    count: number;
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const scoresParam = url.searchParams.get("s"); // Format: tag1:5,tag2:3

    if (!scoresParam) {
        return { topPoliticians: [], topParties: [], userScores: {} };
    }

    // Parse user scores
    const userScores: Record<string, number> = {};
    const userCategoryScores: Record<string, number> = {};

    scoresParam.split(",").forEach(pair => {
        const [tagSlug, score] = pair.split(":");
        if (tagSlug && score) {
            const val = parseInt(score, 10);
            userScores[tagSlug] = val;

            // Calculate max potential per category (for Radar Chart)
            // Assuming TAG_DEFINITIONS has categories mapped correctly, 
            // but for now we'll do a simple mapping or default
            // Since we don't have category in TAG_DEFINITIONS yet, we'll infer or use hardcoded map.
            // Wait, Prisma model has category in Tag. Let's rely on finding the tag in politicians first? 
            // Actually better: We need the Tag model to know category. 
            // PoliticianService.findAllForMatch returns tags with category.
        }
    });

    const politicians = await PoliticianService.findAllForMatch();

    // Helper to get category for a slug (from the first politician who has it, adequate for MVP)
    // Or we could fetch all tags separately. For efficiency, let's build a temporary map from the fetched politicians.
    const tagCategoryMap: Record<string, string> = {};
    politicians.forEach(p => p.tags.forEach(pt => {
        tagCategoryMap[pt.tag.slug] = pt.tag.category;
    }));

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
            user: 100, // User is always 100% of themselves relative to the axes? Or should be normalized?
            // Let's normalize: If User max is 10, and they got 10, it's 100.
            // If Politician got 5 out of 10, it's 50.
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

    return { topPoliticians, topParties, userScores };
}

export default function Resultado() {
    const { topPoliticians, topParties } = useLoaderData<typeof loader>();
    const winner = topPoliticians[0];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Header />

            <main className="flex-grow pb-12">
                {/* Winner Hero Section */}
                {winner ? (
                    <section className="bg-gradient-to-br from-brand-text-alt via-brand-text to-brand-text-alt text-white py-12 lg:py-20 relative overflow-hidden">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>

                        <div className="max-w-6xl mx-auto px-4 relative z-10">
                            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

                                {/* Winner Profile */}
                                <div className="flex-1 text-center lg:text-right space-y-4 animate-fade-in-up">
                                    <div className="inline-block px-4 py-1 bg-brand-secondary text-brand-text-alt rounded-full text-sm font-bold tracking-wide uppercase mb-2">
                                        Seu Match #1
                                    </div>
                                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
                                        {winner.politician.name}
                                    </h1>
                                    <p className="text-xl md:text-2xl text-blue-200 font-medium">
                                        {winner.politician.party}
                                    </p>
                                    <div className="flex items-center justify-center lg:justify-end gap-3 mt-4">
                                        <div className="text-6xl font-bold text-white">{winner.percentage}%</div>
                                        <div className="text-sm text-brand-primary leading-tight text-left">
                                            de<br />compatibilidade
                                        </div>
                                    </div>
                                    <div className="pt-6 flex justify-center lg:justify-end">
                                        <Link
                                            to={`/politico/${winner.politician.id}`}
                                            className="bg-white text-brand-text-alt hover:bg-brand-tertiary font-bold py-3 px-8 rounded-full shadow-lg transition-transform transform hover:-translate-y-1 inline-flex items-center gap-2"
                                        >
                                            Ver Perfil Completo <ArrowRight size={20} />
                                        </Link>
                                    </div>
                                </div>

                                {/* Winner Photo Circle */}
                                <div className="relative shrink-0 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                    <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border-8 border-white/20 shadow-2xl overflow-hidden relative z-10 bg-gray-800">
                                        {winner.politician.photoUrl ? (
                                            <img src={winner.politician.photoUrl} alt={winner.politician.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/50">Foto</div>
                                        )}
                                    </div>
                                    {/* Decorative circles */}
                                    <div className="absolute inset-0 bg-brand-primary rounded-full blur-3xl opacity-30 -z-10 transform scale-110"></div>
                                </div>

                                {/* Radar Chart */}
                                <div className="flex-1 w-full max-w-sm bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                                    <h3 className="text-center text-sm font-bold text-brand-tertiary mb-2 uppercase tracking-wide">Áreas de Afinidade</h3>
                                    <MatchRadarChart data={winner.categoryScores} />
                                </div>

                            </div>
                        </div>
                    </section>
                ) : (
                    <div className="py-20 text-center">
                        <h1 className="text-3xl font-bold">Calculando resultados...</h1>
                    </div>
                )}

                <div className="max-w-4xl mx-auto space-y-16 px-4 mt-16">

                    {/* Top Politicians Grid (Runners Up) */}
                    {topPoliticians.length > 1 && (
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2 text-gray-800">
                                <Trophy className="text-gray-400" />
                                Outras Opções Compatíveis
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                {topPoliticians.slice(1, 5).map((match, idx) => (
                                    <Link
                                        key={match.politician.id}
                                        to={`/politico/${match.politician.id}`}
                                        className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden flex flex-col"
                                    >
                                        <div className="absolute top-0 right-0 bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1 rounded-bl-xl z-10 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                            {match.percentage}% Match
                                        </div>

                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-md flex-shrink-0">
                                                {match.politician.photoUrl && (
                                                    <img src={match.politician.photoUrl} alt={match.politician.name} className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-gray-900 leading-tight group-hover:text-brand-primary transition-colors">
                                                    {match.politician.name}
                                                </h3>
                                                <p className="text-sm text-gray-500 font-medium">
                                                    {match.politician.party}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Match Explanation */}
                                        {match.matchedTags.length > 0 && (
                                            <div className="mt-auto pt-4 border-t border-gray-50 space-y-2">
                                                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Por que deu match?</p>
                                                <div className="text-sm text-gray-600 leading-relaxed">
                                                    <div className="flex items-start gap-2">
                                                        <CheckCircle className="w-4 h-4 text-brand-success mt-0.5 shrink-0" />
                                                        <span>{match.matchedTags[0].reasonText}</span>
                                                    </div>
                                                    {match.matchedTags.length > 1 && (
                                                        <div className="flex items-start gap-2 mt-1">
                                                            <CheckCircle className="w-4 h-4 text-brand-success mt-0.5 shrink-0" />
                                                            <span>{match.matchedTags[1].reasonText}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Top Parties */}
                    {topParties.length > 0 && (
                        <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2 text-gray-800">
                                <Users className="text-blue-600" />
                                Partidos Mais Alinhados
                            </h2>
                            <div className="space-y-6">
                                {topParties.map((party, idx) => (
                                    <div key={party.party} className="relative">
                                        <div className="flex justify-between items-end mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-400 font-bold text-lg w-6">{idx + 1}</span>
                                                <span className="font-bold text-lg">{party.party}</span>
                                            </div>
                                            <span className="font-bold text-blue-600 text-xl">{party.percentage}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                            <div
                                                className="bg-brand-primary h-3 rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${party.percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* CTA */}
                    <div className="text-center pt-8">
                        <Link
                            to="/busca"
                            className="inline-flex items-center gap-2 text-brand-primary font-bold hover:text-brand-text-alt transition-colors"
                        >
                            Ver todos os resultados na Busca
                            <ArrowRight size={20} />
                        </Link>
                    </div>

                </div>
            </main>
            <Footer />
        </div>
    );
}
