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
import { db } from "~/utils/db.server";
import { ArticleService } from "~/services/article.server";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Em Quem Votar? | Vote com consciência" },
    {
      name: "description",
      content:
        "Descubra quais políticos realmente representam seus valores. Baseado em votos reais, não promessas.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const [recentBills, articles] = await Promise.all([
    db.bill.findMany({
      where: { status: "approved" }, // Apenas votações aprovadas
      orderBy: { voteDate: "desc" },
      take: 4,
    }),
    ArticleService.list(),
  ]);

  return {
    recentBills,
    articles: articles.slice(0, 3), // Top 3 apenas
  };
}

export default function Home() {
  const { recentBills, articles } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-brand-primary/20 selection:text-brand-primary overflow-x-hidden">
      <HeroSection />
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
