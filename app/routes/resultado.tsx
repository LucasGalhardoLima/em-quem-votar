import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/resultado";
// PoliticianService removed to avoid server-code in client bundle error
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { ArrowRight, Trophy, Users, AlertCircle, Share2, CheckCircle } from "lucide-react";
import { MatchRadarChart } from "~/components/MatchRadarChart";
import { TAG_DEFINITIONS } from "~/data/tag-definitions";

export function meta() {
    return [{ title: "Seu Resultado Político | Em Quem Votar" }];
}

import { db } from "~/utils/db.server";
import { createSupabaseServerClient } from "~/utils/supabase.server";
import { MatchService, type TagMatchInfo, type MatchResult, type PartyResult } from "~/services/match.server";

// ... interfaces removed as they are imported ...

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const scoresParam = url.searchParams.get("s"); // Format: tag1:5,tag2:3
    const { supabase, headers } = createSupabaseServerClient(request);

    // Check Session
    const { data: { user } } = await supabase.auth.getUser();
    const session = user ? { user } : null;

    let userScores: Record<string, number> = {};

    // Strategy:
    // 1. If params exist: Use them (User just finished quiz)
    //    -> If logged in: SAVE them to DB.
    // 2. If NO params but Logged In: LOAD from DB.
    // 3. If NO params and Anonymous: Return empty.

    if (scoresParam) {
        // Parse from URL
        scoresParam.split(",").forEach(pair => {
            const [tagSlug, score] = pair.split(":");
            if (tagSlug && score) {
                userScores[tagSlug] = parseInt(score, 10);
            }
        });

        // Persist if logged in
        if (session?.user) {
            try {
                // Use upsert instead of update to handle cases where profile might be missing
                await db.userProfile.upsert({
                    where: { id: session.user.id },
                    update: {
                        quizAnswers: userScores as any,
                        updatedAt: new Date()
                    },
                    create: {
                        id: session.user.id,
                        email: session.user.email!,
                        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "Usuário",
                        photoUrl: session.user.user_metadata?.avatar_url,
                        quizAnswers: userScores as any,
                    }
                });
            } catch (e) {
                // Fail silently or log, don't block user
                console.error("Failed to save quiz results", e);
            }
        }
    } else if (session?.user) {
        // Load from DB
        const profile = await db.userProfile.findUnique({
            where: { id: session.user.id },
            select: { quizAnswers: true }
        });

        if (profile?.quizAnswers) {
            userScores = profile.quizAnswers as Record<string, number>;
        }
    }

    if (Object.keys(userScores).length === 0) {
        return { topPoliticians: [], topParties: [], userScores: {} };
    }

    const { topPoliticians, topParties } = await MatchService.calculate(userScores);

    // Return headers to manage session cookies if needed
    return { topPoliticians, topParties, userScores };
}

export default function Resultado() {
    const { topPoliticians, topParties } = useLoaderData<typeof loader>();
    const winner = topPoliticians[0];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Header breadcrumbItems={[{ label: "Seu Resultado", active: true }]} />

            <main className="flex-grow pb-12">
                {/* Winner Hero Section */}
                {winner ? (
                    <section className="bg-gradient-to-br from-brand-text-alt via-brand-text to-brand-text-alt text-white py-12 lg:py-20 relative overflow-hidden">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>

                        <div className="max-w-4xl mx-auto flex flex-col items-center gap-10">

                            {/* Top Row: Photo + Info/Match */}
                            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">

                                {/* 1. Photo */}
                                <div className="relative shrink-0 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                                    <div className="w-40 h-40 md:w-64 md:h-64 rounded-full border-4 md:border-8 border-white/20 shadow-2xl overflow-hidden relative z-10 bg-gray-800">
                                        {winner.politician.photoUrl ? (
                                            <img src={winner.politician.photoUrl} alt={winner.politician.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/50">Foto</div>
                                        )}
                                    </div>
                                    {/* Decorative circles */}
                                    <div className="absolute inset-0 bg-brand-primary rounded-full blur-3xl opacity-30 -z-10 transform scale-110"></div>
                                </div>

                                {/* 2. Info + Match */}
                                <div className="text-center md:text-left space-y-4 animate-fade-in-up max-w-lg">
                                    <div>
                                        <div className="inline-block px-4 py-1 bg-brand-secondary text-brand-text-alt rounded-full text-sm font-bold tracking-wide uppercase mb-3">
                                            Seu Match #1
                                        </div>
                                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none mb-1">
                                            {winner.politician.name}
                                        </h1>
                                        <p className="text-xl md:text-2xl text-blue-200 font-medium">
                                            {winner.politician.party}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
                                        <div className="text-5xl md:text-6xl font-bold text-white">{winner.percentage}%</div>
                                        <div className="text-xs md:text-sm text-blue-100 leading-tight text-left opacity-90 font-medium">
                                            de<br />compatibilidade
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Bottom: Button */}
                            <div className="animate-fade-in-up w-full text-center" style={{ animationDelay: '0.2s' }}>
                                <Link
                                    to={`/politico/${winner.politician.id}`}
                                    className="bg-white text-brand-text-alt hover:bg-brand-tertiary hover:text-white font-bold py-4 px-10 rounded-full shadow-lg transition-transform transform hover:-translate-y-1 inline-flex items-center justify-center gap-2 text-lg w-full md:w-auto"
                                >
                                    Ver Perfil Completo <ArrowRight size={20} />
                                </Link>
                            </div>

                        </div>
                    </section>
                ) : (
                    <div className="py-20 text-center">
                        <h1 className="text-3xl font-bold">Calculando resultados...</h1>
                    </div>
                )}

                <div className="max-w-4xl mx-auto space-y-16 px-4 mt-16">

                    {/* Affinity Radar Chart Section */}
                    {/* Affinity Radar Chart Section */}
                    <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col items-center gap-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <div className="w-full text-center space-y-4 max-w-3xl mx-auto">
                            <h2 className="text-2xl font-bold flex items-center justify-center gap-2 text-gray-800">
                                <Trophy className="text-brand-secondary" />
                                Áreas de Afinidade
                            </h2>
                            <p className="text-gray-600 leading-relaxed">
                                Este gráfico mostra como suas prioridades se alinham com a atuação de <strong>{winner.politician.name}</strong> em diferentes temas legislativos.
                            </p>
                        </div>
                        <div className="w-full bg-gray-50 rounded-2xl p-4 md:p-6 border border-gray-100 h-[350px] md:h-[450px]">
                            <MatchRadarChart data={winner.categoryScores} />
                        </div>
                    </section>

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
                                        <div className="w-full bg-gray-100 rounded-full h-4">
                                            <div
                                                className="bg-brand-primary h-4 rounded-full transition-all duration-1000 ease-out"
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
        </div >
    );
}
