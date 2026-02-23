import { db } from "~/utils/db.server";
import type { SpendingType } from "@prisma/client";

interface SpendingByType {
  type: SpendingType;
  totalAmount: number;
  periodStart: string;
  periodEnd: string;
  source: string;
  sourceUrl: string | null;
  categories: {
    category: string;
    amount: number;
  }[];
}

export const SpendingService = {
  async getByCandidate(candidateId: string): Promise<SpendingByType[]> {
    const records = await db.spendingRecord.findMany({
      where: { candidateId },
      orderBy: [{ type: "asc" }, { periodEnd: "desc" }],
    });

    if (records.length === 0) return [];

    const grouped = new Map<SpendingType, typeof records>();
    for (const record of records) {
      const existing = grouped.get(record.type) ?? [];
      existing.push(record);
      grouped.set(record.type, existing);
    }

    return Array.from(grouped.entries()).map(([type, typeRecords]) => {
      const totalAmount = typeRecords.reduce(
        (sum, r) => sum + Number(r.amount),
        0
      );

      const periodStart = typeRecords
        .map((r) => r.periodStart)
        .sort((a, b) => a.getTime() - b.getTime())[0];

      const periodEnd = typeRecords
        .map((r) => r.periodEnd)
        .sort((a, b) => b.getTime() - a.getTime())[0];

      const categoryMap = new Map<string, number>();
      for (const r of typeRecords) {
        const cat = r.category ?? "Outros";
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Number(r.amount));
      }

      const categories = Array.from(categoryMap.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      return {
        type,
        totalAmount,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        source: typeRecords[0].source,
        sourceUrl: typeRecords[0].sourceUrl,
        categories,
      };
    });
  },

  /** Placeholder: sync CEAP spending from Câmara API */
  async syncFromCamara(
    _candidateId: string,
    _deputadoId: string
  ): Promise<void> {
    // TODO: Fetch from https://dadosabertos.camara.leg.br/api/v2/deputados/{id}/despesas
    // and upsert SpendingRecord entries with type=CEAP
  },

  /** Placeholder: sync campaign finance from TSE */
  async syncFromTSE(_candidateId: string, _tseId: string): Promise<void> {
    // TODO: Fetch from TSE open data portal
    // and upsert SpendingRecord entries with type=CAMPAIGN
  },
};
