import {
  STATUS_BADGE_CLASS,
  statusDescription,
  statusFromTseLabel,
  statusLabel,
  statusTone,
  type RegistrationStatus,
} from "~/lib/candidate-status";
import { cn } from "~/lib/utils";

/**
 * Badge da situação de registro. O texto vem do TSE quando disponível; a
 * descrição no `title` é a definição da Justiça Eleitoral, para que a
 * plataforma não precise interpretar a situação de ninguém.
 *
 * A descrição só aparece quando ela DE FATO corresponde ao rótulo exibido.
 *
 * Por quê: o sync preserva o enum guardado quando o TSE publica uma redação
 * que ainda não está mapeada (ver `tseStatusWrite`). Nesse intervalo o rótulo
 * é a redação nova e o enum é o antigo, e emitir a definição do enum fazia o
 * leitor de tela ouvir os dois em contradição — algo como "Cassado por abuso
 * de poder econômico. Pedido de registro protocolado, com julgamento ainda
 * pendente no TSE". Quem enxerga lê só o rótulo, correto; quem depende do
 * leitor de tela recebia uma afirmação falsa sobre uma pessoa real.
 *
 * Sem correspondência, exibimos apenas a redação do TSE — que é o dado
 * literal e sempre verdadeiro.
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

  // Sem rótulo do TSE, o rótulo exibido VEM do enum, então a definição casa
  // por construção. Com rótulo, ela só casa se a redação mapear no mesmo enum.
  const raw = tseStatusLabel?.trim();
  const describes =
    !raw || raw.length === 0 || statusFromTseLabel(raw) === status;
  const description = describes ? statusDescription(status) : null;

  return (
    <span
      title={description ?? label}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold",
        STATUS_BADGE_CLASS[statusTone(status)],
        className,
      )}
    >
      {label}
      {description && <span className="sr-only">. {description}</span>}
    </span>
  );
}
