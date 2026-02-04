import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/resultado";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { ArrowRight, Trophy, Users, CheckCircle, Share2, Copy, ExternalLink } from "lucide-react";
import { MatchRadarChart } from "~/components/MatchRadarChart";
import { AnimatedCounter } from "~/components/AnimatedCounter";
import { ArchetypeReveal } from "~/components/ArchetypeReveal";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";

import { MatchService, type MatchResult, type PartyResult, type MatchMetadata } from "~/services/match.server";

export function meta({ data }: Route.MetaArgs) {
    if (!data?.topPoliticians?.[0] || !data?.metadata) {
        return [{ title: "Seu Resultado Político | Em Quem Votar" }];
    }

    const winner = data.topPoliticians[0];
    const archetype = data.metadata.archetype;
    const scoresParam = data.scoresParam || "";

    const ogImageUrl = `/resources/og/resultado?s=${scoresParam}&top=${winner.politician.id}&p=${winner.percentage}&a=${archetype.id}`;

    return [
        { title: `${archetype.name}: ${winner.percentage}% com ${winner.politician.name} | Em Quem Votar` },
        { name: "description", content: `Meu perfil político é "${archetype.name}". Meu match #1 é ${winner.politician.name} (${winner.politician.party}) com ${winner.percentage}% de compatibilidade.` },
        { property: "og:title", content: `Sou "${archetype.name}" - ${winner.percentage}% match com ${winner.politician.name}` },
        { property: "og:description", content: archetype.description },
        { property: "og:image", content: ogImageUrl },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `Meu Match Político: ${winner.percentage}%` },
        { name: "twitter:description", content: `Perfil: ${archetype.name}. Match #1: ${winner.politician.name} (${winner.politician.party})` },
        { name: "twitter:image", content: ogImageUrl },
    ];
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const scoresParam = url.searchParams.get("s");

    let userScores: Record<string, number> = {};

    if (scoresParam) {
        scoresParam.split(",").forEach(pair => {
            const [tagSlug, score] = pair.split(":");
            if (tagSlug && score) {
                userScores[tagSlug] = parseInt(score, 10);
            }
        });
    }

    if (Object.keys(userScores).length === 0) {
        return { topPoliticians: [], topParties: [], userScores: {}, metadata: null, scoresParam: "" };
    }

    const { topPoliticians, topParties, metadata } = await MatchService.calculate(userScores);

    return { topPoliticians, topParties, userScores, metadata, scoresParam };
}

export default function Resultado() {
    const { topPoliticians, topParties, metadata, scoresParam } = useLoaderData<typeof loader>();
    const winner = topPoliticians[0];
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const shareData = {
            title: `Meu perfil político: ${metadata?.archetype.name}`,
            text: `Fiz o quiz do Em Quem Votar e meu match #1 é ${winner?.politician.name} com ${winner?.percentage}% de compatibilidade!`,
            url: window.location.href
        };

        if (navigator.share && navigator.canShare?.(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                // User cancelled or share failed
            }
        } else {
            handleCopyLink();
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        toast.success("Link copiado!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleWhatsAppShare = () => {
        const text = `Meu perfil político é "${metadata?.archetype.name}"! Meu match #1 é ${winner?.politician.name} com ${winner?.percentage}% de compatibilidade. Faça o quiz: ${window.location.href}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleTwitterShare = () => {
        const text = `Meu perfil político é "${metadata?.archetype.name}" ${metadata?.archetype.emoji}. Meu match #1 é ${winner?.politician.name} (${winner?.percentage}%). Descubra o seu:`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`, "_blank");
    };

    if (!winner || !metadata) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
                <Header breadcrumbItems={[{ label: "Seu Resultado", active: true }]} />
                <main className="flex-grow flex items-center justify-center">
                    <div className="text-center p-8">
                        <h1 className="text-2xl font-bold mb-4">Nenhum resultado encontrado</h1>
                        <p className="text-slate-600 mb-6">Faça o quiz para descobrir seu perfil político.</p>
                        <Link
                            to="/quiz"
                            className="inline-flex items-center gap-2 bg-brand-primary text-white font-bold py-3 px-6 rounded-xl hover:bg-brand-primary-hover transition-colors"
                        >
                            Fazer Quiz <ArrowRight size={18} />
                        </Link>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            <Header breadcrumbItems={[{ label: "Seu Resultado", active: true }]} />

            <main className="flex-grow">
                {/* Hero Section - Archetype Reveal */}
                <section
                    className="py-16 lg:py-24 px-4 relative overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, ${metadata.archetype.gradient[0]} 0%, ${metadata.archetype.gradient[1]} 100%)`
                    }}
                >
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"></div>

                    <div className="max-w-4xl mx-auto relative z-10">
                        <ArchetypeReveal archetype={metadata.archetype} />
                    </div>
                </section>

                {/* Top Match Card */}
                <section className="px-4 -mt-8 relative z-20">
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                        className="max-w-2xl mx-auto"
                    >
                        <div className="bento-card bg-white p-6 md:p-8 border-2 border-slate-200 shadow-xl">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                {/* Photo */}
                                <div className="relative shrink-0">
                                    <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-brand-primary/20 overflow-hidden bg-slate-100">
                                        {winner.politician.photoUrl ? (
                                            <img
                                                src={winner.politician.photoUrl}
                                                alt={winner.politician.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-4xl">?</div>
                                        )}
                                    </div>
                                    <div className="absolute -top-2 -right-2 bg-brand-primary text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                                        #1
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 text-center md:text-left">
                                    <span className="inline-block text-brand-primary text-sm font-semibold tracking-wide uppercase mb-1">
                                        Seu Match Principal
                                    </span>
                                    <h2 className="text-2xl md:text-3xl font-bold font-heading text-slate-900 mb-1">
                                        {winner.politician.name}
                                    </h2>
                                    <p className="text-slate-500 font-medium mb-4">
                                        {winner.politician.party}
                                    </p>

                                    <div className="flex items-center justify-center md:justify-start gap-3">
                                        <AnimatedCounter
                                            value={winner.percentage}
                                            className="text-4xl md:text-5xl font-bold text-brand-primary font-heading"
                                        />
                                        <span className="text-sm text-slate-500 leading-tight">
                                            de<br />compatibilidade
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Match Reasons */}
                            {winner.matchedTags.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-3">
                                        Por que vocês combinam?
                                    </p>
                                    <div className="space-y-2">
                                        {winner.matchedTags.slice(0, 3).map((tag, idx) => (
                                            <motion.div
                                                key={tag.slug}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.8 + idx * 0.1 }}
                                                className="flex items-start gap-2 text-sm text-slate-600"
                                            >
                                                <CheckCircle className="w-4 h-4 text-brand-success mt-0.5 shrink-0" />
                                                <span>{tag.reasonText}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Link
                                to={`/politico/${winner.politician.id}`}
                                className="mt-6 w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3.5 px-6 rounded-xl transition-colors"
                            >
                                Ver Perfil Completo <ArrowRight size={18} />
                            </Link>
                        </div>
                    </motion.div>
                </section>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="max-w-4xl mx-auto space-y-12 px-4 py-12"
                >
                    {/* Radar Chart Section */}
                    <motion.section
                        variants={itemVariants}
                        className="bento-card bg-white p-6 md:p-8"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-brand-primary/10 rounded-lg">
                                <Trophy className="w-5 h-5 text-brand-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Áreas de Afinidade</h3>
                                <p className="text-sm text-slate-500">Como suas prioridades se alinham</p>
                            </div>
                        </div>
                        <div className="h-[300px] md:h-[400px]">
                            <MatchRadarChart data={winner.categoryScores} />
                        </div>
                    </motion.section>

                    {/* Runner-ups */}
                    {topPoliticians.length > 1 && (
                        <motion.section variants={itemVariants}>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-slate-100 rounded-lg">
                                    <Trophy className="w-5 h-5 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Outras Opções</h3>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {topPoliticians.slice(1, 5).map((match, idx) => (
                                    <motion.div
                                        key={match.politician.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 + idx * 0.1 }}
                                    >
                                        <Link
                                            to={`/politico/${match.politician.id}`}
                                            className="bento-card bg-white p-5 flex items-start gap-4 group hover:border-brand-primary/30"
                                        >
                                            <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border-2 border-white shadow shrink-0">
                                                {match.politician.photoUrl && (
                                                    <img
                                                        src={match.politician.photoUrl}
                                                        alt={match.politician.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-900 group-hover:text-brand-primary transition-colors truncate">
                                                            {match.politician.name}
                                                        </h4>
                                                        <p className="text-sm text-slate-500">{match.politician.party}</p>
                                                    </div>
                                                    <span className="text-lg font-bold text-brand-primary shrink-0">
                                                        {match.percentage}%
                                                    </span>
                                                </div>

                                                {match.matchedTags.length > 0 && (
                                                    <p className="text-xs text-slate-500 mt-2 line-clamp-1">
                                                        <CheckCircle className="w-3 h-3 text-brand-success inline mr-1" />
                                                        {match.matchedTags[0].reasonText}
                                                    </p>
                                                )}
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.section>
                    )}

                    {/* Top Parties */}
                    {topParties.length > 0 && (
                        <motion.section variants={itemVariants} className="bento-card bg-white p-6 md:p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-brand-primary/10 rounded-lg">
                                    <Users className="w-5 h-5 text-brand-primary" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">Partidos Mais Alinhados</h3>
                            </div>

                            <div className="space-y-4">
                                {topParties.map((party, idx) => (
                                    <div key={party.party}>
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-400 font-bold text-sm w-5">{idx + 1}</span>
                                                <span className="font-semibold text-slate-900">{party.party}</span>
                                            </div>
                                            <span className="font-bold text-brand-primary">{party.percentage}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${party.percentage}%` }}
                                                transition={{ duration: 0.8, delay: 0.1 * idx }}
                                                className="bg-brand-primary h-full rounded-full"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.section>
                    )}

                    {/* Share Section */}
                    <motion.section
                        variants={itemVariants}
                        className="bento-card p-6 md:p-8 text-center"
                        style={{
                            background: `linear-gradient(135deg, ${metadata.archetype.gradient[0]}15 0%, ${metadata.archetype.gradient[1]}15 100%)`
                        }}
                    >
                        <div className="text-4xl mb-3">{metadata.archetype.emoji}</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            Compartilhe seu resultado!
                        </h3>
                        <p className="text-slate-600 mb-6 max-w-md mx-auto">
                            Mostre para seus amigos qual é o seu perfil político e quem mais combina com você.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={handleShare}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3 px-6 rounded-xl transition-colors"
                            >
                                <Share2 size={18} />
                                Compartilhar
                            </button>

                            <button
                                onClick={handleCopyLink}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-6 rounded-xl border border-slate-200 transition-colors"
                            >
                                <Copy size={18} />
                                {copied ? "Copiado!" : "Copiar Link"}
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-3 mt-4">
                            <button
                                onClick={handleWhatsAppShare}
                                className="p-3 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full transition-colors"
                                title="Compartilhar no WhatsApp"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </button>

                            <button
                                onClick={handleTwitterShare}
                                className="p-3 bg-black hover:bg-slate-800 text-white rounded-full transition-colors"
                                title="Compartilhar no X (Twitter)"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </button>
                        </div>
                    </motion.section>

                    {/* Back to Search */}
                    <div className="text-center pb-8">
                        <Link
                            to="/busca"
                            className="inline-flex items-center gap-2 text-brand-primary font-semibold hover:text-brand-primary-hover transition-colors"
                        >
                            Explorar todos os políticos
                            <ArrowRight size={18} />
                        </Link>
                    </div>
                </motion.div>
            </main>
            <Footer />
        </div>
    );
}
