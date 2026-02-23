import { db } from "~/utils/db.server";
import type { PositionSourceType } from "@prisma/client";

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

  async create(data: {
    candidateId: string;
    topicId: string;
    stance: number;
    description?: string;
    sourceType: PositionSourceType;
    sourceUrl?: string;
    sourceDate?: Date;
    confidence?: number;
  }) {
    return db.candidatePosition.create({ data });
  },

  async approve(id: string) {
    return db.candidatePosition.update({
      where: { id },
      data: { approvedAt: new Date() },
    });
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
