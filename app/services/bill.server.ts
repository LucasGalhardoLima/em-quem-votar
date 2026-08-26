import { db } from "~/utils/db.server";
import type { Prisma } from "@prisma/client";

interface ListApprovedParams {
  query?: string | null;
  source?: string | null;
  limit?: number;
}

export const BillService = {
  async getById(id: string) {
    const bill = await db.bill.findFirst({
      where: {
        id,
        status: "approved",
      },
      include: {
        voteLogs: {
          include: {
            politician: true,
          },
          orderBy: {
            politician: { name: "asc" },
          },
        },
        voteRecords: {
          include: {
            candidate: {
              select: {
                id: true,
                name: true,
                displayName: true,
                party: true,
                photoUrl: true,
              },
            },
          },
          orderBy: {
            candidate: { name: "asc" },
          },
        },
      },
    });

    if (!bill) return null;

    const candidateVotes = bill.voteRecords.map((vr) => ({
      candidateId: vr.candidate.id,
      candidateName: vr.candidate.displayName,
      candidateParty: vr.candidate.party,
      candidatePhotoUrl: vr.candidate.photoUrl,
      voteType: vr.voteType,
    }));

    const legacyVotes = bill.voteLogs.map((log) => ({
      id: log.id,
      voteType: log.voteType,
      politician: {
        id: log.politician.id,
        name: log.politician.name,
        party: log.politician.party,
        state: log.politician.state,
        photoUrl: log.politician.photoUrl,
      },
    }));

    const countVotes = (type: string) =>
      candidateVotes.filter((v) => v.voteType === type).length +
      legacyVotes.filter((v) => v.voteType === type).length;

    return {
      id: bill.id,
      title: bill.title,
      simplifiedTitle: bill.simplifiedTitle,
      simplifiedDescription: bill.simplifiedDescription,
      description: bill.description,
      voteDate: bill.voteDate.toISOString(),
      voteSimDetails: bill.voteSimDetails,
      voteNaoDetails: bill.voteNaoDetails,
      sourceUrl: bill.sourceUrl,
      sourceType: bill.sourceType,
      status: bill.status,
      candidateVotes,
      legacyVotes,
      summary: {
        sim: countVotes("SIM"),
        nao: countVotes("NÃO"),
        abstencao: countVotes("Abstenção"),
        obstrucao: countVotes("Obstrução"),
      },
    };
  },

  async listApproved({
    query,
    source,
    limit = 50,
  }: ListApprovedParams = {}) {
    const where: Prisma.BillWhereInput = {
      status: "approved",
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { simplifiedTitle: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ];
    }

    if (source && (source === "camara" || source === "senado")) {
      where.sourceType = source;
    }

    const bills = await db.bill.findMany({
      where,
      select: {
        id: true,
        title: true,
        simplifiedTitle: true,
        voteDate: true,
        status: true,
        sourceType: true,
        sourceUrl: true,
      },
      orderBy: { voteDate: "desc" },
      take: limit,
    });

    return bills.map((b) => ({
      ...b,
      voteDate: b.voteDate.toISOString(),
    }));
  },

  async listFeatured(ids: string[]) {
    const bills = await db.bill.findMany({
      where: {
        id: { in: ids },
        status: "approved",
      },
      select: {
        id: true,
        title: true,
        simplifiedTitle: true,
        voteDate: true,
        description: true,
        sourceType: true,
      },
    });

    return bills.map((b) => ({
      ...b,
      voteDate: b.voteDate.toISOString(),
    }));
  },
};
