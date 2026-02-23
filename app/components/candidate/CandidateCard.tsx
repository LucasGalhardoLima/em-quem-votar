import { Link } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { User, MapPin } from "lucide-react";
import { cn } from "~/lib/utils";

interface CandidateCardProps {
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

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  PRE_CANDIDATE: { label: "Pré-candidato", variant: "secondary" },
  REGISTERED: { label: "Registrado", variant: "outline" },
  APPROVED: { label: "Aprovado", variant: "default" },
  REJECTED: { label: "Indeferido", variant: "secondary" },
  WITHDRAWN: { label: "Desistiu", variant: "secondary" },
};

export function CandidateCard({
  id,
  displayName,
  party,
  coalition,
  photoUrl,
  registrationStatus,
  tags,
  positionCount,
}: CandidateCardProps) {
  const status = STATUS_LABELS[registrationStatus] ?? STATUS_LABELS.PRE_CANDIDATE;

  return (
    <Link to={`/candidato/${id}`} prefetch="intent" className="group block">
      <Card className="h-full transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:border-brand-primary/20">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {/* Photo */}
            <div className="shrink-0">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="w-16 h-16 rounded-full object-cover bg-muted"
                  loading="lazy"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-7 h-7 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground truncate group-hover:text-brand-primary transition-colors">
                    {displayName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {party}
                    {coalition && <span className="text-xs"> / {coalition}</span>}
                  </p>
                </div>
                <Badge variant={status.variant} className="shrink-0 text-[10px]">
                  {status.label}
                </Badge>
              </div>

              {/* Position count */}
              <p className="text-xs text-muted-foreground mt-2">
                {positionCount > 0
                  ? `${positionCount} posições mapeadas`
                  : "Sem posições mapeadas"}
              </p>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {tags.slice(0, 4).map((tag) => (
                    <Badge
                      key={tag.slug}
                      variant="outline"
                      className="text-[10px] font-normal"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {tags.length > 4 && (
                    <span className="text-[10px] text-muted-foreground self-center">
                      +{tags.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
