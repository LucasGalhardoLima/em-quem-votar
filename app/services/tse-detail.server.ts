/**
 * Escrita da FICHA COMPLETA da candidatura no banco: bens declarados,
 * eleições anteriores, número do processo e aptidão.
 *
 * POR QUE NÃO FICA EM `tse-status.server.ts`
 *
 * Aquele módulo tem um contrato estreito e documentado no CLAUDE.md: o cron
 * "re-lê apenas a situação — nunca cria, apaga nem toca em outro campo".
 * Este aqui apaga e recria linhas de `SpendingRecord` e escreve em
 * `CandidateElectionHistory`. Misturar os dois borraria a garantia do cron e
 * deixaria a próxima pessoa a um import de distância de fazer o cron das
 * 12:00 reescrever patrimônio.
 *
 * POR QUE O PRISMA VEM POR PARÂMETRO
 *
 * O único consumidor hoje é `scripts/sync-tse-2026.ts`, que abre o próprio
 * `PrismaClient`. Importar `~/utils/db.server` aqui abriria um SEGUNDO — que
 * em dev conecta no load e deixa o processo pendurado, exatamente o motivo
 * pelo qual `~/lib/tse-divulga` é puro. Injetar o cliente mantém a lógica de
 * escrita num só lugar sem duplicar conexão.
 *
 * NENHUMA IA ENVOLVIDA: HTTP ao TSE (em `~/lib/tse-divulga`) e updates aqui.
 */
import type { PrismaClient } from "@prisma/client";

import { aptoFromDivulga } from "~/lib/candidate-status";
import { divulgaUrl, type DivulgaDetail } from "~/lib/tse-divulga";

/** Fonte gravada em cada `SpendingRecord` de bem declarado. */
export const DIVULGA_SOURCE = "TSE — DivulgaCandContas";

/**
 * Statements por lote. O banco é remoto (pooler da Supabase em us-west-2) e
 * cada ida e volta custa ~1s medido daqui, então o que importa é o NÚMERO de
 * statements, não o tamanho de cada um.
 */
const CHUNK = 500;

export interface DetailTarget {
  /** `Candidate.id` no nosso banco. */
  id: string;
  tseId: string;
  /** Unidade eleitoral: "BR" para presidente, a UF para governador. */
  sgUe: string | null;
  /** Só para mensagens de aviso. */
  label: string;
}

export interface DetailWriteResult {
  /** Candidaturas cuja ficha respondeu e foi processada. */
  applied: number;
  /**
   * Candidaturas sem ficha nesta execução. NADA delas foi tocado — nem
   * aptidão, nem bens, nem histórico.
   */
  skipped: number;
  /** Os três estados de `tseApto`, contados sobre as fichas que responderam. */
  apto: { apt: number; unapt: number; undecided: number };
  /** `tseApto`/`tseProcessNumber` que realmente mudaram. */
  candidatesUpdated: number;
  /** Bens que as fichas declaram agora. */
  assetsRead: number;
  /** Bens efetivamente regravados — só os de quem mudou. */
  assetsWritten: number;
  /**
   * Bens APAGADOS pela regravação. Sem este número uma destruição saía do
   * relatório idêntica a um run sem novidade: `assetsWritten` conta o que
   * entra, e zerar a declaração de alguém escreve zero linhas.
   */
  assetsDeleted: number;
  /**
   * Candidaturas cuja declaração de bens foi ZERADA nesta execução (tinham
   * linhas, a ficha diz `[]`). Pode ser legítimo — o TSE aceita declaração sem
   * bens —, mas é a operação mais destrutiva do sync e não pode passar calada.
   */
  assetsCleared: Array<{ tseId: string; label: string; removidos: number }>;
  /**
   * Fichas que responderam SEM a chave `bens`. O patrimônio delas não foi
   * tocado: ausência não é declaração de zero bens.
   */
  assetsAbsent: number;
  /** Bens sem data em nenhum dos dois níveis — não gravados, para conferência. */
  assetsSkippedNoDate: Array<{ tseId: string; label: string; descricao: string }>;
  /** Linhas de histórico que as fichas declaram. */
  historyRead: number;
  historyCreated: number;
  historyUpdated: number;
  processNumbers: number;
  /**
   * Fichas com processo de cassação ou desconstituição. Vazio nas 13
   * presidenciais em 27/08/2026 — por isso NÃO há modelo para isso no schema.
   * Sai no relatório para que a primeira ocorrência real seja vista por uma
   * pessoa, em vez de descartada em silêncio.
   *
   * shortcut: processosCassacao/processosDesconstituicao só são contados, não
   * modelados — upgrade: quando o primeiro aviso não-vazio aparecer, criar o
   * modelo e persistir a redação literal de cada processo.
   */
  withProceedings: Array<{
    tseId: string;
    label: string;
    cassacao: number;
    desconstituicao: number;
  }>;
}

/**
 * O que uma ficha lida pode escrever em `Candidate`.
 *
 * `tseApto` é o único campo sempre presente: ele tem os três estados dentro do
 * próprio valor (`true`/`false`/`null`), então gravá-lo nunca é um chute. Os
 * outros três são OPCIONAIS de propósito — a chave só existe quando a ficha
 * trouxe o dado. Uma chave ausente não sobrescreve; uma chave com `null`
 * sobrescreveria, e é justamente isso que não pode acontecer aqui.
 */
interface CandidateDetailUpdate {
  tseApto: boolean | null;
  tseProcessNumber?: string;
  /** Quantos bens a ficha declara. `0` é afirmação; ausência é omissão. */
  tseAssetsDeclared?: number;
  /** Idem, para candidaturas anteriores (já sem a própria candidatura). */
  tsePriorElectionsDeclared?: number;
}

interface AssetRow {
  candidateId: string;
  type: "DECLARED_ASSETS";
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  category: string | null;
  description: string | null;
  source: string;
  sourceUrl: string | null;
}

/** `YYYY-MM-DD` → `Date` em UTC. `null` para qualquer coisa que não seja isso. */
function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Assinatura de um conjunto de bens, para decidir se vale reescrever.
 * Ordenada, então a ordem em que o TSE devolve não conta como mudança.
 */
function assetSignature(
  items: Array<{
    amount: number;
    category: string | null;
    description: string | null;
    day: string;
  }>,
): string {
  return items
    .map(i => `${i.category ?? ""}|${i.description ?? ""}|${i.amount.toFixed(2)}|${i.day}`)
    .sort()
    .join("\n");
}

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Grava a ficha das candidaturas que responderam.
 *
 * CINCO RECUSAS DELIBERADAS
 *
 * 1. Ficha que não respondeu não escreve nada. A candidatura inteira é
 *    pulada — nem `tseApto`, nem bens, nem histórico. Uma queda do TSE não
 *    pode virar "esta pessoa não declarou bens" nem "candidatura inapta".
 * 2. Ficha que respondeu SEM a chave `bens` também não mexe nos bens. É a
 *    mesma regra da (1) um nível abaixo: resposta incompleta não é declaração
 *    de patrimônio zero. Só `bens: []` — a lista vazia explícita — apaga.
 * 3. `tseProcessNumber` só é gravado quando a ficha o traz. Ausência de um
 *    campo numa resposta não apaga o número já conferido. Vale igual para
 *    `tseAssetsDeclared`/`tsePriorElectionsDeclared`: a contagem só é escrita
 *    quando a ficha trouxe a lista — `null` fica de fora do update.
 * 4. Nada é parafraseado: `descricao` do bem e `situacaoTotalizacao` da
 *    eleição anterior vão literais para o banco.
 * 5. O que não mudou não é reescrito. Além de barato, é o que mantém o
 *    `createdAt` das linhas antigas — a data em que a plataforma passou a
 *    afirmar aquilo.
 *
 * Os bens de UMA candidatura são reescritos em bloco (apaga + cria) quando
 * mudam, porque uma declaração de bens é um conjunto, não um fluxo: item
 * retificado ou retirado tem de sumir, e o schema não tem chave única para
 * (candidato, ordem). O histórico é só create/update por
 * `(candidateId, tsePriorId)` — nunca destrutivo, como o resto do sync.
 *
 * As escritas são AGRUPADAS de propósito. O banco é remoto e cada statement
 * custa ~1s daqui; uma transação por candidatura fazia ~6 statements × 211
 * candidaturas e a etapa levava ~30 min. Em conjunto, uma execução sem
 * mudanças custa ~4 statements.
 */
export async function applyDivulgaDetails(
  prisma: PrismaClient,
  targets: DetailTarget[],
  details: Map<string, DivulgaDetail>,
  options: { dryRun?: boolean } = {},
): Promise<DetailWriteResult> {
  const dryRun = options.dryRun ?? false;

  const result: DetailWriteResult = {
    applied: 0,
    skipped: 0,
    apto: { apt: 0, unapt: 0, undecided: 0 },
    candidatesUpdated: 0,
    assetsRead: 0,
    assetsWritten: 0,
    assetsDeleted: 0,
    assetsCleared: [],
    assetsAbsent: 0,
    assetsSkippedNoDate: [],
    historyRead: 0,
    historyCreated: 0,
    historyUpdated: 0,
    processNumbers: 0,
    withProceedings: [],
  };

  // Só as candidaturas cuja ficha respondeu. As demais não entram em NENHUMA
  // das consultas abaixo — é assim que uma falha do TSE não toca no banco.
  const live = targets.filter(target => details.has(target.tseId));
  result.skipped = targets.length - live.length;
  result.applied = live.length;
  if (live.length === 0) return result;

  const ids = live.map(target => target.id);

  const [storedCandidates, storedAssets, storedHistory] = await Promise.all([
    prisma.candidate.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        tseApto: true,
        tseProcessNumber: true,
        tseAssetsDeclared: true,
        tsePriorElectionsDeclared: true,
      },
    }),
    prisma.spendingRecord.findMany({
      // `source` no filtro, aqui e no `deleteMany` lá embaixo, e nos dois pelo
      // mesmo motivo: o sync só é dono do que ele próprio gravou. Um bem
      // lançado à mão no /admin ou vindo de outra fonte não pode entrar na
      // assinatura (faria toda execução ver diferença) nem ser apagado por
      // uma regravação da ficha do TSE.
      where: { candidateId: { in: ids }, type: "DECLARED_ASSETS", source: DIVULGA_SOURCE },
      select: {
        candidateId: true,
        amount: true,
        category: true,
        description: true,
        periodEnd: true,
      },
    }),
    prisma.candidateElectionHistory.findMany({ where: { candidateId: { in: ids } } }),
  ]);

  const storedCandidateById = new Map(storedCandidates.map(c => [c.id, c]));

  const storedAssetsById = new Map<string, typeof storedAssets>();
  for (const asset of storedAssets) {
    const bucket = storedAssetsById.get(asset.candidateId) ?? [];
    bucket.push(asset);
    storedAssetsById.set(asset.candidateId, bucket);
  }

  const storedHistoryByKey = new Map(
    storedHistory.map(h => [`${h.candidateId}|${h.tsePriorId}`, h]),
  );

  const candidateUpdates: Array<{
    id: string;
    data: CandidateDetailUpdate;
  }> = [];
  const assetRewriteIds: string[] = [];
  const assetRows: AssetRow[] = [];
  const historyCreates: Array<{
    candidateId: string;
    tsePriorId: string;
    year: number;
    office: string;
    ue: string | null;
    party: string | null;
    resultLabel: string;
    sourceUrl: string | null;
  }> = [];
  const historyUpdates: Array<{ id: string; data: Omit<(typeof historyCreates)[number], "candidateId" | "tsePriorId"> }> = [];

  for (const target of live) {
    const detail = details.get(target.tseId) as DivulgaDetail;

    const apto = aptoFromDivulga(detail);
    if (apto === true) result.apto.apt++;
    else if (apto === false) result.apto.unapt++;
    else result.apto.undecided++;

    const data: CandidateDetailUpdate = { tseApto: apto };
    if (detail.numeroProcesso) {
      data.tseProcessNumber = detail.numeroProcesso;
      result.processNumbers++;
    }

    // As duas contagens seguem a MESMA regra do número do processo (recusa 3):
    // só entram no update quando a ficha as trouxe. `bensDeclarados === null`
    // é "a ficha respondeu sem a chave `bens`" — gravar isso apagaria uma
    // contagem já conferida e devolveria a página ao estado em que ela não
    // sabe se pode afirmar "o TSE não lista bem algum".
    if (detail.bensDeclarados !== null) data.tseAssetsDeclared = detail.bensDeclarados;
    if (detail.eleicoesAnterioresDeclaradas !== null) {
      data.tsePriorElectionsDeclared = detail.eleicoesAnterioresDeclaradas;
    }

    const stored = storedCandidateById.get(target.id);
    const aptoDiffers = !stored || stored.tseApto !== apto;
    const processDiffers =
      data.tseProcessNumber !== undefined &&
      (!stored || stored.tseProcessNumber !== data.tseProcessNumber);
    // Sem estas duas, uma execução em que SÓ a contagem mudou — a pessoa
    // retificou a declaração, o total de bens caiu a zero, a aptidão continua
    // a mesma — não gravaria nada, e a página seguiria exibindo a contagem
    // velha como se fosse a da ficha atual.
    const assetsCountDiffers =
      data.tseAssetsDeclared !== undefined &&
      (!stored || stored.tseAssetsDeclared !== data.tseAssetsDeclared);
    const priorCountDiffers =
      data.tsePriorElectionsDeclared !== undefined &&
      (!stored || stored.tsePriorElectionsDeclared !== data.tsePriorElectionsDeclared);
    if (aptoDiffers || processDiffers || assetsCountDiffers || priorCountDiffers) {
      candidateUpdates.push({ id: target.id, data });
    }

    // ---- bens ----
    //
    // `detail.bens === null` significa que a ficha respondeu SEM a chave
    // `bens` — ausência, não "declarou zero bens". Tratar as duas igual armava
    // o `deleteMany` abaixo contra o patrimônio de uma pessoa real a partir de
    // uma resposta incompleta do TSE. Ver `parseDivulgaDetail`.
    if (detail.bens === null) {
      result.assetsAbsent++;
    } else {
      const fichaUrl = divulgaUrl(target.sgUe, target.tseId);
      const declaradoEm = parseIsoDate(detail.atualizadoEm);
      const rows: AssetRow[] = [];
      for (const bem of detail.bens) {
        const dia = parseIsoDate(bem.atualizadoEm) ?? declaradoEm;
        if (!dia) {
          // Sem data não há período honesto a gravar, e `periodStart`/`periodEnd`
          // são obrigatórios. Carimbar "hoje" inventaria quando o patrimônio foi
          // declarado.
          result.assetsSkippedNoDate.push({
            tseId: target.tseId,
            label: target.label,
            descricao: bem.descricao,
          });
          continue;
        }
        rows.push({
          candidateId: target.id,
          type: "DECLARED_ASSETS",
          amount: bem.valor,
          periodStart: dia,
          periodEnd: dia,
          category: bem.tipo,
          description: bem.descricao,
          source: DIVULGA_SOURCE,
          sourceUrl: fichaUrl,
        });
      }
      result.assetsRead += rows.length;

      const guardados = storedAssetsById.get(target.id) ?? [];
      const before = assetSignature(
        guardados.map(a => ({
          amount: Number(a.amount),
          category: a.category,
          description: a.description,
          day: isoDay(a.periodEnd),
        })),
      );
      const after = assetSignature(
        rows.map(r => ({
          amount: r.amount,
          category: r.category,
          description: r.description,
          day: isoDay(r.periodEnd),
        })),
      );
      if (before !== after) {
        assetRewriteIds.push(target.id);
        assetRows.push(...rows);
        result.assetsWritten += rows.length;
        result.assetsDeleted += guardados.length;
        if (guardados.length > 0 && rows.length === 0) {
          result.assetsCleared.push({
            tseId: target.tseId,
            label: target.label,
            removidos: guardados.length,
          });
        }
      }
    }

    // ---- histórico eleitoral ----
    result.historyRead += detail.eleicoesAnteriores.length;
    for (const eleicao of detail.eleicoesAnteriores) {
      const fields = {
        year: eleicao.year,
        office: eleicao.office,
        ue: eleicao.ue,
        party: eleicao.party,
        resultLabel: eleicao.resultLabel,
        sourceUrl: eleicao.sourceUrl,
      };
      const existing = storedHistoryByKey.get(`${target.id}|${eleicao.tsePriorId}`);
      if (!existing) {
        historyCreates.push({
          candidateId: target.id,
          tsePriorId: eleicao.tsePriorId,
          ...fields,
        });
        result.historyCreated++;
      } else if (
        existing.year !== fields.year ||
        existing.office !== fields.office ||
        existing.ue !== fields.ue ||
        existing.party !== fields.party ||
        existing.resultLabel !== fields.resultLabel ||
        existing.sourceUrl !== fields.sourceUrl
      ) {
        historyUpdates.push({ id: existing.id, data: fields });
        result.historyUpdated++;
      }
    }

    if (detail.processosCassacao > 0 || detail.processosDesconstituicao > 0) {
      result.withProceedings.push({
        tseId: target.tseId,
        label: target.label,
        cassacao: detail.processosCassacao,
        desconstituicao: detail.processosDesconstituicao,
      });
    }
  }

  result.candidatesUpdated = candidateUpdates.length;

  if (dryRun) return result;

  // A ORDEM IMPORTA. Bens e histórico primeiro, o update de `Candidate` por
  // último. É nesse update que vão as duas CONTAGENS, e é delas que
  // `/candidato/:id` tira o direito de afirmar "a ficha do TSE não lista bem
  // algum". Escrevendo-as depois das linhas, uma interrupção no meio da etapa
  // deixa a contagem ausente — e a página cai na redação fraca, que é a
  // leitura verdadeira. Na ordem inversa, ela afirmaria sobre uma pessoa real
  // que o TSE não lista patrimônio algum enquanto o patrimônio dela apenas
  // não chegou a ser gravado.

  // Apaga e recria na MESMA transação, e só de quem mudou: em nenhum instante
  // a candidatura fica sem os bens que declarou.
  if (assetRewriteIds.length > 0) {
    await prisma.$transaction([
      prisma.spendingRecord.deleteMany({
        where: {
          candidateId: { in: assetRewriteIds },
          type: "DECLARED_ASSETS",
          source: DIVULGA_SOURCE,
        },
      }),
      ...chunked(assetRows, CHUNK).map(batch =>
        prisma.spendingRecord.createMany({ data: batch }),
      ),
    ]);
  }

  // `skipDuplicates` porque a chave `(candidateId, tsePriorId)` é única e o
  // lote é montado a partir de uma leitura feita ANTES: duas execuções
  // concorrentes (o cron e uma execução manual, por exemplo) fariam a segunda
  // abortar o lote inteiro num P2002. Uma linha já existente não é erro —
  // é o resultado que se queria.
  for (const batch of chunked(historyCreates, CHUNK)) {
    await prisma.candidateElectionHistory.createMany({ data: batch, skipDuplicates: true });
  }

  for (const batch of chunked(historyUpdates, CHUNK)) {
    await prisma.$transaction(
      batch.map(update =>
        prisma.candidateElectionHistory.update({
          where: { id: update.id },
          data: update.data,
        }),
      ),
    );
  }

  for (const batch of chunked(candidateUpdates, CHUNK)) {
    await prisma.$transaction(
      batch.map(update =>
        prisma.candidate.update({ where: { id: update.id }, data: update.data }),
      ),
    );
  }

  return result;
}
