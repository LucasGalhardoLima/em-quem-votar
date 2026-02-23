import { Suspense } from "react";
import { Await, Link } from "react-router";
import { CandidateCard } from "~/components/candidate/CandidateCard";
import { SkeletonCandidateCard } from "~/components/candidate/SkeletonCandidateCard";
import { ArrowRight } from "lucide-react";

interface CandidateListItem {
  id: string;
  name: string;
  displayName: string;
  party: string;
  coalition: string | null;
  photoUrl: string | null;
  registrationStatus: string;
  tags: { name: string; slug: string; category: string }[];
  positionCount: number;
}

interface FeaturedCandidatesProps {
  candidatesPromise: Promise<CandidateListItem[]>;
}

function FeaturedCandidatesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCandidateCard key={i} />
      ))}
    </div>
  );
}

function FeaturedCandidatesList({ candidates }: { candidates: CandidateListItem[] }) {
  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Candidatos serão listados após registro no TSE.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {candidates.map((candidate) => (
        <CandidateCard key={candidate.id} {...candidate} />
      ))}
    </div>
  );
}

export function FeaturedCandidates({ candidatesPromise }: FeaturedCandidatesProps) {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Candidatos à Presidência
            </h2>
            <p className="text-muted-foreground mt-1">
              Conheça as posições de cada candidato
            </p>
          </div>
          <Link
            to="/candidatos"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
          >
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <Suspense fallback={<FeaturedCandidatesSkeleton />}>
          <Await resolve={candidatesPromise}>
            {(candidates) => <FeaturedCandidatesList candidates={candidates} />}
          </Await>
        </Suspense>

        <Link
          to="/candidatos"
          className="sm:hidden flex items-center justify-center gap-1 mt-6 text-sm font-medium text-brand-primary hover:underline"
        >
          Ver todos os candidatos <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
