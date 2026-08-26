/**
 * Escrita da situação da candidatura no banco.
 *
 * A leitura (HTTP, constantes, `divulgaUrl`) mora em `~/lib/tse-divulga` —
 * pura, sem Prisma, para o script de sync poder importá-la sem abrir um
 * segundo cliente de banco. Aqui fica só o que toca o banco.
 *
 * NENHUMA IA ENVOLVIDA: chamadas HTTP ao TSE e updates. O
 * `vote-classifier.server.ts` (OpenAI) pertence ao pipeline de votações e não
 * é tocado por este caminho — o cron horário não consome créditos de modelo.
 */
import { statusFromTseLabel } from "~/lib/candidate-status";
import { fetchDivulgaStatuses, type DivulgaStatuses } from "~/lib/tse-divulga";
import { db } from "~/utils/db.server";

export interface StatusRefreshResult {
  /** Situações lidas no TSE. */
  read: number;
  /** Candidaturas cuja situação mudou de fato. */
  changed: Array<{ tseId: string; from: string | null; to: string }>;
  /** Redações que o TSE escreveu e o STATUS_MAP não conhece. Exigem código. */
  unmapped: Array<{ tseId: string; label: string }>;
  failedUnits: DivulgaStatuses["failedUnits"];
}

/**
 * Reconfere só a situação das candidaturas já existentes. NÃO cria, NÃO apaga
 * e não toca em nenhum outro campo — é o passo barato que roda de hora em
 * hora, enquanto o sync completo (identidade, coligação, chapa) roda menos.
 *
 * Duas recusas deliberadas:
 *
 * 1. Unidade sem resposta não sobrescreve nada. Como só gravamos os `tseId`
 *    que a API devolveu, uma queda do TSE simplesmente não mexe no banco —
 *    em vez de rebaixar "Deferido" para "aguardando julgamento".
 * 2. Redação desconhecida não vira palpite. Sai em `unmapped` para alguém
 *    olhar; a situação gravada continua a que estava.
 */
export async function refreshCandidateStatuses(): Promise<StatusRefreshResult> {
  const { byTseId, failedUnits } = await fetchDivulgaStatuses();

  const candidates = await db.candidate.findMany({
    where: { tseId: { not: null } },
    select: { tseId: true, tseStatusLabel: true },
  });

  const changed: StatusRefreshResult["changed"] = [];
  const unmapped: StatusRefreshResult["unmapped"] = [];

  for (const candidate of candidates) {
    const tseId = candidate.tseId as string;
    const label = byTseId.get(tseId);
    if (!label) continue; // unidade não respondeu, ou candidatura fora do recorte
    if (label === candidate.tseStatusLabel) continue;

    const status = statusFromTseLabel(label);
    if (!status) {
      unmapped.push({ tseId, label });
      continue;
    }

    await db.candidate.update({
      where: { tseId },
      data: { tseStatusLabel: label, registrationStatus: status, lastSyncedAt: new Date() },
    });
    changed.push({ tseId, from: candidate.tseStatusLabel, to: label });
  }

  return { read: byTseId.size, changed, unmapped, failedUnits };
}
