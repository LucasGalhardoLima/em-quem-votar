import { db } from "~/utils/db.server";
import type { PositionSourceType } from "@prisma/client";

/**
 * Dados de procedência de uma posição. Espelha exatamente o que o leitor vê
 * em app/components/candidate/SourceCite.tsx: documento, página, data, trecho
 * literal e link. Nada é exibido no site público que não tenha passado por
 * aqui.
 */
export interface PositionSourceInput {
  sourceType: PositionSourceType;
  sourceUrl?: string | null;
  sourceDocument?: string | null;
  sourcePage?: number | null;
  sourceQuote?: string | null;
  sourceDate?: Date | null;
}

/**
 * Regra editorial de aprovação (spec 002 §4 Fase B / SC-102).
 *
 * Posição extraída da proposta de governo protocolada no TSE só pode ir ao ar
 * se o leitor conseguir conferir a afirmação: link do documento **e** página
 * do PDF. Sem os dois, a aprovação é recusada — nunca aprovada em silêncio.
 *
 * Retorna a mensagem de bloqueio em pt-BR, ou `null` quando a posição está
 * apta a ser aprovada. Função pura: usada tanto no loader (para avisar o
 * editor antes de ele tentar) quanto no `approve` (para valer de fato).
 */
export function approvalBlocker(position: {
  sourceType: PositionSourceType | string;
  sourceUrl?: string | null;
  sourcePage?: number | null;
}): string | null {
  if (position.sourceType !== "PLATFORM") return null;

  const missing: string[] = [];
  if (!position.sourceUrl || position.sourceUrl.trim().length === 0) {
    missing.push("o link do documento (URL da fonte)");
  }
  if (position.sourcePage == null || position.sourcePage < 1) {
    missing.push("a página do PDF");
  }
  if (missing.length === 0) return null;

  return `Falta ${missing.join(" e ")}. Posição de proposta de governo só é publicada com documento e página conferíveis pelo leitor.`;
}

export type ApproveResult =
  | { ok: true }
  | { ok: false; error: string };

export type UpdateResult =
  | { ok: true; unapproved: boolean }
  | { ok: false; error: string };

export const PositionService = {
  async listByCandidate(candidateId: string) {
    return db.candidatePosition.findMany({
      where: { candidateId },
      include: { topic: true },
      orderBy: { topic: { order: "asc" } },
    });
  },

  async listByTopic(topicSlug: string) {
    return db.candidatePosition.findMany({
      where: {
        topic: { slug: topicSlug },
        approvedAt: { not: null },
      },
      include: {
        candidate: {
          select: { id: true, name: true, displayName: true, party: true, photoUrl: true },
        },
        topic: true,
      },
      orderBy: { candidate: { name: "asc" } },
    });
  },

  /**
   * Cria a posição sempre como pendente (`approvedAt` nulo). A checagem de
   * fonte acontece na aprovação, não aqui: o editor pode salvar um rascunho
   * incompleto e voltar para completar a citação.
   */
  async create(
    data: {
      candidateId: string;
      topicId: string;
      stance: number;
      description?: string | null;
      confidence?: number | null;
    } & PositionSourceInput
  ) {
    return db.candidatePosition.create({ data });
  },

  /**
   * Edita uma posição existente. Se a edição quebrar a regra de fonte de uma
   * posição já aprovada, ela volta automaticamente para pendente — nunca
   * fica no ar uma citação incompleta.
   */
  async update(
    id: string,
    data: Partial<
      {
        stance: number;
        description: string | null;
        confidence: number | null;
      } & PositionSourceInput
    >
  ): Promise<UpdateResult> {
    const current = await db.candidatePosition.findUnique({
      where: { id },
      select: {
        sourceType: true,
        sourceUrl: true,
        sourcePage: true,
        approvedAt: true,
      },
    });
    if (!current) return { ok: false, error: "Posição não encontrada." };

    const next = {
      sourceType: data.sourceType ?? current.sourceType,
      sourceUrl: data.sourceUrl !== undefined ? data.sourceUrl : current.sourceUrl,
      sourcePage: data.sourcePage !== undefined ? data.sourcePage : current.sourcePage,
    };
    const unapproved =
      current.approvedAt !== null && approvalBlocker(next) !== null;

    await db.candidatePosition.update({
      where: { id },
      data: unapproved ? { ...data, approvedAt: null } : data,
    });

    return { ok: true, unapproved };
  },

  /**
   * Aprova a posição depois de reconferir a fonte no banco (e não no que o
   * formulário mandou). Recusa explícita em vez de aprovação silenciosa.
   */
  async approve(id: string): Promise<ApproveResult> {
    const position = await db.candidatePosition.findUnique({
      where: { id },
      select: { sourceType: true, sourceUrl: true, sourcePage: true },
    });
    if (!position) return { ok: false, error: "Posição não encontrada." };

    const blocker = approvalBlocker(position);
    if (blocker) return { ok: false, error: blocker };

    await db.candidatePosition.update({
      where: { id },
      data: { approvedAt: new Date() },
    });
    return { ok: true };
  },

  /** Tira a posição do ar sem apagar o trabalho de curadoria já feito. */
  async unapprove(id: string) {
    return db.candidatePosition.update({
      where: { id },
      data: { approvedAt: null },
    });
  },

  async delete(id: string) {
    return db.candidatePosition.delete({ where: { id } });
  },

  async listPending() {
    return db.candidatePosition.findMany({
      where: { approvedAt: null },
      include: {
        candidate: {
          select: { id: true, name: true, displayName: true, party: true },
        },
        topic: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
