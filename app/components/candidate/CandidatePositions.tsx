import { Badge } from "~/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { cn } from "~/lib/utils";

interface Position {
  topicName: string;
  topicCategory: string;
  topicSlug: string;
  stance: 0 | 1 | 2 | 3 | 4 | 5;
  description: string | null;
  sourceType: string;
  sourceUrl: string | null;
  sourceDate: string | null;
}

interface CandidatePositionsProps {
  positions: Position[];
}

const STANCE_LABELS: Record<number, string> = {
  0: "Desconhecido",
  1: "Discorda totalmente",
  2: "Discorda",
  3: "Neutro",
  4: "Concorda",
  5: "Concorda totalmente",
};

const SOURCE_LABELS: Record<string, string> = {
  PLATFORM: "Programa de governo",
  PUBLIC_STATEMENT: "Declaração pública",
  VOTE_RECORD: "Registro de voto",
  INTERVIEW: "Entrevista",
  MANUAL: "Análise editorial",
};

function StanceIndicator({ stance }: { stance: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              "w-2.5 h-2.5 rounded-full border",
              stance >= level
                ? "bg-foreground/70 border-foreground/70"
                : "bg-transparent border-muted-foreground/30"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-1">
        {STANCE_LABELS[stance] ?? "Desconhecido"}
      </span>
    </div>
  );
}

function groupByCategory(positions: Position[]) {
  const groups: Record<string, Position[]> = {};
  for (const pos of positions) {
    if (!groups[pos.topicCategory]) {
      groups[pos.topicCategory] = [];
    }
    groups[pos.topicCategory].push(pos);
  }
  return groups;
}

export function CandidatePositions({ positions }: CandidatePositionsProps) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">Nenhuma posição mapeada para este candidato.</p>
        <p className="text-xs mt-1">Posições serão adicionadas conforme disponíveis.</p>
      </div>
    );
  }

  const grouped = groupByCategory(positions);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, categoryPositions]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
            {category}
          </h3>
          <div className="space-y-3">
            {categoryPositions.map((pos) => (
              <div
                key={pos.topicSlug}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground">
                      {pos.topicName}
                    </h4>
                    <div className="mt-1.5">
                      <StanceIndicator stance={pos.stance} />
                    </div>
                    {pos.description && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {pos.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Source attribution */}
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {SOURCE_LABELS[pos.sourceType] ?? pos.sourceType}
                  </Badge>
                  {pos.sourceDate && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(pos.sourceDate).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {pos.sourceUrl && (
                    <a
                      href={pos.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-brand-primary hover:underline inline-flex items-center gap-0.5 ml-auto"
                    >
                      Fonte <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
