import { User } from "lucide-react";

interface CandidateComparison {
  id: string;
  name: string;
  displayName: string;
  party: string;
  photoUrl: string | null;
  positions: Record<string, { stance: number; description: string | null }>;
  spending: { type: string; totalAmount: number }[];
}

interface Topic {
  slug: string;
  name: string;
  category: string;
}

interface ComparisonTableProps {
  candidates: CandidateComparison[];
  topics: Topic[];
}

const STANCE_LABELS: Record<number, string> = {
  0: "—",
  1: "Discorda totalmente",
  2: "Discorda",
  3: "Neutro",
  4: "Concorda",
  5: "Concorda totalmente",
};

function StanceDots({ stance }: { stance: number }) {
  if (stance === 0) {
    return <span className="text-xs text-muted-foreground">Sem posição</span>;
  }
  return (
    <div className="flex items-center gap-1" title={STANCE_LABELS[stance]}>
      {[1, 2, 3, 4, 5].map((level) => (
        <div
          key={level}
          className={
            stance >= level
              ? "w-2 h-2 rounded-full bg-foreground/70"
              : "w-2 h-2 rounded-full bg-muted-foreground/20"
          }
        />
      ))}
    </div>
  );
}

function groupTopicsByCategory(topics: Topic[]) {
  const groups: Record<string, Topic[]> = {};
  for (const t of topics) {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  }
  return groups;
}

export function ComparisonTable({ candidates, topics }: ComparisonTableProps) {
  const grouped = groupTopicsByCategory(topics);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 w-48 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-background z-10" />
              {candidates.map((c) => (
                <th key={c.id} className="p-4 min-w-[160px] text-center">
                  <div className="flex flex-col items-center gap-2">
                    {c.photoUrl ? (
                      <img
                        src={c.photoUrl}
                        alt={c.displayName}
                        className="w-14 h-14 rounded-full object-cover bg-muted"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        {c.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.party}</p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([category, categoryTopics]) => (
              <>
                <tr key={`cat-${category}`} className="bg-muted/30">
                  <td
                    colSpan={candidates.length + 1}
                    className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                  >
                    {category}
                  </td>
                </tr>
                {categoryTopics.map((topic) => (
                  <tr
                    key={topic.slug}
                    className="border-b border-border/50 hover:bg-muted/20"
                  >
                    <td className="p-4 text-sm font-medium text-foreground sticky left-0 bg-background z-10">
                      {topic.name}
                    </td>
                    {candidates.map((c) => {
                      const pos = c.positions[topic.slug];
                      return (
                        <td key={c.id} className="p-4 text-center">
                          <StanceDots stance={pos?.stance ?? 0} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}

            {/* Spending section */}
            {candidates.some((c) => c.spending.length > 0) && (
              <>
                <tr className="bg-muted/30">
                  <td
                    colSpan={candidates.length + 1}
                    className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider"
                  >
                    Gastos Públicos
                  </td>
                </tr>
                {["CEAP", "CAMPAIGN", "DECLARED_ASSETS"].map((type) => {
                  const hasData = candidates.some((c) =>
                    c.spending.find((s) => s.type === type)
                  );
                  if (!hasData) return null;
                  const typeLabels: Record<string, string> = {
                    CEAP: "Cota Parlamentar",
                    CAMPAIGN: "Campanha",
                    DECLARED_ASSETS: "Patrimônio Declarado",
                  };
                  return (
                    <tr
                      key={type}
                      className="border-b border-border/50 hover:bg-muted/20"
                    >
                      <td className="p-4 text-sm font-medium text-foreground sticky left-0 bg-background z-10">
                        {typeLabels[type] ?? type}
                      </td>
                      {candidates.map((c) => {
                        const record = c.spending.find((s) => s.type === type);
                        return (
                          <td
                            key={c.id}
                            className="p-4 text-center text-sm font-medium"
                          >
                            {record
                              ? new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                  maximumFractionDigits: 0,
                                }).format(record.totalAmount)
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
