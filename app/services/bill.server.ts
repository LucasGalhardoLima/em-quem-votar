import { db } from "~/utils/db.server";
import type { Prisma } from "@prisma/client";

interface ListApprovedParams {
  query?: string | null;
  source?: string | null;
  limit?: number;
}

/**
 * Chave canônica de um tipo de voto.
 *
 * POR QUE NORMALIZAR EM VEZ DE COMPARAR COM `===`
 *
 * As duas tabelas alimentam o MESMO placar, e a grafia que chega depende da
 * fonte. `VoteLog` vem de `scripts/sync-votacoes.ts`, que grava
 * `voto.tipoVoto.toUpperCase()` — verificado no banco em 27/08/2026:
 * `SIM` 12.666 · `NÃO` 9.720 · `ABSTENÇÃO` 73 · `OBSTRUÇÃO` 27 ·
 * `ARTIGO 17` 38. `VoteRecord` está vazia e o schema agora documenta a mesma
 * convenção em caixa alta; a normalização continua sendo o certo porque o
 * acento e a caixa vêm da API da Câmara, não de uma escolha nossa — a Câmara
 * pode devolver "Não" amanhã sem avisar ninguém.
 *
 * Comparar com `===` contra UMA das convenções zera a outra: era exatamente
 * isso que fazia a página da PEC 45/2019 anunciar "Abstenção: 0" com duas
 * abstenções na lista nominal logo abaixo. Normalizar (sem acento, sem caixa,
 * sem espaço sobrando) faz o placar tolerar as duas grafias sem que nenhum dos
 * dois modelos precise mudar.
 */
function voteKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/**
 * Placar de várias votações de uma vez, para a listagem.
 *
 * Lê os DOIS modelos de voto e agrupa pela mesma `voteKey()` que `getById`
 * usa. Contar só `voteLog` seria suficiente hoje — `voteRecord` está vazio —,
 * mas um card que conta uma fonte e uma página que conta duas divergiriam no
 * dia em que a segunda fosse populada, e a divergência apareceria como número
 * errado sobre uma votação real, não como erro de código.
 *
 * `outros` é uma CONTAGEM, não uma lista de rótulos: o card não tem espaço
 * para exibir cada grafia, mas também não pode descartá-las — foi assim que
 * `ARTIGO 17` sumia do placar da página de detalhe. Com ela na conta,
 * `sim + nao + abstencao + obstrucao + outros === total` sempre fecha.
 *
 * Duas consultas agregadas para a página inteira, não uma por card.
 */
async function tallyByBill(ids: string[]) {
  const out = new Map<
    string,
    {
      sim: number;
      nao: number;
      abstencao: number;
      obstrucao: number;
      outros: number;
      total: number;
    }
  >();
  if (ids.length === 0) return out;

  const [logs, records] = await Promise.all([
    db.voteLog.groupBy({
      by: ["billId", "voteType"],
      where: { billId: { in: ids } },
      _count: { _all: true },
    }),
    db.voteRecord.groupBy({
      by: ["billId", "voteType"],
      where: { billId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  for (const row of [...logs, ...records]) {
    const entry = out.get(row.billId) ?? {
      sim: 0,
      nao: 0,
      abstencao: 0,
      obstrucao: 0,
      outros: 0,
      total: 0,
    };
    const n = row._count._all;
    const key = voteKey(row.voteType);
    if (key === "SIM") entry.sim += n;
    else if (key === "NAO") entry.nao += n;
    else if (key === "ABSTENCAO") entry.abstencao += n;
    else if (key === "OBSTRUCAO") entry.obstrucao += n;
    else entry.outros += n;
    entry.total += n;
    out.set(row.billId, entry);
  }

  return out;
}

export const BillService = {
  /**
   * Só o que o `<head>` de `/votacao/:id` precisa — título, resumo e casa.
   *
   * Existe porque `meta()` roda ANTES de qualquer promise deferida resolver:
   * a rota não consegue ler o `bill` que está streamando, e sem isto as
   * páginas de votação saíam todas com o mesmo `<title>`. A saída é uma
   * deferição parcial, e este é o lado resolvido dela: uma consulta por
   * chave primária, sem os milhares de votos nominais que `getById` junta.
   *
   * Mesmo recorte `status: "approved"` de `getById`, de propósito: uma
   * votação ainda não publicada não pode ganhar `<title>` e descrição de
   * página existente enquanto o corpo mostra "não encontrada".
   */
  async getHead(id: string) {
    return db.bill.findFirst({
      where: { id, status: "approved" },
      select: {
        title: true,
        simplifiedTitle: true,
        // `simplifiedDescription` vem junto porque a descrição da página é
        // ela OU `description` como reserva — sem as duas, metade das
        // votações cairia no texto genérico.
        simplifiedDescription: true,
        description: true,
        sourceType: true,
      },
    });
  },

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

    // Um único apanhado dos dois modelos, agrupado pela chave canônica. A
    // primeira grafia encontrada é guardada como rótulo: o que a página exibir
    // sobre um voto é a redação literal da fonte, nunca uma paráfrase nossa.
    const tally = new Map<string, { label: string; count: number }>();
    for (const raw of [
      ...candidateVotes.map((v) => v.voteType),
      ...legacyVotes.map((v) => v.voteType),
    ]) {
      const key = voteKey(raw);
      const entry = tally.get(key);
      if (entry) entry.count += 1;
      else tally.set(key, { label: raw, count: 1 });
    }

    const countVotes = (key: string) => tally.get(key)?.count ?? 0;

    /**
     * Todo tipo de voto que não cabe nos quatro cards conhecidos.
     *
     * NÃO PODE SUMIR. O caso real é `ARTIGO 17`: 38 registros no banco,
     * espalhados por 37 votações, um por votação em 36 delas (verificado em
     * 27/08/2026). É a grafia literal que a Câmara devolve em `tipoVoto` e que
     * `sync-votacoes.ts` grava em caixa alta. Enquanto os quatro cards fixos
     * eram a única saída, esses votos eram lidos do banco e descartados em
     * silêncio — a soma do placar não fechava com a lista nominal e nada na
     * tela dizia por quê. Aqui eles saem com o rótulo da fonte e a contagem,
     * para a página mostrar em vez de esconder.
     */
    const outros = Array.from(tally.entries())
      .filter(
        ([key]) => !["SIM", "NAO", "ABSTENCAO", "OBSTRUCAO"].includes(key),
      )
      .map(([, entry]) => entry)
      .sort(
        (a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"),
      );

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
        nao: countVotes("NAO"),
        abstencao: countVotes("ABSTENCAO"),
        obstrucao: countVotes("OBSTRUCAO"),
        /** Rótulo literal da fonte + contagem, para o que não é um dos quatro acima. */
        outros,
        /** Todos os votos registrados nesta votação. `sim+nao+abstencao+obstrucao+outros` fecha com ele. */
        total: candidateVotes.length + legacyVotes.length,
      },
    };
  },

  /**
   * A página de votações, com o total real ao lado da fatia devolvida.
   *
   * POR QUE O `total` VIAJA JUNTO
   *
   * O `take` sempre existiu, mas a rota recebia só o array: com mais de
   * `limit` votações aprovadas, as mais antigas sumiam da tela sem que nada
   * dissesse que existiam. Uma lista que parece completa e não é afirma algo
   * falso sobre o acervo — o mesmo defeito que a regra "dado ausente é
   * renderizado como ausente" proíbe em cima de uma candidatura.
   *
   * O `count` usa o MESMO `where` da busca, então o número acompanha o filtro:
   * com um termo digitado ele é o total daquele termo, não o do banco inteiro.
   *
   * shortcut: a fatia é sempre a primeira — quem quiser as antigas depende da
   * busca e do filtro de casa. Hoje isso não corta nada (8 votações aprovadas
   * de 58 no banco em 28/08/2026), mas as 48 pendentes cabem dentro de um
   * `approve` — upgrade: paginar por `?page=`, quando `total` passar de
   * `limit`.
   */
  async listApproved({ query, source, limit = 50 }: ListApprovedParams = {}) {
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

    const [bills, total] = await Promise.all([
      db.bill.findMany({
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
      }),
      db.bill.count({ where }),
    ]);

    const tallies = await tallyByBill(bills.map((b) => b.id));

    return {
      bills: bills.map((b) => ({
        ...b,
        voteDate: b.voteDate.toISOString(),
        /** Placar da votação. `null` = nenhum voto registrado para ela. */
        summary: tallies.get(b.id) ?? null,
      })),
      /** Quantas votações atendem ao filtro — não quantas foram devolvidas. */
      total,
    };
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
