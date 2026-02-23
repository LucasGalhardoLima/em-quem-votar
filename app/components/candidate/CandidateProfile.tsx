import { Badge } from "~/components/ui/badge";
import { User } from "lucide-react";
import { CandidatePositions } from "./CandidatePositions";
import { SpendingSummary } from "./SpendingSummary";
import { SpendingChart } from "./SpendingChart";
import { VoteList } from "./VoteList";

interface SpendingDetail {
  type: string;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  source: string;
  sourceUrl: string | null;
  categories: { category: string; amount: number }[];
}

interface CandidateProfileProps {
  candidate: {
    id: string;
    name: string;
    displayName: string;
    party: string;
    coalition: string | null;
    photoUrl: string | null;
    biography: string | null;
    registrationStatus: string;
    number: number | null;
    positions: {
      topicName: string;
      topicCategory: string;
      topicSlug: string;
      stance: 0 | 1 | 2 | 3 | 4 | 5;
      description: string | null;
      sourceType: string;
      sourceUrl: string | null;
      sourceDate: string | null;
    }[];
    tags: { name: string; slug: string; category: string }[];
    votes: {
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
    }[];
    hasLegislativeRecord: boolean;
  };
  spendingDetails?: SpendingDetail[];
}

const STATUS_LABELS: Record<string, string> = {
  PRE_CANDIDATE: "Pré-candidato",
  REGISTERED: "Registrado no TSE",
  APPROVED: "Candidatura aprovada",
  REJECTED: "Candidatura indeferida",
  WITHDRAWN: "Candidatura retirada",
};

export function CandidateProfile({
  candidate,
  spendingDetails = [],
}: CandidateProfileProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6">
        {/* Photo */}
        <div className="shrink-0">
          {candidate.photoUrl ? (
            <img
              src={candidate.photoUrl}
              alt={candidate.displayName}
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover bg-muted"
            />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-muted flex items-center justify-center">
              <User className="w-12 h-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {candidate.displayName}
            </h1>
            {candidate.displayName !== candidate.name && (
              <p className="text-sm text-muted-foreground">{candidate.name}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{candidate.party}</Badge>
            {candidate.coalition && (
              <Badge variant="outline">{candidate.coalition}</Badge>
            )}
            {candidate.number && (
              <Badge variant="secondary">N.º {candidate.number}</Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {STATUS_LABELS[candidate.registrationStatus] ?? candidate.registrationStatus}
            </Badge>
          </div>

          {/* Tags */}
          {candidate.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {candidate.tags.map((tag) => (
                <Badge
                  key={tag.slug}
                  variant="outline"
                  className="text-[11px] font-normal"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Biography */}
      {candidate.biography && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Biografia</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {candidate.biography}
          </p>
        </section>
      )}

      {/* Positions */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Posições Políticas
        </h2>
        <CandidatePositions positions={candidate.positions} />
      </section>

      {/* Spending */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Transparência Financeira
        </h2>
        <SpendingSummary
          spending={spendingDetails}
          hasLegislativeRecord={candidate.hasLegislativeRecord}
        />
        {spendingDetails.map(
          (group) =>
            group.categories.length > 1 && (
              <div key={group.type} className="mt-3">
                <SpendingChart
                  categories={group.categories}
                  label={`Detalhamento — ${TYPE_LABELS[group.type] ?? group.type}`}
                />
              </div>
            )
        )}
      </section>

      {/* Voting Record */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Histórico de Votações
        </h2>
        {candidate.hasLegislativeRecord || candidate.votes.length > 0 ? (
          <VoteList votes={candidate.votes} />
        ) : (
          <div className="rounded-lg border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Sem histórico legislativo.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Este candidato não exerceu mandato legislativo com votações
              registradas.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  CEAP: "Cota Parlamentar",
  CAMPAIGN: "Campanha",
  DECLARED_ASSETS: "Bens Declarados",
};
