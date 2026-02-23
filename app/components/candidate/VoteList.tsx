import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { VoteDetail } from "./VoteDetail";

interface Vote {
  id: string;
  voteType: string;
  bill: {
    id: string;
    title: string;
    simplifiedTitle: string | null;
    simplifiedDescription: string | null;
    voteDate: string;
    voteSimDetails: string | null;
    voteNaoDetails: string | null;
  };
}

interface VoteListProps {
  votes: Vote[];
}

const VOTE_TYPE_STYLES: Record<string, string> = {
  SIM: "bg-foreground/10 text-foreground",
  "NÃO": "bg-foreground/10 text-foreground",
  Abstenção: "bg-muted text-muted-foreground",
  Obstrução: "bg-muted text-muted-foreground",
};

export function VoteList({ votes }: VoteListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (votes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Nenhum voto registrado para este candidato.</p>
        <p className="text-xs mt-1">
          Votos serão adicionados conforme disponíveis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {votes.map((vote) => {
        const isExpanded = expandedId === vote.id;
        const displayTitle =
          vote.bill.simplifiedTitle || vote.bill.title;

        return (
          <div key={vote.id} className="rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : vote.id)}
              className="w-full text-left p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground line-clamp-2">
                  {displayTitle}
                </h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold ${VOTE_TYPE_STYLES[vote.voteType] ?? ""}`}
                  >
                    {vote.voteType}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                    <Calendar className="w-2.5 h-2.5" />
                    {new Date(vote.bill.voteDate).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
              <div className="shrink-0 mt-1 text-muted-foreground">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4">
                <VoteDetail
                  billId={vote.bill.id}
                  description={vote.bill.simplifiedDescription}
                  voteSimDetails={vote.bill.voteSimDetails}
                  voteNaoDetails={vote.bill.voteNaoDetails}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
