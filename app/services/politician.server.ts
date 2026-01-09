import { db } from "~/utils/db.server";
import { Prisma } from "@prisma/client";
import { FEATURED_VOTE_IDS } from "~/data/votes";

interface FindPoliticiansParams {
  query?: string | null;
  tags?: string[] | null;
  offset?: number;
  limit?: number;
}

export const PoliticianService = {
  async list({ query, tags, offset = 0, limit = 20 }: FindPoliticiansParams) {
    const where: Prisma.PoliticianWhereInput = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { party: { contains: query, mode: "insensitive" } },
      ];
    }

    if (tags && tags.length > 0) {
      where.AND = tags.map(slug => ({
        tags: { some: { tag: { slug: slug } } }
      }));
    }

    const politicians = await db.politician.findMany({
      where,
      skip: offset,
      take: limit + 1,
      include: {
        tags: {
          take: 3,
          include: { tag: true },
        },
      },
      orderBy: { name: 'asc' }
    });

    const hasMore = politicians.length > limit;
    const rawItems = hasMore ? politicians.slice(0, limit) : politicians;

    const items = rawItems.map(p => ({
      ...p,
      spending: p.spending ? Number(p.spending.toString()) : 0,
      attendanceRate: p.attendanceRate ? Number(p.attendanceRate.toString()) : 0,
    }));

    return { items, hasMore };
  },

  async getById(id: string) {
    const politician = await db.politician.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        party: true,
        state: true,
        photoUrl: true,
        spending: true,
        attendanceRate: true,
        tags: {
          include: {
            tag: true,
          },
        },
        votes: {
          take: 20,
          select: {
            id: true,
            voteType: true,
            billId: true,
            bill: {
              select: {
                id: true,
                title: true,
                voteDate: true,
                description: true
              }
            }
          },
          orderBy: {
            bill: {
              voteDate: "desc",
            },
          },
        },
      },
    });

    if (!politician) return null;

    return {
      ...politician,
      spending: politician.spending ? Number(politician.spending.toString()) : 0,
      attendanceRate: politician.attendanceRate ? Number(politician.attendanceRate.toString()) : 0,
      votes: politician.votes.map(v => ({
        ...v,
        bill: {
          ...v.bill,
          voteDate: v.bill.voteDate.toISOString()
        }
      }))
    };
  },

  async listForComparison(ids: string[]) {
    const politicians = await db.politician.findMany({
      where: { id: { in: ids } },
      include: {
        votes: {
          include: { bill: true }
        }
      }
    });

    return politicians.map(p => ({
      ...p,
      spending: p.spending ? Number(p.spending.toString()) : 0,
      attendanceRate: p.attendanceRate ? Number(p.attendanceRate.toString()) : 0,
      votes: p.votes.map(v => ({
        ...v,
        bill: {
          ...v.bill,
          voteDate: v.bill.voteDate.toISOString()
        }
      }))
    }));
  },

  async listAllIds() {
    return db.politician.findMany({
      select: { id: true, updatedAt: true },
    });
  }
};
