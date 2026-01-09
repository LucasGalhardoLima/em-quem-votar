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
      select: {
        id: true,
        name: true,
        party: true,
        state: true,
        photoUrl: true,
        spending: true,
        attendanceRate: true,
        tags: {
          take: 3,
          select: {
            tag: {
              select: {
                name: true,
                slug: true,
                category: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const hasMore = politicians.length > limit;
    const items = hasMore ? politicians.slice(0, limit) : politicians;

    return { items, hasMore };
  },

  async getById(id: string) {
    return db.politician.findUnique({
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
  },

  async getFeaturedVotes() {
    const votes = await db.bill.findMany({
      where: {
        id: { in: FEATURED_VOTE_IDS }
      },
      select: { id: true, title: true, voteDate: true, description: true }
    });
    
    return votes.map(v => ({ ...v, voteDate: v.voteDate.toISOString() }));
  }
};
