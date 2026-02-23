import type { Route } from "./+types/home";
import { useLoaderData } from "react-router";
import { Footer } from "~/components/Footer";
import {
  HeroSection,
  ProblemSection,
  SolutionSection,
  FeaturesGrid,
  SocialProof,
  CTASection,
  RecentVotesSection,
  EducationSection,
} from "~/components/landing";
import { FeaturedCandidates } from "~/components/landing/FeaturedCandidates";
import { db } from "~/utils/db.server";
import { ArticleService } from "~/services/article.server";
import { CandidateService } from "~/services/candidate.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Em Quem Votar? | Vote com consciência" },
    {
      name: "description",
      content:
        "Compare candidatos à presidência 2026 com base em posições reais, votações e gastos públicos. Sem viés, sem propaganda.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const [recentBills, articles] = await Promise.all([
    db.bill.findMany({
      where: { status: "approved" },
      orderBy: { voteDate: "desc" },
      take: 4,
    }),
    ArticleService.list(),
  ]);

  // Deferred: load candidates async for streaming
  const featuredCandidatesPromise = CandidateService.list({
    limit: 6,
    offset: 0,
  }).then((result) => result.items);

  return {
    recentBills,
    articles: articles.slice(0, 3),
    featuredCandidates: featuredCandidatesPromise,
  };
}

export default function Home() {
  const { recentBills, articles, featuredCandidates } =
    useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-brand-primary/20 selection:text-brand-primary overflow-x-hidden">
      <HeroSection />
      <FeaturedCandidates candidatesPromise={featuredCandidates} />
      <ProblemSection />
      <SolutionSection />
      <RecentVotesSection bills={recentBills} />
      <FeaturesGrid />
      <EducationSection articles={articles} />
      <SocialProof />
      <CTASection />
      <Footer />
    </div>
  );
}
