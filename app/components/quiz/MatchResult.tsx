import { Link } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { User, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "~/lib/utils";

interface MatchedPosition {
  topicName: string;
  userStance: number;
  candidateStance: number;
  agreement: boolean;
}

interface CategoryScore {
  category: string;
  score: number;
}

interface MatchResultProps {
  rank: number;
  candidate: {
    id: string;
    name: string;
    displayName: string;
    party: string;
    photoUrl: string | null;
    positionCount: number;
  };
  matchPercentage: number;
  matchedPositions: MatchedPosition[];
  categoryScores: CategoryScore[];
  totalQuestions: number;
}

const STANCE_LABELS: Record<number, string> = {
  1: "Discorda totalmente",
  2: "Discorda",
  3: "Neutro",
  4: "Concorda",
  5: "Concorda totalmente",
};

export function MatchResult({
  rank,
  candidate,
  matchPercentage,
  matchedPositions,
  categoryScores,
  totalQuestions,
}: MatchResultProps) {
  const dataCompleteness = Math.round(
    (candidate.positionCount / totalQuestions) * 100
  );

  return (
    <Card className={cn(
      "overflow-hidden",
      rank === 1 && "border-brand-primary/30 shadow-md"
    )}>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start gap-4">
          {/* Photo */}
          <div className="relative shrink-0">
            {candidate.photoUrl ? (
              <img
                src={candidate.photoUrl}
                alt={candidate.displayName}
                className="w-16 h-16 rounded-full object-cover bg-muted"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <User className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">
              {rank}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground">
                  {candidate.displayName}
                </h3>
                <p className="text-sm text-muted-foreground">{candidate.party}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl font-bold text-brand-primary">
                  {matchPercentage}%
                </span>
              </div>
            </div>

            {/* Data completeness */}
            <div className="flex items-center gap-1.5 mt-2">
              {dataCompleteness < 50 && (
                <AlertCircle className="w-3 h-3 text-amber-500" />
              )}
              <span className="text-[10px] text-muted-foreground">
                Baseado em {candidate.positionCount} de {totalQuestions} posições
              </span>
            </div>

            {/* Category scores */}
            {categoryScores.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {categoryScores.map((cs) => (
                  <Badge
                    key={cs.category}
                    variant="outline"
                    className="text-[10px] font-normal"
                  >
                    {cs.category}: {Math.round(cs.score)}%
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* View profile link */}
        <Link
          to={`/candidato/${candidate.id}`}
          className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-brand-primary hover:border-brand-primary/30 transition-colors"
        >
          Ver perfil completo <ArrowRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
