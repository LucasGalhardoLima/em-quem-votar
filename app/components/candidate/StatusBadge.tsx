import {
  STATUS_BADGE_CLASS,
  statusDescription,
  statusLabel,
  statusTone,
  type RegistrationStatus,
} from "~/lib/candidate-status";
import { cn } from "~/lib/utils";

/**
 * Badge da situação de registro. O texto vem do TSE quando disponível; a
 * descrição no `title` é a definição da Justiça Eleitoral, para que a
 * plataforma não precise interpretar a situação de ninguém.
 */
export function StatusBadge({
  status,
  tseStatusLabel,
  className,
}: {
  status: RegistrationStatus;
  tseStatusLabel?: string | null;
  className?: string;
}) {
  const label = statusLabel(status, tseStatusLabel);
  const description = statusDescription(status);

  return (
    <span
      title={description}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        STATUS_BADGE_CLASS[statusTone(status)],
        className,
      )}
    >
      {label}
      <span className="sr-only">. {description}</span>
    </span>
  );
}
