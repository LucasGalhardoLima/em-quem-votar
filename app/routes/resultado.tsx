import { Suspense, useState } from "react";
import { Await, useLoaderData, Link } from "react-router";
import type { Route } from "./+types/resultado";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { MatchResult } from "~/components/quiz/MatchResult";
import { ArchetypeCard } from "~/components/quiz/ArchetypeCard";
import { PoliticalCompass } from "~/components/quiz/PoliticalCompass";
import { calculateCompassPosition } from "~/data/archetypes";
import {
  MatchService,
  type CandidateMatchResult,
  type MatchMetadata,
} from "~/services/match.server";
import type { Archetype } from "~/data/archetypes";
import type { ImportanceLevel } from "~/components/quiz/ImportanceWeighting";
import { ArrowRight, Share2, Copy, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export function meta({ data }: Route.MetaArgs) {
  // Meta is set after results load
  return [
    { title: "Seu Resultado | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Veja qual candidato à presidência 2026 mais se alinha com suas ideias.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const vectorParam = url.searchParams.get("v");
  const weightsParam = url.searchParams.get("w");

  // Parse user vector: topicSlug:stance,topicSlug:stance,...
  const userVector: Record<string, number> = {};
  if (vectorParam) {
    for (const pair of vectorParam.split(",")) {
      const [slug, stanceStr] = pair.split(":");
      if (slug && stanceStr) {
        const stance = parseInt(stanceStr, 10);
        if (stance >= 1 && stance <= 5) {
          userVector[slug] = stance;
        }
      }
    }
  }

  if (Object.keys(userVector).length === 0) {
    return { results: null };
  }

  // Parse axis weights: category:level,category:level,...
  const axisWeights: Record<string, ImportanceLevel> | undefined = weightsParam
    ? Object.fromEntries(
        weightsParam.split(",").map((pair) => {
          const [cat, level] = pair.split(":");
          return [decodeURIComponent(cat), level as ImportanceLevel];
        })
      )
    : undefined;

  // Calculate match (deferred for streaming)
  const resultsPromise = MatchService.calculate(
    userVector,
    axisWeights
  ).then((result) => ({
    ...result,
    userVector,
  }));

  return { results: resultsPromise };
}

function NoResults() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header breadcrumbItems={[{ label: "Seu Resultado", active: true }]} />
      <main className="flex-grow flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            Nenhum resultado encontrado
          </h1>
          <p className="text-muted-foreground mb-6">
            Faça o quiz para descobrir qual candidato mais se alinha com você.
          </p>
          <Link
            to="/quiz"
            className="inline-flex items-center gap-2 bg-brand-primary text-white font-bold py-3 px-6 rounded-xl hover:bg-brand-primary/90 transition-colors"
          >
            Fazer Quiz <ArrowRight size={18} />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ResultsContent({
  data,
}: {
  data: {
    topCandidates: CandidateMatchResult[];
    archetype: Archetype;
    metadata: MatchMetadata;
    userVector: Record<string, number>;
  };
}) {
  const { topCandidates, archetype, metadata, userVector } = data;
  const [copied, setCopied] = useState(false);
  const totalQuestions = Object.keys(userVector).length;

  const userCompass = calculateCompassPosition(
    // Convert userVector topic slugs to category-level averages for compass
    // This is a simplified mapping; the MatchService does the full calculation
    userVector
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const winner = topCandidates[0];
    const shareData = {
      title: `Meu perfil político: ${archetype.name}`,
      text: winner
        ? `Fiz o quiz do Em Quem Votar e meu match #1 é ${winner.candidate.displayName} com ${winner.matchPercentage}% de compatibilidade!`
        : "Faça o quiz e descubra seu candidato!",
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  if (topCandidates.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">
          Nenhum candidato disponível para comparação.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Archetype */}
      <ArchetypeCard archetype={archetype} />

      {/* Political compass */}
      <div className="bg-card rounded-2xl border border-border p-6 md:p-8">
        <h3 className="text-lg font-bold text-foreground mb-6 text-center">
          Seu Compasso Político
        </h3>
        <PoliticalCompass
          userPosition={userCompass}
          candidatePositions={topCandidates.slice(0, 5).map((m) => ({
            label: m.candidate.displayName,
            economic: 0, // Would need per-candidate compass position
            social: 0,
          }))}
          className="mx-auto"
        />
      </div>

      {/* Match results */}
      <div>
        <h3 className="text-lg font-bold text-foreground mb-4">
          Seus Matches
        </h3>
        <div className="space-y-4">
          {topCandidates.map((match, idx) => (
            <motion.div
              key={match.candidate.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * idx }}
            >
              <MatchResult
                rank={idx + 1}
                candidate={match.candidate}
                matchPercentage={match.matchPercentage}
                matchedPositions={match.matchedPositions}
                categoryScores={match.categoryScores}
                totalQuestions={totalQuestions}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-muted/50 rounded-xl p-4 text-center text-sm text-muted-foreground space-y-1">
        <p>
          {metadata.totalCandidatesEvaluated} candidatos avaliados
        </p>
        {metadata.dominantCategories.length > 0 && (
          <p>
            Categorias dominantes:{" "}
            {metadata.dominantCategories.join(", ")}
          </p>
        )}
      </div>

      {/* Share */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-4">
        <button
          onClick={handleShare}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold py-3 px-6 rounded-xl transition-colors"
        >
          <Share2 size={18} />
          Compartilhar
        </button>
        <button
          onClick={handleCopyLink}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-card hover:bg-muted text-foreground font-semibold py-3 px-6 rounded-xl border border-border transition-colors"
        >
          <Copy size={18} />
          {copied ? "Copiado!" : "Copiar link"}
        </button>
      </div>

      {/* Links */}
      <div className="text-center pb-4">
        <Link
          to="/candidatos"
          className="inline-flex items-center gap-2 text-brand-primary font-semibold hover:underline"
        >
          Explorar todos os candidatos
          <ArrowRight size={18} />
        </Link>
      </div>
    </motion.div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      <span className="ml-3 text-muted-foreground">Calculando matches...</span>
    </div>
  );
}

export default function Resultado() {
  const { results } = useLoaderData<typeof loader>();

  if (!results) {
    return <NoResults />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header breadcrumbItems={[{ label: "Seu Resultado", active: true }]} />

      <main className="flex-grow max-w-3xl mx-auto w-full px-4 py-8">
        <Suspense fallback={<ResultsSkeleton />}>
          <Await resolve={results}>
            {(data) => <ResultsContent data={data} />}
          </Await>
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
