import { Link } from "react-router";
import { ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";

interface VoteDetailProps {
  billId: string;
  description: string | null;
  voteSimDetails: string | null;
  voteNaoDetails: string | null;
}

export function VoteDetail({
  billId,
  description,
  voteSimDetails,
  voteNaoDetails,
}: VoteDetailProps) {
  return (
    <div className="space-y-3 border-t border-border/50 pt-3">
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}

      {(voteSimDetails || voteNaoDetails) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {voteSimDetails && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ThumbsUp className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Votar Sim significa
                </span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {voteSimDetails}
              </p>
            </div>
          )}
          {voteNaoDetails && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <ThumbsDown className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Votar Não significa
                </span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {voteNaoDetails}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Link
          to={`/votacao/${billId}`}
          className="text-[11px] text-brand-primary hover:underline inline-flex items-center gap-1"
        >
          Ver votação completa
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
