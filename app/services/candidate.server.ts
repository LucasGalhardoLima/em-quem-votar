import { db } from "~/utils/db.server";
import { Prisma } from "@prisma/client";

interface ListParams {
  query?: string | null;
  party?: string[] | null;
  topic?: string | null;
  stance?: string | null;
  limit?: number;
  offset?: number;
}

export const CandidateService = {
  async list({ query, party, topic, stance, limit = 20, offset = 0 }: ListParams) {
    const where: Prisma.CandidateWhereInput = {
      electionType: "presidential",
    };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
        { party: { contains: query, mode: "insensitive" } },
      ];
    }

    if (party && party.length > 0) {
      where.party = { in: party };
    }

    if (topic) {
      const topicFilter: Prisma.CandidatePositionWhereInput = {
        topic: { slug: topic },
        approvedAt: { not: null },
      };
      if (stance === "favor") {
        topicFilter.stance = { gte: 4 };
      } else if (stance === "contra") {
        topicFilter.stance = { lte: 2 };
      }
      where.positions = { some: topicFilter };
    }

    const [items, total] = await Promise.all([
      db.candidate.findMany({
        where,
        skip: offset,
        take: limit,
        select: {
          id: true,
          name: true,
          displayName: true,
          party: true,
          coalition: true,
          photoUrl: true,
          registrationStatus: true,
          tags: {
            include: { tag: true },
          },
          _count: {
            select: { positions: { where: { approvedAt: { not: null } } } },
          },
        },
        orderBy: { name: "asc" },
      }),
      db.candidate.count({ where }),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        displayName: c.displayName,
        party: c.party,
        coalition: c.coalition,
        photoUrl: c.photoUrl,
        registrationStatus: c.registrationStatus,
        tags: c.tags.map((ct) => ({
          name: ct.tag.name,
          slug: ct.tag.slug,
          category: ct.tag.category,
        })),
        positionCount: c._count.positions,
      })),
      total,
    };
  },

  async getById(id: string) {
    const candidate = await db.candidate.findUnique({
      where: { id },
      include: {
        positions: {
          where: { approvedAt: { not: null } },
          include: { topic: true },
          orderBy: { topic: { order: "asc" } },
        },
        tags: {
          include: { tag: true },
        },
        legislativeLink: true,
        spendingRecords: {
          orderBy: { periodEnd: "desc" },
        },
        votes: {
          include: {
            bill: {
              select: {
                id: true,
                title: true,
                simplifiedTitle: true,
                simplifiedDescription: true,
                voteDate: true,
                voteSimDetails: true,
                voteNaoDetails: true,
              },
            },
          },
          orderBy: { bill: { voteDate: "desc" } },
          take: 20,
        },
      },
    });

    if (!candidate) return null;

    return {
      id: candidate.id,
      name: candidate.name,
      displayName: candidate.displayName,
      party: candidate.party,
      coalition: candidate.coalition,
      photoUrl: candidate.photoUrl,
      biography: candidate.biography,
      registrationStatus: candidate.registrationStatus,
      number: candidate.number,
      positions: candidate.positions.map((p) => ({
        topicName: p.topic.name,
        topicCategory: p.topic.category,
        topicSlug: p.topic.slug,
        stance: p.stance as 0 | 1 | 2 | 3 | 4 | 5,
        description: p.description,
        sourceType: p.sourceType,
        sourceUrl: p.sourceUrl,
        sourceDate: p.sourceDate?.toISOString() ?? null,
      })),
      tags: candidate.tags.map((ct) => ({
        name: ct.tag.name,
        slug: ct.tag.slug,
        category: ct.tag.category,
      })),
      spending: candidate.spendingRecords.map((s) => ({
        type: s.type,
        totalAmount: Number(s.amount),
        period: `${s.periodStart.toISOString().slice(0, 7)} — ${s.periodEnd.toISOString().slice(0, 7)}`,
        source: s.source,
      })),
      votes: candidate.votes.map((v) => ({
        id: v.id,
        voteType: v.voteType,
        bill: {
          id: v.bill.id,
          title: v.bill.title,
          simplifiedTitle: v.bill.simplifiedTitle,
          simplifiedDescription: v.bill.simplifiedDescription,
          voteDate: v.bill.voteDate.toISOString(),
          voteSimDetails: v.bill.voteSimDetails,
          voteNaoDetails: v.bill.voteNaoDetails,
        },
      })),
      hasLegislativeRecord: candidate.legislativeLink !== null,
    };
  },

  async getFilters() {
    const [parties, topics] = await Promise.all([
      db.candidate.findMany({
        where: { electionType: "presidential" },
        select: { party: true },
        distinct: ["party"],
        orderBy: { party: "asc" },
      }),
      db.politicalTopic.findMany({
        select: { slug: true, name: true, category: true },
        orderBy: { order: "asc" },
      }),
    ]);

    return {
      parties: parties.map((p) => p.party),
      topics,
    };
  },

  async listForComparison(ids: string[]) {
    const candidates = await db.candidate.findMany({
      where: { id: { in: ids } },
      include: {
        positions: {
          where: { approvedAt: { not: null } },
          include: { topic: true },
        },
        spendingRecords: true,
        votes: {
          include: { bill: true },
        },
      },
    });

    return candidates.map((c) => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      party: c.party,
      photoUrl: c.photoUrl,
      positions: Object.fromEntries(
        c.positions.map((p) => [
          p.topic.slug,
          { stance: p.stance, description: p.description },
        ])
      ),
      spending: c.spendingRecords.map((s) => ({
        type: s.type,
        totalAmount: Number(s.amount),
      })),
      votes: Object.fromEntries(
        c.votes.map((v) => [v.billId, v.voteType])
      ),
    }));
  },

  async findAllForMatch() {
    const candidates = await db.candidate.findMany({
      where: { electionType: "presidential" },
      select: {
        id: true,
        name: true,
        displayName: true,
        party: true,
        photoUrl: true,
        coalition: true,
        registrationStatus: true,
        positions: {
          where: { approvedAt: { not: null } },
          select: {
            stance: true,
            topic: {
              select: { slug: true, category: true },
            },
          },
        },
        tags: {
          include: { tag: true },
        },
        _count: {
          select: { positions: { where: { approvedAt: { not: null } } } },
        },
      },
    });

    return candidates.map((c) => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      party: c.party,
      photoUrl: c.photoUrl,
      coalition: c.coalition,
      registrationStatus: c.registrationStatus,
      positions: Object.fromEntries(
        c.positions.map((p) => [p.topic.slug, p.stance])
      ),
      positionCategories: Object.fromEntries(
        c.positions.map((p) => [p.topic.slug, p.topic.category])
      ),
      tags: c.tags.map((ct) => ({
        name: ct.tag.name,
        slug: ct.tag.slug,
        category: ct.tag.category,
      })),
      positionCount: c._count.positions,
    }));
  },

  async listAllIds() {
    return db.candidate.findMany({
      where: { electionType: "presidential" },
      select: { id: true, updatedAt: true },
    });
  },

  // Admin methods
  async create(data: {
    name: string;
    displayName: string;
    party: string;
    coalition?: string;
    photoUrl?: string;
    biography?: string;
    number?: number;
    tseId?: string;
  }) {
    return db.candidate.create({ data });
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      displayName: string;
      party: string;
      coalition: string | null;
      photoUrl: string | null;
      biography: string | null;
      number: number | null;
      tseId: string | null;
      registrationStatus: "PRE_CANDIDATE" | "REGISTERED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
    }>
  ) {
    return db.candidate.update({ where: { id }, data });
  },

  async delete(id: string) {
    await db.candidate.delete({ where: { id } });
  },
};
