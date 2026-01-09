import { db } from "~/utils/db.server";

export const BillService = {
  async getById(id: string) {
    const bill = await db.bill.findUnique({
      where: { id },
      include: {
        voteLogs: {
          include: {
            politician: true,
          },
          orderBy: {
            politician: { name: "asc" },
          },
        },
      },
    });

    if (!bill) return null;

    // Serialize dates to avoid hydration errors
    return {
      ...bill,
      voteDate: bill.voteDate.toISOString(),
      voteLogs: bill.voteLogs.map(log => ({
        ...log,
        politician: {
          ...log.politician,
          createdAt: log.politician.createdAt.toISOString(),
          updatedAt: log.politician.updatedAt.toISOString(),
        }
      }))
    };
  },

  async listFeatured(ids: string[]) {
    const projects = await db.bill.findMany({
      where: {
        id: { in: ids }
      },
      select: { id: true, title: true, voteDate: true, description: true }
    });
    
    return projects.map(v => ({ ...v, voteDate: v.voteDate.toISOString() }));
  }
};
