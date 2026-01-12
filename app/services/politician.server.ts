import { db } from "~/utils/db.server";
import { Prisma } from "@prisma/client";
import { FEATURED_VOTE_IDS } from "~/data/votes";

interface FindPoliticiansParams {
  query?: string | null;
  tags?: string[] | null;
  state?: string[] | null;
  party?: string[] | null;
  offset?: number;
  limit?: number;
}

export const PoliticianService = {
  async list({ query, tags, state, party, offset = 0, limit = 20 }: FindPoliticiansParams) {
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

    if (state && state.length > 0) {
      where.state = { in: state };
    }

    if (party && party.length > 0) {
      where.party = { in: party };
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

  async getFilters() {
    const [parties, states] = await Promise.all([
      db.politician.findMany({ select: { party: true }, distinct: ['party'], orderBy: { party: 'asc' } }),
      db.politician.findMany({ select: { state: true }, distinct: ['state'], orderBy: { state: 'asc' } })
    ]);

    return {
      parties: parties.map(p => p.party).filter(Boolean),
      states: states.map(s => s.state).filter(Boolean)
    };
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

    // 1. Get all bill IDs from the politician's votes
    const billIds = politician.votes.map(v => v.billId);

    // 2. Aggregate votes by party for these bills
    // We need to know: For each bill, what did the majority of THIS politician's party vote?
    const partyVotes = await db.voteLog.groupBy({
      by: ['billId', 'voteType'],
      where: {
        billId: { in: billIds },
        politician: {
          party: politician.party
        }
      },
      _count: {
        _all: true
      }
    });

    // 3. Process aggregation to find majority position per bill
    const partyMajorityMap: Record<string, string> = {}; 

    // Group counts by bill
    const billCounts: Record<string, { SIM: number, NAO: number }> = {};
    
    partyVotes.forEach(pv => {
      if (!billCounts[pv.billId]) billCounts[pv.billId] = { SIM: 0, NAO: 0 };
      const type = pv.voteType.toUpperCase();
      if (type === 'SIM') billCounts[pv.billId].SIM += pv._count._all;
      if (type === 'NÃO' || type === 'NAO') billCounts[pv.billId].NAO += pv._count._all;
    });

    Object.entries(billCounts).forEach(([billId, counts]) => {
      if (counts.SIM > counts.NAO) partyMajorityMap[billId] = 'SIM';
      else if (counts.NAO > counts.SIM) partyMajorityMap[billId] = 'NÃO';
      else partyMajorityMap[billId] = 'EMPATE'; // Rare, but possible
    });

    // 4. Map results
    return {
      ...politician,
      spending: politician.spending ? Number(politician.spending.toString()) : 0,
      attendanceRate: politician.attendanceRate ? Number(politician.attendanceRate.toString()) : 0,
      votes: politician.votes.map(v => {
        const myVote = v.voteType.toUpperCase();
        const partyVote = partyMajorityMap[v.billId];
        
        // Logic for "Rebel":
        // Majority is SIM, I voted NÃO
        // Majority is NÃO, I voted SIM
        const isRebel = (partyVote === 'SIM' && (myVote === 'NÃO' || myVote === 'NAO')) ||
                        ((partyVote === 'NÃO' || partyVote === 'NAO') && myVote === 'SIM');

        return {
          ...v,
          isRebel,
          partyMajorityPosition: partyVote,
          bill: {
            ...v.bill,
            voteDate: v.bill.voteDate.toISOString()
          }
        };
      })
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
  },

  async findAllForMatch() {
    return db.politician.findMany({
      select: {
        id: true,
        name: true,
        party: true,
        state: true,
        photoUrl: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });
  }
};
