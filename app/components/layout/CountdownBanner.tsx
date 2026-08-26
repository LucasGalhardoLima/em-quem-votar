import { countdownCopy } from "~/lib/election";

/**
 * Faixa de contagem regressiva. Recebe `days` calculado no servidor para
 * evitar divergência de hidratação entre o fuso do servidor e o do
 * navegador — a data de referência é sempre Brasília.
 */
export function CountdownBanner({
  days,
  label,
  dateLabel,
}: ReturnType<typeof countdownCopy>) {
  if (days === 0) {
    return (
      <div className="border-b border-indigo-600/[0.12] bg-indigo-600/[0.05] px-5 py-2.5 text-center text-[13px] text-indigo-600">
        <strong className="font-semibold">É hoje</strong> — {dateLabel}, dia do{" "}
        {label}
      </div>
    );
  }

  return (
    <div className="border-b border-indigo-600/[0.12] bg-indigo-600/[0.05] px-5 py-2.5 text-center text-[13px] text-indigo-600">
      <strong className="font-semibold">
        {days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`}
      </strong>{" "}
      para o {label} — {dateLabel}
    </div>
  );
}
