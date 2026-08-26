import { db } from "~/utils/db.server";
import type { Prisma } from "@prisma/client";

import type { RegistrationStatus } from "~/lib/candidate-status";
import type { Office, UfSigla } from "~/lib/office";

interface ListParams {
  /**
   * Cargo em disputa. Ausente = todos os cargos cobertos, que é o que a
   * listagem geral mostra. Não existe valor "todos" no enum de propósito:
   * `null` já significa isso, e um terceiro valor viraria estado inválido no
   * banco.
   */
  office?: Office | null;
  /**
   * Recorte por estado. Só faz sentido junto de `office: "governor"` — a
   * disputa presidencial é nacional. Quando vem UF sem cargo, a listagem
   * devolve os governadores daquele estado E a disputa presidencial, porque
   * é isso que o eleitor daquele estado vota.
   */
  uf?: UfSigla | null;
  query?: string | null;
  party?: string[] | null;
  topic?: string | null;
  stance?: string | null;
  status?: RegistrationStatus[] | null;
  limit?: number;
  offset?: number;
  /**
   * Semente da ordem sorteada. Neutralidade (research.md §6): a listagem
   * nunca sai em ordem fixa, para que nenhuma candidatura ganhe a vantagem
   * estrutural de aparecer sempre primeiro. A semente vem do servidor e vai
   * junto no loader, então SSR e hidratação concordam.
   */
  shuffleSeed?: number | null;
}

/**
 * Embaralhamento determinístico a partir de uma semente (Fisher-Yates com
 * PRNG mulberry32). Determinístico de propósito: a mesma semente reproduz a
 * mesma ordem no servidor e no cliente.
 */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Recorte de cargo/UF usado por toda consulta auxiliar. Existe para que os
 * chips de filtro, a lista de partidos e o quiz enxerguem exatamente o mesmo
 * conjunto que a listagem — um contador que conta candidaturas invisíveis é
 * pior que contador nenhum.
 */
function scopeWhere(
  office: Office | null,
  uf: UfSigla | null
): Prisma.CandidateWhereInput {
  if (office) {
    return office === "governor" && uf
      ? { electionType: office, uf }
      : { electionType: office };
  }
  if (uf) {
    return {
      OR: [{ electionType: "governor", uf }, { electionType: "presidential" }],
    };
  }
  return { electionType: { in: ["presidential", "governor"] } };
}

export const CandidateService = {
  async list({
    office = null,
    uf = null,
    query,
    party,
    topic,
    stance,
    status,
    limit = 50,
    offset = 0,
    shuffleSeed = null,
  }: ListParams) {
    const where: Prisma.CandidateWhereInput = {};

    if (office) {
      where.electionType = office;
      // Presidente é nacional: filtrar por UF esvaziaria a lista sem motivo.
      if (office === "governor" && uf) where.uf = uf;
    } else if (uf) {
      // Sem cargo definido, uma UF significa "o que eu voto neste estado":
      // o governo daquele estado mais a disputa nacional.
      where.OR = [
        { electionType: "governor", uf },
        { electionType: "presidential" },
      ];
    } else {
      where.electionType = { in: ["presidential", "governor"] };
    }

    if (query) {
      // AND explícito: `where.OR` pode já estar ocupado pelo recorte de UF
      // acima, e sobrescrevê-lo devolveria candidaturas de outros estados.
      where.AND = [
        {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { displayName: { contains: query, mode: "insensitive" } },
            { party: { contains: query, mode: "insensitive" } },
          ],
        },
      ];
    }

    if (party && party.length > 0) {
      where.party = { in: party };
    }

    if (status && status.length > 0) {
      where.registrationStatus = { in: status };
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
          tseStatusLabel: true,
          number: true,
          viceName: true,
          viceParty: true,
          dataSource: true,
          electionType: true,
          uf: true,
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

    const mapped = items.map((c) => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName,
      party: c.party,
      coalition: c.coalition,
      photoUrl: c.photoUrl,
      registrationStatus: c.registrationStatus,
      tseStatusLabel: c.tseStatusLabel,
      number: c.number,
      viceName: c.viceName,
      viceParty: c.viceParty,
      dataSource: c.dataSource,
      office: c.electionType as Office,
      uf: c.uf,
      tags: c.tags.map((ct) => ({
        name: ct.tag.name,
        slug: ct.tag.slug,
        category: ct.tag.category,
      })),
      positionCount: c._count.positions,
    }));

    return {
      items:
        shuffleSeed === null ? mapped : seededShuffle(mapped, shuffleSeed),
      total,
    };
  },

  /** Contagem por situação, para os chips de filtro da listagem. */
  async countByStatus(office: Office | null = null, uf: UfSigla | null = null) {
    const rows = await db.candidate.groupBy({
      by: ["registrationStatus"],
      where: scopeWhere(office, uf),
      _count: { _all: true },
    });
    return rows.map((r) => ({
      status: r.registrationStatus as RegistrationStatus,
      count: r._count._all,
    }));
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
      tseStatusLabel: candidate.tseStatusLabel,
      tseStatusDetail: candidate.tseStatusDetail,
      number: candidate.number,
      viceName: candidate.viceName,
      viceParty: candidate.viceParty,
      coalitionParties: candidate.coalitionParties,
      governmentPlanUrl: candidate.governmentPlanUrl,
      officialSiteUrl: candidate.officialSiteUrl,
      socialLinks: candidate.socialLinks as Record<string, string> | null,
      dataSource: candidate.dataSource,
      sourceUrl: candidate.sourceUrl,
      lastSyncedAt: candidate.lastSyncedAt?.toISOString() ?? null,
      positions: candidate.positions.map((p) => ({
        topicName: p.topic.name,
        topicCategory: p.topic.category,
        topicSlug: p.topic.slug,
        topicOrder: p.topic.order,
        stance: p.stance as 0 | 1 | 2 | 3 | 4 | 5,
        description: p.description,
        sourceType: p.sourceType,
        sourceUrl: p.sourceUrl,
        sourceDocument: p.sourceDocument,
        sourcePage: p.sourcePage,
        sourceQuote: p.sourceQuote,
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
        sourceUrl: s.sourceUrl,
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
      // A disputa acompanha o registro: a página do candidato não pode
      // afirmar um cargo fixo.
      electionType: candidate.electionType,
      uf: candidate.uf,
    };
  },

  async getFilters(office: Office | null = null, uf: UfSigla | null = null) {
    const [parties, topics] = await Promise.all([
      db.candidate.findMany({
        where: scopeWhere(office, uf),
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
      number: c.number,
      coalition: c.coalition,
      registrationStatus: c.registrationStatus,
      tseStatusLabel: c.tseStatusLabel,
      office: c.electionType as Office,
      uf: c.uf,
      positions: Object.fromEntries(
        c.positions.map((p) => [
          p.topic.slug,
          {
            stance: p.stance,
            description: p.description,
            sourceType: p.sourceType,
            sourceUrl: p.sourceUrl,
            sourceDocument: p.sourceDocument,
            sourcePage: p.sourcePage,
          },
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

  async findAllForMatch(
    office: Office | null = null,
    uf: UfSigla | null = null
  ) {
    const candidates = await db.candidate.findMany({
      where: scopeWhere(office, uf),
      select: {
        id: true,
        name: true,
        displayName: true,
        party: true,
        photoUrl: true,
        coalition: true,
        registrationStatus: true,
        tseStatusLabel: true,
        number: true,
        electionType: true,
        uf: true,
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
      tseStatusLabel: c.tseStatusLabel,
      number: c.number,
      office: c.electionType as Office,
      uf: c.uf,
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
      where: scopeWhere(null, null),
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
      registrationStatus: RegistrationStatus;
      tseStatusLabel: string | null;
      viceName: string | null;
      viceParty: string | null;
      governmentPlanUrl: string | null;
      officialSiteUrl: string | null;
    }>
  ) {
    return db.candidate.update({ where: { id }, data });
  },

  async delete(id: string) {
    await db.candidate.delete({ where: { id } });
  },
};
