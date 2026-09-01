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
import { tseStatusWrite, type RegistrationStatus } from "~/lib/candidate-status";
import { fetchDivulgaStatuses, type DivulgaStatuses } from "~/lib/tse-divulga";
import { db } from "~/utils/db.server";

/**
 * Updates por transação. Mesmo motivo (e mesmo número) de
 * `tse-detail.server.ts`: o banco é remoto e o que custa é o NÚMERO de idas e
 * voltas. Em série, um julgamento em lote — 140 candidaturas ainda
 * "Aguardando julgamento" hoje — viravam 140 round-trips dentro de uma função
 * serverless; agrupadas, viram um.
 */
const CHUNK = 500;

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
 * Três recusas deliberadas:
 *
 * 1. Unidade sem resposta não sobrescreve nada. Como só gravamos os `tseId`
 *    que a API devolveu, uma queda do TSE simplesmente não mexe no banco —
 *    em vez de rebaixar "Deferido" para "aguardando julgamento".
 * 2. Redação desconhecida não vira palpite no ENUM. A redação em si é gravada
 *    (é a palavra literal da Justiça Eleitoral, e é ela que o badge exibe); o
 *    `registrationStatus` guardado é preservado, porque um valor que alguém
 *    conferiu vale mais que um fallback inventado. Ver `tseStatusWrite()`.
 * 3. O aviso de redação desconhecida sai em TODA execução, não só na primeira.
 *    Reportar apenas quando o rótulo muda faria a anomalia aparecer uma vez e
 *    sumir — com o enum errado congelado no banco e ninguém mais avisado.
 */
export async function refreshCandidateStatuses(): Promise<StatusRefreshResult> {
  const { byTseId, failedUnits } = await fetchDivulgaStatuses();

  const candidates = await db.candidate.findMany({
    where: { tseId: { not: null } },
    select: { tseId: true, tseStatusLabel: true },
  });

  const changed: StatusRefreshResult["changed"] = [];
  const unmapped: StatusRefreshResult["unmapped"] = [];
  const updates: Array<{
    tseId: string;
    data: {
      tseStatusLabel: string;
      registrationStatus?: RegistrationStatus;
      lastSyncedAt: Date;
    };
  }> = [];

  for (const candidate of candidates) {
    const tseId = candidate.tseId as string;
    const label = byTseId.get(tseId);
    if (!label) continue; // unidade não respondeu, ou candidatura fora do recorte

    const write = tseStatusWrite(label);
    if (write.kind === "absent") continue; // a API mandou string vazia

    // Antes da comparação de rótulos, de propósito: uma redação desconhecida
    // continua exigindo código mesmo depois de já estar gravada.
    if (write.kind === "unmapped") unmapped.push({ tseId, label });

    if (label === candidate.tseStatusLabel) continue;

    updates.push({
      tseId,
      data: {
        tseStatusLabel: write.label,
        ...(write.kind === "mapped" ? { registrationStatus: write.status } : {}),
        lastSyncedAt: new Date(),
      },
    });
    changed.push({ tseId, from: candidate.tseStatusLabel, to: label });
  }

  for (let i = 0; i < updates.length; i += CHUNK) {
    await db.$transaction(
      updates
        .slice(i, i + CHUNK)
        .map(u => db.candidate.update({ where: { tseId: u.tseId }, data: u.data })),
    );
  }

  return { read: byTseId.size, changed, unmapped, failedUnits };
}
