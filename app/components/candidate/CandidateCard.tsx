import { Link } from "react-router";
import type { RegistrationStatus } from "~/lib/candidate-status";
import { CandidateAvatar } from "./CandidateAvatar";
import { CompareToggle } from "./CompareToggle";
import { StatusBadge } from "./StatusBadge";

export interface CandidateCardData {
  id: string;
  name: string;
  displayName: string;
  party: string;
  coalition: string | null;
  photoUrl: string | null;
  registrationStatus: RegistrationStatus;
  tseStatusLabel: string | null;
  number: number | null;
  viceName: string | null;
  viceParty: string | null;
  positionCount: number;
}

/**
 * Card da listagem. Peso visual idêntico para toda candidatura: mesmo
 * tamanho, mesma tipografia, sem cor partidária e sem destaque para quem
 * tem mais dados. A única diferença admitida é a situação de registro,
 * porque ela é um fato do TSE.
 */
export function CandidateCard({
  candidate,
  selected,
  onToggleCompare,
}: {
  candidate: CandidateCardData;
  selected: boolean;
  onToggleCompare: () => void;
}) {
  const subtitle = [
    candidate.party,
    candidate.number != null ? `nº ${candidate.number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] transition-colors focus-within:border-indigo-300 hover:border-indigo-300">
      <div className="flex items-center gap-3">
        <CandidateAvatar
          name={candidate.displayName}
          photoUrl={candidate.photoUrl}
          size="md"
        />
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-slate-800">
            <Link
              to={`/candidato/${candidate.id}`}
              prefetch="intent"
              className="after:absolute after:inset-0 after:content-['']"
            >
              {candidate.displayName}
            </Link>
          </h3>
          <p className="mt-px truncate text-[12.5px] text-slate-500">{subtitle}</p>
        </div>
      </div>

      <StatusBadge
        status={candidate.registrationStatus}
        tseStatusLabel={candidate.tseStatusLabel}
      />

      {candidate.viceName && (
        <p className="truncate text-[12px] text-slate-400">
          Vice: {candidate.viceName}
          {candidate.viceParty ? ` (${candidate.viceParty})` : ""}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="text-[12.5px] font-semibold text-indigo-600">
          Ver perfil →
        </span>
        <span className="relative z-10">
          <CompareToggle
            selected={selected}
            onToggle={onToggleCompare}
            candidateName={candidate.displayName}
          />
        </span>
      </div>
    </article>
  );
}
